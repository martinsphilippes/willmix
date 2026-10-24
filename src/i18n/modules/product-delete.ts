/**
 * Dicionário do módulo "product-delete" (excluir/restaurar vários produtos na
 * lista do cadastro): mesmas chaves em pt, en e zh.
 */
export const pt = {
  "productDelete.purgeSelected": "Excluir definitivamente",
  "productDelete.confirmPurge":
    "Excluir definitivamente {n} produto(s)? Some o cadastro, as variações, a ficha mestre e as fotos, sem volta. Produto que já esteve em solicitação, pedido, estoque ou embalagem não é apagado (fica nos excluídos).",
  "productDelete.purged": "{n} produto(s) excluído(s) definitivamente.",
  "productDelete.blocked":
    "{n} produto(s) não puderam ser apagados de vez porque já estiveram em solicitação, pedido, estoque ou embalagem: continuam nos excluídos.",
  "productDelete.error.nothing_purged": "Nenhum produto foi apagado.",
  "productDelete.error.purge_blocked":
    "Nenhum dos selecionados pode ser apagado de vez: todos já estiveram em solicitação, pedido, estoque ou embalagem.",
  "productDelete.selectAll": "Selecionar todos",
  "productDelete.selectOne": "Selecionar",
  "productDelete.clear": "Limpar seleção",
  "productDelete.selected": "{n} selecionado(s)",
  "productDelete.deleteSelected": "Excluir selecionados",
  "productDelete.confirmMany":
    'Excluir {n} produto(s)? Eles saem do cadastro, da vitrine e da nova solicitação; pedidos e histórico continuam. Dá para restaurar em "Ver excluídos".',
  "productDelete.restoreSelected": "Restaurar selecionados",
  "productDelete.confirmRestore": "Restaurar {n} produto(s)?",
  "productDelete.done": "{n} produto(s) excluído(s).",
  "productDelete.restored": "{n} produto(s) restaurado(s).",
  "productDelete.showDeleted": "Ver excluídos ({n})",
  "productDelete.showActive": "Voltar aos produtos ativos",
  "productDelete.deletedTitle": "Produtos excluídos",
  "productDelete.error.nothing_deleted": "Nenhum produto foi excluído.",
  "productDelete.error.nothing_restored": "Nenhum produto foi restaurado.",
};

export const en = {
  "productDelete.purgeSelected": "Delete permanently",
  "productDelete.confirmPurge":
    "Permanently delete {n} product(s)? The product, its variations, master sheet and photos are removed for good. A product already used in a request, order, stock or packaging is not removed (it stays under deleted).",
  "productDelete.purged": "{n} product(s) permanently deleted.",
  "productDelete.blocked":
    "{n} product(s) could not be removed for good because they were used in a request, order, stock or packaging: they stay under deleted.",
  "productDelete.error.nothing_purged": "No product was removed.",
  "productDelete.error.purge_blocked":
    "None of the selected products can be removed for good: all were used in a request, order, stock or packaging.",
  "productDelete.selectAll": "Select all",
  "productDelete.selectOne": "Select",
  "productDelete.clear": "Clear selection",
  "productDelete.selected": "{n} selected",
  "productDelete.deleteSelected": "Delete selected",
  "productDelete.confirmMany":
    'Delete {n} product(s)? They leave the catalog, the storefront and new requests; orders and history stay. You can restore them under "Show deleted".',
  "productDelete.restoreSelected": "Restore selected",
  "productDelete.confirmRestore": "Restore {n} product(s)?",
  "productDelete.done": "{n} product(s) deleted.",
  "productDelete.restored": "{n} product(s) restored.",
  "productDelete.showDeleted": "Show deleted ({n})",
  "productDelete.showActive": "Back to active products",
  "productDelete.deletedTitle": "Deleted products",
  "productDelete.error.nothing_deleted": "No product was deleted.",
  "productDelete.error.nothing_restored": "No product was restored.",
};

export const zh = {
  "productDelete.purgeSelected": "永久删除",
  "productDelete.confirmPurge":
    "永久删除 {n} 个产品？产品、规格、主表和照片将被彻底删除，无法恢复。已用于询价、订单、库存或包装的产品不会被删除（仍在已删除列表中）。",
  "productDelete.purged": "已永久删除 {n} 个产品。",
  "productDelete.blocked":
    "{n} 个产品已用于询价、订单、库存或包装，无法永久删除，仍在已删除列表中。",
  "productDelete.error.nothing_purged": "没有删除任何产品。",
  "productDelete.error.purge_blocked":
    "所选产品均已用于询价、订单、库存或包装，无法永久删除。",
  "productDelete.selectAll": "全选",
  "productDelete.selectOne": "选择",
  "productDelete.clear": "清除选择",
  "productDelete.selected": "已选 {n} 个",
  "productDelete.deleteSelected": "删除所选",
  "productDelete.confirmMany":
    "删除 {n} 个产品？它们将从产品目录、展示页和新询价中移除；订单和历史记录保留。可在“查看已删除”中恢复。",
  "productDelete.restoreSelected": "恢复所选",
  "productDelete.confirmRestore": "恢复 {n} 个产品？",
  "productDelete.done": "已删除 {n} 个产品。",
  "productDelete.restored": "已恢复 {n} 个产品。",
  "productDelete.showDeleted": "查看已删除（{n}）",
  "productDelete.showActive": "返回有效产品",
  "productDelete.deletedTitle": "已删除的产品",
  "productDelete.error.nothing_deleted": "没有删除任何产品。",
  "productDelete.error.nothing_restored": "没有恢复任何产品。",
};
