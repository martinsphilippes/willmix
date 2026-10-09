import type { Translate } from "@/i18n";
import { fallbackError } from "@/i18n/error-text";
import type { DictionaryKey } from "@/i18n/dictionaries";
import type { ContainerStatus } from "@/lib/db";
import type { Tone } from "@/components/ui";

/*
 * Peças compartilhadas do módulo Containers: tom do selo por situação,
 * mensagem de erro traduzida e formatação de números (CBM com até 4 casas).
 */

/** Campo maior no celular (16 px para o iOS não dar zoom); compacto (13 px) a partir do tablet. */
export const bigField = "py-2 text-base sm:py-1 sm:text-[13px] sm:leading-5";

export function containerTone(status: ContainerStatus): Tone {
  switch (status) {
    case "planning":
      return "neutral";
    case "loading":
      return "brand";
    case "shipped":
      return "info";
    case "arrived":
      return "warning";
    case "closed":
      return "success";
    default:
      return "neutral";
  }
}

/** Mensagem de erro vinda de ?error=: traduzida quando o código é do módulo; senão a genérica com o código. */
export function errorMessage(
  t: Translate,
  code: string | string[] | undefined,
): string | null {
  if (typeof code !== "string" || !code) return null;
  const key = `containers.error.${code}` as DictionaryKey;
  const text = t(key);
  return text === key ? fallbackError(t, code) : text;
}

/** Número em pt-BR com até `digits` casas, sem zeros à direita. */
export function formatNumber(
  value: number | null | undefined,
  intl = "pt-BR",
  digits = 3,
) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat(intl, {
    maximumFractionDigits: digits,
  }).format(value);
}

/** Percentual com 1 casa (ex.: 42,5%). */
export function formatPercent(
  value: number | null | undefined,
  intl = "pt-BR",
) {
  if (value === null || value === undefined) return "—";
  return `${formatNumber(value, intl, 1)}%`;
}
