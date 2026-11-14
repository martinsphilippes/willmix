import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { isWellmix } from "@/lib/auth/permissions";
import { getT } from "@/i18n/server";
import { priceTable } from "@/lib/services/price-table";
import { ServerPager, SortTh } from "@/components/server-table";
import {
  SERVER_TABLE_FROM,
  parseServerPage,
  parseServerSort,
  serverTable,
  type ServerColumn,
} from "@/lib/server-table";
import { LiveSearch } from "@/components/live-search";
import {
  Card,
  Empty,
  Input,
  PageHeader,
  Table,
  Td,
  Th,
  formatDate,
  formatMoney,
} from "@/components/ui";

/** Tabela de preços (Fase F): último preço praticado por produto. Só a Wellmix. */
export default async function PriceTablePage({
  searchParams,
}: PageProps<"/app/marketing/price-table">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "marketing");
  if (!isWellmix(user)) notFound();
  const t = await getT();
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) =>
    typeof v === "string" ? v : undefined;
  const rows = await priceTable(user);
  type Row = (typeof rows)[number];
  // Lista longa: busca, ordem e página no servidor (auditoria de performance,
  // 14/11/2026: 34 MB de HTML com os 17 mil produtos). O CSV continua com
  // a tabela inteira. Curta: como antes.
  const columns: ServerColumn<Row>[] = [
    { key: "product", text: (r) => (r.sku ? `${r.name} · ${r.sku}` : r.name) },
    { key: "line", text: (r) => r.line },
    { key: "moq", text: (r) => r.moq?.toLocaleString(t.intl) ?? "—" },
    {
      key: "unit",
      text: (r) =>
        r.unitPrice !== null
          ? formatMoney(r.unitPrice, r.currency ?? "BRL", t)
          : "—",
    },
    {
      key: "fob",
      text: (r) =>
        r.fobUnit !== null
          ? formatMoney(r.fobUnit, r.fobCurrency ?? "USD", t)
          : "—",
    },
    { key: "sold", text: (r) => formatDate(r.soldAt, t) },
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
    return `/app/marketing/price-table${query ? `?${query}` : ""}`;
  };
  const header = (label: string, column: string) =>
    serverMode ? (
      <SortTh
        label={label}
        column={column}
        sort={sort}
        href={(value) => listHref({ sort: value })}
        t={t}
      />
    ) : (
      <Th>{label}</Th>
    );
  return (
    <div className="space-y-4">
      <PageHeader
        title={t("priceTable.title")}
        subtitle={t("priceTable.subtitle")}
        actions={
          <a
            href="/api/marketing/price-table"
            className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            data-price-table-csv
          >
            {t("priceTable.csv")}
          </a>
        }
      />
      <Card>
        {serverMode ? (
          <form
            method="get"
            action="/app/marketing/price-table"
            className="mb-3"
            data-price-table-search
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
        {!rows.length ? (
          <Empty>{t("priceTable.empty")}</Empty>
        ) : !shown.matched ? (
          <Empty>{t("tableTools.none")}</Empty>
        ) : (
          <Table tools={!serverMode}>
            <thead>
              <tr>
                {header(t("priceTable.product"), "product")}
                {header(t("priceTable.line"), "line")}
                {header(t("priceTable.moq"), "moq")}
                {header(t("priceTable.unitPrice"), "unit")}
                {header(t("priceTable.fob"), "fob")}
                {header(t("priceTable.soldAt"), "sold")}
              </tr>
            </thead>
            <tbody>
              {shown.rows.map((r) => (
                <tr key={r.productId} data-price-row={r.productId}>
                  <Td>
                    {r.name}
                    {r.sku ? (
                      <span className="text-zinc-500"> · {r.sku}</span>
                    ) : null}
                  </Td>
                  <Td>{r.line}</Td>
                  <Td>{r.moq?.toLocaleString(t.intl) ?? "—"}</Td>
                  <Td>
                    {r.unitPrice !== null
                      ? formatMoney(r.unitPrice, r.currency ?? "BRL", t)
                      : "—"}
                  </Td>
                  <Td>
                    {r.fobUnit !== null
                      ? formatMoney(r.fobUnit, r.fobCurrency ?? "USD", t)
                      : "—"}
                  </Td>
                  <Td>{formatDate(r.soldAt, t)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {serverMode ? (
          <ServerPager page={shown} href={(page) => listHref({ page })} t={t} />
        ) : null}
      </Card>
    </div>
  );
}
