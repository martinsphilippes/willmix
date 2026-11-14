import "server-only";

import { randomBytes, timingSafeEqual } from "node:crypto";
import { getStore, type User } from "@/lib/db";
import { isAdmin } from "@/lib/auth/permissions";
import { audit } from "@/lib/services/audit";
import type { FullLoadEntity } from "./sankhya-mapping";
import { getFullLoadProgress, runFullLoad } from "./sankhya-full-load";
import { readSetting, writeSetting } from "./sankhya-settings";

/*
 * Carga completa "no servidor" (docs/SANKHYA.md): a pessoa enfileira as
 * entidades e pode fechar o navegador. Um agendador (pg_cron do Supabase, a
 * cada 30 segundos, só enquanto a fila está ativa) chama /api/jobs/sankhya-load,
 * que roda uma rodada de ~30 s da primeira entidade da fila. Terminada a
 * entidade, passa para a próxima; a fila vazia desliga sozinha.
 *
 * A rodada usa a pessoa que ligou a fila (precisa continuar admin e ativa).
 * Cinco erros seguidos param a fila, com o último erro na tela.
 */

const KEY = "sankhya.load.server";
/** Chave que o agendador manda (gerada aqui, guardada no próprio banco). */
export const CRON_TOKEN_KEY = "sankhya.load.cronToken";
const MAX_FAILURES = 5;
const LOCK_MS = 90_000;

/** Ordem da fila: locais antes de produtos e saldos; notas por último. */
export const SERVER_LOAD_ORDER: FullLoadEntity[] = [
  "paymentConditions",
  "stockLocations",
  "partners",
  "products",
  "stockBalances",
  "orders",
  // Fotos por último: só dos produtos que já estão no portal.
  "productImages",
];

export interface ServerLoadState {
  active: boolean;
  queue: FullLoadEntity[];
  userId: string | null;
  startedAt: string | null;
  lastRunAt: string | null;
  finishedAt: string | null;
  lastError: string | null;
  failures: number;
  /** Rodada em andamento até esta hora (evita duas ao mesmo tempo). */
  lockUntil: string | null;
  /** Marca da rodada que tem a trava (duas chamadas juntas: só uma segue). */
  lockToken?: string | null;
}

const EMPTY: ServerLoadState = {
  active: false,
  queue: [],
  userId: null,
  startedAt: null,
  lastRunAt: null,
  finishedAt: null,
  lastError: null,
  failures: 0,
  lockUntil: null,
};

export async function getServerLoad(): Promise<ServerLoadState> {
  return { ...EMPTY, ...((await readSetting<ServerLoadState>(KEY)) ?? {}) };
}

async function save(state: ServerLoadState) {
  await writeSetting(KEY, state);
}

/**
 * Liga a fila com as entidades pedidas (ou todas) que ainda não terminaram,
 * na ordem de SERVER_LOAD_ORDER. Uma entidade já na fila não entra de novo.
 */
export async function startServerLoad(
  user: User,
  entities: FullLoadEntity[] = SERVER_LOAD_ORDER,
): Promise<ServerLoadState> {
  if (!isAdmin(user)) throw new Error("forbidden");
  const state = await getServerLoad();
  const wanted = new Set([...(state.active ? state.queue : []), ...entities]);
  const queue: FullLoadEntity[] = [];
  for (const entity of SERVER_LOAD_ORDER) {
    if (!wanted.has(entity)) continue;
    if ((await getFullLoadProgress(entity)).done) continue;
    queue.push(entity);
  }
  if (!(await readSetting<string>(CRON_TOKEN_KEY)))
    await writeSetting(CRON_TOKEN_KEY, randomBytes(24).toString("hex"));
  const next: ServerLoadState = {
    ...state,
    active: queue.length > 0,
    queue,
    userId: user.id,
    startedAt: state.active ? state.startedAt : new Date().toISOString(),
    finishedAt: null,
    lastError: null,
    failures: 0,
  };
  await save(next);
  await audit(
    user,
    "sankhya.load.server",
    "system",
    "sankhya",
    `Carga do Sankhya no servidor ligada: ${queue.join(", ") || "nada pendente"}`,
  );
  return next;
}

export async function stopServerLoad(user: User): Promise<ServerLoadState> {
  if (!isAdmin(user)) throw new Error("forbidden");
  const state = await getServerLoad();
  const next = { ...state, active: false, lockUntil: null };
  await save(next);
  await audit(
    user,
    "sankhya.load.server.stop",
    "system",
    "sankhya",
    "Carga do Sankhya no servidor parada",
  );
  return next;
}

/** A chave do agendador confere (comparação em tempo constante). */
export async function cronTokenOk(given: string | null): Promise<boolean> {
  const token = await readSetting<string>(CRON_TOKEN_KEY);
  if (!token || !given) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

export type ServerTick =
  | { ran: false; reason: "idle" | "busy" | "no_user" }
  | {
      ran: true;
      entity: FullLoadEntity;
      done: boolean;
      error: string | null;
      queue: FullLoadEntity[];
    };

/** Uma rodada da fila (chamada pelo agendador). */
export async function runServerLoadTick({
  budgetMs = 30_000,
  now = () => Date.now(),
  settleMs = 1_500,
}: {
  budgetMs?: number;
  now?: () => number;
  /** Espera antes de reler a trava (as duas gravações já aconteceram). */
  settleMs?: number;
} = {}): Promise<ServerTick> {
  const state = await getServerLoad();
  if (!state.active || !state.queue.length)
    return { ran: false, reason: "idle" };
  if (state.lockUntil && Date.parse(state.lockUntil) > now())
    return { ran: false, reason: "busy" };

  const user = state.userId
    ? await getStore().get("users", state.userId)
    : null;
  if (!user || !user.active || !isAdmin(user)) {
    await save({
      ...state,
      active: false,
      lockUntil: null,
      lastError: "no_user",
    });
    return { ran: false, reason: "no_user" };
  }

  const entity = state.queue[0];
  // Trava: o agendador às vezes entrega duas chamadas no mesmo instante, e as
  // duas liam a fila livre e rodavam a mesma nota juntas (cadastro criado em
  // dobro). Cada uma grava a própria marca, espera e relê: só segue a que
  // encontrar a sua (a última gravação vence).
  const token = randomBytes(8).toString("hex");
  await save({
    ...state,
    lockUntil: new Date(now() + LOCK_MS).toISOString(),
    lockToken: token,
  });
  if (settleMs > 0) await new Promise((r) => setTimeout(r, settleMs));
  if ((await getServerLoad()).lockToken !== token)
    return { ran: false, reason: "busy" };
  let done = false;
  let error: string | null = null;
  try {
    done = (await runFullLoad(user, entity, budgetMs)).progress.done;
  } catch (e) {
    // Com o texto do Sankhya (a tela mostrava só "sankhya_http").
    const detail =
      e && typeof e === "object" && "detail" in e
        ? ` ${(e as { status?: number }).status ?? ""} ${String((e as { detail: unknown }).detail)}`
        : "";
    error = `${String((e as Error)?.message ?? e)}${detail}`
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 300);
    console.error("[sankhya-load-server]", entity, e);
  }

  // Relê: a pessoa pode ter parado a fila durante a rodada.
  const fresh = await getServerLoad();
  const failures = error ? fresh.failures + 1 : 0;
  const queue = done ? fresh.queue.filter((e) => e !== entity) : fresh.queue;
  const active = fresh.active && queue.length > 0 && failures < MAX_FAILURES;
  await save({
    ...fresh,
    queue,
    active,
    failures,
    lastError: error,
    lastRunAt: new Date(now()).toISOString(),
    finishedAt:
      fresh.active && !queue.length
        ? new Date(now()).toISOString()
        : fresh.finishedAt,
    lockUntil: null,
    lockToken: null,
  });
  return { ran: true, entity, done, error, queue };
}
