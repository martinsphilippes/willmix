import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import {
  ATTENDANCE_CHANNELS,
  getStore,
  type AttendanceChannel,
  type CustomerAttendance,
  type CustomerGroup,
  type Party,
  type User,
} from "@/lib/db";
import { can } from "@/lib/auth/function-access";
import { ForbiddenError, isAdmin, isWellmix } from "@/lib/auth/permissions";
import { canOpen } from "@/lib/auth/screens";
import { listByIds, listColumns } from "@/lib/db/lookup";
import { sessionSecret } from "@/lib/env";
import { getSettings } from "@/lib/settings";
import { audit } from "./audit";
import { notify } from "./notifications";
import { rcaCodeOf } from "./rca";
import { visibleTeamIds, wellmixTeam } from "./team";

/*
 * Carteira e atendimento ao cliente (dono, 18/11/2026; docs/TRADE_COMERCIAL.md):
 *
 * - grupo econômico montado à mão; cliente acompanhado = num grupo ativo ou
 *   com responsável escolhido;
 * - responsável: o escolhido no cliente; senão o do grupo; senão o login com
 *   o código do vendedor (RCA) do cliente; senão "Sem responsável";
 * - atendimento só vale confirmado pelos dois lados: quem atendeu registra, o
 *   cliente confirma pelo link (sem login). Só o confirmado zera os dias;
 * - prazo único (Configurações, só o administrador; padrão 30 dias);
 * - pendência "Atender {cliente}" só dos acompanhados, para o responsável, e
 *   "Cobrar a confirmação" para quem atendeu, com 3 dias sem resposta.
 */

export class PortfolioError extends Error {}

/** Dias que o link de confirmação vale. */
export const LINK_DAYS = 14;
/** Janela de "vence em breve" antes do prazo. */
export const DUE_SOON_DAYS = 7;
/** Dias sem resposta do cliente até a pendência de cobrar a confirmação. */
export const CONFIRM_REMINDER_DAYS = 3;
/** Atendimento registrado com data até quantos dias atrás. */
export const MAX_BACKDATE_DAYS = 60;
/** Fotos ou arquivos por atendimento. */
export const MAX_ATTENDANCE_FILES = 6;

export type Standing = "never" | "ok" | "due_soon" | "overdue";
export const STANDINGS: readonly Standing[] = [
  "overdue",
  "never",
  "due_soon",
  "ok",
];

export const isChannel = (v: unknown): v is AttendanceChannel =>
  typeof v === "string" &&
  (ATTENDANCE_CHANNELS as readonly string[]).includes(v);

/* ------------------------------------------------------------------------ */
/* Regras puras                                                              */
/* ------------------------------------------------------------------------ */

/** Dia (AAAA-MM-DD) em Brasília. */
export function brDay(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

const dayMs = (day: string) => Date.parse(`${day}T12:00:00Z`);
const addDays = (day: string, n: number) =>
  new Date(dayMs(day) + n * 86_400_000).toISOString().slice(0, 10);

/**
 * Situação do cliente pelo último atendimento confirmado: nunca atendido, em
 * dia, vence em breve (até 7 dias do prazo) ou atrasado (passou do prazo).
 */
export function standingOf(
  lastConfirmedAt: string | null,
  slaDays: number,
  now = new Date(),
): { status: Standing; days: number | null; dueDay: string | null } {
  if (!lastConfirmedAt) return { status: "never", days: null, dueDay: null };
  const last = brDay(lastConfirmedAt);
  const days = Math.max(
    0,
    Math.round((dayMs(brDay(now)) - dayMs(last)) / 86_400_000),
  );
  const dueDay = addDays(last, slaDays);
  const window = Math.min(DUE_SOON_DAYS, Math.max(0, slaDays - 1));
  const status: Standing =
    days > slaDays ? "overdue" : days > slaDays - window ? "due_soon" : "ok";
  return { status, days, dueDay };
}

export type OwnerSource = "customer" | "group" | "seller";

/** Responsável pela carteira do cliente (regra 5 de docs/TRADE_COMERCIAL.md). */
export function ownerOf(
  party: Pick<
    Party,
    "type" | "ownerUserId" | "rcaCode" | "sankhyaRefs" | "customerGroupId"
  >,
  group: Pick<CustomerGroup, "ownerUserId" | "archivedAt"> | null,
  sellerUsers: ReadonlyMap<string, string>,
  activeIds: ReadonlySet<string>,
): { userId: string | null; source: OwnerSource | null } {
  if (party.ownerUserId && activeIds.has(party.ownerUserId))
    return { userId: party.ownerUserId, source: "customer" };
  if (group && !group.archivedAt && group.ownerUserId) {
    if (activeIds.has(group.ownerUserId))
      return { userId: group.ownerUserId, source: "group" };
  }
  const code = rcaCodeOf(party);
  const seller = code ? sellerUsers.get(code) : undefined;
  if (seller && activeIds.has(seller))
    return { userId: seller, source: "seller" };
  return { userId: null, source: null };
}

/** Cliente acompanhado: num grupo ativo ou com responsável escolhido. */
export function isFollowed(
  party: Pick<Party, "ownerUserId" | "customerGroupId">,
  groups: ReadonlyMap<string, Pick<CustomerGroup, "archivedAt">>,
): boolean {
  if (party.ownerUserId) return true;
  const group = party.customerGroupId
    ? groups.get(party.customerGroupId)
    : undefined;
  return !!group && !group.archivedAt;
}

/** Último atendimento confirmado (o que zera os dias) e os que esperam o cliente. */
export function attendanceSummary(
  rows: readonly Pick<CustomerAttendance, "status" | "occurredAt">[],
): { lastConfirmedAt: string | null; pending: number } {
  let lastConfirmedAt: string | null = null;
  let pending = 0;
  for (const r of rows) {
    if (r.status === "pending_customer") pending++;
    if (
      r.status === "confirmed" &&
      (!lastConfirmedAt || r.occurredAt > lastConfirmedAt)
    )
      lastConfirmedAt = r.occurredAt;
  }
  return { lastConfirmedAt, pending };
}

/* ------------------------------------------------------------------------ */
/* Link de confirmação (assinado; o banco guarda só a parte secreta)          */
/* ------------------------------------------------------------------------ */

const signature = (id: string, nonce: string) =>
  createHmac("sha256", sessionSecret())
    .update(`attendance:${id}:${nonce}`)
    .digest("base64url")
    .slice(0, 32);

/** Código do link (`<id>.<assinatura>`), ou nulo sem link. */
export function attendanceToken(
  a: Pick<CustomerAttendance, "id" | "linkNonce">,
): string | null {
  return a.linkNonce ? `${a.id}.${signature(a.id, a.linkNonce)}` : null;
}

/** Caminho público do link de confirmação. */
export function attendancePath(
  a: Pick<CustomerAttendance, "id" | "linkNonce">,
): string | null {
  const token = attendanceToken(a);
  return token ? `/atendimento/${token}` : null;
}

const newNonce = () => randomBytes(18).toString("base64url");

export type LinkState =
  "open" | "confirmed" | "disputed" | "cancelled" | "expired" | "invalid";

/**
 * O atendimento do link e a situação dele. Link trocado ("Gerar outro link")
 * ou adulterado: inválido. Respondido ou cancelado: a situação final.
 */
export async function attendanceByToken(
  token: string,
  now = new Date(),
): Promise<{ attendance: CustomerAttendance | null; state: LinkState }> {
  const at = token.lastIndexOf(".");
  if (at <= 0) return { attendance: null, state: "invalid" };
  const id = token.slice(0, at);
  const sig = token.slice(at + 1);
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(id) || sig.length !== 32)
    return { attendance: null, state: "invalid" };
  const a = await getStore()
    .get("customer_attendances", id)
    .catch(() => null);
  if (!a?.linkNonce) return { attendance: null, state: "invalid" };
  const expected = Buffer.from(signature(a.id, a.linkNonce));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given))
    return { attendance: null, state: "invalid" };
  if (a.status === "confirmed") return { attendance: a, state: "confirmed" };
  if (a.status === "disputed") return { attendance: a, state: "disputed" };
  if (a.status === "cancelled") return { attendance: a, state: "cancelled" };
  if (a.linkExpiresAt && a.linkExpiresAt < now.toISOString())
    return { attendance: a, state: "expired" };
  return { attendance: a, state: "open" };
}

/* ------------------------------------------------------------------------ */
/* Permissões                                                                */
/* ------------------------------------------------------------------------ */

/** Abre a carteira: Wellmix com a tela "Carteira e atendimento". */
export const canUsePortfolio = (user: User) =>
  isWellmix(user) && canOpen(user, "portfolio");

/** Grupos, responsáveis e tudo da carteira: o administrador e quem tem "Gerir carteira e trade". */
export const canManagePortfolio = (user: User) =>
  isWellmix(user) && (isAdmin(user) || can(user, "trade.manage"));

function assertPortfolio(user: User) {
  if (!canUsePortfolio(user)) throw new ForbiddenError();
}
function assertManage(user: User) {
  if (!canManagePortfolio(user)) throw new ForbiddenError();
}

/* ------------------------------------------------------------------------ */
/* Leitura                                                                   */
/* ------------------------------------------------------------------------ */

interface Context {
  groups: Map<string, CustomerGroup>;
  team: User[];
  activeIds: Set<string>;
  sellerUsers: Map<string, string>;
  slaDays: number;
}

async function context(): Promise<Context> {
  const store = getStore();
  const [groups, team, settings] = await Promise.all([
    store.list("customer_groups", {}).catch(() => [] as CustomerGroup[]),
    wellmixTeam(),
    getSettings(),
  ]);
  const active = team.filter((u) => !u.loginSuspended);
  const sellerUsers = new Map<string, string>();
  for (const u of active)
    if (u.sellerCode && !sellerUsers.has(u.sellerCode))
      sellerUsers.set(u.sellerCode, u.id);
  return {
    groups: new Map(groups.map((g) => [g.id, g])),
    team,
    activeIds: new Set(active.map((u) => u.id)),
    sellerUsers,
    slaDays: settings.attendanceSlaDays,
  };
}

/**
 * Clientes acompanhados: os dos grupos ativos e os com responsável escolhido.
 * O escolhido que saiu da equipe continua valendo para acompanhar: o cliente
 * fica na carteira como "Sem responsável" até alguém ser escolhido.
 */
async function followedCustomers(ctx: Context): Promise<Party[]> {
  const store = getStore();
  const groupIds = [...ctx.groups.values()]
    .filter((g) => !g.archivedAt)
    .map((g) => g.id);
  const teamIds = (
    await listColumns(store, "users", ["role"], {
      filter: { role: ["admin", "operator"] },
    }).catch(() => ctx.team)
  ).map((u) => u.id);
  const [inGroups, owned] = await Promise.all([
    groupIds.length
      ? store
          .list("parties", { filter: { customerGroupId: groupIds } })
          .catch(() => [] as Party[])
      : Promise.resolve([] as Party[]),
    teamIds.length
      ? store
          .list("parties", { filter: { ownerUserId: teamIds } })
          .catch(() => [] as Party[])
      : Promise.resolve([] as Party[]),
  ]);
  const byId = new Map<string, Party>();
  for (const p of [...inGroups, ...owned])
    if (p.type === "customer") byId.set(p.id, p);
  return [...byId.values()];
}

async function attendancesOf(
  customerIds: string[],
): Promise<CustomerAttendance[]> {
  if (!customerIds.length) return [];
  return getStore()
    .list("customer_attendances", { filter: { customerId: customerIds } })
    .catch(() => [] as CustomerAttendance[]);
}

export interface PortfolioRow {
  customerId: string;
  name: string;
  code: string | null;
  groupId: string | null;
  groupName: string | null;
  ownerId: string | null;
  ownerName: string | null;
  ownerSource: OwnerSource | null;
  lastConfirmedAt: string | null;
  status: Standing;
  days: number | null;
  dueDay: string | null;
  pending: number;
}

function rowsFor(
  ctx: Context,
  customers: Party[],
  attendances: CustomerAttendance[],
  now: Date,
): PortfolioRow[] {
  const byCustomer = new Map<string, CustomerAttendance[]>();
  for (const a of attendances)
    byCustomer.set(a.customerId, [...(byCustomer.get(a.customerId) ?? []), a]);
  const name = new Map(ctx.team.map((u) => [u.id, u.name]));
  return customers.map((p) => {
    const group = p.customerGroupId
      ? (ctx.groups.get(p.customerGroupId) ?? null)
      : null;
    const owner = ownerOf(p, group, ctx.sellerUsers, ctx.activeIds);
    const summary = attendanceSummary(byCustomer.get(p.id) ?? []);
    const standing = standingOf(summary.lastConfirmedAt, ctx.slaDays, now);
    return {
      customerId: p.id,
      name: p.name,
      code: p.sankhyaCode ?? null,
      groupId: group && !group.archivedAt ? group.id : null,
      groupName: group && !group.archivedAt ? group.name : null,
      ownerId: owner.userId,
      ownerName: owner.userId ? (name.get(owner.userId) ?? null) : null,
      ownerSource: owner.source,
      lastConfirmedAt: summary.lastConfirmedAt,
      status: standing.status,
      days: standing.days,
      dueDay: standing.dueDay,
      pending: summary.pending,
    };
  });
}

const STATUS_RANK: Record<Standing, number> = {
  overdue: 0,
  never: 1,
  due_soon: 2,
  ok: 3,
};

export interface PortfolioFilters {
  ownerId?: string;
  groupId?: string;
  status?: Standing;
  q?: string;
}

export interface PortfolioView {
  rows: PortfolioRow[];
  /** Totais por situação, antes do filtro de situação. */
  counts: Record<Standing, number>;
  slaDays: number;
  groups: CustomerGroup[];
  owners: Array<{ id: string; name: string }>;
  canManage: boolean;
}

/**
 * A carteira que o login vê: o administrador e quem tem "Gerir carteira e
 * trade", todos os clientes acompanhados; os outros, os da própria carteira e
 * os da equipe abaixo deles (a árvore do Painel de SLA).
 */
export async function loadPortfolio(
  user: User,
  filters: PortfolioFilters = {},
  now = new Date(),
): Promise<PortfolioView> {
  assertPortfolio(user);
  const ctx = await context();
  const customers = await followedCustomers(ctx);
  const rows = rowsFor(
    ctx,
    customers,
    await attendancesOf(customers.map((c) => c.id)),
    now,
  );
  const manage = canManagePortfolio(user);
  const visible = visibleTeamIds(user, ctx.team);
  const mine = manage
    ? rows
    : rows.filter((r) => r.ownerId && visible.has(r.ownerId));
  const q = (filters.q ?? "").trim().toLowerCase();
  const base = mine.filter(
    (r) =>
      (!filters.ownerId ||
        (filters.ownerId === "none"
          ? !r.ownerId
          : r.ownerId === filters.ownerId)) &&
      (!filters.groupId || r.groupId === filters.groupId) &&
      (!q ||
        r.name.toLowerCase().includes(q) ||
        (r.code ?? "").toLowerCase() === q),
  );
  const counts: Record<Standing, number> = {
    overdue: 0,
    never: 0,
    due_soon: 0,
    ok: 0,
  };
  for (const r of base) counts[r.status]++;
  const shown = (
    filters.status ? base.filter((r) => r.status === filters.status) : base
  ).sort(
    (a, b) =>
      STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
      (b.days ?? 0) - (a.days ?? 0) ||
      a.name.localeCompare(b.name, "pt-BR"),
  );
  const ownerIds = new Set(mine.map((r) => r.ownerId).filter(Boolean));
  return {
    rows: shown,
    counts,
    slaDays: ctx.slaDays,
    groups: [...ctx.groups.values()]
      .filter((g) => !g.archivedAt)
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    owners: ctx.team
      .filter((u) => ownerIds.has(u.id))
      .map((u) => ({ id: u.id, name: u.name })),
    canManage: manage,
  };
}

export interface AttendanceView extends CustomerAttendance {
  attendedByName: string | null;
  /** Fotos e arquivos (só a Wellmix abre). */
  files: Array<{ id: string; name: string }>;
  /** Caminho do link, para quem pode mandar (quem atendeu, o responsável e quem gere). */
  linkPath: string | null;
  canAct: boolean;
}

export interface PortfolioCustomerView {
  customer: Pick<Party, "id" | "name" | "sankhyaCode" | "email" | "phone">;
  row: PortfolioRow;
  followed: boolean;
  attendances: AttendanceView[];
  canManage: boolean;
  groups: CustomerGroup[];
  team: Array<{ id: string; name: string }>;
  ownerUserId: string | null;
}

/** O cliente na carteira: situação, histórico de atendimentos e o que o login pode fazer. */
export async function loadPortfolioCustomer(
  user: User,
  customerId: string,
  now = new Date(),
): Promise<PortfolioCustomerView | null> {
  assertPortfolio(user);
  const party = await getStore()
    .get("parties", customerId)
    .catch(() => null);
  if (!party || party.type !== "customer") return null;
  const ctx = await context();
  const attendances = (await attendancesOf([party.id])).sort((a, b) =>
    b.occurredAt.localeCompare(a.occurredAt),
  );
  const [row] = rowsFor(ctx, [party], attendances, now);
  const manage = canManagePortfolio(user);
  const name = new Map(ctx.team.map((u) => [u.id, u.name]));
  const docIds = [...new Set(attendances.flatMap((a) => a.documentIds ?? []))];
  const docs = docIds.length
    ? await listByIds(getStore(), "documents", docIds).catch(() => [])
    : [];
  const docName = new Map(docs.map((d) => [d.id, d.name]));
  return {
    customer: {
      id: party.id,
      name: party.name,
      sankhyaCode: party.sankhyaCode ?? null,
      email: party.email,
      phone: party.phone,
    },
    row,
    followed: isFollowed(party, ctx.groups),
    attendances: attendances.map((a) => {
      const canAct =
        manage || a.attendedByUserId === user.id || row.ownerId === user.id;
      return {
        ...a,
        attendedByName: name.get(a.attendedByUserId) ?? null,
        files: (a.documentIds ?? [])
          .filter((id) => docName.has(id))
          .map((id) => ({ id, name: docName.get(id) ?? id })),
        linkPath:
          canAct && a.status === "pending_customer" ? attendancePath(a) : null,
        canAct,
      };
    }),
    canManage: manage,
    groups: [...ctx.groups.values()]
      .filter((g) => !g.archivedAt)
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    team: ctx.team
      .filter((u) => ctx.activeIds.has(u.id))
      .map((u) => ({ id: u.id, name: u.name })),
    ownerUserId: party.ownerUserId ?? null,
  };
}

/** Busca de cliente para registrar atendimento (nome, código do Sankhya ou CNPJ). */
export async function searchPortfolioCustomers(
  user: User,
  q: string,
): Promise<
  Array<{ id: string; name: string; code: string | null; taxId: string | null }>
> {
  assertPortfolio(user);
  if (q.trim().length < 2) return [];
  const { searchParties } = await import("./party-search");
  const found = await searchParties({
    type: "customer",
    q,
    activeOnly: true,
    identifiers: true,
  });
  return found.map((p) => ({
    id: p.id,
    name: p.name,
    code: p.code ?? null,
    taxId: p.taxId ?? null,
  }));
}

export interface GroupRow extends CustomerGroup {
  ownerName: string | null;
  customers: number;
}

/** Grupos econômicos (ativos e arquivados) com o responsável e quantos clientes. */
export async function loadCustomerGroups(user: User): Promise<{
  active: GroupRow[];
  archived: GroupRow[];
  team: Array<{ id: string; name: string }>;
}> {
  assertManage(user);
  const ctx = await context();
  const groups = [...ctx.groups.values()];
  const members = groups.length
    ? await getStore()
        .list("parties", {
          filter: { customerGroupId: groups.map((g) => g.id) },
        })
        .catch(() => [] as Party[])
    : [];
  const count = new Map<string, number>();
  for (const p of members)
    if (p.type === "customer" && p.customerGroupId)
      count.set(p.customerGroupId, (count.get(p.customerGroupId) ?? 0) + 1);
  const name = new Map(ctx.team.map((u) => [u.id, u.name]));
  const rows = groups
    .map((g) => ({
      ...g,
      ownerName: g.ownerUserId ? (name.get(g.ownerUserId) ?? null) : null,
      customers: count.get(g.id) ?? 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  return {
    active: rows.filter((g) => !g.archivedAt),
    archived: rows.filter((g) => !!g.archivedAt),
    team: ctx.team
      .filter((u) => ctx.activeIds.has(u.id))
      .map((u) => ({ id: u.id, name: u.name })),
  };
}

export interface GroupCandidate {
  id: string;
  name: string;
  code: string | null;
  taxId: string | null;
  /** Grupo atual do cliente (outro grupo ativo), se houver. */
  otherGroupName: string | null;
  inThisGroup: boolean;
}

/** Um grupo: os clientes dele e, com a busca, os clientes para incluir. */
export async function loadCustomerGroup(
  user: User,
  id: string,
  find = "",
): Promise<{
  group: GroupRow;
  customers: Array<{ id: string; name: string; code: string | null }>;
  candidates: GroupCandidate[];
  team: Array<{ id: string; name: string }>;
} | null> {
  assertManage(user);
  const ctx = await context();
  const group = ctx.groups.get(id);
  if (!group) return null;
  const store = getStore();
  const members = (
    await store
      .list("parties", { filter: { customerGroupId: id } })
      .catch(() => [] as Party[])
  )
    .filter((p) => p.type === "customer")
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const name = new Map(ctx.team.map((u) => [u.id, u.name]));
  let candidates: GroupCandidate[] = [];
  if (find.trim().length >= 2) {
    const found = await searchPortfolioCustomers(user, find);
    const parties = found.length
      ? await listByIds(
          store,
          "parties",
          found.map((f) => f.id),
        ).catch(() => [] as Party[])
      : [];
    const groupOf = new Map(
      parties.map((p) => [p.id, p.customerGroupId ?? null]),
    );
    candidates = found.map((f) => {
      const current = groupOf.get(f.id) ?? null;
      const other = current && current !== id ? ctx.groups.get(current) : null;
      return {
        ...f,
        otherGroupName: other && !other.archivedAt ? other.name : null,
        inThisGroup: current === id,
      };
    });
  }
  return {
    group: {
      ...group,
      ownerName: group.ownerUserId
        ? (name.get(group.ownerUserId) ?? null)
        : null,
      customers: members.length,
    },
    customers: members.map((p) => ({
      id: p.id,
      name: p.name,
      code: p.sankhyaCode ?? null,
    })),
    candidates,
    team: ctx.team
      .filter((u) => ctx.activeIds.has(u.id))
      .map((u) => ({ id: u.id, name: u.name })),
  };
}

export interface PublicAttendanceView {
  state: LinkState;
  customerName: string | null;
  attendantName: string | null;
  occurredAt: string | null;
  channel: AttendanceChannel | null;
  summary: string | null;
}

/**
 * O que a página do link mostra ao cliente (sem login): só com o link aberto,
 * o primeiro nome de quem atendeu, quando, o canal e o resumo; nos outros
 * casos, só a situação.
 */
export async function publicAttendanceView(
  token: string,
  now = new Date(),
): Promise<PublicAttendanceView> {
  const { attendance, state } = await attendanceByToken(token, now);
  const empty = {
    customerName: null,
    attendantName: null,
    occurredAt: null,
    channel: null,
    summary: null,
  };
  if (!attendance || state !== "open") return { state, ...empty };
  const store = getStore();
  const [party, attendant] = await Promise.all([
    store.get("parties", attendance.customerId).catch(() => null),
    store.get("users", attendance.attendedByUserId).catch(() => null),
  ]);
  return {
    state,
    customerName: party?.name ?? null,
    // Só o primeiro nome de quem atendeu (docs/TRADE_COMERCIAL.md, seção 15).
    attendantName: attendant?.name.trim().split(/\s+/)[0] || null,
    occurredAt: attendance.occurredAt,
    channel: attendance.channel,
    summary: attendance.summary,
  };
}

/* ------------------------------------------------------------------------ */
/* Atendimentos                                                              */
/* ------------------------------------------------------------------------ */

export interface AttendanceInput {
  customerId: string;
  channel: AttendanceChannel;
  occurredAt: string;
  summary: string;
  nextStep: string | null;
  /** Fotos ou arquivos do atendimento (opcional; só a Wellmix abre). */
  files?: File[];
}

/** Quem atendeu registra (é a confirmação dele) e recebe o link para o cliente. */
export async function registerAttendance(
  user: User,
  input: AttendanceInput,
  now = new Date(),
): Promise<CustomerAttendance> {
  assertPortfolio(user);
  const store = getStore();
  const customer = await store.get("parties", input.customerId);
  if (!customer || customer.type !== "customer")
    throw new PortfolioError("customer_not_found");
  if (!isChannel(input.channel)) throw new PortfolioError("channel_invalid");
  const when = Date.parse(input.occurredAt);
  if (!Number.isFinite(when)) throw new PortfolioError("occurred_invalid");
  if (when > now.getTime() + 60 * 60 * 1000)
    throw new PortfolioError("occurred_future");
  if (when < now.getTime() - MAX_BACKDATE_DAYS * 86_400_000)
    throw new PortfolioError("occurred_too_old");
  const summary = input.summary.trim();
  if (summary.length < 3) throw new PortfolioError("summary_required");
  // Arquivos conferidos antes de subir qualquer um: nada fica pela metade.
  const attachments = input.files ?? [];
  if (attachments.length > MAX_ATTENDANCE_FILES)
    throw new PortfolioError("too_many_files");
  const { assertUploadable, uploadDocument } = await import("./documents");
  for (const file of attachments) assertUploadable(file);
  const documentIds: string[] = [];
  for (const file of attachments) {
    const doc = await uploadDocument(user, file, {
      type: file.type.startsWith("image/") ? "photo" : "attachment",
      visibility: "internal",
    });
    documentIds.push(doc.id);
  }
  const created = await store.create("customer_attendances", {
    customerId: customer.id,
    attendedByUserId: user.id,
    channel: input.channel,
    occurredAt: new Date(when).toISOString(),
    summary,
    nextStep: input.nextStep?.trim() || null,
    documentIds: documentIds.length ? documentIds : null,
    status: "pending_customer",
    linkNonce: newNonce(),
    linkExpiresAt: new Date(
      now.getTime() + LINK_DAYS * 86_400_000,
    ).toISOString(),
    customerAnsweredAt: null,
    customerName: null,
    customerNote: null,
    cancelledAt: null,
    cancelledByUserId: null,
  });
  await audit(
    user,
    "attendance.register",
    "customer_attendance",
    created.id,
    `${customer.name}: ${input.channel}, ${created.occurredAt.slice(0, 10)}`,
  );
  return created;
}

async function actOn(user: User, id: string): Promise<CustomerAttendance> {
  assertPortfolio(user);
  const a = await getStore().get("customer_attendances", id);
  if (!a) throw new PortfolioError("attendance_not_found");
  if (canManagePortfolio(user) || a.attendedByUserId === user.id) return a;
  // O responsável pelo cliente também reenvia o link.
  const ctx = await context();
  const party = await getStore().get("parties", a.customerId);
  const group = party?.customerGroupId
    ? (ctx.groups.get(party.customerGroupId) ?? null)
    : null;
  if (
    party &&
    ownerOf(party, group, ctx.sellerUsers, ctx.activeIds).userId === user.id
  )
    return a;
  throw new ForbiddenError();
}

/** Gera outro link (o anterior deixa de valer), com mais 14 dias. */
export async function renewAttendanceLink(
  user: User,
  id: string,
  now = new Date(),
): Promise<CustomerAttendance> {
  const a = await actOn(user, id);
  if (a.status !== "pending_customer")
    throw new PortfolioError("attendance_closed");
  const updated = await getStore().update("customer_attendances", a.id, {
    linkNonce: newNonce(),
    linkExpiresAt: new Date(
      now.getTime() + LINK_DAYS * 86_400_000,
    ).toISOString(),
  });
  await audit(
    user,
    "attendance.link",
    "customer_attendance",
    a.id,
    "Link de confirmação gerado de novo",
  );
  return updated;
}

/** Cancela o atendimento registrado por engano (não conta). */
export async function cancelAttendance(
  user: User,
  id: string,
  now = new Date(),
): Promise<CustomerAttendance> {
  const a = await actOn(user, id);
  if (a.status === "cancelled") return a;
  if (a.status === "confirmed" && !canManagePortfolio(user))
    throw new ForbiddenError();
  const updated = await getStore().update("customer_attendances", a.id, {
    status: "cancelled",
    cancelledAt: now.toISOString(),
    cancelledByUserId: user.id,
  });
  await audit(
    user,
    "attendance.cancel",
    "customer_attendance",
    a.id,
    "Atendimento cancelado",
    { status: a.status },
    { status: "cancelled" },
  );
  return updated;
}

/**
 * Resposta do cliente pelo link (sem login): confirma, ou diz que não
 * aconteceu (com o motivo). Uso único: respondido, o link mostra a situação.
 */
export async function answerAttendance(
  token: string,
  input: { answer: "confirm" | "dispute"; name: string; note: string | null },
  now = new Date(),
): Promise<CustomerAttendance> {
  const { attendance, state } = await attendanceByToken(token, now);
  if (!attendance || state !== "open")
    throw new PortfolioError(`link_${state}`);
  const name = input.name.trim();
  if (name.length < 2) throw new PortfolioError("name_required");
  const note = input.note?.trim() || null;
  if (input.answer === "dispute" && (!note || note.length < 3))
    throw new PortfolioError("note_required");
  const status = input.answer === "confirm" ? "confirmed" : "disputed";
  const updated = await getStore().update(
    "customer_attendances",
    attendance.id,
    {
      status,
      customerAnsweredAt: now.toISOString(),
      customerName: name,
      customerNote: input.answer === "dispute" ? note : null,
    },
  );
  await audit(
    null,
    status === "confirmed" ? "attendance.confirm" : "attendance.dispute",
    "customer_attendance",
    attendance.id,
    `${name} (cliente, pelo link)${note && status === "disputed" ? `: ${note}` : ""}`,
    { status: attendance.status },
    { status },
  );
  if (status === "disputed") {
    const party = await getStore()
      .get("parties", attendance.customerId)
      .catch(() => null);
    const ctx = await context();
    const group = party?.customerGroupId
      ? (ctx.groups.get(party.customerGroupId) ?? null)
      : null;
    const owner = party
      ? ownerOf(party, group, ctx.sellerUsers, ctx.activeIds).userId
      : null;
    const userIds = [
      ...new Set([attendance.attendedByUserId, owner].filter(Boolean)),
    ] as string[];
    await notify(
      { userIds },
      {
        kind: "alert",
        link: `/app/portfolio/${attendance.customerId}`,
        text: (t) => ({
          subject: t("portfolio.notify.disputed.subject", {
            customer: party?.name ?? "—",
          }),
          body: t("portfolio.notify.disputed.body", {
            name,
            note: note ?? "—",
          }),
        }),
      },
    ).catch((error) => console.error("notify(attendance.dispute)", error));
  }
  return updated;
}

/* ------------------------------------------------------------------------ */
/* Grupos econômicos e responsáveis (Gerir carteira e trade)                 */
/* ------------------------------------------------------------------------ */

async function assertActiveMember(userId: string | null) {
  if (!userId) return;
  const ctx = await context();
  if (!ctx.activeIds.has(userId)) throw new PortfolioError("owner_invalid");
}

async function assertGroupName(name: string, exceptId: string | null) {
  const clean = name.trim();
  if (clean.length < 2) throw new PortfolioError("group_name_required");
  const groups = await getStore().list("customer_groups", {});
  const taken = groups.some(
    (g) =>
      g.id !== exceptId &&
      !g.archivedAt &&
      g.name.trim().toLowerCase() === clean.toLowerCase(),
  );
  if (taken) throw new PortfolioError("group_name_taken");
  return clean;
}

export async function createCustomerGroup(
  user: User,
  input: { name: string; notes: string | null; ownerUserId: string | null },
): Promise<CustomerGroup> {
  assertManage(user);
  const name = await assertGroupName(input.name, null);
  await assertActiveMember(input.ownerUserId);
  const group = await getStore().create("customer_groups", {
    name,
    notes: input.notes?.trim() || null,
    ownerUserId: input.ownerUserId,
    archivedAt: null,
    createdByUserId: user.id,
  });
  await audit(user, "portfolio.group.create", "customer_group", group.id, name);
  return group;
}

export async function updateCustomerGroup(
  user: User,
  id: string,
  input: { name: string; notes: string | null; ownerUserId: string | null },
): Promise<CustomerGroup> {
  assertManage(user);
  const store = getStore();
  const before = await store.get("customer_groups", id);
  if (!before) throw new PortfolioError("group_not_found");
  const name = await assertGroupName(input.name, id);
  if (input.ownerUserId !== (before.ownerUserId ?? null))
    await assertActiveMember(input.ownerUserId);
  const after = await store.update("customer_groups", id, {
    name,
    notes: input.notes?.trim() || null,
    ownerUserId: input.ownerUserId,
  });
  await audit(
    user,
    "portfolio.group.update",
    "customer_group",
    id,
    name,
    { name: before.name, ownerUserId: before.ownerUserId },
    { name: after.name, ownerUserId: after.ownerUserId },
  );
  return after;
}

/** Arquiva (ou reativa) o grupo: arquivado, os clientes deixam de ser acompanhados por ele. */
export async function setCustomerGroupArchived(
  user: User,
  id: string,
  archived: boolean,
  now = new Date(),
): Promise<CustomerGroup> {
  assertManage(user);
  const store = getStore();
  const group = await store.get("customer_groups", id);
  if (!group) throw new PortfolioError("group_not_found");
  if (!archived) await assertGroupName(group.name, id);
  const updated = await store.update("customer_groups", id, {
    archivedAt: archived ? now.toISOString() : null,
  });
  await audit(
    user,
    archived ? "portfolio.group.archive" : "portfolio.group.restore",
    "customer_group",
    id,
    group.name,
  );
  return updated;
}

/** Põe o cliente no grupo (ou tira, com `groupId` nulo). Um grupo por cliente. */
export async function setCustomerGroup(
  user: User,
  customerId: string,
  groupId: string | null,
): Promise<void> {
  assertManage(user);
  const store = getStore();
  const party = await store.get("parties", customerId);
  if (!party || party.type !== "customer")
    throw new PortfolioError("customer_not_found");
  if (groupId) {
    const group = await store.get("customer_groups", groupId);
    if (!group || group.archivedAt) throw new PortfolioError("group_not_found");
  }
  if ((party.customerGroupId ?? null) === groupId) return;
  await store.update("parties", customerId, { customerGroupId: groupId });
  await audit(
    user,
    "portfolio.customer_group",
    "party",
    customerId,
    party.name,
    { customerGroupId: party.customerGroupId ?? null },
    { customerGroupId: groupId },
  );
}

/** Responsável escolhido para o cliente (nulo volta para a regra: grupo, depois vendedor). */
export async function setCustomerOwner(
  user: User,
  customerId: string,
  ownerUserId: string | null,
): Promise<void> {
  assertManage(user);
  const store = getStore();
  const party = await store.get("parties", customerId);
  if (!party || party.type !== "customer")
    throw new PortfolioError("customer_not_found");
  // Sem mudança, nada a conferir (mesmo que o escolhido tenha saído).
  if ((party.ownerUserId ?? null) === ownerUserId) return;
  await assertActiveMember(ownerUserId);
  await store.update("parties", customerId, { ownerUserId });
  await audit(
    user,
    "portfolio.customer_owner",
    "party",
    customerId,
    party.name,
    { ownerUserId: party.ownerUserId ?? null },
    { ownerUserId },
  );
}

/** Código do vendedor do Sankhya no login (só o administrador). */
export async function setUserSellerCode(
  user: User,
  targetId: string,
  code: string | null,
): Promise<void> {
  if (!isAdmin(user)) throw new ForbiddenError();
  const clean = code?.trim().replace(/^0+(?=\d)/, "") || null;
  if (clean && !/^\d{1,10}$/.test(clean))
    throw new PortfolioError("seller_code_invalid");
  const store = getStore();
  const target = await store.get("users", targetId);
  if (!target || !isWellmix(target)) throw new PortfolioError("user_not_found");
  if (clean) {
    const team = await wellmixTeam();
    if (team.some((u) => u.id !== targetId && u.sellerCode === clean))
      throw new PortfolioError("seller_code_taken");
  }
  if ((target.sellerCode ?? null) === clean) return;
  await store.update("users", targetId, { sellerCode: clean });
  await audit(
    user,
    "team.seller_code",
    "user",
    targetId,
    target.name,
    { sellerCode: target.sellerCode ?? null },
    { sellerCode: clean },
  );
}

/* ------------------------------------------------------------------------ */
/* Pendências                                                                */
/* ------------------------------------------------------------------------ */

export interface PortfolioTaskDraft {
  kind: "customer_attendance" | "attendance_confirm";
  title: string;
  detail: string;
  text: {
    title: "portfolio.task.attend.title" | "portfolio.task.confirm.title";
    detail:
      | "portfolio.task.attend.never"
      | "portfolio.task.attend.detail"
      | "portfolio.task.confirm.detail";
    values: Record<string, string | number>;
  };
  link: string;
  dueAt: string;
  customerId: string;
  ownerUserId?: string;
}

/**
 * Pendências da carteira (para todos; o filtro por login fica em
 * `tasksForFunctions` e no Painel de SLA): atender os clientes acompanhados
 * atrasados ou nunca atendidos (responsável) e cobrar a confirmação de
 * atendimento sem resposta há 3 dias (quem atendeu).
 */
export async function portfolioTaskDrafts(
  now = new Date(),
): Promise<PortfolioTaskDraft[]> {
  const ctx = await context();
  const customers = await followedCustomers(ctx);
  if (!customers.length) return [];
  const attendances = await attendancesOf(customers.map((c) => c.id));
  const rows = rowsFor(ctx, customers, attendances, now);
  const today = brDay(now);
  const drafts: PortfolioTaskDraft[] = [];
  for (const r of rows) {
    if (r.status !== "overdue" && r.status !== "never") continue;
    const values = {
      customer: r.name,
      days: r.days ?? 0,
      sla: ctx.slaDays,
    };
    drafts.push({
      kind: "customer_attendance",
      title: `Atender ${r.name}`,
      detail:
        r.status === "never"
          ? "Nunca atendido"
          : `${r.days} dias sem atendimento (prazo de ${ctx.slaDays})`,
      text: {
        title: "portfolio.task.attend.title",
        detail:
          r.status === "never"
            ? "portfolio.task.attend.never"
            : "portfolio.task.attend.detail",
        values,
      },
      link: `/app/portfolio/${r.customerId}`,
      dueAt: r.dueDay ?? today,
      customerId: r.customerId,
      ...(r.ownerId ? { ownerUserId: r.ownerId } : {}),
    });
  }
  const names = new Map(customers.map((c) => [c.id, c.name]));
  for (const a of attendances) {
    if (a.status !== "pending_customer") continue;
    const since = brDay(a.createdAt);
    const dueAt = addDays(since, CONFIRM_REMINDER_DAYS);
    if (dueAt > today) continue;
    const customer = names.get(a.customerId) ?? "—";
    drafts.push({
      kind: "attendance_confirm",
      title: `Cobrar a confirmação de ${customer}`,
      detail: `Atendimento de ${brDay(a.occurredAt)} aguardando o cliente`,
      text: {
        title: "portfolio.task.confirm.title",
        detail: "portfolio.task.confirm.detail",
        values: { customer, date: brDay(a.occurredAt) },
      },
      link: `/app/portfolio/${a.customerId}`,
      dueAt,
      customerId: a.customerId,
      ownerUserId: a.attendedByUserId,
    });
  }
  return drafts;
}
