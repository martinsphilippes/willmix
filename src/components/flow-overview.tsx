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
import { flowAllFor, flowBlockSummary } from "@/lib/services/flow";
import { isWellmix } from "@/lib/auth/permissions";
import { stepId } from "@/lib/flow";
import { FlowCases } from "./flow-cases";
import { Card, PageHeader, TextLink, cx } from "./ui";

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
