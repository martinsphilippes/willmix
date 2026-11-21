import "server-only";
import { getStore } from "@/lib/db";
import { listColumns } from "@/lib/db/lookup";
import { countryKey, countryName } from "@/lib/order-terms";
import { hiddenBookingProductIds } from "./booking-visibility";
import { sankhyaProductSuppliers } from "./sankhya-product-suppliers";
import {
  sankhyaFamiliesByProduct,
  sankhyaProductGroups,
} from "./sankhya-product-families";

/*
 * País de origem e grupo de produto da Nova solicitação (dono, 15/11/2026;
 * docs/ORDER_TERMS.md): o vendedor escolhe o país e depois o grupo, e só os
 * produtos daquele país e grupo entram no pedido.
 *
 * - Grupo de produto = a família, o PRIMEIRO nível da árvore de grupos do
 *   Sankhya (TGFGRU.GRAU = 1; técnico do Sankhya, 15/11/2026), de cada
 *   produto pelo DbExplorer (sankhya-product-families.ts). Sem ela: a raiz
 *   da árvore da linha; sem a árvore, o nome da linha. Famílias com o mesmo
 *   nome são uma só (chave "fm:<NOME>").
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

/** Os três níveis abaixo da família: Grupo, Sub grupo e Coleção do grupo. */
export const BROWSE_LEVELS = 3;
export type BrowseLevels = [string | null, string | null, string | null];

interface ProductFace {
  name: string;
  sku: string | null;
  photoId: string | null;
  /** Chaves ("lv:<NOME>") de Grupo, Sub grupo e Coleção do grupo. */
  levels: BrowseLevels;
}

interface OriginIndex {
  at: number;
  /** produto → país, linha e família */
  byProduct: Map<string, ProductOrigin>;
  countryNames: Map<string, string>;
  /** família → nome e as linhas dela */
  families: Map<string, { name: string; lineIds: Set<string> }>;
  /** linha → família */
  lineFamily: Map<string, { key: string; name: string }>;
  /** CODPROD do Sankhya → produto do portal */
  byCode: Map<string, string>;
  /** produto → nome, SKU, foto e os níveis abaixo da família */
  faces: Map<string, ProductFace>;
  /** chave do nível → nome */
  levelNames: Map<string, string>;
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
      [
        "lineId",
        "supplierId",
        "sankhyaRefs",
        "sankhyaCode",
        "name",
        "sku",
        "primaryPhotoDocumentId",
      ],
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
  // Família de cada produto pelo Sankhya: o 1º nível da árvore (técnico do
  // Sankhya, 15/11/2026). Vale por cima da família da linha.
  const productFamilies = await sankhyaFamiliesByProduct();
  // Família de cada linha (quando o produto não tem a dele pelo Sankhya):
  // a raiz da árvore de grupos da linha (o 1º nível, GRAU = 1); sem a
  // árvore, o nome da própria linha. Mesmo nome = mesma família.
  const lineFamily = new Map<string, { key: string; name: string }>();
  for (const l of lines) {
    let at = l.sankhyaCode ? groups.get(String(Number(l.sankhyaCode))) : null;
    let root: string | null = null;
    for (let up = 0; up < 10 && at?.parent; up++) {
      root = at.parent;
      at = groups.get(at.parent) ?? null;
    }
    const name = root ? (groups.get(root)?.name ?? root) : l.name;
    lineFamily.set(l.id, { key: familyKey(name) ?? `ln:${l.id}`, name });
  }
  const families = new Map<string, { name: string; lineIds: Set<string> }>();
  const familyOf = (p: { lineId: string; sankhyaCode?: string | null }) => {
    const own = p.sankhyaCode
      ? productFamilies.get(String(Number(p.sankhyaCode)))
      : null;
    const key = own ? familyKey(own.name) : null;
    const chosen =
      own && key
        ? { key, name: own.name }
        : (lineFamily.get(p.lineId) ?? { key: `ln:${p.lineId}`, name: "" });
    // As linhas da família (a busca filtra por elas no banco).
    const family = families.get(chosen.key) ?? {
      name: chosen.name,
      lineIds: new Set<string>(),
    };
    family.lineIds.add(p.lineId);
    families.set(chosen.key, family);
    return chosen.key;
  };
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
    byProduct.set(p.id, { country, lineId: p.lineId, family: familyOf(p) });
  }
  // Grupo, Sub grupo e Coleção do grupo de cada produto (seletor de
  // produtos; docs/ORDER_TERMS.md 11.5): sobe na árvore do grupo do produto
  // (ou da linha) até a família e fica com os 3 níveis logo abaixo dela.
  // Mesmo nome no mesmo nível = um só (como a família).
  const levelNames = new Map<string, string>();
  const lineCode = new Map(
    lines.map((l) => [
      l.id,
      l.sankhyaCode ? String(Number(l.sankhyaCode)) : null,
    ]),
  );
  const faces = new Map<string, ProductFace>();
  for (const p of products) {
    if (!byProduct.has(p.id)) continue;
    const own = p.sankhyaCode
      ? productFamilies.get(String(Number(p.sankhyaCode)))
      : null;
    const chain = groupChain(
      groups,
      own?.group ?? lineCode.get(p.lineId) ?? null,
      own?.code ?? null,
    );
    const levels: BrowseLevels = [null, null, null];
    chain.slice(0, BROWSE_LEVELS).forEach((name, i) => {
      const key = familyKey(name)?.replace(/^fm:/, "lv:") ?? null;
      if (!key) return;
      if (!levelNames.has(key)) levelNames.set(key, name);
      levels[i] = key;
    });
    faces.set(p.id, {
      name: p.name ?? "",
      sku: p.sku ?? null,
      photoId: p.primaryPhotoDocumentId ?? null,
      levels,
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
    faces,
    levelNames,
  };
}

/**
 * Os nomes dos grupos entre a família (fora) e o grupo do produto, de cima
 * para baixo. Sem a família conhecida, a raiz da árvore faz o papel dela.
 */
function groupChain(
  groups: Map<string, { name: string; parent: string | null }>,
  leaf: string | null,
  familyCode: string | null,
): string[] {
  const up: string[] = [];
  let at = leaf;
  let reached = false;
  for (let i = 0; at && i < 10; i++) {
    if (at === familyCode) {
      reached = true;
      break;
    }
    const g = groups.get(at);
    if (!g) return [];
    up.push(g.name);
    at = g.parent;
  }
  // Sem a família pelo código: o último da subida é a raiz (a família).
  if (!reached) up.pop();
  return up.reverse();
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
    family: index.lineFamily.get(product.lineId)?.key ?? `ln:${product.lineId}`,
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

/** Um filtro "visto" (dono, 15/11/2026): Grupo, Sub grupo e Coleção. */
export type BrowseCombo = BrowseLevels;

export interface BrowseFacetOption {
  key: string;
  name: string;
  products: number;
  /** Quantos destes já entraram num filtro marcado como visto. */
  seen: number;
}

export interface BrowseResult {
  facets: BrowseFacetOption[][];
  items: Array<{
    id: string;
    name: string;
    sku: string | null;
    photoId: string | null;
    seen: boolean;
  }>;
  total: number;
  page: number;
  pages: number;
  /** A família inteira: produtos e quantos já foram vistos. */
  family: { products: number; seen: number };
}

const comboMatches = (combo: BrowseCombo, levels: BrowseLevels) =>
  combo.every((v, i) => !v || levels[i] === v);

/**
 * Seletor de produtos da Nova solicitação (dono, 15/11/2026;
 * docs/ORDER_TERMS.md 11.5): os produtos do país e da família do pedido,
 * filtrados por Grupo, Sub grupo e Coleção do grupo. Cada filtro mostra as
 * opções que sobram com os outros (as contas andam juntas) e quantos
 * produtos de cada uma já foram vistos (filtros marcados como vistos).
 */
export async function browseOrigin(input: {
  country: string;
  family: string;
  filters: BrowseLevels;
  seen: BrowseCombo[];
  page: number;
  perPage: number;
}): Promise<BrowseResult> {
  const index = await originIndex();
  const inFamily: Array<[string, ProductFace]> = [];
  for (const [id, o] of index.byProduct) {
    if (o.country !== input.country || o.family !== input.family) continue;
    const face = index.faces.get(id);
    if (face) inFamily.push([id, face]);
  }
  const seenIds = new Set(
    inFamily
      .filter(([, f]) => input.seen.some((c) => comboMatches(c, f.levels)))
      .map(([id]) => id),
  );
  const facets: BrowseFacetOption[][] = [];
  for (let level = 0; level < BROWSE_LEVELS; level++) {
    const counts = new Map<string, { products: number; seen: number }>();
    for (const [id, f] of inFamily) {
      const key = f.levels[level];
      if (!key) continue;
      // As outras escolhas valem; a deste nível, não (para trocar).
      const others = input.filters.every(
        (v, i) => i === level || !v || f.levels[i] === v,
      );
      if (!others) continue;
      const c = counts.get(key) ?? { products: 0, seen: 0 };
      c.products++;
      if (seenIds.has(id)) c.seen++;
      counts.set(key, c);
    }
    facets.push(
      [...counts.entries()]
        .map(([key, c]) => ({
          key,
          name: index.levelNames.get(key) ?? key,
          ...c,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "pt")),
    );
  }
  const matching = inFamily
    .filter(([, f]) => comboMatches(input.filters, f.levels))
    .sort(
      ([a, fa], [b, fb]) =>
        fa.name.localeCompare(fb.name, "pt") || a.localeCompare(b),
    );
  const pages = Math.max(1, Math.ceil(matching.length / input.perPage));
  const page = Math.min(Math.max(1, input.page), pages);
  return {
    facets,
    items: matching
      .slice((page - 1) * input.perPage, page * input.perPage)
      .map(([id, f]) => ({
        id,
        name: f.name,
        sku: f.sku,
        photoId: f.photoId,
        seen: seenIds.has(id),
      })),
    total: matching.length,
    page,
    pages,
    family: { products: inFamily.length, seen: seenIds.size },
  };
}
