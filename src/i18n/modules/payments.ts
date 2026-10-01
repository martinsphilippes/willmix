/**
 * Dicionário do módulo "payments" (sinal por Pix copia e cola, QR Code e
 * comprovante do cliente): mesmas chaves em pt, en e zh.
 */
export const pt = {
  "payments.pix.title": "Pague com Pix",
  "payments.pix.howTo":
    "No app do banco, escolha Pix copia e cola e cole o código, ou leia o QR Code. Valor e referência já vão preenchidos. Depois, anexe o comprovante aqui embaixo.",
  "payments.pix.qrAlt": "QR Code do Pix do sinal",
  "payments.pix.receiver": "Recebedor",
  "payments.pix.key": "Chave Pix",
  "payments.pix.amount": "Valor",
  "payments.pix.reference": "Referência",
  "payments.pix.code": "Pix copia e cola",
  "payments.pix.copy": "Copiar código Pix",
  "payments.pix.copied": "Código copiado",
  "payments.pix.unavailable.not_configured":
    "A Wellmix vai informar os dados para pagamento. Depois de pagar, anexe o comprovante aqui.",
  "payments.pix.unavailable.not_brl":
    "Este valor não é em reais, então não há Pix. A Wellmix informa como pagar; depois, anexe o comprovante aqui.",
  "payments.pix.unavailable.no_amount":
    "O valor do sinal ainda não foi definido. A Wellmix avisa quando estiver pronto.",
  "payments.pix.unavailable.not_configuredWellmix":
    "Pix desligado: cadastre chave, recebedor e cidade em Configurações para o cliente ver o Pix copia e cola e o QR Code.",
  "payments.pix.unavailable.not_brlWellmix":
    "Sem Pix: o valor ao cliente não está em BRL. Informe ao cliente outra forma de pagamento.",
  "payments.pix.unavailable.no_amountWellmix":
    "Sem Pix: defina o valor do sinal.",
  "payments.proof.label": "Comprovante do pagamento",
  "payments.proof.another": "Enviar outro comprovante",
  "payments.proof.hint": "Foto ou PDF do comprovante do banco.",
  "payments.proof.submit": "Enviar comprovante",
  "payments.proof.sent":
    "Comprovante enviado. A Wellmix confere o recebimento e confirma o sinal; você recebe um aviso quando o pedido for criado.",
  "payments.proof.receivedWellmix":
    "O cliente enviou o comprovante. Confira o recebimento na conta e confirme o sinal.",
  "payments.proof.view": "Ver comprovante",
  "payments.error.proof_required": "Escolha o arquivo do comprovante.",
  "payments.error.invalid_status":
    "Esta solicitação não está mais aguardando o sinal.",
  "payments.error.forbidden": "Só o cliente da solicitação envia o comprovante.",
  "payments.error.not_found": "Solicitação não encontrada.",
  "payments.error.mime": "Formato não aceito. Envie uma foto ou um PDF.",
  "payments.error.too_large": "Arquivo grande demais (máximo 30 MB).",
  "payments.settings.title": "Pagamento do sinal por Pix",
  "payments.settings.hint":
    "Com chave, recebedor e cidade preenchidos, o cliente vê na proposta o Pix copia e cola e o QR Code com o valor do sinal e a referência da solicitação. A confirmação do recebimento continua com a Wellmix. Deixe a chave vazia para desligar.",
  "payments.settings.key": "Chave Pix",
  "payments.settings.keyHint":
    "CPF, CNPJ, e-mail, celular com +55 ou chave aleatória.",
  "payments.settings.receiverName": "Nome do recebedor",
  "payments.settings.receiverNameHint": "Como aparece no banco (até 25).",
  "payments.settings.receiverCity": "Cidade do recebedor",
  "payments.settings.receiverCityHint": "Até 15 caracteres.",
  "settings.error.pix_key_invalid":
    "Chave Pix inválida. Use CPF ou CNPJ válidos, e-mail, celular com +55 ou chave aleatória.",
  "settings.error.pix_incomplete":
    "Para ligar o Pix, preencha também o nome e a cidade do recebedor.",
  "settings.error.pix_too_long":
    "Recebedor até 25 caracteres e cidade até 15.",
};

export const en: Record<keyof typeof pt, string> = {
  "payments.pix.title": "Pay with Pix",
  "payments.pix.howTo":
    "In your bank app, choose Pix copy and paste and paste the code, or scan the QR Code. Amount and reference are already filled in. Then attach the receipt below.",
  "payments.pix.qrAlt": "Down payment Pix QR Code",
  "payments.pix.receiver": "Payee",
  "payments.pix.key": "Pix key",
  "payments.pix.amount": "Amount",
  "payments.pix.reference": "Reference",
  "payments.pix.code": "Pix copy and paste",
  "payments.pix.copy": "Copy Pix code",
  "payments.pix.copied": "Code copied",
  "payments.pix.unavailable.not_configured":
    "Wellmix will send the payment details. After paying, attach the receipt here.",
  "payments.pix.unavailable.not_brl":
    "This amount is not in reais, so there is no Pix. Wellmix will tell you how to pay; then attach the receipt here.",
  "payments.pix.unavailable.no_amount":
    "The down payment amount is not set yet. Wellmix will let you know when it is ready.",
  "payments.pix.unavailable.not_configuredWellmix":
    "Pix is off: set the key, payee and city in Settings so the customer sees the Pix code and QR Code.",
  "payments.pix.unavailable.not_brlWellmix":
    "No Pix: the customer price is not in BRL. Tell the customer another way to pay.",
  "payments.pix.unavailable.no_amountWellmix":
    "No Pix: set the down payment amount.",
  "payments.proof.label": "Payment receipt",
  "payments.proof.another": "Send another receipt",
  "payments.proof.hint": "Photo or PDF of the bank receipt.",
  "payments.proof.submit": "Send receipt",
  "payments.proof.sent":
    "Receipt sent. Wellmix checks the payment and confirms the down payment; you are notified when the order is created.",
  "payments.proof.receivedWellmix":
    "The customer sent the receipt. Check the payment in the account and confirm the down payment.",
  "payments.proof.view": "View receipt",
  "payments.error.proof_required": "Choose the receipt file.",
  "payments.error.invalid_status":
    "This request is no longer waiting for the down payment.",
  "payments.error.forbidden": "Only the request's customer sends the receipt.",
  "payments.error.not_found": "Request not found.",
  "payments.error.mime": "Format not accepted. Send a photo or a PDF.",
  "payments.error.too_large": "File too large (30 MB max).",
  "payments.settings.title": "Down payment by Pix",
  "payments.settings.hint":
    "With key, payee and city filled in, the customer sees on the proposal the Pix copy-and-paste code and QR Code with the down payment amount and the request reference. Wellmix still confirms receipt. Leave the key empty to turn it off.",
  "payments.settings.key": "Pix key",
  "payments.settings.keyHint":
    "CPF, CNPJ, e-mail, mobile with +55 or random key.",
  "payments.settings.receiverName": "Payee name",
  "payments.settings.receiverNameHint": "As shown at the bank (up to 25).",
  "payments.settings.receiverCity": "Payee city",
  "payments.settings.receiverCityHint": "Up to 15 characters.",
  "settings.error.pix_key_invalid":
    "Invalid Pix key. Use a valid CPF or CNPJ, e-mail, mobile with +55 or random key.",
  "settings.error.pix_incomplete":
    "To turn Pix on, also fill in the payee name and city.",
  "settings.error.pix_too_long": "Payee up to 25 characters and city up to 15.",
};

export const zh: Record<keyof typeof pt, string> = {
  "payments.pix.title": "使用 Pix 付款",
  "payments.pix.howTo":
    "在银行 App 中选择 Pix 复制粘贴并粘贴代码，或扫描二维码。金额和参考号已自动填写。付款后请在下方上传凭证。",
  "payments.pix.qrAlt": "定金 Pix 二维码",
  "payments.pix.receiver": "收款人",
  "payments.pix.key": "Pix 密钥",
  "payments.pix.amount": "金额",
  "payments.pix.reference": "参考号",
  "payments.pix.code": "Pix 复制粘贴码",
  "payments.pix.copy": "复制 Pix 代码",
  "payments.pix.copied": "已复制",
  "payments.pix.unavailable.not_configured":
    "Wellmix 将发送付款信息。付款后请在此上传凭证。",
  "payments.pix.unavailable.not_brl":
    "该金额不是雷亚尔，无法使用 Pix。Wellmix 会告知付款方式；付款后请在此上传凭证。",
  "payments.pix.unavailable.no_amount": "定金金额尚未确定，Wellmix 准备好后会通知您。",
  "payments.pix.unavailable.not_configuredWellmix":
    "Pix 未启用：请在设置中填写密钥、收款人和城市，客户才能看到 Pix 代码和二维码。",
  "payments.pix.unavailable.not_brlWellmix":
    "无 Pix：客户价格不是 BRL。请告知客户其他付款方式。",
  "payments.pix.unavailable.no_amountWellmix": "无 Pix：请设置定金金额。",
  "payments.proof.label": "付款凭证",
  "payments.proof.another": "再次上传凭证",
  "payments.proof.hint": "银行凭证的照片或 PDF。",
  "payments.proof.submit": "上传凭证",
  "payments.proof.sent":
    "凭证已上传。Wellmix 核对到账后确认定金；订单创建时您会收到通知。",
  "payments.proof.receivedWellmix": "客户已上传凭证。请核对到账并确认定金。",
  "payments.proof.view": "查看凭证",
  "payments.error.proof_required": "请选择凭证文件。",
  "payments.error.invalid_status": "该申请已不在等待定金状态。",
  "payments.error.forbidden": "只有该申请的客户可以上传凭证。",
  "payments.error.not_found": "未找到申请。",
  "payments.error.mime": "格式不支持。请上传照片或 PDF。",
  "payments.error.too_large": "文件过大（最大 30 MB）。",
  "payments.settings.title": "Pix 定金付款",
  "payments.settings.hint":
    "填写密钥、收款人和城市后，客户会在报价中看到带有定金金额和申请参考号的 Pix 复制粘贴码和二维码。到账确认仍由 Wellmix 负责。密钥留空即关闭。",
  "payments.settings.key": "Pix 密钥",
  "payments.settings.keyHint": "CPF、CNPJ、电子邮件、带 +55 的手机号或随机密钥。",
  "payments.settings.receiverName": "收款人名称",
  "payments.settings.receiverNameHint": "与银行显示一致（最多 25 个字符）。",
  "payments.settings.receiverCity": "收款人城市",
  "payments.settings.receiverCityHint": "最多 15 个字符。",
  "settings.error.pix_key_invalid":
    "Pix 密钥无效。请使用有效的 CPF 或 CNPJ、电子邮件、带 +55 的手机号或随机密钥。",
  "settings.error.pix_incomplete": "启用 Pix 还需填写收款人名称和城市。",
  "settings.error.pix_too_long": "收款人最多 25 个字符，城市最多 15 个字符。",
};
