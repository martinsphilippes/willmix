/**
 * Dicionário do módulo "finance-fx" (margem com câmbio: real no que foi pago,
 * estimado pelo câmbio do dia no que falta pagar, e o efeito do câmbio desde a
 * venda): mesmas chaves em pt, en e zh.
 */
export const pt = {
  "finance.fx.paid": "real (pagamentos)",
  "finance.fx.today": "~ câmbio de {day}",
  "finance.fx.stale": "~ último câmbio ({day})",
  "finance.fx.manual": "~ câmbio manual",
  "finance.fx.avgPaid": "~ média já paga",
  "finance.fx.balance": "saldo a ~{rate}",
  "finance.fx.sale": "venda {rate}",
  "finance.fx.estimatedAt": "estimado a {rate}",
  "finance.fx.effect": "câmbio desde a venda: {value}",
  "finance.fx.effectTitle":
    "Câmbio da venda {sale} → agora {now}. Diferença na margem por causa do câmbio.",
  "finance.fx.estimatedCount": "~ {n} pelo câmbio do dia",
  "finance.fx.estimateNote":
    "~ = estimado: o que falta pagar ao fornecedor usa o câmbio do dia; o que já foi pago usa o câmbio real informado no pagamento.",
};

export const en: Record<keyof typeof pt, string> = {
  "finance.fx.paid": "actual (payments)",
  "finance.fx.today": "~ rate of {day}",
  "finance.fx.stale": "~ last rate ({day})",
  "finance.fx.manual": "~ manual rate",
  "finance.fx.avgPaid": "~ average paid",
  "finance.fx.balance": "balance at ~{rate}",
  "finance.fx.sale": "sale {rate}",
  "finance.fx.estimatedAt": "estimated at {rate}",
  "finance.fx.effect": "FX since sale: {value}",
  "finance.fx.effectTitle":
    "Sale rate {sale} → now {now}. Change in margin caused by the exchange rate.",
  "finance.fx.estimatedCount": "~ {n} at today's rate",
  "finance.fx.estimateNote":
    "~ = estimate: what is still payable to the supplier uses today's rate; what was already paid uses the actual rate entered on the payment.",
};

export const zh: Record<keyof typeof pt, string> = {
  "finance.fx.paid": "实际（付款）",
  "finance.fx.today": "~ {day} 汇率",
  "finance.fx.stale": "~ 最近汇率（{day}）",
  "finance.fx.manual": "~ 手动汇率",
  "finance.fx.avgPaid": "~ 已付平均",
  "finance.fx.balance": "余款按 ~{rate}",
  "finance.fx.sale": "销售时 {rate}",
  "finance.fx.estimatedAt": "按 {rate} 估算",
  "finance.fx.effect": "销售以来汇率影响：{value}",
  "finance.fx.effectTitle":
    "销售时汇率 {sale} → 现在 {now}。汇率造成的毛利变化。",
  "finance.fx.estimatedCount": "~ {n} 个按当日汇率",
  "finance.fx.estimateNote":
    "~ = 估算：尚未支付给供应商的部分按当日汇率；已支付部分按付款时填写的实际汇率。",
};
