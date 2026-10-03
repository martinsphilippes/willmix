/**
 * Dicionário do módulo "sheet-photos" (nomes das fotos obrigatórias da ficha
 * no aviso do que falta): mesmas chaves em pt, en e zh.
 */
export const pt = {
  "sheet.field.sidePhoto": "Foto da medida de lado",
  "sheet.field.anglePhoto": "Foto de outro ângulo",
  "sheet.field.originalPhoto": "Foto original (evidência)",
  "sheet.field.promptPhoto": "Foto de referência",
  "sheet.field.cardPhoto": "Foto do cartão de visita do fornecedor",
};

export const en: Record<keyof typeof pt, string> = {
  "sheet.field.sidePhoto": "Side measurement photo",
  "sheet.field.anglePhoto": "Other angle photo",
  "sheet.field.originalPhoto": "Original photo (evidence)",
  "sheet.field.promptPhoto": "Reference photo",
  "sheet.field.cardPhoto": "Supplier business card photo",
};

export const zh: Record<keyof typeof pt, string> = {
  "sheet.field.sidePhoto": "侧面尺寸照片",
  "sheet.field.anglePhoto": "其他角度照片",
  "sheet.field.originalPhoto": "原始照片（证据）",
  "sheet.field.promptPhoto": "参考照片",
  "sheet.field.cardPhoto": "供应商名片照片",
};
