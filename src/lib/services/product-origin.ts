import "server-only";
import { getStore } from "@/lib/db";
import { listColumns } from "@/lib/db/lookup";
import { countryKey, countryName } from "@/lib/order-terms";
import { hiddenBookingProductIds } from "./booking-visibility";
import { sankhyaProductSuppliers } from "./sankhya-product-suppliers";

/*
 * País de origem e grupo de produto da Nova solicitação (dono, 15/11/2026;
 * docs/ORDER_TERMS.md): o vendedor escolhe o país e depois o grupo, e só os
 * produtos daquele país e grupo entram no pedido.
 *
 * - Grupo de produto = a linha do produto (`products.lineId`), que é o
 *   grupo do Sankhya (TGFGRU.CODGRUPOPROD).
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
  id: string;
  name: string;
  products: number;
}

interface OriginIndex {
  at: number;
  /** produto → [país, linha] */
  byProduct: Map<string, { country: string; lineId: string }>;
  countryNames: Map<string, string>;
}

const TTL_MS = 10 * 60 * 1000;
let cached: OriginIndex | null = null;
let pending: Promise<OriginIndex> | null = null;

/** Para testes: esquece o índice. */
export function resetOriginIndex() {
  cached = null;
  pending = null;
}

async function buildIndex(): Promise<OriginIndex> {
  const store = getStore();
  const [products, suppliers, hidden] = await Promise.all([
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
  ]);
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
  const byProduct = new Map<string, { country: string; lineId: string }>();
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
    byProduct.set(p.id, { country, lineId: p.lineId });
  }
  return { at: Date.now(), byProduct, countryNames };
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
): Promise<{ country: string; lineId: string } | null> {
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
  return { country: countryKey(supplier?.country), lineId: product.lineId };
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

/** Os grupos (linhas) com produto do catálogo no país escolhido. */
export async function originGroups(country: string): Promise<OriginGroup[]> {
  if (!country) return [];
  const index = await originIndex();
  const counts = new Map<string, number>();
  for (const o of index.byProduct.values())
    if (o.country === country)
      counts.set(o.lineId, (counts.get(o.lineId) ?? 0) + 1);
  if (!counts.size) return [];
  const lines = await listColumns(getStore(), "product_lines", ["name"], {
    filter: { id: [...counts.keys()] },
  });
  return lines
    .map((l) => ({ id: l.id, name: l.name, products: counts.get(l.id) ?? 0 }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt"));
}

/** O nome do país (chave) como a tela mostra; "" = não informado. */
export async function originCountryName(key: string): Promise<string> {
  if (!key) return "";
  return (await originIndex()).countryNames.get(key) ?? key;
}

/** Os produtos (ids) do país escolhido: para filtrar a busca do grupo. */
export async function productIdsOfOrigin(
  country: string,
  lineId: string,
): Promise<Set<string>> {
  const ids = new Set<string>();
  if (!country) return ids;
  const index = await originIndex();
  for (const [id, o] of index.byProduct)
    if (o.country === country && o.lineId === lineId) ids.add(id);
  return ids;
}
