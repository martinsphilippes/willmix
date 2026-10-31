"use server";

import { z } from "zod";
import { ForbiddenError } from "@/lib/auth/permissions";
import { MESSAGE_MAX_LENGTH } from "@/lib/db/schema";
import { errorCode, requireUser } from "./helpers";

/*
 * Painel lateral de chat (abre de qualquer linha: Control Tower, Pedidos,
 * Pendências, SLA, itens do pedido). Server Actions que devolvem dados em vez
 * de redirecionar: a tela que as chama continua onde está. Quem pode ver e
 * escrever é conferido no serviço (empresa da conversa, solicitação/pedido
 * visível); aqui só a validação dos parâmetros.
 */

const ID = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const optionalId = ID.nullable().optional();

export type ChatResult<T> =
  { ok: true; data: T } | { ok: false; error: string };

async function guard<T>(fn: () => Promise<T>): Promise<ChatResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    if (error instanceof ForbiddenError)
      return { ok: false, error: "forbidden" };
    return { ok: false, error: errorCode("chat", error) };
  }
}

const contextSchema = z.object({
  orderId: optionalId,
  requestId: optionalId,
});

/** Com quem dá para conversar e os itens do pedido. */
export async function chatContextAction(input: unknown) {
  const user = await requireUser();
  return guard(async () => {
    const parsed = contextSchema.parse(input);
    const { chatContext } = await import("@/lib/services/messages");
    return chatContext(user, parsed);
  });
}

const openSchema = z.object({
  orderId: optionalId,
  requestId: optionalId,
  orderItemId: optionalId,
  partyId: optionalId,
});

/** Abre (ou acha) o assunto: pedido inteiro, item do pedido ou solicitação. */
export async function chatOpenAction(input: unknown) {
  const user = await requireUser();
  return guard(async () => {
    const parsed = openSchema.parse(input);
    const { openTopic } = await import("@/lib/services/messages");
    return openTopic(user, parsed);
  });
}

/** As mensagens do assunto (e os outros assuntos da conversa). */
export async function chatThreadAction(topicId: unknown) {
  const user = await requireUser();
  return guard(async () => {
    const id = ID.parse(topicId);
    const { topicThread } = await import("@/lib/services/messages");
    return topicThread(user, id);
  });
}

/** Envia uma mensagem de texto no assunto. */
export async function chatSendAction(topicId: unknown, body: unknown) {
  const user = await requireUser();
  return guard(async () => {
    const id = ID.parse(topicId);
    const text = z.string().trim().min(1).max(MESSAGE_MAX_LENGTH).parse(body);
    const { postMessage } = await import("@/lib/services/messages");
    await postMessage(user, id, text);
  });
}

/** Marca o assunto como lido (a tela mostrou mensagens novas). */
export async function chatReadAction(topicId: unknown) {
  const user = await requireUser();
  return guard(async () => {
    const id = ID.parse(topicId);
    const { markTopicRead } = await import("@/lib/services/messages");
    await markTopicRead(user, id);
  });
}
