/**
 * Documentos do embarque do pedido de compra (docs/SHIPPING_DOCS.md): check
 * list de carga, packing list, invoice e BL com a conferência linha a linha.
 * Mesmas chaves em pt, en e zh.
 */
export const pt = {
  "shippingDocs.title": "Documentos do embarque · pedido #{n}",
  "shippingDocs.subtitle":
    "Check list de carga, packing list, invoice e BL. O sistema confere cada documento com o anterior, linha a linha: caixas, peças, peso líquido e peso bruto.",
  "shippingDocs.back": "← Voltar ao pedido",
  "shippingDocs.open": "Documentos do embarque",
  "shippingDocs.orderHint":
    "Check list de carga, packing list, invoice e BL, conferidos pelo sistema.",
  "shippingDocs.status.draft": "Em andamento",
  "shippingDocs.status.submitted": "Enviado",
  "shippingDocs.status.accepted": "Conferido",
  "shippingDocs.status.rejected": "Não bateu: refazer",
  "shippingDocs.status.waiting": "Aguardando",
  "shippingDocs.col.item": "Item",
  "shippingDocs.col.expected": "Caixas do pedido",
  "shippingDocs.col.loaded": "Caixas carregadas",
  "shippingDocs.col.remaining": "Faltam",
  "shippingDocs.col.add": "Subiram agora",
  "shippingDocs.col.cartons": "Caixas",
  "shippingDocs.col.pieces": "Peças",
  "shippingDocs.col.netKg": "Peso líquido (kg)",
  "shippingDocs.col.grossKg": "Peso bruto (kg)",
  "shippingDocs.col.unitPrice": "Preço por peça",
  "shippingDocs.total": "Total",
  "shippingDocs.noBox": "sem caixa master no cadastro",
  "shippingDocs.load.title": "1. Check list de carga",
  "shippingDocs.load.hint":
    "Em cada item, marque quantas caixas subiram no container. O pedido vai sendo abatido até terminar.",
  "shippingDocs.load.waiting":
    "Abre depois das fotos e vídeos do container vazio (cartão Container na origem).",
  "shippingDocs.load.submit": "Registrar as caixas",
  "shippingDocs.load.done":
    "Carga completa: todas as caixas do pedido estão no container.",
  "shippingDocs.packing.title": "2. Packing list (fornecedor)",
  "shippingDocs.packing.hint":
    "As caixas vêm do check list. Confira as peças e os pesos de cada item e envie.",
  "shippingDocs.packing.submit": "Enviar o packing list",
  "shippingDocs.invoice.title": "3. Invoice (trading)",
  "shippingDocs.invoice.hint":
    "A invoice precisa bater com o packing list, linha a linha. Se não bater, ela volta para ser refeita.",
  "shippingDocs.invoice.number": "Nº da invoice",
  "shippingDocs.invoice.submit": "Enviar a invoice",
  "shippingDocs.bl.title": "4. BL (companhia marítima)",
  "shippingDocs.bl.hint":
    "O BL precisa bater com a invoice, linha a linha. Se não bater, ele volta para ser refeito.",
  "shippingDocs.bl.number": "Nº do BL",
  "shippingDocs.bl.container": "Nº do container",
  "shippingDocs.bl.submit": "Enviar o BL",
  "shippingDocs.file": "Arquivo do documento",
  "shippingDocs.fileOptional": "Arquivo (opcional)",
  "shippingDocs.waitPrevious": "Aguardando o documento anterior.",
  "shippingDocs.mismatch.title": "Diferenças encontradas",
  "shippingDocs.mismatch.row":
    "{item}: {field} esperado {expected}, informado {found}",
  "shippingDocs.field.cartons": "caixas",
  "shippingDocs.field.pieces": "peças",
  "shippingDocs.field.netKg": "peso líquido",
  "shippingDocs.field.grossKg": "peso bruto",
  "shippingDocs.field.item": "item",
  "shippingDocs.sentBy": "Enviado por {name} em {date}",
  "shippingDocs.done.load": "Caixas registradas.",
  "shippingDocs.done.packing_list": "Packing list enviado.",
  "shippingDocs.done.invoice": "Invoice enviada.",
  "shippingDocs.done.bl": "BL enviado.",
  "shippingDocs.error.shipping_load_closed":
    "O check list não está aberto agora.",
  "shippingDocs.error.shipping_load_over":
    "Mais caixas do que faltam para o item: confira o número.",
  "shippingDocs.error.shipping_load_empty":
    "Informe as caixas de ao menos um item.",
  "shippingDocs.error.shipping_doc_closed":
    "Este documento não está aberto agora.",
  "shippingDocs.error.shipping_lines_required":
    "Informe peças, peso líquido e peso bruto de todos os itens.",
  "shippingDocs.error.shipping_number_required":
    "Informe o número do documento.",
  "shippingDocs.error.shipping_container_required":
    "Informe o número do container.",
  "shippingDocs.error.file_required": "Envie o arquivo do documento.",
  "orders.error.shipping_docs_required":
    "O embarque só é confirmado com o container lacrado no porto e o BL conferido.",
  "shippingDocs.notify.packing.subject":
    "Pedido #{n}: carga completa, faça o packing list",
  "shippingDocs.notify.packing.body":
    "Todas as caixas do pedido subiram no container. Confira as peças e os pesos e envie o packing list.",
  "shippingDocs.notify.invoice.subject": "Pedido #{n}: faça a invoice",
  "shippingDocs.notify.invoice.body":
    "O packing list foi enviado. Faça a invoice com as mesmas caixas, peças e pesos de cada item.",
  "shippingDocs.notify.invoiceRedo.subject":
    "Pedido #{n}: a invoice não bate com o packing list",
  "shippingDocs.notify.invoiceRedo.body":
    "{count} diferença(s) entre a invoice e o packing list. Refaça a invoice.",
  "shippingDocs.notify.bl.subject": "Pedido #{n}: faça o BL",
  "shippingDocs.notify.bl.body":
    "A invoice foi conferida. Faça o BL com as mesmas caixas, peças e pesos de cada item.",
  "shippingDocs.notify.blRedo.subject":
    "Pedido #{n}: o BL não bate com a invoice",
  "shippingDocs.notify.blRedo.body":
    "{count} diferença(s) entre o BL e a invoice. Refaça o BL.",
  "shippingDocs.task.load.title": "Check list de carga: pedido #{n}",
  "shippingDocs.task.load.detail":
    "Marque as caixas de cada item que subiram no container, até terminar o pedido.",
  "shippingDocs.task.packing_list.title": "Packing list: pedido #{n}",
  "shippingDocs.task.packing_list.detail":
    "A carga está completa. Confira peças e pesos e envie o packing list.",
  "shippingDocs.task.invoice.title": "Invoice: pedido #{n}",
  "shippingDocs.task.invoice.detail":
    "Faça a invoice com as mesmas caixas, peças e pesos do packing list.",
  "shippingDocs.task.bl.title": "BL: pedido #{n}",
  "shippingDocs.task.bl.detail":
    "Faça o BL com as mesmas caixas, peças e pesos da invoice.",
  "shippingDocs.task.redo.detail":
    "Não bateu com o documento anterior. Veja as diferenças e envie de novo.",
};

export const en: Record<keyof typeof pt, string> = {
  "shippingDocs.title": "Shipping documents · order #{n}",
  "shippingDocs.subtitle":
    "Load checklist, packing list, invoice and BL. The system checks each document against the previous one, line by line: cartons, pieces, net and gross weight.",
  "shippingDocs.back": "← Back to the order",
  "shippingDocs.open": "Shipping documents",
  "shippingDocs.orderHint":
    "Load checklist, packing list, invoice and BL, checked by the system.",
  "shippingDocs.status.draft": "In progress",
  "shippingDocs.status.submitted": "Sent",
  "shippingDocs.status.accepted": "Checked",
  "shippingDocs.status.rejected": "Did not match: redo",
  "shippingDocs.status.waiting": "Waiting",
  "shippingDocs.col.item": "Item",
  "shippingDocs.col.expected": "Ordered cartons",
  "shippingDocs.col.loaded": "Loaded cartons",
  "shippingDocs.col.remaining": "Left",
  "shippingDocs.col.add": "Loaded now",
  "shippingDocs.col.cartons": "Cartons",
  "shippingDocs.col.pieces": "Pieces",
  "shippingDocs.col.netKg": "Net weight (kg)",
  "shippingDocs.col.grossKg": "Gross weight (kg)",
  "shippingDocs.col.unitPrice": "Price per piece",
  "shippingDocs.total": "Total",
  "shippingDocs.noBox": "no master carton in the registry",
  "shippingDocs.load.title": "1. Load checklist",
  "shippingDocs.load.hint":
    "For each item, mark how many cartons went into the container. The order is deducted until done.",
  "shippingDocs.load.waiting":
    "Opens after the photos and videos of the empty container (Container at origin card).",
  "shippingDocs.load.submit": "Record the cartons",
  "shippingDocs.load.done":
    "Load complete: all the order's cartons are in the container.",
  "shippingDocs.packing.title": "2. Packing list (supplier)",
  "shippingDocs.packing.hint":
    "The cartons come from the checklist. Check the pieces and weights of each item and send.",
  "shippingDocs.packing.submit": "Send the packing list",
  "shippingDocs.invoice.title": "3. Invoice (trading)",
  "shippingDocs.invoice.hint":
    "The invoice must match the packing list, line by line. If it doesn't, it goes back to be redone.",
  "shippingDocs.invoice.number": "Invoice no.",
  "shippingDocs.invoice.submit": "Send the invoice",
  "shippingDocs.bl.title": "4. BL (shipping line)",
  "shippingDocs.bl.hint":
    "The BL must match the invoice, line by line. If it doesn't, it goes back to be redone.",
  "shippingDocs.bl.number": "BL no.",
  "shippingDocs.bl.container": "Container no.",
  "shippingDocs.bl.submit": "Send the BL",
  "shippingDocs.file": "Document file",
  "shippingDocs.fileOptional": "File (optional)",
  "shippingDocs.waitPrevious": "Waiting for the previous document.",
  "shippingDocs.mismatch.title": "Differences found",
  "shippingDocs.mismatch.row":
    "{item}: {field} expected {expected}, entered {found}",
  "shippingDocs.field.cartons": "cartons",
  "shippingDocs.field.pieces": "pieces",
  "shippingDocs.field.netKg": "net weight",
  "shippingDocs.field.grossKg": "gross weight",
  "shippingDocs.field.item": "item",
  "shippingDocs.sentBy": "Sent by {name} on {date}",
  "shippingDocs.done.load": "Cartons recorded.",
  "shippingDocs.done.packing_list": "Packing list sent.",
  "shippingDocs.done.invoice": "Invoice sent.",
  "shippingDocs.done.bl": "BL sent.",
  "shippingDocs.error.shipping_load_closed": "The checklist is not open now.",
  "shippingDocs.error.shipping_load_over":
    "More cartons than are left for the item: check the number.",
  "shippingDocs.error.shipping_load_empty":
    "Enter the cartons of at least one item.",
  "shippingDocs.error.shipping_doc_closed": "This document is not open now.",
  "shippingDocs.error.shipping_lines_required":
    "Enter pieces, net and gross weight of every item.",
  "shippingDocs.error.shipping_number_required": "Enter the document number.",
  "shippingDocs.error.shipping_container_required":
    "Enter the container number.",
  "shippingDocs.error.file_required": "Send the document file.",
  "orders.error.shipping_docs_required":
    "The shipment is only confirmed with the sealed container at the port and the BL checked.",
  "shippingDocs.notify.packing.subject":
    "Order #{n}: load complete, make the packing list",
  "shippingDocs.notify.packing.body":
    "All the order's cartons are in the container. Check the pieces and weights and send the packing list.",
  "shippingDocs.notify.invoice.subject": "Order #{n}: make the invoice",
  "shippingDocs.notify.invoice.body":
    "The packing list was sent. Make the invoice with the same cartons, pieces and weights of each item.",
  "shippingDocs.notify.invoiceRedo.subject":
    "Order #{n}: the invoice does not match the packing list",
  "shippingDocs.notify.invoiceRedo.body":
    "{count} difference(s) between the invoice and the packing list. Redo the invoice.",
  "shippingDocs.notify.bl.subject": "Order #{n}: make the BL",
  "shippingDocs.notify.bl.body":
    "The invoice was checked. Make the BL with the same cartons, pieces and weights of each item.",
  "shippingDocs.notify.blRedo.subject":
    "Order #{n}: the BL does not match the invoice",
  "shippingDocs.notify.blRedo.body":
    "{count} difference(s) between the BL and the invoice. Redo the BL.",
  "shippingDocs.task.load.title": "Load checklist: order #{n}",
  "shippingDocs.task.load.detail":
    "Mark the cartons of each item that went into the container, until the order is done.",
  "shippingDocs.task.packing_list.title": "Packing list: order #{n}",
  "shippingDocs.task.packing_list.detail":
    "The load is complete. Check pieces and weights and send the packing list.",
  "shippingDocs.task.invoice.title": "Invoice: order #{n}",
  "shippingDocs.task.invoice.detail":
    "Make the invoice with the same cartons, pieces and weights as the packing list.",
  "shippingDocs.task.bl.title": "BL: order #{n}",
  "shippingDocs.task.bl.detail":
    "Make the BL with the same cartons, pieces and weights as the invoice.",
  "shippingDocs.task.redo.detail":
    "It did not match the previous document. See the differences and send again.",
};

export const zh: Record<keyof typeof pt, string> = {
  "shippingDocs.title": "出运单据 · 订单 #{n}",
  "shippingDocs.subtitle":
    "装柜清单、装箱单、发票和提单。系统将每份单据与上一份逐行核对：箱数、件数、净重和毛重。",
  "shippingDocs.back": "← 返回订单",
  "shippingDocs.open": "出运单据",
  "shippingDocs.orderHint": "装柜清单、装箱单、发票和提单，由系统核对。",
  "shippingDocs.status.draft": "进行中",
  "shippingDocs.status.submitted": "已提交",
  "shippingDocs.status.accepted": "已核对",
  "shippingDocs.status.rejected": "不一致：请重做",
  "shippingDocs.status.waiting": "等待中",
  "shippingDocs.col.item": "项目",
  "shippingDocs.col.expected": "订单箱数",
  "shippingDocs.col.loaded": "已装箱数",
  "shippingDocs.col.remaining": "剩余",
  "shippingDocs.col.add": "本次装柜",
  "shippingDocs.col.cartons": "箱数",
  "shippingDocs.col.pieces": "件数",
  "shippingDocs.col.netKg": "净重（kg）",
  "shippingDocs.col.grossKg": "毛重（kg）",
  "shippingDocs.col.unitPrice": "单价",
  "shippingDocs.total": "合计",
  "shippingDocs.noBox": "资料中无外箱数量",
  "shippingDocs.load.title": "1. 装柜清单",
  "shippingDocs.load.hint":
    "每个项目填写装进集装箱的箱数，订单逐步扣减直至完成。",
  "shippingDocs.load.waiting": "空柜照片和视频提交后开放（起运地集装箱卡片）。",
  "shippingDocs.load.submit": "登记箱数",
  "shippingDocs.load.done": "装柜完成：订单所有箱子都已装柜。",
  "shippingDocs.packing.title": "2. 装箱单（供应商）",
  "shippingDocs.packing.hint":
    "箱数来自装柜清单。请核对每个项目的件数和重量后提交。",
  "shippingDocs.packing.submit": "提交装箱单",
  "shippingDocs.invoice.title": "3. 发票（贸易商）",
  "shippingDocs.invoice.hint": "发票须与装箱单逐行一致，不一致将退回重做。",
  "shippingDocs.invoice.number": "发票号",
  "shippingDocs.invoice.submit": "提交发票",
  "shippingDocs.bl.title": "4. 提单（船公司）",
  "shippingDocs.bl.hint": "提单须与发票逐行一致，不一致将退回重做。",
  "shippingDocs.bl.number": "提单号",
  "shippingDocs.bl.container": "柜号",
  "shippingDocs.bl.submit": "提交提单",
  "shippingDocs.file": "单据文件",
  "shippingDocs.fileOptional": "文件（可选）",
  "shippingDocs.waitPrevious": "等待上一份单据。",
  "shippingDocs.mismatch.title": "发现的差异",
  "shippingDocs.mismatch.row":
    "{item}：{field} 应为 {expected}，填写为 {found}",
  "shippingDocs.field.cartons": "箱数",
  "shippingDocs.field.pieces": "件数",
  "shippingDocs.field.netKg": "净重",
  "shippingDocs.field.grossKg": "毛重",
  "shippingDocs.field.item": "项目",
  "shippingDocs.sentBy": "{name} 于 {date} 提交",
  "shippingDocs.done.load": "箱数已登记。",
  "shippingDocs.done.packing_list": "装箱单已提交。",
  "shippingDocs.done.invoice": "发票已提交。",
  "shippingDocs.done.bl": "提单已提交。",
  "shippingDocs.error.shipping_load_closed": "装柜清单目前未开放。",
  "shippingDocs.error.shipping_load_over": "箱数超过该项目剩余数量：请核对。",
  "shippingDocs.error.shipping_load_empty": "请至少填写一个项目的箱数。",
  "shippingDocs.error.shipping_doc_closed": "该单据目前未开放。",
  "shippingDocs.error.shipping_lines_required":
    "请填写所有项目的件数、净重和毛重。",
  "shippingDocs.error.shipping_number_required": "请填写单据号。",
  "shippingDocs.error.shipping_container_required": "请填写柜号。",
  "shippingDocs.error.file_required": "请上传单据文件。",
  "orders.error.shipping_docs_required":
    "只有已封柜到港且提单核对无误后才能确认出运。",
  "shippingDocs.notify.packing.subject": "订单 #{n}：装柜完成，请制作装箱单",
  "shippingDocs.notify.packing.body":
    "订单所有箱子都已装柜。请核对件数和重量并提交装箱单。",
  "shippingDocs.notify.invoice.subject": "订单 #{n}：请制作发票",
  "shippingDocs.notify.invoice.body":
    "装箱单已提交。请按每个项目相同的箱数、件数和重量制作发票。",
  "shippingDocs.notify.invoiceRedo.subject": "订单 #{n}：发票与装箱单不一致",
  "shippingDocs.notify.invoiceRedo.body":
    "发票与装箱单有 {count} 处差异。请重做发票。",
  "shippingDocs.notify.bl.subject": "订单 #{n}：请制作提单",
  "shippingDocs.notify.bl.body":
    "发票已核对。请按每个项目相同的箱数、件数和重量制作提单。",
  "shippingDocs.notify.blRedo.subject": "订单 #{n}：提单与发票不一致",
  "shippingDocs.notify.blRedo.body":
    "提单与发票有 {count} 处差异。请重做提单。",
  "shippingDocs.task.load.title": "装柜清单：订单 #{n}",
  "shippingDocs.task.load.detail": "逐项填写装进集装箱的箱数，直至订单完成。",
  "shippingDocs.task.packing_list.title": "装箱单：订单 #{n}",
  "shippingDocs.task.packing_list.detail":
    "装柜已完成。请核对件数和重量并提交装箱单。",
  "shippingDocs.task.invoice.title": "发票：订单 #{n}",
  "shippingDocs.task.invoice.detail":
    "按装箱单相同的箱数、件数和重量制作发票。",
  "shippingDocs.task.bl.title": "提单：订单 #{n}",
  "shippingDocs.task.bl.detail": "按发票相同的箱数、件数和重量制作提单。",
  "shippingDocs.task.redo.detail": "与上一份单据不一致。请查看差异后重新提交。",
};
