/**
 * Dicionário do módulo "supplier-score" (avaliação de fornecedores): mesmas
 * chaves em pt, en e zh.
 */
export const pt = {
  "score.title": "Avaliação de fornecedores",
  "score.subtitle":
    "Nota de 0 a 100 com o que o portal registra: prazo de embarque cumprido, aprovação na 1ª inspeção, mercadoria recebida sem falta ou avaria, pedidos sem problema de arte e cotações respondidas. A nota é a média dos critérios que têm dados.",
  "score.link": "Avaliação",
  "score.col.supplier": "Fornecedor",
  "score.col.score": "Nota",
  "score.col.onTime": "Prazo (ETD)",
  "score.col.inspection": "1ª inspeção",
  "score.col.receiving": "Recebimento",
  "score.col.art": "Arte",
  "score.col.quotes": "Cotações",
  "score.col.orders": "Pedidos",
  "score.noData": "Sem dados ainda",
  "score.n.orders": "{n} pedido(s)",
  "score.n.skus": "{n} SKU(s)",
  "score.n.units": "{n} un.",
  "score.n.quotes": "{n} convite(s)",
  "score.delay": "atraso médio {n} dia(s)",
  "score.answerDays": "responde em {n} dia(s)",
  "score.legend":
    "A: 90 ou mais · B: 75 a 89 · C: 60 a 74 · D: abaixo de 60. Clique no fornecedor para abrir a ficha.",
  "score.empty": "Nenhum fornecedor cadastrado.",
  "score.inSupplier": "Avaliação: {grade} ({score})",
};

export const en: Record<keyof typeof pt, string> = {
  "score.title": "Supplier scorecard",
  "score.subtitle":
    "Score from 0 to 100 from what the portal records: shipping date kept, approval at the 1st inspection, goods received without shortage or damage, orders without artwork issues and quotes answered. The score is the average of the criteria that have data.",
  "score.link": "Scorecard",
  "score.col.supplier": "Supplier",
  "score.col.score": "Score",
  "score.col.onTime": "On time (ETD)",
  "score.col.inspection": "1st inspection",
  "score.col.receiving": "Receiving",
  "score.col.art": "Artwork",
  "score.col.quotes": "Quotes",
  "score.col.orders": "Orders",
  "score.noData": "No data yet",
  "score.n.orders": "{n} order(s)",
  "score.n.skus": "{n} SKU(s)",
  "score.n.units": "{n} units",
  "score.n.quotes": "{n} invitation(s)",
  "score.delay": "avg delay {n} day(s)",
  "score.answerDays": "answers in {n} day(s)",
  "score.legend":
    "A: 90 or more · B: 75 to 89 · C: 60 to 74 · D: below 60. Click a supplier to open their record.",
  "score.empty": "No suppliers registered.",
  "score.inSupplier": "Scorecard: {grade} ({score})",
};

export const zh: Record<keyof typeof pt, string> = {
  "score.title": "供应商评分",
  "score.subtitle":
    "根据门户记录给出 0 至 100 分：按承诺 ETD 出运、首次验货通过、到货无短缺或破损、订单无设计问题、回复询价。分数为有数据的各项平均值。",
  "score.link": "评分",
  "score.col.supplier": "供应商",
  "score.col.score": "分数",
  "score.col.onTime": "准时（ETD）",
  "score.col.inspection": "首次验货",
  "score.col.receiving": "收货",
  "score.col.art": "设计",
  "score.col.quotes": "报价",
  "score.col.orders": "订单",
  "score.noData": "暂无数据",
  "score.n.orders": "{n} 个订单",
  "score.n.skus": "{n} 个 SKU",
  "score.n.units": "{n} 件",
  "score.n.quotes": "{n} 次邀请",
  "score.delay": "平均延误 {n} 天",
  "score.answerDays": "{n} 天内回复",
  "score.legend":
    "A：90 及以上 · B：75 至 89 · C：60 至 74 · D：低于 60。点击供应商打开档案。",
  "score.empty": "尚未登记供应商。",
  "score.inSupplier": "评分：{grade}（{score}）",
};
