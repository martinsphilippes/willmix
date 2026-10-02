/**
 * Dicionário do módulo "quote-sheet" (resposta da RFQ pela ficha de compra):
 * mesmas chaves em pt, en e zh.
 */
export const pt = {
  "quoteSheet.intro":
    "Responda a cotação preenchendo a ficha de compra completa (os campos com * são obrigatórios). Fotos não são necessárias agora: ficam para a Preparação, se a sua cotação for escolhida. O preço e a moeda da cotação são os da ficha.",
  "quoteSheet.title": "Ficha de compra da cotação",
  "quoteSheet.leadTime": "Prazo de produção (dias)",
  "quoteSheet.conditions": "Condições de pagamento e observações",
  "quoteSheet.saveDraft": "Salvar rascunho",
  "quoteSheet.send": "Enviar cotação",
  "quoteSheet.saved.partial": "Rascunho salvo. Falta preencher: {fields}.",
  "quoteSheet.saved.complete":
    "Rascunho salvo e ficha completa. Confira e clique em Enviar cotação.",
  "quoteSheet.saved.sent": "Cotação enviada à Wellmix com a ficha de compra.",
  "quoteSheet.missing": "Para enviar, falta preencher: {fields}.",
  "quoteSheet.error.sheet_incomplete":
    "A ficha foi salva, mas ainda está incompleta: preencha os campos com * para enviar a cotação.",
  "quoteSheet.readOnly": "Cotação encerrada: a ficha fica só para consulta.",
  "quoteSheet.wellmixHint":
    "A Wellmix pode completar NCM, imposto de importação e IPI: entram no custo importado do valor ao cliente.",
};

export const en: Record<keyof typeof pt, string> = {
  "quoteSheet.intro":
    "Answer the quotation by filling in the complete purchase sheet (fields with * are required). Photos are not needed now: they come in Preparation if your quotation is chosen. The quotation price and currency are the sheet's.",
  "quoteSheet.title": "Quotation purchase sheet",
  "quoteSheet.leadTime": "Production lead time (days)",
  "quoteSheet.conditions": "Payment terms and notes",
  "quoteSheet.saveDraft": "Save draft",
  "quoteSheet.send": "Send quotation",
  "quoteSheet.saved.partial": "Draft saved. Still missing: {fields}.",
  "quoteSheet.saved.complete":
    "Draft saved and sheet complete. Review it and click Send quotation.",
  "quoteSheet.saved.sent": "Quotation sent to Wellmix with the purchase sheet.",
  "quoteSheet.missing": "To send, still missing: {fields}.",
  "quoteSheet.error.sheet_incomplete":
    "The sheet was saved but is still incomplete: fill in the fields with * to send the quotation.",
  "quoteSheet.readOnly": "Quotation closed: the sheet is read-only.",
  "quoteSheet.wellmixHint":
    "Wellmix can complete NCM, import duty and IPI: they go into the landed cost of the customer value.",
};

export const zh: Record<keyof typeof pt, string> = {
  "quoteSheet.intro":
    "请填写完整的采购单来回复报价（带 * 的为必填项）。现在不需要照片：如果您的报价被选中，将在备货阶段上传。报价的价格和币种以采购单为准。",
  "quoteSheet.title": "报价采购单",
  "quoteSheet.leadTime": "生产周期（天）",
  "quoteSheet.conditions": "付款条件和备注",
  "quoteSheet.saveDraft": "保存草稿",
  "quoteSheet.send": "提交报价",
  "quoteSheet.saved.partial": "草稿已保存。尚未填写：{fields}。",
  "quoteSheet.saved.complete": "草稿已保存，采购单已完整。请检查后点击提交报价。",
  "quoteSheet.saved.sent": "报价已连同采购单提交给 Wellmix。",
  "quoteSheet.missing": "提交前还需填写：{fields}。",
  "quoteSheet.error.sheet_incomplete":
    "采购单已保存，但仍不完整：请填写带 * 的字段后再提交报价。",
  "quoteSheet.readOnly": "报价已关闭：采购单仅供查看。",
  "quoteSheet.wellmixHint":
    "Wellmix 可以补充 NCM、进口税和 IPI：这些将计入客户价格的到岸成本。",
};
