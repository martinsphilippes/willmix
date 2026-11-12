import "server-only";

import { buildPurchaseRounds } from "@/lib/purchase-rounds";
import { assertCan } from "@/lib/auth/function-access";

import { assertWellmix } from "@/lib/auth/permissions";
import { assertScreen } from "@/lib/auth/screens";
import {
  getStore,
  ORDER_EXTRA_DEFAULTS,
  REQUEST_EXTRA_DEFAULTS,
  type Order,
  type Party,
  type Product,
  type Requirement,
  type SupplierRequest,
  type User,
} from "@/lib/db";
import {
  LANE_KEYS,
  baseKeyOf,
  blockedBy,
  itemIdOf,
  laneKey,
  laneOf,
  type LaneSla,
} from "@/lib/purchase-lanes";
import { ROLE_PARTY_FIELD } from "@/lib/workflow/stages";
import { samplingApproved } from "@/lib/supplier-request-sampling";
import { audit } from "./audit";

/*
 * Pedido de compra (docs/PURCHASE_ORDER.md). Depois da solicitação ao
 * fornecedor aprovada e do produto vencedor cadastrado, a Wellmix junta num
 * pedido os produtos aprovados do mesmo fornecedor. O comprador é a própria
 * Wellmix (CODEMP do Sankhya, a WELLMIX - SC). O pedido nasce com o fluxo "supplier_request":
 * "Pedido criado" conclui na hora e a Preparação traz as três raias em
 * paralelo (fornecedor, agência de arte, certificadora); depois, o contrato
 * assinado e carimbado pelas duas partes.
 */

export class PurchaseOrderError extends Error {}

/** Produtos por pedido (cada um ganha os itens das três raias). */
export const PURCHASE_ORDER_MAX_ITEMS = 30;

export interface PurchaseCandidate {
  request: SupplierRequest;
  product: Product;
}

export interface PurchaseCandidateGroup {
  supplier: Party | null;
  supplierId: string;
  candidates: PurchaseCandidate[];
}

/**
 * Solicitações aprovadas com produto cadastrado e ainda fora de pedido,
 * agrupadas por fornecedor. `null`: tabelas sem publicar.
 */
export async function listPurchaseCandidates(
  user: User,
): Promise<PurchaseCandidateGroup[] | null> {
  assertWellmix(user);
  assertScreen(user, "orders");
  const store = getStore();
  let rows: SupplierRequest[];
  try {
    rows = await store.list("supplier_requests", {
      filter: { status: "approved" },
    });
  } catch (error) {
    const { isSchemaMissing } = await import("@/lib/db/errors");
    if (isSchemaMissing(error)) return null;
    throw error;
  }
  // Só com a amostra aprovada (docs/SUPPLIER_SAMPLING.md).
  const open = rows.filter(
    (r) => r.productId && !r.orderId && samplingApproved(r),
  );
  if (!open.length) return [];
  const productIds = [...new Set(open.map((r) => r.productId!))];
  const supplierIds = [...new Set(open.map((r) => r.supplierId))];
  const [products, parties] = await Promise.all([
    store.list("products", { filter: { id: productIds } }),
    store.list("parties", { filter: { id: supplierIds } }),
  ]);
  const groups = new Map<string, PurchaseCandidateGroup>();
  for (const request of [...open].sort((a, b) => a.number - b.number)) {
    const product = products.find((p) => p.id === request.productId);
    if (!product) continue;
    const group = groups.get(request.supplierId) ?? {
      supplierId: request.supplierId,
      supplier: parties.find((p) => p.id === request.supplierId) ?? null,
      candidates: [],
    };
    group.candidates.push({ request, product });
    groups.set(request.supplierId, group);
  }
  return [...groups.values()].sort((a, b) =>
    (a.supplier?.name ?? "").localeCompare(b.supplier?.name ?? "", "pt"),
  );
}

/**
 * O comprador (cliente do pedido): a própria Wellmix, a empresa que emite o
 * pedido de compra no Sankhya (CODEMP, hoje 3: WELLMIX - SC). É o cadastro
 * de cliente com esse código do Sankhya. Clientes terceiros só virão com a
 * vitrine.
 */
export async function purchaseOrderCustomer(): Promise<Party | null> {
  const { getSankhyaErpSettings } =
    await import("@/lib/integrations/sankhya-settings");
  const codEmp = (await getSankhyaErpSettings()).codEmp ?? 3;
  const rows = await getStore().list("parties", {
    filter: { type: "customer", sankhyaCode: String(codEmp) },
  });
  return (
    rows
      .filter((p) => p.active)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0] ?? null
  );
}

export interface PurchaseOrderLine {
  requestId: string;
  /** Peças; vazio = a quantidade da solicitação. */
  quantity: number | null;
}

/**
 * Gera o pedido de compra com os produtos aprovados de um fornecedor. Preço,
 * moeda, MOQ e prazo vêm da resposta negociada; todos na mesma moeda.
 */
export async function createPurchaseOrder(
  user: User,
  lines: PurchaseOrderLine[],
): Promise<Order> {
  assertWellmix(user);
  assertScreen(user, "orders");
  assertCan(user, "purchaseOrder.generate");
  if (!lines.length)
    throw new PurchaseOrderError("purchase_order_choose_items");
  if (lines.length > PURCHASE_ORDER_MAX_ITEMS)
    throw new PurchaseOrderError("purchase_order_too_many");
  const store = getStore();
  const ids = [...new Set(lines.map((l) => l.requestId))];
  const requests = await store.list("supplier_requests", {
    filter: { id: ids },
  });
  if (requests.length !== ids.length) throw new PurchaseOrderError("not_found");
  for (const r of requests) {
    if (r.status !== "approved" || !r.productId)
      throw new PurchaseOrderError("purchase_order_not_ready");
    if (!samplingApproved(r))
      throw new PurchaseOrderError("purchase_order_sampling_pending");
    if (r.orderId) throw new PurchaseOrderError("purchase_order_taken");
  }
  const supplierId = requests[0].supplierId;
  if (requests.some((r) => r.supplierId !== supplierId))
    throw new PurchaseOrderError("purchase_order_one_supplier");
  const currency = requests[0].supplierCurrency ?? requests[0].item.currency;
  if (
    requests.some(
      (r) => (r.supplierCurrency ?? r.item.currency) !== currency,
    ) ||
    !currency
  )
    throw new PurchaseOrderError("purchase_order_currency_mixed");
  const customer = await purchaseOrderCustomer();
  if (!customer)
    throw new PurchaseOrderError("purchase_order_customer_missing");
  const products = await store.list("products", {
    filter: { id: requests.map((r) => r.productId!) },
  });

  const ordered = ids.map((id) => {
    const request = requests.find((r) => r.id === id)!;
    const product = products.find((p) => p.id === request.productId)!;
    // Com programação de compra, o total é a soma das rodadas (não se ajusta aqui).
    const asked = request.schedule?.items.length
      ? null
      : (lines.find((l) => l.requestId === id)?.quantity ?? null);
    const quantity = Math.round(asked ?? request.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1e9)
      throw new PurchaseOrderError("purchase_order_qty_invalid");
    const unitPrice = request.supplierPrice ?? request.item.price ?? null;
    return { request, product, quantity, unitPrice };
  });
  if (ordered.some((o) => !o.product))
    throw new PurchaseOrderError("purchase_order_not_ready");
  // Programação de compra (docs/PURCHASE_SCHEDULE.md): o pedido vira o pai e
  // cada rodada nasce como pedido filho no dia combinado.
  const planned = buildPurchaseRounds(
    ordered.map((o) => ({
      productId: o.product.id,
      schedule: o.request.schedule ?? null,
    })),
  );
  if ("error" in planned) throw new PurchaseOrderError(planned.error);
  const rounds = planned.rounds;
  const fobTotal = ordered.every((o) => o.unitPrice !== null)
    ? ordered.reduce((sum, o) => sum + o.unitPrice! * o.quantity, 0)
    : null;
  const first = ordered[0];
  const summary = ordered
    .map((o) => `nº ${o.request.number} (${o.product.name})`)
    .join(", ");

  // A solicitação do pedido (o pedido sempre tem uma): já nasce "pedido".
  const backing = await store.create("requests", {
    ...REQUEST_EXTRA_DEFAULTS,
    customerId: customer.id,
    createdByUserId: user.id,
    productId: first.product.id,
    productName: first.product.name,
    description: `Pedido de compra das solicitações ao fornecedor ${summary}`,
    specification: null,
    quantity: first.quantity,
    unit: "pcs",
    deadline: null,
    status: "ORDERED",
    orderId: null,
    sellPrice: null,
    sellCurrency: null,
    downPaymentAmount: null,
    notes: null,
    origin: "supplier_request",
    ownerUserId: user.id,
  });
  const order = await store.create("orders", {
    ...ORDER_EXTRA_DEFAULTS,
    number: await store.nextNumber("order_number"),
    requestId: backing.id,
    customerId: customer.id,
    supplierId,
    lineId: first.product.lineId ?? null,
    status: "ORDER_CREATED",
    currentStageId: null,
    fobTotal,
    fobCurrency: currency,
    sellPrice: null,
    sellCurrency: null,
    erpSyncStatus: "pending",
    erpNumber: null,
    agencyId: null,
    brokerId: null,
    shippingLineId: null,
    carrierId: null,
    closedAt: null,
    notes: null,
    ownerUserId: user.id,
    flow: "supplier_request",
    ...(rounds ? { purchaseRounds: rounds } : {}),
  });
  await store.update("requests", backing.id, { orderId: order.id });
  for (const o of ordered)
    await store.create("order_items", {
      orderId: order.id,
      productId: o.product.id,
      name: o.product.name,
      quantity: o.quantity,
      unit: "pcs",
      unitPrice: o.unitPrice,
    });
  for (const o of ordered)
    await store.update("supplier_requests", o.request.id, {
      orderId: order.id,
    });
  const { snapshotOrderPaymentTerms } = await import("./supplier-terms");
  await snapshotOrderPaymentTerms(order);
  const { assignDefaultPartners } = await import("./requests");
  await assignDefaultPartners(order);
  await audit(
    user,
    "order.create_purchase",
    "order",
    order.id,
    `Pedido de compra #${order.number}: ${ordered.length} produto(s) de ${supplierId}, ${summary}${rounds ? `; pedido pai de ${rounds.length} rodadas (${rounds.map((r) => r.expectedAt).join(", ")})` : ""}`,
  );
  const { createStagesForOrder } = await import("@/lib/workflow/engine");
  const fresh = (await store.get("orders", order.id)) ?? order;
  await createStagesForOrder(fresh);
  return (await store.get("orders", order.id)) ?? fresh;
}

/* ------------------------------------------------------------------------ */
/* Avisos das raias                                                          */
/* ------------------------------------------------------------------------ */

type Target =
  | { role: "admin" | "operator" | ("admin" | "operator")[] }
  | { role: Requirement["role"]; partyId: string };

/** Quem age num requisito: o parceiro do pedido ou, sem ele, a Wellmix. */
function targetOf(order: Order, role: Requirement["role"]): Target {
  const field = ROLE_PARTY_FIELD[role];
  const partyId = field ? order[field] : null;
  if (role === "operator" || role === "admin" || !partyId)
    return { role: ["admin", "operator"] };
  return { role, partyId };
}

async function send(
  order: Order,
  role: Requirement["role"],
  subjectKey: string,
  bodyKey: string,
  vars: Record<string, string | number>,
) {
  const { notify } = await import("./notifications");
  await notify(targetOf(order, role) as Parameters<typeof notify>[0], {
    kind: "action",
    link: `/app/orders/${order.id}`,
    text: (t) => ({
      subject: t(subjectKey as never, { n: order.number, ...vars }),
      body: t(bodyKey as never, { n: order.number, ...vars }),
    }),
  }).catch((error) => console.error("notify(purchase_order)", error));
}

/** As três raias abrem juntas: fornecedor, agência de arte e certificadora. */
export async function notifyLanesOpen(
  order: Order,
  pending: Array<Pick<Requirement, "key" | "role">>,
): Promise<void> {
  const byLane = new Map<string, Requirement["role"]>();
  for (const r of pending) {
    const lane = laneOf(r.key);
    if (lane === "art" && baseKeyOf(r.key) !== LANE_KEYS.art) continue;
    if (!byLane.has(lane)) byLane.set(lane, r.role);
  }
  for (const [lane, role] of byLane)
    await send(
      order,
      role,
      `purchaseOrder.notify.lane.${lane}.subject`,
      `purchaseOrder.notify.lane.${lane}.body`,
      {},
    );
}

/**
 * Depois de um passo da raia: arte enviada → a Wellmix valida; arte validada
 * e certificado na mão → quem faz a arte faz a arte final com o selo.
 */
export async function afterLaneStep(order: Order, key: string): Promise<void> {
  const item = itemIdOf(key);
  if (!item) return;
  const base = baseKeyOf(key);
  const store = getStore();
  const requirements = await store.list("requirements", {
    filter: { orderId: order.id },
  });
  const named = requirements.find((r) => r.key === key);
  const product = (named?.label.split(" · ").slice(1).join(" · ") ?? "").trim();
  if (base === LANE_KEYS.art) {
    await send(
      order,
      "operator",
      "purchaseOrder.notify.review.subject",
      "purchaseOrder.notify.review.body",
      { product },
    );
    return;
  }
  if (base === LANE_KEYS.artReview || base === LANE_KEYS.certificate) {
    const finalKey = laneKey(LANE_KEYS.artFinal, item);
    const final = requirements.find((r) => r.key === finalKey);
    if (!final || final.status === "done") return;
    if (blockedBy(finalKey, requirements).length) return;
    await send(
      order,
      final.role,
      "purchaseOrder.notify.final.subject",
      "purchaseOrder.notify.final.body",
      { product },
    );
  }
}

/** SLA da arte (Configurações). */
export async function purchaseLaneSla(): Promise<LaneSla> {
  const { getSettings } = await import("@/lib/settings");
  const s = await getSettings();
  return {
    artDays: s.purchaseArtSlaDays,
    reviewDays: s.purchaseArtReviewSlaDays,
  };
}
