import type { Translate } from "@/i18n";
import { fallbackError } from "@/i18n/error-text";
import type { DictionaryKey } from "@/i18n/dictionaries";

/*
 * Peças compartilhadas do catálogo (ficha do produto, página de NCM, parceiro
 * e linhas): mensagem de erro traduzida e nome de usuário por id.
 */

/**
 * Antes deixava o campo mais alto (py-2.5) para o celular; agora os campos
 * seguem o tamanho compacto do kit (ui.tsx), então não acrescenta nada.
 */
export const big = "";

/** Mensagem de ?error=: traduzida quando o código é do módulo; senão a genérica com o código. */
export function catalogError(
  t: Translate,
  code: string | string[] | undefined,
): string | null {
  if (typeof code !== "string" || !code) return null;
  const key = `catalog.error.${code}` as DictionaryKey;
  const text = t(key);
  return text === key ? fallbackError(t, code) : text;
}

/** Nome do usuário por id (listas de "validado por", "registrado por"). */
export function userNameFor(users: Array<{ id: string; name: string }>) {
  return (uid: string | null | undefined) =>
    uid ? (users.find((u) => u.id === uid)?.name ?? "—") : "—";
}
