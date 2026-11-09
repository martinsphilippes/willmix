/**
 * Dicionário do módulo "finance-fx" (margem com câmbio: real no que foi pago
 * com o câmbio do banco, estimado pela cotação automática do dia no que foi
 * pago sem câmbio e no que falta pagar, o "Falta o câmbio do banco" com o
 * botão de informar, e o efeito do câmbio desde a venda): mesmas chaves em pt,
 * en e zh.
 * As fontes do câmbio vêm sem "~" e sem parênteses: a tela põe o "~" e o
 * `finance.fx.withSource` põe os parênteses de cada língua.
 */
export const pt = {
  "finance.fx.paid": "câmbio do banco",
  "finance.fx.bankOne": "câmbio do banco, pago em {day}",
  "finance.fx.bankMany": "média do banco ({n} pagamentos), o último em {day}",
  "finance.fx.today": "cotação automática de {day}",
  "finance.fx.stale": "última cotação automática, {day}",
  "finance.fx.manual": "câmbio manual",
  "finance.fx.avgPaid": "média do câmbio do banco",
  "finance.fx.withSource": "{text} ({source})",
  "finance.fx.balance": "a pagar: ~{rate}",
  "finance.fx.noFx": "pago sem câmbio: ~{rate}",
  "finance.fx.balanceNoFx": "a pagar e pago sem câmbio: ~{rate}",
  "finance.fx.missingOne":
    "Falta o câmbio do banco do pagamento de {amount} ({day})",
  "finance.fx.missingMany":
    "Falta o câmbio do banco de {n} pagamentos ({amount})",
  "finance.fx.missingPayment": "{amount}, pago em {day}",
  "finance.fx.savedShort": "Câmbio salvo; custo e margem recalculados.",
  "finance.fx.cross":
    "pagamento em outra moeda convertido pela cotação automática",
  "finance.fx.sellAt": "reais → {currency} a ~{rate}",
  "finance.fx.sale": "câmbio da venda: {rate}",
  "finance.fx.estimatedAt": "estimado a {rate}",
  "finance.fx.costPartial":
    "pago no câmbio do banco; o resto estimado a {rate}",
  "finance.fx.effect": "câmbio desde a venda: {value}",
  "finance.fx.effectTitle":
    "Câmbio da venda {sale} → câmbio médio do custo {now}. Diferença na margem causada pelo câmbio.",
  "finance.fx.estimatedCount": "pedidos estimados: {n}",
  "finance.fx.estimateNote":
    "~ = estimado: o que foi pago com o câmbio do banco informado usa esse câmbio; o que foi pago sem câmbio e o que falta pagar ao fornecedor usam a cotação automática do dia, até alguém informar o câmbio do banco.",
  "finance.fx.unitHint": "R$ por 1 {currency}",
  "finance.fx.unitHintAny": "R$ por 1 unidade da moeda",
  "finance.fx.unitHintShort": "R$ por 1 un.",
  "finance.fx.setTitle": "Informar câmbio",
  "finance.fx.setSave": "Salvar câmbio",
  "finance.fx.bankLabel": "Câmbio do banco (R$ por 1 {currency})",
  "finance.fx.bankLabelAny": "Câmbio do banco (R$ por 1 unidade)",
  "finance.fx.bankHint":
    "O que o banco cobrou. Sem ele, o custo fica estimado.",
  "finance.fx.reference":
    "Referência: cotação automática de {day}, 1 {currency} = R$ {rate}",
  "finance.fx.referenceManual":
    "Referência: câmbio manual, 1 {currency} = R$ {rate}",
  "finance.fx.correct": "Corrigir câmbio",
  "orders.account.action.payment.fx": "Câmbio informado",
  "finance.fx.paymentRate": "câmbio {rate} (R$ por 1 {currency})",
  "finance.fx.paymentMissing":
    "sem câmbio: o custo deste pagamento fica estimado",
  "finance.fx.savedNotice":
    "Câmbio do pagamento salvo: o custo dele deixou de ser estimado.",
  "orders.error.payment_not_settled":
    "O câmbio é informado em pagamento já feito (confirmado ou recebido).",
  "orders.error.payment_brl": "Pagamento em reais não tem câmbio.",
  "orders.error.invalid_fx":
    "Câmbio inválido: informe R$ por 1 unidade da moeda (maior que zero).",
};

export const en: Record<keyof typeof pt, string> = {
  "finance.fx.paid": "bank rate",
  "finance.fx.bankOne": "bank rate, paid on {day}",
  "finance.fx.bankMany": "bank average ({n} payments), last on {day}",
  "finance.fx.today": "automatic quote of {day}",
  "finance.fx.stale": "last automatic quote, {day}",
  "finance.fx.manual": "manual rate",
  "finance.fx.avgPaid": "average bank rate",
  "finance.fx.withSource": "{text} ({source})",
  "finance.fx.balance": "payable: ~{rate}",
  "finance.fx.noFx": "paid without rate: ~{rate}",
  "finance.fx.balanceNoFx": "payable and paid without rate: ~{rate}",
  "finance.fx.missingOne":
    "Missing the bank rate of the {amount} payment ({day})",
  "finance.fx.missingMany": "Missing the bank rate of {n} payments ({amount})",
  "finance.fx.missingPayment": "{amount}, paid on {day}",
  "finance.fx.savedShort": "Rate saved; cost and margin recalculated.",
  "finance.fx.cross":
    "payment in another currency converted at the automatic quote",
  "finance.fx.sellAt": "BRL → {currency} at ~{rate}",
  "finance.fx.sale": "sale rate: {rate}",
  "finance.fx.estimatedAt": "estimated at {rate}",
  "finance.fx.costPartial":
    "paid at the bank rate; the rest estimated at {rate}",
  "finance.fx.effect": "FX since sale: {value}",
  "finance.fx.effectTitle":
    "Sale rate {sale} → average cost rate {now}. Change in margin caused by the exchange rate.",
  "finance.fx.estimatedCount": "estimated orders: {n}",
  "finance.fx.estimateNote":
    "~ = estimate: what was paid with the bank rate entered uses that rate; what was paid without a rate and what is still payable to the supplier use the day's automatic quote until someone enters the bank rate.",
  "finance.fx.unitHint": "BRL per 1 {currency}",
  "finance.fx.unitHintAny": "BRL per 1 unit of the currency",
  "finance.fx.unitHintShort": "BRL per 1 unit",
  "finance.fx.setTitle": "Enter rate",
  "finance.fx.setSave": "Save rate",
  "finance.fx.bankLabel": "Bank rate (BRL per 1 {currency})",
  "finance.fx.bankLabelAny": "Bank rate (BRL per 1 unit)",
  "finance.fx.bankHint":
    "What the bank charged. Without it, the cost stays estimated.",
  "finance.fx.reference":
    "Reference: automatic quote of {day}, 1 {currency} = BRL {rate}",
  "finance.fx.referenceManual":
    "Reference: manual rate, 1 {currency} = BRL {rate}",
  "finance.fx.correct": "Correct rate",
  "orders.account.action.payment.fx": "Rate entered",
  "finance.fx.paymentRate": "rate {rate} (BRL per 1 {currency})",
  "finance.fx.paymentMissing": "no rate: this payment's cost is estimated",
  "finance.fx.savedNotice":
    "Payment rate saved: its cost is no longer estimated.",
  "orders.error.payment_not_settled":
    "The rate is entered on a payment already made (confirmed or received).",
  "orders.error.payment_brl": "A payment in BRL has no exchange rate.",
  "orders.error.invalid_fx":
    "Invalid rate: enter BRL per 1 unit of the currency (greater than zero).",
};

export const zh: Record<keyof typeof pt, string> = {
  "finance.fx.paid": "银行汇率",
  "finance.fx.bankOne": "银行汇率，{day} 付款",
  "finance.fx.bankMany": "银行平均汇率（{n} 笔付款），最近一笔 {day}",
  "finance.fx.today": "{day} 自动牌价",
  "finance.fx.stale": "最近自动牌价 {day}",
  "finance.fx.manual": "手动汇率",
  "finance.fx.avgPaid": "银行平均汇率",
  "finance.fx.withSource": "{text}（{source}）",
  "finance.fx.balance": "待付：~{rate}",
  "finance.fx.noFx": "已付未填汇率：~{rate}",
  "finance.fx.balanceNoFx": "待付及已付未填汇率：~{rate}",
  "finance.fx.missingOne": "缺少 {amount} 付款的银行汇率（{day}）",
  "finance.fx.missingMany": "缺少 {n} 笔付款的银行汇率（{amount}）",
  "finance.fx.missingPayment": "{amount}，{day} 付款",
  "finance.fx.savedShort": "汇率已保存；成本和毛利已重新计算。",
  "finance.fx.cross": "其他币种付款按自动牌价折算",
  "finance.fx.sellAt": "雷亚尔 → {currency} 按 ~{rate}",
  "finance.fx.sale": "销售时汇率：{rate}",
  "finance.fx.estimatedAt": "按 {rate} 估算",
  "finance.fx.costPartial": "已付按银行汇率；其余按 {rate} 估算",
  "finance.fx.effect": "销售以来汇率影响：{value}",
  "finance.fx.effectTitle":
    "销售时汇率 {sale} → 成本平均汇率 {now}。汇率造成的毛利变化。",
  "finance.fx.estimatedCount": "估算订单：{n}",
  "finance.fx.estimateNote":
    "~ = 估算：已填写银行汇率的付款按该汇率；未填汇率的付款和尚未支付给供应商的部分按当日自动牌价，直到填写银行汇率。",
  "finance.fx.unitHint": "每 1 {currency} 兑雷亚尔",
  "finance.fx.unitHintAny": "每 1 单位该币种兑雷亚尔",
  "finance.fx.unitHintShort": "每1单位兑雷亚尔",
  "finance.fx.setTitle": "填写汇率",
  "finance.fx.setSave": "保存汇率",
  "finance.fx.bankLabel": "银行汇率（每 1 {currency} 兑雷亚尔）",
  "finance.fx.bankLabelAny": "银行汇率（每 1 单位兑雷亚尔）",
  "finance.fx.bankHint": "银行实际收取的汇率。不填则成本为估算。",
  "finance.fx.reference": "参考：{day} 自动牌价，1 {currency} = {rate} 雷亚尔",
  "finance.fx.referenceManual": "参考：手动汇率，1 {currency} = {rate} 雷亚尔",
  "finance.fx.correct": "更正汇率",
  "orders.account.action.payment.fx": "已填写汇率",
  "finance.fx.paymentRate": "汇率 {rate}（每 1 {currency} 兑雷亚尔）",
  "finance.fx.paymentMissing": "未填汇率：该付款成本为估算",
  "finance.fx.savedNotice": "付款汇率已保存：其成本不再是估算。",
  "orders.error.payment_not_settled":
    "汇率需在已完成的付款（已确认或已收款）上填写。",
  "orders.error.payment_brl": "雷亚尔付款没有汇率。",
  "orders.error.invalid_fx":
    "汇率无效：请填写每 1 单位外币兑雷亚尔（大于零）。",
};
