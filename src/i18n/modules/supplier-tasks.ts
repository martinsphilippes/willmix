/**
 * Dicionário do módulo "supplier-tasks" (pendências do fornecedor, pedido do
 * dono em 10/11/2026): os filtros são as etapas que chegam na mão do
 * fornecedor, do Booking ao embarque, cada uma com a explicação, e a coluna
 * "Com você desde". Mesmas chaves em pt, en e zh.
 */
export const pt = {
  "supplierTasks.booking.title": "Analisar o Booking: {product}",
  "supplierTasks.rfq.title": "RFQ: {product}",
  "supplierTasks.booking.detail": "{qty} {unit}",
  "supplierTasks.intro":
    "Aqui está tudo que depende de você, do Booking até o embarque. Toque numa etapa para ver só as pendências dela.",
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
  "tasks.group.supplier.booking": "Analisar o Booking",
  "tasks.group.supplier.dieline": "Faca da embalagem",
  "tasks.group.supplier.sheet": "Ficha de compra",
  "tasks.group.supplier.art": "Aprovar a arte",
  "tasks.group.supplier.sign": "Assinar o pedido",
  "tasks.group.supplier.inspection": "Produção e inspeção",
  "tasks.group.supplier.shipping": "Embarque",
  "supplierTasks.help.booking":
    "Confira preço, pedido mínimo, prazo e fotos do produto e envie a resposta.",
  "supplierTasks.help.dieline":
    "Envie a faca (die-cut) da caixa. A agência faz a arte em cima dela.",
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
  "supplierTasks.booking.title": "Review the Booking: {product}",
  "supplierTasks.rfq.title": "RFQ: {product}",
  "supplierTasks.booking.detail": "{qty} {unit}",
  "supplierTasks.intro":
    "Everything that depends on you, from the Booking to shipment. Tap a step to see only its pending items.",
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
  "tasks.group.supplier.booking": "Review the Booking",
  "tasks.group.supplier.dieline": "Packaging die-cut",
  "tasks.group.supplier.sheet": "Purchase sheet",
  "tasks.group.supplier.art": "Approve the artwork",
  "tasks.group.supplier.sign": "Sign the order",
  "tasks.group.supplier.inspection": "Production and inspection",
  "tasks.group.supplier.shipping": "Shipment",
  "supplierTasks.help.booking":
    "Check price, minimum order, lead time and product photos and send your answer.",
  "supplierTasks.help.dieline":
    "Send the die-cut of the box. The agency builds the artwork on it.",
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
  "supplierTasks.booking.title": "审核 Booking：{product}",
  "supplierTasks.rfq.title": "RFQ：{product}",
  "supplierTasks.booking.detail": "{qty} {unit}",
  "supplierTasks.intro":
    "这里是所有需要您处理的事项，从 Booking 到装运。点击某个环节，只看该环节的待办。",
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
  "tasks.group.supplier.booking": "审核 Booking",
  "tasks.group.supplier.dieline": "包装刀模",
  "tasks.group.supplier.sheet": "采购表",
  "tasks.group.supplier.art": "确认设计稿",
  "tasks.group.supplier.sign": "签署订单",
  "tasks.group.supplier.inspection": "生产与验货",
  "tasks.group.supplier.shipping": "装运",
  "supplierTasks.help.booking":
    "核对价格、起订量、交期和产品照片，然后提交答复。",
  "supplierTasks.help.dieline":
    "上传包装盒刀模（die-cut）。设计公司在其上制作设计稿。",
  "supplierTasks.help.sheet": "填写订单产品的装箱、重量、尺寸和照片。",
  "supplierTasks.help.art":
    "核对包装设计稿并确认，或退回并说明需要修改的地方。",
  "supplierTasks.help.sign": "在门户中签署订单文件，或上传已签署的 PDF。",
  "supplierTasks.help.inspection": "上传成品照片和重量，并整改被退回的项目。",
  "supplierTasks.help.shipping": "核对发票和装箱单，并上传已签署的发票。",
};
