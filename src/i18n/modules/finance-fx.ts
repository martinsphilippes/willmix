/**
 * Dicionário do módulo "finance-fx" (margem com câmbio: real no que foi pago
 * com câmbio, estimado pelo câmbio do dia no que foi pago sem câmbio e no que
 * falta pagar, e o efeito do câmbio desde a venda): mesmas chaves em pt, en e zh.
 * As fontes do câmbio vêm sem "~" e sem parênteses: a tela põe o "~" e o
 * `finance.fx.withSource` põe os parênteses de cada língua.
 */
export const pt = {
  "finance.fx.paid": "real (pagamentos)",
  "finance.fx.today": "câmbio de {day}",
  "finance.fx.stale": "último câmbio, {day}",
  "finance.fx.manual": "câmbio manual",
  "finance.fx.avgPaid": "média do câmbio pago",
  "finance.fx.withSource": "{text} ({source})",
  "finance.fx.balance": "saldo a ~{rate}",
  "finance.fx.noFx": "pago sem câmbio: {amount} a ~{rate} — informe o câmbio",
  "finance.fx.cross": "pagamento em outra moeda convertido pelo câmbio do dia",
  "finance.fx.sellAt": "reais → {currency} a ~{rate}",
  "finance.fx.sale": "venda {rate}",
  "finance.fx.estimatedAt": "estimado a {rate}",
  "finance.fx.costPartial": "pago no câmbio real; o resto estimado a {rate}",
  "finance.fx.effect": "câmbio desde a venda: {value}",
  "finance.fx.effectTitle":
    "Câmbio da venda {sale} → câmbio médio do custo {now}. Diferença na margem causada pelo câmbio.",
  "finance.fx.estimatedCount": "pedidos estimados: {n}",
  "finance.fx.estimateNote":
    "~ = estimado: o que foi pago com câmbio informado usa esse câmbio real; o que foi pago sem câmbio e o que falta pagar ao fornecedor usam o câmbio do dia.",
  "finance.fx.unitHint": "R$ por 1 {currency}",
  "finance.fx.unitHintAny": "R$ por 1 unidade da moeda",
};

export const en: Record<keyof typeof pt, string> = {
  "finance.fx.paid": "actual (payments)",
  "finance.fx.today": "rate of {day}",
  "finance.fx.stale": "last rate, {day}",
  "finance.fx.manual": "manual rate",
  "finance.fx.avgPaid": "average paid rate",
  "finance.fx.withSource": "{text} ({source})",
  "finance.fx.balance": "balance at ~{rate}",
  "finance.fx.noFx": "paid without rate: {amount} at ~{rate} — enter the rate",
  "finance.fx.cross": "payment in another currency converted at today's rate",
  "finance.fx.sellAt": "BRL → {currency} at ~{rate}",
  "finance.fx.sale": "sale {rate}",
  "finance.fx.estimatedAt": "estimated at {rate}",
  "finance.fx.costPartial":
    "paid at the actual rate; the rest estimated at {rate}",
  "finance.fx.effect": "FX since sale: {value}",
  "finance.fx.effectTitle":
    "Sale rate {sale} → average cost rate {now}. Change in margin caused by the exchange rate.",
  "finance.fx.estimatedCount": "estimated orders: {n}",
  "finance.fx.estimateNote":
    "~ = estimate: what was paid with a rate entered uses that actual rate; what was paid without a rate and what is still payable to the supplier use today's rate.",
  "finance.fx.unitHint": "BRL per 1 {currency}",
  "finance.fx.unitHintAny": "BRL per 1 unit of the currency",
};

export const zh: Record<keyof typeof pt, string> = {
  "finance.fx.paid": "实际（付款）",
  "finance.fx.today": "{day} 汇率",
  "finance.fx.stale": "最近汇率 {day}",
  "finance.fx.manual": "手动汇率",
  "finance.fx.avgPaid": "已付平均汇率",
  "finance.fx.withSource": "{text}（{source}）",
  "finance.fx.balance": "余款按 ~{rate}",
  "finance.fx.noFx": "已付但未填汇率：{amount}，按 ~{rate} — 请填写汇率",
  "finance.fx.cross": "其他币种付款按当日汇率折算",
  "finance.fx.sellAt": "雷亚尔 → {currency} 按 ~{rate}",
  "finance.fx.sale": "销售时 {rate}",
  "finance.fx.estimatedAt": "按 {rate} 估算",
  "finance.fx.costPartial": "已付按实际汇率；其余按 {rate} 估算",
  "finance.fx.effect": "销售以来汇率影响：{value}",
  "finance.fx.effectTitle":
    "销售时汇率 {sale} → 成本平均汇率 {now}。汇率造成的毛利变化。",
  "finance.fx.estimatedCount": "估算订单：{n}",
  "finance.fx.estimateNote":
    "~ = 估算：已填写汇率的付款按该实际汇率；未填汇率的付款和尚未支付给供应商的部分按当日汇率。",
  "finance.fx.unitHint": "每 1 {currency} 兑雷亚尔",
  "finance.fx.unitHintAny": "每 1 单位该币种兑雷亚尔",
};
