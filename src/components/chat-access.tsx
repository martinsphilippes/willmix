"use client";

/*
 * O perfil do login tem a tela Mensagens? Sem ela (Gestão de telas), os
 * ícones de conversa das linhas somem: o painel lateral nem é montado e as
 * ações do chat recusam. O padrão é ter (telas fora do portal, testes).
 */

import { createContext, useContext, type ReactNode } from "react";

const ChatAccessContext = createContext(true);

export function ChatAccess({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  return <ChatAccessContext value={enabled}>{children}</ChatAccessContext>;
}

export const useChatAccess = () => useContext(ChatAccessContext);
