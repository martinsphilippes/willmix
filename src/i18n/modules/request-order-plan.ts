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
  "orderPlan.roundsFixed":
    "O número de programações é o do pedido (bloco Programação de compra do pedido).",
  "orderPlan.lockedHint":
    "Dados da ficha do produto: não se alteram na solicitação.",
  "reqBatch.error.schedule_mismatch":
    "As programações dos produtos não batem: as datas são do pedido e precisam ser as mesmas em todos os produtos.",
  "priceForecast.title": "Previsão de preço ao cliente final",
  "priceForecast.hint":
    "Veja o preço previsto ao cliente final ou informe o preço de venda desejado para encontrar o preço.",
  "priceForecast.view": "Ver o preço previsto",
  "priceForecast.target": "Informar o preço de venda desejado",
  "priceForecast.targetField": "Preço de venda desejado (R$ por peça)",
  "priceForecast.calculate": "Calcular",
  "priceForecast.loading": "Calculando…",
  "priceForecast.noProduct":
    "Escolha um produto do catálogo para ver a previsão de preço.",
  "priceForecast.manual":
    "A integração de previsão de preço ainda não está ligada (falta a documentação da API). Nenhum preço é estimado.",
  "priceForecast.error": "Não deu para calcular a previsão de preço.",
  "priceForecast.result": "Preço previsto ao cliente final: {price} por peça.",
  "priceForecast.resultTarget":
    "Para vender a {target} ao cliente final: {price} por peça.",
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
  "orderPlan.roundsFixed":
    "The number of rounds comes from the order (Order purchase schedule block).",
  "orderPlan.lockedHint":
    "Product sheet data: it cannot be changed in the request.",
  "reqBatch.error.schedule_mismatch":
    "The products' schedules do not match: the dates belong to the order and must be the same for every product.",
  "priceForecast.title": "End-customer price forecast",
  "priceForecast.hint":
    "See the forecast end-customer price or enter the desired sale price to find the price.",
  "priceForecast.view": "See the forecast price",
  "priceForecast.target": "Enter the desired sale price",
  "priceForecast.targetField": "Desired sale price (R$ per piece)",
  "priceForecast.calculate": "Calculate",
  "priceForecast.loading": "Calculating…",
  "priceForecast.noProduct":
    "Choose a catalog product to see the price forecast.",
  "priceForecast.manual":
    "The price forecast integration is not connected yet (the API documentation is missing). No price is estimated.",
  "priceForecast.error": "Could not calculate the price forecast.",
  "priceForecast.result": "Forecast end-customer price: {price} per piece.",
  "priceForecast.resultTarget":
    "To sell at {target} to the end customer: {price} per piece.",
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
  "orderPlan.roundsFixed": "批次数来自订单（订单采购计划）。",
  "orderPlan.lockedHint": "产品资料数据：在需求中不能修改。",
  "reqBatch.error.schedule_mismatch":
    "各产品的计划不一致：日期属于订单，所有产品必须相同。",
  "priceForecast.title": "终端客户价格预测",
  "priceForecast.hint": "查看预测的终端客户价格，或输入期望售价以求出价格。",
  "priceForecast.view": "查看预测价格",
  "priceForecast.target": "输入期望售价",
  "priceForecast.targetField": "期望售价（每件 R$）",
  "priceForecast.calculate": "计算",
  "priceForecast.loading": "计算中…",
  "priceForecast.noProduct": "请选择目录中的产品以查看价格预测。",
  "priceForecast.manual":
    "价格预测接口尚未接通（缺少 API 文档）。不估算任何价格。",
  "priceForecast.error": "无法计算价格预测。",
  "priceForecast.result": "预测终端客户价格：每件 {price}。",
  "priceForecast.resultTarget": "若以 {target} 卖给终端客户：每件 {price}。",
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
