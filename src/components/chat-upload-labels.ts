import type { Translate } from "@/i18n";
import type { ChatReplyLabels } from "@/lib/chat-reply";
import type { ChatUploadLabels } from "./chat-upload";
import type { ChatIdentityLabels } from "./chat-identity";

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
    preparing: t("messages.attach.preparing"),
    videoTooLong: t("messages.attach.videoTooLong"),
    videoNoReduce: t("messages.attach.videoNoReduce"),
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

/** Textos de quem envia e quem recebe (cabeçalho, mensagens e campo de envio). */
export function chatIdentityLabels(t: Translate): ChatIdentityLabels {
  return {
    sendingAs: t("chat.identity.sendingAs"),
    recipient: t("chat.identity.recipient"),
    participants: t("chat.identity.participants"),
    login: t("chat.identity.login"),
    you: t("messages.you"),
    wellmix: t("messages.side.wellmix"),
    inactive: t("chat.identity.inactive"),
    sendingTo: t("chat.identity.sendingTo"),
    to: t("chat.identity.to"),
    unknownRecipient: t("chat.identity.unknownRecipient"),
    private: t("chat.identity.private"),
    readOnly: {
      legacy: t("chat.identity.readOnly.legacy"),
      observer: t("chat.identity.readOnly.observer"),
      peer_inactive: t("chat.identity.readOnly.peer_inactive"),
    },
    choose: t("chat.identity.choose"),
    chooseHint: t("chat.identity.chooseHint"),
    pickFirst: t("chat.identity.pickFirst"),
    noPeers: t("chat.identity.noPeers"),
    existing: t("chat.identity.existing"),
    fresh: t("chat.identity.new"),
    all: t("chat.identity.all"),
    owner: t("chat.identity.owner"),
    legacy: t("messages.legacy"),
  };
}

/** Motivo de cada recusa do chat no idioma de quem vê (código do servidor → texto). */
export function chatErrorLabels(t: Translate): Record<string, string> {
  return {
    forbidden: t("messages.error.forbidden"),
    not_found: t("messages.error.not_found"),
    not_participant: t("messages.error.not_participant"),
    choose_login: t("messages.error.choose_login"),
    no_login: t("messages.error.no_login"),
    no_contact: t("messages.error.no_contact"),
    peer_inactive: t("messages.error.peer_inactive"),
    read_only: t("messages.error.read_only"),
    conversation_changed: t("messages.error.conversation_changed"),
    message_empty: t("messages.error.message_empty"),
    message_too_long: t("messages.error.message_too_long"),
    reply_not_found: t("messages.error.reply_not_found"),
  };
}
