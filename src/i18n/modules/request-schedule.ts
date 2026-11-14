/**
 * Dicionário do módulo "request-schedule" (programação de entregas pedida
 * pelo cliente na solicitação): mesmas chaves em pt, en e zh.
 */
export const pt = {
  "reqSchedule.toggle": "Programação de entregas",
  "reqSchedule.ask": "Quer receber em mais de uma entrega?",
  "reqSchedule.title": "Programação de compra",
  "reqSchedule.hint":
    "Divida a quantidade em entregas com intervalo fixo; as datas previstas são calculadas. A Wellmix e o fornecedor seguem esta programação na ficha de compra.",
  "reqSchedule.interval": "Intervalo entre entregas",
  "reqSchedule.days": "{n} dias",
  "reqSchedule.custom": "Outro",
  "reqSchedule.firstDate": "1ª entrega prevista",
  "reqSchedule.n": "Programação {n}",
  "reqSchedule.quantity": "Quantidade",
  "reqSchedule.expected": "Data",
  "reqSchedule.add": "Programação",
  "reqSchedule.remove": "Remover programação {n}",
  "reqSchedule.total": "Total: {total} {unit}",
  "reqSchedule.off": "Sem programação (entrega única)",
  "reqSchedule.gen.chooseProduct": "Escolha o produto no campo acima",
  "reqSchedule.gen.noPieces":
    "O produto escolhido não tem peças por caixa master no cadastro (nem na ficha mestre): não dá para converter caixas em peças. Informe a quantidade em peças ou use “+ Programação de compra” e informe as peças de cada programação.",
  "reqSchedule.gen.noCarton":
    "O produto escolhido não tem o CBM da caixa master (nem as medidas da caixa) no cadastro: sem ele não há conta de containers. As caixas são divididas igualmente pelas programações.",
  "reqSchedule.gen.noData":
    "O produto escolhido não tem peças por caixa master nem o CBM da caixa master (nem as medidas da caixa) no cadastro: sem eles não dá para converter caixas em peças nem calcular containers. Informe a quantidade em peças ou use “+ Programação de compra” e informe as peças de cada programação.",
  "reqSchedule.gen.outside":
    "Produto fora do catálogo: sem caixa master cadastrada, não dá para converter caixas em peças. Informe a quantidade em peças ou use “+ Programação de compra” e informe as peças de cada programação.",
  "reqSchedule.gen.regenerate":
    "O produto mudou: a programação gerada para o produto anterior saiu. Gere a programação de novo.",
  "reqBatch.error.schedule_product_changed":
    "A programação de um produto foi gerada para outro produto. Gere a programação de novo e envie.",
  "reqSchedule.pieces": "Quantidade (peças)",
  "reqSchedule.piecesHint":
    "A quantidade do produto, em peças. Sem programação, vai num pedido único.",
  "reqSchedule.piecesScheduledHint":
    "Com a programação, a quantidade é a soma das programações.",
  "reqSchedule.summary":
    "{n} programações a cada {days} dias, a partir de {date}",
  "reqSchedule.requested": "Pedido do cliente: {quantity} {unit} em {date}",
  "reqSchedule.error.invalid":
    "Confira a programação de entregas: quantidades, intervalo e data.",
};

export const en: Record<keyof typeof pt, string> = {
  "reqSchedule.toggle": "Delivery schedule",
  "reqSchedule.ask": "Want to receive in more than one delivery?",
  "reqSchedule.title": "Purchase schedule",
  "reqSchedule.hint":
    "Split the quantity into deliveries at a fixed interval; expected dates are calculated. Wellmix and the supplier follow this schedule on the purchase sheet.",
  "reqSchedule.interval": "Interval between deliveries",
  "reqSchedule.days": "{n} days",
  "reqSchedule.custom": "Other",
  "reqSchedule.firstDate": "1st expected delivery",
  "reqSchedule.n": "Shipment {n}",
  "reqSchedule.quantity": "Quantity",
  "reqSchedule.expected": "Date",
  "reqSchedule.add": "Shipment",
  "reqSchedule.remove": "Remove shipment {n}",
  "reqSchedule.total": "Total: {total} {unit}",
  "reqSchedule.off": "No schedule (single delivery)",
  "reqSchedule.gen.chooseProduct": "Choose the product in the field above",
  "reqSchedule.gen.noPieces":
    "The chosen product has no pieces per master carton in the catalog (nor in the master sheet): cartons cannot be converted into pieces. Enter the quantity in pieces or use “+ Purchase schedule” and enter the pieces of each round.",
  "reqSchedule.gen.noCarton":
    "The chosen product has no master carton CBM (nor carton dimensions) in the catalog: without it there is no container count. Cartons are split evenly across the schedules.",
  "reqSchedule.gen.noData":
    "The chosen product has neither pieces per master carton nor master carton CBM (nor carton dimensions) in the catalog: without them cartons cannot be converted into pieces and containers cannot be calculated. Enter the quantity in pieces or use “+ Purchase schedule” and enter the pieces of each round.",
  "reqSchedule.gen.outside":
    "Product not in the catalog: with no master carton on file, cartons cannot be converted into pieces. Enter the quantity in pieces or use “+ Purchase schedule” and enter the pieces of each round.",
  "reqSchedule.gen.regenerate":
    "The product changed: the schedule generated for the previous product was removed. Generate the schedule again.",
  "reqBatch.error.schedule_product_changed":
    "A product schedule was generated for another product. Generate the schedule again and send.",
  "reqSchedule.pieces": "Quantity (pieces)",
  "reqSchedule.piecesHint":
    "The product quantity, in pieces. Without a schedule, it goes in a single order.",
  "reqSchedule.piecesScheduledHint":
    "With a schedule, the quantity is the sum of the schedules.",
  "reqSchedule.summary": "{n} rounds every {days} days, starting {date}",
  "reqSchedule.requested": "Customer request: {quantity} {unit} on {date}",
  "reqSchedule.error.invalid":
    "Check the delivery schedule: quantities, interval and date.",
};

export const zh: Record<keyof typeof pt, string> = {
  "reqSchedule.toggle": "分批交货计划",
  "reqSchedule.ask": "需要分多次交货吗？",
  "reqSchedule.title": "采购计划",
  "reqSchedule.hint":
    "将数量按固定间隔分成多次交货，预计日期自动计算。Wellmix 和供应商将在采购单中按此计划执行。",
  "reqSchedule.interval": "交货间隔",
  "reqSchedule.days": "{n} 天",
  "reqSchedule.custom": "其他",
  "reqSchedule.firstDate": "首次预计交货",
  "reqSchedule.n": "第 {n} 批",
  "reqSchedule.quantity": "数量",
  "reqSchedule.expected": "日期",
  "reqSchedule.add": "批次",
  "reqSchedule.remove": "移除第 {n} 批",
  "reqSchedule.total": "合计：{total} {unit}",
  "reqSchedule.off": "不分批（一次交货）",
  "reqSchedule.gen.chooseProduct": "请在上方字段中选择产品",
  "reqSchedule.gen.noPieces":
    "所选产品在资料（及主资料表）中没有每外箱件数：无法把箱数换算成件数。请以件为单位填写数量，或使用“+ 采购计划”并填写每批的件数。",
  "reqSchedule.gen.noCarton":
    "所选产品在资料中没有外箱体积（也没有外箱尺寸）：无法计算集装箱。箱数在各批次间平均分配。",
  "reqSchedule.gen.noData":
    "所选产品在资料中既没有每外箱件数，也没有外箱体积（或外箱尺寸）：无法把箱数换算成件数，也无法计算集装箱。请以件为单位填写数量，或使用“+ 采购计划”并填写每批的件数。",
  "reqSchedule.gen.outside":
    "产品不在目录中：没有登记外箱，无法把箱数换算成件数。请以件为单位填写数量，或使用“+ 采购计划”并填写每批的件数。",
  "reqSchedule.gen.regenerate":
    "产品已更换：为原产品生成的计划已移除。请重新生成计划。",
  "reqBatch.error.schedule_product_changed":
    "某产品的计划是为另一个产品生成的。请重新生成计划后再发送。",
  "reqSchedule.pieces": "数量（件）",
  "reqSchedule.piecesHint": "产品数量，以件计。不分批时为单次订单。",
  "reqSchedule.piecesScheduledHint": "有交货计划时，数量为各批次之和。",
  "reqSchedule.summary": "共 {n} 批，每 {days} 天一批，自 {date} 起",
  "reqSchedule.requested": "客户需求：{quantity} {unit}，{date}",
  "reqSchedule.error.invalid": "请检查分批交货计划：数量、间隔和日期。",
};
