/**
 * Dicionário do módulo "order-collapse" (partes do detalhe do pedido que abrem e
 * fecham; tela enxuta da Wellmix): mesmas chaves em pt, en e zh.
 */
export const pt = {
  "orderPart.open": "Abrir",
  "orderPart.close": "Recolher",
  "orderPart.showAll": "Abrir todas as partes",
  "orderPart.showPhase": "Só as partes da fase atual",
  "orderPart.hint.phase":
    "Abertas as partes da fase em que o pedido está; as outras abrem com um clique.",
  "orderPart.hint.all": "Todas as partes do pedido abertas.",
  "orderPart.certification": "Certificação",
  "orderPart.artwork": "Artes",
  "orderPart.supplierPayment": "Pagamento ao fornecedor",
  "orderPart.production": "Produção",
  "orderPart.inspectionCancel": "Inspeção: tentativas esgotadas",
  "orderPart.freight": "Frete marítimo",
  "orderPart.exw": "Compra EXW: transportadora e custos de origem",
  "orderPart.origin": "Container na origem",
  "orderPart.samples": "Amostras",
  "orderPart.shippingDocs": "Documentos do embarque",
  "orderPart.importFlow": "Embarque e desembaraço",
  "orderPart.receiving": "Recebimento",
};

export const en: Record<keyof typeof pt, string> = {
  "orderPart.open": "Open",
  "orderPart.close": "Collapse",
  "orderPart.showAll": "Open all parts",
  "orderPart.showPhase": "Only the current phase",
  "orderPart.hint.phase":
    "Parts for the order's current phase are open; the others open with one click.",
  "orderPart.hint.all": "All parts of the order are open.",
  "orderPart.certification": "Certification",
  "orderPart.artwork": "Artwork",
  "orderPart.supplierPayment": "Supplier payment",
  "orderPart.production": "Production",
  "orderPart.inspectionCancel": "Inspection: attempts exhausted",
  "orderPart.freight": "Ocean freight",
  "orderPart.exw": "EXW purchase: carrier and origin costs",
  "orderPart.origin": "Container at origin",
  "orderPart.samples": "Samples",
  "orderPart.shippingDocs": "Shipping documents",
  "orderPart.importFlow": "Shipment and customs",
  "orderPart.receiving": "Receiving",
};

export const zh: Record<keyof typeof pt, string> = {
  "orderPart.open": "展开",
  "orderPart.close": "收起",
  "orderPart.showAll": "展开全部",
  "orderPart.showPhase": "只看当前阶段",
  "orderPart.hint.phase": "已展开订单当前阶段的部分，其他部分点击即可展开。",
  "orderPart.hint.all": "订单所有部分已展开。",
  "orderPart.certification": "认证",
  "orderPart.artwork": "设计稿",
  "orderPart.supplierPayment": "供应商付款",
  "orderPart.production": "生产",
  "orderPart.inspectionCancel": "验货：次数已用完",
  "orderPart.freight": "海运费",
  "orderPart.exw": "EXW 采购：承运商和起运地费用",
  "orderPart.origin": "起运地集装箱",
  "orderPart.samples": "样品",
  "orderPart.shippingDocs": "装运单据",
  "orderPart.importFlow": "装运和清关",
  "orderPart.receiving": "收货",
};
