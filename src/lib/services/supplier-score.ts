import type {
  ArtIssue,
  Order,
  ProductionTrack,
  Quote,
  Receiving,
  SkuInspection,
} from "@/lib/db/schema";

/*
 * Avaliação de fornecedores (só a Wellmix vê), com o que o portal já registra:
 * - pontualidade: pedidos em que o ETD prometido não foi adiado;
 * - inspeção: SKUs aprovados na 1ª inspeção;
 * - recebimento: unidades que chegaram boas (recebido − avaria) sobre o esperado,
 *   nos recebimentos fechados;
 * - arte: pedidos sem não conformidade de arte;
 * - cotação: convites respondidos (e em quantos dias, em média); convite
 *   sem resposta só conta depois de QUOTE_GRACE_DAYS dias.
 * A nota é a média simples dos critérios com dados (0 a 100); sem nenhum
 * dado, não há nota (nada é inventado).
 */

export interface Criterion {
  /** Percentual 0–100, ou nulo sem dados. */
  pct: number | null;
  /** Quantos casos entraram na conta. */
  n: number;
}

export interface SupplierScore {
  onTime: Criterion & { avgDelayDays: number | null };
  inspection: Criterion;
  receiving: Criterion;
  art: Criterion;
  quotes: Criterion & { avgDays: number | null };
  score: number | null;
  grade: "A" | "B" | "C" | "D" | null;
  orders: number;
}

const pct = (ok: number, n: number) =>
  n > 0 ? Math.round((ok / n) * 1000) / 10 : null;
const days = (from: string, to: string) =>
  Math.round(
    (Date.parse(`${to.slice(0, 10)}T12:00:00Z`) -
      Date.parse(`${from.slice(0, 10)}T12:00:00Z`)) /
      86_400_000,
  );

/** Dias que o fornecedor tem para responder antes do convite contar contra. */
export const QUOTE_GRACE_DAYS = 3;

/** Letra da nota: A ≥ 90, B ≥ 75, C ≥ 60, D abaixo. */
export function gradeOf(score: number | null): SupplierScore["grade"] {
  if (score === null) return null;
  return score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : "D";
}

/** Calcula a avaliação de um fornecedor (função pura). */
export function scoreSupplier(input: {
  orders: Pick<Order, "id" | "status">[];
  tracks: Pick<ProductionTrack, "orderId" | "etd" | "etdOriginal">[];
  inspections: Pick<SkuInspection, "orderId" | "round" | "result">[];
  receivings: Pick<Receiving, "orderId" | "closedAt" | "items">[];
  artIssues: Pick<ArtIssue, "orderId">[];
  quotes: Pick<Quote, "status" | "answeredAt" | "createdAt">[];
  /** Hoje (AAAA-MM-DD): convite mais novo que o prazo e sem resposta não conta. */
  today: string;
}): SupplierScore {
  const orders = input.orders.filter((o) => o.status !== "CANCELLED");
  const ids = new Set(orders.map((o) => o.id));

  // Pontualidade: ETD final em relação ao prometido (o primeiro).
  const tracks = input.tracks.filter(
    (t) => ids.has(t.orderId) && t.etdOriginal && t.etd,
  );
  const delays = tracks.map((t) => Math.max(0, days(t.etdOriginal!, t.etd!)));
  const onTime = {
    n: tracks.length,
    pct: pct(delays.filter((d) => d === 0).length, tracks.length),
    avgDelayDays: delays.length
      ? Math.round((delays.reduce((s, d) => s + d, 0) / delays.length) * 10) /
        10
      : null,
  };

  const first = input.inspections.filter(
    (i) => ids.has(i.orderId) && i.round === 1,
  );
  const inspection = {
    n: first.length,
    pct: pct(first.filter((i) => i.result === "approved").length, first.length),
  };

  let expected = 0;
  let good = 0;
  for (const r of input.receivings) {
    if (!ids.has(r.orderId) || !r.closedAt) continue;
    for (const it of r.items ?? []) {
      if (!(it.expected > 0)) continue;
      expected += it.expected;
      good += Math.min(it.expected, Math.max(0, it.received - it.damaged));
    }
  }
  const receiving = { n: expected, pct: pct(good, expected) };

  const withIssue = new Set(
    input.artIssues.filter((a) => ids.has(a.orderId)).map((a) => a.orderId),
  );
  const art = {
    n: orders.length,
    pct: pct(orders.length - withIssue.size, orders.length),
  };

  const counted = input.quotes.filter(
    (q) => q.answeredAt || days(q.createdAt, input.today) >= QUOTE_GRACE_DAYS,
  );
  const answered = counted.filter((q) => q.answeredAt);
  const quotes = {
    n: counted.length,
    pct: pct(answered.length, counted.length),
    avgDays: answered.length
      ? Math.round(
          (answered.reduce(
            (s, q) => s + Math.max(0, days(q.createdAt, q.answeredAt!)),
            0,
          ) /
            answered.length) *
            10,
        ) / 10
      : null,
  };

  const parts = [onTime, inspection, receiving, art, quotes]
    .map((c) => c.pct)
    .filter((p): p is number => p !== null);
  // Arte sozinha (só ter pedidos) não basta para dar nota.
  const real = [onTime, inspection, receiving, quotes].some(
    (c) => c.pct !== null,
  );
  const score =
    real && parts.length
      ? Math.round((parts.reduce((s, p) => s + p, 0) / parts.length) * 10) / 10
      : null;
  return {
    onTime,
    inspection,
    receiving,
    art,
    quotes,
    score,
    grade: gradeOf(score),
    orders: orders.length,
  };
}
