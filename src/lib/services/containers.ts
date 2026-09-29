import "server-only";

import {
  getStore,
  type Container,
  type ContainerItem,
  type ContainerStatus,
  type User,
} from "@/lib/db";
import { assertWellmix } from "@/lib/auth/permissions";
import {
  boxCbm,
  boxesFor,
  commercialSplit,
  containerUsage,
  type CommercialSplit,
  type ContainerUsage,
} from "@/lib/logistics/cbm";
import { getSettings } from "@/lib/settings";
import { audit } from "./audit";
import { openReview, resolveReviews } from "./reviews";

/**
 * Container: capacidade por tipo (configurável), itens com caixas e CBM,
 * ocupação determinística e regra de consolidação (docs/EVOLUTION_PLAN.md):
 * vários produtos do MESMO cliente podem dividir o container; clientes diferentes
 * só manualmente, e apenas se settings.containerAllowMultiCustomer permitir.
 */
export class ContainerError extends Error {}

export async function createContainer(
  user: User,
  input: {
    code: string;
    type: string;
    customerId?: string | null;
    capacityCbm?: number | null;
    maxWeightKg?: number | null;
    etd?: string | null;
    eta?: string | null;
    notes?: string | null;
  },
): Promise<Container> {
  assertWellmix(user);
  const settings = await getSettings();
  const type = settings.containerTypes.find((t) => t.code === input.type);
  if (!type && !input.capacityCbm) throw new ContainerError("container_type");
  const container = await getStore().create("containers", {
    code: input.code,
    type: input.type,
    capacityCbm: input.capacityCbm ?? type?.capacityCbm ?? 0,
    maxWeightKg: input.maxWeightKg ?? type?.maxWeightKg ?? null,
    customerId: input.customerId ?? null,
    status: "planning",
    etd: input.etd ?? null,
    eta: input.eta ?? null,
    notes: input.notes ?? null,
    createdByUserId: user.id,
  });
  await audit(
    user,
    "container.create",
    "container",
    container.id,
    `${container.code} (${container.type})`,
  );
  return container;
}

export async function updateContainer(
  user: User,
  id: string,
  patch: Partial<
    Pick<
      Container,
      | "code"
      | "type"
      | "capacityCbm"
      | "maxWeightKg"
      | "customerId"
      | "status"
      | "etd"
      | "eta"
      | "notes"
    >
  >,
) {
  assertWellmix(user);
  const container = await getStore().update("containers", id, patch);
  await audit(user, "container.update", "container", id, container.code);
  await checkContainerGates(user, id);
  return container;
}

export async function setContainerStatus(
  user: User,
  id: string,
  status: ContainerStatus,
) {
  return updateContainer(user, id, { status });
}

/**
 * Adiciona um item. Dados de caixa vêm do produto quando não informados:
 * unidades por caixa = masterBoxQty; CBM por caixa = cbm do produto (ou das dimensões da caixa);
 * peso por caixa = peso bruto unitário × unidades por caixa.
 */
export async function addContainerItem(
  user: User,
  containerId: string,
  input: {
    orderId?: string | null;
    orderItemId?: string | null;
    productId?: string | null;
    name?: string | null;
    quantity: number;
    unit?: string | null;
    unitsPerBox?: number | null;
    boxCount?: number | null;
    cbmPerBox?: number | null;
    weightPerBoxKg?: number | null;
  },
): Promise<ContainerItem> {
  assertWellmix(user);
  const store = getStore();
  const settings = await getSettings();
  const container = await store.get("containers", containerId);
  if (!container) throw new ContainerError("container_not_found");
  if (container.status === "closed")
    throw new ContainerError("container_closed");

  const order = input.orderId ? await store.get("orders", input.orderId) : null;
  if (input.orderId && !order) throw new ContainerError("order_not_found");
  // Regra de consolidação: não misturar clientes sem permissão explícita.
  if (order) {
    if (!container.customerId) {
      await store.update("containers", containerId, {
        customerId: order.customerId,
      });
    } else if (
      container.customerId !== order.customerId &&
      !settings.containerAllowMultiCustomer
    ) {
      throw new ContainerError("container_other_customer");
    }
  }
  const orderItem = input.orderItemId
    ? await store.get("order_items", input.orderItemId)
    : null;
  const productId = input.productId ?? orderItem?.productId ?? null;
  const product = productId ? await store.get("products", productId) : null;

  const unitsPerBox = input.unitsPerBox ?? product?.masterBoxQty ?? null;
  const quantity =
    input.quantity > 0 ? input.quantity : (orderItem?.quantity ?? 0);
  if (!(quantity > 0)) throw new ContainerError("quantity_required");
  const boxCount = input.boxCount ?? boxesFor(quantity, unitsPerBox);
  const cbmPerBox = input.cbmPerBox ?? (product ? boxCbm(product) : null);
  if (!(boxCount > 0)) throw new ContainerError("box_count_required");
  if (!cbmPerBox || cbmPerBox <= 0) throw new ContainerError("cbm_required");
  const weightPerBoxKg =
    input.weightPerBoxKg ??
    (product?.grossWeightKg && unitsPerBox
      ? Math.round(product.grossWeightKg * unitsPerBox * 100) / 100
      : null);

  const item = await store.create("container_items", {
    containerId,
    orderId: input.orderId ?? null,
    orderItemId: input.orderItemId ?? null,
    productId,
    name: input.name || orderItem?.name || product?.name || "Item",
    quantity,
    unit: input.unit || orderItem?.unit || "un",
    unitsPerBox,
    boxCount,
    cbmPerBox,
    weightPerBoxKg,
  });
  await audit(
    user,
    "container.addItem",
    "container",
    containerId,
    `${item.name}: ${boxCount} cx, ${cbmPerBox} m³/cx`,
  );
  await checkContainerGates(user, containerId);
  return item;
}

export async function removeContainerItem(user: User, itemId: string) {
  assertWellmix(user);
  const store = getStore();
  const item = await store.get("container_items", itemId);
  if (!item) return;
  await store.remove("container_items", itemId);
  await audit(
    user,
    "container.removeItem",
    "container",
    item.containerId,
    item.name,
  );
  await checkContainerGates(user, item.containerId);
}

/** Gates: CBM acima da capacidade ou peso acima do máximo entram na fila de revisão. */
async function checkContainerGates(user: User, containerId: string) {
  const data = await loadContainer(containerId);
  if (!data) return;
  const link = `/app/containers/${containerId}`;
  const settings = await getSettings();
  if (
    data.usage.overCapacity ||
    data.usage.occupancyPercent > settings.containerMaxOccupancyPercent
  ) {
    await openReview(user, {
      entity: "container",
      entityId: containerId,
      rule: "container.overCapacity",
      problem: `Container ${data.container.code} acima da ocupação permitida`,
      expected: `≤ ${settings.containerMaxOccupancyPercent}% de ${data.container.capacityCbm} m³`,
      found: `${data.usage.occupancyPercent}% (${data.usage.totalCbm} m³)`,
      responsibleRole: "operator",
      action: "Remover itens ou trocar o tipo de container.",
      link,
    });
  } else {
    await resolveReviews(user, "container", containerId, {
      rulePrefix: "container.overCapacity",
    });
  }
  if (data.usage.overWeight) {
    await openReview(user, {
      entity: "container",
      entityId: containerId,
      rule: "container.overWeight",
      problem: `Container ${data.container.code} acima do peso máximo`,
      expected: `≤ ${data.container.maxWeightKg} kg`,
      found: `${data.usage.totalWeightKg} kg`,
      responsibleRole: "operator",
      action: "Reduzir carga ou revisar pesos por caixa.",
      link,
    });
  } else {
    await resolveReviews(user, "container", containerId, {
      rulePrefix: "container.overWeight",
    });
  }
}

export interface ContainerView {
  container: Container;
  items: ContainerItem[];
  usage: ContainerUsage;
  split: CommercialSplit;
  customerName: string | null;
  /** Valor de venda dos pedidos presentes (moeda do primeiro), para a visão comercial. */
  soldValue: number;
  soldCurrency: string;
  orderNumbers: Record<string, number>;
}

export async function loadContainer(id: string): Promise<ContainerView | null> {
  const store = getStore();
  const container = await store.get("containers", id);
  if (!container) return null;
  const items = await store.list("container_items", {
    filter: { containerId: id },
  });
  const orderIds = [
    ...new Set(items.map((i) => i.orderId).filter((x): x is string => !!x)),
  ];
  const orders = orderIds.length
    ? await store.list("orders", { filter: { id: orderIds } })
    : [];
  const customer = container.customerId
    ? await store.get("parties", container.customerId)
    : null;
  const soldCurrency = orders[0]?.sellCurrency ?? "BRL";
  const soldValue = orders
    .filter((o) => (o.sellCurrency ?? "BRL") === soldCurrency)
    .reduce((s, o) => s + (o.sellPrice ?? 0), 0);
  return {
    container,
    items,
    usage: containerUsage(items, container.capacityCbm, container.maxWeightKg),
    split: commercialSplit(items),
    customerName: customer?.name ?? null,
    soldValue,
    soldCurrency,
    orderNumbers: Object.fromEntries(orders.map((o) => [o.id, o.number])),
  };
}

export async function listContainers(
  filter: { customerId?: string; status?: ContainerStatus[] } = {},
) {
  const store = getStore();
  const containers = await store.list("containers", {
    filter: {
      ...(filter.customerId ? { customerId: filter.customerId } : {}),
      ...(filter.status ? { status: filter.status } : {}),
    },
    orderBy: "createdAt",
    direction: "desc",
  });
  const items = await store.list("container_items");
  const parties = await store.list("parties");
  return containers.map((c) => {
    const mine = items.filter((i) => i.containerId === c.id);
    return {
      container: c,
      itemCount: mine.length,
      usage: containerUsage(mine, c.capacityCbm, c.maxWeightKg),
      split: commercialSplit(mine),
      customerName: parties.find((p) => p.id === c.customerId)?.name ?? null,
    };
  });
}

/** Containers em que um pedido está (para a tela do pedido e o isolamento do cliente). */
export async function containersForOrder(orderId: string) {
  const store = getStore();
  const items = await store.list("container_items", { filter: { orderId } });
  const ids = [...new Set(items.map((i) => i.containerId))];
  return ids.length ? store.list("containers", { filter: { id: ids } }) : [];
}
