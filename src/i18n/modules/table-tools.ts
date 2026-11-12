/**
 * Dicionário do módulo "table-tools" (busca, ordenação e paginação de todas
 * as tabelas, em src/components/table-tools.tsx): mesmas chaves em pt, en e zh.
 */
export const pt = {
  "tableTools.search": "Buscar na tabela",
  "tableTools.perPage": "Linhas por página",
  "tableTools.range": "{from}–{to} de {total}",
  "tableTools.none": "Nenhuma linha encontrada.",
  "tableTools.prev": "Página anterior",
  "tableTools.next": "Próxima página",
  "tableTools.sortHint": "Clique para ordenar",
};

export const en: Record<keyof typeof pt, string> = {
  "tableTools.search": "Search table",
  "tableTools.perPage": "Rows per page",
  "tableTools.range": "{from}–{to} of {total}",
  "tableTools.none": "No rows found.",
  "tableTools.prev": "Previous page",
  "tableTools.next": "Next page",
  "tableTools.sortHint": "Click to sort",
};

export const zh: Record<keyof typeof pt, string> = {
  "tableTools.search": "搜索表格",
  "tableTools.perPage": "每页行数",
  "tableTools.range": "第 {from}–{to} 行，共 {total} 行",
  "tableTools.none": "没有找到匹配的行。",
  "tableTools.prev": "上一页",
  "tableTools.next": "下一页",
  "tableTools.sortHint": "点击排序",
};
