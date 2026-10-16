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
  "ncm.sheet.source.request": "confirmado na solicitação",
  "ncm.sheet.source.ai": "sugestão da IA",
  "ncm.sheet.tableHint": "Vazio: vale a tabela TEC/TIPI pelo NCM ({rates}).",
  "ncm.sheet.none":
    "Sem NCM e sem sugestão ainda. A IA sugere pela descrição do produto na solicitação:",
  "ncm.sheet.requestLink": "abrir as sugestões de NCM →",
  "ncm.sheet.readOnly": "Preenchido pela Wellmix.",
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
  "ncm.sheet.source.request": "confirmed on the request",
  "ncm.sheet.source.ai": "AI suggestion",
  "ncm.sheet.tableHint": "Empty: the TEC/TIPI table applies by NCM ({rates}).",
  "ncm.sheet.none":
    "No NCM and no suggestion yet. The AI suggests from the product description on the request:",
  "ncm.sheet.requestLink": "open the NCM suggestions →",
  "ncm.sheet.readOnly": "Filled in by Wellmix.",
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
  "ncm.sheet.source.request": "需求中已确认",
  "ncm.sheet.source.ai": "AI 建议",
  "ncm.sheet.tableHint": "留空：按 NCM 适用 TEC/TIPI 税率表（{rates}）。",
  "ncm.sheet.none": "暂无 NCM，也暂无建议。AI 会根据需求中的产品描述给出建议：",
  "ncm.sheet.requestLink": "查看 NCM 建议 →",
  "ncm.sheet.readOnly": "由 Wellmix 填写。",
  "ncm.sheet.source.product": "产品档案",
  "ncm.sheet.source.validated": "已验证",
  "ncm.sheet.source.suggested": "建议",
  "ncm.sheet.source.table": "关键词",
};
