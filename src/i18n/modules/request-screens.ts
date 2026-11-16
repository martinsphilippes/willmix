/**
 * Telas de nova solicitação por tipo de operação (dono, 16/11/2026;
 * docs/REQUEST_SCREENS.md): TS - Trading Sales e Venda - Encomenda, no menu
 * Produto novo.
 */
export const pt = {
  "nav.requestTs": "TS - Trading Sales",
  "nav.requestSale": "Venda - Encomenda",
  "requestScreen.ts.title": "TS - Trading Sales",
  "requestScreen.ts.subtitle":
    "Nova solicitação de venda ao cliente por TS (Trading Sales). O tipo de operação é definido por esta tela.",
  "requestScreen.ts.fixed":
    "Definido pela tela TS - Trading Sales: esta solicitação é sempre TS.",
  "requestScreen.sale.title": "Venda - Encomenda",
  "requestScreen.sale.subtitle":
    "Nova solicitação de venda ao cliente por encomenda. O tipo de operação é definido por esta tela.",
  "requestScreen.sale.fixed":
    "Definido pela tela Venda - Encomenda: esta solicitação é sempre Venda.",
  "requestScreen.add": "Adicionar",
  "requestScreen.replenishment.title": "Reposição - Adicionar",
  "requestScreen.replenishment.subtitle":
    "Compra para estoque (sem cliente): a solicitação entra na fila de Reposição. Para vender a um cliente, desmarque a compra para estoque e escolha o cliente.",
  "requestScreen.created": "Solicitação criada.",
  "requestScreen.createdNumbered": "Solicitação nº {n} criada.",
  "reqBatch.error.replenishment_product":
    "Reposição é de produto do catálogo: escolha o produto na busca, sem marcar produto fora do catálogo.",
  "reqBatch.error.request_screen_stock":
    "Esta tela é de venda ao cliente: escolha o cliente. A compra para estoque abre pelo botão + Adicionar de Reposição.",
};

export const en: typeof pt = {
  "nav.requestTs": "TS - Trading Sales",
  "nav.requestSale": "Sale - Customer order",
  "requestScreen.ts.title": "TS - Trading Sales",
  "requestScreen.ts.subtitle":
    "New customer sale request by TS (Trading Sales). The operation type is set by this screen.",
  "requestScreen.ts.fixed":
    "Set by the TS - Trading Sales screen: this request is always TS.",
  "requestScreen.sale.title": "Sale - Customer order",
  "requestScreen.sale.subtitle":
    "New customer sale request by order. The operation type is set by this screen.",
  "requestScreen.sale.fixed":
    "Set by the Sale - Customer order screen: this request is always Sale.",
  "requestScreen.add": "Add",
  "requestScreen.replenishment.title": "Replenishment - Add",
  "requestScreen.replenishment.subtitle":
    "Stock purchase (no customer): the request goes to the Replenishment queue. To sell to a customer, untick the stock purchase and choose the customer.",
  "requestScreen.created": "Request created.",
  "requestScreen.createdNumbered": "Request no. {n} created.",
  "reqBatch.error.replenishment_product":
    "Replenishment is for catalog products: pick the product from the search, without marking a product outside the catalog.",
  "reqBatch.error.request_screen_stock":
    "This screen is for selling to a customer: choose the customer. Stock purchases open from the + Add button in Replenishment.",
};

export const zh: typeof pt = {
  "nav.requestTs": "TS - 贸易销售",
  "nav.requestSale": "销售 - 订货",
  "requestScreen.ts.title": "TS - 贸易销售",
  "requestScreen.ts.subtitle":
    "按 TS（贸易销售）向客户销售的新需求单。业务类型由本页面决定。",
  "requestScreen.ts.fixed": "由 TS - 贸易销售 页面决定：本需求单始终为 TS。",
  "requestScreen.sale.title": "销售 - 订货",
  "requestScreen.sale.subtitle":
    "按订货向客户销售的新需求单。业务类型由本页面决定。",
  "requestScreen.sale.fixed": "由 销售 - 订货 页面决定：本需求单始终为销售。",
  "requestScreen.add": "添加",
  "requestScreen.replenishment.title": "补货 - 添加",
  "requestScreen.replenishment.subtitle":
    "库存采购（无客户）：需求单进入补货队列。若要向客户销售，请取消勾选库存采购并选择客户。",
  "requestScreen.created": "需求单已创建。",
  "requestScreen.createdNumbered": "需求单 {n} 号已创建。",
  "reqBatch.error.replenishment_product":
    "补货仅限目录内产品：请通过搜索选择产品，不要勾选目录外产品。",
  "reqBatch.error.request_screen_stock":
    "本页面用于向客户销售：请选择客户。库存采购请通过 补货 页面的 + 添加 按钮进行。",
};
