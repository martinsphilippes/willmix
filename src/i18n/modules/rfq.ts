/**
 * Dicionário do módulo "rfq" (convite de fornecedores depois da RFQ aberta):
 * mesmas chaves em pt, en e zh.
 */
export const pt = {
  "pricing.error.no_suppliers":
    "Selecione ao menos um fornecedor que ainda não foi convidado.",
};

export const en: Record<keyof typeof pt, string> = {
  "pricing.error.no_suppliers":
    "Select at least one supplier that has not been invited yet.",
};

export const zh: Record<keyof typeof pt, string> = {
  "pricing.error.no_suppliers": "请至少选择一个尚未邀请的供应商。",
};
