/*
 * Encomenda vira cotação na hora e lembrete da confirmação (dono,
 * 22/11/2026; docs/PURCHASE_DEMAND.md, "Encomenda vira cotação na hora", e
 * docs/ORDER_TERMS.md, "Lembrete da confirmação"): a encomenda (aberta pelo
 * cliente ou confirmada por ele) vira cotação na hora para o fornecedor da
 * última compra e os parceiros da família, sem a etapa da Estratégia;
 * enquanto o cliente não confirma, um lembrete por dia até o limite das
 * Configurações, e com o último o vendedor é avisado.
 */
export const pt = {
  "autoQuote.notify.sent.subject":
    "Consulta nº {quote} aberta sozinha: encomenda nº {n} · {customer}",
  "autoQuote.notify.sent.body":
    "{customer}, {products} produto(s). Convites enviados a {sent} parceiro(s): o fornecedor da última compra e os parceiros da família.",
  "autoQuote.notify.sent.bodyOut":
    '{customer}, {products} produto(s). Convites enviados a {sent} parceiro(s); {out} ficaram de fora (sem login ativo, inativos ou sem a tela de cotações). Regularize e use "Tentar de novo".',
  "autoQuote.notify.empty.subject":
    "Consulta nº {quote} aberta sem convite: encomenda nº {n} · {customer}",
  "autoQuote.notify.empty.body":
    '{products} produto(s). Nenhum fornecedor da família pôde receber: {out} sem login ativo, inativos ou sem a tela de cotações. Gere os logins e use "Tentar de novo", ou convide outros na cotação.',
  "autoQuote.notify.empty.bodyNone":
    "{products} produto(s). Não há fornecedor da última compra nem parceiro da família, da linha ou do produto: convide os fornecedores na consulta.",
  "autoQuote.notify.queued.subject": "Encomenda nº {n}: escolha a estratégia",
  "autoQuote.notify.queued.body":
    "{customer}, {products} produto(s). A consulta não saiu sozinha: {reason}",
  "autoQuote.reason.strategy_whole_request":
    "a solicitação tem outros produtos na fila; envie todos juntos.",
  "autoQuote.reason.other":
    "erro ao abrir a consulta; escolha a estratégia na tela.",
  "strategy.send.byAuto":
    "Envio automático em {date}: a encomenda virou consulta sozinha",
  "reqSend.sentAuto": "Virou consulta sozinha em {date}",
  "autoQuote.settings.label": "Encomenda vira consulta sozinha",
  "autoQuote.settings.hint":
    "Sim: a encomenda (aberta pelo cliente ou confirmada por ele) vira consulta na hora para o fornecedor da última compra e os parceiros da família, sem a Estratégia de compra. Não: espera na Estratégia.",
  "confirmReminder.notify.subject": "Lembrete: confirme o pedido nº {n}",
  "confirmReminder.notify.body":
    "A Wellmix lançou um pedido para você e ele ainda espera a sua confirmação. Leia o aviso e confirme no portal. Lembrete {count} de {max}.",
  "confirmReminder.notify.bodyLast":
    "Último lembrete: o pedido nº {n} ainda espera a sua confirmação. Leia o aviso e confirme no portal; o vendedor da Wellmix também foi avisado.",
  "confirmReminder.seller.subject":
    "Cliente ainda não confirmou: encomenda nº {n} · {customer}",
  "confirmReminder.seller.body":
    "Saiu o último lembrete ({count} de {max}) e o cliente ainda não confirmou. Fale com ele ou edite a encomenda.",
  "confirmReminder.status":
    "Lembretes enviados ao cliente: {count} · último em {date}",
  "confirmReminder.settings.label":
    "Lembretes ao cliente para confirmar a encomenda",
  "confirmReminder.settings.hint":
    "Um por dia enquanto a encomenda espera o cliente; com o último, o vendedor é avisado. 0 desliga.",
  "settings.error.customer_reminder_invalid":
    "Lembretes ao cliente: de 0 a 10.",
};

export const en: Record<keyof typeof pt, string> = {
  "autoQuote.notify.sent.subject":
    "Inquiry no. {quote} opened by itself: order no. {n} · {customer}",
  "autoQuote.notify.sent.body":
    "{customer}, {products} product(s). Invitations sent to {sent} partner(s): the supplier of the last purchase and the partners of the family.",
  "autoQuote.notify.sent.bodyOut":
    '{customer}, {products} product(s). Invitations sent to {sent} partner(s); {out} were left out (no active login, inactive or without the quotations screen). Fix them and use "Try again".',
  "autoQuote.notify.empty.subject":
    "Inquiry no. {quote} opened without invitations: order no. {n} · {customer}",
  "autoQuote.notify.empty.body":
    '{products} product(s). No supplier of the family could receive it: {out} without an active login, inactive or without the quotations screen. Create the logins and use "Try again", or invite others on the quotation.',
  "autoQuote.notify.empty.bodyNone":
    "{products} product(s). There is no supplier of the last purchase nor any partner of the family, line or product: invite the suppliers on the inquiry.",
  "autoQuote.notify.queued.subject": "Order no. {n}: choose the strategy",
  "autoQuote.notify.queued.body":
    "{customer}, {products} product(s). The inquiry did not go out by itself: {reason}",
  "autoQuote.reason.strategy_whole_request":
    "the request has other products in the queue; send them all together.",
  "autoQuote.reason.other":
    "error opening the inquiry; choose the strategy on the screen.",
  "strategy.send.byAuto":
    "Automatic send on {date}: the order became an inquiry by itself",
  "reqSend.sentAuto": "Became an inquiry by itself on {date}",
  "autoQuote.settings.label": "Order becomes an inquiry by itself",
  "autoQuote.settings.hint":
    "Yes: the order (opened by the customer or confirmed by them) becomes an inquiry right away for the supplier of the last purchase and the partners of the family, without the purchase strategy. No: it waits in the strategy.",
  "confirmReminder.notify.subject": "Reminder: confirm order no. {n}",
  "confirmReminder.notify.body":
    "Wellmix placed an order for you and it is still waiting for your confirmation. Read the notice and confirm on the portal. Reminder {count} of {max}.",
  "confirmReminder.notify.bodyLast":
    "Last reminder: order no. {n} is still waiting for your confirmation. Read the notice and confirm on the portal; the Wellmix salesperson was also notified.",
  "confirmReminder.seller.subject":
    "Customer has not confirmed yet: order no. {n} · {customer}",
  "confirmReminder.seller.body":
    "The last reminder went out ({count} of {max}) and the customer has not confirmed yet. Talk to them or edit the order.",
  "confirmReminder.status":
    "Reminders sent to the customer: {count} · last on {date}",
  "confirmReminder.settings.label":
    "Reminders for the customer to confirm the order",
  "confirmReminder.settings.hint":
    "One a day while the order waits for the customer; with the last one, the salesperson is notified. 0 turns them off.",
  "settings.error.customer_reminder_invalid":
    "Customer reminders: from 0 to 10.",
};

export const zh: Record<keyof typeof pt, string> = {
  "autoQuote.notify.sent.subject":
    "询盘单 {quote} 已自动发出：第 {n} 号订购 · {customer}",
  "autoQuote.notify.sent.body":
    "{customer}，{products} 个产品。已向 {sent} 个合作伙伴发出邀请：上次采购的供应商和该品类的合作伙伴。",
  "autoQuote.notify.sent.bodyOut":
    "{customer}，{products} 个产品。已向 {sent} 个合作伙伴发出邀请；{out} 个未收到（没有有效账号、已停用或没有询盘页面）。处理后请使用“重试”。",
  "autoQuote.notify.empty.subject":
    "询盘单 {quote} 已打开但无人受邀：第 {n} 号订购 · {customer}",
  "autoQuote.notify.empty.body":
    "{products} 个产品。该品类的供应商都无法接收：{out} 个没有有效账号、已停用或没有询盘页面。请创建账号后使用“重试”，或在询盘单中邀请其他供应商。",
  "autoQuote.notify.empty.bodyNone":
    "{products} 个产品。没有上次采购的供应商，也没有该品类、产品线或产品的合作伙伴：请在询盘单中邀请供应商。",
  "autoQuote.notify.queued.subject": "第 {n} 号订购：请选择采购策略",
  "autoQuote.notify.queued.body":
    "{customer}，{products} 个产品。询盘未能自动发出：{reason}",
  "autoQuote.reason.strategy_whole_request":
    "该申请在队列中还有其他产品；请一起发送。",
  "autoQuote.reason.other": "打开询盘时出错；请在页面上选择采购策略。",
  "strategy.send.byAuto": "{date} 自动发送：订购已自动转为询盘",
  "reqSend.sentAuto": "{date} 已自动转为询盘",
  "autoQuote.settings.label": "订购自动转为询盘",
  "autoQuote.settings.hint":
    "是：订购（客户提交或客户确认的）立即转为询盘，发给上次采购的供应商和该品类的合作伙伴，无需采购策略。否：在采购策略中等待。",
  "confirmReminder.notify.subject": "提醒：请确认第 {n} 号订单",
  "confirmReminder.notify.body":
    "Wellmix 为您下了一个订单，仍在等待您的确认。请阅读提示并在门户中确认。第 {count} 次提醒，共 {max} 次。",
  "confirmReminder.notify.bodyLast":
    "最后一次提醒：第 {n} 号订单仍在等待您的确认。请阅读提示并在门户中确认；Wellmix 的销售也已收到通知。",
  "confirmReminder.seller.subject": "客户尚未确认：第 {n} 号订购 · {customer}",
  "confirmReminder.seller.body":
    "最后一次提醒（{count}/{max}）已发出，客户仍未确认。请联系客户或修改订购。",
  "confirmReminder.status": "已向客户发送提醒：{count} 次 · 最近一次 {date}",
  "confirmReminder.settings.label": "提醒客户确认订购的次数",
  "confirmReminder.settings.hint":
    "订购等待客户确认期间每天一次；最后一次时通知销售。0 表示关闭。",
  "settings.error.customer_reminder_invalid": "客户提醒次数：0 到 10。",
};
