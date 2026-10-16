import "server-only";

import {
  getStore,
  PAYMENT_EXTRA_DEFAULTS,
  type Order,
  type Party,
  type Payment,
  type User,
} from "@/lib/db";
import { isWellmix } from "@/lib/auth/permissions";
import { submitRequirement } from "@/lib/workflow/engine";
import { getSettings } from "@/lib/settings";
import type {
  ScheduleInstallment,
  SupplierSchedule,
} from "@/lib/supplier-terms";
import { audit } from "./audit";
import { notify } from "./notifications";
import { orderPayable, type TermsSource } from "./supplier-terms";

export class SupplierPaymentError extends Error {}

/**
 * Como o pagamento ao fornecedor foi registrado:
 * - manual: a Wellmix informa que pagou (pode anexar comprovante) → "confirmed";
 * - transfer_copied: copiou os dados para o banco → "pending";
 * - finance_email / finance_whatsapp: pediu ao financeiro → "pending".
 * Pendente não conta como pago na conta corrente; o fornecedor confirmar o
 * recebimento marca como recebido.
 */
export const SUPPLIER_PAYMENT_METHODS = [
  "manual",
  "transfer_copied",
  "finance_email",
  "finance_whatsapp",
] as const;
export type SupplierPaymentMethod = (typeof SUPPLIER_PAYMENT_METHODS)[number];

export interface SupplierPaymentView {
  /**
   * Valor a pagar agora: o que falta da próxima parcela da condição do
   * fornecedor; sem condição configurada, o FOB menos o que já foi registrado.
   */
  due: number | null;
  /** Parcela que se paga agora (nula sem condição configurada). */
  installment: ScheduleInstallment | null;
  schedule: SupplierSchedule;
  termsSource: TermsSource | null;
  currency: string;
  fobTotal: number | null;
  alreadyRegistered: number;
  supplier: Party | null;
  /** Dados do fornecedor que faltam para a transferência. */
  missingBank: Array<
    "bankBeneficiary" | "bankName" | "bankAccount" | "bankSwift"
  >;
  /** Texto para colar no banco (padrão de transferência internacional, em inglês). */
  transferText: string;
  emailUrl: string;
  whatsappUrl: string;
}

const money = (value: number, currency: string) =>
  `${currency} ${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export async function supplierPaymentView(
  order: Order,
  orderLink: string,
): Promise<SupplierPaymentView> {
  const store = getStore();
  const [supplier, payments, settings, payable] = await Promise.all([
    store.get("parties", order.supplierId),
    store.list("payments", { filter: { orderId: order.id } }),
    getSettings(),
    orderPayable(order),
  ]);
  const currency = (order.fobCurrency ?? "USD").toUpperCase();
  const alreadyRegistered = payments
    .filter(
      (p) =>
        p.direction === "supplier_out" && p.currency.toUpperCase() === currency,
    )
    .reduce((sum, p) => sum + p.amount, 0);
  const { schedule } = payable;
  const installment = schedule.next;
  const due =
    order.fobTotal === null
      ? null
      : schedule.terms
        ? (installment?.open ?? 0)
        : Math.max(
            0,
            Math.round((order.fobTotal - alreadyRegistered) * 100) / 100,
          );
  // Parcela na referência: o banco e o fornecedor sabem o que está sendo pago.
  const part = installment ? ` ${installment.index}/${installment.count}` : "";
  const reference = `WELLMIX PO #${order.number}${part}`;
  const amountText = due !== null ? money(due, currency) : "—";
  const transferText = [
    `Beneficiary: ${supplier?.bankBeneficiary ?? supplier?.name ?? "—"}`,
    `Bank: ${supplier?.bankName ?? "—"}`,
    `Account / IBAN: ${supplier?.bankAccount ?? "—"}`,
    `SWIFT: ${supplier?.bankSwift ?? "—"}`,
    supplier?.bankAddress ? `Bank address: ${supplier.bankAddress}` : null,
    `Amount: ${amountText}`,
    `Reference: ${reference}`,
  ]
    .filter(Boolean)
    .join("\n");
  const message = [
    `Solicitação de pagamento ao fornecedor — Pedido #${order.number}`,
    `Fornecedor: ${supplier?.name ?? "—"}`,
    installment
      ? `Parcela: ${installment.index}/${installment.count} (${installment.percent}% do FOB)`
      : null,
    `Valor: ${amountText}`,
    "",
    "Dados para a transferência:",
    transferText,
    "",
    `Pedido no portal: ${orderLink}`,
  ]
    .filter((line) => line !== null)
    .join("\n");
  const subject = `Pagamento ao fornecedor — Pedido #${order.number} — ${amountText}`;
  const emailUrl = `mailto:${encodeURIComponent(settings.financeEmail || "")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
  const whatsappUrl = `https://wa.me/${settings.financeWhatsapp || ""}?text=${encodeURIComponent(message)}`;
  const missingBank = (
    ["bankBeneficiary", "bankName", "bankAccount", "bankSwift"] as const
  ).filter((k) => !supplier?.[k]);
  return {
    due,
    installment,
    schedule,
    termsSource: payable.source,
    currency,
    fobTotal: order.fobTotal,
    alreadyRegistered,
    supplier,
    missingBank,
    transferText,
    emailUrl,
    whatsappUrl,
  };
}

export interface RegisterSupplierPaymentInput {
  method: SupplierPaymentMethod;
  /** Sem valor: usa o valor devido calculado (ações rápidas). */
  amount?: number | null;
  currency?: string | null;
  fxRate?: number | null;
  note?: string | null;
  proofDocumentId?: string | null;
  /**
   * Ações rápidas: a parcela que a tela mostrava. Se outra pessoa (ou um
   * clique duplo) já cobriu essa parcela, nada é registrado.
   */
  installment?: number | null;
}

/**
 * Registra o pagamento ao fornecedor (só Wellmix) e conclui o item
 * "Pagamento ao fornecedor registrado" da etapa. O fornecedor é avisado para
 * confirmar o recebimento.
 */
export async function registerSupplierPayment(
  user: User,
  orderId: string,
  input: RegisterSupplierPaymentInput,
): Promise<Payment> {
  if (!isWellmix(user)) throw new SupplierPaymentError("forbidden");
  const store = getStore();
  const order = await store.get("orders", orderId);
  if (!order) throw new SupplierPaymentError("not_found");
  let amount = input.amount ?? null;
  let currency = (input.currency ?? order.fobCurrency ?? "USD").toUpperCase();
  let note = input.note ?? null;
  if (amount === null) {
    const view = await supplierPaymentView(order, "");
    if (
      input.installment != null &&
      (view.installment?.index ?? null) !== input.installment
    )
      throw new SupplierPaymentError("installment_changed");
    if (!view.due || view.due <= 0)
      throw new SupplierPaymentError("nothing_due");
    amount = view.due;
    currency = view.currency;
    if (view.installment && !note)
      note = `Parcela ${view.installment.index}/${view.installment.count}`;
  }
  if (!(amount > 0)) throw new SupplierPaymentError("invalid_amount");
  const status = input.method === "manual" ? "confirmed" : "pending";
  const methodLabel: Record<SupplierPaymentMethod, string> = {
    manual: "manual",
    transfer_copied: "Transferência (dados copiados para o banco)",
    finance_email: "Solicitado ao financeiro por e-mail",
    finance_whatsapp: "Solicitado ao financeiro por WhatsApp",
  };
  const payment = await store.create("payments", {
    ...PAYMENT_EXTRA_DEFAULTS,
    orderId,
    requestId: null,
    direction: "supplier_out",
    amount,
    currency,
    fxRate: input.fxRate ?? null,
    method: methodLabel[input.method],
    status,
    proofDocumentId: input.proofDocumentId ?? null,
    registeredByUserId: user.id,
    confirmedByUserId: null,
    confirmedAt: null,
    note,
  });
  await audit(
    user,
    "payment.register",
    "payment",
    payment.id,
    `${currency} ${amount} · ${methodLabel[input.method]}`,
  );
  // Conclui "pagamento registrado" da etapa, se estiver ativa.
  const [stage] = await store.list("stages", {
    filter: { orderId, key: "SUPPLIER_PAYMENT" },
  });
  if (stage && (stage.status === "active" || stage.status === "blocked")) {
    const [req] = await store.list("requirements", {
      filter: {
        stageId: stage.id,
        key: "payment_registered",
        status: "pending",
      },
    });
    if (req) await submitRequirement(user, req.id, { value: payment.id });
  }
  await notify(
    { role: "supplier", partyId: order.supplierId },
    {
      subject: `Order #${order.number}: payment registered`,
      body: `${currency} ${amount.toFixed(2)}. Please confirm receipt.`,
      link: `/app/orders/${orderId}`,
    },
  );
  return payment;
}
