import type { StageKey } from "@/lib/db/schema";

/*
 * Partes do pedido que não são etapas: o documento do pedido, a ficha de
 * compra, a certificação, as artes, o pagamento ao fornecedor, a produção, o
 * embarque e desembaraço e o recebimento. Cada uma tem o seu cartão (ou a sua
 * página); aqui fica só o lugar de cada uma na tabela "Etapas do pedido", na
 * ordem do negócio, e a situação em poucas palavras, para o fluxo inteiro
 * aparecer num lugar só.
 */

export const ORDER_PART_KEYS = [
  "document",
  "certification",
  "sheet",
  "artwork",
  "supplier_payment",
  "production",
  "import",
  "receiving",
] as const;
export type OrderPartKey = (typeof ORDER_PART_KEYS)[number];

/** Etapa debaixo da qual a parte aparece (a ordem de ORDER_PART_KEYS vale dentro dela). */
export const ORDER_PART_STAGE: Record<OrderPartKey, StageKey> = {
  document: "ORDER_CREATED",
  // A certificadora recebe o pedido quando ele nasce (decisão do dono,
  // docs/CERTIFICATION.md): o selo corre ao mesmo tempo que o resto.
  certification: "ORDER_CREATED",
  sheet: "PREPARATION",
  artwork: "PACKAGING",
  supplier_payment: "PACKAGING",
  production: "PACKAGING",
  import: "SHIPPING",
  receiving: "TRANSPORT",
};

/** Partes que correm ao mesmo tempo que as etapas (não esperam a anterior). */
export const ORDER_PART_PARALLEL: readonly OrderPartKey[] = [
  "certification",
  "supplier_payment",
];

export type OrderPartState = "pending" | "active" | "done";

export interface OrderPart {
  key: OrderPartKey;
  state: OrderPartState;
  /** "N de M", quando a parte se conta em passos. */
  done: number | null;
  total: number | null;
  /** Detalhe curto já traduzido por quem monta (ex.: "ETD 12/12/2026"). */
  detail?: string | null;
  href: string;
}

/** Documento do pedido: os dois itens de assinatura (pedido antigo: sem a parte). */
export function documentPart(
  requirements: Array<{ key: string; status: string }>,
  href: string,
): OrderPart | null {
  const signatures = requirements.filter(
    (r) =>
      r.key === "order_signed_wellmix" || r.key === "order_signed_supplier",
  );
  if (!signatures.length) return null;
  const done = signatures.filter((r) => r.status === "done").length;
  return {
    key: "document",
    state: done === signatures.length ? "done" : "active",
    done,
    total: signatures.length,
    href,
  };
}

/** Parte feita de passos (certificação, embarque e desembaraço). */
export function stepsPart(
  key: "certification" | "import",
  steps: Array<{ done: boolean; started: boolean }>,
  href: string,
): OrderPart | null {
  if (!steps.length) return null;
  const done = steps.filter((s) => s.done).length;
  return {
    key,
    state:
      done === steps.length
        ? "done"
        : steps.some((s) => s.started)
          ? "active"
          : "pending",
    done,
    total: steps.length,
    href,
  };
}

/** Ficha de compra: completa, começada ou por preencher. */
export function sheetPart(
  sheet: { missing: number; started: boolean },
  href: string,
  detail: string | null,
): OrderPart {
  return {
    key: "sheet",
    state: sheet.missing === 0 ? "done" : sheet.started ? "active" : "pending",
    done: null,
    total: null,
    detail,
    href,
  };
}

/** Parte sem contagem (artes, pagamento ao fornecedor, produção, recebimento). */
export function plainPart(
  key: "artwork" | "supplier_payment" | "production" | "receiving",
  state: OrderPartState,
  href: string,
  detail: string | null = null,
): OrderPart {
  return { key, state, done: null, total: null, detail, href };
}

/** As partes de cada etapa, na ordem do negócio. */
export function orderPartsByStage(
  parts: Array<OrderPart | null>,
): Map<StageKey, OrderPart[]> {
  const map = new Map<StageKey, OrderPart[]>();
  for (const key of ORDER_PART_KEYS) {
    const part = parts.find((p) => p?.key === key);
    if (!part) continue;
    const stage = ORDER_PART_STAGE[key];
    map.set(stage, [...(map.get(stage) ?? []), part]);
  }
  return map;
}
