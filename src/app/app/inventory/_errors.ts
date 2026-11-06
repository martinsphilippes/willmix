import type { DictionaryKey } from "@/i18n/dictionaries";
import type { Translate } from "@/i18n";

/** Texto do erro das ações de estoque (código conhecido) ou o genérico. */
export function stockErrorText(t: Translate, code: string): string {
  const key = `stockCount.error.${code}` as DictionaryKey;
  const text = t(key);
  return text === key ? t("common.error") : text;
}
