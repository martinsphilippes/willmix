/**
 * Sequência do pedido de compra pelo mapa do processo (docs/PURCHASE_ORDER.md,
 * "Sequência e dependências"): o que cada item espera, os itens que o sistema
 * confere sozinho, os avisos entre as áreas e os prazos de cada passo.
 * Mesmas chaves em pt, en e zh.
 */
export const pt = {
  "purchaseSequence.waiting": "Aguarda: {items}",
  "purchaseSequence.gate.ncm": "Validar o NCM do produto",
  "purchaseSequence.gate.sheet": "Completar a ficha do produto",
  "purchaseSequence.gate.downPayment": "Pagamento ao fornecedor",
  "req.down_payment": "Sinal pago ao fornecedor (ou conta corrente)",

  "purchaseSequence.notify.sales.subject":
    "Pedido de compra #{n}: o que vem do fornecedor",
  "purchaseSequence.notify.sales.body":
    "Novo pedido de compra com {items}. Acompanhe a chegada para vender antes.",
  "purchaseSequence.notify.registration.subject":
    "Pedido de compra #{n}: NCM e ficha do produto",
  "purchaseSequence.notify.registration.body":
    "Antes do contrato: valide o NCM e complete a ficha mestre de {products}. O contrato só começa com os dois feitos.",
  "purchaseSequence.notify.artUnlocked.subject":
    "Pedido de compra #{n}: faca e foto em alta recebidas",
  "purchaseSequence.notify.artUnlocked.body":
    "A faca e a foto em alta de {product} chegaram: crie a arte e envie para a validação da Wellmix.",
  "purchaseSequence.notify.downPayment.subject":
    "Pedido de compra #{n}: pagar o sinal ao fornecedor",
  "purchaseSequence.notify.downPayment.body":
    "Contrato assinado pelas duas partes. A produção só começa com o sinal pago (ou a condição de conta corrente configurada no fornecedor).",
  "purchaseSequence.notify.production.subject":
    "Pedido de compra #{n}: produção liberada",
  "purchaseSequence.notify.production.body":
    "Sinal pago: pode começar a produção do pedido.",
  "purchaseSequence.notify.production.bodyAccount":
    "Contrato assinado e conta corrente com a Wellmix: pode começar a produção do pedido.",

  "purchaseSequence.settings.title": "Prazos de cada passo do pedido de compra",
  "purchaseSequence.settings.hint":
    "Dias corridos, contados da liberação do passo (o anterior concluído). Aparecem em Minhas pendências e no Painel de SLA.",
  "purchaseSequence.settings.dieCutDays":
    "Fornecedor: faca, foto em alta, MOQ e prazo (desde o pedido)",
  "purchaseSequence.settings.registrationDays":
    "Cadastro e fiscal: NCM validado e ficha completa (desde o pedido)",
  "purchaseSequence.settings.certDays":
    "Certificadora: certificado (desde o pedido)",
  "purchaseSequence.settings.finalDays":
    "Arte final com o selo (desde a arte validada e o certificado)",
  "purchaseSequence.settings.signatureDays":
    "Cada assinatura do contrato (Wellmix, depois o fornecedor)",
  "purchaseSequence.settings.downPaymentDays":
    "Financeiro: sinal ao fornecedor (desde as duas assinaturas)",
  "purchaseSequence.settings.horizonDays":
    "Período do pedido para a certificação valer (dias)",
  "purchaseSequence.settings.horizonHint":
    "Certificação do produto válida até hoje + este prazo dispensa a renovação com a certificadora.",
  "settings.error.certification_horizon_invalid":
    "Informe o período do pedido para a certificação em dias (de 1 a 730).",
};

export const en: Record<keyof typeof pt, string> = {
  "purchaseSequence.waiting": "Waiting for: {items}",
  "purchaseSequence.gate.ncm": "Validate the product NCM",
  "purchaseSequence.gate.sheet": "Complete the product sheet",
  "purchaseSequence.gate.downPayment": "Payment to the supplier",
  "req.down_payment": "Down payment to the supplier (or current account)",

  "purchaseSequence.notify.sales.subject":
    "Purchase order #{n}: what is coming from the supplier",
  "purchaseSequence.notify.sales.body":
    "New purchase order with {items}. Follow the arrival to sell ahead.",
  "purchaseSequence.notify.registration.subject":
    "Purchase order #{n}: product NCM and sheet",
  "purchaseSequence.notify.registration.body":
    "Before the contract: validate the NCM and complete the master sheet of {products}. The contract only starts with both done.",
  "purchaseSequence.notify.artUnlocked.subject":
    "Purchase order #{n}: die cut and high-resolution photo received",
  "purchaseSequence.notify.artUnlocked.body":
    "The die cut and the high-resolution photo of {product} arrived: create the artwork and send it for Wellmix's validation.",
  "purchaseSequence.notify.downPayment.subject":
    "Purchase order #{n}: pay the down payment to the supplier",
  "purchaseSequence.notify.downPayment.body":
    "Contract signed by both parties. Production only starts with the down payment made (or the supplier set up with a current account).",
  "purchaseSequence.notify.production.subject":
    "Purchase order #{n}: production released",
  "purchaseSequence.notify.production.body":
    "Down payment made: you can start producing the order.",
  "purchaseSequence.notify.production.bodyAccount":
    "Contract signed and current account with Wellmix: you can start producing the order.",

  "purchaseSequence.settings.title": "Deadline of each purchase order step",
  "purchaseSequence.settings.hint":
    "Calendar days, counted from when the step is released (the previous one done). Shown in My tasks and on the SLA panel.",
  "purchaseSequence.settings.dieCutDays":
    "Supplier: die cut, high-resolution photo, MOQ and lead time (from the order)",
  "purchaseSequence.settings.registrationDays":
    "Registration and tax: validated NCM and complete sheet (from the order)",
  "purchaseSequence.settings.certDays":
    "Certifier: certificate (from the order)",
  "purchaseSequence.settings.finalDays":
    "Final artwork with the seal (from the validated artwork and the certificate)",
  "purchaseSequence.settings.signatureDays":
    "Each contract signature (Wellmix, then the supplier)",
  "purchaseSequence.settings.downPaymentDays":
    "Finance: down payment to the supplier (from both signatures)",
  "purchaseSequence.settings.horizonDays":
    "Order period the certification must cover (days)",
  "purchaseSequence.settings.horizonHint":
    "A product certification valid until today + this period skips the renewal with the certifier.",
  "settings.error.certification_horizon_invalid":
    "Enter the order period for the certification in days (1 to 730).",
};

export const zh: Record<keyof typeof pt, string> = {
  "purchaseSequence.waiting": "等待：{items}",
  "purchaseSequence.gate.ncm": "验证产品 NCM",
  "purchaseSequence.gate.sheet": "完善产品资料表",
  "purchaseSequence.gate.downPayment": "向供应商付款",
  "req.down_payment": "已向供应商支付定金（或往来账户）",

  "purchaseSequence.notify.sales.subject": "采购订单 #{n}：供应商即将到货",
  "purchaseSequence.notify.sales.body":
    "新的采购订单，包含 {items}。请跟进到货，提前销售。",
  "purchaseSequence.notify.registration.subject":
    "采购订单 #{n}：产品 NCM 与资料表",
  "purchaseSequence.notify.registration.body":
    "签合同前：请验证 {products} 的 NCM 并完善主资料表。两项完成后合同才开始。",
  "purchaseSequence.notify.artUnlocked.subject":
    "采购订单 #{n}：已收到刀模和高清照片",
  "purchaseSequence.notify.artUnlocked.body":
    "{product} 的刀模和高清照片已到：请制作设计稿并提交 Wellmix 审核。",
  "purchaseSequence.notify.downPayment.subject":
    "采购订单 #{n}：向供应商支付定金",
  "purchaseSequence.notify.downPayment.body":
    "合同已由双方签署。只有支付定金（或供应商设置为往来账户）后才开始生产。",
  "purchaseSequence.notify.production.subject": "采购订单 #{n}：已放行生产",
  "purchaseSequence.notify.production.body": "定金已支付：可以开始生产该订单。",
  "purchaseSequence.notify.production.bodyAccount":
    "合同已签署且与 Wellmix 为往来账户：可以开始生产该订单。",

  "purchaseSequence.settings.title": "采购订单各步骤的期限",
  "purchaseSequence.settings.hint":
    "自然日，从该步骤放行（上一步完成）起计算。显示在我的待办和 SLA 面板。",
  "purchaseSequence.settings.dieCutDays":
    "供应商：刀模、高清照片、起订量和交期（自下单起）",
  "purchaseSequence.settings.registrationDays":
    "登记与税务：NCM 已验证、资料表完整（自下单起）",
  "purchaseSequence.settings.certDays": "认证机构：证书（自下单起）",
  "purchaseSequence.settings.finalDays":
    "带认证标志的最终设计稿（自设计稿审核通过和证书起）",
  "purchaseSequence.settings.signatureDays":
    "合同的每个签名（先 Wellmix，后供应商）",
  "purchaseSequence.settings.downPaymentDays":
    "财务：向供应商支付定金（自双方签署起）",
  "purchaseSequence.settings.horizonDays": "认证需覆盖的订单周期（天）",
  "purchaseSequence.settings.horizonHint":
    "产品认证有效期至今天加上此周期，则无需向认证机构续期。",
  "settings.error.certification_horizon_invalid":
    "请输入认证的订单周期天数（1 至 730）。",
};
