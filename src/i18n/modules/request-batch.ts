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
  "reqBatch.error.schema_outdated":
    "O banco ainda não tem a coluna do lote. Publique o esquema Appwrite (GitHub → Publicar esquema Appwrite) e envie de novo, ou envie um produto por vez.",
  "reqBatch.error.mime":
    "Um dos anexos não é foto nem PDF. Troque o arquivo e envie de novo.",
  "reqBatch.error.too_large": "Um dos anexos é grande demais (máx. 50 MB).",
  "reqBatch.error.empty": "Um dos anexos está vazio.",
  "reqBatch.error.attachment_failed":
    "As solicitações foram criadas, mas um anexo não subiu. Abra a solicitação e envie o arquivo de novo.",
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
  "reqBatch.error.schema_outdated":
    "The database does not have the batch column yet. Publish the Appwrite schema (GitHub → Publicar esquema Appwrite) and send again, or send one product at a time.",
  "reqBatch.error.mime":
    "One of the attachments is not a photo or PDF. Replace the file and send again.",
  "reqBatch.error.too_large":
    "One of the attachments is too large (max 50 MB).",
  "reqBatch.error.empty": "One of the attachments is empty.",
  "reqBatch.error.attachment_failed":
    "The requests were created, but an attachment failed to upload. Open the request and send the file again.",
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
  "reqBatch.error.schema_outdated":
    "数据库尚无批次字段。请先发布 Appwrite 架构（GitHub → Publicar esquema Appwrite）后重新提交，或每次只提交一个产品。",
  "reqBatch.error.mime": "有附件不是图片或 PDF，请更换文件后重新提交。",
  "reqBatch.error.too_large": "有附件过大（最大 50 MB）。",
  "reqBatch.error.empty": "有附件为空。",
  "reqBatch.error.attachment_failed":
    "需求已创建，但有附件上传失败。请打开需求并重新上传文件。",
};
