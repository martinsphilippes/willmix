/**
 * Dicionário do módulo "request-batch" (vários produtos numa solicitação só;
 * cada produto vira uma solicitação do mesmo lote): mesmas chaves em pt, en e zh.
 */
export const pt = {
  "reqBatch.inOrder": "Produtos no pedido",
  "reqBatch.inOrderHint": "Os produtos já preenchidos ficam recolhidos aqui. Abra um para revisar ou completar.",
  "reqBatch.expand": "Abrir",
  "reqBatch.collapse": "Recolher",
  "reqBatch.colProduct": "Produto",
  "reqBatch.colVariant": "Variação",
  "reqBatch.colQuantity": "Quantidade",
  "reqBatch.colStatus": "Preenchimento",
  "reqBatch.complete": "Completo",
  "reqBatch.incomplete": "Incompleto",
  "reqBatch.incompleteHint": "Faltam dados neste produto: abra para completar antes de enviar.",
  "reqBatch.outside": "Fora do catálogo",
  "reqBatch.noProduct": "Produto não escolhido",
  "reqBatch.products": "Produtos",
  "reqBatch.productN": "Produto {n}",
  "reqBatch.add": "Adicionar outro produto",
  "reqBatch.remove": "Remover",
  "reqBatch.hint":
    "Pode pedir vários produtos de uma vez. Cada produto vira uma solicitação própria (fornecedor, preço e ficha podem ser diferentes), e todas nascem juntas, num lote.",
  "reqBatch.created": "{n} solicitações criadas num lote.",
  "reqBatch.createdOne": "Solicitação enviada.",
  "reqBatch.badge": "Lote · {n} produtos",
  "reqBatch.filter": "Mostrando só o lote ({n} produtos).",
  "reqBatch.all": "Ver todas",
  "reqBatch.siblings": "Faz parte de um lote com {n} produtos. Os outros:",
  "reqBatch.title": "Solicitação com {n} produtos",
  "reqBatch.count": "{n} produtos",
  "reqBatch.pageHint":
    "Os produtos foram pedidos juntos. Cada um segue com a própria cotação, fornecedor e pedido: abra um produto para ver os detalhes.",
  "reqBatch.viewBatch": "Ver o lote completo",
  "reqBatch.selectBatch": "Selecionar os produtos do lote",
  "reqBatch.deleteAll": "Excluir o lote",
  "reqBatch.deleteAllConfirm":
    "Excluir os produtos deste lote que ainda não viraram pedido? Os que já viraram pedido continuam.",
  "reqBatch.col.photo": "Foto",
  "reqBatch.col.perBox": "Peças por caixa",
  "reqBatch.col.boxes": "Caixas",
  "reqBatch.col.rounds": "Programações",
  "reqBatch.summary": "{products} produto(s) · {rounds} programação(ões) · containers por programação: {containers}",
  "reqBatch.openProduct": "Abrir o produto neste pedido",
  "reqBatch.chatProduct": "Conversar sobre este produto neste pedido",
  "reqBatch.backToOrder": "← Voltar ao pedido",
  "reqBatch.order": "Pedido #{n}",
  "requests.numberShort": "Nº",
  "requests.numbered": "Solicitação nº {n}",
  "reqBatch.titleNumbered": "Solicitação nº {number} · {n} produtos",
  "reqBatch.quotes": "Cotações",
  "reqBatch.quotesCount": "{answered} de {invited} responderam",
  "reqBatch.rfqTitle": "Abrir RFQ do lote",
  "reqBatch.rfqWholeBatch": "Abrir a RFQ do lote inteiro ({n} produtos) →",
  "reqBatch.rfqHint":
    "A RFQ sai de uma vez para os {n} produtos do lote ainda em cotação. Cada fornecedor recebe um aviso só, com todos os produtos, e responde produto a produto.",
  "reqBatch.rfqSubmit": "Abrir RFQ para {n} produtos",
  "reqBatch.rfqDone": "RFQ aberta para {n} produtos do lote.",
  "reqBatch.rfqHintOne":
    "A RFQ sai para o único produto do lote ainda em cotação. Cada fornecedor recebe um aviso.",
  "reqBatch.rfqSubmitOne": "Abrir RFQ para 1 produto",
  "reqBatch.rfqDoneOne": "RFQ aberta para 1 produto do lote.",
  "reqBatch.rfqNoSuppliers":
    "Nenhum fornecedor ativo cadastrado. Cadastre ou ative um fornecedor para abrir a RFQ.",
  "reqBatch.rfqNoSuppliersLink": "Ver fornecedores →",
  "reqBatch.rfqSupplies": "fornece {n} dos produtos",
  "reqBatch.rfqInvited": "já convidado em todos",
  "reqBatch.rfqPartial": "convidado em {n}",
  "reqBatch.error.no_suppliers": "Escolha pelo menos um fornecedor.",
  "reqBatch.error.invalid_supplier":
    "Um dos fornecedores escolhidos não está cadastrado como fornecedor.",
  "reqBatch.error.invalid_status":
    "Nenhum produto deste lote está mais em cotação.",
  "reqBatch.error.no_products": "Informe ao menos um produto.",
  "reqBatch.error.invalid_input":
    "Confira os produtos: nome, descrição e quantidade são obrigatórios.",
  "reqBatch.error.too_many_products":
    "São no máximo 30 produtos por solicitação. Envie o restante em outra.",
  "reqBatch.error.schema_outdated":
    "O banco ainda não tem a coluna do lote. Publique o esquema Appwrite (GitHub → Publicar esquema Appwrite) e envie de novo, ou envie um produto por vez.",
  "reqBatch.error.mime":
    "Um dos anexos tem um tipo de arquivo não aceito. Use JPG, PNG, WebP, HEIC ou PDF.",
  "reqBatch.error.too_large": "Um dos anexos é grande demais (máx. 50 MB).",
  "reqBatch.error.empty": "Um dos anexos está vazio.",
  "reqBatch.error.after_create":
    "As solicitações foram criadas, mas uma etapa seguinte falhou (anexo, foto da busca ou programação). Abra a solicitação e confira os anexos.",
  "reqBatch.error.below_moq":
    "Quantidade abaixo do pedido mínimo do produto. Use pelo menos o mínimo cadastrado (a tela mostra o valor).",
  "reqBatch.error.variant_required": "Escolha a variação do produto.",
  "reqBatch.error.variant_invalid":
    "A variação escolhida não é deste produto ou está desativada.",
  "reqBatch.error.product_unavailable":
    "Um dos produtos escolhidos não está disponível no catálogo. Escolha outro produto ou peça como produto fora do catálogo.",
  // Totais da encomenda (dono, 18/11/2026): a mesma conta da lista.
  "reqBatch.col.pieces": "Peças (UN)",
  "reqBatch.col.inner": "Inner (CX)",
  "reqBatch.col.cbm": "CBM (m³)",
  "reqBatch.col.moq": "MOQ (UN)",
  "reqBatch.col.price": "Preço previsto",
  "reqBatch.totals": "Totais da encomenda",
  "reqBatch.price.hint":
    "{price} por peça × {pieces} peças: a cotação V2 do Sankhya gravada no envio ({date})",
  "reqBatch.boxes.rounds": "Por programação: {list}",
  "reqBatch.cbm.otherBox":
    "O CBM cadastrado é de uma caixa de {qty} peças, e a conta usa caixas de {perBox}: fica de fora",
};

export const en: Record<keyof typeof pt, string> = {
  "reqBatch.inOrder": "Products in the order",
  "reqBatch.inOrderHint": "Products already filled in are collapsed here. Open one to review or complete it.",
  "reqBatch.expand": "Open",
  "reqBatch.collapse": "Collapse",
  "reqBatch.colProduct": "Product",
  "reqBatch.colVariant": "Variant",
  "reqBatch.colQuantity": "Quantity",
  "reqBatch.colStatus": "Completion",
  "reqBatch.complete": "Complete",
  "reqBatch.incomplete": "Incomplete",
  "reqBatch.incompleteHint": "This product is missing data: open it and complete before sending.",
  "reqBatch.outside": "Not in catalog",
  "reqBatch.noProduct": "No product chosen",
  "reqBatch.products": "Products",
  "reqBatch.productN": "Product {n}",
  "reqBatch.add": "Add another product",
  "reqBatch.remove": "Remove",
  "reqBatch.hint":
    "You can request several products at once. Each product becomes its own request (supplier, price and sheet may differ), and they are created together as a batch.",
  "reqBatch.created": "{n} requests created as a batch.",
  "reqBatch.createdOne": "Request sent.",
  "reqBatch.badge": "Batch · {n} products",
  "reqBatch.filter": "Showing only this batch ({n} products).",
  "reqBatch.all": "Show all",
  "reqBatch.siblings": "Part of a batch with {n} products. The others:",
  "reqBatch.title": "Request with {n} products",
  "reqBatch.count": "{n} products",
  "reqBatch.pageHint":
    "These products were requested together. Each one has its own quotation, supplier and order: open a product to see the details.",
  "reqBatch.viewBatch": "See the whole batch",
  "reqBatch.selectBatch": "Select the batch products",
  "reqBatch.deleteAll": "Delete the batch",
  "reqBatch.deleteAllConfirm":
    "Delete the products of this batch that have not become orders yet? Those already ordered stay.",
  "reqBatch.col.photo": "Photo",
  "reqBatch.col.perBox": "Pieces per carton",
  "reqBatch.col.boxes": "Cartons",
  "reqBatch.col.rounds": "Deliveries",
  "reqBatch.summary": "{products} product(s) · {rounds} delivery(ies) · containers per delivery: {containers}",
  "reqBatch.openProduct": "Open the product in this order",
  "reqBatch.chatProduct": "Talk about this product in this order",
  "reqBatch.backToOrder": "← Back to the order",
  "reqBatch.order": "Order #{n}",
  "requests.numberShort": "No.",
  "requests.numbered": "Request no. {n}",
  "reqBatch.titleNumbered": "Request no. {number} · {n} products",
  "reqBatch.quotes": "Quotes",
  "reqBatch.quotesCount": "{answered} of {invited} answered",
  "reqBatch.rfqTitle": "Open RFQ for the batch",
  "reqBatch.rfqWholeBatch": "Open the RFQ for the whole batch ({n} products) →",
  "reqBatch.rfqHint":
    "The RFQ goes out at once for the {n} batch products still being quoted. Each supplier gets a single notice with all products and answers product by product.",
  "reqBatch.rfqSubmit": "Open RFQ for {n} products",
  "reqBatch.rfqDone": "RFQ opened for {n} products of the batch.",
  "reqBatch.rfqHintOne":
    "The RFQ goes out for the only batch product still being quoted. Each supplier gets a notice.",
  "reqBatch.rfqSubmitOne": "Open RFQ for 1 product",
  "reqBatch.rfqDoneOne": "RFQ opened for 1 product of the batch.",
  "reqBatch.rfqNoSuppliers":
    "No active supplier registered. Register or activate a supplier to open the RFQ.",
  "reqBatch.rfqNoSuppliersLink": "See suppliers →",
  "reqBatch.rfqSupplies": "supplies {n} of the products",
  "reqBatch.rfqInvited": "already invited for all",
  "reqBatch.rfqPartial": "invited for {n}",
  "reqBatch.error.no_suppliers": "Choose at least one supplier.",
  "reqBatch.error.invalid_supplier":
    "One of the chosen suppliers is not registered as a supplier.",
  "reqBatch.error.invalid_status":
    "No product of this batch is still being quoted.",
  "reqBatch.error.no_products": "Enter at least one product.",
  "reqBatch.error.invalid_input":
    "Check the products: name, description and quantity are required.",
  "reqBatch.error.too_many_products":
    "At most 30 products per request. Send the rest in another one.",
  "reqBatch.error.schema_outdated":
    "The database does not have the batch column yet. Publish the Appwrite schema (GitHub → Publicar esquema Appwrite) and send again, or send one product at a time.",
  "reqBatch.error.mime":
    "One of the attachments has a file type that is not accepted. Use JPG, PNG, WebP, HEIC or PDF.",
  "reqBatch.error.too_large":
    "One of the attachments is too large (max 50 MB).",
  "reqBatch.error.empty": "One of the attachments is empty.",
  "reqBatch.error.after_create":
    "The requests were created, but a later step failed (attachment, lookup photo or schedule). Open the request and check the attachments.",
  "reqBatch.error.below_moq":
    "Quantity below the product's minimum order. Use at least the registered minimum (shown on the form).",
  "reqBatch.error.variant_required": "Choose the product variation.",
  "reqBatch.error.variant_invalid":
    "The chosen variation does not belong to this product or is deactivated.",
  "reqBatch.error.product_unavailable":
    "One of the chosen products is not available in the catalog. Choose another product or request it as a product outside the catalog.",
  "reqBatch.col.pieces": "Pieces (PCS)",
  "reqBatch.col.inner": "Inner (CTN)",
  "reqBatch.col.cbm": "CBM (m³)",
  "reqBatch.col.moq": "MOQ (PCS)",
  "reqBatch.col.price": "Expected price",
  "reqBatch.totals": "Order totals",
  "reqBatch.price.hint":
    "{price} per piece × {pieces} pieces: the Sankhya V2 quote saved on sending ({date})",
  "reqBatch.boxes.rounds": "Per delivery: {list}",
  "reqBatch.cbm.otherBox":
    "The recorded CBM is for a carton of {qty} pieces, but the count uses cartons of {perBox}: left out",
};

export const zh: Record<keyof typeof pt, string> = {
  "reqBatch.inOrder": "订单中的产品",
  "reqBatch.inOrderHint": "已填写的产品在此收起。展开即可检查或补充。",
  "reqBatch.expand": "展开",
  "reqBatch.collapse": "收起",
  "reqBatch.colProduct": "产品",
  "reqBatch.colVariant": "规格",
  "reqBatch.colQuantity": "数量",
  "reqBatch.colStatus": "填写情况",
  "reqBatch.complete": "完整",
  "reqBatch.incomplete": "不完整",
  "reqBatch.incompleteHint": "此产品缺少数据：请展开并在发送前补全。",
  "reqBatch.outside": "非目录产品",
  "reqBatch.noProduct": "未选择产品",
  "reqBatch.products": "产品",
  "reqBatch.productN": "产品 {n}",
  "reqBatch.add": "添加另一个产品",
  "reqBatch.remove": "移除",
  "reqBatch.hint":
    "可以一次申请多个产品。每个产品会成为独立的需求（供应商、价格和采购单可以不同），并作为同一批次一起创建。",
  "reqBatch.created": "已创建 {n} 个需求（同一批次）。",
  "reqBatch.createdOne": "需求已发送。",
  "reqBatch.badge": "批次 · {n} 个产品",
  "reqBatch.filter": "仅显示该批次（{n} 个产品）。",
  "reqBatch.all": "查看全部",
  "reqBatch.siblings": "属于一个包含 {n} 个产品的批次。其他产品：",
  "reqBatch.title": "包含 {n} 个产品的需求",
  "reqBatch.count": "{n} 个产品",
  "reqBatch.pageHint":
    "这些产品是一起提交的。每个产品都有自己的报价、供应商和订单：打开产品查看详情。",
  "reqBatch.viewBatch": "查看整个批次",
  "reqBatch.selectBatch": "选择批次中的产品",
  "reqBatch.deleteAll": "删除整个批次",
  "reqBatch.deleteAllConfirm":
    "删除此批次中尚未生成订单的产品？已生成订单的产品保留。",
  "reqBatch.col.photo": "照片",
  "reqBatch.col.perBox": "每箱件数",
  "reqBatch.col.boxes": "箱数",
  "reqBatch.col.rounds": "交货批次",
  "reqBatch.summary": "{products} 个产品 · {rounds} 个批次 · 每批集装箱：{containers}",
  "reqBatch.openProduct": "打开此订单中的产品",
  "reqBatch.chatProduct": "讨论此订单中的这个产品",
  "reqBatch.backToOrder": "← 返回订单",
  "reqBatch.order": "订单 #{n}",
  "requests.numberShort": "编号",
  "requests.numbered": "需求编号 {n}",
  "reqBatch.titleNumbered": "需求编号 {number} · {n} 个产品",
  "reqBatch.quotes": "报价",
  "reqBatch.quotesCount": "{invited} 个中 {answered} 个已回复",
  "reqBatch.rfqTitle": "为整个批次发起询价",
  "reqBatch.rfqWholeBatch": "为整个批次（{n} 个产品）发起询价 →",
  "reqBatch.rfqHint":
    "一次性向批次中仍在报价阶段的 {n} 个产品发起询价。每个供应商只收到一条包含所有产品的通知，并逐个产品报价。",
  "reqBatch.rfqSubmit": "为 {n} 个产品发起询价",
  "reqBatch.rfqDone": "已为批次中的 {n} 个产品发起询价。",
  "reqBatch.rfqHintOne":
    "询价发给批次中唯一仍在报价阶段的产品。每个供应商都会收到通知。",
  "reqBatch.rfqSubmitOne": "为 1 个产品发起询价",
  "reqBatch.rfqDoneOne": "已为批次中的 1 个产品发起询价。",
  "reqBatch.rfqNoSuppliers":
    "没有已启用的供应商。请先登记或启用供应商再发起询价。",
  "reqBatch.rfqNoSuppliersLink": "查看供应商 →",
  "reqBatch.rfqSupplies": "供应其中 {n} 个产品",
  "reqBatch.rfqInvited": "已邀请全部产品",
  "reqBatch.rfqPartial": "已邀请 {n} 个",
  "reqBatch.error.no_suppliers": "请至少选择一个供应商。",
  "reqBatch.error.invalid_supplier": "所选供应商中有未登记为供应商的。",
  "reqBatch.error.invalid_status": "此批次中已没有处于报价阶段的产品。",
  "reqBatch.error.no_products": "请至少填写一个产品。",
  "reqBatch.error.invalid_input": "请检查产品：名称、描述和数量为必填项。",
  "reqBatch.error.too_many_products":
    "每次需求最多 30 个产品，其余请另行提交。",
  "reqBatch.error.schema_outdated":
    "数据库尚无批次字段。请先发布 Appwrite 架构（GitHub → Publicar esquema Appwrite）后重新提交，或每次只提交一个产品。",
  "reqBatch.error.mime":
    "有附件的文件类型不被接受。请使用 JPG、PNG、WebP、HEIC 或 PDF。",
  "reqBatch.error.too_large": "有附件过大（最大 50 MB）。",
  "reqBatch.error.empty": "有附件为空。",
  "reqBatch.error.after_create":
    "需求已创建，但后续步骤失败（附件、搜索图片或采购计划）。请打开需求并检查附件。",
  "reqBatch.error.below_moq":
    "数量低于该产品的起订量。请至少填写档案中的起订量（表单中有显示）。",
  "reqBatch.error.variant_required": "请选择产品款式。",
  "reqBatch.error.variant_invalid": "所选款式不属于该产品或已停用。",
  "reqBatch.error.product_unavailable":
    "所选产品中有一个不在目录中。请选择其他产品，或按目录外产品提交申请。",
  "reqBatch.col.pieces": "件数（件）",
  "reqBatch.col.inner": "内盒（箱）",
  "reqBatch.col.cbm": "体积（m³）",
  "reqBatch.col.moq": "起订量（件）",
  "reqBatch.col.price": "预计价格",
  "reqBatch.totals": "订单合计",
  "reqBatch.price.hint":
    "每件 {price} × {pieces} 件：提交时保存的 Sankhya V2 报价（{date}）",
  "reqBatch.boxes.rounds": "每批：{list}",
  "reqBatch.cbm.otherBox": "已登记的体积是每箱 {qty} 件的外箱，而计算用每箱 {perBox} 件：不计入",
};
