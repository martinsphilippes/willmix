"use client";

/*
 * Ícone de chat numa linha (Control Tower, Pedidos, Pendências, SLA, itens do
 * pedido): avisa o painel lateral (ChatDrawer) para abrir a conversa daquele
 * pedido, solicitação ou item. Sem JavaScript o ícone não faz nada; as telas
 * continuam com os botões "Conversar" de sempre.
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

export function ChatIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d="M4 5h16v11H9l-5 4V5Z" />
    </svg>
  );
}

export function ChatOpenButton({
  target,
  label,
  className,
}: {
  target: ChatTargetDetail;
  /** Texto acessível (ex.: "Conversar sobre este pedido"). */
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      data-chat-open={
        target.orderItemId
          ? `item:${target.orderItemId}`
          : target.orderId
            ? `order:${target.orderId}`
            : `request:${target.requestId ?? ""}`
      }
      onClick={(event) => {
        event.stopPropagation();
        window.dispatchEvent(
          new CustomEvent<ChatTargetDetail>(CHAT_EVENT, { detail: target }),
        );
      }}
      className={
        className ??
        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-400 transition hover:bg-brand-50 hover:text-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      }
    >
      <ChatIcon />
    </button>
  );
}
