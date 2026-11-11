import "server-only";

import { translator } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { getStore, type Order, type StageKey, type User } from "@/lib/db";
import { isAdmin, isWellmix } from "@/lib/auth/permissions";
import {
  ORDER_SIGN_SEND,
  ORDER_SIGNED_SUPPLIER,
  ORDER_SIGNED_WELLMIX,
  ROLE_PARTY_FIELD,
  STAGE_TEMPLATES,
  isOffFlowStage,
} from "@/lib/workflow/stages";

export type TaskKind =
  | "booking_invite"
  | "new_request"
  | "requirement"
  | "review"
  | "after_sales"
  | "sourcing_demand"
  | "freight_quote"
  | "supplier_payment"
  | "confirm_receipt"
  | "production_follow"
  | "sku_inspection"
  | "sku_fix"
  | "import_step"
  | "import_validate"
  | "cert_step"
  | "cert_validate"
  | "message_reply"
  | "ncm_classify"
  | "purchase_schedule"
  | "supplier_request";

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
  /** Solicitação de origem. */
  requestId?: string | null;
  /** Pedido do requisito de etapa. */
  orderId?: string | null;
  /** Desde quando a pendência está com quem a vê (ISO); nulo: não se sabe. */
  sinceAt?: string | null;
  /** Quando o produto foi carregado no sistema (a data da solicitação). */
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
  "request",
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
  "booking_invite",
  "new_request",
  "supplier_request",
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
 * `agency.<etapa>`): a arte do pedido e
 * o selo de certificação a aplicar na arte.
 */
export const AGENCY_STEPS = ["art", "seal"] as const;
export type AgencyStep = (typeof AGENCY_STEPS)[number];
export const agencyGroup = (step: AgencyStep) => `agency.${step}`;
const AGENCY_STEP_OF_KIND: Partial<Record<TaskKind, AgencyStep>> = {
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
  const [stages, newRequests, demands, reviews, openAfterSales] =
    await Promise.all([
      store.list("stages", { filter: { status: ["active", "blocked"] } }),
      // Solicitação do cliente ainda sem pedido (as situações da RFQ e do sinal
      // só existem nas antigas): a Wellmix dá o próximo passo.
      wellmix
        ? store.list("requests", {
            filter: {
              status: [
                "REQUESTED",
                "RFQ_OPEN",
                "QUOTATION_RECEIVED",
                "SUPPLIER_SELECTED",
                "WAITING_DOWN_PAYMENT",
              ],
            },
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
        ? store.list("after_sales", {
            filter: { customerId: user.partyId!, status: "open" },
          })
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
  const [orders, openRequirements] = await Promise.all([
    orderIds.length ? store.list("orders", { filter: { id: orderIds } }) : none,
    stages.length
      ? store.list("requirements", {
          filter: {
            stageId: stages.map((s) => s.id),
            status: ["pending", "rejected"],
          },
        })
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

  // Pedido de compra (docs/PURCHASE_ORDER.md): prazos da arte e da validação
  // (Configurações) e a ordem dentro das raias.
  const { isPurchaseFlow } = await import("@/lib/workflow/stages");
  const lanes = orders.some((o) => isPurchaseFlow(o))
    ? {
        ...(await import("@/lib/purchase-lanes")),
        sla: await (await import("./purchase-order")).purchaseLaneSla(),
        all: await store.list("requirements", {
          filter: {
            orderId: orders.filter((o) => isPurchaseFlow(o)).map((o) => o.id),
          },
        }),
      }
    : null;

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
        !(r.key === ORDER_SIGN_SEND && !sealApplied.has(r.orderId)) &&
        // Raias do pedido de compra: só o que já está liberado.
        !(
          lanes &&
          isPurchaseFlow(order) &&
          lanes.blockedBy(
            r.key,
            lanes.all.filter((x) => x.stageId === stage.id),
          ).length
        ),
    );
    if (mine.length === 0) continue;
    // Prazo das raias: o mais próximo entre a arte e a validação pendentes.
    const laneDue =
      lanes && isPurchaseFlow(order)
        ? (mine
            .map((r) =>
              lanes.laneDueAt(
                r.key,
                order.createdAt,
                lanes.all.filter((x) => x.stageId === stage.id),
                lanes.sla,
              ),
            )
            .filter((d): d is string => !!d)
            .sort()[0] ?? null)
        : null;
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
            dueAt: laneDue ?? stage.dueAt,
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

  const { getSettings } = await import("@/lib/settings");
  const flowSettings = await getSettings();
  // Solicitação nova do cliente (a RFQ e a cotação saíram em 11/11/2026).
  for (const request of newRequests)
    tasks.push(
      finish(
        {
          kind: "new_request",
          title: `Solicitação nova: ${request.productName}`,
          detail: `${request.quantity.toLocaleString("pt-BR")} ${request.unit}`,
          link: `/app/requests/${request.id}`,
          dueAt: request.deadline,
          customerId: request.customerId,
          ownerUserId: request.ownerUserId ?? null,
        },
        now,
      ),
    );
  if (supplier) tasks.push(...(await supplierRequestTasks(user, now)));
  if (supplier) tasks.push(...(await bookingInviteTasks(user, now)));
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
    const freightOrderIds = [...new Set(freights.map((f) => f.orderId))];
    const freightOrders = freightOrderIds.length
      ? await store.list("orders", { filter: { id: freightOrderIds } })
      : [];
    for (const f of freights) {
      const order = freightOrders.find((o) => o.id === f.orderId);
      if (!order || order.status === "CANCELLED") continue;
      tasks.push(
        finish(
          {
            kind: "freight_quote",
            title: `Frete: pedido #${order.number}`,
            detail: `${f.totalCbm ?? "?"} m³ · ${f.cartons ?? "?"} cx · ${f.grossWeightKg ?? "?"} kg`,
            link: `/app/freight/${f.id}`,
            chat: { orderId: order.id },
            dueAt: null,
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
    const { isSchemaMissing } = await import("@/lib/db/errors");
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
      // Pedido de compra: a certificação é a raia da certificadora (o
      // certificado de cada produto), não os passos do selo.
      if (cert && p.order.flow === "supplier_request") continue;
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
    // Itens de booking sem produto parecido no cadastro: um por grupo de
    // parecidos (docs/BOOKING.md, "NCM do item"). Só o produto.
    const { pendingNcmGroups } = await import("./booking-ncm");
    for (const group of await pendingNcmGroups(user)) {
      tasks.push(
        finish(
          {
            kind: "ncm_classify",
            title: `Classificar NCM: ${group.key}`,
            detail: `Itens de booking sem NCM: ${group.items.length}`,
            text: {
              title: "bookingNcm.task.title",
              detail: "bookingNcm.task.detail",
              values: { group: group.key, n: group.items.length },
            },
            link: "/app/ncm-items",
            dueAt: null,
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
 * sistema (a data da solicitação)
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
    const requests = await store.list("requests", {
      filter: { id: requestIds },
    });
    for (const task of tasks) {
      if (!task.requestId) continue;
      task.loadedAt =
        requests.find((r) => r.id === task.requestId)?.createdAt ?? null;
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

/*
 * Solicitação ao fornecedor (docs/SUPPLIER_REQUESTS.md): fica na etapa
 * "Responder a solicitação" enquanto a vez é dele: aberta (dizer se faz e em
 * que condições) ou com contraproposta da Wellmix esperando. O prazo é o SLA
 * da negociação. Banco sem a tabela (esquema antigo): nenhuma pendência.
 */
/*
 * Convite para booking concorrente (docs/BOOKING_INVITES.md): o convidado
 * sobe a planilha do booking até o prazo do convite.
 */
async function bookingInviteTasks(user: User, now: Date): Promise<Task[]> {
  const { openInvitesFor } = await import("./booking-invites");
  const rows = await openInvitesFor(user);
  return rows
    .sort((a, b) => a.number - b.number)
    .map((i) => {
      const item =
        i.item.description ??
        i.item.productName ??
        i.item.factoryItemCode ??
        "—";
      const qty = i.item.quantity ?? "?";
      return finish(
        {
          kind: "booking_invite",
          title: `Enviar booking concorrente: ${item}`,
          detail: `${qty} peças · convite nº ${i.number}`,
          text: {
            title: "bookingInvites.task.title",
            detail: "bookingInvites.task.detail",
            values: { item, qty, n: i.number },
          },
          link: `/app/supplier-requests/invites/${i.id}`,
          dueAt: i.dueAt,
          sinceAt: i.createdAt,
          loadedAt: i.createdAt,
          supplierStep: "booking",
        },
        now,
      );
    });
}

async function supplierRequestTasks(user: User, now: Date): Promise<Task[]> {
  const store = getStore();
  let rows;
  try {
    rows = await store.list("supplier_requests", {
      filter: { supplierId: user.partyId!, status: ["open", "answered"] },
    });
  } catch (error) {
    const { isSchemaMissing } = await import("@/lib/db/errors");
    if (isSchemaMissing(error)) return [];
    throw error;
  }
  if (!rows.length) return [];
  const { negotiationTurn, pendingProposal, supplierRequestSlaDue } =
    await import("@/lib/supplier-requests");
  const { supplierRequestSlaMinutes } =
    await import("./supplier-request-negotiation");
  const minutes = await supplierRequestSlaMinutes();
  return rows
    .filter((r) => negotiationTurn(r) === "supplier")
    .sort((a, b) => a.number - b.number)
    .map((r) => {
      const proposal = pendingProposal(r.negotiation);
      const product =
        r.item.description ??
        r.item.productName ??
        r.item.factoryItemCode ??
        "—";
      return finish(
        {
          kind: "supplier_request",
          title: `Solicitação nº ${r.number}: ${product}`,
          detail: proposal
            ? "A Wellmix enviou uma contraproposta: aceite, proponha de novo ou recuse"
            : `${r.quantity} ${r.unit} · diga se faz o item e em que condições`,
          // Traduzido na tela (o fornecedor costuma usar outro idioma).
          text: {
            title: "supplierTasks.request.title",
            detail: proposal
              ? "supplierTasks.request.counter"
              : "supplierTasks.request.detail",
            values: { n: r.number, product, qty: r.quantity, unit: r.unit },
          },
          link: `/app/supplier-requests/${r.id}`,
          dueAt: supplierRequestSlaDue(r, minutes),
          sinceAt: proposal?.at ?? r.createdAt,
          loadedAt: r.createdAt,
          supplierStep: "request",
        },
        now,
      );
    });
}

export function isInvolved(user: User, order: Order): boolean {
  if (isWellmix(user)) return true;
  // Cliente: só o login solicitante (mesma regra de canViewOrder).
  if (user.role === "customer")
    return (
      order.customerId === user.partyId && order.requestedByUserId === user.id
    );
  const field = ROLE_PARTY_FIELD[user.role];
  // Login sem empresa não casa com pedido que ainda não tem esse parceiro.
  if (!field || !user.partyId) return false;
  return order[field] === user.partyId;
}
