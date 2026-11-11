"use client";

import { useEffect, useRef, useState } from "react";
import { postSupplierRequestMessageAction } from "../../actions/supplier-requests";
import { SubmitButton } from "@/components/submit-button";
import { cx } from "@/components/ui";
import { ChatBubbleIcon, ClipIcon, CloseIcon, SendIcon } from "./icons";

/*
 * Conversa da solicitação ao fornecedor (docs/SUPPLIER_REQUESTS.md,
 * "Negociação", item 4) num ícone flutuante: toca e abre uma janela pequena
 * no canto inferior direito com as mensagens e o campo para mandar outra,
 * com foto, PDF ou Excel. A mensagem vai pela mesma Server Action de sempre.
 */

export interface ChatMessage {
  id: string;
  mine: boolean;
  sideLabel: string;
  at: string;
  text: string | null;
  documentId: string | null;
  fileName: string | null;
}

const ACCEPT =
  "image/png,image/jpeg,image/webp,image/heic,image/heif,application/pdf,.xlsx,.xls,.xlsm";

export function RequestChat({
  requestId,
  messages,
  canPost,
  defaultOpen,
  labels,
}: {
  requestId: string;
  messages: ChatMessage[];
  canPost: boolean;
  defaultOpen: boolean;
  labels: {
    open: string;
    title: string;
    close: string;
    empty: string;
    placeholder: string;
    attach: string;
    send: string;
    sending: string;
    file: string;
    closed: string;
  };
}) {
  const [open, setOpen] = useState(defaultOpen);
  const list = useRef<HTMLOListElement>(null);

  // Mensagem nova (a tela volta da ação): rola até o fim. O formulário
  // renasce (key) e o campo volta vazio.
  useEffect(() => {
    if (!open) return;
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [open, messages.length]);

  return (
    <div className="fixed bottom-4 right-4 z-30 flex flex-col items-end gap-3 print:hidden">
      {open ? (
        <section
          className="flex h-[min(30rem,calc(100dvh-7rem))] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl"
          aria-label={labels.title}
          data-request-chat
        >
          <header className="flex items-center justify-between gap-2 bg-brand-600 px-4 py-2.5 text-white">
            <h2 className="truncate text-sm font-semibold">{labels.title}</h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={labels.close}
              title={labels.close}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-white/15"
            >
              <CloseIcon />
            </button>
          </header>
          <ol
            ref={list}
            className="flex-1 space-y-2 overflow-y-auto bg-zinc-50 px-3 py-3"
            data-request-chat-messages
          >
            {messages.length ? (
              messages.map((m) => (
                <li
                  key={m.id}
                  className={cx(
                    "flex",
                    m.mine ? "justify-end" : "justify-start",
                  )}
                  data-request-chat-message={m.mine ? "mine" : "other"}
                >
                  <div
                    className={cx(
                      "max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                      m.mine
                        ? "rounded-br-md bg-brand-600 text-white"
                        : "rounded-bl-md border border-zinc-200 bg-white text-zinc-900",
                    )}
                  >
                    {m.text ? (
                      <p className="whitespace-pre-wrap break-words">
                        {m.text}
                      </p>
                    ) : null}
                    {m.documentId ? (
                      <a
                        href={`/api/files/${m.documentId}`}
                        target="_blank"
                        rel="noreferrer"
                        className={cx(
                          "mt-1 flex items-center gap-1 underline",
                          m.mine ? "text-white" : "text-sky-700",
                        )}
                        data-negotiation-file
                      >
                        <ClipIcon className="h-3.5 w-3.5" />
                        <span className="truncate">
                          {m.fileName ?? labels.file}
                        </span>
                      </a>
                    ) : null}
                    <p
                      className={cx(
                        "mt-1 text-[10px]",
                        m.mine ? "text-white/75" : "text-zinc-500",
                      )}
                    >
                      {m.sideLabel} · {m.at}
                    </p>
                  </div>
                </li>
              ))
            ) : (
              <li className="py-6 text-center text-xs text-zinc-500">
                {labels.empty}
              </li>
            )}
          </ol>
          {canPost ? (
            <ChatForm
              key={messages.length}
              requestId={requestId}
              labels={labels}
            />
          ) : (
            <p className="border-t border-zinc-200 bg-white p-3 text-center text-xs text-zinc-500">
              {labels.closed}
            </p>
          )}
        </section>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={labels.open}
        aria-expanded={open}
        title={labels.open}
        className="relative inline-flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-xl transition hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        data-request-chat-toggle
      >
        {open ? (
          <CloseIcon className="h-6 w-6" />
        ) : (
          <ChatBubbleIcon className="h-6 w-6" />
        )}
        {!open && messages.length ? (
          <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-amber-400 px-1 text-[11px] font-bold text-zinc-900">
            {messages.length}
          </span>
        ) : null}
      </button>
    </div>
  );
}

/** Campo de mensagem com anexo (renasce vazio depois de cada envio). */
function ChatForm({
  requestId,
  labels,
}: {
  requestId: string;
  labels: { attach: string; placeholder: string; send: string };
}) {
  const [fileName, setFileName] = useState("");
  return (
    <form
      action={postSupplierRequestMessageAction}
      className="border-t border-zinc-200 bg-white p-2"
      data-negotiation-message-form
    >
      <input type="hidden" name="id" value={requestId} />
      <input type="hidden" name="view" value="item" />
      <input type="hidden" name="chat" value="1" />
      {fileName ? (
        <p className="mb-1 truncate px-1 text-xs text-zinc-600">
          📎 {fileName}
        </p>
      ) : null}
      <div className="flex items-end gap-1.5">
        <label
          className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100"
          title={labels.attach}
        >
          <span className="sr-only">{labels.attach}</span>
          <ClipIcon />
          <input
            type="file"
            name="file"
            accept={ACCEPT}
            className="sr-only"
            onChange={(e) =>
              setFileName(e.currentTarget.files?.[0]?.name ?? "")
            }
            data-negotiation-message-file
          />
        </label>
        <textarea
          name="text"
          rows={1}
          maxLength={4000}
          placeholder={labels.placeholder}
          aria-label={labels.placeholder}
          className="max-h-28 min-h-9 flex-1 resize-y rounded-2xl border border-zinc-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          data-negotiation-message-text
        />
        <SubmitButton
          className="h-9 w-9 shrink-0 rounded-full p-0"
          aria-label={labels.send}
          title={labels.send}
          pendingText="…"
          data-negotiation-message-submit
        >
          <SendIcon />
        </SubmitButton>
      </div>
    </form>
  );
}
