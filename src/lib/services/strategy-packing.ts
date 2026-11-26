import "server-only";

import type { Request, User } from "@/lib/db";
import {
  packingParcels,
  packingSeal,
  packingTotals,
  sameBasis,
  type PackingBasis,
  type PackingTotals,
} from "@/lib/strategy-packing";
import { scheduleTotal } from "@/lib/workflow/request-schedule";
import { quoteItemKey } from "@/lib/purchase-demand";
import { isBoxUnit } from "./purchase-history";
import {
  loadSheetInputs,
  packingFactsOf,
  type PackingFacts,
} from "./request-sheet";

/*
 * Embalagem e cubagem na Estratégia de compra (dono, 18/11/2026;
 * docs/PURCHASE_DEMAND.md, "Embalagem e cubagem na Estratégia"). A
 * embalagem de cada encomenda sai das mesmas fontes da ficha completa da
 * solicitação (`loadSheetInputs` e `packingFactsOf`); as contas, de
 * `@/lib/strategy-packing` (as mesmas na tela e aqui).
 */

export type DemandPackingWarning =
  /** A soma da programação é diferente da quantidade: a conta sai pelo total. */
  | "scheduleMismatch"
  /** Encomenda em caixas sem peças por master: não dá para converter. */
  | "boxUnitNoMaster";

/** A embalagem de uma encomenda (ou reposição) na Estratégia de compra. */
export interface DemandPacking {
  demandId: string;
  productId: string | null;
  /** Peças pedidas (em caixas: × peças por master); nulo = não dá para converter. */
  pieces: number | null;
  /** As contas de caixas em peças: uma por programação; sem ela, a quantidade. */
  parcels: number[];
  facts: PackingFacts;
  totals: PackingTotals | null;
  warnings: DemandPackingWarning[];
}

/** Peças e contas de uma encomenda: a quantidade pedida e a programação dela. */
function piecesOf(
  demand: Request,
  basis: PackingBasis,
): Pick<DemandPacking, "pieces" | "parcels" | "warnings"> {
  const warnings: DemandPackingWarning[] = [];
  const factor = isBoxUnit(demand.unit) ? basis.perMaster : 1;
  if (!factor) {
    warnings.push("boxUnitNoMaster");
    return { pieces: null, parcels: [], warnings };
  }
  const pieces = demand.quantity * factor;
  const schedule = demand.schedule?.items.length ? demand.schedule : null;
  // "Por programação" quando a programação é a quantidade pedida (a Nova
  // solicitação grava assim); senão, pelo total, com o aviso.
  if (schedule && Math.abs(scheduleTotal(schedule) - demand.quantity) > 1e-9)
    warnings.push("scheduleMismatch");
  const planned =
    schedule && !warnings.includes("scheduleMismatch")
      ? schedule.items.map((i) => i.quantity * factor)
      : null;
  return { pieces, parcels: packingParcels(pieces, planned), warnings };
}

/**
 * Item de book enviado pelo parceiro (dono, 26/11/2026): sem produto, a
 * embalagem é a da cópia do item (já em embalagens do SKU).
 */
function bookFacts(
  source: NonNullable<Request["bookingSource"]>,
): PackingFacts {
  const it = source.snapshot;
  const has = (n: number | null | undefined): n is number =>
    typeof n === "number" && Number.isFinite(n) && n > 0;
  return {
    basis: {
      perMaster: has(it.masterCartonQty) ? it.masterCartonQty : null,
      perInner: has(it.innerQty) ? it.innerQty : null,
      cbmPerMaster: has(it.cbmPerCarton) ? it.cbmPerCarton : null,
      cbmOtherBox: null,
    },
    from: {
      perMaster: has(it.masterCartonQty) ? "book" : null,
      perInner: has(it.innerQty) ? "book" : null,
      cbm: has(it.cbmPerCarton) ? "book" : null,
    },
  };
}

/** A embalagem de cada encomenda (pelo id), com as fontes da ficha completa. */
export async function demandPackings(
  user: User,
  demands: readonly Request[],
): Promise<Map<string, DemandPacking>> {
  const out = new Map<string, DemandPacking>();
  if (!demands.length) return out;
  const inputs = await loadSheetInputs(user, demands);
  for (const input of inputs) {
    const demand = input.request;
    const facts = demand.bookingSource
      ? bookFacts(demand.bookingSource)
      : packingFactsOf(input);
    const { pieces, parcels, warnings } = piecesOf(demand, facts.basis);
    out.set(demand.id, {
      demandId: demand.id,
      productId: demand.productId,
      pieces,
      parcels,
      facts,
      totals:
        pieces !== null && parcels.length
          ? packingTotals(parcels, facts.basis)
          : null,
      warnings,
    });
  }
  return out;
}

/** Um produto do pedido da estratégia: as encomendas dele somadas. */
export interface LinePacking {
  productId: string;
  /** Quantidade que o formulário traz (a soma das encomendas, em peças). */
  quantity: number;
  /** As contas programadas (peças), valendo enquanto a quantidade é a somada. */
  planned: number[];
  /** Nula quando as encomendas do produto têm embalagens diferentes. */
  basis: PackingBasis | null;
  facts: PackingFacts | null;
  warnings: Array<DemandPackingWarning | "mixedBasis">;
}

/**
 * Os produtos do pedido da estratégia (uma linha por produto, as encomendas
 * somadas, como o formulário): a quantidade, as contas e a embalagem.
 * Encomenda em caixas sem peças por master entra com a quantidade gravada
 * (o pedido sai em peças, como sempre), com o aviso.
 */
export function linePackings(
  demands: readonly Request[],
  packings: ReadonlyMap<string, DemandPacking>,
): LinePacking[] {
  // O item de book entra pela chave da demanda (`quoteItemKey`).
  const productIds = [
    ...new Set(demands.map((d) => quoteItemKey(d)).filter(Boolean)),
  ] as string[];
  return productIds.map((productId) => {
    const mine = demands.filter((d) => quoteItemKey(d) === productId);
    const packs = mine
      .map((d) => packings.get(d.id))
      .filter((p): p is DemandPacking => !!p);
    const warnings = new Set<LinePacking["warnings"][number]>(
      packs.flatMap((p) => p.warnings),
    );
    const first = packs[0]?.facts ?? null;
    const mixed =
      !first || packs.some((p) => !sameBasis(p.facts.basis, first.basis));
    if (first && mixed) warnings.add("mixedBasis");
    const convertible =
      packs.length === mine.length && packs.every((p) => p.pieces !== null);
    const quantity = convertible
      ? packs.reduce((sum, p) => sum + (p.pieces ?? 0), 0)
      : mine.reduce((sum, d) => sum + d.quantity, 0);
    return {
      productId,
      quantity,
      planned: convertible ? packs.flatMap((p) => p.parcels) : [],
      basis: mixed ? null : first!.basis,
      facts: mixed ? null : first,
      warnings: [...warnings],
    };
  });
}

/** Totais de um produto do pedido para a quantidade digitada (nulo: sem base). */
export function lineTotals(
  line: Pick<LinePacking, "planned" | "basis">,
  quantity: number,
): PackingTotals | null {
  if (!line.basis) return null;
  return packingTotals(packingParcels(quantity, line.planned), line.basis);
}

/** Assinatura dos totais de um produto (a mesma que a tela manda). */
export function lineSeal(
  line: Pick<LinePacking, "planned" | "basis">,
  quantity: number,
): string {
  const totals = lineTotals(line, quantity);
  return totals ? packingSeal(totals) : "-|-|-";
}
