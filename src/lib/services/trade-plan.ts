import "server-only";
import {
  TRADE_ACTIVITY_STATUSES,
  getStore,
  type CustomerGroup,
  type Party,
  type TradeActivity,
  type TradeActivityStatus,
  type User,
} from "@/lib/db";
import { listByIds } from "@/lib/db/lookup";
import { ForbiddenError, isWellmix } from "@/lib/auth/permissions";
import { audit } from "./audit";
import { notify } from "./notifications";
import {
  PortfolioError,
  brDay,
  canManagePortfolio,
  canUsePortfolio,
} from "./portfolio";
import { visibleTeamIds, wellmixTeam } from "./team";

/*
 * Plano de ação Trade (dono, 18/11/2026; docs/TRADE_COMERCIAL.md, PR 2; a tela
 * 12 do painel do Projeto Campineira): a ação com responsável e prazo, do
 * cliente ou do grupo econômico. Quem gere a carteira cria, edita e cancela;
 * o responsável avança a situação e conclui com a resposta ou a evidência.
 * Aberta, é pendência do responsável e conta no Painel de SLA.
 */

/** Situações em aberto (pendência do responsável). */
export const OPEN_STATUSES: readonly TradeActivityStatus[] = [
  "pending",
  "investigating",
  "pilot",
];
export const isOpenStatus = (s: TradeActivityStatus) =>
  OPEN_STATUSES.includes(s);
export const isTradeStatus = (v: unknown): v is TradeActivityStatus =>
  typeof v === "string" &&
  (TRADE_ACTIVITY_STATUSES as readonly string[]).includes(v);

/** Fotos ou arquivos de evidência por ação. */
export const MAX_EVIDENCE_FILES = 6;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Dia válido (AAAA-MM-DD) do calendário. */
export function validDay(day: string): boolean {
  if (!DAY.test(day)) return false;
  const d = new Date(`${day}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === day;
}

/** Aberta e com o prazo vencido (dia de Brasília). */
export function isLate(
  a: Pick<TradeActivity, "status" | "dueDate">,
  now = new Date(),
): boolean {
  return isOpenStatus(a.status) && a.dueDate < brDay(now);
}

/** Concluída no prazo (nulo enquanto não concluída). */
export function doneOnTime(
  a: Pick<TradeActivity, "status" | "doneAt" | "dueDate">,
): boolean | null {
  if (a.status !== "done" || !a.doneAt) return null;
  return brDay(a.doneAt) <= a.dueDate;
}

function assertUse(user: User) {
  if (!canUsePortfolio(user)) throw new ForbiddenError();
}
function assertManage(user: User) {
  if (!canManagePortfolio(user)) throw new ForbiddenError();
}

/* ------------------------------------------------------------------------ */
/* Escrita                                                                   */
/* ------------------------------------------------------------------------ */

export interface TradeActivityInput {
  title: string;
  description: string | null;
  customerId: string | null;
  groupId: string | null;
  productCode?: string | null;
  productName?: string | null;
  focus?: string | null;
  responsibleUserId: string;
  dueDate: string;
}

interface Checked {
  title: string;
  description: string | null;
  customerId: string | null;
  groupId: string | null;
  scopeName: string;
  dueDate: string;
}

async function check(
  input: TradeActivityInput,
  now: Date,
  creating: boolean,
  current: TradeActivity | null,
): Promise<Checked> {
  const title = input.title.trim();
  if (title.length < 3) throw new PortfolioError("trade_title_required");
  const store = getStore();
  // Do cliente ou do grupo (um dos dois).
  if (!!input.customerId === !!input.groupId)
    throw new PortfolioError("trade_scope_required");
  let scopeName = "";
  if (input.customerId) {
    const party = await store.get("parties", input.customerId);
    if (!party || party.type !== "customer")
      throw new PortfolioError("customer_not_found");
    scopeName = party.name;
  } else if (input.groupId) {
    const group = await store.get("customer_groups", input.groupId);
    if (!group || (group.archivedAt && group.id !== current?.groupId))
      throw new PortfolioError("group_not_found");
    scopeName = group.name;
  }
  if (input.responsibleUserId !== current?.responsibleUserId) {
    const team = await wellmixTeam();
    const ok = team.some(
      (u) => u.id === input.responsibleUserId && !u.loginSuspended,
    );
    if (!ok) throw new PortfolioError("owner_invalid");
  }
  if (!validDay(input.dueDate)) throw new PortfolioError("trade_due_invalid");
  if (creating && input.dueDate < brDay(now))
    throw new PortfolioError("trade_due_past");
  return {
    title,
    description: input.description?.trim() || null,
    customerId: input.customerId,
    groupId: input.groupId,
    scopeName,
    dueDate: input.dueDate,
  };
}

const dayBr = (day: string) =>
  `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}`;

async function notifyAssigned(a: TradeActivity, scopeName: string) {
  await notify(
    { userIds: [a.responsibleUserId] },
    {
      kind: "action",
      link: `/app/portfolio/plan/${a.id}`,
      text: (t) => ({
        subject: t("tradePlan.notify.assigned.subject", { title: a.title }),
        body: t("tradePlan.notify.assigned.body", {
          scope: scopeName,
          date: dayBr(a.dueDate),
        }),
      }),
    },
  ).catch((error) => console.error("notify(trade.assigned)", error));
}

/** Nova ação do plano (quem gere a carteira). */
export async function createTradeActivity(
  user: User,
  input: TradeActivityInput,
  now = new Date(),
): Promise<TradeActivity> {
  assertManage(user);
  const c = await check(input, now, true, null);
  const created = await getStore().create("trade_activities", {
    title: c.title,
    description: c.description,
    customerId: c.customerId,
    groupId: c.groupId,
    productCode: input.productCode?.trim() || null,
    productName: input.productName?.trim() || null,
    focus: input.focus?.trim() || null,
    responsibleUserId: input.responsibleUserId,
    dueDate: c.dueDate,
    status: "pending",
    notes: null,
    documentIds: null,
    doneAt: null,
    doneByUserId: null,
    cancelledAt: null,
    createdByUserId: user.id,
  });
  await audit(
    user,
    "trade.activity.create",
    "trade_activity",
    created.id,
    `${c.title} · ${c.scopeName} · prazo ${c.dueDate}`,
  );
  if (created.responsibleUserId !== user.id)
    await notifyAssigned(created, c.scopeName);
  return created;
}

/** Edita a ação em aberto (quem gere a carteira). */
export async function updateTradeActivity(
  user: User,
  id: string,
  input: TradeActivityInput,
  now = new Date(),
): Promise<TradeActivity> {
  assertManage(user);
  const store = getStore();
  const before = await store.get("trade_activities", id);
  if (!before) throw new PortfolioError("trade_not_found");
  if (!isOpenStatus(before.status)) throw new PortfolioError("trade_closed");
  const c = await check(input, now, false, before);
  const after = await store.update("trade_activities", id, {
    title: c.title,
    description: c.description,
    customerId: c.customerId,
    groupId: c.groupId,
    responsibleUserId: input.responsibleUserId,
    dueDate: c.dueDate,
  });
  await audit(
    user,
    "trade.activity.update",
    "trade_activity",
    id,
    c.title,
    {
      title: before.title,
      responsibleUserId: before.responsibleUserId,
      dueDate: before.dueDate,
    },
    {
      title: after.title,
      responsibleUserId: after.responsibleUserId,
      dueDate: after.dueDate,
    },
  );
  if (
    after.responsibleUserId !== before.responsibleUserId &&
    after.responsibleUserId !== user.id
  )
    await notifyAssigned(after, c.scopeName);
  return after;
}

/**
 * Situação, resposta e evidências: o responsável (ou quem gere a carteira)
 * avança a ação; concluir pede a resposta ou uma evidência; cancelar e
 * reabrir a concluída ficam com quem gere a carteira.
 */
export async function setTradeActivityStatus(
  user: User,
  id: string,
  input: { status: TradeActivityStatus; notes: string | null; files?: File[] },
  now = new Date(),
): Promise<TradeActivity> {
  assertUse(user);
  const store = getStore();
  const a = await store.get("trade_activities", id);
  if (!a) throw new PortfolioError("trade_not_found");
  const manage = canManagePortfolio(user);
  if (!manage && a.responsibleUserId !== user.id) throw new ForbiddenError();
  if (!isTradeStatus(input.status))
    throw new PortfolioError("trade_status_invalid");
  if (!isOpenStatus(a.status) && !manage)
    throw new PortfolioError("trade_closed");
  if (input.status === "cancelled" && !manage) throw new ForbiddenError();
  const files = input.files ?? [];
  const kept = a.documentIds ?? [];
  if (kept.length + files.length > MAX_EVIDENCE_FILES)
    throw new PortfolioError("too_many_files");
  const notes = input.notes?.trim() || null;
  if (input.status === "done" && !notes && !kept.length && !files.length)
    throw new PortfolioError("trade_evidence_required");
  const { assertUploadable, uploadDocument } = await import("./documents");
  for (const file of files) assertUploadable(file);
  const added: string[] = [];
  for (const file of files) {
    const doc = await uploadDocument(user, file, {
      type: file.type.startsWith("image/") ? "photo" : "attachment",
      visibility: "internal",
    });
    added.push(doc.id);
  }
  const done = input.status === "done";
  const cancelled = input.status === "cancelled";
  const updated = await store.update("trade_activities", id, {
    status: input.status,
    notes,
    documentIds: kept.length || added.length ? [...kept, ...added] : null,
    doneAt: done ? (a.status === "done" ? a.doneAt : now.toISOString()) : null,
    doneByUserId: done
      ? a.status === "done"
        ? a.doneByUserId
        : user.id
      : null,
    cancelledAt: cancelled
      ? a.status === "cancelled"
        ? a.cancelledAt
        : now.toISOString()
      : null,
  });
  if (a.status !== input.status || added.length || notes !== a.notes)
    await audit(
      user,
      "trade.activity.status",
      "trade_activity",
      id,
      a.title,
      { status: a.status },
      { status: input.status, files: added.length },
    );
  if (
    done &&
    a.status !== "done" &&
    a.createdByUserId &&
    a.createdByUserId !== user.id
  )
    await notify(
      { userIds: [a.createdByUserId] },
      {
        kind: "done",
        link: `/app/portfolio/plan/${a.id}`,
        text: (t) => ({
          subject: t("tradePlan.notify.done.subject", { title: a.title }),
          body: t("tradePlan.notify.done.body", { name: user.name }),
        }),
      },
    ).catch((error) => console.error("notify(trade.done)", error));
  return updated;
}

/* ------------------------------------------------------------------------ */
/* Leitura                                                                   */
/* ------------------------------------------------------------------------ */

export interface TradeActivityRow extends TradeActivity {
  responsibleName: string | null;
  scopeName: string;
  scopeKind: "customer" | "group";
  late: boolean;
  onTime: boolean | null;
}

export interface TradePlanFilters {
  status?: TradeActivityStatus | "open" | "late";
  responsibleId?: string;
  customerId?: string;
  groupId?: string;
  q?: string;
}

export interface TradePlanView {
  rows: TradeActivityRow[];
  /** Totais por situação (e atrasadas), antes do filtro de situação. */
  counts: Record<TradeActivityStatus | "late", number>;
  team: Array<{ id: string; name: string }>;
  groups: CustomerGroup[];
  canManage: boolean;
}

async function decorate(
  activities: TradeActivity[],
  now: Date,
): Promise<TradeActivityRow[]> {
  const store = getStore();
  const customerIds = [
    ...new Set(activities.map((a) => a.customerId).filter(Boolean)),
  ] as string[];
  const groupIds = [
    ...new Set(activities.map((a) => a.groupId).filter(Boolean)),
  ] as string[];
  const userIds = [...new Set(activities.map((a) => a.responsibleUserId))];
  const [parties, groups, users] = await Promise.all([
    customerIds.length
      ? listByIds(store, "parties", customerIds).catch(() => [] as Party[])
      : Promise.resolve([] as Party[]),
    groupIds.length
      ? listByIds(store, "customer_groups", groupIds).catch(
          () => [] as CustomerGroup[],
        )
      : Promise.resolve([] as CustomerGroup[]),
    userIds.length
      ? listByIds(store, "users", userIds).catch(() => [] as User[])
      : Promise.resolve([] as User[]),
  ]);
  const partyName = new Map(parties.map((p) => [p.id, p.name]));
  const groupName = new Map(groups.map((g) => [g.id, g.name]));
  const userName = new Map(users.map((u) => [u.id, u.name]));
  return activities.map((a) => ({
    ...a,
    responsibleName: userName.get(a.responsibleUserId) ?? null,
    scopeKind: a.groupId ? "group" : "customer",
    scopeName:
      (a.groupId
        ? groupName.get(a.groupId)
        : a.customerId
          ? partyName.get(a.customerId)
          : null) ?? "—",
    late: isLate(a, now),
    onTime: doneOnTime(a),
  }));
}

const STATUS_RANK: Record<TradeActivityStatus, number> = {
  pending: 0,
  investigating: 1,
  pilot: 2,
  done: 3,
  cancelled: 4,
};

/** Quem gere vê todas; os outros, as próprias e as da equipe abaixo. */
async function visibleActivities(user: User): Promise<TradeActivity[]> {
  const all = await getStore()
    .list("trade_activities", {})
    .catch(() => [] as TradeActivity[]);
  if (canManagePortfolio(user)) return all;
  const visible = visibleTeamIds(user, await wellmixTeam());
  return all.filter((a) => visible.has(a.responsibleUserId));
}

export async function loadTradePlan(
  user: User,
  filters: TradePlanFilters = {},
  now = new Date(),
): Promise<TradePlanView> {
  assertUse(user);
  const [mine, team, groups] = await Promise.all([
    visibleActivities(user),
    wellmixTeam(),
    getStore()
      .list("customer_groups", {})
      .catch(() => [] as CustomerGroup[]),
  ]);
  const q = (filters.q ?? "").trim().toLowerCase();
  const rows = (await decorate(mine, now)).filter(
    (r) =>
      (!filters.responsibleId ||
        r.responsibleUserId === filters.responsibleId) &&
      (!filters.customerId || r.customerId === filters.customerId) &&
      (!filters.groupId || r.groupId === filters.groupId) &&
      (!q ||
        `${r.title} ${r.scopeName} ${r.productCode ?? ""} ${r.productName ?? ""}`
          .toLowerCase()
          .includes(q)),
  );
  const counts: TradePlanView["counts"] = {
    pending: 0,
    investigating: 0,
    pilot: 0,
    done: 0,
    cancelled: 0,
    late: 0,
  };
  for (const r of rows) {
    counts[r.status]++;
    if (r.late) counts.late++;
  }
  const shown = rows
    .filter((r) =>
      !filters.status
        ? r.status !== "cancelled"
        : filters.status === "open"
          ? isOpenStatus(r.status)
          : filters.status === "late"
            ? r.late
            : r.status === filters.status,
    )
    .sort(
      (a, b) =>
        Number(b.late) - Number(a.late) ||
        STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
        a.dueDate.localeCompare(b.dueDate) ||
        a.title.localeCompare(b.title, "pt-BR"),
    );
  return {
    rows: shown,
    counts,
    team: team
      .filter((u) => !u.loginSuspended)
      .map((u) => ({ id: u.id, name: u.name })),
    groups: groups
      .filter((g) => !g.archivedAt)
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    canManage: canManagePortfolio(user),
  };
}

export interface TradeActivityView {
  row: TradeActivityRow;
  files: Array<{ id: string; name: string }>;
  createdByName: string | null;
  canManage: boolean;
  /** O responsável ou quem gere: avança a situação. */
  canUpdate: boolean;
  team: Array<{ id: string; name: string }>;
  groups: CustomerGroup[];
}

export async function loadTradeActivity(
  user: User,
  id: string,
  now = new Date(),
): Promise<TradeActivityView | null> {
  assertUse(user);
  const store = getStore();
  const a = await store.get("trade_activities", id).catch(() => null);
  if (!a) return null;
  const manage = canManagePortfolio(user);
  const team = await wellmixTeam();
  if (!manage && !visibleTeamIds(user, team).has(a.responsibleUserId))
    return null;
  const [row] = await decorate([a], now);
  const docs = a.documentIds?.length
    ? await listByIds(store, "documents", a.documentIds).catch(() => [])
    : [];
  const groups = await store
    .list("customer_groups", {})
    .catch(() => [] as CustomerGroup[]);
  return {
    row,
    files: docs.map((d) => ({ id: d.id, name: d.name })),
    createdByName: team.find((u) => u.id === a.createdByUserId)?.name ?? null,
    canManage: manage,
    canUpdate:
      (manage || a.responsibleUserId === user.id) &&
      (isOpenStatus(a.status) || manage),
    team: team
      .filter((u) => !u.loginSuspended)
      .map((u) => ({ id: u.id, name: u.name })),
    groups: groups
      .filter((g) => !g.archivedAt || g.id === a.groupId)
      .sort((x, y) => x.name.localeCompare(y.name, "pt-BR")),
  };
}

/** As ações do cliente ou do grupo que o login vê (fichas da carteira). */
export async function tradeActivitiesFor(
  user: User,
  scope: { customerId?: string; groupId?: string },
  now = new Date(),
): Promise<TradeActivityRow[]> {
  if (!isWellmix(user) || !canUsePortfolio(user)) return [];
  const mine = (await visibleActivities(user)).filter(
    (a) =>
      (scope.customerId && a.customerId === scope.customerId) ||
      (scope.groupId && a.groupId === scope.groupId),
  );
  return (await decorate(mine, now)).sort(
    (a, b) =>
      STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
      a.dueDate.localeCompare(b.dueDate),
  );
}

/** Cliente para escolher numa ação (o que veio da ficha, mesmo fora da carteira). */
export async function customerOption(
  user: User,
  id: string,
): Promise<{ id: string; name: string; code: string | null } | null> {
  assertUse(user);
  const party = await getStore()
    .get("parties", id)
    .catch(() => null);
  return party && party.type === "customer"
    ? { id: party.id, name: party.name, code: party.sankhyaCode ?? null }
    : null;
}

/* ------------------------------------------------------------------------ */
/* Pendências                                                                */
/* ------------------------------------------------------------------------ */

export interface TradeTaskDraft {
  kind: "trade_activity";
  title: string;
  detail: string;
  text: {
    title: "tradePlan.task.title";
    detail: "tradePlan.task.detail";
    values: Record<string, string>;
  };
  link: string;
  dueAt: string;
  customerId: string | null;
  ownerUserId: string;
}

/** Cada ação em aberto é pendência do responsável, com o prazo dela. */
export async function tradeTaskDrafts(
  now = new Date(),
): Promise<TradeTaskDraft[]> {
  const open = (
    await getStore()
      .list("trade_activities", { filter: { status: [...OPEN_STATUSES] } })
      .catch(() => [] as TradeActivity[])
  ).filter((a) => isOpenStatus(a.status));
  if (!open.length) return [];
  const rows = await decorate(open, now);
  return rows.map((r) => ({
    kind: "trade_activity",
    title: `Ação de trade: ${r.title}`,
    detail: `${r.scopeName} · prazo ${dayBr(r.dueDate)}`,
    text: {
      title: "tradePlan.task.title",
      detail: "tradePlan.task.detail",
      values: { title: r.title, scope: r.scopeName, date: dayBr(r.dueDate) },
    },
    link: `/app/portfolio/plan/${r.id}`,
    dueAt: r.dueDate,
    customerId: r.customerId,
    ownerUserId: r.responsibleUserId,
  }));
}
