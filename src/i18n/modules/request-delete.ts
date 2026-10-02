/**
 * Dicionário do módulo "request-delete" (excluir uma ou várias solicitações na
 * lista): mesmas chaves em pt, en e zh.
 */
export const pt = {
  "reqDelete.selectAll": "Selecionar todas",
  "reqDelete.selectOne": "Selecionar",
  "reqDelete.clear": "Limpar seleção",
  "reqDelete.selected": "{n} selecionada(s)",
  "reqDelete.deleteSelected": "Excluir selecionadas",
  "reqDelete.confirmMany":
    "Excluir {n} solicitação(ões)? Elas saem da lista e as cotações em aberto são encerradas.",
  "reqDelete.delete": "Excluir solicitação",
  "reqDelete.confirmOne":
    "Excluir esta solicitação? Ela sai da lista e as cotações em aberto são encerradas.",
  "reqDelete.ordered":
    "Já virou pedido: não pode ser excluída aqui (o pedido continua).",
  "reqDelete.done": "{n} solicitação(ões) excluída(s).",
  "reqDelete.skipped":
    "{n} não foi(ram) excluída(s): já viraram pedido ou não estavam mais disponíveis.",
  "reqDelete.showDeleted": "Ver excluídas ({n})",
  "reqDelete.backToList": "Voltar às solicitações",
  "reqDelete.deletedTitle":
    "Solicitações excluídas: ficam guardadas para consulta e auditoria.",
  "reqDelete.error.nothing_deleted":
    "Nada foi excluído: as solicitações escolhidas já viraram pedido ou já estavam excluídas.",
};

export const en: Record<keyof typeof pt, string> = {
  "reqDelete.selectAll": "Select all",
  "reqDelete.selectOne": "Select",
  "reqDelete.clear": "Clear selection",
  "reqDelete.selected": "{n} selected",
  "reqDelete.deleteSelected": "Delete selected",
  "reqDelete.confirmMany":
    "Delete {n} request(s)? They leave the list and open quotes are closed.",
  "reqDelete.delete": "Delete request",
  "reqDelete.confirmOne":
    "Delete this request? It leaves the list and open quotes are closed.",
  "reqDelete.ordered":
    "Already became an order: it cannot be deleted here (the order continues).",
  "reqDelete.done": "{n} request(s) deleted.",
  "reqDelete.skipped":
    "{n} not deleted: already became an order or no longer available.",
  "reqDelete.showDeleted": "See deleted ({n})",
  "reqDelete.backToList": "Back to requests",
  "reqDelete.deletedTitle": "Deleted requests: kept for reference and audit.",
  "reqDelete.error.nothing_deleted":
    "Nothing was deleted: the chosen requests already became orders or were already deleted.",
};

export const zh: Record<keyof typeof pt, string> = {
  "reqDelete.selectAll": "全选",
  "reqDelete.selectOne": "选择",
  "reqDelete.clear": "清除选择",
  "reqDelete.selected": "已选 {n} 项",
  "reqDelete.deleteSelected": "删除所选",
  "reqDelete.confirmMany":
    "删除 {n} 个需求？它们将从列表中移除，未完成的报价将被关闭。",
  "reqDelete.delete": "删除需求",
  "reqDelete.confirmOne":
    "删除此需求？它将从列表中移除，未完成的报价将被关闭。",
  "reqDelete.ordered": "已生成订单：不能在此删除（订单继续）。",
  "reqDelete.done": "已删除 {n} 个需求。",
  "reqDelete.skipped": "{n} 个未删除：已生成订单或已不可用。",
  "reqDelete.showDeleted": "查看已删除（{n}）",
  "reqDelete.backToList": "返回需求列表",
  "reqDelete.deletedTitle": "已删除的需求：保留以供查询和审计。",
  "reqDelete.error.nothing_deleted":
    "未删除任何内容：所选需求已生成订单或已被删除。",
};
