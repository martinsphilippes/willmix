import type { Translate } from "@/i18n";
import type { PaymentWithoutFx } from "@/lib/services/finance";
import { setSupplierPaymentFxAction } from "@/app/app/actions/supplier-terms";
import { missingPaymentText } from "./finance-fx-text";
import { SubmitButton } from "./submit-button";
import { Input } from "./ui";

/*
 * "Falta o câmbio do banco…" na linha do pedido (tela Financeiro), com o botão
 * "Informar câmbio": abre ali mesmo um campo por pagamento sem câmbio. Salvar
 * volta para a mesma linha, com custo e margem já recalculados. Só a tela
 * Financeiro (administrador) mostra; a ação confere o papel de novo.
 */
export function FxInform({
  t,
  orderId,
  text,
  payments,
  open,
}: {
  t: Translate;
  orderId: string;
  /** "Falta o câmbio do banco do pagamento de US$ 6.800,00 (05/11)". */
  text: string;
  payments: PaymentWithoutFx[];
  /** Já aberto (voltou com erro nesta linha). */
  open: boolean;
}) {
  return (
    <div
      className="mt-1.5 max-w-52 whitespace-normal"
      data-fx-missing={payments.length}
    >
      <p className="text-xs font-semibold leading-snug text-amber-800">
        {text}
      </p>
      <details className="mt-1" open={open} data-fx-inform>
        <summary className="inline-flex cursor-pointer select-none list-none items-center whitespace-nowrap rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900 ring-1 ring-amber-300 transition hover:bg-amber-200 [&::-webkit-details-marker]:hidden">
          {t("finance.fx.setTitle")}
        </summary>
        <div className="mt-1.5 space-y-2">
          {payments.map((p) => (
            <form
              key={p.id}
              action={setSupplierPaymentFxAction}
              className="space-y-1"
              data-fx-inform-form={p.id}
            >
              <input type="hidden" name="orderId" value={orderId} />
              <input type="hidden" name="paymentId" value={p.id} />
              <input type="hidden" name="back" value="finance" />
              <label
                htmlFor={`fx-rate-${p.id}`}
                className="block text-[11px] leading-snug text-zinc-600"
              >
                {missingPaymentText(t, p)}
              </label>
              <div className="flex items-center gap-1.5">
                <Input
                  id={`fx-rate-${p.id}`}
                  name="fxRate"
                  type="number"
                  step="any"
                  min="0"
                  required
                  dense
                  className="w-28"
                  placeholder={t("finance.fx.unitHint", {
                    currency: p.currency,
                  })}
                  title={t("finance.fx.bankLabel", { currency: p.currency })}
                />
                <SubmitButton
                  variant="secondary"
                  className="shrink-0 px-2.5 py-1 text-xs"
                >
                  {t("finance.fx.setSave")}
                </SubmitButton>
              </div>
            </form>
          ))}
        </div>
      </details>
    </div>
  );
}
