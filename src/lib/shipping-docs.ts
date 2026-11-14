import type {
  LoadEntry,
  ShippingDocLine,
  ShippingDocMismatch,
} from "@/lib/db/schema";

/*
 * Documentos do embarque do pedido de compra (docs/SHIPPING_DOCS.md): regras
 * puras do check list de carga e da conferência linha a linha.
 *
 * Decisões do dono (14/11/2026):
 * - check list: em cada item, a quantidade de caixas que subiram no
 *   container, abatendo do pedido até terminar;
 * - conferência (invoice × packing list e BL × invoice): caixas, peças, peso
 *   líquido e peso bruto, linha a linha.
 */

/** Peso: igual até o centésimo de kg (arredondamento de quem digita). */
const WEIGHT_EPS = 0.011;

/** Caixas master de um item do pedido (sem caixa master no cadastro: nulo). */
export function expectedCartons(
  quantity: number,
  perBox: number | null | undefined,
): number | null {
  if (!perBox || perBox <= 0) return null;
  return Math.ceil(quantity / perBox);
}

/** Caixas já marcadas no check list, por item. */
export function loadedByItem(entries: LoadEntry[] | null | undefined) {
  const map = new Map<string, number>();
  for (const e of entries ?? [])
    map.set(e.itemId, (map.get(e.itemId) ?? 0) + e.cartons);
  return map;
}

export interface LoadLine {
  itemId: string;
  name: string;
  expected: number | null;
  loaded: number;
  /** Falta subir (nulo sem caixa master no cadastro). */
  remaining: number | null;
}

/** Situação do check list item a item. */
export function loadLines(
  items: Array<{ id: string; name: string; expected: number | null }>,
  entries: LoadEntry[] | null | undefined,
): LoadLine[] {
  const loaded = loadedByItem(entries);
  return items.map((i) => {
    const done = loaded.get(i.id) ?? 0;
    return {
      itemId: i.id,
      name: i.name,
      expected: i.expected,
      loaded: done,
      remaining: i.expected === null ? null : Math.max(0, i.expected - done),
    };
  });
}

/** Tudo carregado: cada item com as caixas do pedido (ou ao menos uma, sem caixa master). */
export const loadComplete = (lines: LoadLine[]) =>
  lines.length > 0 &&
  lines.every((l) => (l.remaining === null ? l.loaded > 0 : l.remaining === 0));

const sameWeight = (a: number | null, b: number | null) =>
  a === null || b === null ? a === b : Math.abs(a - b) <= WEIGHT_EPS;

/**
 * Confere um documento com o anterior, linha a linha: caixas, peças, peso
 * líquido e bruto de cada item; item que falta ou sobra também conta.
 */
export function compareLines(
  expected: ShippingDocLine[],
  found: ShippingDocLine[],
): ShippingDocMismatch[] {
  const out: ShippingDocMismatch[] = [];
  for (const e of expected) {
    const f = found.find((x) => x.itemId === e.itemId);
    if (!f) {
      out.push({
        itemId: e.itemId,
        field: "item",
        expected: e.pieces,
        found: null,
      });
      continue;
    }
    if (e.cartons !== f.cartons)
      out.push({
        itemId: e.itemId,
        field: "cartons",
        expected: e.cartons,
        found: f.cartons,
      });
    if (e.pieces !== f.pieces)
      out.push({
        itemId: e.itemId,
        field: "pieces",
        expected: e.pieces,
        found: f.pieces,
      });
    if (!sameWeight(e.netKg, f.netKg))
      out.push({
        itemId: e.itemId,
        field: "netKg",
        expected: e.netKg,
        found: f.netKg,
      });
    if (!sameWeight(e.grossKg, f.grossKg))
      out.push({
        itemId: e.itemId,
        field: "grossKg",
        expected: e.grossKg,
        found: f.grossKg,
      });
  }
  for (const f of found)
    if (!expected.some((e) => e.itemId === f.itemId))
      out.push({
        itemId: f.itemId,
        field: "item",
        expected: null,
        found: f.pieces,
      });
  return out;
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Linha sugerida do packing list: caixas carregadas, peças e pesos pelo cadastro. */
export function suggestedLine(input: {
  itemId: string;
  name: string;
  cartons: number;
  perBox: number | null;
  quantity: number;
  netPc: number | null;
  grossPc: number | null;
}): ShippingDocLine {
  const pieces = input.perBox
    ? Math.min(input.quantity, input.cartons * input.perBox)
    : input.quantity;
  return {
    itemId: input.itemId,
    name: input.name,
    cartons: input.cartons,
    pieces,
    netKg: input.netPc !== null ? round(pieces * input.netPc) : null,
    grossKg: input.grossPc !== null ? round(pieces * input.grossPc) : null,
  };
}

export const linesTotals = (lines: ShippingDocLine[]) => ({
  cartons: lines.reduce((s, l) => s + l.cartons, 0),
  pieces: lines.reduce((s, l) => s + l.pieces, 0),
  netKg: round(lines.reduce((s, l) => s + (l.netKg ?? 0), 0)),
  grossKg: round(lines.reduce((s, l) => s + (l.grossKg ?? 0), 0)),
});
