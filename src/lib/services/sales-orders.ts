import "server-only";

import { canOpen } from "@/lib/auth/screens";
import { ForbiddenError, isAdmin, isWellmix } from "@/lib/auth/permissions";
import {
  getStore,
  type SalesOffer,
  type SalesOrder,
  type SalesOrderLine,
  type User,
} from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { audit } from "./audit";
import { notify } from "./notifications";

/*
 * Venda (mapa V3, V4, V7 e V8; docs/SALES_ORDERS.md). Decisões do dono
 * (14/11/2026):
 *
 * - V3: vendas registra a decisão do cliente na oferta: fechou (vira ordem
 *   de venda) ou não fechou (ajusta a oferta, com o motivo);
 * - V7: o portal registra a ordem de venda (cliente, produtos, quantidades,
 *   preço, condição de pagamento) e ela vai ao Sankhya como pedido de venda
 *   (TOP de venda de Configurações; sem ela ou sem a execução no Sankhya
 *   ligada, fica "a lançar" e vendas informa o número à mão);
 * - V8: data e janela da entrega na ordem; o planner fica sabendo.
 *
 * V4 (reserva): ao confirmar, cada linha reserva o que há livre no Brasil
 * (tela Reservas); o que ainda não chegou fica como reserva na chegada.
 */

export class SalesOrderError extends Error {}

/** Quem trabalha a venda: a Wellmix com a tela Produtos (como as ofertas). */
export const canSell = (user: User) =>
  isWellmix(user) && canOpen(user, "products");

function assertSeller(user: User) {
  if (!canSell(user)) throw new ForbiddenError();
}

/** V3: a decisão do cliente na oferta. Fechou abre a ordem de venda. */
export async function decideOffer(
  user: User,
  offerId: string,
  input: {
    decision: "closed" | "declined";
    note: string | null;
    customerId: string | null;
    quantity: number | null;
  },
): Promise<SalesOrder | null> {
  assertSeller(user);
  const store = getStore();
  const offer = await store.get("sales_offers", offerId);
  if (!offer) throw new SalesOrderError("offer_not_found");
  if (offer.decision) throw new SalesOrderError("offer_decided");
  const note = input.note?.trim() || null;
  if (input.decision === "declined" && !note)
    throw new SalesOrderError("decision_note_required");
  const now = new Date().toISOString();
  let order: SalesOrder | null = null;
  if (input.decision === "closed") {
    const customerId = input.customerId ?? offer.customerId;
    if (!customerId) throw new SalesOrderError("customer_required");
    const customer = await store.get("parties", customerId);
    if (!customer || customer.type !== "customer")
      throw new SalesOrderError("customer_required");
    order = await createSalesOrder(user, {
      customerId,
      offer,
      quantity: input.quantity,
    });
  }
  await store.update("sales_offers", offer.id, {
    decision: input.decision,
    decisionNote: note,
    decidedAt: now,
    decidedByUserId: user.id,
    ...(order ? { salesOrderId: order.id, customerId: order.customerId } : {}),
  });
  await audit(
    user,
    input.decision === "closed" ? "sales.offer_closed" : "sales.offer_declined",
    "sales_offer",
    offer.id,
    input.decision === "closed"
      ? `Oferta a ${offer.offeredTo}: fechou (ordem de venda #${order!.number})`
      : `Oferta a ${offer.offeredTo}: não fechou (${note})`,
  );
  return order;
}

/** Produtos da oferta: o produto ofertado ou os itens do pedido da amostra. */
async function offerLines(
  offer: SalesOffer,
  quantity: number | null,
): Promise<{ lines: SalesOrderLine[]; purchaseOrderId: string | null }> {
  const store = getStore();
  if (offer.productId) {
    const product = await store.get("products", offer.productId);
    if (!product) throw new SalesOrderError("product_not_found");
    return {
      lines: [
        {
          productId: product.id,
          name: product.name,
          quantity: quantity && quantity > 0 ? quantity : 1,
          unit: "un",
          unitPrice: null,
        },
      ],
      purchaseOrderId: offer.orderId,
    };
  }
  const items = offer.orderId
    ? await store.list("order_items", { filter: { orderId: offer.orderId } })
    : [];
  return {
    lines: items
      .filter((i) => i.productId)
      .map((i) => ({
        productId: i.productId!,
        name: i.name,
        quantity: quantity && quantity > 0 ? quantity : 1,
        unit: i.unit || "un",
        unitPrice: null,
      })),
    purchaseOrderId: offer.orderId,
  };
}

async function createSalesOrder(
  user: User,
  input: {
    customerId: string;
    offer: SalesOffer | null;
    quantity: number | null;
  },
): Promise<SalesOrder> {
  const store = getStore();
  const { lines, purchaseOrderId } = input.offer
    ? await offerLines(input.offer, input.quantity)
    : { lines: [], purchaseOrderId: null };
  const order = await store.create("sales_orders", {
    number: await store.nextNumber("sales_order_number"),
    customerId: input.customerId,
    offerId: input.offer?.id ?? null,
    purchaseOrderId,
    lines,
    currency: "BRL",
    paymentConditionId: null,
    status: "draft",
    deliveryDate: null,
    deliveryWindow: null,
    note: null,
    erpStatus: "pending",
    erpNumber: null,
    erpError: null,
    createdByUserId: user.id,
    confirmedAt: null,
    confirmedByUserId: null,
  });
  await audit(
    user,
    "sales.order_created",
    "sales_order",
    order.id,
    `Ordem de venda #${order.number} aberta (${lines.length} produto(s))`,
  );
  return order;
}

/** Ordem de venda nova sem oferta (a partir da tela de ordens). */
export async function openSalesOrder(user: User, customerId: string) {
  assertSeller(user);
  const customer = await getStore().get("parties", customerId);
  if (!customer || customer.type !== "customer")
    throw new SalesOrderError("customer_required");
  return createSalesOrder(user, { customerId, offer: null, quantity: null });
}

async function draft(user: User, id: string) {
  assertSeller(user);
  const order = await getStore().get("sales_orders", id);
  if (!order) throw new SalesOrderError("sales_order_not_found");
  if (order.status !== "draft") throw new SalesOrderError("sales_order_closed");
  return order;
}

/** Rascunho: itens (produto, quantidade, preço), condição, entrega e observação. */
export async function updateSalesOrder(
  user: User,
  id: string,
  input: {
    lines: Array<{
      productId: string;
      quantity: number;
      unitPrice: number | null;
    }>;
    paymentConditionId: string | null;
    currency: string;
    deliveryDate: string | null;
    deliveryWindow: string | null;
    note: string | null;
    purchaseOrderId: string | null;
  },
) {
  const order = await draft(user, id);
  const store = getStore();
  const ids = [...new Set(input.lines.map((l) => l.productId))];
  const products = ids.length
    ? await store.list("products", { filter: { id: ids } })
    : [];
  const lines: SalesOrderLine[] = [];
  for (const l of input.lines) {
    const p = products.find((x) => x.id === l.productId);
    if (!p) throw new SalesOrderError("product_not_found");
    if (!(l.quantity > 0)) throw new SalesOrderError("quantity_required");
    lines.push({
      productId: p.id,
      name: p.name,
      quantity: l.quantity,
      unit: order.lines.find((x) => x.productId === p.id)?.unit ?? "un",
      unitPrice: l.unitPrice,
    });
  }
  if (input.deliveryDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.deliveryDate))
    throw new SalesOrderError("delivery_date_invalid");
  return store.update("sales_orders", order.id, {
    lines,
    paymentConditionId: input.paymentConditionId,
    currency: input.currency,
    deliveryDate: input.deliveryDate,
    deliveryWindow: input.deliveryWindow?.trim() || null,
    note: input.note?.trim() || null,
    purchaseOrderId: input.purchaseOrderId,
  });
}

/**
 * Confirma a ordem (V4 e V7): reserva o que há livre no Brasil (o resto fica
 * na chegada), manda ao Sankhya como pedido de venda quando dá e avisa o
 * planner da entrega agendada (V8).
 */
export async function confirmSalesOrder(user: User, id: string) {
  const order = await draft(user, id);
  if (!order.lines.length) throw new SalesOrderError("lines_required");
  if (order.lines.some((l) => !(l.unitPrice && l.unitPrice > 0)))
    throw new SalesOrderError("price_required");
  if (!order.deliveryDate) throw new SalesOrderError("delivery_date_required");
  const store = getStore();
  const { stockInBrazil, createReservation } = await import("./stock");
  const lines: SalesOrderLine[] = [];
  for (const l of order.lines) {
    const stock = await stockInBrazil(l.productId);
    const free = Math.max(0, stock.quantity - stock.reserved);
    if (free >= l.quantity) {
      const r = await createReservation(user, {
        productId: l.productId,
        customerId: order.customerId,
        quantity: l.quantity,
        days: 30,
        note: `Ordem de venda #${order.number}`,
      });
      lines.push({ ...l, reservationId: r.id, onArrival: false });
    } else lines.push({ ...l, reservationId: null, onArrival: true });
  }
  const now = new Date().toISOString();
  let updated = await store.update("sales_orders", order.id, {
    lines,
    status: "confirmed",
    confirmedAt: now,
    confirmedByUserId: user.id,
  });
  updated = await sendToSankhya(updated);
  await audit(
    user,
    "sales.order_confirmed",
    "sales_order",
    order.id,
    `Ordem de venda #${order.number} confirmada; entrega em ${order.deliveryDate}${order.deliveryWindow ? ` (${order.deliveryWindow})` : ""}; Sankhya: ${updated.erpStatus}`,
  );
  // V8: o planner (e o analista) ficam sabendo da entrega agendada.
  const team = await store.list("users", {
    filter: { role: ["admin", "operator"], active: true },
  });
  const planners = team.filter((u) => (u.functions ?? []).includes("planner"));
  const target = planners.length ? planners : team.filter(isAdmin);
  if (target.length)
    await notify(
      { userIds: target.map((u) => u.id) },
      {
        kind: "info",
        link: `/app/sales-orders/${order.id}`,
        text: (t) => ({
          subject: t("salesOrder.notify.scheduled.subject", {
            n: String(order.number),
            date: order.deliveryDate!.split("-").reverse().join("/"),
          }),
          body: t("salesOrder.notify.scheduled.body", {
            window: order.deliveryWindow ?? "—",
          }),
        }),
      },
    );
  return updated;
}

/** Pedido de venda no Sankhya (TOP de venda; cliente e produtos com código). */
async function sendToSankhya(order: SalesOrder): Promise<SalesOrder> {
  const store = getStore();
  const top = (await getSettings()).salesTop;
  const { getSankhyaErpSettings } =
    await import("@/lib/integrations/sankhya-settings");
  const erp = await getSankhyaErpSettings();
  if (!erp.ordersEnabled || !top) return order;
  const fail = (reason: string) =>
    store.update("sales_orders", order.id, {
      erpStatus: "error",
      erpError: reason,
    });
  const customer = await store.get("parties", order.customerId);
  if (!customer?.sankhyaCode)
    return fail(`cliente ${customer?.name ?? ""} sem código do Sankhya`);
  const items = [];
  for (const l of order.lines) {
    const p = await store.get("products", l.productId);
    if (!p?.sankhyaCode) return fail(`produto ${l.name} sem código do Sankhya`);
    items.push({
      CODPROD: p.sankhyaCode,
      QTDNEG: l.quantity,
      CODVOL: erp.codVol || "UN",
      VLRUNIT: l.unitPrice ?? 0,
      PERCDESC: 0,
      CODEMP: erp.codEmp,
    });
  }
  try {
    const { executeQuery, createNote } =
      await import("@/lib/integrations/sankhya-client");
    const tops = await executeQuery(
      `SELECT MAX(TIPMOV) AS TIPMOV FROM TGFTOP WHERE CODTIPOPER = ${Math.trunc(top)}`,
    );
    const tipMov = String(tops.rows[0]?.TIPMOV ?? "").trim();
    if (!tipMov) return fail(`TOP ${top} não encontrada`);
    const condition = order.paymentConditionId
      ? await store.get("payment_conditions", order.paymentConditionId)
      : null;
    const { nunota } = await createNote({
      header: {
        CODEMP: erp.codEmp,
        CODEMPNEGOC: erp.codEmp,
        NUMNOTA: 0,
        CODPARC: customer.sankhyaCode,
        CODTIPOPER: top,
        TIPMOV: tipMov,
        CODTIPVENDA: condition?.code ?? erp.codTipVenda,
        CODVEND: erp.codVend ?? 0,
        CODNAT: erp.codNat,
        CODCENCUS: erp.codCenCus,
        CODPROJ: erp.codProj ?? 0,
        DTNEG: new Date().toLocaleDateString("pt-BR", {
          timeZone: "America/Sao_Paulo",
        }),
        OBSERVACAO: `Portal Wellmix: ordem de venda #${order.number}`,
      },
      items,
      informPrice: true,
    } as never);
    if (!nunota) return fail("o Sankhya não devolveu o número");
    return store.update("sales_orders", order.id, {
      erpStatus: "synced",
      erpNumber: nunota,
      erpError: null,
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message.slice(0, 300) : "erro");
  }
}

/** Sem integração: vendas informa o número do pedido de venda do Sankhya. */
export async function setSalesOrderErpNumber(
  user: User,
  id: string,
  erpNumber: string,
) {
  assertSeller(user);
  const store = getStore();
  const order = await store.get("sales_orders", id);
  if (!order || order.status !== "confirmed")
    throw new SalesOrderError("sales_order_not_found");
  const number = erpNumber.trim();
  if (!number) throw new SalesOrderError("erp_number_required");
  await store.update("sales_orders", id, {
    erpStatus: "synced",
    erpNumber: number,
    erpError: null,
  });
  await audit(
    user,
    "sales.order_erp_number",
    "sales_order",
    id,
    `Ordem de venda #${order.number}: pedido de venda no Sankhya ${number}`,
  );
}

/** Cancela a ordem (rascunho ou confirmada): as reservas voltam a ficar livres. */
export async function cancelSalesOrder(user: User, id: string) {
  assertSeller(user);
  const store = getStore();
  const order = await store.get("sales_orders", id);
  if (!order || order.status === "cancelled")
    throw new SalesOrderError("sales_order_not_found");
  const { cancelReservation } = await import("./stock");
  for (const l of order.lines)
    if (l.reservationId)
      await cancelReservation(user, l.reservationId).catch(() => null);
  await store.update("sales_orders", id, { status: "cancelled" });
  await audit(
    user,
    "sales.order_cancelled",
    "sales_order",
    id,
    `Ordem de venda #${order.number} cancelada`,
  );
}

export interface SalesOrderRow extends SalesOrder {
  customerName: string;
}

/** Lista das ordens (mais novas primeiro) e a agenda de entregas (V8). */
export async function listSalesOrders(user: User): Promise<SalesOrderRow[]> {
  if (!canSell(user)) return [];
  const store = getStore();
  const orders = await store.list("sales_orders").catch(() => []);
  const ids = [...new Set(orders.map((o) => o.customerId))];
  const parties = ids.length
    ? await store.list("parties", { filter: { id: ids } })
    : [];
  return orders
    .map((o) => ({
      ...o,
      customerName: parties.find((p) => p.id === o.customerId)?.name ?? "—",
    }))
    .sort((a, b) => b.number - a.number);
}

/** Agenda das entregas (V8): ordens confirmadas com data de hoje em diante. */
export function salesAgenda<T extends SalesOrder>(orders: T[]): T[] {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
  return orders
    .filter((o) => o.status === "confirmed" && !!o.deliveryDate)
    .filter((o) => o.deliveryDate! >= today)
    .sort((a, b) => a.deliveryDate!.localeCompare(b.deliveryDate!));
}
