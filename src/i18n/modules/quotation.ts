/**
 * Dicionário do módulo "quotation" (Cotação unificada, dono, 22/11/2026;
 * docs/QUOTATION.md): a lista de todas as cotações com a aba dos convites de
 * book, o produto da cotação com o quadro comparativo (conversa e histórico
 * de cada fornecedor num modal), a contraproposta em massa e a negociação
 * dentro da cotação de compra, para a Wellmix e para o fornecedor. Mesmas
 * chaves em pt, en e zh.
 */
export const pt = {
  "quotation.close": "Fechar",
  "quotation.list.title": "Cotação",
  "quotation.list.subtitle":
    "Todas as cotações com os fornecedores: as que saíram de um book, de uma encomenda ou de uma reposição. A negociação acontece dentro da cotação, até escolher o fornecedor do pedido.",
  "quotation.list.count": "{n} cotações · {products} produtos distintos",
  "quotation.list.empty": "Nenhuma cotação ainda.",
  "quotation.list.suppliers": "{n} fornecedores",
  "quotation.tabs.open": "Em andamento",
  "quotation.tabs.closed": "Encerradas",
  "quotation.tabs.invites": "Convites de book",
  "quotation.tabs.emptyOpen": "Nenhuma cotação em andamento.",
  "quotation.tabs.emptyClosed": "Nenhuma cotação encerrada ainda.",
  "quotation.col.origin": "Origem",
  "quotation.origin.book": "Book",
  "quotation.origin.order": "Encomenda",
  "quotation.origin.replenishment": "Reposição",
  "quotation.detail.title": "Cotação nº {n}",
  "quotation.detail.back": "Voltar às cotações",
  "quotation.item.product": "Produto da cotação",
  "quotation.item.open": "Abrir o produto na cotação",
  "quotation.board.hint":
    "Marque os fornecedores que vão receber a contraproposta do bloco ao lado. Os ícones de cada linha abrem a conversa e a sequência de propostas e contrapropostas com aquele fornecedor.",
  "quotation.board.col.select": "Receber a contraproposta",
  "quotation.board.col.actions": "Conversa e histórico",
  "quotation.board.select": "Marcar {name} para a contraproposta",
  "quotation.board.current": "Aberta aqui",
  "quotation.board.pending": "Contraproposta enviada",
  "quotation.board.chat": "Conversar com {name} sobre este produto",
  "quotation.board.chatTitle": "Conversa · {name}",
  "quotation.board.history": "Ver propostas e contrapropostas de {name}",
  "quotation.board.historyTitle": "Propostas e contrapropostas · {name}",
  "quotation.board.open": "Abrir a cotação de {name}",
  "quotation.counter.title": "Devolver com contraproposta",
  "quotation.counter.hint":
    "Vai para os fornecedores marcados no quadro comparativo. Comentário obrigatório e ao menos um valor.",
  "quotation.counter.sendMarked": "Enviar aos marcados",
  "quotation.counter.sendAll": "Enviar a todos ({n})",
  "quotation.counter.none":
    "Nenhum fornecedor pode receber contraproposta agora: é preciso ter respondido e não ter outra contraproposta esperando a resposta dele.",
  "quotation.counter.sent": "Contraproposta enviada a {n} fornecedor(es).",
  "quotation.history.answer": "Proposta do fornecedor",
  "quotation.history.decline": "O fornecedor recusou a cotação",
  "quotation.history.proposal": "Contraproposta da Wellmix",
  "quotation.history.empty": "Nenhuma proposta ainda.",
  "quotation.error.quote_counter_none":
    "Marque ao menos um fornecedor no quadro comparativo.",
  "quotation.error.quote_counter_not_answered":
    "A contraproposta só vai para quem já respondeu a cotação.",
  "quotation.notify.counter.subject":
    "Cotação nº {n}: a Wellmix devolveu com contraproposta",
  "quotation.notify.counter.body":
    "Produto: {product}. Abra a cotação, veja a contraproposta e corrija a sua resposta.",
  "quotation.notify.message.subject": "Cotação nº {n}: nova mensagem",
  "quotation.supplier.title": "Negociação com a Wellmix",
  "quotation.supplier.counter": "Contraproposta da Wellmix para {product}",
  "quotation.supplier.counterHint":
    "Corrija a sua resposta abaixo e envie de novo até {br} (Brasília) · {cn} (China).",
  "quotation.supplier.counterClosed":
    "O prazo para corrigir a resposta acabou; fale com a Wellmix pela conversa.",
};

export const en: Record<keyof typeof pt, string> = {
  "quotation.close": "Close",
  "quotation.list.title": "Quotation",
  "quotation.list.subtitle":
    "Every quotation with suppliers: from a book, a customer order or a replenishment. Negotiation happens inside the quotation, until the supplier of the order is chosen.",
  "quotation.list.count": "{n} quotations · {products} distinct products",
  "quotation.list.empty": "No quotations yet.",
  "quotation.list.suppliers": "{n} suppliers",
  "quotation.tabs.open": "In progress",
  "quotation.tabs.closed": "Closed",
  "quotation.tabs.invites": "Book invitations",
  "quotation.tabs.emptyOpen": "No quotations in progress.",
  "quotation.tabs.emptyClosed": "No closed quotations yet.",
  "quotation.col.origin": "Origin",
  "quotation.origin.book": "Book",
  "quotation.origin.order": "Customer order",
  "quotation.origin.replenishment": "Replenishment",
  "quotation.detail.title": "Quotation no. {n}",
  "quotation.detail.back": "Back to quotations",
  "quotation.item.product": "Product in this quotation",
  "quotation.item.open": "Open the product in the quotation",
  "quotation.board.hint":
    "Tick the suppliers that will receive the counterproposal from the block on the side. The icons on each row open the conversation and the sequence of proposals and counterproposals with that supplier.",
  "quotation.board.col.select": "Receive the counterproposal",
  "quotation.board.col.actions": "Conversation and history",
  "quotation.board.select": "Tick {name} for the counterproposal",
  "quotation.board.current": "Open here",
  "quotation.board.pending": "Counterproposal sent",
  "quotation.board.chat": "Talk to {name} about this product",
  "quotation.board.chatTitle": "Conversation · {name}",
  "quotation.board.history": "See proposals and counterproposals of {name}",
  "quotation.board.historyTitle": "Proposals and counterproposals · {name}",
  "quotation.board.open": "Open the quotation of {name}",
  "quotation.counter.title": "Send back with a counterproposal",
  "quotation.counter.hint":
    "Goes to the suppliers ticked on the comparison board. A comment and at least one value are required.",
  "quotation.counter.sendMarked": "Send to ticked",
  "quotation.counter.sendAll": "Send to all ({n})",
  "quotation.counter.none":
    "No supplier can receive a counterproposal now: they must have answered and have no other counterproposal waiting for them.",
  "quotation.counter.sent": "Counterproposal sent to {n} supplier(s).",
  "quotation.history.answer": "Supplier proposal",
  "quotation.history.decline": "The supplier declined the quotation",
  "quotation.history.proposal": "Wellmix counterproposal",
  "quotation.history.empty": "No proposals yet.",
  "quotation.error.quote_counter_none":
    "Tick at least one supplier on the comparison board.",
  "quotation.error.quote_counter_not_answered":
    "A counterproposal only goes to those who already answered the quotation.",
  "quotation.notify.counter.subject":
    "Quotation no. {n}: Wellmix sent a counterproposal",
  "quotation.notify.counter.body":
    "Product: {product}. Open the quotation, see the counterproposal and update your answer.",
  "quotation.notify.message.subject": "Quotation no. {n}: new message",
  "quotation.supplier.title": "Negotiation with Wellmix",
  "quotation.supplier.counter": "Wellmix counterproposal for {product}",
  "quotation.supplier.counterHint":
    "Update your answer below and send it again by {br} (Brasília) · {cn} (China).",
  "quotation.supplier.counterClosed":
    "The deadline to update the answer has passed; talk to Wellmix in the conversation.",
};

export const zh: Record<keyof typeof pt, string> = {
  "quotation.close": "关闭",
  "quotation.list.title": "询价",
  "quotation.list.subtitle":
    "与供应商的全部询价：来自 Book、客户订货或补货。谈判在询价内进行，直到确定订单的供应商。",
  "quotation.list.count": "{n} 个询价 · {products} 个不同产品",
  "quotation.list.empty": "暂无询价。",
  "quotation.list.suppliers": "{n} 家供应商",
  "quotation.tabs.open": "进行中",
  "quotation.tabs.closed": "已结束",
  "quotation.tabs.invites": "Book 邀请",
  "quotation.tabs.emptyOpen": "没有进行中的询价。",
  "quotation.tabs.emptyClosed": "暂无已结束的询价。",
  "quotation.col.origin": "来源",
  "quotation.origin.book": "Book",
  "quotation.origin.order": "客户订货",
  "quotation.origin.replenishment": "补货",
  "quotation.detail.title": "询价 {n} 号",
  "quotation.detail.back": "返回询价列表",
  "quotation.item.product": "本询价的产品",
  "quotation.item.open": "在询价中打开产品",
  "quotation.board.hint":
    "勾选将收到旁边还价的供应商。每行的图标可打开与该供应商的对话以及报价与还价的记录。",
  "quotation.board.col.select": "接收还价",
  "quotation.board.col.actions": "对话与记录",
  "quotation.board.select": "勾选 {name} 接收还价",
  "quotation.board.current": "当前",
  "quotation.board.pending": "已发还价",
  "quotation.board.chat": "与 {name} 讨论此产品",
  "quotation.board.chatTitle": "对话 · {name}",
  "quotation.board.history": "查看 {name} 的报价与还价",
  "quotation.board.historyTitle": "报价与还价 · {name}",
  "quotation.board.open": "打开 {name} 的询价",
  "quotation.counter.title": "退回并还价",
  "quotation.counter.hint":
    "发送给比价表中勾选的供应商。必须填写说明和至少一个数值。",
  "quotation.counter.sendMarked": "发送给已勾选",
  "quotation.counter.sendAll": "发送给全部（{n}）",
  "quotation.counter.none":
    "目前没有供应商可接收还价：需已回复且没有待其答复的还价。",
  "quotation.counter.sent": "已向 {n} 家供应商发送还价。",
  "quotation.history.answer": "供应商报价",
  "quotation.history.decline": "供应商拒绝了询价",
  "quotation.history.proposal": "Wellmix 还价",
  "quotation.history.empty": "暂无报价。",
  "quotation.error.quote_counter_none": "请在比价表中至少勾选一家供应商。",
  "quotation.error.quote_counter_not_answered":
    "还价只能发送给已回复询价的供应商。",
  "quotation.notify.counter.subject": "询价 {n} 号：Wellmix 已还价",
  "quotation.notify.counter.body":
    "产品：{product}。请打开询价，查看还价并更新您的回复。",
  "quotation.notify.message.subject": "询价 {n} 号：新消息",
  "quotation.supplier.title": "与 Wellmix 的谈判",
  "quotation.supplier.counter": "Wellmix 对 {product} 的还价",
  "quotation.supplier.counterHint":
    "请在下方修改您的回复并于 {br}（巴西利亚）· {cn}（中国）前重新发送。",
  "quotation.supplier.counterClosed":
    "修改回复的期限已过；请通过对话联系 Wellmix。",
};
