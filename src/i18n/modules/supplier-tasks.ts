/**
 * Dicionário do módulo "supplier-tasks" (pendências do fornecedor, pedido do
 * dono em 10/11/2026): os filtros são as etapas que chegam na mão do
 * fornecedor, do Booking ao embarque, cada uma com a explicação, e a coluna
 * "Com você desde". Mesmas chaves em pt, en e zh.
 */
export const pt = {
  "supplierTasks.rfq.title": "RFQ: {product}",
  "supplierTasks.booking.detail": "{qty} {unit}",
  "supplierTasks.intro":
    "Aqui está tudo que depende de você, do Book até o embarque. Toque numa etapa para ver só as pendências dela.",
  "supplierTasks.steps.title": "Etapas que chegam até você",
  "supplierTasks.steps.all": "Todas as etapas",
  "supplierTasks.steps.none": "nada agora",
  "supplierTasks.legend.danger": "Atrasado",
  "supplierTasks.legend.warning": "A fazer, no prazo",
  "supplierTasks.legend.success": "Concluído ou nada a fazer",
  "supplierTasks.steps.count1": "1 pendência",
  "supplierTasks.steps.count": "{n} pendências",
  "supplierTasks.after":
    "Depois do embarque (desembaraço, transporte e entrega ao cliente) nada depende de você. Para acompanhar, abra Pedidos.",
  "supplierTasks.due.hint":
    "Prazo: escolha pelo vencimento. A lista já vem com as mais urgentes primeiro.",
  "supplierTasks.col.step": "Etapa",
  "supplierTasks.col.since": "Com você desde",
  "supplierTasks.since.today": "hoje",
  "supplierTasks.since.day1": "há 1 dia",
  "supplierTasks.since.days": "há {n} dias",
  "supplierTasks.loaded": "produto no sistema desde {date}",
  "supplierTasks.empty":
    "Nenhuma pendência agora. Quando algo chegar para você, aparece aqui, na etapa certa.",
  "supplierTasks.orderStep": "Pedido #{n}: {step}",
  "agencyTasks.intro":
    "Aqui está tudo que depende de você, da arte na cotação até o selo. Toque numa etapa para ver só as pendências dela.",
  "agencyTasks.after":
    "Depois da arte com o selo conferida pela Wellmix, nada depende de você. Para acompanhar, abra Pedidos.",
  "tasks.group.agency.brief": "Arte na cotação",
  "tasks.group.agency.art": "Arte do pedido",
  "tasks.group.agency.seal": "Selo na arte",
  "agencyTasks.help.brief":
    "Faça a arte da embalagem em cima da faca (die-cut) enviada pelo fornecedor e envie os arquivos do briefing.",
  "agencyTasks.help.art":
    "Envie a arte do pedido; se o fornecedor reprovar, corrija e envie de novo.",
  "agencyTasks.help.seal":
    "Aplique na arte o selo enviado pela certificadora e envie a arte com o selo para a Wellmix conferir.",
  "tasks.group.supplier.booking": "Analisar o Book",
  "tasks.group.supplier.request": "Responder a solicitação",
  "supplierTasks.help.request":
    "Diga se faz o item pedido pela Wellmix e em que condições (preço, pedido mínimo e prazo); se vier contraproposta, aceite, proponha de novo ou recuse.",
  "supplierTasks.request.title": "Solicitação nº {n}: {product}",
  "supplierTasks.request.detail":
    "{qty} {unit} · diga se faz o item e em que condições",
  "supplierTasks.request.counter":
    "A Wellmix enviou uma contraproposta: aceite, proponha de novo ou recuse",
  "tasks.group.supplier.dieline": "Die Cut",
  "tasks.group.supplier.sheet": "Ficha de compra",
  "tasks.group.supplier.art": "Aprovar a arte",
  "tasks.group.supplier.sign": "Assinar o pedido",
  "tasks.group.supplier.inspection": "Produção e inspeção",
  "tasks.group.supplier.shipping": "Embarque",
  "supplierTasks.help.booking":
    "Confira preço, pedido mínimo, prazo e fotos do produto e envie a resposta.",
  "supplierTasks.help.dieline":
    "Envie o die-cut e a foto em alta e confirme o pedido mínimo e o prazo de entrega.",
  "supplierTasks.help.sheet":
    "Preencha caixa, pesos, medidas e fotos do produto do pedido.",
  "supplierTasks.help.art":
    "Confira a arte da embalagem e aprove, ou reprove dizendo o que mudar.",
  "supplierTasks.help.sign":
    "Assine o documento do pedido no portal ou envie o PDF assinado.",
  "supplierTasks.help.inspection":
    "Envie fotos e peso do produto pronto e corrija o que for reprovado.",
  "supplierTasks.help.shipping":
    "Confira a invoice e o packing list e envie a invoice assinada.",
};

export const en: Record<keyof typeof pt, string> = {
  "supplierTasks.rfq.title": "RFQ: {product}",
  "supplierTasks.booking.detail": "{qty} {unit}",
  "supplierTasks.intro":
    "Everything that depends on you, from the Book to shipment. Tap a step to see only its pending items.",
  "supplierTasks.steps.title": "Steps that reach you",
  "supplierTasks.steps.all": "All steps",
  "supplierTasks.steps.none": "nothing now",
  "supplierTasks.legend.danger": "Overdue",
  "supplierTasks.legend.warning": "To do, on time",
  "supplierTasks.legend.success": "Done or nothing to do",
  "supplierTasks.steps.count1": "1 pending",
  "supplierTasks.steps.count": "{n} pending",
  "supplierTasks.after":
    "After shipment (customs, transport and delivery to the customer) nothing depends on you. To follow up, open Orders.",
  "supplierTasks.due.hint":
    "Due: choose by due date. The list already shows the most urgent first.",
  "supplierTasks.col.step": "Step",
  "supplierTasks.col.since": "With you since",
  "supplierTasks.since.today": "today",
  "supplierTasks.since.day1": "1 day ago",
  "supplierTasks.since.days": "{n} days ago",
  "supplierTasks.loaded": "product in the system since {date}",
  "supplierTasks.empty":
    "Nothing pending now. When something reaches you, it shows up here, in the right step.",
  "supplierTasks.orderStep": "Order #{n}: {step}",
  "agencyTasks.intro":
    "Everything that depends on you, from the quotation artwork to the seal. Tap a step to see only its pending items.",
  "agencyTasks.after":
    "After Wellmix checks the artwork with the seal, nothing depends on you. To follow up, open Orders.",
  "tasks.group.agency.brief": "Quotation artwork",
  "tasks.group.agency.art": "Order artwork",
  "tasks.group.agency.seal": "Seal on the artwork",
  "agencyTasks.help.brief":
    "Make the packaging artwork on the die-cut sent by the supplier and upload the brief files.",
  "agencyTasks.help.art":
    "Upload the order artwork; if the supplier rejects it, fix it and upload again.",
  "agencyTasks.help.seal":
    "Apply the seal sent by the certifier to the artwork and upload it for Wellmix to check.",
  "tasks.group.supplier.booking": "Review the Book",
  "tasks.group.supplier.request": "Answer the request",
  "supplierTasks.help.request":
    "Say whether you make the item Wellmix asked for and on what terms (price, minimum order and lead time); if a counter-proposal arrives, accept it, propose again or decline.",
  "supplierTasks.request.title": "Request no. {n}: {product}",
  "supplierTasks.request.detail":
    "{qty} {unit} · say whether you make the item and on what terms",
  "supplierTasks.request.counter":
    "Wellmix sent a counter-proposal: accept, propose again or decline",
  "tasks.group.supplier.dieline": "Die Cut",
  "tasks.group.supplier.sheet": "Purchase sheet",
  "tasks.group.supplier.art": "Approve the artwork",
  "tasks.group.supplier.sign": "Sign the order",
  "tasks.group.supplier.inspection": "Production and inspection",
  "tasks.group.supplier.shipping": "Shipment",
  "supplierTasks.help.booking":
    "Check price, minimum order, lead time and product photos and send your answer.",
  "supplierTasks.help.dieline":
    "Send the die-cut and the high-resolution photo and confirm the minimum order and the lead time.",
  "supplierTasks.help.sheet":
    "Fill in carton, weights, measurements and photos of the ordered product.",
  "supplierTasks.help.art":
    "Check the packaging artwork and approve it, or reject it saying what to change.",
  "supplierTasks.help.sign":
    "Sign the order document in the portal or upload the signed PDF.",
  "supplierTasks.help.inspection":
    "Send photos and weight of the finished product and fix what was rejected.",
  "supplierTasks.help.shipping":
    "Check the invoice and the packing list and send the signed invoice.",
};

export const zh: Record<keyof typeof pt, string> = {
  "supplierTasks.rfq.title": "RFQ：{product}",
  "supplierTasks.booking.detail": "{qty} {unit}",
  "supplierTasks.intro":
    "这里是所有需要您处理的事项，从 Book 到装运。点击某个环节，只看该环节的待办。",
  "supplierTasks.steps.title": "需要您处理的环节",
  "supplierTasks.steps.all": "全部环节",
  "supplierTasks.steps.none": "暂无",
  "supplierTasks.legend.danger": "已逾期",
  "supplierTasks.legend.warning": "待办，未逾期",
  "supplierTasks.legend.success": "已完成或无待办",
  "supplierTasks.steps.count1": "1 项待办",
  "supplierTasks.steps.count": "{n} 项待办",
  "supplierTasks.after":
    "装运之后（清关、运输、交付客户）不再需要您处理。如需跟进，请打开“订单”。",
  "supplierTasks.due.hint": "期限：按到期日筛选。列表已按最紧急的排在最前。",
  "supplierTasks.col.step": "环节",
  "supplierTasks.col.since": "到您手上的日期",
  "supplierTasks.since.today": "今天",
  "supplierTasks.since.day1": "1 天前",
  "supplierTasks.since.days": "{n} 天前",
  "supplierTasks.loaded": "产品录入系统日期：{date}",
  "supplierTasks.empty":
    "目前没有待办。有事项需要您处理时，会显示在相应的环节。",
  "supplierTasks.orderStep": "订单 #{n}：{step}",
  "agencyTasks.intro":
    "这里是所有需要您处理的事项，从报价阶段的设计稿到认证标志。点击某个环节，只看该环节的待办。",
  "agencyTasks.after":
    "Wellmix 核对带认证标志的设计稿之后，不再需要您处理。如需跟进，请打开“订单”。",
  "tasks.group.agency.brief": "报价阶段设计稿",
  "tasks.group.agency.art": "订单设计稿",
  "tasks.group.agency.seal": "设计稿加认证标志",
  "agencyTasks.help.brief":
    "在供应商发送的刀模上制作包装设计稿，并上传任务所需文件。",
  "agencyTasks.help.art": "上传订单设计稿；如供应商未通过，请修改后重新上传。",
  "agencyTasks.help.seal":
    "把认证机构发送的认证标志加到设计稿上，并上传给 Wellmix 核对。",
  "tasks.group.supplier.booking": "审核 Book",
  "tasks.group.supplier.request": "答复询问",
  "supplierTasks.help.request":
    "请说明是否能做 Wellmix 询问的产品以及条件（价格、起订量和交期）；如收到还价，请接受、重新报价或拒绝。",
  "supplierTasks.request.title": "询问 {n} 号：{product}",
  "supplierTasks.request.detail": "{qty} {unit} · 请说明是否能做及条件",
  "supplierTasks.request.counter": "Wellmix 已还价：请接受、重新报价或拒绝",
  "tasks.group.supplier.dieline": "刀模 (Die Cut)",
  "tasks.group.supplier.sheet": "采购表",
  "tasks.group.supplier.art": "确认设计稿",
  "tasks.group.supplier.sign": "签署订单",
  "tasks.group.supplier.inspection": "生产与验货",
  "tasks.group.supplier.shipping": "装运",
  "supplierTasks.help.booking":
    "核对价格、起订量、交期和产品照片，然后提交答复。",
  "supplierTasks.help.dieline": "上传刀模和高清照片，并确认起订量和交期。",
  "supplierTasks.help.sheet": "填写订单产品的装箱、重量、尺寸和照片。",
  "supplierTasks.help.art":
    "核对包装设计稿并确认，或退回并说明需要修改的地方。",
  "supplierTasks.help.sign": "在门户中签署订单文件，或上传已签署的 PDF。",
  "supplierTasks.help.inspection": "上传成品照片和重量，并整改被退回的项目。",
  "supplierTasks.help.shipping": "核对发票和装箱单，并上传已签署的发票。",
};
