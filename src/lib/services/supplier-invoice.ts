import "server-only";

import { holdersOf } from "@/lib/auth/function-access";
import { ForbiddenError, isAdmin } from "@/lib/auth/permissions";
import { getStore, type Order, type User } from "@/lib/db";
import { getSettings, setSetting } from "@/lib/settings";
import { isPurchaseFlow } from "@/lib/workflow/stages";
import { audit } from "./audit";
import { isFinance } from "./import-flow";
import { notify } from "./notifications";
import { loadFunctionDefs } from "./team-functions";

/*
 * Fatura ativa em N dias (mapa R24; docs/SHIPPING_DOCS.md). Decisão do dono
 * (14/11/2026): N é fixo por fornecedor. Com os documentos do embarque
 * conferidos (o BL bate com a invoice), a fatura fica ativa e vence N dias
 * depois; o financeiro registra o faturamento (o evento "Pedido faturado"
 * que escreve no Sankhya). Sem prazo no fornecedor, vale o padrão das
 * Configurações.
 */

export class SupplierInvoiceError extends Error {}

const DAY = 24 * 60 * 60 * 1000;

/** Dias do fornecedor (ou o padrão das Configurações). */
export async function invoiceDaysFor(supplierId: string | null | undefined) {
  const settings = await getSettings();
  const own = supplierId
    ? settings.invoiceDaysBySupplier?.[supplierId]
    : undefined;
  return typeof own === "number" ? own : settings.invoiceDays;
}

/** Grava o prazo do fornecedor (só o administrador); vazio volta ao padrão. */
export async function setSupplierInvoiceDays(
  user: User,
  supplierId: string,
  days: number | null,
) {
  if (!isAdmin(user)) throw new ForbiddenError();
  const supplier = await getStore().get("parties", supplierId);
  if (!supplier || supplier.type !== "supplier")
    throw new SupplierInvoiceError("not_supplier");
  if (days !== null && (!Number.isInteger(days) || days < 0 || days > 365))
    throw new SupplierInvoiceError("invoice_days_invalid");
  const map = { ...((await getSettings()).invoiceDaysBySupplier ?? {}) };
  if (days === null) delete map[supplierId];
  else map[supplierId] = days;
  await setSetting("invoiceDaysBySupplier", map);
  await audit(
    user,
    "supplier.invoice_days",
    "party",
    supplierId,
    days === null
      ? `Fatura de ${supplier.name}: volta ao padrão das Configurações`
      : `Fatura de ${supplier.name}: ${days} dia(s) depois dos documentos conferidos`,
  );
}

export interface InvoiceDue {
  /** Quando os documentos foram conferidos (BL aceito). */
  activeAt: string;
  days: number;
  dueAt: string;
  /** Venceu (dia civil já passou). */
  late: boolean;
}

/** Fatura ativa do pedido de compra: nulo antes do BL conferido. */
export async function invoiceDueOf(order: Order): Promise<InvoiceDue | null> {
  if (!isPurchaseFlow(order) || order.status === "CANCELLED") return null;
  const [bl] = await getStore()
    .list("shipping_docs", { filter: { orderId: order.id, kind: "bl" } })
    .catch(() => []);
  if (!bl || bl.status !== "accepted" || !bl.submittedAt) return null;
  const days = await invoiceDaysFor(order.supplierId);
  const dueAt = new Date(Date.parse(bl.submittedAt) + days * DAY).toISOString();
  return {
    activeAt: bl.submittedAt,
    days,
    dueAt,
    late: dueAt.slice(0, 10) < new Date().toISOString().slice(0, 10),
  };
}

/** Quem registra o faturamento: o financeiro (ou os administradores). */
async function financeTarget() {
  const team = await getStore().list("users", {
    filter: { role: ["admin", "operator"], active: true },
  });
  const finance = holdersOf(team, "numerario.manage", await loadFunctionDefs());
  return {
    userIds: (finance.length ? finance : team.filter(isAdmin)).map((u) => u.id),
  };
}

/** Documentos conferidos: avisa o financeiro que a fatura está ativa. */
export async function activateInvoice(order: Order) {
  const due = await invoiceDueOf(order);
  if (!due || order.invoicedAt) return;
  const date = due.dueAt.slice(0, 10).split("-").reverse().join("/");
  await notify(await financeTarget(), {
    kind: "action",
    link: `/app/orders/${order.id}`,
    text: (t) => ({
      subject: t("supplierInvoice.notify.subject", {
        n: String(order.number),
      }),
      body: t("supplierInvoice.notify.body", {
        days: String(due.days),
        date,
      }),
    }),
  });
}

export interface InvoiceTask {
  order: Order;
  due: InvoiceDue;
}

/** Pendências "Registrar faturamento" do financeiro: fatura ativa e ainda não faturada. */
export async function invoiceTasks(user: User): Promise<InvoiceTask[]> {
  if (!isFinance(user)) return [];
  const orders = await getStore()
    .list("orders", {
      filter: {
        flow: "supplier_request",
        status: [
          "INSPECTION",
          "SHIPPING",
          "CUSTOMS",
          "TRANSPORT",
          "DELIVERED",
          "CLOSED",
        ],
      },
    })
    .catch(() => [] as Order[]);
  const out: InvoiceTask[] = [];
  for (const order of orders) {
    if (order.invoicedAt) continue;
    const due = await invoiceDueOf(order);
    if (due) out.push({ order, due });
  }
  return out;
}
