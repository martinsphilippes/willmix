import type { Task } from "@/lib/services/tasks";
import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { caseHref, itemsInStep, type FlowStep } from "@/lib/flow";
import {
  Badge,
  Empty,
  Table,
  Td,
  TextLink,
  Th,
  formatDate,
  rowClass,
} from "./ui";

/*
 * Casos de um passo do fluxo (docs/FLOW_MENU.md): o que espera ação do login,
 * das atrasadas às sem prazo, com há quantos dias chegou e o atalho para a
 * tela onde se resolve. Usado na tela do passo e no Overview do bloco.
 */

const DAY = 86_400_000;

export function caseTitle(task: Task, t: Translate): string {
  if (task.text) return t(task.text.title, task.text.values);
  if (task.stageKey && task.orderNumber)
    return t("tasks.orderStage", {
      n: task.orderNumber,
      stage: t(`stage.${task.stageKey}` as DictionaryKey),
    });
  return task.title;
}

export function caseDetail(task: Task, step: FlowStep, t: Translate): string {
  if (task.kind === "requirement" && task.items?.length) {
    const mine = itemsInStep(step, task);
    if (mine.length) return mine.map((i) => i.label).join(", ");
  }
  return task.text ? t(task.text.detail, task.text.values) : task.detail;
}

export function FlowCases({
  step,
  tasks,
  t,
  now = new Date(),
}: {
  step: FlowStep;
  tasks: Task[];
  t: Translate;
  now?: Date;
}) {
  if (!tasks.length) return <Empty>{t("flow.cases.empty")}</Empty>;
  return (
    <Table>
      <thead>
        <tr>
          <Th>{t("flow.cases.what")}</Th>
          <Th>{t("flow.cases.due")}</Th>
          <Th>{t("flow.cases.since")}</Th>
          <Th>
            <span className="sr-only">{t("common.actions")}</span>
          </Th>
        </tr>
      </thead>
      <tbody>
        {tasks.map((task, i) => {
          const since = task.sinceAt ? Date.parse(task.sinceAt) : NaN;
          const days = Number.isFinite(since)
            ? Math.max(0, Math.floor((now.getTime() - since) / DAY))
            : null;
          return (
            <tr
              key={i}
              data-flow-case
              data-flow-case-overdue={task.overdue ? "1" : "0"}
              className={rowClass}
            >
              <Td>
                <div className="font-medium text-zinc-900">
                  {caseTitle(task, t)}
                </div>
                <div className="text-xs text-zinc-500">
                  {caseDetail(task, step, t)}
                </div>
              </Td>
              <Td className="whitespace-nowrap">
                {task.overdue ? (
                  <Badge tone="danger">{t("common.overdue")}</Badge>
                ) : task.dueAt ? (
                  formatDate(task.dueAt, t)
                ) : (
                  <span className="text-zinc-400">—</span>
                )}
              </Td>
              <Td className="whitespace-nowrap">
                {days === null ? "—" : t("flow.cases.days", { n: days })}
              </Td>
              <Td className="whitespace-nowrap text-right">
                <TextLink href={caseHref(step, task)} data-flow-case-open>
                  {t("flow.cases.open")}
                </TextLink>
              </Td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}
