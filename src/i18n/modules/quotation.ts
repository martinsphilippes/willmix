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
  "quotation.list.title": "Consulta",
  "quotation.list.subtitle":
    "Todas as consultas com os fornecedores: as que saíram de um book, de uma encomenda ou de uma reposição. A negociação acontece dentro da consulta, até escolher o fornecedor do pedido.",
  "quotation.list.count": "{n} consultas · {products} produtos distintos",
  "quotation.list.empty": "Nenhuma consulta ainda.",
  "quotation.list.suppliers": "{n} fornecedores",
  "quotation.tabs.open": "Em andamento",
  "quotation.tabs.closed": "Encerradas",
  "quotation.tabs.invites": "Convites de book",
  "quotation.tabs.emptyOpen": "Nenhuma consulta em andamento.",
  "quotation.tabs.emptyClosed": "Nenhuma consulta encerrada ainda.",
  "quotation.col.origin": "Origem",
  "quotation.origin.book": "Book",
  "quotation.origin.order": "Encomenda",
  "quotation.origin.replenishment": "Reposição",
  "quotation.detail.title": "Consulta nº {n}",
  "quotation.detail.back": "Voltar às consultas",
  "quotation.item.product": "Produto da consulta",
  "quotation.item.open": "Abrir o produto na consulta",
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
  "quotation.board.open": "Abrir a consulta de {name}",
  "quotation.counter.title": "Devolver com contraproposta",
  "quotation.counter.hint":
    "Vai para os fornecedores marcados no quadro comparativo. Comentário obrigatório e ao menos um valor.",
  "quotation.counter.sendMarked": "Enviar aos marcados",
  "quotation.counter.sendAll": "Enviar a todos ({n})",
  "quotation.counter.none":
    "Nenhum fornecedor pode receber contraproposta agora: é preciso ter respondido e não ter outra contraproposta esperando a resposta dele.",
  "quotation.counter.sent": "Contraproposta enviada a {n} fornecedor(es).",
  "quotation.history.answer": "Proposta do fornecedor",
  "quotation.history.decline": "O fornecedor recusou a consulta",
  "quotation.history.proposal": "Contraproposta da Wellmix",
  "quotation.history.empty": "Nenhuma proposta ainda.",
  "quotation.error.quote_counter_none":
    "Marque ao menos um fornecedor no quadro comparativo.",
  "quotation.error.quote_counter_not_answered":
    "A contraproposta só vai para quem já respondeu a consulta.",
  "quotation.notify.counter.subject":
    "Consulta nº {n}: a Wellmix devolveu com contraproposta",
  "quotation.notify.counter.body":
    "Produto: {product}. Abra a consulta, veja a contraproposta e corrija a sua resposta.",
  "quotation.notify.message.subject": "Consulta nº {n}: nova mensagem",
  "quotation.supplier.title": "Negociação com a Wellmix",
  "quotation.supplier.counter": "Contraproposta da Wellmix para {product}",
  "quotation.supplier.counterHint":
    "Corrija a sua resposta abaixo e envie de novo até {br} (Brasília) · {cn} (China).",
  "quotation.supplier.counterClosed":
    "O prazo para corrigir a resposta acabou; fale com a Wellmix pela conversa.",
  "sampling.intro.earlySupplier":
    "Você já pode enviar as fotos e os vídeos da amostra deste item (feita em impressora 3D: detalhes, medidas, encaixes), sem esperar a decisão da Wellmix. A amostra física não é enviada.",
  "sampling.intro.earlyWellmix":
    "O fornecedor já pode enviar a amostra enquanto a consulta corre. Quando ele enviar, confira e aprove, ou reprove com o motivo para ele mandar de novo.",
  "quoteSampling.col": "Amostra",
  "quoteSampling.skipped": "Dispensada",
  "quoteSampling.skippedHint":
    "Fornecedor conhecido deste produto (já vendeu à Wellmix): sem amostragem.",
  "quoteSampling.none": "—",
  "quoteSampling.open": "Ver a amostra de {name}",
  "quoteSampling.modalTitle": "Amostragem · {name}",
  "quoteSampling.photos": "Fotos do produto",
  "quoteSampling.photosHint":
    "Fotos do nosso cadastro, para você fazer a amostra.",
  "quoteSampling.supplierSkipped":
    "Você já forneceu este produto à Wellmix: não precisa enviar amostra.",
  "quoteSampling.productsTitle": "Fotos do produto e amostragem",
  "quoteSampling.choose.hint":
    "Só pode ser a vencedora quem tem a amostra de todos os produtos aprovada ou é fornecedor conhecido do produto.",
  "quoteSampling.choose.blocked": "amostra ainda não aprovada",
  "quoteSampling.notice.file": "Arquivo adicionado à amostragem.",
  "quoteSampling.notice.removed": "Arquivo retirado.",
  "quoteSampling.notice.submitted":
    "Amostra enviada para a validação da Wellmix.",
  "quoteSampling.notice.approved": "Amostra aprovada.",
  "quoteSampling.notice.rejected":
    "Amostra reprovada; o fornecedor foi avisado.",
  "quoteSampling.notify.submitted.subject":
    "Consulta nº {n}: amostra de {product} enviada",
  "quoteSampling.notify.approved.subject": "Consulta nº {n}: amostra aprovada",
  "quoteSampling.notify.rejected.subject": "Consulta nº {n}: amostra reprovada",
  "quote.error.quote_winner_sampling":
    "A amostra deste fornecedor ainda não foi aprovada: só vence quem tem a amostra aprovada ou é conhecido do produto.",
  "quote.error.sampling_not_open": "Não há amostragem para este produto.",
  "quote.error.sampling_closed": "Esta rodada da amostragem já foi enviada.",
  "quote.error.sampling_too_many": "Limite de arquivos da rodada atingido.",
  "quote.error.sampling_file_type":
    "Envie foto (JPG, PNG, WEBP, HEIC) ou vídeo (MP4, MOV, WEBM, 3GP).",
  "quote.error.sampling_file_missing":
    "Adicione ao menos uma foto ou um vídeo.",
  "quote.error.sampling_not_submitted":
    "A amostra ainda não foi enviada para a validação.",
  "quote.error.sampling_reason_required": "Para reprovar, escreva o motivo.",
  "quote.error.sampling_supplier_only": "Só o fornecedor envia a amostra.",
  "quoteSampling.yourSample": "Sua amostra",
  "quoteSampling.reference":
    "Referência da Wellmix: fotos do nosso cadastro, para você fazer a amostra.",
  "itemImages.title": "Imagens",
  "itemImages.hint":
    "Clique para abrir. O botão no canto copia a imagem para colar no chat.",
  "itemImages.reference": "Referência da Wellmix",
  "itemImages.from.product": " (fotos do cadastro do produto)",
  "itemImages.from.book": " (foto do item do book)",
  "itemImages.noReference": "Sem foto de referência.",
  "itemImages.sampleOf": "Amostra de {name}",
  "itemImages.noSample": "Ainda não enviou a amostra.",
  "itemImages.copy": "Copiar a imagem para colar no chat",
  "itemImages.copied": "Imagem copiada",
};

export const en: Record<keyof typeof pt, string> = {
  "quotation.close": "Close",
  "quotation.list.title": "Inquiry",
  "quotation.list.subtitle":
    "Every inquiry with suppliers: from a book, a customer order or a replenishment. Negotiation happens inside the inquiry, until the supplier of the order is chosen.",
  "quotation.list.count": "{n} inquiries · {products} distinct products",
  "quotation.list.empty": "No inquiries yet.",
  "quotation.list.suppliers": "{n} suppliers",
  "quotation.tabs.open": "In progress",
  "quotation.tabs.closed": "Closed",
  "quotation.tabs.invites": "Book invitations",
  "quotation.tabs.emptyOpen": "No inquiries in progress.",
  "quotation.tabs.emptyClosed": "No closed inquiries yet.",
  "quotation.col.origin": "Origin",
  "quotation.origin.book": "Book",
  "quotation.origin.order": "Customer order",
  "quotation.origin.replenishment": "Replenishment",
  "quotation.detail.title": "Inquiry no. {n}",
  "quotation.detail.back": "Back to inquiries",
  "quotation.item.product": "Product in this inquiry",
  "quotation.item.open": "Open the product in the inquiry",
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
  "quotation.board.open": "Open the inquiry of {name}",
  "quotation.counter.title": "Send back with a counterproposal",
  "quotation.counter.hint":
    "Goes to the suppliers ticked on the comparison board. A comment and at least one value are required.",
  "quotation.counter.sendMarked": "Send to ticked",
  "quotation.counter.sendAll": "Send to all ({n})",
  "quotation.counter.none":
    "No supplier can receive a counterproposal now: they must have answered and have no other counterproposal waiting for them.",
  "quotation.counter.sent": "Counterproposal sent to {n} supplier(s).",
  "quotation.history.answer": "Supplier proposal",
  "quotation.history.decline": "The supplier declined the inquiry",
  "quotation.history.proposal": "Wellmix counterproposal",
  "quotation.history.empty": "No proposals yet.",
  "quotation.error.quote_counter_none":
    "Tick at least one supplier on the comparison board.",
  "quotation.error.quote_counter_not_answered":
    "A counterproposal only goes to those who already answered the inquiry.",
  "quotation.notify.counter.subject":
    "Inquiry no. {n}: Wellmix sent a counterproposal",
  "quotation.notify.counter.body":
    "Product: {product}. Open the inquiry, see the counterproposal and update your answer.",
  "quotation.notify.message.subject": "Inquiry no. {n}: new message",
  "quotation.supplier.title": "Negotiation with Wellmix",
  "quotation.supplier.counter": "Wellmix counterproposal for {product}",
  "quotation.supplier.counterHint":
    "Update your answer below and send it again by {br} (Brasília) · {cn} (China).",
  "quotation.supplier.counterClosed":
    "The deadline to update the answer has passed; talk to Wellmix in the conversation.",
  "sampling.intro.earlySupplier":
    "You can already send photos and videos of the sample of this item (3D-printed: details, dimensions, fittings), without waiting for Wellmix's decision. The physical sample is not shipped.",
  "sampling.intro.earlyWellmix":
    "The supplier can already send the sample while the inquiry is running. When they do, check and approve, or reject with the reason so they send again.",
  "quoteSampling.col": "Sample",
  "quoteSampling.skipped": "Not required",
  "quoteSampling.skippedHint":
    "Known supplier of this product (already sold it to Wellmix): no sampling.",
  "quoteSampling.none": "—",
  "quoteSampling.open": "See the sample of {name}",
  "quoteSampling.modalTitle": "Sampling · {name}",
  "quoteSampling.photos": "Product photos",
  "quoteSampling.photosHint":
    "Photos from our records, for you to make the sample.",
  "quoteSampling.supplierSkipped":
    "You have already supplied this product to Wellmix: no sample is needed.",
  "quoteSampling.productsTitle": "Product photos and sampling",
  "quoteSampling.choose.hint":
    "Only a supplier with the sample of every product approved, or a known supplier of the product, can be the winner.",
  "quoteSampling.choose.blocked": "sample not approved yet",
  "quoteSampling.notice.file": "File added to the sampling.",
  "quoteSampling.notice.removed": "File removed.",
  "quoteSampling.notice.submitted": "Sample sent for Wellmix validation.",
  "quoteSampling.notice.approved": "Sample approved.",
  "quoteSampling.notice.rejected":
    "Sample rejected; the supplier was notified.",
  "quoteSampling.notify.submitted.subject":
    "Inquiry no. {n}: sample of {product} sent",
  "quoteSampling.notify.approved.subject": "Inquiry no. {n}: sample approved",
  "quoteSampling.notify.rejected.subject": "Inquiry no. {n}: sample rejected",
  "quote.error.quote_winner_sampling":
    "This supplier's sample is not approved yet: only a supplier with an approved sample, or a known supplier of the product, can win.",
  "quote.error.sampling_not_open": "There is no sampling for this product.",
  "quote.error.sampling_closed": "This sampling round was already sent.",
  "quote.error.sampling_too_many": "File limit of the round reached.",
  "quote.error.sampling_file_type":
    "Send a photo (JPG, PNG, WEBP, HEIC) or a video (MP4, MOV, WEBM, 3GP).",
  "quote.error.sampling_file_missing": "Add at least one photo or video.",
  "quote.error.sampling_not_submitted":
    "The sample has not been sent for validation yet.",
  "quote.error.sampling_reason_required": "Write the reason to reject.",
  "quote.error.sampling_supplier_only": "Only the supplier sends the sample.",
  "quoteSampling.yourSample": "Your sample",
  "quoteSampling.reference":
    "Wellmix reference: photos from our records, for you to make the sample.",
  "itemImages.title": "Images",
  "itemImages.hint":
    "Click to open. The corner button copies the image so you can paste it in the chat.",
  "itemImages.reference": "Wellmix reference",
  "itemImages.from.product": " (photos from the product record)",
  "itemImages.from.book": " (photo of the book item)",
  "itemImages.noReference": "No reference photo.",
  "itemImages.sampleOf": "Sample from {name}",
  "itemImages.noSample": "No sample sent yet.",
  "itemImages.copy": "Copy the image to paste in the chat",
  "itemImages.copied": "Image copied",
};

export const zh: Record<keyof typeof pt, string> = {
  "quotation.close": "关闭",
  "quotation.list.title": "询盘",
  "quotation.list.subtitle":
    "与供应商的全部询盘：来自 Book、客户订货或补货。谈判在询盘内进行，直到确定订单的供应商。",
  "quotation.list.count": "{n} 个询盘 · {products} 个不同产品",
  "quotation.list.empty": "暂无询盘。",
  "quotation.list.suppliers": "{n} 家供应商",
  "quotation.tabs.open": "进行中",
  "quotation.tabs.closed": "已结束",
  "quotation.tabs.invites": "Book 邀请",
  "quotation.tabs.emptyOpen": "没有进行中的询盘。",
  "quotation.tabs.emptyClosed": "暂无已结束的询盘。",
  "quotation.col.origin": "来源",
  "quotation.origin.book": "Book",
  "quotation.origin.order": "客户订货",
  "quotation.origin.replenishment": "补货",
  "quotation.detail.title": "询盘 {n} 号",
  "quotation.detail.back": "返回询盘列表",
  "quotation.item.product": "本询盘的产品",
  "quotation.item.open": "在询盘中打开产品",
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
  "quotation.board.open": "打开 {name} 的询盘",
  "quotation.counter.title": "退回并还价",
  "quotation.counter.hint":
    "发送给比价表中勾选的供应商。必须填写说明和至少一个数值。",
  "quotation.counter.sendMarked": "发送给已勾选",
  "quotation.counter.sendAll": "发送给全部（{n}）",
  "quotation.counter.none":
    "目前没有供应商可接收还价：需已回复且没有待其答复的还价。",
  "quotation.counter.sent": "已向 {n} 家供应商发送还价。",
  "quotation.history.answer": "供应商报价",
  "quotation.history.decline": "供应商拒绝了询盘",
  "quotation.history.proposal": "Wellmix 还价",
  "quotation.history.empty": "暂无报价。",
  "quotation.error.quote_counter_none": "请在比价表中至少勾选一家供应商。",
  "quotation.error.quote_counter_not_answered":
    "还价只能发送给已回复询盘的供应商。",
  "quotation.notify.counter.subject": "询盘 {n} 号：Wellmix 已还价",
  "quotation.notify.counter.body":
    "产品：{product}。请打开询盘，查看还价并更新您的回复。",
  "quotation.notify.message.subject": "询盘 {n} 号：新消息",
  "quotation.supplier.title": "与 Wellmix 的谈判",
  "quotation.supplier.counter": "Wellmix 对 {product} 的还价",
  "quotation.supplier.counterHint":
    "请在下方修改您的回复并于 {br}（巴西利亚）· {cn}（中国）前重新发送。",
  "quotation.supplier.counterClosed":
    "修改回复的期限已过；请通过对话联系 Wellmix。",
  "sampling.intro.earlySupplier":
    "您现在就可以发送该商品样品（3D 打印：细节、尺寸、配合）的照片和视频，无需等待 Wellmix 的决定。实物样品无需寄送。",
  "sampling.intro.earlyWellmix":
    "询盘进行期间供应商即可发送样品。收到后请检查并批准，或填写原因驳回，让其重新发送。",
  "quoteSampling.col": "样品",
  "quoteSampling.skipped": "免样",
  "quoteSampling.skippedHint":
    "该产品的已知供应商（已向 Wellmix 供货）：无需打样。",
  "quoteSampling.none": "—",
  "quoteSampling.open": "查看 {name} 的样品",
  "quoteSampling.modalTitle": "样品 · {name}",
  "quoteSampling.photos": "产品照片",
  "quoteSampling.photosHint": "我们资料中的照片，供您制作样品。",
  "quoteSampling.supplierSkipped":
    "您已向 Wellmix 供应过该产品：无需发送样品。",
  "quoteSampling.productsTitle": "产品照片与样品",
  "quoteSampling.choose.hint":
    "只有所有产品样品均已批准，或为该产品已知供应商的，才能中选。",
  "quoteSampling.choose.blocked": "样品尚未批准",
  "quoteSampling.notice.file": "文件已添加到样品。",
  "quoteSampling.notice.removed": "文件已移除。",
  "quoteSampling.notice.submitted": "样品已提交 Wellmix 验证。",
  "quoteSampling.notice.approved": "样品已批准。",
  "quoteSampling.notice.rejected": "样品已驳回；已通知供应商。",
  "quoteSampling.notify.submitted.subject": "询盘 {n} 号：{product} 样品已发送",
  "quoteSampling.notify.approved.subject": "询盘 {n} 号：样品已批准",
  "quoteSampling.notify.rejected.subject": "询盘 {n} 号：样品被驳回",
  "quote.error.quote_winner_sampling":
    "该供应商的样品尚未批准：只有样品已批准或为该产品已知供应商的才能中选。",
  "quote.error.sampling_not_open": "该产品没有打样环节。",
  "quote.error.sampling_closed": "本轮样品已提交。",
  "quote.error.sampling_too_many": "已达到本轮文件上限。",
  "quote.error.sampling_file_type":
    "请发送照片（JPG、PNG、WEBP、HEIC）或视频（MP4、MOV、WEBM、3GP）。",
  "quote.error.sampling_file_missing": "请至少添加一张照片或一个视频。",
  "quote.error.sampling_not_submitted": "样品尚未提交验证。",
  "quote.error.sampling_reason_required": "驳回请填写原因。",
  "quote.error.sampling_supplier_only": "只有供应商可以发送样品。",
  "quoteSampling.yourSample": "您的样品",
  "quoteSampling.reference": "Wellmix 参考：我们资料中的照片，供您制作样品。",
  "itemImages.title": "图片",
  "itemImages.hint": "点击可打开。角上的按钮可复制图片，粘贴到聊天中。",
  "itemImages.reference": "Wellmix 参考",
  "itemImages.from.product": "（产品资料中的照片）",
  "itemImages.from.book": "（Book 条目的照片）",
  "itemImages.noReference": "没有参考照片。",
  "itemImages.sampleOf": "{name} 的样品",
  "itemImages.noSample": "尚未发送样品。",
  "itemImages.copy": "复制图片以粘贴到聊天",
  "itemImages.copied": "图片已复制",
};
