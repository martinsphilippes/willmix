import type {
  BookingLot,
  SupplierRequest,
  SupplierRequestSampling,
} from "@/lib/db/schema";
import type { FlowBlock } from "@/lib/flow";
import {
  MILESTONES,
  type MilestoneKey,
  type MilestoneState,
} from "@/lib/milestones";

/*
 * Completude e atraso do pedido por bloco do mapa (dono, 14/11/2026;
 * docs/FLOW_MENU.md, "Visão do pedido entre os blocos"). Fase 5g: pelos 16
 * marcos (não mais pelas etapas). Cada marco cai no bloco dele (Pedido,
 * Produção, Entrega); o percentual do bloco é a média dos marcos que se
 * aplicam ao pedido (concluído 100%, em andamento ou travado o andamento das
 * subtarefas, ainda não começado 0%) e o geral é a média de todos. O atraso
 * sai do prazo gravado dos marcos (`order_milestones.dueAt`): aberto com o
 * prazo vencido (atraso agora) e concluído depois do prazo (atraso que já
 * passou). Regra pura: sem banco.
 */

/** Blocos com marcos do pedido, na ordem do mapa. */
export const PROGRESS_BLOCKS = ["order", "production", "delivery"] as const;
export type ProgressBlock = (typeof PROGRESS_BLOCKS)[number];

export const isProgressBlock = (v: unknown): v is ProgressBlock =>
  typeof v === "string" && (PROGRESS_BLOCKS as readonly string[]).includes(v);

export type StageProgressState = "done" | "active" | "blocked" | "pending";

export interface MilestoneProgress {
  id: string;
  key: MilestoneKey;
  state: StageProgressState;
  percent: number;
  dueAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  /** Dias de atraso do marco aberto com o prazo vencido (0: no prazo). */
  lateDays: number;
  /** Dias que o marco concluído passou do prazo (0: no prazo). */
  doneLateDays: number;
}

export interface BlockProgress {
  block: ProgressBlock;
  percent: number;
  state: "done" | "active" | "pending";
  milestones: MilestoneProgress[];
  /** O maior atraso aberto do bloco, em dias. */
  lateDays: number;
  /** Marcos do bloco concluídos com atraso. */
  doneLate: number;
  /** Desde quando o pedido está no bloco (início do primeiro marco dele). */
  startedAt: string | null;
}

export interface OrderProgress {
  blocks: BlockProgress[];
  /** Percentual geral do pedido (média de todos os marcos que se aplicam). */
  overall: number;
  /** Bloco em que o pedido está agora (o do primeiro marco não concluído). */
  current: ProgressBlock | null;
  /** O maior atraso aberto do pedido, em dias. */
  lateDays: number;
}

/** Situação de um marco (formato curto do resumo, `facts.m`). */
export interface MilestoneProgressView {
  k: MilestoneKey;
  s: MilestoneState;
  d: number;
  t: number;
  b?: 1;
}

/** Linha gravada de um marco (`order_milestones`): datas e situação. */
export interface MilestoneProgressRow {
  key: string;
  status?: string | null;
  dueAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
}

const DAY = 86_400_000;

const daysBetween = (from: number, to: number) =>
  Math.max(0, Math.floor((to - from) / DAY));

const mean = (xs: number[]) =>
  xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0;

/**
 * Completude e atraso do pedido, bloco a bloco, pelos marcos: a situação de
 * cada um (`views`, o formato curto do resumo) e as datas gravadas (`rows`).
 * Sem a situação, a linha gravada decide (sem linha: não começou). O marco
 * que não se aplica ao pedido fica fora.
 */
export function orderProgress(
  views: readonly MilestoneProgressView[] | null | undefined,
  rows: readonly MilestoneProgressRow[] | null | undefined,
  now = new Date(),
): OrderProgress {
  const at = now.getTime();
  const viewOf = new Map((views ?? []).map((v) => [v.k, v]));
  const rowOf = new Map((rows ?? []).map((r) => [r.key, r]));
  const all: Array<MilestoneProgress & { block: ProgressBlock }> = [];
  for (const def of MILESTONES) {
    const block = def.block as ProgressBlock;
    if (!(PROGRESS_BLOCKS as readonly string[]).includes(block)) continue;
    const view = viewOf.get(def.key);
    const row = rowOf.get(def.key);
    if (view?.s === "na") continue;
    if (!view && !row && views?.length) continue;
    const state: StageProgressState =
      view?.s === "done" || (!view && row?.status === "done")
        ? "done"
        : view?.b === 1 || row?.status === "blocked"
          ? "blocked"
          : view?.s === "active" || (!view && row?.status === "active")
            ? "active"
            : "pending";
    const percent =
      state === "done"
        ? 100
        : state === "pending"
          ? 0
          : Math.min(
              99,
              Math.max(0, view?.t ? Math.round((view.d / view.t) * 100) : 0),
            );
    const dueAt = row?.dueAt ?? null;
    const completedAt = row?.completedAt ?? null;
    const due = dueAt ? Date.parse(dueAt) : NaN;
    const done = completedAt ? Date.parse(completedAt) : NaN;
    const open = state === "active" || state === "blocked";
    all.push({
      id: def.key,
      key: def.key,
      block,
      state,
      percent,
      dueAt,
      startedAt: row?.startedAt ?? null,
      completedAt,
      lateDays:
        open && Number.isFinite(due) && due < at ? daysBetween(due, at) : 0,
      doneLateDays:
        state === "done" &&
        Number.isFinite(due) &&
        Number.isFinite(done) &&
        done > due
          ? daysBetween(due, done)
          : 0,
    });
  }
  const blocks = PROGRESS_BLOCKS.map((block): BlockProgress => {
    const mine = all.filter((s) => s.block === block);
    const percent = mine.length ? mean(mine.map((s) => s.percent)) : 0;
    const started = mine
      .map((s) => s.startedAt)
      .filter((d): d is string => !!d)
      .sort();
    return {
      block,
      percent,
      state:
        mine.length && mine.every((s) => s.state === "done")
          ? "done"
          : mine.some((s) => s.state !== "pending")
            ? "active"
            : "pending",
      milestones: mine.map((s) => {
        const { block: _omit, ...rest } = s;
        void _omit;
        return rest;
      }),
      lateDays: Math.max(0, ...mine.map((s) => s.lateDays)),
      doneLate: mine.filter((s) => s.doneLateDays > 0).length,
      startedAt: started[0] ?? null,
    };
  });
  const firstOpen = all.find((s) => s.state !== "done");
  return {
    blocks,
    overall: mean(all.map((s) => s.percent)),
    current: firstOpen?.block ?? (all.length ? "delivery" : null),
    lateDays: Math.max(0, ...all.map((s) => s.lateDays)),
  };
}

export const blockOf = (
  progress: OrderProgress,
  block: FlowBlock,
): BlockProgress | null =>
  progress.blocks.find((b) => b.block === block) ?? null;

/*
 * Produto novo (dono, 14/11/2026): as entidades do bloco são os books
 * (planilhas do fornecedor) e as solicitações ao fornecedor. Cada uma anda
 * pelos passos do bloco (Books → Seleção de itens → Cotações → Negociações)
 * e tem a completude pela situação em que está. Regra pura: sem banco.
 */

/** Situação do book → passo em que ele está (nulo: fora do bloco). */
export function bookStep(
  status: BookingLot["status"],
): "books" | "selection" | null {
  if (status === "preparing" || status === "draft") return "books";
  if (status === "closed" || status === "in_progress") return "selection";
  return null;
}

/** Completude do book pela situação (em preenchimento → concluído). */
export const BOOK_PERCENT: Record<BookingLot["status"], number | null> = {
  preparing: 10,
  draft: 25,
  closed: 50,
  in_progress: 75,
  done: 100,
  cancelled: null,
};

type RequestLike = Pick<SupplierRequest, "status" | "createdAt"> & {
  sampling?: Pick<SupplierRequestSampling, "status"> | null;
};

/**
 * Completude da solicitação ao fornecedor: aberta 25%, respondida 50%,
 * aprovada 70% (com a amostra enviada 85%) e a amostra aprovada 100%.
 * Recusada ou cancelada fica fora (nulo).
 */
export function requestPercent(r: RequestLike): number | null {
  if (r.status === "open") return 25;
  if (r.status === "answered") return 50;
  if (r.status !== "approved") return null;
  const sampling = r.sampling?.status ?? "pending";
  if (sampling === "approved") return 100;
  if (sampling === "submitted") return 85;
  return 70;
}

/** A solicitação está em Negociações: em andamento, ou aprovada com a amostra ainda não aprovada. */
export const requestInNegotiation = (r: RequestLike) => {
  const p = requestPercent(r);
  return p !== null && p < 100;
};

/**
 * Dias de atraso pelo prazo (arredondado para cima: o SLA da negociação é
 * em minutos, e passou do prazo já conta 1 dia). 0: no prazo ou sem prazo.
 */
export function lateDaysSince(
  dueAt: string | number | null,
  now = new Date(),
): number {
  const due =
    typeof dueAt === "number" ? dueAt : dueAt ? Date.parse(dueAt) : NaN;
  if (!Number.isFinite(due) || due >= now.getTime()) return 0;
  return Math.max(1, Math.ceil((now.getTime() - due) / DAY));
}

/**
 * Completude geral da entidade do Produto novo: sem pedido, a do Produto
 * novo; com pedido, o Produto novo vale como um bloco a mais ao lado dos três
 * do pedido (média geral dos pedidos que nasceram dela).
 */
export const overallOf = (
  percent: number,
  orders: number,
  orderOverall: number,
) => (orders ? Math.round((percent + orderOverall * 3) / 4) : percent);
