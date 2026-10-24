import "server-only";

import {
  getStore,
  type Order,
  type Request,
  type StageKey,
  type User,
} from "@/lib/db";
import { canViewRequest, isWellmix } from "@/lib/auth/permissions";
import {
  ROLE_PARTY_FIELD,
  STAGE_TEMPLATES,
  isOffFlowStage,
} from "@/lib/workflow/stages";

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
  | "freight_quote"
  | "supplier_payment"
  | "confirm_receipt"
  | "packaging_brief";

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
  "packaging_brief",
  "select_supplier",
  "confirm_payment",
  "pay",
  "freight_quote",
  "supplier_payment",
  "confirm_receipt",
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
  // Pedidos antigos parados na etapa de pagamento ao fornecedor seguem o
  // fluxo (uma consulta por instância do servidor depois que não sobra nenhum).
  await (await import("./supplier-terms")).releaseOffFlowStages();
  // Arte e embalagem dos pedidos antigos: arte da agência, aprovação do fornecedor.
  await (await import("./packaging")).normalizePackaging();
  const customer = user.role === "customer" && !!user.partyId;
  const agency = user.role === "agency" && !!user.partyId;
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
    openBriefs,
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
    // Briefings de embalagem em preparação: da agência (os dela) ou do
    // marketing da Wellmix (sem agência). Tabela ainda não publicada: nenhum.
    agency || wellmix
      ? store
          .list("packaging_briefs", {
            filter: {
              status: "open",
              agencyId: agency ? user.partyId! : null,
            },
          })
          .catch(() => [])
      : none,
  ]);

  // Pedidos, requisitos e solicitações citados acima, em uma rodada paralela.
  // Os pedidos dos itens de revisão entram para pular os de pedido cancelado.
  const orderIds = [
    ...new Set([
      ...stages.map((s) => s.orderId),
      ...openAfterSales.map((a) => a.orderId),
      ...reviews.map((r) => r.orderId).filter((id): id is string => !!id),
    ]),
  ];
  // Depois do pedido criado a embalagem é cobrada pela etapa, não pelo briefing.
  const briefs = openBriefs.filter((b) => !b.orderId);
  const quoteRequestIds = [
    ...new Set([
      ...quotes.map((q) => q.requestId),
      ...briefs.map((b) => b.requestId),
    ]),
  ];
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
    // Pagamento ao fornecedor não é pendência de etapa (vira parcela abaixo).
    if (isOffFlowStage(stage.key)) continue;
    const order = orderById.get(stage.orderId);
    if (!order) continue;
    if (!isInvolved(user, order)) continue;
    const mine = openRequirements.filter(
      (r) =>
        r.stageId === stage.id &&
        (wellmix || r.role === user.role) &&
        // Aprovar a arte só vira pendência depois que a arte chega.
        !(
          r.key === "art_approval" &&
          openRequirements.some(
            (x) => x.stageId === stage.id && x.key === "art",
          )
        ),
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
  // Embalagem (faca e arte) a preparar junto com a cotação: a pendência da
  // agência nasce no mesmo instante em que a do fornecedor.
  for (const brief of briefs) {
    const request = quoteRequests.find((r) => r.id === brief.requestId);
    if (!request || request.status === "CANCELLED") continue;
    const { missingPackagingItems } = await import("./packaging-brief-calc");
    const missing = missingPackagingItems(brief).map(
      (k) => PACKAGING_ITEM_LABEL[k],
    );
    tasks.push(
      finish(
        {
          kind: "packaging_brief",
          title: `${request.number ? `Solicitação nº ${request.number}: ` : ""}embalagem (faca e arte): ${request.productName}`,
          detail: [
            missing.length ? `Faltam: ${missing.join(", ")}` : "Obrigatórios enviados",
            `${request.quantity.toLocaleString("pt-BR")} ${request.unit}`,
            request.status === "WAITING_DOWN_PAYMENT"
              ? "aguardando o sinal do cliente"
              : "venda ainda não confirmada",
          ].join(" · "),
          link: `/app/packaging/${brief.id}`,
          dueAt: brief.dueAt,
          stageKey: "PACKAGING",
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
  // Pós-venda aberto: o cliente avalia a compra (pedido cancelado não conta;
  // os cancelados antes de o cancelamento encerrar o pós-venda ainda o têm aberto).
  for (const a of openAfterSales) {
    const order = orderById.get(a.orderId);
    if (!order || order.status === "CANCELLED" || !isInvolved(user, order))
      continue;
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
  // Item de pedido cancelado fica de fora (cancelamentos antigos ainda o têm aberto).
  for (const r of reviews) {
    if (r.orderId && orderById.get(r.orderId)?.status === "CANCELLED") continue;
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
  // Fornecedor: pagamentos da Wellmix a confirmar (pedido ou pago, ainda não
  // recebido) nos pedidos dele; confirma na conta corrente.
  if (supplier) {
    const myOrders = await store.list("orders", {
      filter: { supplierId: user.partyId! },
    });
    const open = myOrders.filter((o) => o.status !== "CANCELLED");
    // Pedido antigo: o recebimento já foi confirmado pela etapa de pagamento.
    const confirmedInOldFlow = open.length
      ? await store.list("requirements", {
          filter: {
            orderId: open.map((o) => o.id),
            key: "payment_received",
            status: "done",
          },
        })
      : [];
    const { legacyReceivedAt, receivedInOldFlow } =
      await import("./supplier-terms");
    const live = open;
    const toConfirm = live.length
      ? await store.list("payments", {
          filter: {
            orderId: live.map((o) => o.id),
            direction: "supplier_out",
            status: ["pending", "confirmed"],
          },
        })
      : [];
    for (const p of toConfirm) {
      const order = live.find((o) => o.id === p.orderId);
      if (!order) continue;
      // Já recebido pela etapa antiga (registrado antes da confirmação dela).
      const receivedAt = legacyReceivedAt(
        confirmedInOldFlow.filter((r) => r.orderId === order.id),
      );
      if (receivedInOldFlow(p, receivedAt)) continue;
      tasks.push(
        finish(
          {
            kind: "confirm_receipt",
            title: `Confirmar recebimento: pedido #${order.number}`,
            detail: `${p.currency} ${p.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${p.note ? ` · ${p.note}` : ""}`,
            link: "/app/account",
            dueAt: null,
            orderNumber: order.number,
          },
          now,
        ),
      );
    }
  }

  // Wellmix: parcelas a pagar a fornecedores vencidas ou vencendo em 7 dias.
  if (wellmix) {
    const { listPayables, payableRows } = await import("./supplier-terms");
    for (const { payable, installment: i } of payableRows(
      await listPayables(),
    )) {
      if (i.status !== "overdue" && i.status !== "due_soon") continue;
      if (!(i.open > 0)) continue;
      tasks.push(
        finish(
          {
            kind: "supplier_payment",
            title: `Pagar fornecedor: pedido #${payable.order.number}`,
            detail: `${payable.supplier?.name ?? "—"} · parcela ${i.index}/${i.count} · ${payable.schedule.currency} ${i.open.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            link: `/app/orders/${payable.order.id}#supplier-payment`,
            dueAt: i.dueDate,
            orderNumber: payable.order.number,
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

/** Entregáveis do briefing de embalagem (pendências saem em português, como as demais). */
const PACKAGING_ITEM_LABEL: Record<string, string> = {
  dieline: "faca (die-cut)",
  art: "arte",
  print_ready: "arquivos para a gráfica",
  packaging_sample: "foto da embalagem física",
};

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
