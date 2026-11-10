"use client";

import type { ChatUploadLabels } from "./chat-upload";
import { cx } from "./ui";

/**
 * Botões "Foto ou vídeo" e "Arquivo" do chat, vários de uma vez. "Foto ou
 * vídeo" abre a câmera ou a galeria (fotos e vídeos); "Arquivo", qualquer
 * arquivo (PDF, planilha, vídeo, foto original). O campo de arquivo (invisível) cobre o botão inteiro: no
 * iPad/iPhone, tocar num rótulo com o campo escondido dentro não abria o
 * seletor.
 */
export function ChatAttachButtons({
  labels,
  disabled,
  onFiles,
}: {
  labels: Pick<ChatUploadLabels, "photo" | "photoTitle" | "file" | "fileTitle">;
  disabled?: boolean;
  onFiles: (files: File[], photo: boolean) => void;
}) {
  const button = (photo: boolean) => (
    <span
      className={cx(
        "relative inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold shadow-sm transition focus-within:ring-2 focus-within:ring-brand-200",
        disabled
          ? "cursor-not-allowed border-zinc-200 bg-zinc-50 text-zinc-400"
          : "cursor-pointer border-brand-300 bg-white text-brand-700 hover:bg-brand-50 active:bg-brand-100",
      )}
      data-chat-attach={photo ? "photo" : "file"}
      // Segundo caminho (como no botão de foto das fichas): o toque que cair
      // no botão, e não no campo invisível, abre o seletor do mesmo jeito.
      onClick={(event) => {
        const field = event.currentTarget.querySelector("input");
        if (!field || field.disabled || event.target === field) return;
        field.click();
      }}
    >
      <span aria-hidden>{photo ? "📷" : "📎"}</span>
      <span aria-hidden>{photo ? labels.photo : labels.file}</span>
      <input
        type="file"
        multiple
        accept={photo ? "image/*,video/*" : undefined}
        disabled={disabled}
        aria-label={photo ? labels.photo : labels.file}
        title={photo ? labels.photoTitle : labels.fileTitle}
        onChange={(e) => {
          const files = Array.from(e.currentTarget.files ?? []);
          // Limpa para dar para escolher o mesmo arquivo de novo.
          e.currentTarget.value = "";
          if (files.length) onFiles(files, photo);
        }}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
      />
    </span>
  );
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {button(true)}
      {button(false)}
    </span>
  );
}

/** Aviso por cima da conversa enquanto há arquivos sendo arrastados. */
export function ChatDropOverlay({
  label,
  fixed = false,
}: {
  label: string;
  /** Tela inteira (tela de Mensagens) em vez de só o painel. */
  fixed?: boolean;
}) {
  return (
    <div
      className={cx(
        fixed ? "fixed" : "absolute",
        "pointer-events-none inset-0 z-50 flex items-center justify-center bg-brand-600/15 p-4",
      )}
      data-chat-drop
    >
      <span className="rounded-2xl border-2 border-dashed border-brand-500 bg-white/95 px-6 py-4 text-sm font-semibold text-brand-800 shadow-lg">
        <span aria-hidden>📥 </span>
        {label}
      </span>
    </div>
  );
}

/** Linha de andamento ("Enviando 2 de 5…") ou do problema do envio. */
export function ChatUploadStatus({
  status,
  error,
}: {
  status: string | null;
  error: string | null;
}) {
  if (!status && !error) return null;
  return (
    <span className="block space-y-0.5">
      {status ? (
        <span
          className="flex items-center gap-1.5 text-xs font-medium text-brand-700"
          aria-live="polite"
          data-chat-upload-status
        >
          <span
            aria-hidden
            className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-r-transparent"
          />
          {status}
        </span>
      ) : null}
      {error ? (
        <span
          role="alert"
          className="block text-xs font-medium text-red-700"
          data-chat-upload-error
        >
          {error}
        </span>
      ) : null}
    </span>
  );
}
