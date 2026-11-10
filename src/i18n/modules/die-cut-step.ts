/**
 * Dicionário do módulo "die-cut-step" (pedido do dono em 10/11/2026): etapa
 * "Die Cut" do fornecedor escolhido, com os quatro itens que ele envia ou
 * valida (die-cut, foto em alta, pedido mínimo e prazo de entrega). Mesmas
 * chaves em pt, en e zh.
 */
export const pt = {
  "dieCut.title": "Die Cut",
  "dieCut.hint":
    "Nesta etapa você envia o die-cut e a foto em alta do produto e informa ou confirma o pedido mínimo e o prazo de entrega. A agência faz a arte em cima do die-cut.",
  "dieCut.item.dieline": "Die Cut",
  "dieCut.item.hd": "Foto em alta",
  "dieCut.item.moq": "Pedido mínimo (MOQ)",
  "dieCut.item.leadTime": "Prazo de entrega",
  "dieCut.state.done": "Feito",
  "dieCut.state.pending": "Pendente",
  "dieCut.missing": "Falta: {list}.",
  "dieCut.complete": "Os quatro itens estão feitos. Obrigado!",
  "dieCut.dieline.hint": "Arquivo ou foto do die-cut (a faca da caixa).",
  "dieCut.hd.hint":
    "Foto do produto em alta resolução. Pode enviar mais de uma.",
  "dieCut.hd.add": "Adicionar foto em alta",
  "dieCut.terms.hint":
    "Confira os números. Se estiverem certos, é só confirmar; se mudaram, corrija e confirme.",
  "dieCut.moq": "Pedido mínimo (peças)",
  "dieCut.leadTime": "Prazo de entrega (dias)",
  "dieCut.terms.submit": "Confirmar pedido mínimo e prazo",
  "dieCut.saved.dieline": "Die-cut enviado. Quem faz a arte já foi avisado.",
  "dieCut.saved.hd": "Foto em alta enviada.",
  "dieCut.saved.terms": "Pedido mínimo e prazo de entrega confirmados.",
  "dieCut.error.invalid_moq":
    "Pedido mínimo inválido: informe um número inteiro de peças, maior que zero.",
  "dieCut.error.invalid_lead_time":
    "Prazo inválido: informe um número inteiro de dias, de 1 a 720.",
  "dieCut.error.terms_required":
    "Preencha o pedido mínimo e o prazo de entrega para confirmar.",
  "dieCut.error.photo_required": "Escolha pelo menos uma foto.",
  "notif.dieCut.subject": "Die Cut completo: {product}",
  "notif.dieCut.changedSubject":
    "Fornecedor mudou pedido mínimo ou prazo: {product}",
  "notif.dieCut.body":
    "Pedido mínimo: {moq} peças. Prazo de entrega: {days} dias.",
  "notif.dieCut.changed": "Antes: {moq} peças e {days} dias.",
};

export const en: Record<keyof typeof pt, string> = {
  "dieCut.title": "Die Cut",
  "dieCut.hint":
    "In this step you send the die-cut and the high-resolution product photo and inform or confirm the minimum order and the lead time. The agency builds the artwork on the die-cut.",
  "dieCut.item.dieline": "Die Cut",
  "dieCut.item.hd": "High-resolution photo",
  "dieCut.item.moq": "Minimum order (MOQ)",
  "dieCut.item.leadTime": "Lead time",
  "dieCut.state.done": "Done",
  "dieCut.state.pending": "Pending",
  "dieCut.missing": "Missing: {list}.",
  "dieCut.complete": "All four items are done. Thank you!",
  "dieCut.dieline.hint": "File or photo of the box die-cut.",
  "dieCut.hd.hint":
    "High-resolution photo of the product. You can send more than one.",
  "dieCut.hd.add": "Add high-resolution photo",
  "dieCut.terms.hint":
    "Check the numbers. If they are right, just confirm; if they changed, correct them and confirm.",
  "dieCut.moq": "Minimum order (pieces)",
  "dieCut.leadTime": "Lead time (days)",
  "dieCut.terms.submit": "Confirm minimum order and lead time",
  "dieCut.saved.dieline": "Die-cut sent. Whoever makes the artwork was told.",
  "dieCut.saved.hd": "High-resolution photo sent.",
  "dieCut.saved.terms": "Minimum order and lead time confirmed.",
  "dieCut.error.invalid_moq":
    "Invalid minimum order: enter a whole number of pieces, above zero.",
  "dieCut.error.invalid_lead_time":
    "Invalid lead time: enter a whole number of days, from 1 to 720.",
  "dieCut.error.terms_required":
    "Fill in the minimum order and the lead time to confirm.",
  "dieCut.error.photo_required": "Choose at least one photo.",
  "notif.dieCut.subject": "Die Cut complete: {product}",
  "notif.dieCut.changedSubject":
    "Supplier changed minimum order or lead time: {product}",
  "notif.dieCut.body": "Minimum order: {moq} pieces. Lead time: {days} days.",
  "notif.dieCut.changed": "Before: {moq} pieces and {days} days.",
};

export const zh: Record<keyof typeof pt, string> = {
  "dieCut.title": "刀模 (Die Cut)",
  "dieCut.hint":
    "在此环节，请上传刀模和产品高清照片，并填写或确认起订量和交期。设计公司将在刀模上制作设计稿。",
  "dieCut.item.dieline": "刀模 (Die Cut)",
  "dieCut.item.hd": "高清照片",
  "dieCut.item.moq": "起订量 (MOQ)",
  "dieCut.item.leadTime": "交期",
  "dieCut.state.done": "已完成",
  "dieCut.state.pending": "待处理",
  "dieCut.missing": "尚缺：{list}。",
  "dieCut.complete": "四项均已完成，谢谢！",
  "dieCut.dieline.hint": "包装盒刀模的文件或照片。",
  "dieCut.hd.hint": "产品的高清照片，可上传多张。",
  "dieCut.hd.add": "添加高清照片",
  "dieCut.terms.hint": "请核对数字。正确则直接确认；如有变化，请修改后确认。",
  "dieCut.moq": "起订量（件）",
  "dieCut.leadTime": "交期（天）",
  "dieCut.terms.submit": "确认起订量和交期",
  "dieCut.saved.dieline": "刀模已上传，已通知设计方。",
  "dieCut.saved.hd": "高清照片已上传。",
  "dieCut.saved.terms": "起订量和交期已确认。",
  "dieCut.error.invalid_moq": "起订量无效：请输入大于零的整数件数。",
  "dieCut.error.invalid_lead_time":
    "交期无效：请输入 1 到 720 之间的整数天数。",
  "dieCut.error.terms_required": "请填写起订量和交期后再确认。",
  "dieCut.error.photo_required": "请至少选择一张照片。",
  "notif.dieCut.subject": "刀模环节已完成：{product}",
  "notif.dieCut.changedSubject": "供应商修改了起订量或交期：{product}",
  "notif.dieCut.body": "起订量：{moq} 件。交期：{days} 天。",
  "notif.dieCut.changed": "之前：{moq} 件，{days} 天。",
};
