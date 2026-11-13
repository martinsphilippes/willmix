/**
 * Pedido de compra das solicitações ao fornecedor (docs/PURCHASE_ORDER.md):
 * gerar o pedido, as três raias e o contrato com as duas assinaturas.
 * Mesmas chaves em pt, en e zh.
 */
export const pt = {
  "orders.origin.supplier_request":
    "Pedido de compra (solicitação ao fornecedor)",
  "purchaseOrder.stage.PREPARATION": "Preparação, arte e certificação",
  "purchaseOrder.stageRow.PREPARATION": "Die-Cut, Arte e Certificação",
  "purchaseOrder.dieCut.title": "Die-Cut",
  "purchaseOrder.dieCut.done": "Concluído",
  "purchaseOrder.stage.PACKAGING": "Contrato e assinaturas",

  "purchaseOrder.card.title": "Gerar pedido de compra",
  "purchaseOrder.card.hint":
    "Produtos aprovados com o fornecedor e já cadastrados, ainda fora de pedido. Um pedido por fornecedor: marque os produtos, ajuste a quantidade e gere. O pedido abre as três raias juntas: fornecedor (preparação), agência de arte e certificadora.",
  "purchaseOrder.card.customer": "Comprador: {name}",
  "purchaseOrder.card.submit": "Gerar pedido de compra",
  "purchaseOrder.card.pending": "Gerando…",
  "purchaseOrder.col.include": "Incluir",
  "purchaseOrder.col.request": "Solicitação",
  "purchaseOrder.col.product": "Produto",
  "purchaseOrder.col.price": "Preço negociado",
  "purchaseOrder.col.moq": "MOQ",
  "purchaseOrder.col.leadTime": "Prazo (dias)",
  "purchaseOrder.col.quantity": "Quantidade (peças)",
  "purchaseOrder.list.order": "Ver o pedido de compra",
  "purchaseOrder.detail.inOrder":
    "Este produto está no pedido de compra. Abrir o pedido.",
  "purchaseOrder.detail.generate":
    "Produto cadastrado: gere o pedido de compra em Solicitações ao fornecedor.",

  "purchaseOrder.error.purchase_order_choose_items":
    "Marque ao menos um produto para o pedido.",
  "purchaseOrder.error.purchase_order_too_many":
    "No máximo 30 produtos por pedido.",
  "purchaseOrder.error.purchase_order_not_ready":
    "Só entram solicitações aprovadas com o produto cadastrado.",
  "purchaseOrder.error.purchase_order_taken":
    "Um dos produtos já está em outro pedido de compra.",
  "purchaseOrder.error.purchase_order_one_supplier":
    "Um pedido é de um fornecedor só.",
  "purchaseOrder.error.purchase_order_currency_mixed":
    "Os produtos do pedido precisam estar na mesma moeda.",
  "purchaseOrder.error.purchase_order_customer_missing":
    "Comprador não encontrado: falta o cadastro de cliente da Wellmix com o código da empresa do Sankhya (CODEMP, hoje 3).",
  "purchaseOrder.error.purchase_order_qty_invalid":
    "Quantidade inválida: informe as peças (número inteiro maior que zero).",
  "orders.error.lane_prerequisite":
    "Ainda não: falta o passo anterior desta raia (validar só a arte enviada; a arte final pede a arte validada e o certificado).",
  "orderSign.error.signature_file_required":
    "Suba o contrato assinado e carimbado (PDF ou foto).",

  "purchaseOrder.sign.hint":
    "Baixe o contrato em PDF, assine, carimbe e suba o arquivo. O contrato só conclui com os dois arquivos: o da Wellmix e o do fornecedor.",
  "purchaseOrder.contract.arts": "Arte final de cada produto (com o selo)",
  "purchaseOrder.contract.artsPending": "A arte final ainda não foi enviada.",

  "purchaseOrder.settings.artDays":
    "Pedido de compra: dias da agência para a arte",
  "purchaseOrder.settings.reviewDays":
    "Pedido de compra: dias da Wellmix para validar a arte",
  "settings.error.purchase_sla_invalid":
    "Informe os prazos do pedido de compra em dias (de 1 a 365).",

  "purchaseOrder.notify.lane.supplier.subject":
    "Pedido de compra #{n}: preparação",
  "purchaseOrder.notify.lane.supplier.body":
    "Envie a faca (die cut) e a foto em alta de cada produto e confirme o MOQ e o prazo de produção.",
  "purchaseOrder.notify.lane.art.subject": "Pedido de compra #{n}: artes",
  "purchaseOrder.notify.lane.art.body":
    "Faça a arte de cada produto do pedido dentro do prazo e envie para a validação da Wellmix.",
  "purchaseOrder.notify.lane.certification.subject":
    "Pedido de compra #{n}: certificação",
  "purchaseOrder.notify.lane.certification.body":
    "Certifique os produtos do pedido e envie o certificado de cada um.",
  "purchaseOrder.notify.review.subject":
    "Pedido de compra #{n}: validar a arte",
  "purchaseOrder.notify.review.body":
    "A arte de {product} chegou: aprove ou devolva para a agência com o motivo.",
  "purchaseOrder.notify.final.subject":
    "Pedido de compra #{n}: arte final com o selo",
  "purchaseOrder.notify.final.body":
    "Arte de {product} validada e certificado emitido: aplique o selo e envie a arte final.",
};

export const en: Record<keyof typeof pt, string> = {
  "orders.origin.supplier_request": "Purchase order (supplier request)",
  "purchaseOrder.stage.PREPARATION": "Preparation, artwork and certification",
  "purchaseOrder.stageRow.PREPARATION": "Die-Cut, Artwork and Certification",
  "purchaseOrder.dieCut.title": "Die-Cut",
  "purchaseOrder.dieCut.done": "Done",
  "purchaseOrder.stage.PACKAGING": "Contract and signatures",

  "purchaseOrder.card.title": "Create purchase order",
  "purchaseOrder.card.hint":
    "Products approved with the supplier and already registered, not yet in an order. One order per supplier: tick the products, adjust the quantity and create it. The order opens the three lanes together: supplier (preparation), artwork agency and certifier.",
  "purchaseOrder.card.customer": "Buyer: {name}",
  "purchaseOrder.card.submit": "Create purchase order",
  "purchaseOrder.card.pending": "Creating…",
  "purchaseOrder.col.include": "Include",
  "purchaseOrder.col.request": "Request",
  "purchaseOrder.col.product": "Product",
  "purchaseOrder.col.price": "Negotiated price",
  "purchaseOrder.col.moq": "MOQ",
  "purchaseOrder.col.leadTime": "Lead time (days)",
  "purchaseOrder.col.quantity": "Quantity (pcs)",
  "purchaseOrder.list.order": "Open the purchase order",
  "purchaseOrder.detail.inOrder":
    "This product is in a purchase order. Open the order.",
  "purchaseOrder.detail.generate":
    "Product registered: create the purchase order in Supplier requests.",

  "purchaseOrder.error.purchase_order_choose_items":
    "Tick at least one product for the order.",
  "purchaseOrder.error.purchase_order_too_many":
    "At most 30 products per order.",
  "purchaseOrder.error.purchase_order_not_ready":
    "Only approved requests with the product registered can be ordered.",
  "purchaseOrder.error.purchase_order_taken":
    "One of the products is already in another purchase order.",
  "purchaseOrder.error.purchase_order_one_supplier":
    "An order belongs to a single supplier.",
  "purchaseOrder.error.purchase_order_currency_mixed":
    "The products in the order must be in the same currency.",
  "purchaseOrder.error.purchase_order_customer_missing":
    "Buyer not found: the Wellmix customer record with the Sankhya company code (CODEMP, today 3) is missing.",
  "purchaseOrder.error.purchase_order_qty_invalid":
    "Invalid quantity: enter the pieces (a whole number above zero).",
  "orders.error.lane_prerequisite":
    "Not yet: the previous step of this lane is missing (only submitted artwork can be reviewed; the final artwork needs the approved artwork and the certificate).",
  "orderSign.error.signature_file_required":
    "Upload the signed and stamped contract (PDF or photo).",

  "purchaseOrder.sign.hint":
    "Download the contract as PDF, sign it, stamp it and upload the file. The contract is complete only with both files: Wellmix's and the supplier's.",
  "purchaseOrder.contract.arts":
    "Final artwork of each product (with the seal)",
  "purchaseOrder.contract.artsPending":
    "The final artwork has not been sent yet.",

  "purchaseOrder.settings.artDays":
    "Purchase order: agency days for the artwork",
  "purchaseOrder.settings.reviewDays":
    "Purchase order: Wellmix days to review the artwork",
  "settings.error.purchase_sla_invalid":
    "Enter the purchase order deadlines in days (1 to 365).",

  "purchaseOrder.notify.lane.supplier.subject":
    "Purchase order #{n}: preparation",
  "purchaseOrder.notify.lane.supplier.body":
    "Send the die cut and the high-resolution photo of each product and confirm the MOQ and production lead time.",
  "purchaseOrder.notify.lane.art.subject": "Purchase order #{n}: artwork",
  "purchaseOrder.notify.lane.art.body":
    "Create the artwork for each product in the order on time and send it for Wellmix review.",
  "purchaseOrder.notify.lane.certification.subject":
    "Purchase order #{n}: certification",
  "purchaseOrder.notify.lane.certification.body":
    "Certify the products in the order and send each certificate.",
  "purchaseOrder.notify.review.subject":
    "Purchase order #{n}: review the artwork",
  "purchaseOrder.notify.review.body":
    "The artwork for {product} arrived: approve it or send it back to the agency with the reason.",
  "purchaseOrder.notify.final.subject":
    "Purchase order #{n}: final artwork with the seal",
  "purchaseOrder.notify.final.body":
    "Artwork for {product} approved and certificate issued: apply the seal and send the final artwork.",
};

export const zh: Record<keyof typeof pt, string> = {
  "orders.origin.supplier_request": "采购订单（供应商询单）",
  "purchaseOrder.stage.PREPARATION": "准备、设计与认证",
  "purchaseOrder.stageRow.PREPARATION": "刀模 (Die-Cut)、设计与认证",
  "purchaseOrder.dieCut.title": "刀模 (Die-Cut)",
  "purchaseOrder.dieCut.done": "已完成",
  "purchaseOrder.stage.PACKAGING": "合同与签署",

  "purchaseOrder.card.title": "生成采购订单",
  "purchaseOrder.card.hint":
    "已与供应商确认并已建档、尚未下单的产品。每个供应商一张订单：勾选产品、调整数量后生成。订单会同时开启三条流程：供应商（准备）、设计公司和认证机构。",
  "purchaseOrder.card.customer": "采购方：{name}",
  "purchaseOrder.card.submit": "生成采购订单",
  "purchaseOrder.card.pending": "生成中…",
  "purchaseOrder.col.include": "包含",
  "purchaseOrder.col.request": "询单",
  "purchaseOrder.col.product": "产品",
  "purchaseOrder.col.price": "议定价格",
  "purchaseOrder.col.moq": "起订量",
  "purchaseOrder.col.leadTime": "交期（天）",
  "purchaseOrder.col.quantity": "数量（件）",
  "purchaseOrder.list.order": "查看采购订单",
  "purchaseOrder.detail.inOrder": "该产品已在采购订单中。打开订单。",
  "purchaseOrder.detail.generate": "产品已建档：请在供应商询单中生成采购订单。",

  "purchaseOrder.error.purchase_order_choose_items": "请至少勾选一个产品。",
  "purchaseOrder.error.purchase_order_too_many": "每张订单最多 30 个产品。",
  "purchaseOrder.error.purchase_order_not_ready":
    "只有已批准且产品已建档的询单才能下单。",
  "purchaseOrder.error.purchase_order_taken":
    "其中一个产品已在其他采购订单中。",
  "purchaseOrder.error.purchase_order_one_supplier":
    "一张订单只能属于一个供应商。",
  "purchaseOrder.error.purchase_order_currency_mixed":
    "订单中的产品必须使用同一币种。",
  "purchaseOrder.error.purchase_order_customer_missing":
    "未找到采购方：缺少带有 Sankhya 公司代码（CODEMP，目前为 3）的 Wellmix 客户档案。",
  "purchaseOrder.error.purchase_order_qty_invalid":
    "数量无效：请填写件数（大于零的整数）。",
  "orders.error.lane_prerequisite":
    "暂不可操作：本流程的上一步尚未完成（只能审核已提交的设计稿；最终设计稿需设计稿已通过且证书已出具）。",
  "orderSign.error.signature_file_required":
    "请上传已签字盖章的合同（PDF 或照片）。",

  "purchaseOrder.sign.hint":
    "下载合同 PDF，签字盖章后上传文件。合同需双方文件齐全（Wellmix 和供应商）才算完成。",
  "purchaseOrder.contract.arts": "各产品最终设计稿（含认证标志）",
  "purchaseOrder.contract.artsPending": "最终设计稿尚未提交。",

  "purchaseOrder.settings.artDays": "采购订单：设计公司完成设计稿的天数",
  "purchaseOrder.settings.reviewDays": "采购订单：Wellmix 审核设计稿的天数",
  "settings.error.purchase_sla_invalid": "请填写采购订单期限天数（1 至 365）。",

  "purchaseOrder.notify.lane.supplier.subject": "采购订单 #{n}：准备",
  "purchaseOrder.notify.lane.supplier.body":
    "请提交每个产品的刀模图和高清照片，并确认起订量和生产交期。",
  "purchaseOrder.notify.lane.art.subject": "采购订单 #{n}：设计稿",
  "purchaseOrder.notify.lane.art.body":
    "请按期完成订单中每个产品的设计稿，并提交 Wellmix 审核。",
  "purchaseOrder.notify.lane.certification.subject": "采购订单 #{n}：认证",
  "purchaseOrder.notify.lane.certification.body":
    "请为订单中的产品进行认证，并提交每个产品的证书。",
  "purchaseOrder.notify.review.subject": "采购订单 #{n}：审核设计稿",
  "purchaseOrder.notify.review.body":
    "{product} 的设计稿已提交：请批准或附原因退回设计公司。",
  "purchaseOrder.notify.final.subject": "采购订单 #{n}：含认证标志的最终设计稿",
  "purchaseOrder.notify.final.body":
    "{product} 的设计稿已通过且证书已出具：请加上认证标志并提交最终设计稿。",
};
