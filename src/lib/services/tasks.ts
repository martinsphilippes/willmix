import "server-only";

import {
  getStore,
  type Order,
  type Request,
  type StageKey,
  type User,
} from "@/lib/db";
import { canViewRequest, isAdmin, isWellmix } from "@/lib/auth/permissions";
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
  | "packaging_brief"
  | "approval"
  | "production_follow"
  | "sku_inspection"
  | "sku_fix"
  | "import_step"
  | "import_validate";

/** Situação da pendência em relação ao prazo (dia civil em Brasília). */
export type TaskDue = "overdue" | "today" | "week" | "later" | "none";

export interface Task {
  kind: TaskKind;
  title: string;
  detail: string;
  /** Pedido/solicitação da conversa (ícone de chat) quando o link não é deles (cotação, embalagem, frete). */
  chat?: { orderId?: string | null; requestId?: string | null };
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
  /** Cliente da pendência (mostrado no painel de SLA). */
  customerId?: string | null;
  /** Analista responsável (da solicitação/do pedido): dono no painel de SLA. */
  ownerUserId?: string | null;
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
              status: ["open", "transferred"],
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
  // Antes do pedido: briefing aberto. Depois do pedido: só a arte ainda por
  // enviar e só enquanto a etapa Arte e embalagem não começou (depois, a
  // etapa cobra). Briefing "aberto" de solicitação já pedida (transferência
  // que falhou) não cobra ninguém.
  const transferredOpen = openBriefs.filter(
    (b) => b.status === "transferred" && b.orderId && !b.artDocumentId,
  );
  const packagingStages = transferredOpen.length
    ? await store
        .list("stages", {
          filter: {
            orderId: [...new Set(transferredOpen.map((b) => b.orderId!))],
            key: "PACKAGING",
          },
        })
        .catch(() => [])
    : [];
  const briefs = [
    ...openBriefs.filter((b) => b.status === "open" && !b.orderId),
    ...transferredOpen.filter((b) =>
      packagingStages.some(
        (s) => s.orderId === b.orderId && s.status === "pending",
      ),
    ),
  ];
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
          customerId: order.customerId,
          ownerUserId: order.ownerUserId ?? null,
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
          chat: { requestId: request.id },
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
    if (brief.status === "open" && request.status === "ORDERED") continue;
    const { missingPackagingItems } = await import("./packaging-brief-calc");
    const missing = missingPackagingItems(brief).map(
      (k) => PACKAGING_ITEM_LABEL[k],
    );
    const inOrder = brief.status === "transferred";
    tasks.push(
      finish(
        {
          kind: "packaging_brief",
          title: `${request.number ? `Solicitação nº ${request.number}: ` : ""}embalagem (faca e arte): ${request.productName}`,
          detail: [
            missing.length
              ? `Faltam: ${missing.join(", ")}`
              : "Obrigatórios enviados",
            `${request.quantity.toLocaleString("pt-BR")} ${request.unit}`,
            inOrder
              ? "pedido criado: a arte é pedida antes de a etapa Arte e embalagem começar"
              : request.status === "WAITING_DOWN_PAYMENT"
                ? "aguardando o sinal do cliente"
                : "venda ainda não confirmada",
          ].join(" · "),
          link: `/app/packaging/${brief.id}`,
          chat: { requestId: request.id },
          dueAt: brief.dueAt,
          stageKey: "PACKAGING",
          customerId: request.customerId,
          ownerUserId: request.ownerUserId ?? null,
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
  // Aprovação do pré-custo: a escolha do fornecedor aguarda os aprovadores;
  // a solicitação não pede mais "escolher fornecedor" enquanto isso.
  const { approvalsToDecide, pendingApprovalsAll } =
    await import("./approvals");
  const awaitingApproval = wellmix
    ? new Set((await pendingApprovalsAll()).map((a) => a.requestId))
    : new Set<string>();
  if (wellmix) {
    const mineToDecide = await approvalsToDecide(user);
    const approvalRequests = mineToDecide.length
      ? await store.list("requests", {
          filter: { id: [...new Set(mineToDecide.map((a) => a.requestId))] },
        })
      : [];
    for (const a of mineToDecide) {
      const r = approvalRequests.find((x) => x.id === a.requestId);
      if (!r) continue;
      const input = a.input as { sellPrice?: number; sellCurrency?: string };
      tasks.push(
        finish(
          {
            kind: "approval",
            title: `Aprovar pré-custo (${APPROVAL_LEVEL_LABEL[a.currentLevel ?? "planner"]}): ${r.productName}`,
            detail: `Valor ao cliente ${input.sellCurrency ?? ""} ${(input.sellPrice ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            link: `/app/requests/${r.id}#approval`,
            dueAt: r.deadline,
            customerId: r.customerId,
            ownerUserId: r.ownerUserId ?? null,
          },
          now,
        ),
      );
    }
  }
  for (const request of wellmixRequests) {
    if (awaitingApproval.has(request.id)) continue;
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
          customerId: order.customerId,
          ownerUserId: order.ownerUserId ?? null,
        },
        now,
      ),
    );
  }

  // Sourcing sob demanda: produto pedido por cliente ainda sem fornecedor.
  const withRequest = demands.filter((x) => x.requestId);
  const demandRequests = withRequest.length
    ? await store.list("requests", {
        filter: { id: [...new Set(withRequest.map((d) => d.requestId!))] },
      })
    : [];
  for (const d of withRequest) {
    tasks.push(
      finish(
        {
          kind: "sourcing_demand",
          title: `Sourcing sob demanda: ${d.name}`,
          detail: d.notes ?? "Localizar fornecedores e cadastrar opções",
          link: `/app/sourcing/items/${d.id}`,
          dueAt: null,
          customerId:
            demandRequests.find((r) => r.id === d.requestId)?.customerId ??
            null,
          ownerUserId:
            demandRequests.find((r) => r.id === d.requestId)?.ownerUserId ??
            null,
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
          customerId: r.orderId
            ? (orderById.get(r.orderId)?.customerId ?? null)
            : null,
          ownerUserId: r.orderId
            ? (orderById.get(r.orderId)?.ownerUserId ?? null)
            : null,
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
            chat: { requestId: request.id },
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

  // Admin (financeiro é só dele): parcelas a pagar a fornecedores vencidas ou vencendo em 7 dias.
  if (isAdmin(user)) {
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
            customerId: payable.order.customerId,
            ownerUserId: payable.order.ownerUserId ?? null,
          },
          now,
        ),
      );
    }
  }
  // Produção (Fase C): follow 5/15/25 e reinspeção (Wellmix); SKU reprovado
  // a corrigir (fornecedor).
  if (wellmix || supplier) {
    const orders = await store.list("orders", {
      filter: supplier
        ? { supplierId: user.partyId! }
        : {
            status: [
              "ORDER_CREATED",
              "PREPARATION",
              "SUPPLIER_PAYMENT",
              "PACKAGING",
              "INSPECTION",
              "SHIPPING",
            ],
          },
    });
    const { productionTasks } = await import("./production");
    for (const p of await productionTasks(user, orders))
      tasks.push(
        finish(
          {
            kind: p.kind,
            title: p.title,
            detail: p.detail,
            link: `/app/orders/${p.order.id}#production`,
            dueAt: p.dueAt,
            orderNumber: p.order.number,
            customerId: p.order.customerId,
            ownerUserId: p.order.ownerUserId ?? null,
          },
          now,
        ),
      );
  }
  // Embarque e desembaraço (Fase D): passos a fazer e a validar.
  const importRole =
    user.role === "comex" || user.role === "logistics" || user.role === "ocp"
      ? user.role
      : null;
  if (wellmix || supplier || (importRole && user.partyId)) {
    const { importTasks } = await import("./import-flow");
    const { isSchemaMissing } = await import("./packaging-brief");
    let orders: Order[] = [];
    try {
      orders = await store.list("orders", {
        filter: importRole
          ? {
              [importRole === "comex"
                ? "comexId"
                : importRole === "ocp"
                  ? "ocpId"
                  : "logisticsId"]: user.partyId!,
            }
          : supplier
            ? { supplierId: user.partyId! }
            : {
                status: [
                  "PREPARATION",
                  "PACKAGING",
                  "INSPECTION",
                  "SHIPPING",
                  "CUSTOMS",
                  "TRANSPORT",
                ],
              },
      });
    } catch (error) {
      // Coluna nova ainda não publicada no Appwrite: sem pendências.
      if (!isSchemaMissing(error)) throw error;
    }
    for (const p of await importTasks(user, orders)) {
      const step = IMPORT_STEP_LABEL[p.key] ?? p.key;
      tasks.push(
        finish(
          {
            kind: p.kind,
            title:
              p.kind === "import_validate"
                ? `Validar ${step}: pedido #${p.order.number}`
                : `${step}: pedido #${p.order.number}`,
            detail: "",
            link: `/app/orders/${p.order.id}#import-flow`,
            dueAt: null,
            orderNumber: p.order.number,
            customerId: p.order.customerId,
            ownerUserId: p.order.ownerUserId ?? null,
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

/** Passos do embarque/desembaraço (pendências saem em português, como as demais). */
const IMPORT_STEP_LABEL: Record<string, string> = {
  booking: "Booking",
  draft_bl: "Draft do BL",
  invoice_packing: "Invoice e packing list",
  invoice_signed: "Invoice assinada",
  bl: "BL",
  cargo_presence: "Presença de carga",
  numerario: "Numerário",
  numerario_paid: "Pagar numerário",
  channel: "Canal de parametrização",
  di: "DI/DUIMP e XML",
  ce_mercante: "CE Mercante",
  ci: "Comprovante de importação (CI)",
  danfe: "DANFE",
  cert_memorial: "Memorial descritivo (certificação)",
  cert_lab: "Ensaio em laboratório (laudo)",
  cert_registration: "Número de registro (certificado)",
};

/** Nível da aprovação do pré-custo (pendências saem em português, como as demais). */
const APPROVAL_LEVEL_LABEL: Record<string, string> = {
  planner: "planner",
  purchasing_director: "diretoria de compras",
  executive_director: "diretoria executiva",
};

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
    customerId: request.customerId,
    ownerUserId: request.ownerUserId ?? null,
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
