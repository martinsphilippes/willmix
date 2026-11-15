import "server-only";
import { getStore } from "@/lib/db";
import { listColumns } from "@/lib/db/lookup";
import { countryKey, countryName } from "@/lib/order-terms";
import { hiddenBookingProductIds } from "./booking-visibility";
import { sankhyaProductSuppliers } from "./sankhya-product-suppliers";
import { sankhyaProductGroups } from "./sankhya-product-families";

/*
 * País de origem e grupo de produto da Nova solicitação (dono, 15/11/2026;
 * docs/ORDER_TERMS.md): o vendedor escolhe o país e depois o grupo, e só os
 * produtos daquele país e grupo entram no pedido.
 *
 * - Grupo de produto = a família, dois níveis acima da linha (dono,
 *   15/11/2026): o grupo avô da linha no Sankhya (TGFGRU.CODGRUPAI do
 *   CODGRUPAI), lido pela API (sankhya-product-families.ts). Famílias com o
 *   mesmo nome são uma só (chave "fm:<NOME>"). Linha sem código do Sankhya
 *   ou sem o Sankhya: o nome da própria linha.
 * - País de origem = o país do fornecedor do produto: o fornecedor do
 *   cadastro (`supplierId`) ou, sem ele, o fornecedor que veio do Sankhya
 *   (`sankhyaRefs.CODPARCFORN` → parceiro com esse código). Sem nenhum dos
 *   dois, o produto não tem país e não é vendido por aqui (dono,
 *   15/11/2026): não aparece na lista nem na busca.
 *
 * O índice (produto → país e grupo) é lido do banco e guardado por alguns
 * minutos por instância: são ~14 mil produtos e ~6 mil fornecedores.
 */

export interface OriginCountry {
  key: string;
  name: string;
  products: number;
}

export interface OriginGroup {
  /** Chave da família ("sk:<CODGRUPAI>" ou "ln:<id da linha>"). */
  id: string;
  name: string;
  products: number;
}

export interface ProductOrigin {
  country: string;
  lineId: string;
  family: string;
}

interface OriginIndex {
  at: number;
  /** produto → país, linha e família */
  byProduct: Map<string, ProductOrigin>;
  countryNames: Map<string, string>;
  /** família → nome e as linhas dela */
  families: Map<string, { name: string; lineIds: Set<string> }>;
  /** linha → família */
  lineFamily: Map<string, string>;
  /** CODPROD do Sankhya → produto do portal */
  byCode: Map<string, string>;
}

const TTL_MS = 10 * 60 * 1000;

/**
 * Chave da família pelo nome: sem acento, sem caixa e só letras e números
 * ("Utilidades Domésticas" e "UTILIDADES DOMESTICAS" = "fm:UTILIDADES_DOMESTICAS").
 */
export function familyKey(name: string | null | undefined): string | null {
  const slug = (name ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
  return slug ? `fm:${slug}` : null;
}

/** Quantos níveis acima da linha fica a família (dono, 15/11/2026: 2). */
export const FAMILY_LEVELS_UP = 2;
let cached: OriginIndex | null = null;
let pending: Promise<OriginIndex> | null = null;

/** Para testes: esquece o índice. */
export function resetOriginIndex() {
  cached = null;
  pending = null;
}

async function buildIndex(): Promise<OriginIndex> {
  const store = getStore();
  const [products, suppliers, hidden, lines, groups] = await Promise.all([
    listColumns(
      store,
      "products",
      ["lineId", "supplierId", "sankhyaRefs", "sankhyaCode"],
      {
        filter: { active: true },
        jsonKeys: { sankhyaRefs: ["CODPARCFORN"] },
      },
    ),
    listColumns(store, "parties", ["country", "sankhyaCode"], {
      filter: { type: "supplier" },
    }),
    hiddenBookingProductIds(),
    listColumns(store, "product_lines", ["name", "sankhyaCode"]),
    sankhyaProductGroups(),
  ]);
  // Família de cada linha: o grupo do Sankhya FAMILY_LEVELS_UP níveis acima
  // dela (dono, 15/11/2026: o avô; o pai ainda era detalhado demais). Árvore
  // mais rasa: o mais alto que houver. Sem o Sankhya: a própria linha.
  const families = new Map<string, { name: string; lineIds: Set<string> }>();
  const lineFamily = new Map<string, string>();
  for (const l of lines) {
    let code: string | null = null;
    let at = l.sankhyaCode ? groups.get(String(Number(l.sankhyaCode))) : null;
    for (let up = 0; up < FAMILY_LEVELS_UP && at?.parent; up++) {
      // O topo da árvore (sem pai) não é família: agruparia tudo.
      const next = groups.get(at.parent);
      if (up > 0 && !next?.parent) break;
      code = at.parent;
      at = next ?? null;
    }
    const name = code ? (groups.get(code)?.name ?? code) : l.name;
    // Mesmo nome = mesma família (dono, 15/11/2026): grupos do Sankhya com o
    // mesmo nome em ramos diferentes viram uma família só, com todos os
    // produtos deles.
    const key = familyKey(name) ?? `ln:${l.id}`;
    const family = families.get(key) ?? { name, lineIds: new Set<string>() };
    family.lineIds.add(l.id);
    families.set(key, family);
    lineFamily.set(l.id, key);
  }
  const supplierCountry = new Map<string, string>();
  const bySankhya = new Map<string, string>();
  const countryNames = new Map<string, string>();
  for (const s of suppliers) {
    const key = countryKey(s.country);
    if (!key) continue;
    if (!countryNames.has(key)) countryNames.set(key, countryName(s.country));
    supplierCountry.set(s.id, key);
    if (s.sankhyaCode) bySankhya.set(String(s.sankhyaCode), key);
  }
  const byProduct = new Map<string, ProductOrigin>();
  // Sem fornecedor no portal: o fornecedor do produto no Sankhya
  // (TGFPRO.CODPARCFORN), lido pela API enquanto a carga não grava no banco
  // (dono, 15/11/2026). Sem o Sankhya, esses produtos ficam sem país.
  const missing = products.filter(
    (p) =>
      !hidden.has(p.id) &&
      !p.supplierId &&
      p.sankhyaRefs?.CODPARCFORN == null &&
      p.sankhyaCode,
  );
  const fromApi = missing.length
    ? await sankhyaProductSuppliers()
    : new Map<string, string>();
  // Fornecedor do Sankhya que não está como "fornecedor" no portal (o
  // parceiro pode ter vindo como outro tipo): o país pelo código dele.
  const unknownCodes = [
    ...new Set(
      missing
        .map((p) => fromApi.get(String(p.sankhyaCode)))
        .filter((c): c is string => !!c && !bySankhya.has(c)),
    ),
  ];
  for (let i = 0; i < unknownCodes.length; i += 500) {
    const others = await listColumns(
      store,
      "parties",
      ["country", "sankhyaCode"],
      {
        filter: { sankhyaCode: unknownCodes.slice(i, i + 500) },
      },
    );
    for (const o of others) {
      const key = countryKey(o.country);
      if (!key || !o.sankhyaCode) continue;
      if (!countryNames.has(key)) countryNames.set(key, countryName(o.country));
      bySankhya.set(String(o.sankhyaCode), key);
    }
  }
  for (const p of products) {
    if (hidden.has(p.id)) continue;
    const forn =
      p.sankhyaRefs?.CODPARCFORN ??
      (p.sankhyaCode ? fromApi.get(String(p.sankhyaCode)) : undefined);
    const country =
      (p.supplierId ? supplierCountry.get(p.supplierId) : undefined) ??
      (forn != null ? bySankhya.get(String(forn)) : undefined) ??
      "";
    byProduct.set(p.id, {
      country,
      lineId: p.lineId,
      family: lineFamily.get(p.lineId) ?? `ln:${p.lineId}`,
    });
  }
  const byCode = new Map<string, string>();
  for (const p of products)
    if (p.sankhyaCode && byProduct.has(p.id))
      byCode.set(String(Number(p.sankhyaCode)), p.id);
  return {
    at: Date.now(),
    byProduct,
    countryNames,
    families,
    lineFamily,
    byCode,
  };
}

async function originIndex(): Promise<OriginIndex> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached;
  pending ??= buildIndex().finally(() => {
    pending = null;
  });
  cached = await pending;
  return cached;
}

/** País e grupo de um produto do catálogo (nulo = fora do catálogo). */
export async function productOrigin(
  productId: string,
): Promise<ProductOrigin | null> {
  const index = await originIndex();
  const hit = index.byProduct.get(productId);
  if (hit) return hit;
  // Produto novo depois do índice: lê na hora.
  const store = getStore();
  const product = await store.get("products", productId);
  if (!product) return null;
  const supplier = product.supplierId
    ? await store.get("parties", product.supplierId)
    : null;
  return {
    country: countryKey(supplier?.country),
    lineId: product.lineId,
    family: index.lineFamily.get(product.lineId) ?? `ln:${product.lineId}`,
  };
}

/**
 * Os países de origem dos produtos do catálogo. Produto sem país não é
 * vendido (dono, 15/11/2026): fica fora da lista e da busca do pedido.
 */
export async function originCountries(): Promise<OriginCountry[]> {
  const index = await originIndex();
  const counts = new Map<string, number>();
  for (const { country } of index.byProduct.values())
    if (country) counts.set(country, (counts.get(country) ?? 0) + 1);
  return [...counts.entries()]
    .map(([key, products]) => ({
      key,
      name: key ? (index.countryNames.get(key) ?? key) : "",
      products,
    }))
    .sort((a, b) =>
      !a.key ? 1 : !b.key ? -1 : a.name.localeCompare(b.name, "pt"),
    );
}

/** As famílias com produto do catálogo no país escolhido. */
export async function originGroups(country: string): Promise<OriginGroup[]> {
  if (!country) return [];
  const index = await originIndex();
  const counts = new Map<string, number>();
  for (const o of index.byProduct.values())
    if (o.country === country)
      counts.set(o.family, (counts.get(o.family) ?? 0) + 1);
  return [...counts.entries()]
    .map(([id, products]) => ({
      id,
      name: index.families.get(id)?.name ?? id,
      products,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt"));
}

/** Nome e linhas de uma família (nulo = não existe). */
export async function originFamily(
  key: string,
): Promise<{ name: string; lineIds: string[] } | null> {
  const family = (await originIndex()).families.get(key);
  return family ? { name: family.name, lineIds: [...family.lineIds] } : null;
}

/** O nome do país (chave) como a tela mostra; "" = não informado. */
export async function originCountryName(key: string): Promise<string> {
  if (!key) return "";
  return (await originIndex()).countryNames.get(key) ?? key;
}

/** Os produtos (ids) do país e da família escolhidos: para filtrar a busca. */
export async function productIdsOfOrigin(
  country: string,
  family: string,
): Promise<Set<string>> {
  const ids = new Set<string>();
  if (!country) return ids;
  const index = await originIndex();
  for (const [id, o] of index.byProduct)
    if (o.country === country && o.family === family) ids.add(id);
  return ids;
}

/**
 * Produto do portal, país e família de cada código do Sankhya (CODPROD),
 * para o histórico de compras do cliente (docs/ORDER_TERMS.md seção 10):
 * só os do catálogo (ativos, fora do Booking).
 */
export async function originsByCode(
  codes: Array<number | null>,
): Promise<Map<number, ProductOrigin & { productId: string }>> {
  const index = await originIndex();
  const out = new Map<number, ProductOrigin & { productId: string }>();
  for (const code of codes) {
    if (code === null || out.has(code)) continue;
    const productId = index.byCode.get(String(code));
    const origin = productId ? index.byProduct.get(productId) : null;
    if (productId && origin) out.set(code, { ...origin, productId });
  }
  return out;
}
