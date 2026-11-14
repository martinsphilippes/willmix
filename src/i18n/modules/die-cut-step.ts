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
  "dieCut.hd.hint": "Foto do produto em alta resolução.",
  "dieCut.hd.add": "Adicionar foto em alta",
  "dieCut.terms.hint":
    "Confira os números. Se estiverem certos, é só confirmar; se mudaram, corrija e confirme.",
  "dieCut.moq": "Pedido mínimo (peças)",
  "dieCut.leadTime": "Prazo de entrega (dias)",
  "dieCut.terms.submit": "Confirmar pedido mínimo e prazo",
  "dieCut.terms.confirmedBadge": "Confirmado",
  "dieCut.terms.values": "{moq} peças · {days} dias",
  "dieCut.terms.editAria": "Editar pedido mínimo e prazo de entrega: {product}",
  "dieCut.saved.dieline": "Die-cut enviado.",
  "dieCut.saved.hd": "Foto em alta enviada.",
  "dieCut.photo.add": "Adicionar foto",
  "dieCut.saved.photo": "Foto adicionada.",
  "dieCut.saved.removed": "Foto excluída.",
  "dieCut.error.die_cut_send_first":
    "Envie primeiro o arquivo do item; depois o + acrescenta outras fotos.",
  "dieCut.error.mime": "Escolha uma imagem (foto).",
  "dieCut.saved.terms": "Pedido mínimo e prazo de entrega confirmados.",
  "dieCut.error.invalid_moq":
    "Pedido mínimo inválido: informe um número inteiro de peças, maior que zero.",
  "dieCut.error.invalid_lead_time":
    "Prazo inválido: informe um número inteiro de dias, de 1 a 720.",
  "dieCut.error.terms_required":
    "Preencha o pedido mínimo e o prazo de entrega para confirmar.",
  "dieCut.error.photo_required": "Escolha pelo menos uma foto.",
  "dieCut.subtitle": "Pedido #{n}",
  "dieCut.back": "Voltar ao pedido",
  "dieCut.open": "Abrir o Die Cut",
  "dieCut.view": "Ver o Die Cut",
  "dieCut.orderHint":
    "Die-cut, foto em alta, pedido mínimo e prazo de entrega de cada produto ficam no quadro Die Cut.",
  "dieCut.orderHint.supplier":
    "A faca, a foto em alta e o prazo de cada produto também ficam no quadro Die Cut.",
  "dieCut.stageHelp.supplier":
    "Envie a faca (die cut) e a foto em alta resolução de cada produto e confirme o prazo de produção em dias.",
  "dieCut.negotiated": "Negociado: {moq} peças · {days} dias.",
  "dieCut.confirmed": "Confirmado: {moq} peças · {days} dias.",
  "dieCut.closed":
    "Esta etapa do pedido não está aberta: os itens ficam só para consulta.",
  "dieCut.empty": "Este pedido não tem itens de Die Cut.",
  "dieCut.file": "Arquivo enviado",
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
  "dieCut.hd.hint": "High-resolution photo of the product.",
  "dieCut.hd.add": "Add high-resolution photo",
  "dieCut.terms.hint":
    "Check the numbers. If they are right, just confirm; if they changed, correct them and confirm.",
  "dieCut.moq": "Minimum order (pieces)",
  "dieCut.leadTime": "Lead time (days)",
  "dieCut.terms.submit": "Confirm minimum order and lead time",
  "dieCut.terms.confirmedBadge": "Confirmed",
  "dieCut.terms.values": "{moq} pieces · {days} days",
  "dieCut.terms.editAria": "Edit minimum order and lead time: {product}",
  "dieCut.saved.dieline": "Die-cut sent.",
  "dieCut.saved.hd": "High-resolution photo sent.",
  "dieCut.photo.add": "Add photo",
  "dieCut.saved.photo": "Photo added.",
  "dieCut.saved.removed": "Photo deleted.",
  "dieCut.error.die_cut_send_first":
    "Send the item's file first; then + adds more photos.",
  "dieCut.error.mime": "Choose an image (photo).",
  "dieCut.saved.terms": "Minimum order and lead time confirmed.",
  "dieCut.error.invalid_moq":
    "Invalid minimum order: enter a whole number of pieces, above zero.",
  "dieCut.error.invalid_lead_time":
    "Invalid lead time: enter a whole number of days, from 1 to 720.",
  "dieCut.error.terms_required":
    "Fill in the minimum order and the lead time to confirm.",
  "dieCut.error.photo_required": "Choose at least one photo.",
  "dieCut.subtitle": "Order #{n}",
  "dieCut.back": "Back to the order",
  "dieCut.open": "Open Die Cut",
  "dieCut.view": "View Die Cut",
  "dieCut.orderHint":
    "Die-cut, high-resolution photo, minimum order and lead time of each product are in the Die Cut board.",
  "dieCut.orderHint.supplier":
    "The die-cut, the high-resolution photo and the lead time of each product are also in the Die Cut board.",
  "dieCut.stageHelp.supplier":
    "Send the die-cut and the high-resolution photo of each product and confirm the production lead time in days.",
  "dieCut.negotiated": "Negotiated: {moq} pieces · {days} days.",
  "dieCut.confirmed": "Confirmed: {moq} pieces · {days} days.",
  "dieCut.closed":
    "This step of the order is not open: the items are read-only.",
  "dieCut.empty": "This order has no Die Cut items.",
  "dieCut.file": "File sent",
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
  "dieCut.hd.hint": "产品的高清照片。",
  "dieCut.hd.add": "添加高清照片",
  "dieCut.terms.hint": "请核对数字。正确则直接确认；如有变化，请修改后确认。",
  "dieCut.moq": "起订量（件）",
  "dieCut.leadTime": "交期（天）",
  "dieCut.terms.submit": "确认起订量和交期",
  "dieCut.terms.confirmedBadge": "已确认",
  "dieCut.terms.values": "{moq} 件 · {days} 天",
  "dieCut.terms.editAria": "编辑起订量和交期：{product}",
  "dieCut.saved.dieline": "刀模已上传。",
  "dieCut.saved.hd": "高清照片已上传。",
  "dieCut.photo.add": "添加照片",
  "dieCut.saved.photo": "照片已添加。",
  "dieCut.saved.removed": "照片已删除。",
  "dieCut.error.die_cut_send_first":
    "请先上传该项的文件；之后可用 + 添加更多照片。",
  "dieCut.error.mime": "请选择图片（照片）。",
  "dieCut.saved.terms": "起订量和交期已确认。",
  "dieCut.error.invalid_moq": "起订量无效：请输入大于零的整数件数。",
  "dieCut.error.invalid_lead_time":
    "交期无效：请输入 1 到 720 之间的整数天数。",
  "dieCut.error.terms_required": "请填写起订量和交期后再确认。",
  "dieCut.error.photo_required": "请至少选择一张照片。",
  "dieCut.subtitle": "订单 #{n}",
  "dieCut.back": "返回订单",
  "dieCut.open": "打开刀模 (Die Cut)",
  "dieCut.view": "查看刀模 (Die Cut)",
  "dieCut.orderHint":
    "每个产品的刀模、高清照片、起订量和交期都在刀模 (Die Cut) 页面。",
  "dieCut.orderHint.supplier":
    "每个产品的刀模、高清照片和交期也在刀模 (Die Cut) 页面。",
  "dieCut.stageHelp.supplier":
    "请提交每个产品的刀模图 (die cut) 和高清照片，并确认生产交期（天）。",
  "dieCut.negotiated": "已谈定：{moq} 件 · {days} 天。",
  "dieCut.confirmed": "已确认：{moq} 件 · {days} 天。",
  "dieCut.closed": "订单的这个环节未开启：以下内容仅供查看。",
  "dieCut.empty": "此订单没有刀模 (Die Cut) 项目。",
  "dieCut.file": "已上传文件",
  "notif.dieCut.subject": "刀模环节已完成：{product}",
  "notif.dieCut.changedSubject": "供应商修改了起订量或交期：{product}",
  "notif.dieCut.body": "起订量：{moq} 件。交期：{days} 天。",
  "notif.dieCut.changed": "之前：{moq} 件，{days} 天。",
};
