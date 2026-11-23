/**
 * Menu do fornecedor (dono, 23/11/2026; docs/SUPPLIER_REQUESTS.md, seção
 * "Solicitações do cliente"): "Books" como primeira opção de "Meus books" e
 * os convites de book junto com as solicitações ao fornecedor, numa tela e
 * numa tabela só ("Solicitações do cliente"). Mesmas chaves em pt, en e zh.
 */
export const pt = {
  "nav.partnerBooks": "Books",
  "nav.customerRequests": "Solicitações do cliente",
  "partnerBooks.title": "Books",
  "customerRequests.title": "Solicitações do cliente",
  "customerRequests.subtitle":
    "Tudo o que a Wellmix pediu a você numa tabela só: os convites para enviar um book e as solicitações sobre os itens dos seus books.",
  "customerRequests.col.kind": "Tipo",
  "customerRequests.kind.invite": "Convite de book",
  "customerRequests.kind.request": "Solicitação",
  "customerRequests.due": "Prazo {date}",
  "customerRequests.count":
    "{n} solicitação(ões), {products} produto(s) distinto(s)",
};

export const en: Record<keyof typeof pt, string> = {
  "nav.partnerBooks": "Books",
  "nav.customerRequests": "Customer requests",
  "partnerBooks.title": "Books",
  "customerRequests.title": "Customer requests",
  "customerRequests.subtitle":
    "Everything Wellmix asked of you in one table: invitations to send a book and the requests about the items in your books.",
  "customerRequests.col.kind": "Type",
  "customerRequests.kind.invite": "Book invitation",
  "customerRequests.kind.request": "Request",
  "customerRequests.due": "Due {date}",
  "customerRequests.count": "{n} request(s), {products} distinct product(s)",
};

export const zh: Record<keyof typeof pt, string> = {
  "nav.partnerBooks": "Books",
  "nav.customerRequests": "客户请求",
  "partnerBooks.title": "Books",
  "customerRequests.title": "客户请求",
  "customerRequests.subtitle":
    "Wellmix 向您提出的所有请求都在一张表中：提交 Book 的邀请，以及关于您 Book 中商品的询单。",
  "customerRequests.col.kind": "类型",
  "customerRequests.kind.invite": "Book 邀请",
  "customerRequests.kind.request": "询单",
  "customerRequests.due": "截止 {date}",
  "customerRequests.count": "{n} 个请求，{products} 个不同产品",
};
