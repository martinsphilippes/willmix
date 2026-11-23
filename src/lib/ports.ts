import type { SankhyaProductSupplierPort } from "@/lib/db/schema";

/*
 * Portos de embarque por país (dono, 23/11/2026): a lista vem do que o
 * cadastro já tem, os portos do par produto × fornecedor da carga do Sankhya
 * (`product_suppliers.sankhyaPorts`). Regra pura: sem banco, sem tela.
 */

/** Sem acento, em maiúsculas e sem espaços sobrando. */
export const foldCountry = (value: string | null | undefined) =>
  (value ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toUpperCase();

/** Siglas e nomes em outro idioma que aparecem no cadastro dos parceiros. */
const ALIASES: Record<string, string> = {
  CN: "CHINA",
  CHN: "CHINA",
  IN: "INDIA",
  IND: "INDIA",
  EG: "EGITO",
  EGYPT: "EGITO",
  PK: "PAQUISTAO",
  PAKISTAN: "PAQUISTAO",
  TR: "TURQUIA",
  TURKEY: "TURQUIA",
  VN: "VIETNA",
  VIETNAM: "VIETNA",
  BR: "BRASIL",
  BRAZIL: "BRASIL",
};

export const countryKey = (value: string | null | undefined) => {
  const folded = foldCountry(value);
  return ALIASES[folded] ?? folded;
};

/**
 * Os portos do país, sem repetir, do mais usado para o menos usado (empate:
 * ordem alfabética). País vazio ou sem porto cadastrado: lista vazia.
 */
export function portsOfCountry(
  rows: ReadonlyArray<{
    sankhyaPorts?: readonly SankhyaProductSupplierPort[] | null;
  }>,
  country: string | null | undefined,
): string[] {
  const key = countryKey(country);
  if (!key) return [];
  const count = new Map<string, number>();
  for (const row of rows)
    for (const port of row.sankhyaPorts ?? []) {
      const name = port.port?.trim();
      if (!name || countryKey(port.country) !== key) continue;
      count.set(name, (count.get(name) ?? 0) + 1);
    }
  return [...count.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name]) => name);
}
