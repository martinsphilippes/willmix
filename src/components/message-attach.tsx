"use client";

import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useRef } from "react";
import {
  ChatAttachButtons,
  ChatDropOverlay,
  ChatUploadStatus,
} from "./chat-attach";
import { namePasted, useChatUpload, useFileDrop } from "./chat-upload";
import type { ChatUploadLabels } from "./chat-upload";
import { REPLY_CLEAR_EVENT } from "@/lib/chat-reply";

/**
 * Fotos e arquivos na tela de Mensagens (dentro do formulário de envio):
 * botões "Foto" e "Arquivo" (vários de uma vez), arrastar arquivos para
 * qualquer ponto da tela ou colar um print na caixa de texto. O texto já
 * digitado e a mensagem marcada para responder vão junto com o primeiro
 * arquivo; cada arquivo vira uma mensagem e a conversa se atualiza a cada
 * envio.
 */
export function MessageAttach({
  topicId,
  labels,
}: {
  topicId: string;
  labels: ChatUploadLabels;
}) {
  const router = useRouter();
  const ref = useRef<HTMLSpanElement>(null);
  /** Campo do formulário em que o componente está (texto, resposta). */
  const field = (name: string) => {
    const el = ref.current?.closest("form")?.elements.namedItem(name);
    return el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement
      ? el
      : null;
  };
  const upload = useChatUpload({
    labels,
    onSent: () => router.refresh(),
    // O texto e a resposta foram junto com o arquivo: limpa a caixa (se não
    // mudou depois) e esquece a mensagem marcada.
    onFirstSent: (caption) => {
      const box = field("body");
      if (box && caption && box.value.trim() === caption) box.value = "";
      window.dispatchEvent(new Event(REPLY_CLEAR_EVENT));
    },
  });
  const sendFiles = (files: File[], photo: boolean) =>
    void upload.send(topicId, files, {
      caption: field("body")?.value ?? "",
      replyToMessageId: field("replyToMessageId")?.value || null,
      photo,
    });
  const dragging = useFileDrop(null, true, (files) => sendFiles(files, false));
  // Print da tela ou imagem copiada, colado na caixa de texto: vai como anexo.
  const pasted = useEffectEvent((e: ClipboardEvent) => {
    const files = Array.from(e.clipboardData?.files ?? []).map(namePasted);
    if (!files.length) return;
    e.preventDefault();
    sendFiles(files, false);
  });
  useEffect(() => {
    const field = ref.current?.closest("form")?.elements.namedItem("body");
    if (!(field instanceof HTMLTextAreaElement)) return;
    const onPaste = (e: ClipboardEvent) => pasted(e);
    field.addEventListener("paste", onPaste);
    return () => field.removeEventListener("paste", onPaste);
  }, []);
  return (
    <span ref={ref} className="inline-flex max-w-full flex-col gap-1">
      <ChatAttachButtons
        labels={labels}
        disabled={upload.busy}
        onFiles={sendFiles}
      />
      <ChatUploadStatus status={upload.status} error={upload.error} />
      {dragging ? <ChatDropOverlay label={labels.drop} fixed /> : null}
    </span>
  );
}
