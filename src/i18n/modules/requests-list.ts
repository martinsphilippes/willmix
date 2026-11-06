/**
 * Dicionário do módulo "requests-list" (tela Solicitações da Wellmix:
 * filtros por situação, busca, valores, sinal, pedido gerado e CSV):
 * mesmas chaves em pt, en e zh.
 */
export const pt = {
  "reqList.situ.all": "Todas",
  "reqList.situ.open": "Em aberto",
  "reqList.situ.waiting": "Aguardando sinal",
  "reqList.situ.ordered": "Viraram pedido",
  "reqList.situ.late": "Prazo vencido",
  "reqList.search": "Buscar por nº, produto, descrição ou cliente",
  "reqList.searchButton": "Buscar",
  "reqList.export": "Exportar (CSV)",
  "reqList.col.date": "Data",
  "reqList.col.owner": "Analista",
  "reqList.col.sell": "Valor ao cliente",
  "reqList.col.down": "Sinal",
  "reqList.col.order": "Pedido",
  "reqList.down.paid": "Pago",
  "reqList.down.partial": "Parcial",
  "reqList.down.pending": "Pendente",
  "reqList.down.received": "recebido {amount}",
  "reqList.orders": "{n} pedido(s)",
  "reqList.empty": "Nenhuma solicitação nesta busca ou filtro.",
  "reqList.csv.header":
    "Nº;Data;Produto;Cliente;Analista;Quantidade;Unidade;Situação;Prazo de resposta;Valor ao cliente;Moeda;Sinal;Sinal recebido;Pedido",
};

export const en: Record<keyof typeof pt, string> = {
  "reqList.situ.all": "All",
  "reqList.situ.open": "Open",
  "reqList.situ.waiting": "Waiting for down payment",
  "reqList.situ.ordered": "Became orders",
  "reqList.situ.late": "Past deadline",
  "reqList.search": "Search by no., product, description or customer",
  "reqList.searchButton": "Search",
  "reqList.export": "Export (CSV)",
  "reqList.col.date": "Date",
  "reqList.col.owner": "Analyst",
  "reqList.col.sell": "Customer value",
  "reqList.col.down": "Down payment",
  "reqList.col.order": "Order",
  "reqList.down.paid": "Paid",
  "reqList.down.partial": "Partial",
  "reqList.down.pending": "Pending",
  "reqList.down.received": "received {amount}",
  "reqList.orders": "{n} order(s)",
  "reqList.empty": "No request in this search or filter.",
  "reqList.csv.header":
    "No.;Date;Product;Customer;Analyst;Quantity;Unit;Status;Response deadline;Customer value;Currency;Down payment;Down payment received;Order",
};

export const zh: Record<keyof typeof pt, string> = {
  "reqList.situ.all": "全部",
  "reqList.situ.open": "未完成",
  "reqList.situ.waiting": "待付定金",
  "reqList.situ.ordered": "已转订单",
  "reqList.situ.late": "已超期",
  "reqList.search": "按编号、产品、描述或客户搜索",
  "reqList.searchButton": "搜索",
  "reqList.export": "导出 (CSV)",
  "reqList.col.date": "日期",
  "reqList.col.owner": "分析师",
  "reqList.col.sell": "客户金额",
  "reqList.col.down": "定金",
  "reqList.col.order": "订单",
  "reqList.down.paid": "已付",
  "reqList.down.partial": "部分",
  "reqList.down.pending": "待付",
  "reqList.down.received": "已收 {amount}",
  "reqList.orders": "{n} 个订单",
  "reqList.empty": "该搜索或筛选下没有询价。",
  "reqList.csv.header":
    "编号;日期;产品;客户;分析师;数量;单位;状态;回复期限;客户金额;币种;定金;已收定金;订单",
};
