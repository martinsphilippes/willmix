"use client";

import { useRef, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { attachPastedImage } from "@/lib/paste-image";
import { ClipIcon, SendIcon } from "./icons";

/*
 * Campo de mensagem da conversa da cotação de compra: texto e um anexo
 * (foto, PDF ou Excel), que também entra colando uma imagem copiada do card
 * "Imagens" da tela do item (dono, 22/11/2026). Enter envia; Shift+Enter
 * quebra a linha.
 */

const ACCEPT =
  "image/png,image/jpeg,image/webp,image/heic,image/heif,application/pdf,.xlsx,.xls,.xlsm";

export function ChatComposer({
  labels,
}: {
  labels: { placeholder: string; attach: string; send: string };
}) {
  const [fileName, setFileName] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  return (
    <>
      {fileName ? (
        <p
          className="mb-1 truncate px-1 text-xs text-zinc-600"
          data-quote-chat-file-name
        >
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
            ref={fileInput}
            type="file"
            name="file"
            accept={ACCEPT}
            className="sr-only"
            onChange={(e) =>
              setFileName(e.currentTarget.files?.[0]?.name ?? "")
            }
            data-quote-chat-file
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
          onPaste={(e) => {
            const name = attachPastedImage(e, fileInput.current);
            if (name) setFileName(name);
          }}
          data-quote-chat-text
        />
        <SubmitButton
          className="h-9 shrink-0 px-3"
          aria-label={labels.send}
          title={labels.send}
          pendingText="…"
          data-quote-chat-submit
        >
          <SendIcon />
        </SubmitButton>
      </div>
    </>
  );
}
