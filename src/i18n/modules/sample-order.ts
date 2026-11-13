/**
 * Pedido de amostras do pedido de compra (docs/SAMPLE_ORDER.md): contrato
 * secundário com 5 × 3 peças por variante de cada produto, para o show room
 * no Brasil e a agência de marketing na China. Mesmas chaves em pt, en e zh.
 */
export const pt = {
  "sampleOrder.title": "Pedido de amostras · pedido #{n}",
  "sampleOrder.subtitle":
    "Contrato à parte do pedido de compra: amostras para o show room no Brasil e para a agência de marketing na China.",
  "sampleOrder.back": "← Voltar ao pedido",
  "sampleOrder.open": "Pedido de amostras",
  "sampleOrder.card.title": "Amostras por produto",
  "sampleOrder.rule":
    "Regra: {n} peças (5 × 3) por variante de cada produto do pedido. Produto sem variantes cadastradas conta uma.",
  "sampleOrder.col.product": "Produto",
  "sampleOrder.col.variants": "Variantes",
  "sampleOrder.col.quantity": "Amostras (peças)",
  "sampleOrder.total": "Total",
  "sampleOrder.status.pending": "A definir",
  "sampleOrder.status.sent": "Aguardando o fornecedor",
  "sampleOrder.status.accepted": "Aceito pelo fornecedor",
  "sampleOrder.status.none": "Sem amostras",
  "sampleOrder.orderedBy": "Gerado por {name} em {date}",
  "sampleOrder.acceptedBy": "aceito por {name} em {date}",
  "sampleOrder.noneBy":
    "Sem amostras neste pedido (decisão de {name} em {date})",
  "sampleOrder.decide.title": "Definir o pedido de amostras",
  "sampleOrder.decide.hint":
    "Antes de assinar o contrato, a Wellmix gera o pedido de amostras pela regra ou registra que este pedido não terá amostras.",
  "sampleOrder.decide.create": "Gerar o pedido de amostras",
  "sampleOrder.decide.none": "Sem amostras neste pedido",
  "sampleOrder.decide.noteLabel": "Motivo (opcional)",
  "sampleOrder.waitContract":
    "O pedido de amostras é definido quando o pedido chega ao contrato (raias concluídas).",
  "sampleOrder.accept.title": "Aceitar o pedido de amostras",
  "sampleOrder.accept.name": "Nome completo de quem aceita",
  "sampleOrder.accept.agree":
    "Li o pedido de amostras e concordo em produzir e separar estas quantidades.",
  "sampleOrder.accept.submit": "Aceitar o pedido de amostras",
  "sampleOrder.done.ordered":
    "Pedido de amostras gerado. O fornecedor foi avisado para aceitar.",
  "sampleOrder.done.none": "Registrado: este pedido não terá amostras.",
  "sampleOrder.done.accepted": "Pedido de amostras aceito.",
  "sampleOrder.signWait":
    "Antes de assinar, defina o pedido de amostras (gere ou marque sem amostras).",
  "sampleOrder.notify.supplier.subject":
    "Pedido de compra #{n}: pedido de amostras para aceitar",
  "sampleOrder.notify.supplier.body":
    "A Wellmix gerou o pedido de amostras deste pedido (show room no Brasil e agência de marketing na China). Confira as quantidades e aceite.",
  "sampleOrder.error.sample_order_closed":
    "O pedido de amostras só é definido com o pedido no contrato.",
  "sampleOrder.error.sample_order_already_done":
    "O pedido de amostras já foi definido.",
  "sampleOrder.error.sample_order_no_items": "O pedido não tem produtos.",
  "sampleOrder.error.sample_order_not_open":
    "Não há pedido de amostras para aceitar agora.",
  "sampleOrder.error.signature_name_required":
    "Digite o nome completo (de 3 a 120 letras).",
  "sampleOrder.error.signature_agree_required": 'Marque o "li e concordo".',
  "sampleOrder.error.signature_document_changed":
    "O pedido de amostras mudou: confira de novo antes de aceitar.",
  "orderSign.error.signature_samples_pending":
    "Defina o pedido de amostras antes de assinar.",
  "req.sample_order":
    "Pedido de amostras definido (show room e agência na China)",
  "req.sample_order_supplier": "Pedido de amostras aceito pelo fornecedor",
};

export const en: Record<keyof typeof pt, string> = {
  "sampleOrder.title": "Sample order · order #{n}",
  "sampleOrder.subtitle":
    "Separate contract from the purchase order: samples for the showroom in Brazil and for the marketing agency in China.",
  "sampleOrder.back": "← Back to the order",
  "sampleOrder.open": "Sample order",
  "sampleOrder.card.title": "Samples per product",
  "sampleOrder.rule":
    "Rule: {n} pieces (5 × 3) per variant of each product in the order. A product without registered variants counts as one.",
  "sampleOrder.col.product": "Product",
  "sampleOrder.col.variants": "Variants",
  "sampleOrder.col.quantity": "Samples (pieces)",
  "sampleOrder.total": "Total",
  "sampleOrder.status.pending": "To define",
  "sampleOrder.status.sent": "Waiting for the supplier",
  "sampleOrder.status.accepted": "Accepted by the supplier",
  "sampleOrder.status.none": "No samples",
  "sampleOrder.orderedBy": "Created by {name} on {date}",
  "sampleOrder.acceptedBy": "accepted by {name} on {date}",
  "sampleOrder.noneBy":
    "No samples in this order (decided by {name} on {date})",
  "sampleOrder.decide.title": "Define the sample order",
  "sampleOrder.decide.hint":
    "Before signing the contract, Wellmix creates the sample order by the rule or records that this order has no samples.",
  "sampleOrder.decide.create": "Create the sample order",
  "sampleOrder.decide.none": "No samples in this order",
  "sampleOrder.decide.noteLabel": "Reason (optional)",
  "sampleOrder.waitContract":
    "The sample order is defined when the order reaches the contract (lanes done).",
  "sampleOrder.accept.title": "Accept the sample order",
  "sampleOrder.accept.name": "Full name of who accepts",
  "sampleOrder.accept.agree":
    "I have read the sample order and agree to produce and set aside these quantities.",
  "sampleOrder.accept.submit": "Accept the sample order",
  "sampleOrder.done.ordered":
    "Sample order created. The supplier was asked to accept it.",
  "sampleOrder.done.none": "Recorded: this order will have no samples.",
  "sampleOrder.done.accepted": "Sample order accepted.",
  "sampleOrder.signWait":
    "Before signing, define the sample order (create it or mark no samples).",
  "sampleOrder.notify.supplier.subject":
    "Purchase order #{n}: sample order to accept",
  "sampleOrder.notify.supplier.body":
    "Wellmix created the sample order of this order (showroom in Brazil and marketing agency in China). Check the quantities and accept.",
  "sampleOrder.error.sample_order_closed":
    "The sample order is only defined with the order at the contract.",
  "sampleOrder.error.sample_order_already_done":
    "The sample order was already defined.",
  "sampleOrder.error.sample_order_no_items": "The order has no products.",
  "sampleOrder.error.sample_order_not_open":
    "There is no sample order to accept now.",
  "sampleOrder.error.signature_name_required":
    "Type the full name (3 to 120 letters).",
  "sampleOrder.error.signature_agree_required": 'Tick "I have read and agree".',
  "sampleOrder.error.signature_document_changed":
    "The sample order changed: check it again before accepting.",
  "orderSign.error.signature_samples_pending":
    "Define the sample order before signing.",
  "req.sample_order": "Sample order defined (showroom and agency in China)",
  "req.sample_order_supplier": "Sample order accepted by the supplier",
};

export const zh: Record<keyof typeof pt, string> = {
  "sampleOrder.title": "样品订单 · 订单 #{n}",
  "sampleOrder.subtitle":
    "采购订单之外的单独合同：巴西展厅和中国营销代理的样品。",
  "sampleOrder.back": "← 返回订单",
  "sampleOrder.open": "样品订单",
  "sampleOrder.card.title": "各产品样品",
  "sampleOrder.rule":
    "规则：订单中每个产品的每个款式 {n} 件（5 × 3）。未登记款式的产品按一个计。",
  "sampleOrder.col.product": "产品",
  "sampleOrder.col.variants": "款式",
  "sampleOrder.col.quantity": "样品（件）",
  "sampleOrder.total": "合计",
  "sampleOrder.status.pending": "待确定",
  "sampleOrder.status.sent": "等待供应商",
  "sampleOrder.status.accepted": "供应商已接受",
  "sampleOrder.status.none": "无样品",
  "sampleOrder.orderedBy": "由 {name} 于 {date} 生成",
  "sampleOrder.acceptedBy": "由 {name} 于 {date} 接受",
  "sampleOrder.noneBy": "本订单无样品（{name} 于 {date} 决定）",
  "sampleOrder.decide.title": "确定样品订单",
  "sampleOrder.decide.hint":
    "签署合同前，Wellmix 按规则生成样品订单，或记录本订单无样品。",
  "sampleOrder.decide.create": "生成样品订单",
  "sampleOrder.decide.none": "本订单无样品",
  "sampleOrder.decide.noteLabel": "原因（可选）",
  "sampleOrder.waitContract": "订单进入合同阶段（各项完成）后确定样品订单。",
  "sampleOrder.accept.title": "接受样品订单",
  "sampleOrder.accept.name": "接受人全名",
  "sampleOrder.accept.agree": "我已阅读样品订单，同意生产并留出这些数量。",
  "sampleOrder.accept.submit": "接受样品订单",
  "sampleOrder.done.ordered": "样品订单已生成，已通知供应商接受。",
  "sampleOrder.done.none": "已记录：本订单无样品。",
  "sampleOrder.done.accepted": "样品订单已接受。",
  "sampleOrder.signWait": "签署前，请确定样品订单（生成或标记无样品）。",
  "sampleOrder.notify.supplier.subject": "采购订单 #{n}：待接受的样品订单",
  "sampleOrder.notify.supplier.body":
    "Wellmix 已生成本订单的样品订单（巴西展厅和中国营销代理）。请核对数量并接受。",
  "sampleOrder.error.sample_order_closed":
    "订单进入合同阶段后才能确定样品订单。",
  "sampleOrder.error.sample_order_already_done": "样品订单已确定。",
  "sampleOrder.error.sample_order_no_items": "订单没有产品。",
  "sampleOrder.error.sample_order_not_open": "目前没有待接受的样品订单。",
  "sampleOrder.error.signature_name_required":
    "请输入全名（3 至 120 个字符）。",
  "sampleOrder.error.signature_agree_required": "请勾选“我已阅读并同意”。",
  "sampleOrder.error.signature_document_changed":
    "样品订单已变更：请重新核对后再接受。",
  "orderSign.error.signature_samples_pending": "签署前请先确定样品订单。",
  "req.sample_order": "已确定样品订单（展厅与中国代理）",
  "req.sample_order_supplier": "供应商已接受样品订单",
};
