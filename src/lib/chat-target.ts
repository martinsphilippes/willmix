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
  /**
   * Começo da mensagem já escrito no campo (ex.: "Etapa Preparação: "), para
   * quem recebe saber do que se trata. Só enviar o começo não vale.
   */
  draft?: string | null;
  /**
   * Caixa flutuante no canto inferior direito, sem cobrir nem travar a tela
   * (botão "Conversar com a empresa" da solicitação; dono, 14/11/2026). Sem
   * isso, o painel lateral de sempre.
   */
  floating?: boolean;
}

export const CHAT_EVENT = "wellmix:chat";

/**
 * A mesma conversa (pedido, solicitação, item e empresa): com a caixa já
 * aberta nela, o botão só a traz para frente, sem recarregar nem apagar o
 * que foi digitado.
 */
export function sameChatTarget(
  a: ChatTargetDetail | null,
  b: ChatTargetDetail,
): boolean {
  if (!a) return false;
  return (
    (a.orderId ?? null) === (b.orderId ?? null) &&
    (a.requestId ?? null) === (b.requestId ?? null) &&
    (a.orderItemId ?? null) === (b.orderItemId ?? null) &&
    (a.partyId ?? null) === (b.partyId ?? null)
  );
}

/**
 * Quanto da parte de baixo da tela o teclado do celular cobre (px), pela
 * área visível do navegador (`visualViewport`): a caixa flutuante sobe esse
 * tanto e o campo de mensagem continua à vista. Zero sem teclado (diferenças
 * pequenas, como a barra do navegador, não contam).
 */
export function keyboardOverlap(
  innerHeight: number,
  viewport: { height: number; offsetTop: number },
): number {
  const hidden = innerHeight - (viewport.offsetTop + viewport.height);
  return hidden > 80 ? Math.round(hidden) : 0;
}

/** Pedido ou solicitação a partir do link da linha (/app/orders/x, /app/requests/y). */
export function chatTargetFromHref(href: string): ChatTargetDetail | null {
  const m = /^\/app\/(orders|requests)\/([A-Za-z0-9_-]{1,64})(?:[/?#]|$)/.exec(
    href,
  );
  if (!m) return null;
  return m[1] === "orders" ? { orderId: m[2] } : { requestId: m[2] };
}
