/**
 * Dicionário do módulo "request-add" (Wellmix acrescenta produtos a uma
 * solicitação que ainda não virou pedido): mesmas chaves em pt, en e zh.
 */
export const pt = {
  "reqAdd.button": "Adicionar produto",
  "reqAdd.title": "Adicionar produtos à solicitação",
  "reqAdd.titleNumbered": "Adicionar produtos à solicitação nº {n}",
  "reqAdd.intro":
    "Os produtos entram nesta solicitação de {customer}, com o mesmo número. Cada um recebe a sua cotação e vira o seu pedido quando o sinal for confirmado.",
  "reqAdd.back": "Voltar para a solicitação",
  "reqAdd.submit": "Adicionar à solicitação",
  "reqAdd.done":
    "{n} produto(s) adicionado(s). Abra a cotação deles para os fornecedores abaixo.",
};

export const en: Record<keyof typeof pt, string> = {
  "reqAdd.button": "Add product",
  "reqAdd.title": "Add products to the request",
  "reqAdd.titleNumbered": "Add products to request no. {n}",
  "reqAdd.intro":
    "The products join this request from {customer}, with the same number. Each one gets its own quotation and becomes its own order once the down payment is confirmed.",
  "reqAdd.back": "Back to the request",
  "reqAdd.submit": "Add to request",
  "reqAdd.done":
    "{n} product(s) added. Open their quotation to suppliers below.",
};

export const zh: Record<keyof typeof pt, string> = {
  "reqAdd.button": "添加产品",
  "reqAdd.title": "向需求添加产品",
  "reqAdd.titleNumbered": "向第 {n} 号需求添加产品",
  "reqAdd.intro":
    "产品将加入 {customer} 的此需求，编号相同。每个产品单独报价，确认定金后各自生成订单。",
  "reqAdd.back": "返回需求",
  "reqAdd.submit": "添加到需求",
  "reqAdd.done": "已添加 {n} 个产品。请在下方向供应商发起报价。",
};
