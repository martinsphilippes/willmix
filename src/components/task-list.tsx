import Link from "next/link";
import type { User } from "@/lib/db";
import { SCREENS, SCREEN_LABEL, type Screen } from "@/lib/auth/screens";
import {
  AGENCY_STEPS,
  SUPPLIER_STEPS,
  agencyGroup,
  TASK_DUE_FILTERS,
  daysUntil,
  filterTasks,
  pendingTasksFor,
  supplierGroup,
  supplierStepOfGroup,
  taskGroups,
  type Task,
} from "@/lib/services/tasks";
import { getT } from "@/i18n/server";
import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  Alert,
  Badge,
  Empty,
  LinkButton,
  PageHeader,
  Table,
  Td,
  TextLink,
  Th,
  cx,
  formatDate,
  rowClass,
} from "./ui";
import { ChatOpenButton } from "./chat-open-button";
import { chatTargetFromHref } from "@/lib/chat-target";

/*
 * Pendências: a lista vem do serviço já ordenada pelo prazo (atrasadas,
 * hoje, até 7 dias, mais adiante, sem prazo). Os filtros são links
 * (?due=…&type=…), então funcionam sem JavaScript e podem ser compartilhados.
 */
export async function TaskList({
  user,
  due = null,
  group = null,
  denied = null,
}: {
  user: User;
  /** Tela que o login tentou abrir sem acesso (?denied=…): aviso no início. */
  denied?: string | null;
  due?: string | null;
  group?: string | null;
  /** Cotação que o fornecedor acabou de enviar (confirmação no topo). */
}) {
  const t = await getT();
  const tasks = await pendingTasksFor(user);
  const deniedScreen = (SCREENS as readonly string[]).includes(denied ?? "")
    ? (denied as Screen)
    : null;
  const shown = filterTasks(tasks, { due, group });
  const filtering = shown.length !== tasks.length || !!due || !!group;
  // Fornecedor: os filtros são as etapas dele (do Booking ao embarque), cada
  // uma explicada, e a tabela ganha a data em que a pendência chegou a ele.
  const supplier = user.role === "supplier";
  // Agência: os mesmos filtros por etapa, com o caminho dela.
  const agency = user.role === "agency";
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
      {deniedScreen ? (
        <Alert tone="warning">
          {t("access.denied", { screen: t(SCREEN_LABEL[deniedScreen]) })}
        </Alert>
      ) : null}
      {supplier ? (
        <SupplierSteps
          tasks={tasks}
          due={due}
          group={group}
          t={t}
          flow={{
            steps: SUPPLIER_STEPS.map((step) => ({
              id: step,
              group: supplierGroup(step),
              help: `supplierTasks.help.${step}` as DictionaryKey,
            })),
            intro: "supplierTasks.intro",
            after: "supplierTasks.after",
          }}
        />
      ) : null}
      {agency ? (
        <SupplierSteps
          tasks={tasks}
          due={due}
          group={group}
          t={t}
          flow={{
            steps: AGENCY_STEPS.map((step) => ({
              id: step,
              group: agencyGroup(step),
              help: `agencyTasks.help.${step}` as DictionaryKey,
            })),
            intro: "agencyTasks.intro",
            after: "agencyTasks.after",
          }}
        />
      ) : null}
      {tasks.length === 0 ? (
        <Empty>{t(supplier ? "supplierTasks.empty" : "tasks.empty")}</Empty>
      ) : (
        <>
          <TaskFilters
            tasks={tasks}
            due={due}
            group={group}
            t={t}
            supplier={supplier || agency}
          />
          {shown.length === 0 ? (
            <Empty>
              {t("tasks.filter.empty")}{" "}
              <TextLink href="/app/tasks">{t("tasks.filter.clear")}</TextLink>
            </Empty>
          ) : (
            <TaskItems tasks={shown} t={t} since={supplier} />
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
  // Etapa do fornecedor (supplier.<etapa>): nome próprio, não o da etapa do pedido.
  return stage && !supplierStepOfGroup(group)
    ? t(`stage.${group}` as DictionaryKey)
    : t(`tasks.group.${group}` as DictionaryKey);
}

/** Endereço da lista com os filtros (prazo e etapa/tipo) escolhidos. */
function tasksHref(due: string | null, group: string | null) {
  const p = new URLSearchParams();
  if (due) p.set("due", due);
  if (group) p.set("type", group);
  const q = p.toString();
  return q ? `/app/tasks?${q}` : "/app/tasks";
}

/**
 * Fornecedor: as etapas que chegam na mão dele, do Booking ao embarque, na
 * ordem em que acontecem. Cada cartão diz o que fazer e quantas pendências
 * tem; tocar filtra a lista. Aparecem todas, mesmo sem pendência, para ele
 * conhecer o caminho inteiro.
 */
function SupplierSteps({
  tasks,
  due,
  group,
  t,
  flow,
}: {
  tasks: Task[];
  due: string | null;
  group: string | null;
  t: Translate;
  /** O caminho de quem vê (fornecedor ou agência): etapas e textos. */
  flow: {
    steps: { id: string; group: string; help: DictionaryKey }[];
    intro: DictionaryKey;
    after: DictionaryKey;
  };
}) {
  const counts = new Map<string, number>();
  for (const task of tasks)
    counts.set(task.group, (counts.get(task.group) ?? 0) + 1);
  // Etapa com alguma pendência atrasada fica vermelha; com pendência no
  // prazo, amarela; sem nada a fazer, verde (as cores dos selos do sistema).
  const late = new Set(tasks.filter((x) => x.overdue).map((x) => x.group));
  const toneOf = (key: string, n: number) =>
    late.has(key) ? "danger" : n ? "warning" : "success";
  const TONE = {
    danger: {
      box: "border-red-300 bg-red-50 hover:border-red-500",
      dot: "bg-red-600 text-white",
    },
    warning: {
      box: "border-amber-300 bg-amber-50 hover:border-amber-500",
      dot: "bg-amber-500 text-white",
    },
    success: {
      box: "border-emerald-200 bg-emerald-50 hover:border-emerald-400",
      dot: "bg-emerald-600 text-white",
    },
  } as const;
  const activeStep = flow.steps.find((step) => step.group === group) ?? null;
  return (
    <section className="mb-4" data-supplier-steps>
      <p className="mb-3 text-sm text-zinc-600">{t(flow.intro)}</p>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {t("supplierTasks.steps.title")}
        </h2>
        <Link
          href={tasksHref(due, null)}
          aria-pressed={!group}
          data-task-filter="type:all"
          className={cx(
            "inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 py-0.5 text-xs font-medium transition",
            !group
              ? "border-brand-600 bg-brand-600 text-white"
              : "border-zinc-300 bg-white text-zinc-700 hover:border-brand-300 hover:bg-brand-50",
          )}
        >
          {t("supplierTasks.steps.all")} · {tasks.length}
        </Link>
      </div>
      {/* Fluxo do processo: quadrados pequenos, um ao lado do outro, na
          ordem das etapas (pedido do dono). Em tela estreita a faixa rola
          para o lado. O que fazer em cada etapa aparece ao escolher. */}
      <ol
        className="flex items-stretch gap-1 overflow-x-auto pb-1"
        data-supplier-flow
      >
        {flow.steps.map(({ id: step, group: key, help }, i) => {
          const n = counts.get(key) ?? 0;
          const active = group === key;
          const tone = toneOf(key, n);
          return (
            <li key={step} className="flex shrink-0 items-center gap-1">
              {i > 0 ? (
                <span aria-hidden className="text-sm text-zinc-400">
                  →
                </span>
              ) : null}
              <Link
                href={tasksHref(due, active ? null : key)}
                aria-pressed={active}
                title={t(help)}
                data-task-filter={`type:${key}`}
                data-supplier-step={step}
                data-supplier-step-count={n}
                className={cx(
                  "flex h-full items-center gap-1.5 rounded-lg border px-2 py-1.5 transition",
                  TONE[tone].box,
                  active && "ring-2 ring-zinc-900",
                )}
                data-supplier-step-tone={tone}
              >
                <span
                  aria-hidden
                  className={cx(
                    "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                    TONE[tone].dot,
                  )}
                >
                  {i + 1}
                </span>
                <span className="whitespace-nowrap text-xs font-semibold text-zinc-900">
                  {t(`tasks.group.${key}` as DictionaryKey)}
                </span>
                {n ? (
                  <span
                    className={cx(
                      "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold",
                      TONE[tone].dot,
                    )}
                    aria-label={
                      n === 1
                        ? t("supplierTasks.steps.count1")
                        : t("supplierTasks.steps.count", { n })
                    }
                  >
                    {n}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ol>
      <p
        className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600"
        data-supplier-flow-legend
      >
        {(["danger", "warning", "success"] as const).map((tone) => (
          <span key={tone} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className={cx("h-2.5 w-2.5 rounded-full", TONE[tone].dot)}
            />
            {t(`supplierTasks.legend.${tone}`)}
          </span>
        ))}
      </p>
      {activeStep ? (
        <p className="mt-1 text-sm text-zinc-700" data-supplier-step-help>
          {t(activeStep.help)}
        </p>
      ) : null}
      <p className="mt-2 text-xs text-zinc-500">{t(flow.after)}</p>
    </section>
  );
}

/** Filtros por prazo e por tipo, com contagem; chip ativo em destaque. */
function TaskFilters({
  tasks,
  due,
  group,
  t,
  supplier = false,
}: {
  tasks: Task[];
  due: string | null;
  group: string | null;
  t: Translate;
  /** Fornecedor: as etapas ficam nos cartões acima; aqui, só o prazo. */
  supplier?: boolean;
}) {
  // Fora das etapas do fornecedor (não deve haver): continuam filtráveis.
  const groups = taskGroups(tasks).filter(
    (g) =>
      !supplier ||
      !(supplierStepOfGroup(g.group) || g.group.startsWith("agency.")),
  );
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
    <div className="mb-3 space-y-2" data-task-filters>
      <p className="text-xs text-zinc-500">
        {t(supplier ? "supplierTasks.due.hint" : "tasks.sortHint")}
      </p>
      {/* Prazo e tipo na mesma linha quando cabem. */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
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
        {groups.length > (supplier ? 0 : 1) ? (
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

/**
 * Lista de pendências em linhas (também usada no início do cliente, em
 * Solicitações): a mesma tabela das outras telas (Pedidos, Control Tower),
 * uma pendência por linha, na ordem do prazo, com o botão Abrir na linha.
 */
export function TaskItems({
  tasks,
  t,
  since = false,
}: {
  tasks: Task[];
  t: Translate;
  /** Fornecedor: coluna "Com você desde" e o nome da etapa dele. */
  since?: boolean;
}) {
  /** "hoje", "há 1 dia", "há 5 dias". */
  const ago = (iso: string) => {
    const n = -(daysUntil(iso) ?? 0);
    return n <= 0
      ? t("supplierTasks.since.today")
      : n === 1
        ? t("supplierTasks.since.day1")
        : t("supplierTasks.since.days", { n });
  };
  return (
    <Table>
      <thead>
        <tr>
          <Th>{t("tasks.col.task")}</Th>
          <Th>{t("tasks.col.detail")}</Th>
          <Th>{t(since ? "supplierTasks.col.step" : "tasks.filter.type")}</Th>
          {since ? <Th>{t("supplierTasks.col.since")}</Th> : null}
          <Th>{t("common.due")}</Th>
          <Th className="text-right">
            <span className="sr-only">{t("tasks.open")}</span>
          </Th>
        </tr>
      </thead>
      <tbody>
        {tasks.map((task, i) => {
          // Requisito de etapa: etapa traduzida (o serviço guarda a chave).
          const title = task.text
            ? t(task.text.title, task.text.values)
            : task.supplierStep && task.stageKey && task.orderNumber
              ? t("supplierTasks.orderStep", {
                  n: task.orderNumber,
                  step: t(`tasks.group.${task.group}` as DictionaryKey),
                })
              : task.stageKey && task.orderNumber
                ? t("tasks.orderStage", {
                    n: task.orderNumber,
                    stage: t(`stage.${task.stageKey}` as DictionaryKey),
                  })
                : task.title;
          // Item de etapa do fornecedor: o que fazer, no idioma dele (os
          // rótulos dos itens do pedido são gravados em português).
          const detail = task.text
            ? [
                t(task.text.detail, task.text.values),
                task.text.detailExtra
                  ? t(task.text.detailExtra, task.text.values)
                  : "",
              ]
                .filter(Boolean)
                .join(" ")
            : since && task.supplierStep && task.kind === "requirement"
              ? t(`supplierTasks.help.${task.supplierStep}` as DictionaryKey)
              : task.detail;
          const relative = dueLabel(task, t);
          return (
            <tr
              key={i}
              data-task-row
              data-task-due={task.due}
              data-task-group={task.group}
              className={rowClass}
            >
              {/* Título com cara de link (como o nº em Pedidos) e o selo ao lado: no celular a 1ª coluna já diz tudo. */}
              <Td className="min-w-40">
                <TextLink href={task.link} className="font-semibold">
                  {title}
                </TextLink>
                {task.overdue ? (
                  <span className="ml-1.5 align-middle">
                    <Badge tone="danger">{t("common.overdue")}</Badge>
                  </span>
                ) : task.due === "today" ? (
                  <span className="ml-1.5 align-middle">
                    <Badge tone="warning">{t("tasks.due.today")}</Badge>
                  </span>
                ) : null}
              </Td>
              <Td className="min-w-32 text-zinc-600">{detail || "—"}</Td>
              <Td className="whitespace-nowrap text-zinc-700">
                {groupLabel(task.group, !!task.stageKey, t)}
              </Td>
              {since ? (
                <Td className="whitespace-nowrap tabular-nums" data-task-since>
                  {task.sinceAt ? (
                    <>
                      {formatDate(task.sinceAt, t)}
                      <span className="block text-xs text-zinc-500">
                        {ago(task.sinceAt)}
                      </span>
                    </>
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                  {task.loadedAt ? (
                    <span
                      className="block text-xs text-zinc-500"
                      data-task-loaded
                    >
                      {t("supplierTasks.loaded", {
                        date: formatDate(task.loadedAt, t),
                      })}
                    </span>
                  ) : null}
                </Td>
              ) : null}
              <Td
                className={cx(
                  "whitespace-nowrap tabular-nums",
                  task.overdue && "font-semibold text-red-700",
                )}
              >
                {task.dueAt ? (
                  <>
                    {formatDate(task.dueAt, t)}
                    {relative ? (
                      <span
                        className={cx(
                          "block text-xs font-normal",
                          task.overdue ? "text-red-700" : "text-zinc-500",
                        )}
                      >
                        {relative}
                      </span>
                    ) : null}
                  </>
                ) : (
                  <span className="text-zinc-400">—</span>
                )}
              </Td>
              <Td className="whitespace-nowrap text-right">
                <span className="inline-flex items-center gap-1.5">
                  <LinkButton
                    href={task.link}
                    variant="primary"
                    className="min-h-8 px-3 py-1 text-xs"
                  >
                    {t("tasks.open")}
                    <span className="sr-only">: {title}</span>
                  </LinkButton>
                  {/* Conversa do pedido/solicitação: sempre no fim da linha. */}
                  {(task.chat ?? chatTargetFromHref(task.link)) ? (
                    <ChatOpenButton
                      target={(task.chat ?? chatTargetFromHref(task.link))!}
                      label={t("chat.open")}
                    />
                  ) : null}
                </span>
              </Td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}
