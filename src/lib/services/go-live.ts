import "server-only";

import { getStore } from "@/lib/db";
import type { Store } from "@/lib/db/store";

/*
 * Go-live do histórico do Sankhya (docs/SANKHYA.md, "Histórico em espera").
 * Até o go-live, as etapas e pendências dos pedidos da carga do histórico
 * ficam com `held` e somem das listas gerais. O botão em Configurações →
 * Go-live tira a marca em partes (poucos milhares de linhas por gravação:
 * em 13/11/2026 uma gravação única de 613 mil linhas encheu o disco do
 * banco) e desliga a marca nas cargas seguintes.
 */

const SETTING_KEY = "sankhya_history_hold";

export interface HistoryHoldState {
  /** Liberado (go-live): a carga não marca mais e a liberação começou. */
  released: boolean;
  releasedAt: string | null;
  releasedBy: string | null;
  /** Liberação terminou (nenhuma linha em espera). */
  doneAt: string | null;
  /** Linhas em espera quando a liberação começou (barra de andamento). */
  total: number;
}

const DEFAULT_STATE: HistoryHoldState = {
  released: false,
  releasedAt: null,
  releasedBy: null,
  doneAt: null,
  total: 0,
};

async function readState(): Promise<HistoryHoldState> {
  const [row] = await getStore().list("settings", {
    filter: { key: SETTING_KEY },
    limit: 1,
  });
  return { ...DEFAULT_STATE, ...((row?.value as object | null) ?? {}) };
}

async function saveState(state: HistoryHoldState) {
  const { setRawSetting } = await import("@/lib/settings");
  await setRawSetting(SETTING_KEY, state);
}

/** A carga do histórico ainda marca os pedidos novos (antes do go-live)? */
export async function historyHoldActive(): Promise<boolean> {
  return !(await readState()).released;
}

const HELD = ["orders", "stages", "requirements"] as const;
type HeldTable = (typeof HELD)[number];

async function heldCount(store: Store) {
  const count = (table: HeldTable) =>
    store.count
      ? store.count(table, { held: true })
      : store.list(table, { filter: { held: true } }).then((r) => r.length);
  const [orders, stages, requirements] = await Promise.all(HELD.map(count));
  return { orders, stages, requirements };
}

const sum = (h: { orders: number; stages: number; requirements: number }) =>
  h.orders + h.stages + h.requirements;

export interface GoLiveStatus extends HistoryHoldState {
  orders: number;
  stages: number;
  requirements: number;
}

/** Para a tela: quantas etapas e pendências ainda estão em espera. */
export async function goLiveStatus(): Promise<GoLiveStatus> {
  const [state, held] = await Promise.all([
    readState(),
    heldCount(getStore()),
  ]);
  return { ...state, ...held };
}

/** Pedidos por gravação: ~38 pendências e ~10 etapas cada. */
const ORDERS_PER_WRITE = 100;
/** Teto de pedidos por rodada (~60 mil linhas), para o banco respirar. */
const ORDERS_PER_STEP = 1500;

/** No formato da barra dos resumos (src/components/summary-rebuild-progress.tsx). */
export type GoLiveStep =
  | {
      state: "running";
      processed: number;
      total: number;
      startedAt: string;
      busy: boolean;
    }
  | { state: "done"; marker: { doneAt: string } };

/**
 * Uma rodada: liga o go-live (se ainda não) e tira a marca de até
 * `ORDERS_PER_STEP` pedidos, dentro de `budgetMs`. A tela chama de novo até
 * terminar; parar no meio não perde nada (a próxima rodada continua).
 */
export async function releaseHistoryStep(opts: {
  budgetMs: number;
  userId: string;
}): Promise<GoLiveStep> {
  const store = getStore();
  const started = Date.now();
  let state = await readState();
  if (!state.released) {
    const held = await heldCount(store);
    state = {
      released: true,
      releasedAt: new Date().toISOString(),
      releasedBy: opts.userId,
      doneAt: null,
      total: sum(held),
    };
    await saveState(state);
  }
  let orders = 0;
  while (orders < ORDERS_PER_STEP && Date.now() - started < opts.budgetMs) {
    // Os pedidos com algo em espera: das pendências e etapas primeiro, o
    // pedido por último (sai das pendências só com tudo liberado).
    let ids: string[] = [];
    for (const table of ["stages", "requirements"] as const) {
      const rows = await store.list(table, {
        filter: { held: true },
        limit: ORDERS_PER_WRITE * 10,
      });
      ids = [...new Set(rows.map((r) => r.orderId))];
      if (ids.length) break;
    }
    if (!ids.length)
      ids = (
        await store.list("orders", {
          filter: { held: true },
          limit: ORDERS_PER_WRITE,
        })
      ).map((o) => o.id);
    ids = ids.slice(0, ORDERS_PER_WRITE);
    if (!ids.length) break;
    for (const table of HELD.slice().reverse()) {
      const filter = table === "orders" ? { id: ids } : { orderId: ids };
      if (store.updateWhere)
        await store.updateWhere(
          table,
          { ...filter, held: true },
          { held: null },
        );
      else
        for (const row of await store.list(table, {
          filter: { ...filter, held: true },
        }))
          await store.update(table, row.id, { held: null });
    }
    orders += ids.length;
  }
  const remaining = sum(await heldCount(store));
  if (remaining > 0) {
    const total = Math.max(state.total, remaining);
    return {
      state: "running",
      processed: total - remaining,
      total,
      startedAt: state.releasedAt ?? new Date().toISOString(),
      busy: false,
    };
  }
  const doneAt = new Date().toISOString();
  await saveState({ ...state, doneAt });
  return { state: "done", marker: { doneAt } };
}
