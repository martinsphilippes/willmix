/**
 * Dicionário do módulo "inquiries" (Consultas, dono, 27/11/2026): a lista
 * única do fornecedor (convites de book, solicitações e cotações de compra)
 * com a coluna de completude, a marca "Necessita amostragem" da consulta, a
 * tela do item do fornecedor reorganizada e a conta corrente no menu do
 * parceiro. Mesmas chaves em pt, en e zh.
 */
export const pt = {
  "inquiries.col.completion": "Completude",
  "inquiries.col.product": "Produto",
  "inquiries.moreProducts": "+{n}",
  "inquiries.completion.hint": "{done} de {total} etapas resolvidas",
  "inquiries.kind.quote": "Cotação de compra",
  "inquiries.photosTitle": "Fotos do produto",
  "inquiries.samplingNeed.label": "Necessita amostragem",
  "inquiries.samplingNeed.mark": "Marcar",
  "inquiries.samplingNeed.unmark": "Desmarcar",
  "inquiries.samplingNeed.hintOn":
    "Marcada: o fornecedor vê a amostragem e envia as fotos e os vídeos da amostra; o produto e o pedido de compra esperam a amostra aprovada.",
  "inquiries.samplingNeed.hintOff":
    "Desmarcada (o padrão): a amostragem não aparece para o fornecedor e nada espera a amostra.",
  "inquiries.samplingNeed.saved.yes":
    "Amostragem marcada: o fornecedor já vê e pode enviar a amostra.",
  "inquiries.samplingNeed.saved.no":
    "Amostragem desmarcada: ela não aparece mais para o fornecedor.",
  "inquiries.schedule.title": "Programação",
  "inquiries.schedule.single": "Entrega única: {n}.",
  "inquiries.answer.title": "Responder",
  "inquiries.answer.none": "Nada a responder agora.",
  "inquiries.answer.detail": "Ver a resposta do fornecedor",
  "inquiries.answer.detailTitle": "Resposta do fornecedor",
  "inquiries.settings.account": "Conta corrente no menu do fornecedor",
  "inquiries.settings.accountHint":
    "Sim: o item Conta corrente aparece no menu do fornecedor, abaixo das Pendências. Não (o padrão): fica oculto; a tela segue abrindo pelo endereço.",
};

export const en: Record<keyof typeof pt, string> = {
  "inquiries.col.completion": "Completion",
  "inquiries.col.product": "Product",
  "inquiries.moreProducts": "+{n}",
  "inquiries.completion.hint": "{done} of {total} steps resolved",
  "inquiries.kind.quote": "Purchase quote",
  "inquiries.photosTitle": "Product photos",
  "inquiries.samplingNeed.label": "Sampling required",
  "inquiries.samplingNeed.mark": "Check",
  "inquiries.samplingNeed.unmark": "Uncheck",
  "inquiries.samplingNeed.hintOn":
    "Checked: the supplier sees the sampling and sends the sample photos and videos; the product and the purchase order wait for the approved sample.",
  "inquiries.samplingNeed.hintOff":
    "Unchecked (the default): the supplier does not see the sampling and nothing waits for the sample.",
  "inquiries.samplingNeed.saved.yes":
    "Sampling checked: the supplier can now see and send the sample.",
  "inquiries.samplingNeed.saved.no":
    "Sampling unchecked: the supplier no longer sees it.",
  "inquiries.schedule.title": "Schedule",
  "inquiries.schedule.single": "Single delivery: {n}.",
  "inquiries.answer.title": "Reply",
  "inquiries.answer.none": "Nothing to reply right now.",
  "inquiries.answer.detail": "See the supplier's answer",
  "inquiries.answer.detailTitle": "Supplier's answer",
  "inquiries.settings.account": "Account statement in the supplier menu",
  "inquiries.settings.accountHint":
    "Yes: the Account statement item shows in the supplier menu, below the To-dos. No (the default): hidden; the page still opens by its address.",
};

export const zh: Record<keyof typeof pt, string> = {
  "inquiries.col.completion": "完成度",
  "inquiries.col.product": "产品",
  "inquiries.moreProducts": "+{n}",
  "inquiries.completion.hint": "已完成 {done}/{total} 个步骤",
  "inquiries.kind.quote": "采购询价",
  "inquiries.photosTitle": "产品照片",
  "inquiries.samplingNeed.label": "需要打样",
  "inquiries.samplingNeed.mark": "勾选",
  "inquiries.samplingNeed.unmark": "取消勾选",
  "inquiries.samplingNeed.hintOn":
    "已勾选：供应商可以看到打样并发送样品的照片和视频；产品和采购订单要等样品通过。",
  "inquiries.samplingNeed.hintOff":
    "未勾选（默认）：供应商看不到打样，也没有任何步骤等待样品。",
  "inquiries.samplingNeed.saved.yes":
    "已勾选打样：供应商现在可以看到并发送样品。",
  "inquiries.samplingNeed.saved.no": "已取消打样：供应商不再看到它。",
  "inquiries.schedule.title": "交货计划",
  "inquiries.schedule.single": "一次交货：{n}。",
  "inquiries.answer.title": "回复",
  "inquiries.answer.none": "目前无需回复。",
  "inquiries.answer.detail": "查看供应商的回复",
  "inquiries.answer.detailTitle": "供应商的回复",
  "inquiries.settings.account": "供应商菜单中的往来账",
  "inquiries.settings.accountHint":
    "是：往来账显示在供应商菜单中，位于待办事项下方。否（默认）：隐藏；页面仍可通过地址打开。",
};
