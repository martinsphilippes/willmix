/**
 * Dicionário do módulo "request-product" (produto escolhido na nova
 * solicitação: catálogo e estoque da Wellmix): mesmas chaves em pt, en e zh.
 */
export const pt = {
  "reqProduct.fromCatalog": "Produto do catálogo Wellmix",
  "reqProduct.inStock": "Em estoque na Wellmix",
  "reqProduct.inStockQty": "{qty} {unit} disponíveis",
  "reqProduct.inTransit": "{qty} a caminho",
  "reqProduct.noStock":
    "Sem estoque disponível no momento: a Wellmix cota com o fornecedor.",
  "reqProduct.change": "Não é este produto? Marcar como fora do catálogo",
  "reqProduct.moq": "Pedido mínimo: {n} {unit}",
  "reqProduct.belowMoq": "Abaixo do pedido mínimo ({n} {unit}). Ao sair do campo, a quantidade sobe para o mínimo.",
  "reqProduct.variant": "Variação",
  "reqProduct.variantChoose": "Escolha a variação",
  "reqProduct.variantHint":
    "Este produto tem variações: a especificação, o pedido mínimo e a foto são os da variação escolhida.",
  "reqProduct.variantPhoto": "Foto da variação",
};

export const en: Record<keyof typeof pt, string> = {
  "reqProduct.fromCatalog": "Product from the Wellmix catalog",
  "reqProduct.inStock": "In stock at Wellmix",
  "reqProduct.inStockQty": "{qty} {unit} available",
  "reqProduct.inTransit": "{qty} on the way",
  "reqProduct.noStock":
    "No stock available right now: Wellmix will quote with the supplier.",
  "reqProduct.change": "Not this product? Mark as not in the catalog",
  "reqProduct.moq": "Minimum order: {n} {unit}",
  "reqProduct.belowMoq": "Below the minimum order ({n} {unit}). When you leave the field, the quantity goes up to the minimum.",
  "reqProduct.variant": "Variation",
  "reqProduct.variantChoose": "Choose the variation",
  "reqProduct.variantHint":
    "This product has variations: the specification, minimum order and photo are those of the chosen variation.",
  "reqProduct.variantPhoto": "Variation photo",
};

export const zh: Record<keyof typeof pt, string> = {
  "reqProduct.fromCatalog": "Wellmix 目录中的产品",
  "reqProduct.inStock": "Wellmix 有库存",
  "reqProduct.inStockQty": "可用 {qty} {unit}",
  "reqProduct.inTransit": "{qty} 在途",
  "reqProduct.noStock": "目前无可用库存：Wellmix 将向供应商询价。",
  "reqProduct.change": "不是这个产品？标记为不在目录中",
  "reqProduct.moq": "起订量：{n} {unit}",
  "reqProduct.belowMoq": "低于起订量（{n} {unit}）。离开输入框后数量将提升至起订量。",
  "reqProduct.variant": "款式",
  "reqProduct.variantChoose": "请选择款式",
  "reqProduct.variantHint":
    "该产品有多个款式：规格、起订量和照片均以所选款式为准。",
  "reqProduct.variantPhoto": "款式照片",
};
