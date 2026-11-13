/**
 * Programação de compra (docs/PURCHASE_SCHEDULE.md): rodadas de pedido na
 * escolha do grupo, o que o responsável pelo booking lê na solicitação e o
 * pedido pai com os pedidos filhos. Mesmas chaves em pt, en e zh.
 */
export const pt = {
  "supplierRequests.table.col.rounds": "Programações",
  "supplierRequests.table.col.perRound": "Peças por programação",
  "purchaseRounds.form.toggle": "Programação de compra",
  "purchaseRounds.form.ask": "Comprar em rodadas nos próximos meses?",
  "purchaseRounds.form.hint":
    "Divida o total em rodadas de pedido com intervalo fixo, a partir da data da 1ª rodada. A solicitação leva a programação ao responsável pelo book. Aprovada, o pedido de compra vira o pedido pai e cada rodada nasce como pedido filho no dia combinado, com a negociação e as artes do pai.",
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
  "purchaseRounds.gen.title": "Gerar programação pela quantidade",
  "purchaseRounds.gen.hint":
    "Digite o total de caixas e o número de datas programadas: o total é dividido igualmente entre as rodadas, em caixas master inteiras. Os containers de cada rodada saem dessa conta. Em cada rodada, + Aumentar ou − Diminuir ajusta as peças para fechar o container (com 95% ou mais ele conta como cheio).",
  "purchaseRounds.gen.total": "Total de caixas",
  "purchaseRounds.gen.container": "Container",
  "purchaseRounds.gen.perRound": "Containers por rodada",
  "purchaseRounds.gen.perRoundHint":
    "Informativo: quantos containers cada rodada precisa. Sai das peças de cada rodada e muda quando uma rodada aumenta ou diminui.",
  "purchaseRounds.gen.perRoundRange": "{min} a {max}",
  "purchaseRounds.gen.totalField": "Containers no total",
  "purchaseRounds.gen.totalFieldHint":
    "Informativo: a soma dos containers de todas as rodadas. Muda quando uma rodada aumenta ou diminui.",
  "purchaseRounds.gen.rounds": "Programações",
  "purchaseRounds.gen.submit": "Gerar programação",
  "purchaseRounds.gen.calc": "Cálculo",
  "purchaseRounds.gen.item":
    "Item escolhido: {pcs} peças por caixa master · {cbm} m³ por caixa → {cartons} caixas ({pieces} peças) por {container}.",
  "purchaseRounds.gen.selectItem":
    "Selecione um item na tabela para gerar a programação de compra",
  "purchaseRounds.gen.noCarton":
    "O item escolhido não tem CBM da caixa (nem as medidas): sem ele não há conta de containers. As caixas são divididas igualmente pelas rodadas.",
  "purchaseRounds.gen.noPieces":
    "O item escolhido não tem peças por caixa master: não dá para converter caixas em peças. Marque outro item ou use “+ Programação de compra” e informe as peças de cada rodada.",
  "purchaseRounds.gen.tooBig":
    "A caixa master ({cbm} m³) não cabe no {container} ({cap} m³). Escolha um container maior.",
  "purchaseRounds.gen.errorTotal": "Digite o total de caixas (número inteiro).",
  "purchaseRounds.gen.errorRounds": "Informe de 1 a {max} programações.",
  "purchaseRounds.gen.result":
    "{rounds} rodada(s) · {cartons} caixas ({pieces} peças) · {cbm} m³ · {containers} container(s) {container}",
  "purchaseRounds.gen.extra":
    "Arredondado para caixas master inteiras: +{extra} peças.",
  "purchaseRounds.gen.reduced":
    "São só {cartons} caixa(s) master: a programação ficou com {rounds} rodada(s).",
  "purchaseRounds.gen.each":
    "Cada rodada: {cartons} caixas · {cbm} m³ = {n} container {container}, com {pct}% ocupado.",
  "purchaseRounds.gen.eachMany":
    "Cada rodada: {cartons} caixas · {cbm} m³ = {n} containers {container}, o último com {pct}% ocupado.",
  "purchaseRounds.gen.list": "Containers por rodada: {list}.",
  "purchaseRounds.gen.listItem": "{i}ª: {n} ({pct}% ocupado)",
  "purchaseRounds.gen.listItemMany": "{i}ª: {n} (o último {pct}% ocupado)",
  "purchaseRounds.gen.totalContainers": "Containers {container} no total: {n}.",
  "purchaseRounds.gen.load":
    "{cartons} cx · {cbm} m³ · {containers} × {container}",
  "purchaseRounds.gen.cardPartial": "{n} container: {pct}% ocupado",
  "purchaseRounds.gen.cardPartialMany": "{n} containers: o último com {pct}%",
  "purchaseRounds.gen.cardFull": "{n} container cheio",
  "purchaseRounds.gen.cardFullMany": "{n} containers cheios",
  "purchaseRounds.gen.cardFullMargin":
    "{n} container cheio ({pct}%, margem de 5%)",
  "purchaseRounds.gen.cardFullMarginMany":
    "{n} containers cheios (o último com {pct}%, margem de 5%)",
  "purchaseRounds.gen.up": "+ Aumentar {pieces}",
  "purchaseRounds.gen.upTo": "fecha {n} container",
  "purchaseRounds.gen.upToMany": "fecha {n} containers",
  "purchaseRounds.gen.down": "− Diminuir {pieces}",
  "purchaseRounds.gen.downTo": "fica com {n} container",
  "purchaseRounds.gen.downToMany": "fica com {n} containers",
  "purchaseRounds.gen.downOff": "− Diminuir",
  "purchaseRounds.gen.downOffWhy": "menos de 1 container",
  "purchaseRounds.gen.downOffMin": "mínimo de 1 container",

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
    "Split the total into order rounds at a fixed interval, starting on the 1st round date. The request carries the schedule to the book owner. Once approved, the purchase order becomes the parent order and each round is born as a child order on the agreed day, with the parent's negotiation and artwork.",
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
  "purchaseRounds.gen.title": "Generate the schedule from the quantity",
  "purchaseRounds.gen.hint":
    "Type the total cartons and the number of scheduled dates: the total is split evenly across the rounds, in whole master cartons. The containers of each round come from that calculation. In each round, + Increase or − Decrease adjusts the pieces to close the container (at 95% or more it counts as full).",
  "purchaseRounds.gen.total": "Total cartons",
  "purchaseRounds.gen.container": "Container",
  "purchaseRounds.gen.perRound": "Containers per round",
  "purchaseRounds.gen.perRoundHint":
    "For information: how many containers each round needs. It comes from the pieces of each round and changes when a round is increased or decreased.",
  "purchaseRounds.gen.perRoundRange": "{min} to {max}",
  "purchaseRounds.gen.totalField": "Containers in total",
  "purchaseRounds.gen.totalFieldHint":
    "For information: the sum of the containers of all rounds. It changes when a round is increased or decreased.",
  "purchaseRounds.gen.rounds": "Schedules",
  "purchaseRounds.gen.submit": "Generate schedule",
  "purchaseRounds.gen.calc": "Calculation",
  "purchaseRounds.gen.item":
    "Chosen item: {pcs} pieces per master carton · {cbm} m³ per carton → {cartons} cartons ({pieces} pieces) per {container}.",
  "purchaseRounds.gen.selectItem":
    "Select an item in the table to generate the purchase schedule",
  "purchaseRounds.gen.noCarton":
    "The chosen item has no carton CBM (nor dimensions): without it there is no container calculation. The cartons are split evenly across the rounds.",
  "purchaseRounds.gen.noPieces":
    "The chosen item has no pieces per master carton: cartons cannot be converted to pieces. Mark another item or use “+ Purchase schedule” and enter the pieces of each round.",
  "purchaseRounds.gen.tooBig":
    "The master carton ({cbm} m³) does not fit in the {container} ({cap} m³). Pick a larger container.",
  "purchaseRounds.gen.errorTotal": "Type the total cartons (a whole number).",
  "purchaseRounds.gen.errorRounds": "Enter 1 to {max} schedules.",
  "purchaseRounds.gen.result":
    "{rounds} round(s) · {cartons} cartons ({pieces} pieces) · {cbm} m³ · {containers} container(s) {container}",
  "purchaseRounds.gen.extra":
    "Rounded up to whole master cartons: +{extra} pieces.",
  "purchaseRounds.gen.reduced":
    "There are only {cartons} master carton(s): the schedule has {rounds} round(s).",
  "purchaseRounds.gen.each":
    "Each round: {cartons} cartons · {cbm} m³ = {n} {container} container, {pct}% used.",
  "purchaseRounds.gen.eachMany":
    "Each round: {cartons} cartons · {cbm} m³ = {n} {container} containers, the last one {pct}% used.",
  "purchaseRounds.gen.list": "Containers per round: {list}.",
  "purchaseRounds.gen.listItem": "#{i}: {n} ({pct}% used)",
  "purchaseRounds.gen.listItemMany": "#{i}: {n} (last one {pct}% used)",
  "purchaseRounds.gen.totalContainers": "{container} containers in total: {n}.",
  "purchaseRounds.gen.load":
    "{cartons} ctn · {cbm} m³ · {containers} × {container}",
  "purchaseRounds.gen.cardPartial": "{n} container: {pct}% used",
  "purchaseRounds.gen.cardPartialMany": "{n} containers: last one at {pct}%",
  "purchaseRounds.gen.cardFull": "{n} container full",
  "purchaseRounds.gen.cardFullMany": "{n} containers full",
  "purchaseRounds.gen.cardFullMargin": "{n} container full ({pct}%, 5% margin)",
  "purchaseRounds.gen.cardFullMarginMany":
    "{n} containers full (last one at {pct}%, 5% margin)",
  "purchaseRounds.gen.up": "+ Increase {pieces}",
  "purchaseRounds.gen.upTo": "closes {n} container",
  "purchaseRounds.gen.upToMany": "closes {n} containers",
  "purchaseRounds.gen.down": "− Decrease {pieces}",
  "purchaseRounds.gen.downTo": "leaves {n} container",
  "purchaseRounds.gen.downToMany": "leaves {n} containers",
  "purchaseRounds.gen.downOff": "− Decrease",
  "purchaseRounds.gen.downOffWhy": "less than 1 container",
  "purchaseRounds.gen.downOffMin": "minimum of 1 container",

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
    "从第 1 批日期开始，按固定间隔将总数分成多批订单。询单会把计划交给 Book 负责人。批准后，采购订单成为父订单，每一批在约定日期生成子订单，沿用父订单的谈判和设计稿。",
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
  "purchaseRounds.gen.title": "按数量生成采购计划",
  "purchaseRounds.gen.hint":
    "输入总箱数和计划日期数：总数按整箱外箱平均分到各批，每批的集装箱数由此算出。每批可用“+ 增加”或“− 减少”调整件数以装满集装箱（达到 95% 即视为装满）。",
  "purchaseRounds.gen.total": "总箱数",
  "purchaseRounds.gen.container": "集装箱",
  "purchaseRounds.gen.perRound": "每批集装箱数",
  "purchaseRounds.gen.perRoundHint":
    "仅供参考：每批需要的集装箱数，由每批件数算出，增加或减少某一批时随之变化。",
  "purchaseRounds.gen.perRoundRange": "{min} 至 {max}",
  "purchaseRounds.gen.totalField": "集装箱合计",
  "purchaseRounds.gen.totalFieldHint":
    "仅供参考：各批集装箱数之和，增加或减少某一批时随之变化。",
  "purchaseRounds.gen.rounds": "计划数",
  "purchaseRounds.gen.submit": "生成计划",
  "purchaseRounds.gen.calc": "计算",
  "purchaseRounds.gen.item":
    "所选产品：每外箱 {pcs} 件 · 每箱 {cbm} m³ → 每个 {container} {cartons} 箱（{pieces} 件）。",
  "purchaseRounds.gen.selectItem": "请在表格中选择一个商品以生成采购计划",
  "purchaseRounds.gen.noCarton":
    "所选产品没有外箱体积（也没有尺寸）：无法计算集装箱。箱数平均分配到各批。",
  "purchaseRounds.gen.noPieces":
    "所选产品没有每外箱件数：无法把箱数换算成件数。请选择其他产品，或使用“+ 采购计划”并填写每批的件数。",
  "purchaseRounds.gen.tooBig":
    "外箱（{cbm} m³）装不进 {container}（{cap} m³）。请选择更大的集装箱。",
  "purchaseRounds.gen.errorTotal": "请输入总箱数（整数）。",
  "purchaseRounds.gen.errorRounds": "请输入 1 到 {max} 个计划。",
  "purchaseRounds.gen.result":
    "{rounds} 批 · {cartons} 箱（{pieces} 件） · {cbm} m³ · {containers} 个 {container}",
  "purchaseRounds.gen.extra": "按整箱向上取整：多 {extra} 件。",
  "purchaseRounds.gen.reduced": "只有 {cartons} 个外箱：计划为 {rounds} 批。",
  "purchaseRounds.gen.each":
    "每批：{cartons} 箱 · {cbm} m³ = {n} 个 {container}，已用 {pct}%。",
  "purchaseRounds.gen.eachMany":
    "每批：{cartons} 箱 · {cbm} m³ = {n} 个 {container}，最后一个已用 {pct}%。",
  "purchaseRounds.gen.list": "每批集装箱数：{list}。",
  "purchaseRounds.gen.listItem": "第{i}批：{n}（已用 {pct}%）",
  "purchaseRounds.gen.listItemMany": "第{i}批：{n}（最后一个已用 {pct}%）",
  "purchaseRounds.gen.totalContainers": "{container} 合计：{n} 个。",
  "purchaseRounds.gen.load":
    "{cartons} 箱 · {cbm} m³ · {containers} × {container}",
  "purchaseRounds.gen.cardPartial": "{n} 个集装箱：已用 {pct}%",
  "purchaseRounds.gen.cardPartialMany": "{n} 个集装箱：最后一个已用 {pct}%",
  "purchaseRounds.gen.cardFull": "{n} 个集装箱已装满",
  "purchaseRounds.gen.cardFullMany": "{n} 个集装箱已装满",
  "purchaseRounds.gen.cardFullMargin": "{n} 个集装箱已装满（{pct}%，5% 容差）",
  "purchaseRounds.gen.cardFullMarginMany":
    "{n} 个集装箱已装满（最后一个 {pct}%，5% 容差）",
  "purchaseRounds.gen.up": "+ 增加 {pieces}",
  "purchaseRounds.gen.upTo": "装满 {n} 个集装箱",
  "purchaseRounds.gen.upToMany": "装满 {n} 个集装箱",
  "purchaseRounds.gen.down": "− 减少 {pieces}",
  "purchaseRounds.gen.downTo": "保留 {n} 个集装箱",
  "purchaseRounds.gen.downToMany": "保留 {n} 个集装箱",
  "purchaseRounds.gen.downOff": "− 减少",
  "purchaseRounds.gen.downOffWhy": "不足 1 个集装箱",
  "purchaseRounds.gen.downOffMin": "最少 1 个集装箱",

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
