/**
 * Nova solicitação (dono, 15/11/2026): programação de compra do pedido,
 * produto do catálogo só para leitura, histórico do cliente pelo Sankhya e
 * previsão de preço ao cliente final. Mesmas chaves em pt, en e zh.
 */
export const pt = {
  "orderPlan.title": "Programação de compra do pedido",
  "orderPlan.hint":
    "As datas são do pedido e valem para todos os produtos. Em cada produto, reparta a quantidade dele nessas datas.",
  "orderPlan.count": "Programações",
  "orderPlan.countHint":
    "1 = pedido único (uma entrega só). Mudar o número de programações reparte de novo a quantidade de cada produto.",
  "orderPlan.single": "Pedido único: cada produto com uma quantidade só.",
  "orderPlan.n": "Programação {n}",
  "orderPlan.dates": "Datas das programações",
  "orderPlan.minDate":
    "Primeira data permitida: {date} (lançamento em {launch} + 120 dias).",
  "orderPlan.tooSoon":
    "A 1ª programação precisa ser a partir de {date} (lançamento + 120 dias).",
  "orderPlan.datesHint":
    "Toque numa data para trocar só aquela programação. A data trocada fica fixada: mudar o intervalo recalcula só as outras.",
  "orderPlan.manual": "fixada",
  "orderPlan.edit": "Trocar a data da Programação {n}",
  "orderPlan.unpin": "Voltar à data automática da Programação {n}",
  "orderPlan.issues": "Ajuste antes de enviar:",
  "orderPlan.issue":
    "Programação {n}: a data precisa ser depois da Programação {prev} ({date}).",
  "reqBatch.error.schedule_too_soon":
    "A 1ª programação precisa ser a partir de {date}: 120 dias depois do lançamento da solicitação.",
  "reqBatch.error.schedule_out_of_order":
    "As datas das programações estão fora de ordem: cada programação precisa ser depois da anterior.",
  "orderPlan.roundsFixed":
    "O número de programações é o do pedido (bloco Programação de compra do pedido).",
  "orderPlan.lockedHint":
    "Dados da ficha do produto: não se alteram na solicitação.",
  "reqBatch.error.schedule_mismatch":
    "As programações dos produtos não batem: as datas são do pedido e precisam ser as mesmas em todos os produtos.",
  "priceForecast.title": "Previsão de preço ao cliente final",
  "priceForecast.hint":
    "Pela cotação de encomenda do Sankhya (V2), com o formato de venda (VIP), quem chama o transportador (rota) e o frete de entrega padrão: veja o preço previsto do produto ou informe o preço de venda desejado para encontrar o preço máximo de compra.",
  "priceForecast.view": "Ver o preço previsto",
  "priceForecast.target": "Informar o preço de venda desejado",
  "priceForecast.calculate": "Calcular",
  "priceForecast.loading": "Calculando…",
  "priceForecast.noProduct":
    "Escolha um produto do catálogo para ver a previsão de preço.",
  "priceForecast.manual":
    "Sankhya não configurado: a previsão de preço (cotação V2 do Sankhya) não está disponível. Nenhum preço é estimado.",
  "priceForecast.resultTarget":
    "Para vender a {target} por peça, o preço máximo de compra é",
  "priceForecast.targetField": "Preço de venda desejado (R$ por peça, com IPI)",
  "priceForecast.error": "A cotação do Sankhya não devolveu preço:",
  "priceForecast.sale": "Preço de venda (com IPI)",
  "priceForecast.table": "Preço de tabela (com IPI)",
  "priceForecast.wholesale": "Sugestão para o atacado",
  "priceForecast.retail": "Sugestão ao cliente final (loja)",
  "priceForecast.goal": "Preço que dá a meta de lucro",
  "priceForecast.cost": "Custo por peça",
  "priceForecast.profit": "Lucro líquido",
  "priceForecast.profitValue": "{profit}% (meta {goal}%)",
  "priceForecast.source":
    "Valores por peça, da cotação de encomenda V2 do Sankhya (consulta agora).",
  "priceForecast.auditTitle": "Memória de cálculo do Sankhya (auditoria)",
  "priceForecast.auditInputs": "Enviado à função {fn}",
  "priceForecast.auditDefaults":
    "Os parâmetros que não aparecem foram como NULL (a cotação V2 resolve pelos cadastros do Sankhya); na volta (a função inversa do Sankhya), como DEFAULT.",
  "priceForecast.auditOutputs": "Devolvido pela função (todas as colunas)",
  "sankhyaHistory.source": "Do Sankhya, consultado agora",
  "sankhyaHistory.empty": "Nenhum pedido deste cliente no Sankhya.",
  "sankhyaHistory.error": "Não deu para consultar o Sankhya.",
  "sankhyaHistory.hint":
    "Pedidos de venda do cliente no Sankhya, do mais recente para o mais antigo (pendentes e atendidos). Toque no pedido para ver os produtos e os preços.",
  "sankhyaHistory.order": "Pedido {n}",
  "sankhyaHistory.note": "nº {n}",
  "sankhyaHistory.items": "{n} itens",
  "sankhyaHistory.pending": "Com pendência",
  "sankhyaHistory.done": "Sem pendência",
  "sankhyaHistory.fallbackNotConfigured":
    "Sankhya não configurado: mostrando os pedidos gravados no portal.",
  "sankhyaHistory.fallbackNoCode":
    "Cliente sem código do Sankhya no cadastro: mostrando os pedidos gravados no portal.",
  "sankhyaHistory.f.code": "Código no Sankhya",
  "sankhyaHistory.f.reference": "Referência",
  "sankhyaHistory.f.supplierReference": "Referência do fornecedor",
  "sankhyaHistory.f.ncm": "NCM",
  "sankhyaHistory.f.quantity": "Quantidade pedida",
  "sankhyaHistory.f.delivered": "Quantidade entregue",
  "sankhyaHistory.f.unitPrice": "Preço unitário (antes do desconto)",
  "sankhyaHistory.f.discount": "Desconto do item",
  "sankhyaHistory.f.unitNet": "Preço unitário após desconto",
  "sankhyaHistory.f.totalNet": "Total do item após desconto",
  "sankhyaHistory.f.container": "Container",
  "sankhyaHistory.f.top": "TOP",
  "sankhyaHistory.f.company": "empresa",
};

export const en: Record<keyof typeof pt, string> = {
  "orderPlan.title": "Order purchase schedule",
  "orderPlan.hint":
    "The dates belong to the order and apply to every product. In each product, split its quantity across these dates.",
  "orderPlan.count": "Rounds",
  "orderPlan.countHint":
    "1 = single order (one delivery). Changing the number of rounds splits each product's quantity again.",
  "orderPlan.single": "Single order: each product with one quantity.",
  "orderPlan.n": "Round {n}",
  "orderPlan.dates": "Round dates",
  "orderPlan.minDate":
    "First allowed date: {date} (launched on {launch} + 120 days).",
  "orderPlan.tooSoon":
    "The 1st round must be on or after {date} (launch + 120 days).",
  "orderPlan.datesHint":
    "Tap a date to change only that round. The changed date stays fixed: changing the interval recalculates only the others.",
  "orderPlan.manual": "fixed",
  "orderPlan.edit": "Change the date of Round {n}",
  "orderPlan.unpin": "Back to the automatic date of Round {n}",
  "orderPlan.issues": "Adjust before sending:",
  "orderPlan.issue": "Round {n}: the date must be after Round {prev} ({date}).",
  "reqBatch.error.schedule_too_soon":
    "The 1st round must be on or after {date}: 120 days after the request was launched.",
  "reqBatch.error.schedule_out_of_order":
    "The round dates are out of order: each round must be after the previous one.",
  "orderPlan.roundsFixed":
    "The number of rounds comes from the order (Order purchase schedule block).",
  "orderPlan.lockedHint":
    "Product sheet data: it cannot be changed in the request.",
  "reqBatch.error.schedule_mismatch":
    "The products' schedules do not match: the dates belong to the order and must be the same for every product.",
  "priceForecast.title": "End-customer price forecast",
  "priceForecast.hint":
    "From Sankhya's order quote (V2), with the sale format (VIP), who calls the carrier (route) and the default delivery freight: see the product's forecast price or enter the desired sale price to find the maximum purchase price.",
  "priceForecast.view": "See the forecast price",
  "priceForecast.target": "Enter the desired sale price",
  "priceForecast.calculate": "Calculate",
  "priceForecast.loading": "Calculating…",
  "priceForecast.noProduct":
    "Choose a catalog product to see the price forecast.",
  "priceForecast.manual":
    "Sankhya is not configured: the price forecast (Sankhya V2 quote) is unavailable. No price is estimated.",
  "priceForecast.resultTarget":
    "To sell at {target} per piece, the maximum purchase price is",
  "priceForecast.targetField": "Desired sale price (R$ per piece, with IPI)",
  "priceForecast.error": "Sankhya's quote returned no price:",
  "priceForecast.sale": "Sale price (with IPI)",
  "priceForecast.table": "List price (with IPI)",
  "priceForecast.wholesale": "Wholesale suggestion",
  "priceForecast.retail": "End-customer suggestion (retail)",
  "priceForecast.goal": "Price that reaches the profit goal",
  "priceForecast.cost": "Cost per piece",
  "priceForecast.profit": "Net profit",
  "priceForecast.profitValue": "{profit}% (goal {goal}%)",
  "priceForecast.source":
    "Per-piece values from Sankhya's order quote V2 (queried now).",
  "priceForecast.auditTitle": "Sankhya calculation details (audit)",
  "priceForecast.auditInputs": "Sent to function {fn}",
  "priceForecast.auditDefaults":
    "Parameters not listed were sent as NULL (quote V2 resolves them from Sankhya's records); in the reverse calculation (Sankhya's inverse function), as DEFAULT.",
  "priceForecast.auditOutputs": "Returned by the function (all columns)",
  "sankhyaHistory.source": "From Sankhya, queried now",
  "sankhyaHistory.empty": "No orders from this customer in Sankhya.",
  "sankhyaHistory.error": "Could not query Sankhya.",
  "sankhyaHistory.hint":
    "The customer's sales orders in Sankhya, newest first (pending and fulfilled). Tap an order to see the products and prices.",
  "sankhyaHistory.order": "Order {n}",
  "sankhyaHistory.note": "no. {n}",
  "sankhyaHistory.items": "{n} items",
  "sankhyaHistory.pending": "Pending",
  "sankhyaHistory.done": "Nothing pending",
  "sankhyaHistory.fallbackNotConfigured":
    "Sankhya is not configured: showing the orders stored in the portal.",
  "sankhyaHistory.fallbackNoCode":
    "Customer without a Sankhya code: showing the orders stored in the portal.",
  "sankhyaHistory.f.code": "Sankhya code",
  "sankhyaHistory.f.reference": "Reference",
  "sankhyaHistory.f.supplierReference": "Supplier reference",
  "sankhyaHistory.f.ncm": "NCM",
  "sankhyaHistory.f.quantity": "Ordered quantity",
  "sankhyaHistory.f.delivered": "Delivered quantity",
  "sankhyaHistory.f.unitPrice": "Unit price (before discount)",
  "sankhyaHistory.f.discount": "Item discount",
  "sankhyaHistory.f.unitNet": "Unit price after discount",
  "sankhyaHistory.f.totalNet": "Item total after discount",
  "sankhyaHistory.f.container": "Container",
  "sankhyaHistory.f.top": "TOP",
  "sankhyaHistory.f.company": "company",
};

export const zh: Record<keyof typeof pt, string> = {
  "orderPlan.title": "订单采购计划",
  "orderPlan.hint":
    "日期属于订单，适用于所有产品。在每个产品中，把数量分配到这些日期。",
  "orderPlan.count": "批次",
  "orderPlan.countHint":
    "1 = 单次订单（一次交货）。更改批次数会重新分配每个产品的数量。",
  "orderPlan.single": "单次订单：每个产品只有一个数量。",
  "orderPlan.n": "第 {n} 批",
  "orderPlan.dates": "各批次日期",
  "orderPlan.minDate": "最早可选日期：{date}（{launch} 发起 + 120 天）。",
  "orderPlan.tooSoon": "第 1 批必须在 {date} 或之后（发起日 + 120 天）。",
  "orderPlan.datesHint":
    "点击日期只修改该批次。修改后的日期会被固定：更改间隔只重新计算其他日期。",
  "orderPlan.manual": "已固定",
  "orderPlan.edit": "修改第 {n} 批的日期",
  "orderPlan.unpin": "恢复第 {n} 批的自动日期",
  "orderPlan.issues": "发送前请调整：",
  "orderPlan.issue": "第 {n} 批：日期必须晚于第 {prev} 批（{date}）。",
  "reqBatch.error.schedule_too_soon":
    "第 1 批必须在 {date} 或之后：需求发起后 120 天。",
  "reqBatch.error.schedule_out_of_order":
    "各批次日期顺序不对：每一批必须晚于前一批。",
  "orderPlan.roundsFixed": "批次数来自订单（订单采购计划）。",
  "orderPlan.lockedHint": "产品资料数据：在需求中不能修改。",
  "reqBatch.error.schedule_mismatch":
    "各产品的计划不一致：日期属于订单，所有产品必须相同。",
  "priceForecast.title": "终端客户价格预测",
  "priceForecast.view": "查看预测价格",
  "priceForecast.target": "输入期望售价",
  "priceForecast.calculate": "计算",
  "priceForecast.loading": "计算中…",
  "priceForecast.noProduct": "请选择目录中的产品以查看价格预测。",
  "priceForecast.manual":
    "未配置 Sankhya：价格预测（Sankhya V2 报价）不可用。不估算任何价格。",
  "priceForecast.hint":
    "来自 Sankhya 订货报价（V2），包含销售形式（VIP）、由谁联系承运商（路线）和默认送货运费：查看产品的预测价格，或输入期望售价以求出最高采购价。",
  "priceForecast.targetField": "期望售价（每件 R$，含 IPI）",
  "priceForecast.error": "Sankhya 报价未返回价格：",
  "priceForecast.sale": "售价（含 IPI）",
  "priceForecast.table": "目录价（含 IPI）",
  "priceForecast.wholesale": "批发建议价",
  "priceForecast.retail": "终端客户建议价（零售）",
  "priceForecast.goal": "达到利润目标的价格",
  "priceForecast.cost": "每件成本",
  "priceForecast.profit": "净利润",
  "priceForecast.profitValue": "{profit}%（目标 {goal}%）",
  "priceForecast.resultTarget": "若以每件 {target} 出售，最高采购价为",
  "priceForecast.source": "每件数值，来自 Sankhya 订货报价 V2（实时查询）。",
  "priceForecast.auditTitle": "Sankhya 计算明细（审计）",
  "priceForecast.auditInputs": "发送给函数 {fn}",
  "priceForecast.auditDefaults":
    "未列出的参数以 NULL 发送（报价 V2 根据 Sankhya 档案解析）；反向计算（Sankhya 反算函数）以 DEFAULT 发送。",
  "priceForecast.auditOutputs": "函数返回（全部字段）",
  "sankhyaHistory.source": "来自 Sankhya，实时查询",
  "sankhyaHistory.empty": "Sankhya 中没有该客户的订单。",
  "sankhyaHistory.error": "无法查询 Sankhya。",
  "sankhyaHistory.hint":
    "客户在 Sankhya 的销售订单，从新到旧（含待处理和已完成）。点击订单查看产品和价格。",
  "sankhyaHistory.order": "订单 {n}",
  "sankhyaHistory.note": "号 {n}",
  "sankhyaHistory.items": "{n} 项",
  "sankhyaHistory.pending": "待处理",
  "sankhyaHistory.done": "无待处理",
  "sankhyaHistory.fallbackNotConfigured":
    "未配置 Sankhya：显示门户中保存的订单。",
  "sankhyaHistory.fallbackNoCode":
    "客户没有 Sankhya 代码：显示门户中保存的订单。",
  "sankhyaHistory.f.code": "Sankhya 代码",
  "sankhyaHistory.f.reference": "参考号",
  "sankhyaHistory.f.supplierReference": "供应商参考号",
  "sankhyaHistory.f.ncm": "NCM",
  "sankhyaHistory.f.quantity": "订购数量",
  "sankhyaHistory.f.delivered": "已交数量",
  "sankhyaHistory.f.unitPrice": "单价（折扣前）",
  "sankhyaHistory.f.discount": "项目折扣",
  "sankhyaHistory.f.unitNet": "折扣后单价",
  "sankhyaHistory.f.totalNet": "折扣后项目合计",
  "sankhyaHistory.f.container": "集装箱",
  "sankhyaHistory.f.top": "TOP",
  "sankhyaHistory.f.company": "公司",
};
