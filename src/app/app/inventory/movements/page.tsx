import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { isWellmix } from "@/lib/auth/permissions";
import { canOpen } from "@/lib/auth/screens";
import {
  getStore,
  STOCK_MOVEMENT_KINDS,
  type StockCount,
  type StockMovement,
} from "@/lib/db";
import { getT } from "@/i18n/server";
import { listStockMovements } from "@/lib/services/inventory";
import { safeList } from "@/lib/services/stock";
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
  formatDate,
  formatMoney,
  rowClass,
} from "@/components/ui";
import { TabLink } from "@/components/customer-account";

const KIND_TONE = {
  sale_out: "info",
  count_loss: "danger",
  count_gain: "success",
} as const;

type Tab = "all" | StockMovement["kind"];

/**
 * Movimentações do estoque no Brasil: baixas por venda, perdas e sobras dos
 * inventários. "Produtos perdidos" mostra as perdas de cada inventário (de um
 * inventário ao outro), com a quantidade e, para quem abre Finanças, o valor
 * de custo.
 */
export default async function StockMovementsPage({
  searchParams,
}: PageProps<"/app/inventory/movements">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "products");
  if (!isWellmix(user)) redirect("/app");
  const t = await getT();
  const sp = await searchParams;
  const tab: Tab = (STOCK_MOVEMENT_KINDS as readonly string[]).includes(
    String(sp.kind),
  )
    ? (sp.kind as Tab)
    : "all";
  const money = canOpen(user, "finance");
  const store = getStore();
  const all = (await listStockMovements()).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const shown = tab === "all" ? all : all.filter((m) => m.kind === tab);
  const productIds = [...new Set(shown.map((m) => m.productId))];
  const orderIds = [
    ...new Set(shown.map((m) => m.orderId).filter(Boolean) as string[]),
  ];
  const [products, orders, users, counts] = await Promise.all([
    productIds.length
      ? store.list("products", { filter: { id: productIds } })
      : Promise.resolve([]),
    orderIds.length
      ? store.list("orders", { filter: { id: orderIds } })
      : Promise.resolve([]),
    store.list("users"),
    safeList("stock_counts"),
  ]);
  const product = (id: string) => products.find((p) => p.id === id) ?? null;
  const sortedCounts = [...counts].sort((a, b) => a.number - b.number);
  const countOf = (id: string | null) =>
    id ? (counts.find((c) => c.id === id) ?? null) : null;
  const value = (m: StockMovement) => {
    const p = product(m.productId);
    return p?.price != null
      ? formatMoney(Math.abs(m.quantity) * p.price, p.currency, t)
      : "—";
  };
  // Perdas agrupadas por inventário: período desde o inventário anterior.
  const groups: {
    count: StockCount | null;
    prev: StockCount | null;
    rows: StockMovement[];
  }[] =
    tab === "count_loss"
      ? sortedCounts
          .map((c, i) => ({
            count: c,
            prev: sortedCounts[i - 1] ?? null,
            rows: shown.filter((m) => m.countId === c.id),
          }))
          .filter((g) => g.rows.length)
          .reverse()
      : [{ count: null, prev: null, rows: shown }];

  const table = (rows: StockMovement[]) => (
    <Table>
      <thead>
        <tr>
          <Th>{t("stockMov.col.date")}</Th>
          <Th>{t("stockMov.col.kind")}</Th>
          <Th>{t("stockMov.col.product")}</Th>
          <Th className="text-right">{t("stockMov.col.qty")}</Th>
          {money ? (
            <Th className="text-right">{t("stockMov.col.value")}</Th>
          ) : null}
          <Th>{t("stockMov.col.ref")}</Th>
          <Th>{t("stockMov.col.by")}</Th>
          <Th>{t("stockMov.col.note")}</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((m) => {
          const p = product(m.productId);
          const c = countOf(m.countId);
          const o = m.orderId ? orders.find((x) => x.id === m.orderId) : null;
          return (
            <tr key={m.id} className={rowClass} data-movement={m.kind}>
              <Td className="whitespace-nowrap">
                {formatDate(m.createdAt, t)}
              </Td>
              <Td className="whitespace-nowrap">
                <Badge tone={KIND_TONE[m.kind]}>
                  {t(`stockMov.kind.${m.kind}`)}
                </Badge>
              </Td>
              <Td className="min-w-44 font-medium">
                {p ? (
                  <TextLink
                    href={`/app/products/${p.id}`}
                    className="text-zinc-900"
                  >
                    {p.name}
                  </TextLink>
                ) : (
                  m.productId
                )}
                {p?.sku ? (
                  <span className="block font-mono text-xs font-normal text-zinc-500">
                    {p.sku}
                  </span>
                ) : null}
              </Td>
              <Td
                className={cx(
                  "whitespace-nowrap text-right font-semibold tabular-nums",
                  m.quantity < 0 ? "text-rose-700" : "text-emerald-700",
                )}
              >
                {m.quantity > 0 ? "+" : ""}
                {m.quantity.toLocaleString(t.intl)} {m.unit ?? "un"}
              </Td>
              {money ? (
                <Td className="whitespace-nowrap text-right tabular-nums">
                  {value(m)}
                </Td>
              ) : null}
              <Td className="whitespace-nowrap">
                {c ? (
                  <TextLink href={`/app/inventory/counts/${c.id}`}>
                    {t("stockMov.count", { n: c.number })}
                  </TextLink>
                ) : o ? (
                  <TextLink href={`/app/orders/${o.id}`}>#{o.number}</TextLink>
                ) : (
                  "—"
                )}
              </Td>
              <Td className="whitespace-nowrap">
                {users.find((u) => u.id === m.createdByUserId)?.name ?? "—"}
              </Td>
              <Td>
                <span
                  className="block max-w-64 truncate"
                  title={m.note ?? undefined}
                >
                  {m.note ?? "—"}
                </span>
              </Td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );

  return (
    <>
      <PageHeader
        t={t}
        title={t("stockMov.title")}
        subtitle={t("stockMov.subtitle")}
        actions={
          <>
            <LinkButton href="/app/inventory">{t("inv.title")}</LinkButton>
            <LinkButton href="/app/inventory/counts">
              {t("stockCount.link")}
            </LinkButton>
          </>
        }
      />
      <nav className="mb-4 flex flex-wrap gap-4 border-b border-zinc-200">
        {(["all", ...STOCK_MOVEMENT_KINDS] as Tab[]).map((k) => (
          <TabLink
            key={k}
            href={`/app/inventory/movements${k === "all" ? "" : `?kind=${k}`}`}
            active={tab === k}
          >
            {t(`stockMov.tab.${k}`)}
          </TabLink>
        ))}
      </nav>
      {shown.length === 0 ? (
        <Empty>{t("stockMov.empty")}</Empty>
      ) : (
        groups.map((g) => (
          <section
            key={g.count?.id ?? "all"}
            className="mb-6"
            data-loss-group={g.count?.number}
          >
            {g.count ? (
              <h2 className="mb-2 flex flex-wrap items-baseline gap-x-4 text-base font-semibold text-zinc-900">
                <TextLink href={`/app/inventory/counts/${g.count.id}`}>
                  {g.prev
                    ? t("stockMov.period", {
                        n: g.count.number,
                        from: formatDate(
                          g.prev.closedAt ?? g.prev.createdAt,
                          t,
                        ),
                        to: formatDate(
                          g.count.closedAt ?? g.count.createdAt,
                          t,
                        ),
                      })
                    : t("stockMov.periodFirst", {
                        n: g.count.number,
                        to: formatDate(
                          g.count.closedAt ?? g.count.createdAt,
                          t,
                        ),
                      })}
                </TextLink>
                <span className="text-sm font-medium text-rose-700">
                  {t("stockMov.periodTotal", {
                    qty: Math.abs(
                      g.rows.reduce((s, m) => s + m.quantity, 0),
                    ).toLocaleString(t.intl),
                  })}
                </span>
              </h2>
            ) : null}
            {table(g.rows)}
          </section>
        ))
      )}
    </>
  );
}
