/**
 * Dicionário do módulo "sampling" (amostragem da solicitação ao fornecedor,
 * docs/SUPPLIER_SAMPLING.md): depois da aprovação, o responsável pelo booking
 * envia fotos e vídeos de uma amostra e a Wellmix valida. Mesmas chaves em
 * pt, en e zh.
 */
export const pt = {
  "sampling.late": "Atrasada",
  "sampling.due": "Prazo: {date}",
  "sampling.productBlocked":
    "O produto (criar ou associar) e o pedido de compra ficam liberados depois que a Wellmix aprovar a amostra.",
  "sampling.settings.sla": "Prazo da amostragem (dias)",
  "sampling.settings.slaHint":
    "Da aprovação da solicitação (ou da amostra reprovada) até o responsável enviar as fotos e vídeos. Padrão: 1 dia.",
  "sampling.notify.late.subject": "Solicitação nº {n}: amostragem atrasada",
  "sampling.notify.late.body":
    "O prazo de {days} dia(s) para enviar as fotos e vídeos da amostra de {product} passou.",
  "settings.error.sampling_sla_invalid": "Prazo da amostragem: de 1 a 30 dias.",
  "supplierRequests.error.request_product_sampling_pending":
    "O produto só é criado ou associado depois da amostra aprovada.",
  "purchaseOrder.error.purchase_order_sampling_pending":
    "Só entram no pedido de compra os produtos com a amostra aprovada.",
  "sampling.title": "Amostragem",
  "sampling.intro.supplier":
    "A Wellmix aprovou este produto. Agora envie fotos e vídeos da amostra do item feita em impressora 3D (detalhes, medidas, encaixes) e mande para a validação. A amostra física não é enviada.",
  "sampling.intro.wellmix":
    "O responsável pelo book envia fotos e vídeos de uma amostra do item. Confira e aprove, ou reprove com o motivo para ele mandar de novo.",
  "sampling.status.pending": "Esperando a amostra",
  "sampling.status.submitted": "Esperando a validação da Wellmix",
  "sampling.status.approved": "Amostra aprovada",
  "sampling.status.rejected": "Amostra reprovada: envie de novo",
  "sampling.round": "Rodada {n}",
  "sampling.files.title": "Fotos e vídeos da rodada {n}",
  "sampling.files.none": "Nenhum arquivo nesta rodada ainda.",
  "sampling.files.previous": "Rodadas anteriores",
  "sampling.files.count": "{n} arquivos",
  "sampling.files.video": "Vídeo",
  "sampling.files.photo": "Foto",
  "sampling.files.open": "Abrir {name}",
  "sampling.files.remove": "Tirar {name}",
  "sampling.upload.label": "Adicionar foto ou vídeo",
  "sampling.upload.pending": "Enviando…",
  "sampling.upload.uploading": "Enviando {percent}%",
  "sampling.upload.tooBig":
    "Arquivo acima de 50 MB. Grave um vídeo mais curto.",
  "sampling.upload.serverOnly": "Neste ambiente só arquivos de até 4 MB.",
  "sampling.upload.failed": "Não foi possível enviar o arquivo.",
  "sampling.upload.hint":
    "Um arquivo por vez: foto (JPG, PNG, HEIC) ou vídeo (MP4, MOV) de até 50 MB, até {max} por rodada.",
  "sampling.submit.note": "Observação para a Wellmix (opcional)",
  "sampling.submit.button": "Enviar para a validação",
  "sampling.submit.pending": "Enviando…",
  "sampling.submit.needFile":
    "Adicione ao menos uma foto ou vídeo para enviar.",
  "sampling.waiting.supplier":
    "Enviada em {date}. A Wellmix vai conferir e avisar.",
  "sampling.waiting.wellmix":
    "Esperando o responsável pelo book enviar a amostra.",
  "sampling.review.note": "Comentário (obrigatório para reprovar)",
  "sampling.review.approve": "Aprovar a amostra",
  "sampling.review.reject": "Reprovar e pedir de novo",
  "sampling.review.noPermission":
    "Validar a amostragem depende da ação “Validar a amostragem” (Equipe → Funções e acessos).",
  "sampling.approvedAt": "Aprovada em {date}.",
  "sampling.timeline.submit": "Amostragem enviada (fotos e vídeos)",
  "sampling.timeline.approve": "Amostragem aprovada",
  "sampling.timeline.reject": "Amostragem reprovada: enviar de novo",
  "sampling.history.title": "Histórico da amostragem",
  "sampling.history.open": "Amostragem aberta (solicitação aprovada)",
  "sampling.history.submit": "Amostra enviada ({n} arquivos)",
  "sampling.history.approve": "Amostra aprovada",
  "sampling.history.reject": "Amostra reprovada",
  "sampling.notice.file": "Arquivo adicionado à amostragem.",
  "sampling.notice.removed": "Arquivo retirado da amostragem.",
  "sampling.notice.submitted":
    "Amostragem enviada para a validação da Wellmix.",
  "sampling.notice.approved": "Amostra aprovada.",
  "sampling.notice.rejected":
    "Amostra reprovada. O responsável foi avisado para enviar de novo.",
  "sampling.table.col": "Amostragem",
  "sampling.table.open": "Amostragem",
  "sampling.notify.opened.subject":
    "Solicitação nº {n} aprovada: envie a amostragem",
  "sampling.notify.opened.body":
    "A Wellmix aprovou {product}. Envie fotos e vídeos de uma amostra do item pelo portal para a validação.",
  "sampling.notify.submitted.subject":
    "Solicitação nº {n}: amostragem para validar",
  "sampling.notify.submitted.body":
    "O responsável enviou {files} fotos/vídeos da amostra de {product}. Confira e aprove ou reprove.",
  "sampling.notify.approved.subject": "Solicitação nº {n}: amostra aprovada",
  "sampling.notify.approved.body": "A Wellmix aprovou a amostra de {product}.",
  "sampling.notify.rejected.subject":
    "Solicitação nº {n}: amostra reprovada, envie de novo",
  "sampling.notify.rejected.body":
    "A Wellmix reprovou a amostra de {product}: {reason}. Envie novas fotos e vídeos pelo portal.",
  "tasks.group.supplier.sampling": "Enviar a amostragem",
  "supplierTasks.help.sampling":
    "Depois que a Wellmix aprova o produto, envie fotos e vídeos de uma amostra do item; se ela reprovar, envie de novo.",
  "supplierTasks.sampling.title": "Amostragem da solicitação nº {n}: {product}",
  "supplierTasks.sampling.detail":
    "Envie fotos e vídeos de uma amostra do item",
  "supplierTasks.sampling.rejected":
    "A Wellmix reprovou a amostra: envie de novo",
  "tasks.group.sampling_validate": "Validar amostragem",
  "supplierRequests.error.sampling_not_open":
    "A amostragem abre depois que a solicitação é aprovada.",
  "supplierRequests.error.sampling_supplier_only":
    "Só o responsável pelo book envia a amostragem.",
  "supplierRequests.error.sampling_closed":
    "A amostragem não aceita arquivos agora (enviada ou já aprovada).",
  "supplierRequests.error.sampling_too_many":
    "Limite de arquivos da rodada atingido.",
  "supplierRequests.error.sampling_file_type":
    "Envie uma foto (JPG, PNG, HEIC) ou um vídeo (MP4, MOV).",
  "supplierRequests.error.sampling_file_missing":
    "Adicione ao menos uma foto ou vídeo.",
  "supplierRequests.error.sampling_not_submitted":
    "Não há amostra enviada esperando a validação.",
  "supplierRequests.error.sampling_reason_required":
    "Para reprovar, escreva o motivo.",
};

export const en: typeof pt = {
  "sampling.late": "Late",
  "sampling.due": "Due: {date}",
  "sampling.productBlocked":
    "The product (create or link) and the purchase order are unlocked after Wellmix approves the sample.",
  "sampling.settings.sla": "Sampling deadline (days)",
  "sampling.settings.slaHint":
    "From the request approval (or the rejected sample) until the owner sends the photos and videos. Default: 1 day.",
  "sampling.notify.late.subject": "Request no. {n}: sampling late",
  "sampling.notify.late.body":
    "The {days}-day deadline to send the photos and videos of the sample of {product} has passed.",
  "settings.error.sampling_sla_invalid": "Sampling deadline: 1 to 30 days.",
  "supplierRequests.error.request_product_sampling_pending":
    "The product is only created or linked after the sample is approved.",
  "purchaseOrder.error.purchase_order_sampling_pending":
    "Only products with an approved sample go into the purchase order.",
  "sampling.title": "Sampling",
  "sampling.intro.supplier":
    "Wellmix approved this product. Now send photos and videos of the 3D-printed sample of the item (details, dimensions, fittings) and submit them for validation. The physical sample is not shipped.",
  "sampling.intro.wellmix":
    "The book owner sends photos and videos of a sample of the item. Check them and approve, or reject with the reason so they send again.",
  "sampling.status.pending": "Waiting for the sample",
  "sampling.status.submitted": "Waiting for Wellmix validation",
  "sampling.status.approved": "Sample approved",
  "sampling.status.rejected": "Sample rejected: send again",
  "sampling.round": "Round {n}",
  "sampling.files.title": "Photos and videos of round {n}",
  "sampling.files.none": "No files in this round yet.",
  "sampling.files.previous": "Previous rounds",
  "sampling.files.count": "{n} files",
  "sampling.files.video": "Video",
  "sampling.files.photo": "Photo",
  "sampling.files.open": "Open {name}",
  "sampling.files.remove": "Remove {name}",
  "sampling.upload.label": "Add photo or video",
  "sampling.upload.pending": "Sending…",
  "sampling.upload.uploading": "Sending {percent}%",
  "sampling.upload.tooBig": "File over 50 MB. Record a shorter video.",
  "sampling.upload.serverOnly": "In this environment only files up to 4 MB.",
  "sampling.upload.failed": "The file could not be sent.",
  "sampling.upload.hint":
    "One file at a time: photo (JPG, PNG, HEIC) or video (MP4, MOV) up to 50 MB, up to {max} per round.",
  "sampling.submit.note": "Note to Wellmix (optional)",
  "sampling.submit.button": "Submit for validation",
  "sampling.submit.pending": "Sending…",
  "sampling.submit.needFile": "Add at least one photo or video to submit.",
  "sampling.waiting.supplier":
    "Submitted on {date}. Wellmix will check it and let you know.",
  "sampling.waiting.wellmix": "Waiting for the book owner to send the sample.",
  "sampling.review.note": "Comment (required to reject)",
  "sampling.review.approve": "Approve the sample",
  "sampling.review.reject": "Reject and ask again",
  "sampling.review.noPermission":
    "Validating the sampling requires the “Validate the sampling” action (Team → Functions and access).",
  "sampling.approvedAt": "Approved on {date}.",
  "sampling.timeline.submit": "Sampling submitted (photos and videos)",
  "sampling.timeline.approve": "Sampling approved",
  "sampling.timeline.reject": "Sampling rejected: send again",
  "sampling.history.title": "Sampling history",
  "sampling.history.open": "Sampling opened (request approved)",
  "sampling.history.submit": "Sample submitted ({n} files)",
  "sampling.history.approve": "Sample approved",
  "sampling.history.reject": "Sample rejected",
  "sampling.notice.file": "File added to the sampling.",
  "sampling.notice.removed": "File removed from the sampling.",
  "sampling.notice.submitted": "Sampling submitted for Wellmix validation.",
  "sampling.notice.approved": "Sample approved.",
  "sampling.notice.rejected":
    "Sample rejected. The owner was told to send it again.",
  "sampling.table.col": "Sampling",
  "sampling.table.open": "Sampling",
  "sampling.notify.opened.subject":
    "Request no. {n} approved: send the sampling",
  "sampling.notify.opened.body":
    "Wellmix approved {product}. Send photos and videos of a sample of the item through the portal for validation.",
  "sampling.notify.submitted.subject": "Request no. {n}: sampling to validate",
  "sampling.notify.submitted.body":
    "The owner sent {files} photos/videos of the sample of {product}. Check and approve or reject.",
  "sampling.notify.approved.subject": "Request no. {n}: sample approved",
  "sampling.notify.approved.body": "Wellmix approved the sample of {product}.",
  "sampling.notify.rejected.subject":
    "Request no. {n}: sample rejected, send again",
  "sampling.notify.rejected.body":
    "Wellmix rejected the sample of {product}: {reason}. Send new photos and videos through the portal.",
  "tasks.group.supplier.sampling": "Send the sampling",
  "supplierTasks.help.sampling":
    "After Wellmix approves the product, send photos and videos of a sample of the item; if it is rejected, send again.",
  "supplierTasks.sampling.title": "Sampling of request no. {n}: {product}",
  "supplierTasks.sampling.detail":
    "Send photos and videos of a sample of the item",
  "supplierTasks.sampling.rejected": "Wellmix rejected the sample: send again",
  "tasks.group.sampling_validate": "Validate sampling",
  "supplierRequests.error.sampling_not_open":
    "Sampling opens after the request is approved.",
  "supplierRequests.error.sampling_supplier_only":
    "Only the book owner sends the sampling.",
  "supplierRequests.error.sampling_closed":
    "The sampling does not accept files now (submitted or already approved).",
  "supplierRequests.error.sampling_too_many":
    "File limit for this round reached.",
  "supplierRequests.error.sampling_file_type":
    "Send a photo (JPG, PNG, HEIC) or a video (MP4, MOV).",
  "supplierRequests.error.sampling_file_missing":
    "Add at least one photo or video.",
  "supplierRequests.error.sampling_not_submitted":
    "There is no submitted sample waiting for validation.",
  "supplierRequests.error.sampling_reason_required":
    "To reject, write the reason.",
};

export const zh: typeof pt = {
  "sampling.late": "已逾期",
  "sampling.due": "期限：{date}",
  "sampling.productBlocked":
    "Wellmix 批准样品后，才能创建或关联产品并生成采购订单。",
  "sampling.settings.sla": "样品期限（天）",
  "sampling.settings.slaHint":
    "从询价批准（或样品被驳回）到负责人发送照片和视频。默认：1 天。",
  "sampling.notify.late.subject": "询价 {n}：样品已逾期",
  "sampling.notify.late.body":
    "发送 {product} 样品照片和视频的 {days} 天期限已过。",
  "settings.error.sampling_sla_invalid": "样品期限：1 至 30 天。",
  "supplierRequests.error.request_product_sampling_pending":
    "样品批准后才能创建或关联产品。",
  "purchaseOrder.error.purchase_order_sampling_pending":
    "只有样品已批准的产品才能进入采购订单。",
  "sampling.title": "样品",
  "sampling.intro.supplier":
    "Wellmix 已批准该产品。请发送该商品 3D 打印样品的照片和视频（细节、尺寸、配合），并提交验证。实物样品无需寄送。",
  "sampling.intro.wellmix":
    "Book 负责人发送商品样品的照片和视频。请检查并批准，或填写原因驳回，让其重新发送。",
  "sampling.status.pending": "等待样品",
  "sampling.status.submitted": "等待 Wellmix 验证",
  "sampling.status.approved": "样品已批准",
  "sampling.status.rejected": "样品被驳回：请重新发送",
  "sampling.round": "第 {n} 轮",
  "sampling.files.title": "第 {n} 轮的照片和视频",
  "sampling.files.none": "本轮还没有文件。",
  "sampling.files.previous": "之前的轮次",
  "sampling.files.count": "{n} 个文件",
  "sampling.files.video": "视频",
  "sampling.files.photo": "照片",
  "sampling.files.open": "打开 {name}",
  "sampling.files.remove": "移除 {name}",
  "sampling.upload.label": "添加照片或视频",
  "sampling.upload.pending": "发送中…",
  "sampling.upload.uploading": "发送中 {percent}%",
  "sampling.upload.tooBig": "文件超过 50 MB，请录制更短的视频。",
  "sampling.upload.serverOnly": "此环境只支持 4 MB 以内的文件。",
  "sampling.upload.failed": "文件发送失败。",
  "sampling.upload.hint":
    "每次一个文件：照片（JPG、PNG、HEIC）或视频（MP4、MOV），最大 50 MB，每轮最多 {max} 个。",
  "sampling.submit.note": "给 Wellmix 的备注（可选）",
  "sampling.submit.button": "提交验证",
  "sampling.submit.pending": "发送中…",
  "sampling.submit.needFile": "请至少添加一张照片或一个视频再提交。",
  "sampling.waiting.supplier": "已于 {date} 提交。Wellmix 检查后会通知您。",
  "sampling.waiting.wellmix": "等待 Book 负责人发送样品。",
  "sampling.review.note": "备注（驳回时必填）",
  "sampling.review.approve": "批准样品",
  "sampling.review.reject": "驳回并要求重发",
  "sampling.review.noPermission":
    "验证样品需要“验证样品”权限（团队 → 职能与权限）。",
  "sampling.approvedAt": "于 {date} 批准。",
  "sampling.timeline.submit": "样品已提交（照片和视频）",
  "sampling.timeline.approve": "样品已批准",
  "sampling.timeline.reject": "样品被驳回：请重新发送",
  "sampling.history.title": "样品记录",
  "sampling.history.open": "样品环节开启（询价已批准）",
  "sampling.history.submit": "样品已提交（{n} 个文件）",
  "sampling.history.approve": "样品已批准",
  "sampling.history.reject": "样品被驳回",
  "sampling.notice.file": "文件已添加到样品。",
  "sampling.notice.removed": "文件已从样品中移除。",
  "sampling.notice.submitted": "样品已提交给 Wellmix 验证。",
  "sampling.notice.approved": "样品已批准。",
  "sampling.notice.rejected": "样品被驳回，已通知负责人重新发送。",
  "sampling.table.col": "样品",
  "sampling.table.open": "样品",
  "sampling.notify.opened.subject": "询价 {n} 已批准：请发送样品",
  "sampling.notify.opened.body":
    "Wellmix 已批准 {product}。请通过门户发送商品样品的照片和视频以供验证。",
  "sampling.notify.submitted.subject": "询价 {n}：样品待验证",
  "sampling.notify.submitted.body":
    "负责人发送了 {product} 样品的 {files} 张照片/视频。请检查并批准或驳回。",
  "sampling.notify.approved.subject": "询价 {n}：样品已批准",
  "sampling.notify.approved.body": "Wellmix 已批准 {product} 的样品。",
  "sampling.notify.rejected.subject": "询价 {n}：样品被驳回，请重新发送",
  "sampling.notify.rejected.body":
    "Wellmix 驳回了 {product} 的样品：{reason}。请通过门户发送新的照片和视频。",
  "tasks.group.supplier.sampling": "发送样品",
  "supplierTasks.help.sampling":
    "Wellmix 批准产品后，请发送商品样品的照片和视频；如被驳回，请重新发送。",
  "supplierTasks.sampling.title": "询价 {n} 的样品：{product}",
  "supplierTasks.sampling.detail": "发送商品样品的照片和视频",
  "supplierTasks.sampling.rejected": "Wellmix 驳回了样品：请重新发送",
  "tasks.group.sampling_validate": "验证样品",
  "supplierRequests.error.sampling_not_open": "询价批准后才开启样品环节。",
  "supplierRequests.error.sampling_supplier_only":
    "只有 Book 负责人可以发送样品。",
  "supplierRequests.error.sampling_closed":
    "样品环节现在不接受文件（已提交或已批准）。",
  "supplierRequests.error.sampling_too_many": "本轮文件数量已达上限。",
  "supplierRequests.error.sampling_file_type":
    "请发送照片（JPG、PNG、HEIC）或视频（MP4、MOV）。",
  "supplierRequests.error.sampling_file_missing":
    "请至少添加一张照片或一个视频。",
  "supplierRequests.error.sampling_not_submitted": "没有等待验证的样品。",
  "supplierRequests.error.sampling_reason_required": "驳回时请填写原因。",
};
