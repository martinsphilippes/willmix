/**
 * Menu do fornecedor (dono, 23/11/2026; docs/SUPPLIER_REQUESTS.md, seção
 * "Solicitações do cliente"): "Books" como primeira opção de "Meus books" e
 * os convites de book junto com as solicitações ao fornecedor, numa tela e
 * numa tabela só ("Solicitações do cliente"). Mesmas chaves em pt, en e zh.
 */
export const pt = {
  "nav.partnerBooks": "Books",
  "nav.customerRequests": "Consultas",
  "partnerBooks.title": "Books",
  "customerRequests.title": "Consultas",
  "customerRequests.subtitle":
    "Tudo o que a Wellmix pediu a você numa tabela só: os convites para enviar um book, as solicitações sobre os itens dos seus books e as cotações de compra.",
  "customerRequests.col.kind": "Tipo",
  "customerRequests.kind.invite": "Convite de book",
  "customerRequests.kind.request": "Solicitação",
  "customerRequests.due": "Prazo {date}",
  "customerRequests.count": "{n} consulta(s), {products} produto(s)",
};

export const en: Record<keyof typeof pt, string> = {
  "nav.partnerBooks": "Books",
  "nav.customerRequests": "Inquiries",
  "partnerBooks.title": "Books",
  "customerRequests.title": "Inquiries",
  "customerRequests.subtitle":
    "Everything Wellmix asked of you in one table: invitations to send a book, the requests about the items in your books and the purchase quotes.",
  "customerRequests.col.kind": "Type",
  "customerRequests.kind.invite": "Book invitation",
  "customerRequests.kind.request": "Request",
  "customerRequests.due": "Due {date}",
  "customerRequests.count": "{n} inquiry(ies), {products} product(s)",
};

export const zh: Record<keyof typeof pt, string> = {
  "nav.partnerBooks": "Books",
  "nav.customerRequests": "询盘",
  "partnerBooks.title": "Books",
  "customerRequests.title": "询盘",
  "customerRequests.subtitle":
    "Wellmix 向您提出的所有请求都在一张表中：提交 Book 的邀请、关于您 Book 中商品的询单以及采购询价。",
  "customerRequests.col.kind": "类型",
  "customerRequests.kind.invite": "Book 邀请",
  "customerRequests.kind.request": "询单",
  "customerRequests.due": "截止 {date}",
  "customerRequests.count": "{n} 个询盘，{products} 个产品",
};
