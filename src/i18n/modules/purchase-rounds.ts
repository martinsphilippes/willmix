/**
 * Programação de compra (docs/PURCHASE_SCHEDULE.md): rodadas de pedido na
 * escolha do grupo, o que o responsável pelo booking lê na solicitação e o
 * pedido pai com os pedidos filhos. Mesmas chaves em pt, en e zh.
 */
export const pt = {
  "supplierRequests.table.col.rounds": "Rodadas",
  "supplierRequests.table.col.perRound": "Peças por rodada",
  "purchaseRounds.form.toggle": "Programação de compra",
  "purchaseRounds.form.ask": "Comprar em rodadas nos próximos meses?",
  "purchaseRounds.form.hint":
    "Divida o total em rodadas de pedido com intervalo fixo, a partir da data da 1ª rodada. A solicitação leva a programação ao responsável pelo booking. Aprovada, o pedido de compra vira o pedido pai e cada rodada nasce como pedido filho no dia combinado, com a negociação e as artes do pai.",
  "purchaseRounds.form.interval": "Intervalo entre rodadas",
  "purchaseRounds.form.days": "{n} dias",
  "purchaseRounds.form.custom": "Outro",
  "purchaseRounds.form.firstDate": "Data da 1ª rodada",
  "purchaseRounds.form.n": "Rodada {n}",
  "purchaseRounds.form.quantity": "Peças",
  "purchaseRounds.form.expected": "Pedido em",
  "purchaseRounds.form.add": "Rodada",
  "purchaseRounds.form.remove": "Remover rodada {n}",
  "purchaseRounds.form.total": "Total: {total} {unit}",
  "purchaseRounds.form.off": "Sem programação (pedido único)",
  "purchaseRounds.form.quantityOff":
    "Com a programação de compra, a quantidade é a soma das rodadas.",

  "purchaseRounds.summary.title": "Programação de compra",
  "purchaseRounds.summary.same":
    "{rounds} rodadas de {perRound} peças · total {total} peças",
  "purchaseRounds.summary.mixed":
    "{rounds} rodadas ({list} peças) · total {total} peças",
  "purchaseRounds.summary.dates": "A cada {days} dias, de {first} a {last}",
  "purchaseRounds.summary.short": "{rounds} rodadas a cada {days} dias",
  "purchaseRounds.col.rounds": "Rodadas",
  "purchaseRounds.col.perRound": "Peças por rodada",
  "purchaseRounds.col.total": "Total",
  "purchaseRounds.col.round": "Rodada",
  "purchaseRounds.col.date": "Pedido em",
  "purchaseRounds.col.pieces": "Peças",
  "purchaseRounds.col.order": "Pedido",
  "purchaseRounds.single": "Pedido único",

  "purchaseRounds.order.parentTitle": "Programação de compra (pedido pai)",
  "purchaseRounds.order.parentHint":
    "Pedido pai: guarda o total, a negociação, as artes e o certificado. Ele não vai a contrato nem produção. Cada rodada nasce como pedido filho no dia combinado, com as artes e o certificado deste pedido e o seu próprio contrato.",
  "purchaseRounds.order.waiting": "Nasce em {date}",
  "purchaseRounds.order.waitingPrep":
    "Dia chegou: nasce quando a preparação deste pedido concluir",
  "purchaseRounds.order.child": "Pedido #{n}",
  "purchaseRounds.order.childOf": "Rodada {n} de {rounds} do pedido pai",
  "purchaseRounds.order.parentLink": "Abrir o pedido pai #{n}",
  "purchaseRounds.order.spawn": "Gerar as rodadas do dia",
  "purchaseRounds.order.spawnPending": "Gerando…",
  "purchaseRounds.order.spawned": "{n} rodada(s) viraram pedido.",
  "purchaseRounds.order.none": "Nenhuma rodada para gerar hoje.",

  "purchaseRounds.notify.child.subject":
    "Pedido de compra #{n}: rodada {round}",
  "purchaseRounds.notify.child.body":
    "A rodada {round} do pedido #{parent} virou o pedido #{n}, com a negociação, as artes e o certificado do pai. Falta o contrato da rodada.",

  "purchaseOrder.error.purchase_order_schedule_mixed":
    "Produtos com programação de compra só entram juntos no pedido quando as rodadas têm as mesmas datas (1ª data, intervalo e número de rodadas). Gere pedidos separados.",
  "purchaseOrder.error.purchase_order_schedule_qty":
    "Programação de compra inválida: cada rodada precisa de peças.",
  "orders.error.rounds_not_parent":
    "Este pedido não tem programação de compra.",
};

export const en: Record<keyof typeof pt, string> = {
  "supplierRequests.table.col.rounds": "Rounds",
  "supplierRequests.table.col.perRound": "Pieces per round",
  "purchaseRounds.form.toggle": "Purchase schedule",
  "purchaseRounds.form.ask": "Buy in rounds over the coming months?",
  "purchaseRounds.form.hint":
    "Split the total into order rounds at a fixed interval, starting on the 1st round date. The request carries the schedule to the booking owner. Once approved, the purchase order becomes the parent order and each round is born as a child order on the agreed day, with the parent's negotiation and artwork.",
  "purchaseRounds.form.interval": "Interval between rounds",
  "purchaseRounds.form.days": "{n} days",
  "purchaseRounds.form.custom": "Other",
  "purchaseRounds.form.firstDate": "1st round date",
  "purchaseRounds.form.n": "Round {n}",
  "purchaseRounds.form.quantity": "Pieces",
  "purchaseRounds.form.expected": "Order on",
  "purchaseRounds.form.add": "Round",
  "purchaseRounds.form.remove": "Remove round {n}",
  "purchaseRounds.form.total": "Total: {total} {unit}",
  "purchaseRounds.form.off": "No schedule (single order)",
  "purchaseRounds.form.quantityOff":
    "With a purchase schedule, the quantity is the sum of the rounds.",

  "purchaseRounds.summary.title": "Purchase schedule",
  "purchaseRounds.summary.same":
    "{rounds} rounds of {perRound} pieces · total {total} pieces",
  "purchaseRounds.summary.mixed":
    "{rounds} rounds ({list} pieces) · total {total} pieces",
  "purchaseRounds.summary.dates": "Every {days} days, from {first} to {last}",
  "purchaseRounds.summary.short": "{rounds} rounds every {days} days",
  "purchaseRounds.col.rounds": "Rounds",
  "purchaseRounds.col.perRound": "Pieces per round",
  "purchaseRounds.col.total": "Total",
  "purchaseRounds.col.round": "Round",
  "purchaseRounds.col.date": "Order on",
  "purchaseRounds.col.pieces": "Pieces",
  "purchaseRounds.col.order": "Order",
  "purchaseRounds.single": "Single order",

  "purchaseRounds.order.parentTitle": "Purchase schedule (parent order)",
  "purchaseRounds.order.parentHint":
    "Parent order: holds the total, the negotiation, the artwork and the certificate. It does not go to contract or production. Each round is born as a child order on the agreed day, with this order's artwork and certificate and its own contract.",
  "purchaseRounds.order.waiting": "Born on {date}",
  "purchaseRounds.order.waitingPrep":
    "Day reached: born when this order's preparation is done",
  "purchaseRounds.order.child": "Order #{n}",
  "purchaseRounds.order.childOf": "Round {n} of {rounds} of the parent order",
  "purchaseRounds.order.parentLink": "Open parent order #{n}",
  "purchaseRounds.order.spawn": "Generate today's rounds",
  "purchaseRounds.order.spawnPending": "Generating…",
  "purchaseRounds.order.spawned": "{n} round(s) became orders.",
  "purchaseRounds.order.none": "No round to generate today.",

  "purchaseRounds.notify.child.subject": "Purchase order #{n}: round {round}",
  "purchaseRounds.notify.child.body":
    "Round {round} of order #{parent} became order #{n}, with the parent's negotiation, artwork and certificate. The round's contract is pending.",

  "purchaseOrder.error.purchase_order_schedule_mixed":
    "Products with a purchase schedule only go in the same order when the rounds have the same dates (1st date, interval and number of rounds). Generate separate orders.",
  "purchaseOrder.error.purchase_order_schedule_qty":
    "Invalid purchase schedule: each round needs pieces.",
  "orders.error.rounds_not_parent": "This order has no purchase schedule.",
};

export const zh: Record<keyof typeof pt, string> = {
  "supplierRequests.table.col.rounds": "批数",
  "supplierRequests.table.col.perRound": "每批件数",
  "purchaseRounds.form.toggle": "采购计划",
  "purchaseRounds.form.ask": "未来几个月分批下单？",
  "purchaseRounds.form.hint":
    "从第 1 批日期开始，按固定间隔将总数分成多批订单。询单会把计划交给预订负责人。批准后，采购订单成为父订单，每一批在约定日期生成子订单，沿用父订单的谈判和设计稿。",
  "purchaseRounds.form.interval": "批次间隔",
  "purchaseRounds.form.days": "{n} 天",
  "purchaseRounds.form.custom": "其他",
  "purchaseRounds.form.firstDate": "第 1 批日期",
  "purchaseRounds.form.n": "第 {n} 批",
  "purchaseRounds.form.quantity": "件数",
  "purchaseRounds.form.expected": "下单日",
  "purchaseRounds.form.add": "批次",
  "purchaseRounds.form.remove": "删除第 {n} 批",
  "purchaseRounds.form.total": "合计：{total} {unit}",
  "purchaseRounds.form.off": "不分批（单次订单）",
  "purchaseRounds.form.quantityOff": "使用采购计划时，数量为各批之和。",

  "purchaseRounds.summary.title": "采购计划",
  "purchaseRounds.summary.same":
    "{rounds} 批，每批 {perRound} 件 · 合计 {total} 件",
  "purchaseRounds.summary.mixed": "{rounds} 批（{list} 件）· 合计 {total} 件",
  "purchaseRounds.summary.dates": "每 {days} 天一批，从 {first} 到 {last}",
  "purchaseRounds.summary.short": "{rounds} 批，每 {days} 天",
  "purchaseRounds.col.rounds": "批数",
  "purchaseRounds.col.perRound": "每批件数",
  "purchaseRounds.col.total": "合计",
  "purchaseRounds.col.round": "批次",
  "purchaseRounds.col.date": "下单日",
  "purchaseRounds.col.pieces": "件数",
  "purchaseRounds.col.order": "订单",
  "purchaseRounds.single": "单次订单",

  "purchaseRounds.order.parentTitle": "采购计划（父订单）",
  "purchaseRounds.order.parentHint":
    "父订单：保存总数、谈判、设计稿和证书，不进入合同和生产。每一批在约定日期生成子订单，沿用本订单的设计稿和证书，并有自己的合同。",
  "purchaseRounds.order.waiting": "{date} 生成",
  "purchaseRounds.order.waitingPrep": "日期已到：本订单准备完成后生成",
  "purchaseRounds.order.child": "订单 #{n}",
  "purchaseRounds.order.childOf": "父订单第 {n} 批（共 {rounds} 批）",
  "purchaseRounds.order.parentLink": "打开父订单 #{n}",
  "purchaseRounds.order.spawn": "生成今天的批次",
  "purchaseRounds.order.spawnPending": "生成中…",
  "purchaseRounds.order.spawned": "{n} 批已生成订单。",
  "purchaseRounds.order.none": "今天没有要生成的批次。",

  "purchaseRounds.notify.child.subject": "采购订单 #{n}：第 {round} 批",
  "purchaseRounds.notify.child.body":
    "订单 #{parent} 的第 {round} 批已生成订单 #{n}，沿用父订单的谈判、设计稿和证书。待签本批合同。",

  "purchaseOrder.error.purchase_order_schedule_mixed":
    "有采购计划的产品只有在批次日期相同（首批日期、间隔和批数）时才能放在同一订单。请分开生成订单。",
  "purchaseOrder.error.purchase_order_schedule_qty":
    "采购计划无效：每一批都需要件数。",
  "orders.error.rounds_not_parent": "此订单没有采购计划。",
};
