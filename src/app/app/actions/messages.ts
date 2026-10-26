"use server";

import { z } from "zod";
import { assertWellmix } from "@/lib/auth/permissions";
import { MESSAGE_MAX_LENGTH } from "@/lib/db/schema";
import { field, requireUser, run, runInPlace, str } from "./helpers";

/*
 * Mensagens (chat interno). Qualquer usuário logado escreve e abre assuntos;
 * o serviço confere a empresa da conversa e se ele vê a solicitação/o pedido
 * do assunto. Começar conversa escolhendo a empresa: só a Wellmix.
 */

const ID = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const optionalId = ID.nullable();
const bodySchema = z.string().trim().min(1).max(MESSAGE_MAX_LENGTH);
const BASE = "/app/messages";

/** Volta para a tela do chat no assunto em que a pessoa estava. */
function threadBack(conversationId: string, topicId: string) {
  const c = ID.safeParse(conversationId);
  const t = ID.safeParse(topicId);
  if (!c.success) return BASE;
  return t.success ? `${BASE}?c=${c.data}&t=${t.data}` : `${BASE}?c=${c.data}`;
}

/** Volta de quem abriu o chat de outra tela (solicitação ou pedido). */
function pageBack(form: FormData) {
  const back = str(form, "back");
  return /^\/app\/(requests|orders)\/[A-Za-z0-9_-]{1,64}$/.test(back)
    ? back
    : BASE;
}

const optional = (form: FormData, key: string) => str(form, key) || null;

/** Envia uma mensagem no assunto; a conversa se atualiza no lugar. */
export async function postMessageAction(form: FormData) {
  const user = await requireUser();
  const back = threadBack(str(form, "conversationId"), str(form, "topicId"));
  await runInPlace(back, async () => {
    const topicId = ID.parse(str(form, "topicId"));
    // Recusado (vazio ou longo demais): a tela aponta o campo da mensagem.
    const body = field(form, "body", bodySchema);
    const { postMessage } = await import("@/lib/services/messages");
    await postMessage(user, topicId, body);
  });
}

/**
 * Marca o assunto aberto como lido. Chamada pela tela de Mensagens quando
 * mostra mensagens novas (a página em si não marca nada ao ser montada), e
 * atualiza o selo do menu e o sino.
 */
export async function markTopicReadAction(conversationId: string, topicId: string) {
  const user = await requireUser();
  await runInPlace(threadBack(conversationId, topicId), async () => {
    const id = ID.parse(topicId);
    const { markTopicRead } = await import("@/lib/services/messages");
    await markTopicRead(user, id);
  });
}

/**
 * "Conversar com a Wellmix" / "Conversar com a empresa" na solicitação ou no
 * pedido: abre (ou cria) o assunto e vai para ele.
 */
export async function openChatAction(form: FormData) {
  const user = await requireUser();
  await run(pageBack(form), async () => {
    const input = {
      partyId: optionalId.parse(optional(form, "partyId")),
      requestId: optionalId.parse(optional(form, "requestId")),
      orderId: optionalId.parse(optional(form, "orderId")),
    };
    const { openTopic } = await import("@/lib/services/messages");
    const opened = await openTopic(user, input);
    return threadBack(opened.conversationId, opened.topicId);
  });
}

/**
 * "Nova conversa" (Wellmix): empresa ("party:<id>") ou login sem empresa
 * ("user:<id>") escolhido na lista.
 */
export async function startConversationAction(form: FormData) {
  const user = await requireUser();
  await run(BASE, async () => {
    assertWellmix(user);
    const target = z
      .string()
      .regex(/^(party|user):[A-Za-z0-9_-]{1,64}$/)
      .parse(str(form, "target"));
    const [kind, id] = target.split(":");
    const { openTopic } = await import("@/lib/services/messages");
    const opened = await openTopic(
      user,
      kind === "party" ? { partyId: id } : { userId: id },
    );
    return threadBack(opened.conversationId, opened.topicId);
  });
}
