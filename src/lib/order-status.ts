/*
 * Situação do pedido (`orders.status`) sem depender das etapas antigas (fase
 * 5c, docs/MILESTONES.md): o pedido está aberto enquanto não foi encerrado
 * nem cancelado. Os valores gravados continuam as chaves das etapas até a
 * fase 5d/5f; o código que só quer saber "está aberto?" usa esta função e não
 * compara com a lista das etapas.
 */

/** Situações que fecham o pedido. */
export const ORDER_FINAL_STATUSES = ["CLOSED", "CANCELLED"] as const;

/** O pedido está em andamento (nem encerrado, nem cancelado)? */
export function isOrderOpen(status: string | null | undefined): boolean {
  return (
    !!status && !(ORDER_FINAL_STATUSES as readonly string[]).includes(status)
  );
}
