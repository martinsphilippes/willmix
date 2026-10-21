/**
 * Dicionário do módulo "supplier-ranking" (disputa entre as cotações dos
 * fornecedores, com pesos nas Configurações): mesmas chaves em pt, en e zh.
 */
export const pt = {
  "ranking.title": "Disputa de fornecedores",
  "ranking.intro":
    "Cada cotação ganha de 0 a 100 pontos em cada critério, comparada com a melhor. A nota é a média pelos pesos das Configurações.",
  "ranking.winner": "Vencedor: {supplier}, com {points} pontos.",
  "ranking.tie":
    "Empate em {points} pontos entre {suppliers}: a Wellmix decide.",
  "ranking.why": "Ganhou por: {reasons}.",
  "ranking.lostIn": "Perdeu em: {criteria}.",
  "ranking.tiedIn": "Empate em: {criteria}.",
  "ranking.reason.price": "menor preço ({value} por peça)",
  "ranking.reason.delivery": "chega antes ({value})",
  "ranking.reason.production": "produz mais rápido ({value})",
  "ranking.reason.freight": "menor frete marítimo ({value} por peça)",
  "ranking.reason.moq": "MOQ atende a quantidade",
  "ranking.criterion.price": "Preço por peça",
  "ranking.criterion.delivery": "Entrega",
  "ranking.criterion.production": "Produção",
  "ranking.criterion.freight": "Frete marítimo por peça",
  "ranking.criterion.moq": "MOQ",
  "ranking.col.rank": "#",
  "ranking.col.total": "Nota",
  "ranking.weight": "peso {n}",
  "ranking.points": "{n} pts",
  "ranking.days": "{n} dias",
  "ranking.noValue": "sem dado",
  "ranking.moq.ok": "{moq} (atende)",
  "ranking.moq.over": "{moq} (acima de {qty})",
  "ranking.badge": "Vencedor",
  "ranking.settingsLink": "Ajustar os pesos",
  "ranking.none":
    "Sem dados para comparar: as cotações ainda não têm preço, prazo ou ficha.",
  "ranking.settings.title": "Disputa de fornecedores (pesos)",
  "ranking.settings.hint":
    "Quanto cada critério pesa na nota das cotações, de 0 a 100. Zero tira o critério da disputa.",
  "ranking.settings.price":
    "Preço por peça (na moeda das cotações; moedas diferentes, em R$ pelo câmbio do dia)",
  "ranking.settings.delivery":
    "Entrega (dias até chegar: início da produção, 1ª remessa e trânsito marítimo)",
  "ranking.settings.production": "Prazo de produção (dias)",
  "ranking.settings.freight": "Frete marítimo por peça",
  "ranking.settings.moq": "MOQ atende a quantidade pedida",
  "settings.error.ranking_weight_invalid":
    "Pesos da disputa inválidos: use números de 0 a 100, com pelo menos um acima de zero.",
};

export const en: Record<keyof typeof pt, string> = {
  "ranking.title": "Supplier contest",
  "ranking.intro":
    "Each quotation scores 0 to 100 points per criterion, compared with the best. The score is the average weighted by the Settings.",
  "ranking.winner": "Winner: {supplier}, with {points} points.",
  "ranking.tie": "Tie at {points} points between {suppliers}: Wellmix decides.",
  "ranking.why": "Won on: {reasons}.",
  "ranking.lostIn": "Lost on: {criteria}.",
  "ranking.tiedIn": "Tied on: {criteria}.",
  "ranking.reason.price": "lowest price ({value} per piece)",
  "ranking.reason.delivery": "arrives first ({value})",
  "ranking.reason.production": "fastest production ({value})",
  "ranking.reason.freight": "lowest ocean freight ({value} per piece)",
  "ranking.reason.moq": "MOQ fits the quantity",
  "ranking.criterion.price": "Price per piece",
  "ranking.criterion.delivery": "Delivery",
  "ranking.criterion.production": "Production",
  "ranking.criterion.freight": "Ocean freight per piece",
  "ranking.criterion.moq": "MOQ",
  "ranking.col.rank": "#",
  "ranking.col.total": "Score",
  "ranking.weight": "weight {n}",
  "ranking.points": "{n} pts",
  "ranking.days": "{n} days",
  "ranking.noValue": "no data",
  "ranking.moq.ok": "{moq} (fits)",
  "ranking.moq.over": "{moq} (above {qty})",
  "ranking.badge": "Winner",
  "ranking.settingsLink": "Adjust the weights",
  "ranking.none":
    "Nothing to compare: the quotations have no price, lead time or sheet yet.",
  "ranking.settings.title": "Supplier contest (weights)",
  "ranking.settings.hint":
    "How much each criterion weighs in the quotation score, from 0 to 100. Zero removes the criterion from the contest.",
  "ranking.settings.price":
    "Price per piece (in the quotations' currency; different currencies, in R$ at today's rate)",
  "ranking.settings.delivery":
    "Delivery (days to arrive: production start, first shipment and ocean transit)",
  "ranking.settings.production": "Production lead time (days)",
  "ranking.settings.freight": "Ocean freight per piece",
  "ranking.settings.moq": "MOQ fits the requested quantity",
  "settings.error.ranking_weight_invalid":
    "Invalid contest weights: use numbers from 0 to 100, at least one above zero.",
};

export const zh: Record<keyof typeof pt, string> = {
  "ranking.title": "供应商比选",
  "ranking.intro":
    "每份报价在每个标准上按与最佳值的比较得 0 到 100 分，总分按设置中的权重加权平均。",
  "ranking.winner": "胜出：{supplier}，{points} 分。",
  "ranking.tie": "{suppliers} 同为 {points} 分：由 Wellmix 决定。",
  "ranking.why": "胜出原因：{reasons}。",
  "ranking.lostIn": "落后项：{criteria}。",
  "ranking.tiedIn": "持平项：{criteria}。",
  "ranking.reason.price": "价格最低（每件 {value}）",
  "ranking.reason.delivery": "最早到货（{value}）",
  "ranking.reason.production": "生产最快（{value}）",
  "ranking.reason.freight": "海运费最低（每件 {value}）",
  "ranking.reason.moq": "起订量满足需求数量",
  "ranking.criterion.price": "每件价格",
  "ranking.criterion.delivery": "到货",
  "ranking.criterion.production": "生产",
  "ranking.criterion.freight": "每件海运费",
  "ranking.criterion.moq": "起订量",
  "ranking.col.rank": "#",
  "ranking.col.total": "总分",
  "ranking.weight": "权重 {n}",
  "ranking.points": "{n} 分",
  "ranking.days": "{n} 天",
  "ranking.noValue": "无数据",
  "ranking.moq.ok": "{moq}（满足）",
  "ranking.moq.over": "{moq}（高于 {qty}）",
  "ranking.badge": "胜出",
  "ranking.settingsLink": "调整权重",
  "ranking.none": "暂无可比较的数据：报价还没有价格、周期或采购单。",
  "ranking.settings.title": "供应商比选（权重）",
  "ranking.settings.hint":
    "各标准在报价总分中的权重，0 到 100。0 表示不参与比选。",
  "ranking.settings.price":
    "每件价格（按报价币种；币种不同时按当日汇率折合 R$）",
  "ranking.settings.delivery":
    "到货（到货天数：开始生产、第一批出货和海运时间）",
  "ranking.settings.production": "生产周期（天）",
  "ranking.settings.freight": "每件海运费",
  "ranking.settings.moq": "起订量满足需求数量",
  "settings.error.ranking_weight_invalid":
    "比选权重无效：请输入 0 到 100 的数字，且至少一项大于 0。",
};
