/**
 * Dicionário do módulo "new-product" (tela Novo produto com a ficha em
 * branco e a aprovação do produto novo pelo administrador ou pelo superior;
 * docs/NEW_PRODUCT.md): mesmas chaves em pt, en e zh.
 */
export const pt = {
  /* Tela Novo produto */
  "newProduct.title": "Novo produto",
  "newProduct.subtitle":
    "Preencha a ficha do produto. Ao criar, ele vai para a aprovação do administrador ou do seu superior.",
  "newProduct.create": "Criar produto e enviar para aprovação",
  "newProduct.status":
    "Nasce inativo e aguardando aprovação: fica ativo quando o administrador ou o seu superior aprovar.",
  "newProduct.approver":
    "Quem aprova: {name} (seu superior) ou o administrador.",
  "newProduct.approver.admins":
    'Quem aprova: o administrador (você não tem um superior no "Responde a" que abra a tela Produtos).',
  "newProduct.after.title": "Depois de criar",
  "newProduct.after.body":
    "Nesta mesma ficha ficam liberados os fornecedores, as variações, a ficha de compra mestre, as fotos, as medições, o NCM, as certificações, os atributos e a IA.",
  "newProduct.created":
    "Produto criado e enviado para aprovação. Ele fica inativo até ser aprovado; complete aqui as fotos, as medições e o resto da ficha.",
  "help.newProduct.body":
    'Cadastro de um produto novo com a ficha completa: os mesmos campos da tela do produto. O produto nasce inativo e vai para as Pendências do administrador e do seu superior (o "Responde a" da Equipe), que aprovam ou recusam.',
  "help.newProduct.steps":
    "Preencha o nome e a linha (obrigatórios) e o que já souber da ficha.\nCrie o produto: ele vai para a aprovação e abre na tela do produto, onde você completa fotos, medições e o resto.\nAprovado, fica ativo no catálogo e segue para o Sankhya. Recusado, aparece o motivo: corrija e reenvie.",

  /* Aprovação na tela do produto */
  "productApproval.title": "Aprovação do produto novo",
  "productApproval.badge.pending": "Aguardando aprovação",
  "productApproval.badge.rejected": "Recusado",
  "productApproval.requestedBy": "Pedido por {name} em {date}.",
  "productApproval.waitingFor":
    "Com {name} (superior de quem pediu) e com o administrador.",
  "productApproval.waitingForAdmins":
    'Com o administrador (quem pediu não tem um superior no "Responde a" que abra a tela Produtos).',
  "productApproval.previousRejection":
    "Recusado antes por {name} em {date}: {note}",
  "productApproval.rejectedBy": "Recusado por {name} em {date}: {note}",
  "productApproval.inactiveHint":
    "Enquanto aguarda, o produto fica inativo: fora do catálogo, da vitrine, das novas solicitações e do Sankhya.",
  "productApproval.approve": "Aprovar produto",
  "productApproval.reject": "Recusar",
  "productApproval.note": "Motivo da recusa",
  "productApproval.notePlaceholder": "O que precisa ser corrigido",
  "productApproval.onlyApprovers":
    "Só o administrador ou um superior de quem pediu aprova ou recusa.",
  "productApproval.resubmit": "Reenviar para aprovação",
  "productApproval.resubmitHint":
    "Corrija a ficha e reenvie: a aprovação volta para o seu superior (ou para o administrador).",
  "productApproval.activeLocked": "fica ativo na aprovação",
  "productApproval.done.approved":
    "Produto aprovado: está ativo no catálogo e segue para o Sankhya.",
  "productApproval.done.rejected":
    "Produto recusado. Quem pediu foi avisado com o motivo.",
  "productApproval.done.resubmitted": "Produto reenviado para aprovação.",

  /* Lista de produtos */
  "productApproval.showList": "Aguardando aprovação ({n})",
  "productApproval.listTitle": "Produtos novos aguardando aprovação",

  /* Pendências e avisos */
  "tasks.group.product_approve": "Aprovar produto novo",
  "productApproval.task.title": "Aprovar produto novo: {name}",
  "productApproval.task.detail": "{sku} · {line} · pedido por {requester}",
  "productApproval.notify.subject": "Aprovar produto novo: {name}",
  "productApproval.notify.resubmitted":
    "Produto novo corrigido, aprovar de novo: {name}",
  "productApproval.notify.body":
    "{requester} cadastrou o produto (SKU {sku}). Abra a ficha e aprove ou recuse.",
  "productApproval.notify.approved": "Produto aprovado: {name}",
  "productApproval.notify.approvedBody":
    "{by} aprovou o produto. Ele está ativo no catálogo.",
  "productApproval.notify.rejected": "Produto recusado: {name}",
  "productApproval.notify.rejectedBody":
    "{by} recusou: {note}. Corrija a ficha e reenvie para aprovação.",

  /* Erros (?error=) */
  "catalog.error.line_not_found": "Linha de produto não encontrada.",
  "catalog.error.approval_not_pending":
    "Este produto não está aguardando aprovação (já foi decidido).",
  "catalog.error.approval_not_rejected":
    "Só um produto recusado pode ser reenviado para aprovação.",
  "catalog.error.approval_forbidden":
    "Só o administrador ou um superior de quem pediu aprova ou recusa este produto.",
  "catalog.error.approval_reject_note": "Escreva o motivo da recusa.",
};

export const en: Record<keyof typeof pt, string> = {
  "newProduct.title": "New product",
  "newProduct.subtitle":
    "Fill in the product sheet. Once created, it goes to the administrator or your manager for approval.",
  "newProduct.create": "Create product and send for approval",
  "newProduct.status":
    "Starts inactive and awaiting approval: it becomes active when the administrator or your manager approves it.",
  "newProduct.approver":
    "Approved by: {name} (your manager) or the administrator.",
  "newProduct.approver.admins":
    'Approved by: the administrator (you have no manager in "Reports to" who opens the Products screen).',
  "newProduct.after.title": "After creating",
  "newProduct.after.body":
    "This same sheet then unlocks suppliers, variants, the master purchase sheet, photos, measurements, NCM, certifications, attributes and AI.",
  "newProduct.created":
    "Product created and sent for approval. It stays inactive until approved; complete the photos, measurements and the rest of the sheet here.",
  "help.newProduct.body":
    'Register a new product with the full sheet: the same fields as the product screen. The product starts inactive and goes to the tasks of the administrator and your manager (Team "Reports to"), who approve or reject it.',
  "help.newProduct.steps":
    "Fill in the name and the line (required) and whatever you already know of the sheet.\nCreate the product: it goes for approval and opens on the product screen, where you complete photos, measurements and the rest.\nOnce approved, it is active in the catalog and goes to Sankhya. If rejected, the reason shows: fix it and resubmit.",

  "productApproval.title": "New product approval",
  "productApproval.badge.pending": "Awaiting approval",
  "productApproval.badge.rejected": "Rejected",
  "productApproval.requestedBy": "Requested by {name} on {date}.",
  "productApproval.waitingFor":
    "With {name} (the requester's manager) and the administrator.",
  "productApproval.waitingForAdmins":
    'With the administrator (the requester has no manager in "Reports to" who opens the Products screen).',
  "productApproval.previousRejection":
    "Previously rejected by {name} on {date}: {note}",
  "productApproval.rejectedBy": "Rejected by {name} on {date}: {note}",
  "productApproval.inactiveHint":
    "While waiting, the product stays inactive: out of the catalog, the showcase, new requests and Sankhya.",
  "productApproval.approve": "Approve product",
  "productApproval.reject": "Reject",
  "productApproval.note": "Reason for rejection",
  "productApproval.notePlaceholder": "What needs to be fixed",
  "productApproval.onlyApprovers":
    "Only the administrator or a manager of the requester approves or rejects.",
  "productApproval.resubmit": "Resubmit for approval",
  "productApproval.resubmitHint":
    "Fix the sheet and resubmit: the approval goes back to your manager (or the administrator).",
  "productApproval.activeLocked": "becomes active on approval",
  "productApproval.done.approved":
    "Product approved: it is active in the catalog and goes to Sankhya.",
  "productApproval.done.rejected":
    "Product rejected. The requester was notified with the reason.",
  "productApproval.done.resubmitted": "Product resubmitted for approval.",

  "productApproval.showList": "Awaiting approval ({n})",
  "productApproval.listTitle": "New products awaiting approval",

  "tasks.group.product_approve": "Approve new product",
  "productApproval.task.title": "Approve new product: {name}",
  "productApproval.task.detail": "{sku} · {line} · requested by {requester}",
  "productApproval.notify.subject": "Approve new product: {name}",
  "productApproval.notify.resubmitted":
    "New product fixed, approve again: {name}",
  "productApproval.notify.body":
    "{requester} registered the product (SKU {sku}). Open the sheet and approve or reject it.",
  "productApproval.notify.approved": "Product approved: {name}",
  "productApproval.notify.approvedBody":
    "{by} approved the product. It is active in the catalog.",
  "productApproval.notify.rejected": "Product rejected: {name}",
  "productApproval.notify.rejectedBody":
    "{by} rejected it: {note}. Fix the sheet and resubmit for approval.",

  "catalog.error.line_not_found": "Product line not found.",
  "catalog.error.approval_not_pending":
    "This product is not awaiting approval (it was already decided).",
  "catalog.error.approval_not_rejected":
    "Only a rejected product can be resubmitted for approval.",
  "catalog.error.approval_forbidden":
    "Only the administrator or a manager of the requester approves or rejects this product.",
  "catalog.error.approval_reject_note": "Write the reason for rejection.",
};

export const zh: Record<keyof typeof pt, string> = {
  "newProduct.title": "新增产品",
  "newProduct.subtitle": "填写产品档案。创建后将提交给管理员或您的上级审批。",
  "newProduct.create": "创建产品并提交审批",
  "newProduct.status":
    "创建后为停用状态并等待审批：管理员或您的上级批准后即启用。",
  "newProduct.approver": "审批人：{name}（您的上级）或管理员。",
  "newProduct.approver.admins":
    "审批人：管理员（您在“汇报对象”中没有可打开产品页面的上级）。",
  "newProduct.after.title": "创建之后",
  "newProduct.after.body":
    "在同一档案中即可填写供应商、规格变体、采购主档、照片、测量、NCM、认证、属性和 AI。",
  "newProduct.created":
    "产品已创建并提交审批。批准前保持停用；请在此补充照片、测量和档案的其余部分。",
  "help.newProduct.body":
    "使用完整档案登记新产品：与产品页面相同的字段。产品创建后为停用状态，并进入管理员和您的上级（团队中的“汇报对象”）的待办，由他们批准或拒绝。",
  "help.newProduct.steps":
    "填写名称和产品线（必填）以及已知的档案信息。\n创建产品：提交审批并打开产品页面，在那里补充照片、测量和其余内容。\n批准后在目录中启用并同步到 Sankhya。被拒绝时会显示原因：修改后重新提交。",

  "productApproval.title": "新产品审批",
  "productApproval.badge.pending": "等待审批",
  "productApproval.badge.rejected": "已拒绝",
  "productApproval.requestedBy": "由 {name} 于 {date} 提交。",
  "productApproval.waitingFor": "待 {name}（提交人的上级）和管理员审批。",
  "productApproval.waitingForAdmins":
    "待管理员审批（提交人在“汇报对象”中没有可打开产品页面的上级）。",
  "productApproval.previousRejection": "此前由 {name} 于 {date} 拒绝：{note}",
  "productApproval.rejectedBy": "由 {name} 于 {date} 拒绝：{note}",
  "productApproval.inactiveHint":
    "等待期间产品保持停用：不在目录、展示、新申请和 Sankhya 中。",
  "productApproval.approve": "批准产品",
  "productApproval.reject": "拒绝",
  "productApproval.note": "拒绝原因",
  "productApproval.notePlaceholder": "需要修改的内容",
  "productApproval.onlyApprovers": "只有管理员或提交人的上级可以批准或拒绝。",
  "productApproval.resubmit": "重新提交审批",
  "productApproval.resubmitHint":
    "修改档案后重新提交：审批将回到您的上级（或管理员）。",
  "productApproval.activeLocked": "批准后启用",
  "productApproval.done.approved":
    "产品已批准：已在目录中启用并同步到 Sankhya。",
  "productApproval.done.rejected": "产品已拒绝。已将原因通知提交人。",
  "productApproval.done.resubmitted": "产品已重新提交审批。",

  "productApproval.showList": "等待审批（{n}）",
  "productApproval.listTitle": "等待审批的新产品",

  "tasks.group.product_approve": "审批新产品",
  "productApproval.task.title": "审批新产品：{name}",
  "productApproval.task.detail": "{sku} · {line} · 提交人 {requester}",
  "productApproval.notify.subject": "审批新产品：{name}",
  "productApproval.notify.resubmitted": "新产品已修改，请再次审批：{name}",
  "productApproval.notify.body":
    "{requester} 登记了产品（SKU {sku}）。请打开档案批准或拒绝。",
  "productApproval.notify.approved": "产品已批准：{name}",
  "productApproval.notify.approvedBody": "{by} 批准了该产品，已在目录中启用。",
  "productApproval.notify.rejected": "产品已拒绝：{name}",
  "productApproval.notify.rejectedBody":
    "{by} 拒绝了：{note}。请修改档案后重新提交审批。",

  "catalog.error.line_not_found": "未找到产品线。",
  "catalog.error.approval_not_pending": "该产品不在等待审批（已处理）。",
  "catalog.error.approval_not_rejected": "只有被拒绝的产品才能重新提交审批。",
  "catalog.error.approval_forbidden":
    "只有管理员或提交人的上级可以批准或拒绝该产品。",
  "catalog.error.approval_reject_note": "请填写拒绝原因。",
};
