import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";

/*
 * Peças compartilhadas do catálogo (ficha do produto, página de NCM, parceiro
 * e linhas): mensagem de erro traduzida e campo maior para o celular.
 */

/** Campo maior para uso no celular (fábrica/feira): py-2.5 em vez de py-2. */
export const big = "py-2.5";

/** Mensagem de ?error=: traduzida quando o código é do módulo; senão a genérica com o código. */
export function catalogError(
  t: Translate,
  code: string | string[] | undefined,
): string | null {
  if (typeof code !== "string" || !code) return null;
  const key = `catalog.error.${code}` as DictionaryKey;
  const text = t(key);
  return text === key ? `${t("common.error")} (${code})` : text;
}

/** Nome do usuário por id (listas de "validado por", "registrado por"). */
export function userNameFor(users: Array<{ id: string; name: string }>) {
  return (uid: string | null | undefined) =>
    uid ? (users.find((u) => u.id === uid)?.name ?? "—") : "—";
}
