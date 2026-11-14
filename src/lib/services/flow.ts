import { cache } from "react";
import type { User } from "@/lib/db/schema";
import { getStore } from "@/lib/db";
import { isWellmix } from "@/lib/auth/permissions";
import { canOpen } from "@/lib/auth/screens";
import { pendingTasksFor, type Task } from "./tasks";
import { tasksForFunctions } from "@/lib/task-owner";
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
  kind: Task["kind"] | "receiving_storage" | "receiving_return";
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

/** Todos os casos do menu do login: as pendências e os recebimentos abertos. */
export const flowCasesFor = cache(async (user: User): Promise<FlowCase[]> => [
  ...(await flowTasksFor(user)),
  ...(await flowReceivingCasesFor(user).catch((error: unknown) => {
    console.error("flowReceivingCasesFor failed", error);
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
