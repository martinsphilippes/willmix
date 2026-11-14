import Link from "next/link";
import type { User } from "@/lib/db/schema";
import type { Translate } from "@/i18n";
import {
  blockLabelKey,
  stepHelpKey,
  stepHref,
  stepLabelKey,
  type FlowBlock,
} from "@/lib/flow";
import {
  flowAllFor,
  flowBlockEntities,
  flowBlockSummary,
  flowProgressFor,
  type FlowBlockEntity,
} from "@/lib/services/flow";
import { isWellmix } from "@/lib/auth/permissions";
import { overviewHref, stepId } from "@/lib/flow";
import {
  PROGRESS_BLOCKS,
  blockOf,
  isProgressBlock,
  type ProgressBlock,
} from "@/lib/flow-progress";
import { FlowCases } from "./flow-cases";
import { FlowEntities, PercentBar, daysSince } from "./flow-entities";
import { Card, PageHeader, Stat, TextLink, cx } from "./ui";

/*
 * Overview do bloco (dono, 14/11/2026; docs/FLOW_MENU.md): à esquerda, a
 * linha do tempo vertical dos passos na ordem do mapa, cada um com quantos
 * esperam ação, quantos atrasaram e há quantos dias (média e a mais antiga);
 * à direita, a tabela com os casos do passo escolhido para analisar e
 * resolver. O passo vem no endereço (?step=…), então funciona sem JavaScript.
 */
export async function FlowOverview({
  user,
  block,
  selected,
  t,
  basePath,
}: {
  user: User;
  block: FlowBlock;
  selected?: string | null;
  t: Translate;
  /** Endereço do Overview (o da Produção é /app/production). */
  basePath: string;
}) {
  // Pedido, Produção e Entrega (Wellmix): o Overview é dos pedidos do bloco
  // (dono, 14/11/2026), com KPIs, a linha do tempo geral entre os blocos e a
  // tabela dos pedidos filtrada pelo passo; as pendências ficam em segundo
  // plano (número menor). Os outros logins e o Produto novo seguem como antes.
  if (isWellmix(user) && isProgressBlock(block))
    return (
      <EntityOverview
        user={user}
        block={block}
        selected={selected ?? null}
        t={t}
        basePath={basePath}
      />
    );
  const summary = await flowBlockSummary(user, block);
  // Quantos pedidos estão em cada passo agora, de qualquer responsável (só a
  // Wellmix; a aba "Todos no passo" da tela do passo lista).
  const all = isWellmix(user) ? await flowAllFor(user) : null;
  // Passos com tela própria de antes (Books, Pedidos, Revisão…) listam lá.
  const inStep = (key: string) =>
    all && !summary.find((x) => x.step.key === key)?.step.href
      ? (all.get(stepId({ block, key }))?.length ?? 0)
      : null;
  const total = summary.reduce((n, s) => n + s.count, 0);
  const late = summary.reduce((n, s) => n + s.overdue, 0);
  const current =
    summary.find((s) => s.step.key === selected) ??
    summary.find((s) => s.overdue > 0) ??
    summary.find((s) => s.count > 0) ??
    summary[0];
  return (
    <div data-flow-overview={block}>
      <PageHeader
        title={t(blockLabelKey(block))}
        subtitle={t("flow.overview.subtitle", { n: total, late })}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(16rem,20rem)_1fr]">
        <ol className="relative space-y-1" data-flow-timeline>
          {summary.map((s, i) => {
            const active = s.step.key === current?.step.key;
            const dot =
              s.overdue > 0
                ? "bg-red-600 ring-red-100"
                : s.count > 0
                  ? "bg-brand-600 ring-brand-100"
                  : "bg-zinc-300 ring-zinc-100";
            return (
              <li key={s.step.key} className="relative pl-8">
                {i < summary.length - 1 ? (
                  <span
                    aria-hidden
                    className="absolute left-[0.6875rem] top-6 h-[calc(100%-0.5rem)] w-0.5 bg-zinc-200"
                  />
                ) : null}
                <span
                  aria-hidden
                  className={cx(
                    "absolute left-1.5 top-3 h-3 w-3 rounded-full ring-4",
                    dot,
                  )}
                />
                <Link
                  href={`${basePath}?step=${s.step.key}`}
                  scroll={false}
                  aria-current={active ? "step" : undefined}
                  data-flow-timeline-step={s.step.key}
                  data-flow-count={s.count}
                  data-flow-overdue={s.overdue}
                  className={cx(
                    "block rounded-lg px-3 py-2 transition hover:bg-zinc-100",
                    active && "bg-brand-50 ring-1 ring-brand-200",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cx(
                        "text-sm",
                        active
                          ? "font-semibold text-brand-700"
                          : "text-zinc-800",
                      )}
                    >
                      {t(stepLabelKey(s.step))}
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-zinc-900">
                      {s.count}
                    </span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-zinc-500">
                    {inStep(s.step.key) !== null ? (
                      <span data-flow-in-step={inStep(s.step.key) ?? 0}>
                        {t("flow.overview.inStep", {
                          n: inStep(s.step.key) ?? 0,
                        })}
                      </span>
                    ) : null}
                    <span
                      className={s.overdue ? "font-semibold text-red-700" : ""}
                    >
                      {t("flow.overview.late", { n: s.overdue })}
                    </span>
                    {s.avgDays !== null ? (
                      <span>
                        {t("flow.overview.days", {
                          avg: s.avgDays,
                          max: s.maxDays ?? s.avgDays,
                        })}
                      </span>
                    ) : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ol>
        {current ? (
          <Card
            title={t(stepLabelKey(current.step))}
            actions={
              <TextLink href={stepHref(current.step)} data-flow-step-page>
                {t("flow.overview.openStep")}
              </TextLink>
            }
          >
            <p className="mb-3 text-sm text-zinc-600">
              {t(stepHelpKey(current.step))}
            </p>
            <FlowCases step={current.step} tasks={current.tasks} t={t} />
          </Card>
        ) : null}
      </div>
    </div>
  );
}

/** Média dos percentuais (0 sem pedidos). */
const avg = (xs: number[]) =>
  xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0;

async function EntityOverview({
  user,
  block,
  selected,
  t,
  basePath,
}: {
  user: User;
  block: ProgressBlock;
  selected: string | null;
  t: Translate;
  basePath: string;
}) {
  const now = new Date();
  const [summary, progress, byBlock] = await Promise.all([
    flowBlockSummary(user, block, now),
    flowProgressFor(user),
    Promise.all(
      PROGRESS_BLOCKS.map(
        async (b) => [b, await flowBlockEntities(user, b)] as const,
      ),
    ),
  ]);
  const blockEntities = new Map<ProgressBlock, FlowBlockEntity[]>(byBlock);
  const entities = blockEntities.get(block) ?? [];
  const current = summary.find((s) => s.step.key === selected) ?? null;
  const shown = current
    ? entities.filter((e) => e.steps.includes(current.step.key))
    : entities;
  const inStep = (key: string) =>
    entities.filter((e) => e.steps.includes(key)).length;
  const mineOf = (e: FlowBlockEntity) =>
    e.progress ? blockOf(e.progress, block) : null;
  const late = entities.filter((e) => (mineOf(e)?.lateDays ?? 0) > 0).length;
  const oldest = Math.max(
    0,
    ...entities.map(
      (e) => daysSince(mineOf(e)?.startedAt ?? e.since, now) ?? 0,
    ),
  );
  const tasks = summary.reduce((n, s) => n + s.count, 0);
  const lateTasks = summary.reduce((n, s) => n + s.overdue, 0);
  return (
    <div data-flow-overview={block} data-flow-entity-mode>
      <PageHeader
        title={t(blockLabelKey(block))}
        subtitle={t("flow.entities.subtitle", {
          n: entities.length,
          late,
          tasks,
        })}
      />
      <div
        className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
        data-flow-kpis
      >
        <Stat
          label={t("flow.kpi.entities")}
          value={<span data-flow-kpi="entities">{entities.length}</span>}
        />
        <Stat
          label={t("flow.kpi.late")}
          tone={late ? "danger" : "neutral"}
          value={<span data-flow-kpi="late">{late}</span>}
        />
        <Stat
          label={t("flow.kpi.blockPercent")}
          value={
            <span data-flow-kpi="block">
              {avg(entities.map((e) => mineOf(e)?.percent ?? 0))}%
            </span>
          }
        />
        <Stat
          label={t("flow.kpi.overall")}
          value={
            <span data-flow-kpi="overall">
              {avg(entities.map((e) => e.progress?.overall ?? 0))}%
            </span>
          }
        />
        <Stat
          label={t("flow.kpi.tasks")}
          tone={lateTasks ? "warning" : "neutral"}
          value={
            <span data-flow-kpi="tasks">
              {tasks}
              <span className="ml-2 text-xs font-medium text-zinc-500">
                {t("flow.kpi.oldest", { n: oldest })}
              </span>
            </span>
          }
        />
      </div>
      <Card className="mb-4" title={t("flow.general.title")}>
        <p className="mb-3 text-xs text-zinc-500">
          {t("flow.general.hint", { n: progress.size })}
        </p>
        <ol className="grid gap-2 sm:grid-cols-3" data-flow-general>
          {PROGRESS_BLOCKS.map((b, i) => {
            const list = blockEntities.get(b) ?? [];
            const here = b === block;
            const lateHere = list.filter(
              (e) => (e.progress ? blockOf(e.progress, b)?.lateDays : 0) ?? 0,
            ).length;
            return (
              <li key={b} className="relative">
                <Link
                  href={overviewHref(b)}
                  aria-current={here ? "page" : undefined}
                  data-flow-general-block={b}
                  data-flow-general-count={list.length}
                  className={cx(
                    "block rounded-xl border px-3 py-2 transition hover:shadow-sm",
                    here
                      ? "border-brand-300 bg-brand-50"
                      : "border-zinc-200 bg-zinc-50 text-zinc-500",
                  )}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span
                      className={cx(
                        "text-sm",
                        here ? "font-semibold text-brand-700" : "text-zinc-600",
                      )}
                    >
                      {i + 1}. {t(blockLabelKey(b))}
                    </span>
                    <span
                      className={cx(
                        "text-xl font-bold tabular-nums",
                        here ? "text-zinc-900" : "text-zinc-500",
                      )}
                    >
                      {list.length}
                    </span>
                  </div>
                  <div className="mt-1">
                    <PercentBar
                      percent={avg(
                        list.map((e) =>
                          e.progress
                            ? (blockOf(e.progress, b)?.percent ?? 0)
                            : 0,
                        ),
                      )}
                      muted={!here}
                    />
                  </div>
                  <div
                    className={cx(
                      "mt-0.5 text-xs",
                      lateHere ? "text-red-700" : "text-zinc-500",
                    )}
                  >
                    {t("flow.general.late", { n: lateHere })}
                  </div>
                </Link>
              </li>
            );
          })}
        </ol>
      </Card>
      <div className="grid gap-6 lg:grid-cols-[minmax(16rem,20rem)_1fr]">
        <ol className="relative space-y-1" data-flow-timeline>
          <li className="relative pl-8">
            <span
              aria-hidden
              className="absolute left-1.5 top-3 h-3 w-3 rounded-full bg-zinc-800 ring-4 ring-zinc-100"
            />
            <Link
              href={basePath}
              scroll={false}
              aria-current={!current ? "step" : undefined}
              data-flow-timeline-all
              className={cx(
                "flex items-center justify-between gap-2 rounded-lg px-3 py-2 transition hover:bg-zinc-100",
                !current && "bg-brand-50 ring-1 ring-brand-200",
              )}
            >
              <span
                className={cx(
                  "text-sm",
                  !current ? "font-semibold text-brand-700" : "text-zinc-800",
                )}
              >
                {t("flow.entities.allSteps")}
              </span>
              <span className="text-lg font-bold tabular-nums text-zinc-900">
                {entities.length}
              </span>
            </Link>
          </li>
          {summary.map((s, i) => {
            const active = s.step.key === current?.step.key;
            const n = inStep(s.step.key);
            const dot =
              s.overdue > 0
                ? "bg-red-600 ring-red-100"
                : n > 0 || s.count > 0
                  ? "bg-brand-600 ring-brand-100"
                  : "bg-zinc-300 ring-zinc-100";
            return (
              <li key={s.step.key} className="relative pl-8">
                {i < summary.length - 1 ? (
                  <span
                    aria-hidden
                    className="absolute left-[0.6875rem] top-6 h-[calc(100%-0.5rem)] w-0.5 bg-zinc-200"
                  />
                ) : null}
                <span
                  aria-hidden
                  className={cx(
                    "absolute left-1.5 top-3 h-3 w-3 rounded-full ring-4",
                    dot,
                  )}
                />
                <Link
                  href={`${basePath}?step=${s.step.key}`}
                  scroll={false}
                  aria-current={active ? "step" : undefined}
                  data-flow-timeline-step={s.step.key}
                  data-flow-entities={n}
                  data-flow-count={s.count}
                  data-flow-overdue={s.overdue}
                  className={cx(
                    "block rounded-lg px-3 py-2 transition hover:bg-zinc-100",
                    active && "bg-brand-50 ring-1 ring-brand-200",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cx(
                        "text-sm",
                        active
                          ? "font-semibold text-brand-700"
                          : "text-zinc-800",
                      )}
                    >
                      {t(stepLabelKey(s.step))}
                    </span>
                    <span
                      className="text-lg font-bold tabular-nums text-zinc-900"
                      title={t("flow.entities.inStepTitle", { n })}
                    >
                      {n}
                    </span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-zinc-500">
                    <span data-flow-pending={s.count}>
                      {t("flow.entities.pending", { n: s.count })}
                    </span>
                    {s.overdue ? (
                      <span className="font-semibold text-red-700">
                        {t("flow.overview.late", { n: s.overdue })}
                      </span>
                    ) : null}
                    {s.avgDays !== null ? (
                      <span>
                        {t("flow.overview.days", {
                          avg: s.avgDays,
                          max: s.maxDays ?? s.avgDays,
                        })}
                      </span>
                    ) : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ol>
        <div className="min-w-0 space-y-4">
          <Card
            title={
              current
                ? t("flow.entities.titleStep", {
                    step: t(stepLabelKey(current.step)),
                  })
                : t("flow.entities.title", { block: t(blockLabelKey(block)) })
            }
            actions={
              current ? (
                <TextLink href={stepHref(current.step)} data-flow-step-page>
                  {t("flow.overview.openStep")}
                </TextLink>
              ) : null
            }
          >
            <p className="mb-3 text-sm text-zinc-600">
              {current ? t(stepHelpKey(current.step)) : t("flow.entities.hint")}
            </p>
            <FlowEntities
              block={block}
              entities={shown}
              showSteps={!current}
              t={t}
              now={now}
            />
          </Card>
          {current ? (
            <Card
              title={t("flow.entities.pendingTitle", {
                n: current.count,
              })}
            >
              <FlowCases step={current.step} tasks={current.tasks} t={t} />
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
