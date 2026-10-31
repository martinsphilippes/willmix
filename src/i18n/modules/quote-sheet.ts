/**
 * Dicionário do módulo "quote-sheet" (resposta da RFQ pela ficha de compra):
 * mesmas chaves em pt, en e zh.
 */
export const pt = {
  "quoteSheet.intro":
    "Responda a cotação preenchendo a ficha de compra completa: os campos com *, a programação dos lotes e as 5 fotos do produto. Se a sua cotação for escolhida, o pedido já nasce com a Preparação concluída. O preço e a moeda da cotação são os da ficha.",
  "quoteSheet.photosHint":
    "Envie as 5 fotos do produto antes de clicar em Enviar cotação: todas são obrigatórias. Cada foto sobe na hora, sem apagar o que você digitou na ficha.",
  "quoteSheet.title": "Ficha de compra da cotação",
  "quoteSheet.leadTime": "Prazo de produção (dias)",
  "quoteSheet.leadTimeLabel": "Prazo de produção",
  "quoteSheet.leadTimeAuto": "{days} dias",
  "quoteSheet.leadTimePending": "Preencha “Saída em (dias)” na programação 1.",
  "quoteSheet.leadTimeHint":
    "Calculado pela programação 1: dias entre o início da produção e a saída da 1ª remessa.",
  "quoteSheet.conditions": "Condições de pagamento e observações",
  "quoteSheet.saveDraft": "Salvar rascunho",
  "quoteSheet.send": "Enviar cotação",
  "quoteSheet.saved.partial": "Rascunho salvo. Falta preencher: {fields}.",
  "quoteSheet.saved.complete":
    "Rascunho salvo e ficha completa. Confira e clique em Enviar cotação.",
  "quoteSheet.saved.sent": "Cotação enviada à Wellmix com a ficha de compra.",
  "quoteSent.lead": "prazo de {days} dias",
  "quoteSent.edit":
    "Até a decisão, dá para corrigir e reenviar pela própria cotação.",
  "quoteSent.next": "Responder a próxima: {title}",
  "quoteSent.none": "Nenhuma outra cotação esperando resposta.",
  "quoteSent.pending": "{n} cotações esperando resposta.",
  "quoteSent.view": "Ver a cotação enviada",
  "quoteSent.all": "Ver todas as cotações",
  "nav.quotes": "Cotações",
  "quotes.list.title": "Cotações",
  "quotes.list.empty":
    "Nenhuma cotação ainda. Quando a Wellmix pedir uma cotação, ela aparece aqui e nas Pendências.",
  "quotes.list.emptyTab": "Nenhuma cotação nesta situação.",
  "quotes.list.all": "Todas",
  "quotes.list.tab.invited": "Para responder",
  "quotes.list.tab.answered": "Enviadas",
  "quotes.list.tab.selected": "Escolhidas",
  "quotes.list.tab.rejected": "Não escolhidas",
  "quotes.list.when": "Prazo / envio",
  "quotes.list.price": "Valor enviado",
  "quotes.list.until": "Responder até",
  "quotes.list.sentOn": "Enviada em",
  "quotes.list.answer": "Preencher cotação",
  "quotes.list.open": "Abrir",
  "quotes.list.notAnswered": "Não respondida",
  "quotes.list.requestCancelled": "Solicitação cancelada",
  "quoteSheet.missing": "Para enviar, falta preencher: {fields}.",
  "quoteSheet.error.lead_time_required":
    "A ficha foi salva. Para enviar a cotação, informe o prazo de produção (dias) no fim da página.",
  "quoteSheet.error.sheet_incomplete":
    "A ficha foi salva, mas ainda está incompleta: preencha os campos com *, o 1º lote da programação e todas as fotos para enviar a cotação.",
  "quoteSheet.readOnly": "Cotação encerrada: a ficha fica só para consulta.",
  "quoteSheet.wellmixHint":
    "A Wellmix pode completar NCM, imposto de importação e IPI: entram no custo importado do valor ao cliente.",
};

export const en: Record<keyof typeof pt, string> = {
  "quoteSheet.intro":
    "Answer the quotation by filling in the complete purchase sheet: fields with *, the lot schedule and the 5 product photos. If your quotation is chosen, the order starts with Preparation already done. The quotation price and currency are the sheet's.",
  "quoteSheet.photosHint":
    "Upload the 5 product photos before clicking Send quotation: all of them are required. Each photo uploads right away without clearing what you typed in the sheet.",
  "quoteSheet.title": "Quotation purchase sheet",
  "quoteSheet.leadTime": "Production lead time (days)",
  "quoteSheet.leadTimeLabel": "Production lead time",
  "quoteSheet.leadTimeAuto": "{days} days",
  "quoteSheet.leadTimePending": "Fill in “Departure in (days)” on shipment 1.",
  "quoteSheet.leadTimeHint":
    "Calculated from shipment 1: days between the production start and the first shipment leaving.",
  "quoteSheet.conditions": "Payment terms and notes",
  "quoteSheet.saveDraft": "Save draft",
  "quoteSheet.send": "Send quotation",
  "quoteSheet.saved.partial": "Draft saved. Still missing: {fields}.",
  "quoteSheet.saved.complete":
    "Draft saved and sheet complete. Review it and click Send quotation.",
  "quoteSheet.saved.sent": "Quotation sent to Wellmix with the purchase sheet.",
  "quoteSent.lead": "lead time {days} days",
  "quoteSent.edit":
    "Until the decision, you can correct and resend it from the quotation.",
  "quoteSent.next": "Answer the next one: {title}",
  "quoteSent.none": "No other quotation waiting for an answer.",
  "quoteSent.pending": "{n} quotations waiting for an answer.",
  "quoteSent.view": "View the sent quotation",
  "quoteSent.all": "See all quotations",
  "nav.quotes": "Quotations",
  "quotes.list.title": "Quotations",
  "quotes.list.empty":
    "No quotations yet. When Wellmix asks you for a quotation, it shows up here and in your tasks.",
  "quotes.list.emptyTab": "No quotations in this status.",
  "quotes.list.all": "All",
  "quotes.list.tab.invited": "To answer",
  "quotes.list.tab.answered": "Sent",
  "quotes.list.tab.selected": "Selected",
  "quotes.list.tab.rejected": "Not selected",
  "quotes.list.when": "Deadline / sent",
  "quotes.list.price": "Price sent",
  "quotes.list.until": "Answer by",
  "quotes.list.sentOn": "Sent on",
  "quotes.list.answer": "Fill in quotation",
  "quotes.list.open": "Open",
  "quotes.list.notAnswered": "Not answered",
  "quotes.list.requestCancelled": "Request cancelled",
  "quoteSheet.missing": "To send, still missing: {fields}.",
  "quoteSheet.error.lead_time_required":
    "The sheet was saved. To send the quotation, enter the production lead time (days) at the end of the page.",
  "quoteSheet.error.sheet_incomplete":
    "The sheet was saved but is still incomplete: fill in the fields with *, the 1st lot of the schedule and all the photos to send the quotation.",
  "quoteSheet.readOnly": "Quotation closed: the sheet is read-only.",
  "quoteSheet.wellmixHint":
    "Wellmix can complete NCM, import duty and IPI: they go into the landed cost of the customer value.",
};

export const zh: Record<keyof typeof pt, string> = {
  "quoteSheet.intro":
    "请填写完整的采购单来回复报价：带 * 的字段、批次计划以及 5 张产品照片。如果您的报价被选中，订单的备货阶段将直接完成。报价的价格和币种以采购单为准。",
  "quoteSheet.photosHint":
    "请在点击“提交报价”前上传 5 张产品照片：全部为必需。每张照片会立即上传，不会清除您在采购单中填写的内容。",
  "quoteSheet.title": "报价采购单",
  "quoteSheet.leadTime": "生产周期（天）",
  "quoteSheet.leadTimeLabel": "生产周期",
  "quoteSheet.leadTimeAuto": "{days} 天",
  "quoteSheet.leadTimePending": "请在第 1 批填写“出货间隔（天）”。",
  "quoteSheet.leadTimeHint":
    "按第 1 批计算：从开始生产到第一批出货之间的天数。",
  "quoteSheet.conditions": "付款条件和备注",
  "quoteSheet.saveDraft": "保存草稿",
  "quoteSheet.send": "提交报价",
  "quoteSheet.saved.partial": "草稿已保存。尚未填写：{fields}。",
  "quoteSheet.saved.complete":
    "草稿已保存，采购单已完整。请检查后点击提交报价。",
  "quoteSheet.saved.sent": "报价已连同采购单提交给 Wellmix。",
  "quoteSent.lead": "交期 {days} 天",
  "quoteSent.edit": "在 Wellmix 决定之前，可以在该报价中修改并重新提交。",
  "quoteSent.next": "回复下一个：{title}",
  "quoteSent.none": "没有其他待回复的报价。",
  "quoteSent.pending": "还有 {n} 个报价待回复。",
  "quoteSent.view": "查看已提交的报价",
  "quoteSent.all": "查看全部报价",
  "nav.quotes": "报价",
  "quotes.list.title": "报价",
  "quotes.list.empty": "还没有报价。Wellmix 向您询价时，会显示在这里和待办中。",
  "quotes.list.emptyTab": "没有此状态的报价。",
  "quotes.list.all": "全部",
  "quotes.list.tab.invited": "待回复",
  "quotes.list.tab.answered": "已提交",
  "quotes.list.tab.selected": "已选中",
  "quotes.list.tab.rejected": "未选中",
  "quotes.list.when": "截止 / 提交",
  "quotes.list.price": "报价金额",
  "quotes.list.until": "截止",
  "quotes.list.sentOn": "提交于",
  "quotes.list.answer": "填写报价",
  "quotes.list.open": "打开",
  "quotes.list.notAnswered": "未回复",
  "quotes.list.requestCancelled": "需求已取消",
  "quoteSheet.missing": "提交前还需填写：{fields}。",
  "quoteSheet.error.lead_time_required":
    "采购单已保存。要提交报价，请在页面底部填写生产周期（天）。",
  "quoteSheet.error.sheet_incomplete":
    "采购单已保存，但仍不完整：请填写带 * 的字段、第 1 批计划以及所有照片后再提交报价。",
  "quoteSheet.readOnly": "报价已关闭：采购单仅供查看。",
  "quoteSheet.wellmixHint":
    "Wellmix 可以补充 NCM、进口税和 IPI：这些将计入客户价格的到岸成本。",
};
