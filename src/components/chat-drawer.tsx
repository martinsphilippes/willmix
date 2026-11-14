"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  chatContextAction,
  chatOpenAction,
  chatReadAction,
  chatSendAction,
  chatThreadAction,
  chatTranslateAction,
} from "@/app/app/actions/chat";
import type { ChatContext, ConversationView } from "@/lib/services/messages";
import { ChatIcon } from "./chat-open-button";
import { MessageTranslationNote } from "./message-translation-note";
import { ChatAttachmentView } from "./chat-attachment";
import {
  ChatAttachButtons,
  ChatDropOverlay,
  ChatUploadStatus,
} from "./chat-attach";
import {
  pastedFiles,
  useChatUpload,
  useFileDrop,
  type ChatUploadLabels,
} from "./chat-upload";
import { ReplyPreview, ReplyQuote, ReplySwipe } from "./chat-reply";
import {
  replyTarget,
  type ChatReplyLabels,
  type ReplyTarget,
} from "@/lib/chat-reply";
import {
  CHAT_EVENT,
  keyboardOverlap,
  sameChatTarget,
  type ChatTargetDetail,
} from "@/lib/chat-target";
import { cx } from "./ui";

/*
 * Painel lateral de chat: abre por cima de qualquer tela quando um ícone de
 * chat é tocado (evento CHAT_EVENT). Mostra com quem conversar (as empresas
 * do pedido/da solicitação; quem é de fora fala só com a Wellmix) e sobre o
 * quê (pedido inteiro ou um item), as mensagens do assunto e o campo de
 * envio. As Server Actions devolvem dados (sem redirecionar) e o serviço
 * confere o acesso. Atualiza a cada 20 s enquanto está aberto. Fotos e
 * arquivos: botões "Foto" e "Arquivo" (vários de uma vez), arrastar para o
 * painel ou colar um print na caixa de texto; a foto aparece na conversa e o
 * vídeo toca ali mesmo. Arrastar uma mensagem para a direita (ou "↩")
 * responde a ela, com a citação na resposta.
 * Cada mensagem do outro lado aparece no idioma de quem lê (tradução
 * automática, com "Ver original").
 *
 * Caixa flutuante (`floating` no evento; botão "Conversar com a empresa" da
 * solicitação, dono, 14/11/2026): a mesma conversa num quadro no canto
 * inferior direito, sem fundo escuro, com a tela de baixo usável (endereço,
 * rolagem e dados não mudam). Aberta de novo na mesma conversa, só vem para
 * frente. No celular ocupa a largura e sobe com o teclado (área visível do
 * navegador), para o campo de mensagem continuar à vista.
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
  /** Fotos e arquivos (botões, andamento, erros). */
  attach: ChatUploadLabels;
  /** Responder a uma mensagem marcada. */
  reply: ChatReplyLabels;
  /** "Baixar vídeo". */
  videoDownload: string;
}

const REFRESH_MS = 20_000;

/*
 * Teclado do celular (área visível do navegador, `visualViewport`): o
 * quanto ele cobre embaixo e a altura que sobra, em texto para o React
 * comparar ("" sem teclado).
 */
function subscribeViewport(onChange: () => void) {
  const vv = window.visualViewport;
  if (!vv) return () => {};
  vv.addEventListener("resize", onChange);
  vv.addEventListener("scroll", onChange);
  return () => {
    vv.removeEventListener("resize", onChange);
    vv.removeEventListener("scroll", onChange);
  };
}
function keyboardSnapshot(): string {
  const vv = window.visualViewport;
  if (!vv) return "";
  const overlap = keyboardOverlap(window.innerHeight, vv);
  return overlap ? `${overlap}:${Math.round(vv.height)}` : "";
}
const noKeyboard = () => "";

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
  /** Caixa flutuante no canto (em vez do painel lateral). */
  const [floating, setFloating] = useState(false);
  /** Vezes que a caixa já aberta foi trazida para frente. */
  const [raised, setRaised] = useState(0);
  // O que está aberto agora, para o evento (que não vê o estado novo).
  const openRef = useRef(false);
  const floatingRef = useRef(false);
  const targetRef = useRef<ChatTargetDetail | null>(null);
  const keyboard = useSyncExternalStore(
    subscribeViewport,
    keyboardSnapshot,
    noKeyboard,
  );
  const [ctx, setCtx] = useState<ChatContext | null>(null);
  const [partyId, setPartyId] = useState<string | null>(null);
  const [itemId, setItemId] = useState<string | null>(null);
  const [topic, setTopic] = useState<{
    conversationId: string;
    topicId: string;
  } | null>(null);
  const [view, setView] = useState<ConversationView | null>(null);
  const [body, setBody] = useState("");
  /** Começo já escrito (da linha que abriu o painel). */
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  /** Mensagem sendo traduzida pelo botão "Traduzir". */
  const [translating, setTranslating] = useState<string | null>(null);
  /** Mensagem marcada para responder ("Respondendo a …"). */
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const readFor = useRef<string | null>(null);
  /** Painel inteiro (fundo incluído): arrastar arquivos para cá envia. */
  const panelRef = useRef<HTMLDivElement>(null);
  /** Assunto aberto agora (o envio de arquivos recarrega este). */
  const topicRef = useRef<string | null>(null);

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

  const upload = useChatUpload({
    labels: labels.attach,
    onSent: async () => {
      if (topicRef.current) await loadThread(topicRef.current);
    },
    // O texto da caixa e a resposta foram junto com o arquivo: limpa a
    // caixa (se não mudou depois) e esquece a mensagem marcada.
    onFirstSent: (caption) => {
      if (caption) {
        setBody((b) => (b.trim() === caption ? "" : b));
        setDraft("");
      }
      setReplyTo(null);
    },
  });
  const sendFiles = (files: File[], photo: boolean) => {
    if (!topic) return;
    void upload.send(topic.topicId, files, {
      caption: body,
      photo,
      replyToMessageId: replyTo?.id ?? null,
    });
  };
  const chooseReply = (target: ReplyTarget) => {
    setReplyTo(target);
    boxRef.current?.focus();
  };
  // Enquanto o painel está aberto, o que for solto nele é dele (mesmo antes
  // de a conversa carregar: não cai na tela de baixo nem abre o arquivo).
  const dragging = useFileDrop(panelRef, open, (files) =>
    sendFiles(files, false),
  );
  useEffect(() => {
    topicRef.current = topic?.topicId ?? null;
  }, [topic]);

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
      setReplyTo(null);
      await loadThread(res.data.topicId);
      setLoading(false);
    },
    [labels.error, loadThread],
  );

  // Ícone tocado em alguma linha: abre o painel com aquele pedido/solicitação/item.
  useEffect(() => {
    const onOpen = async (event: Event) => {
      const detail = (event as CustomEvent<ChatTargetDetail>).detail;
      // Caixa flutuante já aberta nesta conversa: só vem para frente, com o
      // que já foi digitado.
      if (
        detail.floating &&
        openRef.current &&
        floatingRef.current &&
        sameChatTarget(targetRef.current, detail)
      ) {
        setRaised((n) => n + 1);
        return;
      }
      openRef.current = true;
      floatingRef.current = !!detail.floating;
      targetRef.current = detail;
      setFloating(!!detail.floating);
      setOpen(true);
      setTarget(detail);
      setCtx(null);
      setTopic(null);
      setView(null);
      setReplyTo(null);
      setBody(detail.draft ?? "");
      setDraft(detail.draft ?? "");
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

  // Esc fecha (a caixa flutuante, só com o foco nela: a tela continua usável).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (
        floatingRef.current &&
        !panelRef.current?.contains(document.activeElement)
      )
        return;
      openRef.current = false;
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Caixa flutuante: no computador, o campo de mensagem já vem com o foco
  // (no celular, não abre o teclado sozinho). Trazida para frente, pisca.
  useEffect(() => {
    if (!open || !floating || !topic) return;
    if (window.matchMedia("(pointer: fine)").matches)
      boxRef.current?.focus({ preventScroll: true });
  }, [open, floating, topic]);
  useEffect(() => {
    if (!raised) return;
    panelRef.current?.animate(
      [
        { transform: "scale(1)" },
        { transform: "scale(1.02)" },
        { transform: "scale(1)" },
      ],
      { duration: 280 },
    );
    if (window.matchMedia("(pointer: fine)").matches)
      boxRef.current?.focus({ preventScroll: true });
  }, [raised]);

  if (!open) return null;

  const close = () => {
    openRef.current = false;
    setOpen(false);
  };

  const choose = (party: string | null, item: string | null) => {
    setPartyId(party);
    setItemId(item);
    if (ctx) void openTopic(ctx, party, item);
  };
  // Só o começo já escrito (sem nada digitado depois) não conta como mensagem.
  const typed = !!body.trim() && body.trim() !== draft.trim();
  const send = async () => {
    if (!topic || !typed || busy) return;
    setBusy(true);
    setError(null);
    const res = await chatSendAction(topic.topicId, body, replyTo?.id ?? null);
    if (!res.ok) setError(labels.error);
    else {
      setBody("");
      setDraft("");
      setReplyTo(null);
      await loadThread(topic.topicId);
    }
    setBusy(false);
  };
  const translate = async (messageId: string) => {
    if (!topic || translating) return;
    setTranslating(messageId);
    const res = await chatTranslateAction(messageId);
    if (!res.ok) setError(labels.error);
    await loadThread(topic.topicId);
    setTranslating(null);
  };
  const chip = (active: boolean) =>
    cx(
      "rounded-full border px-2.5 py-1 text-xs font-medium transition",
      active
        ? "border-brand-600 bg-brand-600 text-white"
        : "border-zinc-300 bg-white text-zinc-700 hover:border-brand-300 hover:bg-brand-50",
    );

  const content = (
    <>
      {dragging ? <ChatDropOverlay label={labels.attach.drop} /> : null}
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
          onClick={close}
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
                  <span className="block max-w-[14rem] truncate">{i.name}</span>
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
        className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto overflow-x-hidden bg-zinc-50 px-3 py-3"
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
                id={`dm-${m.id}`}
                className={cx(
                  "flex rounded-xl",
                  m.mine ? "justify-end" : "justify-start",
                )}
                data-chat-message={m.authorSide}
              >
                <ReplySwipe
                  target={replyTarget(m, labels.reply)}
                  labels={labels.reply}
                  mine={m.mine}
                  onReply={chooseReply}
                  className="max-w-[88%]"
                >
                  <div
                    className={cx(
                      "rounded-2xl px-3 py-2 text-sm shadow-sm",
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
                    {m.replyTo ? (
                      <ReplyQuote
                        quote={m.replyTo}
                        labels={labels.reply}
                        mine={m.mine}
                        prefix="dm-"
                      />
                    ) : null}
                    {m.attachment ? (
                      <ChatAttachmentView
                        attachment={m.attachment}
                        mine={m.mine}
                        intl={labels.intl}
                        downloadLabel={labels.videoDownload}
                      />
                    ) : null}
                    {m.attachment &&
                    m.body === `📎 ${m.attachment.name}` ? null : (
                      <p className="whitespace-pre-wrap break-words">
                        {m.tr?.text ?? m.body}
                      </p>
                    )}
                    {m.tr ? (
                      <MessageTranslationNote
                        tr={m.tr}
                        mine={m.mine}
                        retry={
                          <button
                            type="button"
                            onClick={() => void translate(m.id)}
                            disabled={!!translating}
                            className={cx(
                              "rounded px-1 font-semibold underline underline-offset-2 disabled:opacity-60",
                              m.mine ? "text-white" : "text-brand-700",
                            )}
                            data-translate-message={m.id}
                          >
                            {translating === m.id ? "…" : m.tr.retry}
                          </button>
                        }
                      />
                    ) : null}
                  </div>
                </ReplySwipe>
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
        {replyTo ? (
          <ReplyPreview
            target={replyTo}
            labels={labels.reply}
            onCancel={() => setReplyTo(null)}
          />
        ) : null}
        <textarea
          ref={boxRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            // Enter envia; Shift+Enter quebra linha.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          onPaste={(e) => {
            // Print da tela ou imagem copiada: vai como anexo.
            const files = pastedFiles(e);
            if (!files.length) return;
            e.preventDefault();
            sendFiles(files, false);
          }}
          rows={2}
          maxLength={4000}
          placeholder={labels.placeholder}
          disabled={!topic || busy}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-zinc-50"
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <ChatAttachButtons
            labels={labels.attach}
            disabled={!topic || upload.busy}
            onFiles={sendFiles}
          />
          <button
            type="submit"
            disabled={!topic || busy || !typed}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
            data-chat-send
          >
            {busy ? labels.sending : labels.send}
          </button>
        </div>
        <div className="mt-1.5">
          <ChatUploadStatus status={upload.status} error={upload.error} />
        </div>
        <div className="mt-1 text-xs text-zinc-500">
          <span className="block">
            {labels.attachHint} {labels.reply.hint}
          </span>
          {topic ? (
            <Link
              href={`/app/messages?c=${topic.conversationId}&t=${topic.topicId}`}
              // A caixa flutuante fecha: a conversa segue na página Mensagens.
              onClick={floating ? close : undefined}
              className="font-medium text-brand-700 underline underline-offset-2"
              data-chat-open-full
            >
              {labels.openFull}
            </Link>
          ) : null}
        </div>
      </form>
    </>
  );

  if (floating) {
    // Teclado aberto no celular: a caixa sobe acima dele e cabe na área
    // visível, abaixo do cabeçalho do portal.
    const [overlap, visible] = keyboard ? keyboard.split(":").map(Number) : [];
    return (
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="false"
        aria-label={labels.title}
        className="fixed bottom-[max(0.5rem,env(safe-area-inset-bottom))] left-2 right-2 z-30 flex h-[calc(100dvh-var(--wm-header)-1rem)] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl sm:bottom-4 sm:left-auto sm:right-4 sm:h-[min(36rem,calc(100dvh-var(--wm-header)-2rem))] sm:w-[24rem] print:hidden"
        style={
          keyboard
            ? {
                bottom: overlap + 8,
                maxHeight: Math.max(220, visible - 72),
              }
            : undefined
        }
        data-chat-drawer
        data-chat-floating
        data-chat-raised={raised}
      >
        {content}
      </div>
    );
  }
  return (
    <div
      ref={panelRef}
      className="fixed inset-0 z-50 flex justify-end"
      data-chat-drawer
    >
      {/* Fundo: tocar fora fecha. */}
      <button
        type="button"
        aria-label={labels.close}
        onClick={close}
        className="absolute inset-0 bg-zinc-900/30"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={labels.title}
        className="relative flex h-full w-full max-w-[30rem] flex-col bg-white shadow-2xl"
      >
        {content}
      </aside>
    </div>
  );
}
