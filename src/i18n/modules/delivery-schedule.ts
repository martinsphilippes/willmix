/**
 * Programações como entregas ao cliente, nas telas TS - Trading Sales e
 * Venda - Encomenda (dono, 16/11/2026; docs/REQUEST_SCREENS.md, seção 6):
 * cada programação é uma entrega prevista ao cliente, e a data dela é a do
 * recebimento pelo cliente (não a de produção, embarque ou saída da
 * mercadoria). Só os textos: o conceito de programação, os cálculos e os
 * nomes técnicos não mudam. A Nova solicitação de Encomendas segue com os
 * textos de sempre.
 */
export const pt = {
  // Bloco do pedido (as datas valem para todos os produtos).
  "deliverySchedule.plan.title": "Programação de entregas ao cliente",
  "deliverySchedule.plan.hint":
    "Cada programação é uma entrega prevista ao cliente. As datas são as previstas de recebimento pelo cliente (não as de produção, embarque ou saída da mercadoria) e valem para todos os produtos do pedido; em cada produto, reparta a quantidade dele nessas entregas.",
  "deliverySchedule.plan.count": "Quantidade de entregas programadas",
  "deliverySchedule.plan.countHint":
    "1 = entrega única (o cliente recebe tudo de uma vez). Mudar a quantidade de entregas programadas reparte de novo a quantidade de cada produto.",
  "deliverySchedule.plan.single":
    "Entrega única: o cliente recebe cada produto de uma vez, numa quantidade só.",
  "deliverySchedule.interval": "Intervalo entre recebimentos previstos",
  "deliverySchedule.firstDate": "Data prevista do 1º recebimento",
  "deliverySchedule.n": "Programação {n}",
  "deliverySchedule.receipt": "Recebimento previsto",
  "deliverySchedule.plan.dates": "Datas previstas de recebimento pelo cliente",
  "deliverySchedule.plan.minDate":
    "O 1º recebimento pelo cliente pode ser a partir de {date} (lançamento em {launch} + 120 dias).",
  "deliverySchedule.plan.tooSoon":
    "O 1º recebimento previsto precisa ser a partir de {date} (lançamento + 120 dias).",
  "deliverySchedule.plan.datesHint":
    "Toque numa data para trocar o recebimento previsto só daquela programação. A data trocada fica fixada: mudar o intervalo recalcula só as outras.",
  "deliverySchedule.plan.edit":
    "Trocar a data prevista de recebimento da Programação {n}",
  "deliverySchedule.plan.unpin":
    "Voltar à data automática de recebimento da Programação {n}",
  "deliverySchedule.plan.issue":
    "Programação {n}: o recebimento previsto precisa ser depois do da Programação {prev} ({date}).",
  // Cada produto (a quantidade dele em cada entrega).
  "deliverySchedule.item.toggle": "Programação de entregas ao cliente",
  "deliverySchedule.item.ask": "Entregar ao cliente em mais de uma data?",
  "deliverySchedule.item.hint":
    "Divida o total nas entregas programadas ao cliente, com intervalo fixo a partir da data prevista do 1º recebimento. Cada programação é uma entrega prevista ao cliente.",
  "deliverySchedule.item.add": "Programação de entrega",
  "deliverySchedule.item.remove": "Remover a programação {n}",
  "deliverySchedule.item.off": "Entrega única (sem programação)",
  "deliverySchedule.item.piecesHint":
    "Digite as caixas: as peças saem delas (caixas × peças por caixa master). Sem programação, o cliente recebe tudo numa entrega única.",
  "deliverySchedule.item.piecesScheduledHint":
    "Com as entregas programadas, a quantidade é a soma das programações (uma por recebimento previsto).",
  // Gerador pela quantidade (caixas e containers de cada entrega).
  "deliverySchedule.gen.title": "Gerar as entregas programadas pela quantidade",
  "deliverySchedule.gen.hint":
    "Digite o total de caixas e a quantidade de entregas programadas: o total é dividido igualmente entre as entregas previstas ao cliente, em caixas master inteiras. Os containers de cada programação saem dessa conta. Em cada programação, + Aumentar ou − Diminuir ajusta as peças para fechar o container (com 95% ou mais ele conta como cheio).",
  "deliverySchedule.gen.rounds": "Quantidade de entregas programadas",
  "deliverySchedule.gen.perRound": "Containers por entrega programada",
  "deliverySchedule.gen.perRoundHint":
    "Informativo: quantos containers cada entrega programada precisa. Sai das peças de cada programação e muda quando uma programação aumenta ou diminui.",
  "deliverySchedule.gen.totalFieldHint":
    "Informativo: a soma dos containers de todas as entregas programadas. Muda quando uma programação aumenta ou diminui.",
  "deliverySchedule.gen.submit": "Gerar as entregas programadas",
  "deliverySchedule.gen.errorRounds":
    "Informe de 1 a {max} entregas programadas.",
  "deliverySchedule.gen.result":
    "{rounds} entrega(s) programada(s) · {cartons} caixas ({pieces} peças) · {cbm} m³ · ocupação efetiva de {containers} container(s) {container}",
  "deliverySchedule.gen.short":
    "Faltam {missing} caixa(s) master para dar pelo menos 1 caixa a cada uma das {rounds} entregas programadas: o total tem {cartons} caixa(s).",
  "deliverySchedule.gen.shortDown": "Reduzir para {rounds} entregas",
  "deliverySchedule.gen.shortDownOne": "Reduzir para 1 entrega",
  "deliverySchedule.gen.shortKeep": "Manter {rounds} entregas",
  "deliverySchedule.gen.each":
    "Cada entrega programada: {cartons} caixas · {cbm} m³ → {n} container {container} previsto, com {pct}% ocupado.",
  "deliverySchedule.gen.eachMany":
    "Cada entrega programada: {cartons} caixas · {cbm} m³ → {n} containers {container} previstos, o último com {pct}% ocupado.",
  "deliverySchedule.gen.list":
    "Containers previstos por entrega programada: {list}.",
  "deliverySchedule.gen.noPieces":
    "O produto escolhido não tem peças por caixa master no cadastro (nem na ficha mestre): não dá para converter caixas em peças. Informe a quantidade em peças ou use “+ Programação de entrega” e informe as peças de cada entrega.",
  "deliverySchedule.gen.noCarton":
    "O produto escolhido não tem o CBM da caixa master (nem as medidas da caixa) no cadastro: sem ele não há conta de containers. As caixas são divididas igualmente pelas entregas programadas.",
  "deliverySchedule.gen.noData":
    "O produto escolhido não tem peças por caixa master nem o CBM da caixa master (nem as medidas da caixa) no cadastro: sem eles não dá para converter caixas em peças nem calcular containers. Informe a quantidade em peças ou use “+ Programação de entrega” e informe as peças de cada entrega.",
  "deliverySchedule.gen.outside":
    "Produto fora do catálogo: sem caixa master cadastrada, não dá para converter caixas em peças. Informe a quantidade em peças ou use “+ Programação de entrega” e informe as peças de cada entrega.",
  "deliverySchedule.gen.regenerate":
    "O produto mudou: as entregas programadas geradas para o produto anterior saíram. Gere de novo.",
  "deliverySchedule.gen.roundsFixed":
    "A quantidade de entregas programadas é a do pedido (bloco Programação de entregas ao cliente).",
  "deliverySchedule.res.title": "Resultado das entregas programadas",
  "deliverySchedule.res.perRound": "Por entrega programada",
  // Composição de containers (uma coluna por programação).
  "deliverySchedule.composition.hint":
    "Ocupação de cada container em cada programação (uma entrega prevista ao cliente; a data no título da coluna é o recebimento previsto), somando os produtos do pedido em caixas master inteiras, pelo CBM. Abra a linha para ver cada produto.",
  "deliverySchedule.composition.roundDate": "Recebimento previsto: {date}",
  // Recusas do envio que falam das datas.
  "deliverySchedule.error.schedule_too_soon":
    "O 1º recebimento previsto pelo cliente precisa ser a partir de {date}: 120 dias depois do lançamento da solicitação.",
  "deliverySchedule.error.schedule_out_of_order":
    "As datas previstas de recebimento estão fora de ordem: cada programação precisa ser recebida depois da anterior.",
  "deliverySchedule.error.schedule_mismatch":
    "As programações dos produtos não batem: as datas previstas de recebimento são do pedido e precisam ser as mesmas em todos os produtos.",
  "deliverySchedule.error.schedule_product_changed":
    "As entregas programadas de um produto foram geradas para outro produto. Gere de novo e envie.",
};

export const en: typeof pt = {
  "deliverySchedule.plan.title": "Customer delivery schedule",
  "deliverySchedule.plan.hint":
    "Each schedule is a planned delivery to the customer. The dates are the customer's expected receipt dates (not production, shipment or dispatch dates) and apply to every product in the order; in each product, split its quantity across these deliveries.",
  "deliverySchedule.plan.count": "Number of scheduled deliveries",
  "deliverySchedule.plan.countHint":
    "1 = single delivery (the customer receives everything at once). Changing the number of scheduled deliveries splits each product's quantity again.",
  "deliverySchedule.plan.single":
    "Single delivery: the customer receives each product at once, in a single quantity.",
  "deliverySchedule.interval": "Interval between expected receipts",
  "deliverySchedule.firstDate": "Expected date of the 1st receipt",
  "deliverySchedule.n": "Schedule {n}",
  "deliverySchedule.receipt": "Expected receipt",
  "deliverySchedule.plan.dates": "Customer's expected receipt dates",
  "deliverySchedule.plan.minDate":
    "The customer's 1st receipt can be from {date} (launched on {launch} + 120 days).",
  "deliverySchedule.plan.tooSoon":
    "The 1st expected receipt must be from {date} (launch + 120 days).",
  "deliverySchedule.plan.datesHint":
    "Tap a date to change the expected receipt of that schedule only. The changed date stays pinned: changing the interval recalculates only the others.",
  "deliverySchedule.plan.edit":
    "Change the expected receipt date of Schedule {n}",
  "deliverySchedule.plan.unpin":
    "Back to the automatic receipt date of Schedule {n}",
  "deliverySchedule.plan.issue":
    "Schedule {n}: the expected receipt must be after that of Schedule {prev} ({date}).",
  "deliverySchedule.item.toggle": "Customer delivery schedule",
  "deliverySchedule.item.ask": "Deliver to the customer on more than one date?",
  "deliverySchedule.item.hint":
    "Split the total across the deliveries scheduled to the customer, at a fixed interval from the expected date of the 1st receipt. Each schedule is a planned delivery to the customer.",
  "deliverySchedule.item.add": "Delivery schedule",
  "deliverySchedule.item.remove": "Remove schedule {n}",
  "deliverySchedule.item.off": "Single delivery (no schedule)",
  "deliverySchedule.item.piecesHint":
    "Type the cartons: the pieces come from them (cartons × pieces per master carton). Without a schedule, the customer receives everything in a single delivery.",
  "deliverySchedule.item.piecesScheduledHint":
    "With scheduled deliveries, the quantity is the sum of the schedules (one per expected receipt).",
  "deliverySchedule.gen.title":
    "Generate the scheduled deliveries from the quantity",
  "deliverySchedule.gen.hint":
    "Type the total cartons and the number of scheduled deliveries: the total is split evenly across the deliveries expected by the customer, in whole master cartons. Each schedule's containers come from this calculation. In each schedule, + Increase or − Decrease adjusts the pieces to fill the container (95% or more counts as full).",
  "deliverySchedule.gen.rounds": "Number of scheduled deliveries",
  "deliverySchedule.gen.perRound": "Containers per scheduled delivery",
  "deliverySchedule.gen.perRoundHint":
    "For information: how many containers each scheduled delivery needs. It comes from each schedule's pieces and changes when a schedule increases or decreases.",
  "deliverySchedule.gen.totalFieldHint":
    "For information: the sum of the containers of all scheduled deliveries. It changes when a schedule increases or decreases.",
  "deliverySchedule.gen.submit": "Generate the scheduled deliveries",
  "deliverySchedule.gen.errorRounds": "Enter 1 to {max} scheduled deliveries.",
  "deliverySchedule.gen.result":
    "{rounds} scheduled delivery(ies) · {cartons} cartons ({pieces} pieces) · {cbm} m³ · effective load of {containers} {container} container(s)",
  "deliverySchedule.gen.short":
    "{missing} master carton(s) missing to give at least 1 carton to each of the {rounds} scheduled deliveries: the total has {cartons} carton(s).",
  "deliverySchedule.gen.shortDown": "Reduce to {rounds} deliveries",
  "deliverySchedule.gen.shortDownOne": "Reduce to 1 delivery",
  "deliverySchedule.gen.shortKeep": "Keep {rounds} deliveries",
  "deliverySchedule.gen.each":
    "Each scheduled delivery: {cartons} cartons · {cbm} m³ → {n} {container} container expected, {pct}% full.",
  "deliverySchedule.gen.eachMany":
    "Each scheduled delivery: {cartons} cartons · {cbm} m³ → {n} {container} containers expected, the last one {pct}% full.",
  "deliverySchedule.gen.list":
    "Containers expected per scheduled delivery: {list}.",
  "deliverySchedule.gen.noPieces":
    "The chosen product has no pieces per master carton in its record (nor in the master sheet): cartons cannot be converted into pieces. Enter the quantity in pieces or use “+ Delivery schedule” and enter the pieces of each delivery.",
  "deliverySchedule.gen.noCarton":
    "The chosen product has no master carton CBM (nor the carton measurements) in its record: without it there is no container calculation. The cartons are split evenly across the scheduled deliveries.",
  "deliverySchedule.gen.noData":
    "The chosen product has neither pieces per master carton nor the master carton CBM (nor the carton measurements) in its record: without them cartons cannot be converted into pieces and containers cannot be calculated. Enter the quantity in pieces or use “+ Delivery schedule” and enter the pieces of each delivery.",
  "deliverySchedule.gen.outside":
    "Product outside the catalog: with no master carton on record, cartons cannot be converted into pieces. Enter the quantity in pieces or use “+ Delivery schedule” and enter the pieces of each delivery.",
  "deliverySchedule.gen.regenerate":
    "The product changed: the scheduled deliveries generated for the previous product were removed. Generate them again.",
  "deliverySchedule.gen.roundsFixed":
    "The number of scheduled deliveries is the order's (Customer delivery schedule block).",
  "deliverySchedule.res.title": "Scheduled deliveries result",
  "deliverySchedule.res.perRound": "Per scheduled delivery",
  "deliverySchedule.composition.hint":
    "Load of each container in each schedule (a planned delivery to the customer; the date in the column header is the expected receipt), adding up the order's products in whole master cartons, by CBM. Open the row to see each product.",
  "deliverySchedule.composition.roundDate": "Expected receipt: {date}",
  "deliverySchedule.error.schedule_too_soon":
    "The customer's 1st expected receipt must be from {date}: 120 days after the request was launched.",
  "deliverySchedule.error.schedule_out_of_order":
    "The expected receipt dates are out of order: each schedule must be received after the previous one.",
  "deliverySchedule.error.schedule_mismatch":
    "The products' schedules do not match: the expected receipt dates belong to the order and must be the same for every product.",
  "deliverySchedule.error.schedule_product_changed":
    "A product's scheduled deliveries were generated for another product. Generate them again and send.",
};

export const zh: typeof pt = {
  "deliverySchedule.plan.title": "客户交货计划",
  "deliverySchedule.plan.hint":
    "每个计划是一次向客户的预计交货。日期为客户的预计收货日期（不是生产、装运或发货日期），适用于订单中的所有产品；在每个产品中，把其数量分配到这些交货中。",
  "deliverySchedule.plan.count": "计划交货次数",
  "deliverySchedule.plan.countHint":
    "1 = 一次交货（客户一次收到全部）。修改计划交货次数会重新分配每个产品的数量。",
  "deliverySchedule.plan.single":
    "一次交货：客户一次收到每个产品，只有一个数量。",
  "deliverySchedule.interval": "预计收货间隔",
  "deliverySchedule.firstDate": "第 1 次预计收货日期",
  "deliverySchedule.n": "计划 {n}",
  "deliverySchedule.receipt": "预计收货",
  "deliverySchedule.plan.dates": "客户预计收货日期",
  "deliverySchedule.plan.minDate":
    "客户第 1 次收货最早为 {date}（下单日 {launch} + 120 天）。",
  "deliverySchedule.plan.tooSoon":
    "第 1 次预计收货须不早于 {date}（下单 + 120 天）。",
  "deliverySchedule.plan.datesHint":
    "点击日期只修改该计划的预计收货。修改后的日期会固定：修改间隔只重算其他日期。",
  "deliverySchedule.plan.edit": "修改计划 {n} 的预计收货日期",
  "deliverySchedule.plan.unpin": "恢复计划 {n} 的自动收货日期",
  "deliverySchedule.plan.issue":
    "计划 {n}：预计收货须晚于计划 {prev}（{date}）。",
  "deliverySchedule.item.toggle": "客户交货计划",
  "deliverySchedule.item.ask": "分多个日期向客户交货？",
  "deliverySchedule.item.hint":
    "把总数分配到向客户计划的各次交货中，从第 1 次预计收货日期起按固定间隔。每个计划是一次向客户的预计交货。",
  "deliverySchedule.item.add": "交货计划",
  "deliverySchedule.item.remove": "删除计划 {n}",
  "deliverySchedule.item.off": "一次交货（无计划）",
  "deliverySchedule.item.piecesHint":
    "输入箱数：件数由箱数得出（箱数 × 每外箱件数）。没有计划时，客户一次收到全部。",
  "deliverySchedule.item.piecesScheduledHint":
    "有计划交货时，数量为各计划之和（每次预计收货一个）。",
  "deliverySchedule.gen.title": "按数量生成计划交货",
  "deliverySchedule.gen.hint":
    "输入总箱数和计划交货次数：总数按整外箱平均分配到客户预计的各次交货。每个计划的集装箱由此计算。在每个计划中，+ 增加 或 − 减少 会调整件数以装满集装箱（95% 及以上视为装满）。",
  "deliverySchedule.gen.rounds": "计划交货次数",
  "deliverySchedule.gen.perRound": "每次计划交货的集装箱",
  "deliverySchedule.gen.perRoundHint":
    "仅供参考：每次计划交货需要多少集装箱。由每个计划的件数得出，计划增减时随之变化。",
  "deliverySchedule.gen.totalFieldHint":
    "仅供参考：所有计划交货的集装箱之和。计划增减时随之变化。",
  "deliverySchedule.gen.submit": "生成计划交货",
  "deliverySchedule.gen.errorRounds": "请输入 1 到 {max} 次计划交货。",
  "deliverySchedule.gen.result":
    "{rounds} 次计划交货 · {cartons} 箱（{pieces} 件）· {cbm} m³ · 实际占用 {containers} 个 {container} 集装箱",
  "deliverySchedule.gen.short":
    "还差 {missing} 个外箱，才能让 {rounds} 次计划交货每次至少 1 箱：总数为 {cartons} 箱。",
  "deliverySchedule.gen.shortDown": "减少到 {rounds} 次交货",
  "deliverySchedule.gen.shortDownOne": "减少到 1 次交货",
  "deliverySchedule.gen.shortKeep": "保持 {rounds} 次交货",
  "deliverySchedule.gen.each":
    "每次计划交货：{cartons} 箱 · {cbm} m³ → 预计 {n} 个 {container} 集装箱，占用 {pct}%。",
  "deliverySchedule.gen.eachMany":
    "每次计划交货：{cartons} 箱 · {cbm} m³ → 预计 {n} 个 {container} 集装箱，最后一个占用 {pct}%。",
  "deliverySchedule.gen.list": "每次计划交货的预计集装箱：{list}。",
  "deliverySchedule.gen.noPieces":
    "所选产品的资料（及主表）中没有每外箱件数：无法把箱数换算成件数。请按件数输入数量，或使用“+ 交货计划”并输入每次交货的件数。",
  "deliverySchedule.gen.noCarton":
    "所选产品的资料中没有外箱 CBM（也没有外箱尺寸）：无法计算集装箱。箱数平均分配到各次计划交货。",
  "deliverySchedule.gen.noData":
    "所选产品的资料中既没有每外箱件数，也没有外箱 CBM（或外箱尺寸）：无法换算件数，也无法计算集装箱。请按件数输入数量，或使用“+ 交货计划”并输入每次交货的件数。",
  "deliverySchedule.gen.outside":
    "目录外产品：没有登记外箱，无法把箱数换算成件数。请按件数输入数量，或使用“+ 交货计划”并输入每次交货的件数。",
  "deliverySchedule.gen.regenerate":
    "产品已更换：为上一个产品生成的计划交货已移除。请重新生成。",
  "deliverySchedule.gen.roundsFixed":
    "计划交货次数以订单为准（客户交货计划区块）。",
  "deliverySchedule.res.title": "计划交货结果",
  "deliverySchedule.res.perRound": "每次计划交货",
  "deliverySchedule.composition.hint":
    "每个计划中各集装箱的占用（一次向客户的预计交货；列标题中的日期为预计收货日期），按整外箱和 CBM 汇总订单产品。展开该行可查看每个产品。",
  "deliverySchedule.composition.roundDate": "预计收货：{date}",
  "deliverySchedule.error.schedule_too_soon":
    "客户第 1 次预计收货须不早于 {date}：需求单下单后 120 天。",
  "deliverySchedule.error.schedule_out_of_order":
    "预计收货日期顺序有误：每个计划须晚于上一个计划收货。",
  "deliverySchedule.error.schedule_mismatch":
    "各产品的计划不一致：预计收货日期属于订单，所有产品必须相同。",
  "deliverySchedule.error.schedule_product_changed":
    "某产品的计划交货是为另一个产品生成的。请重新生成后再提交。",
};
