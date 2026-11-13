import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";

/**
 * Texto de erro sem tradução própria: "unexpected" (falha técnica, já
 * registrada no log do servidor) vira uma frase clara; outros códigos seguem
 * como "Não foi possível concluir… (código)".
 */
export function fallbackError(t: Translate, code: string | null | undefined) {
  if (!code || code === "unexpected") return t("common.unexpected");
  return `${t("common.error")} (${code})`;
}

/**
 * Texto de um código de erro: a tradução do primeiro prefixo que tem o
 * código (ex.: `dieCut.error`, depois `orders.error`); sem nenhuma, o texto
 * padrão de `fallbackError`.
 */
export function errorTextFor(
  t: Translate,
  code: string,
  prefixes: readonly string[],
): string {
  for (const prefix of prefixes) {
    const key = `${prefix}.${code}`;
    const text = t(key as DictionaryKey);
    if (text !== key) return text;
  }
  return fallbackError(t, code);
}
