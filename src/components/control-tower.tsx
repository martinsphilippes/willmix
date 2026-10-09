import type { Translate } from "@/i18n";
import type { ReactNode } from "react";
import type { User } from "@/lib/db";
import { isWellmix } from "@/lib/auth/permissions";
import { getT } from "@/i18n/server";
import {
  loadControlTower,
  loadTowerTotals,
  type TowerTotals,
} from "@/lib/services/control-tower";
import {
  Badge,
  Card,
  cx,
  Empty,
  PageHeader,
  Progress,
  Stat,
  Table,
  Td,
  TextLink,
  Th,
  formatDate,
  formatMoney,
  rowClass,
  stageTone,
} from "./ui";

/** Valores por moeda ("USD 1.000,00 · CNY 500,00"); zero na moeda de venda quando não há nada. */
function moneyByCurrency(
  map: Record<string, number>,
  fallback: string,
  t: Translate,
) {
  return (
    Object.entries(map)
      .filter(([, v]) => v > 0.005)
      .map(([c, v]) => formatMoney(v, c, t))
      .join(" · ") || formatMoney(0, fallback, t)
  );
}

const hasValue = (map: Record<string, number>) =>
  Object.values(map).some((v) => v > 0.005);

/** Percentual com 1 casa (ex.: 42,5%). */
const percent = (v: number | null, intl: string) =>
  v === null
    ? "—"
    : `${new Intl.NumberFormat(intl, { maximumFractionDigits: 1 }).format(v)}%`;

/** Valor monetário no card: um pouco menor que o padrão do Stat para o número não quebrar no meio. */
function Money({ children }: { children: ReactNode }) {
  return (
    <span className="block text-lg leading-tight tabular-nums sm:text-xl">
      {children}
    </span>
  );
}

/**
 * Faixas "Financeiro" e "Operação" (docs/EVOLUTION_PLAN.md, itens 27 e 28):
 * reutilizam o financeiro e os containers; só o que foi lançado, nada estimado.
 */
async function TowerTotalsStrip({
  totals,
  t,
}: {
  totals: TowerTotals;
  t: Awaited<ReturnType<typeof getT>>;
}) {
  const pipelineLabel: Record<TowerTotals["pipeline"][number]["key"], string> =
    {
      production: t("ct.operation.production"),
      ready: t("ct.operation.ready"),
      shipped: t("ct.operation.shipped"),
      customs: t("ct.operation.customs"),
      transport: t("ct.operation.transport"),
      delivered: t("ct.operation.delivered"),
    };
  return (
    <>
      <section aria-label={t("ct.finance.title")} className="mb-5">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {t("ct.finance.title")}
          </h2>
          <p className="text-xs text-zinc-500">{t("ct.totals.hint")}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat
            label={t("finance.sold")}
            value={
              <Money>{formatMoney(totals.sold, totals.sellCurrency, t)}</Money>
            }
            href="/app/finance"
          />
          <Stat
            label={t("finance.received")}
            value={
              <Money>
                {formatMoney(totals.received, totals.sellCurrency, t)}
              </Money>
            }
            href="/app/finance"
          />
          <Stat
            label={t("finance.receivable")}
            value={
              <Money>
                {formatMoney(totals.receivable, totals.sellCurrency, t)}
              </Money>
            }
            href="/app/finance"
            tone={totals.receivable > 0 ? "warning" : undefined}
          />
          <Stat
            label={t("ct.finance.purchased")}
            value={
              <Money>
                {moneyByCurrency(totals.purchasedByCurrency, "USD", t)}
              </Money>
            }
            href="/app/finance"
          />
          <Stat
            label={t("ct.finance.paid")}
            value={
              <Money>{moneyByCurrency(totals.paidByCurrency, "USD", t)}</Money>
            }
            href="/app/finance"
          />
          <Stat
            label={t("ct.finance.payable")}
            value={
              <Money>
                {moneyByCurrency(totals.payableByCurrency, "USD", t)}
              </Money>
            }
            href="/app/finance"
            tone={hasValue(totals.payableByCurrency) ? "warning" : undefined}
          />
        </div>
      </section>

      <section aria-label={t("ct.operation.title")} className="mb-5">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {t("ct.operation.title")}
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {totals.pipeline.map((p) => (
            <Stat
              key={p.key}
              label={pipelineLabel[p.key]}
              value={
                <>
                  {t("ct.operation.orders", { count: p.count })}
                  <span className="block text-xs font-medium text-zinc-500">
                    {formatMoney(p.value, totals.sellCurrency, t)}
                  </span>
                </>
              }
            />
          ))}
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat
            label={t("ct.operation.reviewsOpen")}
            value={totals.reviewsOpen}
            href="/app/reviews"
            tone={totals.reviewsOpen > 0 ? "danger" : undefined}
          />
          <Stat
            label={t("ct.operation.containersOpen")}
            value={`${totals.containers.open} / ${totals.containers.total}`}
            href="/app/containers"
          />
          <Stat
            label={t("ct.operation.avgOccupancy")}
            value={percent(totals.containers.avgOccupancyPercent, t.intl)}
            href="/app/containers"
          />
        </div>
      </section>
    </>
  );
}

/** Visão comercial por container aberto: vendido × disponível em volume e valor vendido. */
function CommercialCard({
  totals,
  t,
}: {
  totals: TowerTotals;
  t: Awaited<ReturnType<typeof getT>>;
}) {
  return (
    <Card className="mt-6 min-w-0" title={t("ct.commercial.title")}>
      <p className="mb-3 text-xs text-zinc-500">{t("ct.commercial.hint")}</p>
      {totals.commercial.length === 0 ? (
        <Empty>{t("ct.commercial.none")}</Empty>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>{t("containers.code")}</Th>
              <Th>{t("common.customer")}</Th>
              <Th className="min-w-36">{t("containers.occupancy")}</Th>
              <Th className="text-right">{t("containers.soldPercent")}</Th>
              <Th className="text-right">{t("containers.availablePercent")}</Th>
              <Th className="text-right">{t("containers.soldValue")}</Th>
            </tr>
          </thead>
          <tbody>
            {totals.commercial.map((c) => (
              <tr key={c.id} className={rowClass}>
                <Td className="whitespace-nowrap">
                  <TextLink href={`/app/containers/${c.id}`}>{c.code}</TextLink>
                </Td>
                <Td>{c.customer ?? t("containers.noCustomer")}</Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <Progress percent={c.occupancyPercent} tone="danger" />
                    <span
                      className={cx(
                        "w-14 shrink-0 text-right text-xs font-semibold tabular-nums",
                        c.occupancyPercent > 100
                          ? "text-red-700"
                          : "text-zinc-700",
                      )}
                    >
                      {percent(c.occupancyPercent, t.intl)}
                    </span>
                  </div>
                </Td>
                <Td className="text-right font-medium tabular-nums text-emerald-700">
                  {percent(c.soldPercent, t.intl)}
                </Td>
                <Td className="text-right tabular-nums">
                  {percent(c.availablePercent, t.intl)}
                </Td>
                <Td className="whitespace-nowrap text-right tabular-nums">
                  {formatMoney(c.soldValue, c.soldCurrency, t)}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}

export async function ControlTower({
  user,
  filter,
}: {
  user: User;
  filter?: string;
}) {
  const t = await getT();
  const wellmix = isWellmix(user);
  const [data, totals] = await Promise.all([
    loadControlTower(),
    wellmix ? loadTowerTotals() : Promise.resolve(null),
  ]);
  const cards: Array<{
    key: keyof typeof data.buckets;
    label: string;
    tone?: "danger" | "warning";
  }> = [
    { key: "active", label: t("ct.active") },
    { key: "requestsOpen", label: t("ct.requestsOpen") },
    { key: "waitingSupplier", label: t("ct.waitingSupplier") },
    { key: "waitingCustomer", label: t("ct.waitingCustomer") },
    { key: "preparation", label: t("ct.preparation") },
    { key: "inspection", label: t("ct.inspection") },
    { key: "shipping", label: t("ct.shipping") },
    { key: "customs", label: t("ct.customs") },
    { key: "transport", label: t("ct.transport") },
    { key: "overdue", label: t("ct.overdue"), tone: "danger" },
    { key: "problems", label: t("ct.problems"), tone: "warning" },
    { key: "closed", label: t("ct.closed") },
  ];
  const selected =
    filter && filter in data.buckets
      ? (filter as keyof typeof data.buckets)
      : "active";
  const rows = data.buckets[selected];

  return (
    <>
      <PageHeader
        help={{ body: "help.ct.body", steps: "help.ct.cards" }}
        t={t}
        title={t("ct.title")}
        subtitle={t("home.welcome", { name: user.name })}
      />
      {totals ? <TowerTotalsStrip totals={totals} t={t} /> : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <Stat
            key={c.key}
            label={c.label}
            value={data.buckets[c.key].length}
            href={`/app?filter=${c.key}`}
            tone={data.buckets[c.key].length > 0 ? c.tone : undefined}
            active={c.key === selected}
          />
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card
          className="min-w-0 lg:col-span-2"
          title={cards.find((c) => c.key === selected)?.label}
        >
          {rows.length === 0 ? (
            <Empty>{t("common.none")}</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>#</Th>
                  <Th>{t("common.customer")}</Th>
                  <Th>{t("common.product")}</Th>
                  <Th>{t("orders.stage")}</Th>
                  <Th>{t("common.responsible")}</Th>
                  <Th>{t("common.due")}</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className={rowClass}>
                    <Td>
                      <TextLink href={row.link}>{row.number}</TextLink>
                    </Td>
                    <Td>{row.customer}</Td>
                    <Td>{row.product}</Td>
                    <Td className="whitespace-nowrap">
                      <Badge
                        tone={stageTone(
                          row.stageKey === "CLOSED"
                            ? "done"
                            : row.blocked
                              ? "blocked"
                              : "active",
                        )}
                      >
                        {row.stageKey
                          ? t(`stage.${row.stageKey}`)
                          : t(`reqStatusLabel.${row.requestStatus!}`)}
                        {row.blocked ? ` · ${t("stageStatus.blocked")}` : ""}
                      </Badge>
                    </Td>
                    <Td>
                      {row.responsible ? t(`role.${row.responsible}`) : "—"}
                    </Td>
                    <Td className="whitespace-nowrap">
                      <span
                        className={cx(
                          row.overdue && "font-semibold text-red-700",
                        )}
                      >
                        {formatDate(row.dueAt, t)}
                      </span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
        <Card className="min-w-0" title={t("ct.exceptions")}>
          {data.exceptions.length === 0 ? (
            <Empty>{t("common.none")}</Empty>
          ) : (
            <ul className="space-y-2 text-sm">
              {data.exceptions.map((e, i) => (
                <li
                  key={i}
                  className="flex items-start justify-between gap-3 rounded-xl border border-zinc-200/80 p-3"
                >
                  <div className="min-w-0">
                    <Badge tone={e.severity === "high" ? "danger" : "warning"}>
                      {t(`ct.exception.${e.kind}`)}
                    </Badge>
                    <p className="mt-1.5 text-zinc-700">{e.detail}</p>
                  </div>
                  <TextLink href={e.link} className="whitespace-nowrap text-xs">
                    {t("tasks.open")}
                  </TextLink>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      {totals ? <CommercialCard totals={totals} t={t} /> : null}
    </>
  );
}
