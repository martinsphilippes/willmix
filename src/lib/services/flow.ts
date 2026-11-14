import { cache } from "react";
import type { User } from "@/lib/db/schema";
import { getStore } from "@/lib/db";
import { isWellmix } from "@/lib/auth/permissions";
import { canOpen } from "@/lib/auth/screens";
import { pendingTasksFor, type Task } from "./tasks";
import { tasksForFunctions } from "@/lib/task-owner";
import { orderProgress, type OrderProgress } from "@/lib/flow-progress";
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
export type FlowEntityItem =
  | { kind: "requirement"; requirement: import("@/lib/db/schema").Requirement }
  | { kind: "import"; key: string }
  | { kind: "case"; title: FlowCase["text"] };

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
    const [stages, importSteps, tracks] = await Promise.all([
      store.list("stages", { filter: { orderId: ids } }),
      store.list("import_steps", { filter: { orderId: ids } }).catch(() => []),
      store
        .list("production_tracks", { filter: { orderId: ids } })
        .catch(() => []),
    ]);
    const now = new Date();
    const stagesByOrder = new Map<string, typeof stages>();
    for (const st of stages) {
      const list = stagesByOrder.get(st.orderId) ?? [];
      list.push(st);
      stagesByOrder.set(st.orderId, list);
    }
    const progress = new Map(
      orders.map((o) => [
        o.id,
        orderProgress(stagesByOrder.get(o.id) ?? [], now),
      ]),
    );
    // Itens de etapa abertos das etapas em andamento (ou bloqueadas).
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
      if (!stage) continue;
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
    // Passos do embarque, da origem, da certificação e das amostras.
    const flow = await import("./import-flow");
    const { samplesApply } = await import("./sample-flow");
    const { flowStepOfImportKey } = await import("@/lib/flow");
    for (const order of orders) {
      const steps = importSteps.filter((s) => s.orderId === order.id);
      const certification = steps.some((s) => s.key.startsWith("cert_"));
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
        certification,
        samples,
      })) {
        const step = flowStepOfImportKey(key);
        if (!step) continue;
        const after = steps
          .filter((s) => s.orderId === order.id)
          .map((s) => s.updatedAt ?? s.createdAt ?? null)
          .filter((d): d is string => !!d)
          .sort()
          .pop();
        add(stepId(step), order.id, { kind: "import", key }, after ?? null);
      }
      // Produção em andamento: com ETD e na etapa de inspeção.
      const track = tracks.find((x) => x.orderId === order.id);
      if (track?.etd && order.status === "INSPECTION")
        add(
          "production/production",
          order.id,
          {
            kind: "case",
            title: {
              title: "flow.all.production",
              detail: "flow.all.production",
              values: { n: order.number },
            },
          },
          track.productionStartAt ?? null,
        );
    }
    // Recebimento no CD e pré-produção: os mesmos casos do menu.
    for (const c of [
      ...(await flowReceivingCasesFor(user).catch(() => [])),
      ...(await flowPreProductionCasesFor(user).catch(() => [])),
    ])
      for (const step of flowStepsOf(c))
        if (c.orderId)
          add(
            stepId(step),
            c.orderId,
            { kind: "case", title: c.text },
            c.sinceAt ?? null,
          );
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
