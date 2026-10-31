"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  chatContextAction,
  chatOpenAction,
  chatReadAction,
  chatSendAction,
  chatThreadAction,
} from "@/app/app/actions/chat";
import type { ChatContext, ConversationView } from "@/lib/services/messages";
import { ChatIcon } from "./chat-open-button";
import { CHAT_EVENT, type ChatTargetDetail } from "@/lib/chat-target";
import { cx } from "./ui";

/*
 * Painel lateral de chat: abre por cima de qualquer tela quando um ícone de
 * chat é tocado (evento CHAT_EVENT). Mostra com quem conversar (as empresas
 * do pedido/da solicitação; quem é de fora fala só com a Wellmix) e sobre o
 * quê (pedido inteiro ou um item), as mensagens do assunto e o campo de
 * envio. As Server Actions devolvem dados (sem redirecionar) e o serviço
 * confere o acesso. Atualiza a cada 20 s enquanto está aberto. Anexos só na
 * tela de Mensagens (link no rodapé).
 */

export interface ChatDrawerLabels {
  title: string;
  with: string;
  about: string;
  wholeOrder: string;
  wholeRequest: string;
  openFull: string;
  close: string;
  loading: string;
  noParticipants: string;
  error: string;
  attachHint: string;
  send: string;
  sending: string;
  placeholder: string;
  you: string;
  wellmix: string;
  empty: string;
  intl: string;
}

const REFRESH_MS = 20_000;

function when(value: string, intl: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString(intl, {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Sao_Paulo",
      });
}

export function ChatDrawer({ labels }: { labels: ChatDrawerLabels }) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<ChatTargetDetail | null>(null);
  const [ctx, setCtx] = useState<ChatContext | null>(null);
  const [partyId, setPartyId] = useState<string | null>(null);
  const [itemId, setItemId] = useState<string | null>(null);
  const [topic, setTopic] = useState<{
    conversationId: string;
    topicId: string;
  } | null>(null);
  const [view, setView] = useState<ConversationView | null>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const readFor = useRef<string | null>(null);

  const loadThread = useCallback(
    async (topicId: string) => {
      const res = await chatThreadAction(topicId);
      if (!res.ok) {
        setError(labels.error);
        return;
      }
      setView(res.data);
      // Mensagem nova de outra pessoa: marca como lida (uma vez por mensagem).
      const last = res.data.messages[res.data.messages.length - 1];
      if (res.data.topic.unread > 0 && last && readFor.current !== last.id) {
        readFor.current = last.id;
        void chatReadAction(topicId);
      }
    },
    [labels.error],
  );

  // Abre (ou acha) o assunto da escolha atual e carrega as mensagens.
  const openTopic = useCallback(
    async (c: ChatContext, party: string | null, item: string | null) => {
      if (!c.own && !party) {
        setTopic(null);
        setView(null);
        return;
      }
      setLoading(true);
      setError(null);
      const res = await chatOpenAction({
        orderId: c.kind === "order" ? c.id : null,
        requestId: c.kind === "request" ? c.id : null,
        orderItemId: c.kind === "order" ? item : null,
        partyId: c.own ? null : party,
      });
      if (!res.ok) {
        setError(labels.error);
        setLoading(false);
        return;
      }
      setTopic(res.data);
      await loadThread(res.data.topicId);
      setLoading(false);
    },
    [labels.error, loadThread],
  );

  // Ícone tocado em alguma linha: abre o painel com aquele pedido/solicitação/item.
  useEffect(() => {
    const onOpen = async (event: Event) => {
      const detail = (event as CustomEvent<ChatTargetDetail>).detail;
      setOpen(true);
      setTarget(detail);
      setCtx(null);
      setTopic(null);
      setView(null);
      setBody("");
      setError(null);
      setLoading(true);
      // Item: o contexto é o do pedido dele (o serviço resolve pelo item).
      const res = await chatContextAction({
        orderId: detail.orderId ?? null,
        requestId: detail.requestId ?? null,
      });
      if (!res.ok) {
        setError(labels.error);
        setLoading(false);
        return;
      }
      const c = res.data;
      setCtx(c);
      const party =
        detail.partyId ??
        (c.participants.some((p) => p.partyId === detail.partyId)
          ? detail.partyId!
          : (c.participants[0]?.partyId ?? null));
      const item = detail.orderItemId ?? null;
      setPartyId(party);
      setItemId(item);
      await openTopic(c, party, item);
    };
    window.addEventListener(CHAT_EVENT, onOpen);
    return () => window.removeEventListener(CHAT_EVENT, onOpen);
  }, [labels.error, openTopic]);

  // Atualiza sozinho enquanto está aberto (sem websocket).
  useEffect(() => {
    if (!open || !topic) return;
    const tick = () => {
      if (document.visibilityState === "visible")
        void loadThread(topic.topicId);
    };
    const timer = window.setInterval(tick, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [open, topic, loadThread]);

  // Esc fecha.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  const choose = (party: string | null, item: string | null) => {
    setPartyId(party);
    setItemId(item);
    if (ctx) void openTopic(ctx, party, item);
  };
  const send = async () => {
    if (!topic || !body.trim() || busy) return;
    setBusy(true);
    setError(null);
    const res = await chatSendAction(topic.topicId, body);
    if (!res.ok) setError(labels.error);
    else {
      setBody("");
      await loadThread(topic.topicId);
    }
    setBusy(false);
  };
  const chip = (active: boolean) =>
    cx(
      "rounded-full border px-2.5 py-1 text-xs font-medium transition",
      active
        ? "border-brand-600 bg-brand-600 text-white"
        : "border-zinc-300 bg-white text-zinc-700 hover:border-brand-300 hover:bg-brand-50",
    );

  return (
    <div className="fixed inset-0 z-50 flex justify-end" data-chat-drawer>
      {/* Fundo: tocar fora fecha. */}
      <button
        type="button"
        aria-label={labels.close}
        onClick={() => setOpen(false)}
        className="absolute inset-0 bg-zinc-900/30"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={labels.title}
        className="relative flex h-full w-full max-w-[30rem] flex-col bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-zinc-200 px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
              <ChatIcon className="h-4 w-4 text-brand-700" />
              {labels.title}
            </div>
            <div className="truncate text-xs text-zinc-500" data-chat-context>
              {ctx?.title ?? (target ? labels.loading : "")}
              {view?.conversation.name && !ctx?.own
                ? ` · ${view.conversation.name}`
                : ""}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100"
            data-chat-close
          >
            ✕<span className="sr-only">{labels.close}</span>
          </button>
        </header>

        {ctx ? (
          <div className="space-y-2 border-b border-zinc-100 px-4 py-2">
            {/* Com quem: as empresas do pedido/da solicitação (só a Wellmix escolhe). */}
            {!ctx.own ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  {labels.with}
                </span>
                {ctx.participants.length ? (
                  ctx.participants.map((p) => (
                    <button
                      key={p.partyId}
                      type="button"
                      onClick={() => choose(p.partyId, itemId)}
                      className={chip(partyId === p.partyId)}
                      data-chat-party={p.partyId}
                    >
                      {p.name}
                    </button>
                  ))
                ) : (
                  <span className="text-xs text-zinc-500">
                    {labels.noParticipants}
                  </span>
                )}
              </div>
            ) : null}
            {/* Sobre: o pedido inteiro ou um item (a conversa desce até o produto). */}
            {ctx.kind === "order" && ctx.items.length ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  {labels.about}
                </span>
                <button
                  type="button"
                  onClick={() => choose(partyId, null)}
                  className={chip(itemId === null)}
                  data-chat-item="order"
                >
                  {labels.wholeOrder}
                </button>
                {ctx.items.map((i) => (
                  <button
                    key={i.id}
                    type="button"
                    onClick={() => choose(partyId, i.id)}
                    className={chip(itemId === i.id)}
                    data-chat-item={i.id}
                    title={i.name}
                  >
                    <span className="block max-w-[14rem] truncate">
                      {i.name}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <p className="mx-4 mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        {/* Mensagens (coluna invertida: abre já no fim). */}
        <div
          className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto bg-zinc-50 px-3 py-3"
          data-chat-thread
        >
          {loading && !view ? (
            <p className="py-6 text-center text-sm text-zinc-500">
              {labels.loading}
            </p>
          ) : view?.messages.length ? (
            <ol className="space-y-2">
              {view.messages.map((m) => (
                <li
                  key={m.id}
                  className={cx(
                    "flex",
                    m.mine ? "justify-end" : "justify-start",
                  )}
                  data-chat-message={m.authorSide}
                >
                  <div
                    className={cx(
                      "max-w-[88%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                      m.mine
                        ? "bg-brand-600 text-white"
                        : "border border-zinc-200 bg-white text-zinc-900",
                    )}
                  >
                    <div
                      className={cx(
                        "mb-0.5 text-[11px]",
                        m.mine ? "text-white/80" : "text-zinc-500",
                      )}
                    >
                      <span className="font-semibold">
                        {m.mine ? labels.you : m.authorName}
                      </span>{" "}
                      ·{" "}
                      {m.authorSide === "wellmix"
                        ? labels.wellmix
                        : (view.conversation.name ?? "")}{" "}
                      · {when(m.createdAt, labels.intl)}
                    </div>
                    {m.attachment ? (
                      <a
                        href={`/api/files/${m.attachment.id}`}
                        target="_blank"
                        rel="noopener"
                        className={cx(
                          "block font-semibold underline underline-offset-2",
                          m.mine ? "text-white" : "text-brand-700",
                        )}
                      >
                        📎 {m.attachment.name}
                      </a>
                    ) : null}
                    {m.attachment &&
                    m.body === `📎 ${m.attachment.name}` ? null : (
                      <p className="whitespace-pre-wrap break-words">
                        {m.body}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          ) : view ? (
            <p className="py-6 text-center text-sm text-zinc-500">
              {labels.empty}
            </p>
          ) : null}
        </div>

        <form
          className="border-t border-zinc-200 px-4 py-3"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
          data-chat-composer
        >
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              // Enter envia; Shift+Enter quebra linha.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={2}
            maxLength={4000}
            placeholder={labels.placeholder}
            disabled={!topic || busy}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-zinc-50"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-zinc-500">
              {topic ? (
                <Link
                  href={`/app/messages?c=${topic.conversationId}&t=${topic.topicId}`}
                  className="font-medium text-brand-700 underline underline-offset-2"
                  data-chat-open-full
                >
                  {labels.openFull}
                </Link>
              ) : null}
              <span className="block">{labels.attachHint}</span>
            </div>
            <button
              type="submit"
              disabled={!topic || busy || !body.trim()}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
              data-chat-send
            >
              {busy ? labels.sending : labels.send}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}
