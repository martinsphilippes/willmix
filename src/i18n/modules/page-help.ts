/**
 * Dicionário do módulo "page-help" (caixa "Como funciona" recolhida: o que
 * aparece ao lado do + para abrir e fechar): mesmas chaves em pt, en e zh.
 */
export const pt = {
  "help.show": "Ver",
  "help.hide": "Fechar",
};

export const en: Record<keyof typeof pt, string> = {
  "help.show": "Show",
  "help.hide": "Close",
};

export const zh: Record<keyof typeof pt, string> = {
  "help.show": "查看",
  "help.hide": "收起",
};
