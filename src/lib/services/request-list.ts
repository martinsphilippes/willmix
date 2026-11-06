import "server-only";

import type { Payment, Request } from "@/lib/db";
import type { RequestDisplayStatus } from "./order-status";

/*
 * Lista de solicitações da Wellmix (tela Solicitações): situação resumida
 * para os filtros (em aberto, aguardando sinal, viraram pedido, atrasadas),
 * busca e o sinal recebido de cada solicitação. Funções puras: a tela e o
 * CSV usam as mesmas regras.
 */

export const REQUEST_SITUATIONS = [
  "all",
  "open",
  "waiting",
  "ordered",
  "late",
] as const;
export type RequestSituation = (typeof REQUEST_SITUATIONS)[number];

const OPEN: readonly string[] = [
  "REQUESTED",
  "RFQ_OPEN",
  "QUOTATION_RECEIVED",
  "SUPPLIER_SELECTED",
];

/** Dia de hoje (AAAA-MM-DD) em Brasília. */
export function todayBrazil(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** A solicitação está na situação do filtro? */
export function inSituation(
  r: Pick<Request, "status" | "deadline">,
  display: RequestDisplayStatus,
  situation: RequestSituation,
  today: string,
): boolean {
  switch (situation) {
    case "all":
      return true;
    case "open":
      return OPEN.includes(r.status);
    case "waiting":
      return r.status === "WAITING_DOWN_PAYMENT";
    case "ordered":
      return display === "ORDERED";
    case "late":
      // Ainda sem pedido e com o prazo de resposta vencido.
      return (
        (OPEN.includes(r.status) || r.status === "WAITING_DOWN_PAYMENT") &&
        !!r.deadline &&
        r.deadline.slice(0, 10) < today
      );
  }
}

const norm = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Busca por número, produto, descrição ou cliente (sem acento). */
export function matchesRequest(
  r: Pick<Request, "number" | "productName" | "description">,
  customerName: string,
  q: string,
): boolean {
  const term = norm(q).trim().replace(/^#/, "");
  if (!term) return true;
  return [String(r.number ?? ""), r.productName, r.description, customerName]
    .map(norm)
    .some((v) => v.includes(term));
}

/** Sinal recebido (confirmado ou recebido) por solicitação. */
export function receivedByRequest(payments: Payment[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const p of payments) {
    if (p.direction !== "customer_in" || !p.requestId) continue;
    if (p.status !== "confirmed" && p.status !== "received") continue;
    out.set(
      p.requestId,
      Math.round(((out.get(p.requestId) ?? 0) + p.amount) * 100) / 100,
    );
  }
  return out;
}

export type DownStatus = "paid" | "partial" | "pending" | "none";

/** Situação do sinal: sem sinal definido, pago, parcial ou pendente. */
export function downStatus(
  r: Pick<Request, "downPaymentAmount">,
  received: number,
): DownStatus {
  const due = r.downPaymentAmount ?? 0;
  if (!(due > 0)) return received > 0 ? "paid" : "none";
  if (received >= due - 0.005) return "paid";
  return received > 0 ? "partial" : "pending";
}
