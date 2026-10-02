/**
 * Dicionário do módulo "rfq" (convite de fornecedores depois da RFQ aberta):
 * mesmas chaves em pt, en e zh.
 */
export const pt = {
  "rfq.inviteMore": "Convidar mais fornecedores",
  "rfq.inviteMoreHint":
    "A RFQ já está aberta. Marque os fornecedores que ainda não foram convidados.",
  "rfq.inviteSelected": "Convidar selecionados",
  "rfq.allInvited":
    "RFQ aberta: todos os fornecedores ativos já foram convidados. As respostas aparecem na comparação de cotações.",
  "pricing.error.no_suppliers":
    "Selecione ao menos um fornecedor que ainda não foi convidado.",
};

export const en: Record<keyof typeof pt, string> = {
  "rfq.inviteMore": "Invite more suppliers",
  "rfq.inviteMoreHint":
    "The RFQ is already open. Tick the suppliers that have not been invited yet.",
  "rfq.inviteSelected": "Invite selected",
  "rfq.allInvited":
    "RFQ open: all active suppliers have been invited. Answers show up in the quote comparison.",
  "pricing.error.no_suppliers":
    "Select at least one supplier that has not been invited yet.",
};

export const zh: Record<keyof typeof pt, string> = {
  "rfq.inviteMore": "邀请更多供应商",
  "rfq.inviteMoreHint": "询价已发起。请勾选尚未邀请的供应商。",
  "rfq.inviteSelected": "邀请所选供应商",
  "rfq.allInvited":
    "询价已发起：所有有效供应商均已邀请。回复将显示在报价比较中。",
  "pricing.error.no_suppliers": "请至少选择一个尚未邀请的供应商。",
};
