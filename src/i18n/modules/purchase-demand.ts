/**
 * Compra por demanda (mapa B10, B14, B10? e B13; dono, 15/11/2026;
 * docs/PURCHASE_DEMAND.md): encomendas do cliente, reposição do Planner,
 * função Vendas e as ações novas. Mesmas chaves em pt, en e zh.
 */
export const pt = {
  "nav.demands": "Encomendas",
  "orders.origin.cart": "Vitrine",
  "demand.kind.all": "Todas",
  "demand.kind.order": "Encomendas",
  "demand.kind.replenishment": "Reposições",
  "demand.kind.order.one": "Encomenda",
  "demand.kind.replenishment.one": "Reposição",
  "demand.filter.kind": "Tipo de demanda",
  "demand.channel.vitrine": "Vitrine",
  "demand.channel.cliente": "Cliente",
  "demand.channel.vendedor": "Vendedor",
  "demand.channel.operador": "Operador",
  "demand.number": "Nº",
  "demand.source": "Origem",
  "demand.source.afterSales": "Pós-venda",
  "demand.source.planner": "Planner",
  "demand.status": "Situação",
  "demand.status.waitingStrategy": "Esperando a estratégia de compra",
  "demand.status.ordered": "Pedido de compra gerado",
  "demand.desiredAt": "Data desejada",
  "demand.notes": "Observação",
  "demand.replenishment.title": "Reposição",
  "demand.replenishment.subtitle":
    "Produtos ativos que precisam repor: abertos pelo Planner ou vindos do pós-venda. Cada reposição segue para a estratégia de compra.",
  "demand.replenishment.manualOnly":
    "A reposição automática pelo estoque está desligada: o estoque ainda não é controlado no portal. Abra a reposição à mão.",
  "demand.replenishment.new": "Abrir reposição",
  "demand.replenishment.submit": "Abrir reposição",
  "demand.replenishment.opened":
    "Reposição aberta. Ela entrou na fila da estratégia de compra.",
  "demand.replenishment.queue": "Fila ({n} em aberto)",
  "demand.replenishment.empty": "Nenhuma reposição aberta.",
  "demand.error.forbidden": "Seu acesso não permite abrir reposição.",
  "demand.error.product_unavailable": "Produto inativo ou inexistente.",
  "demand.error.invalid_quantity": "Informe uma quantidade maior que zero.",
  "demand.error.invalid_input": "Confira o produto, a quantidade e a data.",
  "demand.error.below_moq": "Quantidade abaixo do pedido mínimo do produto.",
  "demand.cart.ready": "Pronta entrega",
  "demand.cart.order": "Encomenda",
  "demand.cart.readyCount":
    "{n} item(ns) de pronta entrega: vão para a ordem de venda, e Vendas confirma o preço.",
  "demand.cart.orderCount":
    "{n} item(ns) sob encomenda: a Wellmix compra para você e acompanha na tela Encomendas.",
  "demand.cart.saleSent":
    "Os itens de pronta entrega viraram a ordem de venda nº {n}; Vendas vai confirmar o preço e a entrega.",
  "function.sales": "Vendas",
  "function.desc.sales":
    "registra e qualifica as encomendas do cliente (inclusive em nome dele), faz ofertas e amostras, vende e cuida das ordens de venda, das reservas e do pós-venda",
  "action.demand.createForCustomer": "Lançar encomenda em nome do cliente",
  "action.desc.demand.createForCustomer":
    "Cria a encomenda (Nova solicitação) para um cliente; o vendedor e o operador escolhem o cliente.",
  "action.replenishment.open": "Abrir reposição",
  "action.desc.replenishment.open":
    "Abre a reposição de um produto ativo (produto, quantidade e data desejada) na tela Reposição.",
  "settings.label.autoReplenishmentByStock":
    "Reposição automática pelo estoque",
  "settings.hint.autoReplenishmentByStock":
    "Desligada e sem efeito: o estoque ainda não é controlado no portal (dono, 15/11/2026).",
} as const;

export const en: Record<keyof typeof pt, string> = {
  "nav.demands": "Customer orders",
  "orders.origin.cart": "Storefront",
  "demand.kind.all": "All",
  "demand.kind.order": "Customer orders",
  "demand.kind.replenishment": "Replenishments",
  "demand.kind.order.one": "Customer order",
  "demand.kind.replenishment.one": "Replenishment",
  "demand.filter.kind": "Demand type",
  "demand.channel.vitrine": "Storefront",
  "demand.channel.cliente": "Customer",
  "demand.channel.vendedor": "Salesperson",
  "demand.channel.operador": "Operator",
  "demand.number": "No.",
  "demand.source": "Source",
  "demand.source.afterSales": "After-sales",
  "demand.source.planner": "Planner",
  "demand.status": "Status",
  "demand.status.waitingStrategy": "Waiting for the purchase strategy",
  "demand.status.ordered": "Purchase order created",
  "demand.desiredAt": "Desired date",
  "demand.notes": "Notes",
  "demand.replenishment.title": "Replenishment",
  "demand.replenishment.subtitle":
    "Active products that need restocking: opened by the Planner or coming from after-sales. Each replenishment goes to the purchase strategy.",
  "demand.replenishment.manualOnly":
    "Automatic replenishment from stock is off: stock is not controlled in the portal yet. Open the replenishment by hand.",
  "demand.replenishment.new": "Open replenishment",
  "demand.replenishment.submit": "Open replenishment",
  "demand.replenishment.opened":
    "Replenishment opened. It is now in the purchase strategy queue.",
  "demand.replenishment.queue": "Queue ({n} open)",
  "demand.replenishment.empty": "No replenishment open.",
  "demand.error.forbidden":
    "Your access does not allow opening replenishments.",
  "demand.error.product_unavailable": "Inactive or missing product.",
  "demand.error.invalid_quantity": "Enter a quantity greater than zero.",
  "demand.error.invalid_input": "Check the product, quantity and date.",
  "demand.error.below_moq": "Quantity below the product's minimum order.",
  "demand.cart.ready": "Ready stock",
  "demand.cart.order": "Made to order",
  "demand.cart.readyCount":
    "{n} ready-stock item(s): they go to a sales order, and Sales confirms the price.",
  "demand.cart.orderCount":
    "{n} made-to-order item(s): Wellmix buys them for you; follow them under Customer orders.",
  "demand.cart.saleSent":
    "The ready-stock items became sales order no. {n}; Sales will confirm the price and delivery.",
  "function.sales": "Sales",
  "function.desc.sales":
    "records and qualifies customer orders (also on the customer's behalf), makes offers and samples, sells and handles sales orders, reservations and after-sales",
  "action.demand.createForCustomer":
    "Place a customer order on the customer's behalf",
  "action.desc.demand.createForCustomer":
    "Creates the customer order (New request) for a customer; salespeople and operators choose the customer.",
  "action.replenishment.open": "Open replenishment",
  "action.desc.replenishment.open":
    "Opens the replenishment of an active product (product, quantity and desired date) on the Replenishment screen.",
  "settings.label.autoReplenishmentByStock":
    "Automatic replenishment from stock",
  "settings.hint.autoReplenishmentByStock":
    "Off and without effect: stock is not controlled in the portal yet (owner, 15/11/2026).",
};

export const zh: Record<keyof typeof pt, string> = {
  "nav.demands": "客户订货",
  "orders.origin.cart": "橱窗",
  "demand.kind.all": "全部",
  "demand.kind.order": "客户订货",
  "demand.kind.replenishment": "补货",
  "demand.kind.order.one": "客户订货",
  "demand.kind.replenishment.one": "补货",
  "demand.filter.kind": "需求类型",
  "demand.channel.vitrine": "橱窗",
  "demand.channel.cliente": "客户",
  "demand.channel.vendedor": "销售",
  "demand.channel.operador": "运营",
  "demand.number": "编号",
  "demand.source": "来源",
  "demand.source.afterSales": "售后",
  "demand.source.planner": "计划员",
  "demand.status": "状态",
  "demand.status.waitingStrategy": "等待采购策略",
  "demand.status.ordered": "已生成采购订单",
  "demand.desiredAt": "期望日期",
  "demand.notes": "备注",
  "demand.replenishment.title": "补货",
  "demand.replenishment.subtitle":
    "需要补货的在售产品：由计划员发起或来自售后。每个补货都进入采购策略。",
  "demand.replenishment.manualOnly":
    "按库存自动补货已关闭：门户尚未管理库存。请手动发起补货。",
  "demand.replenishment.new": "发起补货",
  "demand.replenishment.submit": "发起补货",
  "demand.replenishment.opened": "补货已发起，已进入采购策略队列。",
  "demand.replenishment.queue": "队列（{n} 个待处理）",
  "demand.replenishment.empty": "没有待处理的补货。",
  "demand.error.forbidden": "您的权限不能发起补货。",
  "demand.error.product_unavailable": "产品未启用或不存在。",
  "demand.error.invalid_quantity": "请输入大于零的数量。",
  "demand.error.invalid_input": "请检查产品、数量和日期。",
  "demand.error.below_moq": "数量低于产品的最小起订量。",
  "demand.cart.ready": "现货",
  "demand.cart.order": "订货",
  "demand.cart.readyCount": "{n} 个现货商品：进入销售订单，由销售确认价格。",
  "demand.cart.orderCount":
    "{n} 个订货商品：由 Wellmix 为您采购，可在“客户订货”中跟进。",
  "demand.cart.saleSent":
    "现货商品已生成第 {n} 号销售订单；销售将确认价格和交货。",
  "function.sales": "销售",
  "function.desc.sales":
    "登记并确认客户订货（包括代客户录入），提供报价和样品，销售并处理销售订单、预留和售后",
  "action.demand.createForCustomer": "代客户录入订货",
  "action.desc.demand.createForCustomer":
    "为客户创建订货（新申请）；销售和运营人员选择客户。",
  "action.replenishment.open": "发起补货",
  "action.desc.replenishment.open":
    "在“补货”页面为在售产品发起补货（产品、数量和期望日期）。",
  "settings.label.autoReplenishmentByStock": "按库存自动补货",
  "settings.hint.autoReplenishmentByStock":
    "已关闭且不生效：门户尚未管理库存（业主，2026/11/15）。",
};
