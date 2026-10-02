import { headers } from "next/headers";
import type { Order } from "@/lib/db";
import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { supplierPaymentView } from "@/lib/services/supplier-payment";
import {
  quickSupplierPaymentAction,
  registerSupplierPaymentAction,
} from "@/app/app/actions";
import { CurrencySelect } from "./currency-select";
import { PaymentActionButton } from "./payment-action-button";
import { SubmitButton } from "./submit-button";
import { Field, Input, TextLink, formatMoney } from "./ui";

/**
 * Pagar o fornecedor (só Wellmix): valor devido calculado (FOB − já
 * registrado), dados para colar no banco e pedido ao financeiro por e-mail ou
 * WhatsApp. Qualquer ação registra o pagamento e conclui o item da etapa.
 */
export async function SupplierPaymentPanel({
  order,
  t,
}: {
  order: Order;
  t: Translate;
}) {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const view = await supplierPaymentView(
    order,
    `${proto}://${host}/app/orders/${order.id}`,
  );
  if (view.registered) return null;
  const hasDue = view.due !== null && view.due > 0;

  return (
    <div
      id="supplier-payment"
      className="mt-4 scroll-mt-24 space-y-4 rounded-xl border border-zinc-200 bg-zinc-50/70 p-4"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            {t("supplierPay.due")}
          </p>
          <p className="text-2xl font-bold tracking-tight tabular-nums text-zinc-900">
            {view.due !== null ? formatMoney(view.due, view.currency) : "—"}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            {view.fobTotal !== null
              ? t("supplierPay.dueHint", {
                  fob: formatMoney(view.fobTotal, view.currency),
                  paid: formatMoney(view.alreadyRegistered, view.currency),
                })
              : t("supplierPay.noFob")}
          </p>
        </div>
      </div>

      {hasDue ? (
        <>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-zinc-900">
              {t("supplierPay.transfer")}
            </p>
            <pre className="whitespace-pre-wrap break-words rounded-lg border border-zinc-200 bg-white p-3 font-mono text-xs leading-relaxed text-zinc-800">
              {view.transferText}
            </pre>
            {view.missingBank.length ? (
              <p className="text-xs text-amber-700">
                {t("supplierPay.missingBank", {
                  fields: view.missingBank
                    .map((k) => t(`supplierPay.field.${k}` as DictionaryKey))
                    .join(", "),
                })}{" "}
                <TextLink href={`/app/parties/${order.supplierId}#bank`}>
                  {t("supplierPay.fillBank")}
                </TextLink>
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <form action={quickSupplierPaymentAction}>
              <input type="hidden" name="orderId" value={order.id} />
              <input type="hidden" name="method" value="transfer_copied" />
              <PaymentActionButton
                copyText={view.transferText}
                variant="primary"
              >
                {t("supplierPay.copy")}
              </PaymentActionButton>
            </form>
            <form action={quickSupplierPaymentAction}>
              <input type="hidden" name="orderId" value={order.id} />
              <input type="hidden" name="method" value="finance_email" />
              <PaymentActionButton openUrl={view.emailUrl}>
                ✉️ {t("supplierPay.email")}
              </PaymentActionButton>
            </form>
            <form action={quickSupplierPaymentAction}>
              <input type="hidden" name="orderId" value={order.id} />
              <input type="hidden" name="method" value="finance_whatsapp" />
              <PaymentActionButton openUrl={view.whatsappUrl}>
                💬 {t("supplierPay.whatsapp")}
              </PaymentActionButton>
            </form>
          </div>
          <p className="text-xs leading-relaxed text-zinc-500">
            {t("supplierPay.actionsHint")}
          </p>
        </>
      ) : null}

      {/* Já pagou por fora: registra com valor, câmbio e comprovante. */}
      <details className="group rounded-lg border border-zinc-200 bg-white">
        <summary className="cursor-pointer select-none px-3 py-2.5 text-sm font-semibold text-zinc-800">
          {t("supplierPay.manual")}
        </summary>
        <form
          action={registerSupplierPaymentAction}
          className="grid gap-4 border-t border-zinc-100 p-3 sm:grid-cols-3"
        >
          <input type="hidden" name="orderId" value={order.id} />
          <Field label={t("orders.value")}>
            <Input
              name="amount"
              type="number"
              step="0.01"
              min="0"
              required
              defaultValue={view.due ?? ""}
            />
          </Field>
          <Field label={t("common.currency")}>
            <CurrencySelect name="currency" value={view.currency} t={t} />
          </Field>
          <Field label={t("finance.fx")}>
            <Input name="fxRate" type="number" step="any" />
          </Field>
          <div className="sm:col-span-3">
            <Field label={t("requests.payment.proof")}>
              <Input name="proof" type="file" />
            </Field>
          </div>
          <div className="sm:col-span-3">
            <SubmitButton>{t("orders.registerPayment")}</SubmitButton>
          </div>
        </form>
      </details>
    </div>
  );
}
