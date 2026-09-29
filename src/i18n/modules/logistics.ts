/**
 * Dicionário do módulo "logistics": containers, totais da Control Tower e
 * configurações de inspeção/container. Mesmas chaves em pt, en e zh.
 */
export const pt = {
  /* ---- Lista de containers ---- */
  "containers.title": "Containers",
  "containers.subtitle":
    "Planejamento de carga: capacidade por tipo, ocupação em CBM e peso, vendido × disponível.",
  "help.containers.body":
    "Cada container tem um tipo (capacidade em m³ e peso máximo vêm das Configurações), um cliente e itens com caixas e CBM. A ocupação é calculada de forma determinística: caixas × CBM por caixa. Vendido é o volume dos itens ligados a um pedido; disponível é o volume dos itens sem pedido (estoque dentro do container). Regra de consolidação: clientes diferentes não são juntados no mesmo container, a menos que a Wellmix libere isso nas Configurações.",
  "help.containers.steps":
    "Novo container: informe código, tipo e, se souber, o cliente e as datas de saída (ETD) e chegada (ETA).\nAbrir: toque no código para ver ocupação, itens e adicionar carga.\nOcupação: a barra mostra o CBM usado sobre a capacidade; acima do limite configurado o container entra na fila de revisão.\nVendido / disponível: percentuais em volume; só usam dados lançados.",
  "containers.new": "Novo container",
  "containers.code": "Código",
  "containers.codeHint":
    "Ex.: número do booking ou do container (MSKU1234567).",
  "containers.type": "Tipo",
  "containers.typeOption": "{code} · {cbm} m³ · {kg} kg",
  "containers.capacity": "Capacidade",
  "containers.maxWeight": "Peso máximo",
  "containers.customerOptional": "Cliente (opcional)",
  "containers.customerHint":
    "Definido automaticamente pelo primeiro pedido adicionado. Clientes diferentes só com liberação nas Configurações.",
  "containers.noCustomer": "Sem cliente",
  "containers.etd": "ETD (saída prevista)",
  "containers.eta": "ETA (chegada prevista)",
  "containers.notes": "Observações",
  "containers.create": "Criar container",
  "containers.none":
    "Nenhum container ainda. Crie o primeiro para planejar a carga.",
  "containers.status.planning": "Planejamento",
  "containers.status.loading": "Em carregamento",
  "containers.status.shipped": "Embarcado",
  "containers.status.arrived": "Chegou",
  "containers.status.closed": "Encerrado",
  "containers.occupancy": "Ocupação",
  "containers.boxes": "Caixas",
  "containers.cbmUsed": "CBM usado / capacidade",
  "containers.soldAvailable": "Vendido / disponível",
  "containers.sold": "Vendido",
  "containers.available": "Disponível",
  "containers.weight": "Peso",
  "containers.weightUnknown": "Peso não informado em todos os itens.",
  /* ---- Container ---- */
  "help.container.body":
    "Aqui você monta a carga. A barra de ocupação soma caixas × CBM por caixa sobre a capacidade do tipo; a de peso só aparece quando todos os itens têm peso por caixa. Itens ligados a um pedido contam como vendidos; itens de estoque (produto sem pedido) contam como disponíveis. Acima da capacidade, da ocupação máxima ou do peso, o container entra na fila de revisão automaticamente e sai dela quando a carga é ajustada.",
  "help.container.steps":
    "Situação: avance de Planejamento para Em carregamento, Embarcado, Chegou e Encerrado; encerrado não aceita mais itens.\nAdicionar por pedido: escolha um pedido ativo; quantidade, caixa e CBM vêm do item e da ficha do produto quando vazios.\nAdicionar de estoque: escolha o produto e informe quantidade; un/caixa, CBM e peso vêm da ficha quando vazios.\nRegra de consolidação: o primeiro pedido define o cliente do container; pedidos de outro cliente são recusados, salvo liberação nas Configurações.\nRemover: tira o item e recalcula ocupação e revisão.",
  "containers.changeStatus": "Mudar situação",
  "containers.advanceTo": "Avançar para: {status}",
  "containers.alert.overCapacity":
    "Acima da capacidade: {total} m³ usados de {capacity} m³.",
  "containers.alert.overOccupancy":
    "Ocupação acima do máximo recomendado ({max}%): {percent}%.",
  "containers.alert.overWeight":
    "Acima do peso máximo: {total} kg de {max} kg.",
  "containers.items": "Itens no container",
  "containers.items.none":
    "Nenhum item ainda. Adicione carga por pedido ou de estoque.",
  "containers.item.order": "Pedido",
  "containers.item.unitsPerBox": "Un/caixa",
  "containers.item.boxes": "Caixas",
  "containers.item.cbmPerBox": "CBM/caixa",
  "containers.item.cbmTotal": "CBM total",
  "containers.item.weight": "Peso (kg)",
  "containers.item.weightPerBox": "Peso por caixa (kg)",
  "containers.item.stock": "Estoque",
  "containers.remove": "Remover",
  "containers.addItem": "Adicionar item",
  "containers.addItem.byOrder": "Por pedido",
  "containers.addItem.byStock": "Estoque / produto",
  "containers.addItem.order": "Pedido ativo com item",
  "containers.addItem.orderHint":
    "Só pedidos não encerrados. Quantidade padrão = a do item do pedido; caixa e CBM vêm da ficha do produto quando vazios.",
  "containers.addItem.noOrders": "Nenhum pedido ativo com item.",
  "containers.addItem.product": "Produto",
  "containers.addItem.quantityHint":
    "Deixe vazio para usar a quantidade do item do pedido.",
  "containers.addItem.boxHint":
    "Vazio = valores da ficha do produto (un/caixa, CBM da caixa, peso bruto × un/caixa).",
  "containers.addItem.submit": "Adicionar ao container",
  "containers.commercial": "Visão comercial",
  "containers.soldValue": "Valor vendido",
  "containers.soldPercent": "Vendido (volume)",
  "containers.availablePercent": "Disponível (volume)",
  "containers.commercialHint":
    "Disponível = itens sem pedido (estoque dentro do container). Só dados lançados; nada é estimado.",
  /* ---- Erros (código em ?error=) ---- */
  "containers.error.container_other_customer":
    "Regra de consolidação: este container já é de outro cliente. Clientes diferentes não são juntados automaticamente; libere em Configurações (containerAllowMultiCustomer) se for uma consolidação manual.",
  "containers.error.cbm_required":
    "Informe o CBM por caixa (ou cadastre as dimensões da caixa na ficha do produto).",
  "containers.error.box_count_required":
    "Informe o número de caixas (ou as unidades por caixa na ficha do produto).",
  "containers.error.quantity_required": "Informe a quantidade.",
  "containers.error.container_closed":
    "Container encerrado: não aceita mais itens.",
  "containers.error.container_type":
    "Tipo de container desconhecido. Cadastre em Configurações.",
  "containers.error.order_not_found": "Pedido não encontrado.",
  "containers.error.product_not_found": "Produto não encontrado.",
  "containers.error.container_not_found": "Container não encontrado.",
  "containers.error.invalid": "Dados inválidos. Verifique os campos.",
  /* ---- Control Tower: totais ---- */
  "ct.totals.hint":
    "Totais só com o que foi lançado (pedidos, pagamentos, recebimentos e containers); nada é estimado.",
  "ct.finance.title": "Financeiro",
  "ct.finance.purchased": "Comprado (FOB)",
  "ct.finance.paid": "Pago ao fornecedor",
  "ct.finance.payable": "Saldo a pagar",
  "ct.operation.title": "Operação",
  "ct.operation.production": "Em produção",
  "ct.operation.ready": "Pronto / inspeção",
  "ct.operation.shipped": "Embarcado / no mar",
  "ct.operation.customs": "Desembaraço",
  "ct.operation.transport": "Transporte",
  "ct.operation.delivered": "Entregue",
  "ct.operation.orders": "{count} pedido(s)",
  "ct.operation.reviewsOpen": "Itens para revisão",
  "ct.operation.containersOpen": "Containers abertos",
  "ct.operation.avgOccupancy": "Ocupação média",
  "ct.commercial.title": "Visão comercial por container",
  "ct.commercial.hint":
    "Só usa dados lançados: valor de venda dos pedidos no container e volume dos itens. Disponível = itens sem pedido.",
  "ct.commercial.none": "Nenhum container aberto.",
  /* ---- Configurações ---- */
  "settings.section.general": "Fluxo e prazos",
  "settings.section.inspection": "Inspeção e fila de revisão",
  "settings.section.containers": "Containers",
  "settings.section.compliance": "Conformidade e pós-venda",
  "settings.hint.complianceGateEnabled":
    "Produto sem certificação válida exigida pela linha entra na fila de revisão e o pedido ganha uma conferência obrigatória.",
  "settings.hint.afterSalesEnabled":
    "Ao concluir a entrega, abre a avaliação de pós-venda para o cliente (experiência, problemas, interesse em repor).",
  "settings.hint.certificationExpiryWarningDays":
    "Dias de antecedência para avisar (Control Tower e ficha) que uma certificação vai vencer.",
  "settings.hint.dimensionTolerancePercent":
    "Divergência aceita nas dimensões (comprimento, largura, altura) entre a compra e a inspeção.",
  "settings.hint.cbmTolerancePercent":
    "Divergência aceita em CBM e peso bruto entre a compra e a inspeção.",
  "settings.hint.quantityTolerancePercent":
    "Divergência aceita em unidades por caixa (0 = exato).",
  "settings.hint.inspectionExtendedChecks":
    "A inspeção pede também dimensões, peso bruto, caixa, material e cor (opcionais) e compara com a compra.",
  "settings.hint.reviewOnZeroPrice":
    "Pedido com FOB zerado ou ausente entra na fila de revisão.",
  "settings.hint.containerAllowMultiCustomer":
    "Permite juntar pedidos de clientes diferentes no mesmo container (consolidação manual).",
  "settings.hint.containerMaxOccupancyPercent":
    "Acima deste percentual o container entra na fila de revisão.",
  "settings.containerTypes.label": "Tipos de container",
  "settings.hint.containerTypes":
    "Uma linha por tipo: código;capacidade em m³;peso máximo em kg. Ex.: 40HC;68;26500. Linhas vazias são ignoradas.",
  "settings.error.invalid_json": "JSON inválido em stageDueDays.",
  "settings.error.invalid_container_types":
    "Tipos de container inválidos: use código;capacidade;peso por linha.",
};

export const en: Record<keyof typeof pt, string> = {
  "containers.title": "Containers",
  "containers.subtitle":
    "Load planning: capacity per type, CBM and weight occupancy, sold vs. available.",
  "help.containers.body":
    "Each container has a type (capacity in m³ and max weight come from Settings), a customer and items with boxes and CBM. Occupancy is deterministic: boxes × CBM per box. Sold is the volume of items linked to an order; available is the volume of items without an order (stock inside the container). Consolidation rule: different customers are never merged in one container unless Wellmix allows it in Settings.",
  "help.containers.steps":
    "New container: enter code, type and, if known, the customer and the departure (ETD) and arrival (ETA) dates.\nOpen: tap the code to see occupancy, items and add cargo.\nOccupancy: the bar shows CBM used over capacity; above the configured limit the container enters the review queue.\nSold / available: percentages by volume; only recorded data is used.",
  "containers.new": "New container",
  "containers.code": "Code",
  "containers.codeHint": "E.g. booking or container number (MSKU1234567).",
  "containers.type": "Type",
  "containers.typeOption": "{code} · {cbm} m³ · {kg} kg",
  "containers.capacity": "Capacity",
  "containers.maxWeight": "Max weight",
  "containers.customerOptional": "Customer (optional)",
  "containers.customerHint":
    "Set automatically by the first order added. Different customers only when allowed in Settings.",
  "containers.noCustomer": "No customer",
  "containers.etd": "ETD (planned departure)",
  "containers.eta": "ETA (planned arrival)",
  "containers.notes": "Notes",
  "containers.create": "Create container",
  "containers.none": "No containers yet. Create the first one to plan cargo.",
  "containers.status.planning": "Planning",
  "containers.status.loading": "Loading",
  "containers.status.shipped": "Shipped",
  "containers.status.arrived": "Arrived",
  "containers.status.closed": "Closed",
  "containers.occupancy": "Occupancy",
  "containers.boxes": "Boxes",
  "containers.cbmUsed": "CBM used / capacity",
  "containers.soldAvailable": "Sold / available",
  "containers.sold": "Sold",
  "containers.available": "Available",
  "containers.weight": "Weight",
  "containers.weightUnknown": "Weight missing on some items.",
  "help.container.body":
    "Build the load here. The occupancy bar sums boxes × CBM per box over the type's capacity; the weight bar only shows when every item has a weight per box. Items linked to an order count as sold; stock items (product without order) count as available. Above capacity, max occupancy or weight, the container automatically enters the review queue and leaves it once the load is adjusted.",
  "help.container.steps":
    "Status: move from Planning to Loading, Shipped, Arrived and Closed; a closed container accepts no more items.\nAdd by order: pick an active order; quantity, box and CBM come from the item and the product sheet when left empty.\nAdd from stock: pick the product and enter quantity; units/box, CBM and weight come from the product sheet when left empty.\nConsolidation rule: the first order sets the container's customer; orders from another customer are refused unless allowed in Settings.\nRemove: takes the item out and recalculates occupancy and review.",
  "containers.changeStatus": "Change status",
  "containers.advanceTo": "Move to: {status}",
  "containers.alert.overCapacity":
    "Over capacity: {total} m³ used of {capacity} m³.",
  "containers.alert.overOccupancy":
    "Occupancy above the recommended maximum ({max}%): {percent}%.",
  "containers.alert.overWeight": "Over max weight: {total} kg of {max} kg.",
  "containers.items": "Items in the container",
  "containers.items.none": "No items yet. Add cargo by order or from stock.",
  "containers.item.order": "Order",
  "containers.item.unitsPerBox": "Units/box",
  "containers.item.boxes": "Boxes",
  "containers.item.cbmPerBox": "CBM/box",
  "containers.item.cbmTotal": "Total CBM",
  "containers.item.weight": "Weight (kg)",
  "containers.item.weightPerBox": "Weight per box (kg)",
  "containers.item.stock": "Stock",
  "containers.remove": "Remove",
  "containers.addItem": "Add item",
  "containers.addItem.byOrder": "By order",
  "containers.addItem.byStock": "Stock / product",
  "containers.addItem.order": "Active order with item",
  "containers.addItem.orderHint":
    "Only open orders. Default quantity = the order item's; box and CBM come from the product sheet when empty.",
  "containers.addItem.noOrders": "No active order with items.",
  "containers.addItem.product": "Product",
  "containers.addItem.quantityHint":
    "Leave empty to use the order item's quantity.",
  "containers.addItem.boxHint":
    "Empty = values from the product sheet (units/box, box CBM, gross weight × units/box).",
  "containers.addItem.submit": "Add to container",
  "containers.commercial": "Commercial view",
  "containers.soldValue": "Sold value",
  "containers.soldPercent": "Sold (volume)",
  "containers.availablePercent": "Available (volume)",
  "containers.commercialHint":
    "Available = items without an order (stock inside the container). Only recorded data; nothing is estimated.",
  "containers.error.container_other_customer":
    "Consolidation rule: this container already belongs to another customer. Different customers are never merged automatically; allow it in Settings (containerAllowMultiCustomer) for a manual consolidation.",
  "containers.error.cbm_required":
    "Enter the CBM per box (or record the box dimensions on the product sheet).",
  "containers.error.box_count_required":
    "Enter the number of boxes (or the units per box on the product sheet).",
  "containers.error.quantity_required": "Enter the quantity.",
  "containers.error.container_closed":
    "Container is closed: it accepts no more items.",
  "containers.error.container_type":
    "Unknown container type. Register it in Settings.",
  "containers.error.order_not_found": "Order not found.",
  "containers.error.product_not_found": "Product not found.",
  "containers.error.container_not_found": "Container not found.",
  "containers.error.invalid": "Invalid data. Check the fields.",
  "ct.totals.hint":
    "Totals use only what was recorded (orders, payments, receipts and containers); nothing is estimated.",
  "ct.finance.title": "Finance",
  "ct.finance.purchased": "Purchased (FOB)",
  "ct.finance.paid": "Paid to supplier",
  "ct.finance.payable": "Balance payable",
  "ct.operation.title": "Operations",
  "ct.operation.production": "In production",
  "ct.operation.ready": "Ready / inspection",
  "ct.operation.shipped": "Shipped / at sea",
  "ct.operation.customs": "Customs",
  "ct.operation.transport": "Transport",
  "ct.operation.delivered": "Delivered",
  "ct.operation.orders": "{count} order(s)",
  "ct.operation.reviewsOpen": "Items for review",
  "ct.operation.containersOpen": "Open containers",
  "ct.operation.avgOccupancy": "Average occupancy",
  "ct.commercial.title": "Commercial view per container",
  "ct.commercial.hint":
    "Only recorded data: sell value of the orders in the container and item volume. Available = items without an order.",
  "ct.commercial.none": "No open containers.",
  "settings.section.general": "Flow and deadlines",
  "settings.section.inspection": "Inspection and review queue",
  "settings.section.containers": "Containers",
  "settings.section.compliance": "Compliance and after-sales",
  "settings.hint.complianceGateEnabled":
    "A product without a valid certification required by its line enters the review queue and the order gets a mandatory check.",
  "settings.hint.afterSalesEnabled":
    "When delivery completes, opens the after-sales review for the customer (experience, problems, repurchase interest).",
  "settings.hint.certificationExpiryWarningDays":
    "Days in advance to warn (Control Tower and product sheet) that a certification is about to expire.",
  "settings.hint.dimensionTolerancePercent":
    "Accepted divergence in dimensions (length, width, height) between purchase and inspection.",
  "settings.hint.cbmTolerancePercent":
    "Accepted divergence in CBM and gross weight between purchase and inspection.",
  "settings.hint.quantityTolerancePercent":
    "Accepted divergence in units per box (0 = exact).",
  "settings.hint.inspectionExtendedChecks":
    "Inspection also asks for dimensions, gross weight, box, material and color (optional) and compares them with the purchase.",
  "settings.hint.reviewOnZeroPrice":
    "An order with zero or missing FOB enters the review queue.",
  "settings.hint.containerAllowMultiCustomer":
    "Allows orders from different customers in the same container (manual consolidation).",
  "settings.hint.containerMaxOccupancyPercent":
    "Above this percentage the container enters the review queue.",
  "settings.containerTypes.label": "Container types",
  "settings.hint.containerTypes":
    "One line per type: code;capacity in m³;max weight in kg. E.g. 40HC;68;26500. Empty lines are ignored.",
  "settings.error.invalid_json": "Invalid JSON in stageDueDays.",
  "settings.error.invalid_container_types":
    "Invalid container types: use code;capacity;weight per line.",
};

export const zh: Record<keyof typeof pt, string> = {
  "containers.title": "集装箱",
  "containers.subtitle":
    "装柜计划：按箱型的容量、体积（CBM）和重量占用、已售与可售。",
  "help.containers.body":
    "每个集装箱有一个箱型（容量 m³ 和最大重量来自设置）、一个客户以及带箱数和 CBM 的货物明细。占用率按确定的公式计算：箱数 × 每箱 CBM。已售是关联订单的货物体积；可售是未关联订单的货物体积（箱内库存）。拼柜规则：不同客户的货物不会自动拼在同一个集装箱，除非 Wellmix 在设置中允许。",
  "help.containers.steps":
    "新建集装箱：填写编号、箱型，若已知可填客户以及预计离港（ETD）和到港（ETA）日期。\n打开：点击编号查看占用率、货物明细并添加货物。\n占用率：进度条显示已用 CBM 与容量的比例；超过设定上限时集装箱进入复核队列。\n已售 / 可售：按体积的百分比；只使用已录入的数据。",
  "containers.new": "新建集装箱",
  "containers.code": "编号",
  "containers.codeHint": "例如：订舱号或箱号（MSKU1234567）。",
  "containers.type": "箱型",
  "containers.typeOption": "{code} · {cbm} m³ · {kg} kg",
  "containers.capacity": "容量",
  "containers.maxWeight": "最大重量",
  "containers.customerOptional": "客户（可选）",
  "containers.customerHint":
    "由添加的第一个订单自动确定。不同客户需在设置中允许后才能拼柜。",
  "containers.noCustomer": "无客户",
  "containers.etd": "ETD（预计离港）",
  "containers.eta": "ETA（预计到港）",
  "containers.notes": "备注",
  "containers.create": "创建集装箱",
  "containers.none": "还没有集装箱。创建第一个以开始装柜计划。",
  "containers.status.planning": "计划中",
  "containers.status.loading": "装柜中",
  "containers.status.shipped": "已发运",
  "containers.status.arrived": "已到港",
  "containers.status.closed": "已关闭",
  "containers.occupancy": "占用率",
  "containers.boxes": "箱数",
  "containers.cbmUsed": "已用 CBM / 容量",
  "containers.soldAvailable": "已售 / 可售",
  "containers.sold": "已售",
  "containers.available": "可售",
  "containers.weight": "重量",
  "containers.weightUnknown": "部分货物未填写重量。",
  "help.container.body":
    "在这里组织装柜。占用率进度条按箱数 × 每箱 CBM 与箱型容量的比例计算；重量进度条仅在所有货物都有每箱重量时显示。关联订单的货物计为已售；库存货物（无订单的产品）计为可售。超过容量、最大占用率或重量时，集装箱会自动进入复核队列，调整装载后自动退出。",
  "help.container.steps":
    "状态：从计划中依次推进到装柜中、已发运、已到港和已关闭；已关闭的集装箱不再接受货物。\n按订单添加：选择进行中的订单；数量、箱数和 CBM 留空时取自订单明细和产品资料。\n从库存添加：选择产品并填写数量；每箱数量、CBM 和重量留空时取自产品资料。\n拼柜规则：第一个订单确定集装箱的客户；其他客户的订单会被拒绝，除非在设置中允许。\n移除：删除该货物并重新计算占用率和复核。",
  "containers.changeStatus": "更改状态",
  "containers.advanceTo": "推进到：{status}",
  "containers.alert.overCapacity":
    "超过容量：已用 {total} m³，容量 {capacity} m³。",
  "containers.alert.overOccupancy":
    "占用率超过建议上限（{max}%）：{percent}%。",
  "containers.alert.overWeight": "超过最大重量：{total} kg，上限 {max} kg。",
  "containers.items": "箱内货物",
  "containers.items.none": "还没有货物。按订单或从库存添加。",
  "containers.item.order": "订单",
  "containers.item.unitsPerBox": "每箱数量",
  "containers.item.boxes": "箱数",
  "containers.item.cbmPerBox": "每箱 CBM",
  "containers.item.cbmTotal": "总 CBM",
  "containers.item.weight": "重量（kg）",
  "containers.item.weightPerBox": "每箱重量（kg）",
  "containers.item.stock": "库存",
  "containers.remove": "移除",
  "containers.addItem": "添加货物",
  "containers.addItem.byOrder": "按订单",
  "containers.addItem.byStock": "库存 / 产品",
  "containers.addItem.order": "有明细的进行中订单",
  "containers.addItem.orderHint":
    "仅未关闭的订单。默认数量为订单明细数量；箱数和 CBM 留空时取自产品资料。",
  "containers.addItem.noOrders": "没有带明细的进行中订单。",
  "containers.addItem.product": "产品",
  "containers.addItem.quantityHint": "留空则使用订单明细的数量。",
  "containers.addItem.boxHint":
    "留空 = 取自产品资料（每箱数量、外箱 CBM、毛重 × 每箱数量）。",
  "containers.addItem.submit": "加入集装箱",
  "containers.commercial": "商业视图",
  "containers.soldValue": "已售金额",
  "containers.soldPercent": "已售（体积）",
  "containers.availablePercent": "可售（体积）",
  "containers.commercialHint":
    "可售 = 无订单的货物（箱内库存）。只使用已录入的数据，不做估算。",
  "containers.error.container_other_customer":
    "拼柜规则：该集装箱已属于另一客户。不同客户的货物不会自动拼柜；如需手动拼柜，请在设置中允许（containerAllowMultiCustomer）。",
  "containers.error.cbm_required":
    "请填写每箱 CBM（或在产品资料中登记外箱尺寸）。",
  "containers.error.box_count_required":
    "请填写箱数（或在产品资料中登记每箱数量）。",
  "containers.error.quantity_required": "请填写数量。",
  "containers.error.container_closed": "集装箱已关闭，不再接受货物。",
  "containers.error.container_type": "未知箱型。请在设置中登记。",
  "containers.error.order_not_found": "未找到订单。",
  "containers.error.product_not_found": "未找到产品。",
  "containers.error.container_not_found": "未找到集装箱。",
  "containers.error.invalid": "数据无效，请检查各字段。",
  "ct.totals.hint":
    "合计仅基于已录入的数据（订单、付款、收款和集装箱），不做估算。",
  "ct.finance.title": "财务",
  "ct.finance.purchased": "采购额（FOB）",
  "ct.finance.paid": "已付供应商",
  "ct.finance.payable": "应付余额",
  "ct.operation.title": "运营",
  "ct.operation.production": "生产中",
  "ct.operation.ready": "已完成 / 验货",
  "ct.operation.shipped": "已发运 / 海上",
  "ct.operation.customs": "清关",
  "ct.operation.transport": "运输",
  "ct.operation.delivered": "已送达",
  "ct.operation.orders": "{count} 个订单",
  "ct.operation.reviewsOpen": "待复核事项",
  "ct.operation.containersOpen": "未关闭集装箱",
  "ct.operation.avgOccupancy": "平均占用率",
  "ct.commercial.title": "按集装箱的商业视图",
  "ct.commercial.hint":
    "只使用已录入的数据：箱内订单的销售额和货物体积。可售 = 无订单的货物。",
  "ct.commercial.none": "没有未关闭的集装箱。",
  "settings.section.general": "流程与期限",
  "settings.section.inspection": "验货与复核队列",
  "settings.section.containers": "集装箱",
  "settings.section.compliance": "合规与售后",
  "settings.hint.complianceGateEnabled":
    "产品缺少产品线要求的有效认证时进入复核队列，订单增加一项必需的核对。",
  "settings.hint.afterSalesEnabled":
    "交付完成后为客户打开售后评价（体验、问题、复购意向）。",
  "settings.hint.certificationExpiryWarningDays":
    "认证到期前多少天在控制塔和产品档案中提醒。",
  "settings.hint.dimensionTolerancePercent":
    "采购与验货之间尺寸（长、宽、高）允许的偏差。",
  "settings.hint.cbmTolerancePercent": "采购与验货之间 CBM 和毛重允许的偏差。",
  "settings.hint.quantityTolerancePercent":
    "每箱数量允许的偏差（0 = 必须一致）。",
  "settings.hint.inspectionExtendedChecks":
    "验货时还需填写尺寸、毛重、外箱、材质和颜色（可选），并与采购数据比较。",
  "settings.hint.reviewOnZeroPrice": "FOB 为零或缺失的订单进入复核队列。",
  "settings.hint.containerAllowMultiCustomer":
    "允许不同客户的订单拼入同一个集装箱（手动拼柜）。",
  "settings.hint.containerMaxOccupancyPercent":
    "超过此百分比时集装箱进入复核队列。",
  "settings.containerTypes.label": "箱型",
  "settings.hint.containerTypes":
    "每行一个箱型：代码;容量 m³;最大重量 kg。例如：40HC;68;26500。空行将被忽略。",
  "settings.error.invalid_json": "stageDueDays 的 JSON 无效。",
  "settings.error.invalid_container_types":
    "箱型无效：每行请使用 代码;容量;重量 的格式。",
};
