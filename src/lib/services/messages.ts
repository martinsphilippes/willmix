import "server-only";

import { after } from "next/server";
import {
  getStore,
  MESSAGE_MAX_LENGTH,
  PARTY_TYPES,
  type Conversation,
  type ConversationTopic,
  type Locale,
  type Message,
  type MessageSide,
  type Order,
  type Party,
  type PartyType,
  type Request,
  type RequestDraft,
  type Role,
  type TopicKind,
  type User,
} from "@/lib/db";
import {
  ForbiddenError,
  canViewOrder,
  canViewRequest,
  isAdmin,
  isWellmix,
} from "@/lib/auth/permissions";
import type { Translate } from "@/i18n";
import {
  WELLMIX_LOCALE,
  translationState,
  type MessageTranslationState,
  type TranslationDisplay,
} from "@/lib/message-translation";
import { isSchemaMissing } from "@/lib/db/errors";
import { listColumns } from "@/lib/db/lookup";
import { canOpen } from "@/lib/auth/screens";
import { searchText } from "@/lib/db/store";
import { isPlayableVideo, isPreviewImage } from "@/lib/file-kinds";
import { notify } from "./notifications";
import { getListedDraft } from "./request-drafts";
import {
  isAttachmentOnly,
  translateMessage,
  translationOn,
} from "./message-translation";

/*
 * Mensagens: chat da Wellmix com as empresas parceiras (cliente, fornecedor,
 * agência, despachante, companhia marítima, transportador e jurídico).
 *
 * Conversa privada entre dois logins (dono, 18/11/2026; docs/CHAT_IDENTITY.md):
 * uma pessoa da Wellmix e uma pessoa de fora. Só os dois leem, escrevem e são
 * avisados; o administrador lê todas, sem escrever (auditoria, Controladoria
 * e SLA). Quem é de fora fala, num pedido ou numa solicitação, com o
 * responsável dele (`ownerUserId`); sem responsável, escolhe numa lista curta
 * (quem criou, com quem já conversa ou, sem ninguém, os administradores).
 * A Wellmix escolhe o login da empresa ("Escolher conversa").
 *
 * Conversas antigas (antes de 18/11/2026: uma por EMPRESA, `partyId`, ou por
 * login sem empresa, `userId`) continuam visíveis como antes, só para leitura.
 *
 * Cada conversa tem assuntos: "Geral" e, quando preciso, um por solicitação,
 * pedido ou produto do pedido. Quem é de fora só abre (e escreve em) assuntos
 * de solicitações e pedidos que ele mesmo pode ver.
 *
 * Aviso de mensagem nova só no sino do portal (sem e-mail nem WhatsApp), só
 * para o outro login da conversa e no máximo um aviso não lido por assunto,
 * até ele ler. Quem é de fora também vê, em toda tela, a faixa "Nova mensagem
 * da Wellmix" com o texto (unreadDigest).
 *
 * Tradução automática: depois do envio, a mensagem é traduzida para os
 * idiomas do portal (message-translation.ts); cada um lê no próprio idioma,
 * com o original a um toque.
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
  if (topic.kind === "item")
    return t("messages.topic.item", { ref: topic.title ?? "" });
  if (topic.kind === "draft")
    return t("messages.topic.draft", { ref: topic.title ?? "" });
  return t("messages.topic.general");
}

/** Prévia de uma mensagem numa linha. */
const previewOf = (body: string, size = 200) =>
  body.replace(/\s+/g, " ").trim().slice(0, size);

/* ---------------------------------------------------------------------- */
/* Acesso                                                                  */
/* ---------------------------------------------------------------------- */

/** Conversa privada entre dois logins (as novas); falso: antiga, da empresa. */
export const isPair = (
  c: Pick<Conversation, "wellmixUserId" | "externalUserId">,
): boolean => !!c.wellmixUserId && !!c.externalUserId;

/** O login é um dos dois da conversa privada? */
function isMember(user: User, conversation: Conversation): boolean {
  return (
    isPair(conversation) &&
    (conversation.wellmixUserId === user.id ||
      conversation.externalUserId === user.id)
  );
}

/** Conversa antiga da empresa do login (ou do próprio login sem empresa). */
function inLegacyCompany(user: User, conversation: Conversation): boolean {
  if (isWellmix(user) || isPair(conversation)) return false;
  if (user.partyId) return conversation.partyId === user.partyId;
  return !conversation.partyId && conversation.userId === user.id;
}

/**
 * Quem lê: a conversa privada, os dois e o administrador; a antiga, como
 * antes (a Wellmix e os logins da empresa).
 */
const canAccessConversation = (user: User, conversation: Conversation) =>
  isPair(conversation)
    ? isMember(user, conversation) || isAdmin(user)
    : isWellmix(user) || inLegacyCompany(user, conversation);

/** Quem escreve: só os dois da conversa privada (a antiga é só leitura). */
const canWriteConversation = (user: User, conversation: Conversation) =>
  isMember(user, conversation);

/** O outro login da conversa privada, visto por um dos dois. */
const peerIdOf = (user: User, conversation: Conversation) =>
  conversation.wellmixUserId === user.id
    ? conversation.externalUserId!
    : conversation.wellmixUserId!;

/** Quem pode ver a solicitação: as regras de sempre (cliente: o login solicitante). */
async function canSeeRequest(user: User, request: Request): Promise<boolean> {
  return canViewRequest(user, request);
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
    order.comexId,
    order.logisticsId,
    order.ocpId,
    order.marketingAgencyId,
  ].filter((id): id is string => !!id);
}

/**
 * Login de fora da conversa: o da conversa privada ou, na antiga sem
 * empresa, o dono dela.
 */
async function conversationOwner(conversation: Conversation) {
  if (isPair(conversation))
    return getStore().get("users", conversation.externalUserId!);
  if (conversation.partyId || !conversation.userId) return null;
  return getStore().get("users", conversation.userId);
}

/** A empresa da conversa participa da solicitação (é o cliente)? */
async function companyInRequest(
  conversation: Conversation,
  request: Request,
): Promise<boolean> {
  if (!isPair(conversation) && conversation.partyId)
    return request.customerId === conversation.partyId;
  const owner = await conversationOwner(conversation);
  return !!owner && (await canSeeRequest(owner, request));
}

/** A empresa da conversa participa do pedido? */
async function companyInOrder(
  conversation: Conversation,
  order: Order,
): Promise<boolean> {
  if (!isPair(conversation) && conversation.partyId)
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
  // O rascunho (dono, 19/11/2026): só existe na conversa privada de quem o
  // salvou com o login do cliente, que já é conferida à parte.
  if (isWellmix(user) || topic.kind === "general" || topic.kind === "draft")
    return true;
  const store = getStore();
  if (topic.kind === "request" && topic.requestId) {
    const request = await store.get("requests", topic.requestId);
    return !!request && (await canSeeRequest(user, request));
  }
  if ((topic.kind === "order" || topic.kind === "item") && topic.orderId) {
    const order = await store.get("orders", topic.orderId);
    return !!order && canViewOrder(user, order);
  }
  return false;
}

/**
 * Conversa e assunto que o login pode abrir (`write`: e escrever); senão
 * ForbiddenError. Conversa antiga, ao escrever: "read_only".
 */
async function loadTopicFor(
  user: User,
  topicId: string,
  mode: "read" | "write" = "read",
) {
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
  if (mode === "write" && !canWriteConversation(user, conversation)) {
    if (!isPair(conversation)) throw new MessageError("read_only");
    throw new ForbiddenError();
  }
  return { topic, conversation };
}

/** O login pode abrir o assunto (e os anexos dele)? Nunca lança. */
export async function canOpenTopic(
  user: User,
  topicId: string,
): Promise<boolean> {
  try {
    await loadTopicFor(user, topicId);
    return true;
  } catch {
    return false;
  }
}

/* ---------------------------------------------------------------------- */
/* Conversas e assuntos (encontrar ou criar)                               */
/* ---------------------------------------------------------------------- */

/** Conversa privada entre os dois logins, sem criar (duas ao mesmo tempo: vale a mais antiga). */
async function findPair(
  wellmixUserId: string,
  externalUserId: string,
): Promise<Conversation | null> {
  const [found] = await getStore().list("conversations", {
    filter: { wellmixUserId, externalUserId },
    orderBy: "createdAt",
    limit: 1,
  });
  return found ?? null;
}

/** Conversa privada entre a pessoa da Wellmix e a de fora, criada na primeira vez. */
async function pairFor(wellmixUser: User, externalUser: User) {
  if (!isWellmix(wellmixUser) || isWellmix(externalUser))
    throw new MessageError("not_participant");
  const found = await findPair(wellmixUser.id, externalUser.id);
  if (found) return found;
  return getStore().create("conversations", {
    partyId: externalUser.partyId,
    userId: null,
    wellmixUserId: wellmixUser.id,
    externalUserId: externalUser.id,
    lastMessageAt: null,
    lastMessagePreview: null,
    status: "open",
  });
}

/**
 * Conversas do login: as privadas dele e as antigas que ele lê (Wellmix: as
 * antigas de todas as empresas; de fora: a antiga da própria empresa).
 * Administrador: todas. Não cria nada.
 */
async function conversationsOf(user: User): Promise<Conversation[]> {
  const store = getStore();
  if (isAdmin(user)) return store.list("conversations");
  if (isWellmix(user)) {
    const all = await store.list("conversations");
    return all.filter((c) => !isPair(c) || c.wellmixUserId === user.id);
  }
  const [mine, legacy] = await Promise.all([
    store.list("conversations", { filter: { externalUserId: user.id } }),
    store.list("conversations", {
      filter: user.partyId ? { partyId: user.partyId } : { userId: user.id },
    }),
  ]);
  return [
    ...mine.filter((c) => isMember(user, c)),
    ...legacy.filter((c) => inLegacyCompany(user, c)),
  ];
}

/** Conversas em que o login escreve (as privadas dele): não lidas e avisos. */
async function memberConversations(user: User): Promise<Conversation[]> {
  const rows = await getStore().list("conversations", {
    filter: isWellmix(user)
      ? { wellmixUserId: user.id }
      : { externalUserId: user.id },
  });
  return rows.filter((c) => isMember(user, c));
}

async function findTopic(
  conversationId: string,
  kind: TopicKind,
  ref: {
    requestId?: string;
    orderId?: string;
    orderItemId?: string;
    draftId?: string;
  } = {},
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

/** Referência do rascunho no assunto: "#5 · Berço de boneca" (o número reservado). */
const draftRef = (draft: Pick<RequestDraft, "number" | "title">) =>
  [typeof draft.number === "number" ? `#${draft.number}` : null, draft.title]
    .filter(Boolean)
    .join(" · ")
    .slice(0, 160);

/** O login de fora da conversa é do cliente do rascunho? */
async function companyInDraft(
  conversation: Conversation,
  draft: Pick<RequestDraft, "customerId">,
): Promise<boolean> {
  if (!draft.customerId) return false;
  if (!isPair(conversation) && conversation.partyId)
    return conversation.partyId === draft.customerId;
  const owner = await conversationOwner(conversation);
  return !!owner && owner.partyId === draft.customerId;
}

/**
 * Rascunho enviado (dono, 19/11/2026; docs/ORDER_LEVEL_LISTS.md, seção 8):
 * o assunto do rascunho passa a ser o da solicitação (a primeira do lote),
 * com as mensagens, na mesma conversa. O rascunho fica anotado no assunto.
 */
export async function moveDraftTopics(
  draftId: string,
  request: Request,
): Promise<number> {
  return safe(async () => {
    const store = getStore();
    const topics = (
      await store.list("conversation_topics", { filter: { draftId } })
    ).filter((topic) => topic.kind === "draft");
    for (const topic of topics)
      await store.update("conversation_topics", topic.id, {
        kind: "request",
        requestId: request.id,
        title: requestRef(request),
      });
    return topics.length;
  }, 0);
}

async function orderRef(order: Order) {
  const [item] = await getStore().list("order_items", {
    filter: { orderId: order.id },
    limit: 1,
  });
  return [`#${order.number}`, item?.name]
    .filter(Boolean)
    .join(" · ")
    .slice(0, 160);
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
    readAt.set(
      r.topicId,
      Math.max(readAt.get(r.topicId) ?? 0, time(r.lastReadAt)),
    );
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

/** Uma pessoa da conversa: nome, login (e-mail) e empresa ou equipe. */
export interface ChatPerson {
  userId: string;
  name: string;
  /** Login (e-mail). Nulo: não aparece para quem vê (lista de escolha de quem é de fora). */
  login: string | null;
  side: MessageSide;
  /** Empresa de quem é de fora (nulo na Wellmix ou no login sem empresa). */
  org: string | null;
  /** Tipo da empresa ou papel do login (rótulo "Cliente", "Fornecedor"…). */
  type: PartyType | Role | null;
  /** Login ativo (nem desativado nem suspenso). */
  active: boolean;
}

/** Pessoas pelos ids, com a empresa de cada uma. */
async function peopleOf(ids: string[]): Promise<Map<string, ChatPerson>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const result = new Map<string, ChatPerson>();
  if (!unique.length) return result;
  const store = getStore();
  const users = await store.list("users", { filter: { id: unique } });
  const partyIds = [
    ...new Set(users.map((u) => u.partyId).filter(Boolean)),
  ] as string[];
  const parties = partyIds.length
    ? await store.list("parties", { filter: { id: partyIds } })
    : [];
  for (const u of users) result.set(u.id, personOf(u, parties));
  return result;
}

function personOf(u: User, parties: Party[]): ChatPerson {
  const wellmix = isWellmix(u);
  const party = u.partyId ? parties.find((p) => p.id === u.partyId) : null;
  return {
    userId: u.id,
    name: u.name,
    login: u.email,
    side: wellmix ? "wellmix" : "external",
    org: wellmix ? null : (party?.name ?? null),
    type: wellmix ? null : (party?.type ?? u.role),
    active: u.active !== false && !u.loginSuspended,
  };
}

/** Pessoa que não está mais no banco (mensagem antiga de login apagado). */
const unknownPerson = (userId: string, side: MessageSide): ChatPerson => ({
  userId,
  name: "—",
  login: null,
  side,
  org: null,
  type: null,
  active: false,
});

export interface ConversationSummary {
  id: string;
  partyId: string | null;
  userId: string | null;
  /** Nome na lista: a outra pessoa; admin lendo: "A ↔ B"; antiga: a empresa. */
  name: string;
  /** Tipo da empresa (ou papel do login sem empresa). */
  type: PartyType | Role | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unread: number;
  /** Privada entre dois logins ou antiga da empresa (só leitura). */
  mode: "pair" | "legacy";
  /** Quem vê não escreve (antiga, ou o administrador lendo a conversa de outros). */
  readOnly: boolean;
  /** A outra pessoa (quem vê é um dos dois) ou, para o administrador, a de fora. */
  peer: ChatPerson | null;
  /** Os dois da conversa privada (Wellmix primeiro); vazio na antiga. */
  members: ChatPerson[];
}

/** Nome e tipo da empresa de cada conversa. */
async function companiesOf(conversations: Conversation[]) {
  const store = getStore();
  const partyIds = [
    ...new Set(conversations.map((c) => c.partyId).filter(Boolean)),
  ] as string[];
  const userIds = [
    ...new Set(conversations.filter((c) => !c.partyId).map((c) => c.userId)),
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

/** Resumo das conversas para quem vê: nome, a outra pessoa e se escreve. */
async function summariesOf(user: User, conversations: Conversation[]) {
  const company = await companiesOf(conversations);
  const people = await peopleOf(
    conversations.flatMap((c) =>
      isPair(c) ? [c.wellmixUserId!, c.externalUserId!] : [],
    ),
  );
  return (c: Conversation, unread: number): ConversationSummary => {
    const base = {
      id: c.id,
      partyId: c.partyId,
      userId: c.userId,
      lastMessageAt: c.lastMessageAt,
      lastMessagePreview: c.lastMessagePreview,
      unread,
    };
    if (!isPair(c))
      return {
        ...base,
        ...company(c),
        mode: "legacy",
        readOnly: true,
        peer: null,
        members: [],
      };
    const wellmix =
      people.get(c.wellmixUserId!) ??
      unknownPerson(c.wellmixUserId!, "wellmix");
    const external =
      people.get(c.externalUserId!) ??
      unknownPerson(c.externalUserId!, "external");
    const member = isMember(user, c);
    const peer = !member
      ? external
      : peerIdOf(user, c) === wellmix.userId
        ? wellmix
        : external;
    return {
      ...base,
      name: member ? peer.name : `${wellmix.name} ↔ ${external.name}`,
      type: external.type,
      mode: "pair",
      readOnly: !member,
      peer,
      members: [wellmix, external],
    };
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
 * Conversas do login, a mais recente primeiro: as privadas dele e as antigas
 * que ele lê; o administrador, todas. Não lidas só nas conversas em que ele
 * escreve. Não cria nada.
 */
export async function listConversationsFor(
  user: User,
): Promise<ConversationSummary[]> {
  return safe(async () => {
    const store = getStore();
    const conversations = await conversationsOf(user);
    if (!conversations.length) return [];
    const allTopics = await store.list("conversation_topics", {
      filter: { conversationId: conversations.map((c) => c.id) },
    });
    const topics = isWellmix(user)
      ? allTopics
      : await visibleTopics(user, allTopics);
    const memberIds = new Set(
      conversations.filter((c) => isMember(user, c)).map((c) => c.id),
    );
    const unread = await unreadByTopic(
      user,
      topics.filter((t) => memberIds.has(t.conversationId)),
    );
    const summary = await summariesOf(user, conversations);
    return conversations
      .map((c) =>
        summary(
          c,
          topics
            .filter((t) => t.conversationId === c.id)
            .reduce((sum, t) => sum + (unread.get(t.id) ?? 0), 0),
        ),
      )
      .sort(byRecent);
  }, []);
}

export interface TopicSummary {
  id: string;
  kind: TopicKind;
  requestId: string | null;
  orderId: string | null;
  /** Assunto de item: o item do pedido. */
  orderItemId?: string | null;
  title: string | null;
  lastMessageAt: string | null;
  unread: number;
}

/*
 * Árvore de assuntos (lista de quem é de fora e abas da Wellmix): Geral;
 * cada pedido pelo número com os produtos dele embaixo (o assunto do item,
 * ou "abrir" quando ainda não existe); cada solicitação pelo número com o
 * produto. Assim o fornecedor acha a conversa pelo pedido e desce ao produto.
 */
export interface TopicNode {
  key: string;
  kind: "general" | "order" | "request" | "item" | "draft";
  /** Nome da linha ("Pedido #12", "Solicitação #8", nome do produto). */
  label: string;
  /** Segunda linha (produto da solicitação). */
  sub?: string | null;
  /** Assunto já existente (link); nulo = abre ao tocar (pedido/item sem conversa). */
  topic: TopicSummary | null;
  orderId?: string | null;
  orderItemId?: string | null;
  children: TopicNode[];
}

export async function topicTree(
  t: Translate,
  topics: TopicSummary[],
): Promise<TopicNode[]> {
  const store = getStore();
  const orderIds = [
    ...new Set(topics.map((x) => x.orderId).filter(Boolean)),
  ] as string[];
  const [orders, items] = await Promise.all([
    orderIds.length ? store.list("orders", { filter: { id: orderIds } }) : [],
    orderIds.length
      ? store.list("order_items", { filter: { orderId: orderIds } })
      : [],
  ]);
  const nodes: TopicNode[] = [];
  const general = topics.find((x) => x.kind === "general");
  if (general)
    nodes.push({
      key: general.id,
      kind: "general",
      label: topicLabel(t, general),
      topic: general,
      children: [],
    });
  // Pedidos: pelo número, mais recente primeiro; itens na ordem do pedido.
  const byNumber = [...orders].sort((a, b) => b.number - a.number);
  for (const order of byNumber) {
    const orderTopic =
      topics.find((x) => x.kind === "order" && x.orderId === order.id) ?? null;
    const itemNodes: TopicNode[] = items
      .filter((i) => i.orderId === order.id)
      .map((i) => {
        const topic =
          topics.find((x) => x.kind === "item" && x.orderItemId === i.id) ??
          null;
        return {
          key: topic?.id ?? `item:${i.id}`,
          kind: "item" as const,
          label: i.name,
          topic,
          orderId: order.id,
          orderItemId: i.id,
          children: [],
        };
      });
    // Assunto de item cujo item sumiu do pedido: ainda aparece, pelo título.
    for (const x of topics)
      if (
        x.kind === "item" &&
        x.orderId === order.id &&
        !itemNodes.some((n) => n.topic?.id === x.id)
      )
        itemNodes.push({
          key: x.id,
          kind: "item",
          label: (x.title ?? "").replace(/^#\d+ · /, "") || topicLabel(t, x),
          topic: x,
          orderId: order.id,
          orderItemId: x.orderItemId ?? null,
          children: [],
        });
    nodes.push({
      key: orderTopic?.id ?? `order:${order.id}`,
      kind: "order",
      label: t("messages.topic.order", { ref: `#${order.number}` }),
      topic: orderTopic,
      orderId: order.id,
      children: itemNodes,
    });
  }
  // Pedido de assunto que não está mais no banco: linha pelo título.
  for (const x of topics)
    if (
      (x.kind === "order" || x.kind === "item") &&
      x.orderId &&
      !orders.some((o) => o.id === x.orderId)
    )
      nodes.push({
        key: x.id,
        kind: x.kind,
        label: topicLabel(t, x),
        topic: x,
        orderId: x.orderId,
        children: [],
      });
  // Solicitações: número e produto, mais recente primeiro.
  const requests = topics
    .filter((x) => x.kind === "request")
    .sort((a, b) => time(b.lastMessageAt) - time(a.lastMessageAt));
  for (const x of requests) {
    const [ref, ...rest] = (x.title ?? "").split(" · ");
    const hasNumber = /^#\d+$/.test(ref ?? "");
    nodes.push({
      key: x.id,
      kind: "request",
      label: hasNumber
        ? t("messages.topic.request", { ref })
        : topicLabel(t, x),
      sub: hasNumber ? rest.join(" · ") || null : null,
      topic: x,
      children: [],
    });
  }
  // Rascunhos (dono, 19/11/2026): o número reservado e o produto, mais
  // recente primeiro; viram solicitação no envio.
  const drafts = topics
    .filter((x) => x.kind === "draft")
    .sort((a, b) => time(b.lastMessageAt) - time(a.lastMessageAt));
  for (const x of drafts) {
    const [ref, ...rest] = (x.title ?? "").split(" · ");
    const hasNumber = /^#\d+$/.test(ref ?? "");
    nodes.push({
      key: x.id,
      kind: "draft",
      label: hasNumber ? t("messages.topic.draft", { ref }) : topicLabel(t, x),
      sub: hasNumber ? rest.join(" · ") || null : null,
      topic: x,
      children: [],
    });
  }
  return nodes;
}

export interface MessageView {
  id: string;
  body: string;
  createdAt: string;
  authorName: string;
  authorSide: MessageSide;
  /** Quem escreveu: nome, login e empresa ou equipe. */
  author: ChatPerson;
  /**
   * Para quem foi: a outra pessoa da conversa privada. Nulo: conversa antiga
   * (destinatário não identificado no histórico).
   */
  recipients: ChatPerson[] | null;
  mine: boolean;
  /**
   * Arquivo anexado (abre por /api/files, que confere o acesso). `isImage`:
   * o navegador mostra (miniatura na conversa); `isVideo`: toca na conversa;
   * `size` em bytes.
   */
  attachment: {
    id: string;
    name: string;
    isImage: boolean;
    isVideo: boolean;
    size: number;
  } | null;
  /** Tradução para quem vê (só quando a tela informa o idioma). */
  translation: MessageTranslationState | null;
  /** Textos da tradução já montados no idioma da tela (preenchido pela tela). */
  tr?: TranslationDisplay | null;
  /** Resposta a uma mensagem marcada: a citação (null: não é resposta). */
  replyTo: MessageQuote | null;
}

/** Citação da mensagem respondida (sempre do mesmo assunto). */
export interface MessageQuote {
  id: string;
  authorName: string;
  authorSide: MessageSide;
  /** Quem vê escreveu a mensagem citada ("Você"). */
  mine: boolean;
  /** Começo do texto, no idioma de quem lê quando há tradução; null: só o anexo. */
  text: string | null;
  attachment: { name: string; isImage: boolean; isVideo: boolean } | null;
}

/** Quem envia e quem recebe na conversa aberta (cabeçalho e campo de envio). */
export interface ChatIdentity {
  mode: "pair" | "legacy";
  /** Quem vê ("Enviando como"). */
  me: ChatPerson;
  /** Destinatário de quem vê; nulo na antiga e para o administrador lendo. */
  peer: ChatPerson | null;
  /** Os dois da conversa privada (Wellmix primeiro); vazio na antiga. */
  members: ChatPerson[];
  /** Quem vê pode escrever agora. */
  canWrite: boolean;
  /** Por que não escreve: antiga, administrador lendo ou a outra pessoa sem login ativo. */
  readOnly: null | "legacy" | "observer" | "peer_inactive";
}

export interface ConversationView {
  identity: ChatIdentity;
  conversation: ConversationSummary;
  topics: TopicSummary[];
  topic: TopicSummary;
  messages: MessageView[];
}

/** Últimas mensagens mostradas no assunto. */
const THREAD_LIMIT = 200;
/** Começo do texto citado numa resposta (a tela mostra até duas linhas). */
const QUOTE_MAX_LENGTH = 240;

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
  /** Idioma da tela de quem vê: liga a tradução das mensagens. */
  opts: { locale?: Locale } = {},
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
  // Não lidas só para os dois da conversa (o administrador lendo não acumula).
  const unread = isMember(user, conversation)
    ? await unreadByTopic(user, topics)
    : new Map<string, number>();
  // Sem assunto escolhido: abre onde há mensagem nova (a mais recente) ou,
  // sem nada novo, o assunto da última mensagem; Geral só se não houver nada.
  const byRecent = [...topics].sort(
    (a, b) => time(b.lastMessageAt) - time(a.lastMessageAt),
  );
  const defaultTopic =
    byRecent.find((t) => (unread.get(t.id) ?? 0) > 0) ??
    byRecent.find((t) => t.lastMessageAt) ??
    general;
  const selected = topics.find((t) => t.id === (topicId || defaultTopic.id))!;
  const summary = (t: ConversationTopic): TopicSummary => ({
    id: t.id,
    kind: t.kind,
    requestId: t.requestId,
    orderId: t.orderId,
    orderItemId: t.orderItemId ?? null,
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
  // Respostas: a mensagem citada, sempre deste assunto (a mais antiga que as
  // da tela vem à parte).
  const byId = new Map(rows.map((m) => [m.id, m]));
  const olderIds = [
    ...new Set(
      rows
        .map((m) => m.replyToMessageId)
        .filter((id): id is string => !!id && !byId.has(id)),
    ),
  ];
  const older = olderIds.length
    ? (await store.list("messages", { filter: { id: olderIds } })).filter(
        (m) => m.topicId === selected.id,
      )
    : [];
  for (const m of older) byId.set(m.id, m);
  const authorIds = [
    ...new Set([...rows, ...older].map((m) => m.authorUserId)),
  ];
  const authors = authorIds.length
    ? await store.list("users", { filter: { id: authorIds } })
    : [];
  const people = await peopleOf([
    user.id,
    ...authorIds,
    ...(isPair(conversation)
      ? [conversation.wellmixUserId!, conversation.externalUserId!]
      : []),
  ]);
  const person = (id: string, side: MessageSide) =>
    people.get(id) ?? unknownPerson(id, side);
  const attachmentIds = [...rows, ...older]
    .map((m) => m.attachmentDocumentId)
    .filter((id): id is string => !!id);
  const attachments = attachmentIds.length
    ? await store.list("documents", { filter: { id: attachmentIds } })
    : [];
  const attachmentOf = (m: Message): MessageView["attachment"] => {
    const doc = attachments.find((d) => d.id === m.attachmentDocumentId);
    return doc
      ? {
          id: doc.id,
          name: doc.name,
          isImage: isPreviewImage(doc.mime),
          isVideo: isPlayableVideo(doc.mime),
          size: doc.size,
        }
      : null;
  };
  const summaryOf = await summariesOf(user, [conversation]);
  const translationOf = await translationReader(
    user,
    conversation,
    authors,
    opts.locale,
  );
  const authorName = (m: Message) =>
    authors.find((u) => u.id === m.authorUserId)?.name ?? "—";
  const quoteOf = (m: Message): MessageQuote | null => {
    const q = m.replyToMessageId ? byId.get(m.replyToMessageId) : undefined;
    if (!q || q.topicId !== m.topicId) return null;
    const file = attachmentOf(q);
    const state = translationOf(q);
    const text = state?.state === "translated" ? state.text : q.body;
    return {
      id: q.id,
      authorName: authorName(q),
      authorSide: q.authorSide,
      mine: q.authorUserId === user.id,
      text: isAttachmentOnly(q) ? null : text.slice(0, QUOTE_MAX_LENGTH),
      attachment: file
        ? { name: file.name, isImage: file.isImage, isVideo: file.isVideo }
        : null,
    };
  };
  const pair = isPair(conversation);
  const member = isMember(user, conversation);
  const members = pair
    ? [
        person(conversation.wellmixUserId!, "wellmix"),
        person(conversation.externalUserId!, "external"),
      ]
    : [];
  const peer = member
    ? (members.find((p) => p.userId !== user.id) ?? null)
    : null;
  const readOnly: ChatIdentity["readOnly"] = !pair
    ? "legacy"
    : !member
      ? "observer"
      : peer && !peer.active
        ? "peer_inactive"
        : null;
  /** Para quem foi a mensagem: o outro da conversa privada. */
  const recipientsOf = (m: Message): ChatPerson[] | null => {
    if (!pair) return null;
    const other = members.filter((p) => p.userId !== m.authorUserId);
    return other.length === 1 ? other : null;
  };
  return {
    identity: {
      mode: pair ? "pair" : "legacy",
      me: person(user.id, sideOf(user)),
      peer,
      members,
      canWrite: readOnly === null,
      readOnly,
    },
    conversation: summaryOf(
      conversation,
      member ? [...unread.values()].reduce((a, b) => a + b, 0) : 0,
    ),
    topics: ordered.map(summary),
    topic: summary(selected),
    messages: rows.map((m: Message) => ({
      id: m.id,
      body: m.body,
      createdAt: m.createdAt,
      authorName: authorName(m),
      authorSide: m.authorSide,
      author: person(m.authorUserId, m.authorSide),
      recipients: recipientsOf(m),
      mine: m.authorUserId === user.id,
      attachment: attachmentOf(m),
      translation: translationOf(m),
      replyTo: quoteOf(m),
    })),
  };
}

/**
 * Leitor da tradução das mensagens para quem vê a conversa (sem idioma da
 * tela: sem tradução). Do outro lado: a Wellmix lê em português; a empresa,
 * nos idiomas dos logins dela.
 */
async function translationReader(
  user: User,
  conversation: Conversation,
  authors: User[],
  locale: Locale | undefined,
): Promise<(m: Message) => MessageTranslationState | null> {
  if (!locale) return () => null;
  const aiOn = await translationOn();
  let counterpartLocales: Locale[] = [WELLMIX_LOCALE];
  if (isWellmix(user)) {
    const logins = isPair(conversation)
      ? await conversationOwner(conversation).then((u) => (u ? [u] : []))
      : conversation.partyId
        ? await getStore().list("users", {
            filter: { partyId: conversation.partyId, active: true },
          })
        : await conversationOwner(conversation).then((u) => (u ? [u] : []));
    counterpartLocales = [
      ...new Set(
        logins.filter((u) => !isWellmix(u)).map((u) => u.locale ?? "pt"),
      ),
    ];
  }
  const now = Date.now();
  return (m) =>
    translationState(
      {
        body: m.body,
        translation: m.translation,
        createdAt: m.createdAt,
        mine: m.authorUserId === user.id,
        authorLocale:
          authors.find((u) => u.id === m.authorUserId)?.locale ?? null,
        attachmentOnly: isAttachmentOnly(m),
      },
      { locale, aiOn, now, counterpartLocales },
    );
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
    const own = await memberConversations(user);
    if (!own.length) return 0;
    const topics = await store.list("conversation_topics", {
      filter: { conversationId: own.map((c) => c.id) },
    });
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

/** Faixa "Nova mensagem da Wellmix" de quem é de fora (em toda tela). */
export interface UnreadDigest {
  /** Mensagens não lidas (o mesmo número do selo de Mensagens). */
  total: number;
  /** Assuntos com mensagem não lida. */
  topics: number;
  /** A mais recente: assunto, quem escreveu e o começo, no idioma de quem lê. */
  latest: {
    href: string;
    topic: Pick<ConversationTopic, "kind" | "title">;
    authorName: string;
    authorSide: MessageSide;
    text: string;
    createdAt: string;
  } | null;
}

/**
 * Não lidas de quem é de fora, com a mensagem mais recente já traduzida para
 * o idioma da tela (quando há tradução). A Wellmix tem a Controladoria de
 * mensagens: aqui volta vazio para ela. Não cria nada.
 */
export async function unreadDigest(
  user: User,
  locale: Locale,
): Promise<UnreadDigest> {
  const empty: UnreadDigest = { total: 0, topics: 0, latest: null };
  if (isWellmix(user)) return empty;
  return safe(async () => {
    const store = getStore();
    const own = await memberConversations(user);
    if (!own.length) return empty;
    const topics = await store.list("conversation_topics", {
      filter: { conversationId: own.map((c) => c.id) },
    });
    const unread = await unreadByTopic(user, topics);
    if (!unread.size) return empty;
    // Só assuntos que ele vê (só os com novidade são conferidos).
    const withNews: ConversationTopic[] = [];
    let total = 0;
    for (const topic of topics) {
      const n = unread.get(topic.id);
      if (n && (await canSeeTopic(user, topic))) {
        total += n;
        withNews.push(topic);
      }
    }
    if (!withNews.length) return empty;
    const newest = [...withNews].sort(
      (a, b) => time(b.lastMessageAt) - time(a.lastMessageAt),
    )[0];
    const recent = await store.list("messages", {
      filter: { topicId: newest.id },
      orderBy: "createdAt",
      direction: "desc",
      limit: 20,
    });
    const message = recent.find((m) => m.authorUserId !== user.id);
    if (!message) return { total, topics: withNews.length, latest: null };
    const author = await store.get("users", message.authorUserId);
    const tr = message.translation;
    const translated =
      tr?.status === "done" && tr.lang !== locale ? tr.texts[locale] : null;
    return {
      total,
      topics: withNews.length,
      latest: {
        href: topicHref(newest.conversationId, newest.id),
        topic: { kind: newest.kind, title: newest.title },
        authorName: author?.name ?? "—",
        authorSide: message.authorSide,
        text: previewOf(translated || message.body, 200),
        createdAt: message.createdAt,
      },
    };
  }, empty);
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

/** Tipos de empresa que a Wellmix chama numa conversa nova (ordem dos grupos). */
export const CHAT_PARTY_TYPES: PartyType[] = [
  "customer",
  "supplier",
  "shipping_line",
  "carrier",
  "agency",
  "broker",
  "comex",
  "logistics",
  "ocp",
  "marketing_agency",
  "legal",
];

/** Rótulo do tipo da empresa (ou do papel do login): "Cliente", "Fornecedor"… */
export function chatTypeLabel(
  t: Translate,
  type: PartyType | Role | null | undefined,
): string {
  return type && (PARTY_TYPES as readonly string[]).includes(type)
    ? t(`messages.type.${type as PartyType}`)
    : "";
}

/** Quantas empresas a busca da conversa nova devolve por vez. */
export const CHAT_TARGET_LIMIT = 20;

export interface ChatTarget {
  /** O valor do campo `target` da conversa nova: `user:<id>` (o login). */
  id: string;
  name: string;
  /** Tipo da empresa ou papel do login sem empresa (para o rótulo). */
  type: PartyType | Role;
  /** Login (e-mail) da pessoa. */
  login: string;
  /** Empresa da pessoa (nulo: login sem empresa). */
  org: string | null;
}

/** O login de fora tem a tela Mensagens no perfil (Gestão de telas)? */
async function hasMessagesScreen(user: User): Promise<boolean> {
  if (isWellmix(user)) return canOpen(user, "messages");
  const { externalAccessFor } = await import("./partner-access");
  const access = await externalAccessFor(user);
  return !access || access.screens.includes("messages");
}

/** Login que entra no portal (nem desativado nem suspenso). */
const loginActive = (u: User) => u.active !== false && !u.loginSuspended;

/**
 * Busca de com quem a Wellmix abre uma conversa nova: o LOGIN da pessoa de
 * fora (a conversa é privada entre os dois). Acha pelo nome da pessoa, pelo
 * e-mail ou pelo nome da empresa (empresas ativas dos tipos da conversa), a
 * partir de 2 letras. Só logins ativos de fora da Wellmix.
 */
export async function searchChatTargets(
  user: User,
  q: string,
): Promise<ChatTarget[]> {
  if (!isWellmix(user)) throw new ForbiddenError();
  const text = searchText(q).slice(0, 80);
  if (text.length < 2) return [];
  const store = getStore();
  const [parties, byName, byEmail] = await Promise.all([
    listColumns(store, "parties", ["name", "type"], {
      filter: { active: true, type: CHAT_PARTY_TYPES },
      search: { column: "name", text },
      orderBy: "name",
      limit: CHAT_TARGET_LIMIT,
    }),
    store.list("users", {
      filter: { active: true },
      search: { column: "name", text },
      orderBy: "name",
      limit: CHAT_TARGET_LIMIT,
    }),
    store.list("users", {
      filter: { active: true },
      search: { column: "email", text },
      orderBy: "name",
      limit: CHAT_TARGET_LIMIT,
    }),
  ]);
  const ofParties = parties.length
    ? await store.list("users", {
        filter: { active: true, partyId: parties.map((p) => p.id) },
        orderBy: "name",
      })
    : [];
  const seen = new Set<string>();
  const users = [...byName, ...byEmail, ...ofParties].filter((u) => {
    if (seen.has(u.id) || isWellmix(u) || !loginActive(u)) return false;
    seen.add(u.id);
    return true;
  });
  const partyIds = [
    ...new Set(users.map((u) => u.partyId).filter(Boolean)),
  ] as string[];
  const names = partyIds.length
    ? await listColumns(store, "parties", ["name", "type"], {
        filter: { id: partyIds },
      })
    : [];
  return users.slice(0, CHAT_TARGET_LIMIT * 2).map((u) => {
    const party = names.find((p) => p.id === u.partyId);
    return {
      id: `user:${u.id}`,
      name: u.name,
      type: party?.type ?? u.role,
      login: u.email,
      org: party?.name ?? null,
    };
  });
}

/* ---------------------------------------------------------------------- */
/* Escrita                                                                 */
/* ---------------------------------------------------------------------- */

export interface OpenTopicInput {
  conversationId?: string | null;
  /** Wellmix: empresa do pedido (com um login só, é ele; com vários, escolher). */
  partyId?: string | null;
  /** A outra pessoa da conversa (Wellmix: o login de fora; de fora: a pessoa da Wellmix). */
  peerUserId?: string | null;
  /** Antigo (= peerUserId): login de fora escolhido pela Wellmix. */
  userId?: string | null;
  requestId?: string | null;
  orderId?: string | null;
  /** Um produto do pedido: o assunto desce até o item. */
  orderItemId?: string | null;
  /** O rascunho de uma solicitação (quem o salvou e o administrador; dono, 19/11/2026). */
  draftId?: string | null;
}

/** Do que se fala: o pedido, a solicitação ou o rascunho (nenhum = Geral). */
interface PeerContext {
  order?: Order | null;
  request?: Request | null;
  draft?: RequestDraft | null;
}

/**
 * Logins de fora com quem a Wellmix conversa sobre o pedido ou a
 * solicitação: os das empresas participantes que veem o pedido (ou a
 * solicitação), ativos e com a tela Mensagens.
 */
async function externalCandidates(ctx: PeerContext): Promise<User[]> {
  const store = getStore();
  const partyIds = ctx.order
    ? orderParties(ctx.order)
    : ctx.request?.customerId
      ? [ctx.request.customerId]
      : ctx.draft?.customerId
        ? [ctx.draft.customerId]
        : [];
  if (!partyIds.length) return [];
  const users = (
    await store.list("users", {
      filter: { active: true, partyId: partyIds },
      orderBy: "name",
    })
  ).filter((u) => !isWellmix(u) && loginActive(u));
  const ok = await Promise.all(
    users.map(async (u) => {
      if (ctx.order && !canViewOrder(u, ctx.order)) return false;
      if (ctx.request && !(await canSeeRequest(u, ctx.request))) return false;
      return hasMessagesScreen(u);
    }),
  );
  return users.filter((_, i) => ok[i]);
}

/**
 * Com quem da Wellmix quem é de fora conversa (dono, 18/11/2026): o
 * responsável do pedido ou da solicitação primeiro; depois quem criou a
 * solicitação e as pessoas com quem ele já conversa; sem ninguém, os
 * administradores. Só logins ativos.
 */
async function wellmixCandidates(
  user: User,
  ctx: PeerContext,
): Promise<User[]> {
  const store = getStore();
  const existing = (await memberConversations(user)).sort(
    (a, b) => time(b.lastMessageAt) - time(a.lastMessageAt),
  );
  const ids = [
    ctx.order?.ownerUserId,
    ctx.request?.ownerUserId,
    ctx.request?.createdByUserId,
    ...existing.map((c) => c.wellmixUserId),
  ].filter((id): id is string => !!id);
  const unique = [...new Set(ids)];
  const found = unique.length
    ? await store.list("users", { filter: { id: unique } })
    : [];
  const ordered = unique
    .map((id) => found.find((u) => u.id === id))
    .filter((u): u is User => !!u && isWellmix(u) && loginActive(u));
  if (ordered.length) return ordered;
  return (
    await store.list("users", {
      filter: { role: "admin", active: true },
      orderBy: "name",
    })
  ).filter(loginActive);
}

/** Pedido ou solicitação do assunto que se quer abrir. */
async function contextOf(input: OpenTopicInput): Promise<PeerContext> {
  const store = getStore();
  if (input.draftId)
    return { draft: await store.get("request_drafts", input.draftId) };
  if (input.requestId)
    return { request: await store.get("requests", input.requestId) };
  if (input.orderItemId) {
    const item = await store.get("order_items", input.orderItemId);
    return { order: item ? await store.get("orders", item.orderId) : null };
  }
  if (input.orderId) return { order: await store.get("orders", input.orderId) };
  return {};
}

/**
 * Conversa privada em que o login abre o assunto. Wellmix: com o login de
 * fora escolhido (`peerUserId`) ou, só com a empresa, o único login dela
 * que pode conversar (ou aquele com quem já conversa); com vários e nenhuma
 * conversa ainda: "choose_login". De fora: com a pessoa da Wellmix escolhida
 * na lista curta, ou com a primeira dela (o responsável).
 */
async function resolveConversation(
  user: User,
  input: OpenTopicInput,
  ctx: PeerContext,
): Promise<Conversation> {
  const store = getStore();
  if (input.conversationId) {
    const found = await store.get("conversations", input.conversationId);
    if (!found) throw new MessageError("not_found");
    if (!canAccessConversation(user, found)) throw new ForbiddenError();
    if (!canWriteConversation(user, found)) {
      if (!isPair(found)) throw new MessageError("read_only");
      throw new ForbiddenError();
    }
    return found;
  }
  const hasContext = !!(ctx.order || ctx.request || ctx.draft);
  if (!isWellmix(user)) {
    if (input.partyId && input.partyId !== user.partyId)
      throw new ForbiddenError();
    const candidates = await wellmixCandidates(user, ctx);
    const peerId = input.peerUserId ?? candidates[0]?.id ?? null;
    const peer = candidates.find((u) => u.id === peerId);
    if (!peer) {
      if (!peerId) throw new MessageError("no_contact");
      throw new ForbiddenError();
    }
    return pairFor(peer, user);
  }
  const peerId = input.peerUserId ?? input.userId ?? null;
  const candidates = hasContext ? await externalCandidates(ctx) : null;
  if (peerId) {
    const peer = await store.get("users", peerId);
    if (!peer || isWellmix(peer)) throw new MessageError("not_found");
    if (!loginActive(peer)) throw new MessageError("peer_inactive");
    if (candidates && !candidates.some((u) => u.id === peer.id))
      throw new MessageError("not_participant");
    return pairFor(user, peer);
  }
  // Só a empresa: o único login dela que pode conversar, ou com quem já conversa.
  const partyId = input.partyId ?? null;
  let pool =
    candidates ??
    (partyId
      ? (
          await store.list("users", {
            filter: { active: true, partyId },
          })
        ).filter((u) => !isWellmix(u) && loginActive(u))
      : []);
  if (partyId) pool = pool.filter((u) => u.partyId === partyId);
  if (pool.length === 1) return pairFor(user, pool[0]);
  if (!pool.length) {
    if (partyId) {
      const party = await store.get("parties", partyId);
      if (!party) throw new MessageError("not_found");
    }
    throw new MessageError("no_login");
  }
  const mine = (await memberConversations(user))
    .filter((c) => pool.some((u) => u.id === c.externalUserId))
    .sort((a, b) => time(b.lastMessageAt) - time(a.lastMessageAt));
  if (mine[0]) return mine[0];
  throw new MessageError("choose_login");
}

/**
 * Abre (encontra ou cria) a conversa privada e o assunto: Geral, de uma
 * solicitação, de um pedido ou de um produto do pedido. O login de fora da
 * conversa tem de ver a solicitação/o pedido; quem é de fora, ainda, só se
 * ele mesmo vê.
 */
export async function openTopic(
  user: User,
  input: OpenTopicInput,
): Promise<{ conversationId: string; topicId: string }> {
  const store = getStore();
  const wellmix = isWellmix(user);
  if (input.draftId) {
    /* Rascunho (dono, 19/11/2026; docs/ORDER_LEVEL_LISTS.md, seções 8 e 9):
       quem o salvou e o administrador conversam sobre ele (a regra dos
       detalhes), cada um na conversa dele com um login do cliente do
       rascunho; no envio, os assuntos passam para a solicitação. */
    if (!wellmix) throw new ForbiddenError();
    const draft = await getListedDraft(user, input.draftId);
    if (!draft) throw new MessageError("not_found");
    const conversation = await resolveConversation(user, input, { draft });
    if (!(await companyInDraft(conversation, draft)))
      throw new MessageError("not_participant");
    const topic =
      (await findTopic(conversation.id, "draft", { draftId: draft.id })) ??
      (await store.create("conversation_topics", {
        conversationId: conversation.id,
        kind: "draft",
        requestId: null,
        orderId: null,
        draftId: draft.id,
        title: draftRef(draft),
        lastMessageAt: null,
      }));
    await generalTopic(conversation);
    return { conversationId: conversation.id, topicId: topic.id };
  }
  const ctx = await contextOf(input);
  if (input.requestId) {
    const request = ctx.request;
    if (!request) throw new MessageError("not_found");
    if (!wellmix && !(await canSeeRequest(user, request)))
      throw new ForbiddenError();
    const conversation = await resolveConversation(user, input, ctx);
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
  if (input.orderItemId) {
    // Item do pedido: mesmas regras do pedido; o item tem de ser dele.
    const item = await store.get("order_items", input.orderItemId);
    if (!item) throw new MessageError("not_found");
    if (input.orderId && input.orderId !== item.orderId)
      throw new MessageError("item_not_in_order");
    const order = await store.get("orders", item.orderId);
    if (!order) throw new MessageError("not_found");
    if (!wellmix && !canViewOrder(user, order)) throw new ForbiddenError();
    const conversation = await resolveConversation(user, input, { order });
    if (!(await companyInOrder(conversation, order)))
      throw new MessageError("not_participant");
    const topic =
      (await findTopic(conversation.id, "item", { orderItemId: item.id })) ??
      (await store.create("conversation_topics", {
        conversationId: conversation.id,
        kind: "item",
        requestId: null,
        orderId: order.id,
        orderItemId: item.id,
        productId: item.productId ?? null,
        title: `#${order.number} · ${item.name}`.slice(0, 160),
        lastMessageAt: null,
      }));
    await generalTopic(conversation);
    return { conversationId: conversation.id, topicId: topic.id };
  }
  if (input.orderId) {
    const order = await store.get("orders", input.orderId);
    if (!order) throw new MessageError("not_found");
    if (!wellmix && !canViewOrder(user, order)) throw new ForbiddenError();
    const conversation = await resolveConversation(user, input, { order });
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
  const conversation = await resolveConversation(user, input, {});
  const topic = await generalTopic(conversation);
  return { conversationId: conversation.id, topicId: topic.id };
}

/**
 * Com quem da Wellmix quem é de fora começa uma conversa na tela de
 * Mensagens (sem pedido nem solicitação): as pessoas com quem já conversa ou,
 * sem ninguém, os administradores. O login só aparece de quem já conversa.
 */
export async function externalContactsFor(
  user: User,
): Promise<ChatPeerOption[]> {
  if (isWellmix(user)) return [];
  return safe(async () => {
    const [candidates, existing] = await Promise.all([
      wellmixCandidates(user, {}),
      memberConversations(user),
    ]);
    return candidates.map((u) => {
      const conv = existing.find((c) => c.wellmixUserId === u.id);
      const person = personOf(u, []);
      return {
        ...person,
        login: conv ? person.login : null,
        partyId: null,
        conversationId: conv?.id ?? null,
        lastMessageAt: conv?.lastMessageAt ?? null,
      };
    });
  }, []);
}

/* ---------------------------------------------------------------------- */
/* Painel lateral (chat a partir de qualquer linha)                        */
/* ---------------------------------------------------------------------- */

/** Uma pessoa com quem dá para conversar no contexto ("Escolher conversa"). */
export interface ChatPeerOption extends ChatPerson {
  /** Empresa do login de fora (para agrupar por empresa). */
  partyId: string | null;
  /** Conversa que já existe com ela (nulo: nasce ao abrir). */
  conversationId: string | null;
  lastMessageAt: string | null;
  /** É o responsável do pedido ou da solicitação. */
  isOwner?: boolean;
}

export interface ChatContext {
  kind: "order" | "request" | "draft";
  id: string;
  /** "Pedido #5" ou "Solicitação nº 3: Jarra". */
  title: string;
  /** Wellmix: as empresas do pedido/da solicitação (atalhos para filtrar a lista). */
  participants: Array<{ partyId: string; name: string; type: PartyType }>;
  /** Pedido: os produtos (a conversa pode descer até o item). */
  items: Array<{ id: string; name: string }>;
  /** Quem é de fora fala só com a Wellmix (escolhe a pessoa na lista curta). */
  own: boolean;
  /** Quem vê ("Enviando como"). */
  me: ChatPerson;
  /**
   * Com quem dá para conversar neste pedido ou solicitação: Wellmix, os
   * logins de fora que veem; de fora, a lista curta da Wellmix (o
   * responsável primeiro). O login (e-mail) de quem é da Wellmix só aparece
   * para quem é de fora quando os dois já conversam.
   */
  peers: ChatPeerOption[];
  /**
   * Escolha padrão: de fora, quem já conversa com ele sobre este assunto ou,
   * sem conversa, o responsável; Wellmix, nulo (escolhe no painel).
   */
  defaultPeerId: string | null;
}

/**
 * O que o painel lateral precisa para abrir a conversa de um pedido ou de
 * uma solicitação: com quem dá para conversar (cada login, com a empresa) e
 * os itens. Quem é de fora só recebe o contexto do que ele mesmo vê.
 */
export async function chatContext(
  user: User,
  input: {
    orderId?: string | null;
    requestId?: string | null;
    draftId?: string | null;
  },
): Promise<ChatContext> {
  const store = getStore();
  const wellmix = isWellmix(user);
  let ctx: PeerContext;
  let base: Pick<ChatContext, "kind" | "id" | "title" | "items">;
  let partyIds: string[];
  if (input.orderId) {
    const order = await store.get("orders", input.orderId);
    if (!order) throw new MessageError("not_found");
    if (!wellmix && !canViewOrder(user, order)) throw new ForbiddenError();
    const items = await store.list("order_items", {
      filter: { orderId: order.id },
    });
    ctx = { order };
    partyIds = orderParties(order);
    base = {
      kind: "order",
      id: order.id,
      title: `Pedido #${order.number}`,
      items: items.map((i) => ({ id: i.id, name: i.name })),
    };
  } else if (input.requestId) {
    const request = await store.get("requests", input.requestId);
    if (!request) throw new MessageError("not_found");
    if (!wellmix && !(await canSeeRequest(user, request)))
      throw new ForbiddenError();
    ctx = { request };
    partyIds = [request.customerId].filter((id): id is string => !!id);
    base = {
      kind: "request",
      id: request.id,
      title: request.number
        ? `Solicitação nº ${request.number}: ${request.productName}`
        : request.productName,
      items: [],
    };
  } else if (input.draftId) {
    /* Rascunho (dono, 19/11/2026): quem o salvou e o administrador (a regra
       dos detalhes) abrem a conversa dele, com os logins do cliente do
       rascunho. */
    if (!wellmix) throw new ForbiddenError();
    const draft = await getListedDraft(user, input.draftId);
    if (!draft) throw new MessageError("not_found");
    ctx = { draft };
    partyIds = draft.customerId ? [draft.customerId] : [];
    base = {
      kind: "draft",
      id: draft.id,
      title:
        typeof draft.number === "number"
          ? `Solicitação nº ${draft.number} (rascunho)`
          : "Rascunho",
      items: [],
    };
  } else throw new MessageError("not_found");

  const candidates = wellmix
    ? await externalCandidates(ctx)
    : await wellmixCandidates(user, ctx);
  const allPartyIds = [
    ...new Set([
      ...(wellmix ? partyIds : []),
      ...candidates.map((u) => u.partyId).filter((id): id is string => !!id),
    ]),
  ];
  const [parties, me, existing] = await Promise.all([
    allPartyIds.length
      ? store.list("parties", { filter: { id: allPartyIds } })
      : Promise.resolve([] as Party[]),
    peopleOf([user.id]).then((m) => m.get(user.id)!),
    memberConversations(user),
  ]);
  const peers: ChatPeerOption[] = candidates.map((u) => {
    const conv = existing.find((c) =>
      wellmix ? c.externalUserId === u.id : c.wellmixUserId === u.id,
    );
    const person = personOf(u, parties);
    return {
      ...person,
      // Privacidade: quem é de fora só vê o login de quem já conversa com ele.
      login: wellmix || conv ? person.login : null,
      partyId: u.partyId,
      conversationId: conv?.id ?? null,
      lastMessageAt: conv?.lastMessageAt ?? null,
      isOwner:
        !!u.id &&
        u.id === (ctx.order?.ownerUserId ?? ctx.request?.ownerUserId ?? null),
    };
  });
  return {
    ...base,
    participants: wellmix
      ? partyIds.flatMap((id) => {
          const p = parties.find((x) => x.id === id);
          return p ? [{ partyId: p.id, name: p.name, type: p.type }] : [];
        })
      : [],
    own: !wellmix,
    me,
    peers,
    defaultPeerId: wellmix ? null : await externalDefaultPeer(base, peers),
  };
}

/**
 * Pessoa padrão de quem é de fora: a da conversa mais recente sobre este
 * pedido ou solicitação (a resposta que ele espera está lá); sem conversa
 * sobre ele ainda, o responsável (o primeiro da lista curta).
 */
async function externalDefaultPeer(
  base: Pick<ChatContext, "kind" | "id">,
  peers: ChatPeerOption[],
): Promise<string | null> {
  const withConversation = peers.filter((p) => p.conversationId);
  if (withConversation.length) {
    const topics = await getStore().list("conversation_topics", {
      filter: {
        conversationId: withConversation.map((p) => p.conversationId!),
        ...(base.kind === "order"
          ? { orderId: base.id }
          : { requestId: base.id }),
      },
    });
    const latest = topics
      .filter((t) => t.lastMessageAt)
      .sort((a, b) => time(b.lastMessageAt) - time(a.lastMessageAt))[0];
    const peer =
      latest &&
      withConversation.find((p) => p.conversationId === latest.conversationId);
    if (peer) return peer.userId;
  }
  return peers[0]?.userId ?? null;
}

/** A conversa de um assunto (mesma leitura da tela de Mensagens), para o painel lateral. */
export async function topicThread(
  user: User,
  topicId: string,
  opts: { locale?: Locale } = {},
): Promise<ConversationView> {
  const { topic, conversation } = await loadTopicFor(user, topicId);
  const view = await getConversationView(user, conversation.id, topic.id, opts);
  if (!view) throw new MessageError("not_found");
  return view;
}

/** Texto da mensagem: sem espaços nas pontas, de 1 a 4.000 caracteres. */
export function messageBody(body: string): string {
  const text = body.trim();
  if (!text) throw new MessageError("message_empty");
  if (text.length > MESSAGE_MAX_LENGTH)
    throw new MessageError("message_too_long");
  return text;
}

/** Anexo: arquivo do formulário ou id do que o navegador já subiu direto. */
export type MessageAttachment = File | { fileKey: string };

/**
 * Escreve no assunto: grava a mensagem (com o anexo, se houver), atualiza a
 * última mensagem da conversa e do assunto, marca como lido para quem
 * escreveu e avisa o outro lado (Wellmix escreveu: os logins da empresa que
 * veem o assunto; a empresa escreveu: a equipe Wellmix). Com anexo o texto
 * pode ficar vazio (vale o nome do arquivo). O anexo só abre para quem vê o
 * assunto (documents.conversationTopicId; ver canAccessDocument). Resposta a
 * uma mensagem marcada (`replyToMessageId`): só de uma mensagem do mesmo
 * assunto; outra conversa nunca aparece na citação.
 */
export async function postMessage(
  user: User,
  topicId: string,
  body: string,
  attachment?: MessageAttachment | null,
  options: {
    replyToMessageId?: string | null;
    /**
     * Conversa que a tela mostrava ao enviar: se o assunto não é dela (a
     * pessoa trocou de conversa no meio), recusa em vez de mandar para outro.
     */
    conversationId?: string | null;
  } = {},
): Promise<Message> {
  const attached =
    attachment instanceof File
      ? attachment.size > 0
        ? attachment
        : null
      : (attachment ?? null);
  const typed = body.trim();
  const text = attached && !typed ? "" : messageBody(body);
  const store = getStore();
  // Acesso antes de qualquer gravação (nem o arquivo sobe sem acesso).
  const { topic, conversation } = await loadTopicFor(user, topicId, "write");
  if (options.conversationId && options.conversationId !== conversation.id)
    throw new MessageError("conversation_changed");
  // A outra pessoa sem login ativo: ninguém leria (nada é gravado).
  if (isPair(conversation)) {
    const peer = await store.get("users", peerIdOf(user, conversation));
    if (!peer || !loginActive(peer)) throw new MessageError("peer_inactive");
  }
  // Resposta: a mensagem marcada tem de ser deste assunto (conferido antes de
  // gravar o anexo).
  let replyTo: Message | null = null;
  if (options.replyToMessageId) {
    const id = options.replyToMessageId;
    replyTo = await safe(() => store.get("messages", id), null);
    if (!replyTo || replyTo.topicId !== topic.id)
      throw new MessageError("reply_not_found");
  }
  let attachmentDocumentId: string | null = null;
  let fileName = "";
  if (attached) {
    const { uploadDocument, registerUploadedDocument } =
      await import("./documents");
    const input = {
      type: "attachment" as const,
      visibility: "internal" as const,
      conversationTopicId: topic.id,
    };
    // Arquivo no formulário ou já subido direto ao armazenamento (grande).
    const doc =
      attached instanceof File
        ? await uploadDocument(user, attached, input)
        : await registerUploadedDocument(user, attached.fileKey, input);
    attachmentDocumentId = doc.id;
    fileName = doc.name;
  }
  const shown = text || `📎 ${fileName}`.slice(0, MESSAGE_MAX_LENGTH);
  const row = {
    conversationId: conversation.id,
    topicId: topic.id,
    authorUserId: user.id,
    authorSide: sideOf(user),
    body: shown,
    attachmentDocumentId,
  };
  let message: Message;
  try {
    // A coluna nova só vai nas respostas (o resto grava antes da publicação).
    message = await store.create(
      "messages",
      replyTo ? { ...row, replyToMessageId: replyTo.id } : row,
    );
  } catch (error) {
    // Esquema ainda sem a coluna: a mensagem vai sem a citação (nada se perde).
    if (!replyTo || !isSchemaMissing(error)) throw error;
    console.error("messages.replyToMessageId: publique o esquema do Appwrite");
    message = await store.create("messages", row);
  }
  await Promise.all([
    store.update("conversation_topics", topic.id, {
      lastMessageAt: message.createdAt,
    }),
    store.update("conversations", conversation.id, {
      lastMessageAt: message.createdAt,
      lastMessagePreview: previewOf(shown),
    }),
  ]);
  await saveRead(user.id, topic.id);
  await notifyOtherSide(user, conversation, topic, shown);
  if (!isAttachmentOnly(message)) scheduleTranslations([message.id]);
  return message;
}

/**
 * Tradução automática logo depois que a tela responde (quem envia não espera
 * a IA), uma mensagem por vez. Fora de uma requisição (testes, scripts) não
 * há "depois": a mensagem fica sem tradução e o botão "Traduzir" continua.
 * Devolve se ficou agendada.
 */
function scheduleTranslations(messageIds: string[]): boolean {
  if (!messageIds.length) return false;
  try {
    after(async () => {
      for (const id of messageIds) {
        try {
          await translateMessage(id);
        } catch (error) {
          console.error(
            "message_translation_failed",
            id,
            error instanceof Error ? error.message : String(error),
          );
        }
      }
    });
    return true;
  } catch {
    // Sem requisição em andamento: sem tradução automática.
    return false;
  }
}

/** Mensagens sem tradução traduzidas a cada tela aberta (as mais recentes). */
const AUTO_TRANSLATE_LIMIT = 10;

/**
 * Mensagens que a tela mostrou sem tradução (enviadas antes da tradução
 * automática, ou cujo envio não chegou a traduzir): traduz depois da resposta
 * e mostra "Traduzindo…" no lugar do botão. A próxima atualização da conversa
 * já traz o texto traduzido (ou "Tentar de novo", se a IA falhar).
 */
export function translateShown(view: ConversationView): ConversationView {
  const ids = view.messages
    .filter((m) => m.translation?.state === "available")
    .slice(-AUTO_TRANSLATE_LIMIT)
    .map((m) => m.id);
  if (!scheduleTranslations(ids)) return view;
  const scheduled = new Set(ids);
  return {
    ...view,
    messages: view.messages.map((m) =>
      scheduled.has(m.id) ? { ...m, translation: { state: "pending" } } : m,
    ),
  };
}

/**
 * "Traduzir" / "Tentar de novo" numa mensagem: só quem vê o assunto dela.
 * Já traduzida: nada a fazer. IA desligada: continua sem tradução.
 */
export async function translateMessageFor(user: User, messageId: string) {
  const message = await getStore().get("messages", messageId);
  if (!message) throw new MessageError("not_found");
  await loadTopicFor(user, message.topicId);
  return translateMessage(message.id);
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

/**
 * Avisa no sino a outra pessoa da conversa privada (só ela); quem já tem
 * aviso não lido do assunto, não. Conversa antiga: ninguém (é só leitura).
 */
async function notifyOtherSide(
  author: User,
  conversation: Conversation,
  topic: ConversationTopic,
  text: string,
) {
  if (!isMember(author, conversation)) return;
  const store = getStore();
  const peer = await store.get("users", peerIdOf(author, conversation));
  if (!peer || !loginActive(peer) || peer.id === author.id) return;
  // Sem a tela Mensagens (Gestão de telas) ou sem ver o assunto: sem aviso,
  // que traria o começo da mensagem e um link que o login não abre.
  if (!(await canSeeTopic(peer, topic)) || !(await hasMessagesScreen(peer)))
    return;
  const link = topicHref(conversation.id, topic.id);
  const pending = await store.list("notifications", {
    filter: { userId: peer.id, channel: "inapp", link, readAt: null },
  });
  if (pending.length) return;
  const people = await peopleOf([author.id]);
  const who = people.get(author.id);
  const name = who?.name ?? author.name;
  // O começo da mensagem só vai no aviso de quem lê no mesmo idioma de quem
  // escreveu; os outros abrem a conversa e leem a tradução.
  const written = author.locale ?? WELLMIX_LOCALE;
  await notify(
    { userIds: [peer.id] },
    {
      link,
      kind: "info",
      actor: null,
      inAppOnly: true,
      text: (t) => ({
        subject: isWellmix(author)
          ? t("messages.notify.fromPersonWellmix", { name })
          : t("messages.notify.fromPerson", {
              name,
              company: who?.org ?? name,
            }),
        body:
          t.locale === written
            ? `${topicLabel(t, topic)}: ${previewOf(text, 140)}`
            : topicLabel(t, topic),
      }),
    },
  );
}
