import type { ProductVariant, VariantSnapshot } from "@/lib/db/schema";

/*
 * Regras puras das variações de produto (ver docs/PRODUCT_VARIANTS.md).
 * Sem "server-only": a vitrine e a nova solicitação usam no navegador para
 * montar o snapshot e escolher a variação de referência da lista recebida.
 */

/** Tamanho da coluna `product_variants.key`. */
export const VARIANT_KEY_MAX = 80;

const norm = (s: string | null | undefined) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/**
 * Chave da variação dentro do produto: código de fábrica + nome, em
 * minúsculas, sem acentos nem espaços repetidos ("my-059a|wd striby vert
 * 8x10 / 20x25"). É o que a reimportação usa para achar a mesma variação.
 */
export function variantKey(parts: {
  factoryItemCode?: string | null;
  name: string;
}): string {
  return `${norm(parts.factoryItemCode)}|${norm(parts.name)}`.slice(
    0,
    VARIANT_KEY_MAX,
  );
}

/** Cópia dos valores da variação que viaja na solicitação e no pedido. */
export function variantSnapshot(v: ProductVariant): VariantSnapshot {
  return {
    id: v.id,
    name: v.name,
    factoryItemCode: v.factoryItemCode ?? null,
    price: v.price ?? null,
    currency: v.currency ?? null,
    moq: v.moq ?? null,
    masterBoxQty: v.masterBoxQty ?? null,
    innerBoxQty: v.innerBoxQty ?? null,
    netWeightKg: v.netWeightKg ?? null,
    grossWeightKg: v.grossWeightKg ?? null,
    lengthCm: v.lengthCm ?? null,
    widthCm: v.widthCm ?? null,
    heightCm: v.heightCm ?? null,
    cbm: v.cbm ?? null,
    colorAssortment: v.colorAssortment ?? null,
    material: v.material ?? null,
    packageType: v.packageType ?? null,
  };
}

const positivePrice = (v: { price: number | null }) =>
  typeof v.price === "number" && Number.isFinite(v.price) && v.price > 0;
const order = (v: { sortOrder: number | null }) =>
  typeof v.sortOrder === "number" ? v.sortOrder : Number.POSITIVE_INFINITY;

/**
 * Variação de referência: a ativa de menor preço (empate: menor ordem, depois
 * a primeira da lista); se nenhuma tem preço, a primeira ativa. É o que o
 * produto mostra como "a partir de" e o que as colunas do produto espelham.
 */
export function referenceVariant<
  T extends Pick<ProductVariant, "active" | "price" | "sortOrder">,
>(variants: T[]): T | null {
  const active = variants.filter((v) => v.active);
  if (!active.length) return null;
  const priced = active.filter(positivePrice);
  if (!priced.length) return active[0];
  return priced.reduce((best, v) =>
    (v.price as number) < (best.price as number) ||
    ((v.price as number) === (best.price as number) && order(v) < order(best))
      ? v
      : best,
  );
}

/** Ordem de exibição: ordem da planilha, depois nome. */
export function sortVariants<
  T extends Pick<ProductVariant, "name" | "sortOrder">,
>(variants: T[]): T[] {
  return [...variants].sort(
    (a, b) => order(a) - order(b) || a.name.localeCompare(b.name),
  );
}
