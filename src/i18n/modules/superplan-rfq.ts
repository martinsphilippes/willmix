/**
 * Dicionário do módulo "superplan-rfq" (do Superplan à faca e à RFQ com o
 * fornecedor ganho: faca, MOQ, prazo e foto em alta na cotação): mesmas
 * chaves em pt, en e zh. Os textos da tela do Superplan ficam no módulo
 * "superplan" (vão para a simulação).
 */
export const pt = {
  "orders.origin.superplan": "Superplan",
  "spRfq.title": "Superplan: faca, MOQ, prazo e foto em alta",
  "spRfq.hint.supplier":
    "Você ganhou este produto pelo Superplan. Envie os quatro itens abaixo: a Wellmix só manda a proposta com todos.",
  "spRfq.hint.wellmix":
    "Aberta do Superplan. A escolha (proposta e aprovação) espera os quatro itens do fornecedor; a Wellmix pode enviar no lugar dele.",
  "spRfq.price": "Preço combinado: {price} por peça.",
  "spRfq.item.dieline": "Faca (die-cut)",
  "spRfq.item.moq": "MOQ",
  "spRfq.item.leadTime": "Prazo",
  "spRfq.item.hd": "Foto em alta (HD)",
  "spRfq.state.done": "Enviado",
  "spRfq.state.pending": "Falta",
  "spRfq.moq": "MOQ (pedido mínimo, em peças)",
  "spRfq.leadTime": "Prazo de produção (dias)",
  "spRfq.terms.hint": "Já vem com o que temos: confirme ou corrija.",
  "spRfq.terms.submit": "Confirmar MOQ e prazo",
  "spRfq.hd.add": "Enviar foto em alta",
  "spRfq.hd.hint":
    "A foto original do produto, sem passar por aplicativo de mensagem (que reduz a qualidade).",
  "spRfq.dieline.hint":
    "A faca da caixa, para a agência fazer a arte em cima. Arquivo (PDF, AI, CDR) ou foto.",
  "spRfq.saved": "Recebido. Falta: {list}.",
  "spRfq.done": "Tudo enviado. A Wellmix foi avisada.",
  "spRfq.missing": "Falta: {list}.",
  "spRfq.complete":
    "Os quatro itens chegaram: já pode escolher e mandar a proposta.",
  "spRfq.closed": "Cotação encerrada: nada mais a enviar por aqui.",
  "spRfq.opened":
    "Aberta do Superplan: a RFQ foi para o fornecedor ganho, que envia faca, MOQ, prazo e foto em alta.",
  "spRfq.request": "Superplan: {state}",
  "spRfq.openQuote": "Abrir a cotação",
  "spRfq.error.quote_closed": "Cotação encerrada: não dá mais para enviar.",
  "spRfq.error.invalid_moq": "MOQ: use um número inteiro de peças.",
  "spRfq.error.invalid_lead_time":
    "Prazo: use um número inteiro de dias (até 720).",
  "spRfq.error.terms_required": "Preencha o MOQ e o prazo.",
  "spRfq.error.no_brief":
    "Esta solicitação está sem briefing de embalagem: peça à Wellmix para abrir.",
  "spRfq.error.photo_required": "Escolha a foto em alta.",
  "spRfq.error.document_required": "Escolha o arquivo ou a foto da faca.",
  "purchaseFlow.error.superplan_items_missing":
    "Aberta do Superplan: falta o fornecedor enviar faca, MOQ, prazo e foto em alta. A proposta espera os quatro.",
  "reqStage.dieline.hint.superplan":
    "o fornecedor ganho no Superplan envia a faca, com MOQ, prazo e foto em alta (antes da proposta)",
  "notif.superplanRfq.subject":
    "Superplan: envie faca, MOQ, prazo e foto em alta: {product}{ref}",
  "notif.superplanRfq.body":
    "Você ganhou este produto ({qty} peças). Na cotação, envie a faca (die-cut), o MOQ, o prazo e a foto em alta.",
  "notif.superplanItems.subject":
    "Superplan: o fornecedor enviou tudo: {product}",
  "notif.superplanItems.body":
    "Faca, foto em alta, MOQ de {moq} peças e prazo de {days} dias. Já pode escolher e mandar a proposta.",
  "notif.superplanItems.changed":
    "Atenção: mudou (antes: MOQ {moq}, prazo {days} dias).",
};

export const en: Record<keyof typeof pt, string> = {
  "orders.origin.superplan": "Superplan",
  "spRfq.title": "Superplan: die-cut, MOQ, lead time and high-res photo",
  "spRfq.hint.supplier":
    "You won this product through Superplan. Send the four items below: Wellmix only sends the proposal with all of them.",
  "spRfq.hint.wellmix":
    "Opened from Superplan. The choice (proposal and approval) waits for the supplier's four items; Wellmix can send them on the supplier's behalf.",
  "spRfq.price": "Agreed price: {price} per piece.",
  "spRfq.item.dieline": "Die-cut",
  "spRfq.item.moq": "MOQ",
  "spRfq.item.leadTime": "Lead time",
  "spRfq.item.hd": "High-res photo (HD)",
  "spRfq.state.done": "Sent",
  "spRfq.state.pending": "Missing",
  "spRfq.moq": "MOQ (minimum order, in pieces)",
  "spRfq.leadTime": "Production lead time (days)",
  "spRfq.terms.hint": "Prefilled with what we have: confirm or correct.",
  "spRfq.terms.submit": "Confirm MOQ and lead time",
  "spRfq.hd.add": "Send high-res photo",
  "spRfq.hd.hint":
    "The original product photo, not sent through a messaging app (it lowers the quality).",
  "spRfq.dieline.hint":
    "The box die-cut, so the agency can do the artwork on it. File (PDF, AI, CDR) or photo.",
  "spRfq.saved": "Received. Missing: {list}.",
  "spRfq.done": "Everything sent. Wellmix was notified.",
  "spRfq.missing": "Missing: {list}.",
  "spRfq.complete":
    "All four items arrived: you can choose and send the proposal.",
  "spRfq.closed": "Quote closed: nothing more to send here.",
  "spRfq.opened":
    "Opened from Superplan: the RFQ went to the winning supplier, who sends die-cut, MOQ, lead time and high-res photo.",
  "spRfq.request": "Superplan: {state}",
  "spRfq.openQuote": "Open the quote",
  "spRfq.error.quote_closed": "Quote closed: it can no longer be sent.",
  "spRfq.error.invalid_moq": "MOQ: use a whole number of pieces.",
  "spRfq.error.invalid_lead_time":
    "Lead time: use a whole number of days (up to 720).",
  "spRfq.error.terms_required": "Fill in the MOQ and the lead time.",
  "spRfq.error.no_brief":
    "This request has no packaging brief: ask Wellmix to open it.",
  "spRfq.error.photo_required": "Choose the high-res photo.",
  "spRfq.error.document_required": "Choose the die-cut file or photo.",
  "purchaseFlow.error.superplan_items_missing":
    "Opened from Superplan: the supplier still has to send die-cut, MOQ, lead time and high-res photo. The proposal waits for all four.",
  "reqStage.dieline.hint.superplan":
    "the supplier who won in Superplan sends the die-cut, with MOQ, lead time and high-res photo (before the proposal)",
  "notif.superplanRfq.subject":
    "Superplan: send die-cut, MOQ, lead time and high-res photo: {product}{ref}",
  "notif.superplanRfq.body":
    "You won this product ({qty} pieces). In the quote, send the die-cut, the MOQ, the lead time and the high-res photo.",
  "notif.superplanItems.subject":
    "Superplan: the supplier sent everything: {product}",
  "notif.superplanItems.body":
    "Die-cut, high-res photo, MOQ of {moq} pieces and lead time of {days} days. You can choose and send the proposal.",
  "notif.superplanItems.changed":
    "Note: it changed (before: MOQ {moq}, lead time {days} days).",
};

export const zh: Record<keyof typeof pt, string> = {
  "orders.origin.superplan": "Superplan",
  "spRfq.title": "Superplan：刀版、起订量、交期和高清照片",
  "spRfq.hint.supplier":
    "您已通过 Superplan 中标此产品。请发送以下四项：四项齐全后 Wellmix 才会发出报价方案。",
  "spRfq.hint.wellmix":
    "由 Superplan 发起。选择（报价方案和审批）需等待供应商的四项资料；Wellmix 可代为发送。",
  "spRfq.price": "约定价格：每件 {price}。",
  "spRfq.item.dieline": "刀版（die-cut）",
  "spRfq.item.moq": "起订量",
  "spRfq.item.leadTime": "交期",
  "spRfq.item.hd": "高清照片（HD）",
  "spRfq.state.done": "已发送",
  "spRfq.state.pending": "缺少",
  "spRfq.moq": "起订量（最低订购，件）",
  "spRfq.leadTime": "生产交期（天）",
  "spRfq.terms.hint": "已按现有资料预填：请确认或更正。",
  "spRfq.terms.submit": "确认起订量和交期",
  "spRfq.hd.add": "发送高清照片",
  "spRfq.hd.hint": "产品原图，不要经过聊天软件发送（会降低画质）。",
  "spRfq.dieline.hint":
    "包装盒刀版，供设计公司在上面做设计稿。文件（PDF、AI、CDR）或照片。",
  "spRfq.saved": "已收到。缺少：{list}。",
  "spRfq.done": "全部已发送，已通知 Wellmix。",
  "spRfq.missing": "缺少：{list}。",
  "spRfq.complete": "四项资料已齐：可以选择并发送报价方案。",
  "spRfq.closed": "报价已结束：此处无需再发送。",
  "spRfq.opened":
    "由 Superplan 发起：询价已发给中标供应商，由其发送刀版、起订量、交期和高清照片。",
  "spRfq.request": "Superplan：{state}",
  "spRfq.openQuote": "打开报价",
  "spRfq.error.quote_closed": "报价已结束，无法再发送。",
  "spRfq.error.invalid_moq": "起订量：请填写整数件数。",
  "spRfq.error.invalid_lead_time": "交期：请填写整数天数（最多 720）。",
  "spRfq.error.terms_required": "请填写起订量和交期。",
  "spRfq.error.no_brief": "此询价没有包装简报：请联系 Wellmix 开启。",
  "spRfq.error.photo_required": "请选择高清照片。",
  "spRfq.error.document_required": "请选择刀版文件或照片。",
  "purchaseFlow.error.superplan_items_missing":
    "由 Superplan 发起：供应商尚需发送刀版、起订量、交期和高清照片。报价方案需等待四项齐全。",
  "reqStage.dieline.hint.superplan":
    "Superplan 中标供应商发送刀版，以及起订量、交期和高清照片（在报价方案之前）",
  "notif.superplanRfq.subject":
    "Superplan：请发送刀版、起订量、交期和高清照片：{product}{ref}",
  "notif.superplanRfq.body":
    "您已中标此产品（{qty} 件）。请在报价中发送刀版、起订量、交期和高清照片。",
  "notif.superplanItems.subject": "Superplan：供应商已全部发送：{product}",
  "notif.superplanItems.body":
    "刀版、高清照片、起订量 {moq} 件、交期 {days} 天。可以选择并发送报价方案。",
  "notif.superplanItems.changed":
    "注意：有变动（之前：起订量 {moq}，交期 {days} 天）。",
};
