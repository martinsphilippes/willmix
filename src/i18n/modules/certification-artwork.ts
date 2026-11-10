/**
 * Dicionário do módulo "certification-artwork" (Fase F: certificação com o
 * OCP, artes do pedido com designer e não conformidade por SKU, tabela de
 * preços): mesmas chaves em pt, en e zh.
 */
export const pt = {
  "role.ocp": "OCP (certificação)",
  "party.ocp": "OCP (certificação)",
  "messages.type.ocp": "OCP",
  "function.designer": "Designer",
  "certFlow.title": "Certificação",
  "importFlow.step.cert_memorial": "Memorial descritivo",
  "importFlow.step.cert_lab": "Ensaio em laboratório (laudo)",
  "importFlow.step.cert_registration": "Número de registro (certificado)",
  "importFlow.actor.ocp": "OCP",
  "importFlow.ph.cert_memorial": "",
  "importFlow.ph.cert_lab": "Laboratório / nº do laudo",
  "importFlow.ph.cert_registration": "Nº de registro",
  "importFlow.step.cert_seal": "Selo de certificação",
  "importFlow.step.cert_seal_art": "Selo aplicado na arte",
  "importFlow.actor.agency": "agência",
  "importFlow.ph.cert_seal": "Nº do selo ou do registro (opcional)",
  "importFlow.ph.cert_seal_art": "",
  "importFlow.fileReady":
    "Arquivo pronto: {name} ({size}). Agora clique em Enviar.",
  "importFlow.error.schema_pending":
    "Este passo ainda não foi liberado no banco de dados. Avise a Wellmix (falta publicar o esquema) e envie de novo.",
  "certFlow.sealHint":
    "Selo de certificação: a certificadora (OCP) envia o selo do pedido. Quem faz a arte da embalagem (a agência do pedido ou a Wellmix) baixa o selo, aplica na arte e envia a arte com o selo. A Wellmix confere.",
  "certFlow.sheetNote": "Certificação pedida na ficha: {note}",
  "certFlow.sealReplaced":
    "A certificadora enviou um selo novo. Aplique o selo novo na arte e envie de novo.",
  "certFlow.notify.sealRequested.subject":
    "Pedido #{n}: gerar o selo de certificação",
  "certFlow.notify.sealRequested.body":
    "Um pedido novo chegou para certificação. Gere o selo de certificação e envie o arquivo no pedido. Quem faz a arte da embalagem recebe o selo para aplicar.",
  "certFlow.notify.sealReady.subject":
    "Pedido #{n}: selo de certificação disponível",
  "certFlow.notify.sealReady.body":
    "A certificadora enviou o selo de certificação. Baixe o selo no pedido, aplique na arte da embalagem e envie a arte com o selo.",
  "certFlow.notify.sealChanged.subject":
    "Pedido #{n}: selo de certificação trocado",
  "certFlow.notify.sealChanged.body":
    "A certificadora enviou um selo novo. Baixe o selo no pedido, aplique na arte da embalagem e envie a arte com o selo de novo.",
  "certFlow.notify.noOcp.subject": "Pedido #{n}: sem certificadora para o selo",
  "certFlow.notify.noOcp.body":
    "Todo pedido precisa do selo de certificação e este está sem certificadora (OCP). Designe a certificadora em Parceiros do pedido para o pedido chegar a ela.",
  "certFlow.brief.sealPending":
    "Selo de certificação: aguardando a certificadora. Deixe o espaço do selo na arte.",
  "certFlow.brief.sealReady":
    "Selo de certificação disponível: baixe no pedido, aplique na arte e envie a arte com o selo.",
  "certFlow.brief.sealSent": "Arte com o selo enviada; a Wellmix confere.",
  "certFlow.brief.sealDone":
    "Selo de certificação aplicado na arte e conferido.",
  "certFlow.brief.open": "Abrir o selo no pedido",
  "tasks.group.cert_step": "Certificação",
  "tasks.group.cert_validate": "Validar certificação",
  "tasks.seal.issue.title": "Gerar o selo de certificação: pedido #{n}",
  "tasks.seal.issue.detail":
    "Envie o arquivo do selo no pedido. Quem faz a arte recebe para aplicar na embalagem.",
  "tasks.seal.apply.title":
    "Aplicar o selo de certificação na arte: pedido #{n}",
  "tasks.seal.apply.detail":
    "Baixe o selo no pedido e envie a arte com o selo aplicado.",
  "tasks.seal.validate.title": "Validar o selo aplicado na arte: pedido #{n}",
  "tasks.seal.validate.detail":
    "Confira o selo na arte e valide, ou recuse com o motivo.",
  "tasks.seal.assign.title": "Designar a certificadora do selo: pedido #{n}",
  "tasks.seal.assign.detail":
    "O pedido está sem certificadora. Designe em Parceiros do pedido, ou envie no cartão Certificação o selo recebido por fora.",
  "artwork.title": "Artes",
  "artwork.downloadAll": "Baixar todas as artes",
  "artwork.designer": "Designer",
  "artwork.saveDesigner": "Salvar designer",
  "artwork.noCandidates":
    "Ninguém disponível: dê a função Designer em Equipe ou designe a agência do pedido.",
  "artwork.noIssues": "Sem não conformidade",
  "artwork.status.open": "Não conforme",
  "artwork.status.fixed": "Corrigida, aguardando aceite",
  "artwork.status.accepted": "Aceita",
  "artwork.file": "Arquivo",
  "artwork.fix": "Correção: {note} ({date})",
  "artwork.fixPh": "O que foi corrigido",
  "artwork.sendFix": "Enviar correção",
  "artwork.reopenPh": "Motivo (obrigatório para reabrir)",
  "artwork.accept": "Aceitar",
  "artwork.reopen": "Reabrir",
  "artwork.issuePh": "Não conformidade na arte deste SKU",
  "artwork.report": "Apontar",
  "artwork.done.designer": "Designer salvo.",
  "artwork.done.reported": "Não conformidade enviada ao designer.",
  "artwork.done.fixed": "Correção enviada.",
  "artwork.done.accepted": "Correção aceita.",
  "artwork.done.reopened": "Reaberta; o designer foi avisado.",
  "artwork.notify.assigned.subject": "Pedido #{n}: você é o designer",
  "artwork.notify.assigned.body": "Acompanhe as artes do pedido.",
  "artwork.notify.issue.subject": "Pedido #{n}: arte de {item} não conforme",
  "artwork.notify.fixed.subject": "Pedido #{n}: arte corrigida",
  "artwork.notify.reopened.subject": "Pedido #{n}: correção da arte reaberta",
  "artwork.error.invalid_designer":
    "Essa pessoa não pode ser designer deste pedido.",
  "artwork.error.item_not_found": "Item não encontrado neste pedido.",
  "artwork.error.note_required": "Escreva o motivo.",
  "artwork.error.invalid_status": "Essa não conformidade mudou; recarregue.",
  "artwork.error.not_found": "Não encontrada.",
  "artwork.error.order_cancelled": "Pedido cancelado.",
  "priceTable.title": "Tabela de preços",
  "priceTable.subtitle":
    "Último preço praticado de cada produto ativo (valor ao cliente ÷ quantidade) e o FOB. Só a Wellmix vê.",
  "priceTable.csv": "Baixar CSV",
  "priceTable.empty": "Nenhum produto ativo.",
  "priceTable.product": "Produto",
  "priceTable.line": "Linha",
  "priceTable.moq": "Pedido mínimo",
  "priceTable.unitPrice": "Preço unitário",
  "priceTable.fob": "FOB unitário",
  "priceTable.soldAt": "Última venda",
} as const;

export const en: Record<keyof typeof pt, string> = {
  "role.ocp": "Certification body (OCP)",
  "party.ocp": "Certification body (OCP)",
  "messages.type.ocp": "OCP",
  "function.designer": "Designer",
  "certFlow.title": "Certification",
  "importFlow.step.cert_memorial": "Technical description",
  "importFlow.step.cert_lab": "Lab testing (report)",
  "importFlow.step.cert_registration": "Registration number (certificate)",
  "importFlow.actor.ocp": "OCP",
  "importFlow.ph.cert_memorial": "",
  "importFlow.ph.cert_lab": "Lab / report no.",
  "importFlow.ph.cert_registration": "Registration no.",
  "importFlow.step.cert_seal": "Certification seal",
  "importFlow.step.cert_seal_art": "Seal applied to the artwork",
  "importFlow.actor.agency": "agency",
  "importFlow.ph.cert_seal": "Seal or registration no. (optional)",
  "importFlow.ph.cert_seal_art": "",
  "importFlow.fileReady": "File ready: {name} ({size}). Now click Send.",
  "importFlow.error.schema_pending":
    "This step has not been released in the database yet. Tell Wellmix (the schema must be published) and send it again.",
  "certFlow.sealHint":
    "Certification seal: the certification body (OCP) sends the seal for the order. Whoever makes the packaging artwork (the order's agency or Wellmix) downloads the seal, applies it to the artwork and sends the artwork with the seal. Wellmix checks it.",
  "certFlow.sheetNote": "Certification requested on the sheet: {note}",
  "certFlow.sealReplaced":
    "The certification body sent a new seal. Apply the new seal to the artwork and send it again.",
  "certFlow.notify.sealRequested.subject":
    "Order #{n}: issue the certification seal",
  "certFlow.notify.sealRequested.body":
    "A new order arrived for certification. Issue the certification seal and send the file on the order. Whoever makes the packaging artwork receives the seal to apply it.",
  "certFlow.notify.sealReady.subject":
    "Order #{n}: certification seal available",
  "certFlow.notify.sealReady.body":
    "The certification body sent the certification seal. Download the seal on the order, apply it to the packaging artwork and send the artwork with the seal.",
  "certFlow.notify.sealChanged.subject":
    "Order #{n}: certification seal replaced",
  "certFlow.notify.sealChanged.body":
    "The certification body sent a new seal. Download the seal on the order, apply it to the packaging artwork and send the artwork with the seal again.",
  "certFlow.notify.noOcp.subject":
    "Order #{n}: no certification body for the seal",
  "certFlow.notify.noOcp.body":
    "Every order needs the certification seal and this one has no certification body (OCP). Assign one under Order partners so the order reaches it.",
  "certFlow.brief.sealPending":
    "Certification seal: waiting for the certification body. Leave room for the seal in the artwork.",
  "certFlow.brief.sealReady":
    "Certification seal available: download it on the order, apply it to the artwork and send the artwork with the seal.",
  "certFlow.brief.sealSent":
    "Artwork with the seal sent; Wellmix is checking it.",
  "certFlow.brief.sealDone":
    "Certification seal applied to the artwork and checked.",
  "certFlow.brief.open": "Open the seal on the order",
  "tasks.group.cert_step": "Certification",
  "tasks.group.cert_validate": "Validate certification",
  "tasks.seal.issue.title": "Issue the certification seal: order #{n}",
  "tasks.seal.issue.detail":
    "Send the seal file on the order. Whoever makes the artwork receives it to apply to the packaging.",
  "tasks.seal.apply.title":
    "Apply the certification seal to the artwork: order #{n}",
  "tasks.seal.apply.detail":
    "Download the seal on the order and send the artwork with the seal applied.",
  "tasks.seal.validate.title":
    "Validate the seal applied to the artwork: order #{n}",
  "tasks.seal.validate.detail":
    "Check the seal on the artwork and validate it, or reject it with the reason.",
  "tasks.seal.assign.title":
    "Assign the certification body for the seal: order #{n}",
  "tasks.seal.assign.detail":
    "The order has no certification body. Assign one under Order partners, or send the seal you received elsewhere on the Certification card.",
  "artwork.title": "Artwork",
  "artwork.downloadAll": "Download all artwork",
  "artwork.designer": "Designer",
  "artwork.saveDesigner": "Save designer",
  "artwork.noCandidates":
    "Nobody available: give someone the Designer function in Team or assign the order's agency.",
  "artwork.noIssues": "No non-conformity",
  "artwork.status.open": "Non-conforming",
  "artwork.status.fixed": "Fixed, awaiting acceptance",
  "artwork.status.accepted": "Accepted",
  "artwork.file": "File",
  "artwork.fix": "Fix: {note} ({date})",
  "artwork.fixPh": "What was fixed",
  "artwork.sendFix": "Send fix",
  "artwork.reopenPh": "Reason (required to reopen)",
  "artwork.accept": "Accept",
  "artwork.reopen": "Reopen",
  "artwork.issuePh": "Non-conformity in this SKU's artwork",
  "artwork.report": "Report",
  "artwork.done.designer": "Designer saved.",
  "artwork.done.reported": "Non-conformity sent to the designer.",
  "artwork.done.fixed": "Fix sent.",
  "artwork.done.accepted": "Fix accepted.",
  "artwork.done.reopened": "Reopened; the designer was notified.",
  "artwork.notify.assigned.subject": "Order #{n}: you are the designer",
  "artwork.notify.assigned.body": "Follow the order's artwork.",
  "artwork.notify.issue.subject": "Order #{n}: {item} artwork non-conforming",
  "artwork.notify.fixed.subject": "Order #{n}: artwork fixed",
  "artwork.notify.reopened.subject": "Order #{n}: artwork fix reopened",
  "artwork.error.invalid_designer":
    "This person cannot be this order's designer.",
  "artwork.error.item_not_found": "Item not found on this order.",
  "artwork.error.note_required": "Write the reason.",
  "artwork.error.invalid_status": "This non-conformity changed; reload.",
  "artwork.error.not_found": "Not found.",
  "artwork.error.order_cancelled": "Order cancelled.",
  "priceTable.title": "Price table",
  "priceTable.subtitle":
    "Last price charged for each active product (customer value ÷ quantity) and the FOB. Wellmix only.",
  "priceTable.csv": "Download CSV",
  "priceTable.empty": "No active products.",
  "priceTable.product": "Product",
  "priceTable.line": "Line",
  "priceTable.moq": "Minimum order",
  "priceTable.unitPrice": "Unit price",
  "priceTable.fob": "Unit FOB",
  "priceTable.soldAt": "Last sale",
};

export const zh: Record<keyof typeof pt, string> = {
  "role.ocp": "认证机构（OCP）",
  "party.ocp": "认证机构（OCP）",
  "messages.type.ocp": "OCP",
  "function.designer": "设计师",
  "certFlow.title": "认证",
  "importFlow.step.cert_memorial": "技术说明书",
  "importFlow.step.cert_lab": "实验室检测（报告）",
  "importFlow.step.cert_registration": "注册号（证书）",
  "importFlow.actor.ocp": "OCP",
  "importFlow.ph.cert_memorial": "",
  "importFlow.ph.cert_lab": "实验室 / 报告编号",
  "importFlow.ph.cert_registration": "注册号",
  "importFlow.step.cert_seal": "认证标志",
  "importFlow.step.cert_seal_art": "认证标志已用于设计稿",
  "importFlow.actor.agency": "设计公司",
  "importFlow.ph.cert_seal": "标志或注册编号（选填）",
  "importFlow.ph.cert_seal_art": "",
  "importFlow.fileReady": "文件已就绪：{name}（{size}）。现在请点击“提交”。",
  "importFlow.error.schema_pending":
    "此步骤尚未在数据库中开通。请通知 Wellmix（需要发布数据结构）后重新提交。",
  "certFlow.sealHint":
    "认证标志：认证机构（OCP）提交该订单的认证标志。负责包装设计稿的一方（订单的设计公司或 Wellmix）下载标志，放入设计稿，并提交带标志的设计稿。由 Wellmix 核对。",
  "certFlow.sheetNote": "采购单要求的认证：{note}",
  "certFlow.sealReplaced":
    "认证机构提交了新的认证标志。请在设计稿中换用新标志并重新提交。",
  "certFlow.notify.sealRequested.subject": "订单 #{n}：请出具认证标志",
  "certFlow.notify.sealRequested.body":
    "有新订单需要认证。请出具认证标志并在订单中提交文件。负责包装设计稿的一方会收到标志并放入设计稿。",
  "certFlow.notify.sealReady.subject": "订单 #{n}：认证标志已可用",
  "certFlow.notify.sealReady.body":
    "认证机构已提交认证标志。请在订单中下载标志，放入包装设计稿，并提交带标志的设计稿。",
  "certFlow.notify.sealChanged.subject": "订单 #{n}：认证标志已更换",
  "certFlow.notify.sealChanged.body":
    "认证机构提交了新的认证标志。请在订单中下载标志，放入包装设计稿，并重新提交带标志的设计稿。",
  "certFlow.notify.noOcp.subject": "订单 #{n}：尚未指定出具标志的认证机构",
  "certFlow.notify.noOcp.body":
    "每个订单都需要认证标志，而此订单尚未指定认证机构（OCP）。请在“订单合作方”中指定认证机构，订单才会到达该机构。",
  "certFlow.brief.sealPending":
    "认证标志：等待认证机构提交。请在设计稿中预留标志位置。",
  "certFlow.brief.sealReady":
    "认证标志已可用：请在订单中下载，放入设计稿，并提交带标志的设计稿。",
  "certFlow.brief.sealSent": "带标志的设计稿已提交，Wellmix 正在核对。",
  "certFlow.brief.sealDone": "认证标志已放入设计稿并核对通过。",
  "certFlow.brief.open": "在订单中打开认证标志",
  "tasks.group.cert_step": "认证",
  "tasks.group.cert_validate": "审核认证",
  "tasks.seal.issue.title": "出具认证标志：订单 #{n}",
  "tasks.seal.issue.detail":
    "请在订单中提交标志文件。负责设计稿的一方会收到并用于包装。",
  "tasks.seal.apply.title": "将认证标志放入设计稿：订单 #{n}",
  "tasks.seal.apply.detail": "请在订单中下载标志，并提交带标志的设计稿。",
  "tasks.seal.validate.title": "审核设计稿中的认证标志：订单 #{n}",
  "tasks.seal.validate.detail":
    "请核对设计稿中的标志并审核通过，或填写原因后退回。",
  "tasks.seal.assign.title": "指定出具标志的认证机构：订单 #{n}",
  "tasks.seal.assign.detail":
    "此订单尚未指定认证机构。请在“订单合作方”中指定，或在“认证”卡片中提交从其他渠道收到的标志。",
  "artwork.title": "设计稿",
  "artwork.downloadAll": "下载全部设计稿",
  "artwork.designer": "设计师",
  "artwork.saveDesigner": "保存设计师",
  "artwork.noCandidates":
    "暂无人选：请在团队中分配设计师职能，或为订单指定代理公司。",
  "artwork.noIssues": "无不符合项",
  "artwork.status.open": "不符合",
  "artwork.status.fixed": "已修改，待确认",
  "artwork.status.accepted": "已确认",
  "artwork.file": "文件",
  "artwork.fix": "修改：{note}（{date}）",
  "artwork.fixPh": "修改内容",
  "artwork.sendFix": "提交修改",
  "artwork.reopenPh": "原因（重新打开时必填）",
  "artwork.accept": "确认",
  "artwork.reopen": "重新打开",
  "artwork.issuePh": "该 SKU 设计稿的不符合项",
  "artwork.report": "提出",
  "artwork.done.designer": "设计师已保存。",
  "artwork.done.reported": "不符合项已发送给设计师。",
  "artwork.done.fixed": "修改已提交。",
  "artwork.done.accepted": "修改已确认。",
  "artwork.done.reopened": "已重新打开，已通知设计师。",
  "artwork.notify.assigned.subject": "订单 #{n}：您是设计师",
  "artwork.notify.assigned.body": "请跟进订单的设计稿。",
  "artwork.notify.issue.subject": "订单 #{n}：{item} 设计稿不符合",
  "artwork.notify.fixed.subject": "订单 #{n}：设计稿已修改",
  "artwork.notify.reopened.subject": "订单 #{n}：设计稿修改被重新打开",
  "artwork.error.invalid_designer": "此人不能担任该订单的设计师。",
  "artwork.error.item_not_found": "该订单中未找到此产品。",
  "artwork.error.note_required": "请填写原因。",
  "artwork.error.invalid_status": "该不符合项已变更，请刷新。",
  "artwork.error.not_found": "未找到。",
  "artwork.error.order_cancelled": "订单已取消。",
  "priceTable.title": "价格表",
  "priceTable.subtitle":
    "每个在售产品的最近成交价（客户金额 ÷ 数量）及 FOB。仅 Wellmix 可见。",
  "priceTable.csv": "下载 CSV",
  "priceTable.empty": "没有在售产品。",
  "priceTable.product": "产品",
  "priceTable.line": "产品线",
  "priceTable.moq": "起订量",
  "priceTable.unitPrice": "单价",
  "priceTable.fob": "FOB 单价",
  "priceTable.soldAt": "最近销售",
};
