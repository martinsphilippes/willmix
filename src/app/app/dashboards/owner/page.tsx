import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { canOpen } from "@/lib/auth/screens";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { loadOwnerPanel } from "@/lib/services/owner-panel";
import {
  Card,
  Empty,
  LinkButton,
  PageHeader,
  TextLink,
  cx,
  formatMoney,
} from "@/components/ui";

/** Cartão de número com uma linha de apoio; o cartão inteiro leva à tela onde se age. */
function Kpi({
  label,
  value,
  sub,
  href,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  href: string;
  tone?: "neutral" | "good" | "bad" | "warn";
}) {
  return (
    <Link
      href={href}
      className={cx(
        "flex flex-col rounded-2xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
        tone === "bad"
          ? "border-rose-200"
          : tone === "warn"
            ? "border-amber-200"
            : "border-zinc-200/80",
      )}
      data-owner-kpi
    >
      <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </span>
      <span className="mt-1 text-xl font-bold tabular-nums text-zinc-900">
        {value}
      </span>
      {sub ? (
        <span
          className={cx(
            "mt-1 text-xs",
            tone === "good"
              ? "text-emerald-700"
              : tone === "bad"
                ? "text-rose-700"
                : tone === "warn"
                  ? "text-amber-700"
                  : "text-zinc-500",
          )}
        >
          {sub}
        </span>
      ) : null}
    </Link>
  );
}

/**
 * Painel do dono: os números do negócio numa tela só. Só quem abre Finanças
 * (administrador); leitura no servidor, nada é gravado.
 */
export default async function OwnerPanelPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "dashboards");
  if (!canOpen(user, "finance")) redirect("/app/dashboards");
  const t = await getT();
  const d = await loadOwnerPanel();
  const money = (v: number | null, c: string) =>
    v === null ? t("owner.none") : formatMoney(v, c, t);
  const multi = (m: Map<string, number> | Record<string, number>) => {
    const entries = (m instanceof Map ? [...m] : Object.entries(m)).filter(
      ([, v]) => Math.abs(v) > 0.004,
    );
    return entries.length
      ? entries.map(([c, v]) => formatMoney(v, c, t)).join(" + ")
      : formatMoney(0, d.currency, t);
  };
  const monthLabel = (m: string) => {
    const [y, mm] = m.split("-").map(Number);
    return new Date(Date.UTC(y, mm - 1, 15)).toLocaleDateString(t.intl, {
      month: "short",
      year: "2-digit",
      timeZone: "UTC",
    });
  };
  const maxSell = Math.max(1, ...d.chart.map((c) => c.sell));
  const change = d.sales.change;

  return (
    <div className="space-y-5">
      <PageHeader
        t={t}
        title={t("owner.title")}
        subtitle={
          <>
            {t("owner.subtitle")}{" "}
            <span className="font-medium text-zinc-800">
              {t("owner.month", { month: monthLabel(d.month) })}
            </span>
          </>
        }
        actions={
          <span className="flex flex-wrap gap-2">
            <LinkButton href="/app/dashboards/cashflow">
              {t("cash.link")}
            </LinkButton>
            <LinkButton href="/app/dashboards">{t("dash.title")}</LinkButton>
          </span>
        }
      />

      <section
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
        data-owner-money
      >
        <Kpi
          label={t("owner.sales")}
          value={money(d.sales.now, d.currency)}
          sub={
            <>
              {change === null
                ? t("owner.sales.noPrev")
                : t("owner.sales.vsPrev", {
                    pct: `${change > 0 ? "+" : ""}${change.toLocaleString(t.intl)}%`,
                  })}
              {" · "}
              {t("owner.sales.orders", { n: d.sales.orders })}
            </>
          }
          tone={change === null ? "neutral" : change >= 0 ? "good" : "bad"}
          href="/app/finance"
        />
        <Kpi
          label={t("owner.margin")}
          value={money(d.sales.margin, d.currency)}
          sub={
            d.sales.marginPct !== null
              ? `${d.sales.marginPct.toLocaleString(t.intl)}%`
              : t("owner.margin.none")
          }
          tone={
            d.sales.margin === null
              ? "neutral"
              : d.sales.margin >= 0
                ? "good"
                : "bad"
          }
          href="/app/finance"
        />
        <Kpi
          label={t("owner.receivedMonth")}
          value={multi(d.receivedMonth)}
          sub={`${t("owner.receivable")}: ${money(d.receivable, d.currency)}`}
          tone={d.receivable > 0 ? "warn" : "neutral"}
          href="/app/customers"
        />
        <Kpi
          label={t("owner.paidMonth")}
          value={multi(d.paidMonth)}
          sub={`${t("owner.payable")}: ${multi(d.payable)}`}
          href="/app/payables"
        />
      </section>

      <section
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5"
        data-owner-ops
      >
        <Kpi
          label={t("owner.stock")}
          value={multi(d.stock.value)}
          sub={
            d.stock.idle > 0
              ? `${t("owner.stock.below", { n: d.stock.below })} · ${t("owner.stock.idle", { n: d.stock.idle })}`
              : t("owner.stock.below", { n: d.stock.below })
          }
          tone={d.stock.below > 0 ? "bad" : "neutral"}
          href={
            d.stock.below > 0 ? "/app/inventory?situ=below" : "/app/inventory"
          }
        />
        <Kpi
          label={t("owner.losses")}
          value={d.stock.lastCount ? multi(d.stock.lossValue) : t("owner.none")}
          sub={
            d.stock.lastCount
              ? t("owner.losses.qty", {
                  n: d.stock.lastCount.number,
                  qty: d.stock.lossQty.toLocaleString(t.intl),
                })
              : t("owner.losses.none")
          }
          tone={d.stock.lossQty > 0 ? "bad" : "neutral"}
          href="/app/inventory/movements?kind=count_loss"
        />
        <Kpi
          label={t("owner.ops.requests")}
          value={d.ops.openRequests}
          href="/app/requests?situ=open"
        />
        <Kpi
          label={t("owner.ops.waiting")}
          value={d.ops.waitingDown}
          tone={d.ops.waitingDown > 0 ? "warn" : "neutral"}
          href="/app/requests?situ=waiting"
        />
        <Kpi
          label={t("owner.ops.orders")}
          value={d.ops.activeOrders}
          href="/app/orders"
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={t("owner.chart.title")}>
          <ul className="space-y-2" data-owner-chart>
            {d.chart.map((c) => (
              <li
                key={c.month}
                className="grid grid-cols-[5.5rem_minmax(0,1fr)_auto] items-center gap-3 text-sm"
              >
                <span className="text-zinc-600">{monthLabel(c.month)}</span>
                <span className="h-3 overflow-hidden rounded-full bg-zinc-100">
                  <span
                    className={cx(
                      "block h-full rounded-full",
                      c.month === d.month ? "bg-brand-600" : "bg-brand-300",
                    )}
                    style={{ width: `${(c.sell / maxSell) * 100}%` }}
                  />
                </span>
                <span className="whitespace-nowrap text-right tabular-nums">
                  {money(c.sell, d.currency)}
                  {c.margin !== null ? (
                    <span className="block text-xs text-zinc-500">
                      {t("owner.chart.margin", {
                        v: money(c.margin, d.currency),
                      })}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title={t("owner.stages.title")}>
          {d.ops.byStage.size === 0 ? (
            <Empty>{t("owner.stages.empty")}</Empty>
          ) : (
            <ul className="divide-y divide-zinc-100 text-sm" data-owner-stages>
              {[...d.ops.byStage]
                .sort((a, b) => b[1] - a[1])
                .map(([stage, n]) => (
                  <li
                    key={stage}
                    className="flex items-center justify-between py-1.5"
                  >
                    <span>{t(`stage.${stage}` as DictionaryKey)}</span>
                    <span className="font-semibold tabular-nums">{n}</span>
                  </li>
                ))}
            </ul>
          )}
        </Card>
        <Card title={t("owner.topCustomers")}>
          {d.topCustomers.length === 0 ? (
            <Empty>{t("owner.top.empty")}</Empty>
          ) : (
            <ol className="space-y-1.5 text-sm" data-owner-top-customers>
              {d.topCustomers.map((c, i) => (
                <li key={c.key} className="flex items-baseline gap-2">
                  <span className="w-5 text-zinc-400">{i + 1}.</span>
                  <TextLink
                    href={`/app/customers/${c.key}`}
                    className="min-w-0 flex-1 truncate"
                  >
                    {c.name}
                  </TextLink>
                  <span className="text-xs text-zinc-500">
                    {t("owner.top.orders", { n: c.count })}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {money(c.value, d.currency)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Card>
        <Card title={t("owner.topSuppliers")}>
          {d.topSuppliers.length === 0 ? (
            <Empty>{t("owner.top.empty")}</Empty>
          ) : (
            <ol className="space-y-1.5 text-sm" data-owner-top-suppliers>
              {d.topSuppliers.map((c, i) => (
                <li key={c.key} className="flex items-baseline gap-2">
                  <span className="w-5 text-zinc-400">{i + 1}.</span>
                  <TextLink
                    href={`/app/suppliers/${c.key}`}
                    className="min-w-0 flex-1 truncate"
                  >
                    {c.name}
                  </TextLink>
                  <span className="text-xs text-zinc-500">
                    {t("owner.top.orders", { n: c.count })}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {money(c.value, d.fobCurrency)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </div>
  );
}
