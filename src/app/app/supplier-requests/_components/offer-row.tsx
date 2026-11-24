import { SHEET_CURRENCIES, SHEET_INCOTERMS } from "@/lib/db/schema";
import type { Translate } from "@/i18n";
import { Field, Input, Select } from "@/components/ui";
import { FxFieldWatch } from "@/components/fx-field-watch";

/*
 * Linha de oferta dos formulários da negociação (docs/SUPPLIER_REQUESTS.md,
 * "Tela da negociação reorganizada").
 */

/** Campos de 36px nesta tela (toque no iPad); o padrão do portal não muda. */
export const FIELD = "min-h-9";

/**
 * Preço/peça | Moeda | Mínimo (peças) | Produção (dias) | Incoterm numa linha
 * só quando cabe (resposta do fornecedor e resposta à contraproposta; a da
 * Wellmix usa `ProposalFields`, com a mesma grade). Os nomes
 * dos campos são os de sempre: a Server Action não muda.
 */
export function OfferRowFields({
  t,
  values,
  showPrice = true,
  marks = {},
}: {
  t: Translate;
  values: {
    price: number | null | undefined;
    currency: string;
    moq: number | null | undefined;
    leadTimeDays: number | null | undefined;
    incoterm: string;
  };
  showPrice?: boolean;
  /** Atributos `data-*` de cada campo (os que os testes já usam). */
  marks?: Partial<
    Record<"price" | "moq" | "leadTime" | "incoterm", `data-${string}`>
  >;
}) {
  const decimal = t.intl.startsWith("pt") ? "," : ".";
  const raw = (n: number | null | undefined) =>
    n === null || n === undefined ? "" : String(n).replace(".", decimal);
  const mark = (key: keyof typeof marks) =>
    marks[key] ? { [marks[key]]: true } : {};
  return (
    <div className="@container">
      <div
        className={
          showPrice
            ? "grid grid-cols-2 gap-2 @sm:grid-cols-3 @xl:grid-cols-5"
            : "grid grid-cols-2 gap-2 @sm:grid-cols-3"
        }
        data-offer-row
      >
        {showPrice ? (
          <>
            <Field label={t("negotiationScreen.f.price")}>
              <Input
                name="price"
                inputMode="decimal"
                className={FIELD}
                defaultValue={raw(values.price)}
                {...mark("price")}
              />
              {/* Trocar a moeda converte o preço (dono, 21/11/2026). */}
              <FxFieldWatch price="price" currency="currency" locale={t.intl} />
            </Field>
            <Field label={t("negotiationScreen.f.currency")}>
              <Select
                name="currency"
                className={FIELD}
                defaultValue={values.currency}
              >
                {SHEET_CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
          </>
        ) : null}
        <Field label={t("negotiationScreen.f.moq")}>
          <Input
            name="moq"
            inputMode="numeric"
            className={FIELD}
            defaultValue={raw(values.moq)}
            {...mark("moq")}
          />
        </Field>
        <Field label={t("negotiationScreen.f.leadTime")}>
          <Input
            name="leadTimeDays"
            inputMode="numeric"
            className={FIELD}
            defaultValue={raw(values.leadTimeDays)}
            {...mark("leadTime")}
          />
        </Field>
        <Field label={t("negotiationScreen.f.incoterm")}>
          <Select
            name="incoterm"
            className={FIELD}
            defaultValue={values.incoterm}
            {...mark("incoterm")}
          >
            {SHEET_INCOTERMS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </div>
  );
}
