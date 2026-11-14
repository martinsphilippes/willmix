/**
 * Dicionário do módulo "color-variants": escolha do vencedor na Seleção de
 * itens (botão "Escolher", "Rever opções"), variações de cor do produto e a
 * composição por cor e por data, até o pedido (docs/PURCHASE_SCHEDULE.md,
 * "Cores"). Mesmas chaves em pt, en e zh.
 */
export const pt = {
  "colors.choose": "Escolher",
  "colors.chosen": "Escolhido",
  "colors.chooseHint": "Marca este item como o vencedor do grupo",
  "colors.review": "Rever opções",
  "colors.reviewHint":
    "Mostra de novo os outros itens do grupo para comparar e trocar a escolha.",
  "colors.collapsed": "{n} outros itens recolhidos",
  "colors.card.title": "Variações",
  "colors.card.hint":
    "Uma linha por cor do item no Book. Tire ou ponha cada cor nesta compra: vale só para o pedido em preparação; as cores do Book não mudam.",
  "colors.card.include": "Incluir {color} na compra",
  "colors.card.excluded": "fora desta compra",
  "colors.card.count": "{n} de {total} cores na compra",
  "colors.card.pieces": "{n} peças",
  "colors.line": "{product} · {color}",
  "colors.preview.title": "Composição por cor",
  "colors.preview.hint":
    "O total é dividido igualmente entre as cores incluídas, em caixas master inteiras; o saldo vai para as primeiras cores.",
  "colors.preview.single": "Pedido único",
  "colors.preview.round": "Programação {n} · {date}",
  "colors.preview.subtotal": "Subtotal",
  "colors.preview.total": "Total do pedido",
  "colors.preview.color": "Cor",
  "colors.preview.pieces": "Peças",
  "colors.preview.cartons": "Caixas",
  "colors.adjust":
    "{pieces} peças{where} não fecham caixas master inteiras de {carton} para dividir entre as cores. Ajuste para {down} ou {up} peças antes de gravar.",
  "colors.adjustWhere": " na programação {n}",
  "colors.none": "Inclua pelo menos uma cor na compra para gravar.",
  "colors.col.color": "Cor",
  "colors.byColor": "Por cor",
  "supplierRequests.error.selection_colors_cartons":
    "A quantidade não fecha caixas master inteiras para dividir entre as cores. Ajuste como indicado na composição por cor e grave de novo.",
  "supplierRequests.error.selection_colors_none":
    "Inclua pelo menos uma cor na compra (card Variações) para gravar a escolha.",
  "supplierRequests.error.selection_colors_total":
    "As caixas por cor não somam o total do pedido. Confira as caixas de cada cor no card Variações e grave de novo.",
  "colors.card.cartons": "Caixas",
  "colors.card.cartonsOf": "Caixas de {color}",
  "colors.card.custom":
    "Caixas por cor digitadas: o total do pedido é a soma das cores.",
  "colors.card.reset": "Dividir igualmente",
  "purchaseOrder.error.purchase_order_colors_cartons":
    "A quantidade de um produto com variações de cor não fecha caixas master inteiras para dividir entre as cores. Use um múltiplo da caixa master ou deixe a quantidade da solicitação.",
};

export const en: Record<keyof typeof pt, string> = {
  "colors.choose": "Choose",
  "colors.chosen": "Chosen",
  "colors.chooseHint": "Marks this item as the group winner",
  "colors.review": "Review options",
  "colors.reviewHint":
    "Shows the other items of the group again to compare and change the choice.",
  "colors.collapsed": "{n} other items collapsed",
  "colors.card.title": "Variations",
  "colors.card.hint":
    "One line per color of the item in the Book. Take each color out of this purchase or put it back: it applies only to the order being prepared; the Book colors do not change.",
  "colors.card.include": "Include {color} in the purchase",
  "colors.card.excluded": "out of this purchase",
  "colors.card.count": "{n} of {total} colors in the purchase",
  "colors.card.pieces": "{n} pieces",
  "colors.line": "{product} · {color}",
  "colors.preview.title": "Breakdown by color",
  "colors.preview.hint":
    "The total is split evenly across the included colors, in whole master cartons; the remainder goes to the first colors.",
  "colors.preview.single": "Single order",
  "colors.preview.round": "Schedule {n} · {date}",
  "colors.preview.subtotal": "Subtotal",
  "colors.preview.total": "Order total",
  "colors.preview.color": "Color",
  "colors.preview.pieces": "Pieces",
  "colors.preview.cartons": "Cartons",
  "colors.adjust":
    "{pieces} pieces{where} do not make whole master cartons of {carton} to split across the colors. Change it to {down} or {up} pieces before saving.",
  "colors.adjustWhere": " in schedule {n}",
  "colors.none": "Include at least one color in the purchase to save.",
  "colors.col.color": "Color",
  "colors.byColor": "By color",
  "supplierRequests.error.selection_colors_cartons":
    "The quantity does not make whole master cartons to split across the colors. Adjust it as shown in the breakdown by color and save again.",
  "supplierRequests.error.selection_colors_none":
    "Include at least one color in the purchase (Variations card) to save the choice.",
  "supplierRequests.error.selection_colors_total":
    "The cartons per color do not add up to the order total. Check each color's cartons in the Variations card and save again.",
  "colors.card.cartons": "Cartons",
  "colors.card.cartonsOf": "Cartons of {color}",
  "colors.card.custom":
    "Cartons typed per color: the order total is the sum of the colors.",
  "colors.card.reset": "Split evenly",
  "purchaseOrder.error.purchase_order_colors_cartons":
    "The quantity of a product with color variations does not make whole master cartons to split across the colors. Use a multiple of the master carton or keep the request quantity.",
};

export const zh: Record<keyof typeof pt, string> = {
  "colors.choose": "选择",
  "colors.chosen": "已选",
  "colors.chooseHint": "将此项设为该组的中选项",
  "colors.review": "重新比较",
  "colors.reviewHint": "重新显示该组的其他项目，以便比较并更换选择。",
  "colors.collapsed": "已收起其他 {n} 项",
  "colors.card.title": "颜色款式",
  "colors.card.hint":
    "Book 中该项目的每种颜色一行。可将每种颜色移出或加入本次采购：仅对正在准备的订单有效；Book 中的颜色不变。",
  "colors.card.include": "将 {color} 加入采购",
  "colors.card.excluded": "不在本次采购中",
  "colors.card.count": "采购 {total} 种颜色中的 {n} 种",
  "colors.card.pieces": "{n} 件",
  "colors.line": "{product} · {color}",
  "colors.preview.title": "按颜色分配",
  "colors.preview.hint":
    "总数按整箱外箱平均分配给所选颜色；余数分给排在前面的颜色。",
  "colors.preview.single": "单次订单",
  "colors.preview.round": "计划 {n} · {date}",
  "colors.preview.subtotal": "小计",
  "colors.preview.total": "订单合计",
  "colors.preview.color": "颜色",
  "colors.preview.pieces": "件数",
  "colors.preview.cartons": "箱数",
  "colors.adjust":
    "{pieces} 件{where}无法凑成每箱 {carton} 件的整箱来分配颜色。保存前请调整为 {down} 或 {up} 件。",
  "colors.adjustWhere": "（计划 {n}）",
  "colors.none": "请至少选择一种颜色加入采购后再保存。",
  "colors.col.color": "颜色",
  "colors.byColor": "按颜色",
  "supplierRequests.error.selection_colors_cartons":
    "数量无法凑成整箱外箱来分配颜色。请按颜色分配中的提示调整后再保存。",
  "supplierRequests.error.selection_colors_none":
    "请至少选择一种颜色加入采购（颜色款式卡片）后再保存选择。",
  "supplierRequests.error.selection_colors_total":
    "各颜色的箱数之和与订单总数不符。请在颜色款式卡片中核对每种颜色的箱数后再保存。",
  "colors.card.cartons": "箱数",
  "colors.card.cartonsOf": "{color} 的箱数",
  "colors.card.custom": "已按颜色输入箱数：订单总数为各颜色之和。",
  "colors.card.reset": "平均分配",
  "purchaseOrder.error.purchase_order_colors_cartons":
    "有颜色款式的产品数量无法凑成整箱外箱来分配颜色。请使用外箱的倍数，或保留询价单的数量。",
};
