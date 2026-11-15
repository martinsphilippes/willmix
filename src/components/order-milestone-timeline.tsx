import type { ReactNode } from "react";
import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { blockLabelKey } from "@/lib/flow";
import { milestoneLabelKey, type MilestoneView } from "@/lib/milestones";
import { PercentBar } from "./flow-entities";
import { Badge, StepDot, cx, formatDate, isOverdue } from "./ui";

/*
 * Linha do tempo dos marcos do pedido (dono, 14/11/2026; fase 3,
 * docs/MILESTONES.md): os 16 marcos do mapa, na ordem e por bloco (Pedido,
 * Produção, Entrega), com a situação (concluído, em andamento, aguardando
 * outro marco, não se aplica), o andamento das subtarefas e o prazo. Cada
 * marco abre em "Ver detalhes" com as subtarefas dele; o marco em que o login
 * tem tarefa liberada agora já vem aberto, com os campos. Substitui a antiga
 * tabela "Etapas do pedido" na visão da Wellmix (o motor continua nas etapas
 * por baixo até as fases 4 e 5).
 */

const TONE = {
  done: "success",
  active: "brand",
  waiting: "neutral",
  na: "neutral",
} as const;

const DOT = {
  done: "done",
  active: "active",
  waiting: "pending",
  na: "pending",
} as const;

export interface MilestoneTimelineItem {
  view: MilestoneView;
  /** Tarefa do login no marco: liberada agora, só depois ou nenhuma. */
  mine: "now" | "later" | null;
  /** Aberto ao carregar (o login tem tarefa liberada aqui). */
  expanded: boolean;
  /** Subtarefas do marco (itens, passos e atalhos); nulo: nada a mostrar. */
  detail: ReactNode | null;
}

export function OrderMilestoneTimeline({
  items,
  t,
}: {
  items: MilestoneTimelineItem[];
  t: Translate;
}) {
  const blocks = [...new Set(items.map((i) => i.view.block))];
  return (
    <div className="space-y-4" data-order-milestones>
      {blocks.map((block) => (
        <div key={block} data-milestone-block={block}>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {t(blockLabelKey(block))}
          </h3>
          {/* Sem <ol>/<li>: os itens do pedido dentro do marco são <li> (os
              testes e a tela acham a linha do item pelo <li> mais próximo). */}
          <div role="list" className="space-y-1.5">
            {items
              .filter((i) => i.view.block === block)
              .map((item) => (
                <MilestoneRow
                  key={item.view.key}
                  item={item}
                  number={items.indexOf(item) + 1}
                  t={t}
                />
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function MilestoneRow({
  item,
  number,
  t,
}: {
  item: MilestoneTimelineItem;
  number: number;
  t: Translate;
}) {
  const m = item.view;
  const late = m.state === "active" && isOverdue(m.dueAt);
  const summary = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <StepDot state={DOT[m.state]}>{number}</StepDot>
      <span
        className={cx(
          "min-w-0 flex-1 text-sm",
          m.state === "active"
            ? "font-semibold text-brand-800"
            : m.state === "done"
              ? "font-medium text-zinc-900"
              : "text-zinc-500",
        )}
        data-milestone-name
      >
        {t(milestoneLabelKey(m.key))}
      </span>
      <span className="flex flex-wrap items-center gap-2">
        {item.mine ? (
          <span data-milestone-mine={item.mine}>
            <Badge tone={item.mine === "now" ? "warning" : "neutral"}>
              {t(`milestone.mine.${item.mine}` as DictionaryKey)}
            </Badge>
          </span>
        ) : null}
        <Badge tone={TONE[m.state]}>
          {m.state === "waiting" && m.waitingFor
            ? t("milestone.state.waiting", {
                name: t(milestoneLabelKey(m.waitingFor)),
              })
            : t(`milestone.state.${m.state}` as DictionaryKey)}
        </Badge>
      </span>
      {m.state !== "na" ? (
        <span className="flex w-full items-center gap-3 text-xs text-zinc-500 sm:w-auto">
          <span className="w-28">
            <PercentBar percent={m.percent} muted={m.state !== "active"} />
          </span>
          <span className="whitespace-nowrap tabular-nums" data-milestone-count>
            {t("orderView.stage.reqs", { done: m.done, total: m.total })}
          </span>
          {m.state === "active" && m.dueAt ? (
            <span
              className={cx(
                "whitespace-nowrap",
                late && "font-semibold text-red-700",
              )}
              data-milestone-late={late ? "" : undefined}
            >
              {t("common.due")}: {formatDate(m.dueAt, t)}
            </span>
          ) : null}
        </span>
      ) : null}
    </div>
  );
  return (
    <div
      role="listitem"
      id={`milestone-${m.key}`}
      data-milestone={m.key}
      data-milestone-state={m.state}
      className={cx(
        "scroll-mt-24 rounded-lg border",
        item.mine === "now"
          ? "border-brand-300 bg-white ring-4 ring-brand-50"
          : m.state === "active"
            ? "border-brand-200 bg-brand-50/40"
            : m.state === "done"
              ? "border-emerald-200 bg-white"
              : "border-zinc-200 bg-zinc-50/60",
      )}
    >
      {item.detail ? (
        <details
          open={item.expanded}
          className="group"
          data-milestone-details={m.key}
        >
          <summary className="cursor-pointer list-none px-3 py-2 [&::-webkit-details-marker]:hidden">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">{summary}</div>
              <span className="mt-0.5 whitespace-nowrap text-xs font-medium text-brand-700 underline-offset-2 group-open:hidden hover:underline">
                {t("milestone.details")}
              </span>
              <span className="mt-0.5 hidden whitespace-nowrap text-xs font-medium text-zinc-500 group-open:inline">
                {t("orderView.stage.close")}
              </span>
            </div>
          </summary>
          <div className="border-t border-zinc-100 px-3 pb-2 pt-1">
            {item.detail}
          </div>
        </details>
      ) : (
        <div className="px-3 py-2">{summary}</div>
      )}
    </div>
  );
}
