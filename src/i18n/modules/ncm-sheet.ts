/**
 * Dicionário do módulo "ncm-sheet" (sugestões de NCM no campo da ficha de
 * compra): mesmas chaves em pt, en e zh.
 */
export const pt = {
  "ncm.sheet.title": "Sugestões de NCM",
  "ncm.sheet.use": "Usar",
  "ncm.sheet.hint":
    "Pelo cadastro do produto e pela tabela fiscal; II e IPI entram junto quando a tabela tem. A classificação oficial segue no card Tributos do produto.",
  "ncm.sheet.applied": "NCM {ncm} aplicado; confira II e IPI e salve a ficha.",
  "ncm.sheet.source.product": "cadastro do produto",
  "ncm.sheet.source.validated": "validado",
  "ncm.sheet.source.suggested": "sugerido",
  "ncm.sheet.source.table": "palavras-chave",
};

export const en: Record<keyof typeof pt, string> = {
  "ncm.sheet.title": "NCM suggestions",
  "ncm.sheet.use": "Use",
  "ncm.sheet.hint":
    "From the product record and the tax table; II and IPI come along when the table has them. The official classification stays in the product's Taxes card.",
  "ncm.sheet.applied":
    "NCM {ncm} applied; check II and IPI and save the sheet.",
  "ncm.sheet.source.product": "product record",
  "ncm.sheet.source.validated": "validated",
  "ncm.sheet.source.suggested": "suggested",
  "ncm.sheet.source.table": "keywords",
};

export const zh: Record<keyof typeof pt, string> = {
  "ncm.sheet.title": "NCM 建议",
  "ncm.sheet.use": "使用",
  "ncm.sheet.hint":
    "来自产品档案和税率表；表中有时会一并填入 II 和 IPI。正式归类仍在产品的“税费”卡片中。",
  "ncm.sheet.applied": "已填入 NCM {ncm}；请核对 II 和 IPI 并保存采购单。",
  "ncm.sheet.source.product": "产品档案",
  "ncm.sheet.source.validated": "已验证",
  "ncm.sheet.source.suggested": "建议",
  "ncm.sheet.source.table": "关键词",
};
