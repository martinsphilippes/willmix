/**
 * Dicionário do módulo "bookingCost": custo dos itens do book pela cotação
 * V2 do Sankhya (dono, 24/11/2026; `src/lib/booking-cost.ts`,
 * `src/lib/services/booking-cost.ts`).
 */
export const pt = {
  "bookingCost.col": "Custo no Sankhya",
  "bookingCost.cost": "Custo {price}",
  "bookingCost.target": "Preço meta {price}",
  "bookingCost.profit": "Lucro {pct}%",
  "bookingCost.profitGoal": "Lucro {pct}% · meta {goal}%",
  "bookingCost.status.FRETE_PENDENTE": "Frete pendente no Sankhya",
  "bookingCost.status.PENDENTE": "Cotação pendente no Sankhya",
  "bookingCost.none": "Sem custo do Sankhya",
  "bookingCost.queued": "Na fila do Sankhya",
  "bookingCost.failed": "O Sankhya não calculou",
  "bookingCost.missingTitle": "Falta dado",
  "bookingCost.missing": "Faltou: {list}",
  "bookingCost.missing.ncm": "NCM",
  "bookingCost.missing.price": "preço",
  "bookingCost.missing.currency": "moeda (RMB, US$ ou euro)",
  "bookingCost.missing.pcsPerCarton": "peças por caixa master",
  "bookingCost.missing.cbm": "CBM da caixa master",
  "bookingCost.missing.netWeight": "peso líquido",
  "bookingCost.missing.grossWeight": "peso bruto",
  "bookingCost.sentTitle":
    "Cotação V2 do Sankhya em {date}: {price} {currency} · NCM {ncm} · {pcs} peças/caixa · CBM {cbm}",
  "bookingCost.card.title": "Custo no Sankhya",
  "bookingCost.card.body":
    "O custo por peça vem da cotação V2 do Sankhya, item por item, com os dados de cada um (NCM, pesos, caixa master, CBM, preço e moeda). Nada é estimado pelo portal.",
  "bookingCost.card.counts":
    "{costed} com custo · {missing} com falta de dado · {failed} com erro · {pending} na fila",
  "bookingCost.card.at": "Último pedido ao Sankhya: {date}",
  "bookingCost.card.running":
    "Calculando no Sankhya, um item de cada vez. Atualize a página para ver os que já voltaram.",
  "bookingCost.card.stalled":
    "{n} item(ns) ainda sem custo do Sankhya: peça de novo.",
  "bookingCost.card.off":
    "O Sankhya não está configurado: o custo dos itens não é calculado (nenhum valor é estimado).",
  "bookingCost.card.submit": "Calcular no Sankhya",
  "bookingCost.card.submitPending": "Pedindo ao Sankhya…",
  "bookingCost.done": "Custo pedido ao Sankhya.",
};

export const en: Record<keyof typeof pt, string> = {
  "bookingCost.col": "Sankhya cost",
  "bookingCost.cost": "Cost {price}",
  "bookingCost.target": "Target price {price}",
  "bookingCost.profit": "Profit {pct}%",
  "bookingCost.profitGoal": "Profit {pct}% · goal {goal}%",
  "bookingCost.status.FRETE_PENDENTE": "Freight pending in Sankhya",
  "bookingCost.status.PENDENTE": "Quote pending in Sankhya",
  "bookingCost.none": "No Sankhya cost",
  "bookingCost.queued": "Queued for Sankhya",
  "bookingCost.failed": "Sankhya did not calculate",
  "bookingCost.missingTitle": "Missing data",
  "bookingCost.missing": "Missing: {list}",
  "bookingCost.missing.ncm": "NCM",
  "bookingCost.missing.price": "price",
  "bookingCost.missing.currency": "currency (RMB, USD or EUR)",
  "bookingCost.missing.pcsPerCarton": "pieces per master carton",
  "bookingCost.missing.cbm": "master carton CBM",
  "bookingCost.missing.netWeight": "net weight",
  "bookingCost.missing.grossWeight": "gross weight",
  "bookingCost.sentTitle":
    "Sankhya V2 quote on {date}: {price} {currency} · NCM {ncm} · {pcs} pcs/carton · CBM {cbm}",
  "bookingCost.card.title": "Sankhya cost",
  "bookingCost.card.body":
    "The cost per piece comes from the Sankhya V2 quote, item by item, with each item's data (NCM, weights, master carton, CBM, price and currency). The portal estimates nothing.",
  "bookingCost.card.counts":
    "{costed} with cost · {missing} missing data · {failed} with error · {pending} queued",
  "bookingCost.card.at": "Last request to Sankhya: {date}",
  "bookingCost.card.running":
    "Calculating in Sankhya, one item at a time. Reload the page to see the ones already back.",
  "bookingCost.card.stalled":
    "{n} item(s) still without a Sankhya cost: request again.",
  "bookingCost.card.off":
    "Sankhya is not configured: the item cost is not calculated (no value is estimated).",
  "bookingCost.card.submit": "Calculate in Sankhya",
  "bookingCost.card.submitPending": "Asking Sankhya…",
  "bookingCost.done": "Cost requested from Sankhya.",
};

export const zh: Record<keyof typeof pt, string> = {
  "bookingCost.col": "Sankhya 成本",
  "bookingCost.cost": "成本 {price}",
  "bookingCost.target": "目标价 {price}",
  "bookingCost.profit": "利润 {pct}%",
  "bookingCost.profitGoal": "利润 {pct}% · 目标 {goal}%",
  "bookingCost.status.FRETE_PENDENTE": "Sankhya 运费待定",
  "bookingCost.status.PENDENTE": "Sankhya 报价待定",
  "bookingCost.none": "没有 Sankhya 成本",
  "bookingCost.queued": "等待 Sankhya 计算",
  "bookingCost.failed": "Sankhya 未能计算",
  "bookingCost.missingTitle": "缺少数据",
  "bookingCost.missing": "缺少：{list}",
  "bookingCost.missing.ncm": "NCM",
  "bookingCost.missing.price": "价格",
  "bookingCost.missing.currency": "币种（人民币、美元或欧元）",
  "bookingCost.missing.pcsPerCarton": "每外箱件数",
  "bookingCost.missing.cbm": "外箱 CBM",
  "bookingCost.missing.netWeight": "净重",
  "bookingCost.missing.grossWeight": "毛重",
  "bookingCost.sentTitle":
    "Sankhya V2 报价（{date}）：{price} {currency} · NCM {ncm} · 每箱 {pcs} 件 · CBM {cbm}",
  "bookingCost.card.title": "Sankhya 成本",
  "bookingCost.card.body":
    "每件成本来自 Sankhya V2 报价，逐个条目计算，使用每个条目的数据（NCM、重量、外箱、CBM、价格和币种）。门户不做任何估算。",
  "bookingCost.card.counts":
    "{costed} 个有成本 · {missing} 个缺少数据 · {failed} 个出错 · {pending} 个等待中",
  "bookingCost.card.at": "最近一次向 Sankhya 请求：{date}",
  "bookingCost.card.running":
    "正在 Sankhya 中逐个计算。刷新页面可查看已返回的条目。",
  "bookingCost.card.stalled": "{n} 个条目还没有 Sankhya 成本：请重新请求。",
  "bookingCost.card.off": "未配置 Sankhya：不计算条目成本（不做任何估算）。",
  "bookingCost.card.submit": "在 Sankhya 中计算",
  "bookingCost.card.submitPending": "正在请求 Sankhya…",
  "bookingCost.done": "已向 Sankhya 请求成本。",
};
