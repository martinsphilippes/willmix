/**
 * Dicionário do módulo "requirement-files" (fotos e arquivos do checklist do
 * pedido): mesmas chaves em pt, en e zh.
 */
export const pt = {
  "requirement.photo.add": "Tirar ou escolher foto",
  "requirement.file.add": "Escolher arquivo",
  "requirement.sending": "Enviando…",
  "requirement.file.tooBig":
    "Arquivo grande demais (máx. 4 MB). Reduza ou envie em PDF compactado.",
  "requirement.remove": "Excluir",
  "requirement.removeConfirm":
    "Excluir este arquivo? O item volta a pendente e você pode enviar outro.",
  "requirement.removed": "Arquivo excluído. Envie o novo.",
};

export const en: Record<keyof typeof pt, string> = {
  "requirement.photo.add": "Take or choose photo",
  "requirement.file.add": "Choose file",
  "requirement.sending": "Sending…",
  "requirement.file.tooBig":
    "File too large (max. 4 MB). Reduce it or send a compressed PDF.",
  "requirement.remove": "Delete",
  "requirement.removeConfirm":
    "Delete this file? The item goes back to pending and you can send another.",
  "requirement.removed": "File deleted. Send the new one.",
};

export const zh: Record<keyof typeof pt, string> = {
  "requirement.photo.add": "拍照或选择照片",
  "requirement.file.add": "选择文件",
  "requirement.sending": "正在发送…",
  "requirement.file.tooBig":
    "文件过大（最大 4 MB）。请压缩或发送压缩后的 PDF。",
  "requirement.remove": "删除",
  "requirement.removeConfirm":
    "删除此文件？该项将恢复为待处理，您可以重新上传。",
  "requirement.removed": "文件已删除。请上传新文件。",
};
