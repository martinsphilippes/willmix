/**
 * Dicionário do módulo "product-sheet" (ficha de compra mestre no cadastro
 * do produto): mesmas chaves em pt, en e zh.
 */
export const pt = {
  "productSheet.title": "Ficha de compra do produto (mestre)",
  "productSheet.hint":
    "Pedidos e cotações deste produto já nascem preenchidos com esta ficha e com as fotos do cadastro. Preço, moeda, MOQ, caixa, medidas, pesos, cor e material são o mesmo dado dos campos acima: salvar aqui atualiza lá, e vice-versa.",
  "productSheet.complete": "Ficha mestre completa",
  "productSheet.partial": "Ficha mestre: faltam {n} item(ns)",
  "productSheet.none": "Sem ficha mestre",
  "productSheet.missing": "Faltam: {fields}",
  "productSheet.save": "Salvar ficha mestre",
  "productSheet.saved": "Ficha mestre salva.",
  "productSheet.savedPartial": "Ficha mestre salva; faltam: {fields}.",
  "productSheet.photosHint":
    "As 5 fotos da ficha ficam no card Fotos deste produto (balança, régua, lado, ângulo e original). Elas vão junto para os pedidos.",
  "productSheet.adopt": "Atualizar cadastro do produto com esta ficha",
  "productSheet.adoptHint":
    "Copia os campos gerais e as fotos desta ficha para a ficha mestre do produto; os próximos pedidos e cotações nascem com eles.",
  "productSheet.adopted": "Cadastro do produto atualizado com esta ficha.",
  "sheet.prefilledNotice.master":
    "Ficha preenchida com a ficha mestre do produto (cadastro). Confira e ajuste o que for desta compra.",
  "sheet.prefilled.master": "Ficha mestre do produto trazida do cadastro.",
  "productSheet.column": "Ficha mestre",
  "productSheet.badge.complete": "Completa",
  "productSheet.badge.partial": "Parcial",
  "productSheet.badge.none": "—",
  "productSheet.error.no_product":
    "Esta ficha não está ligada a um produto do catálogo.",
};

export const en: Record<keyof typeof pt, string> = {
  "productSheet.title": "Product purchase sheet (master)",
  "productSheet.hint":
    "Orders and quotes for this product start pre-filled with this sheet and with the catalog photos. Price, currency, MOQ, carton, dimensions, weights, color and material are the same data as the fields above: saving here updates them, and vice versa.",
  "productSheet.complete": "Master sheet complete",
  "productSheet.partial": "Master sheet: {n} item(s) missing",
  "productSheet.none": "No master sheet",
  "productSheet.missing": "Missing: {fields}",
  "productSheet.save": "Save master sheet",
  "productSheet.saved": "Master sheet saved.",
  "productSheet.savedPartial": "Master sheet saved; missing: {fields}.",
  "productSheet.photosHint":
    "The 5 sheet photos live in this product's Photos card (scale, ruler, side, angle and original). They travel with the orders.",
  "productSheet.adopt": "Update the product record with this sheet",
  "productSheet.adoptHint":
    "Copies the general fields and the photos of this sheet into the product's master sheet; the next orders and quotes start with them.",
  "productSheet.adopted": "Product record updated with this sheet.",
  "sheet.prefilledNotice.master":
    "Sheet pre-filled from the product's master sheet (catalog). Review and adjust what belongs to this purchase.",
  "sheet.prefilled.master": "Product master sheet brought from the catalog.",
  "productSheet.column": "Master sheet",
  "productSheet.badge.complete": "Complete",
  "productSheet.badge.partial": "Partial",
  "productSheet.badge.none": "—",
  "productSheet.error.no_product":
    "This sheet is not linked to a catalog product.",
};

export const zh: Record<keyof typeof pt, string> = {
  "productSheet.title": "产品采购单（主档）",
  "productSheet.hint":
    "该产品的订单和报价将直接以此采购单和产品照片预填。价格、币种、起订量、外箱、尺寸、重量、颜色和材质与上方字段是同一数据：在此保存会同步上方，反之亦然。",
  "productSheet.complete": "主档采购单已完整",
  "productSheet.partial": "主档采购单：缺 {n} 项",
  "productSheet.none": "尚无主档采购单",
  "productSheet.missing": "缺少：{fields}",
  "productSheet.save": "保存主档采购单",
  "productSheet.saved": "主档采购单已保存。",
  "productSheet.savedPartial": "主档采购单已保存；缺少：{fields}。",
  "productSheet.photosHint":
    "采购单的 5 张照片放在本产品的“照片”卡片中（称重、带尺、侧面、其他角度、原始）。它们会随订单一起带入。",
  "productSheet.adopt": "用此采购单更新产品主档",
  "productSheet.adoptHint":
    "将此采购单的通用字段和照片复制到产品主档；后续订单和报价将以此预填。",
  "productSheet.adopted": "产品主档已按此采购单更新。",
  "sheet.prefilledNotice.master":
    "已用产品主档（产品库）预填采购单，请核对并调整本次采购的内容。",
  "sheet.prefilled.master": "已带入产品主档采购单。",
  "productSheet.column": "主档采购单",
  "productSheet.badge.complete": "完整",
  "productSheet.badge.partial": "部分",
  "productSheet.badge.none": "—",
  "productSheet.error.no_product": "此采购单未关联产品库中的产品。",
};
