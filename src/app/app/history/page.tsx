import type { ReactNode } from "react";
import { fallbackError } from "@/i18n/error-text";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { canOpen } from "@/lib/auth/screens";
import { canSeeInternalCosts, isWellmix } from "@/lib/auth/permissions";
import { getStore } from "@/lib/db";
import { loadCommercialHistory, type HistoryRow } from "@/lib/services/history";
import { getT } from "@/i18n/server";
import type { Translate } from "@/i18n";
import {
  Alert,
  Badge,
  Empty,
  LinkButton,
  PageHeader,
  Table,
  Td,
  TextLink,
  Th,
  formatDate,
  formatMoney,
  rowClass,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { PartyPicker } from "@/components/party-picker";
import { partyPickerLabels } from "@/components/party-picker-labels";
import { ServerPager, SortTh } from "@/components/server-table";
import {
  SERVER_TABLE_FROM,
  parseServerPage,
  parseServerSort,
  serverTable,
  type ServerColumn,
} from "@/lib/server-table";
import { ChatOpenButton } from "@/components/chat-open-button";

const interestTone = (v: string | null) =>
  v === "yes" ? "success" : v === "maybe" ? "warning" : "neutral";

function Interest({ value, t }: { value: string | null; t: Translate }) {
  if (value !== "yes" && value !== "maybe" && value !== "no") return <>—</>;
  return (
    <Badge tone={interestTone(value)}>
      {t(`orders.afterSales.repurchase.${value}`)}
    </Badge>
  );
}

/** Botões "Comprar de novo / Nova proposta": levam ao card de recompra do último pedido. */
function RowActions({ row, t }: { row: HistoryRow; t: Translate }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <LinkButton
        href={`/app/orders/${row.lastOrderId}#followup`}
        variant="primary"
        className="px-2.5 py-1 text-xs"
      >
        {t("history.buyAgain")}
      </LinkButton>
      <LinkButton
        href={`/app/orders/${row.lastOrderId}#followup`}
        className="px-2.5 py-1 text-xs"
      >
        {t("history.newProposal")}
      </LinkButton>
    </div>
  );
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </dt>
      <dd className="mt-0.5 text-zinc-900">{children}</dd>
    </div>
  );
}

/**
 * Histórico comercial: cliente → produto → compras → quantidade → preço → data →
 * frequência → reposição. Só dados lançados. Wellmix vê todos os clientes e o
 * FOB; o cliente vê só o próprio histórico, sem custo.
 */
export default async function HistoryPage({
  searchParams,
}: PageProps<"/app/history">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const wellmix = isWellmix(user);
  requireScreen(user, "history");
  // "Comprar de novo" leva ao cartão de recompra do pedido: só com Pedidos e
  // Solicitações no perfil (sem eles o cartão não existe e o botão não leva a nada).
  const canBuyAgain = canOpen(user, "orders") && canOpen(user, "requests");
  const sp = await searchParams;
  const { customerId: customerParam, error } = sp;
  const one = (v: string | string[] | undefined) =>
    typeof v === "string" ? v : undefined;
  const customerId =
    wellmix && typeof customerParam === "string" && customerParam
      ? customerParam
      : undefined;
  const t = await getT();
  const showCosts = canSeeInternalCosts(user);
  // Filtro de cliente pela busca (como no Marketing): antes, um seletor com
  // todos os clientes (26 mil em produção) em toda abertura da tela.
  const [rows, chosen] = await Promise.all([
    loadCommercialHistory(user, { customerId }),
    wellmix && customerId
      ? getStore().get("parties", customerId)
      : Promise.resolve(null),
  ]);
  const money = (v: number | null, c: string | null) =>
    v !== null ? formatMoney(v, c ?? "BRL", t) : "—";
  const interval = (r: HistoryRow) =>
    r.avgIntervalDays !== null
      ? t("history.days", { days: r.avgIntervalDays })
      : "—";
  const productCell = (r: HistoryRow) =>
    r.productId && wellmix ? (
      <TextLink href={`/app/products/${r.productId}`}>{r.product}</TextLink>
    ) : (
      r.product
    );
  // Lista longa: busca, ordem e página no servidor (auditoria de performance,
  // 14/11/2026: com o histórico do Sankhya a tela tinha 266 MB de HTML, a
  // tabela e os cartões do celular com todas as linhas). Curta: como antes.
  const interestText = (v: string | null) =>
    v === "yes" || v === "maybe" || v === "no"
      ? t(`orders.afterSales.repurchase.${v}`)
      : "—";
  const columns: ServerColumn<HistoryRow>[] = [
    ...(wellmix
      ? [{ key: "customer", text: (r: HistoryRow) => r.customer }]
      : []),
    { key: "product", text: (r) => r.product },
    { key: "purchases", text: (r) => String(r.purchases) },
    { key: "total", text: (r) => `${r.totalQuantity} ${r.unit}` },
    { key: "last", text: (r) => `${r.lastQuantity} ${r.unit}` },
    { key: "sell", text: (r) => money(r.lastSellUnit, r.sellCurrency) },
    ...(showCosts
      ? [
          {
            key: "fob",
            text: (r: HistoryRow) =>
              money(r.lastFobUnit, r.fobCurrency ?? "USD"),
          },
        ]
      : []),
    {
      key: "period",
      text: (r) => `${formatDate(r.firstAt, t)} ${formatDate(r.lastAt, t)}`,
    },
    { key: "interval", text: interval },
    { key: "replenishments", text: (r) => String(r.replenishments) },
    { key: "repurchase", text: (r) => interestText(r.repurchaseInterest) },
    {
      key: "order",
      text: (r) => t("orders.number", { number: r.lastOrderNumber }),
    },
  ];
  const serverMode = rows.length > SERVER_TABLE_FROM;
  const sort = serverMode ? parseServerSort(one(sp.sort), columns) : null;
  const shown = serverTable(rows, columns, {
    sort,
    page: parseServerPage(one(sp.page)),
    size: serverMode ? undefined : Math.max(rows.length, 1),
    decimalComma: t.locale === "pt",
  });
  const listHref = (patch: { sort?: string | null; page?: number }) => {
    const params = new URLSearchParams();
    if (customerId) params.set("customerId", customerId);
    const sortValue =
      patch.sort !== undefined
        ? patch.sort
        : sort
          ? `${sort.desc ? "-" : ""}${sort.key}`
          : null;
    if (sortValue) params.set("sort", sortValue);
    if (patch.page) params.set("page", String(patch.page + 1));
    const query = params.toString();
    return query ? `/app/history?${query}` : "/app/history";
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
        help={{ body: "help.history.body", steps: "help.history.steps" }}
        t={t}
        title={t("history.title")}
        subtitle={t("history.subtitle")}
      />
      {error ? (
        <Alert tone="danger">{fallbackError(t, String(error))}</Alert>
      ) : null}
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        {wellmix ? (
          <form
            method="get"
            action="/app/history"
            className="flex flex-wrap items-end gap-2"
          >
            <label className="block w-full space-y-1 sm:w-auto">
              <span className="block text-xs font-medium leading-5 text-zinc-700">
                {t("common.customer")}
              </span>
              <PartyPicker
                name="customerId"
                type="customer"
                initial={chosen ? { id: chosen.id, name: chosen.name } : null}
                ariaLabel={t("common.customer")}
                className="w-full sm:w-64"
                labels={{
                  ...partyPickerLabels(t),
                  placeholder: t("history.allCustomers"),
                }}
              />
            </label>
            <SubmitButton type="submit" variant="secondary">
              {t("history.filter")}
            </SubmitButton>
          </form>
        ) : (
          <span />
        )}
        <span className="text-xs text-zinc-500">
          {t("history.rows", { count: rows.length })}
        </span>
      </div>
      {rows.length === 0 ? (
        <Empty>{t("history.none")}</Empty>
      ) : (
        <>
          {/* Tabela (tablet e mesa) */}
          <div className="hidden md:block">
            <Table tools={!serverMode}>
              <thead>
                <tr>
                  {wellmix ? header(t("common.customer"), "customer") : null}
                  {header(t("common.product"), "product")}
                  {header(t("history.purchases"), "purchases", "text-right")}
                  {header(t("history.totalQuantity"), "total", "text-right")}
                  {header(t("history.lastQuantity"), "last", "text-right")}
                  {header(t("history.lastSellUnit"), "sell", "text-right")}
                  {showCosts
                    ? header(t("history.lastFobUnit"), "fob", "text-right")
                    : null}
                  {header(t("history.period"), "period")}
                  {header(t("history.avgInterval"), "interval", "text-right")}
                  {header(
                    t("history.replenishments"),
                    "replenishments",
                    "text-right",
                  )}
                  {header(t("history.repurchase"), "repurchase")}
                  {header(t("history.lastOrder"), "order")}
                  <Th />
                </tr>
              </thead>
              <tbody>
                {shown.rows.map((r) => (
                  <tr
                    key={`${r.customerId}|${r.productId ?? r.product}`}
                    className={rowClass}
                  >
                    {wellmix ? (
                      <Td className="font-medium">{r.customer}</Td>
                    ) : null}
                    <Td className="font-medium">{productCell(r)}</Td>
                    <Td className="text-right tabular-nums">{r.purchases}</Td>
                    <Td className="text-right tabular-nums whitespace-nowrap">
                      {r.totalQuantity} {r.unit}
                    </Td>
                    <Td className="text-right tabular-nums whitespace-nowrap">
                      {r.lastQuantity} {r.unit}
                    </Td>
                    <Td className="text-right tabular-nums whitespace-nowrap">
                      {money(r.lastSellUnit, r.sellCurrency)}
                    </Td>
                    {showCosts ? (
                      <Td className="text-right tabular-nums whitespace-nowrap">
                        {money(r.lastFobUnit, r.fobCurrency ?? "USD")}
                      </Td>
                    ) : null}
                    <Td className="whitespace-nowrap text-xs">
                      <div>{formatDate(r.firstAt, t)}</div>
                      <div>{formatDate(r.lastAt, t)}</div>
                    </Td>
                    <Td className="text-right tabular-nums whitespace-nowrap">
                      {interval(r)}
                    </Td>
                    <Td className="text-right tabular-nums">
                      {r.replenishments}
                    </Td>
                    <Td>
                      <Interest value={r.repurchaseInterest} t={t} />
                    </Td>
                    <Td>
                      <TextLink
                        href={`/app/orders/${r.lastOrderId}`}
                        className="whitespace-nowrap"
                      >
                        {t("orders.number", { number: r.lastOrderNumber })}
                      </TextLink>
                      {canBuyAgain ? (
                        <div className="mt-1.5">
                          <RowActions row={r} t={t} />
                        </div>
                      ) : null}
                    </Td>
                    <Td className="whitespace-nowrap text-right">
                      <ChatOpenButton
                        target={{ orderId: r.lastOrderId }}
                        label={t("chat.open")}
                      />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>

          {/* Cards (celular) */}
          <ul className="grid gap-3 sm:grid-cols-2 md:hidden">
            {shown.rows.map((r) => (
              <li
                key={`${r.customerId}|${r.productId ?? r.product}`}
                className="min-w-0 rounded-2xl border border-zinc-200/80 bg-white p-3.5 shadow-sm shadow-zinc-900/[0.03]"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-zinc-900">
                      {productCell(r)}
                    </p>
                    {wellmix ? (
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {r.customer}
                      </p>
                    ) : null}
                  </div>
                  <span className="inline-flex items-center gap-1">
                    <TextLink
                      href={`/app/orders/${r.lastOrderId}`}
                      className="whitespace-nowrap text-sm"
                    >
                      {t("orders.number", { number: r.lastOrderNumber })}
                    </TextLink>
                    <ChatOpenButton
                      target={{ orderId: r.lastOrderId }}
                      label={t("chat.open")}
                    />
                  </span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <Item label={t("history.purchases")}>
                    {r.purchases} · {r.totalQuantity} {r.unit}
                  </Item>
                  <Item label={t("history.lastQuantity")}>
                    {r.lastQuantity} {r.unit}
                  </Item>
                  <Item label={t("history.lastSellUnit")}>
                    {money(r.lastSellUnit, r.sellCurrency)}
                  </Item>
                  {showCosts ? (
                    <Item label={t("history.lastFobUnit")}>
                      {money(r.lastFobUnit, r.fobCurrency ?? "USD")}
                    </Item>
                  ) : null}
                  <Item label={t("history.period")}>
                    {formatDate(r.firstAt, t)} → {formatDate(r.lastAt, t)}
                  </Item>
                  <Item label={t("history.avgInterval")}>{interval(r)}</Item>
                  <Item label={t("history.replenishments")}>
                    {r.replenishments}
                  </Item>
                  <Item label={t("history.repurchase")}>
                    <Interest value={r.repurchaseInterest} t={t} />
                  </Item>
                </dl>
                {canBuyAgain ? (
                  <div className="mt-3">
                    <RowActions row={r} t={t} />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
          {serverMode ? (
            <ServerPager
              page={shown}
              href={(page) => listHref({ page })}
              t={t}
            />
          ) : null}
        </>
      )}
    </>
  );
}
