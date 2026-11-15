import "server-only";

import { createHash } from "node:crypto";
import { after } from "next/server";
import {
  getStore,
  type ImportStep,
  type Order,
  type OrderMilestone,
  type OrderMilestoneStatus,
  type ProductionTrack,
  type Receiving,
  type Requirement,
  type Stage,
} from "@/lib/db";
import { isHeld, type NewRow } from "@/lib/db/store";
import type { User } from "@/lib/db";
import { requirementLabel } from "@/i18n";
import {
  milestoneOfItem,
  releaseOf,
  requirementReleased,
  ROUNDS_PARENT_MILESTONES,
  type MilestoneRelease,
} from "@/lib/milestone-release";
import { isRoundsParent } from "@/lib/purchase-rounds";
import {
  isOrderDocumentKey,
  isPurchaseFlow,
  ROLE_PARTY_FIELD,
} from "@/lib/workflow/stages";
import { notify, requesterTarget } from "./notifications";
import {
  currentMilestone,
  MILESTONE_KEYS,
  milestoneOfRequirement,
  milestoneOfStep,
  milestoneTitle,
  orderMilestones,
  requirementFlowFields,
  type MilestoneKey,
  type MilestoneView,
} from "@/lib/milestones";
import { SAMPLE_ORDER_KEY } from "@/lib/purchase-lanes";
import { getSettings, milestoneDueDaysOf } from "@/lib/settings";
import { orderSubtasks, type MilestoneInput } from "./milestones";

/*
 * Fase 5b (docs/MILESTONES.md, "Fase 5: plano e andamento"): os marcos do
 * pedido gravados em sombra, ao lado das etapas antigas.
 *
 * - `syncMilestones(orderId)`: calcula os 16 marcos do pedido (as mesmas
 *   subtarefas da tela, `orderSubtasks`) e grava `order_milestones` (a linha
 *   nasce quando o marco abre pela primeira vez, com o prazo de
 *   `milestoneDueDays`; conclui com `completedAt`) e `orders.milestoneKey`
 *   (o marco atual). Desde a fase 5d é a autoridade: fora da sombra avisa
 *   quem faz os itens liberados, dispara os eventos `milestone:*`, avisa os
 *   informados e roda os casos especiais (`afterTransitions`). Em sombra
 *   (`{ shadow: true }`: migração, conferência, carga do Sankhya) só grava.
 * - `queueMilestoneSync`: as outras gravações (passos do embarque, produção,
 *   recebimento) pedem a sincronização; os pedidos da mesma requisição viram
 *   uma chamada por pedido, depois da resposta. O motor chama na hora.
 *   Falha não derruba a ação (registra e segue).
 * - Migração (`migrateMilestonesStep`) e conferência (`milestoneParityStep`):
 *   em fatias de 500 pedidos, com o cursor em `settings`, pela tela
 *   Configurações → Resumos dos pedidos ("Migrar para os marcos").
 */

/** Id estável da linha (pedido + marco): a gravação em lote não duplica. */
export function orderMilestoneId(orderId: string, key: string): string {
  const h = createHash("sha1")
    .update(`order_milestone:${orderId}:${key}`)
    .digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

type MilestoneRowData = NewRow<OrderMilestone> & { id: string };

const addDays = (iso: string, days: number) =>
  new Date(Date.parse(iso) + days * 86_400_000).toISOString();

/** Marco gravado válido (um dos 16) ou nulo. */
export const storedMilestone = (
  key: string | null | undefined,
): MilestoneKey | null =>
  key && (MILESTONE_KEYS as readonly string[]).includes(key)
    ? (key as MilestoneKey)
    : null;

/**
 * Marcos travados pela linha gravada (fase 5e): o bloqueio da inspeção mora
 * em `order_milestones` (status "blocked" e o motivo), gravado por
 * `setMilestoneBlock`; a etapa não decide mais.
 */
export function blockedMilestones(
  rows: readonly Pick<OrderMilestone, "key" | "status" | "blockReason">[],
): Map<MilestoneKey, string | null> {
  const out = new Map<MilestoneKey, string | null>();
  for (const r of rows) {
    const key = storedMilestone(r.key);
    if (key && r.status === "blocked") out.set(key, r.blockReason ?? null);
  }
  return out;
}

/** Marco do bloqueio da inspeção (divergência de peso ou comprado × inspecionado). */
export const INSPECTION_BLOCK_MILESTONE: MilestoneKey = "inspection";

/**
 * Trava (com o motivo) ou destrava (`null`) um marco do pedido na linha
 * dele (fase 5e). Sem linha, a trava cria a linha já em andamento e travada.
 * Destravar a linha que não está travada não muda nada.
 */
export async function setMilestoneBlock(
  orderId: string,
  key: MilestoneKey,
  reason: string | null,
): Promise<void> {
  const store = getStore();
  const [row] = await store.list("order_milestones", {
    filter: { orderId, key },
    limit: 1,
  });
  if (reason === null) {
    if (row?.status === "blocked")
      await store.update("order_milestones", row.id, {
        status: "active",
        blockReason: null,
      });
    return;
  }
  if (row) {
    if (row.status !== "blocked" || row.blockReason !== reason)
      await store.update("order_milestones", row.id, {
        status: "blocked",
        blockReason: reason,
        completedAt: null,
      });
    return;
  }
  const [order, settings] = await Promise.all([
    store.get("orders", orderId),
    getSettings(),
  ]);
  const now = new Date().toISOString();
  const days = milestoneDueDaysOf(settings)[key];
  await store.create("order_milestones", {
    id: orderMilestoneId(orderId, key),
    orderId,
    key,
    status: "blocked",
    startedAt: now,
    dueAt: days == null ? null : addDays(now, days),
    completedAt: null,
    reminderSentAt: null,
    blockReason: reason,
    held: order?.held === true ? true : null,
  });
}

/** O marco está travado? O motivo (ou nulo sem motivo); sem trava, `undefined`. */
export async function milestoneBlockOf(
  orderId: string,
  key: MilestoneKey,
): Promise<string | null | undefined> {
  const [row] = await getStore().list("order_milestones", {
    filter: { orderId, key },
    limit: 1,
  });
  return row?.status === "blocked" ? (row.blockReason ?? null) : undefined;
}

/**
 * Migração (fase 5b): marcos com item numa etapa travada (o bloqueio antigo
 * da inspeção), para gravar a trava na linha do marco.
 */
export function blockedMilestonesFromStages(
  stages: readonly Pick<Stage, "id" | "key" | "status" | "blockReason">[],
  requirements: readonly (Pick<Requirement, "stageId" | "key"> & {
    milestoneKey?: string | null;
  })[],
): Map<MilestoneKey, string | null> {
  const out = new Map<MilestoneKey, string | null>();
  const blocked = new Map(
    stages.filter((s) => s.status === "blocked").map((s) => [s.id, s]),
  );
  if (!blocked.size) return out;
  for (const r of requirements) {
    const stage = blocked.get(r.stageId);
    if (!stage) continue;
    // Fase 5c: o marco gravado no item; sem ele, pela etapa e a chave.
    const key =
      storedMilestone(r.milestoneKey) ??
      milestoneOfRequirement(stage.key, r.key);
    if (key && !out.has(key)) out.set(key, stage.blockReason ?? null);
  }
  return out;
}

export interface MilestonePlanInput {
  order: Pick<Order, "id" | "status" | "held" | "closedAt">;
  views: readonly Pick<MilestoneView, "key" | "state">[];
  existing: readonly OrderMilestone[];
  blocked: ReadonlyMap<MilestoneKey, string | null>;
  dueDays: Record<MilestoneKey, number | null>;
  now: string;
}

/**
 * As linhas de `order_milestones` que mudam (função pura):
 * - em andamento: a linha nasce (início agora, prazo pelos dias do marco) ou
 *   volta a "active"/"blocked" (concluído que reabriu perde a conclusão);
 * - concluído: a linha nasce concluída ou conclui agora (pedido encerrado:
 *   na data do encerramento, se a linha nasce agora);
 * - aguardando ou sem aplicação: a linha que existe fica como está;
 * - pedido cancelado: nada muda além da marca de espera.
 * `held` acompanha o pedido (histórico do Sankhya em espera).
 */
export function planMilestoneRows(input: MilestonePlanInput): {
  rows: MilestoneRowData[];
  milestoneKey: MilestoneKey | null;
} {
  const { order, now } = input;
  const held = order.held === true ? true : null;
  const byKey = new Map(input.existing.map((r) => [r.key, r]));
  const rows: MilestoneRowData[] = [];
  const cancelled = order.status === "CANCELLED";
  for (const view of input.views) {
    const row = byKey.get(view.key);
    let next: MilestoneRowData | null = row
      ? {
          id: row.id,
          orderId: row.orderId,
          key: row.key,
          status: row.status,
          startedAt: row.startedAt ?? null,
          dueAt: row.dueAt ?? null,
          completedAt: row.completedAt ?? null,
          reminderSentAt: row.reminderSentAt ?? null,
          blockReason: row.blockReason ?? null,
          held,
        }
      : null;
    if (!cancelled && view.state === "active") {
      const block = input.blocked.has(view.key);
      const status: OrderMilestoneStatus = block ? "blocked" : "active";
      const blockReason = block ? (input.blocked.get(view.key) ?? null) : null;
      if (!next) {
        const days = input.dueDays[view.key];
        next = {
          id: orderMilestoneId(order.id, view.key),
          orderId: order.id,
          key: view.key,
          status,
          startedAt: now,
          dueAt: days == null ? null : addDays(now, days),
          completedAt: null,
          reminderSentAt: null,
          blockReason,
          held,
        };
      } else next = { ...next, status, completedAt: null, blockReason };
    } else if (!cancelled && view.state === "done") {
      const at =
        order.status === "CLOSED" && order.closedAt ? order.closedAt : now;
      if (!next)
        next = {
          id: orderMilestoneId(order.id, view.key),
          orderId: order.id,
          key: view.key,
          status: "done",
          startedAt: null,
          dueAt: null,
          completedAt: at,
          reminderSentAt: null,
          blockReason: null,
          held,
        };
      else if (next.status !== "done")
        next = { ...next, status: "done", completedAt: now, blockReason: null };
    }
    if (!next) continue;
    if (row && sameRow(row, next)) continue;
    rows.push(next);
  }
  return {
    rows,
    milestoneKey: currentMilestone(input.views, order.status),
  };
}

function sameRow(a: OrderMilestone, b: MilestoneRowData) {
  return (
    a.status === b.status &&
    (a.startedAt ?? null) === b.startedAt &&
    (a.dueAt ?? null) === b.dueAt &&
    (a.completedAt ?? null) === b.completedAt &&
    (a.reminderSentAt ?? null) === b.reminderSentAt &&
    (a.blockReason ?? null) === b.blockReason &&
    (a.held === true ? true : null) === b.held
  );
}

/** Grava as linhas: em lote quando o banco tem, senão uma a uma. */
async function writeMilestoneRows(
  rows: MilestoneRowData[],
  existingIds: ReadonlySet<string>,
) {
  if (!rows.length) return;
  const store = getStore();
  if (store.upsertMany) {
    await store.upsertMany("order_milestones", rows);
    return;
  }
  for (const row of rows) {
    const { id, ...data } = row;
    if (existingIds.has(id)) await store.update("order_milestones", id, data);
    else await store.create("order_milestones", row);
  }
}

/**
 * Grava `orders.milestoneKey` sem marcar o resumo do pedido (`updateWhere`
 * não refaz resumos): o campo ainda não entra no resumo, e a ação que pediu
 * a sincronização já marcou o pedido.
 */
async function writeOrderMilestoneKeys(
  changes: ReadonlyMap<string, MilestoneKey | null>,
) {
  if (!changes.size) return;
  const store = getStore();
  const groups = new Map<MilestoneKey | null, string[]>();
  for (const [id, key] of changes)
    groups.set(key, [...(groups.get(key) ?? []), id]);
  for (const [key, ids] of groups) {
    if (store.updateWhere)
      await store.updateWhere("orders", { id: ids }, { milestoneKey: key });
    else
      for (const id of ids)
        await store.update("orders", id, { milestoneKey: key });
  }
}

/** O que os marcos de um grupo de pedidos leem (as mesmas fontes da tela). */
interface SliceSources {
  orders: Order[];
  stages: Map<string, Stage[]>;
  requirements: Map<string, Requirement[]>;
  steps: Map<string, ImportStep[]>;
  tracks: Map<string, ProductionTrack[]>;
  receivings: Map<string, Receiving[]>;
  lpco: Set<string>;
  milestones: Map<string, OrderMilestone[]>;
}

function groupBy<T extends { orderId: string }>(rows: readonly T[]) {
  const out = new Map<string, T[]>();
  for (const r of rows) {
    const list = out.get(r.orderId);
    if (list) list.push(r);
    else out.set(r.orderId, [r]);
  }
  return out;
}

const safe = <T>(p: Promise<T[]>) => p.catch(() => [] as T[]);

/**
 * Lê os pedidos dados e o que os marcos deles usam: uma consulta por tabela
 * para o grupo (o banco divide as listas longas). Dos itens, só as colunas
 * que os marcos leem; o valor só do pedido de amostras.
 */
async function loadSlice(ids: string[]): Promise<SliceSources> {
  const store = getStore();
  const orders = ids.length
    ? await store.list("orders", { filter: { id: ids } })
    : [];
  const orderIds = orders.map((o) => o.id);
  if (!orderIds.length)
    return {
      orders,
      stages: new Map(),
      requirements: new Map(),
      steps: new Map(),
      tracks: new Map(),
      receivings: new Map(),
      lpco: new Set(),
      milestones: new Map(),
    };
  const { listColumns } = await import("@/lib/db/lookup");
  const filter = { orderId: orderIds };
  const [
    stages,
    requirements,
    samples,
    steps,
    tracks,
    receivings,
    lpco,
    milestones,
  ] = await Promise.all([
    listColumns(
      store,
      "stages",
      ["orderId", "key", "status", "dueAt", "blockReason"],
      { filter },
    ),
    listColumns(
      store,
      "requirements",
      [
        "orderId",
        "stageId",
        "key",
        "status",
        "step",
        "milestoneKey",
        "required",
      ],
      { filter },
    ),
    store.list("requirements", {
      filter: { ...filter, key: SAMPLE_ORDER_KEY },
    }),
    safe(store.list("import_steps", { filter })),
    safe(store.list("production_tracks", { filter })),
    safe(store.list("receivings", { filter })),
    import("./import-flow")
      .then((m) => m.lpcoOrderIds(orderIds))
      .catch(() => new Set<string>()),
    safe(store.list("order_milestones", { filter })),
  ]);
  const sampleById = new Map(samples.map((r) => [r.id, r]));
  return {
    orders,
    stages: groupBy(stages as Stage[]),
    requirements: groupBy(
      (requirements as Requirement[]).map((r) => sampleById.get(r.id) ?? r),
    ),
    steps: groupBy(steps),
    tracks: groupBy(tracks),
    receivings: groupBy(receivings),
    lpco,
    milestones: groupBy(milestones),
  };
}

function inputOf(order: Order, src: SliceSources): MilestoneInput {
  return {
    order,
    stages: src.stages.get(order.id) ?? [],
    requirements: src.requirements.get(order.id) ?? [],
    importSteps: src.steps.get(order.id) ?? [],
    track: src.tracks.get(order.id)?.[0] ?? null,
    receiving: src.receivings.get(order.id)?.[0] ?? null,
    lpco: src.lpco.has(order.id),
  };
}

/** Os 16 marcos do pedido pelas etapas (a conta de antes da fase 5c). */
const viewsByStage = (input: MilestoneInput) =>
  orderMilestones(
    orderSubtasks({ ...input, source: "stages" }),
    input.order.status,
  );

/**
 * Os 16 marcos como as telas leem desde a fase 5c: o passo gravado no item
 * (`requirements.step`) e, só sem ele, o de-para pela etapa.
 */
const viewsNow = (input: MilestoneInput) =>
  orderMilestones(orderSubtasks(input), input.order.status);

/**
 * Os marcos pelos campos gravados nos itens (`requirements.step` e
 * `milestoneKey`): o item entra pelo passo gravado, só quando o marco
 * gravado é o desse passo (o item que só tem marco pela etapa não entra na
 * linha do tempo, como hoje).
 */
const viewsByStored = (input: MilestoneInput) =>
  orderMilestones(
    orderSubtasks({
      ...input,
      requirementStep: (r) =>
        r.step && r.milestoneKey && milestoneOfStep(r.step) === r.milestoneKey
          ? r.step
          : null,
    }),
    input.order.status,
  );

export interface SyncResult {
  rows: number;
  milestoneKey: MilestoneKey | null;
  /** Marcos que começaram nesta sincronização (fase 5d). */
  started: MilestoneKey[];
  /** Marcos que concluíram nesta sincronização, com todas as subtarefas. */
  done: MilestoneKey[];
}

export interface SyncOptions {
  /**
   * Em sombra (migração, conferência, carga do histórico do Sankhya): grava
   * as linhas sem avisos, eventos nem efeitos. Fora dela (o motor, fase 5d),
   * a sincronização é a autoridade: avisa quem faz os itens liberados,
   * dispara os eventos `milestone:*`, avisa os informados e roda os casos
   * especiais (pós-venda, rodadas, ficha de compra).
   */
  shadow?: boolean;
  /** Quem agiu (o motor); nulo no sistema (fila, rotinas). */
  user?: User | null;
  now?: Date;
}

/**
 * Transições entre as linhas gravadas e os marcos de agora (função pura):
 * começou = em andamento sem linha aberta antes (sem linha, ou concluída e
 * reaberta); concluiu = concluído com todas as subtarefas feitas e sem linha
 * concluída antes. O "concluído" só pela situação (encerrado conclui tudo)
 * não conta, como no aviso aos informados (fase 4c).
 */
export function milestoneTransitions(
  views: readonly Pick<MilestoneView, "key" | "state" | "total" | "subtasks">[],
  existing: readonly Pick<OrderMilestone, "key" | "status">[],
): { started: MilestoneKey[]; done: MilestoneKey[]; closed: MilestoneKey[] } {
  const before = new Map(existing.map((r) => [r.key, r.status]));
  const started: MilestoneKey[] = [];
  const done: MilestoneKey[] = [];
  const closed: MilestoneKey[] = [];
  for (const v of views) {
    const was = before.get(v.key);
    if (v.state === "active" && (was === undefined || was === "done"))
      started.push(v.key);
    if (v.state !== "done" || was === "done") continue;
    // Concluído de qualquer jeito (inclusive pelo encerramento).
    closed.push(v.key);
    // Com as obrigatórias feitas (o opcional não segura; fase 5d).
    if (v.total > 0 && v.subtasks.every((x) => x.done || x.optional))
      done.push(v.key);
  }
  return { started, done, closed };
}

/**
 * Sincroniza os marcos de um pedido. Grava `order_milestones` e
 * `orders.milestoneKey`; fora da sombra (fase 5d), cuida também das
 * transições (`afterTransitions`). Pedido em espera (histórico do Sankhya)
 * e cancelado: só as linhas, nunca avisos. Pedido que não existe: nada.
 */
export async function syncMilestones(
  orderId: string,
  options: SyncOptions = {},
): Promise<SyncResult | null> {
  const [src, settings] = await Promise.all([
    loadSlice([orderId]),
    getSettings(),
  ]);
  const order = src.orders[0];
  if (!order) return null;
  const input = inputOf(order, src);
  const existing = src.milestones.get(order.id) ?? [];
  const views = viewsNow(input);
  const plan = planMilestoneRows({
    order,
    views,
    existing,
    blocked: blockedMilestones(existing),
    dueDays: milestoneDueDaysOf(settings),
    now: (options.now ?? new Date()).toISOString(),
  });
  await writeMilestoneRows(plan.rows, new Set(existing.map((r) => r.id)));
  if ((order.milestoneKey ?? null) !== plan.milestoneKey)
    await writeOrderMilestoneKeys(new Map([[order.id, plan.milestoneKey]]));
  // Fase 5c: o resumo do pedido lê o prazo gravado do marco e o painel de
  // SLA o "no prazo" dos marcos concluídos; a gravação em lote não passa
  // pelo aviso do CachedStore, então o pedido é marcado aqui.
  if (plan.rows.length || (order.milestoneKey ?? null) !== plan.milestoneKey) {
    const { noteMilestoneWrite } = await import("@/lib/db/summary-dirty");
    // SLA: só quando um marco com prazo conclui ou reabre.
    const wasDone = new Set(
      existing.filter((r) => r.status === "done").map((r) => r.id),
    );
    noteMilestoneWrite(
      order.id,
      plan.rows.some(
        (r) => !!r.dueAt && (r.status === "done") !== wasDone.has(r.id),
      ),
    );
  }
  const quiet =
    options.shadow === true || isHeld(order) || order.status === "CANCELLED";
  const moved = quiet
    ? { started: [], done: [], closed: [] }
    : milestoneTransitions(views, existing);
  // As linhas já estão gravadas: uma sincronização aninhada (um efeito que
  // envia outro item) não vê a mesma transição de novo.
  if (moved.started.length || moved.closed.length)
    await afterTransitions(order, input, views, moved, options.user ?? null);
  return {
    rows: plan.rows.length,
    milestoneKey: plan.milestoneKey,
    started: moved.started,
    done: moved.done,
  };
}

/** Os marcos e a liberação dos itens de um pedido, calculados agora. */
export async function orderRelease(orderId: string): Promise<{
  views: MilestoneView[];
  release: MilestoneRelease;
} | null> {
  const src = await loadSlice([orderId]);
  const order = src.orders[0];
  if (!order) return null;
  const input = inputOf(order, src);
  const views = viewsNow(input);
  return { views, release: releaseOf(views, input.stages) };
}

/** `orderRelease` de vários pedidos numa leitura só (uma consulta por tabela). */
export async function ordersRelease(
  orderIds: readonly string[],
): Promise<Map<string, { views: MilestoneView[]; release: MilestoneRelease }>> {
  const out = new Map<
    string,
    { views: MilestoneView[]; release: MilestoneRelease }
  >();
  if (!orderIds.length) return out;
  const src = await loadSlice([...orderIds]);
  for (const order of src.orders) {
    const input = inputOf(order, src);
    const views = viewsNow(input);
    out.set(order.id, { views, release: releaseOf(views, input.stages) });
  }
  return out;
}

/**
 * O item está liberado pelo marco dele agora (fase 5d)? Para as telas e os
 * serviços que mostram ou aceitam o item fora do motor (pedido de amostras,
 * assinatura, Die Cut, itens conferidos pelo sistema).
 */
export async function requirementIsReleased(
  requirement: Pick<Requirement, "orderId" | "key" | "required" | "stageId"> & {
    milestoneKey?: string | null;
  },
): Promise<boolean> {
  const src = await loadSlice([requirement.orderId]);
  const order = src.orders[0];
  if (!order) return false;
  const input = inputOf(order, src);
  return requirementReleased(
    order,
    requirement,
    releaseOf(viewsNow(input), input.stages),
  );
}

/** Auditoria do aviso "liberado" (uma vez por marco e pedido). */
export const MILESTONE_RELEASED_ACTION = "milestone.released";

/**
 * O que acontece quando marcos começam ou concluem (fase 5d; antes na
 * ativação e na conclusão das etapas e no recálculo do resumo):
 * - aviso a quem faz os itens liberados do marco que começou;
 * - ficha de compra: o marco 1 que começou preenche a Preparação pela ficha;
 * - pedido pai de uma programação de compra: com os marcos 1 a 4 prontos,
 *   nascem as rodadas do dia;
 * - Entrega e recebimento concluída: abre o pós-venda;
 * - eventos `milestone:*` das regras de processo e aviso aos informados.
 * Cada parte registra o erro e segue (a ação original não cai).
 */
async function afterTransitions(
  order: Order,
  input: MilestoneInput,
  views: readonly MilestoneView[],
  moved: {
    started: MilestoneKey[];
    done: MilestoneKey[];
    closed: MilestoneKey[];
  },
  user: User | null,
) {
  const guard = async (what: string, run: () => Promise<unknown>) => {
    try {
      await run();
    } catch (error) {
      console.error(`[milestones] ${what}`, order.id, error);
    }
  };
  const release = releaseOf(views, input.stages);
  const parent = isRoundsParent(order);
  if (moved.started.length)
    await guard("aviso dos itens liberados", () =>
      notifyReleased(order, input, release, moved.started),
    );
  if (user && !isPurchaseFlow(order) && moved.started.includes("new-order"))
    await guard("ficha de compra", async () => {
      const { syncPreparationFromSheet } = await import("./purchase-sheet");
      await syncPreparationFromSheet(user, order.id);
    });
  // Pai da programação: o contrato (marco 5) deixou de aguardar = marcos 1
  // a 4 prontos. Contrato e produção são de cada rodada.
  if (
    parent &&
    (moved.started.includes("contract") || moved.closed.includes("contract"))
  )
    await guard("rodadas da programação", async () => {
      const { spawnDueRounds } = await import("./purchase-rounds");
      await spawnDueRounds(user, { orderId: order.id });
    });
  // Pós-venda: com a Entrega e recebimento concluída (inclusive pelo
  // encerramento do pedido, como na conclusão da etapa Entregue).
  if (moved.closed.includes("delivery"))
    await guard("pós-venda", async () => {
      const { openAfterSales } = await import("./after-sales");
      await openAfterSales(user, order);
    });
  // O pai não passa dos marcos 1 a 4: os seguintes não disparam nada.
  const own = (keys: MilestoneKey[]) =>
    parent ? keys.filter((k) => ROUNDS_PARENT_MILESTONES.includes(k)) : keys;
  const started = own(moved.started);
  const done = own(moved.done);
  if (done.length)
    await guard("aviso aos informados", async () => {
      const { informMilestones } = await import("./milestone-notify");
      await informMilestones(order, done);
    });
  if (started.length || done.length)
    await guard("eventos das regras", async () => {
      const { emitMilestoneEvents, milestoneTransitionEvents } =
        await import("./milestone-events");
      const { getProcessRules } = await import("./process-engine");
      await emitMilestoneEvents(
        order,
        milestoneTransitionEvents(started, done),
        await getProcessRules(),
      );
    });
}

/**
 * Aviso de "liberado" para quem faz os itens do marco que começou (o texto
 * e os destinos de antes, da ativação da etapa): no pedido de compra, as
 * raias da Preparação pelo aviso de cada raia (`notifyLanesOpen`; a arte,
 * produto a produto, quando o Material de arte conclui); o resto, um aviso por
 * papel com os itens obrigatórios dele que já dá para fazer (o envio para
 * assinatura e as assinaturas têm os avisos deles). Uma vez por marco e
 * pedido (auditoria `milestone.released`).
 */
async function notifyReleased(
  order: Order,
  input: MilestoneInput,
  release: MilestoneRelease,
  started: MilestoneKey[],
) {
  const store = getStore();
  const sent = new Set(
    (
      await store.list("audit_log", {
        filter: {
          entity: "order",
          entityId: order.id,
          action: MILESTONE_RELEASED_ACTION,
        },
      })
    ).map((a) => (a.after as { milestone?: string } | null)?.milestone),
  );
  const keys = started.filter((k) => !sent.has(k));
  if (!keys.length) return;
  // Os itens com rótulo e papel (a fonte dos marcos lê só algumas colunas).
  const full = await store.list("requirements", {
    filter: { orderId: order.id, status: ["pending", "rejected"] },
  });
  const stageById = new Map(input.stages.map((st) => [st.id, st]));
  const { requirementWaiting } = await import("./tasks");
  const { audit } = await import("./audit");
  const purchase = isPurchaseFlow(order);
  const sealApplied = input.importSteps.some(
    (x) =>
      x.key === "cert_seal_art" &&
      (x.status === "submitted" || x.status === "validated"),
  );
  for (const key of keys) {
    const items = full.filter((r) => {
      const stage = stageById.get(r.stageId);
      return (
        !!stage &&
        r.required &&
        milestoneOfItem(r, stage) === key &&
        requirementReleased(order, r, release)
      );
    });
    await audit(
      null,
      MILESTONE_RELEASED_ACTION,
      "order",
      order.id,
      `Pedido #${order.number}: marco ${key} liberado`,
      null,
      { milestone: key },
    );
    if (!items.length) continue;
    const lanes = purchase
      ? items.filter((r) => stageById.get(r.stageId)?.key === "PREPARATION")
      : [];
    if (lanes.length) {
      const { notifyArtReleased, notifyLanesOpen } =
        await import("./purchase-order");
      if (key === "art") await notifyArtReleased(order);
      else await notifyLanesOpen(order, lanes);
    }
    const rest = items.filter((r) => {
      if (lanes.includes(r) || isOrderDocumentKey(r.key)) return false;
      const stageOpen = full.filter((x) => x.stageId === r.stageId);
      return !requirementWaiting(
        r,
        { open: stageOpen, all: stageOpen },
        { sealApplied, purchase },
      );
    });
    const byRole = new Map<Requirement["role"], Requirement[]>();
    for (const r of rest)
      byRole.set(r.role, [...(byRole.get(r.role) ?? []), r]);
    for (const [role, list] of byRole) {
      const partyField = ROLE_PARTY_FIELD[role];
      await notify(
        role === "customer"
          ? requesterTarget(order.requestedByUserId)
          : {
              role: role === "operator" ? ["admin", "operator"] : role,
              partyId: partyField ? order[partyField] : null,
            },
        {
          kind: "action",
          link: `/app/orders/${order.id}`,
          text: (t) => ({
            subject: t("notif.stage.subject", {
              n: order.number,
              stage: milestoneTitle(t, key),
            }),
            body: t("notif.stage.body", {
              items: list.map((r) => requirementLabel(t, r)).join(", "),
            }),
          }),
        },
      ).catch((error) => console.error("notify(milestone)", error));
    }
  }
}

/* ------------------------------------------------------------------------ */
/* Fila por requisição                                                        */
/* ------------------------------------------------------------------------ */

const queued = new Set<string>();
let scheduled = false;

/**
 * Pede a sincronização do pedido (gravações fora do motor, cancelamento): uma por
 * pedido por requisição, depois da resposta (`after`). Fora de uma
 * requisição (testes, scripts) o pedido fica na fila até
 * `flushMilestoneSync` (ou a migração). Nunca lança.
 */
export function queueMilestoneSync(orderId: string | null | undefined) {
  if (!orderId) return;
  queued.add(orderId);
  if (scheduled) return;
  scheduled = true;
  try {
    after(() => flushMilestoneSync());
  } catch {
    scheduled = false;
  }
}

/** Sincroniza os pedidos da fila; falha de um pedido só é registrada. */
export async function flushMilestoneSync(): Promise<number> {
  scheduled = false;
  const ids = [...queued];
  queued.clear();
  let done = 0;
  for (const id of ids) {
    try {
      await syncMilestones(id);
      done++;
    } catch (error) {
      console.error("[milestones] sincronização falhou", id, error);
    }
  }
  return done;
}

/** Para testes: os pedidos na fila. */
export const queuedMilestoneSyncs = () => [...queued];

/**
 * Marco em que o pedido está agora (para `cancelMilestoneKey`): calculado na
 * hora; sem cálculo, o gravado ou, sem ele, pela situação. Nunca lança.
 */
export async function milestoneNow(order: Order): Promise<MilestoneKey | null> {
  try {
    const src = await loadSlice([order.id]);
    const fresh = src.orders[0] ?? order;
    return currentMilestone(viewsNow(inputOf(fresh, src)), fresh.status);
  } catch (error) {
    console.error("[milestones] marco do pedido", order.id, error);
    if (
      order.milestoneKey &&
      (MILESTONE_KEYS as readonly string[]).includes(order.milestoneKey)
    )
      return order.milestoneKey as MilestoneKey;
    const { milestoneOfStatus } = await import("@/lib/milestones");
    return milestoneOfStatus(order.status);
  }
}

/* ------------------------------------------------------------------------ */
/* Migração e conferência em fatias                                           */
/* ------------------------------------------------------------------------ */

/** Pedidos por fatia (como a reconstrução dos resumos). */
export const MIGRATION_CHUNK = 500;
/** Rodada parada há mais que isso recomeça do zero. */
const STALE_MS = 12 * 60 * 60 * 1000;
/** Itens por gravação em paralelo. */
const PARALLEL_WRITES = 4;

export const MIGRATION_SETTING_KEY = "milestoneMigration";
export const MIGRATION_DONE_KEY = "milestoneMigrationDone";
export const PARITY_SETTING_KEY = "milestoneParity";
export const PARITY_DONE_KEY = "milestoneParityDone";

export interface MigrationStats {
  /** Itens que ganharam passo e marco. */
  requirements: number;
  /** Linhas de `order_milestones` gravadas. */
  milestones: number;
  /** Pedidos com `milestoneKey` gravado. */
  orders: number;
}

export interface ParityStats {
  /** Pedidos com alguma diferença. */
  differences: number;
  /** Pedidos cujos marcos pelas etapas e pelos itens gravados diferem. */
  views: number;
  /** Itens com passo ou marco gravado diferente do calculado (ou vazio). */
  requirements: number;
  /** Pedidos com `orders.milestoneKey` diferente do marco atual. */
  current: number;
  /** Pedidos com linha de `order_milestones` faltando ou diferente. */
  rows: number;
  /** Números de alguns pedidos com diferença (até 20). */
  sample: number[];
}

interface SliceProgress<S> {
  startedAt: string;
  cursor: string | null;
  processed: number;
  total: number;
  lockUntil: string | null;
  stats: S;
}

export type SliceState<S> =
  | { state: "idle" }
  | {
      state: "running";
      processed: number;
      total: number;
      startedAt: string;
      busy: boolean;
    }
  | { state: "done"; marker: SliceMarker<S> };

export interface SliceMarker<S> {
  doneAt: string;
  startedAt: string;
  orders: number;
  ms: number;
  stats: S;
}

async function readSetting<T>(key: string): Promise<T | null> {
  const [row] = await getStore().list("settings", {
    filter: { key },
    limit: 1,
  });
  return (row?.value as T | undefined) ?? null;
}

async function writeSetting(key: string, value: unknown) {
  const { setRawSetting } = await import("@/lib/settings");
  await setRawSetting(key, value);
}

async function clearSetting(key: string) {
  const store = getStore();
  const [row] = await store.list("settings", { filter: { key }, limit: 1 });
  if (row) await store.remove("settings", row.id);
}

async function orderIdsSorted(): Promise<string[]> {
  const { listColumns } = await import("@/lib/db/lookup");
  const rows = await listColumns(getStore(), "orders", ["id"]);
  return rows.map((r) => r.id).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * Uma rodada de um trabalho em fatias (o mesmo jeito da reconstrução dos
 * resumos, `rebuildOrderSummariesStep`): começa (`start`) ou continua o que
 * está em andamento, faz fatias até `budgetMs` (ao menos uma), guarda o
 * cursor em `settings` e trava contra rodadas simultâneas.
 */
async function runSlices<S>(opts: {
  progressKey: string;
  doneKey: string;
  budgetMs: number;
  start?: boolean;
  chunk?: number;
  empty: () => S;
  slice: (ids: string[], stats: S) => Promise<S>;
}): Promise<SliceState<S>> {
  const chunk = opts.chunk ?? MIGRATION_CHUNK;
  const began = Date.now();
  const deadline = began + opts.budgetMs;
  const running = (p: SliceProgress<S>, busy: boolean): SliceState<S> => ({
    state: "running",
    processed: p.processed,
    total: p.total,
    startedAt: p.startedAt,
    busy,
  });
  let progress = await readSetting<SliceProgress<S>>(opts.progressKey);
  if (!progress?.startedAt) progress = null;
  if (progress && began - Date.parse(progress.startedAt) > STALE_MS)
    progress = null;
  if (progress?.lockUntil && Date.parse(progress.lockUntil) > began)
    return running(progress, true);
  if (!progress && !opts.start) return { state: "idle" };
  const ids = await orderIdsSorted();
  progress ??= {
    startedAt: new Date(began).toISOString(),
    cursor: null,
    processed: 0,
    total: ids.length,
    lockUntil: null,
    stats: opts.empty(),
  };
  const cursor = progress.cursor;
  const pending = cursor ? ids.filter((id) => id > cursor) : ids;
  progress = { ...progress, total: progress.processed + pending.length };
  const lock = () =>
    new Date(
      Math.min(Math.max(deadline, Date.now()), Date.now() + 9 * 60_000) +
        60_000,
    ).toISOString();
  let offset = 0;
  do {
    const part = pending.slice(offset, offset + chunk);
    if (!part.length) break;
    await writeSetting(opts.progressKey, { ...progress, lockUntil: lock() });
    const stats = await opts.slice(part, progress.stats);
    offset += part.length;
    progress = {
      ...progress,
      cursor: part[part.length - 1],
      processed: progress.processed + part.length,
      stats,
    };
  } while (Date.now() < deadline);
  if (offset < pending.length) {
    progress = { ...progress, lockUntil: null };
    await writeSetting(opts.progressKey, progress);
    return running(progress, false);
  }
  const marker: SliceMarker<S> = {
    doneAt: new Date().toISOString(),
    startedAt: progress.startedAt,
    orders: progress.processed,
    ms: Date.now() - Date.parse(progress.startedAt),
    stats: progress.stats,
  };
  await writeSetting(opts.doneKey, marker);
  await clearSetting(opts.progressKey);
  return { state: "done", marker };
}

/** Grava passo e marco nos itens, agrupados pelo valor (poucas idas ao banco). */
async function writeRequirementFields(
  groups: Map<
    string,
    { step: string | null; milestoneKey: string | null; ids: string[] }
  >,
) {
  const store = getStore();
  const jobs = [...groups.values()].map((g) => async () => {
    const patch = { step: g.step, milestoneKey: g.milestoneKey };
    if (store.updateWhere)
      await store.updateWhere("requirements", { id: g.ids }, patch);
    else for (const id of g.ids) await store.update("requirements", id, patch);
  });
  for (let i = 0; i < jobs.length; i += PARALLEL_WRITES)
    await Promise.all(jobs.slice(i, i + PARALLEL_WRITES).map((j) => j()));
}

/**
 * Uma fatia da migração: passo e marco dos itens que ainda não têm (só os
 * vazios), as linhas de `order_milestones` e `orders.milestoneKey`. A marca
 * de espera (`held`) dos pedidos do histórico fica como está (as linhas
 * novas copiam a do pedido). Rodar de novo não muda nada.
 */
export async function migrateMilestonesSlice(
  ids: string[],
  stats: MigrationStats = { requirements: 0, milestones: 0, orders: 0 },
  now: Date = new Date(),
): Promise<MigrationStats> {
  const [src, settings] = await Promise.all([loadSlice(ids), getSettings()]);
  const dueDays = milestoneDueDaysOf(settings);
  const at = now.toISOString();
  const groups = new Map<
    string,
    { step: string | null; milestoneKey: string | null; ids: string[] }
  >();
  const rows: MilestoneRowData[] = [];
  const existingIds = new Set<string>();
  const orderKeys = new Map<string, MilestoneKey | null>();
  let filled = 0;
  for (const order of src.orders) {
    const input = inputOf(order, src);
    const stageById = new Map(input.stages.map((s) => [s.id, s]));
    // Os itens migrados aqui já entram no cálculo dos marcos desta fatia.
    const requirements = input.requirements.map((r) => {
      if (r.step != null || r.milestoneKey != null) return r;
      const stage = stageById.get(r.stageId);
      if (!stage) return r;
      const fields = requirementFlowFields(stage.key, r.key);
      if (!fields.step && !fields.milestoneKey) return r;
      const g = `${fields.step ?? ""}|${fields.milestoneKey ?? ""}`;
      const group = groups.get(g) ?? { ...fields, ids: [] };
      group.ids.push(r.id);
      groups.set(g, group);
      filled++;
      return { ...r, ...fields };
    });
    const existing = src.milestones.get(order.id) ?? [];
    for (const r of existing) existingIds.add(r.id);
    const plan = planMilestoneRows({
      order,
      views: viewsByStage({ ...input, requirements }),
      existing,
      blocked: new Map([
        ...blockedMilestonesFromStages(input.stages, requirements),
        ...blockedMilestones(existing),
      ]),
      dueDays,
      now: at,
    });
    rows.push(...plan.rows);
    if ((order.milestoneKey ?? null) !== plan.milestoneKey)
      orderKeys.set(order.id, plan.milestoneKey);
  }
  await writeRequirementFields(groups);
  await writeMilestoneRows(rows, existingIds);
  await writeOrderMilestoneKeys(orderKeys);
  return {
    requirements: stats.requirements + filled,
    milestones: stats.milestones + rows.length,
    orders: stats.orders + orderKeys.size,
  };
}

/** Uma rodada da migração para os marcos (tela e testes). */
export function migrateMilestonesStep(options: {
  budgetMs: number;
  start?: boolean;
  chunk?: number;
  now?: Date;
}): Promise<SliceState<MigrationStats>> {
  return runSlices<MigrationStats>({
    progressKey: MIGRATION_SETTING_KEY,
    doneKey: MIGRATION_DONE_KEY,
    budgetMs: options.budgetMs,
    start: options.start,
    chunk: options.chunk,
    empty: () => ({ requirements: 0, milestones: 0, orders: 0 }),
    slice: (ids, stats) => migrateMilestonesSlice(ids, stats, options.now),
  });
}

const sameViews = (a: readonly MilestoneView[], b: readonly MilestoneView[]) =>
  a.length === b.length &&
  a.every(
    (v, i) =>
      v.key === b[i].key &&
      v.state === b[i].state &&
      v.done === b[i].done &&
      v.total === b[i].total,
  );

/**
 * Conferência de uma fatia (meta: zero): os marcos pelas etapas contra os
 * marcos pelos campos gravados nos itens, os itens com passo ou marco
 * diferente do calculado, o marco atual gravado no pedido e as linhas de
 * `order_milestones` (marco aberto sem linha "active"/"blocked", concluído
 * sem linha "done"). Só lê.
 */
export async function milestoneParitySlice(
  ids: string[],
  stats: ParityStats = emptyParity(),
): Promise<ParityStats> {
  const src = await loadSlice(ids);
  const out = { ...stats, sample: [...stats.sample] };
  for (const order of src.orders) {
    const input = inputOf(order, src);
    const stageById = new Map(input.stages.map((s) => [s.id, s]));
    const byStage = viewsByStage(input);
    const views = !sameViews(byStage, viewsByStored(input));
    let requirements = 0;
    for (const r of input.requirements) {
      const stage = stageById.get(r.stageId);
      if (!stage) continue;
      const want = requirementFlowFields(stage.key, r.key);
      if (
        (r.step ?? null) !== want.step ||
        (r.milestoneKey ?? null) !== want.milestoneKey
      )
        requirements++;
    }
    const current =
      (order.milestoneKey ?? null) !== currentMilestone(byStage, order.status);
    const saved = new Map(
      (src.milestones.get(order.id) ?? []).map((r) => [r.key, r]),
    );
    const rows =
      order.status !== "CANCELLED" &&
      byStage.some((v) => {
        const row = saved.get(v.key);
        if (v.state === "active")
          return !row || (row.status !== "active" && row.status !== "blocked");
        if (v.state === "done") return !row || row.status !== "done";
        return false;
      });
    if (views) out.views++;
    out.requirements += requirements;
    if (current) out.current++;
    if (rows) out.rows++;
    if (views || requirements || current || rows) {
      out.differences++;
      if (out.sample.length < 20) out.sample.push(order.number);
    }
  }
  return out;
}

const emptyParity = (): ParityStats => ({
  differences: 0,
  views: 0,
  requirements: 0,
  current: 0,
  rows: 0,
  sample: [],
});

/** Uma rodada da conferência (tela e testes). */
export function milestoneParityStep(options: {
  budgetMs: number;
  start?: boolean;
  chunk?: number;
}): Promise<SliceState<ParityStats>> {
  return runSlices<ParityStats>({
    progressKey: PARITY_SETTING_KEY,
    doneKey: PARITY_DONE_KEY,
    budgetMs: options.budgetMs,
    start: options.start,
    chunk: options.chunk,
    empty: emptyParity,
    slice: (ids, stats) => milestoneParitySlice(ids, stats),
  });
}

/** Para a tela: andamento e último resultado da migração e da conferência. */
export async function milestoneMigrationStatus() {
  const [migration, migrated, parity, checked] = await Promise.all([
    readSetting<SliceProgress<MigrationStats>>(MIGRATION_SETTING_KEY),
    readSetting<SliceMarker<MigrationStats>>(MIGRATION_DONE_KEY),
    readSetting<SliceProgress<ParityStats>>(PARITY_SETTING_KEY),
    readSetting<SliceMarker<ParityStats>>(PARITY_DONE_KEY),
  ]);
  return {
    migration: migration?.startedAt ? migration : null,
    migrated: migrated?.doneAt ? migrated : null,
    parity: parity?.startedAt ? parity : null,
    checked: checked?.doneAt ? checked : null,
  };
}
