import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { isAdmin, isWellmix } from "@/lib/auth/permissions";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  Alert,
  Badge,
  Card,
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
  ALL,
  UNASSIGNED,
  slaBoardFor,
  type SlaItem,
  type SlaPerson,
} from "@/lib/services/sla-panel";

/*
 * Painel de SLA (docs/SLA_PANEL.md): o que cada operador deve, pelo prazo, na
 * carteira de clientes dele, e o que está atrasado com parceiros para ele
 * cobrar. Quem tem equipe vê a tabela de todos abaixo dele e escolhe uma
 * pessoa (?u=); o administrador vê todos e "Sem responsável".
 */

type Translate = Awaited<ReturnType<typeof getT>>;

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

function ItemList({ t, items }: { t: Translate; items: SlaItem[] }) {
  return (
    <ul className="divide-y divide-zinc-100">
      {items.map((item, i) => (
        <li
          key={`${item.link}-${i}`}
          className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-2"
          data-sla-item={item.source}
        >
          <div className="min-w-0">
            <Link
              href={item.link}
              className="font-medium text-zinc-900 hover:text-brand-700 hover:underline"
            >
              {item.title}
            </Link>
            {item.stageKey ? (
              <span className="ml-1.5 text-xs text-zinc-500">
                · {t(`stage.${item.stageKey}` as DictionaryKey)}
              </span>
            ) : null}
            <div className="text-xs text-zinc-500">
              {[
                item.detail || null,
                item.customerName
                  ? t("sla.customer", { name: item.customerName })
                  : null,
                item.waitingOn?.length
                  ? t("sla.waiting", {
                      who:
                        item.waitingParty ??
                        item.waitingOn
                          .map((r) => t(`role.${r}` as DictionaryKey))
                          .join(", "),
                    })
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 text-xs">
            {item.dueAt ? (
              <span className="tabular-nums text-zinc-500">
                {formatDate(item.dueAt, t)}
              </span>
            ) : null}
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
          </div>
        </li>
      ))}
    </ul>
  );
}

export default async function SlaPage({ searchParams }: PageProps<"/app/sla">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isWellmix(user)) redirect("/app");
  const t = await getT();
  const { u } = await searchParams;
  const board = await slaBoardFor(user, typeof u === "string" ? u : null);
  const admin = isAdmin(user);

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

  const sections: Array<{ key: string; title: string; items: SlaItem[] }> = [
    {
      key: "overdue",
      title: t("sla.section.overdue"),
      items: board.items.filter(
        (i) => i.source === "task" && i.due === "overdue",
      ),
    },
    {
      key: "today",
      title: t("sla.section.today"),
      items: board.items.filter(
        (i) => i.source === "task" && i.due === "today",
      ),
    },
    {
      key: "week",
      title: t("sla.section.week"),
      items: board.items.filter((i) => i.source === "task" && i.due === "week"),
    },
    {
      key: "partner",
      title: t("sla.section.partner"),
      items: board.items.filter((i) => i.source === "partner"),
    },
    {
      key: "later",
      title: t("sla.section.later"),
      items: board.items.filter(
        (i) => i.source === "task" && (i.due === "later" || i.due === "none"),
      ),
    },
  ];

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

      {showingMine && me && me.customers === 0 && !admin ? (
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
                <Th className="text-right">{t("sla.col.customers")}</Th>
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
                  <Td className="text-right tabular-nums">{p.customers}</Td>
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

      <h2
        className="mb-2 text-sm font-semibold text-zinc-700"
        data-sla-selected={board.selected}
      >
        {t("sla.viewing", { name: nameOf(board.selected) })}
      </h2>
      {board.selected === UNASSIGNED ? (
        <div className="mb-3">
          <Alert tone="warning">{t("sla.unassignedHint")}</Alert>
        </div>
      ) : null}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat
          label={t("sla.col.overdue")}
          value={board.totals.overdue}
          tone={board.totals.overdue ? "danger" : "neutral"}
        />
        <Stat
          label={t("sla.col.today")}
          value={board.totals.today}
          tone={board.totals.today ? "warning" : "neutral"}
        />
        <Stat label={t("sla.col.week")} value={board.totals.week} />
        <Stat
          label={t("sla.col.partner")}
          value={board.totals.partnerLate}
          tone={board.totals.partnerLate ? "warning" : "neutral"}
        />
        <Stat
          label={t("sla.col.onTime")}
          value={<OnTime t={t} value={board.onTime} />}
        />
      </div>

      {board.items.length === 0 ? (
        <Alert tone="success">{t("sla.allClear")}</Alert>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {sections
            .filter((s) => s.items.length > 0)
            .map((s) => (
              <Card
                key={s.key}
                title={`${s.title} (${s.items.length})`}
                className={cx(
                  s.key === "overdue" && "border-red-200",
                  s.key === "partner" && "border-amber-200",
                )}
              >
                <div data-sla-section={s.key}>
                  <ItemList t={t} items={s.items} />
                </div>
              </Card>
            ))}
        </div>
      )}
    </>
  );
}
