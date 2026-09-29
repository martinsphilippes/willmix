import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { assertWellmix } from "@/lib/auth/permissions";
import {
  getStore,
  AFTER_SALES_STATUSES,
  type AfterSales,
  type AfterSalesStatus,
} from "@/lib/db";
import { listAfterSales } from "@/lib/services/after-sales";
import { getT } from "@/i18n/server";
import type { Translate } from "@/i18n";
import {
  Alert,
  Badge,
  Empty,
  PageHeader,
  TextLink,
  cx,
  formatDate,
} from "@/components/ui";

/** Chip de filtro: selecionado na cor da marca, demais neutros (mesmo padrão de Revisão/Sourcing). */
const chipClass = (selected: boolean) =>
  cx(
    "rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-inset transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
    selected
      ? "bg-brand-600 text-white ring-brand-600"
      : "bg-white text-zinc-700 ring-zinc-200 hover:bg-brand-50 hover:text-brand-800 hover:ring-brand-200",
  );

const statusTone = (s: AfterSalesStatus) =>
  s === "open" ? "warning" : s === "answered" ? "info" : "success";

/** Nota como estrelas com o número ao lado (acessível). */
function Stars({ rating, t }: { rating: number | null; t: Translate }) {
  if (rating === null)
    return <span className="text-zinc-500">{t("afterSales.notRated")}</span>;
  const filled = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap"
      aria-label={`${rating}/5`}
      title={`${rating}/5`}
    >
      <span className="text-amber-500" aria-hidden>
        {"★".repeat(filled)}
        <span className="text-zinc-300">{"★".repeat(5 - filled)}</span>
      </span>
      <span className="text-xs font-semibold tabular-nums text-zinc-700">
        {rating}/5
      </span>
    </span>
  );
}

const summary = (text: string | null, max = 140) =>
  text && text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;

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

/** Pós-venda (Wellmix): registros por situação, nota, problemas e interesse em recompra. */
export default async function AfterSalesPage({
  searchParams,
}: PageProps<"/app/after-sales">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  assertWellmix(user);
  const { status: statusParam, error } = await searchParams;
  const status: AfterSalesStatus =
    typeof statusParam === "string" &&
    (AFTER_SALES_STATUSES as readonly string[]).includes(statusParam)
      ? (statusParam as AfterSalesStatus)
      : "open";
  const t = await getT();
  const store = getStore();
  const [all, orders, parties] = await Promise.all([
    listAfterSales(),
    store.list("orders"),
    store.list("parties", { filter: { type: "customer" } }),
  ]);
  const rows = all.filter((a) => a.status === status);
  const counts = Object.fromEntries(
    AFTER_SALES_STATUSES.map((s) => [
      s,
      all.filter((a) => a.status === s).length,
    ]),
  ) as Record<AfterSalesStatus, number>;
  const orderOf = (a: AfterSales) => orders.find((o) => o.id === a.orderId);
  const customerName = (id: string) =>
    parties.find((p) => p.id === id)?.name ?? "—";
  const interest = (v: AfterSales["repurchaseInterest"]) =>
    v ? t(`orders.afterSales.repurchase.${v}`) : "—";

  return (
    <>
      <PageHeader
        help={{ body: "help.afterSales.body", steps: "help.afterSales.steps" }}
        t={t}
        title={t("afterSales.title")}
        subtitle={t("afterSales.subtitle")}
      />
      {error ? (
        <Alert tone="danger">
          {t("common.error")} ({error})
        </Alert>
      ) : null}
      <nav
        aria-label={t("common.status")}
        className="mb-4 flex flex-wrap items-center gap-2"
      >
        {AFTER_SALES_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/app/after-sales?status=${s}`}
            aria-current={s === status ? "page" : undefined}
            className={chipClass(s === status)}
          >
            {t(`afterSales.filter.${s}`)}
            <span
              className={cx(
                "ml-1.5 rounded-full px-1.5 text-xs tabular-nums",
                s === status
                  ? "bg-white/20 text-white"
                  : "bg-zinc-100 text-zinc-600",
              )}
            >
              {counts[s]}
            </span>
          </Link>
        ))}
        <span className="ml-auto text-xs text-zinc-500">
          {t("afterSales.count", { count: rows.length })}
        </span>
      </nav>
      {rows.length === 0 ? (
        <Empty>{t("afterSales.none")}</Empty>
      ) : (
        <ul className="space-y-3">
          {rows.map((a) => {
            const order = orderOf(a);
            const orderHref = order
              ? `/app/orders/${order.id}#after-sales`
              : null;
            return (
              <li
                key={a.id}
                className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm shadow-zinc-900/[0.03] sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={statusTone(a.status)}>
                        {t(`orders.afterSales.status.${a.status}`)}
                      </Badge>
                      {order && orderHref ? (
                        <TextLink href={orderHref} className="text-sm">
                          {t("orders.number", { number: order.number })}
                        </TextLink>
                      ) : (
                        <span className="text-sm font-semibold text-zinc-900">
                          {t("reviews.entity.order")} —
                        </span>
                      )}
                      <span className="text-sm font-semibold text-zinc-900">
                        {customerName(a.customerId)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-zinc-500">
                      {t("afterSales.openedAt")} {formatDate(a.createdAt)}
                      {a.answeredAt
                        ? ` · ${t("orders.afterSales.answeredAt")} ${formatDate(a.answeredAt)}`
                        : ""}
                      {a.closedAt
                        ? ` · ${t("orders.afterSales.closedAt")} ${formatDate(a.closedAt)}`
                        : ""}
                    </p>
                  </div>
                  {orderHref ? (
                    <TextLink
                      href={orderHref}
                      className="whitespace-nowrap text-sm"
                    >
                      {t("afterSales.openOrder")} →
                    </TextLink>
                  ) : null}
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm lg:grid-cols-4">
                  <Item label={t("afterSales.rating")}>
                    <Stars rating={a.rating} t={t} />
                  </Item>
                  <Item label={t("afterSales.repurchase")}>
                    {a.repurchaseInterest ? (
                      <Badge
                        tone={
                          a.repurchaseInterest === "yes"
                            ? "success"
                            : a.repurchaseInterest === "maybe"
                              ? "warning"
                              : "neutral"
                        }
                      >
                        {interest(a.repurchaseInterest)}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </Item>
                  <div className="col-span-2 min-w-0">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      {t("afterSales.problems")}
                    </dt>
                    <dd className="mt-0.5 text-zinc-900">
                      {a.status === "open" ? (
                        "—"
                      ) : a.problems ? (
                        <span title={a.problems}>{summary(a.problems)}</span>
                      ) : (
                        <span className="text-emerald-700">
                          {t("afterSales.noProblems")}
                        </span>
                      )}
                    </dd>
                  </div>
                  {a.status === "closed" && a.notes ? (
                    <div className="col-span-2 min-w-0 lg:col-span-4">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        {t("orders.afterSales.notes")}
                      </dt>
                      <dd className="mt-0.5 text-zinc-900">
                        {summary(a.notes)}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
