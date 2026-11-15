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
import { addDays } from "@/lib/supplier-terms";
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

/**
 * Pronta entrega da vitrine (mapa V6 → V7; dono, 15/11/2026): os itens do
 * carrinho que o estoque livre ou uma compra a caminho atende viram uma
 * ordem de venda em rascunho para Vendas pôr o preço e confirmar (a reserva
 * nasce na confirmação, como sempre). Quem cria é o próprio cliente, pelo
 * carrinho; Vendas é avisada.
 */
export async function openSalesOrderFromCart(
  user: User,
  customerId: string,
  lines: SalesOrderLine[],
  note: string | null,
): Promise<SalesOrder> {
  if (user.role !== "customer" || user.partyId !== customerId)
    throw new ForbiddenError();
  if (!lines.length) throw new SalesOrderError("sales_order_lines");
  const store = getStore();
  const order = await store.create("sales_orders", {
    number: await store.nextNumber("sales_order_number"),
    customerId,
    offerId: null,
    purchaseOrderId: null,
    lines,
    currency: "BRL",
    paymentConditionId: null,
    status: "draft",
    deliveryDate: null,
    deliveryWindow: null,
    note,
    erpStatus: "pending",
    erpNumber: null,
    erpError: null,
    createdByUserId: user.id,
    confirmedAt: null,
    confirmedByUserId: null,
  });
  await audit(
    user,
    "sales.order_from_cart",
    "sales_order",
    order.id,
    `Ordem de venda #${order.number} pela vitrine (${lines.length} produto(s) de pronta entrega)`,
  );
  const { holdersOf } = await import("@/lib/auth/function-access");
  const { loadFunctionDefs } = await import("./team-functions");
  const users = (await store.list("users", { filter: { active: true } })).filter(
    (u) => isWellmix(u),
  );
  const sellers = holdersOf(
    users,
    "demand.createForCustomer",
    await loadFunctionDefs(),
  );
  const to = sellers.length ? sellers : users.filter((u) => isAdmin(u));
  if (to.length)
    await notify(
      { userIds: to.map((u) => u.id) },
      {
        kind: "action",
        link: `/app/sales-orders/${order.id}`,
        subject: `Pedido da vitrine: ordem de venda #${order.number}`,
        body: `${lines.length} produto(s) de pronta entrega para pôr o preço e confirmar.`,
      },
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
  // NF de venda: o financeiro emite no Sankhya e registra na ordem.
  const finance = team.filter((u) => (u.functions ?? []).includes("finance"));
  const billers = finance.length ? finance : team.filter(isAdmin);
  if (billers.length)
    await notify(
      { userIds: billers.map((u) => u.id) },
      {
        kind: "info",
        link: `/app/sales-orders/${order.id}`,
        text: (t) => ({
          subject: t("salesOrder.notify.invoice.subject", {
            n: String(order.number),
          }),
          body: t("salesOrder.notify.invoice.body"),
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
  // Expedida já baixou o estoque: não cancela mais (devolução fica fora).
  if (order.status === "shipped" || order.status === "delivered")
    throw new SalesOrderError("sales_order_shipped");
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

/** Agenda das entregas (V8): confirmadas ou a caminho, de hoje em diante. */
export function salesAgenda<T extends SalesOrder>(orders: T[]): T[] {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
  return orders
    .filter(
      (o) =>
        (o.status === "confirmed" || o.status === "shipped") &&
        !!o.deliveryDate,
    )
    .filter((o) => o.deliveryDate! >= today)
    .sort((a, b) => a.deliveryDate!.localeCompare(b.deliveryDate!));
}

/* ---- NF de venda, expedição e entrega (dono, 15/11/2026) ---------------- */

/** NF de venda: o financeiro (tela Financeiro) ou o administrador. */
export const canInvoice = (user: User) =>
  isAdmin(user) || (isWellmix(user) && canOpen(user, "finance"));

/** Dia AAAA-MM-DD (Brasil) → meio-dia em UTC; sem dia, agora. */
const dayAt = (day: string | null) => {
  if (!day) return new Date().toISOString();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day))
    throw new SalesOrderError("date_invalid");
  return `${day}T15:00:00.000Z`;
};

/**
 * O financeiro emite a NF de venda no Sankhya e registra o número (e o
 * arquivo) na ordem confirmada; sem ela a ordem não expede.
 */
export async function registerSalesInvoice(
  user: User,
  id: string,
  input: { number: string; documentId: string | null },
) {
  if (!canInvoice(user)) throw new ForbiddenError();
  const store = getStore();
  const order = await store.get("sales_orders", id);
  if (!order) throw new SalesOrderError("sales_order_not_found");
  if (order.status !== "confirmed")
    throw new SalesOrderError("sales_order_closed");
  const number = input.number.trim();
  if (!number) throw new SalesOrderError("invoice_number_required");
  await store.update("sales_orders", id, {
    invoiceNumber: number,
    invoiceDocumentId: input.documentId ?? order.invoiceDocumentId ?? null,
    invoicedAt: new Date().toISOString(),
    invoicedByUserId: user.id,
  });
  await audit(
    user,
    "sales.order_invoice",
    "sales_order",
    id,
    `Ordem de venda #${order.number}: NF de venda ${number}`,
  );
}

/**
 * Expedição ao cliente: com a NF registrada, a transportadora cadastrada (ou
 * o cliente retira), a data de saída e o frete. Dá a baixa por venda no
 * estoque no Brasil: a reserva da ordem vira baixa; a linha sem reserva viva
 * (na chegada ou vencida) sai do estoque livre, que precisa bastar para
 * todas antes de gravar qualquer baixa.
 */
export async function shipSalesOrder(
  user: User,
  id: string,
  input: {
    carrierId: string | null;
    customerPickup: boolean;
    freightValue: number | null;
    shippedOn: string | null;
    /** Prazo do frete em dias depois da saída (conta a pagar). */
    freightDays?: number | null;
  },
) {
  assertSeller(user);
  const store = getStore();
  const order = await store.get("sales_orders", id);
  if (!order) throw new SalesOrderError("sales_order_not_found");
  if (order.status !== "confirmed")
    throw new SalesOrderError("sales_order_closed");
  if (!order.invoiceNumber) throw new SalesOrderError("invoice_required");
  const pickup = input.customerPickup;
  if (!pickup) {
    const carrier = input.carrierId
      ? await store.get("parties", input.carrierId)
      : null;
    if (!carrier || carrier.type !== "carrier" || !carrier.active)
      throw new SalesOrderError("carrier_required");
  }
  if (input.freightValue != null && !(input.freightValue >= 0))
    throw new SalesOrderError("freight_invalid");
  const days = input.freightDays ?? 0;
  if (!(Number.isInteger(days) && days >= 0 && days <= 365))
    throw new SalesOrderError("freight_days_invalid");
  const shippedAt = dayAt(input.shippedOn);
  // Frete da transportadora vira conta a pagar (o cliente retira: sem frete).
  const freightValue = pickup ? null : input.freightValue;
  const freightDueDate =
    freightValue && freightValue > 0
      ? addDays(shippedAt.slice(0, 10), days)
      : null;

  const { stockInBrazil, consumeReservation, recordSaleOut } =
    await import("./stock");
  const { isReservationLive } = await import("./reservation-rules");
  const { brazilDay } = await import("@/lib/supplier-terms");
  const today = brazilDay(new Date().toISOString()) as string;
  // Planeja: reserva viva ou estoque livre (somado por produto).
  const plan: Array<{ line: SalesOrderLine; reservationId: string | null }> =
    [];
  const fromFree = new Map<string, number>();
  for (const line of order.lines) {
    const r = line.reservationId
      ? await store.get("stock_reservations", line.reservationId)
      : null;
    const live = !!r && isReservationLive(r, today);
    plan.push({ line, reservationId: live ? r!.id : null });
    if (!live)
      fromFree.set(
        line.productId,
        (fromFree.get(line.productId) ?? 0) + line.quantity,
      );
  }
  for (const [productId, qty] of fromFree) {
    const s = await stockInBrazil(productId);
    if (Math.max(0, s.quantity - s.reserved) + 1e-6 < qty)
      throw new SalesOrderError("stock_insufficient");
  }
  for (const { line, reservationId } of plan) {
    if (reservationId)
      await consumeReservation(user, reservationId, null, order.id);
    else
      await recordSaleOut(user, {
        productId: line.productId,
        quantity: line.quantity,
        orderId: null,
        note: `Ordem de venda #${order.number}`,
        salesOrderId: order.id,
      });
  }
  const updated = await store.update("sales_orders", id, {
    status: "shipped",
    carrierId: pickup ? null : input.carrierId,
    customerPickup: pickup,
    freightValue,
    freightDueDate,
    shippedAt,
    shippedByUserId: user.id,
  });
  await audit(
    user,
    "sales.order_shipped",
    "sales_order",
    id,
    `Ordem de venda #${order.number} expedida (${pickup ? "cliente retira" : "transportadora"}); baixa de ${order.lines.length} produto(s) no estoque`,
  );
  return updated;
}

/** Entrega ao cliente: data, quem recebeu e o comprovante (canhoto). */
export async function deliverSalesOrder(
  user: User,
  id: string,
  input: {
    deliveredOn: string | null;
    receivedBy: string;
    proofDocumentId: string | null;
  },
) {
  assertSeller(user);
  const store = getStore();
  const order = await store.get("sales_orders", id);
  if (!order) throw new SalesOrderError("sales_order_not_found");
  if (order.status !== "shipped")
    throw new SalesOrderError("sales_order_not_shipped");
  const receivedBy = input.receivedBy.trim();
  if (!receivedBy) throw new SalesOrderError("received_by_required");
  if (!input.proofDocumentId) throw new SalesOrderError("proof_required");
  await store.update("sales_orders", id, {
    status: "delivered",
    deliveredAt: dayAt(input.deliveredOn),
    receivedBy,
    proofDocumentId: input.proofDocumentId,
    deliveredByUserId: user.id,
  });
  await audit(
    user,
    "sales.order_delivered",
    "sales_order",
    id,
    `Ordem de venda #${order.number} entregue (recebido por ${receivedBy})`,
  );
}

/* ---- Frete da venda no Financeiro (dono, 15/11/2026) -------------------- */

/** Quem baixa o frete: a tela Contas a pagar ou o administrador. */
export const canPayFreight = (user: User) =>
  isAdmin(user) || (isWellmix(user) && canOpen(user, "payables"));

export interface FreightPayable {
  id: string;
  number: number;
  customerName: string;
  carrierName: string;
  value: number;
  dueDate: string | null;
  paidAt: string | null;
  proofDocumentId: string | null;
  /** Em aberto e com o vencimento antes de hoje (Brasil). */
  overdue: boolean;
}

/** Fretes de venda (contas a pagar às transportadoras): em aberto primeiro. */
export async function listFreightPayables(
  user: User,
): Promise<FreightPayable[]> {
  if (!canPayFreight(user)) return [];
  const store = getStore();
  const orders = (
    await store
      .list("sales_orders", { filter: { status: ["shipped", "delivered"] } })
      .catch(() => [] as SalesOrder[])
  ).filter((o) => (o.freightValue ?? 0) > 0 && !!o.carrierId);
  const ids = [...new Set(orders.flatMap((o) => [o.customerId, o.carrierId!]))];
  const parties = ids.length
    ? await store.list("parties", { filter: { id: ids } })
    : [];
  const name = (id: string | null | undefined) =>
    parties.find((p) => p.id === id)?.name ?? "—";
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
  return orders
    .map((o) => ({
      id: o.id,
      number: o.number,
      customerName: name(o.customerId),
      carrierName: name(o.carrierId),
      value: o.freightValue!,
      dueDate: o.freightDueDate ?? null,
      paidAt: o.freightPaidAt ?? null,
      proofDocumentId: o.freightProofDocumentId ?? null,
      overdue:
        !o.freightPaidAt && !!o.freightDueDate && o.freightDueDate < today,
    }))
    .sort(
      (a, b) =>
        Number(!!a.paidAt) - Number(!!b.paidAt) ||
        (a.dueDate ?? "").localeCompare(b.dueDate ?? ""),
    );
}

/** O financeiro marca o frete como pago, com o comprovante. */
export async function payFreight(
  user: User,
  id: string,
  input: { proofDocumentId: string | null },
) {
  if (!canPayFreight(user)) throw new ForbiddenError();
  const store = getStore();
  const order = await store.get("sales_orders", id);
  if (!order || !(order.freightValue && order.freightValue > 0))
    throw new SalesOrderError("freight_not_found");
  if (order.freightPaidAt) throw new SalesOrderError("freight_paid");
  if (!input.proofDocumentId) throw new SalesOrderError("proof_required");
  await store.update("sales_orders", id, {
    freightPaidAt: new Date().toISOString(),
    freightPaidByUserId: user.id,
    freightProofDocumentId: input.proofDocumentId,
  });
  await audit(
    user,
    "sales.freight_paid",
    "sales_order",
    id,
    `Frete da ordem de venda #${order.number} pago (R$ ${order.freightValue})`,
  );
}
