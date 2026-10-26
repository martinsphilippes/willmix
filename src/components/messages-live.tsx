"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";
import { markTopicReadAction } from "@/app/app/actions/messages";

/*
 * Tela de Mensagens "ao vivo" sem websocket: atualiza a conversa a cada 20 s
 * enquanto a aba está visível (e logo ao voltar para ela). O texto que a
 * pessoa está digitando fica: a atualização não remonta o formulário.
 */

const REFRESH_MS = 20_000;

export function MessagesAutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = window.setInterval(tick, REFRESH_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router]);
  return null;
}

/**
 * Assunto aberto com mensagens não lidas: marca como lido (Server Action) uma
 * vez por mensagem nova; o selo do menu e o sino se atualizam em seguida.
 */
export function MarkTopicRead({
  conversationId,
  topicId,
  lastMessageId,
}: {
  conversationId: string;
  topicId: string;
  lastMessageId: string;
}) {
  const [, startTransition] = useTransition();
  const done = useRef<string | null>(null);
  useEffect(() => {
    const key = `${topicId}:${lastMessageId}`;
    if (done.current === key) return;
    done.current = key;
    startTransition(() => markTopicReadAction(conversationId, topicId));
  }, [conversationId, topicId, lastMessageId]);
  return null;
}
