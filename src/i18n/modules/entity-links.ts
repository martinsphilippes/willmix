/**
 * Dicionário do módulo "entity-links" (ligações entre book, seleção,
 * produto e pedido, fase 4b; docs/MILESTONES.md): mesmas chaves em pt, en
 * e zh. Book é a planilha do fornecedor; booking só a reserva no navio.
 */
export const pt = {
  "entityLinks.orderTitle": "Origem do pedido",
  "entityLinks.col": "Ligações",
  "entityLinks.book": "Book nº {n}",
  "entityLinks.selection": "Seleção",
  "entityLinks.supplierRequest": "Solicitação nº {n}",
  "entityLinks.label.book": "Book",
  "entityLinks.label.selection": "Seleção",
  "entityLinks.label.supplierRequests": "Solicitações ao fornecedor",
  "entityLinks.label.products": "Produtos",
  "entityLinks.label.orders": "Pedidos",
  "entityLinks.cycle.book": "Book e solicitações ao fornecedor",
  "entityLinks.cycle.empty":
    "Este produto não veio de um book nem de uma solicitação ao fornecedor.",
  "entityLinks.cycle.item": "Item: {name}",
};

export const en: Record<keyof typeof pt, string> = {
  "entityLinks.orderTitle": "Order origin",
  "entityLinks.col": "Links",
  "entityLinks.book": "Book no. {n}",
  "entityLinks.selection": "Selection",
  "entityLinks.supplierRequest": "Request no. {n}",
  "entityLinks.label.book": "Book",
  "entityLinks.label.selection": "Selection",
  "entityLinks.label.supplierRequests": "Supplier requests",
  "entityLinks.label.products": "Products",
  "entityLinks.label.orders": "Orders",
  "entityLinks.cycle.book": "Book and supplier requests",
  "entityLinks.cycle.empty":
    "This product did not come from a book or a supplier request.",
  "entityLinks.cycle.item": "Item: {name}",
};

export const zh: Record<keyof typeof pt, string> = {
  "entityLinks.orderTitle": "订单来源",
  "entityLinks.col": "关联",
  "entityLinks.book": "Book 第 {n} 号",
  "entityLinks.selection": "条目筛选",
  "entityLinks.supplierRequest": "询单第 {n} 号",
  "entityLinks.label.book": "Book",
  "entityLinks.label.selection": "条目筛选",
  "entityLinks.label.supplierRequests": "供应商询单",
  "entityLinks.label.products": "产品",
  "entityLinks.label.orders": "订单",
  "entityLinks.cycle.book": "Book 与供应商询单",
  "entityLinks.cycle.empty": "该产品不是来自 Book 或供应商询单。",
  "entityLinks.cycle.item": "条目：{name}",
};
