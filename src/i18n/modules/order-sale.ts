/**
 * Venda ao cliente por pedido e por produto (dono, 14/11/2026;
 * docs/ORDER_SALE.md): o card "Venda ao cliente" do detalhe do pedido.
 */
export const pt = {
  "orderSale.title": "Venda ao cliente",
  "orderSale.hint":
    "Preço de venda de cada produto, na moeda do pedido. O total do pedido é a soma (preço × quantidade).",
  "orderSale.col.product": "Produto",
  "orderSale.col.qty": "Quantidade",
  "orderSale.col.unit": "Preço unitário",
  "orderSale.col.subtotal": "Subtotal",
  "orderSale.currency": "Moeda da venda",
  "orderSale.total": "Total do pedido",
  "orderSale.partial":
    "Soma parcial: {sum} · faltam preços em {n} de {total} produtos. O total do pedido vale quando todos tiverem preço.",
  "orderSale.legacy":
    "Total gravado antes, sem preço por produto: {total}. Com os preços de todos os produtos, o total passa a ser a soma.",
  "orderSale.empty": "Sem venda gravada.",
  "orderSale.save": "Salvar a venda",
  "orderSale.saving": "Salvando…",
  "orderSale.saved": "Venda gravada.",
  "orderSale.priceOf": "Preço de venda de {name}",
  "orderSale.child":
    "A venda desta rodada fica no pedido de compra #{n} (o pai da programação).",
  "orderSale.openParent": "Abrir o pedido #{n}",
  "orderSale.cancelled": "Pedido cancelado: a venda não muda mais.",
  "orderSale.readOnly":
    "Só quem tem a permissão “Gravar a venda ao cliente” altera os preços.",
  "orders.error.sale_forbidden":
    "Seu login não tem a permissão “Gravar a venda ao cliente”.",
  "orders.error.sale_cancelled":
    "Pedido cancelado: a venda não pode ser alterada.",
  "orders.error.sale_on_parent":
    "A venda da programação é gravada no pedido pai.",
  "orders.error.sale_unknown_item":
    "Um dos produtos não é deste pedido. Recarregue a página e grave de novo.",
  "orders.error.sale_no_items": "Pedido sem produtos: não há o que precificar.",
  "orderSale.cargo.boxes": "Caixas",
  "orderSale.line.boxes": "{n} caixas",
  "orderSale.line.cbm": "{n} m³",
  "orderSale.cargo.cbm": "Cubagem",
  "orderSale.cargo.containers": "Containers",
  "orderSale.cargo.missing":
    "{n} produto(s) sem caixa master ou cubagem no cadastro ficam fora da soma.",
  "orderSale.quote.hint":
    "Preços por peça, em R$, com frete, pela cotação do Sankhya: WD com VIP 5 e Wellmix no nível {tier}. Não se digitam: escolha o formato e grave. O total do pedido é a soma (preço × quantidade).",
  "orderSale.quote.tierDefault": "padrão do Sankhya",
  "orderSale.quote.format": "Formato da venda",
  "orderSale.quote.pick":
    "Escolha WD ou Wellmix para ver o total e gravar a venda.",
  "orderSale.quote.total": "Total do pedido ({format})",
  "orderSale.quote.loading": "Buscando os preços no Sankhya… {n} de {total}",
  "orderSale.quote.recorded": "Venda gravada: {total} ({format})",
  "orderSale.quote.recordedTyped":
    "Venda gravada antes, com o preço digitado: {total}",
  "orderSale.quote.priceOf": "Preço {format} de {name}",
  "orderSale.quote.missing": "{format}: {reason}",
  "orderSale.quote.reason.noProduct": "produto fora do catálogo",
  "orderSale.quote.reason.noPrice": "a cotação não devolveu preço",
  "orderSale.quote.reason.failed":
    "o Sankhya não respondeu; recarregue a página",
  "orders.error.sale_api_unavailable":
    "A cotação do Sankhya não está ligada agora. Recarregue a página para gravar a venda.",
  "orders.error.sale_no_prices":
    "Nenhum produto tem o preço desse formato na cotação do Sankhya agora. Nada foi gravado: a venda de antes continua.",
} as const;

export const en: Record<keyof typeof pt, string> = {
  "orderSale.title": "Customer sale",
  "orderSale.hint":
    "Sale price of each product, in the order currency. The order total is the sum (price × quantity).",
  "orderSale.col.product": "Product",
  "orderSale.col.qty": "Quantity",
  "orderSale.col.unit": "Unit price",
  "orderSale.col.subtotal": "Subtotal",
  "orderSale.currency": "Sale currency",
  "orderSale.total": "Order total",
  "orderSale.partial":
    "Partial sum: {sum} · prices missing for {n} of {total} products. The order total counts once every product has a price.",
  "orderSale.legacy":
    "Total recorded before, without per-product prices: {total}. Once every product has a price, the total becomes the sum.",
  "orderSale.empty": "No sale recorded.",
  "orderSale.save": "Save the sale",
  "orderSale.saving": "Saving…",
  "orderSale.saved": "Sale recorded.",
  "orderSale.priceOf": "Sale price of {name}",
  "orderSale.child":
    "The sale of this round is on purchase order #{n} (the schedule's parent).",
  "orderSale.openParent": "Open order #{n}",
  "orderSale.cancelled": "Cancelled order: the sale no longer changes.",
  "orderSale.readOnly":
    "Only logins with the “Record the customer sale” permission change prices.",
  "orders.error.sale_forbidden":
    "Your login does not have the “Record the customer sale” permission.",
  "orders.error.sale_cancelled": "Cancelled order: the sale cannot be changed.",
  "orders.error.sale_on_parent":
    "The schedule's sale is recorded on the parent order.",
  "orders.error.sale_unknown_item":
    "One of the products is not in this order. Reload the page and save again.",
  "orders.error.sale_no_items": "Order without products: nothing to price.",
  "orderSale.cargo.boxes": "Boxes",
  "orderSale.line.boxes": "{n} boxes",
  "orderSale.line.cbm": "{n} m³",
  "orderSale.cargo.cbm": "Volume",
  "orderSale.cargo.containers": "Containers",
  "orderSale.cargo.missing":
    "{n} product(s) without a master box or volume in the catalog are left out of the totals.",
  "orderSale.quote.hint":
    "Prices per piece, in R$, with freight, from the Sankhya quote: WD with VIP 5 and Wellmix at the {tier} level. They are not typed: choose the format and save. The order total is the sum (price × quantity).",
  "orderSale.quote.tierDefault": "Sankhya default",
  "orderSale.quote.format": "Sale format",
  "orderSale.quote.pick":
    "Choose WD or Wellmix to see the total and record the sale.",
  "orderSale.quote.total": "Order total ({format})",
  "orderSale.quote.loading": "Fetching prices from Sankhya… {n} of {total}",
  "orderSale.quote.recorded": "Recorded sale: {total} ({format})",
  "orderSale.quote.recordedTyped":
    "Sale recorded before, with a typed price: {total}",
  "orderSale.quote.priceOf": "{format} price of {name}",
  "orderSale.quote.missing": "{format}: {reason}",
  "orderSale.quote.reason.noProduct": "product not in the catalog",
  "orderSale.quote.reason.noPrice": "the quote returned no price",
  "orderSale.quote.reason.failed": "Sankhya did not respond; reload the page",
  "orders.error.sale_api_unavailable":
    "The Sankhya quote is not connected right now. Reload the page to record the sale.",
  "orders.error.sale_no_prices":
    "No product has a price for this format in the Sankhya quote right now. Nothing was saved: the previous sale stays.",
};

export const zh: Record<keyof typeof pt, string> = {
  "orderSale.title": "客户销售",
  "orderSale.hint":
    "每个产品的售价，按订单币种。订单总额为合计（单价 × 数量）。",
  "orderSale.col.product": "产品",
  "orderSale.col.qty": "数量",
  "orderSale.col.unit": "单价",
  "orderSale.col.subtotal": "小计",
  "orderSale.currency": "销售币种",
  "orderSale.total": "订单总额",
  "orderSale.partial":
    "部分合计：{sum} · {total} 个产品中有 {n} 个缺少价格。所有产品都有价格后，订单总额才生效。",
  "orderSale.legacy":
    "之前录入的总额（无产品单价）：{total}。所有产品都有价格后，总额改为合计。",
  "orderSale.empty": "尚未录入销售。",
  "orderSale.save": "保存销售",
  "orderSale.saving": "正在保存…",
  "orderSale.saved": "销售已保存。",
  "orderSale.priceOf": "{name} 的售价",
  "orderSale.child": "本批次的销售记录在采购订单 #{n}（排期的父订单）。",
  "orderSale.openParent": "打开订单 #{n}",
  "orderSale.cancelled": "订单已取消：销售不再更改。",
  "orderSale.readOnly": "只有拥有“录入客户售价”权限的账号才能修改价格。",
  "orders.error.sale_forbidden": "您的账号没有“录入客户售价”权限。",
  "orders.error.sale_cancelled": "订单已取消：无法修改销售。",
  "orders.error.sale_on_parent": "排期的销售记录在父订单中。",
  "orders.error.sale_unknown_item":
    "其中一个产品不属于本订单。请刷新页面后重新保存。",
  "orders.error.sale_no_items": "订单没有产品：无需定价。",
  "orderSale.cargo.boxes": "箱数",
  "orderSale.line.boxes": "{n} 箱",
  "orderSale.line.cbm": "{n} m³",
  "orderSale.cargo.cbm": "体积",
  "orderSale.cargo.containers": "集装箱",
  "orderSale.cargo.missing": "{n} 个产品在目录中没有外箱或体积，未计入合计。",
  "orderSale.quote.hint":
    "每件价格（雷亚尔，含运费），来自 Sankhya 报价：WD 使用 VIP 5，Wellmix 使用 {tier} 等级。价格不可手动输入：选择模式后保存。订单合计为各产品之和（价格 × 数量）。",
  "orderSale.quote.tierDefault": "Sankhya 默认",
  "orderSale.quote.format": "销售模式",
  "orderSale.quote.pick": "选择 WD 或 Wellmix 以查看合计并保存销售。",
  "orderSale.quote.total": "订单合计（{format}）",
  "orderSale.quote.loading": "正在从 Sankhya 获取价格……{n}/{total}",
  "orderSale.quote.recorded": "已保存的销售：{total}（{format}）",
  "orderSale.quote.recordedTyped": "之前以手动输入价格保存的销售：{total}",
  "orderSale.quote.priceOf": "{name} 的 {format} 价格",
  "orderSale.quote.missing": "{format}：{reason}",
  "orderSale.quote.reason.noProduct": "产品不在目录中",
  "orderSale.quote.reason.noPrice": "报价未返回价格",
  "orderSale.quote.reason.failed": "Sankhya 无响应，请刷新页面",
  "orders.error.sale_api_unavailable":
    "Sankhya 报价目前未连接。请刷新页面后再保存销售。",
  "orders.error.sale_no_prices":
    "目前 Sankhya 报价中没有任何产品有该模式的价格。未保存任何内容，之前的销售保持不变。",
};
