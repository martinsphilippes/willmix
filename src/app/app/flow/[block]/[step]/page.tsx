import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { getT } from "@/i18n/server";
import {
  FLOW_OVERVIEW_BLOCKS,
  blockLabelKey,
  findStep,
  overviewHref,
  stepHelpKey,
  stepLabelKey,
} from "@/lib/flow";
import { flowCasesOf } from "@/lib/services/flow";
import { FlowCases } from "@/components/flow-cases";
import { FlowStepWork } from "@/components/flow-step-work";
import {
  FlowArtworkWork,
  FlowProductionWork,
  FlowReceivingWork,
  FlowRequirementWork,
} from "@/components/flow-step-forms";
import { Alert } from "@/components/ui";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { PageHeader, TextLink } from "@/components/ui";

/*
 * Tela de um passo do fluxo (dono, 14/11/2026; docs/FLOW_MENU.md): o que
 * espera ação do login naquele passo, com o prazo, há quantos dias chegou e
 * o atalho para a tela focada onde se resolve. Os filtros de prazo são links
 * (?due=overdue|today|week).
 */
const DUES = ["overdue", "today", "week"] as const;

export default async function FlowStepPage({
  params,
  searchParams,
}: PageProps<"/app/flow/[block]/[step]">) {
  const { block, step: key } = await params;
  const step = findStep(block, key);
  if (!step || step.badgeOnly) notFound();
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/app/flow/${block}/${key}`);
  requireScreen(user, step.screen);
  const { due, importStep, certStep, production, artwork, receiving, saved } =
    await searchParams;
  const done = [importStep, certStep].find(
    (v) =>
      typeof v === "string" &&
      ["submitted", "validated", "rejected"].includes(v),
  ) as string | undefined;
  const t = await getT();
  const all = await flowCasesOf(user, step);
  const filter = (DUES as readonly string[]).includes(String(due))
    ? String(due)
    : null;
  const tasks = filter ? all.filter((x) => x.due === filter) : all;
  const base = `/app/flow/${block}/${key}`;
  // Aviso de "feito" das ações da produção e da arte (os cartões leem o seu).
  const productionNotice =
    typeof production === "string" &&
    ["saved", "followup", "scheduled", "inspected", "fixed"].includes(
      production,
    )
      ? t(`production.done.${production}` as DictionaryKey)
      : null;
  const receivingNotice =
    typeof receiving === "string" &&
    ["saved", "counted", "ric", "returned", "closed"].includes(receiving)
      ? t(`receiving.done.${receiving}` as DictionaryKey)
      : null;
  const artworkNotice =
    typeof artwork === "string" &&
    ["designer", "reported", "fixed", "accepted", "reopened"].includes(artwork)
      ? t(`artwork.done.${artwork}` as DictionaryKey)
      : null;
  return (
    <div data-flow-step={`${block}/${key}`}>
      <PageHeader
        title={t(stepLabelKey(step))}
        subtitle={t(stepHelpKey(step))}
        actions={
          FLOW_OVERVIEW_BLOCKS.includes(step.block) ? (
            <TextLink href={overviewHref(step.block)} data-flow-back>
              {t("flow.step.back", { block: t(blockLabelKey(step.block)) })}
            </TextLink>
          ) : null
        }
      />
      <nav
        aria-label={t("flow.cases.filter")}
        className="mb-3 flex flex-wrap gap-2 text-sm"
      >
        {[null, ...DUES].map((d) => {
          const n = d ? all.filter((x) => x.due === d).length : all.length;
          const active = d === filter;
          return (
            <a
              key={d ?? "all"}
              href={d ? `${base}?due=${d}` : base}
              aria-current={active ? "page" : undefined}
              data-flow-filter={d ?? "all"}
              className={`rounded-full border px-3 py-1 ${
                active
                  ? "border-brand-600 bg-brand-50 font-semibold text-brand-700"
                  : "border-zinc-200 text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              {t(`flow.due.${d ?? "all"}` as const)} ({n})
            </a>
          );
        })}
      </nav>
      {saved === "1" ? (
        <div className="mb-3">
          <Alert tone="success">{t("flow.work.saved")}</Alert>
        </div>
      ) : null}
      <FlowCases step={step} tasks={tasks} t={t} />
      <FlowRequirementWork user={user} step={step} tasks={all} t={t} />
      {step.block === "production" &&
      (step.key === "production" || step.key === "inspection") ? (
        <FlowProductionWork
          user={user}
          step={step}
          tasks={all}
          t={t}
          notice={productionNotice}
        />
      ) : null}
      {step.block === "delivery" &&
      (step.key === "storage" || step.key === "return") ? (
        <FlowReceivingWork
          step={step}
          tasks={all}
          t={t}
          notice={receivingNotice}
        />
      ) : null}
      {step.block === "order" && step.key === "art" ? (
        <FlowArtworkWork
          user={user}
          step={step}
          tasks={all}
          t={t}
          notice={artworkNotice}
        />
      ) : null}
      <FlowStepWork
        user={user}
        step={step}
        tasks={all}
        t={t}
        notice={done ? t(`importFlow.done.${done}` as DictionaryKey) : null}
      />
    </div>
  );
}
