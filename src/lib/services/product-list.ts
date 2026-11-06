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
