import type { Order, PurchaseRound, RequestSchedule } from "@/lib/db/schema";
import { addDaysIso, scheduleTotal } from "@/lib/workflow/request-schedule";

/*
 * Programação de compra (docs/PURCHASE_SCHEDULE.md): na escolha do grupo a
 * Wellmix diz em quantas rodadas compra, quantas peças em cada uma e o
 * intervalo entre elas. A solicitação ao fornecedor leva a programação; o
 * pedido de compra vira o pedido pai (o total e a negociação) e cada rodada
 * vira um pedido filho no dia combinado. Só a conta, sem banco.
 */

/** Rodadas de compra que a escolha do grupo aceita (a solicitação do cliente fica em 6). */
export const MAX_PURCHASE_ROUNDS = 12;

export interface ScheduleSummary {
  rounds: number;
  /** Peças por rodada, na ordem. */
  perRound: number[];
  /** Todas iguais: o número; diferentes: nulo. */
  sameQuantity: number | null;
  total: number;
  intervalDays: number;
  firstDate: string;
  lastDate: string;
}

/** O que o responsável pelo booking lê: rodadas, peças por rodada e total. */
export function scheduleSummary(
  schedule: RequestSchedule | null | undefined,
): ScheduleSummary | null {
  if (!schedule?.items.length) return null;
  const perRound = schedule.items.map((i) => i.quantity);
  return {
    rounds: perRound.length,
    perRound,
    sameQuantity: perRound.every((q) => q === perRound[0]) ? perRound[0] : null,
    total: scheduleTotal(schedule),
    intervalDays: schedule.intervalDays,
    firstDate: schedule.firstDate,
    lastDate: schedule.items[schedule.items.length - 1].expectedAt,
  };
}

/** Mesmas datas (1ª data, intervalo e número de rodadas). */
export function sameDates(a: RequestSchedule, b: RequestSchedule): boolean {
  return (
    a.firstDate === b.firstDate &&
    a.intervalDays === b.intervalDays &&
    a.items.length === b.items.length
  );
}

export type PurchaseRoundsError =
  "purchase_order_schedule_mixed" | "purchase_order_schedule_qty";

/**
 * Rodadas do pedido pai a partir dos produtos do pedido. Sem programação em
 * nenhum: nulo (pedido de sempre). Com programação, todos precisam ter a
 * mesma (datas iguais); cada rodada leva as peças de cada produto.
 */
export function buildPurchaseRounds(
  lines: Array<{ productId: string; schedule: RequestSchedule | null }>,
): { rounds: PurchaseRound[] | null } | { error: PurchaseRoundsError } {
  const scheduled = lines.filter((l) => l.schedule?.items.length);
  if (!scheduled.length) return { rounds: null };
  if (scheduled.length !== lines.length)
    return { error: "purchase_order_schedule_mixed" };
  const base = scheduled[0].schedule!;
  if (scheduled.some((l) => !sameDates(base, l.schedule!)))
    return { error: "purchase_order_schedule_mixed" };
  const rounds = base.items.map((round, i) => ({
    index: i + 1,
    expectedAt: addDaysIso(base.firstDate, base.intervalDays * i),
    items: scheduled.map((l) => ({
      productId: l.productId,
      quantity: Math.round(l.schedule!.items[i].quantity),
    })),
    orderId: null,
    createdAt: null,
  }));
  if (
    rounds.some((r) =>
      r.items.some((it) => !Number.isFinite(it.quantity) || it.quantity <= 0),
    )
  )
    return { error: "purchase_order_schedule_qty" };
  return { rounds };
}

/** O pedido é pai de uma programação de compra. */
export const isRoundsParent = (order: Pick<Order, "purchaseRounds">): boolean =>
  !!order.purchaseRounds?.length;

/** Rodadas cujo dia chegou (AAAA-MM-DD ≤ hoje) e que ainda não viraram pedido. */
export function dueRounds(
  rounds: PurchaseRound[] | null | undefined,
  today: string,
): PurchaseRound[] {
  return (rounds ?? []).filter((r) => !r.orderId && r.expectedAt <= today);
}

/** Item de raia do pai (`chave__itemDoPai`) com o item do filho do mesmo produto. */
export function mapLaneKey(
  key: string,
  parentItems: Array<{ id: string; productId: string | null }>,
  childItems: Array<{ id: string; productId: string | null }>,
): string | null {
  const at = key.lastIndexOf("__");
  if (at < 0) return key;
  const parentItemId = key.slice(at + 2);
  const parent = parentItems.find((i) => i.id === parentItemId);
  if (!parent?.productId) return null;
  const child = childItems.find((i) => i.productId === parent.productId);
  return child ? `${key.slice(0, at)}__${child.id}` : null;
}
