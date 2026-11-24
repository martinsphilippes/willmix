/**
 * Previsão de preço dos itens do Book e da negociação pela API de preço do
 * Sankhya (dono, 24/11/2026; src/lib/booking-forecast.ts). Só a Wellmix vê.
 * Mesmas chaves em pt, en e zh.
 */
export const pt = {
  "bookingForecast.title": "Previsão de preço",
  "bookingForecast.sale": "Venda prevista {price}",
  "bookingForecast.withFreight": "Com frete {price}",
  "bookingForecast.profit": "Lucro {pct}%",
  "bookingForecast.target": "Meta {pct}%: {price}",
  "bookingForecast.none": "Sem previsão",
  "bookingForecast.at": "Previsão de preço do Sankhya em {date}",
  "bookingForecast.missing.ncm": "NCM",
  "bookingForecast.missing.price": "preço por peça",
  "bookingForecast.missing.currency": "moeda (RMB, US$ ou euro)",
  "bookingForecast.missing.carton": "peças por caixa",
  "bookingForecast.missing.cbm": "CBM da caixa",
  "bookingForecast.missing.manual":
    "Sankhya não configurado: nenhum preço é previsto",
  "bookingForecast.missing.error": "o Sankhya não respondeu",
  "bookingForecast.lot.at": "Previsão pedida em {date}",
  "bookingForecast.lot.auto":
    "A previsão é do Sankhya, pedida ao fechar o book e ao trocar o NCM. O que ficar sem previsão o portal completa sozinho uma vez por dia.",
  "bookingForecast.negotiated": "Previsão de preço com as condições negociadas",
  "bookingForecast.negotiatedHint":
    "Refeita pela API de preço do Sankhya a cada abertura da tela, com o preço e a moeda combinados; nada é gravado.",
  "bookingForecast.chosen": "Previsão de preço do item escolhido",
};

export const en: Record<keyof typeof pt, string> = {
  "bookingForecast.title": "Price forecast",
  "bookingForecast.sale": "Forecast sale {price}",
  "bookingForecast.withFreight": "With freight {price}",
  "bookingForecast.profit": "Profit {pct}%",
  "bookingForecast.target": "Target {pct}%: {price}",
  "bookingForecast.none": "No forecast",
  "bookingForecast.at": "Sankhya price forecast on {date}",
  "bookingForecast.missing.ncm": "NCM",
  "bookingForecast.missing.price": "price per piece",
  "bookingForecast.missing.currency": "currency (RMB, US$ or euro)",
  "bookingForecast.missing.carton": "pieces per carton",
  "bookingForecast.missing.cbm": "carton CBM",
  "bookingForecast.missing.manual":
    "Sankhya not configured: no price is forecast",
  "bookingForecast.missing.error": "Sankhya did not answer",
  "bookingForecast.lot.at": "Forecast requested on {date}",
  "bookingForecast.lot.auto":
    "The forecast comes from Sankhya, requested when the book is closed and when the NCM changes. Whatever is left without a forecast the portal completes by itself once a day.",
  "bookingForecast.negotiated": "Price forecast with the negotiated conditions",
  "bookingForecast.negotiatedHint":
    "Redone through Sankhya's price API every time the screen opens, with the agreed price and currency; nothing is saved.",
  "bookingForecast.chosen": "Price forecast of the chosen item",
};

export const zh: Record<keyof typeof pt, string> = {
  "bookingForecast.title": "价格预测",
  "bookingForecast.sale": "预测售价 {price}",
  "bookingForecast.withFreight": "含运费 {price}",
  "bookingForecast.profit": "利润 {pct}%",
  "bookingForecast.target": "目标 {pct}%：{price}",
  "bookingForecast.none": "无预测",
  "bookingForecast.at": "Sankhya 价格预测，{date}",
  "bookingForecast.missing.ncm": "NCM",
  "bookingForecast.missing.price": "单件价格",
  "bookingForecast.missing.currency": "币种（人民币、美元或欧元）",
  "bookingForecast.missing.carton": "每箱件数",
  "bookingForecast.missing.cbm": "箱子 CBM",
  "bookingForecast.missing.manual": "未配置 Sankhya：不预测任何价格",
  "bookingForecast.missing.error": "Sankhya 未响应",
  "bookingForecast.lot.at": "预测请求于 {date}",
  "bookingForecast.lot.auto":
    "预测来自 Sankhya，在关闭 Book 和修改 NCM 时请求。仍没有预测的条目，门户每天自动补全一次。",
  "bookingForecast.negotiated": "按谈判条件的价格预测",
  "bookingForecast.negotiatedHint":
    "每次打开页面都会按约定的价格和币种通过 Sankhya 价格 API 重新计算；不保存任何内容。",
  "bookingForecast.chosen": "选中条目的价格预测",
};
