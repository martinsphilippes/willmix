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
  "strategy.title": "Estratégia de compra",
  "strategy.subtitle":
    "Reposições e encomendas esperando a decisão: repetir o fornecedor da última compra ou cotar entre fornecedores. A Diretoria de compras aprova.",
  "strategy.waiting": "Esperando a escolha ({n})",
  "strategy.waitingEmpty": "Nenhuma demanda esperando a estratégia.",
  "strategy.noLine": "Sem linha",
  "strategy.noProduct": "Produto fora do catálogo",
  "strategy.noProductHint":
    "Cadastre o produto (ou associe a encomenda a um produto) antes de escolher a estratégia.",
  "strategy.question": "Qual a estratégia de compra?",
  "strategy.choice.last_supplier": "Fornecedor da última compra",
  "strategy.choice.quote": "Cotar entre fornecedores",
  "strategy.noLastPurchase":
    "Sem compra anterior deste produto: só dá para cotar entre fornecedores.",
  "strategy.lastOneProduct":
    "Vários produtos juntos: só dá para cotar entre fornecedores (a última compra é de um produto).",
  "strategy.submit": "Enviar para aprovação",
  "strategy.chosen":
    "Estratégia nº {n} enviada para a aprovação da Diretoria de compras.",
  "strategy.decided": "Estratégia nº {n} decidida.",
  "strategy.open": "Em andamento ({n})",
  "strategy.openEmpty": "Nenhuma estratégia em andamento.",
  "strategy.decision": "Estratégia nº {n}",
  "strategy.status.pending": "Esperando aprovação",
  "strategy.status.approved": "Aprovada",
  "strategy.status.rejected": "Recusada",
  "strategy.status.done": "Concluída",
  "strategy.approvalNote": "Observação da aprovação (obrigatória para recusar)",
  "strategy.approve": "Aprovar",
  "strategy.reject": "Recusar",
  "strategy.waitingApproval": "Esperando a aprovação da Diretoria de compras.",
  "strategy.waitingOrder":
    "Aprovada: quem gera pedido de compra gera o pedido.",
  "strategy.generateOrder": "Gerar pedido de compra",
  "strategy.quotePending":
    "Aprovada para cotar entre fornecedores: a Cotação de compra (B13) segue daqui.",
  "strategy.currency": "Moeda",
  "strategy.days": "{n} dias",
  "strategy.last.supplier": "Fornecedor da última compra",
  "strategy.last.price": "Preço unitário",
  "strategy.last.date": "Pedido e data",
  "strategy.last.leadTime": "Prazo de produção",
  "strategy.last.incoterm": "Incoterm",
  "strategy.last.moq": "Pedido mínimo",
  "strategy.error.forbidden": "Seu acesso não permite esta ação.",
  "strategy.error.not_found": "Demanda ou estratégia não encontrada.",
  "strategy.error.strategy_choose_demands": "Marque ao menos uma demanda.",
  "strategy.error.strategy_demand_taken":
    "Alguma demanda já está em outra estratégia ou já virou pedido.",
  "strategy.error.strategy_product_missing":
    "Demanda sem produto do catálogo: cadastre o produto antes.",
  "strategy.error.strategy_same_line":
    "Junte só demandas do mesmo produto ou da mesma linha.",
  "strategy.error.strategy_last_one_product":
    '"Fornecedor da última compra" vale para um produto só.',
  "strategy.error.strategy_no_last_purchase":
    "Produto sem compra anterior: só dá para cotar.",
  "strategy.error.strategy_decided": "Esta estratégia já foi decidida.",
  "strategy.error.strategy_reject_note": "Para recusar, escreva o motivo.",
  "strategy.error.strategy_not_ready":
    "A estratégia ainda não está aprovada (ou já gerou o pedido).",
  "strategy.error.invalid_input": "Confira os campos.",
  "action.purchaseStrategy.choose": "Escolher a estratégia de compra",
  "action.desc.purchaseStrategy.choose":
    "Na reposição e na encomenda, escolhe entre o fornecedor da última compra e cotar entre fornecedores.",
  "action.purchaseStrategy.approve": "Aprovar a estratégia de compra",
  "action.desc.purchaseStrategy.approve":
    "Aprova ou recusa a estratégia escolhida pelo Comprador (Diretoria de compras).",
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
  "strategy.title": "Purchase strategy",
  "strategy.subtitle":
    "Replenishments and customer orders waiting for a decision: repeat the last purchase's supplier or quote among suppliers. The Purchasing board approves.",
  "strategy.waiting": "Waiting for a choice ({n})",
  "strategy.waitingEmpty": "No demand waiting for a strategy.",
  "strategy.noLine": "No line",
  "strategy.noProduct": "Product not in the catalog",
  "strategy.noProductHint":
    "Register the product (or link the order to a product) before choosing the strategy.",
  "strategy.question": "Which purchase strategy?",
  "strategy.choice.last_supplier": "Last purchase's supplier",
  "strategy.choice.quote": "Quote among suppliers",
  "strategy.noLastPurchase":
    "No previous purchase of this product: only quoting among suppliers is possible.",
  "strategy.lastOneProduct":
    "Several products together: only quoting among suppliers is possible (the last purchase is per product).",
  "strategy.submit": "Send for approval",
  "strategy.chosen":
    "Strategy no. {n} sent to the Purchasing board for approval.",
  "strategy.decided": "Strategy no. {n} decided.",
  "strategy.open": "In progress ({n})",
  "strategy.openEmpty": "No strategy in progress.",
  "strategy.decision": "Strategy no. {n}",
  "strategy.status.pending": "Waiting for approval",
  "strategy.status.approved": "Approved",
  "strategy.status.rejected": "Rejected",
  "strategy.status.done": "Done",
  "strategy.approvalNote": "Approval note (required to reject)",
  "strategy.approve": "Approve",
  "strategy.reject": "Reject",
  "strategy.waitingApproval": "Waiting for the Purchasing board's approval.",
  "strategy.waitingOrder":
    "Approved: whoever generates purchase orders creates the order.",
  "strategy.generateOrder": "Generate purchase order",
  "strategy.quotePending":
    "Approved to quote among suppliers: the Purchase quote (B13) continues from here.",
  "strategy.currency": "Currency",
  "strategy.days": "{n} days",
  "strategy.last.supplier": "Last purchase's supplier",
  "strategy.last.price": "Unit price",
  "strategy.last.date": "Order and date",
  "strategy.last.leadTime": "Production lead time",
  "strategy.last.incoterm": "Incoterm",
  "strategy.last.moq": "Minimum order",
  "strategy.error.forbidden": "Your access does not allow this action.",
  "strategy.error.not_found": "Demand or strategy not found.",
  "strategy.error.strategy_choose_demands": "Select at least one demand.",
  "strategy.error.strategy_demand_taken":
    "A demand is already in another strategy or became an order.",
  "strategy.error.strategy_product_missing":
    "Demand without a catalog product: register the product first.",
  "strategy.error.strategy_same_line":
    "Group only demands of the same product or the same line.",
  "strategy.error.strategy_last_one_product":
    '"Last purchase\'s supplier" applies to a single product.',
  "strategy.error.strategy_no_last_purchase":
    "Product without a previous purchase: quoting only.",
  "strategy.error.strategy_decided": "This strategy was already decided.",
  "strategy.error.strategy_reject_note": "Write the reason to reject.",
  "strategy.error.strategy_not_ready":
    "The strategy is not approved yet (or already generated the order).",
  "strategy.error.invalid_input": "Check the fields.",
  "action.purchaseStrategy.choose": "Choose the purchase strategy",
  "action.desc.purchaseStrategy.choose":
    "For replenishments and customer orders, chooses between the last purchase's supplier and quoting among suppliers.",
  "action.purchaseStrategy.approve": "Approve the purchase strategy",
  "action.desc.purchaseStrategy.approve":
    "Approves or rejects the strategy chosen by the Buyer (Purchasing board).",
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
  "strategy.title": "采购策略",
  "strategy.subtitle":
    "等待决定的补货和客户订货：沿用上次采购的供应商，或在供应商之间询价。由采购总监批准。",
  "strategy.waiting": "等待选择（{n}）",
  "strategy.waitingEmpty": "没有等待采购策略的需求。",
  "strategy.noLine": "无产品线",
  "strategy.noProduct": "不在目录中的产品",
  "strategy.noProductHint": "选择策略前，请先登记产品（或将订货关联到产品）。",
  "strategy.question": "采用哪种采购策略？",
  "strategy.choice.last_supplier": "上次采购的供应商",
  "strategy.choice.quote": "在供应商之间询价",
  "strategy.noLastPurchase": "该产品没有采购记录：只能在供应商之间询价。",
  "strategy.lastOneProduct":
    "多个产品合并：只能在供应商之间询价（上次采购按产品计算）。",
  "strategy.submit": "提交审批",
  "strategy.chosen": "第 {n} 号策略已提交采购总监审批。",
  "strategy.decided": "第 {n} 号策略已决定。",
  "strategy.open": "进行中（{n}）",
  "strategy.openEmpty": "没有进行中的策略。",
  "strategy.decision": "第 {n} 号策略",
  "strategy.status.pending": "等待审批",
  "strategy.status.approved": "已批准",
  "strategy.status.rejected": "已拒绝",
  "strategy.status.done": "已完成",
  "strategy.approvalNote": "审批备注（拒绝时必填）",
  "strategy.approve": "批准",
  "strategy.reject": "拒绝",
  "strategy.waitingApproval": "等待采购总监审批。",
  "strategy.waitingOrder": "已批准：由负责生成采购订单的人员生成订单。",
  "strategy.generateOrder": "生成采购订单",
  "strategy.quotePending":
    "已批准在供应商之间询价：从这里进入采购询价（B13）。",
  "strategy.currency": "币种",
  "strategy.days": "{n} 天",
  "strategy.last.supplier": "上次采购的供应商",
  "strategy.last.price": "单价",
  "strategy.last.date": "订单和日期",
  "strategy.last.leadTime": "生产周期",
  "strategy.last.incoterm": "贸易术语",
  "strategy.last.moq": "最小起订量",
  "strategy.error.forbidden": "您的权限不允许此操作。",
  "strategy.error.not_found": "未找到需求或策略。",
  "strategy.error.strategy_choose_demands": "请至少勾选一个需求。",
  "strategy.error.strategy_demand_taken":
    "某个需求已在其他策略中或已生成订单。",
  "strategy.error.strategy_product_missing": "需求没有目录产品：请先登记产品。",
  "strategy.error.strategy_same_line": "只能合并同一产品或同一产品线的需求。",
  "strategy.error.strategy_last_one_product":
    "“上次采购的供应商”只适用于单个产品。",
  "strategy.error.strategy_no_last_purchase": "产品没有采购记录：只能询价。",
  "strategy.error.strategy_decided": "该策略已决定。",
  "strategy.error.strategy_reject_note": "拒绝时请填写原因。",
  "strategy.error.strategy_not_ready": "策略尚未批准（或已生成订单）。",
  "strategy.error.invalid_input": "请检查字段。",
  "action.purchaseStrategy.choose": "选择采购策略",
  "action.desc.purchaseStrategy.choose":
    "在补货和客户订货中，选择上次采购的供应商或在供应商之间询价。",
  "action.purchaseStrategy.approve": "批准采购策略",
  "action.desc.purchaseStrategy.approve":
    "批准或拒绝采购员选择的策略（采购总监）。",
};
