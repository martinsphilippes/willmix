import Link from "next/link";
import type { User } from "@/lib/db";
import {
  TASK_DUE_FILTERS,
  filterTasks,
  pendingTasksFor,
  taskGroups,
  type Task,
} from "@/lib/services/tasks";
import { getT } from "@/i18n/server";
import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  Badge,
  Card,
  Empty,
  LinkButton,
  PageHeader,
  TextLink,
  cx,
  formatDate,
} from "./ui";

/*
 * Pendências: a lista vem do serviço já ordenada pelo prazo (atrasadas,
 * hoje, até 7 dias, mais adiante, sem prazo). Os filtros são links
 * (?due=…&type=…), então funcionam sem JavaScript e podem ser compartilhados.
 */
export async function TaskList({
  user,
  due = null,
  group = null,
}: {
  user: User;
  due?: string | null;
  group?: string | null;
}) {
  const t = await getT();
  const tasks = await pendingTasksFor(user);
  const shown = filterTasks(tasks, { due, group });
  const filtering = shown.length !== tasks.length || !!due || !!group;
  // Cliente tem poucas ações próprias: a ajuda fala só delas.
  const help =
    user.role === "customer"
      ? {
          body: "help.tasks.customer.body" as const,
          steps: "help.tasks.customer.steps" as const,
        }
      : {
          body: "help.tasks.body" as const,
          steps: "help.tasks.steps" as const,
        };
  return (
    <>
      <PageHeader
        help={help}
        t={t}
        title={t("tasks.title")}
        subtitle={t("home.welcome", { name: user.name })}
      />
      {tasks.length === 0 ? (
        <Empty>{t("tasks.empty")}</Empty>
      ) : (
        <>
          <TaskFilters tasks={tasks} due={due} group={group} t={t} />
          {shown.length === 0 ? (
            <Empty>
              {t("tasks.filter.empty")}{" "}
              <TextLink href="/app/tasks">{t("tasks.filter.clear")}</TextLink>
            </Empty>
          ) : (
            <TaskItems tasks={shown} t={t} />
          )}
          {filtering && shown.length > 0 ? (
            <p className="mt-3 text-sm">
              <TextLink href="/app/tasks">{t("tasks.filter.clear")}</TextLink>
            </p>
          ) : null}
        </>
      )}
    </>
  );
}

function groupLabel(group: string, stage: boolean, t: Translate) {
  return stage
    ? t(`stage.${group}` as DictionaryKey)
    : t(`tasks.group.${group}` as DictionaryKey);
}

/** Filtros por prazo e por tipo, com contagem; chip ativo em destaque. */
function TaskFilters({
  tasks,
  due,
  group,
  t,
}: {
  tasks: Task[];
  due: string | null;
  group: string | null;
  t: Translate;
}) {
  const groups = taskGroups(tasks);
  const dueCounts = new Map<string, number>();
  for (const task of tasks)
    dueCounts.set(task.due, (dueCounts.get(task.due) ?? 0) + 1);
  const href = (next: { due?: string | null; type?: string | null }) => {
    const p = new URLSearchParams();
    const d = next.due === undefined ? due : next.due;
    const g = next.type === undefined ? group : next.type;
    if (d) p.set("due", d);
    if (g) p.set("type", g);
    const q = p.toString();
    return q ? `/app/tasks?${q}` : "/app/tasks";
  };
  const chip = (active: boolean) =>
    cx(
      "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition",
      active
        ? "border-brand-600 bg-brand-600 text-white"
        : "border-zinc-300 bg-white text-zinc-700 hover:border-brand-300 hover:bg-brand-50",
    );
  const count = (n: number, active: boolean) => (
    <span
      className={cx(
        "rounded-full px-1.5 text-xs",
        active ? "bg-white/20" : "bg-zinc-100 text-zinc-600",
      )}
    >
      {n}
    </span>
  );
  return (
    <div className="mb-4 space-y-2" data-task-filters>
      <p className="text-xs text-zinc-500">{t("tasks.sortHint")}</p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {t("tasks.filter.due")}
        </span>
        <Link
          href={href({ due: null })}
          aria-pressed={!due}
          data-task-filter="due:all"
          className={chip(!due)}
        >
          {t("tasks.filter.all")} {count(tasks.length, !due)}
        </Link>
        {TASK_DUE_FILTERS.filter((d) => dueCounts.has(d)).map((d) => (
          <Link
            key={d}
            href={href({ due: d })}
            aria-pressed={due === d}
            data-task-filter={`due:${d}`}
            className={chip(due === d)}
          >
            {t(`tasks.filter.${d}` as DictionaryKey)}{" "}
            {count(dueCounts.get(d) ?? 0, due === d)}
          </Link>
        ))}
      </div>
      {groups.length > 1 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {t("tasks.filter.type")}
          </span>
          <Link
            href={href({ type: null })}
            aria-pressed={!group}
            data-task-filter="type:all"
            className={chip(!group)}
          >
            {t("tasks.filter.all")}
          </Link>
          {groups.map((g) => (
            <Link
              key={g.group}
              href={href({ type: g.group })}
              aria-pressed={group === g.group}
              data-task-filter={`type:${g.group}`}
              className={chip(group === g.group)}
            >
              {groupLabel(g.group, g.stage, t)}{" "}
              {count(g.count, group === g.group)}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** "vence hoje", "vence em 3 dias", "atrasada há 2 dias". */
function dueLabel(task: Task, t: Translate): string | null {
  const n = task.daysLeft;
  if (n === null) return null;
  if (n < -1) return t("tasks.due.late", { n: -n });
  if (n === -1) return t("tasks.due.late1");
  if (n === 0) return t("tasks.due.today");
  if (n === 1) return t("tasks.due.tomorrow");
  return t("tasks.due.in", { n });
}

/** Lista de pendências (também usada no início do cliente, em Solicitações). */
export function TaskItems({ tasks, t }: { tasks: Task[]; t: Translate }) {
  return (
    <ul className="space-y-3">
      {tasks.map((task, i) => {
        // Requisito de etapa: etapa traduzida (o serviço guarda a chave).
        const title =
          task.stageKey && task.orderNumber
            ? t("tasks.orderStage", {
                n: task.orderNumber,
                stage: t(`stage.${task.stageKey}` as DictionaryKey),
              })
            : task.title;
        const relative = dueLabel(task, t);
        return (
          <li key={i} data-task-due={task.due} data-task-group={task.group}>
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-zinc-900">{title}</span>
                    {task.overdue ? (
                      <Badge tone="danger">{t("common.overdue")}</Badge>
                    ) : task.due === "today" ? (
                      <Badge tone="warning">{t("tasks.due.today")}</Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-zinc-600">{task.detail}</p>
                  {task.dueAt ? (
                    <p
                      className={cx(
                        "mt-1.5 text-xs",
                        task.overdue
                          ? "font-semibold text-red-700"
                          : "text-zinc-500",
                      )}
                    >
                      {t("common.due")}: {formatDate(task.dueAt)}
                      {relative ? ` · ${relative}` : null}
                    </p>
                  ) : null}
                </div>
                <LinkButton
                  href={task.link}
                  variant="primary"
                  className="shrink-0"
                >
                  {t("tasks.open")}
                </LinkButton>
              </div>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
