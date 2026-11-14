import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { blockLabelKey } from "@/lib/flow";
import { milestoneLabelKey, type MilestoneView } from "@/lib/milestones";
import { PercentBar } from "./flow-entities";
import { Badge, Card, cx, formatDate } from "./ui";

/*
 * Marcos do pedido (dono, 14/11/2026; fase 2, docs/MILESTONES.md): os 16
 * marcos do mapa, na ordem, com a situação (concluído, em andamento,
 * aguardando outro marco, não se aplica), o andamento das subtarefas e o
 * prazo. Só leitura: a fase 3 troca a tabela "Etapas do pedido" por esta
 * linha do tempo, com os formulários de cada login.
 */

const TONE = {
  done: "success",
  active: "brand",
  waiting: "neutral",
  na: "neutral",
} as const;

export function OrderMilestonesCard({
  milestones,
  t,
}: {
  milestones: MilestoneView[];
  t: Translate;
}) {
  const blocks = [...new Set(milestones.map((m) => m.block))];
  return (
    <Card
      className="mb-4"
      title={<span data-order-milestones>{t("milestone.title")}</span>}
    >
      <p className="mb-3 text-xs text-zinc-500">{t("milestone.hint")}</p>
      <div className="grid gap-4 lg:grid-cols-3">
        {blocks.map((block) => (
          <ol key={block} className="space-y-1.5">
            <li className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {t(blockLabelKey(block))}
            </li>
            {milestones
              .filter((m) => m.block === block)
              .map((m) => (
                <li
                  key={m.key}
                  data-milestone={m.key}
                  data-milestone-state={m.state}
                  className={cx(
                    "rounded-lg border px-3 py-2",
                    m.state === "active"
                      ? "border-brand-300 bg-brand-50"
                      : m.state === "done"
                        ? "border-emerald-200 bg-white"
                        : "border-zinc-200 bg-zinc-50 text-zinc-500",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cx(
                        "text-sm",
                        m.state === "active"
                          ? "font-semibold text-brand-700"
                          : m.state === "done"
                            ? "text-zinc-800"
                            : "text-zinc-500",
                      )}
                    >
                      {MILESTONE_NUMBER(milestones, m)}.{" "}
                      {t(milestoneLabelKey(m.key))}
                    </span>
                    <Badge tone={TONE[m.state]}>
                      {m.state === "waiting" && m.waitingFor
                        ? t("milestone.state.waiting", {
                            name: t(milestoneLabelKey(m.waitingFor)),
                          })
                        : t(`milestone.state.${m.state}` as DictionaryKey)}
                    </Badge>
                  </div>
                  {m.state !== "na" ? (
                    <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500">
                      <span className="flex-1">
                        <PercentBar
                          percent={m.percent}
                          muted={m.state !== "active"}
                        />
                      </span>
                      <span className="whitespace-nowrap tabular-nums">
                        {m.done}/{m.total}
                      </span>
                      {m.state === "active" && m.dueAt ? (
                        <span className="whitespace-nowrap">
                          {formatDate(m.dueAt, t)}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              ))}
          </ol>
        ))}
      </div>
    </Card>
  );
}

const MILESTONE_NUMBER = (all: MilestoneView[], m: MilestoneView) =>
  all.indexOf(m) + 1;
