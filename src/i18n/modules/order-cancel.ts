/**
 * Dicionário do módulo "order-cancel" (cancelamento de pedido pela Wellmix e
 * pedido de cancelamento do cliente): mesmas chaves em pt, en e zh.
 */
export const pt = {
  "stage.CANCELLED": "Cancelado",
  "stageStatus.cancelled": "Cancelada",
  "cancel.title": "Cancelar pedido",
  "cancel.hint":
    "Só o administrador cancela, em qualquer etapa. Nada é apagado: o pedido fica como Cancelado, com o histórico. Etapas abertas são encerradas, o pedido sai dos containers e dos fretes em aberto e todos os envolvidos são avisados.",
  "cancel.reason": "Motivo",
  "cancel.reason.customer_withdrew": "Desistência do cliente",
  "cancel.reason.supplier_issue": "Problema com o fornecedor",
  "cancel.reason.quality_rejected": "Qualidade reprovada",
  "cancel.reason.price_or_deadline": "Preço ou prazo",
  "cancel.reason.other": "Outro",
  "cancel.note": "Observação (opcional)",
  "cancel.settlement": "Acerto financeiro com o cliente (opcional)",
  "cancel.settlementLabel": "Acerto financeiro com o cliente",
  "cancel.settlementHint":
    "Livre: o que foi combinado sobre o sinal e os pagamentos (devolução, crédito, retenção…). Pode ser preenchido ou alterado depois.",
  "cancel.money":
    "Recebido do cliente: {received} · Pago ao fornecedor: {paid}",
  "cancel.submit": "Cancelar pedido",
  "cancel.confirm":
    "Cancelar este pedido? As etapas abertas serão encerradas e todos serão avisados.",
  "cancel.done": "Pedido cancelado.",
  "cancel.banner": "Pedido cancelado em {date} por {user}",
  "cancel.bannerStage": "Estava na etapa: {stage}.",
  "cancel.settlementSave": "Salvar acerto",
  "cancel.settlementSaved": "Acerto financeiro salvo.",
  "cancel.settlementEmpty": "Acerto financeiro ainda não registrado.",
  "cancel.erpWarning":
    "Este pedido tem número no Sankhya ({erp}): cancele também no Sankhya.",
  "cancel.request.title": "Solicitar cancelamento",
  "cancel.request.hint":
    "Você pode pedir o cancelamento até o produto entrar em produção. A Wellmix analisa e responde.",
  "cancel.request.reason": "Por que deseja cancelar?",
  "cancel.request.submit": "Solicitar cancelamento",
  "cancel.request.sent":
    "Pedido de cancelamento enviado. A Wellmix vai responder.",
  "cancel.request.pending":
    "Cancelamento solicitado em {date}. Aguardando a análise da Wellmix.",
  "cancel.request.rejected": "A Wellmix recusou o cancelamento: {response}",
  "cancel.request.closedWindow":
    "O produto já entrou em produção: o cancelamento só pode ser tratado diretamente com a Wellmix.",
  "cancel.request.wellmixTitle": "Cliente pediu o cancelamento",
  "cancel.request.wellmixBody": "Em {date}: {reason}",
  "cancel.request.reject": "Recusar pedido de cancelamento",
  "cancel.request.response": "Resposta ao cliente",
  "cancel.request.rejectedOk":
    "Pedido de cancelamento recusado; o cliente foi avisado.",
  "orders.error.cancel_not_allowed":
    "O cancelamento não é mais possível pelo portal: o produto já entrou em produção.",
  "orders.error.already_cancelled": "Este pedido já está cancelado.",
  "orders.error.no_cancel_request": "Não há pedido de cancelamento em aberto.",
};

export const en: Record<keyof typeof pt, string> = {
  "stage.CANCELLED": "Cancelled",
  "stageStatus.cancelled": "Cancelled",
  "cancel.title": "Cancel order",
  "cancel.hint":
    "Only the administrator cancels, at any stage. Nothing is deleted: the order stays as Cancelled, with its history. Open stages are closed, the order leaves containers and open freight requests, and everyone involved is notified.",
  "cancel.reason": "Reason",
  "cancel.reason.customer_withdrew": "Customer withdrew",
  "cancel.reason.supplier_issue": "Supplier issue",
  "cancel.reason.quality_rejected": "Quality rejected",
  "cancel.reason.price_or_deadline": "Price or deadline",
  "cancel.reason.other": "Other",
  "cancel.note": "Note (optional)",
  "cancel.settlement": "Financial settlement with the customer (optional)",
  "cancel.settlementLabel": "Financial settlement with the customer",
  "cancel.settlementHint":
    "Free text: what was agreed about the down payment and payments (refund, credit, retention…). Can be filled in or changed later.",
  "cancel.money":
    "Received from customer: {received} · Paid to supplier: {paid}",
  "cancel.submit": "Cancel order",
  "cancel.confirm":
    "Cancel this order? Open stages will be closed and everyone will be notified.",
  "cancel.done": "Order cancelled.",
  "cancel.banner": "Order cancelled on {date} by {user}",
  "cancel.bannerStage": "It was at stage: {stage}.",
  "cancel.settlementSave": "Save settlement",
  "cancel.settlementSaved": "Financial settlement saved.",
  "cancel.settlementEmpty": "Financial settlement not recorded yet.",
  "cancel.erpWarning":
    "This order has a Sankhya number ({erp}): cancel it in Sankhya too.",
  "cancel.request.title": "Request cancellation",
  "cancel.request.hint":
    "You can request cancellation until the product goes into production. Wellmix reviews and replies.",
  "cancel.request.reason": "Why do you want to cancel?",
  "cancel.request.submit": "Request cancellation",
  "cancel.request.sent": "Cancellation request sent. Wellmix will reply.",
  "cancel.request.pending":
    "Cancellation requested on {date}. Waiting for Wellmix's review.",
  "cancel.request.rejected": "Wellmix declined the cancellation: {response}",
  "cancel.request.closedWindow":
    "The product is already in production: cancellation can only be handled directly with Wellmix.",
  "cancel.request.wellmixTitle": "Customer requested cancellation",
  "cancel.request.wellmixBody": "On {date}: {reason}",
  "cancel.request.reject": "Decline cancellation request",
  "cancel.request.response": "Reply to the customer",
  "cancel.request.rejectedOk":
    "Cancellation request declined; the customer was notified.",
  "orders.error.cancel_not_allowed":
    "Cancellation is no longer possible through the portal: the product is already in production.",
  "orders.error.already_cancelled": "This order is already cancelled.",
  "orders.error.no_cancel_request": "There is no open cancellation request.",
};

export const zh: Record<keyof typeof pt, string> = {
  "stage.CANCELLED": "已取消",
  "stageStatus.cancelled": "已取消",
  "cancel.title": "取消订单",
  "cancel.hint":
    "只有管理员可以取消，任何阶段均可。不会删除任何数据：订单保留历史并标记为已取消。进行中的阶段将关闭，订单将移出货柜和未完成的运费询价，并通知所有相关方。",
  "cancel.reason": "原因",
  "cancel.reason.customer_withdrew": "客户放弃",
  "cancel.reason.supplier_issue": "供应商问题",
  "cancel.reason.quality_rejected": "质量不合格",
  "cancel.reason.price_or_deadline": "价格或交期",
  "cancel.reason.other": "其他",
  "cancel.note": "备注（可选）",
  "cancel.settlement": "与客户的财务结算（可选）",
  "cancel.settlementLabel": "与客户的财务结算",
  "cancel.settlementHint":
    "自由填写：关于定金和付款的约定（退款、抵扣、扣留……）。可稍后填写或修改。",
  "cancel.money": "已收客户款：{received} · 已付供应商：{paid}",
  "cancel.submit": "取消订单",
  "cancel.confirm": "确定取消此订单？进行中的阶段将关闭，并通知所有人。",
  "cancel.done": "订单已取消。",
  "cancel.banner": "订单已于 {date} 由 {user} 取消",
  "cancel.bannerStage": "取消时所处阶段：{stage}。",
  "cancel.settlementSave": "保存结算",
  "cancel.settlementSaved": "财务结算已保存。",
  "cancel.settlementEmpty": "尚未记录财务结算。",
  "cancel.erpWarning":
    "此订单在 Sankhya 中有编号（{erp}）：请同时在 Sankhya 中取消。",
  "cancel.request.title": "申请取消",
  "cancel.request.hint": "产品投产前您可以申请取消。Wellmix 会审核并回复。",
  "cancel.request.reason": "取消原因？",
  "cancel.request.submit": "申请取消",
  "cancel.request.sent": "取消申请已发送。Wellmix 将会回复。",
  "cancel.request.pending": "已于 {date} 申请取消，等待 Wellmix 审核。",
  "cancel.request.rejected": "Wellmix 拒绝了取消申请：{response}",
  "cancel.request.closedWindow": "产品已投产：取消只能直接与 Wellmix 协商。",
  "cancel.request.wellmixTitle": "客户申请取消订单",
  "cancel.request.wellmixBody": "{date}：{reason}",
  "cancel.request.reject": "拒绝取消申请",
  "cancel.request.response": "回复客户",
  "cancel.request.rejectedOk": "已拒绝取消申请，并已通知客户。",
  "orders.error.cancel_not_allowed": "无法再通过平台取消：产品已投产。",
  "orders.error.already_cancelled": "此订单已取消。",
  "orders.error.no_cancel_request": "没有待处理的取消申请。",
};
