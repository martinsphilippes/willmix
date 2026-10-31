/*
 * Alvo de uma conversa aberta a partir de uma linha (pedido, solicitação ou
 * item do pedido) e o evento que o painel lateral escuta. Módulo sem
 * "use client": é usado tanto por Server Components (linhas das tabelas)
 * quanto pelo painel e pelo ícone (client).
 */

export interface ChatTargetDetail {
  orderId?: string | null;
  requestId?: string | null;
  orderItemId?: string | null;
  partyId?: string | null;
}

export const CHAT_EVENT = "wellmix:chat";

/** Pedido ou solicitação a partir do link da linha (/app/orders/x, /app/requests/y). */
export function chatTargetFromHref(href: string): ChatTargetDetail | null {
  const m = /^\/app\/(orders|requests)\/([A-Za-z0-9_-]{1,64})(?:[/?#]|$)/.exec(
    href,
  );
  if (!m) return null;
  return m[1] === "orders" ? { orderId: m[2] } : { requestId: m[2] };
}
