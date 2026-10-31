import "server-only";

import {
  getStore,
  type Conversation,
  type ConversationTopic,
  type Message,
  type MessageSide,
  type PartyType,
  type Role,
  type TopicKind,
  type User,
} from "@/lib/db";
import { ForbiddenError, isAdmin, isWellmix } from "@/lib/auth/permissions";
import { MESSAGE_SLA_BUSINESS_DAYS, businessDeadline } from "@/lib/sla";
import { isSchemaMissing } from "./packaging-brief";
import { topicHref } from "./messages";

/*
 * Controladoria de mensagens (docs/SLA_PANEL.md, "Mensagens"): toda conversa com uma
 * empresa, assunto por assunto, com "quem está com a bola" (quem escreveu
 * por último passou a vez ao outro lado), há quanto tempo o outro lado
 * espera e o prazo de 1 dia útil para responder. O que a Wellmix deve e já
 * passou do prazo vira pendência do analista (tasks) e entra no painel de
 * SLA. Indicadores: o que está com a Wellmix, o que está atrasado, o que
 * está com a empresa e o % respondido no prazo nos últimos 30 dias. Visão
 * por produto: cada assunto de item, pedido ou solicitação aponta para os
 * produtos envolvidos.
 *
 * Operador vê os assuntos em que escreveu e os que ninguém da Wellmix
 * assumiu ainda; administrador vê todos (e pode filtrar "só os meus").
 * Banco sem as tabelas (esquema não publicado): tudo vazio, sem derrubar.
 */

/** Com quem está a bola. */
export type Ball = "wellmix" | "party";

export interface MessageControlRow {
  topicId: string;
  conversationId: string;
  href: string;
  partyId: string | null;
  partyName: string;
  partyType: PartyType | Role | null;
  kind: TopicKind;
  /** Referência do assunto ("#12 · Jarra"); vazio no Geral. */
  title: string | null;
  requestId: string | null;
  orderId: string | null;
  orderItemId: string | null;
  /** Produtos do assunto (item: um; pedido: os itens; solicitação: o dela). */
  productIds: string[];
  productNames: string[];
  messages: number;
  lastAt: string;
  lastSide: MessageSide;
  lastAuthorId: string;
  lastAuthorName: string;
  lastPreview: string;
  ball: Ball;
  /** Horas que o outro lado já espera. */
  waitingHours: number;
  /** Prazo de resposta (1 dia útil depois da última mensagem). */
  dueAt: string;
  overdue: boolean;
  /** Analista: último login da Wellmix que escreveu no assunto (nulo: ninguém ainda). */
  analystId: string | null;
  analystName: string | null;
  /** Cliente da solicitação/do pedido (ou a própria empresa, se é cliente): painel de SLA. */
  customerId: string | null;
}

export interface MessageControlStats {
  withWellmix: number;
  overdue: number;
  withParty: number;
  /** Respostas da Wellmix nos últimos 30 dias: total e no prazo. */
  answered30d: number;
  onTime30d: number;
  /** Tempo médio de resposta da Wellmix nos últimos 30 dias, em horas (nulo sem resposta). */
  avgResponseHours: number | null;
}

export interface MessageControlProduct {
  productId: string;
  name: string;
  topics: number;
  withWellmix: number;
  overdue: number;
}

export interface MessageControlFilter {
  /** "mine": só os meus (padrão de quem não é admin); "all": todos (admin). */
  scope?: "mine" | "all";
  ball?: Ball | "all";
  overdueOnly?: boolean;
  partyId?: string | null;
  productId?: string | null;
}

export interface MessageControl {
  rows: MessageControlRow[];
  /** Indicadores de tudo que o login vê (antes dos filtros de linha). */
  stats: MessageControlStats;
  products: MessageControlProduct[];
  parties: Array<{ id: string; name: string }>;
  scope: "mine" | "all";
  slaBusinessDays: number;
}

const time = (value: string | null | undefined) => {
  const n = value ? Date.parse(value) : NaN;
  return Number.isNaN(n) ? 0 : n;
};

const preview = (body: string, size = 120) =>
  body.replace(/\s+/g, " ").trim().slice(0, size);

/** Último login da Wellmix que escreveu (quem está cuidando do assunto). */
function analystOf(messages: Message[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--)
    if (messages[i].authorSide === "wellmix") return messages[i].authorUserId;
  return null;
}

/**
 * Respostas da Wellmix: cada vez que uma mensagem de fora ficou sem
 * resposta e a Wellmix respondeu, o tempo entre a primeira mensagem de fora
 * sem resposta e a resposta. Vale para os indicadores dos últimos 30 dias.
 */
export function wellmixResponses(
  messages: Message[],
  slaDays = MESSAGE_SLA_BUSINESS_DAYS,
): Array<{ askedAt: string; answeredAt: string; onTime: boolean }> {
  const out: Array<{ askedAt: string; answeredAt: string; onTime: boolean }> =
    [];
  let askedAt: string | null = null;
  for (const m of messages) {
    if (m.authorSide === "external") {
      if (!askedAt) askedAt = m.createdAt;
    } else if (askedAt) {
      const due = businessDeadline(askedAt, slaDays);
      out.push({
        askedAt,
        answeredAt: m.createdAt,
        onTime: !due || time(m.createdAt) <= time(due),
      });
      askedAt = null;
    }
  }
  return out;
}

/** Leitura que volta `fallback` se a tabela/coluna ainda não existe no banco. */
async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (isSchemaMissing(error)) return fallback;
    throw error;
  }
}

interface Loaded {
  rows: MessageControlRow[];
  threads: Map<string, Message[]>;
}

/** Todos os assuntos com mensagem, com a bola, o prazo e os produtos. */
async function loadAll(now: Date): Promise<Loaded> {
  const store = getStore();
  const empty: Loaded = { rows: [], threads: new Map() };
  return safe(async () => {
    const [conversations, topics] = await Promise.all([
      store.list("conversations"),
      store.list("conversation_topics"),
    ]);
    const active = topics.filter((t) => t.lastMessageAt);
    if (!active.length) return empty;
    const messages = await store.list("messages", {
      filter: { topicId: active.map((t) => t.id) },
    });
    const threads = new Map<string, Message[]>();
    for (const m of messages) {
      const list = threads.get(m.topicId) ?? [];
      list.push(m);
      threads.set(m.topicId, list);
    }
    for (const list of threads.values())
      list.sort((a, b) => time(a.createdAt) - time(b.createdAt));

    // Nomes: empresas, logins, produtos (dos itens, pedidos e solicitações).
    const convById = new Map<string, Conversation>(
      conversations.map((c) => [c.id, c]),
    );
    const partyIds = [
      ...new Set(conversations.map((c) => c.partyId).filter(Boolean)),
    ] as string[];
    const authorIds = new Set(messages.map((m) => m.authorUserId));
    for (const c of conversations) if (c.userId) authorIds.add(c.userId);
    const requestIds = [
      ...new Set(active.map((t) => t.requestId).filter(Boolean)),
    ] as string[];
    const orderIds = [
      ...new Set(active.map((t) => t.orderId).filter(Boolean)),
    ] as string[];
    const [parties, users, requests, orderItems, orders] = await Promise.all([
      partyIds.length
        ? store.list("parties", { filter: { id: partyIds } })
        : [],
      authorIds.size
        ? store.list("users", { filter: { id: [...authorIds] } })
        : [],
      requestIds.length
        ? store.list("requests", { filter: { id: requestIds } })
        : [],
      orderIds.length
        ? store.list("order_items", { filter: { orderId: orderIds } })
        : [],
      orderIds.length ? store.list("orders", { filter: { id: orderIds } }) : [],
    ]);
    const productIdsOf = (t: ConversationTopic): string[] => {
      if (t.productId) return [t.productId];
      if (t.kind === "item" && t.orderItemId) {
        const item = orderItems.find((i) => i.id === t.orderItemId);
        return item?.productId ? [item.productId] : [];
      }
      if (t.kind === "order" && t.orderId)
        return [
          ...new Set(
            orderItems
              .filter((i) => i.orderId === t.orderId)
              .map((i) => i.productId)
              .filter(Boolean) as string[],
          ),
        ];
      if (t.kind === "request" && t.requestId) {
        const r = requests.find((x) => x.id === t.requestId);
        return r?.productId ? [r.productId] : [];
      }
      return [];
    };
    const allProductIds = [...new Set(active.flatMap(productIdsOf))];
    const products = allProductIds.length
      ? await store.list("products", { filter: { id: allProductIds } })
      : [];
    const productName = (id: string) =>
      products.find((p) => p.id === id)?.name ?? "—";
    const userName = (id: string | null) =>
      id ? (users.find((u) => u.id === id)?.name ?? "—") : null;

    const rows: MessageControlRow[] = [];
    for (const topic of active) {
      const thread = threads.get(topic.id);
      if (!thread?.length) continue;
      const last = thread[thread.length - 1];
      const conv = convById.get(topic.conversationId);
      const party = conv?.partyId
        ? parties.find((p) => p.id === conv.partyId)
        : null;
      const owner = conv && !conv.partyId ? userName(conv.userId) : null;
      const dueAt =
        businessDeadline(last.createdAt, MESSAGE_SLA_BUSINESS_DAYS) ??
        last.createdAt;
      const productIds = productIdsOf(topic);
      const analystId = analystOf(thread);
      rows.push({
        topicId: topic.id,
        conversationId: topic.conversationId,
        href: topicHref(topic.conversationId, topic.id),
        partyId: conv?.partyId ?? null,
        partyName: party?.name ?? owner ?? "—",
        partyType:
          party?.type ??
          (conv && !conv.partyId
            ? (users.find((u) => u.id === conv.userId)?.role ?? null)
            : null),
        kind: topic.kind,
        title: topic.title,
        requestId: topic.requestId,
        orderId: topic.orderId,
        orderItemId: topic.orderItemId ?? null,
        productIds,
        productNames: productIds.map(productName),
        messages: thread.length,
        lastAt: last.createdAt,
        lastSide: last.authorSide,
        lastAuthorId: last.authorUserId,
        lastAuthorName: userName(last.authorUserId) ?? "—",
        lastPreview: preview(last.body),
        ball: last.authorSide === "external" ? "wellmix" : "party",
        waitingHours: Math.max(
          0,
          (now.getTime() - time(last.createdAt)) / 3_600_000,
        ),
        dueAt,
        overdue: now.getTime() > time(dueAt),
        analystId,
        analystName: userName(analystId),
        customerId:
          (topic.requestId
            ? requests.find((r) => r.id === topic.requestId)?.customerId
            : topic.orderId
              ? orders.find((o) => o.id === topic.orderId)?.customerId
              : null) ?? (party?.type === "customer" ? party.id : null),
      });
    }
    rows.sort((a, b) => {
      // Primeiro o que a Wellmix deve e está atrasado; depois pelo mais antigo.
      const score = (r: MessageControlRow) =>
        (r.ball === "wellmix" ? 0 : 2) + (r.overdue ? 0 : 1);
      return score(a) - score(b) || time(a.lastAt) - time(b.lastAt);
    });
    return { rows, threads };
  }, empty);
}

/** Linhas que o login vê: admin todas; operador as suas e as sem analista. */
function visibleTo(
  user: User,
  rows: MessageControlRow[],
  scope: "mine" | "all",
) {
  if (scope === "all") return rows;
  return rows.filter((r) => !r.analystId || r.analystId === user.id);
}

/**
 * Controladoria do login (Wellmix). `filter.scope` padrão: admin "all",
 * operador "mine" (operador não pode pedir "all").
 */
export async function messageControlFor(
  user: User,
  filter: MessageControlFilter = {},
  now = new Date(),
): Promise<MessageControl> {
  if (!isWellmix(user)) throw new ForbiddenError();
  const admin = isAdmin(user);
  const scope: "mine" | "all" = admin ? (filter.scope ?? "all") : "mine";
  const { rows: all, threads } = await loadAll(now);
  const mine = visibleTo(user, all, scope);

  const since = now.getTime() - 30 * 86_400_000;
  let answered30d = 0;
  let onTime30d = 0;
  let totalHours = 0;
  for (const r of mine)
    for (const resp of wellmixResponses(threads.get(r.topicId) ?? [])) {
      if (time(resp.answeredAt) < since) continue;
      answered30d++;
      if (resp.onTime) onTime30d++;
      totalHours += (time(resp.answeredAt) - time(resp.askedAt)) / 3_600_000;
    }
  const stats: MessageControlStats = {
    withWellmix: mine.filter((r) => r.ball === "wellmix").length,
    overdue: mine.filter((r) => r.ball === "wellmix" && r.overdue).length,
    withParty: mine.filter((r) => r.ball === "party").length,
    answered30d,
    onTime30d,
    avgResponseHours: answered30d ? totalHours / answered30d : null,
  };

  const byProduct = new Map<string, MessageControlProduct>();
  for (const r of mine)
    r.productIds.forEach((id, i) => {
      const p = byProduct.get(id) ?? {
        productId: id,
        name: r.productNames[i] ?? "—",
        topics: 0,
        withWellmix: 0,
        overdue: 0,
      };
      p.topics++;
      if (r.ball === "wellmix") {
        p.withWellmix++;
        if (r.overdue) p.overdue++;
      }
      byProduct.set(id, p);
    });
  const products = [...byProduct.values()].sort(
    (a, b) =>
      b.overdue - a.overdue ||
      b.withWellmix - a.withWellmix ||
      a.name.localeCompare(b.name),
  );
  const parties = [
    ...new Map(
      mine
        .filter((r) => r.partyId)
        .map((r) => [r.partyId!, { id: r.partyId!, name: r.partyName }]),
    ).values(),
  ].sort((a, b) => a.name.localeCompare(b.name));

  let rows = mine;
  if (filter.ball && filter.ball !== "all")
    rows = rows.filter((r) => r.ball === filter.ball);
  if (filter.overdueOnly)
    rows = rows.filter((r) => r.ball === "wellmix" && r.overdue);
  if (filter.partyId) rows = rows.filter((r) => r.partyId === filter.partyId);
  if (filter.productId)
    rows = rows.filter((r) => r.productIds.includes(filter.productId!));

  return {
    rows,
    stats,
    products,
    parties,
    scope,
    slaBusinessDays: MESSAGE_SLA_BUSINESS_DAYS,
  };
}

/**
 * O que a Wellmix deve responder (pendências e painel de SLA): assuntos com
 * a bola na Wellmix, com o prazo de 1 dia útil. Todos os logins da Wellmix
 * veem; o painel de SLA agrupa pelo analista (quem escreveu por último).
 */
export async function wellmixMessageDebts(
  now = new Date(),
): Promise<MessageControlRow[]> {
  const { rows } = await loadAll(now);
  return rows.filter((r) => r.ball === "wellmix");
}

/** CSV (Excel abre direto) das linhas da controladoria. */
export function messageControlCsv(
  rows: MessageControlRow[],
  labels: {
    header: string[];
    ball: Record<Ball, string>;
    kind: Record<TopicKind, string>;
    yes: string;
    no: string;
  },
): string {
  const cell = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [labels.header.map(cell).join(";")];
  for (const r of rows)
    lines.push(
      [
        r.partyName,
        labels.kind[r.kind],
        r.title ?? "",
        r.productNames.join(", "),
        labels.ball[r.ball],
        r.waitingHours.toFixed(1),
        r.dueAt,
        r.overdue ? labels.yes : labels.no,
        r.lastAt,
        r.lastAuthorName,
        r.lastPreview,
        r.analystName ?? "",
        r.messages,
      ]
        .map(cell)
        .join(";"),
    );
  return `﻿${lines.join("\r\n")}\r\n`;
}
