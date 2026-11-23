import "server-only";
import { getStore } from "@/lib/db";
import { listByIds } from "@/lib/db/lookup";
import type { User } from "@/lib/db/schema";
import { canOpenTopic } from "./messages";

/*
 * Prévia da conversa de uma solicitação (dono, 23/11/2026): as últimas
 * mensagens dos assuntos da solicitação que o login pode abrir, para a tela
 * do produto no pedido mostrar a conversa à vista. Só leitura: não cria
 * assunto nem marca como lido; escrever continua pela caixa do chat.
 */

export interface ChatPreviewMessage {
  id: string;
  author: string;
  /** Escrita por quem está vendo. */
  mine: boolean;
  body: string;
  attachment: boolean;
  at: string;
}

export interface ChatPreview {
  /** Mensagens em todos os assuntos visíveis da solicitação. */
  total: number;
  /** As últimas, da mais antiga para a mais nova. */
  messages: ChatPreviewMessage[];
}

export async function requestChatPreview(
  user: User,
  requestId: string,
  limit = 5,
): Promise<ChatPreview> {
  const store = getStore();
  const topics = await store
    .list("conversation_topics", { filter: { requestId } })
    .catch(() => []);
  const visible: string[] = [];
  for (const topic of topics)
    if (await canOpenTopic(user, topic.id)) visible.push(topic.id);
  if (!visible.length) return { total: 0, messages: [] };
  const messages = (
    await store.list("messages", { filter: { topicId: visible } })
  ).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const last = messages.slice(-limit);
  const authors = await listByIds(store, "users", [
    ...new Set(last.map((m) => m.authorUserId)),
  ]);
  return {
    total: messages.length,
    messages: last.map((m) => ({
      id: m.id,
      author: authors.find((u) => u.id === m.authorUserId)?.name ?? "—",
      mine: m.authorUserId === user.id,
      body: m.body,
      attachment: !!m.attachmentDocumentId,
      at: m.createdAt,
    })),
  };
}
