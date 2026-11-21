import type {
  QuoteInnerIssue,
  QuoteItemInner,
  RequestInnerRequirement,
} from "@/lib/db/schema";

/*
 * Caixa inner exigida pelo cliente na cotação de compra (dono, 21/11/2026;
 * docs/PURCHASE_DEMAND.md, "Inner do cliente, material do catálogo e Sem
 * peso"). Puro: a exigência de cada produto a partir das demandas e o que o
 * fornecedor vê.
 *
 * - Nenhuma demanda pediu inner: o fornecedor não vê nada de inner.
 * - Todas pediram o mesmo número: exigência travada ("Peças por inner").
 * - Pedida sem número, ou demandas diferentes (uma pediu 24, outra 12, ou
 *   uma pediu e outra não): a Wellmix define na cotação; o fornecedor vê "a
 *   confirmar pela Wellmix" e o envio não trava. Nada é inventado.
 */

export type QuoteInnerState =
  | { kind: "none" }
  | { kind: "required"; qty: number }
  | { kind: "pending"; issue: QuoteInnerIssue; requested: number[] };

const wholePositive = (n: number | null | undefined): n is number =>
  typeof n === "number" && Number.isInteger(n) && n > 0;

/** O que o fornecedor vê do inner de um item da cotação. */
export function quoteInnerState(
  inner: QuoteItemInner | null | undefined,
): QuoteInnerState {
  if (!inner) return { kind: "none" };
  if (inner.issue)
    return {
      kind: "pending",
      issue: inner.issue,
      requested: inner.requested ?? [],
    };
  return wholePositive(inner.qty)
    ? { kind: "required", qty: inner.qty }
    : { kind: "none" };
}

/** A exigência do item a partir das demandas do mesmo produto. */
export function innerFromDemands(
  demands: ReadonlyArray<{
    innerRequirement?: RequestInnerRequirement | null;
  }>,
): QuoteItemInner | null {
  const reqs = demands.map((d) => d.innerRequirement ?? null);
  if (!reqs.some(Boolean)) return null;
  // Peças por inner de cada demanda (0 = não pediu; nulo = pediu sem o número).
  const values = reqs.map((r) => (r ? (wholePositive(r.qty) ? r.qty : null) : 0));
  const requested = [
    ...new Set(values.filter((v): v is number => v !== null)),
  ].sort((a, b) => a - b);
  if (values.some((v) => v === null))
    return { qty: null, issue: "missing", requested };
  if (requested.length === 1 && requested[0] > 0)
    return { qty: requested[0], issue: null, requested: null };
  return { qty: null, issue: "conflict", requested };
}
