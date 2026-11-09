import type { Translate } from "@/i18n";
import { Field, Input, cx } from "./ui";

/*
 * Campo do câmbio do banco nos formulários de pagamento ao fornecedor
 * ("Marcar como pago" e "Já pagou? Registrar"): em destaque, para entrar na
 * hora em que o pagamento sai (é o que tira o "~" do custo no Financeiro).
 * Continua opcional: quem marca como pago nem sempre tem o câmbio do banco na
 * mão, e um número inventado só para passar seria pior que o aviso. A cotação
 * automática do dia aparece só como referência; o campo fica vazio.
 */
export function BankFxField({
  t,
  currency,
  reference,
  className,
}: {
  t: Translate;
  /** Moeda do pagamento; nula quando a pessoa ainda escolhe a moeda. */
  currency: string | null;
  /** "Referência: cotação automática de 09/11, 1 USD = R$ 5,5037". */
  reference: string | null;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "min-w-0 rounded-lg bg-amber-50 px-2 pb-1.5 pt-1 ring-1 ring-amber-300",
        className,
      )}
      data-bank-fx-field=""
    >
      <Field
        label={
          currency
            ? t("finance.fx.bankLabel", { currency: currency.toUpperCase() })
            : t("finance.fx.bankLabelAny")
        }
        hint={
          <>
            <span className="block">{t("finance.fx.bankHint")}</span>
            {reference ? (
              <span className="block" data-fx-reference="">
                {reference}
              </span>
            ) : null}
          </>
        }
      >
        {/* R$ por 1 unidade da moeda do pagamento (como a PTAX). */}
        <Input
          name="fxRate"
          type="number"
          step="any"
          min="0"
          placeholder={
            currency
              ? t("finance.fx.unitHint", { currency: currency.toUpperCase() })
              : t("finance.fx.unitHintShort")
          }
          title={t("finance.fx.unitHintAny")}
        />
      </Field>
    </div>
  );
}
