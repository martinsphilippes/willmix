import "server-only";

import {
  getStore,
  type Division,
  type JobLevel,
  type Role,
  type StageKey,
  type User,
} from "@/lib/db";
import { WELLMIX_ROLES, isAdmin, isWellmix } from "@/lib/auth/permissions";
import { ForbiddenError } from "@/lib/auth/permissions";
import { isOffFlowStage } from "@/lib/workflow/stages";
import {
  daysUntil,
  dueBucket,
  pendingTasksFor,
  type TaskDue,
  type TaskKind,
} from "./tasks";
import { visibleTeamIds, wellmixTeam } from "./team";

/*
 * Painel de SLA (docs/SLA_PANEL.md). Cada pendência da Wellmix cai no painel
 * do operador responsável pela carteira do cliente dela; o que está atrasado
 * com um parceiro (fornecedor, agência, companhia marítima, despachante,
 * transportador) aparece à parte, para ele cobrar. Quem vê quem: o
 * administrador vê todos e o que está "sem responsável"; os demais, o próprio
 * painel e o de todos abaixo deles na equipe. Só leitura.
 */

/** Pendências sem cliente com responsável. */
export const UNASSIGNED = "unassigned";
/** Visão "todos" (de quem o login vê). */
export const ALL = "all";

export interface SlaItem {
  /** "task": a Wellmix deve; "partner": um parceiro está atrasado. */
  source: "task" | "partner";
  kind: TaskKind | "partner_stage" | "partner_quote" | "partner_packaging";
  title: string;
  detail: string;
  link: string;
  dueAt: string | null;
  due: TaskDue;
  daysLeft: number | null;
  customerId: string | null;
  customerName: string | null;
  /** Operador responsável (ou UNASSIGNED). */
  ownerId: string;
  stageKey?: StageKey;
  /** Parceiro: papéis de quem está devendo (a tela traduz). */
  waitingOn?: Role[];
  /** Parceiro: nome da empresa que está devendo, quando há uma só. */
  waitingParty?: string | null;
}

export interface SlaCounts {
  overdue: number;
  today: number;
  week: number;
  later: number;
  partnerLate: number;
}

export interface SlaPerson {
  id: string;
  name: string;
  jobLevel: JobLevel | null;
  managerUserId: string | null;
  /** Profundidade na árvore do que o login vê (0 = topo). */
  depth: number;
  /** Divisão que a pessoa atende (Wellmix ou WellKids). */
  division: Division | null;
  counts: SlaCounts;
  /** Etapas concluídas nos últimos 30 dias: no prazo / total com prazo. */
  onTime: { done: number; total: number };
}

export interface SlaBoard {
  people: SlaPerson[];
  /** Linha "Sem responsável" (só o admin vê). */
  unassigned: SlaPerson | null;
  /** O que está escolhido: id de pessoa, UNASSIGNED ou ALL. */
  selected: string;
  items: SlaItem[];
  /** Totais do que está escolhido. */
  totals: SlaCounts;
  onTime: { done: number; total: number };
  /** O login tem equipe (ou é admin): mostra a tabela da equipe. */
  manages: boolean;
}

const emptyCounts = (): SlaCounts => ({
  overdue: 0,
  today: 0,
  week: 0,
  later: 0,
  partnerLate: 0,
});

function addTo(counts: SlaCounts, item: SlaItem) {
  if (item.source === "partner") counts.partnerLate++;
  else if (item.due === "overdue") counts.overdue++;
  else if (item.due === "today") counts.today++;
  else if (item.due === "week") counts.week++;
  else counts.later++;
}

/** Dia (AAAA-MM-DD) em Brasília. */
function brazilDay(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

/** Etapa concluída dentro do prazo (pelo dia em Brasília). */
function onTimeDay(completedAt: string, dueAt: string): boolean {
  const due = /^\d{4}-\d{2}-\d{2}(T00:00:00(\.000)?Z)?$/.test(dueAt)
    ? dueAt.slice(0, 10)
    : brazilDay(dueAt);
  return brazilDay(completedAt) <= due;
}

/** Ordena a equipe como árvore (chefe, depois a equipe dele), com profundidade. */
function treeOrder(team: User[], visible: Set<string>) {
  const shown = team.filter((u) => visible.has(u.id));
  const ids = new Set(shown.map((u) => u.id));
  const roots = shown.filter(
    (u) => !u.managerUserId || !ids.has(u.managerUserId),
  );
  const out: Array<{ user: User; depth: number }> = [];
  const seen = new Set<string>();
  const walk = (u: User, depth: number) => {
    if (seen.has(u.id)) return;
    seen.add(u.id);
    out.push({ user: u, depth });
    for (const child of shown.filter((c) => c.managerUserId === u.id))
      walk(child, depth + 1);
  };
  for (const r of roots) walk(r, 0);
  // Ciclo no cadastro (ninguém é raiz): entra no fim, no nível 0.
  for (const u of shown) if (!seen.has(u.id)) walk(u, 0);
  return out;
}

/**
 * Painel do login (Wellmix). `selected`: id de alguém que ele vê, UNASSIGNED
 * (admin) ou ALL; vazio = padrão (quem tem equipe: todos; senão, o próprio).
 */
export async function slaBoardFor(
  viewer: User,
  selected?: string | null,
): Promise<SlaBoard> {
  if (!isWellmix(viewer)) throw new ForbiddenError();
  const store = getStore();
  const now = new Date();
  const team = await wellmixTeam();
  if (!team.some((u) => u.id === viewer.id)) team.push(viewer);
  const visible = visibleTeamIds(viewer, team);
  const admin = isAdmin(viewer);
  const manages = admin || visible.size > 1;

  const [customers, tasks, partnerItems, recentStages] = await Promise.all([
    store.list("parties", { filter: { type: "customer" } }),
    pendingTasksFor(viewer),
    partnerDelays(now),
    store.list("stages", { filter: { status: "done" } }),
  ]);
  const customerById = new Map(customers.map((c) => [c.id, c]));
  // Dono: o analista da solicitação/do pedido, se ainda é da equipe ativa.
  const teamIds = new Set(team.map((u) => u.id));
  const ownerFor = (ownerUserId: string | null | undefined) =>
    ownerUserId && teamIds.has(ownerUserId) ? ownerUserId : UNASSIGNED;

  const all: SlaItem[] = [
    ...tasks.map((t): SlaItem => ({
      source: "task",
      kind: t.kind,
      title: t.title,
      detail: t.detail,
      link: t.link,
      dueAt: t.dueAt,
      due: t.due,
      daysLeft: t.daysLeft,
      customerId: t.customerId ?? null,
      customerName: t.customerId
        ? (customerById.get(t.customerId)?.name ?? null)
        : null,
      ownerId: ownerFor(t.ownerUserId),
      stageKey: t.stageKey,
    })),
    ...partnerItems.map((p) => ({
      ...p,
      customerName: p.customerId
        ? (customerById.get(p.customerId)?.name ?? null)
        : null,
      ownerId: ownerFor(p.ownerUserId),
    })),
  ];
  const mine = all.filter(
    (i) => visible.has(i.ownerId) || (admin && i.ownerId === UNASSIGNED),
  );

  // Etapas concluídas nos últimos 30 dias (com prazo): no prazo ou não.
  const since = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const doneStages = recentStages.filter(
    (s) =>
      !!s.completedAt &&
      !!s.dueAt &&
      s.completedAt >= since &&
      !isOffFlowStage(s.key),
  );
  const orderIds = [...new Set(doneStages.map((s) => s.orderId))];
  const orders = orderIds.length
    ? await store.list("orders", { filter: { id: orderIds } })
    : [];
  const stageOwner = new Map(
    doneStages.map((s) => [
      s.id,
      ownerFor(orders.find((o) => o.id === s.orderId)?.ownerUserId),
    ]),
  );
  const onTimeFor = (match: (ownerId: string) => boolean) => {
    const of = doneStages.filter((s) => match(stageOwner.get(s.id)!));
    return {
      total: of.length,
      done: of.filter((s) => onTimeDay(s.completedAt!, s.dueAt!)).length,
    };
  };
  const countsFor = (match: (ownerId: string) => boolean) => {
    const c = emptyCounts();
    for (const i of mine) if (match(i.ownerId)) addTo(c, i);
    return c;
  };

  const people: SlaPerson[] = treeOrder(team, visible).map(
    ({ user, depth }) => ({
      id: user.id,
      name: user.name,
      jobLevel: user.jobLevel ?? null,
      managerUserId: user.managerUserId ?? null,
      depth,
      division: user.division ?? null,
      counts: countsFor((o) => o === user.id),
      onTime: onTimeFor((o) => o === user.id),
    }),
  );
  const unassigned: SlaPerson | null = admin
    ? {
        id: UNASSIGNED,
        name: "",
        jobLevel: null,
        managerUserId: null,
        depth: 0,
        division: null,
        counts: countsFor((o) => o === UNASSIGNED),
        onTime: onTimeFor((o) => o === UNASSIGNED),
      }
    : null;

  // Escolha: só quem o login vê; o resto cai no padrão.
  const valid =
    selected === ALL ||
    (selected === UNASSIGNED && admin) ||
    (!!selected && visible.has(selected));
  const pick = valid ? selected! : manages ? ALL : viewer.id;
  const match = (o: string) => (pick === ALL ? true : o === pick);
  const items = mine
    .filter((i) => match(i.ownerId))
    .sort(
      (a, b) =>
        (a.daysLeft ?? Number.POSITIVE_INFINITY) -
        (b.daysLeft ?? Number.POSITIVE_INFINITY),
    );
  return {
    people,
    unassigned,
    selected: pick,
    items,
    totals: countsFor(match),
    onTime: onTimeFor(
      pick === ALL
        ? (o) => visible.has(o) || (admin && o === UNASSIGNED)
        : match,
    ),
    manages,
  };
}

/**
 * Atrasos de parceiros (para o operador cobrar): etapa do pedido vencida com
 * pendência de parceiro, RFQ sem resposta depois do prazo da solicitação e
 * embalagem da agência vencida.
 */
async function partnerDelays(
  now: Date,
): Promise<
  Array<
    Omit<SlaItem, "customerName" | "ownerId"> & { ownerUserId: string | null }
  >
> {
  const store = getStore();
  const [stages, quotes, briefs, parties] = await Promise.all([
    store.list("stages", { filter: { status: ["active", "blocked"] } }),
    store.list("quotes", { filter: { status: "invited" } }),
    store
      .list("packaging_briefs", { filter: { status: "open" } })
      .catch(() => []),
    store.list("parties"),
  ]);
  const name = (id: string | null | undefined) =>
    (id && parties.find((p) => p.id === id)?.name) || null;
  const out: Array<
    Omit<SlaItem, "customerName" | "ownerId"> & { ownerUserId: string | null }
  > = [];
  const late = (dueAt: string | null) => {
    const daysLeft = daysUntil(dueAt, now);
    return { daysLeft, due: dueBucket(daysLeft) };
  };

  // Etapas vencidas esperando parceiro.
  const lateStages = stages.filter(
    (s) => !isOffFlowStage(s.key) && late(s.dueAt).due === "overdue",
  );
  if (lateStages.length) {
    const [orders, reqs] = await Promise.all([
      store.list("orders", {
        filter: { id: [...new Set(lateStages.map((s) => s.orderId))] },
      }),
      store.list("requirements", {
        filter: {
          stageId: lateStages.map((s) => s.id),
          status: ["pending", "rejected"],
        },
      }),
    ]);
    for (const s of lateStages) {
      const order = orders.find((o) => o.id === s.orderId);
      if (!order || order.status === "CANCELLED") continue;
      const roles = [
        ...new Set(
          reqs
            .filter(
              (r) =>
                r.stageId === s.id &&
                !(WELLMIX_ROLES as readonly string[]).includes(r.role),
            )
            .map((r) => r.role),
        ),
      ];
      if (!roles.length) continue;
      const field: Partial<Record<Role, keyof typeof order>> = {
        supplier: "supplierId",
        agency: "agencyId",
        broker: "brokerId",
        shipping_line: "shippingLineId",
        carrier: "carrierId",
        customer: "customerId",
      };
      const parties = roles
        .map((r) => (field[r] ? name(order[field[r]!] as string | null) : null))
        .filter(Boolean);
      const { daysLeft, due } = late(s.dueAt);
      out.push({
        source: "partner",
        kind: "partner_stage",
        title: `Pedido #${order.number}`,
        detail: reqs
          .filter(
            (r) =>
              r.stageId === s.id &&
              !(WELLMIX_ROLES as readonly string[]).includes(r.role),
          )
          .map((r) => r.label)
          .join(", "),
        link: `/app/orders/${order.id}`,
        dueAt: s.dueAt,
        due,
        daysLeft,
        customerId: order.customerId,
        ownerUserId: order.ownerUserId ?? null,
        stageKey: s.key,
        waitingOn: roles,
        waitingParty: parties.length === 1 ? parties[0] : null,
      });
    }
  }

  // RFQ sem resposta depois do prazo da solicitação.
  const requestIds = [...new Set(quotes.map((q) => q.requestId))];
  const requests = requestIds.length
    ? await store.list("requests", { filter: { id: requestIds } })
    : [];
  for (const q of quotes) {
    const request = requests.find((r) => r.id === q.requestId);
    if (!request || request.status !== "RFQ_OPEN") continue;
    const { daysLeft, due } = late(request.deadline);
    if (due !== "overdue") continue;
    out.push({
      source: "partner",
      kind: "partner_quote",
      title: request.number
        ? `Solicitação nº ${request.number}: ${request.productName}`
        : request.productName,
      detail: "",
      link: `/app/requests/${request.id}`,
      dueAt: request.deadline,
      due,
      daysLeft,
      customerId: request.customerId,
      ownerUserId: request.ownerUserId ?? null,
      waitingOn: ["supplier"],
      waitingParty: name(q.supplierId),
    });
  }

  // Embalagem da agência vencida (o marketing da Wellmix já é pendência).
  const briefRequests = briefs.filter((b) => b.agencyId);
  const briefReqRows = briefRequests.length
    ? await store.list("requests", {
        filter: { id: [...new Set(briefRequests.map((b) => b.requestId))] },
      })
    : [];
  for (const b of briefRequests) {
    const { daysLeft, due } = late(b.dueAt);
    if (due !== "overdue") continue;
    const request = briefReqRows.find((r) => r.id === b.requestId);
    if (!request || request.status === "CANCELLED") continue;
    out.push({
      source: "partner",
      kind: "partner_packaging",
      title: request.number
        ? `Solicitação nº ${request.number}: ${request.productName}`
        : request.productName,
      detail: "",
      link: `/app/packaging/${b.id}`,
      dueAt: b.dueAt,
      due,
      daysLeft,
      customerId: request.customerId,
      ownerUserId: request.ownerUserId ?? null,
      stageKey: "PACKAGING",
      waitingOn: ["agency"],
      waitingParty: name(b.agencyId),
    });
  }
  return out;
}
