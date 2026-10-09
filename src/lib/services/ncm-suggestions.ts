import "server-only";
import { getStore } from "@/lib/db";
import type { Translate } from "@/i18n";
import { formatNcm, normalizeNcm } from "@/lib/fiscal";
import { lookupNcm, ncmsWithPrefix, type NcmRates } from "./fiscal";
import { listTaxClassifications, suggestNcm } from "./taxes";

/*
 * Sugestões de NCM para o campo NCM da ficha de compra (mestre, cotação e
 * pedido): o NCM do cadastro do produto, as classificações já registradas
 * (validadas primeiro) e as candidatas por palavra-chave × tabela fiscal.
 * Nada é gravado: quem edita escolhe com um clique e salva a ficha.
 */

export type NcmChipSource = "product" | "validated" | "suggested" | "table";

export interface NcmChip {
  ncm: string;
  description: string | null;
  source: NcmChipSource;
  /** Alíquotas na tabela; null = fora da tabela carregada. */
  rates: NcmRates | null;
}

const MAX_CHIPS = 6;

export async function ncmSuggestionsFor(
  productId: string | null | undefined,
): Promise<NcmChip[]> {
  if (!productId) return [];
  const store = getStore();
  const product = await store.get("products", productId);
  if (!product) return [];
  const out: Array<Omit<NcmChip, "rates">> = [];
  const push = (chip: Omit<NcmChip, "rates">) => {
    const ncm = normalizeNcm(chip.ncm);
    if (!ncm || out.some((o) => o.ncm === ncm)) return;
    out.push({ ...chip, ncm });
  };
  if (product.ncm)
    push({ ncm: product.ncm, description: null, source: "product" });
  const rows = await listTaxClassifications(productId);
  for (const r of rows.filter((r) => r.status === "validated"))
    push({ ncm: r.ncm, description: r.description, source: "validated" });
  for (const r of rows.filter((r) => r.status === "suggested"))
    push({ ncm: r.ncm, description: r.description, source: "suggested" });
  for (const hint of suggestNcm(product).slice(0, 3)) {
    if (normalizeNcm(hint.ncm)) {
      push({ ncm: hint.ncm, description: hint.description, source: "table" });
      continue;
    }
    // Posição de 4 a 6 dígitos: os subitens da tabela fiscal.
    const digits = hint.ncm.replace(/\D/g, "");
    if (digits.length < 4) continue;
    for (const r of await ncmsWithPrefix(digits, 3))
      push({
        ncm: r.ncm,
        description: r.description ?? hint.description,
        source: "table",
      });
  }
  const top = out.slice(0, MAX_CHIPS);
  return Promise.all(
    top.map(async (chip) => ({ ...chip, rates: await lookupNcm(chip.ncm) })),
  );
}

/** Texto pronto para a tela (idioma do usuário). */
export interface NcmChipView {
  ncm: string;
  label: string;
  description: string | null;
  source: string;
  rates: string;
  ii: number | null;
  ipi: number | null;
}

export function ncmChipsView(t: Translate, chips: NcmChip[]): NcmChipView[] {
  const pct = (n: number | null) =>
    n === null
      ? "—"
      : `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
  return chips.map((c) => ({
    ncm: c.ncm,
    label: formatNcm(c.ncm),
    description: c.rates?.description ?? c.description,
    source: t(`ncm.sheet.source.${c.source}`),
    rates: c.rates
      ? t("ncm.rates", {
          ii: pct(c.rates.ii),
          ipi: c.rates.ipiNt ? t("ncm.nt") : pct(c.rates.ipi),
        })
      : t("ncm.notInTable"),
    ii: c.rates?.ii ?? null,
    ipi: c.rates && !c.rates.ipiNt ? c.rates.ipi : null,
  }));
}
