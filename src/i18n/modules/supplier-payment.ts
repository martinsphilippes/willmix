/**
 * Dicionário do módulo "supplier-payment" (pagar o fornecedor: valor devido,
 * dados para o banco, pedido ao financeiro): mesmas chaves em pt, en e zh.
 */
export const pt = {
  "supplierPay.due": "Valor a pagar ao fornecedor",
  "supplierPay.dueHint": "FOB do pedido {fob} · já registrado {paid}",
  "supplierPay.noFob":
    "O pedido ainda não tem valor FOB (preço da cotação × quantidade).",
  "supplierPay.transfer": "Dados para a transferência",
  "supplierPay.missingBank": "Falta no cadastro do fornecedor: {fields}.",
  "supplierPay.fillBank": "Preencher dados bancários",
  "supplierPay.copy": "Copiar dados para o banco",
  "supplierPay.email": "Pedir ao financeiro por e-mail",
  "supplierPay.whatsapp": "Pedir ao financeiro por WhatsApp",
  "supplierPay.actionsHint":
    'Qualquer uma dessas ações registra o pagamento (pendente) e conclui o item "Pagamento ao fornecedor registrado". O valor só conta como pago quando o fornecedor confirma o recebimento.',
  "supplierPay.manual": "Já pagou? Registrar com valor, câmbio e comprovante",
  "supplierPay.done.transfer_copied":
    "Dados copiados e pagamento registrado. Cole no banco para fazer a transferência; o fornecedor confirma o recebimento.",
  "supplierPay.done.finance_email":
    "Pedido enviado ao financeiro por e-mail e pagamento registrado; o fornecedor confirma o recebimento.",
  "supplierPay.done.finance_whatsapp":
    "Pedido enviado ao financeiro por WhatsApp e pagamento registrado; o fornecedor confirma o recebimento.",
  "supplierPay.field.bankBeneficiary": "Beneficiário",
  "supplierPay.field.bankName": "Banco",
  "supplierPay.field.bankAccount": "Conta / IBAN",
  "supplierPay.field.bankSwift": "SWIFT",
  "supplierPay.field.bankAddress": "Endereço do banco",
  "supplierPay.bankTitle": "Dados bancários (pagamento ao fornecedor)",
  "supplierPay.bankHint":
    'Usados no "Copiar dados para o banco" e no pedido ao financeiro.',
  "supplierPay.settings.title": "Pagamento ao fornecedor",
  "supplierPay.settings.hint":
    "Para onde vai o pedido de pagamento ao financeiro. Vazio: a pessoa escolhe o destinatário na hora.",
  "supplierPay.settings.email": "E-mail do financeiro",
  "supplierPay.settings.whatsapp": "WhatsApp do financeiro",
  "supplierPay.settings.whatsappHint": "Com DDI e DDD, ex.: 55 11 99999-8888.",
  "settings.error.finance_email_invalid": "E-mail do financeiro inválido.",
  "settings.error.finance_whatsapp_invalid":
    "WhatsApp do financeiro inválido: informe DDI, DDD e número.",
  "sheet.error.nothing_due": "Não há valor a pagar ao fornecedor neste pedido.",
  "sheet.error.invalid_amount": "Valor do pagamento inválido.",
};

export const en: Record<keyof typeof pt, string> = {
  "supplierPay.due": "Amount to pay the supplier",
  "supplierPay.dueHint": "Order FOB {fob} · already registered {paid}",
  "supplierPay.noFob":
    "The order has no FOB value yet (quote price × quantity).",
  "supplierPay.transfer": "Transfer details",
  "supplierPay.missingBank": "Missing in the supplier record: {fields}.",
  "supplierPay.fillBank": "Fill in bank details",
  "supplierPay.copy": "Copy details for the bank",
  "supplierPay.email": "Ask finance by e-mail",
  "supplierPay.whatsapp": "Ask finance on WhatsApp",
  "supplierPay.actionsHint":
    'Any of these actions registers the payment (pending) and completes the "Supplier payment registered" item. It only counts as paid once the supplier confirms receipt.',
  "supplierPay.manual": "Already paid? Register with amount, rate and receipt",
  "supplierPay.done.transfer_copied":
    "Details copied and payment registered. Paste them at the bank to transfer; the supplier confirms receipt.",
  "supplierPay.done.finance_email":
    "Request sent to finance by e-mail and payment registered; the supplier confirms receipt.",
  "supplierPay.done.finance_whatsapp":
    "Request sent to finance on WhatsApp and payment registered; the supplier confirms receipt.",
  "supplierPay.field.bankBeneficiary": "Beneficiary",
  "supplierPay.field.bankName": "Bank",
  "supplierPay.field.bankAccount": "Account / IBAN",
  "supplierPay.field.bankSwift": "SWIFT",
  "supplierPay.field.bankAddress": "Bank address",
  "supplierPay.bankTitle": "Bank details (supplier payment)",
  "supplierPay.bankHint":
    'Used by "Copy details for the bank" and by the request to finance.',
  "supplierPay.settings.title": "Supplier payment",
  "supplierPay.settings.hint":
    "Where the payment request to finance goes. Empty: pick the recipient each time.",
  "supplierPay.settings.email": "Finance e-mail",
  "supplierPay.settings.whatsapp": "Finance WhatsApp",
  "supplierPay.settings.whatsappHint":
    "With country and area code, e.g. 55 11 99999-8888.",
  "settings.error.finance_email_invalid": "Invalid finance e-mail.",
  "settings.error.finance_whatsapp_invalid":
    "Invalid finance WhatsApp: include country code, area code and number.",
  "sheet.error.nothing_due": "Nothing to pay the supplier on this order.",
  "sheet.error.invalid_amount": "Invalid payment amount.",
};

export const zh: Record<keyof typeof pt, string> = {
  "supplierPay.due": "应付供应商金额",
  "supplierPay.dueHint": "订单 FOB {fob} · 已登记 {paid}",
  "supplierPay.noFob": "订单还没有 FOB 金额（报价 × 数量）。",
  "supplierPay.transfer": "转账信息",
  "supplierPay.missingBank": "供应商档案缺少：{fields}。",
  "supplierPay.fillBank": "填写银行信息",
  "supplierPay.copy": "复制银行转账信息",
  "supplierPay.email": "通过邮件请财务付款",
  "supplierPay.whatsapp": "通过 WhatsApp 请财务付款",
  "supplierPay.actionsHint":
    "任一操作都会登记付款（待处理）并完成“已登记供应商付款”项。供应商确认收款后才算已付。",
  "supplierPay.manual": "已经付款？登记金额、汇率和凭证",
  "supplierPay.done.transfer_copied":
    "信息已复制，付款已登记。请在银行粘贴并转账；供应商确认收款。",
  "supplierPay.done.finance_email":
    "已通过邮件请求财务并登记付款；供应商确认收款。",
  "supplierPay.done.finance_whatsapp":
    "已通过 WhatsApp 请求财务并登记付款；供应商确认收款。",
  "supplierPay.field.bankBeneficiary": "收款人",
  "supplierPay.field.bankName": "银行",
  "supplierPay.field.bankAccount": "账号 / IBAN",
  "supplierPay.field.bankSwift": "SWIFT",
  "supplierPay.field.bankAddress": "银行地址",
  "supplierPay.bankTitle": "银行信息（供应商付款）",
  "supplierPay.bankHint": "用于“复制银行转账信息”和请财务付款。",
  "supplierPay.settings.title": "供应商付款",
  "supplierPay.settings.hint": "付款请求发给财务的地址。留空：每次选择收件人。",
  "supplierPay.settings.email": "财务邮箱",
  "supplierPay.settings.whatsapp": "财务 WhatsApp",
  "supplierPay.settings.whatsappHint": "含国家和区号，例如 55 11 99999-8888。",
  "settings.error.finance_email_invalid": "财务邮箱无效。",
  "settings.error.finance_whatsapp_invalid":
    "财务 WhatsApp 无效：请填写国家码、区号和号码。",
  "sheet.error.nothing_due": "该订单没有应付供应商的金额。",
  "sheet.error.invalid_amount": "付款金额无效。",
};
