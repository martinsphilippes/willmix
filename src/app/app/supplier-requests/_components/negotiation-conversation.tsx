"use client";

import { useEffect, useRef, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { cx } from "@/components/ui";
import { postSupplierRequestMessageStateAction } from "../../actions/supplier-requests";
import { ChatBubbleIcon, ClipIcon, SendIcon } from "./icons";
import { attachPastedImage } from "@/lib/paste-image";

/*
 * Conversa da solicitação ao fornecedor dentro da seção "Negociação e
 * conversa" (docs/SUPPLIER_REQUESTS.md, "Tela da negociação reorganizada"),
 * no lugar do chat flutuante: abre e recolhe no próprio card, sem cobrir os
 * botões. Cada mensagem mostra quem mandou (nome e login), para quem foi o
 * aviso e a data e a hora; acima do campo, "Enviando como" e "Enviando
 * para". A mensagem vai pela mesma Server Action de sempre (a variante que
 * devolve o erro): dando errado, o texto e o arquivo continuam no campo.
 */

export interface ConversationMessage {
  id: string;
  mine: boolean;
  side: "wellmix" | "supplier";
  sideLabel: string;
  /** "Nome · Você" do autor. */
  author: string;
  /** Login do autor, quando quem vê pode vê-lo. */
  login: string | null;
  /** Quem recebeu o aviso. */
  to: string;
  at: string;
  text: string | null;
  documentId: string | null;
  fileName: string | null;
}

const ACCEPT =
  "image/png,image/jpeg,image/webp,image/heic,image/heif,application/pdf,.xlsx,.xls,.xlsm";

export function NegotiationConversation({
  requestId,
  board,
  messages,
  canPost,
  defaultOpen,
  sendingAs,
  sendingTo,
  errors,
  fallbackError,
  labels,
}: {
  requestId: string;
  /**
   * Quadro comparativo (docs/QUOTATION.md): a solicitação da tela em que a
   * conversa está aberta (num modal); o envio volta para ela.
   */
  board?: string;
  messages: ConversationMessage[];
  canPost: boolean;
  defaultOpen: boolean;
  /** "Nome (login)" de quem está vendo. */
  sendingAs: string;
  /** Quem recebe o aviso do que ele mandar. */
  sendingTo: string;
  errors: Record<string, string>;
  fallbackError: string;
  labels: {
    title: string;
    who: string;
    empty: string;
    placeholder: string;
    attach: string;
    send: string;
    sending: string;
    file: string;
    closed: string;
    sendingAs: string;
    sendingTo: string;
    to: string;
    login: string;
  };
}) {
  const [open, setOpen] = useState(defaultOpen);
  const list = useRef<HTMLOListElement>(null);

  // Aberta ou com mensagem nova (a tela volta da ação): rola até a última.
  useEffect(() => {
    if (!open) return;
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [open, messages.length]);

  return (
    <details
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="group/chat rounded-lg border border-zinc-200 bg-white"
      data-request-chat
    >
      <summary
        className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-brand-600 [&::-webkit-details-marker]:hidden"
        aria-expanded={open}
        data-request-chat-toggle
      >
        <span className="inline-flex items-center gap-2">
          <ChatBubbleIcon className="h-4 w-4 text-brand-600" />
          {labels.title}
        </span>
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          className="h-4 w-4 text-zinc-500 transition-transform group-open/chat:rotate-180"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="m5 8 5 5 5-5" />
        </svg>
      </summary>
      <div className="border-t border-zinc-200">
        <p className="px-3 pt-2 text-[11px] text-zinc-500">{labels.who}</p>
        <ol
          ref={list}
          className="max-h-[26rem] space-y-2 overflow-y-auto px-3 py-2"
          data-request-chat-messages
        >
          {messages.length ? (
            messages.map((m) => (
              <li
                key={m.id}
                className={cx("flex", m.mine ? "justify-end" : "justify-start")}
                data-request-chat-message={m.mine ? "mine" : "other"}
              >
                <div
                  className={cx(
                    "max-w-[85%] rounded-xl px-3 py-2 text-[13px] shadow-sm",
                    m.mine
                      ? "rounded-br-sm bg-brand-50 text-zinc-900 ring-1 ring-brand-100"
                      : "rounded-bl-sm bg-zinc-50 text-zinc-900 ring-1 ring-zinc-200",
                  )}
                >
                  <p className="text-xs" data-request-chat-author>
                    <span className="font-semibold">{m.author}</span>
                    <span className="text-zinc-500"> · {m.sideLabel}</span>
                  </p>
                  {m.login ? (
                    <p className="break-all text-[11px] text-zinc-500">
                      {labels.login.replace("{login}", m.login)}
                    </p>
                  ) : null}
                  {m.text ? (
                    <p className="mt-1 whitespace-pre-wrap break-words">
                      {m.text}
                    </p>
                  ) : null}
                  {m.documentId ? (
                    <a
                      href={`/api/files/${m.documentId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 flex items-center gap-1 text-sky-700 underline"
                      data-negotiation-file
                    >
                      <ClipIcon className="h-3.5 w-3.5 shrink-0" />
                      <span className="break-all">
                        {m.fileName ?? labels.file}
                      </span>
                    </a>
                  ) : null}
                  <p className="mt-1 break-words text-[11px] text-zinc-500">
                    <span data-request-chat-to>
                      {labels.to}: {m.to}
                    </span>{" "}
                    · {m.at}
                  </p>
                </div>
              </li>
            ))
          ) : (
            <li className="py-4 text-center text-xs text-zinc-500">
              {labels.empty}
            </li>
          )}
        </ol>
        {canPost ? (
          <MessageForm
            // Mensagem gravada: o formulário renasce vazio.
            key={messages.length}
            requestId={requestId}
            board={board}
            sendingAs={sendingAs}
            sendingTo={sendingTo}
            errors={errors}
            fallbackError={fallbackError}
            labels={labels}
          />
        ) : (
          <p className="border-t border-zinc-200 p-3 text-center text-xs text-zinc-500">
            {labels.closed}
          </p>
        )}
      </div>
    </details>
  );
}

/** Campo de mensagem com anexo, "Enviando como" e "Enviando para". */
function MessageForm({
  requestId,
  board,
  sendingAs,
  sendingTo,
  errors,
  fallbackError,
  labels,
}: {
  requestId: string;
  board?: string;
  sendingAs: string;
  sendingTo: string;
  errors: Record<string, string>;
  fallbackError: string;
  labels: {
    attach: string;
    placeholder: string;
    send: string;
    sending: string;
    sendingAs: string;
    sendingTo: string;
  };
}) {
  const [fileName, setFileName] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  return (
    <ActionForm
      action={postSupplierRequestMessageStateAction}
      errors={errors}
      fallbackError={fallbackError}
      pendingLabel={labels.sending}
      className="border-t border-zinc-200 p-2"
      data-negotiation-message-form
    >
      <input type="hidden" name="id" value={requestId} />
      {board ? <input type="hidden" name="board" value={board} /> : null}
      <input type="hidden" name="view" value="item" />
      <input type="hidden" name="chat" value="1" />
      <p
        className="mb-1 flex flex-wrap gap-x-4 gap-y-0.5 px-1 text-xs text-zinc-600"
        data-negotiation-from-to
      >
        <span>
          <span className="font-semibold text-zinc-500">
            {labels.sendingAs}:
          </span>{" "}
          <span data-request-chat-sending-as>{sendingAs}</span>
        </span>
        <span>
          <span className="font-semibold text-zinc-500">
            {labels.sendingTo}:
          </span>{" "}
          <span data-request-chat-sending-to>{sendingTo}</span>
        </span>
      </p>
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
            ref={fileInput}
            onChange={(e) =>
              setFileName(e.currentTarget.files?.[0]?.name ?? "")
            }
            data-negotiation-message-file
          />
        </label>
        <textarea
          name="text"
          rows={2}
          maxLength={4000}
          placeholder={labels.placeholder}
          aria-label={labels.placeholder}
          className="max-h-40 min-h-9 flex-1 resize-y rounded-lg border border-zinc-300 px-2.5 py-1.5 text-[13px] leading-5 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          // Imagem colada (copiada do card "Imagens" da tela do item, dono,
          // 22/11/2026): vira o anexo da mensagem.
          onPaste={(e) => {
            const name = attachPastedImage(e, fileInput.current);
            if (name) setFileName(name);
          }}
          data-negotiation-message-text
        />
        <SubmitButton
          className="h-9 shrink-0 px-3"
          aria-label={labels.send}
          title={labels.send}
          pendingText="…"
          data-negotiation-message-submit
        >
          <SendIcon />
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
