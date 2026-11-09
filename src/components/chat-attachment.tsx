import { fileIcon, fileSizeLabel, fileTypeLabel } from "@/lib/file-kinds";
import { cx } from "./ui";

/*
 * Anexo dentro de uma mensagem (tela de Mensagens e painel lateral): foto em
 * miniatura (tocar abre grande) ou cartão do arquivo com ícone, nome, tipo e
 * tamanho (vídeo e planilha baixam). O arquivo abre por /api/files, que
 * confere quem pode ver o assunto.
 */

export interface ChatAttachment {
  id: string;
  name: string;
  isImage: boolean;
  size: number;
}

export function ChatAttachmentView({
  attachment,
  mine,
  intl,
}: {
  attachment: ChatAttachment;
  /** Mensagem de quem vê (balão escuro): cores claras. */
  mine: boolean;
  intl: string;
}) {
  const href = `/api/files/${attachment.id}`;
  if (attachment.isImage)
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener"
        title={attachment.name}
        className="mb-1 block"
        data-attachment="image"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido por /api/files com sessão */}
        <img
          src={href}
          alt={attachment.name}
          loading="lazy"
          className="max-h-60 max-w-full rounded-lg bg-white object-contain"
        />
      </a>
    );
  const meta = [
    fileTypeLabel(attachment.name),
    fileSizeLabel(attachment.size, intl),
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      className={cx(
        "mb-1 flex max-w-full items-center gap-2 rounded-lg border px-2.5 py-2",
        mine
          ? "border-white/30 bg-white/10 text-white hover:bg-white/20"
          : "border-zinc-200 bg-zinc-50 text-brand-700 hover:bg-brand-50",
      )}
      data-attachment="file"
    >
      <span aria-hidden className="text-xl leading-none">
        {fileIcon(attachment.name)}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-semibold underline underline-offset-2">
          {attachment.name}
        </span>
        {meta ? (
          <span
            className={cx(
              "block text-[11px]",
              mine ? "text-white/80" : "text-zinc-500",
            )}
          >
            {meta}
          </span>
        ) : null}
      </span>
    </a>
  );
}
