"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  REPLY_CLEAR_EVENT,
  REPLY_EVENT,
  REPLY_SWIPE_PX,
  attachmentLabel,
  type ChatReplyLabels,
  type ReplyTarget,
} from "@/lib/chat-reply";
import type { MessageQuote } from "@/lib/services/messages";
import { cx } from "./ui";

/*
 * Responder a uma mensagem marcada, como no WhatsApp: arrastar a mensagem
 * para a direita (dedo ou mouse) ou tocar em "↩" ao lado dela. A escolha
 * aparece em cima da caixa de texto ("Respondendo a …", com ✕ para
 * desistir); a resposta mostra a citação, e tocar nela leva à mensagem
 * original. Regras e resumo em src/lib/chat-reply.ts; o servidor confere que
 * a mensagem marcada é do mesmo assunto.
 */

/** Quanto a mensagem anda no máximo ao ser arrastada. */
const MAX_PULL = 88;

export function ReplySwipe({
  target,
  labels,
  mine,
  onReply,
  className,
  children,
}: {
  target: ReplyTarget;
  labels: Pick<ChatReplyLabels, "reply">;
  /** Mensagem de quem vê (à direita): o botão "↩" fica à esquerda dela. */
  mine: boolean;
  /** Painel lateral: guarda a escolha; sem isso, avisa a tela (REPLY_EVENT). */
  onReply?: (target: ReplyTarget) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const [pull, setPull] = useState(0);
  const drag = useRef<{
    x: number;
    y: number;
    id: number;
    axis: "x" | "y" | null;
  } | null>(null);
  const pulled = useRef(0);
  // Depois de arrastar, o soltar do mouse não abre a foto/o link embaixo.
  const swiped = useRef(false);

  const reply = () => {
    if (onReply) onReply(target);
    else
      window.dispatchEvent(
        new CustomEvent<ReplyTarget>(REPLY_EVENT, { detail: target }),
      );
    try {
      navigator.vibrate?.(10);
    } catch {
      // Sem vibração no aparelho: segue.
    }
  };
  const reset = () => {
    drag.current = null;
    pulled.current = 0;
    setPull(0);
  };

  return (
    <div
      className={cx("group relative min-w-0", className)}
      style={{ touchAction: "pan-y" }}
      data-reply-swipe={target.id}
      onPointerDown={(e) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        // Os controles do vídeo e os campos continuam funcionando. Começar em
        // cima da citação ou de um link também vale: só um toque parado abre.
        if (
          (e.target as HTMLElement).closest(
            "video, audio, input, textarea, select, [data-no-swipe]",
          )
        )
          return;
        drag.current = {
          x: e.clientX,
          y: e.clientY,
          id: e.pointerId,
          axis: null,
        };
        swiped.current = false;
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d || d.id !== e.pointerId) return;
        const dx = e.clientX - d.x;
        const dy = e.clientY - d.y;
        if (!d.axis) {
          if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
          // Para a direita e mais de lado que de cima a baixo: é o "responder";
          // senão a conversa rola normalmente.
          d.axis = dx > 0 && Math.abs(dx) > Math.abs(dy) ? "x" : "y";
          if (d.axis === "x") {
            e.currentTarget.setPointerCapture(e.pointerId);
            window.getSelection()?.removeAllRanges();
          }
        }
        if (d.axis !== "x") return;
        e.preventDefault();
        pulled.current = Math.max(0, Math.min(dx, MAX_PULL));
        setPull(pulled.current);
      }}
      onPointerUp={() => {
        if (drag.current?.axis === "x" && pulled.current >= REPLY_SWIPE_PX) {
          swiped.current = true;
          reply();
        } else if (drag.current?.axis === "x") swiped.current = true;
        reset();
      }}
      onPointerCancel={reset}
      onClickCapture={(e) => {
        if (!swiped.current) return;
        swiped.current = false;
        e.preventDefault();
        e.stopPropagation();
      }}
      onDragStart={(e) => {
        // Arrastar a foto da mensagem não tira a foto da conversa.
        if (drag.current) e.preventDefault();
      }}
    >
      {/* Seta que aparece enquanto a mensagem é arrastada. */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-zinc-200 px-1.5 py-0.5 text-sm text-zinc-700"
        style={{
          opacity: Math.min(1, pull / REPLY_SWIPE_PX),
          transform: `translateY(-50%) scale(${pull >= REPLY_SWIPE_PX ? 1.15 : 1})`,
        }}
      >
        ↩
      </span>
      <div
        className={cx(
          "relative",
          pull > 0 ? "select-none" : "transition-transform duration-150",
        )}
        style={{ transform: pull ? `translateX(${pull}px)` : undefined }}
      >
        {children}
      </div>
      {/* No computador: "↩" ao passar o mouse (no toque, arrastar). */}
      <button
        type="button"
        onClick={reply}
        aria-label={labels.reply}
        title={labels.reply}
        className={cx(
          "absolute top-1/2 hidden -translate-y-1/2 rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-sm text-zinc-600 opacity-0 shadow-sm transition hover:bg-brand-50 hover:text-brand-700 focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:hover)]:block",
          mine ? "right-full mr-1.5" : "left-full ml-1.5",
        )}
        data-reply-button={target.id}
      >
        ↩
      </button>
    </div>
  );
}

/** Citação dentro da resposta; tocar leva à mensagem original e a destaca. */
export function ReplyQuote({
  quote,
  labels,
  mine,
  prefix,
}: {
  quote: MessageQuote;
  labels: Pick<ChatReplyLabels, "photo" | "video" | "original" | "you">;
  /** A resposta é de quem vê (balão escuro): cores claras. */
  mine: boolean;
  /** Prefixo do id das mensagens na tela ("m-" ou "dm-", no painel). */
  prefix: string;
}) {
  const text = quote.text ?? attachmentLabel(quote.attachment, labels);
  return (
    <button
      type="button"
      title={labels.original}
      onClick={() => {
        const el = document.getElementById(`${prefix}${quote.id}`);
        if (!el) return;
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.animate(
          [
            { backgroundColor: "rgba(250, 204, 21, 0.45)" },
            { backgroundColor: "rgba(250, 204, 21, 0)" },
          ],
          { duration: 1800, easing: "ease-out" },
        );
      }}
      className={cx(
        "mb-1.5 block w-full min-w-0 rounded-lg border-l-4 px-2.5 py-1.5 text-left text-xs transition",
        mine
          ? "border-white/80 bg-white/15 text-white hover:bg-white/25"
          : "border-brand-500 bg-zinc-100 text-zinc-700 hover:bg-zinc-200",
      )}
      data-reply-quote={quote.id}
    >
      <span
        className={cx(
          "block font-semibold",
          mine ? "text-white" : "text-brand-800",
        )}
      >
        {quote.mine ? labels.you : quote.authorName}
      </span>
      <span className="line-clamp-2 break-words">{text}</span>
    </button>
  );
}

/** "Respondendo a …" em cima da caixa de texto, com ✕ para desistir. */
export function ReplyPreview({
  target,
  labels,
  onCancel,
}: {
  target: ReplyTarget;
  labels: Pick<ChatReplyLabels, "to" | "cancel">;
  onCancel: () => void;
}) {
  return (
    <div
      className="mb-2 flex items-start gap-2 rounded-lg border-l-4 border-brand-500 bg-brand-50 px-3 py-2 text-xs"
      data-reply-preview={target.id}
    >
      <span aria-hidden className="text-sm leading-4 text-brand-700">
        ↩
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-brand-800">
          {labels.to.replace("{name}", target.author)}
        </div>
        <div className="line-clamp-2 break-words text-zinc-700">
          {target.text}
        </div>
      </div>
      <button
        type="button"
        onClick={onCancel}
        aria-label={labels.cancel}
        title={labels.cancel}
        className="rounded px-1.5 text-sm leading-5 text-zinc-500 hover:bg-white hover:text-zinc-800"
        data-reply-cancel
      >
        ✕
      </button>
    </div>
  );
}

/**
 * Tela de Mensagens (dentro do formulário de envio): guarda a mensagem
 * escolhida (REPLY_EVENT), mostra "Respondendo a …" e manda o id no campo
 * `replyToMessageId`. Esquece a escolha depois do envio, no ✕, quando a
 * resposta vai junto com um arquivo (REPLY_CLEAR_EVENT) e ao trocar de
 * assunto (a tela remonta o componente).
 */
export function ReplyComposer({ labels }: { labels: ChatReplyLabels }) {
  const [target, setTarget] = useState<ReplyTarget | null>(null);
  const anchor = useRef<HTMLSpanElement>(null);
  const { pending } = useFormStatus();
  const wasPending = useRef(false);
  useEffect(() => {
    // Terminou o envio do formulário: a resposta já foi.
    if (wasPending.current && !pending) setTarget(null);
    wasPending.current = pending;
  }, [pending]);
  useEffect(() => {
    const choose = (e: Event) => {
      setTarget((e as CustomEvent<ReplyTarget>).detail);
      const field = anchor.current?.closest("form")?.elements.namedItem("body");
      if (field instanceof HTMLTextAreaElement) field.focus();
    };
    const clear = () => setTarget(null);
    window.addEventListener(REPLY_EVENT, choose);
    window.addEventListener(REPLY_CLEAR_EVENT, clear);
    return () => {
      window.removeEventListener(REPLY_EVENT, choose);
      window.removeEventListener(REPLY_CLEAR_EVENT, clear);
    };
  }, []);
  return (
    <>
      <span ref={anchor} hidden />
      {target ? (
        <>
          <input type="hidden" name="replyToMessageId" value={target.id} />
          <ReplyPreview
            target={target}
            labels={labels}
            onCancel={() => setTarget(null)}
          />
        </>
      ) : null}
    </>
  );
}
