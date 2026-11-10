/**
 * Dicionário do módulo "quote-flow" (cotação: devolver com comentário,
 * contraproposta e resposta do fornecedor; proposta de embalagem com o OK
 * do fornecedor): mesmas chaves em pt, en e zh.
 */
export const pt = {
  "quoteFlow.neg.title": "Negociação",
  "quoteFlow.neg.hint.wellmix":
    "Não aceita a cotação como está? Devolva com o motivo e, se quiser, o preço que propõe. O fornecedor aceita, manda outro preço ou mantém o dele. Enquanto ele não responde, a escolha do fornecedor fica parada.",
  "quoteFlow.neg.current": "Preço da cotação: {price}.",
  "quoteFlow.neg.comment": "Motivo (o fornecedor lê)",
  "quoteFlow.neg.target": "Preço que a Wellmix propõe ({currency})",
  "quoteFlow.neg.targetHint":
    "Já vem com {pct}% a menos ({suggested}). Pode mudar ou apagar.",
  "quoteFlow.neg.return": "Devolver com comentário",
  "quoteFlow.neg.waiting":
    "Devolvida em {date}: esperando a resposta do fornecedor.",
  "quoteFlow.neg.pending.supplier":
    "A Wellmix devolveu a sua cotação. Leia o motivo e responda abaixo.",
  "quoteFlow.neg.proposed": "Preço proposto pela Wellmix: {price}.",
  "quoteFlow.neg.reply.title": "Sua resposta",
  "quoteFlow.neg.reply.title.wellmix":
    "Registrar a resposta do fornecedor (se ele respondeu por fora)",
  "quoteFlow.neg.reply.accept": "Aceitar o preço proposto ({price})",
  "quoteFlow.neg.reply.counter": "Mandar outro preço",
  "quoteFlow.neg.reply.keep": "Manter o preço atual ({price})",
  "quoteFlow.neg.reply.price": "Novo preço ({currency})",
  "quoteFlow.neg.reply.comment": "Comentário (obrigatório para manter o preço)",
  "quoteFlow.neg.reply.submit": "Responder",
  "quoteFlow.neg.history": "Histórico da negociação",
  "quoteFlow.neg.round.return": "Wellmix devolveu",
  "quoteFlow.neg.round.accept": "Fornecedor aceitou",
  "quoteFlow.neg.round.counter": "Fornecedor mandou outro preço",
  "quoteFlow.neg.round.keep": "Fornecedor manteve o preço",
  "quoteFlow.neg.round.target": "propôs {price}",
  "quoteFlow.neg.round.price": "{from} → {to}",
  "quoteFlow.neg.done.returned": "Cotação devolvida. O fornecedor foi avisado.",
  "quoteFlow.neg.done.replied": "Resposta registrada. A Wellmix foi avisada.",
  "quoteFlow.neg.chat":
    "Para conversar antes de responder, use o botão de mensagens no alto da página.",
  "quoteFlow.pack.title": "Proposta de embalagem",
  "quoteFlow.pack.hint.wellmix":
    "Envie ao fornecedor a imagem da embalagem proposta (e o prompt que a gerou). Ele responde OK ou Não. Com proposta enviada, a escolha do fornecedor espera o OK.",
  "quoteFlow.pack.prompt": "Prompt usado para gerar a imagem (opcional)",
  "quoteFlow.pack.image": "Imagem da proposta",
  "quoteFlow.pack.send": "Enviar ao fornecedor",
  "quoteFlow.pack.sendNew": "Enviar outra proposta",
  "quoteFlow.pack.version": "Proposta {n}, enviada em {date} por {name}.",
  "quoteFlow.pack.state.waiting": "Esperando o fornecedor",
  "quoteFlow.pack.state.ok": "OK do fornecedor",
  "quoteFlow.pack.state.no": "Fornecedor disse não",
  "quoteFlow.pack.decided": "{name}, em {date}.",
  "quoteFlow.pack.ask.supplier":
    "Esta é a embalagem que a Wellmix propõe para o produto. Você consegue produzir assim?",
  "quoteFlow.pack.ok": "OK, consigo produzir",
  "quoteFlow.pack.no": "Não",
  "quoteFlow.pack.comment": "Comentário (obrigatório para dizer não)",
  "quoteFlow.pack.register.wellmix":
    "Registrar a resposta do fornecedor (se ele respondeu por fora)",
  "quoteFlow.pack.refused.wellmix":
    "O fornecedor recusou esta embalagem. Reveja a seleção: envie outra proposta ou escolha outro fornecedor.",
  "quoteFlow.pack.open": "Abrir a imagem",
  "quoteFlow.pack.history": "Propostas anteriores",
  "quoteFlow.pack.done.sent": "Proposta enviada. O fornecedor foi avisado.",
  "quoteFlow.pack.done.ok": "OK registrado. A Wellmix foi avisada.",
  "quoteFlow.pack.done.no": "Resposta registrada. A Wellmix foi avisada.",
  "quoteFlow.chip.returned": "Devolvida: esperando o fornecedor",
  "quoteFlow.chip.packWaiting": "Embalagem: esperando o OK",
  "quoteFlow.chip.packOk": "Embalagem: OK do fornecedor",
  "quoteFlow.chip.packNo": "Embalagem: fornecedor disse não",
  "quoteFlow.chip.open": "Negociar e embalagem",
  "purchaseFlow.error.negotiation_pending":
    "Esta cotação foi devolvida e o fornecedor ainda não respondeu. Espere a resposta (ou registre-a na cotação) antes de escolher.",
  "purchaseFlow.error.packaging_ok_waiting":
    "A proposta de embalagem ainda espera o OK do fornecedor. A escolha só segue depois do OK.",
  "purchaseFlow.error.packaging_ok_refused":
    "O fornecedor recusou a proposta de embalagem. Envie outra proposta ou escolha outro fornecedor.",
  "purchaseFlow.error.negotiation_not_answered":
    "Só dá para negociar uma cotação respondida, com preço.",
  "purchaseFlow.error.negotiation_none":
    "Não há devolução esperando resposta nesta cotação.",
  "purchaseFlow.error.negotiation_too_many":
    "Esta cotação já teve rodadas demais. Combine pelo chat e registre a resposta.",
  "purchaseFlow.error.negotiation_target_invalid":
    "O preço proposto precisa ser maior que zero e menor que o preço da cotação.",
  "purchaseFlow.error.negotiation_no_target":
    "A Wellmix não propôs um preço: mande outro preço ou mantenha o atual.",
  "purchaseFlow.error.negotiation_price_invalid": "Informe o novo preço.",
  "purchaseFlow.error.comment_required":
    "Escreva o comentário (pelo menos 3 letras).",
  "purchaseFlow.error.comment_too_long":
    "Comentário grande demais (até 1.000 letras).",
  "purchaseFlow.error.prompt_too_long":
    "Prompt grande demais (até 2.000 letras).",
  "purchaseFlow.error.proposal_image_required":
    "Anexe a imagem da proposta (JPG, PNG ou WebP).",
  "purchaseFlow.error.proposal_not_waiting":
    "Não há proposta de embalagem esperando resposta.",
  "purchaseFlow.error.proposal_closed":
    "Esta cotação já foi encerrada: a proposta não muda mais.",
  "notif.quoteReturned.subject": "Cotação devolvida: {product}",
  "notif.quoteReturned.body":
    "A Wellmix devolveu a sua cotação: {comment} Abra a cotação e responda.",
  "notif.quoteReturned.bodyTarget":
    "A Wellmix devolveu a sua cotação: {comment} Preço proposto: {target}. Abra a cotação e responda.",
  "notif.packagingProposal.subject": "Proposta de embalagem: {product}",
  "notif.packagingProposal.body":
    "A Wellmix enviou a embalagem proposta para este produto. Abra a cotação, veja a imagem e responda OK ou Não.",
} as const;

export const en: Record<keyof typeof pt, string> = {
  "quoteFlow.neg.title": "Negotiation",
  "quoteFlow.neg.hint.wellmix":
    "Not accepting the quote as it is? Return it with the reason and, if you want, the price you propose. The supplier accepts, sends another price or keeps theirs. Until they answer, choosing the supplier is on hold.",
  "quoteFlow.neg.current": "Quote price: {price}.",
  "quoteFlow.neg.comment": "Reason (the supplier reads it)",
  "quoteFlow.neg.target": "Price Wellmix proposes ({currency})",
  "quoteFlow.neg.targetHint":
    "Prefilled {pct}% lower ({suggested}). You can change or clear it.",
  "quoteFlow.neg.return": "Return with comment",
  "quoteFlow.neg.waiting": "Returned on {date}: waiting for the supplier.",
  "quoteFlow.neg.pending.supplier":
    "Wellmix returned your quote. Read the reason and answer below.",
  "quoteFlow.neg.proposed": "Price proposed by Wellmix: {price}.",
  "quoteFlow.neg.reply.title": "Your answer",
  "quoteFlow.neg.reply.title.wellmix":
    "Register the supplier's answer (if they answered elsewhere)",
  "quoteFlow.neg.reply.accept": "Accept the proposed price ({price})",
  "quoteFlow.neg.reply.counter": "Send another price",
  "quoteFlow.neg.reply.keep": "Keep the current price ({price})",
  "quoteFlow.neg.reply.price": "New price ({currency})",
  "quoteFlow.neg.reply.comment": "Comment (required to keep the price)",
  "quoteFlow.neg.reply.submit": "Answer",
  "quoteFlow.neg.history": "Negotiation history",
  "quoteFlow.neg.round.return": "Wellmix returned",
  "quoteFlow.neg.round.accept": "Supplier accepted",
  "quoteFlow.neg.round.counter": "Supplier sent another price",
  "quoteFlow.neg.round.keep": "Supplier kept the price",
  "quoteFlow.neg.round.target": "proposed {price}",
  "quoteFlow.neg.round.price": "{from} → {to}",
  "quoteFlow.neg.done.returned": "Quote returned. The supplier was notified.",
  "quoteFlow.neg.done.replied": "Answer registered. Wellmix was notified.",
  "quoteFlow.neg.chat":
    "To talk before answering, use the messages button at the top of the page.",
  "quoteFlow.pack.title": "Packaging proposal",
  "quoteFlow.pack.hint.wellmix":
    "Send the supplier the image of the proposed packaging (and the prompt that generated it). They answer OK or No. Once a proposal is sent, choosing the supplier waits for the OK.",
  "quoteFlow.pack.prompt": "Prompt used to generate the image (optional)",
  "quoteFlow.pack.image": "Proposal image",
  "quoteFlow.pack.send": "Send to the supplier",
  "quoteFlow.pack.sendNew": "Send another proposal",
  "quoteFlow.pack.version": "Proposal {n}, sent on {date} by {name}.",
  "quoteFlow.pack.state.waiting": "Waiting for the supplier",
  "quoteFlow.pack.state.ok": "Supplier OK",
  "quoteFlow.pack.state.no": "Supplier said no",
  "quoteFlow.pack.decided": "{name}, on {date}.",
  "quoteFlow.pack.ask.supplier":
    "This is the packaging Wellmix proposes for the product. Can you produce it like this?",
  "quoteFlow.pack.ok": "OK, I can produce it",
  "quoteFlow.pack.no": "No",
  "quoteFlow.pack.comment": "Comment (required to say no)",
  "quoteFlow.pack.register.wellmix":
    "Register the supplier's answer (if they answered elsewhere)",
  "quoteFlow.pack.refused.wellmix":
    "The supplier refused this packaging. Review the selection: send another proposal or choose another supplier.",
  "quoteFlow.pack.open": "Open the image",
  "quoteFlow.pack.history": "Previous proposals",
  "quoteFlow.pack.done.sent": "Proposal sent. The supplier was notified.",
  "quoteFlow.pack.done.ok": "OK registered. Wellmix was notified.",
  "quoteFlow.pack.done.no": "Answer registered. Wellmix was notified.",
  "quoteFlow.chip.returned": "Returned: waiting for the supplier",
  "quoteFlow.chip.packWaiting": "Packaging: waiting for the OK",
  "quoteFlow.chip.packOk": "Packaging: supplier OK",
  "quoteFlow.chip.packNo": "Packaging: supplier said no",
  "quoteFlow.chip.open": "Negotiate and packaging",
  "purchaseFlow.error.negotiation_pending":
    "This quote was returned and the supplier has not answered yet. Wait for the answer (or register it on the quote) before choosing.",
  "purchaseFlow.error.packaging_ok_waiting":
    "The packaging proposal is still waiting for the supplier's OK. The choice only goes on after the OK.",
  "purchaseFlow.error.packaging_ok_refused":
    "The supplier refused the packaging proposal. Send another proposal or choose another supplier.",
  "purchaseFlow.error.negotiation_not_answered":
    "Only an answered quote, with a price, can be negotiated.",
  "purchaseFlow.error.negotiation_none":
    "There is no return waiting for an answer on this quote.",
  "purchaseFlow.error.negotiation_too_many":
    "This quote already had too many rounds. Agree by chat and register the answer.",
  "purchaseFlow.error.negotiation_target_invalid":
    "The proposed price must be above zero and below the quote price.",
  "purchaseFlow.error.negotiation_no_target":
    "Wellmix did not propose a price: send another price or keep the current one.",
  "purchaseFlow.error.negotiation_price_invalid": "Enter the new price.",
  "purchaseFlow.error.comment_required":
    "Write the comment (at least 3 letters).",
  "purchaseFlow.error.comment_too_long":
    "Comment too long (up to 1,000 characters).",
  "purchaseFlow.error.prompt_too_long":
    "Prompt too long (up to 2,000 characters).",
  "purchaseFlow.error.proposal_image_required":
    "Attach the proposal image (JPG, PNG or WebP).",
  "purchaseFlow.error.proposal_not_waiting":
    "There is no packaging proposal waiting for an answer.",
  "purchaseFlow.error.proposal_closed":
    "This quote is already closed: the proposal no longer changes.",
  "notif.quoteReturned.subject": "Quote returned: {product}",
  "notif.quoteReturned.body":
    "Wellmix returned your quote: {comment} Open the quote and answer.",
  "notif.quoteReturned.bodyTarget":
    "Wellmix returned your quote: {comment} Proposed price: {target}. Open the quote and answer.",
  "notif.packagingProposal.subject": "Packaging proposal: {product}",
  "notif.packagingProposal.body":
    "Wellmix sent the proposed packaging for this product. Open the quote, see the image and answer OK or No.",
};

export const zh: Record<keyof typeof pt, string> = {
  "quoteFlow.neg.title": "议价",
  "quoteFlow.neg.hint.wellmix":
    "不接受当前报价？请退回并写明原因，也可以写上您提出的价格。供应商可以接受、另报新价或维持原价。在供应商回复之前，暂不能选定供应商。",
  "quoteFlow.neg.current": "报价单价格：{price}。",
  "quoteFlow.neg.comment": "原因（供应商可见）",
  "quoteFlow.neg.target": "Wellmix 提出的价格（{currency}）",
  "quoteFlow.neg.targetHint":
    "已按低 {pct}% 预填（{suggested}），可修改或清空。",
  "quoteFlow.neg.return": "附意见退回",
  "quoteFlow.neg.waiting": "已于 {date} 退回：等待供应商回复。",
  "quoteFlow.neg.pending.supplier":
    "Wellmix 退回了您的报价。请阅读原因并在下方回复。",
  "quoteFlow.neg.proposed": "Wellmix 提出的价格：{price}。",
  "quoteFlow.neg.reply.title": "您的回复",
  "quoteFlow.neg.reply.title.wellmix": "登记供应商的回复（如果他在别处已回复）",
  "quoteFlow.neg.reply.accept": "接受提出的价格（{price}）",
  "quoteFlow.neg.reply.counter": "另报新价",
  "quoteFlow.neg.reply.keep": "维持当前价格（{price}）",
  "quoteFlow.neg.reply.price": "新价格（{currency}）",
  "quoteFlow.neg.reply.comment": "备注（维持原价时必填）",
  "quoteFlow.neg.reply.submit": "回复",
  "quoteFlow.neg.history": "议价记录",
  "quoteFlow.neg.round.return": "Wellmix 退回",
  "quoteFlow.neg.round.accept": "供应商已接受",
  "quoteFlow.neg.round.counter": "供应商另报新价",
  "quoteFlow.neg.round.keep": "供应商维持原价",
  "quoteFlow.neg.round.target": "提出 {price}",
  "quoteFlow.neg.round.price": "{from} → {to}",
  "quoteFlow.neg.done.returned": "报价已退回，已通知供应商。",
  "quoteFlow.neg.done.replied": "回复已登记，已通知 Wellmix。",
  "quoteFlow.neg.chat": "如需在回复前沟通，请使用页面顶部的消息按钮。",
  "quoteFlow.pack.title": "包装方案",
  "quoteFlow.pack.hint.wellmix":
    "把拟定包装的图片（以及生成它的提示词）发给供应商，由他回复“可以”或“不可以”。方案发出后，需等供应商确认才能选定供应商。",
  "quoteFlow.pack.prompt": "生成图片所用的提示词（选填）",
  "quoteFlow.pack.image": "方案图片",
  "quoteFlow.pack.send": "发送给供应商",
  "quoteFlow.pack.sendNew": "发送新的方案",
  "quoteFlow.pack.version": "方案 {n}，{date} 由 {name} 发送。",
  "quoteFlow.pack.state.waiting": "等待供应商",
  "quoteFlow.pack.state.ok": "供应商已确认",
  "quoteFlow.pack.state.no": "供应商表示不可以",
  "quoteFlow.pack.decided": "{name}，{date}。",
  "quoteFlow.pack.ask.supplier":
    "这是 Wellmix 为该产品拟定的包装。您能按此生产吗？",
  "quoteFlow.pack.ok": "可以，能按此生产",
  "quoteFlow.pack.no": "不可以",
  "quoteFlow.pack.comment": "备注（选择“不可以”时必填）",
  "quoteFlow.pack.register.wellmix": "登记供应商的回复（如果他在别处已回复）",
  "quoteFlow.pack.refused.wellmix":
    "供应商拒绝了该包装。请重新考虑：发送新的方案或选择其他供应商。",
  "quoteFlow.pack.open": "打开图片",
  "quoteFlow.pack.history": "以前的方案",
  "quoteFlow.pack.done.sent": "方案已发送，已通知供应商。",
  "quoteFlow.pack.done.ok": "已登记确认，已通知 Wellmix。",
  "quoteFlow.pack.done.no": "回复已登记，已通知 Wellmix。",
  "quoteFlow.chip.returned": "已退回：等待供应商",
  "quoteFlow.chip.packWaiting": "包装：等待确认",
  "quoteFlow.chip.packOk": "包装：供应商已确认",
  "quoteFlow.chip.packNo": "包装：供应商表示不可以",
  "quoteFlow.chip.open": "议价与包装",
  "purchaseFlow.error.negotiation_pending":
    "该报价已退回，供应商尚未回复。请等待回复（或在报价单中登记）后再选择。",
  "purchaseFlow.error.packaging_ok_waiting":
    "包装方案仍在等待供应商确认，确认后才能继续选择。",
  "purchaseFlow.error.packaging_ok_refused":
    "供应商拒绝了包装方案。请发送新的方案或选择其他供应商。",
  "purchaseFlow.error.negotiation_not_answered":
    "只有已回复且有价格的报价才能议价。",
  "purchaseFlow.error.negotiation_none": "该报价没有等待回复的退回。",
  "purchaseFlow.error.negotiation_too_many":
    "该报价的议价轮次已过多。请通过聊天商定后登记回复。",
  "purchaseFlow.error.negotiation_target_invalid":
    "提出的价格必须大于零且低于报价单价格。",
  "purchaseFlow.error.negotiation_no_target":
    "Wellmix 没有提出价格：请另报新价或维持当前价格。",
  "purchaseFlow.error.negotiation_price_invalid": "请填写新价格。",
  "purchaseFlow.error.comment_required": "请填写备注（至少 3 个字符）。",
  "purchaseFlow.error.comment_too_long": "备注过长（最多 1000 个字符）。",
  "purchaseFlow.error.prompt_too_long": "提示词过长（最多 2000 个字符）。",
  "purchaseFlow.error.proposal_image_required":
    "请附上方案图片（JPG、PNG 或 WebP）。",
  "purchaseFlow.error.proposal_not_waiting": "没有等待回复的包装方案。",
  "purchaseFlow.error.proposal_closed": "该报价已结束，方案不能再更改。",
  "notif.quoteReturned.subject": "报价被退回：{product}",
  "notif.quoteReturned.body":
    "Wellmix 退回了您的报价：{comment} 请打开报价单并回复。",
  "notif.quoteReturned.bodyTarget":
    "Wellmix 退回了您的报价：{comment} 提出的价格：{target}。请打开报价单并回复。",
  "notif.packagingProposal.subject": "包装方案：{product}",
  "notif.packagingProposal.body":
    "Wellmix 发来了该产品的拟定包装。请打开报价单查看图片，并回复“可以”或“不可以”。",
};
