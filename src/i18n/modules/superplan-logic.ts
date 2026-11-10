/**
 * Dicionário do módulo "superplan-logic" (pedido do dono em 10/11/2026): a
 * lógica do cálculo do Superplan escrita na própria tela, passo a passo, na
 * ordem em que a conta é feita (src/lib/superplan.ts), com os percentuais em
 * uso. Mesmas chaves em pt, en e zh.
 */
export const pt = {
  "superplanLogic.link": "Como a conta é feita",
  "superplanLogic.intro":
    "A conta é sempre a de um container cheio do produto. O Superplan segue estes passos, nesta ordem, e o resultado ao lado sai deles. Os percentuais abaixo são os que estão valendo agora.",
  "superplanLogic.formula": "Conta",
  "superplanLogic.s1.title": "Quantas peças cabem no container",
  "superplanLogic.s1.a":
    "Pelo volume: capacidade do container ÷ volume da caixa.",
  "superplanLogic.s1.b":
    "Pelo peso: peso máximo do container ÷ (peso bruto por peça × peças por caixa).",
  "superplanLogic.s1.c":
    "Vale o menor dos dois, arredondado para baixo: só entram caixas inteiras.",
  "superplanLogic.s1.d":
    "Sem peso bruto na ficha, usa o peso líquido + {gross}% (bruto estimado). Sem peso nenhum, só o volume limita.",
  "superplanLogic.s1.f": "Peças = caixas que cabem × peças por caixa",
  "superplanLogic.s2.title": "Quanto custa a compra",
  "superplanLogic.s2.a":
    "Preço em RMB vira dólar: preço ÷ quantos RMB vale 1 dólar.",
  "superplanLogic.s2.b":
    "A compra é paga ao fornecedor no dólar futuro: dólar oficial + R$ {spread}.",
  "superplanLogic.s2.f1": "FOB (US$) = preço por peça em dólar × peças",
  "superplanLogic.s2.f2": "Compra (R$) = FOB × dólar futuro",
  "superplanLogic.s3.title": "Frete marítimo e seguro",
  "superplanLogic.s3.a":
    "O frete é pago a um câmbio {freightFx}% acima do dólar oficial.",
  "superplanLogic.s3.b": "O seguro é {insurance}% do valor da compra (FOB).",
  "superplanLogic.s3.f1":
    "Frete (R$) = frete em US$ × dólar oficial × (1 + {freightFx}%)",
  "superplanLogic.s3.f2": "Seguro (R$) = FOB × {insurance}% × dólar oficial",
  "superplanLogic.s4.title": "Impostos da importação",
  "superplanLogic.s4.a":
    "A base é o valor aduaneiro, calculado sobre o valor real da compra. Entram nele as despesas aduaneiras: {customs}.",
  "superplanLogic.s4.b":
    "II e IPI são os do NCM do produto (campos II e IPI da Compra).",
  "superplanLogic.s4.c":
    "ICMS da importação: {icmsImport}. Quando há, é calculado por dentro.",
  "superplanLogic.s4.f1":
    "Valor aduaneiro = (FOB + frete + seguro, em US$) × dólar oficial + despesas aduaneiras",
  "superplanLogic.s4.f2": "II = valor aduaneiro × II%",
  "superplanLogic.s4.f3": "IPI = (valor aduaneiro + II) × IPI%",
  "superplanLogic.s4.f4":
    "PIS = valor aduaneiro × {pisImport}%   ·   COFINS = valor aduaneiro × {cofinsImport}%",
  "superplanLogic.s4.f5": "AFRMM = frete (R$) × {afrmm}% + R$ {fixed}",
  "superplanLogic.s4.f6":
    "ICMS = (valor aduaneiro + II + IPI + PIS + COFINS + AFRMM) ÷ (1 − ICMS%) × ICMS%",
  "superplanLogic.icms.none": "não configurado (não entra na conta)",
  "superplanLogic.icms.pct": "{pct}%",
  "superplanLogic.s5.title": "Custo do container e custo por peça",
  "superplanLogic.s5.a":
    "Despesas no Brasil, por container: R$ {expenses} ({list}). Cada uma entra uma vez só.",
  "superplanLogic.s5.b":
    "Despesas na China = (FOB × comissão da trading % + outras despesas em RMB ÷ RMB por dólar) × dólar futuro.",
  "superplanLogic.s5.f1":
    "Custo do container = compra + frete + seguro + II + IPI + PIS + COFINS + AFRMM + ICMS + despesas no Brasil + frete rodoviário + despesas na China",
  "superplanLogic.s5.f2": "Custo por peça = custo do container ÷ peças",
  "superplanLogic.s6.title": "Preços",
  "superplanLogic.s6.a":
    "O markup, a comissão, as despesas administrativas, a meta de lucro e o WD vêm do tipo de negócio escolhido.",
  "superplanLogic.s6.f1":
    "Preço mínimo = custo por peça × markup do tipo de negócio",
  "superplanLogic.s6.f2":
    "Tabela = mínimo × {table}   ·   Atacado = mínimo × {wholesale}   ·   Loja = mínimo × {retail}",
  "superplanLogic.s6.f3": "WD = mínimo × (1 + WD% do tipo de negócio)",
  "superplanLogic.s6.f4":
    "Com entrega = mínimo + frete de entrega no cliente ÷ peças",
  "superplanLogic.s7.title": "Lucro na venda",
  "superplanLogic.s7.a":
    "O lucro é calculado no preço mínimo ou, se você preencher, no preço de venda a testar.",
  "superplanLogic.s7.b":
    "Os impostos da venda incidem sobre o preço cheio. O IPI, o ICMS, o PIS e a COFINS pagos na importação entram como crédito, por peça.",
  "superplanLogic.s7.f1": "Base = preço × (1 − IPI%)",
  "superplanLogic.s7.f2":
    "IPI = base × IPI% − crédito   ·   ICMS = base × {icms}% − crédito",
  "superplanLogic.s7.f3":
    "PIS = (base − ICMS da venda − IPI a pagar) × {pis}% − crédito   ·   COFINS = a mesma base × {cofins}% − crédito",
  "superplanLogic.s7.f4": "IR = base × {ir}%   ·   CSLL = base × {csll}%",
  "superplanLogic.s7.f5":
    "Comissão = preço × comissão%   ·   Despesas administrativas = preço × despesas%",
  "superplanLogic.s7.f6":
    "Lucro por peça = preço − custo por peça − impostos da venda − comissão − despesas administrativas",
  "superplanLogic.s7.f7":
    "Lucro % = lucro por peça ÷ preço   ·   Lucro do container = lucro por peça × peças",
  "superplanLogic.s8.title": "O resultado: verde, amarelo ou vermelho",
  "superplanLogic.s8.a":
    "Verde (viável): o lucro % é igual ou maior que a meta do tipo de negócio.",
  "superplanLogic.s8.b": "Amarelo: há lucro, mas abaixo da meta.",
  "superplanLogic.s8.c": "Vermelho: prejuízo (lucro zero ou negativo).",
  "superplanLogic.s8.d":
    "Preço para bater a meta: o preço em que o lucro % fica igual à meta. O markup necessário é esse preço ÷ custo por peça. Quando impostos e despesas passam da margem possível, esse preço não existe.",
  "superplanLogic.sources.title": "De onde vêm os números",
  "superplanLogic.sources.a":
    "Do produto (ficha do Booking): preço, moeda, peças por caixa, pesos, volume da caixa e o NCM (II e IPI).",
  "superplanLogic.sources.b":
    "Do sistema: dólar oficial do dia, RMB por dólar, containers e os tributos da importação (seguro, PIS, COFINS e ICMS).",
  "superplanLogic.sources.c":
    "Dos Parâmetros do Superplan, logo abaixo: tipos de negócio, despesas, fretes, câmbio do frete, AFRMM, fatores de preço e impostos da venda.",
};

export const en: Record<keyof typeof pt, string> = {
  "superplanLogic.link": "How the calculation works",
  "superplanLogic.intro":
    "The calculation is always for a full container of the product. Superplan follows these steps, in this order, and the result beside comes from them. The rates below are the ones in force now.",
  "superplanLogic.formula": "Formula",
  "superplanLogic.s1.title": "How many pieces fit in the container",
  "superplanLogic.s1.a": "By volume: container capacity ÷ carton volume.",
  "superplanLogic.s1.b":
    "By weight: container maximum weight ÷ (gross weight per piece × pieces per carton).",
  "superplanLogic.s1.c":
    "The smaller of the two counts, rounded down: only whole cartons go in.",
  "superplanLogic.s1.d":
    "Without a gross weight on the sheet, it uses the net weight + {gross}% (estimated gross). With no weight at all, only volume limits.",
  "superplanLogic.s1.f": "Pieces = cartons that fit × pieces per carton",
  "superplanLogic.s2.title": "What the purchase costs",
  "superplanLogic.s2.a":
    "A price in RMB becomes dollars: price ÷ how many RMB one dollar is worth.",
  "superplanLogic.s2.b":
    "The purchase is paid to the supplier at the forward dollar: official dollar + R$ {spread}.",
  "superplanLogic.s2.f1": "FOB (US$) = price per piece in dollars × pieces",
  "superplanLogic.s2.f2": "Purchase (R$) = FOB × forward dollar",
  "superplanLogic.s3.title": "Sea freight and insurance",
  "superplanLogic.s3.a":
    "Freight is paid at a rate {freightFx}% above the official dollar.",
  "superplanLogic.s3.b": "Insurance is {insurance}% of the purchase (FOB).",
  "superplanLogic.s3.f1":
    "Freight (R$) = freight in US$ × official dollar × (1 + {freightFx}%)",
  "superplanLogic.s3.f2":
    "Insurance (R$) = FOB × {insurance}% × official dollar",
  "superplanLogic.s4.title": "Import taxes",
  "superplanLogic.s4.a":
    "The base is the customs value, calculated on the real purchase value. It includes the customs expenses: {customs}.",
  "superplanLogic.s4.b":
    "II and IPI are those of the product's NCM (II and IPI fields in Purchase).",
  "superplanLogic.s4.c":
    "Import ICMS: {icmsImport}. When present, it is calculated inside the price.",
  "superplanLogic.s4.f1":
    "Customs value = (FOB + freight + insurance, in US$) × official dollar + customs expenses",
  "superplanLogic.s4.f2": "II = customs value × II%",
  "superplanLogic.s4.f3": "IPI = (customs value + II) × IPI%",
  "superplanLogic.s4.f4":
    "PIS = customs value × {pisImport}%   ·   COFINS = customs value × {cofinsImport}%",
  "superplanLogic.s4.f5": "AFRMM = freight (R$) × {afrmm}% + R$ {fixed}",
  "superplanLogic.s4.f6":
    "ICMS = (customs value + II + IPI + PIS + COFINS + AFRMM) ÷ (1 − ICMS%) × ICMS%",
  "superplanLogic.icms.none": "not configured (left out of the calculation)",
  "superplanLogic.icms.pct": "{pct}%",
  "superplanLogic.s5.title": "Container cost and cost per piece",
  "superplanLogic.s5.a":
    "Expenses in Brazil, per container: R$ {expenses} ({list}). Each one counts only once.",
  "superplanLogic.s5.b":
    "Expenses in China = (FOB × trading commission % + other expenses in RMB ÷ RMB per dollar) × forward dollar.",
  "superplanLogic.s5.f1":
    "Container cost = purchase + freight + insurance + II + IPI + PIS + COFINS + AFRMM + ICMS + expenses in Brazil + road freight + expenses in China",
  "superplanLogic.s5.f2": "Cost per piece = container cost ÷ pieces",
  "superplanLogic.s6.title": "Prices",
  "superplanLogic.s6.a":
    "Markup, commission, administrative expenses, profit target and WD come from the chosen business type.",
  "superplanLogic.s6.f1":
    "Minimum price = cost per piece × the business type markup",
  "superplanLogic.s6.f2":
    "Table = minimum × {table}   ·   Wholesale = minimum × {wholesale}   ·   Retail = minimum × {retail}",
  "superplanLogic.s6.f3": "WD = minimum × (1 + the business type WD%)",
  "superplanLogic.s6.f4":
    "Delivered = minimum + delivery freight to the customer ÷ pieces",
  "superplanLogic.s7.title": "Profit on the sale",
  "superplanLogic.s7.a":
    "Profit is calculated at the minimum price or, if you fill it in, at the sale price to test.",
  "superplanLogic.s7.b":
    "Sale taxes apply to the full price. The IPI, ICMS, PIS and COFINS paid at import count as credit, per piece.",
  "superplanLogic.s7.f1": "Base = price × (1 − IPI%)",
  "superplanLogic.s7.f2":
    "IPI = base × IPI% − credit   ·   ICMS = base × {icms}% − credit",
  "superplanLogic.s7.f3":
    "PIS = (base − sale ICMS − IPI payable) × {pis}% − credit   ·   COFINS = the same base × {cofins}% − credit",
  "superplanLogic.s7.f4": "IR = base × {ir}%   ·   CSLL = base × {csll}%",
  "superplanLogic.s7.f5":
    "Commission = price × commission%   ·   Administrative expenses = price × expenses%",
  "superplanLogic.s7.f6":
    "Profit per piece = price − cost per piece − sale taxes − commission − administrative expenses",
  "superplanLogic.s7.f7":
    "Profit % = profit per piece ÷ price   ·   Container profit = profit per piece × pieces",
  "superplanLogic.s8.title": "The result: green, yellow or red",
  "superplanLogic.s8.a":
    "Green (viable): profit % is equal to or above the business type target.",
  "superplanLogic.s8.b": "Yellow: there is profit, but below the target.",
  "superplanLogic.s8.c": "Red: loss (zero or negative profit).",
  "superplanLogic.s8.d":
    "Price to hit the target: the price at which profit % equals the target. The markup needed is that price ÷ cost per piece. When taxes and expenses exceed the possible margin, that price does not exist.",
  "superplanLogic.sources.title": "Where the numbers come from",
  "superplanLogic.sources.a":
    "From the product (Booking sheet): price, currency, pieces per carton, weights, carton volume and the NCM (II and IPI).",
  "superplanLogic.sources.b":
    "From the system: official dollar of the day, RMB per dollar, containers and the import taxes (insurance, PIS, COFINS and ICMS).",
  "superplanLogic.sources.c":
    "From the Superplan parameters, right below: business types, expenses, freights, freight exchange rate, AFRMM, price factors and sale taxes.",
};

export const zh: Record<keyof typeof pt, string> = {
  "superplanLogic.link": "计算方式说明",
  "superplanLogic.intro":
    "计算始终以一个装满该产品的货柜为准。Superplan 按以下步骤依次计算，旁边的结果即由此得出。以下百分比为当前生效的数值。",
  "superplanLogic.formula": "公式",
  "superplanLogic.s1.title": "货柜能装多少件",
  "superplanLogic.s1.a": "按体积：货柜容量 ÷ 外箱体积。",
  "superplanLogic.s1.b": "按重量：货柜最大载重 ÷（单件毛重 × 每箱件数）。",
  "superplanLogic.s1.c": "取两者中较小的一个并向下取整：只装整箱。",
  "superplanLogic.s1.d":
    "资料表没有毛重时，按净重 + {gross}% 计算（估算毛重）。没有任何重量时，只按体积限制。",
  "superplanLogic.s1.f": "件数 = 可装箱数 × 每箱件数",
  "superplanLogic.s2.title": "采购成本",
  "superplanLogic.s2.a": "人民币价格换算成美元：价格 ÷ 1 美元可兑换的人民币。",
  "superplanLogic.s2.b":
    "采购款按远期美元支付给供应商：官方美元 + R$ {spread}。",
  "superplanLogic.s2.f1": "FOB（美元）= 单件美元价格 × 件数",
  "superplanLogic.s2.f2": "采购（雷亚尔）= FOB × 远期美元",
  "superplanLogic.s3.title": "海运费和保险",
  "superplanLogic.s3.a": "运费按高于官方美元 {freightFx}% 的汇率支付。",
  "superplanLogic.s3.b": "保险为采购金额（FOB）的 {insurance}%。",
  "superplanLogic.s3.f1":
    "运费（雷亚尔）= 美元运费 × 官方美元 ×（1 + {freightFx}%）",
  "superplanLogic.s3.f2": "保险（雷亚尔）= FOB × {insurance}% × 官方美元",
  "superplanLogic.s4.title": "进口税",
  "superplanLogic.s4.a":
    "税基为完税价格，按采购的实际价值计算。其中包含报关费用：{customs}。",
  "superplanLogic.s4.b":
    "II 和 IPI 取产品 NCM 的税率（采购中的 II 和 IPI 字段）。",
  "superplanLogic.s4.c": "进口 ICMS：{icmsImport}。如有，按价内税计算。",
  "superplanLogic.s4.f1":
    "完税价格 =（FOB + 运费 + 保险，美元）× 官方美元 + 报关费用",
  "superplanLogic.s4.f2": "II = 完税价格 × II%",
  "superplanLogic.s4.f3": "IPI =（完税价格 + II）× IPI%",
  "superplanLogic.s4.f4":
    "PIS = 完税价格 × {pisImport}%   ·   COFINS = 完税价格 × {cofinsImport}%",
  "superplanLogic.s4.f5": "AFRMM = 运费（雷亚尔）× {afrmm}% + R$ {fixed}",
  "superplanLogic.s4.f6":
    "ICMS =（完税价格 + II + IPI + PIS + COFINS + AFRMM）÷（1 − ICMS%）× ICMS%",
  "superplanLogic.icms.none": "未配置（不计入）",
  "superplanLogic.icms.pct": "{pct}%",
  "superplanLogic.s5.title": "货柜成本和单件成本",
  "superplanLogic.s5.a":
    "巴西费用（每柜）：R$ {expenses}（{list}）。每项只计算一次。",
  "superplanLogic.s5.b":
    "中国费用 =（FOB × 贸易公司佣金 % + 其他人民币费用 ÷ 人民币兑美元）× 远期美元。",
  "superplanLogic.s5.f1":
    "货柜成本 = 采购 + 运费 + 保险 + II + IPI + PIS + COFINS + AFRMM + ICMS + 巴西费用 + 陆运费 + 中国费用",
  "superplanLogic.s5.f2": "单件成本 = 货柜成本 ÷ 件数",
  "superplanLogic.s6.title": "价格",
  "superplanLogic.s6.a":
    "加价倍数、佣金、管理费用、利润目标和 WD 来自所选的业务类型。",
  "superplanLogic.s6.f1": "最低价 = 单件成本 × 业务类型的加价倍数",
  "superplanLogic.s6.f2":
    "价目表 = 最低价 × {table}   ·   批发 = 最低价 × {wholesale}   ·   零售 = 最低价 × {retail}",
  "superplanLogic.s6.f3": "WD = 最低价 ×（1 + 业务类型的 WD%）",
  "superplanLogic.s6.f4": "含送货 = 最低价 + 送货到客户的运费 ÷ 件数",
  "superplanLogic.s7.title": "销售利润",
  "superplanLogic.s7.a":
    "利润按最低价计算；如果填写了要测试的售价，则按该售价计算。",
  "superplanLogic.s7.b":
    "销售税按全价计算。进口时缴纳的 IPI、ICMS、PIS 和 COFINS 按单件抵扣。",
  "superplanLogic.s7.f1": "税基 = 售价 ×（1 − IPI%）",
  "superplanLogic.s7.f2":
    "IPI = 税基 × IPI% − 抵扣   ·   ICMS = 税基 × {icms}% − 抵扣",
  "superplanLogic.s7.f3":
    "PIS =（税基 − 销售 ICMS − 应缴 IPI）× {pis}% − 抵扣   ·   COFINS = 同一基数 × {cofins}% − 抵扣",
  "superplanLogic.s7.f4": "IR = 税基 × {ir}%   ·   CSLL = 税基 × {csll}%",
  "superplanLogic.s7.f5": "佣金 = 售价 × 佣金%   ·   管理费用 = 售价 × 费用%",
  "superplanLogic.s7.f6":
    "单件利润 = 售价 − 单件成本 − 销售税 − 佣金 − 管理费用",
  "superplanLogic.s7.f7":
    "利润率 = 单件利润 ÷ 售价   ·   货柜利润 = 单件利润 × 件数",
  "superplanLogic.s8.title": "结果：绿色、黄色或红色",
  "superplanLogic.s8.a": "绿色（可行）：利润率达到或超过业务类型的目标。",
  "superplanLogic.s8.b": "黄色：有利润，但低于目标。",
  "superplanLogic.s8.c": "红色：亏损（利润为零或负数）。",
  "superplanLogic.s8.d":
    "达到目标所需的价格：利润率等于目标时的售价。所需加价倍数 = 该价格 ÷ 单件成本。当税费超过可能的利润空间时，该价格不存在。",
  "superplanLogic.sources.title": "数据来源",
  "superplanLogic.sources.a":
    "来自产品（Booking 资料表）：价格、币种、每箱件数、重量、外箱体积和 NCM（II 和 IPI）。",
  "superplanLogic.sources.b":
    "来自系统：当日官方美元、人民币兑美元、货柜和进口税费（保险、PIS、COFINS 和 ICMS）。",
  "superplanLogic.sources.c":
    "来自下方的 Superplan 参数：业务类型、费用、运费、运费汇率、AFRMM、价格系数和销售税。",
};
