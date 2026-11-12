/**
 * Negociação da solicitação ao fornecedor (docs/SUPPLIER_REQUESTS.md,
 * "Negociação" e "SLA da negociação"). Mesmas chaves em pt, en e zh.
 */
export const pt = {
  "supplierRequests.negotiation.title": "Negociação e conversa",
  "supplierRequests.negotiation.empty":
    "Nenhuma mensagem ainda. As contrapropostas, respostas, mensagens e arquivos aparecem aqui, na ordem.",
  "supplierRequests.negotiation.side.wellmix": "Wellmix",
  "supplierRequests.negotiation.side.supplier": "Fornecedor",
  "supplierRequests.negotiation.kind.proposal": "Contraproposta",
  "supplierRequests.negotiation.kind.accept": "Aceitou a contraproposta",
  "supplierRequests.negotiation.kind.counter": "Nova proposta",
  "supplierRequests.negotiation.kind.reject": "Recusou a contraproposta",
  "supplierRequests.negotiation.kind.message": "Mensagem",
  "supplierRequests.negotiation.kind.answer": "Resposta",
  "supplierRequests.negotiation.file": "Arquivo",
  "supplierRequests.negotiation.pendingWellmix":
    "Contraproposta esperando o fornecedor. Enquanto ele não responde, a solicitação não pode ser aprovada.",
  "supplierRequests.negotiation.pendingSupplier":
    "A Wellmix devolveu com uma contraproposta. Aceite, responda com outra proposta ou recuse.",
  "supplierRequests.negotiation.approveBlocked":
    "Aprovar fica disponível depois que o fornecedor responder à contraproposta.",
  "supplierRequests.negotiation.propose": "Devolver com contraproposta",
  "supplierRequests.negotiation.proposeHint":
    "Proponha preço, pedido mínimo e prazo. O comentário é obrigatório e o fornecedor o lê.",
  "supplierRequests.negotiation.comment": "Comentário",
  "supplierRequests.negotiation.commentOptional": "Comentário (opcional)",
  "supplierRequests.negotiation.proposeSubmit": "Enviar contraproposta",
  "supplierRequests.negotiation.respond": "Responder à contraproposta",
  "supplierRequests.negotiation.respondHint":
    "Aceitar: os valores propostos viram a sua resposta. Nova proposta: informe os seus valores (o preço é obrigatório). Recusar: fica a sua resposta anterior.",
  "supplierRequests.negotiation.accept": "Aceitar",
  "supplierRequests.negotiation.counter": "Enviar nova proposta",
  "supplierRequests.negotiation.reject": "Recusar",
  "supplierRequests.negotiation.message": "Mensagem",
  "supplierRequests.negotiation.messageText": "Texto",
  "supplierRequests.negotiation.attach": "Arquivo (opcional)",
  "supplierRequests.negotiation.attachHint":
    "Foto, PDF ou Excel. Só a Wellmix e o fornecedor desta solicitação abrem.",
  "supplierRequests.negotiation.send": "Enviar",
  "supplierRequests.negotiation.sending": "Enviando…",
  "supplierRequests.negotiation.turn.supplier": "Esperando o fornecedor",
  "supplierRequests.negotiation.turn.wellmix": "Esperando a Wellmix",
  "supplierRequests.negotiation.notice.proposal":
    "Contraproposta enviada ao fornecedor.",
  "supplierRequests.negotiation.notice.accept":
    "Contraproposta aceita: os valores propostos viraram a resposta.",
  "supplierRequests.negotiation.notice.counter": "Nova proposta enviada.",
  "supplierRequests.negotiation.notice.reject":
    "Contraproposta recusada: fica a resposta anterior.",
  "supplierRequests.negotiation.notice.message": "Mensagem enviada.",

  "supplierRequests.sla.until": "SLA até {date}",
  "supplierRequests.sla.late": "Atrasada",
  "supplierRequests.sla.settingLabel":
    "SLA da negociação com o fornecedor (minutos)",
  "supplierRequests.sla.settingHint":
    "Conta da abertura da solicitação ao fornecedor até a decisão da Wellmix. Estourado, a solicitação fica atrasada e a Wellmix e o fornecedor recebem um aviso.",
  "settings.error.supplier_request_sla_invalid":
    "Informe o SLA da negociação em minutos (de 1 a 86400).",

  "supplierRequests.negotiation.sim.title": "Estimativa do Superplan",
  "supplierRequests.negotiation.sim.cost": "Custo por peça",
  "supplierRequests.negotiation.sim.minimum": "Preço mínimo",
  "supplierRequests.negotiation.sim.booking": "no booking:",
  "supplierRequests.negotiation.sim.target": "Preço mínimo desejado (R$)",
  "supplierRequests.negotiation.sim.targetHint":
    "Conta inversa: o sistema mostra o preço por peça necessário para chegar a esse mínimo.",
  "supplierRequests.negotiation.sim.needed": "Preço por peça necessário",
  "supplierRequests.negotiation.sim.use": "Usar este preço",
  "supplierRequests.negotiation.sim.unreachable":
    "Esse mínimo não é alcançável só com o preço (fica abaixo do custo sem a mercadoria).",
  "supplierRequests.negotiation.sim.currency":
    "A estimativa só funciona com preço em USD ou RMB.",
  "supplierRequests.negotiation.sim.missing":
    "Faltam dados do item para a estimativa (caixa, volume, frete ou câmbio).",
  "supplierRequests.negotiation.sim.hint":
    "Só estimativa, refeita a cada tecla com o câmbio de hoje e os padrões do Superplan; o que vale é a resposta do fornecedor.",
  "supplierRequests.error.supplier_request_supplier_only":
    "A resposta é do fornecedor, pelo portal: a Wellmix não responde por ele.",
  "supplierRequests.error.supplier_request_proposal_pending":
    "Há uma contraproposta esperando o fornecedor: ele aceita, responde com outra proposta ou recusa.",
  "supplierRequests.error.supplier_request_propose_invalid":
    "Contraproposta só depois de o fornecedor responder que faz.",
  "supplierRequests.error.supplier_request_comment_required":
    "Escreva o comentário da contraproposta.",
  "supplierRequests.error.supplier_request_offer_empty":
    "Informe ao menos um valor: preço, pedido mínimo ou prazo.",
  "supplierRequests.error.supplier_request_no_proposal":
    "Não há contraproposta esperando resposta.",
  "supplierRequests.error.supplier_request_message_empty":
    "Escreva a mensagem ou escolha um arquivo.",
  "supplierRequests.error.supplier_request_file_type":
    "Arquivo não aceito: envie foto, PDF ou Excel.",

  "supplierRequests.notify.proposal.subject":
    "Contraproposta na solicitação nº {n}",
  "supplierRequests.notify.proposal.body":
    "A Wellmix devolveu a solicitação nº {n} com uma contraproposta. Aceite, responda com outra proposta ou recuse no portal.",
  "supplierRequests.notify.accept.subject":
    "Contraproposta aceita na solicitação nº {n}",
  "supplierRequests.notify.accept.body":
    "O fornecedor aceitou a contraproposta da solicitação nº {n}.",
  "supplierRequests.notify.counter.subject":
    "Nova proposta na solicitação nº {n}",
  "supplierRequests.notify.counter.body":
    "O fornecedor respondeu à contraproposta da solicitação nº {n} com outra proposta.",
  "supplierRequests.notify.reject.subject":
    "Contraproposta recusada na solicitação nº {n}",
  "supplierRequests.notify.reject.body":
    "O fornecedor recusou a contraproposta da solicitação nº {n}; fica a resposta anterior.",
  "supplierRequests.notify.message.subject": "Mensagem na solicitação nº {n}",
  "supplierRequests.notify.file.subject": "Arquivo na solicitação nº {n}",
  "supplierRequests.notify.message.body": "Solicitação nº {n}: {text}",
  "supplierRequests.notify.late.subject": "Solicitação nº {n} passou do SLA",
  "supplierRequests.notify.late.body":
    "A negociação da solicitação nº {n} passou do SLA de {minutes} minutos sem decisão.",
};

export const en: Record<keyof typeof pt, string> = {
  "supplierRequests.negotiation.title": "Negotiation and conversation",
  "supplierRequests.negotiation.empty":
    "No messages yet. Counteroffers, answers, messages and files show up here, in order.",
  "supplierRequests.negotiation.side.wellmix": "Wellmix",
  "supplierRequests.negotiation.side.supplier": "Supplier",
  "supplierRequests.negotiation.kind.proposal": "Counteroffer",
  "supplierRequests.negotiation.kind.accept": "Accepted the counteroffer",
  "supplierRequests.negotiation.kind.counter": "New proposal",
  "supplierRequests.negotiation.kind.reject": "Declined the counteroffer",
  "supplierRequests.negotiation.kind.message": "Message",
  "supplierRequests.negotiation.kind.answer": "Answer",
  "supplierRequests.negotiation.file": "File",
  "supplierRequests.negotiation.pendingWellmix":
    "Counteroffer waiting for the supplier. Until they answer, the request cannot be approved.",
  "supplierRequests.negotiation.pendingSupplier":
    "Wellmix sent back a counteroffer. Accept it, answer with another proposal or decline it.",
  "supplierRequests.negotiation.approveBlocked":
    "Approval becomes available once the supplier answers the counteroffer.",
  "supplierRequests.negotiation.propose": "Send back with a counteroffer",
  "supplierRequests.negotiation.proposeHint":
    "Propose price, minimum order and lead time. The comment is required and the supplier reads it.",
  "supplierRequests.negotiation.comment": "Comment",
  "supplierRequests.negotiation.commentOptional": "Comment (optional)",
  "supplierRequests.negotiation.proposeSubmit": "Send counteroffer",
  "supplierRequests.negotiation.respond": "Answer the counteroffer",
  "supplierRequests.negotiation.respondHint":
    "Accept: the proposed values become your answer. New proposal: enter your values (price is required). Decline: your previous answer stays.",
  "supplierRequests.negotiation.accept": "Accept",
  "supplierRequests.negotiation.counter": "Send new proposal",
  "supplierRequests.negotiation.reject": "Decline",
  "supplierRequests.negotiation.message": "Message",
  "supplierRequests.negotiation.messageText": "Text",
  "supplierRequests.negotiation.attach": "File (optional)",
  "supplierRequests.negotiation.attachHint":
    "Photo, PDF or Excel. Only Wellmix and this request's supplier can open it.",
  "supplierRequests.negotiation.send": "Send",
  "supplierRequests.negotiation.sending": "Sending…",
  "supplierRequests.negotiation.turn.supplier": "Waiting for the supplier",
  "supplierRequests.negotiation.turn.wellmix": "Waiting for Wellmix",
  "supplierRequests.negotiation.notice.proposal":
    "Counteroffer sent to the supplier.",
  "supplierRequests.negotiation.notice.accept":
    "Counteroffer accepted: the proposed values are now the answer.",
  "supplierRequests.negotiation.notice.counter": "New proposal sent.",
  "supplierRequests.negotiation.notice.reject":
    "Counteroffer declined: the previous answer stays.",
  "supplierRequests.negotiation.notice.message": "Message sent.",

  "supplierRequests.sla.until": "SLA until {date}",
  "supplierRequests.sla.late": "Late",
  "supplierRequests.sla.settingLabel": "Supplier negotiation SLA (minutes)",
  "supplierRequests.sla.settingHint":
    "Counted from when the supplier request opens until Wellmix decides. Once exceeded, the request is marked late and Wellmix and the supplier are notified.",
  "settings.error.supplier_request_sla_invalid":
    "Enter the negotiation SLA in minutes (1 to 86400).",

  "supplierRequests.negotiation.sim.title": "Superplan estimate",
  "supplierRequests.negotiation.sim.cost": "Cost per piece",
  "supplierRequests.negotiation.sim.minimum": "Minimum price",
  "supplierRequests.negotiation.sim.booking": "in the booking:",
  "supplierRequests.negotiation.sim.target": "Desired minimum price (R$)",
  "supplierRequests.negotiation.sim.targetHint":
    "Reverse calculation: the system shows the price per piece needed to reach that minimum.",
  "supplierRequests.negotiation.sim.needed": "Price per piece needed",
  "supplierRequests.negotiation.sim.use": "Use this price",
  "supplierRequests.negotiation.sim.unreachable":
    "This minimum can't be reached by the price alone (it is below the cost without the goods).",
  "supplierRequests.negotiation.sim.currency":
    "The estimate only works with a price in USD or RMB.",
  "supplierRequests.negotiation.sim.missing":
    "The item is missing data for the estimate (carton, volume, freight or exchange rate).",
  "supplierRequests.negotiation.sim.hint":
    "Estimate only, recalculated on every keystroke with today's exchange rate and the Superplan defaults; the supplier's answer is what counts.",
  "supplierRequests.error.supplier_request_supplier_only":
    "The answer comes from the supplier, through the portal: Wellmix does not answer for them.",
  "supplierRequests.error.supplier_request_proposal_pending":
    "A counteroffer is waiting for the supplier: they accept it, answer with another proposal or decline it.",
  "supplierRequests.error.supplier_request_propose_invalid":
    "A counteroffer is only possible after the supplier answers they can do it.",
  "supplierRequests.error.supplier_request_comment_required":
    "Write the counteroffer comment.",
  "supplierRequests.error.supplier_request_offer_empty":
    "Enter at least one value: price, minimum order or lead time.",
  "supplierRequests.error.supplier_request_no_proposal":
    "There is no counteroffer waiting for an answer.",
  "supplierRequests.error.supplier_request_message_empty":
    "Write the message or choose a file.",
  "supplierRequests.error.supplier_request_file_type":
    "File not accepted: send a photo, PDF or Excel.",

  "supplierRequests.notify.proposal.subject": "Counteroffer on request #{n}",
  "supplierRequests.notify.proposal.body":
    "Wellmix sent request #{n} back with a counteroffer. Accept it, answer with another proposal or decline it in the portal.",
  "supplierRequests.notify.accept.subject":
    "Counteroffer accepted on request #{n}",
  "supplierRequests.notify.accept.body":
    "The supplier accepted the counteroffer on request #{n}.",
  "supplierRequests.notify.counter.subject": "New proposal on request #{n}",
  "supplierRequests.notify.counter.body":
    "The supplier answered the counteroffer on request #{n} with another proposal.",
  "supplierRequests.notify.reject.subject":
    "Counteroffer declined on request #{n}",
  "supplierRequests.notify.reject.body":
    "The supplier declined the counteroffer on request #{n}; the previous answer stays.",
  "supplierRequests.notify.message.subject": "Message on request #{n}",
  "supplierRequests.notify.file.subject": "File on request #{n}",
  "supplierRequests.notify.message.body": "Request #{n}: {text}",
  "supplierRequests.notify.late.subject": "Request #{n} is past its SLA",
  "supplierRequests.notify.late.body":
    "The negotiation of request #{n} went past the {minutes}-minute SLA without a decision.",
};

export const zh: Record<keyof typeof pt, string> = {
  "supplierRequests.negotiation.title": "议价与沟通",
  "supplierRequests.negotiation.empty":
    "暂无消息。还价、答复、消息和文件会按顺序显示在这里。",
  "supplierRequests.negotiation.side.wellmix": "Wellmix",
  "supplierRequests.negotiation.side.supplier": "供应商",
  "supplierRequests.negotiation.kind.proposal": "还价",
  "supplierRequests.negotiation.kind.accept": "接受了还价",
  "supplierRequests.negotiation.kind.counter": "新报价",
  "supplierRequests.negotiation.kind.reject": "拒绝了还价",
  "supplierRequests.negotiation.kind.message": "消息",
  "supplierRequests.negotiation.kind.answer": "答复",
  "supplierRequests.negotiation.file": "文件",
  "supplierRequests.negotiation.pendingWellmix":
    "还价正在等待供应商答复。答复之前，询单无法批准。",
  "supplierRequests.negotiation.pendingSupplier":
    "Wellmix 发回了还价。请接受、提出新报价或拒绝。",
  "supplierRequests.negotiation.approveBlocked": "供应商答复还价后才能批准。",
  "supplierRequests.negotiation.propose": "发回还价",
  "supplierRequests.negotiation.proposeHint":
    "提出价格、起订量和交期。备注为必填，供应商会看到。",
  "supplierRequests.negotiation.comment": "备注",
  "supplierRequests.negotiation.commentOptional": "备注（可选）",
  "supplierRequests.negotiation.proposeSubmit": "发送还价",
  "supplierRequests.negotiation.respond": "答复还价",
  "supplierRequests.negotiation.respondHint":
    "接受：还价的数值成为您的答复。新报价：填写您的数值（价格必填）。拒绝：保留您之前的答复。",
  "supplierRequests.negotiation.accept": "接受",
  "supplierRequests.negotiation.counter": "发送新报价",
  "supplierRequests.negotiation.reject": "拒绝",
  "supplierRequests.negotiation.message": "消息",
  "supplierRequests.negotiation.messageText": "内容",
  "supplierRequests.negotiation.attach": "文件（可选）",
  "supplierRequests.negotiation.attachHint":
    "照片、PDF 或 Excel。只有 Wellmix 和本询单的供应商可以打开。",
  "supplierRequests.negotiation.send": "发送",
  "supplierRequests.negotiation.sending": "发送中…",
  "supplierRequests.negotiation.turn.supplier": "等待供应商",
  "supplierRequests.negotiation.turn.wellmix": "等待 Wellmix",
  "supplierRequests.negotiation.notice.proposal": "还价已发送给供应商。",
  "supplierRequests.negotiation.notice.accept":
    "已接受还价：还价数值已成为答复。",
  "supplierRequests.negotiation.notice.counter": "新报价已发送。",
  "supplierRequests.negotiation.notice.reject": "已拒绝还价：保留之前的答复。",
  "supplierRequests.negotiation.notice.message": "消息已发送。",

  "supplierRequests.sla.until": "SLA 截止 {date}",
  "supplierRequests.sla.late": "已逾期",
  "supplierRequests.sla.settingLabel": "供应商议价 SLA（分钟）",
  "supplierRequests.sla.settingHint":
    "从向供应商发出询单起，到 Wellmix 作出决定为止。超时后询单标记为逾期，并通知 Wellmix 和供应商。",
  "settings.error.supplier_request_sla_invalid":
    "请填写议价 SLA 分钟数（1 至 86400）。",

  "supplierRequests.negotiation.sim.title": "Superplan 估算",
  "supplierRequests.negotiation.sim.cost": "每件成本",
  "supplierRequests.negotiation.sim.minimum": "最低价",
  "supplierRequests.negotiation.sim.booking": "预订单中：",
  "supplierRequests.negotiation.sim.target": "期望最低价（R$）",
  "supplierRequests.negotiation.sim.targetHint":
    "反向计算：系统显示达到该最低价所需的每件价格。",
  "supplierRequests.negotiation.sim.needed": "所需每件价格",
  "supplierRequests.negotiation.sim.use": "使用此价格",
  "supplierRequests.negotiation.sim.unreachable":
    "仅靠价格无法达到该最低价（低于不含货物的成本）。",
  "supplierRequests.negotiation.sim.currency": "估算仅适用于 USD 或 RMB 价格。",
  "supplierRequests.negotiation.sim.missing":
    "该商品缺少估算所需数据（箱规、体积、运费或汇率）。",
  "supplierRequests.negotiation.sim.hint":
    "仅为估算，每次输入都会按今日汇率和 Superplan 默认值重新计算；以供应商的答复为准。",
  "supplierRequests.error.supplier_request_supplier_only":
    "答复由供应商通过门户提交：Wellmix 不能代为答复。",
  "supplierRequests.error.supplier_request_proposal_pending":
    "有还价正在等待供应商：请接受、提出新报价或拒绝。",
  "supplierRequests.error.supplier_request_propose_invalid":
    "供应商答复能生产后才能还价。",
  "supplierRequests.error.supplier_request_comment_required":
    "请填写还价备注。",
  "supplierRequests.error.supplier_request_offer_empty":
    "请至少填写一项：价格、起订量或交期。",
  "supplierRequests.error.supplier_request_no_proposal": "没有等待答复的还价。",
  "supplierRequests.error.supplier_request_message_empty":
    "请填写消息或选择文件。",
  "supplierRequests.error.supplier_request_file_type":
    "文件类型不支持：请发送照片、PDF 或 Excel。",

  "supplierRequests.notify.proposal.subject": "询单 {n} 有还价",
  "supplierRequests.notify.proposal.body":
    "Wellmix 对询单 {n} 发回了还价。请在门户中接受、提出新报价或拒绝。",
  "supplierRequests.notify.accept.subject": "询单 {n} 的还价已被接受",
  "supplierRequests.notify.accept.body": "供应商接受了询单 {n} 的还价。",
  "supplierRequests.notify.counter.subject": "询单 {n} 有新报价",
  "supplierRequests.notify.counter.body":
    "供应商对询单 {n} 的还价提出了新报价。",
  "supplierRequests.notify.reject.subject": "询单 {n} 的还价被拒绝",
  "supplierRequests.notify.reject.body":
    "供应商拒绝了询单 {n} 的还价；保留之前的答复。",
  "supplierRequests.notify.message.subject": "询单 {n} 有新消息",
  "supplierRequests.notify.file.subject": "询单 {n} 有新文件",
  "supplierRequests.notify.message.body": "询单 {n}：{text}",
  "supplierRequests.notify.late.subject": "询单 {n} 已超过 SLA",
  "supplierRequests.notify.late.body":
    "询单 {n} 的议价已超过 {minutes} 分钟 SLA，尚未作出决定。",
};
