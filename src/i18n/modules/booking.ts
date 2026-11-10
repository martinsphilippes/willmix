/**
 * Dicionário do módulo "booking" (docs/BOOKING.md): os produtos que chegaram
 * pela ficha técnica, antes de virar solicitação. Etapas, colunas, filtros,
 * ações e recusas. Mesmas chaves em pt, en e zh. Os textos só da tela
 * (rótulos de apoio) ficam em booking-screen.ts.
 */
export const pt = {
  "nav.booking": "Booking",
  "booking.title": "Booking",
  "booking.subtitle":
    "Produtos que chegaram pela ficha técnica, antes de virar solicitação: análise, aprovação, oferta, reserva e pedido.",
  "booking.status.new": "Novo",
  "booking.status.analysis": "Em análise",
  "booking.status.approved": "Aprovado",
  "booking.status.offered": "Oferecido ao cliente",
  "booking.status.reserved": "Reservado pelo cliente",
  "booking.status.requested": "Virou solicitação",
  "booking.status.discarded": "Descartado",
  "booking.col.photo": "Foto",
  "booking.col.status": "Etapa",
  "booking.col.code": "Código",
  "booking.col.name": "Produto",
  "booking.col.supplier": "Fornecedor",
  "booking.col.location": "Local / loja",
  "booking.col.sheetDate": "Data da ficha",
  "booking.col.price": "Preço",
  "booking.col.currency": "Moeda",
  "booking.col.moq": "MOQ",
  "booking.col.masterQty": "Pç/caixa",
  "booking.col.innerQty": "Pç/inner",
  "booking.col.netWeight": "Peso líquido (kg)",
  "booking.col.grossWeight": "Peso bruto (kg)",
  "booking.col.estimatedWeight": "Peso estimado (kg)",
  "booking.col.average": "Média (US$)",
  "booking.col.cbm": "CBM da caixa",
  "booking.col.size": "Medidas",
  "booking.col.colors": "Cores",
  "booking.col.material": "Material",
  "booking.col.packageType": "Embalagem",
  "booking.col.customer": "Cliente",
  "booking.col.reservedQty": "Qtd. reservada",
  "booking.col.salePrice": "Preço de venda",
  "booking.col.cost": "Custo (R$)",
  "booking.col.targetPrice": "Preço p/ meta",
  "booking.col.signal": "Superplan",
  "booking.col.owner": "Responsável",
  "booking.col.enteredAt": "Entrada",
  "booking.col.source": "Planilha",
  "booking.col.note": "Observação",
  "booking.col.request": "Solicitação",
  "booking.signal.viable": "Viável",
  "booking.signal.below": "Abaixo da meta",
  "booking.signal.loss": "Prejuízo",
  "booking.signal.minimum": "No preço mínimo",
  "booking.signal.missing": "Falta dado",
  "booking.signal.none": "Sem análise",
  "booking.error.booking_not_found": "Linha do Booking não encontrada.",
  "booking.error.booking_request_only":
    "A etapa “Virou solicitação” é marcada sozinha quando você usa “Gerar solicitação”.",
  "booking.error.booking_approver_required":
    "Aprovar ou tirar um produto da vitrine é de quem analisa no Superplan (hoje, o administrador).",
  "booking.error.booking_customer_required":
    "Escolha o cliente antes de marcar como oferecido ou reservado.",
  "booking.error.booking_customer_invalid":
    "Cliente inválido ou inativo. Escolha um cliente da lista.",
  "booking.error.booking_qty_required":
    "Informe a quantidade reservada (número inteiro de peças).",
  "booking.error.booking_qty_below_moq":
    "A quantidade reservada está abaixo do pedido mínimo do produto.",
  "booking.error.booking_owner_invalid":
    "Responsável inválido. Escolha um login ativo da Wellmix.",
  "booking.error.booking_none_selected":
    "Marque pelo menos uma linha antes de usar a ação.",
  "booking.error.booking_too_many":
    "Linhas demais de uma vez. Marque até {max} linhas.",
  "booking.error.booking_request_too_many":
    "Linhas demais para uma solicitação só. Marque até {max} linhas por vez.",
  "booking.error.booking_not_requestable":
    "Só linhas em Aprovado, Oferecido ou Reservado geram solicitação. Confira as linhas marcadas.",
  "booking.error.booking_customer_mismatch":
    "Há linha marcada reservada para outro cliente. Desmarque-a ou escolha o cliente dela.",
  "booking.error.booking_qty_missing":
    "Há linha marcada sem quantidade reservada e sem pedido mínimo no produto. Informe a quantidade.",
  "booking.error.booking_variant_required":
    "Há produto marcado com variações. Para ele, use a Nova solicitação (que pede a variação).",
  "booking.error.booking_product_missing":
    "Há linha marcada com o produto fora do cadastro (excluído ou inativo).",
  "booking.error.booking_analysis_forbidden":
    "A análise do Superplan é só de quem abre o Superplan (hoje, o administrador).",
  "booking.error.booking_note_too_long":
    "Observação longa demais (até 500 caracteres).",
  "booking.error.booking_locked":
    "Esta linha já virou solicitação: cliente e quantidade mudam na solicitação. Para a linha voltar, exclua a solicitação.",
  "booking.productMissing": "Produto fora do cadastro",
  "booking.error.booking_request_alive":
    "Esta linha tem uma solicitação em andamento. Para a linha voltar, exclua a solicitação (em Solicitações): ela volta sozinha para Reservado ou Aprovado.",
  "booking.error.booking_request_customer":
    "Escolha o cliente na barra antes de gerar a solicitação: há linha marcada sem cliente.",
  "booking.error.booking_status_required":
    "Escolha a etapa em “Mover para…” antes de tocar em Mover.",
  "booking.error.booking_owner_required":
    "Escolha o responsável antes de tocar em Trocar responsável.",
  "booking.error.below_moq":
    "Quantidade abaixo do pedido mínimo de um dos produtos.",
  "booking.error.schema_outdated":
    "O banco ainda não tem a tabela do Booking. Publique o esquema (Configurações) e tente de novo.",
  "booking.error.forbidden": "Você não tem permissão para esta ação.",
  "booking.error.invalid_input":
    "Algum valor não é válido. Confira e tente de novo.",
};

export const en: Record<keyof typeof pt, string> = {
  "nav.booking": "Booking",
  "booking.title": "Booking",
  "booking.subtitle":
    "Products that arrived through the technical sheet, before they become a request: analysis, approval, offer, reservation and order.",
  "booking.status.new": "New",
  "booking.status.analysis": "Under analysis",
  "booking.status.approved": "Approved",
  "booking.status.offered": "Offered to the customer",
  "booking.status.reserved": "Reserved by the customer",
  "booking.status.requested": "Became a request",
  "booking.status.discarded": "Discarded",
  "booking.col.photo": "Photo",
  "booking.col.status": "Stage",
  "booking.col.code": "Code",
  "booking.col.name": "Product",
  "booking.col.supplier": "Supplier",
  "booking.col.location": "Place / store",
  "booking.col.sheetDate": "Sheet date",
  "booking.col.price": "Price",
  "booking.col.currency": "Currency",
  "booking.col.moq": "MOQ",
  "booking.col.masterQty": "Pcs/carton",
  "booking.col.innerQty": "Pcs/inner",
  "booking.col.netWeight": "Net weight (kg)",
  "booking.col.grossWeight": "Gross weight (kg)",
  "booking.col.estimatedWeight": "Estimated weight (kg)",
  "booking.col.average": "Average (US$)",
  "booking.col.cbm": "Carton CBM",
  "booking.col.size": "Size",
  "booking.col.colors": "Colors",
  "booking.col.material": "Material",
  "booking.col.packageType": "Packaging",
  "booking.col.customer": "Customer",
  "booking.col.reservedQty": "Reserved qty",
  "booking.col.salePrice": "Sale price",
  "booking.col.cost": "Cost (R$)",
  "booking.col.targetPrice": "Price for target",
  "booking.col.signal": "Superplan",
  "booking.col.owner": "Owner",
  "booking.col.enteredAt": "Entered",
  "booking.col.source": "Spreadsheet",
  "booking.col.note": "Note",
  "booking.col.request": "Request",
  "booking.signal.viable": "Viable",
  "booking.signal.below": "Below target",
  "booking.signal.loss": "Loss",
  "booking.signal.minimum": "At the minimum price",
  "booking.signal.missing": "Missing data",
  "booking.signal.none": "Not analyzed",
  "booking.error.booking_not_found": "Booking row not found.",
  "booking.error.booking_request_only":
    "The “Became a request” stage is set automatically when you use “Create request”.",
  "booking.error.booking_approver_required":
    "Approving or removing a product from the showcase is for whoever analyzes in Superplan (today, the administrator).",
  "booking.error.booking_customer_required":
    "Choose the customer before marking as offered or reserved.",
  "booking.error.booking_customer_invalid":
    "Invalid or inactive customer. Choose a customer from the list.",
  "booking.error.booking_qty_required":
    "Enter the reserved quantity (a whole number of pieces).",
  "booking.error.booking_qty_below_moq":
    "The reserved quantity is below the product's minimum order.",
  "booking.error.booking_owner_invalid":
    "Invalid owner. Choose an active Wellmix login.",
  "booking.error.booking_none_selected":
    "Tick at least one row before using the action.",
  "booking.error.booking_too_many":
    "Too many rows at once. Tick up to {max} rows.",
  "booking.error.booking_request_too_many":
    "Too many rows for one request. Tick up to {max} rows at a time.",
  "booking.error.booking_not_requestable":
    "Only rows in Approved, Offered or Reserved create a request. Check the ticked rows.",
  "booking.error.booking_customer_mismatch":
    "A ticked row is reserved for another customer. Untick it or choose its customer.",
  "booking.error.booking_qty_missing":
    "A ticked row has no reserved quantity and the product has no minimum order. Enter the quantity.",
  "booking.error.booking_variant_required":
    "A ticked product has variations. For it, use New request (which asks for the variation).",
  "booking.error.booking_product_missing":
    "A ticked row has a product that is no longer in the catalog (deleted or inactive).",
  "booking.error.booking_analysis_forbidden":
    "The Superplan analysis is only for whoever opens Superplan (today, the administrator).",
  "booking.error.booking_note_too_long":
    "Note too long (up to 500 characters).",
  "booking.error.booking_locked":
    "This row already became a request: customer and quantity change in the request. For the row to come back, delete the request.",
  "booking.productMissing": "Product no longer in the catalog",
  "booking.error.booking_request_alive":
    "This row has a request in progress. For the row to come back, delete the request (in Requests): it returns by itself to Reserved or Approved.",
  "booking.error.booking_request_customer":
    "Choose the customer in the bar before creating the request: a ticked row has no customer.",
  "booking.error.booking_status_required":
    "Choose the stage in “Move to…” before tapping Move.",
  "booking.error.booking_owner_required":
    "Choose the owner before tapping Change owner.",
  "booking.error.below_moq":
    "Quantity below the minimum order of one of the products.",
  "booking.error.schema_outdated":
    "The database does not have the Booking table yet. Publish the schema (Settings) and try again.",
  "booking.error.forbidden": "You do not have permission for this action.",
  "booking.error.invalid_input":
    "A value is not valid. Check it and try again.",
};

export const zh: Record<keyof typeof pt, string> = {
  "nav.booking": "Booking",
  "booking.title": "Booking",
  "booking.subtitle":
    "通过技术表进入的产品，在成为询价单之前：分析、批准、向客户推荐、预订和下单。",
  "booking.status.new": "新增",
  "booking.status.analysis": "分析中",
  "booking.status.approved": "已批准",
  "booking.status.offered": "已向客户推荐",
  "booking.status.reserved": "客户已预订",
  "booking.status.requested": "已生成询价单",
  "booking.status.discarded": "已放弃",
  "booking.col.photo": "照片",
  "booking.col.status": "阶段",
  "booking.col.code": "货号",
  "booking.col.name": "产品",
  "booking.col.supplier": "供应商",
  "booking.col.location": "地点 / 店铺",
  "booking.col.sheetDate": "技术表日期",
  "booking.col.price": "价格",
  "booking.col.currency": "币种",
  "booking.col.moq": "起订量",
  "booking.col.masterQty": "每箱件数",
  "booking.col.innerQty": "每内盒件数",
  "booking.col.netWeight": "净重（kg）",
  "booking.col.grossWeight": "毛重（kg）",
  "booking.col.estimatedWeight": "估算重量（kg）",
  "booking.col.average": "均价（美元）",
  "booking.col.cbm": "箱体积",
  "booking.col.size": "尺寸",
  "booking.col.colors": "颜色",
  "booking.col.material": "材质",
  "booking.col.packageType": "包装",
  "booking.col.customer": "客户",
  "booking.col.reservedQty": "预订数量",
  "booking.col.salePrice": "售价",
  "booking.col.cost": "成本（R$）",
  "booking.col.targetPrice": "达标价格",
  "booking.col.signal": "Superplan",
  "booking.col.owner": "负责人",
  "booking.col.enteredAt": "进入日期",
  "booking.col.source": "来源表格",
  "booking.col.note": "备注",
  "booking.col.request": "询价单",
  "booking.signal.viable": "可行",
  "booking.signal.below": "低于目标",
  "booking.signal.loss": "亏损",
  "booking.signal.minimum": "按最低价",
  "booking.signal.missing": "缺少数据",
  "booking.signal.none": "未分析",
  "booking.error.booking_not_found": "未找到该 Booking 行。",
  "booking.error.booking_request_only":
    "“已生成询价单”阶段在使用“生成询价单”时自动标记。",
  "booking.error.booking_approver_required":
    "批准或将产品从展示页撤下，只能由在 Superplan 中分析的人操作（目前为管理员）。",
  "booking.error.booking_customer_required":
    "标记为已推荐或已预订之前，请先选择客户。",
  "booking.error.booking_customer_invalid":
    "客户无效或已停用。请从列表中选择客户。",
  "booking.error.booking_qty_required": "请填写预订数量（整数件数）。",
  "booking.error.booking_qty_below_moq": "预订数量低于该产品的起订量。",
  "booking.error.booking_owner_invalid":
    "负责人无效。请选择有效的 Wellmix 账号。",
  "booking.error.booking_none_selected": "使用操作前请至少勾选一行。",
  "booking.error.booking_too_many": "一次勾选的行太多。最多勾选 {max} 行。",
  "booking.error.booking_request_too_many":
    "一张询价单的行数太多。每次最多勾选 {max} 行。",
  "booking.error.booking_not_requestable":
    "只有“已批准”“已推荐”或“已预订”的行可以生成询价单。请检查勾选的行。",
  "booking.error.booking_customer_mismatch":
    "勾选的行中有为其他客户预订的。请取消勾选或选择该行的客户。",
  "booking.error.booking_qty_missing":
    "勾选的行中有未填预订数量且产品没有起订量的。请填写数量。",
  "booking.error.booking_variant_required":
    "勾选的产品有规格变体。请对其使用“新建询价单”（会要求选择变体）。",
  "booking.error.booking_product_missing":
    "勾选的行中有产品已不在目录中（已删除或停用）。",
  "booking.error.booking_analysis_forbidden":
    "Superplan 分析仅限可打开 Superplan 的人（目前为管理员）。",
  "booking.error.booking_note_too_long": "备注过长（最多 500 个字符）。",
  "booking.error.booking_locked":
    "该行已生成询价单：客户和数量请在询价单中修改。要让该行回来，请删除询价单。",
  "booking.productMissing": "产品已不在目录中",
  "booking.error.booking_request_alive":
    "该行有一张进行中的询价单。要让该行回来，请删除询价单（在“询价单”中）：它会自动回到“已预订”或“已批准”。",
  "booking.error.booking_request_customer":
    "生成询价单之前请先在操作栏选择客户：有勾选的行没有客户。",
  "booking.error.booking_status_required":
    "点击“移动”之前，请先在“移到…”中选择阶段。",
  "booking.error.booking_owner_required":
    "点击“更换负责人”之前，请先选择负责人。",
  "booking.error.below_moq": "数量低于其中一个产品的起订量。",
  "booking.error.schema_outdated":
    "数据库中还没有 Booking 表。请发布数据结构（设置）后重试。",
  "booking.error.forbidden": "您没有执行此操作的权限。",
  "booking.error.invalid_input": "某个值无效。请检查后重试。",
};
