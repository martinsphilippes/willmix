import type { StockReservation } from "@/lib/db/schema";

/*
 * Regras puras da reserva de estoque para cliente (sem banco), usadas pela
 * tela Estoque, pela vitrine e pela baixa por venda.
 */

/** Validade padrão de uma reserva nova, em dias. */
export const RESERVATION_DEFAULT_DAYS = 15;
export const RESERVATION_MAX_DAYS = 120;

type Res = Pick<StockReservation, "status" | "expiresAt">;

/** Vencida: ativa, com validade, e o dia da validade já passou. */
export function isReservationExpired(r: Res, today: string): boolean {
  return (
    r.status === "active" && !!r.expiresAt && r.expiresAt.slice(0, 10) < today
  );
}

/** Conta no estoque: ativa e dentro da validade (vence no fim do dia). */
export function isReservationLive(r: Res, today: string): boolean {
  return r.status === "active" && !isReservationExpired(r, today);
}

/** Situação mostrada na tela: ativa, vencida, usada ou cancelada. */
export function reservationState(
  r: Res,
  today: string,
): "active" | "expired" | "used" | "cancelled" {
  if (r.status !== "active") return r.status;
  return isReservationExpired(r, today) ? "expired" : "active";
}

/** Quanto está reservado por produto (só reservas valendo hoje). */
export function reservedByProduct(
  list: (Res & Pick<StockReservation, "productId" | "quantity" | "id">)[],
  today: string,
  exceptId?: string,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of list) {
    if (r.id === exceptId || !isReservationLive(r, today)) continue;
    out.set(r.productId, (out.get(r.productId) ?? 0) + r.quantity);
  }
  return out;
}

/** Livre = no Brasil menos o reservado (nunca negativo). */
export function freeStock(brazil: number, reserved: number): number {
  return Math.max(0, brazil - reserved);
}
