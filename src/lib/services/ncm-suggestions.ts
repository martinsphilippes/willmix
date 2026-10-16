import "server-only";
import { getStore, type Request } from "@/lib/db";
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

export type NcmChipSource =
  "request" | "product" | "validated" | "suggested" | "ai" | "table";

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
  /** Solicitação da ficha: NCM confirmado nela e sugestões da IA/tabela guardadas. */
  request?: Pick<Request, "ncm" | "ncmSuggestions"> | null,
): Promise<NcmChip[]> {
  const out: Array<Omit<NcmChip, "rates">> = [];
  const push = (chip: Omit<NcmChip, "rates">) => {
    const ncm = normalizeNcm(chip.ncm);
    if (!ncm || out.some((o) => o.ncm === ncm)) return;
    out.push({ ...chip, ncm });
  };
  // Confirmado na solicitação vale mais que tudo (a Wellmix já decidiu).
  if (request?.ncm)
    push({ ncm: request.ncm, description: null, source: "request" });
  const store = getStore();
  const product = productId ? await store.get("products", productId) : null;
  // Sem produto do catálogo: só o que a solicitação tem (IA/tabela).
  const fromRequest = () => {
    for (const sug of request?.ncmSuggestions ?? [])
      push({
        ncm: sug.ncm,
        description: sug.description,
        source: sug.source === "ai" ? "ai" : "table",
      });
  };
  if (!product) {
    fromRequest();
    return withRates(out);
  }
  if (product.ncm)
    push({ ncm: product.ncm, description: null, source: "product" });
  const rows = await listTaxClassifications(product.id);
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
  fromRequest();
  return withRates(out);
}

function withRates(chips: Array<Omit<NcmChip, "rates">>): Promise<NcmChip[]> {
  return Promise.all(
    chips
      .slice(0, MAX_CHIPS)
      .map(async (chip) => ({ ...chip, rates: await lookupNcm(chip.ncm) })),
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

/** "II 20% · IPI 0%" do NCM na tabela (null = NCM vazio ou fora da tabela). */
export async function ncmRatesText(
  t: Translate,
  ncm: string | null | undefined,
): Promise<string | null> {
  if (!normalizeNcm(ncm)) return null;
  const rates = await lookupNcm(ncm);
  if (!rates) return null;
  const pct = (n: number | null) =>
    n === null
      ? "—"
      : `${n.toLocaleString(t.intl, { maximumFractionDigits: 2 })}%`;
  return t("ncm.rates", {
    ii: pct(rates.ii),
    ipi: rates.ipiNt ? t("ncm.nt") : pct(rates.ipi),
  });
}

export function ncmChipsView(t: Translate, chips: NcmChip[]): NcmChipView[] {
  const pct = (n: number | null) =>
    n === null
      ? "—"
      : `${n.toLocaleString(t.intl, { maximumFractionDigits: 2 })}%`;
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
