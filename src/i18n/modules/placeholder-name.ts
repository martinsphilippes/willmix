/*
 * Nome de exemplo ("XPTO", "Produto novo XPTO") tratado como nome ausente
 * (docs/PURCHASE_ORDER.md, "Nome de exemplo"; regras em
 * src/lib/placeholder-name.ts).
 */
const PT_ERROR =
  '"XPTO" é texto de exemplo, não nome de produto. Informe o nome real do produto.';
const EN_ERROR =
  '"XPTO" is sample text, not a product name. Enter the real product name.';
const ZH_ERROR = "“XPTO”是示例文字，不是产品名称。请填写真实的产品名称。";

export const pt = {
  "productName.unnamed": "Produto sem nome",
  "productName.unnamedHint":
    "Este produto ainda não tem nome. Preencha o nome no cadastro do produto; ele passa a aparecer nos pedidos e nas tarefas.",
  "productName.error.product_name_placeholder": PT_ERROR,
  "sheet.error.product_name_placeholder": PT_ERROR,
  "supplierRequests.error.product_name_placeholder": PT_ERROR,
};

export const en: typeof pt = {
  "productName.unnamed": "Unnamed product",
  "productName.unnamedHint":
    "This product has no name yet. Fill in the name on the product record; it will then show on orders and tasks.",
  "productName.error.product_name_placeholder": EN_ERROR,
  "sheet.error.product_name_placeholder": EN_ERROR,
  "supplierRequests.error.product_name_placeholder": EN_ERROR,
};

export const zh: typeof pt = {
  "productName.unnamed": "未命名产品",
  "productName.unnamedHint":
    "此产品尚未命名。请在产品资料中填写名称；之后会显示在订单和任务中。",
  "productName.error.product_name_placeholder": ZH_ERROR,
  "sheet.error.product_name_placeholder": ZH_ERROR,
  "supplierRequests.error.product_name_placeholder": ZH_ERROR,
};
