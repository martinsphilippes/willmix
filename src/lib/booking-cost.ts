import type { BookingCost, BookingItem } from "@/lib/db/schema";

/*
 * Custo do item do booking pela cotação V2 do Sankhya (dono, 24/11/2026;
 * docs/BOOKING.md, "Custo no Sankhya"). Regras puras, usadas no servidor (o
 * cálculo, src/lib/services/booking-cost.ts) e nas telas (a leitura):
 *
 * - `bookingCostInputs`: o que vai do item para o Sankhya e o que falta;
 * - `costVerdict`: o sinal pela resposta do Sankhya;
 * - `bookingCostOf`: o retrato do Sankhya gravado no item
 *   (`booking_items.sankhyaCost`), ou nulo.
 */

/** Dados do item que o Sankhya precisa (todos obrigatórios para fechar). */
export const BOOKING_COST_INPUTS = [
  "ncm",
  "price",
  "currency",
  "pcsPerCarton",
  "cbm",
  "netWeight",
  "grossWeight",
] as const;
export type BookingCostInput = (typeof BOOKING_COST_INPUTS)[number];

const positive = (n: number | null | undefined): number | null =>
  typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null;

/** Moeda do book → a da função (RMB, USD, EUR); o Real não vai. */
export function sankhyaCurrency(code: string | null | undefined) {
  const c = String(code ?? "")
    .trim()
    .toUpperCase();
  if (c === "CNY") return "RMB";
  return c === "RMB" || c === "USD" || c === "EUR" ? c : null;
}

/** O que vai do item para a cotação V2 e o que falta (sem falta = pode ir). */
export function bookingCostInputs(
  item: Pick<
    BookingItem,
    | "ncm"
    | "price"
    | "currency"
    | "masterCartonQty"
    | "cbmPerCarton"
    | "netWeightPcKg"
    | "grossWeightPcKg"
  >,
): { sent: NonNullable<BookingCost["sent"]>; missing: BookingCostInput[] } {
  const digits = String(item.ncm ?? "").replace(/\D/g, "");
  const sent = {
    ncm: digits.length === 8 ? digits : null,
    price: positive(item.price),
    currency: sankhyaCurrency(item.currency),
    pcsPerCarton: positive(item.masterCartonQty),
    cbmPerCarton: positive(item.cbmPerCarton),
    netWeightPcKg: positive(item.netWeightPcKg),
    grossWeightPcKg: positive(item.grossWeightPcKg),
  };
  const missing: BookingCostInput[] = [];
  if (!sent.ncm) missing.push("ncm");
  if (sent.price === null) missing.push("price");
  if (!sent.currency) missing.push("currency");
  if (sent.pcsPerCarton === null) missing.push("pcsPerCarton");
  if (sent.cbmPerCarton === null) missing.push("cbm");
  if (sent.netWeightPcKg === null) missing.push("netWeight");
  if (sent.grossWeightPcKg === null) missing.push("grossWeight");
  return { sent, missing };
}

/**
 * Sinal pela resposta do Sankhya: META_ATINGIDA = viável; sem ela, o lucro
 * (LUCRO_LIQUIDO_PERC) acima de zero = abaixo da meta, zero ou negativo =
 * prejuízo. Sem a meta informada, o lucro igual ou acima da meta % também é
 * viável. Sem lucro nem meta: nulo (sem sinal).
 */
export function costVerdict(
  goalReached: boolean | null,
  profitPct: number | null,
  goalPct: number | null = null,
): BookingCost["verdict"] {
  if (goalReached === true) return "viable";
  if (profitPct !== null && Number.isFinite(profitPct)) {
    if (
      goalReached === null &&
      goalPct !== null &&
      Number.isFinite(goalPct) &&
      profitPct >= goalPct
    )
      return "viable";
    return profitPct > 0 ? "below" : "loss";
  }
  return goalReached === false ? "below" : null;
}

/** O retrato do Sankhya gravado no item; sem ele (ou fora do formato), nulo. */
export function bookingCostOf(
  item: { sankhyaCost?: unknown } | null | undefined,
): BookingCost | null {
  const a = item?.sankhyaCost as Partial<BookingCost> | null | undefined;
  return a && typeof a === "object" && a.source === "sankhya"
    ? (a as BookingCost)
    : null;
}

/** Custo por peça do Sankhya (R$), o número para comparar; nulo sem ele. */
export function bookingCostValue(
  item: { sankhyaCost?: unknown } | null | undefined,
): number | null {
  const cost = bookingCostOf(item)?.costBrl;
  return typeof cost === "number" && Number.isFinite(cost) ? cost : null;
}

/**
 * Item na fila do Sankhya: sem retrato, ou com um anterior ao último pedido
 * de cálculo do book (`booking_lots.sankhyaCostAt`).
 */
export function bookingCostPending(
  item: { sankhyaCost?: unknown },
  since: string | null | undefined = null,
): boolean {
  const cost = bookingCostOf(item);
  return !cost || (!!since && cost.at < since);
}

/** Quanto a conta do book segue depois da resposta (dentro do limite da função). */
export const BOOKING_COST_BACKGROUND_MS = 240_000;

/**
 * O cálculo do book pode estar rodando agora: pedido há menos que o tempo da
 * rodada em segundo plano (com um minuto de folga).
 */
export function bookingCostRunning(
  sankhyaCostAt: string | null | undefined,
  now = Date.now(),
): boolean {
  if (!sankhyaCostAt) return false;
  const at = Date.parse(sankhyaCostAt);
  return Number.isFinite(at) && now - at < BOOKING_COST_BACKGROUND_MS + 60_000;
}

/** Contagem do book: com custo, com falta de dado, com erro e na fila. */
export function bookingCostCounts(
  items: readonly { sankhyaCost?: unknown }[],
  since: string | null | undefined,
): { costed: number; missing: number; failed: number; pending: number } {
  const out = { costed: 0, missing: 0, failed: 0, pending: 0 };
  for (const item of items) {
    const cost = bookingCostOf(item);
    if (bookingCostPending(item, since)) out.pending++;
    else if (cost?.error) out.failed++;
    else if (cost?.missing.length) out.missing++;
    else out.costed++;
  }
  return out;
}
