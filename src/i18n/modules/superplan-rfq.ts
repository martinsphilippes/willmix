/**
 * Dicionário do módulo "superplan-rfq" (do Superplan à faca e à RFQ com o
 * fornecedor ganho: faca, MOQ, prazo e foto em alta na cotação): mesmas
 * chaves em pt, en e zh. Os textos da tela do Superplan ficam no módulo
 * "superplan" (vão para a simulação).
 */
export const pt = {
  "orders.origin.superplan": "Superplan",
  "purchaseFlow.error.superplan_items_missing":
    "Aberta do Superplan: falta o fornecedor enviar faca, MOQ, prazo e foto em alta. A proposta espera os quatro.",
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
  "purchaseFlow.error.superplan_items_missing":
    "Opened from Superplan: the supplier still has to send die-cut, MOQ, lead time and high-res photo. The proposal waits for all four.",
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
  "purchaseFlow.error.superplan_items_missing":
    "由 Superplan 发起：供应商尚需发送刀版、起订量、交期和高清照片。报价方案需等待四项齐全。",
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
