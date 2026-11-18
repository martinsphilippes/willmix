import type { Translate } from "@/i18n";
import { pt } from "@/i18n/modules/economic-groups";

/** Textos do pedido para um grupo econômico (com os {marcadores}). */
export type EconomicGroupLabels = Record<keyof typeof pt, string>;

const VARS = ["n", "name", "pct", "list", "cartons", "pieces", "product"];

/** Os textos do módulo, com os marcadores intactos para a tela preencher. */
export function economicGroupLabels(t: Translate): EconomicGroupLabels {
  const keep = Object.fromEntries(VARS.map((v) => [v, `{${v}}`]));
  return Object.fromEntries(
    (Object.keys(pt) as (keyof typeof pt)[]).map((k) => [k, t(k, keep)]),
  ) as EconomicGroupLabels;
}

/** "{n} empresas" → "3 empresas". */
export function fillLabel(
  text: string,
  vars: Record<string, string | number>,
): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) =>
    k in vars ? String(vars[k]) : m,
  );
}
