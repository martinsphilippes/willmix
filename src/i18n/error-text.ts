import type { Translate } from "@/i18n";

/**
 * Texto de erro sem tradução própria: "unexpected" (falha técnica, já
 * registrada no log do servidor) vira uma frase clara; outros códigos seguem
 * como "Não foi possível concluir… (código)".
 */
export function fallbackError(t: Translate, code: string | null | undefined) {
  if (!code || code === "unexpected") return t("common.unexpected");
  return `${t("common.error")} (${code})`;
}
