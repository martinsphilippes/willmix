/**
 * Amostras depois da inspeção e fotos reais (mapa R12 a R16 e R5;
 * docs/SAMPLE_FLOW.md): agência de marketing na China, retirada e envios das
 * amostras, devolução à trading, fotos e vídeos do produto real, aprovação do
 * marketing, troca das fotos e ativação da venda. Mesmas chaves em pt, en e zh.
 */
export const pt = {
  "role.marketing_agency": "Agência de marketing (China)",
  "party.marketing_agency": "Agência de marketing (China)",
  "messages.type.marketing_agency": "Agência de marketing (China)",
  "importFlow.actor.marketing_agency": "agência de marketing (China)",
  "samplesFlow.title": "Amostras",
  "samplesFlow.hint":
    "Com o SKU aprovado, a trading retira as amostras, envia 4 × 3 × Nm de cada produto ao show room no Brasil e 1 × 3 × Nm à agência de marketing na China. A agência faz as fotos e vídeos reais e devolve a amostra à trading, que a embarca com o pedido.",
  "samplesFlow.col.product": "Produto",
  "samplesFlow.col.brazil": "Show room (Brasil)",
  "samplesFlow.col.china": "Agência (China)",
  "samplesFlow.col.total": "Total",
  "importFlow.step.samples_picked": "Retirada das amostras (data)",
  "importFlow.step.samples_brazil":
    "Envio ao show room no Brasil (rastreio e comprovante)",
  "importFlow.step.samples_china":
    "Envio à agência de marketing na China (rastreio e comprovante)",
  "importFlow.step.samples_china_received":
    "Amostras recebidas pela agência (data)",
  "importFlow.step.samples_returned":
    "Amostra devolvida à trading para seguir com o pedido",
  "importFlow.ph.samples_brazil": "Rastreio / AWB",
  "importFlow.ph.samples_china": "Rastreio / transportadora",
  "importFlow.ph.samples_returned": "Como e quando foi devolvida",
  "importFlow.error.samples_return_required":
    "O container só é carregado depois que a amostra da China volta à trading (cartão Amostras).",
  "importFlow.error.real_media_required":
    "A amostra só volta à trading com as fotos e vídeos reais de todos os produtos aprovados pelo marketing.",
  "action.realMedia.approve":
    "Aprovar as fotos e vídeos reais (troca as fotos e ativa a venda)",
  "action.desc.realMedia.approve":
    "Fotos e vídeos do produto real feitos pela agência de marketing na China: ao aprovar, viram as fotos principais do catálogo (as de referência saem da vitrine, mas ficam guardadas) e o produto é liberado para venda.",
  "realMedia.title": "Fotos e vídeos reais · pedido #{n}",
  "realMedia.subtitle":
    "A agência de marketing na China fotografa e filma a amostra de cada produto. O marketing aprova: as fotos reais viram as principais do catálogo, as de referência saem da vitrine (ficam guardadas) e o produto é liberado para venda.",
  "realMedia.back": "← Voltar ao pedido",
  "realMedia.open": "Fotos e vídeos reais",
  "realMedia.orderHint":
    "Fotos e vídeos do produto real feitos pela agência na China, aprovação do marketing e ativação da venda.",
  "realMedia.waiting":
    "Abre quando a agência recebe as amostras (cartão Amostras).",
  "realMedia.status.missing": "Falta enviar",
  "realMedia.status.sent": "Aguardando o marketing",
  "realMedia.status.approved": "Aprovado · à venda",
  "realMedia.status.rejected": "Refazer",
  "realMedia.upload": "Enviar fotos e vídeos",
  "realMedia.files": "Fotos e vídeos (pode escolher vários)",
  "realMedia.approve": "Aprovar, trocar as fotos e ativar a venda",
  "realMedia.reject": "Pedir para refazer",
  "realMedia.reason": "Motivo (obrigatório para pedir refazer)",
  "realMedia.video": "Vídeo",
  "realMedia.done.uploaded": "Arquivos enviados.",
  "realMedia.done.approved":
    "Aprovado: fotos do catálogo trocadas e produto à venda.",
  "realMedia.done.rejected": "Pedido de refazer enviado à agência.",
  "realMedia.error.real_media_closed": "Esta etapa não está aberta agora.",
  "realMedia.error.real_media_empty": "Escolha ao menos uma foto ou um vídeo.",
  "realMedia.error.real_media_no_photo":
    "Envie ao menos uma foto (só vídeo não troca a foto do catálogo).",
  "realMedia.error.reason_required": "Escreva o motivo para pedir refazer.",
  "realMedia.error.item_not_found": "Produto não encontrado no pedido.",
  "realMedia.notify.sent.subject":
    "Pedido #{n}: fotos e vídeos reais para aprovar",
  "realMedia.notify.sent.body":
    "A agência na China enviou as fotos e vídeos reais de {product}. Aprove para trocar as fotos do catálogo e ativar a venda.",
  "realMedia.notify.rejected.subject":
    "Pedido #{n}: refazer fotos e vídeos de {product}",
  "realMedia.notify.rejected.body": "O marketing pediu para refazer: {reason}",
  "realMedia.notify.approved.subject": "{product} à venda com fotos reais",
  "realMedia.notify.approved.body":
    "As fotos reais do pedido #{n} entraram no catálogo e o produto está liberado para venda (vitrine e oferta ativa).",
  "realMedia.task.do.title": "Fotos e vídeos reais: pedido #{n}",
  "realMedia.task.do.detail":
    "Fotografe e filme a amostra de {count} produto(s) e envie.",
  "realMedia.task.approve.title": "Aprovar fotos reais: pedido #{n}",
  "realMedia.task.approve.detail":
    "{count} produto(s) com fotos e vídeos reais da agência para aprovar e ativar a venda.",
  "tasks.group.real_media": "Fotos reais",
  "sourcing.photo.real": "Foto real (agência)",
  "importFlow.error.samples_closed":
    "Os passos das amostras abrem com o SKU aprovado e o pedido de amostras gerado.",
  "importFlow.step.samples_brazil_received":
    "Amostras recebidas no show room (conferidas)",
  "showroom.title": "Recebimento no show room (Brasil)",
  "showroom.hint":
    "Confira as peças de cada produto que chegaram ao show room. Com diferença, explique na observação: a trading é avisada. Vendas fica sabendo do que chegou.",
  "showroom.waiting": "Abre quando a trading registra o envio ao Brasil.",
  "showroom.col.expected": "Esperadas",
  "showroom.col.received": "Recebidas",
  "showroom.note": "Observação (obrigatória com diferença)",
  "showroom.photo": "Foto das amostras (opcional)",
  "showroom.submit": "Registrar o recebimento",
  "showroom.received": "Recebidas em {date} por {name}",
  "showroom.divergent": "Com diferença",
  "showroom.ok": "Conferidas sem diferença",
  "showroom.done": "Recebimento registrado. Vendas foi avisada.",
  "showroom.error.showroom_closed":
    "O recebimento não está aberto agora (ou já foi registrado).",
  "showroom.error.showroom_qty_invalid":
    "Informe as peças recebidas de cada produto.",
  "showroom.error.showroom_note_required":
    "Com peças a mais ou a menos, explique na observação.",
  "showroom.notify.sales.subject": "Pedido #{n}: amostras no show room",
  "showroom.notify.sales.body":
    "Chegaram ao show room do Brasil as amostras de: {products}. Já dá para oferecer (Vendas → Amostras).",
  "showroom.notify.divergent.subject":
    "Pedido #{n}: amostras do show room com diferença",
  "showroom.notify.divergent.body": "Recebidas/esperadas: {lines}. {note}",
  "showroom.task.title": "Receber as amostras no show room: pedido #{n}",
  "showroom.task.detail":
    "A trading enviou as amostras ao Brasil. Confira as peças de cada produto quando chegarem.",
  "tasks.group.showroom": "Show room",
};

export const en: Record<keyof typeof pt, string> = {
  "role.marketing_agency": "Marketing agency (China)",
  "party.marketing_agency": "Marketing agency (China)",
  "messages.type.marketing_agency": "Marketing agency (China)",
  "importFlow.actor.marketing_agency": "marketing agency (China)",
  "samplesFlow.title": "Samples",
  "samplesFlow.hint":
    "With the SKU approved, the trading company picks up the samples, sends 4 × 3 × Nm of each product to the showroom in Brazil and 1 × 3 × Nm to the marketing agency in China. The agency shoots the real photos and videos and returns the sample to the trading company, which ships it with the order.",
  "samplesFlow.col.product": "Product",
  "samplesFlow.col.brazil": "Showroom (Brazil)",
  "samplesFlow.col.china": "Agency (China)",
  "samplesFlow.col.total": "Total",
  "importFlow.step.samples_picked": "Samples picked up (date)",
  "importFlow.step.samples_brazil":
    "Sent to the showroom in Brazil (tracking and proof)",
  "importFlow.step.samples_china":
    "Sent to the marketing agency in China (tracking and proof)",
  "importFlow.step.samples_china_received":
    "Samples received by the agency (date)",
  "importFlow.step.samples_returned":
    "Sample returned to the trading company to ship with the order",
  "importFlow.ph.samples_brazil": "Tracking / AWB",
  "importFlow.ph.samples_china": "Tracking / courier",
  "importFlow.ph.samples_returned": "How and when it was returned",
  "importFlow.error.samples_return_required":
    "The container is only loaded after the China sample is back with the trading company (Samples card).",
  "importFlow.error.real_media_required":
    "The sample only goes back to the trading company once marketing has approved the real photos and videos of every product.",
  "action.realMedia.approve":
    "Approve real photos and videos (replaces photos and activates sales)",
  "action.desc.realMedia.approve":
    "Real product photos and videos from the marketing agency in China: once approved they become the main catalog photos (reference ones leave the showcase but are kept) and the product is released for sale.",
  "realMedia.title": "Real photos and videos · order #{n}",
  "realMedia.subtitle":
    "The marketing agency in China shoots photos and videos of each product's sample. Marketing approves: the real photos become the main catalog ones, the reference ones leave the showcase (kept on file) and the product is released for sale.",
  "realMedia.back": "← Back to the order",
  "realMedia.open": "Real photos and videos",
  "realMedia.orderHint":
    "Real product photos and videos from the agency in China, marketing approval and sales activation.",
  "realMedia.waiting":
    "Opens when the agency receives the samples (Samples card).",
  "realMedia.status.missing": "Not sent",
  "realMedia.status.sent": "Waiting for marketing",
  "realMedia.status.approved": "Approved · on sale",
  "realMedia.status.rejected": "Redo",
  "realMedia.upload": "Send photos and videos",
  "realMedia.files": "Photos and videos (you can pick several)",
  "realMedia.approve": "Approve, replace photos and activate sales",
  "realMedia.reject": "Ask to redo",
  "realMedia.reason": "Reason (required to ask for a redo)",
  "realMedia.video": "Video",
  "realMedia.done.uploaded": "Files sent.",
  "realMedia.done.approved":
    "Approved: catalog photos replaced and product on sale.",
  "realMedia.done.rejected": "Redo request sent to the agency.",
  "realMedia.error.real_media_closed": "This step is not open now.",
  "realMedia.error.real_media_empty": "Pick at least one photo or video.",
  "realMedia.error.real_media_no_photo":
    "Send at least one photo (a video alone does not replace the catalog photo).",
  "realMedia.error.reason_required": "Write the reason to ask for a redo.",
  "realMedia.error.item_not_found": "Product not found in the order.",
  "realMedia.notify.sent.subject":
    "Order #{n}: real photos and videos to approve",
  "realMedia.notify.sent.body":
    "The agency in China sent the real photos and videos of {product}. Approve to replace the catalog photos and activate sales.",
  "realMedia.notify.rejected.subject":
    "Order #{n}: redo photos and videos of {product}",
  "realMedia.notify.rejected.body": "Marketing asked for a redo: {reason}",
  "realMedia.notify.approved.subject": "{product} on sale with real photos",
  "realMedia.notify.approved.body":
    "The real photos of order #{n} are in the catalog and the product is released for sale (showcase and active offer).",
  "realMedia.task.do.title": "Real photos and videos: order #{n}",
  "realMedia.task.do.detail":
    "Shoot photos and videos of the sample of {count} product(s) and send them.",
  "realMedia.task.approve.title": "Approve real photos: order #{n}",
  "realMedia.task.approve.detail":
    "{count} product(s) with real photos and videos from the agency to approve and activate sales.",
  "tasks.group.real_media": "Real photos",
  "sourcing.photo.real": "Real photo (agency)",
  "importFlow.error.samples_closed":
    "The sample steps open once the SKU is approved and the sample order exists.",
  "importFlow.step.samples_brazil_received":
    "Samples received at the showroom (checked)",
  "showroom.title": "Showroom receipt (Brazil)",
  "showroom.hint":
    "Check the pieces of each product that reached the showroom. If anything differs, explain in the note: the trading company is notified. Sales learns what arrived.",
  "showroom.waiting":
    "Opens when the trading company records the shipment to Brazil.",
  "showroom.col.expected": "Expected",
  "showroom.col.received": "Received",
  "showroom.note": "Note (required if anything differs)",
  "showroom.photo": "Photo of the samples (optional)",
  "showroom.submit": "Record the receipt",
  "showroom.received": "Received on {date} by {name}",
  "showroom.divergent": "With differences",
  "showroom.ok": "Checked, no differences",
  "showroom.done": "Receipt recorded. Sales was notified.",
  "showroom.error.showroom_closed":
    "The receipt is not open now (or was already recorded).",
  "showroom.error.showroom_qty_invalid":
    "Enter the pieces received for each product.",
  "showroom.error.showroom_note_required":
    "With pieces missing or extra, explain in the note.",
  "showroom.notify.sales.subject": "Order #{n}: samples at the showroom",
  "showroom.notify.sales.body":
    "The samples of {products} reached the showroom in Brazil. They can be offered now (Sales → Samples).",
  "showroom.notify.divergent.subject":
    "Order #{n}: showroom samples with differences",
  "showroom.notify.divergent.body": "Received/expected: {lines}. {note}",
  "showroom.task.title": "Receive the samples at the showroom: order #{n}",
  "showroom.task.detail":
    "The trading company sent the samples to Brazil. Check the pieces of each product when they arrive.",
  "tasks.group.showroom": "Showroom",
};

export const zh: Record<keyof typeof pt, string> = {
  "role.marketing_agency": "营销代理（中国）",
  "party.marketing_agency": "营销代理（中国）",
  "messages.type.marketing_agency": "营销代理（中国）",
  "importFlow.actor.marketing_agency": "营销代理（中国）",
  "samplesFlow.title": "样品",
  "samplesFlow.hint":
    "SKU 通过后，贸易商取样，每个产品寄 4 × 3 × Nm 到巴西展厅，1 × 3 × Nm 到中国营销代理。代理拍摄实物照片和视频后，把样品退回贸易商，随订单一起出运。",
  "samplesFlow.col.product": "产品",
  "samplesFlow.col.brazil": "展厅（巴西）",
  "samplesFlow.col.china": "代理（中国）",
  "samplesFlow.col.total": "合计",
  "importFlow.step.samples_picked": "取样（日期）",
  "importFlow.step.samples_brazil": "寄往巴西展厅（单号和凭证）",
  "importFlow.step.samples_china": "寄往中国营销代理（单号和凭证）",
  "importFlow.step.samples_china_received": "代理已收到样品（日期）",
  "importFlow.step.samples_returned": "样品已退回贸易商，随订单出运",
  "importFlow.ph.samples_brazil": "单号 / AWB",
  "importFlow.ph.samples_china": "单号 / 快递公司",
  "importFlow.ph.samples_returned": "退回方式和时间",
  "importFlow.error.samples_return_required":
    "中国样品退回贸易商后才能装柜（样品卡片）。",
  "importFlow.error.real_media_required":
    "所有产品的实物照片和视频经市场部审核通过后，样品才能退回贸易商。",
  "action.realMedia.approve": "审核实物照片和视频（替换照片并开启销售）",
  "action.desc.realMedia.approve":
    "中国营销代理拍摄的实物照片和视频：审核通过后成为目录主图（参考图从展示中移除但保留），产品开放销售。",
  "realMedia.title": "实物照片和视频 · 订单 #{n}",
  "realMedia.subtitle":
    "中国营销代理为每个产品的样品拍摄照片和视频。市场部审核：实物照片成为目录主图，参考图从展示中移除（保留存档），产品开放销售。",
  "realMedia.back": "← 返回订单",
  "realMedia.open": "实物照片和视频",
  "realMedia.orderHint": "中国代理拍摄的实物照片和视频、市场部审核和开启销售。",
  "realMedia.waiting": "代理收到样品后开放（样品卡片）。",
  "realMedia.status.missing": "未上传",
  "realMedia.status.sent": "等待市场部",
  "realMedia.status.approved": "已通过 · 在售",
  "realMedia.status.rejected": "重做",
  "realMedia.upload": "上传照片和视频",
  "realMedia.files": "照片和视频（可多选）",
  "realMedia.approve": "通过、替换照片并开启销售",
  "realMedia.reject": "要求重做",
  "realMedia.reason": "原因（要求重做时必填）",
  "realMedia.video": "视频",
  "realMedia.done.uploaded": "文件已上传。",
  "realMedia.done.approved": "已通过：目录照片已替换，产品在售。",
  "realMedia.done.rejected": "已通知代理重做。",
  "realMedia.error.real_media_closed": "此步骤目前未开放。",
  "realMedia.error.real_media_empty": "请至少选择一张照片或一个视频。",
  "realMedia.error.real_media_no_photo":
    "请至少上传一张照片（只有视频无法替换目录照片）。",
  "realMedia.error.reason_required": "请填写要求重做的原因。",
  "realMedia.error.item_not_found": "订单中找不到该产品。",
  "realMedia.notify.sent.subject": "订单 #{n}：实物照片和视频待审核",
  "realMedia.notify.sent.body":
    "中国代理已上传 {product} 的实物照片和视频。审核通过后将替换目录照片并开启销售。",
  "realMedia.notify.rejected.subject": "订单 #{n}：重做 {product} 的照片和视频",
  "realMedia.notify.rejected.body": "市场部要求重做：{reason}",
  "realMedia.notify.approved.subject": "{product} 已用实物照片上架",
  "realMedia.notify.approved.body":
    "订单 #{n} 的实物照片已进入目录，产品开放销售（展示和主动报价）。",
  "realMedia.task.do.title": "实物照片和视频：订单 #{n}",
  "realMedia.task.do.detail": "为 {count} 个产品的样品拍摄照片和视频并上传。",
  "realMedia.task.approve.title": "审核实物照片：订单 #{n}",
  "realMedia.task.approve.detail":
    "{count} 个产品有代理上传的实物照片和视频，待审核并开启销售。",
  "tasks.group.real_media": "实物照片",
  "sourcing.photo.real": "实物照片（代理）",
  "importFlow.error.samples_closed":
    "SKU 通过且已生成样品订单后，样品步骤才开放。",
  "importFlow.step.samples_brazil_received": "展厅已收到样品（已核对）",
  "showroom.title": "展厅收货（巴西）",
  "showroom.hint":
    "核对每个产品到达展厅的件数。如有差异请在备注中说明：将通知贸易商。销售会知道到了哪些样品。",
  "showroom.waiting": "贸易商登记寄往巴西后开放。",
  "showroom.col.expected": "应收",
  "showroom.col.received": "实收",
  "showroom.note": "备注（有差异时必填）",
  "showroom.photo": "样品照片（可选）",
  "showroom.submit": "登记收货",
  "showroom.received": "{name} 于 {date} 收货",
  "showroom.divergent": "有差异",
  "showroom.ok": "已核对，无差异",
  "showroom.done": "已登记收货，已通知销售。",
  "showroom.error.showroom_closed": "收货目前未开放（或已登记）。",
  "showroom.error.showroom_qty_invalid": "请填写每个产品的实收件数。",
  "showroom.error.showroom_note_required": "件数多或少时请在备注中说明。",
  "showroom.notify.sales.subject": "订单 #{n}：样品已到展厅",
  "showroom.notify.sales.body":
    "以下产品的样品已到巴西展厅：{products}。现在可以推荐给客户（销售 → 样品）。",
  "showroom.notify.divergent.subject": "订单 #{n}：展厅样品有差异",
  "showroom.notify.divergent.body": "实收/应收：{lines}。{note}",
  "showroom.task.title": "展厅收样：订单 #{n}",
  "showroom.task.detail":
    "贸易商已将样品寄往巴西。到货后请核对每个产品的件数。",
  "tasks.group.showroom": "展厅",
};
