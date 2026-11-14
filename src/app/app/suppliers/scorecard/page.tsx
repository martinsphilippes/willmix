import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { isWellmix } from "@/lib/auth/permissions";
import { getT } from "@/i18n/server";
import { loadSupplierScores } from "@/lib/services/supplier-score-load";
import type { Criterion, SupplierScore } from "@/lib/services/supplier-score";
import { ServerPager, SortTh } from "@/components/server-table";
import { LiveSearch } from "@/components/live-search";
import {
  SERVER_TABLE_FROM,
  parseServerPage,
  parseServerSort,
  serverTable,
  type ServerColumn,
} from "@/lib/server-table";
import {
  Badge,
  Empty,
  Input,
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
export default async function SupplierScorecardPage({
  searchParams,
}: PageProps<"/app/suppliers/scorecard">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "parties");
  if (!isWellmix(user)) redirect("/app");
  const t = await getT();
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) =>
    typeof v === "string" ? v : undefined;
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

  // Lista longa: busca, ordem e página no servidor (auditoria de performance,
  // 14/11/2026: 24 MB de HTML com os 5,7 mil fornecedores). Curta: como antes.
  type Row = (typeof rows)[number];
  const columns: ServerColumn<Row>[] = [
    { key: "supplier", text: ({ supplier }) => supplier.name },
    {
      key: "score",
      text: ({ score: s }) =>
        s.grade ? `${s.grade} ${n(s.score ?? 0)}` : t("score.noData"),
    },
    { key: "onTime", text: ({ score: s }) => pctText(s.onTime) },
    { key: "inspection", text: ({ score: s }) => pctText(s.inspection) },
    { key: "receiving", text: ({ score: s }) => pctText(s.receiving) },
    { key: "art", text: ({ score: s }) => pctText(s.art) },
    { key: "quotes", text: ({ score: s }) => pctText(s.quotes) },
    { key: "orders", text: ({ score: s }) => n(s.orders) },
  ];
  const serverMode = rows.length > SERVER_TABLE_FROM;
  const q = serverMode ? (one(sp.q) ?? "").slice(0, 120) : "";
  const sort = serverMode ? parseServerSort(one(sp.sort), columns) : null;
  const shown = serverTable(rows, columns, {
    q,
    sort,
    page: parseServerPage(one(sp.page)),
    size: serverMode ? undefined : Math.max(rows.length, 1),
    decimalComma: t.locale === "pt",
  });
  const listHref = (patch: { sort?: string | null; page?: number }) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    const value =
      patch.sort !== undefined
        ? patch.sort
        : sort
          ? `${sort.desc ? "-" : ""}${sort.key}`
          : null;
    if (value) params.set("sort", value);
    if (patch.page) params.set("page", String(patch.page + 1));
    const query = params.toString();
    return `/app/suppliers/scorecard${query ? `?${query}` : ""}`;
  };
  const header = (label: string, column: string, className?: string) =>
    serverMode ? (
      <SortTh
        label={label}
        column={column}
        sort={sort}
        href={(value) => listHref({ sort: value })}
        t={t}
        className={className}
      />
    ) : (
      <Th className={className}>{label}</Th>
    );

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
          {serverMode ? (
            <form
              method="get"
              action="/app/suppliers/scorecard"
              className="mb-3"
              data-scorecard-search
            >
              {sort ? (
                <input
                  type="hidden"
                  name="sort"
                  value={`${sort.desc ? "-" : ""}${sort.key}`}
                />
              ) : null}
              <Input
                name="q"
                type="search"
                defaultValue={q}
                placeholder={t("tableTools.search")}
                aria-label={t("tableTools.search")}
                className="w-full max-w-md"
              />
              <LiveSearch />
            </form>
          ) : null}
          <Table tools={!serverMode}>
            <thead>
              <tr>
                {header(t("score.col.supplier"), "supplier")}
                {header(t("score.col.score"), "score")}
                {header(t("score.col.onTime"), "onTime", "text-right")}
                {header(t("score.col.inspection"), "inspection", "text-right")}
                {header(t("score.col.receiving"), "receiving", "text-right")}
                {header(t("score.col.art"), "art", "text-right")}
                {header(t("score.col.quotes"), "quotes", "text-right")}
                {header(t("score.col.orders"), "orders", "text-right")}
              </tr>
            </thead>
            <tbody data-scorecard>
              {shown.rows.map(({ supplier, score: s }) => {
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
          {serverMode ? (
            <ServerPager
              page={shown}
              href={(page) => listHref({ page })}
              t={t}
            />
          ) : null}
          <p className="mt-2 text-xs text-zinc-500">{t("score.legend")}</p>
        </>
      )}
    </>
  );
}
