import { redirect } from "next/navigation";
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
  Stat,
  Table,
  Td,
  TextLink,
  Textarea,
  Th,
  rowClass,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import {
  TRADE_ACTIVITY_STATUSES,
  type TradeActivityStatus,
} from "@/lib/db/schema";
import { loadPortfolio } from "@/lib/services/portfolio";
import {
  customerOption,
  loadTradePlan,
  type TradePlanFilters,
} from "@/lib/services/trade-plan";
import { createTradeActivityAction } from "../../actions/trade-plan";
import {
  brasiliaLocal,
  currentTime,
  dateBr,
  portfolioError,
} from "../_components/shared";
import { TradeStatus } from "./_components/activity-list";

/*
 * Plano de ação Trade (dono, 18/11/2026; docs/TRADE_COMERCIAL.md, PR 2; a tela
 * 12 do painel do Projeto Campineira): as ações com responsável, prazo e
 * situação, do cliente ou do grupo econômico. Quem gere a carteira cria as
 * ações; em aberto, cada uma é pendência do responsável e conta no Painel de
 * SLA. Quem não gere vê as próprias e as da equipe abaixo.
 */

const one = (v: string | string[] | undefined, max = 120) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

const STATUS_FILTERS = ["open", "late", ...TRADE_ACTIVITY_STATUSES] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];
const isStatusFilter = (v: string): v is StatusFilter =>
  (STATUS_FILTERS as readonly string[]).includes(v);

function planHref(params: Record<string, string>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  const qs = sp.toString();
  return qs ? `/app/portfolio/plan?${qs}` : "/app/portfolio/plan";
}

/** Prazo padrão da ação nova: daqui a 7 dias. */
const inAWeek = (now: Date) =>
  brasiliaLocal(new Date(now.getTime() + 7 * 86_400_000)).slice(0, 10);

export default async function TradePlanPage({
  searchParams,
}: PageProps<"/app/portfolio/plan">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "portfolio");
  const t = await getT();
  const sp = await searchParams;
  const rawStatus = one(sp.status);
  const status = isStatusFilter(rawStatus) ? rawStatus : undefined;
  const owner = one(sp.owner, 64);
  const group = one(sp.group, 64);
  const q = one(sp.q);
  const filters: TradePlanFilters = {
    status: status as TradePlanFilters["status"],
    responsibleId: owner || undefined,
    groupId: group || undefined,
    q: q || undefined,
  };
  const now = currentTime();
  const view = await loadTradePlan(user, filters, now);
  const errorText = portfolioError(t, sp.error);
  const base = { owner, group, q };
  const exportHref = `/app/portfolio/plan/export?${new URLSearchParams(
    Object.entries({ status: status ?? "", ...base }).filter(([, v]) => v),
  ).toString()}`;

  // Nova ação: os clientes da carteira e o que veio pelo endereço (ficha do
  // cliente ou diagnóstico do painel).
  const prefill = {
    customer: one(sp.customer, 64),
    group: one(sp.newGroup, 64),
    title: one(sp.title, 200),
    description: one(sp.description, 4000),
    product: /^\d{1,20}$/.test(one(sp.product, 20)) ? one(sp.product, 20) : "",
    productName: one(sp.productName, 300),
    focus: /^[a-z]{1,20}$/.test(one(sp.focus, 20)) ? one(sp.focus, 20) : "",
  };
  const portfolio = view.canManage ? await loadPortfolio(user, {}, now) : null;
  const customers = portfolio
    ? portfolio.rows.map((r) => ({
        id: r.customerId,
        name: r.name,
        code: r.code,
        ownerId: r.ownerId,
      }))
    : [];
  if (
    view.canManage &&
    prefill.customer &&
    !customers.some((c) => c.id === prefill.customer)
  ) {
    const extra = await customerOption(user, prefill.customer);
    if (extra) customers.unshift({ ...extra, ownerId: null });
  }
  const defaultOwner =
    customers.find((c) => c.id === prefill.customer)?.ownerId ??
    (view.team.some((u) => u.id === user.id) ? user.id : "");
  const openNew = !!sp.new || !!prefill.customer || !!prefill.group;

  const stats: Array<{
    key: Exclude<StatusFilter, "open" | "cancelled">;
    tone: "neutral" | "danger" | "warning";
  }> = [
    { key: "pending", tone: "warning" },
    { key: "investigating", tone: "neutral" },
    { key: "pilot", tone: "neutral" },
    { key: "late", tone: "danger" },
    { key: "done", tone: "neutral" },
  ];

  return (
    <>
      <PageHeader
        title={t("tradePlan.title")}
        subtitle={t("tradePlan.subtitle")}
        actions={
          <>
            <LinkButton href={exportHref} data-trade-export>
              {t("tradePlan.export")}
            </LinkButton>
            <TextLink href="/app/portfolio">
              {t("portfolio.customer.back")}
            </TextLink>
          </>
        }
      />
      {errorText ? (
        <div className="mb-3">
          <Alert tone="danger">{errorText}</Alert>
        </div>
      ) : null}

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {stats.map((s) => (
          <Stat
            key={s.key}
            compact
            label={t(`tradePlan.status.${s.key}` as DictionaryKey)}
            value={<span data-trade-count={s.key}>{view.counts[s.key]}</span>}
            tone={view.counts[s.key] ? s.tone : "neutral"}
            active={status === s.key}
            href={planHref({ ...base, status: status === s.key ? "" : s.key })}
          />
        ))}
      </div>

      <form
        action="/app/portfolio/plan"
        className="mb-3 grid gap-2 sm:grid-cols-[repeat(4,minmax(0,1fr))_auto] sm:items-end"
        data-trade-filters
      >
        <Field label={t("tradePlan.filter.status")}>
          <Select name="status" defaultValue={status ?? ""}>
            <option value="">{t("tradePlan.filter.all")}</option>
            <option value="open">{t("tradePlan.filter.open")}</option>
            <option value="late">{t("tradePlan.status.late")}</option>
            {TRADE_ACTIVITY_STATUSES.map((s: TradeActivityStatus) => (
              <option key={s} value={s}>
                {t(`tradePlan.status.${s}` as DictionaryKey)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("tradePlan.filter.responsible")}>
          <Select name="owner" defaultValue={owner}>
            <option value="">{t("tradePlan.filter.anyone")}</option>
            {view.team.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("tradePlan.filter.group")}>
          <Select name="group" defaultValue={group}>
            <option value="">{t("portfolio.filter.all")}</option>
            {view.groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("tradePlan.filter.search")}>
          <Input name="q" defaultValue={q} />
        </Field>
        <Button type="submit" variant="secondary">
          {t("tradePlan.filter.apply")}
        </Button>
      </form>

      {view.rows.length ? (
        <Table>
          <thead>
            <tr>
              <Th>{t("tradePlan.col.title")}</Th>
              <Th>{t("tradePlan.col.scope")}</Th>
              <Th>{t("tradePlan.col.responsible")}</Th>
              <Th>{t("tradePlan.col.due")}</Th>
              <Th>{t("tradePlan.col.status")}</Th>
            </tr>
          </thead>
          <tbody>
            {view.rows.map((r) => (
              <tr key={r.id} className={rowClass} data-trade-row={r.id}>
                <Td>
                  <TextLink href={`/app/portfolio/plan/${r.id}`}>
                    {r.title}
                  </TextLink>
                  {r.productName ? (
                    <span className="block text-xs text-zinc-500">
                      {[r.productCode, r.productName]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  ) : null}
                </Td>
                <Td>{r.scopeName}</Td>
                <Td>{r.responsibleName ?? "—"}</Td>
                <Td>{dateBr(t, r.dueDate)}</Td>
                <Td>
                  <TradeStatus t={t} row={r} />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <Empty>
          {status || owner || group || q
            ? t("tradePlan.emptyFilter")
            : t("tradePlan.empty")}
        </Empty>
      )}

      {view.canManage ? (
        <Card className="mt-5" dense title={t("tradePlan.new.title")}>
          <details open={openNew} id="new">
            <summary className="mb-2 cursor-pointer text-sm font-semibold text-brand-700">
              {t("tradePlan.new.open")}
            </summary>
            <form
              action={createTradeActivityAction}
              className="grid gap-3"
              data-trade-new
            >
              <input
                type="hidden"
                name="back"
                value="/app/portfolio/plan#new"
              />
              <input type="hidden" name="productCode" value={prefill.product} />
              <input
                type="hidden"
                name="productName"
                value={prefill.productName}
              />
              <input type="hidden" name="focus" value={prefill.focus} />
              <Field label={t("tradePlan.field.title")}>
                <Input
                  name="title"
                  required
                  minLength={3}
                  maxLength={200}
                  defaultValue={prefill.title}
                />
              </Field>
              {prefill.productName ? (
                <p className="text-xs text-zinc-600">
                  {t("tradePlan.detail.product", {
                    product: [prefill.product, prefill.productName]
                      .filter(Boolean)
                      .join(" · "),
                  })}
                </p>
              ) : null}
              <Field label={t("tradePlan.field.description")}>
                <Textarea
                  name="description"
                  maxLength={4000}
                  defaultValue={prefill.description}
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label={t("tradePlan.field.group")}
                  hint={t("tradePlan.field.scopeHint")}
                >
                  <Select
                    name="groupId"
                    defaultValue={prefill.customer ? "" : prefill.group}
                  >
                    <option value="">{t("tradePlan.field.none")}</option>
                    {view.groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={t("tradePlan.field.customer")}>
                  <Select name="customerId" defaultValue={prefill.customer}>
                    <option value="">{t("tradePlan.field.none")}</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code ? `${c.name} (${c.code})` : c.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={t("tradePlan.field.responsible")}>
                  <Select
                    name="responsibleUserId"
                    defaultValue={defaultOwner}
                    required
                  >
                    <option value="" disabled>
                      {t("tradePlan.field.none")}
                    </option>
                    {view.team.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={t("tradePlan.field.due")}>
                  <Input
                    type="date"
                    name="dueDate"
                    required
                    min={brasiliaLocal(now).slice(0, 10)}
                    defaultValue={inAWeek(now)}
                  />
                </Field>
              </div>
              <div>
                <SubmitButton data-trade-create>
                  {t("tradePlan.create")}
                </SubmitButton>
              </div>
            </form>
          </details>
        </Card>
      ) : null}
    </>
  );
}
