/**
 * Dicionário do módulo "quote-sheet" (resposta da RFQ pela ficha de compra):
 * mesmas chaves em pt, en e zh.
 */
export const pt = {
  "nav.quotes": "Solicitações ao fornecedor",
};

export const en: Record<keyof typeof pt, string> = {
  "nav.quotes": "Supplier requests",
};

export const zh: Record<keyof typeof pt, string> = {
  "nav.quotes": "供应商询价",
};
