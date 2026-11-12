/**
 * Dicionário do módulo "party-picker" (campo de cliente/fornecedor com busca,
 * em src/components/party-picker.tsx): mesmas chaves em pt, en e zh.
 */
export const pt = {
  "partyPicker.placeholder": "Digite para buscar",
  "partyPicker.typeMore": "Digite ao menos 2 letras do nome.",
  "partyPicker.none": "Nenhum encontrado.",
  "partyPicker.loading": "Buscando…",
  "partyPicker.pick": "Escolha um nome da lista.",
  "partyPicker.clear": "Limpar",
};

export const en: Record<keyof typeof pt, string> = {
  "partyPicker.placeholder": "Type to search",
  "partyPicker.typeMore": "Type at least 2 letters of the name.",
  "partyPicker.none": "None found.",
  "partyPicker.loading": "Searching…",
  "partyPicker.pick": "Choose a name from the list.",
  "partyPicker.clear": "Clear",
};

export const zh: Record<keyof typeof pt, string> = {
  "partyPicker.placeholder": "输入以搜索",
  "partyPicker.typeMore": "请至少输入名称的 2 个字。",
  "partyPicker.none": "未找到。",
  "partyPicker.loading": "搜索中…",
  "partyPicker.pick": "请从列表中选择一个名称。",
  "partyPicker.clear": "清除",
};
