/**
 * Dicionário do módulo "request-schedule" (programação de entregas pedida
 * pelo cliente na solicitação): mesmas chaves em pt, en e zh.
 */
export const pt = {
  "reqSchedule.toggle": "Programação de entregas",
  "reqSchedule.ask": "Quer receber em mais de uma entrega?",
  "reqSchedule.title": "Programação de entregas",
  "reqSchedule.hint":
    "Divida a quantidade em entregas com intervalo fixo; as datas previstas são calculadas. A Wellmix e o fornecedor seguem esta programação na ficha de compra.",
  "reqSchedule.interval": "Intervalo entre entregas",
  "reqSchedule.days": "{n} dias",
  "reqSchedule.custom": "Outro",
  "reqSchedule.firstDate": "1ª entrega prevista",
  "reqSchedule.n": "Programação {n}",
  "reqSchedule.quantity": "Quantidade",
  "reqSchedule.expected": "Previsão",
  "reqSchedule.add": "Programação",
  "reqSchedule.remove": "Remover programação {n}",
  "reqSchedule.total": "Total: {total} {unit}",
  "reqSchedule.off": "Sem programação (entrega única)",
  "reqSchedule.summary": "{n} entregas a cada {days} dias, a partir de {date}",
  "reqSchedule.requested": "Pedido do cliente: {quantity} {unit} em {date}",
  "reqSchedule.error.invalid":
    "Confira a programação de entregas: quantidades, intervalo e data.",
};

export const en: Record<keyof typeof pt, string> = {
  "reqSchedule.toggle": "Delivery schedule",
  "reqSchedule.ask": "Want to receive in more than one delivery?",
  "reqSchedule.title": "Delivery schedule",
  "reqSchedule.hint":
    "Split the quantity into deliveries at a fixed interval; expected dates are calculated. Wellmix and the supplier follow this schedule on the purchase sheet.",
  "reqSchedule.interval": "Interval between deliveries",
  "reqSchedule.days": "{n} days",
  "reqSchedule.custom": "Other",
  "reqSchedule.firstDate": "1st expected delivery",
  "reqSchedule.n": "Shipment {n}",
  "reqSchedule.quantity": "Quantity",
  "reqSchedule.expected": "Expected",
  "reqSchedule.add": "Shipment",
  "reqSchedule.remove": "Remove shipment {n}",
  "reqSchedule.total": "Total: {total} {unit}",
  "reqSchedule.off": "No schedule (single delivery)",
  "reqSchedule.summary": "{n} deliveries every {days} days, starting {date}",
  "reqSchedule.requested": "Customer request: {quantity} {unit} on {date}",
  "reqSchedule.error.invalid":
    "Check the delivery schedule: quantities, interval and date.",
};

export const zh: Record<keyof typeof pt, string> = {
  "reqSchedule.toggle": "分批交货计划",
  "reqSchedule.ask": "需要分多次交货吗？",
  "reqSchedule.title": "分批交货计划",
  "reqSchedule.hint":
    "将数量按固定间隔分成多次交货，预计日期自动计算。Wellmix 和供应商将在采购单中按此计划执行。",
  "reqSchedule.interval": "交货间隔",
  "reqSchedule.days": "{n} 天",
  "reqSchedule.custom": "其他",
  "reqSchedule.firstDate": "首次预计交货",
  "reqSchedule.n": "第 {n} 批",
  "reqSchedule.quantity": "数量",
  "reqSchedule.expected": "预计",
  "reqSchedule.add": "批次",
  "reqSchedule.remove": "移除第 {n} 批",
  "reqSchedule.total": "合计：{total} {unit}",
  "reqSchedule.off": "不分批（一次交货）",
  "reqSchedule.summary": "{n} 次交货，每 {days} 天一次，自 {date} 起",
  "reqSchedule.requested": "客户需求：{quantity} {unit}，{date}",
  "reqSchedule.error.invalid": "请检查分批交货计划：数量、间隔和日期。",
};
