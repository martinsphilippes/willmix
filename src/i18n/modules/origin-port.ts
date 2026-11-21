/**
 * Buscador único dos formulários e "País - Porto" na Nova solicitação
 * (dono, 21/11/2026; docs/ORDER_TERMS.md seção 11.23).
 */
export const pt = {
  "listPicker.placeholder": "Digite para buscar ou escolha na lista",
  "listPicker.typeMore": "Digite para buscar",
  "listPicker.none": "Nada encontrado",
  "listPicker.loading": "Buscando…",
  "listPicker.pick": "Escolha uma opção da lista.",
  "listPicker.clear": "Limpar",
  "originPort.field": "País - Porto (de origem)",
  "originPort.choose": "Escolha o país e o porto",
  "originPort.noPort": "Porto não informado",
  "originPort.option": "{country} - {port}",
  "originPort.count": "{n} produtos",
  "originPort.hint":
    'Porto de embarque do produto pelo fornecedor (Sankhya: produto × fornecedor e o porto preferencial do produto). Um pedido fica num só país, porto e família. Produto sem porto no Sankhya fica em "Porto não informado".',
  "orderTerms.groupPickPort": "Escolha o país e o porto primeiro",
};

export const en: Record<keyof typeof pt, string> = {
  "listPicker.placeholder": "Type to search or pick from the list",
  "listPicker.typeMore": "Type to search",
  "listPicker.none": "Nothing found",
  "listPicker.loading": "Searching…",
  "listPicker.pick": "Pick an option from the list.",
  "listPicker.clear": "Clear",
  "originPort.field": "Country - Port (of origin)",
  "originPort.choose": "Choose the country and port",
  "originPort.noPort": "Port not informed",
  "originPort.option": "{country} - {port}",
  "originPort.count": "{n} products",
  "originPort.hint":
    'Loading port of the product by supplier (Sankhya: product × supplier and the product\'s preferred port). An order stays in a single country, port and family. Products without a port in Sankhya are under "Port not informed".',
  "orderTerms.groupPickPort": "Choose the country and port first",
};

export const zh: Record<keyof typeof pt, string> = {
  "listPicker.placeholder": "输入搜索或从列表中选择",
  "listPicker.typeMore": "输入以搜索",
  "listPicker.none": "未找到",
  "listPicker.loading": "搜索中…",
  "listPicker.pick": "请从列表中选择一项。",
  "listPicker.clear": "清除",
  "originPort.field": "国家 - 港口（原产地）",
  "originPort.choose": "选择国家和港口",
  "originPort.noPort": "未填写港口",
  "originPort.option": "{country} - {port}",
  "originPort.count": "{n} 个产品",
  "originPort.hint":
    "按供应商的产品装运港（Sankhya：产品 × 供应商及产品首选港口）。一个订单只能有一个国家、港口和产品系列。Sankhya 中没有港口的产品归入“未填写港口”。",
  "orderTerms.groupPickPort": "请先选择国家和港口",
};
