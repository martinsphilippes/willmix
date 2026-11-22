/**
 * Dicionário do módulo "order-table" (tabelas padrão no nível do pedido e no
 * nível do item, dono, 22/11/2026; docs/ORDER_TABLES.md): os cabeçalhos da
 * tabela de pedidos, na ordem do dono, com a explicação de cada coluna, e os
 * valores do tipo de venda e do tipo de faturamento. Mesmas chaves em pt, en
 * e zh.
 */
export const pt = {
  "orderTable.head.number": "Nº do pedido",
  "orderTable.head.number.hint":
    "O número do pedido no portal, o mesmo do Sankhya. Abre os produtos do pedido.",
  "orderTable.head.negotiationDate": "Data negociação",
  "orderTable.head.negotiationDate.hint":
    "Dia em que o pedido foi lançado no portal.",
  "orderTable.head.saleType": "Tipo de venda",
  "orderTable.head.saleType.hint":
    "Trading Sales (encomenda do cliente) ou Wellmix STK (estoque).",
  "orderTable.head.paymentTerm": "Prazo pgto.",
  "orderTable.head.paymentTerm.hint":
    "Número de parcelas da forma de pagamento do pedido.",
  "orderTable.head.paymentMethod": "Forma pgto.",
  "orderTable.head.paymentMethod.hint":
    "Forma de pagamento escolhida no pedido.",
  "orderTable.head.billing": "Faturamento",
  "orderTable.head.billing.hint":
    "Tipo de faturamento: WX (Wellmix) ou WD (distribuidora).",
  "orderTable.head.vip": "VIP",
  "orderTable.head.vip.hint":
    "Nível do cliente no pedido: Pleno, Mega, Hiper, Ultra, Evo ou Super.",
  "orderTable.head.group": "Grupo econômico",
  "orderTable.head.group.hint": "Grupo econômico do cliente no Sankhya.",
  "orderTable.head.customerCode": "Cliente nº",
  "orderTable.head.customerCode.hint": "Código do cliente no Sankhya.",
  "orderTable.head.customer": "Cliente nome",
  "orderTable.head.customer.hint": "Cliente nome",
  "orderTable.head.status": "Status",
  "orderTable.head.status.hint":
    "O que o pedido está esperando: de quem é a vez.",
  "orderTable.head.step": "Situação",
  "orderTable.head.step.hint":
    "O momento do passo em que o pedido está e quem pode agir.",
  "orderTable.head.deadline": "Prazo resposta",
  "orderTable.head.deadline.hint":
    "Prazo (SLA) da ação que o pedido espera; em vermelho quando atrasado.",
  "orderTable.head.items": "Itens",
  "orderTable.head.items.hint": "Quantos produtos diferentes o pedido tem.",
  "orderTable.head.deliveries": "Entregas",
  "orderTable.head.deliveries.hint":
    "Quantas entregas foram programadas no pedido.",
  "orderTable.head.cbm": "Total CBM (m³)",
  "orderTable.head.cbm.hint":
    "Cubagem total: caixas master × m³ de cada caixa.",
  "orderTable.head.value": "Valor total",
  "orderTable.head.value.hint": "Valor total previsto do pedido (com frete).",
  "orderTable.head.supplier": "Fornecedor",
  "orderTable.head.supplier.hint":
    "Fornecedor do pedido, a partir de quando ele é definido. Só a equipe Wellmix vê.",
  "orderTable.saleType.trading": "Trading Sales",
  "orderTable.saleType.stock": "Wellmix STK",
  "orderTable.saleType.sale": "Venda",
  "orderTable.billing.wellmix": "WX",
  "orderTable.billing.wd": "WD",
};

export const en: Record<keyof typeof pt, string> = {
  "orderTable.head.number": "Order no.",
  "orderTable.head.number.hint":
    "The order number in the portal, the same as in Sankhya. Opens the products of the order.",
  "orderTable.head.negotiationDate": "Negotiation date",
  "orderTable.head.negotiationDate.hint":
    "Day the order was entered in the portal.",
  "orderTable.head.saleType": "Sale type",
  "orderTable.head.saleType.hint":
    "Trading Sales (customer order) or Wellmix STK (stock).",
  "orderTable.head.paymentTerm": "Payment term",
  "orderTable.head.paymentTerm.hint":
    "Number of instalments of the order's payment plan.",
  "orderTable.head.paymentMethod": "Payment",
  "orderTable.head.paymentMethod.hint": "Payment plan chosen for the order.",
  "orderTable.head.billing": "Billing",
  "orderTable.head.billing.hint":
    "Billing type: WX (Wellmix) or WD (distributor).",
  "orderTable.head.vip": "VIP",
  "orderTable.head.vip.hint":
    "Customer level on the order: Pleno, Mega, Hiper, Ultra, Evo or Super.",
  "orderTable.head.group": "Economic group",
  "orderTable.head.group.hint": "Customer's economic group in Sankhya.",
  "orderTable.head.customerCode": "Customer no.",
  "orderTable.head.customerCode.hint": "Customer code in Sankhya.",
  "orderTable.head.customer": "Customer name",
  "orderTable.head.customer.hint": "Customer name",
  "orderTable.head.status": "Status",
  "orderTable.head.status.hint":
    "What the order is waiting for: whose turn it is.",
  "orderTable.head.step": "Stage",
  "orderTable.head.step.hint":
    "The moment of the step the order is in and who can act.",
  "orderTable.head.deadline": "Answer due",
  "orderTable.head.deadline.hint":
    "Deadline (SLA) of the action the order waits for; red when late.",
  "orderTable.head.items": "Items",
  "orderTable.head.items.hint": "How many different products the order has.",
  "orderTable.head.deliveries": "Deliveries",
  "orderTable.head.deliveries.hint":
    "How many deliveries were scheduled for the order.",
  "orderTable.head.cbm": "Total CBM (m³)",
  "orderTable.head.cbm.hint": "Total volume: master cartons × m³ per carton.",
  "orderTable.head.value": "Total value",
  "orderTable.head.value.hint":
    "Forecast total value of the order (with freight).",
  "orderTable.head.supplier": "Supplier",
  "orderTable.head.supplier.hint":
    "Supplier of the order, once it is defined. Only the Wellmix team sees it.",
  "orderTable.saleType.trading": "Trading Sales",
  "orderTable.saleType.stock": "Wellmix STK",
  "orderTable.saleType.sale": "Sale",
  "orderTable.billing.wellmix": "WX",
  "orderTable.billing.wd": "WD",
};

export const zh: Record<keyof typeof pt, string> = {
  "orderTable.head.number": "订单号",
  "orderTable.head.number.hint":
    "门户中的订单号，与 Sankhya 相同。点击打开订单产品。",
  "orderTable.head.negotiationDate": "洽谈日期",
  "orderTable.head.negotiationDate.hint": "订单录入门户的日期。",
  "orderTable.head.saleType": "销售类型",
  "orderTable.head.saleType.hint":
    "Trading Sales（客户订货）或 Wellmix STK（库存）。",
  "orderTable.head.paymentTerm": "付款期数",
  "orderTable.head.paymentTerm.hint": "订单付款方式的期数。",
  "orderTable.head.paymentMethod": "付款方式",
  "orderTable.head.paymentMethod.hint": "订单选择的付款方式。",
  "orderTable.head.billing": "开票类型",
  "orderTable.head.billing.hint": "开票类型：WX（Wellmix）或 WD（分销商）。",
  "orderTable.head.vip": "VIP",
  "orderTable.head.vip.hint":
    "订单中的客户级别：Pleno、Mega、Hiper、Ultra、Evo 或 Super。",
  "orderTable.head.group": "经济集团",
  "orderTable.head.group.hint": "客户在 Sankhya 中的经济集团。",
  "orderTable.head.customerCode": "客户编号",
  "orderTable.head.customerCode.hint": "客户在 Sankhya 中的编码。",
  "orderTable.head.customer": "客户名称",
  "orderTable.head.customer.hint": "客户名称",
  "orderTable.head.status": "状态",
  "orderTable.head.status.hint": "订单在等待什么：轮到谁处理。",
  "orderTable.head.step": "阶段",
  "orderTable.head.step.hint": "订单所处步骤的环节以及谁可以处理。",
  "orderTable.head.deadline": "回复期限",
  "orderTable.head.deadline.hint":
    "订单所等待操作的期限（SLA）；逾期显示红色。",
  "orderTable.head.items": "品项",
  "orderTable.head.items.hint": "订单包含多少种不同产品。",
  "orderTable.head.deliveries": "交货次数",
  "orderTable.head.deliveries.hint": "订单计划的交货次数。",
  "orderTable.head.cbm": "总 CBM (m³)",
  "orderTable.head.cbm.hint": "总体积：外箱数 × 每箱 m³。",
  "orderTable.head.value": "总金额",
  "orderTable.head.value.hint": "订单预计总金额（含运费）。",
  "orderTable.head.supplier": "供应商",
  "orderTable.head.supplier.hint": "订单确定后的供应商。仅 Wellmix 团队可见。",
  "orderTable.saleType.trading": "Trading Sales",
  "orderTable.saleType.stock": "Wellmix STK",
  "orderTable.saleType.sale": "销售",
  "orderTable.billing.wellmix": "WX",
  "orderTable.billing.wd": "WD",
};
