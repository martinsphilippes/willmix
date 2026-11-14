import "server-only";

import { translator } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  getStore,
  type Order,
  type Requirement,
  type Stage,
  type StageKey,
  type User,
} from "@/lib/db";
import { isAdmin, isWellmix } from "@/lib/auth/permissions";
import type { TaskItem } from "@/lib/task-owner";
import { can } from "@/lib/auth/function-access";
import {
  ORDER_SIGN_SEND,
  ORDER_SIGNED_SUPPLIER,
  ORDER_SIGNED_WELLMIX,
  ROLE_PARTY_FIELD,
  STAGE_TEMPLATES,
  isOffFlowStage,
  isPurchaseFlow,
} from "@/lib/workflow/stages";
import { dieCutHref, dieCutItemOf, dieCutProducts } from "@/lib/die-cut-step";
import { blockedBy } from "@/lib/purchase-lanes";
import { realName, withoutPlaceholder } from "@/lib/placeholder-name";
import { isRoutedLaneKey } from "@/lib/purchase-lanes";

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
  | "supplier_request"
  | "sampling"
  | "sampling_validate"
  | "art_fix"
  | "art_review"
  | "invoice_due"
  | "real_media";

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
    /** Frase a mais no detalhe (ex.: o que falta designar e onde). */
    detailExtra?: DictionaryKey;
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
  /** Itens da etapa na pendência (filtro por função do operador, src/lib/task-owner.ts). */
  items?: TaskItem[];
  /** Passo do embarque ou da certificação ("assign": designar o despachante). */
  stepKey?: string | null;
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
  "sampling",
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

/**
 * O item ainda espera outro e não vira pendência (nem tarefa de ninguém na
 * linha do tempo): aprovar a arte antes de ela chegar; a cadeia do documento
 * do pedido (enviar, a Wellmix assina, o fornecedor assina); enviar para
 * assinatura sem o selo aplicado na arte; no pedido de compra, o passo
 * anterior da raia. `open`: os itens abertos da etapa; `all`: todos os itens
 * da etapa (a ordem das raias olha os concluídos).
 */
export function requirementWaiting(
  r: Pick<Requirement, "key">,
  stage: { open: readonly Pick<Requirement, "key">[]; all: Requirement[] },
  options: { sealApplied: boolean; purchase: boolean },
): boolean {
  // Aprovar a arte só vira pendência depois que a arte chega.
  if (r.key === "art_approval" && stage.open.some((x) => x.key === "art"))
    return true;
  // Documento do pedido (ordem nova): enviar para assinatura só depois da
  // arte; a Wellmix assina depois do envio; o fornecedor, depois dela.
  if (
    SIGN_AFTER.some(
      ([key, before]) =>
        r.key === key && stage.open.some((x) => x.key === before),
    )
  )
    return true;
  if (r.key === ORDER_SIGN_SEND && !options.sealApplied) return true;
  // Raias do pedido de compra: só o que já está liberado.
  return options.purchase && blockedBy(r.key, stage.all).length > 0;
}
const KIND_ORDER: string[] = [
  "booking_invite",
  "new_request",
  "supplier_request",
  "sampling_validate",
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
  art_fix: "art",
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

/** Pendência antes de `finish` (prazo e grupo calculados na hora da leitura). */
export type TaskDraft = Parameters<typeof finish>[0];

type Lanes = typeof import("@/lib/purchase-lanes") & {
  sla: Awaited<ReturnType<typeof import("./purchase-order").purchaseLaneSla>>;
  all: Requirement[];
};

/**
 * Pendências dos itens das etapas em andamento ou bloqueadas (função pura):
 * a regra de `pendingTasksFor`, também usada no resumo de cada pedido para a
 * Wellmix (as mesmas para toda a equipe).
 */
export function stageTaskDrafts(
  user: User,
  input: {
    stages: Stage[];
    orderById: Map<string, Order>;
    openRequirements: Requirement[];
    sealApplied: Set<string>;
    lanes: Lanes | null;
  },
): TaskDraft[] {
  const { stages, orderById, openRequirements, sealApplied, lanes } = input;
  const wellmix = isWellmix(user);
  const supplier = user.role === "supplier" && !!user.partyId;
  const out: TaskDraft[] = [];
  for (const stage of stages) {
    // Pagamento ao fornecedor não é pendência de etapa (vira parcela abaixo).
    if (isOffFlowStage(stage.key)) continue;
    const order = orderById.get(stage.orderId);
    if (!order) continue;
    if (!isInvolved(user, order)) continue;
    const stageOpen = openRequirements.filter((x) => x.stageId === stage.id);
    const stageAll = lanes
      ? lanes.all.filter((x) => x.stageId === stage.id)
      : [];
    const mine = stageOpen.filter(
      (r) =>
        (wellmix ||
          r.role === user.role ||
          // Arte e certificado do pedido de compra: o designer da agência e a
          // certificadora recebem por login (routeLaneTasks), não pelo papel.
          (isRoutedLaneKey(r.key) &&
            (user.role === "agency" || user.role === "ocp"))) &&
        !requirementWaiting(
          r,
          { open: stageOpen, all: stageAll },
          {
            sealApplied: sealApplied.has(r.orderId),
            purchase: !!lanes && isPurchaseFlow(order),
          },
        ),
    );
    if (mine.length === 0) continue;
    // Prazo de cada passo (Configurações → SLA): o mais próximo dos pendentes.
    const laneDue =
      lanes && isPurchaseFlow(order)
        ? (mine
            .map((r) =>
              lanes.laneDueAt(
                r.key,
                order.createdAt,
                lanes.all.filter((x) => x.stageId === stage.id),
                lanes.sla,
                stage.startedAt,
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
    // Fornecedor do pedido de compra: os quatro itens do Die Cut (die-cut,
    // foto em alta, pedido mínimo e prazo) são uma etapa dele, produto a
    // produto, e abrem no quadro Die Cut do pedido.
    const dieCut =
      supplier && isPurchaseFlow(order)
        ? dieCutProducts(rest.filter((r) => dieCutItemOf(r.key)))
        : [];
    const other = dieCut.length
      ? rest.filter((r) => !dieCutItemOf(r.key))
      : rest;
    for (const product of dieCut)
      out.push({
        kind: "requirement",
        title: `Die Cut: ${product.name}`,
        detail: `Pedido #${order.number} · die-cut, foto em alta, pedido mínimo e prazo de entrega`,
        text: {
          title: "tasks.dieline.title",
          detail: "tasks.dieline.detailOrder",
          values: { product: product.name, n: order.number },
        },
        link: dieCutHref(order.id, product.itemId),
        dueAt: laneDue ?? stage.dueAt,
        orderNumber: order.number,
        stageKey: stage.key,
        customerId: order.customerId,
        ownerUserId: order.ownerUserId ?? null,
        requestId: order.requestId,
        orderId: order.id,
        sinceAt: stage.startedAt,
        supplierStep: "dieline",
      });
    for (const [items, step] of [
      [other, supplier ? SUPPLIER_STAGE_STEP[stage.key] : undefined],
      [sign, "sign"],
    ] as Array<[typeof mine, SupplierStep | undefined]>) {
      if (!items.length) continue;
      out.push({
        kind: "requirement",
        title: `Pedido #${order.number}: ${stage.key}`,
        detail: withoutPlaceholder(items.map((r) => r.label).join(", ")),
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
        items: items.map((r) => ({ key: r.key, role: r.role, label: r.label })),
        ...(step ? { supplierStep: step } : {}),
      });
    }
  }

  return out;
}

/**
 * As quatro tarefas da Preparação do pedido de compra com dono por login
 * (arte, validação, certificado e arte final; dono, 14/11/2026): cada item
 * fica só com quem o recebe (`seesLaneTask`); o administrador vê todos. No
 * painel da equipe (`team`), todos. Item sem dono certo diz o que falta
 * designar. A pendência que fica sem item sai da lista.
 */
async function routeLaneTasks(
  user: User,
  tasks: Task[],
  team: boolean,
): Promise<Task[]> {
  const routed = tasks.filter(
    (t) =>
      t.kind === "requirement" &&
      !!t.orderId &&
      t.items?.some((i) => isRoutedLaneKey(i.key)),
  );
  if (!routed.length) return tasks;
  const ids = [...new Set(routed.map((t) => t.orderId as string))];
  const store = getStore();
  const { laneRoute, loadRoutingContext, seesLaneTask } =
    await import("./cert-art-routing");
  const [orders, requirements, ctx] = await Promise.all([
    store.list("orders", { filter: { id: ids } }),
    store.list("requirements", { filter: { orderId: ids } }),
    loadRoutingContext(),
  ]);
  const orderById = new Map(orders.map((o) => [o.id, o]));
  const out: Task[] = [];
  for (const task of tasks) {
    const order = task.orderId ? orderById.get(task.orderId) : undefined;
    if (!routed.includes(task) || !order) {
      out.push(task);
      continue;
    }
    const siblings = requirements.filter((r) => r.orderId === order.id);
    const items: TaskItem[] = [];
    let missing: keyof typeof MISSING_TASK_TEXT | null = null;
    for (const item of task.items ?? []) {
      if (!isRoutedLaneKey(item.key)) {
        items.push(item);
        continue;
      }
      if (!team && !seesLaneTask(user, item.key, order, ctx, siblings))
        continue;
      items.push({ ...item, routed: true });
      const route = laneRoute(item.key, order, ctx, siblings);
      if (!missing && route?.missing && route.missing !== "ocp")
        missing = route.missing;
    }
    if (!items.length) continue;
    const detail = withoutPlaceholder(items.map((i) => i.label).join(", "));
    out.push({
      ...task,
      items,
      // O que falta designar e onde (ex.: o pedido sem certificadora).
      detail: missing
        ? `${detail} ${translator("pt")(MISSING_TASK_TEXT[missing])}`.trim()
        : detail,
    });
  }
  return out;
}

/**
 * Pedidos do login de fora da Wellmix (a mesma regra de `isInvolved`), sem os
 * do histórico do Sankhya em espera (pendências só depois do go-live).
 */
async function involvedOrderIds(user: User): Promise<string[]> {
  const { listColumns } = await import("@/lib/db/lookup");
  const store = getStore();
  if (user.role === "customer") {
    if (!user.partyId) return [];
    const rows = await listColumns(store, "orders", ["customerId"], {
      filter: {
        customerId: user.partyId,
        requestedByUserId: user.id,
        held: null,
      },
    });
    return rows.map((o) => o.id);
  }
  const field = ROLE_PARTY_FIELD[user.role];
  if (!field || !user.partyId) return [];
  const rows = await listColumns(store, "orders", [field], {
    // Pedido do histórico do Sankhya em espera: sem pendência até o go-live.
    filter: { [field]: user.partyId, held: null },
  });
  return rows.map((o) => o.id);
}

export interface PendingTasksOptions {
  /**
   * Painel de SLA: as pendências de certificação e artes de toda a equipe
   * Wellmix (cada uma com quem a recebeu como dono), não só as do usuário.
   */
  team?: boolean;
}

/** Pendências do usuário: o que ele precisa fazer agora. */
export async function pendingTasksFor(
  user: User,
  options: PendingTasksOptions = {},
): Promise<Task[]> {
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
  // Tarefas de arte e certificado dos pedidos de compra: papel coerente com
  // quem as recebe (as abertas antes de 14/11/2026).
  await (await import("./purchase-order")).normalizeLaneRoles();
  const customer = user.role === "customer" && !!user.partyId;
  const agency = user.role === "agency" && !!user.partyId;
  const none = Promise.resolve([] as never[]);

  // Todas as consultas independentes saem juntas (cada ida ao banco custa uma
  // viagem de rede); os detalhes vêm depois, em lote.
  // Parceiros e cliente: só as etapas dos pedidos deles (antes: as etapas de
  // todos os pedidos, filtradas depois). Wellmix com os resumos em uso: as
  // tarefas das etapas vêm prontas do resumo de cada pedido (docs/RESUMOS.md).
  const scope = wellmix ? null : await involvedOrderIds(user);
  const ready = wellmix
    ? await (await import("./order-summary")).summariesReady()
    : false;
  const [stages, newRequests, demands, reviews, openAfterSales] =
    await Promise.all([
      ready
        ? none
        : scope
          ? scope.length
            ? store.list("stages", {
                filter: { orderId: scope, status: ["active", "blocked"] },
              })
            : none
          : store.list("stages", { filter: { status: ["active", "blocked"] } }),
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

  // Wellmix com os resumos em uso: as pendências por pedido vêm prontas do
  // resumo de cada pedido (etapas, produção, embarque, certificação, artes e
  // "Pagar fornecedor"), sem ler os pedidos (docs/RESUMOS.md, "Pendências").
  const readyList = ready
    ? await (await import("./order-summary")).wellmixReadyTasks()
    : null;
  // Requisitos pendentes em etapas ativas/bloqueadas.
  const drafts = readyList
    ? readyList.stage
    : stageTaskDrafts(user, {
        stages,
        orderById,
        openRequirements,
        sealApplied,
        lanes,
      });
  // Arte, validação, certificado e arte final do pedido de compra: só com
  // quem recebe cada uma (o resumo do pedido traz a lista da equipe toda).
  tasks.push(
    ...(await routeLaneTasks(
      user,
      drafts.map((draft) => finish(draft, now)),
      !!options.team,
    )),
  );

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
  // Amostragem: o responsável envia; a Wellmix (com a ação) valida.
  if (supplier || (wellmix && can(user, "sampling.validate")))
    tasks.push(...(await samplingTasks(user, supplier, now)));
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
      filter: { supplierId: user.partyId!, held: null },
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
    const payTask = (
      order: Pick<Order, "id" | "number" | "customerId" | "ownerUserId">,
      supplierName: string | null,
      currency: string,
      i: { index: number; count: number; open: number; dueDate: string | null },
    ) =>
      finish(
        {
          kind: "supplier_payment",
          title: `Pagar fornecedor: pedido #${order.number}`,
          detail: `${supplierName ?? "—"} · parcela ${i.index}/${i.count} · ${currency} ${i.open.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          link: `/app/orders/${order.id}#supplier-payment`,
          dueAt: i.dueDate,
          orderNumber: order.number,
          customerId: order.customerId,
          ownerUserId: order.ownerUserId ?? null,
        },
        now,
      );
    if (readyList) {
      // Do resumo: a situação da parcela é a do dia (vence sem gravação).
      const { installmentStatusOn } = await import("./order-summary");
      const { brazilDay, INSTALLMENT_STATUS_ORDER } =
        await import("@/lib/supplier-terms");
      const today = brazilDay(now.toISOString()) as string;
      const rank = (s: string) => INSTALLMENT_STATUS_ORDER.indexOf(s as never);
      const rows = readyList.orders
        .flatMap(({ order, tasks: t }) =>
          (t.f?.parts ?? []).map((part) => ({
            order,
            f: t.f!,
            part: { ...part, status: installmentStatusOn(part, today) },
          })),
        )
        .filter(
          (r) => r.part.status === "overdue" || r.part.status === "due_soon",
        )
        .sort(
          (a, b) =>
            rank(a.part.status) - rank(b.part.status) ||
            (a.part.dueDate ?? "9999").localeCompare(
              b.part.dueDate ?? "9999",
            ) ||
            a.order.number - b.order.number ||
            a.part.index - b.part.index,
        );
      for (const r of rows)
        tasks.push(payTask(r.order, r.f.supplier, r.f.currency, r.part));
    } else {
      const { listPayables, payableRows } = await import("./supplier-terms");
      // Só os pedidos fora de espera: com os 16 mil do histórico do Sankhya,
      // ler todos custava ~2.300 consultas a cada abertura de Pendências.
      for (const { payable, installment: i } of payableRows(
        await listPayables({ live: true }),
      )) {
        if (i.status !== "overdue" && i.status !== "due_soon") continue;
        if (!(i.open > 0)) continue;
        // Pedido do histórico do Sankhya em espera: fica em Contas a pagar,
        // mas não vira pendência até o go-live.
        if (payable.order.held) continue;
        tasks.push(
          payTask(
            payable.order,
            payable.supplier?.name ?? null,
            payable.schedule.currency,
            i,
          ),
        );
      }
    }
  }
  // Produção (Fase C): follow 5/15/25 e reinspeção (Wellmix); SKU reprovado
  // a corrigir (fornecedor).
  if (wellmix || supplier) {
    const { productionTasks, dueProductionCandidates } =
      await import("./production");
    const drafts = readyList
      ? // Do resumo: o follow só depois da data dele.
        readyList.orders.flatMap(({ order, tasks: t }) =>
          dueProductionCandidates(t.p ?? [], now).map((c) => ({
            ...c,
            order,
          })),
        )
      : await productionTasks(
          user,
          // Pedido do histórico do Sankhya em espera (held): sem pendência.
          await store.list("orders", {
            filter: supplier
              ? { supplierId: user.partyId!, held: null }
              : {
                  held: null,
                  status: [
                    "ORDER_CREATED",
                    "PREPARATION",
                    "SUPPLIER_PAYMENT",
                    "PACKAGING",
                    "INSPECTION",
                    "SHIPPING",
                  ],
                },
          }),
        );
    for (const p of drafts)
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
    user.role === "agency" ||
    // Despachante: a certificação é dele (dono, 13/11/2026).
    user.role === "broker" ||
    // Agência de marketing na China: amostras (docs/SAMPLE_FLOW.md).
    user.role === "marketing_agency"
      ? user.role
      : null;
  if (wellmix || supplier || (importRole && user.partyId)) {
    const { importTasks, isOcpOnlyStep, readyImportTasks } =
      await import("./import-flow");
    const { isSchemaMissing } = await import("@/lib/db/errors");
    let orders: Order[] = [];
    if (!readyList)
      try {
        orders = await store.list("orders", {
          filter: importRole
            ? {
                held: null,
                [importRole === "comex"
                  ? "comexId"
                  : importRole === "ocp"
                    ? "ocpId"
                    : importRole === "agency"
                      ? "agencyId"
                      : importRole === "broker"
                        ? "brokerId"
                        : importRole === "marketing_agency"
                          ? "marketingAgencyId"
                          : "logisticsId"]: user.partyId!,
              }
            : supplier
              ? { supplierId: user.partyId!, held: null }
              : {
                  held: null,
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
    // Certificação (docs/CERTIFICATION.md, "Quem recebe cada tarefa"): cada
    // passo já vem só para o login que o recebe, com o link direto.
    const drafts = readyList
      ? // Do resumo: só o encaminhamento do momento decide de quem é.
        await readyImportTasks(
          user,
          readyList.orders
            .filter(({ tasks: t }) => t.i?.length)
            .map(({ order, tasks: t }) => ({ order, candidates: t.i! })),
          { team: options.team },
        )
      : await importTasks(user, orders, { team: options.team });
    // Pedidos que já ganharam a pendência de vincular a certificadora.
    const assigningOcp = new Set<string>();
    for (const p of drafts) {
      const step = IMPORT_STEP_LABEL[p.key] ?? p.key;
      const cert = p.kind === "cert_step" || p.kind === "cert_validate";
      const validate =
        p.kind === "import_validate" || p.kind === "cert_validate";
      // Memorial ou selo sem certificadora (OCP) no pedido: a pendência é de
      // quem vincula a certificadora em Parceiros do pedido (o analista ou a
      // equipe), uma só por pedido; só ela envia os dois (dono, 14/11/2026).
      const assignOcp =
        p.kind === "cert_step" &&
        isOcpOnlyStep(p.key) &&
        p.missing === "certifier";
      if (assignOcp) {
        if (assigningOcp.has(p.order.id)) continue;
        assigningOcp.add(p.order.id);
      }
      // Selo e memorial: texto próprio, traduzido na tela.
      const seal =
        SEAL_TASK_TEXT[assignOcp ? "assign_ocp" : `${p.kind}:${p.key}`];
      // Sem designer (arte feita pela Wellmix) ou sem analista: a pendência
      // diz o que falta designar e onde (a certificadora tem texto próprio).
      const missing =
        cert && p.missing && p.missing !== "ocp" && !assignOcp
          ? MISSING_TASK_TEXT[p.missing]
          : null;
      const values = { n: p.order.number };
      const detail = seal ? ptText(seal.detail, values) : "";
      tasks.push(
        finish(
          {
            kind: p.kind,
            title: seal
              ? ptText(seal.title, values)
              : validate
                ? `Validar ${step}: pedido #${p.order.number}`
                : `${step}: pedido #${p.order.number}`,
            detail: missing
              ? `${detail} ${ptText(missing, values)}`.trim()
              : detail,
            ...(seal
              ? {
                  text: {
                    ...seal,
                    ...(missing ? { detailExtra: missing } : {}),
                    values,
                  },
                }
              : {}),
            link: p.link ?? `/app/orders/${p.order.id}#import-flow`,
            stepKey: assignOcp ? "assign" : p.key,
            dueAt: null,
            requestId: p.order.requestId,
            sinceAt: p.sinceAt ?? null,
            ...(supplier && !cert ? { supplierStep: "shipping" as const } : {}),
            orderNumber: p.order.number,
            customerId: p.order.customerId,
            ownerUserId:
              p.ownerUserId !== undefined
                ? p.ownerUserId
                : (p.order.ownerUserId ?? null),
          },
          now,
        ),
      );
    }
  }
  // Fotos e vídeos reais (docs/SAMPLE_FLOW.md): a agência na China
  // fotografa a amostra de cada produto; o marketing aprova e ativa a venda.
  if (wellmix || user.role === "marketing_agency") {
    try {
      const { realMediaTasks } = await import("./sample-flow");
      const ptText = translator("pt");
      for (const p of await realMediaTasks(user)) {
        const values = { n: p.order.number, count: p.count };
        const title = `realMedia.task.${p.kind}.title` as DictionaryKey;
        const detail = `realMedia.task.${p.kind}.detail` as DictionaryKey;
        tasks.push(
          finish(
            {
              kind: "real_media",
              title: ptText(title, values),
              detail: ptText(detail, values),
              text: { title, detail, values },
              link: `/app/orders/${p.order.id}/real-media`,
              dueAt: null,
              requestId: p.order.requestId,
              orderNumber: p.order.number,
              customerId: p.order.customerId,
              ownerUserId: p.order.ownerUserId ?? null,
            },
            now,
          ),
        );
      }
    } catch (error) {
      const { isSchemaMissing } = await import("@/lib/db/errors");
      // Tabela nova ainda não publicada: sem estas pendências.
      if (!isSchemaMissing(error)) throw error;
    }
  }
  // Show room do Brasil (docs/SAMPLE_FLOW.md): amostras enviadas pela
  // trading ainda não conferidas no recebimento.
  if (wellmix) {
    try {
      const { showroomTasks } = await import("./sample-flow");
      const ptText = translator("pt");
      for (const order of await showroomTasks(user)) {
        const values = { n: order.number };
        tasks.push(
          finish(
            {
              kind: "real_media",
              group: "showroom",
              title: ptText("showroom.task.title", values),
              detail: ptText("showroom.task.detail", values),
              text: {
                title: "showroom.task.title",
                detail: "showroom.task.detail",
                values,
              },
              link: `/app/orders/${order.id}#samples`,
              dueAt: null,
              requestId: order.requestId,
              orderNumber: order.number,
              customerId: order.customerId,
              ownerUserId: order.ownerUserId ?? null,
            },
            now,
          ),
        );
      }
    } catch (error) {
      const { isSchemaMissing } = await import("@/lib/db/errors");
      if (!isSchemaMissing(error)) throw error;
    }
  }
  // Qualidade no CD (mapa E19; docs/DELIVERY.md): descarga registrada e a
  // conferência da qualidade por concluir.
  if (wellmix) {
    try {
      const { qualityTasks } = await import("./receiving");
      const ptText = translator("pt");
      for (const order of await qualityTasks(user)) {
        const values = { n: order.number };
        tasks.push(
          finish(
            {
              kind: "real_media",
              group: "quality",
              title: ptText("quality.task.title", values),
              detail: ptText("quality.task.detail", values),
              text: {
                title: "quality.task.title",
                detail: "quality.task.detail",
                values,
              },
              link: `/app/orders/${order.id}#receiving`,
              dueAt: null,
              requestId: order.requestId,
              orderNumber: order.number,
              customerId: order.customerId,
              ownerUserId: order.ownerUserId ?? null,
            },
            now,
          ),
        );
      }
    } catch (error) {
      const { isSchemaMissing } = await import("@/lib/db/errors");
      if (!isSchemaMissing(error)) throw error;
    }
  }
  // Fatura ativa em N dias (mapa R24): com os documentos do embarque
  // conferidos, o financeiro registra o faturamento até o vencimento.
  if (wellmix) {
    const { invoiceTasks } = await import("./supplier-invoice");
    const ptText = translator("pt");
    for (const p of await invoiceTasks(user)) {
      const values = { n: p.order.number, days: p.due.days };
      tasks.push(
        finish(
          {
            kind: "invoice_due",
            title: ptText("supplierInvoice.task.title", values),
            detail: ptText("supplierInvoice.task.detail", values),
            text: {
              title: "supplierInvoice.task.title",
              detail: "supplierInvoice.task.detail",
              values,
            },
            link: `/app/orders/${p.order.id}`,
            dueAt: p.due.dueAt,
            sinceAt: p.due.activeAt,
            requestId: p.order.requestId,
            orderNumber: p.order.number,
            customerId: p.order.customerId,
            ownerUserId: p.order.ownerUserId ?? null,
          },
          now,
        ),
      );
    }
  }
  // Documentos do embarque do pedido de compra (docs/SHIPPING_DOCS.md):
  // check list e packing list do fornecedor, invoice da trading e BL da
  // marítima (sem marítima designada, da Wellmix).
  if (wellmix || user.role === "supplier" || user.role === "shipping_line") {
    try {
      const { shippingDocTasks } = await import("./shipping-docs");
      const ptText = translator("pt");
      for (const p of await shippingDocTasks(user)) {
        const values = { n: p.order.number };
        const title = `shippingDocs.task.${p.kind}.title` as DictionaryKey;
        const detail = (
          p.redo
            ? "shippingDocs.task.redo.detail"
            : `shippingDocs.task.${p.kind}.detail`
        ) as DictionaryKey;
        tasks.push(
          finish(
            {
              kind: "import_step",
              title: ptText(title, values),
              detail: ptText(detail, values),
              text: { title, detail, values },
              link: `/app/orders/${p.order.id}/shipping-docs#${p.kind}`,
              stepKey: `shipping_${p.kind}`,
              dueAt: null,
              requestId: p.order.requestId,
              ...(user.role === "supplier"
                ? { supplierStep: "shipping" as const }
                : {}),
              orderNumber: p.order.number,
              customerId: p.order.customerId,
              ownerUserId: p.order.ownerUserId ?? null,
            },
            now,
          ),
        );
      }
    } catch (error) {
      const { isSchemaMissing } = await import("@/lib/db/errors");
      // Tabela nova ainda não publicada: sem estas pendências.
      if (!isSchemaMissing(error)) throw error;
    }
  }
  // Artes (cartão Artes do pedido): corrigir a não conformidade (quem faz a
  // arte) e conferir a correção (quem apontou ou quem valida a arte).
  if (wellmix || agency) {
    const { artIssueTasks, readyArtTasks } = await import("./artwork");
    const ptText = translator("pt");
    const drafts = readyList
      ? // Do resumo: as não conformidades guardadas, na ordem de criação.
        await readyArtTasks(
          user,
          readyList.orders.flatMap(({ order, tasks: t }) =>
            (t.a ?? []).map((a) => ({ ...a, order })),
          ),
          { team: options.team },
        )
      : await artIssueTasks(user, { team: options.team });
    for (const a of drafts) {
      const text = ART_TASK_TEXT[a.kind];
      const missing =
        a.missing && a.missing !== "ocp" ? MISSING_TASK_TEXT[a.missing] : null;
      const values = { n: a.order.number, item: a.itemName };
      tasks.push(
        finish(
          {
            kind: a.kind,
            title: ptText(text.title, values),
            detail: [
              ptText(text.detail, values),
              missing ? ptText(missing, values) : "",
            ]
              .filter(Boolean)
              .join(" "),
            text: {
              ...text,
              ...(missing ? { detailExtra: missing } : {}),
              values,
            },
            link: a.link,
            dueAt: null,
            requestId: a.order.requestId,
            sinceAt: a.sinceAt,
            orderNumber: a.order.number,
            customerId: a.order.customerId,
            ownerUserId: a.ownerUserId,
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
                product: realName(request.productName) ?? "—",
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
            detail: `Itens de book sem NCM: ${group.items.length}`,
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
  container_at_factory: "Container vazio na fábrica",
  container_empty: "Fotos e vídeos do container vazio",
  container_loaded: "Carregamento do container",
  container_sealed: "Lacre e número do container",
  container_at_port: "Container lacrado no porto",
  container_tracking: "Rastreio do container",
  samples_picked: "Retirada das amostras",
  samples_brazil: "Envio das amostras ao Brasil",
  samples_china: "Envio das amostras à agência na China",
  samples_china_received: "Amostras recebidas pela agência",
  samples_returned: "Devolução da amostra à trading",
  samples_brazil_received: "Amostras recebidas no show room",
  origin_carrier: "Transportadora na origem (EXW)",
  origin_carrier_eta: "Previsão do container na fábrica (EXW)",
  origin_costs: "Custos de origem (POP)",
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
  "cert_step:cert_memorial": {
    title: "tasks.memorial.send.title",
    detail: "tasks.memorial.send.detail",
  },
  "cert_validate:cert_memorial": {
    title: "tasks.memorial.validate.title",
    detail: "tasks.memorial.validate.detail",
  },
};

/** Pendências do cartão Artes: título e detalhe traduzidos. */
const ART_TASK_TEXT: Record<
  "art_fix" | "art_review",
  { title: DictionaryKey; detail: DictionaryKey }
> = {
  art_fix: { title: "tasks.art.fix.title", detail: "tasks.art.fix.detail" },
  art_review: {
    title: "tasks.art.review.title",
    detail: "tasks.art.review.detail",
  },
};

/** Pendência sem dono certo: o que falta designar e onde (traduzido na tela). */
const MISSING_TASK_TEXT: Record<
  "designer" | "analyst" | "certifier",
  DictionaryKey
> = {
  designer: "tasks.missing.designer",
  analyst: "tasks.missing.analyst",
  certifier: "tasks.missing.certifier",
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
          title: `Enviar book concorrente: ${item}`,
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

/**
 * Amostragem das solicitações aprovadas (docs/SUPPLIER_SAMPLING.md): ao
 * fornecedor, enviar (pendente ou reprovada); à Wellmix, validar a enviada.
 */
async function samplingTasks(
  user: User,
  supplier: boolean,
  now: Date,
): Promise<Task[]> {
  let rows;
  try {
    rows = await getStore().list("supplier_requests", {
      filter: supplier
        ? { supplierId: user.partyId!, status: "approved" }
        : { status: "approved" },
    });
  } catch (error) {
    const { isSchemaMissing } = await import("@/lib/db/errors");
    if (isSchemaMissing(error)) return [];
    throw error;
  }
  const { samplingDueAt, samplingOf, samplingTurn } =
    await import("@/lib/supplier-request-sampling");
  const { samplingSlaDays } = await import("./supplier-request-sampling");
  const days = await samplingSlaDays();
  const out: Task[] = [];
  for (const r of rows.sort((a, b) => a.number - b.number)) {
    const s = samplingOf(r);
    if (samplingTurn(s) !== (supplier ? "supplier" : "wellmix") || !s) continue;
    const product =
      r.item.description ?? r.item.productName ?? r.item.factoryItemCode ?? "—";
    const link = `/app/supplier-requests/${r.id}?view=item#amostragem`;
    out.push(
      supplier
        ? finish(
            {
              kind: "sampling",
              title: `Amostragem da solicitação nº ${r.number}: ${product}`,
              detail:
                s.status === "rejected"
                  ? "A Wellmix reprovou a amostra: envie de novo"
                  : "Envie fotos e vídeos de uma amostra do item",
              text: {
                title: "supplierTasks.sampling.title",
                detail:
                  s.status === "rejected"
                    ? "supplierTasks.sampling.rejected"
                    : "supplierTasks.sampling.detail",
                values: { n: r.number, product },
              },
              link,
              dueAt: samplingDueAt(s, days),
              sinceAt: s.reviewedAt ?? s.openedAt,
              loadedAt: r.createdAt,
              supplierStep: "sampling",
            },
            now,
          )
        : finish(
            {
              kind: "sampling_validate",
              title: `Validar a amostragem: solicitação nº ${r.number}`,
              detail: product,
              link,
              dueAt: null,
              sinceAt: s.submittedAt ?? null,
            },
            now,
          ),
    );
  }
  return out;
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

/** Pedidos do histórico mostrados por página na tela Pendências. */
export const HELD_TASKS_PAGE = 50;

/**
 * Pendências dos pedidos do histórico do Sankhya em espera até o go-live
 * (dono, 14/11/2026; docs/SANKHYA.md): só as da atividade em aberto (os
 * itens das etapas em andamento ou bloqueadas), com a mesma regra de quem
 * faz cada uma (`stageTaskDrafts` e o encaminhamento das raias). Ficam fora
 * das pendências gerais, das bolinhas do menu, do SLA e dos avisos: a tela
 * Pendências lê esta lista à parte, por página de pedidos (os 16 mil do
 * histórico de uma vez repetiriam a lentidão de 13/11/2026). Só a Wellmix.
 */
export async function heldTasksFor(
  user: User,
  page = 1,
  now = new Date(),
): Promise<{ tasks: Task[]; orders: number; page: number; pages: number }> {
  const empty = { tasks: [], orders: 0, page: 1, pages: 1 };
  if (!isWellmix(user)) return empty;
  const store = getStore();
  const { listColumns } = await import("@/lib/db/lookup");
  const held = (
    await listColumns(store, "orders", ["number", "status", "held"], {
      filter: { held: true },
    })
  )
    .filter((o) => o.held && o.status !== "CLOSED" && o.status !== "CANCELLED")
    .sort((a, b) => b.number - a.number);
  if (!held.length) return empty;
  const pages = Math.max(1, Math.ceil(held.length / HELD_TASKS_PAGE));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pages);
  const ids = held
    .slice((current - 1) * HELD_TASKS_PAGE, current * HELD_TASKS_PAGE)
    .map((o) => o.id);
  // Leituras pelo pedido (orderId): veem as linhas em espera.
  const [orders, stages, openRequirements, seals] = await Promise.all([
    store.list("orders", { filter: { id: ids } }),
    store.list("stages", {
      filter: { orderId: ids, status: ["active", "blocked"] },
    }),
    store.list("requirements", {
      filter: { orderId: ids, status: ["pending", "rejected"] },
    }),
    store
      .list("import_steps", { filter: { orderId: ids, key: "cert_seal_art" } })
      .catch(() => []),
  ]);
  const purchase = orders.filter((o) => isPurchaseFlow(o)).map((o) => o.id);
  const lanes = purchase.length
    ? {
        ...(await import("@/lib/purchase-lanes")),
        sla: await (await import("./purchase-order")).purchaseLaneSla(),
        all: await store.list("requirements", {
          filter: { orderId: purchase },
        }),
      }
    : null;
  const drafts = stageTaskDrafts(user, {
    stages,
    orderById: new Map(orders.map((o) => [o.id, o])),
    openRequirements,
    sealApplied: new Set(
      seals
        .filter((s) => s.status === "submitted" || s.status === "validated")
        .map((s) => s.orderId),
    ),
    lanes,
  });
  const tasks = await routeLaneTasks(
    user,
    drafts.map((d) => finish(d, now)),
    false,
  );
  const { tasksForFunctions } = await import("@/lib/task-owner");
  return {
    tasks: tasksForFunctions(user, tasks).sort(
      (a, b) => (b.orderNumber ?? 0) - (a.orderNumber ?? 0),
    ),
    orders: held.length,
    page: current,
    pages,
  };
}
