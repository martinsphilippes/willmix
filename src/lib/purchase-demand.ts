import type {
  DemandChannel,
  Request,
  RequestOrigin,
  User,
} from "@/lib/db/schema";

/*
 * Compra por demanda (mapa B10 e B14, dono 15/11/2026; docs/PURCHASE_DEMAND.md).
 * Regras puras: sem banco, sem tela.
 *
 * - A demanda de compra é a própria solicitação (`requests`): a reposição
 *   tem origem `replenishment`; a encomenda do cliente, as outras origens de
 *   pedido (`manual`, `cart`, `sourcing_demand`).
 * - A encomenda guarda a porta de entrada (`channel`): vitrine, cliente,
 *   vendedor ou operador.
 */

/** Origens que são encomenda do cliente (B14). */
export const ORDER_ORIGINS: readonly RequestOrigin[] = [
  "manual",
  "cart",
  "sourcing_demand",
];

export type DemandKind = "order" | "replenishment";

/** Reposição (B10) ou encomenda (B14)? Nulo: não é demanda de compra. */
export function demandKind(
  request: Pick<Request, "origin">,
): DemandKind | null {
  const origin = request.origin ?? "manual";
  if (origin === "replenishment") return "replenishment";
  return ORDER_ORIGINS.includes(origin) ? "order" : null;
}

/**
 * Porta de entrada da encomenda: o carrinho é a vitrine; o cliente pela tela
 * dele; na Wellmix, quem tem a função Vendas é o vendedor e os outros são
 * operadores. Reposição e compra para estoque não têm porta.
 */
export function demandChannel(
  user: Pick<User, "role"> & Partial<Pick<User, "functions">>,
  input: { origin: RequestOrigin; cart?: boolean; stock?: boolean },
): DemandChannel | null {
  if (input.origin === "replenishment" || input.stock) return null;
  if (!ORDER_ORIGINS.includes(input.origin)) return null;
  if (input.cart) return "vitrine";
  if (user.role === "customer") return "cliente";
  if (user.role !== "admin" && user.role !== "operator") return null;
  return (user.functions ?? []).includes("sales") ? "vendedor" : "operador";
}

/** Uma linha do carrinho, com a quantidade pedida. */
export interface CartDemandLine {
  id: string;
  productId: string;
  quantity: number;
}

/**
 * Divide o carrinho da vitrine (mapa V6 → V7 ou B14; dono, 15/11/2026): o
 * item que o estoque livre ou uma compra a caminho atende por inteiro vai
 * para a ordem de venda (pronta entrega); o resto vira encomenda. Itens do
 * mesmo produto consomem o mesmo saldo, na ordem do carrinho. Sem saldo
 * conhecido do produto (o portal ainda não controla o estoque), encomenda.
 */
export function splitCart<T extends CartDemandLine>(
  lines: readonly T[],
  available: ReadonlyMap<string, number>,
): { ready: T[]; order: T[] } {
  const left = new Map(available);
  const ready: T[] = [];
  const order: T[] = [];
  for (const line of lines) {
    const free = left.get(line.productId) ?? 0;
    if (line.quantity > 0 && free >= line.quantity) {
      ready.push(line);
      left.set(line.productId, free - line.quantity);
    } else order.push(line);
  }
  return { ready, order };
}
