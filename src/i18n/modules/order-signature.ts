/**
 * Dicionário do módulo "order-signature" (documento do pedido com as duas
 * assinaturas: Wellmix e fornecedor): mesmas chaves em pt, en e zh.
 */
export const pt = {
  "req.order_signed_wellmix": "Documento do pedido assinado pela Wellmix",
  "req.order_signed_supplier": "Documento do pedido assinado pelo fornecedor",
  "orderSign.title": "Documento do pedido #{n}",
  "orderSign.subtitle":
    "O que foi combinado neste pedido. A Wellmix assina primeiro; o fornecedor assina em seguida. O pedido só segue com as duas assinaturas.",
  "orderSign.open": "Abrir e assinar o documento",
  "orderSign.view": "Ver o documento do pedido",
  "orderSign.buyer": "Comprador",
  "orderSign.supplier": "Fornecedor",
  "orderSign.item": "Produto",
  "orderSign.qty": "Quantidade",
  "orderSign.unitPrice": "Preço por unidade",
  "orderSign.total": "Total",
  "orderSign.leadTime": "Prazo de produção",
  "orderSign.leadTime.days": "{n} dias",
  "orderSign.payment": "Condição de pagamento",
  "orderSign.payment.none": "Conforme combinado (sem parcelas cadastradas).",
  "orderSign.packaging": "Embalagem",
  "orderSign.packaging.ok":
    "Proposta de embalagem {n}, com o OK do fornecedor na cotação.",
  "orderSign.version": "Versão do documento: {hash}",
  "orderSign.signatures": "Assinaturas",
  "orderSign.side.wellmix": "Wellmix",
  "orderSign.side.supplier": "Fornecedor",
  "orderSign.signed": "{name}, em {date}.",
  "orderSign.signed.onBehalf":
    "{name}, em {date}. Assinatura recebida por fora e registrada por {by}.",
  "orderSign.signed.old":
    "Assinou uma versão anterior deste documento (o pedido mudou depois).",
  "orderSign.pending": "Ainda não assinou.",
  "orderSign.waitingWellmix":
    "A Wellmix ainda não assinou. Você assina depois dela.",
  "orderSign.notApplicable":
    "Este pedido é de antes da assinatura no portal: o documento fica só para consulta.",
  "orderSign.form.title": "Assinar",
  "orderSign.form.title.onBehalf":
    "Registrar a assinatura do fornecedor recebida por fora (administrador)",
  "orderSign.form.name": "Seu nome completo",
  "orderSign.form.name.onBehalf": "Nome de quem assinou pelo fornecedor",
  "orderSign.form.agree":
    "Li o documento acima e concordo com produto, quantidade, preço, prazo e condição de pagamento.",
  "orderSign.form.agree.onBehalf":
    "Confirmo que recebi o documento assinado pelo fornecedor (papel ou e-mail) e que ele está guardado.",
  "orderSign.form.submit": "Assinar o documento",
  "orderSign.form.submit.onBehalf": "Registrar a assinatura",
  "orderSign.form.note":
    "A assinatura registra o seu nome, o seu login, a data e a hora e esta versão do documento. É um aceite no portal, não um certificado digital.",
  "orderSign.done": "Assinatura registrada.",
  "orderSign.print": "Imprimir ou salvar em PDF",
  "orderSign.back": "Voltar ao pedido",
  "orderSign.error.signature_required":
    "Este item só é concluído pela assinatura do documento do pedido.",
  "orderSign.error.signature_name_required":
    "Digite o nome completo (pelo menos 3 letras).",
  "orderSign.error.signature_agree_required":
    "Marque que leu e concorda para assinar.",
  "orderSign.error.signature_not_applicable":
    "Este pedido não tem assinatura no portal.",
  "orderSign.error.signature_already_done":
    "Este documento já foi assinado por este lado.",
  "orderSign.error.signature_wellmix_first":
    "A Wellmix assina primeiro. Aguarde a assinatura dela.",
  "orderSign.error.signature_document_changed":
    "O pedido mudou enquanto você lia. Confira o documento de novo e assine.",
  "orderSign.error.stage_not_active":
    "Ainda não é a hora desta assinatura: a etapa dela não está aberta.",
  "orderSign.moq": "Pedido mínimo (MOQ)",
  "orderSign.moq.value": "{n} peças",
  "orderSign.status.awaiting_wellmix":
    "Pronto para assinatura: esperando a Wellmix",
  "orderSign.status.sent_to_supplier":
    "Enviado ao fornecedor: esperando a assinatura dele",
  "orderSign.status.signed":
    "Assinado pelos dois: pedido autorizado, falta gerar no Sankhya",
  "orderSign.status.in_erp": "Pedido gerado no Sankhya: {n}",
  "orderSign.download": "Baixar o documento em PDF",
  "orderSign.file.title": "Como assinar",
  "orderSign.file.steps":
    "1) Baixe o PDF. 2) Assine e carimbe. 3) Anexe aqui o arquivo assinado (PDF ou foto) e toque em Assinar. Sem arquivo, vale o aceite no portal.",
  "orderSign.file.label": "Documento assinado (PDF ou foto)",
  "orderSign.file.label.optional": "Documento assinado (PDF ou foto), opcional",
  "orderSign.signed.file": "Arquivo assinado",
  "orderSign.signed.accept": "Aceite no portal",
  "orderSign.reopen.title":
    "Devolver a assinatura do fornecedor (administrador)",
  "orderSign.reopen.reason": "Motivo (o fornecedor lê)",
  "orderSign.reopen.submit": "Devolver para assinar de novo",
  "orderSign.reopened": "Assinatura devolvida. O fornecedor foi avisado.",
  "orderSign.error.signature_file_invalid":
    "O arquivo assinado precisa ser PDF ou foto (JPG, PNG ou WebP).",
  "orderSign.error.signature_reason_required":
    "Escreva o motivo (pelo menos 3 letras).",
  "notif.orderSignReopened.subject": "Pedido #{n}: assine o documento de novo",
  "notif.orderSignReopened.body":
    "A Wellmix devolveu a sua assinatura: {reason} Abra o documento do pedido e assine de novo.",
  "notif.orderSign.subject": "Pedido #{n}: assine o documento do pedido",
  "notif.orderSign.body":
    "A Wellmix assinou o documento do pedido. Abra, confira produto, quantidade, preço e prazo e assine para o pedido seguir.",
} as const;

export const en: Record<keyof typeof pt, string> = {
  "req.order_signed_wellmix": "Order document signed by Wellmix",
  "req.order_signed_supplier": "Order document signed by the supplier",
  "orderSign.title": "Order document #{n}",
  "orderSign.subtitle":
    "What was agreed for this order. Wellmix signs first; the supplier signs next. The order only goes on with both signatures.",
  "orderSign.open": "Open and sign the document",
  "orderSign.view": "View the order document",
  "orderSign.buyer": "Buyer",
  "orderSign.supplier": "Supplier",
  "orderSign.item": "Product",
  "orderSign.qty": "Quantity",
  "orderSign.unitPrice": "Unit price",
  "orderSign.total": "Total",
  "orderSign.leadTime": "Production lead time",
  "orderSign.leadTime.days": "{n} days",
  "orderSign.payment": "Payment terms",
  "orderSign.payment.none": "As agreed (no installments registered).",
  "orderSign.packaging": "Packaging",
  "orderSign.packaging.ok":
    "Packaging proposal {n}, with the supplier's OK on the quote.",
  "orderSign.version": "Document version: {hash}",
  "orderSign.signatures": "Signatures",
  "orderSign.side.wellmix": "Wellmix",
  "orderSign.side.supplier": "Supplier",
  "orderSign.signed": "{name}, on {date}.",
  "orderSign.signed.onBehalf":
    "{name}, on {date}. Signature received outside the portal and registered by {by}.",
  "orderSign.signed.old":
    "Signed an earlier version of this document (the order changed afterwards).",
  "orderSign.pending": "Not signed yet.",
  "orderSign.waitingWellmix":
    "Wellmix has not signed yet. You sign after them.",
  "orderSign.notApplicable":
    "This order predates signing in the portal: the document is for reference only.",
  "orderSign.form.title": "Sign",
  "orderSign.form.title.onBehalf":
    "Register the supplier's signature received outside the portal (administrator)",
  "orderSign.form.name": "Your full name",
  "orderSign.form.name.onBehalf": "Name of who signed for the supplier",
  "orderSign.form.agree":
    "I have read the document above and agree with product, quantity, price, lead time and payment terms.",
  "orderSign.form.agree.onBehalf":
    "I confirm I received the document signed by the supplier (paper or e-mail) and that it is filed.",
  "orderSign.form.submit": "Sign the document",
  "orderSign.form.submit.onBehalf": "Register the signature",
  "orderSign.form.note":
    "The signature records your name, your login, the date and time and this version of the document. It is an acceptance in the portal, not a digital certificate.",
  "orderSign.done": "Signature registered.",
  "orderSign.print": "Print or save as PDF",
  "orderSign.back": "Back to the order",
  "orderSign.error.signature_required":
    "This item is only completed by signing the order document.",
  "orderSign.error.signature_name_required":
    "Type the full name (at least 3 letters).",
  "orderSign.error.signature_agree_required":
    "Tick that you have read and agree in order to sign.",
  "orderSign.error.signature_not_applicable":
    "This order has no signature in the portal.",
  "orderSign.error.signature_already_done":
    "This document has already been signed by this side.",
  "orderSign.error.signature_wellmix_first":
    "Wellmix signs first. Wait for their signature.",
  "orderSign.error.signature_document_changed":
    "The order changed while you were reading. Check the document again and sign.",
  "orderSign.error.stage_not_active":
    "It is not time for this signature yet: its stage is not open.",
  "orderSign.moq": "Minimum order (MOQ)",
  "orderSign.moq.value": "{n} pcs",
  "orderSign.status.awaiting_wellmix": "Ready to sign: waiting for Wellmix",
  "orderSign.status.sent_to_supplier":
    "Sent to the supplier: waiting for their signature",
  "orderSign.status.signed":
    "Signed by both: order authorized, still to be created in Sankhya",
  "orderSign.status.in_erp": "Order created in Sankhya: {n}",
  "orderSign.download": "Download the document as PDF",
  "orderSign.file.title": "How to sign",
  "orderSign.file.steps":
    "1) Download the PDF. 2) Sign and stamp it. 3) Attach the signed file here (PDF or photo) and tap Sign. Without a file, the acceptance in the portal applies.",
  "orderSign.file.label": "Signed document (PDF or photo)",
  "orderSign.file.label.optional": "Signed document (PDF or photo), optional",
  "orderSign.signed.file": "Signed file",
  "orderSign.signed.accept": "Accepted in the portal",
  "orderSign.reopen.title": "Return the supplier's signature (administrator)",
  "orderSign.reopen.reason": "Reason (the supplier reads it)",
  "orderSign.reopen.submit": "Return to sign again",
  "orderSign.reopened": "Signature returned. The supplier was notified.",
  "orderSign.error.signature_file_invalid":
    "The signed file must be a PDF or a photo (JPG, PNG or WebP).",
  "orderSign.error.signature_reason_required":
    "Write the reason (at least 3 letters).",
  "notif.orderSignReopened.subject": "Order #{n}: sign the document again",
  "notif.orderSignReopened.body":
    "Wellmix returned your signature: {reason} Open the order document and sign again.",
  "notif.orderSign.subject": "Order #{n}: sign the order document",
  "notif.orderSign.body":
    "Wellmix signed the order document. Open it, check product, quantity, price and lead time, and sign so the order can go on.",
};

export const zh: Record<keyof typeof pt, string> = {
  "req.order_signed_wellmix": "Wellmix 已签署订单文件",
  "req.order_signed_supplier": "供应商已签署订单文件",
  "orderSign.title": "订单文件 #{n}",
  "orderSign.subtitle":
    "本订单约定的内容。Wellmix 先签署，供应商随后签署。双方签署后订单才继续。",
  "orderSign.open": "打开并签署文件",
  "orderSign.view": "查看订单文件",
  "orderSign.buyer": "买方",
  "orderSign.supplier": "供应商",
  "orderSign.item": "产品",
  "orderSign.qty": "数量",
  "orderSign.unitPrice": "单价",
  "orderSign.total": "合计",
  "orderSign.leadTime": "生产交期",
  "orderSign.leadTime.days": "{n} 天",
  "orderSign.payment": "付款条件",
  "orderSign.payment.none": "按约定（未登记分期）。",
  "orderSign.packaging": "包装",
  "orderSign.packaging.ok": "包装方案 {n}，供应商已在报价单中确认。",
  "orderSign.version": "文件版本：{hash}",
  "orderSign.signatures": "签署",
  "orderSign.side.wellmix": "Wellmix",
  "orderSign.side.supplier": "供应商",
  "orderSign.signed": "{name}，{date}。",
  "orderSign.signed.onBehalf":
    "{name}，{date}。签署在系统外收到，由 {by} 登记。",
  "orderSign.signed.old": "签署的是本文件的旧版本（之后订单有变更）。",
  "orderSign.pending": "尚未签署。",
  "orderSign.waitingWellmix": "Wellmix 尚未签署。请在其之后签署。",
  "orderSign.notApplicable": "该订单早于系统内签署功能：文件仅供查阅。",
  "orderSign.form.title": "签署",
  "orderSign.form.title.onBehalf": "登记在系统外收到的供应商签署（管理员）",
  "orderSign.form.name": "您的全名",
  "orderSign.form.name.onBehalf": "代表供应商签署的人的姓名",
  "orderSign.form.agree":
    "我已阅读上述文件，并同意产品、数量、价格、交期和付款条件。",
  "orderSign.form.agree.onBehalf":
    "我确认已收到供应商签署的文件（纸质或电子邮件）并已存档。",
  "orderSign.form.submit": "签署文件",
  "orderSign.form.submit.onBehalf": "登记签署",
  "orderSign.form.note":
    "签署会记录您的姓名、登录账号、日期时间以及文件的这一版本。这是系统内的确认，不是数字证书。",
  "orderSign.done": "签署已登记。",
  "orderSign.print": "打印或保存为 PDF",
  "orderSign.back": "返回订单",
  "orderSign.error.signature_required": "此项只能通过签署订单文件来完成。",
  "orderSign.error.signature_name_required": "请输入全名（至少 3 个字符）。",
  "orderSign.error.signature_agree_required": "请勾选已阅读并同意后再签署。",
  "orderSign.error.signature_not_applicable": "该订单没有系统内签署。",
  "orderSign.error.signature_already_done": "该文件这一方已经签署。",
  "orderSign.error.signature_wellmix_first": "Wellmix 先签署。请等待其签署。",
  "orderSign.error.signature_document_changed":
    "在您阅读期间订单有变更。请重新核对文件后签署。",
  "orderSign.error.stage_not_active": "还未到此签署的时间：对应阶段尚未开启。",
  "orderSign.moq": "最小起订量（MOQ）",
  "orderSign.moq.value": "{n} 件",
  "orderSign.status.awaiting_wellmix": "待签署：等待 Wellmix",
  "orderSign.status.sent_to_supplier": "已发送给供应商：等待其签署",
  "orderSign.status.signed": "双方已签署：订单已授权，尚待在 Sankhya 生成",
  "orderSign.status.in_erp": "订单已在 Sankhya 生成：{n}",
  "orderSign.download": "下载 PDF 文件",
  "orderSign.file.title": "如何签署",
  "orderSign.file.steps":
    "1）下载 PDF。2）签字并盖章。3）在此上传已签署的文件（PDF 或照片），然后点击签署。不上传文件时，以系统内确认为准。",
  "orderSign.file.label": "已签署的文件（PDF 或照片）",
  "orderSign.file.label.optional": "已签署的文件（PDF 或照片），选填",
  "orderSign.signed.file": "已签署的文件",
  "orderSign.signed.accept": "系统内确认",
  "orderSign.reopen.title": "退回供应商的签署（管理员）",
  "orderSign.reopen.reason": "原因（供应商可见）",
  "orderSign.reopen.submit": "退回重新签署",
  "orderSign.reopened": "签署已退回，已通知供应商。",
  "orderSign.error.signature_file_invalid":
    "已签署的文件必须是 PDF 或照片（JPG、PNG 或 WebP）。",
  "orderSign.error.signature_reason_required": "请填写原因（至少 3 个字符）。",
  "notif.orderSignReopened.subject": "订单 #{n}：请重新签署文件",
  "notif.orderSignReopened.body":
    "Wellmix 退回了您的签署：{reason} 请打开订单文件并重新签署。",
  "notif.orderSign.subject": "订单 #{n}：请签署订单文件",
  "notif.orderSign.body":
    "Wellmix 已签署订单文件。请打开并核对产品、数量、价格和交期后签署，订单才能继续。",
};
