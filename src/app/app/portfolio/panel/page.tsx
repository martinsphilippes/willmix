import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  Alert,
  Button,
  Card,
  Empty,
  Field,
  Input,
  LinkButton,
  PageHeader,
  Select,
  TextLink,
  cx,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import {
  filterRows,
  productTotals,
  type PanelFilters,
} from "@/lib/sales-panel";
import {
  loadPanelData,
  panelChoices,
  parseScope,
  scopeParam,
  stockByProduct,
} from "@/lib/services/sales-panel";
import { tradeActivitiesFor } from "@/lib/services/trade-plan";
import { refreshPanelSalesAction } from "../../actions/sales-panel";
import {
  brasiliaLocal,
  currentTime,
  dateTimeBr,
  portfolioError,
} from "../_components/shared";
import { formatters } from "./_components/format";
import {
  AbcTab,
  CompareTab,
  CustomersTab,
  DiagnosisTab,
  ExecutiveTab,
  FrequencyTab,
  LifecycleTab,
  MixTab,
  PeriodTab,
  RankingTab,
  StockTab,
  type TabContext,
} from "./_components/tabs";

/*
 * Painel do cliente e do grupo (dono, 19/11/2026; docs/TRADE_COMERCIAL.md, PR
 * 4): as telas 01 a 11 do painel do Projeto Campineira sobre a base de vendas
 * do Sankhya (PR 3), por grupo econômico ou cliente; a 12 é o Plano de ação
 * Trade. Filtros de ano, trimestre, grupo de produto, cliente e busca; CSV de
 * cada tela; "Atualizar agora" para quem gere a carteira.
 */

export const maxDuration = 120;

const TABS = [
  "executive",
  "ranking",
  "abc",
  "frequency",
  "period",
  "compare",
  "mix",
  "stock",
  "lifecycle",
  "customers",
  "diagnosis",
] as const;
type Tab = (typeof TABS)[number];

const one = (v: string | string[] | undefined, max = 120) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

export default async function SalesPanelPage({
  searchParams,
}: PageProps<"/app/portfolio/panel">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "portfolio");
  const t = await getT();
  const sp = await searchParams;
  const scope = parseScope(one(sp.scope, 70));

  if (!scope) {
    const choices = await panelChoices(user);
    return (
      <>
        <PageHeader
          title={t("salesPanel.title")}
          subtitle={t("salesPanel.subtitle")}
        />
        {choices.groups.length || choices.customers.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card dense title={t("salesPanel.choose.groups")}>
              <ul className="divide-y divide-zinc-100" data-panel-choose-groups>
                {choices.groups.map((g) => (
                  <li key={g.id} className="py-2 text-sm">
                    <TextLink href={`/app/portfolio/panel?scope=g:${g.id}`}>
                      {g.name}
                    </TextLink>
                  </li>
                ))}
              </ul>
            </Card>
            <Card dense title={t("salesPanel.choose.customers")}>
              <ul className="divide-y divide-zinc-100">
                {choices.customers.map((c) => (
                  <li key={c.id} className="py-2 text-sm">
                    <TextLink href={`/app/portfolio/panel?scope=c:${c.id}`}>
                      {c.name}
                    </TextLink>
                    <span className="block text-xs text-zinc-500">
                      {[c.code, c.groupName].filter(Boolean).join(" · ")}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        ) : (
          <Empty>{t("salesPanel.choose.empty")}</Empty>
        )}
      </>
    );
  }

  const data = await loadPanelData(user, scope);
  if (!data) notFound();
  const rawTab = one(sp.tab, 20);
  const tab: Tab = (TABS as readonly string[]).includes(rawTab)
    ? (rawTab as Tab)
    : "executive";
  const year = data.years.includes(one(sp.year, 4)) ? one(sp.year, 4) : "";
  const quarterRaw = Number(one(sp.quarter, 1));
  const quarter = year && quarterRaw >= 1 && quarterRaw <= 4 ? quarterRaw : 0;
  const group = data.groups.includes(one(sp.group, 160))
    ? one(sp.group, 160)
    : "";
  const customer = data.customers.some((c) => c.id === one(sp.customer, 64))
    ? one(sp.customer, 64)
    : "";
  const q = one(sp.q);
  const filters: PanelFilters = {
    // O comparativo escolhe os dois anos dele.
    year: tab === "compare" ? undefined : year || undefined,
    quarter: tab === "compare" ? undefined : quarter || undefined,
    group: group || undefined,
    customerId: customer || undefined,
    q: q || undefined,
  };
  const customerName = new Map(data.customers.map((c) => [c.id, c.name]));
  const rows = filterRows(data.rows, data.products, filters, customerName);
  const totals = productTotals(rows, data.products);
  const now = currentTime();
  const today = brasiliaLocal(now).slice(0, 10);
  const params: Record<string, string> = {
    scope: scopeParam(scope),
    tab,
    year,
    quarter: quarter ? String(quarter) : "",
    group,
    customer,
    q,
    cls: one(sp.cls, 1),
    focus: one(sp.focus, 20),
    ya: one(sp.ya, 4),
    yb: one(sp.yb, 4),
  };
  const f = formatters(t);
  const stock =
    tab === "stock"
      ? await stockByProduct(totals.map((p) => p.productId ?? ""))
      : undefined;
  const plan =
    tab === "diagnosis"
      ? new Map(
          (
            await tradeActivitiesFor(
              user,
              scope.kind === "group"
                ? { groupId: scope.id }
                : { customerId: scope.id },
              now,
            )
          )
            .filter((a) => a.productCode && a.status !== "cancelled")
            .map((a) => [a.productCode!, { id: a.id, status: a.status }]),
        )
      : undefined;
  const ctx: TabContext = {
    t,
    f,
    data,
    rows,
    totals,
    customerName,
    today,
    params,
    stock,
    plan,
  };
  const href = (patch: Record<string, string>) =>
    `/app/portfolio/panel?${new URLSearchParams(
      Object.entries({ ...params, ...patch }).filter(([, v]) => v),
    ).toString()}`;
  const exportHref = `/app/portfolio/panel/export?${new URLSearchParams(
    Object.entries(params).filter(([, v]) => v),
  ).toString()}`;
  const lastLoad = data.customers
    .map((c) => c.load?.loadedAt)
    .filter(Boolean)
    .sort()[0];
  const errorText = portfolioError(t, sp.error);
  const refreshed = /^(\d+)-(\d+)$/.exec(one(sp.refreshed, 10));
  const planHref =
    scope.kind === "group"
      ? `/app/portfolio/plan?group=${scope.id}`
      : "/app/portfolio/plan";

  return (
    <>
      <PageHeader
        title={t("salesPanel.titleOf", { name: data.name })}
        subtitle={
          <span className="block">
            {t(
              scope.kind === "group"
                ? "salesPanel.scope.group"
                : "salesPanel.scope.customer",
            )}{" "}
            ·{" "}
            {data.customers.length === 1
              ? t("salesPanel.customersOne")
              : t("salesPanel.customersCount", { n: data.customers.length })}
            {" · "}
            <span data-panel-loaded={lastLoad ? "yes" : "no"}>
              {lastLoad
                ? t("salesPanel.loaded", { date: dateTimeBr(t, lastLoad) })
                : t("salesPanel.neverLoaded")}
            </span>
          </span>
        }
        actions={
          <>
            <LinkButton href={exportHref} data-panel-export>
              {t("salesPanel.export")}
            </LinkButton>
            <TextLink href="/app/portfolio/panel">
              {t("salesPanel.back")}
            </TextLink>
          </>
        }
      />
      {errorText ? (
        <div className="mb-3">
          <Alert tone="danger">
            {one(sp.error) === "sankhya_not_configured"
              ? t("salesPanel.notConfigured")
              : errorText}
          </Alert>
        </div>
      ) : null}
      {refreshed ? (
        <div className="mb-3" data-panel-refreshed>
          <Alert tone="success">
            {t("salesPanel.notice.refreshed", {
              ok: refreshed[1],
              total: refreshed[2],
            })}
          </Alert>
        </div>
      ) : null}
      {data.customers.some(
        (c) => c.load?.error || c.load?.complete === false,
      ) ? (
        <div
          className="mb-3 space-y-1 text-xs text-amber-800"
          data-panel-load-warnings
        >
          {data.customers.map((c) =>
            c.load?.error === "no_code" ? (
              <p key={c.id}>{t("salesPanel.noCode", { customer: c.name })}</p>
            ) : c.load?.error ? (
              <p key={c.id}>
                {t("salesPanel.loadError", {
                  customer: c.name,
                  message: c.load.error,
                })}
              </p>
            ) : c.load?.complete === false ? (
              <p key={c.id}>
                {t("salesPanel.incomplete", { customer: c.name })}
              </p>
            ) : null,
          )}
        </div>
      ) : null}
      {data.canManage ? (
        <form
          action={refreshPanelSalesAction}
          className="mb-3 flex flex-wrap items-center gap-2 text-xs text-zinc-600"
        >
          <input type="hidden" name="scope" value={scopeParam(scope)} />
          <input type="hidden" name="tab" value={tab} />
          <SubmitButton
            variant="secondary"
            className="px-2.5 py-1 text-xs"
            pendingText="…"
            data-panel-refresh
          >
            {t("salesPanel.refresh")}
          </SubmitButton>
          <span>{t("salesPanel.refreshHint")}</span>
        </form>
      ) : null}

      <nav className="mb-3 flex flex-wrap gap-1.5" data-panel-tabs>
        {TABS.map((k) => (
          <a
            key={k}
            href={href({ tab: k })}
            className={cx(
              "rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset",
              k === tab
                ? "bg-brand-600 text-white ring-brand-600"
                : "bg-white text-zinc-700 ring-zinc-200 hover:bg-zinc-50",
            )}
            data-panel-tab={k}
            aria-current={k === tab ? "page" : undefined}
          >
            {t(`salesPanel.tab.${k}` as DictionaryKey)}
          </a>
        ))}
        <a
          href={planHref}
          className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-zinc-700 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50"
        >
          {t("salesPanel.tab.plan")}
        </a>
      </nav>

      <form
        action="/app/portfolio/panel"
        className="mb-4 grid gap-2 sm:grid-cols-[repeat(5,minmax(0,1fr))_auto] sm:items-end"
        data-panel-filters
      >
        <input type="hidden" name="scope" value={scopeParam(scope)} />
        <input type="hidden" name="tab" value={tab} />
        <Field label={t("salesPanel.filter.year")}>
          <Select name="year" defaultValue={year} disabled={tab === "compare"}>
            <option value="">{t("salesPanel.filter.allYears")}</option>
            {data.years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("salesPanel.filter.quarter")}>
          <Select
            name="quarter"
            defaultValue={quarter ? String(quarter) : ""}
            disabled={tab === "compare"}
          >
            <option value="">{t("salesPanel.filter.allQuarters")}</option>
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {t(`salesPanel.filter.q${n}` as DictionaryKey)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("salesPanel.filter.group")}>
          <Select name="group" defaultValue={group}>
            <option value="">{t("salesPanel.filter.allGroups")}</option>
            {data.groups.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("salesPanel.filter.customer")}>
          <Select name="customer" defaultValue={customer}>
            <option value="">{t("salesPanel.filter.allCustomers")}</option>
            {data.customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("salesPanel.filter.search")}>
          <Input name="q" defaultValue={q} />
        </Field>
        <Button type="submit" variant="secondary">
          {t("salesPanel.filter.apply")}
        </Button>
      </form>

      {!data.rows.length ? (
        <Empty>
          {lastLoad ? t("salesPanel.empty") : t("salesPanel.neverLoaded")}
        </Empty>
      ) : tab === "executive" ? (
        <ExecutiveTab c={ctx} />
      ) : tab === "ranking" ? (
        <RankingTab c={ctx} />
      ) : tab === "abc" ? (
        <AbcTab c={ctx} />
      ) : tab === "frequency" ? (
        <FrequencyTab c={ctx} />
      ) : tab === "period" ? (
        <PeriodTab c={ctx} />
      ) : tab === "compare" ? (
        <CompareTab c={ctx} />
      ) : tab === "mix" ? (
        <MixTab c={ctx} />
      ) : tab === "stock" ? (
        <StockTab c={ctx} />
      ) : tab === "lifecycle" ? (
        <LifecycleTab c={ctx} />
      ) : tab === "customers" ? (
        <CustomersTab c={ctx} />
      ) : (
        <DiagnosisTab c={ctx} />
      )}
    </>
  );
}
