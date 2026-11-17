import "server-only";

import type { Product, ProductPhoto } from "@/lib/db";

/*
 * Lista de produtos (tela Produtos): busca, filtros e a foto de cada linha.
 * Funções puras: a tela e o CSV usam as mesmas regras.
 */

const norm = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Busca por nome, SKU, código do fornecedor, categoria, observações ou fornecedor (sem acento). */
export function matchesProduct(
  p: Pick<
    Product,
    "name" | "sku" | "supplierSku" | "category" | "notes" | "specification"
  >,
  supplierName: string,
  q: string,
): boolean {
  const term = norm(q).trim();
  if (!term) return true;
  return [
    p.name,
    p.sku,
    p.supplierSku,
    p.category,
    p.notes,
    p.specification,
    supplierName,
  ]
    .map(norm)
    .some((v) => v.includes(term));
}

/** Foto da linha: a principal do produto; senão a marcada como principal; senão a primeira. */
export function productThumbId(
  p: Pick<Product, "id" | "primaryPhotoDocumentId">,
  photos: Pick<ProductPhoto, "productId" | "documentId" | "isPrimary">[],
): string | null {
  if (p.primaryPhotoDocumentId) return p.primaryPhotoDocumentId;
  const own = photos.filter((ph) => ph.productId === p.id);
  return (own.find((ph) => ph.isPrimary) ?? own[0])?.documentId ?? null;
}

export interface ProductFilter {
  q: string;
  lineId: string;
  supplierId: string;
}

/** Lê os filtros da URL (valores soltos viram vazio). */
export function readProductFilter(sp: {
  q?: string | string[];
  line?: string | string[];
  supplier?: string | string[];
}): ProductFilter {
  const one = (v: string | string[] | undefined) =>
    (Array.isArray(v) ? v[0] : v)?.trim().slice(0, 120) ?? "";
  return { q: one(sp.q), lineId: one(sp.line), supplierId: one(sp.supplier) };
}

/**
 * Ordem da lista de Produtos (dono, 17/11/2026): pelo nome (A–Z, a de
 * sempre) ou os mais recentes primeiro (pela data de cadastro), para quem
 * acabou de cadastrar ver o produto no topo. Vale para o catálogo inteiro,
 * antes de dividir em páginas.
 */
export const PRODUCT_ORDERS = ["name", "recent"] as const;
export type ProductOrder = (typeof PRODUCT_ORDERS)[number];

/** Lê a ordem da URL (`?order=recent`); qualquer outro valor é a de sempre. */
export function readProductOrder(sp: {
  order?: string | string[];
}): ProductOrder {
  const raw = Array.isArray(sp.order) ? sp.order[0] : sp.order;
  return raw === "recent" ? "recent" : "name";
}

/**
 * A lista na ordem pedida. "name" devolve como veio (o banco já ordena pelo
 * nome); "recent" põe os cadastrados por último no topo, e quem tem a mesma
 * data fica na ordem de antes (pelo nome).
 */
export function sortProducts<T extends Pick<Product, "createdAt">>(
  products: readonly T[],
  order: ProductOrder,
): T[] {
  if (order !== "recent") return [...products];
  return products
    .map((p, i) => ({ p, i }))
    .sort(
      (a, b) =>
        (a.p.createdAt < b.p.createdAt
          ? 1
          : a.p.createdAt > b.p.createdAt
            ? -1
            : 0) || a.i - b.i,
    )
    .map(({ p }) => p);
}

/** Produtos por página na tela Produtos. */
export const PRODUCT_PAGE_SIZE = 50;

/**
 * Página da lista de produtos. O cadastro passou de 20 mil produtos com a
 * carga do Sankhya: a tela mostra uma página e só busca ficha, fotos,
 * variações e fornecedores vinculados dos produtos dela. Página fora do
 * intervalo ou ilegível vira a mais próxima válida.
 */
export function productPage(
  total: number,
  raw: string | string[] | undefined,
  size = PRODUCT_PAGE_SIZE,
): { page: number; pages: number; start: number; end: number } {
  const pages = Math.max(1, Math.ceil(total / size));
  const asked = Number(Array.isArray(raw) ? raw[0] : raw);
  const page = Number.isInteger(asked)
    ? Math.min(Math.max(asked, 1), pages)
    : 1;
  const start = (page - 1) * size;
  return { page, pages, start, end: Math.min(start + size, total) };
}

/** O produto passa nos filtros de linha e fornecedor (principal ou vinculado)? */
export function inProductFilter(
  p: Pick<Product, "id" | "lineId" | "supplierId">,
  f: Pick<ProductFilter, "lineId" | "supplierId">,
  linkedSuppliers: ReadonlySet<string>,
): boolean {
  if (f.lineId && p.lineId !== f.lineId) return false;
  if (
    f.supplierId &&
    p.supplierId !== f.supplierId &&
    !linkedSuppliers.has(f.supplierId)
  )
    return false;
  return true;
}

/**
 * Todas as fotos do produto para a galeria da linha: a principal primeiro,
 * depois a marcada como principal e as demais, sem repetir.
 */
export function productPhotoList(
  p: Pick<Product, "id" | "primaryPhotoDocumentId">,
  photos: Pick<
    ProductPhoto,
    "productId" | "documentId" | "isPrimary" | "kind"
  >[],
): { documentId: string; kind: ProductPhoto["kind"] | null }[] {
  const own = photos.filter((ph) => ph.productId === p.id);
  const ordered = [
    ...own.filter((ph) => ph.documentId === p.primaryPhotoDocumentId),
    ...own.filter((ph) => ph.isPrimary),
    ...own,
  ];
  const seen = new Set<string>();
  const out: { documentId: string; kind: ProductPhoto["kind"] | null }[] = [];
  if (
    p.primaryPhotoDocumentId &&
    !own.some((ph) => ph.documentId === p.primaryPhotoDocumentId)
  ) {
    seen.add(p.primaryPhotoDocumentId);
    out.push({ documentId: p.primaryPhotoDocumentId, kind: null });
  }
  for (const ph of ordered) {
    if (seen.has(ph.documentId)) continue;
    seen.add(ph.documentId);
    out.push({ documentId: ph.documentId, kind: ph.kind });
  }
  return out;
}
