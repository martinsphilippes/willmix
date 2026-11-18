import type { SupplierRequest } from "@/lib/db/schema";
import { samplingApproved } from "@/lib/supplier-request-sampling";

/*
 * Solicitação encerrada e "Gerar pedido" (dono, 18/11/2026;
 * docs/SUPPLIER_REQUESTS.md, "Abas e gerar pedido"): regras puras, sem banco.
 * Uma solicitação é a linha da lista (os produtos abertos juntos para o
 * fornecedor).
 */

type Row = Pick<
  SupplierRequest,
  | "id"
  | "status"
  | "productId"
  | "orderId"
  | "decidedAt"
  | "updatedAt"
  | "sampling"
>;

const FINAL = new Set(["approved", "declined", "cancelled"]);

/** Encerrada: todos os produtos decididos (aprovado, recusado ou cancelado). */
export const requestClosed = (products: Pick<Row, "status">[]) =>
  products.length > 0 && products.every((p) => FINAL.has(p.status));

export type RequestOrderState =
  /** Nenhum produto aprovado: não vira pedido. */
  | { kind: "none" }
  /** Todos os aprovados já estão em pedido. */
  | { kind: "ordered" }
  /** Aprovado sem produto cadastrado (ou associado). */
  | { kind: "missingProduct"; missing: number }
  /** Produto cadastrado, mas a amostra ainda não foi aprovada. */
  | { kind: "waitingSample"; waiting: number }
  /** Pronta: os aprovados fora de pedido, todos com produto e amostra. */
  | { kind: "ready"; requestIds: string[] };

/**
 * Se a solicitação encerrada vira pedido: só quando todos os produtos
 * aprovados (fora de pedido) existem no cadastro e têm a amostra aprovada.
 */
export function requestOrderState(products: Row[]): RequestOrderState {
  const approved = products.filter((p) => p.status === "approved");
  if (!approved.length) return { kind: "none" };
  const free = approved.filter((p) => !p.orderId);
  if (!free.length) return { kind: "ordered" };
  const missing = free.filter((p) => !p.productId).length;
  if (missing) return { kind: "missingProduct", missing };
  const waiting = free.filter((p) => !samplingApproved(p)).length;
  if (waiting) return { kind: "waitingSample", waiting };
  return { kind: "ready", requestIds: free.map((p) => p.id) };
}
