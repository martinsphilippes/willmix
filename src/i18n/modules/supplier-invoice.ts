/**
 * Fatura ativa em N dias (mapa R24; docs/SHIPPING_DOCS.md): prazo por
 * fornecedor contado dos documentos do embarque conferidos. Mesmas chaves em
 * pt, en e zh.
 */
export const pt = {
  "supplierInvoice.title": "Fatura ativa",
  "supplierInvoice.label": "Dias depois dos documentos conferidos",
  "supplierInvoice.hint":
    "Com o BL conferido com a invoice e o packing list, a fatura do pedido fica ativa e o faturamento vence depois destes dias. Vazio: o padrão das Configurações ({days} dia(s)).",
  "supplierInvoice.saved": "Prazo da fatura salvo.",
  "supplierInvoice.due": "Fatura ativa · vence {date}",
  "supplierInvoice.task.title": "Registrar faturamento: pedido #{n}",
  "supplierInvoice.task.detail":
    "Documentos do embarque conferidos: a fatura está ativa e vence em {days} dia(s).",
  "supplierInvoice.notify.subject": "Pedido #{n}: fatura ativa",
  "supplierInvoice.notify.body":
    "Packing list, invoice e BL conferidos. O faturamento vence em {days} dia(s), em {date}.",
  "settings.label.invoiceDays":
    "Fatura ativa: dias depois dos documentos do embarque conferidos, padrão para fornecedor sem prazo próprio (0 = no dia)",
  "tasks.group.invoice_due": "Faturamento",
  "supplierInvoice.error.invoice_days_invalid": "Informe de 0 a 365 dias.",
};

export const en: Record<keyof typeof pt, string> = {
  "supplierInvoice.title": "Active invoice",
  "supplierInvoice.label": "Days after the documents are checked",
  "supplierInvoice.hint":
    "Once the BL matches the invoice and the packing list, the order's invoice becomes active and invoicing is due after these days. Empty: the Settings default ({days} day(s)).",
  "supplierInvoice.saved": "Invoice term saved.",
  "supplierInvoice.due": "Active invoice · due {date}",
  "supplierInvoice.task.title": "Register invoicing: order #{n}",
  "supplierInvoice.task.detail":
    "Shipping documents checked: the invoice is active and due in {days} day(s).",
  "supplierInvoice.notify.subject": "Order #{n}: active invoice",
  "supplierInvoice.notify.body":
    "Packing list, invoice and BL checked. Invoicing is due in {days} day(s), on {date}.",
  "settings.label.invoiceDays":
    "Active invoice: days after the shipping documents are checked, default for suppliers without their own (0 = same day)",
  "tasks.group.invoice_due": "Invoicing",
  "supplierInvoice.error.invoice_days_invalid": "Enter 0 to 365 days.",
};

export const zh: Record<keyof typeof pt, string> = {
  "supplierInvoice.title": "发票生效",
  "supplierInvoice.label": "单据核对后的天数",
  "supplierInvoice.hint":
    "提单与发票、装箱单核对一致后，订单发票生效，开票在这些天后到期。留空：使用设置中的默认值（{days} 天）。",
  "supplierInvoice.saved": "发票期限已保存。",
  "supplierInvoice.due": "发票已生效 · {date} 到期",
  "supplierInvoice.task.title": "登记开票：订单 #{n}",
  "supplierInvoice.task.detail":
    "出运单据已核对：发票已生效，{days} 天后到期。",
  "supplierInvoice.notify.subject": "订单 #{n}：发票已生效",
  "supplierInvoice.notify.body":
    "装箱单、发票和提单已核对。开票在 {days} 天后（{date}）到期。",
  "settings.label.invoiceDays":
    "发票生效：出运单据核对后的天数，适用于没有单独期限的供应商（0 = 当天）",
  "tasks.group.invoice_due": "开票",
  "supplierInvoice.error.invoice_days_invalid": "请输入 0 到 365 天。",
};
