import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { CURRENCIES } from "@/lib/currencies";
import { Select } from "./ui";

/**
 * Campo de moeda: escolha entre as moedas da Wellmix (Real, Yuan, Dólar, Euro),
 * nada digitado. Um valor antigo fora da lista continua aparecendo para não se
 * perder ao salvar.
 */
export function CurrencySelect({
  name,
  value,
  t,
  required,
  disabled,
  allowEmpty,
  className,
  dense,
}: {
  name?: string;
  value: string | null | undefined;
  t: Translate;
  required?: boolean;
  disabled?: boolean;
  /** Mostra "Selecione" (campo opcional). */
  allowEmpty?: boolean;
  className?: string;
  /** Campo compacto (formulários densos). */
  dense?: boolean;
}) {
  const current = value ? value.toUpperCase() : "";
  const legacy =
    current && !(CURRENCIES as readonly string[]).includes(current)
      ? current
      : null;
  return (
    <Select
      name={name}
      defaultValue={current || (allowEmpty ? "" : CURRENCIES[0])}
      required={required}
      disabled={disabled}
      className={className}
      dense={dense}
    >
      {allowEmpty ? <option value="">{t("common.select")}</option> : null}
      {legacy ? <option value={legacy}>{legacy}</option> : null}
      {CURRENCIES.map((c) => (
        <option key={c} value={c}>
          {t(`currency.name.${c}` as DictionaryKey)}
        </option>
      ))}
    </Select>
  );
}
