/**
 * Produto da solicitação ao fornecedor aprovada (docs/SUPPLIER_REQUESTS.md,
 * "Produto"): criar ou associar, ligar os itens iguais, vitrine e Sankhya.
 * Mesmas chaves em pt, en e zh.
 */
export const pt = {
  "srProduct.title": "Produto",
  "srProduct.intro":
    "Solicitação aprovada: crie o produto com o nome correto ou associe a um que já existe, e ligue a ele os itens iguais dos bookings.",
  "srProduct.items": "Itens de booking ligados ao produto",
  "srProduct.itemsHint":
    "O escolhido sempre entra. As alternativas já vêm marcadas: desmarque as que não são o mesmo produto. Os fornecedores delas entram na lista de fornecedores do produto.",
  "srProduct.chosen": "escolhido",
  "srProduct.found": "achado na busca",
  "srProduct.searchItems": "Buscar mais itens nos bookings",
  "srProduct.searchProducts": "Buscar produto no catálogo",
  "srProduct.searchErp": "Buscar no Sankhya (descrição ou referência)",
  "srProduct.search": "Buscar",
  "srProduct.create.title": "Criar produto novo",
  "srProduct.create.name": "Nome do produto",
  "srProduct.create.line": "Linha de produto",
  "srProduct.create.hint":
    "Preço, moeda e MOQ vêm da resposta do fornecedor; medidas, caixa, material e foto vêm do item. O produto nasce fora da vitrine do cliente.",
  "srProduct.create.submit": "Criar produto",
  "srProduct.link.title": "Associar a um produto existente",
  "srProduct.link.none":
    "Busque pelo nome ou código acima para escolher o produto.",
  "srProduct.link.empty": "Nenhum produto com esse texto.",
  "srProduct.link.submit": "Associar ao produto marcado",
  "srProduct.pending": "Gravando…",
  "srProduct.done.created": "Produto criado",
  "srProduct.done.linked": "Associada a um produto existente",
  "srProduct.open": "Abrir o produto",
  "srProduct.linkedItems": "{n} itens de booking ligados",
  "srProduct.hidden": "Fora da vitrine do cliente até ser liberado.",
  "srProduct.release": "Liberar na vitrine",
  "srProduct.released": "Na vitrine desde {date}.",
  "srProduct.moreItems": "Ligar mais itens",
  "srProduct.moreSubmit": "Ligar os marcados",
  "srProduct.moreNone":
    "Busque acima por itens de outros bookings para ligar.",
  "srProduct.erp.title": "Sankhya",
  "srProduct.erp.code": "CODPROD",
  "srProduct.erp.none": "Sem código do Sankhya.",
  "srProduct.erp.checked": "CODPROD {code}, conferido no Sankhya.",
  "srProduct.erp.unchecked":
    "CODPROD {code}, não conferido no Sankhya (sem credencial ou o ERP não respondeu).",
  "srProduct.erp.use": "Usar",
  "srProduct.erp.save": "Gravar código",
  "srProduct.erp.notConfigured":
    "Sankhya sem credencial: digite o CODPROD; ele fica gravado como não conferido.",
  "srProduct.erp.error":
    "O Sankhya não respondeu ({code}). Digite o CODPROD ou tente de novo.",
  "srProduct.erp.empty": "Nenhum produto no Sankhya com esse texto.",
  "srProduct.notice.created":
    "Produto criado e itens ligados. Ele está fora da vitrine até ser liberado.",
  "srProduct.notice.linked":
    "Solicitação associada ao produto e itens ligados.",
  "srProduct.notice.items": "Itens ligados ao produto.",
  "srProduct.notice.released": "Produto liberado na vitrine.",
  "srProduct.notice.erp.checked":
    "CODPROD gravado e conferido no Sankhya.",
  "srProduct.notice.erp.unchecked":
    "CODPROD gravado sem conferir no Sankhya.",
  "srProduct.notice.erp.cleared": "CODPROD retirado do produto.",

  "supplierRequests.error.request_product_not_approved":
    "Só uma solicitação aprovada ganha produto.",
  "supplierRequests.error.request_product_exists":
    "Esta solicitação já tem produto.",
  "supplierRequests.error.request_product_name_required":
    "Informe o nome do produto.",
  "supplierRequests.error.request_product_line_invalid":
    "Escolha uma linha de produto ativa.",
  "supplierRequests.error.request_product_not_found":
    "Produto não encontrado ou inativo.",
  "supplierRequests.error.request_product_item_taken":
    "Um dos itens marcados já está ligado a outro produto. Desmarque-o.",
  "supplierRequests.error.request_product_missing":
    "Crie ou associe o produto antes.",
  "supplierRequests.error.request_product_choose":
    "Marque o produto do catálogo para associar.",
  "supplierRequests.error.request_erp_code_invalid":
    "O CODPROD é um número (até 10 dígitos).",
  "supplierRequests.error.request_erp_code_not_found":
    "Esse CODPROD não existe no Sankhya.",
};

export const en: typeof pt = {
  "srProduct.title": "Product",
  "srProduct.intro":
    "Approved request: create the product with the correct name or link it to an existing one, and link the matching booking items to it.",
  "srProduct.items": "Booking items linked to the product",
  "srProduct.itemsHint":
    "The chosen item is always included. Alternatives come checked: uncheck those that are not the same product. Their suppliers join the product's supplier list.",
  "srProduct.chosen": "chosen",
  "srProduct.found": "found in search",
  "srProduct.searchItems": "Search more items in bookings",
  "srProduct.searchProducts": "Search the catalog",
  "srProduct.searchErp": "Search Sankhya (description or reference)",
  "srProduct.search": "Search",
  "srProduct.create.title": "Create a new product",
  "srProduct.create.name": "Product name",
  "srProduct.create.line": "Product line",
  "srProduct.create.hint":
    "Price, currency and MOQ come from the supplier's answer; sizes, carton, material and photo come from the item. The product starts hidden from the customer showcase.",
  "srProduct.create.submit": "Create product",
  "srProduct.link.title": "Link to an existing product",
  "srProduct.link.none":
    "Search by name or code above to choose the product.",
  "srProduct.link.empty": "No product matches this text.",
  "srProduct.link.submit": "Link to the checked product",
  "srProduct.pending": "Saving…",
  "srProduct.done.created": "Product created",
  "srProduct.done.linked": "Linked to an existing product",
  "srProduct.open": "Open the product",
  "srProduct.linkedItems": "{n} booking items linked",
  "srProduct.hidden": "Hidden from the customer showcase until released.",
  "srProduct.release": "Release to the showcase",
  "srProduct.released": "In the showcase since {date}.",
  "srProduct.moreItems": "Link more items",
  "srProduct.moreSubmit": "Link the checked ones",
  "srProduct.moreNone":
    "Search above for items from other bookings to link.",
  "srProduct.erp.title": "Sankhya",
  "srProduct.erp.code": "CODPROD",
  "srProduct.erp.none": "No Sankhya code.",
  "srProduct.erp.checked": "CODPROD {code}, checked in Sankhya.",
  "srProduct.erp.unchecked":
    "CODPROD {code}, not checked in Sankhya (no credentials or the ERP did not answer).",
  "srProduct.erp.use": "Use",
  "srProduct.erp.save": "Save code",
  "srProduct.erp.notConfigured":
    "Sankhya has no credentials: type the CODPROD; it is saved as not checked.",
  "srProduct.erp.error":
    "Sankhya did not answer ({code}). Type the CODPROD or try again.",
  "srProduct.erp.empty": "No Sankhya product matches this text.",
  "srProduct.notice.created":
    "Product created and items linked. It stays out of the showcase until released.",
  "srProduct.notice.linked":
    "Request linked to the product and items linked.",
  "srProduct.notice.items": "Items linked to the product.",
  "srProduct.notice.released": "Product released to the showcase.",
  "srProduct.notice.erp.checked": "CODPROD saved and checked in Sankhya.",
  "srProduct.notice.erp.unchecked":
    "CODPROD saved without checking Sankhya.",
  "srProduct.notice.erp.cleared": "CODPROD removed from the product.",

  "supplierRequests.error.request_product_not_approved":
    "Only an approved request gets a product.",
  "supplierRequests.error.request_product_exists":
    "This request already has a product.",
  "supplierRequests.error.request_product_name_required":
    "Enter the product name.",
  "supplierRequests.error.request_product_line_invalid":
    "Choose an active product line.",
  "supplierRequests.error.request_product_not_found":
    "Product not found or inactive.",
  "supplierRequests.error.request_product_item_taken":
    "One of the checked items is already linked to another product. Uncheck it.",
  "supplierRequests.error.request_product_missing":
    "Create or link the product first.",
  "supplierRequests.error.request_product_choose":
    "Check the catalog product to link.",
  "supplierRequests.error.request_erp_code_invalid":
    "CODPROD is a number (up to 10 digits).",
  "supplierRequests.error.request_erp_code_not_found":
    "That CODPROD does not exist in Sankhya.",
};

export const zh: typeof pt = {
  "srProduct.title": "产品",
  "srProduct.intro":
    "询单已批准：用正确的名称创建产品或关联到已有产品，并把各 booking 中相同的条目关联到该产品。",
  "srProduct.items": "关联到产品的 booking 条目",
  "srProduct.itemsHint":
    "选中的条目总是包含在内。备选条目默认勾选：请取消勾选不是同一产品的条目。其供应商会加入产品的供应商列表。",
  "srProduct.chosen": "选中",
  "srProduct.found": "搜索结果",
  "srProduct.searchItems": "在 booking 中搜索更多条目",
  "srProduct.searchProducts": "在产品目录中搜索",
  "srProduct.searchErp": "在 Sankhya 中搜索（描述或参考号）",
  "srProduct.search": "搜索",
  "srProduct.create.title": "创建新产品",
  "srProduct.create.name": "产品名称",
  "srProduct.create.line": "产品线",
  "srProduct.create.hint":
    "价格、币种和 MOQ 来自供应商的回复；尺寸、外箱、材质和照片来自条目。产品创建后不在客户橱窗中显示。",
  "srProduct.create.submit": "创建产品",
  "srProduct.link.title": "关联到已有产品",
  "srProduct.link.none": "在上方按名称或编码搜索以选择产品。",
  "srProduct.link.empty": "没有符合此文字的产品。",
  "srProduct.link.submit": "关联到勾选的产品",
  "srProduct.pending": "正在保存…",
  "srProduct.done.created": "产品已创建",
  "srProduct.done.linked": "已关联到已有产品",
  "srProduct.open": "打开产品",
  "srProduct.linkedItems": "已关联 {n} 个 booking 条目",
  "srProduct.hidden": "在发布之前不在客户橱窗中显示。",
  "srProduct.release": "发布到橱窗",
  "srProduct.released": "自 {date} 起在橱窗中显示。",
  "srProduct.moreItems": "关联更多条目",
  "srProduct.moreSubmit": "关联勾选的条目",
  "srProduct.moreNone": "在上方搜索其他 booking 中的条目以进行关联。",
  "srProduct.erp.title": "Sankhya",
  "srProduct.erp.code": "CODPROD",
  "srProduct.erp.none": "没有 Sankhya 编码。",
  "srProduct.erp.checked": "CODPROD {code}，已在 Sankhya 中核对。",
  "srProduct.erp.unchecked":
    "CODPROD {code}，未在 Sankhya 中核对（无凭据或 ERP 未响应）。",
  "srProduct.erp.use": "使用",
  "srProduct.erp.save": "保存编码",
  "srProduct.erp.notConfigured":
    "Sankhya 未配置凭据：请输入 CODPROD，将保存为未核对。",
  "srProduct.erp.error":
    "Sankhya 未响应（{code}）。请输入 CODPROD 或重试。",
  "srProduct.erp.empty": "Sankhya 中没有符合此文字的产品。",
  "srProduct.notice.created":
    "产品已创建，条目已关联。发布前不在橱窗中显示。",
  "srProduct.notice.linked": "询单已关联到产品，条目已关联。",
  "srProduct.notice.items": "条目已关联到产品。",
  "srProduct.notice.released": "产品已发布到橱窗。",
  "srProduct.notice.erp.checked": "CODPROD 已保存并在 Sankhya 中核对。",
  "srProduct.notice.erp.unchecked":
    "CODPROD 已保存，未在 Sankhya 中核对。",
  "srProduct.notice.erp.cleared": "已从产品中移除 CODPROD。",

  "supplierRequests.error.request_product_not_approved":
    "只有已批准的询单才能关联产品。",
  "supplierRequests.error.request_product_exists": "该询单已有产品。",
  "supplierRequests.error.request_product_name_required": "请填写产品名称。",
  "supplierRequests.error.request_product_line_invalid": "请选择有效的产品线。",
  "supplierRequests.error.request_product_not_found":
    "未找到产品或产品已停用。",
  "supplierRequests.error.request_product_item_taken":
    "勾选的条目中有一个已关联到其他产品。请取消勾选。",
  "supplierRequests.error.request_product_missing": "请先创建或关联产品。",
  "supplierRequests.error.request_product_choose": "请勾选要关联的目录产品。",
  "supplierRequests.error.request_erp_code_invalid":
    "CODPROD 为数字（最多 10 位）。",
  "supplierRequests.error.request_erp_code_not_found":
    "Sankhya 中不存在该 CODPROD。",
};
