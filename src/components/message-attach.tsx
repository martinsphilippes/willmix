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

/**
 * Fotos e arquivos na tela de Mensagens (dentro do formulário de envio):
 * botões "Foto" e "Arquivo" (vários de uma vez), arrastar arquivos para
 * qualquer ponto da tela ou colar um print na caixa de texto. O texto já
 * digitado vai junto com o primeiro arquivo; cada arquivo vira uma mensagem
 * e a conversa se atualiza a cada envio.
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
  /** Caixa de texto do formulário em que o componente está. */
  const box = () => {
    const field = ref.current?.closest("form")?.elements.namedItem("body");
    return field instanceof HTMLTextAreaElement ? field : null;
  };
  const upload = useChatUpload({
    labels,
    onSent: () => router.refresh(),
    // O texto foi junto com a foto: limpa a caixa (se não mudou depois).
    onCaptionSent: (caption) => {
      const field = box();
      if (field && field.value.trim() === caption) field.value = "";
    },
  });
  const sendFiles = (files: File[], photo: boolean) =>
    void upload.send(topicId, files, { caption: box()?.value ?? "", photo });
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
