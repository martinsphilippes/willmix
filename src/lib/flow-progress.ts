import type {
  BookingLot,
  Stage,
  StageKey,
  SupplierRequest,
  SupplierRequestSampling,
} from "@/lib/db/schema";
import type { FlowBlock } from "@/lib/flow";

/*
 * Completude e atraso do pedido por bloco do mapa (dono, 14/11/2026;
 * docs/FLOW_MENU.md, "Visão do pedido entre os blocos"). Cada etapa do pedido
 * cai num bloco (Pedido, Produção, Entrega); o percentual do bloco é a média
 * das etapas dele (concluída 100%, em andamento ou bloqueada o percentual da
 * etapa, ainda não começada 0%) e o geral é a média de todas as etapas. O
 * atraso sai do prazo das etapas: aberta com o prazo vencido (atraso agora) e
 * concluída depois do prazo (atraso que já passou). Regra pura: sem banco.
 */

/** Blocos com etapas do pedido, na ordem do mapa. */
export const PROGRESS_BLOCKS = ["order", "production", "delivery"] as const;
export type ProgressBlock = (typeof PROGRESS_BLOCKS)[number];

export const isProgressBlock = (v: unknown): v is ProgressBlock =>
  typeof v === "string" && (PROGRESS_BLOCKS as readonly string[]).includes(v);

/**
 * Etapa → bloco. O pagamento ao fornecedor saiu do fluxo (OFF_FLOW_STAGES) e
 * não conta.
 */
export const STAGE_BLOCK: Partial<Record<StageKey, ProgressBlock>> = {
  ORDER_CREATED: "order",
  PREPARATION: "order",
  PACKAGING: "order",
  INSPECTION: "production",
  SHIPPING: "production",
  CUSTOMS: "delivery",
  TRANSPORT: "delivery",
  DELIVERED: "delivery",
  CLOSED: "delivery",
};

export type StageProgressState = "done" | "active" | "blocked" | "pending";

export interface StageProgress {
  id: string;
  key: StageKey;
  state: StageProgressState;
  percent: number;
  dueAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  /** Dias de atraso da etapa aberta com o prazo vencido (0: no prazo). */
  lateDays: number;
  /** Dias que a etapa concluída passou do prazo (0: no prazo). */
  doneLateDays: number;
}

export interface BlockProgress {
  block: ProgressBlock;
  percent: number;
  state: "done" | "active" | "pending";
  stages: StageProgress[];
  /** O maior atraso aberto do bloco, em dias. */
  lateDays: number;
  /** Etapas do bloco concluídas com atraso. */
  doneLate: number;
  /** Desde quando o pedido está no bloco (início da primeira etapa dele). */
  startedAt: string | null;
}

export interface OrderProgress {
  blocks: BlockProgress[];
  /** Percentual geral do pedido (média de todas as etapas). */
  overall: number;
  /** Bloco em que o pedido está agora (o da primeira etapa não concluída). */
  current: ProgressBlock | null;
  /** O maior atraso aberto do pedido, em dias. */
  lateDays: number;
}

const DAY = 86_400_000;

const daysBetween = (from: number, to: number) =>
  Math.max(0, Math.floor((to - from) / DAY));

const mean = (xs: number[]) =>
  xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0;

type StageLike = Pick<
  Stage,
  | "id"
  | "key"
  | "sequence"
  | "status"
  | "percent"
  | "dueAt"
  | "startedAt"
  | "completedAt"
>;

function stageProgress(s: StageLike, now: number): StageProgress | null {
  if (s.status === "cancelled") return null;
  const state: StageProgressState =
    s.status === "done"
      ? "done"
      : s.status === "active" || s.status === "blocked"
        ? s.status
        : "pending";
  const percent =
    state === "done"
      ? 100
      : state === "pending"
        ? 0
        : Math.min(99, Math.max(0, Math.round(s.percent ?? 0)));
  const due = s.dueAt ? Date.parse(s.dueAt) : NaN;
  const done = s.completedAt ? Date.parse(s.completedAt) : NaN;
  const open = state === "active" || state === "blocked";
  return {
    id: s.id,
    key: s.key,
    state,
    percent,
    dueAt: s.dueAt ?? null,
    startedAt: s.startedAt ?? null,
    completedAt: s.completedAt ?? null,
    lateDays:
      open && Number.isFinite(due) && due < now ? daysBetween(due, now) : 0,
    doneLateDays:
      state === "done" &&
      Number.isFinite(due) &&
      Number.isFinite(done) &&
      done > due
        ? daysBetween(due, done)
        : 0,
  };
}

/** Completude e atraso do pedido, bloco a bloco, a partir das etapas dele. */
export function orderProgress(
  stages: StageLike[],
  now = new Date(),
): OrderProgress {
  const at = now.getTime();
  const sorted = [...stages].sort((a, b) => a.sequence - b.sequence);
  const all: Array<StageProgress & { block: ProgressBlock }> = [];
  for (const s of sorted) {
    const block = STAGE_BLOCK[s.key];
    if (!block) continue;
    const p = stageProgress(s, at);
    if (p) all.push({ ...p, block });
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
      stages: mine.map((s) => {
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

/*
 * Histórico do Sankhya em espera até o go-live (dono, 14/11/2026;
 * docs/SANKHYA.md): o pedido não tem pendência nem etapa liberada, então
 * entra no Overview só pela situação, num contador e lista à parte.
 */
const HELD_STATUS_STEP: Partial<Record<StageKey, string>> = {
  ORDER_CREATED: "order/orders",
  PREPARATION: "order/orders",
  PACKAGING: "order/art",
  INSPECTION: "production/inspection",
  SHIPPING: "production/shipment",
  CUSTOMS: "delivery/cargo-presence",
  TRANSPORT: "delivery/logistics",
  DELIVERED: "delivery/delivery",
};

/** Passo (`bloco/passo`) do pedido em espera, pela situação; nulo fora dos blocos. */
export const heldStepOf = (status: string): string | null =>
  HELD_STATUS_STEP[status as StageKey] ?? null;
