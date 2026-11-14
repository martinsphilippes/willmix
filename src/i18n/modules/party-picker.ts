/**
 * Dicionário do módulo "party-picker" (campos com busca: cliente/fornecedor
 * em src/components/party-picker.tsx e produto em
 * src/components/product-picker.tsx): mesmas chaves em pt, en e zh.
 */
export const pt = {
  "partyPicker.placeholder": "Digite para buscar",
  "partyPicker.typeMore": "Digite ao menos 2 letras do nome.",
  "partyPicker.none": "Nenhum encontrado.",
  "partyPicker.loading": "Buscando…",
  "partyPicker.pick": "Escolha um nome da lista.",
  "partyPicker.clear": "Limpar",
  "productPicker.placeholder": "Digite o nome ou o código",
  "productPicker.typeMore": "Digite ao menos 2 letras do nome ou do código.",
  "productPicker.none": "Nenhum produto encontrado.",
  "productPicker.pick": "Escolha um produto da lista.",
  "productPicker.fillLoading": "Carregando a ficha do produto…",
  "productPicker.fillError":
    "Não foi possível carregar a ficha do produto. Escolha o produto de novo.",
};

export const en: Record<keyof typeof pt, string> = {
  "partyPicker.placeholder": "Type to search",
  "partyPicker.typeMore": "Type at least 2 letters of the name.",
  "partyPicker.none": "None found.",
  "partyPicker.loading": "Searching…",
  "partyPicker.pick": "Choose a name from the list.",
  "partyPicker.clear": "Clear",
  "productPicker.placeholder": "Type the name or code",
  "productPicker.typeMore": "Type at least 2 letters of the name or code.",
  "productPicker.none": "No product found.",
  "productPicker.pick": "Choose a product from the list.",
  "productPicker.fillLoading": "Loading the product sheet…",
  "productPicker.fillError":
    "Could not load the product sheet. Choose the product again.",
};

export const zh: Record<keyof typeof pt, string> = {
  "partyPicker.placeholder": "输入以搜索",
  "partyPicker.typeMore": "请至少输入名称的 2 个字。",
  "partyPicker.none": "未找到。",
  "partyPicker.loading": "搜索中…",
  "partyPicker.pick": "请从列表中选择一个名称。",
  "partyPicker.clear": "清除",
  "productPicker.placeholder": "输入名称或编码",
  "productPicker.typeMore": "请至少输入名称或编码的 2 个字。",
  "productPicker.none": "未找到产品。",
  "productPicker.pick": "请从列表中选择一个产品。",
  "productPicker.fillLoading": "正在加载产品资料…",
  "productPicker.fillError": "无法加载产品资料，请重新选择产品。",
};
