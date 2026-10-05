import "server-only";

import {
  getStore,
  type Order,
  type Request,
  type StageKey,
  type User,
} from "@/lib/db";
import { canViewRequest, isWellmix } from "@/lib/auth/permissions";
import { ROLE_PARTY_FIELD, STAGE_TEMPLATES } from "@/lib/workflow/stages";

export type TaskKind =
  | "requirement"
  | "quote"
  | "select_supplier"
  | "confirm_payment"
  | "pay"
  | "rfq"
  | "review"
  | "after_sales"
  | "sourcing_demand"
  | "freight_quote";

/** Situação da pendência em relação ao prazo (dia civil em Brasília). */
export type TaskDue = "overdue" | "today" | "week" | "later" | "none";

export interface Task {
  kind: TaskKind;
  title: string;
  detail: string;
  link: string;
  dueAt: string | null;
  overdue: boolean;
  orderNumber?: number;
  /** Requisito de etapa: a etapa (a tela traduz). */
  stageKey?: StageKey;
  /** Filtro "tipo": a etapa (requisito) ou o tipo da pendência. */
  group: string;
  /** Filtro "prazo". */
  due: TaskDue;
  /** Dias até o prazo (negativo = atrasada); nulo sem prazo. */
  daysLeft: number | null;
}

/* ---------------------------------------------------------------------------
 * Prazo: dia civil em Brasília. Uma pendência que vence hoje "vence hoje";
 * só fica atrasada no dia seguinte. Prazos sem hora (AAAA-MM-DD) e com hora
 * (ISO) são comparados pelo dia.
 * ------------------------------------------------------------------------ */

function dayInBrazil(value: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

/** Dia civil (AAAA-MM-DD, Brasília) de um prazo; nulo se inválido. */
function dueDay(dueAt: string | null): string | null {
  if (!dueAt) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dueAt)) return dueAt;
  const ms = Date.parse(dueAt);
  return Number.isNaN(ms) ? null : dayInBrazil(new Date(ms));
}

/** Dias (civis) até o prazo: 0 = hoje, negativo = atrasada, nulo = sem prazo. */
export function daysUntil(
  dueAt: string | null,
  now = new Date(),
): number | null {
  const day = dueDay(dueAt);
  if (!day) return null;
  const a = Date.UTC(
    Number(day.slice(0, 4)),
    Number(day.slice(5, 7)) - 1,
    Number(day.slice(8, 10)),
  );
  const today = dayInBrazil(now);
  const b = Date.UTC(
    Number(today.slice(0, 4)),
    Number(today.slice(5, 7)) - 1,
    Number(today.slice(8, 10)),
  );
  return Math.round((a - b) / 86_400_000);
}

export function dueBucket(daysLeft: number | null): TaskDue {
  if (daysLeft === null) return "none";
  if (daysLeft < 0) return "overdue";
  if (daysLeft === 0) return "today";
  if (daysLeft <= 7) return "week";
  return "later";
}

/** Filtros de prazo, na ordem da tela. */
export const TASK_DUE_FILTERS: TaskDue[] = [
  "overdue",
  "today",
  "week",
  "later",
  "none",
];

/**
 * Ordem da lista: pelo prazo, as mais urgentes primeiro (atrasadas, depois
 * hoje, e assim por diante); sem prazo por último. Empate mantém a ordem de
 * origem (estável).
 */
export function sortTasks<T extends Pick<Task, "daysLeft">>(tasks: T[]): T[] {
  return tasks
    .map((task, i) => ({ task, i }))
    .sort((a, b) => {
      const da = a.task.daysLeft;
      const db = b.task.daysLeft;
      if (da === null && db === null) return a.i - b.i;
      if (da === null) return 1;
      if (db === null) return -1;
      return da - db || a.i - b.i;
    })
    .map((x) => x.task);
}

export interface TaskFilter {
  due?: string | null;
  group?: string | null;
}

export function filterTasks(tasks: Task[], filter: TaskFilter): Task[] {
  const due = TASK_DUE_FILTERS.includes(filter.due as TaskDue)
    ? (filter.due as TaskDue)
    : null;
  const group = filter.group || null;
  return tasks.filter(
    (t) => (!due || t.due === due) && (!group || t.group === group),
  );
}

const STAGE_ORDER: string[] = STAGE_TEMPLATES.map((s) => s.key);
const KIND_ORDER: string[] = [
  "rfq",
  "quote",
  "select_supplier",
  "confirm_payment",
  "pay",
  "freight_quote",
  "review",
  "sourcing_demand",
  "after_sales",
];
const GROUP_ORDER = [...STAGE_ORDER, ...KIND_ORDER];

/** Grupos presentes (etapas na ordem do fluxo, depois os tipos), com contagem. */
export function taskGroups(
  tasks: Task[],
): { group: string; stage: boolean; count: number }[] {
  const counts = new Map<string, number>();
  for (const t of tasks) counts.set(t.group, (counts.get(t.group) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => GROUP_ORDER.indexOf(a[0]) - GROUP_ORDER.indexOf(b[0]))
    .map(([group, count]) => ({
      group,
      stage: STAGE_ORDER.includes(group),
      count,
    }));
}

/** Completa prazo/grupo de uma pendência montada pelas rotinas abaixo. */
function finish(
  task: Omit<Task, "overdue" | "group" | "due" | "daysLeft"> & {
    group?: string;
  },
  now: Date,
): Task {
  const daysLeft = daysUntil(task.dueAt, now);
  const due = dueBucket(daysLeft);
  return {
    ...task,
    group: task.group ?? task.stageKey ?? task.kind,
    due,
    daysLeft,
    overdue: due === "overdue",
  };
}

/** Pendências do usuário: o que ele precisa fazer agora. */
export async function pendingTasksFor(user: User): Promise<Task[]> {
  const store = getStore();
  const tasks: Task[] = [];
  const now = new Date();
  const wellmix = isWellmix(user);
  const supplier = user.role === "supplier" && !!user.partyId;
  const customer = user.role === "customer" && !!user.partyId;
  const none = Promise.resolve([] as never[]);

  // Todas as consultas independentes saem juntas (cada ida ao banco custa uma
  // viagem de rede); os detalhes vêm depois, em lote.
  const [
    stages,
    quotes,
    wellmixRequests,
    pendingPayments,
    demands,
    reviews,
    waitingRequests,
    openAfterSales,
  ] = await Promise.all([
    store.list("stages", { filter: { status: ["active", "blocked"] } }),
    supplier
      ? store.list("quotes", {
          filter: { supplierId: user.partyId!, status: "invited" },
        })
      : none,
    wellmix
      ? store.list("requests", {
          filter: {
            status: ["REQUESTED", "QUOTATION_RECEIVED", "WAITING_DOWN_PAYMENT"],
          },
        })
      : none,
    wellmix || customer
      ? store.list("payments", {
          filter: { direction: "customer_in", status: "pending" },
        })
      : none,
    wellmix
      ? store.list("sourcing_items", {
          filter: { status: ["draft", "negotiating"] },
        })
      : none,
    wellmix
      ? store.list("review_items", {
          filter: { status: "open" },
          orderBy: "createdAt",
          direction: "desc",
        })
      : none,
    customer
      ? store.list("requests", {
          filter: { customerId: user.partyId!, status: "WAITING_DOWN_PAYMENT" },
        })
      : none,
    customer
      ? store.list("after_sales", {
          filter: { customerId: user.partyId!, status: "open" },
        })
      : none,
  ]);

  // Pedidos, requisitos e solicitações citados acima, em uma rodada paralela.
  const orderIds = [
    ...new Set([
      ...stages.map((s) => s.orderId),
      ...openAfterSales.map((a) => a.orderId),
    ]),
  ];
  const quoteRequestIds = [...new Set(quotes.map((q) => q.requestId))];
  const [orders, openRequirements, quoteRequests] = await Promise.all([
    orderIds.length ? store.list("orders", { filter: { id: orderIds } }) : none,
    stages.length
      ? store.list("requirements", {
          filter: {
            stageId: stages.map((s) => s.id),
            status: ["pending", "rejected"],
          },
        })
      : none,
    quoteRequestIds.length
      ? store.list("requests", { filter: { id: quoteRequestIds } })
      : none,
  ]);
  const orderById = new Map(orders.map((o) => [o.id, o]));

  // Requisitos pendentes em etapas ativas/bloqueadas.
  for (const stage of stages) {
    const order = orderById.get(stage.orderId);
    if (!order) continue;
    if (!isInvolved(user, order)) continue;
    const mine = openRequirements.filter(
      (r) => r.stageId === stage.id && (wellmix || r.role === user.role),
    );
    if (mine.length === 0) continue;
    tasks.push(
      finish(
        {
          kind: "requirement",
          title: `Pedido #${order.number}: ${stage.key}`,
          detail: mine.map((r) => r.label).join(", "),
          link: `/app/orders/${order.id}`,
          dueAt: stage.dueAt,
          orderNumber: order.number,
          stageKey: stage.key,
        },
        now,
      ),
    );
  }

  // Fase de solicitação.
  for (const quote of quotes) {
    const request = quoteRequests.find((r) => r.id === quote.requestId);
    if (!request) continue;
    tasks.push(
      finish(
        {
          kind: "quote",
          title: `RFQ: ${request.productName}`,
          detail: `${request.quantity} ${request.unit}`,
          link: `/app/quotes/${quote.id}`,
          dueAt: quote.validUntil,
        },
        now,
      ),
    );
  }
  const withProof = new Set(
    pendingPayments
      .filter((p) => p.requestId && p.proofDocumentId)
      .map((p) => p.requestId as string),
  );
  for (const request of wellmixRequests) {
    const task = requestTask(request);
    if (task.kind === "confirm_payment" && withProof.has(request.id))
      task.detail = "Comprovante enviado pelo cliente: conferir e confirmar";
    tasks.push(finish(task, now));
  }
  for (const request of waitingRequests.filter((r) =>
    canViewRequest(user, r),
  )) {
    // Comprovante já enviado: agora depende da Wellmix confirmar, não do cliente.
    if (withProof.has(request.id)) continue;
    tasks.push(
      finish(
        {
          kind: "pay",
          title: `Sinal pendente: ${request.productName}`,
          detail: `${request.sellCurrency ?? ""} ${request.downPaymentAmount?.toFixed(2) ?? ""}`,
          link: `/app/requests/${request.id}`,
          dueAt: null,
        },
        now,
      ),
    );
  }
  // Pós-venda aberto: o cliente avalia a compra.
  for (const a of openAfterSales) {
    const order = orderById.get(a.orderId);
    if (!order || !isInvolved(user, order)) continue;
    tasks.push(
      finish(
        {
          kind: "after_sales",
          title: `Avalie a compra: pedido #${order.number}`,
          detail: "Como foi a experiência? Quer repor?",
          link: `/app/orders/${order.id}#after-sales`,
          dueAt: null,
          orderNumber: order.number,
        },
        now,
      ),
    );
  }

  // Sourcing sob demanda: produto pedido por cliente ainda sem fornecedor.
  for (const d of demands.filter((x) => x.requestId)) {
    tasks.push(
      finish(
        {
          kind: "sourcing_demand",
          title: `Sourcing sob demanda: ${d.name}`,
          detail: d.notes ?? "Localizar fornecedores e cadastrar opções",
          link: `/app/sourcing/items/${d.id}`,
          dueAt: null,
        },
        now,
      ),
    );
  }

  // Fila "itens para revisão" (gates): uma pendência por item aberto, só para a Wellmix.
  for (const r of reviews) {
    tasks.push(
      finish(
        {
          kind: "review",
          title: r.problem,
          detail: [
            r.expected !== null ? `esperado ${r.expected}` : null,
            r.found !== null ? `encontrado ${r.found}` : null,
            r.action,
          ]
            .filter(Boolean)
            .join(" · "),
          link: r.link ?? "/app/reviews",
          dueAt: null,
        },
        now,
      ),
    );
  }

  // Companhia marítima: pedidos de frete a informar.
  if (user.role === "shipping_line" && user.partyId) {
    const freights = await store.list("freight_quotes", {
      filter: { carrierId: user.partyId, status: "invited" },
    });
    const requestIds = [...new Set(freights.map((f) => f.requestId))];
    const requests = requestIds.length
      ? await store.list("requests", { filter: { id: requestIds } })
      : [];
    for (const f of freights) {
      const request = requests.find((r) => r.id === f.requestId);
      if (!request) continue;
      tasks.push(
        finish(
          {
            kind: "freight_quote",
            title: `Frete: ${request.productName}`,
            detail: `${f.totalCbm ?? "?"} m³ · ${f.cartons ?? "?"} cx · ${f.grossWeightKg ?? "?"} kg`,
            link: `/app/freight/${f.id}`,
            dueAt: request.deadline,
          },
          now,
        ),
      );
    }
  }
  // Pelo prazo: as mais urgentes primeiro; sem prazo por último.
  return sortTasks(tasks);
}

type DraftTask = Omit<Task, "overdue" | "group" | "due" | "daysLeft">;

function requestTask(request: Request): DraftTask {
  const base = {
    link: `/app/requests/${request.id}`,
    dueAt: request.deadline,
  };
  switch (request.status) {
    case "REQUESTED":
      return {
        kind: "rfq",
        title: `Abrir RFQ: ${request.productName}`,
        detail: "Selecione fornecedores",
        ...base,
      };
    case "QUOTATION_RECEIVED":
      return {
        kind: "select_supplier",
        title: `Escolher fornecedor: ${request.productName}`,
        detail: "Cotações recebidas",
        ...base,
      };
    default:
      return {
        kind: "confirm_payment",
        title: `Confirmar sinal: ${request.productName}`,
        detail: "Aguardando pagamento do cliente",
        ...base,
      };
  }
}

export function isInvolved(user: User, order: Order): boolean {
  if (isWellmix(user)) return true;
  // Cliente: só o login solicitante (mesma regra de canViewOrder).
  if (user.role === "customer")
    return (
      order.customerId === user.partyId && order.requestedByUserId === user.id
    );
  const field = ROLE_PARTY_FIELD[user.role];
  if (!field) return false;
  return order[field] === user.partyId;
}
