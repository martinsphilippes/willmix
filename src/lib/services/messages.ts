import "server-only";

import {
  getStore,
  MESSAGE_MAX_LENGTH,
  type Conversation,
  type ConversationTopic,
  type Message,
  type MessageSide,
  type Order,
  type Party,
  type PartyType,
  type Request,
  type Role,
  type TopicKind,
  type User,
} from "@/lib/db";
import {
  ForbiddenError,
  WELLMIX_ROLES,
  canViewOrder,
  canViewQuote,
  canViewRequest,
  isWellmix,
} from "@/lib/auth/permissions";
import type { Translate } from "@/i18n";
import { isSchemaMissing } from "./packaging-brief";
import { notify } from "./notifications";

/*
 * Mensagens: chat interno da Wellmix com as empresas parceiras (cliente,
 * fornecedor, agência, despachante, companhia marítima, transportador e
 * jurídico). Uma conversa por EMPRESA (`partyId`): todos os logins dela veem
 * e respondem a mesma; login sem empresa tem uma conversa só dele (`userId`).
 * A Wellmix (admin e operadores) vê todas; quem é de fora, só a da própria
 * empresa (isolamento conferido aqui, não na tela).
 *
 * Cada conversa tem assuntos: "Geral" e, quando preciso, um por solicitação
 * ou pedido de que a empresa participa. Quem é de fora só abre (e escreve
 * em) assuntos de solicitações e pedidos que ele mesmo pode ver.
 *
 * Aviso de mensagem nova só no sino do portal (sem e-mail nem WhatsApp) e no
 * máximo um aviso não lido por assunto e destinatário, até ele ler.
 *
 * Banco sem as tabelas novas (esquema não publicado): as leituras voltam
 * vazias em vez de derrubar a tela.
 */

export class MessageError extends Error {}

export { MESSAGE_MAX_LENGTH };

/** Lado de quem escreve. */
export const sideOf = (user: Pick<User, "role">): MessageSide =>
  isWellmix(user) ? "wellmix" : "external";

/** Instante de uma data gravada (o Appwrite devolve "+00:00", a memória "Z"). */
const time = (value: string | null | undefined) => {
  const n = value ? Date.parse(value) : NaN;
  return Number.isNaN(n) ? 0 : n;
};

/** Leitura que volta `fallback` se a tabela/coluna ainda não existe no banco. */
async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (isSchemaMissing(error)) return fallback;
    throw error;
  }
}

/** Link do assunto (aviso no sino e volta das ações). */
export const topicHref = (conversationId: string, topicId: string) =>
  `/app/messages?c=${encodeURIComponent(conversationId)}&t=${encodeURIComponent(topicId)}`;

/** Nome do assunto no idioma de quem lê. */
export function topicLabel(
  t: Translate,
  topic: Pick<ConversationTopic, "kind" | "title">,
): string {
  if (topic.kind === "request")
    return t("messages.topic.request", { ref: topic.title ?? "" });
  if (topic.kind === "order")
    return t("messages.topic.order", { ref: topic.title ?? "" });
  return t("messages.topic.general");
}

/** Prévia de uma mensagem numa linha. */
const previewOf = (body: string, size = 200) =>
  body.replace(/\s+/g, " ").trim().slice(0, size);

/* ---------------------------------------------------------------------- */
/* Acesso                                                                  */
/* ---------------------------------------------------------------------- */

/** O login é da empresa da conversa (ou é o dono da conversa sem empresa)? */
function isMember(user: User, conversation: Conversation): boolean {
  if (isWellmix(user)) return false;
  if (user.partyId) return conversation.partyId === user.partyId;
  return !conversation.partyId && conversation.userId === user.id;
}

const canAccessConversation = (user: User, conversation: Conversation) =>
  isWellmix(user) || isMember(user, conversation);

/**
 * Quem pode ver a solicitação: as regras de sempre (cliente: o login
 * solicitante) e o fornecedor por meio da própria cotação.
 */
async function canSeeRequest(user: User, request: Request): Promise<boolean> {
  if (canViewRequest(user, request)) return true;
  if (user.role !== "supplier" || !user.partyId) return false;
  const quotes = await getStore().list("quotes", {
    filter: { requestId: request.id, supplierId: user.partyId },
    limit: 1,
  });
  return quotes.some((q) => canViewQuote(user, q));
}

/** Empresas do pedido (cliente, fornecedor e parceiros designados). */
function orderParties(order: Order): string[] {
  return [
    order.customerId,
    order.supplierId,
    order.agencyId,
    order.brokerId,
    order.shippingLineId,
    order.carrierId,
  ].filter((id): id is string => !!id);
}

/** Dono de uma conversa sem empresa (login avulso). */
async function conversationOwner(conversation: Conversation) {
  if (conversation.partyId || !conversation.userId) return null;
  return getStore().get("users", conversation.userId);
}

/** A empresa da conversa participa da solicitação (cliente ou cotou)? */
async function companyInRequest(
  conversation: Conversation,
  request: Request,
): Promise<boolean> {
  if (conversation.partyId) {
    if (request.customerId === conversation.partyId) return true;
    const quotes = await getStore().list("quotes", {
      filter: { requestId: request.id, supplierId: conversation.partyId },
      limit: 1,
    });
    return quotes.length > 0;
  }
  const owner = await conversationOwner(conversation);
  return !!owner && (await canSeeRequest(owner, request));
}

/** A empresa da conversa participa do pedido? */
async function companyInOrder(
  conversation: Conversation,
  order: Order,
): Promise<boolean> {
  if (conversation.partyId)
    return orderParties(order).includes(conversation.partyId);
  const owner = await conversationOwner(conversation);
  return !!owner && canViewOrder(owner, order);
}

/**
 * O login vê o assunto? Wellmix e "Geral": sim. Solicitação e pedido: só se
 * ele mesmo vê a solicitação/o pedido (pertencer à conversa é conferido à parte).
 */
async function canSeeTopic(
  user: User,
  topic: ConversationTopic,
): Promise<boolean> {
  if (isWellmix(user) || topic.kind === "general") return true;
  const store = getStore();
  if (topic.kind === "request" && topic.requestId) {
    const request = await store.get("requests", topic.requestId);
    return !!request && (await canSeeRequest(user, request));
  }
  if (topic.kind === "order" && topic.orderId) {
    const order = await store.get("orders", topic.orderId);
    return !!order && canViewOrder(user, order);
  }
  return false;
}

/** Conversa e assunto que o login pode abrir; senão ForbiddenError. */
async function loadTopicFor(user: User, topicId: string) {
  const store = getStore();
  const topic = await store.get("conversation_topics", topicId);
  if (!topic) throw new MessageError("not_found");
  const conversation = await store.get("conversations", topic.conversationId);
  if (!conversation) throw new MessageError("not_found");
  if (
    !canAccessConversation(user, conversation) ||
    !(await canSeeTopic(user, topic))
  )
    throw new ForbiddenError();
  return { topic, conversation };
}

/* ---------------------------------------------------------------------- */
/* Conversas e assuntos (encontrar ou criar)                               */
/* ---------------------------------------------------------------------- */

/** Conversa da empresa (ou do login sem empresa), sem criar. */
async function findConversation(key: {
  partyId: string | null;
  userId: string | null;
}): Promise<Conversation | null> {
  const filter = key.partyId
    ? { partyId: key.partyId }
    : { userId: key.userId, partyId: null };
  if (!key.partyId && !key.userId) return null;
  // Duas criadas ao mesmo tempo: vale sempre a mais antiga.
  const [found] = await getStore().list("conversations", {
    filter,
    orderBy: "createdAt",
    limit: 1,
  });
  return found ?? null;
}

/** Conversa da empresa (ou do login sem empresa), criada na primeira vez. */
async function conversationFor(key: {
  partyId: string | null;
  userId: string | null;
}): Promise<Conversation> {
  const found = await findConversation(key);
  if (found) return found;
  return getStore().create("conversations", {
    partyId: key.partyId,
    userId: key.partyId ? null : key.userId,
    lastMessageAt: null,
    lastMessagePreview: null,
    status: "open",
  });
}

/** Chave da conversa de quem é de fora: a empresa ou, sem ela, o próprio login. */
const ownKey = (user: User) => ({
  partyId: user.partyId,
  userId: user.partyId ? null : user.id,
});

async function findTopic(
  conversationId: string,
  kind: TopicKind,
  ref: { requestId?: string; orderId?: string } = {},
): Promise<ConversationTopic | null> {
  const [found] = await getStore().list("conversation_topics", {
    filter: { conversationId, kind, ...ref },
    orderBy: "createdAt",
    limit: 1,
  });
  return found ?? null;
}

/** Assunto "Geral" da conversa, criado na primeira vez. */
async function generalTopic(
  conversation: Conversation,
): Promise<ConversationTopic> {
  const found = await findTopic(conversation.id, "general");
  if (found) return found;
  return getStore().create("conversation_topics", {
    conversationId: conversation.id,
    kind: "general",
    requestId: null,
    orderId: null,
    title: null,
    lastMessageAt: null,
  });
}

/** Referência da solicitação no assunto: "#12 · Jarra de vidro". */
const requestRef = (request: Request) =>
  [request.number ? `#${request.number}` : null, request.productName]
    .filter(Boolean)
    .join(" · ")
    .slice(0, 160);

async function orderRef(order: Order) {
  const [item] = await getStore().list("order_items", {
    filter: { orderId: order.id },
    limit: 1,
  });
  return [`#${order.number}`, item?.name].filter(Boolean).join(" · ").slice(0, 160);
}

/* ---------------------------------------------------------------------- */
/* Não lidas                                                               */
/* ---------------------------------------------------------------------- */

/**
 * Mensagens não lidas por assunto: as de outras pessoas depois da última
 * leitura do login. Só busca mensagens dos assuntos com novidade (última
 * mensagem depois da leitura).
 */
async function unreadByTopic(
  user: User,
  topics: ConversationTopic[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  const active = topics.filter((t) => t.lastMessageAt);
  if (!active.length) return result;
  const store = getStore();
  const reads = await store.list("message_reads", {
    filter: { userId: user.id, topicId: active.map((t) => t.id) },
  });
  const readAt = new Map<string, number>();
  for (const r of reads)
    readAt.set(r.topicId, Math.max(readAt.get(r.topicId) ?? 0, time(r.lastReadAt)));
  const stale = active.filter(
    (t) => time(t.lastMessageAt) > (readAt.get(t.id) ?? 0),
  );
  if (!stale.length) return result;
  const messages = await store.list("messages", {
    filter: { topicId: stale.map((t) => t.id) },
  });
  for (const m of messages) {
    if (m.authorUserId === user.id) continue;
    if (time(m.createdAt) <= (readAt.get(m.topicId) ?? 0)) continue;
    result.set(m.topicId, (result.get(m.topicId) ?? 0) + 1);
  }
  return result;
}

/* ---------------------------------------------------------------------- */
/* Leitura                                                                 */
/* ---------------------------------------------------------------------- */

export interface ConversationSummary {
  id: string;
  partyId: string | null;
  userId: string | null;
  /** Nome da empresa (ou do login sem empresa). */
  name: string;
  /** Tipo da empresa (ou papel do login sem empresa). */
  type: PartyType | Role | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unread: number;
}

/** Nome e tipo da empresa de cada conversa. */
async function companiesOf(conversations: Conversation[]) {
  const store = getStore();
  const partyIds = [
    ...new Set(conversations.map((c) => c.partyId).filter(Boolean)),
  ] as string[];
  const userIds = [
    ...new Set(
      conversations.filter((c) => !c.partyId).map((c) => c.userId),
    ),
  ].filter(Boolean) as string[];
  const [parties, users] = await Promise.all([
    partyIds.length
      ? store.list("parties", { filter: { id: partyIds } })
      : Promise.resolve([] as Party[]),
    userIds.length
      ? store.list("users", { filter: { id: userIds } })
      : Promise.resolve([] as User[]),
  ]);
  return (c: Conversation): { name: string; type: PartyType | Role | null } => {
    if (c.partyId) {
      const party = parties.find((p) => p.id === c.partyId);
      return { name: party?.name ?? "—", type: party?.type ?? null };
    }
    const owner = users.find((u) => u.id === c.userId);
    return { name: owner?.name ?? "—", type: owner?.role ?? null };
  };
}

const byRecent = (a: ConversationSummary, b: ConversationSummary) =>
  time(b.lastMessageAt) - time(a.lastMessageAt);

/** Assuntos da conversa que o login vê. */
async function visibleTopics(user: User, topics: ConversationTopic[]) {
  const seen = await Promise.all(topics.map((t) => canSeeTopic(user, t)));
  return topics.filter((_, i) => seen[i]);
}

/**
 * Conversas do login. Wellmix: todas, a mais recente primeiro. Quem é de
 * fora: só a da própria empresa, criada na primeira vez.
 */
export async function listConversationsFor(
  user: User,
): Promise<ConversationSummary[]> {
  return safe(async () => {
    const store = getStore();
    const wellmix = isWellmix(user);
    const conversations = wellmix
      ? await store.list("conversations")
      : [await conversationFor(ownKey(user))];
    if (!conversations.length) return [];
    const allTopics = await store.list("conversation_topics", {
      filter: { conversationId: conversations.map((c) => c.id) },
    });
    const topics = wellmix ? allTopics : await visibleTopics(user, allTopics);
    const unread = await unreadByTopic(user, topics);
    const company = await companiesOf(conversations);
    return conversations
      .map((c) => ({
        id: c.id,
        partyId: c.partyId,
        userId: c.userId,
        ...company(c),
        lastMessageAt: c.lastMessageAt,
        lastMessagePreview: c.lastMessagePreview,
        unread: topics
          .filter((t) => t.conversationId === c.id)
          .reduce((sum, t) => sum + (unread.get(t.id) ?? 0), 0),
      }))
      .sort(byRecent);
  }, []);
}

export interface TopicSummary {
  id: string;
  kind: TopicKind;
  requestId: string | null;
  orderId: string | null;
  title: string | null;
  lastMessageAt: string | null;
  unread: number;
}

export interface MessageView {
  id: string;
  body: string;
  createdAt: string;
  authorName: string;
  authorSide: MessageSide;
  mine: boolean;
}

export interface ConversationView {
  conversation: ConversationSummary;
  topics: TopicSummary[];
  topic: TopicSummary;
  messages: MessageView[];
}

/** Últimas mensagens mostradas no assunto. */
const THREAD_LIMIT = 200;

/**
 * Conversa aberta: assuntos que o login vê (Geral primeiro, depois os mais
 * recentes) com as não lidas, e as mensagens do assunto escolhido (padrão:
 * Geral). Conversa de outra empresa ou assunto que o login não vê:
 * ForbiddenError. Não marca como lido (ver markTopicRead).
 */
export async function getConversationView(
  user: User,
  conversationId: string,
  topicId?: string | null,
): Promise<ConversationView | null> {
  const store = getStore();
  const conversation = await safe(
    () => store.get("conversations", conversationId),
    null,
  );
  if (!conversation) return null;
  if (!canAccessConversation(user, conversation)) throw new ForbiddenError();
  const general = await generalTopic(conversation);
  const all = await store.list("conversation_topics", {
    filter: { conversationId: conversation.id },
  });
  if (!all.some((t) => t.id === general.id)) all.push(general);
  const topics = await visibleTopics(user, all);
  if (topicId && !topics.some((t) => t.id === topicId))
    throw new ForbiddenError();
  const selected = topics.find((t) => t.id === (topicId || general.id))!;
  const unread = await unreadByTopic(user, topics);
  const summary = (t: ConversationTopic): TopicSummary => ({
    id: t.id,
    kind: t.kind,
    requestId: t.requestId,
    orderId: t.orderId,
    title: t.title,
    lastMessageAt: t.lastMessageAt,
    unread: unread.get(t.id) ?? 0,
  });
  const ordered = [...topics].sort(
    (a, b) =>
      (a.kind === "general" ? 0 : 1) - (b.kind === "general" ? 0 : 1) ||
      time(b.lastMessageAt) - time(a.lastMessageAt),
  );
  const rows = (
    await store.list("messages", {
      filter: { topicId: selected.id },
      orderBy: "createdAt",
      direction: "desc",
      limit: THREAD_LIMIT,
    })
  ).reverse();
  const authorIds = [...new Set(rows.map((m) => m.authorUserId))];
  const authors = authorIds.length
    ? await store.list("users", { filter: { id: authorIds } })
    : [];
  const company = await companiesOf([conversation]);
  return {
    conversation: {
      id: conversation.id,
      partyId: conversation.partyId,
      userId: conversation.userId,
      ...company(conversation),
      lastMessageAt: conversation.lastMessageAt,
      lastMessagePreview: conversation.lastMessagePreview,
      unread: [...unread.values()].reduce((a, b) => a + b, 0),
    },
    topics: ordered.map(summary),
    topic: summary(selected),
    messages: rows.map((m: Message) => ({
      id: m.id,
      body: m.body,
      createdAt: m.createdAt,
      authorName: authors.find((u) => u.id === m.authorUserId)?.name ?? "—",
      authorSide: m.authorSide,
      mine: m.authorUserId === user.id,
    })),
  };
}

/**
 * Conversa padrão de quem é de fora (a da empresa), para abrir a tela sem
 * escolher. Wellmix: null (escolhe na lista).
 */
export async function ownConversationId(user: User): Promise<string | null> {
  if (isWellmix(user)) return null;
  const [own] = await listConversationsFor(user);
  return own?.id ?? null;
}

/**
 * Total de mensagens não lidas do login (selo do menu "Mensagens"). Não
 * cria nada: quem ainda não tem conversa tem zero.
 */
export async function unreadCountFor(user: User): Promise<number> {
  return safe(async () => {
    const store = getStore();
    let topics: ConversationTopic[];
    if (isWellmix(user)) {
      topics = await store.list("conversation_topics");
    } else {
      const own = await findConversation(ownKey(user));
      if (!own) return 0;
      topics = await store.list("conversation_topics", {
        filter: { conversationId: own.id },
      });
    }
    const unread = await unreadByTopic(user, topics);
    if (!unread.size) return 0;
    // Quem é de fora: só conta assuntos que ele vê (só os com novidade são conferidos).
    let total = 0;
    for (const topic of topics) {
      const n = unread.get(topic.id);
      if (n && (await canSeeTopic(user, topic))) total += n;
    }
    return total;
  }, 0);
}

/** Empresas e logins sem empresa com quem a Wellmix pode abrir conversa. */
export async function chatDirectory(user: User): Promise<{
  parties: Party[];
  users: User[];
}> {
  if (!isWellmix(user)) throw new ForbiddenError();
  const store = getStore();
  const [parties, users] = await Promise.all([
    store.list("parties", { filter: { active: true }, orderBy: "name" }),
    store.list("users", { filter: { active: true }, orderBy: "name" }),
  ]);
  return {
    parties,
    users: users.filter((u) => !u.partyId && !isWellmix(u)),
  };
}

/* ---------------------------------------------------------------------- */
/* Escrita                                                                 */
/* ---------------------------------------------------------------------- */

export interface OpenTopicInput {
  conversationId?: string | null;
  /** Wellmix: empresa com quem conversar. */
  partyId?: string | null;
  /** Wellmix: login sem empresa com quem conversar. */
  userId?: string | null;
  requestId?: string | null;
  orderId?: string | null;
}

/** Conversa em que o login abre o assunto. */
async function resolveConversation(
  user: User,
  input: OpenTopicInput,
  fallbackPartyId: string | null,
): Promise<Conversation> {
  const store = getStore();
  if (!isWellmix(user)) {
    // Quem é de fora só fala na conversa da própria empresa.
    const own = await conversationFor(ownKey(user));
    if (input.conversationId && input.conversationId !== own.id)
      throw new ForbiddenError();
    if (input.partyId && input.partyId !== user.partyId)
      throw new ForbiddenError();
    if (input.userId && input.userId !== user.id) throw new ForbiddenError();
    return own;
  }
  if (input.conversationId) {
    const found = await store.get("conversations", input.conversationId);
    if (!found) throw new MessageError("not_found");
    return found;
  }
  if (input.userId) {
    const target = await store.get("users", input.userId);
    if (!target || isWellmix(target)) throw new MessageError("not_found");
    return conversationFor(ownKey(target));
  }
  const partyId = input.partyId || fallbackPartyId;
  if (!partyId) throw new MessageError("no_company");
  const party = await store.get("parties", partyId);
  if (!party) throw new MessageError("not_found");
  return conversationFor({ partyId: party.id, userId: null });
}

/**
 * Abre (encontra ou cria) a conversa e o assunto: Geral, de uma solicitação
 * ou de um pedido. Assunto de solicitação/pedido só com a empresa
 * participante; quem é de fora, ainda, só se ele mesmo vê a
 * solicitação/o pedido.
 */
export async function openTopic(
  user: User,
  input: OpenTopicInput,
): Promise<{ conversationId: string; topicId: string }> {
  const store = getStore();
  const wellmix = isWellmix(user);
  if (input.requestId) {
    const request = await store.get("requests", input.requestId);
    if (!request) throw new MessageError("not_found");
    if (!wellmix && !(await canSeeRequest(user, request)))
      throw new ForbiddenError();
    const conversation = await resolveConversation(
      user,
      input,
      request.customerId,
    );
    if (!(await companyInRequest(conversation, request)))
      throw new MessageError("not_participant");
    const topic =
      (await findTopic(conversation.id, "request", {
        requestId: request.id,
      })) ??
      (await store.create("conversation_topics", {
        conversationId: conversation.id,
        kind: "request",
        requestId: request.id,
        orderId: null,
        title: requestRef(request),
        lastMessageAt: null,
      }));
    await generalTopic(conversation);
    return { conversationId: conversation.id, topicId: topic.id };
  }
  if (input.orderId) {
    const order = await store.get("orders", input.orderId);
    if (!order) throw new MessageError("not_found");
    if (!wellmix && !canViewOrder(user, order)) throw new ForbiddenError();
    const conversation = await resolveConversation(
      user,
      input,
      order.customerId,
    );
    if (!(await companyInOrder(conversation, order)))
      throw new MessageError("not_participant");
    const topic =
      (await findTopic(conversation.id, "order", { orderId: order.id })) ??
      (await store.create("conversation_topics", {
        conversationId: conversation.id,
        kind: "order",
        requestId: null,
        orderId: order.id,
        title: await orderRef(order),
        lastMessageAt: null,
      }));
    await generalTopic(conversation);
    return { conversationId: conversation.id, topicId: topic.id };
  }
  const conversation = await resolveConversation(user, input, null);
  const topic = await generalTopic(conversation);
  return { conversationId: conversation.id, topicId: topic.id };
}

/** Texto da mensagem: sem espaços nas pontas, de 1 a 4.000 caracteres. */
export function messageBody(body: string): string {
  const text = body.trim();
  if (!text) throw new MessageError("message_empty");
  if (text.length > MESSAGE_MAX_LENGTH)
    throw new MessageError("message_too_long");
  return text;
}

/**
 * Escreve no assunto: grava a mensagem, atualiza a última mensagem da
 * conversa e do assunto, marca como lido para quem escreveu e avisa o outro
 * lado (Wellmix escreveu: os logins da empresa que veem o assunto; a empresa
 * escreveu: a equipe Wellmix).
 */
export async function postMessage(
  user: User,
  topicId: string,
  body: string,
): Promise<Message> {
  const text = messageBody(body);
  const store = getStore();
  const { topic, conversation } = await loadTopicFor(user, topicId);
  const message = await store.create("messages", {
    conversationId: conversation.id,
    topicId: topic.id,
    authorUserId: user.id,
    authorSide: sideOf(user),
    body: text,
    attachmentDocumentId: null,
  });
  await Promise.all([
    store.update("conversation_topics", topic.id, {
      lastMessageAt: message.createdAt,
    }),
    store.update("conversations", conversation.id, {
      lastMessageAt: message.createdAt,
      lastMessagePreview: previewOf(text),
    }),
  ]);
  await saveRead(user.id, topic.id);
  await notifyOtherSide(user, conversation, topic, text);
  return message;
}

/** Grava até onde o login leu o assunto (uma linha por login e assunto). */
async function saveRead(userId: string, topicId: string) {
  const store = getStore();
  const lastReadAt = new Date().toISOString();
  const [row] = await store.list("message_reads", {
    filter: { topicId, userId },
    limit: 1,
  });
  if (row) await store.update("message_reads", row.id, { lastReadAt });
  else await store.create("message_reads", { topicId, userId, lastReadAt });
}

/**
 * Marca o assunto como lido para o login e os avisos do sino que levam a
 * ele também. Assunto que ele não vê: ForbiddenError.
 */
export async function markTopicRead(user: User, topicId: string) {
  const store = getStore();
  const { topic, conversation } = await loadTopicFor(user, topicId);
  await saveRead(user.id, topic.id);
  const notices = await store.list("notifications", {
    filter: {
      userId: user.id,
      channel: "inapp",
      link: topicHref(conversation.id, topic.id),
      readAt: null,
    },
  });
  const now = new Date().toISOString();
  for (const n of notices)
    await store.update("notifications", n.id, { readAt: now });
}

/** Avisa no sino quem está do outro lado; quem já tem aviso não lido do assunto, não. */
async function notifyOtherSide(
  author: User,
  conversation: Conversation,
  topic: ConversationTopic,
  text: string,
) {
  const store = getStore();
  const fromWellmix = isWellmix(author);
  let recipients: User[];
  if (fromWellmix) {
    const logins = conversation.partyId
      ? await store.list("users", {
          filter: { partyId: conversation.partyId, active: true },
        })
      : (await conversationOwner(conversation).then((u) => (u ? [u] : []))).filter(
          (u) => u.active,
        );
    const external = logins.filter((u) => !isWellmix(u));
    const sees = await Promise.all(external.map((u) => canSeeTopic(u, topic)));
    recipients = external.filter((_, i) => sees[i]);
  } else {
    recipients = await store.list("users", {
      filter: { role: WELLMIX_ROLES, active: true },
    });
  }
  recipients = recipients.filter((u) => u.id !== author.id);
  if (!recipients.length) return;
  const link = topicHref(conversation.id, topic.id);
  const pending = await store.list("notifications", {
    filter: {
      userId: recipients.map((u) => u.id),
      channel: "inapp",
      link,
      readAt: null,
    },
  });
  const already = new Set(pending.map((n) => n.userId));
  const fresh = recipients.filter((u) => !already.has(u.id));
  if (!fresh.length) return;
  const company = fromWellmix
    ? null
    : (await companiesOf([conversation]))(conversation).name;
  await notify(
    { userIds: fresh.map((u) => u.id) },
    {
      link,
      kind: "info",
      actor: null,
      inAppOnly: true,
      text: (t) => ({
        subject: company
          ? t("messages.notify.fromCompany", { company })
          : t("messages.notify.fromWellmix"),
        body: `${topicLabel(t, topic)}: ${previewOf(text, 140)}`,
      }),
    },
  );
}
