import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";

/** Texto traduzido do motivo de falha da IA ("ai_card_required" ou "card_required"); null se não for da IA. */
export function aiErrorText(
  t: Translate,
  code: string | string[] | null | undefined,
): string | null {
  if (typeof code !== "string" || !code) return null;
  const c = code.startsWith("ai_") ? code.slice(3) : code;
  const key = `ai.error.${c}` as DictionaryKey;
  const text = t(key);
  return text === key ? null : text;
}
