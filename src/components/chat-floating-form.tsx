"use client";

import type { ReactNode } from "react";
import { openChatAction } from "@/app/app/actions/messages";
import { CHAT_EVENT, type ChatTargetDetail } from "@/lib/chat-target";
import { SubmitButton } from "./submit-button";

/*
 * Botão de conversa que abre a caixa flutuante do chat (ChatDrawer com
 * `floating`) na própria tela: a conversa da empresa sobre a solicitação ou
 * o pedido, sem mudar o endereço nem a rolagem (dono, 14/11/2026). O
 * formulário é o de sempre: sem JavaScript (ou antes de a tela carregar), o
 * envio abre a conversa na página Mensagens, como antes.
 */
export function ChatFloatingForm({
  back,
  requestId,
  orderId,
  partyId,
  title,
  children,
}: {
  back: string;
  requestId?: string;
  orderId?: string;
  partyId?: string | null;
  title?: string;
  children: ReactNode;
}) {
  return (
    <form
      action={openChatAction}
      onSubmit={(event) => {
        event.preventDefault();
        window.dispatchEvent(
          new CustomEvent<ChatTargetDetail>(CHAT_EVENT, {
            detail: {
              requestId: requestId ?? null,
              orderId: orderId ?? null,
              partyId: partyId ?? null,
              floating: true,
            },
          }),
        );
      }}
    >
      <input type="hidden" name="back" value={back} />
      {requestId ? (
        <input type="hidden" name="requestId" value={requestId} />
      ) : null}
      {orderId ? <input type="hidden" name="orderId" value={orderId} /> : null}
      {partyId ? <input type="hidden" name="partyId" value={partyId} /> : null}
      <SubmitButton
        variant="secondary"
        title={title}
        data-chat-target={partyId ?? "own"}
        data-chat-floating-open
      >
        {children}
      </SubmitButton>
    </form>
  );
}
