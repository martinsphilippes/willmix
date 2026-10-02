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
};

export const en: Record<keyof typeof pt, string> = {
  "reqProduct.fromCatalog": "Product from the Wellmix catalog",
  "reqProduct.inStock": "In stock at Wellmix",
  "reqProduct.inStockQty": "{qty} {unit} available",
  "reqProduct.inTransit": "{qty} on the way",
  "reqProduct.noStock":
    "No stock available right now: Wellmix will quote with the supplier.",
  "reqProduct.change": "Not this product? Mark as not in the catalog",
};

export const zh: Record<keyof typeof pt, string> = {
  "reqProduct.fromCatalog": "Wellmix 目录中的产品",
  "reqProduct.inStock": "Wellmix 有库存",
  "reqProduct.inStockQty": "可用 {qty} {unit}",
  "reqProduct.inTransit": "{qty} 在途",
  "reqProduct.noStock": "目前无可用库存：Wellmix 将向供应商询价。",
  "reqProduct.change": "不是这个产品？标记为不在目录中",
};
