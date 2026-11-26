import type {
  DemandChannel,
  PurchaseDecision,
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

/**
 * Quem aparece no que o portal faz sozinho (dono, 22/11/2026): a encomenda
 * que entra na Estratégia e a cotação que sai na confirmação do cliente
 * ficam com "system" no lugar de um login (`strategySentByUserId`,
 * `chosenByUserId`, `openedByUserId`, `createdByUserId` do envio).
 */
export const AUTO_ACTOR_ID = "system";

/**
 * Item de book na cotação de compra (dono, 26/11/2026): sem produto do
 * cadastro, a chave do item é a da demanda, com este prefixo.
 */
export const BOOK_KEY_PREFIX = "bk-";

/** A chave da cotação: o produto ou, no item de book, a da demanda. */
export function quoteItemKey(
  demand: Pick<Request, "id" | "productId"> & {
    bookingSource?: Request["bookingSource"];
  },
): string | null {
  if (demand.productId) return demand.productId;
  return demand.bookingSource ? `${BOOK_KEY_PREFIX}${demand.id}` : null;
}

/** A chave é de um item de book (não há produto para procurar)? */
export const isBookKey = (key: string | null | undefined) =>
  !!key && key.startsWith(BOOK_KEY_PREFIX);

/** Demanda de um item de book (sem produto, vinda da Seleção de itens). */
export const isBookDemand = (
  demand: Pick<Request, "productId"> & {
    bookingSource?: Request["bookingSource"];
  },
) => !demand.productId && !!demand.bookingSource;

/**
 * Fotos do item de book na cotação de compra (sem produto do cadastro): a
 * foto do item no book e a arte de exemplo do SKU, no formato da galeria.
 */
export function bookPhotoList(
  book:
    | {
        snapshot: { photoDocumentId: string | null };
        variant: { artDocumentId: string | null } | null;
      }
    | null
    | undefined,
): { documentId: string; kind: null }[] {
  if (!book) return [];
  return [book.snapshot.photoDocumentId, book.variant?.artDocumentId ?? null]
    .filter((id): id is string => !!id)
    .filter((id, i, all) => all.indexOf(id) === i)
    .map((documentId) => ({ documentId, kind: null }));
}

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

/** Por que a encomenda saiu do caminho da estratégia de compra. */
export type ClosedDemandReason = "cancelled" | "ordered" | "missing";

/**
 * A encomenda não segue mais na estratégia (dono, 18/11/2026)? Cancelada
 * (excluída em Encomendas), já em outro pedido ou não encontrada. Com uma
 * assim, a estratégia não é aprovada nem gera o pedido; fica gravada como
 * está (recusar continua valendo).
 */
export function closedDemandReason(
  decision: Pick<PurchaseDecision, "orderId">,
  demand: Pick<Request, "status" | "orderId"> | null | undefined,
): ClosedDemandReason | null {
  if (!demand) return "missing";
  if (demand.status === "CANCELLED") return "cancelled";
  if (demand.orderId && demand.orderId !== decision.orderId) return "ordered";
  return null;
}

/** As encomendas da estratégia que não seguem mais (pelo id), com o motivo. */
export function closedDemands(
  decision: Pick<PurchaseDecision, "orderId" | "demandIds">,
  demands: readonly Pick<Request, "id" | "status" | "orderId">[],
): Map<string, ClosedDemandReason> {
  const out = new Map<string, ClosedDemandReason>();
  for (const id of decision.demandIds) {
    const reason = closedDemandReason(
      decision,
      demands.find((d) => d.id === id),
    );
    if (reason) out.set(id, reason);
  }
  return out;
}
