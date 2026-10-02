import type { ReactNode } from "react";
import { fallbackError } from "@/i18n/error-text";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
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
  Select,
  Table,
  Td,
  TextLink,
  Th,
  formatDate,
  formatMoney,
  rowClass,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

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
  if (!(wellmix || user.role === "customer")) redirect("/app");
  const { customerId: customerParam, error } = await searchParams;
  const customerId =
    wellmix && typeof customerParam === "string" && customerParam
      ? customerParam
      : undefined;
  const t = await getT();
  const showCosts = canSeeInternalCosts(user);
  const [rows, customers] = await Promise.all([
    loadCommercialHistory(user, { customerId }),
    wellmix
      ? getStore().list("parties", {
          filter: { type: "customer" },
          orderBy: "name",
        })
      : Promise.resolve([]),
  ]);
  const money = (v: number | null, c: string | null) =>
    v !== null ? formatMoney(v, c ?? "BRL") : "—";
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
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        {wellmix ? (
          <form
            method="get"
            action="/app/history"
            className="flex flex-wrap items-end gap-2"
          >
            <label className="block w-full space-y-1 sm:w-auto">
              <span className="text-sm font-medium text-zinc-800">
                {t("common.customer")}
              </span>
              <Select
                name="customerId"
                defaultValue={customerId ?? ""}
                className="w-full sm:w-64"
              >
                <option value="">{t("history.allCustomers")}</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
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
            <Table>
              <thead>
                <tr>
                  {wellmix ? <Th>{t("common.customer")}</Th> : null}
                  <Th>{t("common.product")}</Th>
                  <Th className="text-right">{t("history.purchases")}</Th>
                  <Th className="text-right">{t("history.totalQuantity")}</Th>
                  <Th className="text-right">{t("history.lastQuantity")}</Th>
                  <Th className="text-right">{t("history.lastSellUnit")}</Th>
                  {showCosts ? (
                    <Th className="text-right">{t("history.lastFobUnit")}</Th>
                  ) : null}
                  <Th>{t("history.period")}</Th>
                  <Th className="text-right">{t("history.avgInterval")}</Th>
                  <Th className="text-right">{t("history.replenishments")}</Th>
                  <Th>{t("history.repurchase")}</Th>
                  <Th>{t("history.lastOrder")}</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
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
                      <div>{formatDate(r.firstAt)}</div>
                      <div>{formatDate(r.lastAt)}</div>
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
                      <div className="mt-1.5">
                        <RowActions row={r} t={t} />
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>

          {/* Cards (celular) */}
          <ul className="space-y-3 md:hidden">
            {rows.map((r) => (
              <li
                key={`${r.customerId}|${r.productId ?? r.product}`}
                className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm shadow-zinc-900/[0.03]"
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
                  <TextLink
                    href={`/app/orders/${r.lastOrderId}`}
                    className="whitespace-nowrap text-sm"
                  >
                    {t("orders.number", { number: r.lastOrderNumber })}
                  </TextLink>
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
                    {formatDate(r.firstAt)} → {formatDate(r.lastAt)}
                  </Item>
                  <Item label={t("history.avgInterval")}>{interval(r)}</Item>
                  <Item label={t("history.replenishments")}>
                    {r.replenishments}
                  </Item>
                  <Item label={t("history.repurchase")}>
                    <Interest value={r.repurchaseInterest} t={t} />
                  </Item>
                </dl>
                <div className="mt-3">
                  <RowActions row={r} t={t} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
