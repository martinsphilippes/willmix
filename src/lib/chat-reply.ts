/*
 * Responder a uma mensagem marcada (como no WhatsApp): o que a tela precisa
 * saber da mensagem escolhida e o evento que liga a conversa à caixa de
 * envio da tela de Mensagens. Módulo sem "use client": a página (servidor)
 * monta o resumo de cada mensagem e os componentes do navegador o usam.
 */

/** Mensagem escolhida para responder (o resumo aparece em cima da caixa de texto). */
export interface ReplyTarget {
  id: string;
  /** Quem escreveu ("Você" quando foi quem responde). */
  author: string;
  /** Começo do texto ou o anexo ("📷 Foto", "🎬 Vídeo", "📎 nome"). */
  text: string;
}

/** Textos do responder (no idioma de quem vê). */
export interface ChatReplyLabels {
  reply: string;
  /** Com {name}. */
  to: string;
  cancel: string;
  hint: string;
  photo: string;
  video: string;
  original: string;
  you: string;
}

/** Uma mensagem foi escolhida para responder (tela de Mensagens). */
export const REPLY_EVENT = "wellmix:reply";
/** A resposta foi junto com um arquivo: a caixa de envio esquece a escolha. */
export const REPLY_CLEAR_EVENT = "wellmix:reply-clear";

/** Arraste mínimo (px) para a direita que vale como "responder". */
export const REPLY_SWIPE_PX = 56;

/** Rótulo do anexo numa citação ou no resumo da resposta. */
export function attachmentLabel(
  attachment: { name: string; isImage: boolean; isVideo?: boolean } | null,
  labels: Pick<ChatReplyLabels, "photo" | "video">,
): string {
  if (!attachment) return "";
  if (attachment.isVideo) return `🎬 ${labels.video}`;
  if (attachment.isImage) return `📷 ${labels.photo}`;
  return `📎 ${attachment.name}`;
}

/**
 * Resumo de uma mensagem da conversa para a resposta: o texto como quem lê
 * o vê (traduzido, quando há) ou, só com anexo, o rótulo do anexo.
 */
export function replyTarget(
  m: {
    id: string;
    body: string;
    mine: boolean;
    authorName: string;
    attachment: { name: string; isImage: boolean; isVideo?: boolean } | null;
    tr?: { text?: string | null } | null;
  },
  labels: Pick<ChatReplyLabels, "photo" | "video" | "you">,
): ReplyTarget {
  const attachmentOnly = !!m.attachment && m.body === `📎 ${m.attachment.name}`;
  const text = attachmentOnly
    ? attachmentLabel(m.attachment, labels)
    : (m.tr?.text ?? m.body);
  return {
    id: m.id,
    author: m.mine ? labels.you : m.authorName,
    text: text.slice(0, 240),
  };
}
