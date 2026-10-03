/**
 * Dicionário do módulo "requirement-files" (fotos e arquivos do checklist do
 * pedido): mesmas chaves em pt, en e zh.
 */
export const pt = {
  "requirement.photo.add": "Tirar ou escolher foto",
  "requirement.file.add": "Escolher arquivo",
  "requirement.sending": "Enviando…",
  "requirement.file.tooBig":
    "Arquivo grande demais (máx. 50 MB). Reduza ou envie em PDF compactado.",
  "requirement.file.uploading": "Enviando… {percent}%",
  "requirement.file.serverOnly":
    "Neste ambiente o envio é limitado a 4 MB. Reduza ou envie em PDF compactado.",
  "requirement.file.failed":
    "O envio falhou. Verifique a conexão e tente de novo.",
  "orders.error.upload_missing":
    "O arquivo enviado não foi encontrado no armazenamento. Envie de novo.",
  "orders.error.too_large": "Arquivo grande demais (máx. 50 MB).",
  "orders.error.money_required": "Informe o valor (ex.: 1.234,56).",
  "orders.error.mime":
    "Formato de arquivo não aceito: envie PDF, imagem, planilha, ZIP ou arte (AI, PSD, EPS, CDR, TIFF).",
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
    "File too large (max. 50 MB). Reduce it or send a compressed PDF.",
  "requirement.file.uploading": "Uploading… {percent}%",
  "requirement.file.serverOnly":
    "Uploads in this environment are limited to 4 MB. Reduce the file or send a compressed PDF.",
  "requirement.file.failed":
    "The upload failed. Check your connection and try again.",
  "orders.error.upload_missing":
    "The uploaded file was not found in storage. Please upload it again.",
  "orders.error.too_large": "File too large (max. 50 MB).",
  "orders.error.money_required": "Enter the amount (e.g. 1,234.56).",
  "orders.error.mime":
    "File format not accepted: send a PDF, image, spreadsheet, ZIP or artwork (AI, PSD, EPS, CDR, TIFF).",
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
    "文件过大（最大 50 MB）。请压缩或发送压缩后的 PDF。",
  "requirement.file.uploading": "上传中… {percent}%",
  "requirement.file.serverOnly":
    "当前环境上传限制为 4 MB。请压缩文件或发送压缩后的 PDF。",
  "requirement.file.failed": "上传失败。请检查网络后重试。",
  "orders.error.upload_missing": "未在存储中找到已上传的文件，请重新上传。",
  "orders.error.too_large": "文件过大（最大 50 MB）。",
  "orders.error.money_required": "请输入金额（例如 1.234,56）。",
  "orders.error.mime":
    "不支持的文件格式：请发送 PDF、图片、表格、ZIP 或设计稿（AI、PSD、EPS、CDR、TIFF）。",
  "requirement.remove": "删除",
  "requirement.removeConfirm":
    "删除此文件？该项将恢复为待处理，您可以重新上传。",
  "requirement.removed": "文件已删除。请上传新文件。",
};
