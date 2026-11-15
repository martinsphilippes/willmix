/**
 * Dicionário do módulo "quote-flow" (cotação: devolver com comentário,
 * contraproposta e resposta do fornecedor; proposta de embalagem com o OK
 * do fornecedor): mesmas chaves em pt, en e zh.
 */
export const pt = {
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
