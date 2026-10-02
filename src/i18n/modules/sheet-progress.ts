/**
 * Dicionário do módulo "sheet-progress" (o que falta na ficha de compra do
 * pedido e de onde ela veio): mesmas chaves em pt, en e zh.
 */
export const pt = {
  "sheet.completeCta": "Completar ficha (faltam {count})",
  "sheet.missingShort": "Falta: {fields}.",
  "sheet.prefilled.quote": "Já preenchida na cotação.",
  "sheet.prefilled.previous":
    "Preenchida com a ficha do último pedido deste produto.",
  "sheet.prefilledNotice.quote":
    "A ficha veio da cotação do fornecedor: confira e complete só o que falta (fotos e programação dos lotes).",
  "sheet.prefilledNotice.previous":
    "A ficha veio do último pedido deste produto com este fornecedor: confira, ajuste o que mudou e complete o que falta.",
};

export const en: Record<keyof typeof pt, string> = {
  "sheet.completeCta": "Complete sheet ({count} missing)",
  "sheet.missingShort": "Missing: {fields}.",
  "sheet.prefilled.quote": "Already filled in the quotation.",
  "sheet.prefilled.previous": "Filled from the last order of this product.",
  "sheet.prefilledNotice.quote":
    "The sheet came from the supplier's quotation: review it and complete only what is missing (photos and lot schedule).",
  "sheet.prefilledNotice.previous":
    "The sheet came from the last order of this product with this supplier: review it, adjust what changed and complete what is missing.",
};

export const zh: Record<keyof typeof pt, string> = {
  "sheet.completeCta": "补全采购单（还缺 {count} 项）",
  "sheet.missingShort": "缺少：{fields}。",
  "sheet.prefilled.quote": "已在报价时填写。",
  "sheet.prefilled.previous": "已按该产品上一订单的采购单填写。",
  "sheet.prefilledNotice.quote":
    "采购单来自供应商的报价：请核对，只需补全缺少的内容（照片和批次计划）。",
  "sheet.prefilledNotice.previous":
    "采购单来自该产品与该供应商的上一订单：请核对、调整变化的内容并补全缺少的部分。",
};
