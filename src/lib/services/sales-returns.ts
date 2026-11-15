import "server-only";

import { ForbiddenError } from "@/lib/auth/permissions";
import {
  getStore,
  type SalesReturn,
  type SalesReturnLine,
  type User,
} from "@/lib/db";
import { audit } from "./audit";
import { notify } from "./notifications";
import { canInvoice, canSell } from "./sales-orders";

/*
 * Devolução de venda (docs/SALES_ORDERS.md). Decisões do dono (15/11/2026):
 *
 * - parcial por item: vendas registra a quantidade devolvida de cada produto
 *   e o motivo; pode haver mais de uma devolução até devolver tudo;
 * - a NF de devolução é emitida no Sankhya e o financeiro registra o número
 *   (e o arquivo); sem ela a devolução não fecha;
 * - a qualidade confere: o que está bom volta ao estoque livre no Brasil
 *   (movimento "return_in"); o resto fica como perda na devolução, com o
 *   motivo (a mercadoria já tinha saído do estoque na expedição).
 */

export class SalesReturnError extends Error {}

const same = (a: number, b: number) => Math.abs(a - b) < 1e-6;

/** Quanto de cada produto ainda pode voltar: expedido menos o já devolvido. */
export function returnableOf(
  lines: Array<{ productId: string; quantity: number }>,
  returns: Array<Pick<SalesReturn, "status" | "lines">>,
): Map<string, number> {
  const left = new Map<string, number>();
  for (const l of lines)
    left.set(l.productId, (left.get(l.productId) ?? 0) + l.quantity);
  for (const r of returns) {
    if (r.status === "cancelled") continue;
    for (const l of r.lines)
      left.set(l.productId, (left.get(l.productId) ?? 0) - l.quantity);
  }
  return left;
}

export async function listSalesReturns(salesOrderId: string) {
  return getStore()
    .list("sales_returns", { filter: { salesOrderId } })
    .catch(() => [] as SalesReturn[]);
}

/** Vendas registra a devolução (parcial por item) de uma ordem expedida. */
export async function openSalesReturn(
  user: User,
  salesOrderId: string,
  input: {
    lines: Array<{ productId: string; quantity: number }>;
    reason: string;
  },
): Promise<SalesReturn> {
  if (!canSell(user)) throw new ForbiddenError();
  const store = getStore();
  const order = await store.get("sales_orders", salesOrderId);
  if (!order) throw new SalesReturnError("sales_order_not_found");
  if (order.status !== "shipped" && order.status !== "delivered")
    throw new SalesReturnError("sales_order_not_shipped");
  const reason = input.reason.trim();
  if (!reason) throw new SalesReturnError("return_reason_required");
  const wanted = input.lines.filter((l) => l.quantity > 0);
  if (!wanted.length) throw new SalesReturnError("return_lines_required");
  const left = returnableOf(order.lines, await listSalesReturns(order.id));
  const lines: SalesReturnLine[] = [];
  for (const w of wanted) {
    const line = order.lines.find((l) => l.productId === w.productId);
    if (!line) throw new SalesReturnError("product_not_found");
    if (w.quantity > (left.get(w.productId) ?? 0) + 1e-6)
      throw new SalesReturnError("return_too_much");
    lines.push({
      productId: line.productId,
      name: line.name,
      quantity: w.quantity,
      unit: line.unit,
      goodQty: null,
      lossQty: null,
    });
  }
  const created = await store.create("sales_returns", {
    salesOrderId: order.id,
    lines,
    reason,
    status: "open",
    createdByUserId: user.id,
    invoiceNumber: null,
    invoiceDocumentId: null,
    invoicedAt: null,
    invoicedByUserId: null,
    checkedAt: null,
    checkedByUserId: null,
    lossNote: null,
  });
  await audit(
    user,
    "sales.return_opened",
    "sales_order",
    order.id,
    `Devolução da ordem de venda #${order.number}: ${lines.map((l) => `${l.quantity} ${l.unit} de ${l.name}`).join(", ")} (${reason})`,
  );
  // O financeiro emite a NF de devolução; a qualidade confere.
  const team = await store.list("users", {
    filter: { role: ["admin", "operator"], active: true },
  });
  const finance = team.filter((u) => (u.functions ?? []).includes("finance"));
  const target = finance.length
    ? finance
    : team.filter((u) => u.role === "admin");
  if (target.length)
    await notify(
      { userIds: target.map((u) => u.id) },
      {
        kind: "info",
        link: `/app/sales-orders/${order.id}`,
        text: (t) => ({
          subject: t("salesReturn.notify.subject", { n: String(order.number) }),
          body: t("salesReturn.notify.body"),
        }),
      },
    );
  return created;
}

async function openReturn(id: string) {
  const r = await getStore().get("sales_returns", id);
  if (!r) throw new SalesReturnError("return_not_found");
  if (r.status !== "open") throw new SalesReturnError("return_closed");
  return r;
}

/** O financeiro registra a NF de devolução emitida no Sankhya. */
export async function registerReturnInvoice(
  user: User,
  id: string,
  input: { number: string; documentId: string | null },
) {
  if (!canInvoice(user)) throw new ForbiddenError();
  const r = await openReturn(id);
  const number = input.number.trim();
  if (!number) throw new SalesReturnError("invoice_number_required");
  await getStore().update("sales_returns", r.id, {
    invoiceNumber: number,
    invoiceDocumentId: input.documentId ?? r.invoiceDocumentId,
    invoicedAt: new Date().toISOString(),
    invoicedByUserId: user.id,
  });
  await audit(
    user,
    "sales.return_invoice",
    "sales_order",
    r.salesOrderId,
    `Devolução: NF de devolução ${number}`,
  );
}

/**
 * A qualidade confere a devolução (com a NF registrada): por item, quanto
 * está bom (volta ao estoque livre no Brasil) e quanto é perda; bom + perda
 * = devolvido. Com perda, o motivo é obrigatório. Fecha a devolução.
 */
export async function checkSalesReturn(
  user: User,
  id: string,
  input: {
    lines: Array<{ productId: string; goodQty: number }>;
    lossNote: string | null;
  },
) {
  const { canDoQuality } = await import("./receiving");
  if (!(await canDoQuality(user))) throw new ForbiddenError();
  const r = await openReturn(id);
  if (!r.invoiceNumber) throw new SalesReturnError("invoice_required");
  const lines: SalesReturnLine[] = r.lines.map((l) => {
    const good = input.lines.find((x) => x.productId === l.productId)?.goodQty;
    if (good == null || !(good >= 0) || good > l.quantity + 1e-6)
      throw new SalesReturnError("return_check_invalid");
    return { ...l, goodQty: good, lossQty: l.quantity - good };
  });
  const hasLoss = lines.some((l) => !same(l.lossQty ?? 0, 0));
  const lossNote = input.lossNote?.trim() || null;
  if (hasLoss && !lossNote) throw new SalesReturnError("loss_note_required");
  const store = getStore();
  const order = await store.get("sales_orders", r.salesOrderId);
  for (const l of lines) {
    if (!(l.goodQty! > 0)) continue;
    await store.create("stock_movements", {
      productId: l.productId,
      kind: "return_in",
      quantity: l.goodQty!,
      unit: l.unit,
      orderId: null,
      countId: null,
      countItemId: null,
      note: `Devolução da ordem de venda #${order?.number ?? ""}`,
      createdByUserId: user.id,
      salesOrderId: r.salesOrderId,
    });
  }
  await store.update("sales_returns", r.id, {
    lines,
    status: "closed",
    checkedAt: new Date().toISOString(),
    checkedByUserId: user.id,
    lossNote,
  });
  await audit(
    user,
    "sales.return_checked",
    "sales_order",
    r.salesOrderId,
    `Devolução conferida: ${lines.map((l) => `${l.name} ${l.goodQty} bom / ${l.lossQty} perda`).join(", ")}${lossNote ? ` (${lossNote})` : ""}`,
  );
}

/** Vendas cancela a devolução ainda aberta (registrada por engano). */
export async function cancelSalesReturn(user: User, id: string) {
  if (!canSell(user)) throw new ForbiddenError();
  const r = await openReturn(id);
  await getStore().update("sales_returns", r.id, { status: "cancelled" });
  await audit(
    user,
    "sales.return_cancelled",
    "sales_order",
    r.salesOrderId,
    "Devolução cancelada",
  );
}
