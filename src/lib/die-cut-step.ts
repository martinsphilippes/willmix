import type { Requirement } from "@/lib/db/schema";
import { LANE_KEYS, baseKeyOf, itemIdOf } from "@/lib/purchase-lanes";
import { nameOfLabel } from "@/lib/placeholder-name";

/*
 * Etapa "Die Cut" do fornecedor no pedido de compra (decisão do dono,
 * 13/11/2026): os quatro itens da raia dele, produto a produto, num quadro
 * só: o die-cut (a faca da caixa), a foto em alta, o pedido mínimo e o prazo
 * de entrega. São os mesmos requisitos da etapa "Preparação, arte e
 * certificação" (docs/PURCHASE_ORDER.md); aqui ficam as regras puras.
 */

export const DIE_CUT_ITEMS = ["dieline", "hd", "moq", "leadTime"] as const;
export type DieCutItem = (typeof DIE_CUT_ITEMS)[number];

const BASE_KEY: Record<DieCutItem, string> = {
  dieline: LANE_KEYS.dieCut,
  hd: LANE_KEYS.hdPhoto,
  moq: LANE_KEYS.moq,
  leadTime: LANE_KEYS.leadTime,
};

/** O item do Die Cut de um requisito do pedido; nulo nos outros requisitos. */
export function dieCutItemOf(key: string): DieCutItem | null {
  if (!itemIdOf(key)) return null;
  const base = baseKeyOf(key);
  return DIE_CUT_ITEMS.find((i) => BASE_KEY[i] === base) ?? null;
}

export interface DieCutProduct<R> {
  /** Item do pedido. */
  itemId: string;
  /** Nome do produto (o que vem depois de " · " no rótulo do requisito). */
  name: string;
  items: Record<DieCutItem, R | null>;
  /** O que ainda falta, na ordem do quadro. */
  missing: DieCutItem[];
  complete: boolean;
}

/**
 * Nome do produto gravado no rótulo do requisito ("Faca (die cut) · Produto").
 * Vazio quando o rótulo não tem produto ou tem o nome de exemplo.
 */
export const productOfLabel = (label: string) => nameOfLabel(label);

/**
 * Os quatro itens de cada produto do pedido, na ordem em que os requisitos
 * foram dados. Produto sem nenhum dos quatro fica de fora.
 */
export function dieCutProducts<
  R extends Pick<Requirement, "key" | "label" | "status">,
>(requirements: R[]): DieCutProduct<R>[] {
  const byItem = new Map<string, DieCutProduct<R>>();
  for (const r of requirements) {
    const item = dieCutItemOf(r.key);
    const itemId = itemIdOf(r.key);
    if (!item || !itemId) continue;
    let product = byItem.get(itemId);
    if (!product) {
      product = {
        itemId,
        name: productOfLabel(r.label),
        items: { dieline: null, hd: null, moq: null, leadTime: null },
        missing: [],
        complete: false,
      };
      byItem.set(itemId, product);
    }
    product.items[item] = r;
  }
  for (const product of byItem.values()) {
    product.missing = DIE_CUT_ITEMS.filter((i) => {
      const r = product.items[i];
      return !!r && r.status !== "done";
    });
    product.complete = product.missing.length === 0;
  }
  return [...byItem.values()];
}

/** Página do quadro Die Cut do pedido (com a âncora do produto, se houver). */
export const dieCutHref = (orderId: string, itemId?: string | null) =>
  `/app/orders/${orderId}/die-cut${itemId ? `#item-${itemId}` : ""}`;

/** Pedido mínimo: inteiro de peças, maior que zero. */
export function parseMoq(raw: string): number | null {
  const n = Number(raw.trim());
  return /^\d{1,9}$/.test(raw.trim()) && n > 0 ? n : null;
}

/** Prazo de entrega: inteiro de dias, de 1 a 720. */
export function parseLeadTime(raw: string): number | null {
  const n = Number(raw.trim());
  return /^\d{1,3}$/.test(raw.trim()) && n >= 1 && n <= 720 ? n : null;
}
