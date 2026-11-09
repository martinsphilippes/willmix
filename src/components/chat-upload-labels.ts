import type { Translate } from "@/i18n";
import type { ChatReplyLabels } from "@/lib/chat-reply";
import type { ChatUploadLabels } from "./chat-upload";

/**
 * Textos do envio de fotos e arquivos do chat no idioma de quem vê (painel
 * lateral e tela de Mensagens), com o motivo de cada recusa do servidor.
 */
export function chatUploadLabels(t: Translate): ChatUploadLabels {
  return {
    photo: t("messages.attach.photo"),
    photoTitle: t("messages.attach.photoTitle"),
    file: t("messages.attach.file"),
    fileTitle: t("messages.attach.fileTitle"),
    progress: t("messages.attach.progress"),
    progressPercent: t("messages.attach.progressPercent"),
    drop: t("messages.attach.drop"),
    failedFile: t("messages.attach.failedFile"),
    failed: t("messages.attach.failed"),
    tooBig: t("messages.attach.tooBig"),
    videoTooBig: t("messages.attach.videoTooBig"),
    serverOnly: t("messages.attach.serverOnly"),
    errors: {
      mime: t("messages.error.mime"),
      too_large: t("messages.error.too_large"),
      empty: t("messages.error.empty"),
      upload_missing: t("messages.error.upload_missing"),
      forbidden: t("messages.error.forbidden"),
      not_found: t("messages.error.not_found"),
      message_too_long: t("messages.error.message_too_long"),
      reply_not_found: t("messages.error.reply_not_found"),
    },
  };
}

/** Textos do responder a uma mensagem marcada, no idioma de quem vê. */
export function chatReplyLabels(t: Translate): ChatReplyLabels {
  return {
    reply: t("messages.reply"),
    to: t("messages.reply.to"),
    cancel: t("messages.reply.cancel"),
    hint: t("messages.reply.hint"),
    photo: t("messages.reply.photo"),
    video: t("messages.reply.video"),
    original: t("messages.reply.original"),
    you: t("messages.you"),
  };
}
