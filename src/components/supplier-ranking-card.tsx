import type { Translate } from "@/i18n";
import type { SupplierRanking } from "@/lib/services/supplier-ranking";
import {
  explainWinner,
  type RankingCriterion,
  type RankingValues,
} from "@/lib/services/supplier-ranking-calc";
import { Badge, Card, cx, TextLink } from "@/components/ui";

/**
 * Disputa entre as cotações: nota de cada fornecedor por critério (com o
 * peso das Configurações), o vencedor e por que ele ganhou.
 */
export function SupplierRankingCard({
  t,
  ranking,
  supplierOf,
  canEditWeights,
}: {
  t: Translate;
  ranking: SupplierRanking;
  /** Nome do fornecedor de cada cotação. */
  supplierOf: (quoteId: string) => string;
  canEditWeights: boolean;
}) {
  const money = (n: number, currency: string | null) => {
    const digits = { maximumFractionDigits: n < 10 ? 4 : 2 };
    try {
      return currency
        ? new Intl.NumberFormat(t.intl, {
            style: "currency",
            currency,
            ...digits,
          }).format(n)
        : n.toLocaleString(t.intl, digits);
    } catch {
      return `${currency} ${n.toLocaleString(t.intl, digits)}`;
    }
  };
  // Preço na moeda comum das cotações (ou R$); frete marítimo sempre em R$.
  const fmt = (c: RankingCriterion, n: number) =>
    money(n, c === "price" ? ranking.priceCurrency : "BRL");
  const show = (c: RankingCriterion, v: RankingValues): string => {
    if (c === "moq") {
      if (!v.moq) return t("ranking.noValue");
      return v.moq.moq <= v.moq.quantity
        ? t("ranking.moq.ok", { moq: v.moq.moq.toLocaleString(t.intl) })
        : t("ranking.moq.over", {
            moq: v.moq.moq.toLocaleString(t.intl),
            qty: v.moq.quantity.toLocaleString(t.intl),
          });
    }
    const n = v[c] as number | null;
    if (n === null) return t("ranking.noValue");
    return c === "price" || c === "freight"
      ? fmt(c, n)
      : t("ranking.days", { n: String(n) });
  };
  const num = (n: number) =>
    n.toLocaleString(t.intl, { maximumFractionDigits: 1 });
  const reasonFor = (c: RankingCriterion, v: RankingValues): string => {
    if (c === "moq") {
      // "Atende" só quando atende; senão, só é o menor MOQ entre elas.
      return v.moq && v.moq.moq > v.moq.quantity
        ? t("ranking.reason.moqLower", {
            value: v.moq.moq.toLocaleString(t.intl),
          })
        : t("ranking.reason.moq");
    }
    if (c === "price" || c === "freight")
      return t(`ranking.reason.${c}`, { value: fmt(c, (v[c] as number) ?? 0) });
    const days = t("ranking.days", { n: String(v[c] ?? "") });
    return c === "delivery" && !ranking.deliveryIncludesTransit
      ? t("ranking.reason.deliveryDeparture", { value: days })
      : t(`ranking.reason.${c}`, { value: days });
  };
  // Nome do critério no meio da frase (minúsculo, mas "MOQ" fica "MOQ").
  const criteriaList = (list: RankingCriterion[]) =>
    list.map((c) => t(`ranking.inline.${c}`)).join(", ");

  if (!ranking.used.length)
    return (
      <Card title={t("ranking.title")} dense>
        <p className="text-sm text-zinc-600">{t("ranking.none")}</p>
      </Card>
    );

  const winner = ranking.rows.find((r) => r.quoteId === ranking.winnerId);
  const winnerValues = winner ? ranking.values.get(winner.quoteId)! : null;
  // Onde ganhou, empatou, perdeu ou só ele informou (em ordem de peso).
  const why = explainWinner(ranking);
  const tied = ranking.tie
    ? ranking.rows.filter((r) => r.total === ranking.rows[0].total)
    : [];

  return (
    <Card
      title={t("ranking.title")}
      dense
      actions={
        canEditWeights ? (
          <TextLink href="/app/settings#ranking" className="text-xs">
            {t("ranking.settingsLink")}
          </TextLink>
        ) : null
      }
    >
      <div className="space-y-3" data-supplier-ranking={ranking.rows.length}>
        <p className="text-xs text-zinc-600">{t("ranking.intro")}</p>
        {ranking.used.includes("delivery") &&
        !ranking.deliveryIncludesTransit ? (
          <p className="text-xs text-zinc-600" data-ranking-departure="">
            {t("ranking.deliveryToDeparture")}
          </p>
        ) : null}
        {ranking.tie ? (
          <p
            className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 ring-1 ring-inset ring-amber-200"
            data-ranking-tie=""
          >
            {t("ranking.tie", {
              points: num(ranking.rows[0].total),
              suppliers: tied.map((r) => supplierOf(r.quoteId)).join(", "),
            })}
          </p>
        ) : winner && winnerValues ? (
          <div
            className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900 ring-1 ring-inset ring-emerald-200"
            data-ranking-winner={winner.quoteId}
          >
            <p className="font-semibold">
              {t("ranking.winner", {
                supplier: supplierOf(winner.quoteId),
                points: num(winner.total),
              })}
            </p>
            {why?.wins.length ? (
              <p>
                {t("ranking.why", {
                  reasons: why.wins
                    .map((c) => reasonFor(c, winnerValues))
                    .join("; "),
                })}
              </p>
            ) : null}
            {why?.losses.length ? (
              <p className="text-emerald-800">
                {t("ranking.lostIn", { criteria: criteriaList(why.losses) })}
              </p>
            ) : null}
            {why?.tied.length ? (
              <p className="text-emerald-800" data-ranking-tied-on="">
                {t("ranking.tiedIn", { criteria: criteriaList(why.tied) })}
              </p>
            ) : null}
            {why?.onlyData.length ? (
              <p className="text-emerald-800">
                {t("ranking.onlyData", {
                  criteria: criteriaList(why.onlyData),
                })}
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="text-left text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                <th className="py-1 pr-3">{t("ranking.col.rank")}</th>
                <th className="py-1 pr-3">{t("common.supplier")}</th>
                {ranking.used.map((c) => (
                  <th key={c} className="py-1 pr-3">
                    {t(`ranking.criterion.${c}`)}
                    <span className="block font-normal normal-case tracking-normal text-zinc-400">
                      {t("ranking.weight", {
                        n: String(ranking.weights[c]),
                      })}
                    </span>
                  </th>
                ))}
                <th className="py-1 text-right">{t("ranking.col.total")}</th>
              </tr>
            </thead>
            <tbody>
              {ranking.rows.map((row) => {
                const v = ranking.values.get(row.quoteId)!;
                const isWinner =
                  !ranking.tie && row.quoteId === ranking.winnerId;
                return (
                  <tr
                    key={row.quoteId}
                    className={cx(
                      "border-t border-zinc-100 align-top",
                      isWinner && "bg-emerald-50/50",
                    )}
                    data-ranking-row={row.quoteId}
                    data-ranking-total={row.total}
                  >
                    <td className="py-2 pr-3 font-semibold tabular-nums">
                      {t("ranking.rank", { n: String(row.rank) })}
                    </td>
                    <td className="py-2 pr-3 font-medium text-zinc-900">
                      {supplierOf(row.quoteId)}
                      {isWinner ? (
                        <span className="ml-2">
                          <Badge tone="success">{t("ranking.badge")}</Badge>
                        </span>
                      ) : null}
                    </td>
                    {row.criteria.map((cs) => (
                      <td
                        key={cs.criterion}
                        className={cx(
                          "py-2 pr-3 tabular-nums",
                          cs.best
                            ? "font-semibold text-emerald-800"
                            : "text-zinc-700",
                        )}
                        data-ranking-best={cs.best ? "" : undefined}
                      >
                        {show(cs.criterion, v)}
                        <span className="block text-xs font-normal text-zinc-500">
                          {t("ranking.points", { n: num(cs.score) })}
                        </span>
                      </td>
                    ))}
                    <td className="py-2 text-right text-base font-semibold tabular-nums text-zinc-900">
                      {num(row.total)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}
