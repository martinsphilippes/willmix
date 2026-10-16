import type { Order } from "@/lib/db";
import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import type { SupplierPaymentView } from "@/lib/services/supplier-payment";
import {
  quickSupplierPaymentAction,
  registerSupplierPaymentAction,
} from "@/app/app/actions";
import { CurrencySelect } from "./currency-select";
import { PaymentActionButton } from "./payment-action-button";
import { SubmitButton } from "./submit-button";
import { Field, Input, TextLink, formatMoney } from "./ui";
import { MoneyInput } from "./money-input";

/**
 * Pagar o fornecedor (só Wellmix), dentro do card "Pagamento ao fornecedor":
 * valor da parcela da vez (ou o saldo, sem condição configurada), dados para
 * colar no banco e pedido ao financeiro por e-mail ou WhatsApp. Qualquer ação
 * registra o pagamento da parcela.
 */
export function SupplierPaymentPanel({
  order,
  t,
  view,
  manualOnly = false,
}: {
  order: Order;
  t: Translate;
  view: SupplierPaymentView;
  /** Só o "Já pagou? Registrar…" (nada a pagar agora, ou FOB desconhecido). */
  manualOnly?: boolean;
}) {
  const hasDue = view.due !== null && view.due > 0;
  /* Já pagou por fora: registra com valor, câmbio e comprovante. Valor, moeda
     e câmbio do tamanho do que se digita, numa linha só. */
  const manual = (
    <details className="group min-w-0 rounded-lg border border-zinc-200 bg-white md:col-span-2">
      <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-zinc-800">
        {t("supplierPay.manual")}
      </summary>
      <form
        action={registerSupplierPaymentAction}
        className="flex flex-wrap items-end gap-2 border-t border-zinc-100 p-2.5"
      >
        <input type="hidden" name="orderId" value={order.id} />
        {/* Parcela da vez: o pagamento fica ligado a ela. */}
        {hasDue && view.installment ? (
          <input
            type="hidden"
            name="installment"
            value={view.installment.index}
          />
        ) : null}
        <div className="w-[calc(50%-0.25rem)] min-w-0 sm:w-40">
          <Field label={t("orders.value")}>
            <MoneyInput
              locale={t.intl}
              name="amount"
              watchField="currency"
              required
              defaultAmount={hasDue ? view.due : null}
              className="w-full"
            />
          </Field>
        </div>
        <div className="w-[calc(50%-0.25rem)] min-w-0 sm:w-36">
          <Field label={t("common.currency")}>
            <CurrencySelect name="currency" value={view.currency} t={t} />
          </Field>
        </div>
        <div className="w-full min-w-0 sm:w-28">
          <Field label={t("finance.fx")}>
            <Input name="fxRate" type="number" step="any" />
          </Field>
        </div>
        <div className="w-full min-w-0 sm:w-auto sm:min-w-56 sm:flex-1">
          <Field label={t("requests.payment.proof")}>
            <Input name="proof" type="file" />
          </Field>
        </div>
        <div>
          <SubmitButton>{t("orders.registerPayment")}</SubmitButton>
        </div>
      </form>
    </details>
  );
  if (manualOnly) return manual;
  // Parcela que a tela mostra: o servidor recusa se outra pessoa já a cobriu.
  const installment = view.installment ? (
    <input type="hidden" name="installment" value={view.installment.index} />
  ) : null;

  return (
    /* Valor devido | dados para o banco lado a lado (iPad em diante); botões,
       dica e registro manual ocupam a largura toda. */
    <div className="mt-3 grid scroll-mt-24 items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            {t("supplierPay.due")}
          </p>
          <p className="text-2xl font-bold tracking-tight tabular-nums text-zinc-900">
            {view.due !== null ? formatMoney(view.due, view.currency, t) : "—"}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            {view.fobTotal !== null
              ? t("supplierPay.dueHint", {
                  fob: formatMoney(view.fobTotal, view.currency, t),
                  paid: formatMoney(view.alreadyRegistered, view.currency, t),
                })
              : t("supplierPay.noFob")}
          </p>
        </div>
      </div>

      {hasDue ? (
        <>
          <div className="min-w-0 space-y-1.5">
            <p className="text-sm font-semibold text-zinc-900">
              {t("supplierPay.transfer")}
            </p>
            <pre className="whitespace-pre-wrap break-words rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-xs leading-relaxed text-zinc-800">
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

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap md:col-span-2">
            <form action={quickSupplierPaymentAction}>
              <input type="hidden" name="orderId" value={order.id} />
              <input type="hidden" name="method" value="transfer_copied" />
              {installment}
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
              {installment}
              <PaymentActionButton openUrl={view.emailUrl}>
                ✉️ {t("supplierPay.email")}
              </PaymentActionButton>
            </form>
            <form action={quickSupplierPaymentAction}>
              <input type="hidden" name="orderId" value={order.id} />
              <input type="hidden" name="method" value="finance_whatsapp" />
              {installment}
              <PaymentActionButton openUrl={view.whatsappUrl}>
                💬 {t("supplierPay.whatsapp")}
              </PaymentActionButton>
            </form>
          </div>
          <p className="-mt-1 text-xs leading-relaxed text-zinc-500 md:col-span-2">
            {t("supplierPay.actionsHint")}
          </p>
        </>
      ) : null}

      {manual}
    </div>
  );
}
