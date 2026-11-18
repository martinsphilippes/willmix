/*
 * Estratégia de Compra por produto (dono, 18/11/2026; docs/PURCHASE_DEMAND.md,
 * "Estratégia de Compra por produto"): "Enviar para cotação" em Encomendas,
 * a escolha e os destinatários por produto, o resumo, o resultado por
 * destinatário com "Tentar de novo" e as famílias atendidas no cadastro do
 * parceiro.
 */
export const pt = {
  "nav.purchaseStrategy": "Estratégia de compra",
  "perm.note.purchaseStrategy":
    "Estratégia de Compra por produto e o resultado dos envios. Nasce aberta para quem abre Solicitações ao fornecedor.",
  "family.card.title": "Famílias atendidas",
  "family.card.hint":
    "Marque as famílias de produto que este parceiro fornece. Na Estratégia de Compra ele aparece para cotar os produtos dessas famílias.",
  "family.card.empty":
    "A lista de famílias ainda não carregou (ela vem do Sankhya). Tente de novo em alguns minutos.",
  "family.card.products": "{n} produto(s)",
  "family.card.save": "Salvar famílias",
  "family.card.saved": "Famílias atendidas salvas.",
  "family.card.count": "{n} família(s) marcada(s)",
  "family.card.gone": "fora da lista do Sankhya agora",
  "catalog.error.family_type_not_allowed":
    "Só Fornecedor, Trading, Supplier e Factory recebem cotação de compra.",
  "reqSend.button": "Enviar para cotação",
  "reqSend.confirm": "Enviar {n} produto(s) para a Estratégia de Compra?",
  "reqSend.done": "{n} produto(s) enviado(s) para a Estratégia de Compra.",
  "reqSend.skipped":
    "{n} não foram enviados: só vão os produtos com a situação Solicitado que ainda não foram enviados (a reposição e a compra para estoque seguem sozinhas).",
  "reqSend.open": "Abrir a Estratégia de Compra",
  "reqSend.all": "Enviar todos para cotação ({n})",
  "reqSend.sentAt": "Enviado para cotação em {date}",
  "reqBatch.error.nothing_sent":
    "Nada foi enviado: marque produtos com a situação Solicitado que ainda não foram enviados para cotação.",
  "reqList.next.send": "Enviar para cotação",
  "reqList.next.strategy": "Estratégia de compra",
  "tasks.group.purchase_strategy_send": "Envio da estratégia com pendência",
  "strategy.task.toSend.title": "Enviar para cotação: {product}",
  "strategy.task.toSend.detail": "Encomenda · {quantity} {unit}",
  "strategy.task.send.title":
    "Envio nº {n} da Estratégia de Compra: {count} parceiro(s) sem receber",
  "strategy.task.send.detail":
    'Regularize o parceiro ou escolha outro e use "Tentar de novo".',
  "strategy.toSend": "{n} encomenda(s) ainda não enviada(s) para cotação.",
  "strategy.toSendLink": "Abrir Encomendas",
  "strategy.queue.title": "Produtos esperando a estratégia ({n})",
  "strategy.queue.empty":
    'Nenhum produto esperando a estratégia. Envie produtos pela tela Encomendas ("Enviar para cotação").',
  "strategy.line.order": "Encomenda nº {n}",
  "strategy.line.replenishment": "Reposição nº {n}",
  "strategy.line.batch": "lote com {n} produtos",
  "strategy.line.customer": "Cliente",
  "strategy.line.quantity": "Quantidade",
  "strategy.line.spec": "Especificação",
  "strategy.line.schedule": "Programação de entrega",
  "strategy.line.scheduleItem": "{index}ª: {quantity} em {date}",
  "strategy.line.desiredAt": "Entrega desejada",
  "strategy.line.deadline": "Prazo",
  "strategy.line.family": "Família",
  "strategy.line.noFamily": "Família não identificada",
  "strategy.line.choose": "O que fazer com este produto?",
  "strategy.option.skip": "Não enviar agora",
  "strategy.choice.quote_last": "Cotar com o fornecedor da última compra",
  "strategy.option.lastHint": "A cotação vai só para {name}.",
  "strategy.option.directHint":
    "Sem cotação: vai para a aprovação da Diretoria de compras e depois vira o pedido de compra.",
  "strategy.option.noHistory":
    "Sem compra anterior deste produto: escolha outros parceiros.",
  "strategy.recipients.linked": "Vinculados à família {family}",
  "strategy.recipients.suggested":
    "Já forneceram produtos da família (sem vínculo no cadastro)",
  "strategy.recipients.none":
    "Nenhum parceiro vinculado à família {family}. Vincule no cadastro do parceiro (Famílias atendidas) ou busque abaixo.",
  "strategy.recipients.search":
    "Buscar outro parceiro (Fornecedor, Trading, Supplier ou Factory)",
  "strategy.recipients.added": "Escolhidos na busca",
  "strategy.recipients.checking": "Conferindo o parceiro…",
  "strategy.recipients.allOk": "Marcar todos os aptos",
  "strategy.recipients.clear": "Desmarcar todos",
  "strategy.recipients.logins": "{n} login(s)",
  "strategy.recipients.ok": "Apto: recebe e responde no portal",
  "strategy.recipients.lastBadge": "Última compra",
  "strategy.recipients.cantWin":
    "Cota, mas ainda não pode vencer (o pedido de compra só aceita Fornecedor)",
  "strategy.issue.not_quote_type": "Tipo de parceiro que não recebe cotação.",
  "strategy.issue.inactive": "Cadastro inativo: reative o parceiro.",
  "strategy.issue.type_inactive":
    "O tipo de parceiro está desativado (Tipos e acessos).",
  "strategy.issue.no_login":
    "Sem login ativo: gere o login de acesso no cadastro do parceiro.",
  "strategy.issue.no_quotes_screen":
    "A tela Cotação está fechada no perfil do tipo (Gestão de telas).",
  "strategy.warning.no_email": "Login sem e-mail: o aviso fica só no portal.",
  "strategy.issue.fix": "Abrir o cadastro",
  "strategy.review": "Revisar o envio ({n})",
  "strategy.review.none": "Escolha o que fazer com pelo menos um produto.",
  "strategy.summary.title": "Resumo do envio",
  "strategy.summary.hint":
    'Confira quem recebe cada cotação. Quem tem pendência fica de fora até regularizar; depois use "Tentar de novo" no resultado.',
  "strategy.summary.receives": "Recebem ({n})",
  "strategy.summary.blocked": "Ficam de fora ({n})",
  "strategy.summary.direct": "Vai para a aprovação da Diretoria de compras.",
  "strategy.summary.noRecipient":
    "Nenhum destinatário apto: escolha outro parceiro.",
  "strategy.summary.missingRecipient": "Escolha pelo menos um parceiro.",
  "strategy.summary.confirm": "Confirmar o envio",
  "strategy.summary.back": "Voltar e ajustar",
  "strategy.summary.working": "Enviando…",
  "strategy.summary.fixFirst":
    "Há produtos sem destinatário apto. Ajuste antes de confirmar.",
  "strategy.note": "Observação (vai junto da estratégia)",
  "strategy.sends.title": "Envios recentes",
  "strategy.sends.empty": "Nenhum envio ainda.",
  "strategy.sends.one": "Envio nº {n}",
  "strategy.sends.ok": "Todos receberam",
  "strategy.sends.failures": "{n} sem receber",
  "strategy.sends.closed": "{n} sem receber (cotação encerrada)",
  "strategy.sends.lines": "{n} produto(s)",
  "strategy.send.title": "Envio nº {n} da Estratégia de Compra",
  "strategy.send.subtitle":
    "O que aconteceu com cada destinatário. Quem ficou de fora pode receber depois, sem duplicar quem já recebeu.",
  "strategy.send.done": "Envio confirmado.",
  "strategy.send.retried": "Tentamos de novo: {n} parceiro(s) receberam agora.",
  "strategy.send.retry": "Tentar de novo",
  "strategy.send.retryHint":
    "Só para quem ficou de fora ou deu erro. Quem já recebeu não recebe de novo.",
  "strategy.send.status.sent": "Recebeu",
  "strategy.send.status.already": "Já tinha recebido",
  "strategy.send.status.blocked": "Ficou de fora",
  "strategy.send.status.failed": "Erro no envio",
  "strategy.send.logins":
    "Aviso no portal para {n} login(s). E-mail e WhatsApp ainda simulados (provedor pendente).",
  "strategy.send.quote": "Cotação de compra nº {n}",
  "strategy.send.openQuote": "Abrir a cotação",
  "strategy.send.direct":
    "Pedido direto: esperando a aprovação da Diretoria de compras.",
  "strategy.send.lineError": "Não foi enviado: {error}",
  "strategy.send.by": "Enviado por {name} em {date}",
  "strategy.send.runs": "{n} tentativa(s)",
  "strategy.send.back": "Voltar para a Estratégia de Compra",
  "strategy.send.details": "Detalhes",
  "strategy.error.strategy_send_empty":
    "Escolha o que fazer com pelo menos um produto.",
  "strategy.error.strategy_send_recipients":
    "Produto sem parceiro escolhido: escolha pelo menos um.",
  "strategy.error.strategy_send_no_ok_recipient":
    "Produto sem destinatário apto: escolha outro parceiro.",
  "strategy.error.strategy_recipient_type":
    "Só Fornecedor, Trading, Supplier e Factory recebem a cotação.",
  "strategy.error.strategy_send_not_found": "Envio não encontrado.",
  "strategy.error.strategy_line_duplicated":
    "O mesmo produto apareceu duas vezes no envio.",
  "strategy.error.strategy_nothing_to_retry":
    "Ninguém ficou de fora: não há o que tentar de novo.",
  "strategy.error.strategy_demand_not_sent":
    "A encomenda ainda não foi enviada para cotação (Encomendas → Enviar para cotação).",
  "strategy.error.strategy_send_failed":
    'Erro ao gravar ou ao abrir a cotação. Use "Tentar de novo".',
  "quote.item.spec": "Especificação",
  "quote.item.schedule": "Programação de entrega",
  "quote.item.desiredAt": "Entrega desejada",
  "quote.winner.notSupplier":
    "{type}: cota, mas ainda não pode ser escolhido como vencedor (o pedido de compra só aceita Fornecedor).",
  "quote.error.quote_winner_not_supplier":
    "Este parceiro ainda não pode vencer: o pedido de compra só aceita Fornecedor. Escolha um Fornecedor.",
};

export const en: Record<keyof typeof pt, string> = {
  "nav.purchaseStrategy": "Purchase strategy",
  "perm.note.purchaseStrategy":
    "Purchase strategy per product and the result of each send. Starts open for those who open Supplier requests.",
  "family.card.title": "Product families served",
  "family.card.hint":
    "Tick the product families this partner supplies. In the Purchase strategy the partner shows up to quote the products of these families.",
  "family.card.empty":
    "The family list has not loaded yet (it comes from Sankhya). Try again in a few minutes.",
  "family.card.products": "{n} product(s)",
  "family.card.save": "Save families",
  "family.card.saved": "Product families saved.",
  "family.card.count": "{n} family(ies) ticked",
  "family.card.gone": "not in the Sankhya list now",
  "catalog.error.family_type_not_allowed":
    "Only Supplier, Trading, Supplier partner and Factory receive purchase quotes.",
  "reqSend.button": "Send to quotation",
  "reqSend.confirm": "Send {n} product(s) to the Purchase strategy?",
  "reqSend.done": "{n} product(s) sent to the Purchase strategy.",
  "reqSend.skipped":
    "{n} were not sent: only products with the Requested status that were not sent yet go (replenishment and stock purchases move on by themselves).",
  "reqSend.open": "Open the Purchase strategy",
  "reqSend.all": "Send all to quotation ({n})",
  "reqSend.sentAt": "Sent to quotation on {date}",
  "reqBatch.error.nothing_sent":
    "Nothing was sent: tick products with the Requested status that were not sent to quotation yet.",
  "reqList.next.send": "Send to quotation",
  "reqList.next.strategy": "Purchase strategy",
  "tasks.group.purchase_strategy_send": "Strategy send with issues",
  "strategy.task.toSend.title": "Send to quotation: {product}",
  "strategy.task.toSend.detail": "Customer order · {quantity} {unit}",
  "strategy.task.send.title":
    "Purchase strategy send no. {n}: {count} partner(s) did not receive it",
  "strategy.task.send.detail":
    'Fix the partner or choose another one and use "Try again".',
  "strategy.toSend": "{n} customer order(s) not sent to quotation yet.",
  "strategy.toSendLink": "Open Customer orders",
  "strategy.queue.title": "Products waiting for the strategy ({n})",
  "strategy.queue.empty":
    'No product waiting for the strategy. Send products from the Customer orders screen ("Send to quotation").',
  "strategy.line.order": "Customer order no. {n}",
  "strategy.line.replenishment": "Replenishment no. {n}",
  "strategy.line.batch": "batch with {n} products",
  "strategy.line.customer": "Customer",
  "strategy.line.quantity": "Quantity",
  "strategy.line.spec": "Specification",
  "strategy.line.schedule": "Delivery schedule",
  "strategy.line.scheduleItem": "#{index}: {quantity} on {date}",
  "strategy.line.desiredAt": "Desired delivery",
  "strategy.line.deadline": "Deadline",
  "strategy.line.family": "Family",
  "strategy.line.noFamily": "Family not identified",
  "strategy.line.choose": "What to do with this product?",
  "strategy.option.skip": "Do not send now",
  "strategy.choice.quote_last": "Quote with the last purchase's supplier",
  "strategy.option.lastHint": "The quote goes only to {name}.",
  "strategy.option.directHint":
    "No quote: it goes to the Purchasing board approval and then becomes the purchase order.",
  "strategy.option.noHistory":
    "No previous purchase of this product: choose other partners.",
  "strategy.recipients.linked": "Linked to the {family} family",
  "strategy.recipients.suggested":
    "Already supplied products of the family (not linked in the record)",
  "strategy.recipients.none":
    "No partner linked to the {family} family. Link it in the partner record (Product families served) or search below.",
  "strategy.recipients.search":
    "Search another partner (Supplier, Trading, Supplier partner or Factory)",
  "strategy.recipients.added": "Chosen in the search",
  "strategy.recipients.checking": "Checking the partner…",
  "strategy.recipients.allOk": "Tick all eligible",
  "strategy.recipients.clear": "Untick all",
  "strategy.recipients.logins": "{n} login(s)",
  "strategy.recipients.ok": "Eligible: receives and answers in the portal",
  "strategy.recipients.lastBadge": "Last purchase",
  "strategy.recipients.cantWin":
    "Quotes, but cannot win yet (the purchase order only accepts a Supplier)",
  "strategy.issue.not_quote_type": "Partner type that does not receive quotes.",
  "strategy.issue.inactive": "Inactive record: reactivate the partner.",
  "strategy.issue.type_inactive":
    "The partner type is deactivated (Types and access).",
  "strategy.issue.no_login":
    "No active login: create the access login in the partner record.",
  "strategy.issue.no_quotes_screen":
    "The Quotes screen is closed in the type's profile (Screen management).",
  "strategy.warning.no_email":
    "Login without e-mail: the notice stays in the portal only.",
  "strategy.issue.fix": "Open the record",
  "strategy.review": "Review the send ({n})",
  "strategy.review.none": "Choose what to do with at least one product.",
  "strategy.summary.title": "Send summary",
  "strategy.summary.hint":
    'Check who receives each quote. Partners with issues stay out until fixed; then use "Try again" in the result.',
  "strategy.summary.receives": "Receive ({n})",
  "strategy.summary.blocked": "Stay out ({n})",
  "strategy.summary.direct": "Goes to the Purchasing board approval.",
  "strategy.summary.noRecipient":
    "No eligible recipient: choose another partner.",
  "strategy.summary.missingRecipient": "Choose at least one partner.",
  "strategy.summary.confirm": "Confirm the send",
  "strategy.summary.back": "Go back and adjust",
  "strategy.summary.working": "Sending…",
  "strategy.summary.fixFirst":
    "Some products have no eligible recipient. Adjust them before confirming.",
  "strategy.note": "Note (goes with the strategy)",
  "strategy.sends.title": "Recent sends",
  "strategy.sends.empty": "No send yet.",
  "strategy.sends.one": "Send no. {n}",
  "strategy.sends.ok": "Everyone received it",
  "strategy.sends.failures": "{n} did not receive it",
  "strategy.sends.closed": "{n} did not receive it (quote closed)",
  "strategy.sends.lines": "{n} product(s)",
  "strategy.send.title": "Purchase strategy send no. {n}",
  "strategy.send.subtitle":
    "What happened to each recipient. Those who stayed out can receive it later, without duplicating those who already did.",
  "strategy.send.done": "Send confirmed.",
  "strategy.send.retried": "Tried again: {n} partner(s) received it now.",
  "strategy.send.retry": "Try again",
  "strategy.send.retryHint":
    "Only for those who stayed out or had an error. Those who already received it do not receive it again.",
  "strategy.send.status.sent": "Received",
  "strategy.send.status.already": "Had already received",
  "strategy.send.status.blocked": "Stayed out",
  "strategy.send.status.failed": "Send error",
  "strategy.send.logins":
    "Portal notice to {n} login(s). E-mail and WhatsApp still simulated (provider pending).",
  "strategy.send.quote": "Purchase quote no. {n}",
  "strategy.send.openQuote": "Open the quote",
  "strategy.send.direct":
    "Direct order: waiting for the Purchasing board approval.",
  "strategy.send.lineError": "Not sent: {error}",
  "strategy.send.by": "Sent by {name} on {date}",
  "strategy.send.runs": "{n} attempt(s)",
  "strategy.send.back": "Back to the Purchase strategy",
  "strategy.send.details": "Details",
  "strategy.error.strategy_send_empty":
    "Choose what to do with at least one product.",
  "strategy.error.strategy_send_recipients":
    "Product with no partner chosen: choose at least one.",
  "strategy.error.strategy_send_no_ok_recipient":
    "Product with no eligible recipient: choose another partner.",
  "strategy.error.strategy_recipient_type":
    "Only Supplier, Trading, Supplier partner and Factory receive the quote.",
  "strategy.error.strategy_send_not_found": "Send not found.",
  "strategy.error.strategy_line_duplicated":
    "The same product appeared twice in the send.",
  "strategy.error.strategy_nothing_to_retry":
    "Nobody stayed out: there is nothing to try again.",
  "strategy.error.strategy_demand_not_sent":
    "The customer order was not sent to quotation yet (Customer orders → Send to quotation).",
  "strategy.error.strategy_send_failed":
    'Error while saving or opening the quote. Use "Try again".',
  "quote.item.spec": "Specification",
  "quote.item.schedule": "Delivery schedule",
  "quote.item.desiredAt": "Desired delivery",
  "quote.winner.notSupplier":
    "{type}: quotes, but cannot be chosen as the winner yet (the purchase order only accepts a Supplier).",
  "quote.error.quote_winner_not_supplier":
    "This partner cannot win yet: the purchase order only accepts a Supplier. Choose a Supplier.",
};

export const zh: Record<keyof typeof pt, string> = {
  "nav.purchaseStrategy": "采购策略",
  "perm.note.purchaseStrategy":
    "按产品的采购策略和每次发送的结果。默认对能打开向供应商询价的人开放。",
  "family.card.title": "供应的产品系列",
  "family.card.hint":
    "勾选该合作伙伴供应的产品系列。在采购策略中，它会出现在这些系列产品的询价名单里。",
  "family.card.empty": "产品系列列表尚未加载（来自 Sankhya）。请几分钟后再试。",
  "family.card.products": "{n} 个产品",
  "family.card.save": "保存产品系列",
  "family.card.saved": "已保存供应的产品系列。",
  "family.card.count": "已勾选 {n} 个系列",
  "family.card.gone": "目前不在 Sankhya 列表中",
  "catalog.error.family_type_not_allowed":
    "只有供应商、贸易商、Supplier 和工厂接收采购询价。",
  "reqSend.button": "发送询价",
  "reqSend.confirm": "将 {n} 个产品发送到采购策略？",
  "reqSend.done": "已将 {n} 个产品发送到采购策略。",
  "reqSend.skipped":
    "{n} 个未发送：只发送状态为“已提交”且尚未发送的产品（补货和库存采购会自动进入）。",
  "reqSend.open": "打开采购策略",
  "reqSend.all": "全部发送询价（{n}）",
  "reqSend.sentAt": "{date} 已发送询价",
  "reqBatch.error.nothing_sent":
    "没有发送任何产品：请勾选状态为“已提交”且尚未发送询价的产品。",
  "reqList.next.send": "发送询价",
  "reqList.next.strategy": "采购策略",
  "tasks.group.purchase_strategy_send": "有问题的策略发送",
  "strategy.task.toSend.title": "发送询价：{product}",
  "strategy.task.toSend.detail": "客户订货 · {quantity} {unit}",
  "strategy.task.send.title": "采购策略第 {n} 次发送：{count} 个合作伙伴未收到",
  "strategy.task.send.detail":
    "请处理该合作伙伴的问题或另选一个，然后点击“重试”。",
  "strategy.toSend": "{n} 个客户订货尚未发送询价。",
  "strategy.toSendLink": "打开客户订货",
  "strategy.queue.title": "等待采购策略的产品（{n}）",
  "strategy.queue.empty":
    "没有等待采购策略的产品。请在客户订货页面发送产品（“发送询价”）。",
  "strategy.line.order": "客户订货第 {n} 号",
  "strategy.line.replenishment": "补货第 {n} 号",
  "strategy.line.batch": "含 {n} 个产品的批次",
  "strategy.line.customer": "客户",
  "strategy.line.quantity": "数量",
  "strategy.line.spec": "规格",
  "strategy.line.schedule": "交货计划",
  "strategy.line.scheduleItem": "第 {index} 次：{date} 交 {quantity}",
  "strategy.line.desiredAt": "期望交货",
  "strategy.line.deadline": "期限",
  "strategy.line.family": "产品系列",
  "strategy.line.noFamily": "未识别产品系列",
  "strategy.line.choose": "这个产品怎么处理？",
  "strategy.option.skip": "暂不发送",
  "strategy.choice.quote_last": "向上次采购的供应商询价",
  "strategy.option.lastHint": "询价只发给 {name}。",
  "strategy.option.directHint": "不询价：先由采购总监审批，然后生成采购订单。",
  "strategy.option.noHistory": "该产品没有以前的采购：请选择其他合作伙伴。",
  "strategy.recipients.linked": "关联到 {family} 系列",
  "strategy.recipients.suggested": "曾供应该系列产品（档案中未关联）",
  "strategy.recipients.none":
    "没有合作伙伴关联到 {family} 系列。请在合作伙伴档案中关联（供应的产品系列），或在下方搜索。",
  "strategy.recipients.search":
    "搜索其他合作伙伴（供应商、贸易商、Supplier 或工厂）",
  "strategy.recipients.added": "搜索中选择的",
  "strategy.recipients.checking": "正在核对合作伙伴…",
  "strategy.recipients.allOk": "勾选所有符合条件的",
  "strategy.recipients.clear": "全部取消",
  "strategy.recipients.logins": "{n} 个登录",
  "strategy.recipients.ok": "符合条件：在门户中接收并回复",
  "strategy.recipients.lastBadge": "上次采购",
  "strategy.recipients.cantWin":
    "可以报价，但暂时不能中选（采购订单只接受供应商）",
  "strategy.issue.not_quote_type": "该合作伙伴类型不接收询价。",
  "strategy.issue.inactive": "档案未启用：请重新启用该合作伙伴。",
  "strategy.issue.type_inactive": "该合作伙伴类型已停用（类型和访问）。",
  "strategy.issue.no_login": "没有启用的登录：请在合作伙伴档案中生成访问登录。",
  "strategy.issue.no_quotes_screen":
    "该类型的页面配置中“询价”页面已关闭（页面管理）。",
  "strategy.warning.no_email": "登录没有电子邮件：通知只在门户中显示。",
  "strategy.issue.fix": "打开档案",
  "strategy.review": "检查发送（{n}）",
  "strategy.review.none": "请至少为一个产品选择处理方式。",
  "strategy.summary.title": "发送摘要",
  "strategy.summary.hint":
    "请核对每个询价的接收方。有问题的合作伙伴在处理前不会收到；之后可在结果中点击“重试”。",
  "strategy.summary.receives": "接收（{n}）",
  "strategy.summary.blocked": "未包括（{n}）",
  "strategy.summary.direct": "提交采购总监审批。",
  "strategy.summary.noRecipient": "没有符合条件的接收方：请选择其他合作伙伴。",
  "strategy.summary.missingRecipient": "请至少选择一个合作伙伴。",
  "strategy.summary.confirm": "确认发送",
  "strategy.summary.back": "返回调整",
  "strategy.summary.working": "正在发送…",
  "strategy.summary.fixFirst": "有产品没有符合条件的接收方。请先调整再确认。",
  "strategy.note": "备注（随策略一起保存）",
  "strategy.sends.title": "最近的发送",
  "strategy.sends.empty": "还没有发送。",
  "strategy.sends.one": "第 {n} 次发送",
  "strategy.sends.ok": "全部已收到",
  "strategy.sends.failures": "{n} 个未收到",
  "strategy.sends.closed": "{n} 个未收到（询价已结束）",
  "strategy.sends.lines": "{n} 个产品",
  "strategy.send.title": "采购策略第 {n} 次发送",
  "strategy.send.subtitle":
    "每个接收方的情况。未收到的可以稍后再收到，已收到的不会重复。",
  "strategy.send.done": "已确认发送。",
  "strategy.send.retried": "已重试：现在有 {n} 个合作伙伴收到。",
  "strategy.send.retry": "重试",
  "strategy.send.retryHint": "只针对未收到或出错的。已收到的不会再次收到。",
  "strategy.send.status.sent": "已收到",
  "strategy.send.status.already": "之前已收到",
  "strategy.send.status.blocked": "未包括",
  "strategy.send.status.failed": "发送出错",
  "strategy.send.logins":
    "已在门户通知 {n} 个登录。电子邮件和 WhatsApp 仍为模拟（服务商待定）。",
  "strategy.send.quote": "采购询价第 {n} 号",
  "strategy.send.openQuote": "打开询价",
  "strategy.send.direct": "直接下单：等待采购总监审批。",
  "strategy.send.lineError": "未发送：{error}",
  "strategy.send.by": "由 {name} 于 {date} 发送",
  "strategy.send.runs": "{n} 次尝试",
  "strategy.send.back": "返回采购策略",
  "strategy.send.details": "详情",
  "strategy.error.strategy_send_empty": "请至少为一个产品选择处理方式。",
  "strategy.error.strategy_send_recipients":
    "有产品没有选择合作伙伴：请至少选择一个。",
  "strategy.error.strategy_send_no_ok_recipient":
    "有产品没有符合条件的接收方：请选择其他合作伙伴。",
  "strategy.error.strategy_recipient_type":
    "只有供应商、贸易商、Supplier 和工厂接收询价。",
  "strategy.error.strategy_send_not_found": "未找到该次发送。",
  "strategy.error.strategy_line_duplicated": "同一产品在发送中出现了两次。",
  "strategy.error.strategy_nothing_to_retry":
    "没有未收到的合作伙伴：无需重试。",
  "strategy.error.strategy_demand_not_sent":
    "该客户订货尚未发送询价（客户订货 → 发送询价）。",
  "strategy.error.strategy_send_failed": "保存或打开询价时出错。请点击“重试”。",
  "quote.item.spec": "规格",
  "quote.item.schedule": "交货计划",
  "quote.item.desiredAt": "期望交货",
  "quote.winner.notSupplier":
    "{type}：可以报价，但暂时不能被选为中选方（采购订单只接受供应商）。",
  "quote.error.quote_winner_not_supplier":
    "该合作伙伴暂时不能中选：采购订单只接受供应商。请选择一个供应商。",
};
