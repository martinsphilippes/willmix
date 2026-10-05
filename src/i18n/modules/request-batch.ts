/**
 * Dicionário do módulo "request-batch" (vários produtos numa solicitação só;
 * cada produto vira uma solicitação do mesmo lote): mesmas chaves em pt, en e zh.
 */
export const pt = {
  "reqBatch.products": "Produtos",
  "reqBatch.productN": "Produto {n}",
  "reqBatch.add": "Adicionar outro produto",
  "reqBatch.remove": "Remover",
  "reqBatch.hint":
    "Pode pedir vários produtos de uma vez. Cada produto vira uma solicitação própria (fornecedor, preço e ficha podem ser diferentes), e todas nascem juntas, num lote.",
  "reqBatch.created": "{n} solicitações criadas num lote.",
  "reqBatch.badge": "Lote · {n} produtos",
  "reqBatch.filter": "Mostrando só o lote ({n} produtos).",
  "reqBatch.all": "Ver todas",
  "reqBatch.siblings": "Faz parte de um lote com {n} produtos. Os outros:",
  "reqBatch.error.no_products": "Informe ao menos um produto.",
  "reqBatch.error.invalid_input":
    "Confira os produtos: nome, descrição e quantidade são obrigatórios.",
  "reqBatch.error.too_many_products":
    "São no máximo 30 produtos por solicitação. Envie o restante em outra.",
};

export const en: Record<keyof typeof pt, string> = {
  "reqBatch.products": "Products",
  "reqBatch.productN": "Product {n}",
  "reqBatch.add": "Add another product",
  "reqBatch.remove": "Remove",
  "reqBatch.hint":
    "You can request several products at once. Each product becomes its own request (supplier, price and sheet may differ), and they are created together as a batch.",
  "reqBatch.created": "{n} requests created as a batch.",
  "reqBatch.badge": "Batch · {n} products",
  "reqBatch.filter": "Showing only this batch ({n} products).",
  "reqBatch.all": "Show all",
  "reqBatch.siblings": "Part of a batch with {n} products. The others:",
  "reqBatch.error.no_products": "Enter at least one product.",
  "reqBatch.error.invalid_input":
    "Check the products: name, description and quantity are required.",
  "reqBatch.error.too_many_products":
    "At most 30 products per request. Send the rest in another one.",
};

export const zh: Record<keyof typeof pt, string> = {
  "reqBatch.products": "产品",
  "reqBatch.productN": "产品 {n}",
  "reqBatch.add": "添加另一个产品",
  "reqBatch.remove": "移除",
  "reqBatch.hint":
    "可以一次申请多个产品。每个产品会成为独立的需求（供应商、价格和采购单可以不同），并作为同一批次一起创建。",
  "reqBatch.created": "已创建 {n} 个需求（同一批次）。",
  "reqBatch.badge": "批次 · {n} 个产品",
  "reqBatch.filter": "仅显示该批次（{n} 个产品）。",
  "reqBatch.all": "查看全部",
  "reqBatch.siblings": "属于一个包含 {n} 个产品的批次。其他产品：",
  "reqBatch.error.no_products": "请至少填写一个产品。",
  "reqBatch.error.invalid_input": "请检查产品：名称、描述和数量为必填项。",
  "reqBatch.error.too_many_products":
    "每次需求最多 30 个产品，其余请另行提交。",
};
