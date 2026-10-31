import Link from "next/link";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { isAdmin } from "@/lib/auth/permissions";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  Alert,
  Badge,
  Card,
  Empty,
  LinkButton,
  PageHeader,
  Stat,
  Table,
  Td,
  TextLink,
  Th,
  cx,
  formatDate,
  rowClass,
} from "@/components/ui";
import {
  ChatOpenButton,
  chatTargetFromHref,
} from "@/components/chat-open-button";
import {
  ALL,
  UNASSIGNED,
  slaBoardFor,
  type SlaBoard,
  type SlaItem,
  type SlaPerson,
} from "@/lib/services/sla-panel";

/*
 * Painel de SLA (docs/SLA_PANEL.md): o que cada operador deve, pelo prazo, na
 * carteira de clientes dele, e o que está atrasado com parceiros para ele
 * cobrar. Quem tem equipe vê a tabela de todos abaixo dele e escolhe uma
 * pessoa (?u=); o administrador vê todos e "Sem responsável". Os cartões de
 * totais são filtros (?show=): tocar num deles abre, embaixo, a tabela em
 * linhas daquele grupo (atrasadas, vencem hoje, 7 dias, depois, parceiros,
 * etapas no prazo), como na Control Tower.
 */

type Translate = Awaited<ReturnType<typeof getT>>;

/** Grupos dos cartões; "all" é a tabela inteira (padrão). */
const SHOW = [
  "all",
  "overdue",
  "today",
  "week",
  "later",
  "partner",
  "onTime",
] as const;
type Show = (typeof SHOW)[number];

function itemsOf(items: SlaItem[], show: Show): SlaItem[] {
  switch (show) {
    case "overdue":
    case "today":
    case "week":
      return items.filter((i) => i.source === "task" && i.due === show);
    case "later":
      return items.filter(
        (i) => i.source === "task" && (i.due === "later" || i.due === "none"),
      );
    case "partner":
      return items.filter((i) => i.source === "partner");
    default:
      return items;
  }
}

function pct(done: number, total: number) {
  return total ? Math.round((done / total) * 100) : null;
}

function OnTime({
  t,
  value,
}: {
  t: Translate;
  value: { done: number; total: number };
}) {
  const p = pct(value.done, value.total);
  if (p === null) return <span className="text-zinc-400">—</span>;
  return (
    <span
      className={cx(
        "font-semibold tabular-nums",
        p >= 90
          ? "text-emerald-700"
          : p >= 70
            ? "text-amber-700"
            : "text-red-700",
      )}
    >
      {t("sla.onTimeValue", { pct: p, done: value.done, total: value.total })}
    </span>
  );
}

function dueText(t: Translate, item: SlaItem) {
  if (item.daysLeft === null) return t("sla.noDue");
  if (item.daysLeft < 0) return t("sla.daysLate", { n: -item.daysLeft });
  if (item.daysLeft === 0) return t("sla.dueToday");
  return t("sla.dueIn", { n: item.daysLeft });
}

/** Tabela em linhas das pendências do grupo escolhido. */
function ItemsTable({
  t,
  items,
  showOwner,
  nameOf,
}: {
  t: Translate;
  items: SlaItem[];
  /** Coluna "Responsável" (quando a visão é de mais de uma pessoa). */
  showOwner: boolean;
  nameOf: (id: string) => string;
}) {
  const waiting = items.some((i) => i.waitingOn?.length);
  return (
    <Table>
      <thead>
        <tr>
          <Th>{t("sla.col.item")}</Th>
          <Th>{t("sla.col.detail")}</Th>
          <Th>{t("common.customer")}</Th>
          {showOwner ? <Th>{t("common.responsible")}</Th> : null}
          {waiting ? <Th>{t("sla.col.waiting")}</Th> : null}
          <Th>{t("common.due")}</Th>
          <Th className="text-right">
            <span className="sr-only">{t("tasks.open")}</span>
          </Th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, i) => (
          <tr
            key={`${item.link}-${i}`}
            className={rowClass}
            data-sla-item={item.source}
          >
            <Td className="min-w-40">
              <TextLink href={item.link} className="font-semibold">
                {item.title}
              </TextLink>
              {chatTargetFromHref(item.link) ? (
                <span className="ml-1 inline-block align-middle">
                  <ChatOpenButton
                    target={chatTargetFromHref(item.link)!}
                    label={t("chat.open")}
                  />
                </span>
              ) : null}
              {item.stageKey ? (
                <span className="block text-xs font-normal text-zinc-500">
                  {t(`stage.${item.stageKey}` as DictionaryKey)}
                </span>
              ) : null}
            </Td>
            <Td className="min-w-32 text-zinc-600">{item.detail || "—"}</Td>
            <Td className="text-zinc-700">{item.customerName ?? "—"}</Td>
            {showOwner ? (
              <Td className="whitespace-nowrap text-zinc-700">
                {nameOf(item.ownerId)}
              </Td>
            ) : null}
            {waiting ? (
              <Td className="text-zinc-700">
                {item.waitingOn?.length
                  ? (item.waitingParty ??
                    item.waitingOn
                      .map((r) => t(`role.${r}` as DictionaryKey))
                      .join(", "))
                  : "—"}
              </Td>
            ) : null}
            <Td
              className={cx(
                "whitespace-nowrap tabular-nums",
                item.daysLeft !== null &&
                  item.daysLeft < 0 &&
                  "font-semibold text-red-700",
              )}
            >
              {item.dueAt ? formatDate(item.dueAt, t) : null}
              <span className={cx("align-middle", item.dueAt && "ml-1.5")}>
                <Badge
                  tone={
                    item.daysLeft === null
                      ? "neutral"
                      : item.daysLeft < 0
                        ? "danger"
                        : item.daysLeft === 0
                          ? "warning"
                          : "info"
                  }
                >
                  {dueText(t, item)}
                </Badge>
              </span>
            </Td>
            <Td className="whitespace-nowrap text-right">
              <LinkButton
                href={item.link}
                variant="primary"
                className="min-h-8 px-3 py-1 text-xs"
              >
                {t("tasks.open")}
                <span className="sr-only">: {item.title}</span>
              </LinkButton>
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

/** Tabela das etapas por trás de "Etapas no prazo (30 dias)". */
function StagesTable({
  t,
  stages,
  showOwner,
  nameOf,
}: {
  t: Translate;
  stages: SlaBoard["recentStages"];
  showOwner: boolean;
  nameOf: (id: string) => string;
}) {
  return (
    <Table>
      <thead>
        <tr>
          <Th>#</Th>
          <Th>{t("orders.stage")}</Th>
          <Th>{t("common.customer")}</Th>
          {showOwner ? <Th>{t("common.responsible")}</Th> : null}
          <Th>{t("common.due")}</Th>
          <Th>{t("sla.col.completed")}</Th>
          <Th>{t("common.status")}</Th>
        </tr>
      </thead>
      <tbody>
        {stages.map((s, i) => (
          <tr
            key={`${s.orderId}-${s.stageKey}-${i}`}
            className={rowClass}
            data-sla-stage={s.onTime ? "on-time" : "late"}
          >
            <Td className="whitespace-nowrap">
              <TextLink href={s.link}>#{s.orderNumber || "—"}</TextLink>
            </Td>
            <Td className="whitespace-nowrap font-medium text-zinc-900">
              {t(`stage.${s.stageKey}` as DictionaryKey)}
            </Td>
            <Td className="text-zinc-700">{s.customerName ?? "—"}</Td>
            {showOwner ? (
              <Td className="whitespace-nowrap text-zinc-700">
                {nameOf(s.ownerId)}
              </Td>
            ) : null}
            <Td className="whitespace-nowrap tabular-nums">
              {formatDate(s.dueAt, t)}
            </Td>
            <Td className="whitespace-nowrap tabular-nums">
              {formatDate(s.completedAt, t)}
            </Td>
            <Td className="whitespace-nowrap">
              <Badge tone={s.onTime ? "success" : "danger"}>
                {s.onTime ? t("sla.onTimeYes") : t("sla.onTimeNo")}
              </Badge>
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

export default async function SlaPage({ searchParams }: PageProps<"/app/sla">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "sla");
  const t = await getT();
  const { u, show: showParam } = await searchParams;
  const board = await slaBoardFor(user, typeof u === "string" ? u : null);
  const admin = isAdmin(user);
  const show: Show = (SHOW as readonly string[]).includes(
    typeof showParam === "string" ? showParam : "",
  )
    ? (showParam as Show)
    : "all";

  const rows: SlaPerson[] = [
    ...board.people,
    ...(board.unassigned ? [board.unassigned] : []),
  ];
  const nameOf = (id: string) =>
    id === ALL
      ? t("sla.all")
      : id === UNASSIGNED
        ? t("sla.unassigned")
        : (board.people.find((p) => p.id === id)?.name ?? "—");
  const me = board.people.find((p) => p.id === user.id);
  const showingMine = board.selected === user.id;
  const showOwner = board.selected === ALL;
  // Os cartões trocam só o grupo; a pessoa escolhida (?u=) fica.
  const href = (next: Show) => {
    const p = new URLSearchParams();
    if (typeof u === "string" && u) p.set("u", u);
    if (next !== "all") p.set("show", next);
    const q = p.toString();
    return q ? `/app/sla?${q}` : "/app/sla";
  };

  const cards: Array<{
    key: Exclude<Show, "all">;
    label: string;
    value: ReactNode;
    tone?: "danger" | "warning";
  }> = [
    {
      key: "overdue",
      label: t("sla.col.overdue"),
      value: board.totals.overdue,
      tone: board.totals.overdue ? "danger" : undefined,
    },
    {
      key: "today",
      label: t("sla.col.today"),
      value: board.totals.today,
      tone: board.totals.today ? "warning" : undefined,
    },
    { key: "week", label: t("sla.col.week"), value: board.totals.week },
    { key: "later", label: t("sla.col.later"), value: board.totals.later },
    {
      key: "partner",
      label: t("sla.col.partner"),
      value: board.totals.partnerLate,
      tone: board.totals.partnerLate ? "warning" : undefined,
    },
    {
      key: "onTime",
      label: t("sla.col.onTime"),
      value: <OnTime t={t} value={board.onTime} />,
    },
  ];
  const sectionTitle: Record<Show, string> = {
    all: t("sla.show.all"),
    overdue: t("sla.section.overdue"),
    today: t("sla.section.today"),
    week: t("sla.section.week"),
    later: t("sla.section.later"),
    partner: t("sla.section.partner"),
    onTime: t("sla.col.onTime"),
  };
  const shown = show === "onTime" ? [] : itemsOf(board.items, show);
  const count = show === "onTime" ? board.recentStages.length : shown.length;

  return (
    <>
      <PageHeader
        t={t}
        title={t("sla.title")}
        subtitle={t("sla.subtitle")}
        actions={
          admin ? <TextLink href="/app/team">{t("sla.setup")}</TextLink> : null
        }
      />

      {showingMine && me && !me.division && !admin ? (
        <div className="mb-3">
          <Alert tone="info">{t("sla.noPortfolio")}</Alert>
        </div>
      ) : null}

      {board.manages ? (
        <Card title={t("sla.team")} className="mb-4">
          <Table>
            <thead>
              <tr>
                <Th>{t("sla.col.person")}</Th>
                <Th>{t("sla.col.level")}</Th>
                <Th>{t("sla.col.customers")}</Th>
                <Th className="text-right">{t("sla.col.overdue")}</Th>
                <Th className="text-right">{t("sla.col.today")}</Th>
                <Th className="text-right">{t("sla.col.week")}</Th>
                <Th className="text-right">{t("sla.col.partner")}</Th>
                <Th className="text-right">{t("sla.col.onTime")}</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.map((p) => (
                <tr
                  key={p.id}
                  className={cx(
                    rowClass,
                    board.selected === p.id && "bg-brand-50/60",
                  )}
                  data-sla-person={p.id}
                >
                  <Td>
                    <Link
                      href={`/app/sla?u=${encodeURIComponent(p.id)}`}
                      className="font-medium text-zinc-900 hover:text-brand-700 hover:underline"
                      style={{ paddingLeft: `${p.depth * 1.25}rem` }}
                    >
                      {p.depth ? "↳ " : ""}
                      {p.id === UNASSIGNED ? t("sla.unassigned") : p.name}
                    </Link>
                  </Td>
                  <Td className="text-zinc-600">
                    {p.jobLevel
                      ? t(`level.${p.jobLevel}` as DictionaryKey)
                      : "—"}
                  </Td>
                  <Td className="text-zinc-600">
                    {p.division
                      ? t(`division.${p.division}` as DictionaryKey)
                      : "—"}
                  </Td>
                  <Td
                    className={cx(
                      "text-right tabular-nums",
                      p.counts.overdue > 0 && "font-semibold text-red-700",
                    )}
                  >
                    {p.counts.overdue}
                  </Td>
                  <Td
                    className={cx(
                      "text-right tabular-nums",
                      p.counts.today > 0 && "font-semibold text-amber-700",
                    )}
                  >
                    {p.counts.today}
                  </Td>
                  <Td className="text-right tabular-nums">{p.counts.week}</Td>
                  <Td
                    className={cx(
                      "text-right tabular-nums",
                      p.counts.partnerLate > 0 &&
                        "font-semibold text-amber-700",
                    )}
                  >
                    {p.counts.partnerLate}
                  </Td>
                  <Td className="text-right">
                    <OnTime t={t} value={p.onTime} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <div className="mt-2 flex flex-wrap gap-2 text-sm">
            <TextLink href={`/app/sla?u=${ALL}`}>{t("sla.all")}</TextLink>
            {me ? (
              <TextLink href={`/app/sla?u=${encodeURIComponent(user.id)}`}>
                {me.name}
              </TextLink>
            ) : null}
          </div>
        </Card>
      ) : null}

      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2
          className="text-sm font-semibold text-zinc-700"
          data-sla-selected={board.selected}
        >
          {t("sla.viewing", { name: nameOf(board.selected) })}
        </h2>
        <p className="text-xs text-zinc-500">{t("sla.show.hint")}</p>
      </div>
      {board.selected === UNASSIGNED ? (
        <div className="mb-3">
          <Alert tone="warning">{t("sla.unassignedHint")}</Alert>
        </div>
      ) : null}
      {/* Cartões menores, como filtros: o escolhido fica marcado. */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <Stat
            key={c.key}
            compact
            label={c.label}
            value={c.value}
            href={href(c.key)}
            tone={show === c.key ? undefined : c.tone}
            active={show === c.key}
          />
        ))}
      </div>

      <Card
        title={`${sectionTitle[show]} (${count})`}
        actions={
          show !== "all" ? (
            <TextLink href={href("all")} className="text-sm">
              {t("sla.show.all")}
            </TextLink>
          ) : null
        }
        className={cx(
          show === "overdue" && "border-red-200",
          show === "partner" && "border-amber-200",
        )}
      >
        <div data-sla-section={show}>
          {show === "onTime" ? (
            <>
              <p className="mb-2 text-xs text-zinc-500">
                {t("sla.onTimeHint")}
              </p>
              {board.recentStages.length === 0 ? (
                <Empty>{t("sla.onTimeEmpty")}</Empty>
              ) : (
                <StagesTable
                  t={t}
                  stages={board.recentStages}
                  showOwner={showOwner}
                  nameOf={nameOf}
                />
              )}
            </>
          ) : board.items.length === 0 ? (
            <Alert tone="success">{t("sla.allClear")}</Alert>
          ) : shown.length === 0 ? (
            <Empty>{t("sla.empty")}</Empty>
          ) : (
            <ItemsTable
              t={t}
              items={shown}
              showOwner={showOwner}
              nameOf={nameOf}
            />
          )}
        </div>
      </Card>
    </>
  );
}
