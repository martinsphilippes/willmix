import { cache } from "react";
import type { User } from "@/lib/db/schema";
import { getStore } from "@/lib/db";
import { isWellmix } from "@/lib/auth/permissions";
import { canOpen } from "@/lib/auth/screens";
import { pendingTasksFor, type Task } from "./tasks";
import { tasksForFunctions } from "@/lib/task-owner";
import {
  BOOK_PERCENT,
  blockOf,
  bookStep,
  isProgressBlock,
  lateDaysSince,
  orderProgress,
  overallOf,
  requestInNegotiation,
  requestPercent,
  type OrderProgress,
} from "@/lib/flow-progress";
import { getSettings } from "@/lib/settings";
import { SAMPLE_ORDER_KEY } from "@/lib/purchase-lanes";
import { RECEIVING_STATUSES } from "./receiving";
import { orderFlowEntries, type OrderFlowInput } from "./flow-contribution";
import {
  supplierRequestLate,
  supplierRequestSlaDue,
} from "@/lib/supplier-requests";
import {
  countByStep,
  flowStepsOf,
  stepId,
  stepsOf,
  type FlowBlock,
  type FlowCount,
  type FlowStep,
} from "@/lib/flow";

/*
 * Pendências do login por passo do menu (docs/FLOW_MENU.md): as mesmas da
 * tela Pendências (com o filtro das funções do operador), lidas uma vez por
 * página (cache do React: o menu, o Overview e a tela do passo dividem a
 * mesma leitura). Mais os casos do menu que não são pendências (o
 * recebimento no CD: Armazenagem e Retorno). Só leitura; nada novo no banco.
 */
export const flowTasksFor = cache(async (user: User): Promise<Task[]> =>
  tasksForFunctions(user, await pendingTasksFor(user)),
);

/** Caso do menu: uma pendência ou um recebimento aberto. */
export type FlowCase = Omit<Task, "kind"> & {
  kind:
    | Task["kind"]
    | "receiving_storage"
    | "receiving_return"
    | "preproduction_plan";
};

/** Peças da descarga (Armazenagem); o resto (RIC, devolução, fechamento) é Retorno. */
const STORAGE_PARTS = ["seal", "photos", "checklist", "counts"] as const;

/**
 * Recebimento no CD (Wellmix, quem abre Containers): o pedido já entregue
 * (ou com a descarga começada) e o recebimento aberto. Falta descarga ou
 * contagem: Armazenagem; senão, RIC, devolução do container e fechamento:
 * Retorno.
 */
export const flowReceivingCasesFor = cache(
  async (user: User): Promise<FlowCase[]> => {
    if (!isWellmix(user) || !canOpen(user, "containers")) return [];
    const store = getStore();
    const svc = await import("./receiving");
    const orders = (
      await store.list("orders", {
        filter: { status: [...svc.RECEIVING_STATUSES] },
      })
    ).filter((o) => !o.held);
    if (!orders.length) return [];
    const ids = orders.map((o) => o.id);
    const [rows, items] = await Promise.all([
      store.list("receivings", { filter: { orderId: ids } }).catch(() => []),
      store.list("order_items", { filter: { orderId: ids } }),
    ]);
    const out: FlowCase[] = [];
    for (const order of orders) {
      const row = rows.find((r) => r.orderId === order.id) ?? null;
      if (row?.closedAt) continue;
      if (!row && order.status !== "DELIVERED") continue;
      const missing = svc.missingForClose(
        row,
        items.filter((i) => i.orderId === order.id),
      );
      const storage = missing.some((m) =>
        (STORAGE_PARTS as readonly string[]).includes(m),
      );
      out.push({
        kind: storage ? "receiving_storage" : "receiving_return",
        title: `Pedido #${order.number}`,
        detail: missing.join(", "),
        text: {
          title: "flow.receiving.title",
          detail: storage ? "flow.receiving.storage" : "flow.receiving.return",
          values: { n: order.number },
        },
        link: `/app/orders/${order.id}#receiving`,
        dueAt: null,
        overdue: false,
        orderNumber: order.number,
        orderId: order.id,
        customerId: order.customerId,
        ownerUserId: order.ownerUserId ?? null,
        sinceAt: row?.createdAt ?? null,
        group: storage ? "receiving_storage" : "receiving_return",
        due: "none",
        daysLeft: null,
      });
    }
    return out;
  },
);

/** Pedidos em andamento (os encerrados e cancelados não entram). */
const LIVE = (status: string) => status !== "CLOSED" && status !== "CANCELLED";

/**
 * Pré-produção (mapa, P12 → R1): pedido de compra com o sinal pago (ou a
 * conta corrente) e a produção sem ETD. Resolve-se com os dados da produção
 * e o ETD (cartão de produção, parte "dados e ETD"). Wellmix com a tela
 * Produção.
 */
export const flowPreProductionCasesFor = cache(
  async (user: User): Promise<FlowCase[]> => {
    if (!isWellmix(user) || !canOpen(user, "production")) return [];
    const store = getStore();
    const paid = await store.list("requirements", {
      filter: { key: "down_payment", status: "done" },
    });
    const ids = [...new Set(paid.map((r) => r.orderId))];
    if (!ids.length) return [];
    const [orders, tracks] = await Promise.all([
      store.list("orders", { filter: { id: ids } }),
      store
        .list("production_tracks", { filter: { orderId: ids } })
        .catch(() => []),
    ]);
    const out: FlowCase[] = [];
    for (const order of orders) {
      if (!LIVE(order.status) || order.held) continue;
      const track = tracks.find((x) => x.orderId === order.id) ?? null;
      if (track?.etd) continue;
      const since = paid.find((r) => r.orderId === order.id);
      out.push({
        kind: "preproduction_plan",
        title: `Pedido #${order.number}`,
        detail: "",
        text: {
          title: "flow.preproduction.title",
          detail: "flow.preproduction.detail",
          values: { n: order.number },
        },
        link: `/app/orders/${order.id}#production`,
        dueAt: null,
        overdue: false,
        orderNumber: order.number,
        orderId: order.id,
        customerId: order.customerId,
        ownerUserId: order.ownerUserId ?? null,
        sinceAt: since?.submittedAt ?? since?.updatedAt ?? null,
        group: "preproduction_plan",
        due: "none",
        daysLeft: null,
      });
    }
    return out;
  },
);

/** Todos os casos do menu do login: as pendências e os recebimentos abertos. */
export const flowCasesFor = cache(async (user: User): Promise<FlowCase[]> => [
  ...(await flowTasksFor(user)),
  ...(await flowReceivingCasesFor(user).catch((error: unknown) => {
    console.error("flowReceivingCasesFor failed", error);
    return [];
  })),
  ...(await flowPreProductionCasesFor(user).catch((error: unknown) => {
    console.error("flowPreProductionCasesFor failed", error);
    return [];
  })),
]);

/** Contadores do menu: `bloco/passo` → quantas esperam e quantas atrasaram. */
export async function flowCountsFor(
  user: User,
): Promise<Map<string, FlowCount>> {
  return countByStep(await flowCasesFor(user));
}

/** Os casos de um passo, das atrasadas às sem prazo (a ordem das Pendências). */
export async function flowCasesOf(
  user: User,
  step: FlowStep,
): Promise<FlowCase[]> {
  const id = stepId(step);
  return (await flowCasesFor(user)).filter((t) =>
    flowStepsOf(t).some((x) => stepId(x) === id),
  );
}

export interface FlowStepSummary {
  step: FlowStep;
  count: number;
  overdue: number;
  /** Dias, em média, desde que as pendências chegaram ao passo (nulo: não se sabe). */
  avgDays: number | null;
  /** A mais antiga, em dias. */
  maxDays: number | null;
  tasks: FlowCase[];
}

const DAY = 86_400_000;

/** Linha do tempo do bloco: cada passo com o que espera, o que atrasou e há quantos dias. */
export async function flowBlockSummary(
  user: User,
  block: FlowBlock,
  now = new Date(),
): Promise<FlowStepSummary[]> {
  const tasks = await flowCasesFor(user);
  return stepsOf(block)
    .filter((step) => !step.badgeOnly)
    .map((step) => {
      const id = stepId(step);
      const mine = tasks.filter((t) =>
        flowStepsOf(t).some((x) => stepId(x) === id),
      );
      const ages = mine
        .map((t) => (t.sinceAt ? Date.parse(t.sinceAt) : NaN))
        .filter((ms) => Number.isFinite(ms))
        .map((ms) => Math.max(0, Math.floor((now.getTime() - ms) / DAY)));
      return {
        step,
        count: mine.length,
        overdue: mine.filter((t) => t.overdue).length,
        avgDays: ages.length
          ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length)
          : null,
        maxDays: ages.length ? Math.max(...ages) : null,
        tasks: mine,
      };
    });
}

/** Item aberto de um pedido num passo (aba "Todos" da tela do passo). */
export type { FlowEntityItem } from "./flow-contribution";
type FlowEntityItem = import("./flow-contribution").FlowEntityItem;

/** Pedido que está num passo agora, com o que está aberto nele. */
export interface FlowEntity {
  order: import("@/lib/db/schema").Order;
  items: FlowEntityItem[];
  /** Desde quando o pedido está no passo (o item aberto mais antigo). */
  since: string | null;
}

/**
 * Tudo o que está em cada passo agora, de qualquer responsável (aba "Todos",
 * docs/FLOW_MENU.md): os itens de etapa abertos das etapas em andamento, os
 * passos do embarque, da origem, da certificação e das amostras prontos e não
 * concluídos, os recebimentos abertos, a pré-produção e a produção em
 * andamento (com ETD, na etapa de inspeção). Pedidos em andamento, sem os do
 * histórico em espera. Só a Wellmix; leitura sob demanda (a tela do passo e
 * o Overview), não entra no menu.
 */
export const flowAllFor = cache(
  async (user: User): Promise<Map<string, FlowEntity[]>> =>
    (await flowAllData(user)).entities,
);

/**
 * Completude e atraso por bloco de cada pedido em andamento (dono,
 * 14/11/2026): a mesma leitura das etapas do "Todos no passo", sem consulta
 * nova. Só a Wellmix.
 */
export const flowProgressFor = cache(
  async (user: User): Promise<Map<string, OrderProgress>> =>
    (await flowAllData(user)).progress,
);

const flowAllData = cache(
  async (
    user: User,
  ): Promise<{
    entities: Map<string, FlowEntity[]>;
    progress: Map<string, OrderProgress>;
  }> => {
    const out = new Map<string, Map<string, FlowEntity>>();
    const empty = { entities: new Map(), progress: new Map() };
    if (!isWellmix(user)) return empty;
    const store = getStore();
    const orders = (await store.list("orders")).filter(
      (o) => !o.held && o.status !== "CLOSED" && o.status !== "CANCELLED",
    );
    if (!orders.length) return empty;
    const orderById = new Map(orders.map((o) => [o.id, o]));
    const ids = orders.map((o) => o.id);
    const add = (
      stepKey: string,
      orderId: string,
      item: FlowEntityItem,
      since: string | null,
    ) => {
      const order = orderById.get(orderId);
      if (!order) return;
      const byOrder = out.get(stepKey) ?? new Map<string, FlowEntity>();
      const entity = byOrder.get(orderId) ?? { order, items: [], since: null };
      entity.items.push(item);
      if (since && (!entity.since || since < entity.since))
        entity.since = since;
      byOrder.set(orderId, entity);
      out.set(stepKey, byOrder);
    };
    const [
      stages,
      importSteps,
      tracks,
      openRequirements,
      receivings,
      downPayments,
      sampleOrders,
    ] = await Promise.all([
      store.list("stages", { filter: { orderId: ids } }),
      store.list("import_steps", { filter: { orderId: ids } }).catch(() => []),
      store
        .list("production_tracks", { filter: { orderId: ids } })
        .catch(() => []),
      store.list("requirements", {
        filter: { orderId: ids, status: ["pending", "rejected"] },
      }),
      store.list("receivings", { filter: { orderId: ids } }).catch(() => []),
      store.list("requirements", {
        filter: { orderId: ids, key: "down_payment", status: "done" },
      }),
      store.list("requirements", {
        filter: { orderId: ids, key: SAMPLE_ORDER_KEY },
      }),
    ]);
    // Itens do pedido só de quem está no recebimento (a contagem por SKU).
    const receivingIds = orders
      .filter((o) =>
        (RECEIVING_STATUSES as readonly string[]).includes(o.status),
      )
      .map((o) => o.id);
    const items = receivingIds.length
      ? await store.list("order_items", { filter: { orderId: receivingIds } })
      : [];
    const group = <T extends { orderId: string }>(rows: T[]) => {
      const m = new Map<string, T[]>();
      for (const r of rows) m.set(r.orderId, [...(m.get(r.orderId) ?? []), r]);
      return m;
    };
    const byStages = group(stages);
    const byReqs = group(openRequirements);
    const bySteps = group(importSteps);
    const byItems = group(items);
    const now = new Date();
    const progress = new Map<string, OrderProgress>();
    for (const order of orders) {
      const input: OrderFlowInput = {
        order,
        stages: byStages.get(order.id) ?? [],
        openRequirements: byReqs.get(order.id) ?? [],
        importSteps: bySteps.get(order.id) ?? [],
        track: tracks.find((x) => x.orderId === order.id) ?? null,
        receiving: receivings.find((x) => x.orderId === order.id) ?? null,
        items: byItems.get(order.id) ?? [],
        downPayment: downPayments.find((x) => x.orderId === order.id) ?? null,
        sampleOrder: sampleOrders.find((x) => x.orderId === order.id) ?? null,
      };
      progress.set(order.id, orderProgress(input.stages, now));
      for (const e of orderFlowEntries(input))
        add(e.step, order.id, e.item, e.since);
    }
    const entities = new Map(
      [...out.entries()].map(([k, byOrder]) => [
        k,
        [...byOrder.values()].sort((a, b) => a.order.number - b.order.number),
      ]),
    );
    return { entities, progress };
  },
);

/** Pedido que está no bloco: os passos em que está, desde quando e a completude. */
export interface FlowBlockEntity {
  order: import("@/lib/db/schema").Order;
  /** Chaves dos passos do bloco em que o pedido está agora. */
  steps: string[];
  items: FlowEntityItem[];
  since: string | null;
  progress: OrderProgress | null;
}

/**
 * Os pedidos de um bloco agora (Overview, dono 14/11/2026): todo pedido com
 * algo aberto em algum passo do bloco (a mesma regra do "Todos no passo"),
 * com os passos, desde quando e a completude do pedido. Só a Wellmix.
 */
export async function flowBlockEntities(
  user: User,
  block: FlowBlock,
): Promise<FlowBlockEntity[]> {
  const { entities, progress } = await flowAllData(user);
  const byOrder = new Map<string, FlowBlockEntity>();
  for (const step of stepsOf(block)) {
    if (step.badgeOnly) continue;
    for (const e of entities.get(stepId(step)) ?? []) {
      const row = byOrder.get(e.order.id) ?? {
        order: e.order,
        steps: [],
        items: [],
        since: null,
        progress: progress.get(e.order.id) ?? null,
      };
      if (!row.steps.includes(step.key)) row.steps.push(step.key);
      row.items.push(...e.items);
      if (e.since && (!row.since || e.since < row.since)) row.since = e.since;
      byOrder.set(e.order.id, row);
    }
  }
  return [...byOrder.values()].sort((a, b) => a.order.number - b.order.number);
}

/**
 * Linha da tabela do Overview (dono, 14/11/2026): um pedido (Pedido,
 * Produção, Entrega) ou, no Produto novo, um book ou uma solicitação ao
 * fornecedor, com os passos do bloco em que está, a situação, desde quando, o
 * atraso e a completude.
 */
export interface OverviewEntity {
  kind: "order" | "book" | "request";
  id: string;
  number: number;
  /** Tela da entidade, aberta na linha do tempo dela. */
  href: string;
  partyId: string | null;
  steps: string[];
  /** Situação: chave do dicionário. */
  statusKey: string;
  since: string | null;
  lateDays: number;
  /** Completude no bloco. */
  percent: number;
  /** Completude geral da entidade. */
  overall: number;
}

/** As entidades de um bloco no Overview (só a Wellmix). */
export async function flowOverviewEntities(
  user: User,
  block: FlowBlock,
): Promise<OverviewEntity[]> {
  if (!isWellmix(user)) return [];
  if (block === "new-product") return newProductEntities(user);
  if (!isProgressBlock(block)) return [];
  // Com os resumos em uso: da contribuição de cada pedido (docs/RESUMOS.md).
  const { summariesReady } = await import("./order-summary");
  if (await summariesReady()) {
    const { flushSummaryChanges } = await import("@/lib/db/summary-dirty");
    await flushSummaryChanges();
    const { readOrderFlows, entitiesFromFlows } = await import("./flow-kpis");
    const flows = await readOrderFlows();
    if (flows) return entitiesFromFlows(flows, block, new Date());
  }
  return (await flowBlockEntities(user, block)).map((e) => {
    const mine = e.progress ? blockOf(e.progress, block) : null;
    return {
      kind: "order",
      id: e.order.id,
      number: e.order.number,
      href: `/app/orders/${e.order.id}?from=${block}#order-progress`,
      partyId: e.order.supplierId || null,
      steps: e.steps,
      statusKey: `stage.${e.order.status}`,
      since: mine?.startedAt ?? e.since,
      lateDays: mine?.lateDays ?? 0,
      percent: mine?.percent ?? 0,
      overall: e.progress?.overall ?? 0,
    };
  });
}

/**
 * Produto novo: os books em preenchimento, rascunho, fechados ou em
 * andamento (Books ou Seleção de itens; Cotações quando há convite de book
 * concorrente aberto) e as solicitações ao fornecedor em negociação ou
 * aprovadas com a amostra ainda não aprovada e sem pedido (Negociações). A
 * solicitação com vários produtos (mesmo `batchId`) é uma linha só.
 */
export const newProductEntities = cache(
  async (user: User, now = new Date()): Promise<OverviewEntity[]> => {
    if (!isWellmix(user)) return [];
    const { summariesReady } = await import("./order-summary");
    const ready = await summariesReady();
    return (
      await newProductData(user, now, async (ids) => {
        // Completude geral dos pedidos: do resumo (indicadores prontos) ou
        // das etapas lidas na hora (sem os resumos em uso).
        if (ready) {
          const { readOrderFlows } = await import("./flow-kpis");
          const flows = ids.length ? await readOrderFlows(ids) : [];
          if (flows) return new Map(flows.map(({ id, f }) => [id, f.o]));
        }
        const progress = await flowProgressFor(user);
        return new Map([...progress].map(([id, p]) => [id, p.overall]));
      })
    ).rows;
  },
);

/**
 * As linhas do Produto novo e os prazos que mudam o atraso delas (convite
 * vencido, SLA da negociação). Sem login (`null`): todas, para os
 * indicadores prontos (flow-kpis.ts); com login, só as telas que ele abre.
 * `overall`: a completude geral dos pedidos em andamento, por id (ou a
 * função que a lê, com os ids dos pedidos das solicitações).
 */
export async function newProductData(
  user: User | null,
  now: Date,
  overall:
    | Map<string, number>
    | ((orderIds: string[]) => Promise<Map<string, number>>),
): Promise<{ rows: OverviewEntity[]; dues: number[] }> {
  const store = getStore();
  const sees = (screen: "booking" | "quotes") => !user || canOpen(user, screen);
  const [lots, invites, requests, minutes] = await Promise.all([
    sees("booking")
      ? store.list("booking_lots", {
          filter: {
            status: ["preparing", "draft", "closed", "in_progress"],
          },
        })
      : Promise.resolve([]),
    sees("quotes")
      ? store
          .list("booking_invites", { filter: { status: "open" } })
          .catch(() => [])
      : Promise.resolve([]),
    sees("quotes")
      ? store.list("supplier_requests", {
          filter: { status: ["open", "answered", "approved"] },
        })
      : Promise.resolve([]),
    (async () => (await getSettings()).supplierRequestSlaMinutes)(),
  ]);
  // Book já concluído com convite de book concorrente ainda aberto.
  const missing = [
    ...new Set(
      invites
        .map((i) => i.bookingLotId)
        .filter((id) => !lots.some((l) => l.id === id)),
    ),
  ];
  if (missing.length)
    lots.push(
      ...(await store.list("booking_lots", { filter: { id: missing } })),
    );
  const orderIds = [
    ...new Set(requests.map((r) => r.orderId).filter((x): x is string => !!x)),
  ];
  const overallById =
    typeof overall === "function" ? await overall(orderIds) : overall;
  const out: OverviewEntity[] = [];
  const dues: number[] = [];
  // Pedidos em andamento que nasceram das solicitações de cada book.
  const ordersOfLot = (lotId: string) =>
    [
      ...new Set(
        requests
          .filter((r) => r.bookingLotId === lotId && r.orderId)
          .map((r) => r.orderId!),
      ),
    ]
      .map((id) => overallById.get(id))
      .filter((o): o is number => o !== undefined);
  for (const lot of lots) {
    const step = bookStep(lot.status);
    const open = invites.filter((i) => i.bookingLotId === lot.id);
    if (!step && !open.length) continue;
    for (const i of open) dues.push(Date.parse(i.dueAt));
    const orders = ordersOfLot(lot.id);
    out.push({
      kind: "book",
      id: lot.id,
      number: lot.number,
      href: `/app/booking/lots/${lot.id}#entity-timeline`,
      partyId: lot.supplierId ?? lot.partnerId ?? null,
      steps: [...(step ? [step] : []), ...(open.length ? ["quotes"] : [])],
      statusKey: `bookingLots.status.${lot.status}`,
      since: lot.statusChangedAt ?? lot.createdAt ?? null,
      lateDays: Math.max(0, ...open.map((i) => lateDaysSince(i.dueAt, now))),
      percent: BOOK_PERCENT[lot.status] ?? 0,
      overall: overallOf(
        BOOK_PERCENT[lot.status] ?? 0,
        orders.length,
        orders.length
          ? Math.round(orders.reduce((n, o) => n + o, 0) / orders.length)
          : 0,
      ),
    });
  }
  const groups = new Map<string, typeof requests>();
  for (const r of requests) {
    if (r.orderId || !requestInNegotiation(r)) continue;
    const key = r.batchId ?? r.id;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  for (const list of groups.values()) {
    const first = [...list].sort((a, b) =>
      a.createdAt < b.createdAt ? -1 : 1,
    )[0];
    const percents = list.map((r) => requestPercent(r) ?? 0);
    const percent = Math.round(
      percents.reduce((a, b) => a + b, 0) / percents.length,
    );
    // A situação mais atrasada do grupo (aberta antes de respondida…).
    const lowest = list.reduce((a, b) =>
      (requestPercent(a) ?? 0) <= (requestPercent(b) ?? 0) ? a : b,
    );
    for (const r of list)
      if (r.status === "open" || r.status === "answered")
        dues.push(Date.parse(supplierRequestSlaDue(r, minutes)));
    out.push({
      kind: "request",
      id: first.id,
      number: first.number,
      href: `/app/supplier-requests/${first.id}#entity-timeline`,
      partyId: first.supplierId,
      steps: ["negotiations"],
      statusKey:
        lowest.status === "approved"
          ? `flow.np.sampling.${lowest.sampling?.status ?? "pending"}`
          : `supplierRequests.status.${lowest.status}`,
      since: first.createdAt ?? null,
      lateDays: Math.max(
        0,
        ...list.map((r) =>
          supplierRequestLate(r, minutes, now)
            ? lateDaysSince(supplierRequestSlaDue(r, minutes), now)
            : 0,
        ),
      ),
      percent,
      overall: percent,
    });
  }
  return {
    rows: out.sort(
      (a, b) =>
        (a.kind === b.kind ? 0 : a.kind === "book" ? -1 : 1) ||
        a.number - b.number,
    ),
    dues,
  };
}

/**
 * Aba "Todos no passo" do parceiro (dono, 14/11/2026; docs/FLOW_MENU.md):
 * os pedidos dele (a regra de canViewOrder) que estão em cada passo dele
 * agora, só com o que é dele: os itens de etapa abertos que o papel faz e os
 * passos do embarque, da origem, da certificação e das amostras prontos que
 * o papel vê (canSeeStep). Só os passos do parceiro (PARTNER_FLOW_STEPS).
 */
export const flowPartnerAllFor = cache(
  async (user: User): Promise<Map<string, FlowEntity[]>> => {
    const { canViewOrder } = await import("@/lib/auth/permissions");
    const { partnerStepsOf, flowStepOfImportKey } = await import("@/lib/flow");
    const { canSubmitRequirement } = await import("@/lib/workflow/engine");
    if (isWellmix(user) || !user.partyId) return new Map();
    const mine = new Set(partnerStepsOf(user.role).map(stepId));
    if (!mine.size) return new Map();
    const store = getStore();
    const orders = (await store.list("orders")).filter(
      (o) =>
        !o.held &&
        o.status !== "CLOSED" &&
        o.status !== "CANCELLED" &&
        canViewOrder(user, o),
    );
    if (!orders.length) return new Map();
    const ids = orders.map((o) => o.id);
    const orderById = new Map(orders.map((o) => [o.id, o]));
    const out = new Map<string, Map<string, FlowEntity>>();
    const add = (
      key: string,
      orderId: string,
      item: FlowEntityItem,
      since: string | null,
    ) => {
      if (!mine.has(key)) return;
      const order = orderById.get(orderId);
      if (!order) return;
      const byOrder = out.get(key) ?? new Map<string, FlowEntity>();
      const entity = byOrder.get(orderId) ?? { order, items: [], since: null };
      entity.items.push(item);
      if (since && (!entity.since || since < entity.since))
        entity.since = since;
      byOrder.set(orderId, entity);
      out.set(key, byOrder);
    };
    const [stages, importSteps] = await Promise.all([
      store.list("stages", { filter: { orderId: ids } }),
      store.list("import_steps", { filter: { orderId: ids } }).catch(() => []),
    ]);
    const live = stages.filter(
      (s) => s.status === "active" || s.status === "blocked",
    );
    const stageById = new Map(live.map((s) => [s.id, s]));
    const requirements = live.length
      ? await store.list("requirements", {
          filter: { stageId: live.map((s) => s.id) },
        })
      : [];
    for (const r of requirements) {
      if (r.status === "done") continue;
      const stage = stageById.get(r.stageId);
      const order = orderById.get(r.orderId);
      if (!stage || !order) continue;
      // Só o que é do papel: o item dele ou o que ele pode fazer.
      if (r.role !== user.role && !canSubmitRequirement(user, order, r))
        continue;
      for (const step of flowStepsOf({
        kind: "requirement",
        stageKey: stage.key,
        items: [{ key: r.key }],
      }))
        add(
          stepId(step),
          r.orderId,
          { kind: "requirement", requirement: r },
          stage.startedAt ?? null,
        );
    }
    const flow = await import("./import-flow");
    const { samplesApply } = await import("./sample-flow");
    for (const order of orders) {
      const steps = importSteps.filter((s) => s.orderId === order.id);
      const samples =
        [
          "INSPECTION",
          "SHIPPING",
          "CUSTOMS",
          "TRANSPORT",
          "DELIVERED",
        ].includes(order.status) &&
        (await samplesApply(order).catch(() => false));
      for (const key of flow.openImportStepKeys(order, steps, {
        certification: steps.some((s) => s.key.startsWith("cert_")),
        samples,
      })) {
        if (!flow.canSeeStep(user, order, key)) continue;
        const step = flowStepOfImportKey(key);
        if (step)
          add(
            stepId(step),
            order.id,
            { kind: "import", key },
            order.updatedAt ?? null,
          );
      }
    }
    return new Map(
      [...out.entries()].map(([k, byOrder]) => [
        k,
        [...byOrder.values()].sort((a, b) => a.order.number - b.order.number),
      ]),
    );
  },
);

/**
 * Os números do Overview: os indicadores prontos (`kpi_snapshots`, chave
 * "flow") com os resumos em uso; sem eles, somados das linhas lidas das
 * tabelas, pela mesma conta (flow-kpis.ts, `aggregateFlow`).
 */
export async function flowOverviewKpis(
  user: User,
  now = new Date(),
): Promise<Pick<import("./flow-kpis").FlowKpis, "blocks" | "steps">> {
  const k = await import("./flow-kpis");
  if (!isWellmix(user)) return k.aggregateFlow(new Map());
  const ready = await k.readFlowKpis(now);
  if (ready) return ready;
  const byBlock = new Map<FlowBlock, OverviewEntity[]>();
  for (const block of k.ENTITY_BLOCKS)
    byBlock.set(block, await flowOverviewEntities(user, block));
  return k.aggregateFlow(byBlock);
}
