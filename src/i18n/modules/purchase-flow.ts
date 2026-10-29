/**
 * Dicionário do módulo "purchase-flow" (Fase B do fluxo de compras: despachante
 * com dumping/média/certificação, fotos HD e die cut, validações da Wellmix na
 * Preparação e compra para estoque): mesmas chaves em pt, en e zh.
 */
export const pt = {
  "purchaseFlow.dumping.title": "Dumping",
  "purchaseFlow.dumping.held":
    "Dumping marcado pelo despachante: a escolha do fornecedor espera a liberação do gerente de produto ou do comprador.",
  "purchaseFlow.dumping.released": "Dumping liberado: a escolha pode seguir.",
  "purchaseFlow.dumping.releasedAt": "Dumping liberado por {name} em {date}.",
  "purchaseFlow.dumping.release": "Liberar dumping",
  "purchaseFlow.dumping.done": "Dumping liberado.",
  "purchaseFlow.certificationNote.ph": "Qual certificação, órgão, observações",
  "purchaseFlow.notify.dumping.subject": "Dumping em {product}: liberar",
  "purchaseFlow.notify.dumping.body":
    "O despachante marcou dumping na ficha da cotação. A escolha do fornecedor espera a sua liberação. Observação: {note}",
  "purchaseFlow.notify.average.subject": "Média alterada em {product}",
  "purchaseFlow.notify.average.body":
    "Na recompra, a média passou de {before} para {after}. Peça ao despachante para esclarecer.",
  "purchaseFlow.error.dumping_release_required":
    "Dumping marcado: o gerente de produto ou o comprador precisa liberar antes de escolher o fornecedor.",
  "purchaseFlow.error.no_dumping": "Esta ficha não tem dumping marcado.",
  "purchaseFlow.stock.option": "Compra para estoque (sem cliente)",
  "purchaseFlow.stock.badge": "Compra para estoque",
  "sheet.field.dumping": "Dumping",
  "sheet.field.dumpingNote": "Observação do dumping",
  "sheet.field.averagePrice": "Média (US$)",
  "sheet.field.certificationRequired": "Precisa de certificação",
  "sheet.field.certificationNote": "Certificação",
  "catalog.photoKind.hd": "Foto em alta (HD)",
  "catalog.photoKind.die_cut": "Faca (die cut)",
  "sourcing.photo.hd": "Foto em alta (HD)",
  "sourcing.photo.die_cut": "Faca (die cut)",
  "req.sheet_validated": "Ficha e imagens validadas pelo comprador",
  "req.product_registered": "Cadastro do produto validado (cadastro)",
} as const;

export const en: Record<keyof typeof pt, string> = {
  "purchaseFlow.dumping.title": "Dumping",
  "purchaseFlow.dumping.held":
    "Dumping flagged by the customs broker: supplier selection waits for the product manager or buyer to release it.",
  "purchaseFlow.dumping.released": "Dumping released: selection can proceed.",
  "purchaseFlow.dumping.releasedAt": "Dumping released by {name} on {date}.",
  "purchaseFlow.dumping.release": "Release dumping",
  "purchaseFlow.dumping.done": "Dumping released.",
  "purchaseFlow.certificationNote.ph": "Which certification, body, notes",
  "purchaseFlow.notify.dumping.subject": "Dumping on {product}: release",
  "purchaseFlow.notify.dumping.body":
    "The customs broker flagged dumping on the quote sheet. Supplier selection waits for your release. Note: {note}",
  "purchaseFlow.notify.average.subject": "Average changed on {product}",
  "purchaseFlow.notify.average.body":
    "On this repurchase the average went from {before} to {after}. Ask the customs broker to clarify.",
  "purchaseFlow.error.dumping_release_required":
    "Dumping flagged: the product manager or buyer must release it before choosing the supplier.",
  "purchaseFlow.error.no_dumping": "This sheet has no dumping flag.",
  "purchaseFlow.stock.option": "Stock purchase (no customer)",
  "purchaseFlow.stock.badge": "Stock purchase",
  "sheet.field.dumping": "Dumping",
  "sheet.field.dumpingNote": "Dumping note",
  "sheet.field.averagePrice": "Average (US$)",
  "sheet.field.certificationRequired": "Needs certification",
  "sheet.field.certificationNote": "Certification",
  "catalog.photoKind.hd": "High-res photo (HD)",
  "catalog.photoKind.die_cut": "Die cut",
  "sourcing.photo.hd": "High-res photo (HD)",
  "sourcing.photo.die_cut": "Die cut",
  "req.sheet_validated": "Sheet and images validated by the buyer",
  "req.product_registered": "Product registration validated",
};

export const zh: Record<keyof typeof pt, string> = {
  "purchaseFlow.dumping.title": "反倾销",
  "purchaseFlow.dumping.held":
    "报关行已标记反倾销：选择供应商需等待产品经理或采购员放行。",
  "purchaseFlow.dumping.released": "反倾销已放行，可以继续选择。",
  "purchaseFlow.dumping.releasedAt": "{name} 于 {date} 放行反倾销。",
  "purchaseFlow.dumping.release": "放行反倾销",
  "purchaseFlow.dumping.done": "反倾销已放行。",
  "purchaseFlow.certificationNote.ph": "认证类型、机构、备注",
  "purchaseFlow.notify.dumping.subject": "{product} 反倾销：待放行",
  "purchaseFlow.notify.dumping.body":
    "报关行在报价单上标记了反倾销，选择供应商需等待您放行。备注：{note}",
  "purchaseFlow.notify.average.subject": "{product} 均价已变更",
  "purchaseFlow.notify.average.body":
    "本次复购均价由 {before} 变为 {after}，请报关行说明。",
  "purchaseFlow.error.dumping_release_required":
    "已标记反倾销：选择供应商前需产品经理或采购员放行。",
  "purchaseFlow.error.no_dumping": "该采购单未标记反倾销。",
  "purchaseFlow.stock.option": "库存采购（无客户）",
  "purchaseFlow.stock.badge": "库存采购",
  "sheet.field.dumping": "反倾销",
  "sheet.field.dumpingNote": "反倾销备注",
  "sheet.field.averagePrice": "均价（美元）",
  "sheet.field.certificationRequired": "需要认证",
  "sheet.field.certificationNote": "认证",
  "catalog.photoKind.hd": "高清照片",
  "catalog.photoKind.die_cut": "刀模",
  "sourcing.photo.hd": "高清照片",
  "sourcing.photo.die_cut": "刀模",
  "req.sheet_validated": "采购员已确认采购单和图片",
  "req.product_registered": "产品登记已确认",
};
