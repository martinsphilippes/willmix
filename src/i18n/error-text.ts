import type { Translate } from "@/i18n";
import { dictionaries, type DictionaryKey } from "@/i18n/dictionaries";

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

/**
 * Textos de todos os códigos de erro dos prefixos, no idioma da tela, para o
 * formulário que mostra o erro sem recarregar (`ActionForm`). O primeiro
 * prefixo vence quando o mesmo código existe em dois. Só os códigos em
 * snake_case (as outras chaves dos prefixos não são erros).
 */
export function errorTextsFor(
  t: Translate,
  prefixes: readonly string[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const prefix of [...prefixes].reverse()) {
    const head = `${prefix}.`;
    for (const key of Object.keys(dictionaries.pt)) {
      if (!key.startsWith(head)) continue;
      const code = key.slice(head.length);
      if (!/^[a-z][a-z0-9_]*$/.test(code)) continue;
      out[code] = t(key as DictionaryKey);
    }
  }
  out.unexpected = t("common.unexpected");
  return out;
}
