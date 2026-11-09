import type { Translate } from "@/i18n";
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
    serverOnly: t("messages.attach.serverOnly"),
    errors: {
      mime: t("messages.error.mime"),
      too_large: t("messages.error.too_large"),
      empty: t("messages.error.empty"),
      upload_missing: t("messages.error.upload_missing"),
      forbidden: t("messages.error.forbidden"),
      not_found: t("messages.error.not_found"),
      message_too_long: t("messages.error.message_too_long"),
    },
  };
}
