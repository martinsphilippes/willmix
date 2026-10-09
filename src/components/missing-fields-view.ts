import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import type { MissingItem } from "./missing-fields";

/**
 * Props do aviso "faltam" a partir da tradução com {fields}: texto antes e
 * depois da lista e um item por campo (rótulo da ficha), para o componente
 * de cliente tornar cada um clicável.
 */
export function missingFieldsView(
  t: Translate,
  messageKey: DictionaryKey,
  missing: readonly string[],
): { before: string; after: string; items: MissingItem[]; hint: string } {
  const marker = "\u0001";
  const [before, after = ""] = t(messageKey, { fields: marker }).split(marker);
  return {
    before,
    after,
    items: missing.map((key) => ({
      key,
      label: t(`sheet.field.${key}` as DictionaryKey),
    })),
    hint: t("sheet.missingHint"),
  };
}
