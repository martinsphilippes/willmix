import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { isWellmix } from "@/lib/auth/permissions";
import { getT } from "@/i18n/server";
import { loadSupplierScores } from "@/lib/services/supplier-score-load";
import type { Criterion, SupplierScore } from "@/lib/services/supplier-score";
import {
  Badge,
  Empty,
  LinkButton,
  PageHeader,
  Table,
  Td,
  TextLink,
  Th,
  cx,
  rowClass,
} from "@/components/ui";

const GRADE_TONE = {
  A: "success",
  B: "info",
  C: "warning",
  D: "danger",
} as const;

/**
 * Avaliação de fornecedores: nota por critério e geral. Só a Wellmix (nunca
 * um fornecedor vê a nota de outro); leitura no servidor, nada é gravado.
 */
export default async function SupplierScorecardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "parties");
  if (!isWellmix(user)) redirect("/app");
  const t = await getT();
  const rows = await loadSupplierScores();
  const n = (v: number) => v.toLocaleString(t.intl);
  const pctText = (c: Criterion) =>
    c.pct === null ? "—" : `${c.pct.toLocaleString(t.intl)}%`;
  const tone = (c: Criterion) =>
    c.pct === null
      ? "text-zinc-400"
      : c.pct >= 90
        ? "text-emerald-700"
        : c.pct >= 75
          ? "text-zinc-900"
          : c.pct >= 60
            ? "text-amber-700"
            : "text-rose-700";
  const cell = (c: Criterion, sub: string | null) => (
    <Td className="whitespace-nowrap text-right">
      <span className={cx("font-semibold tabular-nums", tone(c))}>
        {pctText(c)}
      </span>
      {sub ? <span className="block text-xs text-zinc-500">{sub}</span> : null}
    </Td>
  );
  const subs = (s: SupplierScore) => ({
    onTime: s.onTime.n
      ? [
          t("score.n.orders", { n: n(s.onTime.n) }),
          s.onTime.avgDelayDays
            ? t("score.delay", { n: n(s.onTime.avgDelayDays) })
            : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : null,
    inspection: s.inspection.n
      ? t("score.n.skus", { n: n(s.inspection.n) })
      : null,
    receiving: s.receiving.n
      ? t("score.n.units", { n: n(s.receiving.n) })
      : null,
    art: s.art.n ? t("score.n.orders", { n: n(s.art.n) }) : null,
    quotes: s.quotes.n
      ? [
          t("score.n.quotes", { n: n(s.quotes.n) }),
          s.quotes.avgDays !== null
            ? t("score.answerDays", { n: n(s.quotes.avgDays) })
            : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : null,
  });

  return (
    <>
      <PageHeader
        t={t}
        title={t("score.title")}
        subtitle={t("score.subtitle")}
        actions={
          <LinkButton href="/app/suppliers">{t("supp.title")}</LinkButton>
        }
      />
      {rows.length === 0 ? (
        <Empty>{t("score.empty")}</Empty>
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>{t("score.col.supplier")}</Th>
                <Th>{t("score.col.score")}</Th>
                <Th className="text-right">{t("score.col.onTime")}</Th>
                <Th className="text-right">{t("score.col.inspection")}</Th>
                <Th className="text-right">{t("score.col.receiving")}</Th>
                <Th className="text-right">{t("score.col.art")}</Th>
                <Th className="text-right">{t("score.col.quotes")}</Th>
                <Th className="text-right">{t("score.col.orders")}</Th>
              </tr>
            </thead>
            <tbody data-scorecard>
              {rows.map(({ supplier, score: s }) => {
                const sub = subs(s);
                return (
                  <tr key={supplier.id} className={rowClass}>
                    <Td className="min-w-44 font-medium">
                      <TextLink
                        href={`/app/suppliers/${supplier.id}`}
                        className="text-zinc-900"
                      >
                        {supplier.name}
                      </TextLink>
                    </Td>
                    <Td className="whitespace-nowrap">
                      <div data-score-grade={s.grade ?? "none"}>
                        {s.grade ? (
                          <span className="flex items-center gap-2">
                            <Badge tone={GRADE_TONE[s.grade]}>{s.grade}</Badge>
                            <span className="font-semibold tabular-nums">
                              {n(s.score ?? 0)}
                            </span>
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-500">
                            {t("score.noData")}
                          </span>
                        )}
                      </div>
                    </Td>
                    {cell(s.onTime, sub.onTime)}
                    {cell(s.inspection, sub.inspection)}
                    {cell(s.receiving, sub.receiving)}
                    {cell(s.art, sub.art)}
                    {cell(s.quotes, sub.quotes)}
                    <Td className="text-right tabular-nums">{n(s.orders)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <p className="mt-2 text-xs text-zinc-500">{t("score.legend")}</p>
        </>
      )}
    </>
  );
}
