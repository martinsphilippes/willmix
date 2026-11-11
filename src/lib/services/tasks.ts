import "server-only";

import { translator } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  getStore,
  type Order,
  type Request,
  type StageKey,
  type User,
} from "@/lib/db";
import { canViewRequest, isAdmin, isWellmix } from "@/lib/auth/permissions";
import {
  ORDER_SIGN_SEND,
  ORDER_SIGNED_SUPPLIER,
  ORDER_SIGNED_WELLMIX,
  ROLE_PARTY_FIELD,
  STAGE_TEMPLATES,
  isOffFlowStage,
} from "@/lib/workflow/stages";

export type TaskKind =
  | "approve_proposal"
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
  | "import_validate"
  | "cert_step"
  | "cert_validate"
  | "message_reply"
  | "ncm_classify"
  | "purchase_schedule";

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
  /**
   * Título e detalhe traduzidos na tela (chave e valores), para pendência de
   * quem usa outro idioma (ex.: fornecedor chinês); sem isto valem `title` e
   * `detail`, em português.
   */
  text?: {
    title: DictionaryKey;
    detail: DictionaryKey;
    values: Record<string, string | number>;
  };
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
  /** Solicitação de origem (acha a linha do Booking do produto). */
  requestId?: string | null;
  /** Pedido do requisito de etapa. */
  orderId?: string | null;
  /** Desde quando a pendência está com quem a vê (ISO); nulo: não se sabe. */
  sinceAt?: string | null;
  /** Quando o produto foi carregado no sistema (linha do Booking; senão, a solicitação). */
  loadedAt?: string | null;
  /** Etapa do caminho do fornecedor (só nas pendências do fornecedor). */
  supplierStep?: SupplierStep;
}

/*
 * Caminho do fornecedor: tudo que chega na mão dele, do Booking ao embarque,
 * na ordem em que acontece. É o filtro "Etapa" da tela de pendências do
 * fornecedor (o grupo da pendência vira `supplier.<etapa>`). Depois do
 * embarque (desembaraço, transporte, entrega ao cliente) nada depende dele.
 */
export const SUPPLIER_STEPS = [
  "booking",
  "dieline",
  "sheet",
  "art",
  "sign",
  "inspection",
  "shipping",
] as const;
export type SupplierStep = (typeof SUPPLIER_STEPS)[number];

export const supplierGroup = (step: SupplierStep) => `supplier.${step}`;

/** A etapa do fornecedor de um grupo `supplier.<etapa>`; nulo nos demais. */
export function supplierStepOfGroup(group: string): SupplierStep | null {
  const step = group.startsWith("supplier.") ? group.slice(9) : "";
  return (SUPPLIER_STEPS as readonly string[]).includes(step)
    ? (step as SupplierStep)
    : null;
}

/** Etapa do pedido → etapa do fornecedor (itens dele que não são a assinatura). */
const SUPPLIER_STAGE_STEP: Partial<Record<StageKey, SupplierStep>> = {
  PREPARATION: "sheet",
  PACKAGING: "art",
  INSPECTION: "inspection",
};

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

/** Item da assinatura do documento → o item da mesma etapa que vem antes dele. */
const SIGN_AFTER: ReadonlyArray<[string, string]> = [
  [ORDER_SIGN_SEND, "art"],
  [ORDER_SIGNED_WELLMIX, ORDER_SIGN_SEND],
  [ORDER_SIGNED_SUPPLIER, ORDER_SIGNED_WELLMIX],
];
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
/*
 * Caminho da agência: o que chega na mão dela, na ordem em que acontece. É o
 * filtro "Etapa" da tela de pendências da agência (o grupo da pendência vira
 * `agency.<etapa>`): a arte pedida na cotação (briefing), a arte do pedido e
 * o selo de certificação a aplicar na arte.
 */
export const AGENCY_STEPS = ["brief", "art", "seal"] as const;
export type AgencyStep = (typeof AGENCY_STEPS)[number];
export const agencyGroup = (step: AgencyStep) => `agency.${step}`;
const AGENCY_STEP_OF_KIND: Partial<Record<TaskKind, AgencyStep>> = {
  packaging_brief: "brief",
  requirement: "art",
  cert_step: "seal",
};

const GROUP_ORDER = [
  ...SUPPLIER_STEPS.map(supplierGroup),
  ...AGENCY_STEPS.map(agencyGroup),
  ...STAGE_ORDER,
  ...KIND_ORDER,
];

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
    group:
      task.group ??
      (task.supplierStep
        ? supplierGroup(task.supplierStep)
        : (task.stageKey ?? task.kind)),
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

  // "Enviar para assinatura" só é pendência com o selo já aplicado na arte
  // (antes disso não há o que apertar): uma consulta só para os pedidos em
  // que o envio está aberto.
  const sendOrderIds = [
    ...new Set(
      openRequirements
        .filter((r) => r.key === ORDER_SIGN_SEND)
        .map((r) => r.orderId),
    ),
  ];
  const sealApplied = new Set(
    sendOrderIds.length
      ? (
          await store
            .list("import_steps", {
              filter: { orderId: sendOrderIds, key: "cert_seal_art" },
            })
            // Tabela ainda não publicada: nenhum selo aplicado.
            .catch(() => [])
        )
          .filter((s) => s.status === "submitted" || s.status === "validated")
          .map((s) => s.orderId)
      : [],
  );

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
        ) &&
        // Documento do pedido (ordem nova): enviar para assinatura só depois
        // da arte; a Wellmix assina depois do envio; o fornecedor, depois dela.
        !SIGN_AFTER.some(
          ([key, before]) =>
            r.key === key &&
            openRequirements.some(
              (x) => x.stageId === stage.id && x.key === before,
            ),
        ) &&
        !(r.key === ORDER_SIGN_SEND && !sealApplied.has(r.orderId)),
    );
    if (mine.length === 0) continue;
    // Fornecedor: a assinatura do documento é uma etapa dele à parte dos
    // outros itens da etapa do pedido (ficha, arte, inspeção).
    const sign = supplier
      ? mine.filter((r) => r.key === ORDER_SIGNED_SUPPLIER)
      : [];
    const rest = supplier
      ? mine.filter((r) => r.key !== ORDER_SIGNED_SUPPLIER)
      : mine;
    for (const [items, step] of [
      [rest, supplier ? SUPPLIER_STAGE_STEP[stage.key] : undefined],
      [sign, "sign"],
    ] as Array<[typeof mine, SupplierStep | undefined]>) {
      if (!items.length) continue;
      tasks.push(
        finish(
          {
            kind: "requirement",
            title: `Pedido #${order.number}: ${stage.key}`,
            detail: items.map((r) => r.label).join(", "),
            link:
              step === "sign"
                ? `/app/orders/${order.id}/purchase-order`
                : `/app/orders/${order.id}`,
            dueAt: stage.dueAt,
            orderNumber: order.number,
            stageKey: stage.key,
            customerId: order.customerId,
            ownerUserId: order.ownerUserId ?? null,
            requestId: order.requestId,
            orderId: order.id,
            sinceAt: stage.startedAt,
            ...(step ? { supplierStep: step } : {}),
          },
          now,
        ),
      );
    }
  }

  // Fase de solicitação. RFQ em espera (docs/RFQ_STANDBY.md): o que veio do
  // Booking é "analisar o Booking" para o fornecedor, e a Wellmix "envia ao
  // fornecedor" em vez de abrir a RFQ.
  const { getSettings } = await import("@/lib/settings");
  const flowSettings = await getSettings();
  const rfqOn = flowSettings.rfqEnabled;
  const fromBooking = new Set(
    quotes.length
      ? (
          await store
            .list("bookings", {
              filter: { requestId: quotes.map((q) => q.requestId) },
            })
            // Tabela ainda não publicada: nenhum veio do Booking.
            .catch(() => [])
        ).map((b) => b.requestId)
      : [],
  );
  for (const quote of quotes) {
    const request = quoteRequests.find((r) => r.id === quote.requestId);
    if (!request) continue;
    tasks.push(
      finish(
        {
          kind: "quote",
          title: fromBooking.has(request.id)
            ? `Analisar o Booking: ${request.productName}`
            : `RFQ: ${request.productName}`,
          detail: `${request.quantity} ${request.unit}`,
          // Traduzido na tela (o fornecedor costuma usar outro idioma).
          text: {
            title: fromBooking.has(request.id)
              ? "supplierTasks.booking.title"
              : "supplierTasks.rfq.title",
            detail: "supplierTasks.booking.detail",
            values: {
              product: request.productName,
              qty: request.quantity,
              unit: request.unit,
            },
          },
          link: `/app/quotes/${quote.id}`,
          chat: { requestId: request.id },
          dueAt: quote.validUntil,
          requestId: request.id,
          // Devolvida pela Wellmix: está com o fornecedor desde a devolução.
          sinceAt:
            quote.negotiation?.at(-1)?.side === "wellmix"
              ? quote.negotiation.at(-1)!.at
              : quote.createdAt,
          supplierStep: "booking",
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
    // A faca é do fornecedor escolhido: a agência é cobrada só do que é dela.
    const { missingOwnerItems, dielineMissing } =
      await import("./packaging-brief-calc");
    const missing = missingOwnerItems(brief).map(
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
            ...(dielineMissing(brief)
              ? ["faca (die-cut): com o fornecedor escolhido"]
              : []),
            `${request.quantity.toLocaleString("pt-BR")} ${request.unit}`,
            inOrder
              ? "pedido pré-aprovado: a arte é pedida antes de a etapa Arte e embalagem começar"
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
  // Faca (die-cut) da embalagem: é do fornecedor escolhido, depois da
  // comparação das cotações (envia pela cotação escolhida ou pelo pedido).
  if (supplier) tasks.push(...(await supplierDielineTasks(user, now)));
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
    const task = requestTask(request, rfqOn);
    if (task.kind === "confirm_payment" && withProof.has(request.id))
      task.detail = "Comprovante enviado pelo cliente: conferir e confirmar";
    tasks.push(finish(task, now));
  }
  for (const request of waitingRequests.filter((r) =>
    canViewRequest(user, r),
  )) {
    // Comprovante já enviado: agora depende da Wellmix confirmar, não do cliente.
    if (withProof.has(request.id)) continue;
    // Primeiro o cliente aprova a proposta; o sinal vem depois.
    if (!request.proposalApprovedAt) {
      const money = (n: number | null) =>
        n === null ? "" : `${request.sellCurrency ?? ""} ${n.toFixed(2)}`;
      tasks.push(
        finish(
          {
            kind: "approve_proposal",
            title: `Aprovar proposta: ${request.productName}`,
            detail: `${money(request.sellPrice)} · depois de aprovar, o sinal de ${money(request.downPaymentAmount)}`,
            text: {
              title: "tasks.proposal.title",
              detail: "tasks.proposal.detail",
              values: {
                product: request.productName,
                total: money(request.sellPrice),
                down: money(request.downPaymentAmount),
              },
            },
            link: `/app/requests/${request.id}#proposal`,
            dueAt: null,
          },
          now,
        ),
      );
      continue;
    }
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
  // Com o Sourcing em espera (decisão do dono) não é pendência de ninguém.
  const withRequest = flowSettings.sourcingEnabled
    ? demands.filter((x) => x.requestId)
    : [];
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
            requestId: p.order.requestId,
            sinceAt: p.sinceAt ?? null,
            ...(supplier ? { supplierStep: "inspection" as const } : {}),
            orderNumber: p.order.number,
            customerId: p.order.customerId,
            ownerUserId: p.order.ownerUserId ?? null,
          },
          now,
        ),
      );
  }
  // Embarque e desembaraço (Fase D) e certificação (Fase F): passos a fazer
  // e a validar. A agência entra pelo selo de certificação a aplicar na arte.
  const importRole =
    user.role === "comex" ||
    user.role === "logistics" ||
    user.role === "ocp" ||
    user.role === "agency"
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
                  : importRole === "agency"
                    ? "agencyId"
                    : "logisticsId"]: user.partyId!,
            }
          : supplier
            ? { supplierId: user.partyId! }
            : {
                status: [
                  // Pedido recém-criado: só o selo de certificação já vale.
                  "ORDER_CREATED",
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
    const ptText = translator("pt");
    for (const p of await importTasks(user, orders)) {
      const step = IMPORT_STEP_LABEL[p.key] ?? p.key;
      const cert = p.kind === "cert_step" || p.kind === "cert_validate";
      const validate =
        p.kind === "import_validate" || p.kind === "cert_validate";
      // Selo sem certificadora no pedido: a pendência é da Wellmix, que
      // designa a certificadora em Parceiros do pedido.
      const assignOcp =
        p.kind === "cert_step" && p.key === "cert_seal" && !p.order.ocpId;
      // Selo de certificação: texto próprio, traduzido na tela.
      const seal =
        SEAL_TASK_TEXT[assignOcp ? "assign_ocp" : `${p.kind}:${p.key}`];
      const values = { n: p.order.number };
      tasks.push(
        finish(
          {
            kind: p.kind,
            title: seal
              ? ptText(seal.title, values)
              : validate
                ? `Validar ${step}: pedido #${p.order.number}`
                : `${step}: pedido #${p.order.number}`,
            detail: seal ? ptText(seal.detail, values) : "",
            ...(seal ? { text: { ...seal, values } } : {}),
            link: `/app/orders/${p.order.id}#${assignOcp ? "order-partners" : cert ? "certification" : "import-flow"}`,
            dueAt: null,
            requestId: p.order.requestId,
            sinceAt: p.sinceAt ?? null,
            ...(supplier && !cert ? { supplierStep: "shipping" as const } : {}),
            orderNumber: p.order.number,
            customerId: p.order.customerId,
            ownerUserId: p.order.ownerUserId ?? null,
          },
          now,
        ),
      );
    }
  }
  // Mensagens que a Wellmix deve responder (Controladoria de mensagens):
  // prazo de 1 dia útil; o analista é quem escreveu por último pela Wellmix.
  if (wellmix) {
    const { wellmixMessageDebts } = await import("./message-control");
    for (const m of await wellmixMessageDebts(now)) {
      tasks.push(
        finish(
          {
            kind: "message_reply",
            title: `Responder ${m.partyName}`,
            detail: `${m.title ?? "Geral"} · ${m.lastAuthorName}: ${m.lastPreview}`,
            link: m.href,
            chat: m.orderItemId
              ? undefined
              : { orderId: m.orderId, requestId: m.requestId },
            dueAt: m.dueAt,
            customerId: m.customerId,
            ownerUserId: m.analystId,
          },
          now,
        ),
      );
    }
  }
  // Programação de compra (lotes, caixas, container): quem faz é a Wellmix,
  // o administrador (dono, 10/11/2026). Pedido na Preparação, com ficha de
  // compra e ainda sem o 1º lote, vira pendência dele.
  if (isAdmin(user)) {
    const { normalizeLots } = await import("./purchase-sheet-calc");
    const stages = await store.list("stages", {
      filter: { key: "PREPARATION", status: ["active", "blocked"] },
    });
    const orderIds = stages.map((s) => s.orderId);
    const [sheets, orders] = orderIds.length
      ? await Promise.all([
          store.list("purchase_sheets", { filter: { orderId: orderIds } }),
          store.list("orders", { filter: { id: orderIds } }),
        ])
      : [[], []];
    for (const stage of stages) {
      const order = orders.find((o) => o.id === stage.orderId);
      const sheet = sheets.find((x) => x.orderId === stage.orderId);
      if (!order || !sheet) continue;
      if (order.status === "CANCELLED" || order.status === "CLOSED") continue;
      const first = normalizeLots(sheet.lots)[0];
      const done =
        typeof first.masterCartons === "number" &&
        first.masterCartons > 0 &&
        typeof first.departureIntervalDays === "number";
      if (done) continue;
      tasks.push(
        finish(
          {
            kind: "purchase_schedule",
            title: `Fazer a programação de compra: pedido #${order.number}`,
            detail:
              "Informe os lotes (caixas e dias de saída) na ficha de compra do pedido",
            text: {
              title: "tasks.schedule.title",
              detail: "tasks.schedule.detail",
              values: { n: order.number },
            },
            link: `/app/orders/${order.id}/purchase-sheet`,
            dueAt: stage.dueAt,
            orderNumber: order.number,
            customerId: order.customerId,
            ownerUserId: order.ownerUserId,
          },
          now,
        ),
      );
    }
  }
  // Despachante: produto de solicitação aberta sem NCM (ele classifica; a
  // Wellmix também pode, na solicitação). Só o produto: sem cliente nem valor.
  if (user.role === "broker" && user.partyId) {
    const { ncmPendingRequests } = await import("./request-ncm");
    for (const request of await ncmPendingRequests()) {
      tasks.push(
        finish(
          {
            kind: "ncm_classify",
            title: `Classificar NCM: ${request.productName}`,
            detail: request.number
              ? `Solicitação nº ${request.number} · confira as sugestões e confirme o NCM`
              : "Confira as sugestões e confirme o NCM",
            text: {
              title: "tasks.ncm.title",
              detail: request.number
                ? "tasks.ncm.detail"
                : "tasks.ncm.detailNoNumber",
              values: {
                product: request.productName,
                n: request.number ?? "",
              },
            },
            link: `/app/requests/${request.id}/ncm`,
            dueAt: request.deadline,
          },
          now,
        ),
      );
    }
  }
  if (supplier) await datesForSupplier(tasks);
  // Pelo prazo: as mais urgentes primeiro; sem prazo por último.
  // Agência: cada pendência entra na etapa dela (filtros da tela).
  if (agency)
    for (const task of tasks) {
      const step = AGENCY_STEP_OF_KIND[task.kind];
      if (step) task.group = agencyGroup(step);
    }
  return sortTasks(tasks);
}

/**
 * Datas das pendências do fornecedor: quando o produto foi carregado no
 * sistema (a linha do Booking da solicitação; sem ela, a própria solicitação)
 * e, na arte e na assinatura, desde quando o item está com ele (a arte
 * enviada; o documento assinado pela Wellmix).
 */
async function datesForSupplier(tasks: Task[]): Promise<void> {
  const store = getStore();
  const requestIds = [
    ...new Set(
      tasks.map((t) => t.requestId).filter((id): id is string => !!id),
    ),
  ];
  if (requestIds.length) {
    const [bookings, requests] = await Promise.all([
      store
        .list("bookings", { filter: { requestId: requestIds } })
        // Tabela ainda não publicada: vale a data da solicitação.
        .catch(() => []),
      store.list("requests", { filter: { id: requestIds } }),
    ]);
    for (const task of tasks) {
      if (!task.requestId) continue;
      task.loadedAt =
        bookings.find((b) => b.requestId === task.requestId)?.createdAt ??
        requests.find((r) => r.id === task.requestId)?.createdAt ??
        null;
    }
  }
  const waiting = tasks.filter(
    (t) =>
      t.kind === "requirement" &&
      !!t.orderId &&
      (t.supplierStep === "art" || t.supplierStep === "sign"),
  );
  if (!waiting.length) return;
  const before = await store.list("requirements", {
    filter: {
      orderId: [...new Set(waiting.map((t) => t.orderId!))],
      key: ["art", ORDER_SIGNED_WELLMIX],
    },
  });
  for (const task of waiting) {
    const row = before.find(
      (r) =>
        r.orderId === task.orderId &&
        r.key === (task.supplierStep === "sign" ? ORDER_SIGNED_WELLMIX : "art"),
    );
    if (row?.submittedAt) task.sinceAt = row.submittedAt;
  }
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
  cert_seal: "Selo",
  cert_seal_art: "Selo aplicado na arte",
};

/** Pendências do selo de certificação (tipo da pendência + passo): título e detalhe traduzidos. */
const SEAL_TASK_TEXT: Record<
  string,
  { title: DictionaryKey; detail: DictionaryKey } | undefined
> = {
  "cert_step:cert_seal": {
    title: "tasks.seal.issue.title",
    detail: "tasks.seal.issue.detail",
  },
  "cert_step:cert_seal_art": {
    title: "tasks.seal.apply.title",
    detail: "tasks.seal.apply.detail",
  },
  "cert_validate:cert_seal_art": {
    title: "tasks.seal.validate.title",
    detail: "tasks.seal.validate.detail",
  },
  assign_ocp: {
    title: "tasks.seal.assign.title",
    detail: "tasks.seal.assign.detail",
  },
};

/** Nível da aprovação do pré-custo (pendências saem em português, como as demais). */
const APPROVAL_LEVEL_LABEL: Record<string, string> = {
  planner: "planner",
  purchasing_director: "diretoria de compras",
  executive_director: "diretoria executiva",
};

/** Entregáveis do briefing de embalagem (pendências saem em português, como as demais). */
/** Situações do pedido em que a etapa "Die Cut" ainda cobra os quatro itens. */
const DIE_CUT_STEP_ORDER_STATUSES: string[] = [
  "ORDER_CREATED",
  "PREPARATION",
  "SUPPLIER_PAYMENT",
  "PACKAGING",
];

/** Ordem dos itens na etapa "Die Cut" (a mesma do cartão do fornecedor). */
const DIE_CUT_ITEM_ORDER = ["dieline", "hd", "moq", "leadTime"];

/** Itens da etapa "Die Cut" (pendências saem em português, como as demais). */
const DIE_CUT_ITEM_LABEL: Record<string, string> = {
  dieline: "die-cut",
  hd: "foto em alta",
  moq: "pedido mínimo",
  leadTime: "prazo de entrega",
};

/**
 * Pendências da etapa "Die Cut" do fornecedor escolhido: die-cut, foto em
 * alta, pedido mínimo e prazo de entrega (src/lib/services/die-cut-step.ts).
 */
async function supplierDielineTasks(user: User, now: Date): Promise<Task[]> {
  const store = getStore();
  const selected = await store.list("quotes", {
    filter: { supplierId: user.partyId!, status: "selected" },
  });
  if (!selected.length) return [];
  const { dielineMissing } = await import("./packaging-brief-calc");
  const briefs = (
    await store
      .list("packaging_briefs", {
        filter: {
          requestId: [...new Set(selected.map((q) => q.requestId))],
          status: ["open", "ready", "transferred"],
        },
      })
      .catch(() => [])
  )
    // Etapa "Die Cut": só onde o die-cut é um entregável do briefing.
    .filter((b) => b.requiredKeys.includes("dieline"));
  if (!briefs.length) return [];
  const { superplanMissing } = await import("@/lib/superplan-rfq");
  // Foto em alta: fica na ficha da cotação escolhida.
  const hdQuoteIds = new Set(
    (
      await store
        .list("product_photos", {
          filter: { orderId: selected.map((q) => q.id), kind: "hd" },
        })
        .catch(() => [])
    ).map((p) => p.orderId),
  );
  const orderIds = briefs
    .map((b) => b.orderId)
    .filter((id): id is string => !!id);
  const [requests, orders] = await Promise.all([
    store.list("requests", {
      filter: { id: [...new Set(briefs.map((b) => b.requestId))] },
    }),
    orderIds.length
      ? store.list("orders", { filter: { id: orderIds } })
      : Promise.resolve([]),
  ]);
  const out: Task[] = [];
  for (const brief of briefs) {
    const request = requests.find((r) => r.id === brief.requestId);
    if (!request || request.status === "CANCELLED") continue;
    // Só a cotação escolhida desta solicitação (e o pedido dela) cobra a faca.
    if (!selected.some((q) => q.id === request.selectedQuoteId)) continue;
    const order = brief.orderId
      ? orders.find((o) => o.id === brief.orderId)
      : null;
    if (brief.orderId && (!order || order.supplierId !== user.partyId))
      continue;
    // Os quatro itens da etapa: die-cut, foto em alta, MOQ e prazo. Pedido
    // que já passou da arte (produção em diante) só cobra o die-cut que
    // ficou faltando: os outros três não voltam a cobrar pedido antigo.
    const quote = selected.find((q) => q.id === request.selectedQuoteId)!;
    const early = !order || DIE_CUT_STEP_ORDER_STATUSES.includes(order.status);
    const missing = early
      ? superplanMissing({
          dieline: !dielineMissing(brief),
          moq: quote.moq ?? null,
          leadTimeDays: quote.leadTimeDays,
          hd: hdQuoteIds.has(quote.id),
        })
      : dielineMissing(brief)
        ? ["dieline" as const]
        : [];
    if (!missing.length) continue;
    out.push(
      finish(
        {
          kind: "packaging_brief",
          title: `Die Cut: ${request.productName}`,
          text: {
            title: "tasks.dieline.title",
            detail: order
              ? "tasks.dieline.detailOrder"
              : request.number
                ? "tasks.dieline.detailRequest"
                : "tasks.dieline.detail",
            values: {
              product: request.productName,
              n: order?.number ?? request.number ?? "",
            },
          },
          detail: [
            order
              ? `Pedido #${order.number}`
              : request.number
                ? `Solicitação nº ${request.number}`
                : null,
            `falta: ${DIE_CUT_ITEM_ORDER.filter((m) =>
              (missing as string[]).includes(m),
            )
              .map((m) => DIE_CUT_ITEM_LABEL[m])
              .join(", ")}`,
          ]
            .filter(Boolean)
            .join(" · "),
          link: order
            ? `/app/orders/${order.id}#die-cut`
            : `/app/quotes/${request.selectedQuoteId}#die-cut`,
          chat: order ? { orderId: order.id } : { requestId: request.id },
          dueAt: brief.dueAt,
          orderNumber: order?.number,
          requestId: request.id,
          // A faca passa a ser dele quando a cotação é escolhida (ou o pedido nasce).
          sinceAt:
            order?.createdAt ??
            selected.find((q) => q.id === request.selectedQuoteId)?.updatedAt ??
            brief.createdAt,
          supplierStep: "dieline",
        },
        now,
      ),
    );
  }
  return out;
}

const PACKAGING_ITEM_LABEL: Record<string, string> = {
  dieline: "faca (die-cut)",
  art: "arte",
  print_ready: "arquivos para a gráfica",
  packaging_sample: "foto da embalagem física",
};

function requestTask(request: Request, rfqOn = true): DraftTask {
  const base = {
    // RFQ em espera: o envio ao fornecedor é na tela Pedidos → RFQ.
    link:
      !rfqOn && request.status === "REQUESTED"
        ? `/app/rfq#req-${request.id}`
        : `/app/requests/${request.id}`,
    dueAt: request.deadline,
    customerId: request.customerId,
    ownerUserId: request.ownerUserId ?? null,
  };
  switch (request.status) {
    case "REQUESTED":
      return {
        kind: "rfq",
        title: rfqOn
          ? `Abrir RFQ: ${request.productName}`
          : `Enviar ao fornecedor: ${request.productName}`,
        detail: rfqOn
          ? "Selecione fornecedores"
          : "Escolha o fornecedor que vai analisar o produto",
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
        // Etapa "Proposta ao cliente": antes do sinal, o cliente aprova.
        detail: request.proposalApprovedAt
          ? "Aguardando pagamento do cliente"
          : "Aguardando o cliente aprovar a proposta",
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
