/**
 * Buscador único dos formulários com lista na tela (dono, 21/11/2026;
 * docs/ORDER_TERMS.md seção 11.23): primeiro no RCA do cliente. Os textos do
 * "País - Porto" saíram com ele (desfeito a pedido do dono no mesmo dia).
 */
export const pt = {
  "listPicker.placeholder": "Digite para buscar ou escolha na lista",
  "listPicker.typeMore": "Digite para buscar",
  "listPicker.none": "Nada encontrado",
  "listPicker.loading": "Buscando…",
  "listPicker.pick": "Escolha uma opção da lista.",
  "listPicker.clear": "Limpar",
};

export const en: Record<keyof typeof pt, string> = {
  "listPicker.placeholder": "Type to search or pick from the list",
  "listPicker.typeMore": "Type to search",
  "listPicker.none": "Nothing found",
  "listPicker.loading": "Searching…",
  "listPicker.pick": "Pick an option from the list.",
  "listPicker.clear": "Clear",
};

export const zh: Record<keyof typeof pt, string> = {
  "listPicker.placeholder": "输入搜索或从列表中选择",
  "listPicker.typeMore": "输入以搜索",
  "listPicker.none": "未找到",
  "listPicker.loading": "搜索中…",
  "listPicker.pick": "请从列表中选择一项。",
  "listPicker.clear": "清除",
};
