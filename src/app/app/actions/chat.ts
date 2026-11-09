"use server";

import { z } from "zod";
import { ForbiddenError, isWellmix } from "@/lib/auth/permissions";
import { MESSAGE_MAX_LENGTH } from "@/lib/db/schema";
import { getT } from "@/i18n/server";
import { withTranslationText } from "@/lib/message-translation";
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

/**
 * As mensagens do assunto (e os outros assuntos da conversa), cada uma com a
 * tradução para o idioma da tela de quem lê.
 */
export async function chatThreadAction(topicId: unknown) {
  const user = await requireUser();
  return guard(async () => {
    const id = ID.parse(topicId);
    const t = await getT();
    const { topicThread, translateShown } =
      await import("@/lib/services/messages");
    // Mensagem antiga sem tradução: traduz agora (vem na próxima atualização).
    const view = translateShown(
      await topicThread(user, id, { locale: t.locale }),
    );
    return {
      ...view,
      messages: withTranslationText(t, view.messages, isWellmix(user)),
    };
  });
}

/** "Traduzir" / "Tentar de novo" numa mensagem (o serviço confere o acesso). */
export async function chatTranslateAction(messageId: unknown) {
  const user = await requireUser();
  return guard(async () => {
    const id = ID.parse(messageId);
    const { translateMessageFor } = await import("@/lib/services/messages");
    await translateMessageFor(user, id);
  });
}

/**
 * Envia uma mensagem de texto no assunto; com `replyToMessageId`, é a
 * resposta a uma mensagem marcada (do mesmo assunto, conferido no serviço).
 */
export async function chatSendAction(
  topicId: unknown,
  body: unknown,
  replyToMessageId?: unknown,
) {
  const user = await requireUser();
  return guard(async () => {
    const id = ID.parse(topicId);
    const text = z.string().trim().min(1).max(MESSAGE_MAX_LENGTH).parse(body);
    const replyTo = optionalId.parse(replyToMessageId ?? null);
    const { postMessage } = await import("@/lib/services/messages");
    await postMessage(user, id, text, null, {
      replyToMessageId: replyTo ?? null,
    });
  });
}

/** Id do arquivo que o navegador subiu direto ao armazenamento. */
const uploadedId = z.string().regex(/^[A-Za-z0-9_.-]{1,64}$/);

/**
 * Envia um arquivo (foto, PDF, planilha, vídeo…) no assunto, com o texto
 * digitado e a mensagem marcada para responder (opcionais), pelo painel
 * lateral ou pela tela de Mensagens. Uma
 * mensagem por arquivo, como no WhatsApp. Até ~3,5 MB o arquivo vem no
 * formulário; maior, o navegador já o subiu direto ao armazenamento e manda
 * só o id. O serviço confere o acesso ao assunto antes de gravar qualquer
 * coisa, e o tipo e o tamanho do arquivo.
 */
export async function chatSendFileAction(form: FormData) {
  const user = await requireUser();
  return guard(async () => {
    const id = ID.parse(form.get("topicId"));
    const text = z
      .string()
      .trim()
      .max(MESSAGE_MAX_LENGTH)
      .parse(form.get("body") ?? "");
    const file = form.get("file");
    const uploaded = form.get("uploadedFileId");
    if (file instanceof File && file.size === 0) throw new Error("empty");
    const attachment =
      file instanceof File
        ? file
        : typeof uploaded === "string" && uploaded
          ? { fileKey: uploadedId.parse(uploaded) }
          : null;
    if (!attachment) throw new Error("upload_missing");
    const replyTo = form.get("replyToMessageId");
    const { postMessage } = await import("@/lib/services/messages");
    const message = await postMessage(user, id, text, attachment, {
      replyToMessageId:
        typeof replyTo === "string" && replyTo ? ID.parse(replyTo) : null,
    });
    return { id: message.id };
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
