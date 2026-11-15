/**
 * Forma de pagamento do cliente no pedido e as formas configuráveis (dono,
 * 15/11/2026; docs/CUSTOMER_PAYMENT.md). Mesmas chaves em pt, en e zh.
 */
export const pt = {
  "customerPayment.title": "Pagamento do cliente",
  "customerPayment.plan": "Forma de pagamento",
  "customerPayment.none": "Nenhuma forma escolhida ainda.",
  "customerPayment.seller": "Vendedor",
  "customerPayment.noSeller": "Sem vendedor",
  "customerPayment.saleNunota": "NUNOTA da venda no Sankhya",
  "customerPayment.saleNunotaHint":
    "O pedido de venda no Sankhya cujos títulos a receber são os boletos deste pedido.",
  "customerPayment.status.pending": "Em aprovação",
  "customerPayment.status.approved": "Aprovada",
  "customerPayment.status.rejected": "Recusada",
  "customerPayment.approval":
    "Precisa de aprovação por alçada: responde {name}",
  "customerPayment.decided": "respondida por {name} em {date}",
  "customerPayment.decideTitle":
    "Esta forma de pagamento espera a sua aprovação.",
  "customerPayment.decisionNote": "Observação (opcional)",
  "customerPayment.approve": "Aprovar",
  "customerPayment.reject": "Recusar",
  "customerPayment.noSale":
    "Sem a venda ao cliente gravada no pedido: os valores das parcelas aparecem depois de gravar a venda.",
  "customerPayment.col.installment": "Parcela",
  "customerPayment.col.when": "Quando",
  "customerPayment.col.amount": "Valor",
  "customerPayment.col.due": "Vencimento",
  "customerPayment.col.boleto": "Boleto",
  "customerPayment.event.order": "No pedido",
  "customerPayment.event.shipment": "No embarque",
  "customerPayment.event.cargo_presence": "Na Presença de Carga",
  "customerPayment.event.delivery": "Na entrega",
  "customerPayment.eventDays": "{event} + {days} dias",
  "customerPayment.eventOn": "aconteceu em {date}",
  "customerPayment.eventPending": "ainda não aconteceu",
  "customerPayment.interest": "inclui {value} de juros ({rate}% ao mês)",
  "customerPayment.state.no_charge": "Sem cobrança",
  "customerPayment.state.waiting_event": "Aguardando o evento",
  "customerPayment.state.to_issue": "Gerar o boleto no Sankhya",
  "customerPayment.state.issued": "Boleto em aberto",
  "customerPayment.state.overdue": "Boleto vencido",
  "customerPayment.state.paid": "Pago",
  "customerPayment.nossoNumero": "Nosso número",
  "customerPayment.boletoAmount": "Valor do boleto",
  "customerPayment.barcode": "Linha digitável",
  "customerPayment.pdf": "Boleto (PDF)",
  "customerPayment.paidOn": "Pago em {date}",
  "customerPayment.chargedOn": "Cobrado em {date}",
  "customerPayment.charge": "Cobrar o cliente",
  "customerPayment.manual": "Registrar o boleto à mão",
  "customerPayment.markPaid": "Pago",
  "customerPayment.sync": "Buscar boletos no Sankhya",
  "customerPayment.syncHint":
    "Lê os títulos a receber do pedido de venda {nunota} (financeiro do Sankhya).",
  "customerPayment.syncNoNunota":
    "Informe o NUNOTA da venda no Sankhya na forma de pagamento para buscar os boletos.",
  "customerPayment.choose": "Escolher a forma de pagamento",
  "customerPayment.change": "Trocar a forma de pagamento ou o vendedor",
  "customerPayment.choosePlan": "Escolha…",
  "customerPayment.needsApproval": "com alçada",
  "customerPayment.lockedByCharges":
    "Com boleto registrado, a forma de pagamento não muda (só o vendedor e o NUNOTA).",
  "customerPayment.notice.saved": "Forma de pagamento gravada.",
  "customerPayment.notice.approve": "Forma de pagamento aprovada.",
  "customerPayment.notice.reject": "Forma de pagamento recusada.",
  "customerPayment.notice.synced":
    "Boletos buscados no Sankhya: {n} título(s).",
  "customerPayment.notice.charge.saved": "Boleto gravado.",
  "customerPayment.notice.charge.sent": "Cobrança enviada ao cliente.",
  "customerPayment.notify.approveSubject":
    "Aprovar a forma de pagamento do pedido #{n}",
  "customerPayment.notify.approveBody":
    "Forma escolhida: {plan}. Abra o pedido para aprovar ou recusar.",
  "customerPayment.notify.approvedSubject":
    "Forma de pagamento aprovada no pedido #{n}",
  "customerPayment.notify.rejectedSubject":
    "Forma de pagamento recusada no pedido #{n}",
  "customerPayment.notify.issueSubject":
    "Gerar o boleto da parcela {i} do pedido #{n}",
  "customerPayment.notify.issueBody":
    '{plan}: valor {amount}, vencimento {due}. Gere o boleto no Sankhya (pedido de venda {nunota}) e use "Buscar boletos no Sankhya" no pedido.',
  "customerPayment.notify.chargeSubject":
    "Boleto da parcela {i} do pedido #{n}",
  "customerPayment.notify.chargeBody":
    "Vencimento {due}. Linha digitável: {barcode}. O boleto está no pedido, em Pagamento do cliente.",
  "customerPayment.notify.holdSubject":
    "Pedido #{n} travado: parcela em aberto",
  "customerPayment.notify.holdBody":
    "A(s) parcela(s) {list} venceu(ram) sem pagamento. O pedido fica travado até o pagamento entrar ou um administrador destravar.",
  "delivery.paused.payment_open":
    "Pedido travado em {date}: parcela do cliente vencida sem pagamento (Pagamento do cliente). Destrava sozinho quando o pagamento entrar; só um administrador pode destravar antes.",
  "customerPayment.released": "Liberada pelo administrador em {date}",
  "customerPayment.holdHint":
    "Parcela vencida sem pagamento trava o pedido; só um administrador destrava antes do pagamento. Uma data pode ficar sem quantidade para um produto.",
  "paymentPlans.title": "Formas de pagamento do cliente",
  "paymentPlans.intro":
    "As formas que a Wellmix escolhe no pedido: cada parcela é um percentual da venda ao cliente que vence num evento do pedido (mais dias, se houver). A soma tem de dar 100%.",
  "paymentPlans.back": "Voltar às configurações",
  "paymentPlans.saved": "Forma de pagamento gravada.",
  "paymentPlans.new": "Nova forma de pagamento",
  "paymentPlans.name": "Nome",
  "paymentPlans.sortOrder": "Ordem",
  "paymentPlans.installments": "Parcelas",
  "paymentPlans.installmentsHint":
    'Percentual, evento e dias depois do evento. Linha sem percentual não conta; 0% marca o evento sem cobrança. Parcela "Na entrega" com dias paga os juros abaixo.',
  "paymentPlans.percent": "Percentual da parcela",
  "paymentPlans.event": "Evento da parcela",
  "paymentPlans.days": "Dias",
  "paymentPlans.interest": "Juros compostos ao mês (%)",
  "paymentPlans.interestHint":
    "Só nas parcelas depois da entrega: valor × (1 + juros) elevado a (dias ÷ 30).",
  "paymentPlans.approver": "Quem aprova (alçada)",
  "paymentPlans.requiresApproval": "Solicitar aprovação por alçada",
  "paymentPlans.active": "Ativa (aparece no pedido)",
  "paymentPlans.inactive": "Inativa",
  "paymentPlans.approvalBy": "Alçada: {name}",
  "paymentPlans.interestBadge": "Juros {rate}% ao mês",
  "customerPayment.error.plan_installments":
    "A forma precisa de 1 a 12 parcelas.",
  "orders.error.plan_installments": "A forma precisa de 1 a 12 parcelas.",
  "customerPayment.error.plan_event": "Evento de parcela inválido.",
  "orders.error.plan_event": "Evento de parcela inválido.",
  "customerPayment.error.plan_percent":
    "Percentual de parcela inválido (0 a 100).",
  "orders.error.plan_percent": "Percentual de parcela inválido (0 a 100).",
  "customerPayment.error.plan_days": "Dias inválidos (0 a 720).",
  "orders.error.plan_days": "Dias inválidos (0 a 720).",
  "customerPayment.error.plan_total": "As parcelas precisam somar 100%.",
  "orders.error.plan_total": "As parcelas precisam somar 100%.",
  "customerPayment.error.plan_interest": "Juros inválidos (0 a 20% ao mês).",
  "orders.error.plan_interest": "Juros inválidos (0 a 20% ao mês).",
  "customerPayment.error.plan_approver":
    "Com alçada, escolha quem aprova (um login ativo da Wellmix).",
  "orders.error.plan_approver":
    "Com alçada, escolha quem aprova (um login ativo da Wellmix).",
  "customerPayment.error.plan_unavailable":
    "Essa forma de pagamento não está ativa.",
  "orders.error.plan_unavailable": "Essa forma de pagamento não está ativa.",
  "customerPayment.error.plan_seller":
    "Vendedor inválido: escolha um login ativo da Wellmix.",
  "orders.error.plan_seller":
    "Vendedor inválido: escolha um login ativo da Wellmix.",
  "customerPayment.error.plan_has_charges":
    "Este pedido já tem boleto registrado: a forma de pagamento não muda.",
  "orders.error.plan_has_charges":
    "Este pedido já tem boleto registrado: a forma de pagamento não muda.",
  "customerPayment.error.plan_child_order":
    "A rodada da programação segue a forma de pagamento do pedido pai.",
  "orders.error.plan_child_order":
    "A rodada da programação segue a forma de pagamento do pedido pai.",
  "customerPayment.error.plan_not_pending":
    "Esta forma de pagamento não está em aprovação.",
  "orders.error.plan_not_pending":
    "Esta forma de pagamento não está em aprovação.",
  "customerPayment.error.plan_not_approved":
    "A forma de pagamento ainda não foi aprovada.",
  "orders.error.plan_not_approved":
    "A forma de pagamento ainda não foi aprovada.",
  "customerPayment.error.plan_no_nunota":
    "Informe o NUNOTA da venda no Sankhya na forma de pagamento.",
  "orders.error.plan_no_nunota":
    "Informe o NUNOTA da venda no Sankhya na forma de pagamento.",
  "customerPayment.error.charge_unavailable":
    "Essa parcela não tem boleto em aberto.",
  "orders.error.charge_unavailable": "Essa parcela não tem boleto em aberto.",
  "customerPayment.error.charge_no_customer":
    "O pedido não tem login do cliente que pediu: não há a quem enviar a cobrança.",
  "orders.error.charge_no_customer":
    "O pedido não tem login do cliente que pediu: não há a quem enviar a cobrança.",
};

export const en: Record<keyof typeof pt, string> = {
  "customerPayment.title": "Customer payment",
  "customerPayment.plan": "Payment method",
  "customerPayment.none": "No payment method chosen yet.",
  "customerPayment.seller": "Salesperson",
  "customerPayment.noSeller": "No salesperson",
  "customerPayment.saleNunota": "Sankhya sales order NUNOTA",
  "customerPayment.saleNunotaHint":
    "The Sankhya sales order whose receivables are this order's boletos.",
  "customerPayment.status.pending": "Awaiting approval",
  "customerPayment.status.approved": "Approved",
  "customerPayment.status.rejected": "Rejected",
  "customerPayment.approval":
    "Needs approval by authority level: answered by {name}",
  "customerPayment.decided": "answered by {name} on {date}",
  "customerPayment.decideTitle": "This payment method awaits your approval.",
  "customerPayment.decisionNote": "Note (optional)",
  "customerPayment.approve": "Approve",
  "customerPayment.reject": "Reject",
  "customerPayment.noSale":
    "No customer sale recorded on the order: installment amounts appear after the sale is recorded.",
  "customerPayment.col.installment": "Installment",
  "customerPayment.col.when": "When",
  "customerPayment.col.amount": "Amount",
  "customerPayment.col.due": "Due date",
  "customerPayment.col.boleto": "Boleto",
  "customerPayment.event.order": "On order",
  "customerPayment.event.shipment": "On shipment",
  "customerPayment.event.cargo_presence": "On cargo presence",
  "customerPayment.event.delivery": "On delivery",
  "customerPayment.eventDays": "{event} + {days} days",
  "customerPayment.eventOn": "happened on {date}",
  "customerPayment.eventPending": "not yet",
  "customerPayment.interest": "includes {value} interest ({rate}% per month)",
  "customerPayment.state.no_charge": "No charge",
  "customerPayment.state.waiting_event": "Waiting for the event",
  "customerPayment.state.to_issue": "Issue the boleto in Sankhya",
  "customerPayment.state.issued": "Boleto open",
  "customerPayment.state.overdue": "Boleto overdue",
  "customerPayment.state.paid": "Paid",
  "customerPayment.nossoNumero": "Bank reference (nosso número)",
  "customerPayment.boletoAmount": "Boleto amount",
  "customerPayment.barcode": "Payment line (linha digitável)",
  "customerPayment.pdf": "Boleto (PDF)",
  "customerPayment.paidOn": "Paid on {date}",
  "customerPayment.chargedOn": "Charged on {date}",
  "customerPayment.charge": "Charge the customer",
  "customerPayment.manual": "Record the boleto manually",
  "customerPayment.markPaid": "Paid",
  "customerPayment.sync": "Fetch boletos from Sankhya",
  "customerPayment.syncHint":
    "Reads the receivables of sales order {nunota} (Sankhya finance).",
  "customerPayment.syncNoNunota":
    "Enter the Sankhya sales order NUNOTA in the payment method to fetch the boletos.",
  "customerPayment.choose": "Choose the payment method",
  "customerPayment.change": "Change the payment method or salesperson",
  "customerPayment.choosePlan": "Choose…",
  "customerPayment.needsApproval": "needs approval",
  "customerPayment.lockedByCharges":
    "With a boleto recorded, the payment method no longer changes (only the salesperson and the NUNOTA).",
  "customerPayment.notice.saved": "Payment method saved.",
  "customerPayment.notice.approve": "Payment method approved.",
  "customerPayment.notice.reject": "Payment method rejected.",
  "customerPayment.notice.synced":
    "Boletos fetched from Sankhya: {n} title(s).",
  "customerPayment.notice.charge.saved": "Boleto saved.",
  "customerPayment.notice.charge.sent": "Charge sent to the customer.",
  "customerPayment.notify.approveSubject":
    "Approve the payment method of order #{n}",
  "customerPayment.notify.approveBody":
    "Chosen method: {plan}. Open the order to approve or reject.",
  "customerPayment.notify.approvedSubject":
    "Payment method approved on order #{n}",
  "customerPayment.notify.rejectedSubject":
    "Payment method rejected on order #{n}",
  "customerPayment.notify.issueSubject":
    "Issue the boleto for installment {i} of order #{n}",
  "customerPayment.notify.issueBody":
    '{plan}: amount {amount}, due {due}. Issue the boleto in Sankhya (sales order {nunota}) and use "Fetch boletos from Sankhya" on the order.',
  "customerPayment.notify.chargeSubject":
    "Boleto for installment {i} of order #{n}",
  "customerPayment.notify.chargeBody":
    "Due {due}. Payment line: {barcode}. The boleto is on the order, under Customer payment.",
  "customerPayment.notify.holdSubject": "Order #{n} on hold: open installment",
  "customerPayment.notify.holdBody":
    "Installment(s) {list} are past due without payment. The order stays on hold until payment comes in or an administrator releases it.",
  "delivery.paused.payment_open":
    "Order on hold since {date}: customer installment past due without payment (Customer payment). It releases itself when payment comes in; only an administrator can release it earlier.",
  "customerPayment.released": "Released by the administrator on {date}",
  "customerPayment.holdHint":
    "A past-due unpaid installment puts the order on hold; only an administrator can release it before payment. A date may have no quantity for a product.",
  "paymentPlans.title": "Customer payment methods",
  "paymentPlans.intro":
    "The methods Wellmix chooses on the order: each installment is a percentage of the customer sale due at an order event (plus days, if any). The total must be 100%.",
  "paymentPlans.back": "Back to settings",
  "paymentPlans.saved": "Payment method saved.",
  "paymentPlans.new": "New payment method",
  "paymentPlans.name": "Name",
  "paymentPlans.sortOrder": "Order",
  "paymentPlans.installments": "Installments",
  "paymentPlans.installmentsHint":
    'Percentage, event and days after the event. A row without a percentage does not count; 0% marks the event without a charge. An "On delivery" installment with days pays the interest below.',
  "paymentPlans.percent": "Installment percentage",
  "paymentPlans.event": "Installment event",
  "paymentPlans.days": "Days",
  "paymentPlans.interest": "Monthly compound interest (%)",
  "paymentPlans.interestHint":
    "Only on installments after delivery: amount × (1 + interest) to the power of (days ÷ 30).",
  "paymentPlans.approver": "Approver (authority level)",
  "paymentPlans.requiresApproval": "Require approval by authority level",
  "paymentPlans.active": "Active (shown on the order)",
  "paymentPlans.inactive": "Inactive",
  "paymentPlans.approvalBy": "Approval: {name}",
  "paymentPlans.interestBadge": "Interest {rate}% per month",
  "customerPayment.error.plan_installments":
    "The method needs 1 to 12 installments.",
  "orders.error.plan_installments": "The method needs 1 to 12 installments.",
  "customerPayment.error.plan_event": "Invalid installment event.",
  "orders.error.plan_event": "Invalid installment event.",
  "customerPayment.error.plan_percent":
    "Invalid installment percentage (0 to 100).",
  "orders.error.plan_percent": "Invalid installment percentage (0 to 100).",
  "customerPayment.error.plan_days": "Invalid days (0 to 720).",
  "orders.error.plan_days": "Invalid days (0 to 720).",
  "customerPayment.error.plan_total": "Installments must add up to 100%.",
  "orders.error.plan_total": "Installments must add up to 100%.",
  "customerPayment.error.plan_interest":
    "Invalid interest (0 to 20% per month).",
  "orders.error.plan_interest": "Invalid interest (0 to 20% per month).",
  "customerPayment.error.plan_approver":
    "With approval, choose the approver (an active Wellmix login).",
  "orders.error.plan_approver":
    "With approval, choose the approver (an active Wellmix login).",
  "customerPayment.error.plan_unavailable":
    "This payment method is not active.",
  "orders.error.plan_unavailable": "This payment method is not active.",
  "customerPayment.error.plan_seller":
    "Invalid salesperson: choose an active Wellmix login.",
  "orders.error.plan_seller":
    "Invalid salesperson: choose an active Wellmix login.",
  "customerPayment.error.plan_has_charges":
    "This order already has a boleto recorded: the payment method does not change.",
  "orders.error.plan_has_charges":
    "This order already has a boleto recorded: the payment method does not change.",
  "customerPayment.error.plan_child_order":
    "The schedule round follows the parent order's payment method.",
  "orders.error.plan_child_order":
    "The schedule round follows the parent order's payment method.",
  "customerPayment.error.plan_not_pending":
    "This payment method is not awaiting approval.",
  "orders.error.plan_not_pending":
    "This payment method is not awaiting approval.",
  "customerPayment.error.plan_not_approved":
    "The payment method has not been approved yet.",
  "orders.error.plan_not_approved":
    "The payment method has not been approved yet.",
  "customerPayment.error.plan_no_nunota":
    "Enter the Sankhya sales order NUNOTA in the payment method.",
  "orders.error.plan_no_nunota":
    "Enter the Sankhya sales order NUNOTA in the payment method.",
  "customerPayment.error.charge_unavailable":
    "This installment has no open boleto.",
  "orders.error.charge_unavailable": "This installment has no open boleto.",
  "customerPayment.error.charge_no_customer":
    "The order has no requesting customer login: there is no one to send the charge to.",
  "orders.error.charge_no_customer":
    "The order has no requesting customer login: there is no one to send the charge to.",
};

export const zh: Record<keyof typeof pt, string> = {
  "customerPayment.title": "客户付款",
  "customerPayment.plan": "付款方式",
  "customerPayment.none": "尚未选择付款方式。",
  "customerPayment.seller": "销售员",
  "customerPayment.noSeller": "无销售员",
  "customerPayment.saleNunota": "Sankhya 销售订单 NUNOTA",
  "customerPayment.saleNunotaHint":
    "Sankhya 中的销售订单，其应收款即本订单的 boleto。",
  "customerPayment.status.pending": "待审批",
  "customerPayment.status.approved": "已批准",
  "customerPayment.status.rejected": "已拒绝",
  "customerPayment.approval": "需按权限审批：由 {name} 答复",
  "customerPayment.decided": "{name} 于 {date} 答复",
  "customerPayment.decideTitle": "此付款方式等待您的审批。",
  "customerPayment.decisionNote": "备注（可选）",
  "customerPayment.approve": "批准",
  "customerPayment.reject": "拒绝",
  "customerPayment.noSale": "订单尚未记录客户销售：记录销售后显示各期金额。",
  "customerPayment.col.installment": "期数",
  "customerPayment.col.when": "时间",
  "customerPayment.col.amount": "金额",
  "customerPayment.col.due": "到期日",
  "customerPayment.col.boleto": "Boleto",
  "customerPayment.event.order": "下单时",
  "customerPayment.event.shipment": "装运时",
  "customerPayment.event.cargo_presence": "货物到港登记时",
  "customerPayment.event.delivery": "交付时",
  "customerPayment.eventDays": "{event} + {days} 天",
  "customerPayment.eventOn": "发生于 {date}",
  "customerPayment.eventPending": "尚未发生",
  "customerPayment.interest": "含利息 {value}（每月 {rate}%）",
  "customerPayment.state.no_charge": "不收款",
  "customerPayment.state.waiting_event": "等待事件",
  "customerPayment.state.to_issue": "在 Sankhya 生成 boleto",
  "customerPayment.state.issued": "Boleto 未付",
  "customerPayment.state.overdue": "Boleto 逾期",
  "customerPayment.state.paid": "已付",
  "customerPayment.nossoNumero": "银行编号",
  "customerPayment.boletoAmount": "Boleto 金额",
  "customerPayment.barcode": "付款码",
  "customerPayment.pdf": "Boleto（PDF）",
  "customerPayment.paidOn": "于 {date} 付款",
  "customerPayment.chargedOn": "于 {date} 催收",
  "customerPayment.charge": "向客户催收",
  "customerPayment.manual": "手动登记 boleto",
  "customerPayment.markPaid": "已付",
  "customerPayment.sync": "从 Sankhya 获取 boleto",
  "customerPayment.syncHint":
    "读取销售订单 {nunota} 的应收款（Sankhya 财务）。",
  "customerPayment.syncNoNunota":
    "请在付款方式中填写 Sankhya 销售订单 NUNOTA 以获取 boleto。",
  "customerPayment.choose": "选择付款方式",
  "customerPayment.change": "更改付款方式或销售员",
  "customerPayment.choosePlan": "请选择…",
  "customerPayment.needsApproval": "需审批",
  "customerPayment.lockedByCharges":
    "已登记 boleto 后，付款方式不再更改（仅可改销售员和 NUNOTA）。",
  "customerPayment.notice.saved": "付款方式已保存。",
  "customerPayment.notice.approve": "付款方式已批准。",
  "customerPayment.notice.reject": "付款方式已拒绝。",
  "customerPayment.notice.synced": "已从 Sankhya 获取 boleto：{n} 笔。",
  "customerPayment.notice.charge.saved": "Boleto 已保存。",
  "customerPayment.notice.charge.sent": "催收已发送给客户。",
  "customerPayment.notify.approveSubject": "审批订单 #{n} 的付款方式",
  "customerPayment.notify.approveBody":
    "所选方式：{plan}。打开订单以批准或拒绝。",
  "customerPayment.notify.approvedSubject": "订单 #{n} 的付款方式已批准",
  "customerPayment.notify.rejectedSubject": "订单 #{n} 的付款方式已拒绝",
  "customerPayment.notify.issueSubject": "生成订单 #{n} 第 {i} 期的 boleto",
  "customerPayment.notify.issueBody":
    "{plan}：金额 {amount}，到期 {due}。请在 Sankhya 生成 boleto（销售订单 {nunota}），然后在订单中使用“从 Sankhya 获取 boleto”。",
  "customerPayment.notify.chargeSubject": "订单 #{n} 第 {i} 期 boleto",
  "customerPayment.notify.chargeBody":
    "到期 {due}。付款码：{barcode}。Boleto 在订单的“客户付款”中。",
  "customerPayment.notify.holdSubject": "订单 #{n} 已冻结：有未付分期",
  "customerPayment.notify.holdBody":
    "第 {list} 期已到期未付。在付款到账或管理员解除之前，订单保持冻结。",
  "delivery.paused.payment_open":
    "订单自 {date} 起冻结：客户分期到期未付（客户付款）。付款到账后自动解除；只有管理员可以提前解除。",
  "customerPayment.released": "管理员于 {date} 解除",
  "customerPayment.holdHint":
    "到期未付的分期会冻结订单；付款前只有管理员可以解除。某个日期可以没有某产品的数量。",
  "paymentPlans.title": "客户付款方式",
  "paymentPlans.intro":
    "Wellmix 在订单中选择的方式：每期是客户销售额的百分比，在订单的某个事件（加天数）到期。合计必须为 100%。",
  "paymentPlans.back": "返回设置",
  "paymentPlans.saved": "付款方式已保存。",
  "paymentPlans.new": "新付款方式",
  "paymentPlans.name": "名称",
  "paymentPlans.sortOrder": "顺序",
  "paymentPlans.installments": "分期",
  "paymentPlans.installmentsHint":
    "百分比、事件和事件后的天数。没有百分比的行不计；0% 仅标记事件不收款。带天数的“交付时”分期按下方利息计。",
  "paymentPlans.percent": "分期百分比",
  "paymentPlans.event": "分期事件",
  "paymentPlans.days": "天数",
  "paymentPlans.interest": "月复利（%）",
  "paymentPlans.interestHint":
    "仅适用于交付后的分期：金额 × (1 + 利率) 的 (天数 ÷ 30) 次方。",
  "paymentPlans.approver": "审批人（权限）",
  "paymentPlans.requiresApproval": "需要按权限审批",
  "paymentPlans.active": "启用（在订单中显示）",
  "paymentPlans.inactive": "停用",
  "paymentPlans.approvalBy": "审批：{name}",
  "paymentPlans.interestBadge": "利息每月 {rate}%",
  "customerPayment.error.plan_installments": "付款方式需要 1 到 12 期。",
  "orders.error.plan_installments": "付款方式需要 1 到 12 期。",
  "customerPayment.error.plan_event": "分期事件无效。",
  "orders.error.plan_event": "分期事件无效。",
  "customerPayment.error.plan_percent": "分期百分比无效（0 到 100）。",
  "orders.error.plan_percent": "分期百分比无效（0 到 100）。",
  "customerPayment.error.plan_days": "天数无效（0 到 720）。",
  "orders.error.plan_days": "天数无效（0 到 720）。",
  "customerPayment.error.plan_total": "各期合计必须为 100%。",
  "orders.error.plan_total": "各期合计必须为 100%。",
  "customerPayment.error.plan_interest": "利息无效（每月 0 到 20%）。",
  "orders.error.plan_interest": "利息无效（每月 0 到 20%）。",
  "customerPayment.error.plan_approver":
    "需审批时，请选择审批人（有效的 Wellmix 账号）。",
  "orders.error.plan_approver":
    "需审批时，请选择审批人（有效的 Wellmix 账号）。",
  "customerPayment.error.plan_unavailable": "该付款方式未启用。",
  "orders.error.plan_unavailable": "该付款方式未启用。",
  "customerPayment.error.plan_seller":
    "销售员无效：请选择有效的 Wellmix 账号。",
  "orders.error.plan_seller": "销售员无效：请选择有效的 Wellmix 账号。",
  "customerPayment.error.plan_has_charges":
    "该订单已登记 boleto：付款方式不能更改。",
  "orders.error.plan_has_charges": "该订单已登记 boleto：付款方式不能更改。",
  "customerPayment.error.plan_child_order": "计划批次沿用母订单的付款方式。",
  "orders.error.plan_child_order": "计划批次沿用母订单的付款方式。",
  "customerPayment.error.plan_not_pending": "该付款方式不在审批中。",
  "orders.error.plan_not_pending": "该付款方式不在审批中。",
  "customerPayment.error.plan_not_approved": "付款方式尚未批准。",
  "orders.error.plan_not_approved": "付款方式尚未批准。",
  "customerPayment.error.plan_no_nunota":
    "请在付款方式中填写 Sankhya 销售订单 NUNOTA。",
  "orders.error.plan_no_nunota": "请在付款方式中填写 Sankhya 销售订单 NUNOTA。",
  "customerPayment.error.charge_unavailable": "该期没有未付的 boleto。",
  "orders.error.charge_unavailable": "该期没有未付的 boleto。",
  "customerPayment.error.charge_no_customer":
    "订单没有提出需求的客户账号：无人可接收催收。",
  "orders.error.charge_no_customer":
    "订单没有提出需求的客户账号：无人可接收催收。",
};
