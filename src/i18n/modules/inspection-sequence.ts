/**
 * Inspeção do pedido de compra pelo mapa do processo (docs/PRODUCTION.md,
 * "Sequência da inspeção"): vídeo, declaração de conformidade, aprovação da
 * Wellmix e tentativas. Mesmas chaves em pt, en e zh.
 */
export const pt = {
  "purchaseSequence.settings.inspectionMediaDays":
    "Fornecedor: fotos, vídeo e declaração de conformidade (desde o início da produção)",
  "purchaseSequence.settings.inspectionReviewDays":
    "Wellmix: aprovar os SKUs na inspeção (desde a declaração)",
  "purchaseSequence.settings.inspectionMaxAttempts":
    "Tentativas de aprovação na inspeção antes do cancelamento",
  "purchaseSequence.gate.sku": "Inspeção por SKU",
  "req.production_video": "Vídeo da produção",
  "req.supplier_conformity":
    "Produto conforme o pedido (declaração do fornecedor)",
  "req.sku_approved": "Inspeção aprovada pela Wellmix (todos os SKUs)",
  "production.error.conformity_required":
    "Espere a declaração de conformidade do fornecedor antes de inspecionar.",
  "production.error.attempts_exhausted":
    "As tentativas acabaram: confirme o cancelamento do pedido.",
  "inspectionCancel.title": "Tentativas de aprovação esgotadas",
  "inspectionCancel.body":
    "{items} foi reprovado {n} vezes (limite de {max} tentativas). Pelo processo, o pedido é cancelado e o produto volta à Seleção de itens para outro fornecedor. Escreva a mensagem que o fornecedor vai receber e confirme.",
  "inspectionCancel.message": "Mensagem para o fornecedor",
  "inspectionCancel.confirm": "Confirmo o cancelamento deste pedido.",
  "inspectionCancel.submit": "Cancelar o pedido",
  "inspectionCancel.selection": "Escolher outro fornecedor na Seleção de itens",
  "inspectionCancel.noPermission":
    'Quem tem a permissão "Cancelar pedido" confirma o cancelamento.',
};

export const en: Record<keyof typeof pt, string> = {
  "purchaseSequence.settings.inspectionMediaDays":
    "Supplier: photos, video and conformity statement (from the production start)",
  "purchaseSequence.settings.inspectionReviewDays":
    "Wellmix: approve the SKUs in the inspection (from the statement)",
  "purchaseSequence.settings.inspectionMaxAttempts":
    "Inspection approval attempts before cancelling",
  "purchaseSequence.gate.sku": "SKU inspection",
  "req.production_video": "Production video",
  "req.supplier_conformity": "Product as ordered (supplier statement)",
  "req.sku_approved": "Inspection approved by Wellmix (all SKUs)",
  "production.error.conformity_required":
    "Wait for the supplier's conformity statement before inspecting.",
  "production.error.attempts_exhausted":
    "No attempts left: confirm the order cancellation.",
  "inspectionCancel.title": "Approval attempts used up",
  "inspectionCancel.body":
    "{items} was rejected {n} times (limit of {max} attempts). By the process, the order is cancelled and the product goes back to the item selection for another supplier. Write the message the supplier will get and confirm.",
  "inspectionCancel.message": "Message to the supplier",
  "inspectionCancel.confirm": "I confirm the cancellation of this order.",
  "inspectionCancel.submit": "Cancel the order",
  "inspectionCancel.selection": "Choose another supplier in the item selection",
  "inspectionCancel.noPermission":
    'Someone with the "Cancel order" permission confirms the cancellation.',
};

export const zh: Record<keyof typeof pt, string> = {
  "purchaseSequence.settings.inspectionMediaDays":
    "供应商：照片、视频和符合性声明（自生产开始起）",
  "purchaseSequence.settings.inspectionReviewDays":
    "Wellmix：验货审批 SKU（自声明起）",
  "purchaseSequence.settings.inspectionMaxAttempts": "取消前的验货审批次数",
  "purchaseSequence.gate.sku": "按 SKU 验货",
  "req.production_video": "生产视频",
  "req.supplier_conformity": "产品符合订单（供应商声明）",
  "req.sku_approved": "Wellmix 验货通过（全部 SKU）",
  "production.error.conformity_required": "请先等待供应商的符合性声明再验货。",
  "production.error.attempts_exhausted": "次数已用完：请确认取消订单。",
  "inspectionCancel.title": "审批次数已用完",
  "inspectionCancel.body":
    "{items} 被退回 {n} 次（上限 {max} 次）。按流程，订单取消，产品回到选品以选择其他供应商。请填写发给供应商的说明并确认。",
  "inspectionCancel.message": "给供应商的说明",
  "inspectionCancel.confirm": "我确认取消此订单。",
  "inspectionCancel.submit": "取消订单",
  "inspectionCancel.selection": "在选品中选择其他供应商",
  "inspectionCancel.noPermission": "由拥有“取消订单”权限的人确认取消。",
};
