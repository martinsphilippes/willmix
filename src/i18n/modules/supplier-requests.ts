/**
 * Seleção de itens e solicitação ao fornecedor (docs/SUPPLIER_REQUESTS.md).
 * Mesmas chaves em pt, en e zh.
 */
export const pt = {
  "nav.bookingSelection": "Seleção de itens",
  "nav.supplierRequests": "Solicitações ao fornecedor",

  "supplierRequests.selection.title": "Seleção de itens",
  "supplierRequests.selection.subtitle":
    "Itens dos bookings fechados. Filtre por parte da descrição, compare os parecidos e abra a solicitação ao fornecedor do melhor.",
  "supplierRequests.selection.search": "Buscar por parte da descrição",
  "supplierRequests.selection.searchPlaceholder":
    "Ex.: copo vidro, garrafa térmica, 350",
  "supplierRequests.selection.filter": "Filtrar",
  "supplierRequests.selection.clear": "Limpar",
  "supplierRequests.selection.count": "{n} itens",
  "supplierRequests.selection.truncated":
    "Mostrando {shown} de {n} itens. Refine a busca para ver o resto.",
  "supplierRequests.selection.empty":
    "Nenhum item de booking fechado combina com a busca.",
  "supplierRequests.selection.noItems":
    "Nenhum booking fechado ainda. Feche um booking para os itens dele aparecerem aqui.",
  "supplierRequests.selection.schemaMissing":
    "As tabelas novas ainda não foram publicadas no banco (npm run appwrite:push).",
  "supplierRequests.selection.best": "Melhor preço mínimo",
  "supplierRequests.selection.similar": "ver parecidos",
  "supplierRequests.selection.inRequest": "Solicitação nº {n}",
  "supplierRequests.selection.col.choose": "Escolher",
  "supplierRequests.selection.col.alternative": "Alternativa",
  "supplierRequests.selection.col.photo": "Foto",
  "supplierRequests.selection.col.item": "Item",
  "supplierRequests.selection.col.supplier": "Fornecedor",
  "supplierRequests.selection.col.booking": "Booking",
  "supplierRequests.selection.col.price": "Preço",
  "supplierRequests.selection.col.priceUsd": "Preço (US$)",
  "supplierRequests.selection.col.moq": "MOQ",
  "supplierRequests.selection.col.box": "Qtd/caixa",
  "supplierRequests.selection.col.cbm": "CBM",
  "supplierRequests.selection.col.size": "Medidas (cm)",
  "supplierRequests.selection.col.capacity": "Capacidade (ml)",
  "supplierRequests.selection.col.material": "Material / embalagem",
  "supplierRequests.selection.col.sheetQty": "Qtd da planilha",
  "supplierRequests.selection.col.superplan": "Superplan",
  "supplierRequests.selection.col.situation": "Situação",
  "supplierRequests.selection.form.title": "Abrir solicitação ao fornecedor",
  "supplierRequests.selection.form.body":
    "Marque o item escolhido (um só) e os parecidos que ficam como alternativas. A solicitação vai ao fornecedor do item escolhido, que vê e responde no portal. As alternativas e o Superplan ficam só com a Wellmix.",
  "supplierRequests.selection.form.quantity": "Quantidade (peças)",
  "supplierRequests.selection.form.quantityHint":
    "Em branco: a quantidade da planilha do item escolhido.",
  "supplierRequests.selection.form.needs": "O que a Wellmix precisa no produto",
  "supplierRequests.selection.form.needsHint":
    "Cor, embalagem, logo, ajuste… O fornecedor lê este texto.",
  "supplierRequests.selection.form.submit": "Abrir solicitação",
  "supplierRequests.selection.form.pending": "Abrindo…",

  "supplierRequests.list.title": "Solicitações ao fornecedor",
  "supplierRequests.list.subtitle":
    "O que a Wellmix pediu aos fornecedores a partir da seleção de itens, com a resposta de cada um.",
  "supplierRequests.list.subtitleSupplier":
    "Pedidos da Wellmix para saber se você faz um item e em que condições. Abra e responda.",
  "supplierRequests.list.empty": "Nenhuma solicitação ainda.",
  "supplierRequests.list.toSelection": "Seleção de itens",
  "supplierRequests.col.number": "Nº",
  "supplierRequests.col.status": "Situação",
  "supplierRequests.col.supplier": "Fornecedor",
  "supplierRequests.col.item": "Item",
  "supplierRequests.col.quantity": "Quantidade",
  "supplierRequests.col.answer": "Resposta",
  "supplierRequests.col.createdAt": "Aberta em",
  "supplierRequests.status.open": "Aberta",
  "supplierRequests.status.answered": "Respondida",
  "supplierRequests.status.approved": "Aprovada",
  "supplierRequests.status.declined": "Recusada",
  "supplierRequests.status.cancelled": "Cancelada",
  "supplierRequests.answer.yes": "Faz: {price}",
  "supplierRequests.answer.yesNoPrice": "Faz",
  "supplierRequests.answer.no": "Não faz",
  "supplierRequests.answer.waiting": "Esperando o fornecedor",

  "supplierRequests.detail.title": "Solicitação ao fornecedor nº {n}",
  "supplierRequests.detail.back": "Voltar às solicitações",
  "supplierRequests.detail.created":
    "Solicitação aberta. O fornecedor foi avisado e responde no portal.",
  "supplierRequests.detail.answered": "Resposta registrada.",
  "supplierRequests.detail.decided.approved":
    "Solicitação aprovada. Crie o produto ou associe a um existente no bloco Produto, logo abaixo.",
  "supplierRequests.detail.decided.declined": "Solicitação recusada.",
  "supplierRequests.detail.decided.cancelled": "Solicitação cancelada.",
  "supplierRequests.detail.request": "O que a Wellmix pede",
  "supplierRequests.detail.quantity": "Quantidade",
  "supplierRequests.detail.pieces": "{n} peças",
  "supplierRequests.detail.needs": "O que a Wellmix precisa no produto",
  "supplierRequests.detail.needsNone": "Nada além do item como está.",
  "supplierRequests.detail.item": "Item",
  "supplierRequests.detail.bookingPrice": "Preço do booking",
  "supplierRequests.detail.booking": "Booking",
  "supplierRequests.detail.bookingOf": "Booking nº {n} · {file}",
  "supplierRequests.detail.supplier": "Fornecedor",
  "supplierRequests.detail.answer.title": "Resposta do fornecedor",
  "supplierRequests.detail.answer.none": "O fornecedor ainda não respondeu.",
  "supplierRequests.detail.answer.canDo": "Faz o que foi pedido?",
  "supplierRequests.detail.answer.yes": "Sim, faço",
  "supplierRequests.detail.answer.no": "Não faço",
  "supplierRequests.detail.answer.price": "Preço por peça",
  "supplierRequests.detail.answer.currency": "Moeda",
  "supplierRequests.detail.answer.moq": "Pedido mínimo (peças)",
  "supplierRequests.detail.answer.leadTime": "Prazo de produção (dias)",
  "supplierRequests.detail.answer.note": "Observação",
  "supplierRequests.detail.answer.submit": "Enviar resposta",
  "supplierRequests.detail.answer.submitWellmix":
    "Registrar a resposta do fornecedor",
  "supplierRequests.detail.answer.wellmixHint":
    "Use quando o fornecedor respondeu por fora do portal (WeChat, e-mail).",
  "supplierRequests.detail.answer.pending": "Enviando…",
  "supplierRequests.detail.answer.at": "Respondido em {date}",
  "supplierRequests.detail.answer.change":
    "Você pode mudar a resposta até a Wellmix decidir.",
  "supplierRequests.detail.decide.title": "Decisão da Wellmix",
  "supplierRequests.detail.decide.approved": "Aprovar",
  "supplierRequests.detail.decide.declined": "Recusar",
  "supplierRequests.detail.decide.cancelled": "Cancelar a solicitação",
  "supplierRequests.detail.decide.note": "Observação da decisão",
  "supplierRequests.detail.decide.at": "Decidido em {date}",
  "supplierRequests.detail.alternatives": "Alternativas ({n})",
  "supplierRequests.detail.alternativesNone": "Nenhuma alternativa guardada.",
  "supplierRequests.detail.alternativesHint":
    "Só a Wellmix vê: itens parecidos de outros bookings, para comparar ou abrir outra solicitação.",
  "supplierRequests.detail.chosenSuperplan": "Superplan do item escolhido",

  "supplierRequests.error.supplier_request_choose":
    "Marque o item escolhido antes de abrir a solicitação.",
  "supplierRequests.error.supplier_request_lot_not_closed":
    "O booking deste item não está fechado. Feche o booking antes de abrir a solicitação.",
  "supplierRequests.error.supplier_request_no_supplier":
    "O booking deste item não tem fornecedor.",
  "supplierRequests.error.supplier_invalid":
    "O fornecedor deste item está inativo ou não existe mais.",
  "supplierRequests.error.supplier_request_exists":
    "Este item já tem uma solicitação em andamento. Abra a que existe.",
  "supplierRequests.error.supplier_request_qty_required":
    "A planilha não traz quantidade para este item: digite a quantidade.",
  "supplierRequests.error.supplier_request_closed":
    "A Wellmix já decidiu esta solicitação: a resposta não muda mais.",
  "supplierRequests.error.supplier_request_price_required":
    "Informe o preço por peça para dizer que faz.",
  "supplierRequests.error.supplier_request_decision_invalid":
    "Essa decisão não vale para a situação atual da solicitação.",
  "supplierRequests.error.schema_outdated":
    "As tabelas novas ainda não foram publicadas no banco (npm run appwrite:push).",
  "supplierRequests.error.not_found": "Solicitação ou item não encontrado.",
  "supplierRequests.error.invalid_input":
    "Algum valor não dá para ler. Use números maiores que zero.",

  "supplierRequests.notify.open.subject": "Nova solicitação da Wellmix nº {n}",
  "supplierRequests.notify.open.body":
    "A Wellmix quer saber se você faz o item {code} ({qty} peças). Abra a solicitação nº {n} e responda.",
  "supplierRequests.notify.answer.subject":
    "O fornecedor respondeu a solicitação nº {n}",
  "supplierRequests.notify.answer.yes":
    "O fornecedor disse que faz. Confira as condições na solicitação nº {n} e decida.",
  "supplierRequests.notify.answer.no":
    "O fornecedor disse que não faz o pedido da solicitação nº {n}.",
  "supplierRequests.notify.approved.subject": "Solicitação nº {n} aprovada",
  "supplierRequests.notify.approved.body":
    "A Wellmix aprovou a solicitação nº {n}. Os próximos passos chegam pelo portal.",
  "supplierRequests.notify.declined.subject": "Solicitação nº {n} recusada",
  "supplierRequests.notify.declined.body":
    "A Wellmix não vai seguir com a solicitação nº {n} desta vez.",
  "supplierRequests.notify.cancelled.subject": "Solicitação nº {n} cancelada",
  "supplierRequests.notify.cancelled.body":
    "A Wellmix cancelou a solicitação nº {n}. Não é preciso responder.",
};

export const en: typeof pt = {
  "nav.bookingSelection": "Item selection",
  "nav.supplierRequests": "Supplier requests",

  "supplierRequests.selection.title": "Item selection",
  "supplierRequests.selection.subtitle":
    "Items from closed bookings. Filter by part of the description, compare similar ones and open a request to the best one's supplier.",
  "supplierRequests.selection.search": "Search by part of the description",
  "supplierRequests.selection.searchPlaceholder":
    "E.g.: glass cup, thermos, 350",
  "supplierRequests.selection.filter": "Filter",
  "supplierRequests.selection.clear": "Clear",
  "supplierRequests.selection.count": "{n} items",
  "supplierRequests.selection.truncated":
    "Showing {shown} of {n} items. Refine the search to see the rest.",
  "supplierRequests.selection.empty":
    "No item from a closed booking matches the search.",
  "supplierRequests.selection.noItems":
    "No closed booking yet. Close a booking for its items to show up here.",
  "supplierRequests.selection.schemaMissing":
    "The new tables are not published in the database yet (npm run appwrite:push).",
  "supplierRequests.selection.best": "Best minimum price",
  "supplierRequests.selection.similar": "see similar",
  "supplierRequests.selection.inRequest": "Request no. {n}",
  "supplierRequests.selection.col.choose": "Choose",
  "supplierRequests.selection.col.alternative": "Alternative",
  "supplierRequests.selection.col.photo": "Photo",
  "supplierRequests.selection.col.item": "Item",
  "supplierRequests.selection.col.supplier": "Supplier",
  "supplierRequests.selection.col.booking": "Booking",
  "supplierRequests.selection.col.price": "Price",
  "supplierRequests.selection.col.priceUsd": "Price (US$)",
  "supplierRequests.selection.col.moq": "MOQ",
  "supplierRequests.selection.col.box": "Qty/box",
  "supplierRequests.selection.col.cbm": "CBM",
  "supplierRequests.selection.col.size": "Size (cm)",
  "supplierRequests.selection.col.capacity": "Capacity (ml)",
  "supplierRequests.selection.col.material": "Material / package",
  "supplierRequests.selection.col.sheetQty": "Spreadsheet qty",
  "supplierRequests.selection.col.superplan": "Superplan",
  "supplierRequests.selection.col.situation": "Status",
  "supplierRequests.selection.form.title": "Open a supplier request",
  "supplierRequests.selection.form.body":
    "Mark the chosen item (just one) and the similar ones kept as alternatives. The request goes to the chosen item's supplier, who sees and answers it in the portal. Alternatives and Superplan stay with Wellmix only.",
  "supplierRequests.selection.form.quantity": "Quantity (pieces)",
  "supplierRequests.selection.form.quantityHint":
    "Blank: the chosen item's spreadsheet quantity.",
  "supplierRequests.selection.form.needs": "What Wellmix needs in the product",
  "supplierRequests.selection.form.needsHint":
    "Color, package, logo, adjustment… The supplier reads this text.",
  "supplierRequests.selection.form.submit": "Open request",
  "supplierRequests.selection.form.pending": "Opening…",

  "supplierRequests.list.title": "Supplier requests",
  "supplierRequests.list.subtitle":
    "What Wellmix asked suppliers from the item selection, with each answer.",
  "supplierRequests.list.subtitleSupplier":
    "Wellmix asks whether you make an item and on what terms. Open and answer.",
  "supplierRequests.list.empty": "No requests yet.",
  "supplierRequests.list.toSelection": "Item selection",
  "supplierRequests.col.number": "No.",
  "supplierRequests.col.status": "Status",
  "supplierRequests.col.supplier": "Supplier",
  "supplierRequests.col.item": "Item",
  "supplierRequests.col.quantity": "Quantity",
  "supplierRequests.col.answer": "Answer",
  "supplierRequests.col.createdAt": "Opened on",
  "supplierRequests.status.open": "Open",
  "supplierRequests.status.answered": "Answered",
  "supplierRequests.status.approved": "Approved",
  "supplierRequests.status.declined": "Declined",
  "supplierRequests.status.cancelled": "Cancelled",
  "supplierRequests.answer.yes": "Can do: {price}",
  "supplierRequests.answer.yesNoPrice": "Can do",
  "supplierRequests.answer.no": "Cannot do",
  "supplierRequests.answer.waiting": "Waiting for the supplier",

  "supplierRequests.detail.title": "Supplier request no. {n}",
  "supplierRequests.detail.back": "Back to requests",
  "supplierRequests.detail.created":
    "Request opened. The supplier was notified and answers in the portal.",
  "supplierRequests.detail.answered": "Answer recorded.",
  "supplierRequests.detail.decided.approved":
    "Request approved. Create the product or link an existing one in the Product block below.",
  "supplierRequests.detail.decided.declined": "Request declined.",
  "supplierRequests.detail.decided.cancelled": "Request cancelled.",
  "supplierRequests.detail.request": "What Wellmix asks",
  "supplierRequests.detail.quantity": "Quantity",
  "supplierRequests.detail.pieces": "{n} pieces",
  "supplierRequests.detail.needs": "What Wellmix needs in the product",
  "supplierRequests.detail.needsNone": "Nothing beyond the item as it is.",
  "supplierRequests.detail.item": "Item",
  "supplierRequests.detail.bookingPrice": "Booking price",
  "supplierRequests.detail.booking": "Booking",
  "supplierRequests.detail.bookingOf": "Booking no. {n} · {file}",
  "supplierRequests.detail.supplier": "Supplier",
  "supplierRequests.detail.answer.title": "Supplier's answer",
  "supplierRequests.detail.answer.none": "The supplier has not answered yet.",
  "supplierRequests.detail.answer.canDo": "Can you do what was asked?",
  "supplierRequests.detail.answer.yes": "Yes, I can",
  "supplierRequests.detail.answer.no": "No, I can't",
  "supplierRequests.detail.answer.price": "Price per piece",
  "supplierRequests.detail.answer.currency": "Currency",
  "supplierRequests.detail.answer.moq": "Minimum order (pieces)",
  "supplierRequests.detail.answer.leadTime": "Production lead time (days)",
  "supplierRequests.detail.answer.note": "Note",
  "supplierRequests.detail.answer.submit": "Send answer",
  "supplierRequests.detail.answer.submitWellmix":
    "Record the supplier's answer",
  "supplierRequests.detail.answer.wellmixHint":
    "Use when the supplier answered outside the portal (WeChat, e-mail).",
  "supplierRequests.detail.answer.pending": "Sending…",
  "supplierRequests.detail.answer.at": "Answered on {date}",
  "supplierRequests.detail.answer.change":
    "You can change the answer until Wellmix decides.",
  "supplierRequests.detail.decide.title": "Wellmix decision",
  "supplierRequests.detail.decide.approved": "Approve",
  "supplierRequests.detail.decide.declined": "Decline",
  "supplierRequests.detail.decide.cancelled": "Cancel the request",
  "supplierRequests.detail.decide.note": "Decision note",
  "supplierRequests.detail.decide.at": "Decided on {date}",
  "supplierRequests.detail.alternatives": "Alternatives ({n})",
  "supplierRequests.detail.alternativesNone": "No alternatives kept.",
  "supplierRequests.detail.alternativesHint":
    "Wellmix only: similar items from other bookings, to compare or open another request.",
  "supplierRequests.detail.chosenSuperplan": "Superplan of the chosen item",

  "supplierRequests.error.supplier_request_choose":
    "Mark the chosen item before opening the request.",
  "supplierRequests.error.supplier_request_lot_not_closed":
    "This item's booking is not closed. Close the booking before opening the request.",
  "supplierRequests.error.supplier_request_no_supplier":
    "This item's booking has no supplier.",
  "supplierRequests.error.supplier_invalid":
    "This item's supplier is inactive or no longer exists.",
  "supplierRequests.error.supplier_request_exists":
    "This item already has a request in progress. Open the existing one.",
  "supplierRequests.error.supplier_request_qty_required":
    "The spreadsheet has no quantity for this item: type the quantity.",
  "supplierRequests.error.supplier_request_closed":
    "Wellmix has already decided this request: the answer no longer changes.",
  "supplierRequests.error.supplier_request_price_required":
    "Enter the price per piece to say you can do it.",
  "supplierRequests.error.supplier_request_decision_invalid":
    "That decision does not apply to the request's current status.",
  "supplierRequests.error.schema_outdated":
    "The new tables are not published in the database yet (npm run appwrite:push).",
  "supplierRequests.error.not_found": "Request or item not found.",
  "supplierRequests.error.invalid_input":
    "Some value cannot be read. Use numbers above zero.",

  "supplierRequests.notify.open.subject": "New Wellmix request no. {n}",
  "supplierRequests.notify.open.body":
    "Wellmix wants to know whether you make item {code} ({qty} pieces). Open request no. {n} and answer.",
  "supplierRequests.notify.answer.subject":
    "The supplier answered request no. {n}",
  "supplierRequests.notify.answer.yes":
    "The supplier said they can do it. Check the terms in request no. {n} and decide.",
  "supplierRequests.notify.answer.no":
    "The supplier said they cannot do request no. {n}.",
  "supplierRequests.notify.approved.subject": "Request no. {n} approved",
  "supplierRequests.notify.approved.body":
    "Wellmix approved request no. {n}. Next steps will come through the portal.",
  "supplierRequests.notify.declined.subject": "Request no. {n} declined",
  "supplierRequests.notify.declined.body":
    "Wellmix will not move forward with request no. {n} this time.",
  "supplierRequests.notify.cancelled.subject": "Request no. {n} cancelled",
  "supplierRequests.notify.cancelled.body":
    "Wellmix cancelled request no. {n}. No answer is needed.",
};

export const zh: typeof pt = {
  "nav.bookingSelection": "条目筛选",
  "nav.supplierRequests": "供应商询单",

  "supplierRequests.selection.title": "条目筛选",
  "supplierRequests.selection.subtitle":
    "已关闭 booking 的条目。按描述的一部分筛选，比较相似条目，并向最佳条目的供应商发起询单。",
  "supplierRequests.selection.search": "按描述的一部分搜索",
  "supplierRequests.selection.searchPlaceholder": "例如：玻璃杯、保温瓶、350",
  "supplierRequests.selection.filter": "筛选",
  "supplierRequests.selection.clear": "清除",
  "supplierRequests.selection.count": "{n} 个条目",
  "supplierRequests.selection.truncated":
    "显示 {n} 个中的 {shown} 个。请细化搜索以查看其余条目。",
  "supplierRequests.selection.empty": "没有已关闭 booking 的条目符合搜索。",
  "supplierRequests.selection.noItems":
    "还没有已关闭的 booking。关闭一个 booking 后其条目会出现在这里。",
  "supplierRequests.selection.schemaMissing":
    "新数据表尚未发布到数据库（npm run appwrite:push）。",
  "supplierRequests.selection.best": "最低价最优",
  "supplierRequests.selection.similar": "查看相似",
  "supplierRequests.selection.inRequest": "询单第 {n} 号",
  "supplierRequests.selection.col.choose": "选择",
  "supplierRequests.selection.col.alternative": "备选",
  "supplierRequests.selection.col.photo": "照片",
  "supplierRequests.selection.col.item": "条目",
  "supplierRequests.selection.col.supplier": "供应商",
  "supplierRequests.selection.col.booking": "Booking",
  "supplierRequests.selection.col.price": "价格",
  "supplierRequests.selection.col.priceUsd": "价格（US$）",
  "supplierRequests.selection.col.moq": "MOQ",
  "supplierRequests.selection.col.box": "每箱数量",
  "supplierRequests.selection.col.cbm": "CBM",
  "supplierRequests.selection.col.size": "尺寸（cm）",
  "supplierRequests.selection.col.capacity": "容量（ml）",
  "supplierRequests.selection.col.material": "材质 / 包装",
  "supplierRequests.selection.col.sheetQty": "表格数量",
  "supplierRequests.selection.col.superplan": "Superplan",
  "supplierRequests.selection.col.situation": "状态",
  "supplierRequests.selection.form.title": "向供应商发起询单",
  "supplierRequests.selection.form.body":
    "勾选选中的条目（仅一个）以及作为备选的相似条目。询单发给选中条目的供应商，供应商在门户中查看并回复。备选条目和 Superplan 仅 Wellmix 可见。",
  "supplierRequests.selection.form.quantity": "数量（件）",
  "supplierRequests.selection.form.quantityHint":
    "留空：使用选中条目的表格数量。",
  "supplierRequests.selection.form.needs": "Wellmix 对产品的要求",
  "supplierRequests.selection.form.needsHint":
    "颜色、包装、标志、调整……供应商会阅读这段文字。",
  "supplierRequests.selection.form.submit": "发起询单",
  "supplierRequests.selection.form.pending": "正在发起…",

  "supplierRequests.list.title": "供应商询单",
  "supplierRequests.list.subtitle":
    "Wellmix 根据条目筛选向供应商提出的询单，以及每个供应商的回复。",
  "supplierRequests.list.subtitleSupplier":
    "Wellmix 想了解您是否能生产某个条目以及条件。请打开并回复。",
  "supplierRequests.list.empty": "还没有询单。",
  "supplierRequests.list.toSelection": "条目筛选",
  "supplierRequests.col.number": "编号",
  "supplierRequests.col.status": "状态",
  "supplierRequests.col.supplier": "供应商",
  "supplierRequests.col.item": "条目",
  "supplierRequests.col.quantity": "数量",
  "supplierRequests.col.answer": "回复",
  "supplierRequests.col.createdAt": "发起日期",
  "supplierRequests.status.open": "待回复",
  "supplierRequests.status.answered": "已回复",
  "supplierRequests.status.approved": "已批准",
  "supplierRequests.status.declined": "已拒绝",
  "supplierRequests.status.cancelled": "已取消",
  "supplierRequests.answer.yes": "可以生产：{price}",
  "supplierRequests.answer.yesNoPrice": "可以生产",
  "supplierRequests.answer.no": "无法生产",
  "supplierRequests.answer.waiting": "等待供应商",

  "supplierRequests.detail.title": "供应商询单第 {n} 号",
  "supplierRequests.detail.back": "返回询单列表",
  "supplierRequests.detail.created":
    "询单已发起。已通知供应商，供应商在门户中回复。",
  "supplierRequests.detail.answered": "回复已记录。",
  "supplierRequests.detail.decided.approved":
    "询单已批准。请在下方“产品”区域创建产品或关联到已有产品。",
  "supplierRequests.detail.decided.declined": "询单已拒绝。",
  "supplierRequests.detail.decided.cancelled": "询单已取消。",
  "supplierRequests.detail.request": "Wellmix 的要求",
  "supplierRequests.detail.quantity": "数量",
  "supplierRequests.detail.pieces": "{n} 件",
  "supplierRequests.detail.needs": "Wellmix 对产品的要求",
  "supplierRequests.detail.needsNone": "按条目现状即可，无其他要求。",
  "supplierRequests.detail.item": "条目",
  "supplierRequests.detail.bookingPrice": "Booking 价格",
  "supplierRequests.detail.booking": "Booking",
  "supplierRequests.detail.bookingOf": "Booking 第 {n} 号 · {file}",
  "supplierRequests.detail.supplier": "供应商",
  "supplierRequests.detail.answer.title": "供应商回复",
  "supplierRequests.detail.answer.none": "供应商尚未回复。",
  "supplierRequests.detail.answer.canDo": "能否按要求生产？",
  "supplierRequests.detail.answer.yes": "可以",
  "supplierRequests.detail.answer.no": "不可以",
  "supplierRequests.detail.answer.price": "单价",
  "supplierRequests.detail.answer.currency": "币种",
  "supplierRequests.detail.answer.moq": "最小起订量（件）",
  "supplierRequests.detail.answer.leadTime": "生产周期（天）",
  "supplierRequests.detail.answer.note": "备注",
  "supplierRequests.detail.answer.submit": "发送回复",
  "supplierRequests.detail.answer.submitWellmix": "记录供应商的回复",
  "supplierRequests.detail.answer.wellmixHint":
    "供应商在门户之外（微信、邮件）回复时使用。",
  "supplierRequests.detail.answer.pending": "正在发送…",
  "supplierRequests.detail.answer.at": "回复于 {date}",
  "supplierRequests.detail.answer.change":
    "在 Wellmix 决定之前，您可以修改回复。",
  "supplierRequests.detail.decide.title": "Wellmix 的决定",
  "supplierRequests.detail.decide.approved": "批准",
  "supplierRequests.detail.decide.declined": "拒绝",
  "supplierRequests.detail.decide.cancelled": "取消询单",
  "supplierRequests.detail.decide.note": "决定备注",
  "supplierRequests.detail.decide.at": "决定于 {date}",
  "supplierRequests.detail.alternatives": "备选（{n}）",
  "supplierRequests.detail.alternativesNone": "未保存备选条目。",
  "supplierRequests.detail.alternativesHint":
    "仅 Wellmix 可见：其他 booking 中的相似条目，用于比较或另行发起询单。",
  "supplierRequests.detail.chosenSuperplan": "选中条目的 Superplan",

  "supplierRequests.error.supplier_request_choose":
    "发起询单前请勾选选中的条目。",
  "supplierRequests.error.supplier_request_lot_not_closed":
    "该条目的 booking 尚未关闭。请先关闭 booking 再发起询单。",
  "supplierRequests.error.supplier_request_no_supplier":
    "该条目的 booking 没有供应商。",
  "supplierRequests.error.supplier_invalid": "该条目的供应商已停用或不存在。",
  "supplierRequests.error.supplier_request_exists":
    "该条目已有进行中的询单。请打开现有询单。",
  "supplierRequests.error.supplier_request_qty_required":
    "表格中没有该条目的数量：请输入数量。",
  "supplierRequests.error.supplier_request_closed":
    "Wellmix 已对该询单作出决定：回复不能再修改。",
  "supplierRequests.error.supplier_request_price_required":
    "如能生产，请填写单价。",
  "supplierRequests.error.supplier_request_decision_invalid":
    "该决定不适用于询单的当前状态。",
  "supplierRequests.error.schema_outdated":
    "新数据表尚未发布到数据库（npm run appwrite:push）。",
  "supplierRequests.error.not_found": "未找到询单或条目。",
  "supplierRequests.error.invalid_input":
    "有数值无法读取。请使用大于零的数字。",

  "supplierRequests.notify.open.subject": "Wellmix 新询单第 {n} 号",
  "supplierRequests.notify.open.body":
    "Wellmix 想了解您是否能生产条目 {code}（{qty} 件）。请打开询单第 {n} 号并回复。",
  "supplierRequests.notify.answer.subject": "供应商已回复询单第 {n} 号",
  "supplierRequests.notify.answer.yes":
    "供应商表示可以生产。请在询单第 {n} 号中核对条件并作出决定。",
  "supplierRequests.notify.answer.no":
    "供应商表示无法满足询单第 {n} 号的要求。",
  "supplierRequests.notify.approved.subject": "询单第 {n} 号已批准",
  "supplierRequests.notify.approved.body":
    "Wellmix 已批准询单第 {n} 号。后续步骤将通过门户通知。",
  "supplierRequests.notify.declined.subject": "询单第 {n} 号已拒绝",
  "supplierRequests.notify.declined.body":
    "Wellmix 这次不会继续询单第 {n} 号。",
  "supplierRequests.notify.cancelled.subject": "询单第 {n} 号已取消",
  "supplierRequests.notify.cancelled.body":
    "Wellmix 已取消询单第 {n} 号。无需回复。",
};
