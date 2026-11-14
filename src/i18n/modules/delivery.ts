/**
 * Entrega (mapa E7? a E16; docs/DELIVERY.md): pedido pausado pelo canal,
 * porto de chegada e transportadora padrão. Mesmas chaves em pt, en e zh.
 */
export const pt = {
  "delivery.paused.title": "Pedido pausado",
  "delivery.paused.channel_red":
    "Canal vermelho no despacho: o pedido está pausado desde {date}. Nada anda até um administrador retomar.",
  "delivery.paused.channel_grey":
    "Canal cinza no despacho: o pedido está pausado desde {date}. Nada anda até um administrador retomar.",
  "delivery.paused.other":
    "O pedido está pausado desde {date}. Nada anda até um administrador retomar.",
  "delivery.resume": "Retomar o pedido",
  "delivery.resumeNote": "Observação (opcional)",
  "delivery.resumed": "Pedido retomado.",
  "delivery.port.title": "Porto de chegada e transportadora",
  "delivery.port.hint":
    "Pelo porto de chegada, a transportadora padrão de Configurações: Itapoá → {itapoa}; os demais → {other}.",
  "delivery.port.label": "Porto de chegada",
  "delivery.port.IOA": "Itapoá",
  "delivery.port.ITJ": "Itajaí",
  "delivery.port.NVT": "Navegantes",
  "delivery.port.OTHER": "Outro porto",
  "delivery.port.save": "Salvar o porto",
  "delivery.port.saved": "Porto de chegada salvo.",
  "delivery.carrier.suggested": "Transportadora: {name}",
  "delivery.carrier.hire": "Contratar {name}",
  "delivery.carrier.hired": "{name} contratada para este pedido.",
  "delivery.carrier.missing":
    "{name} não está cadastrada como transportadora. Cadastre em Parceiros ou ajuste o nome em Configurações.",
  "delivery.notify.paused.subject": "Pedido #{n} pausado: canal {channel}",
  "delivery.notify.paused.body":
    "O despacho saiu com canal {channel}. O pedido está pausado por tempo indeterminado; um administrador retoma quando for liberado.",
  "settings.label.carrierItapoaName":
    "Transportadora padrão para cargas que chegam por Itapoá (nome do cadastro)",
  "settings.label.carrierDefaultName":
    "Transportadora padrão para os demais portos (nome do cadastro)",
  "orders.error.order_paused":
    "O pedido está pausado (canal cinza ou vermelho). Um administrador precisa retomar antes.",
  "importFlow.error.order_paused":
    "O pedido está pausado (canal cinza ou vermelho). Um administrador precisa retomar antes.",
  "function.quality": "Qualidade (CD)",
  "function.desc.quality":
    "confere no CD a carga recebida contra o pedido e decide: armazenar ou seguir a trilha de divergência",
  "action.receiving.quality": "Concluir a conferência da qualidade no CD",
  "action.desc.receiving.quality":
    "Depois da contagem por SKU do recebimento, conclui a conferência: sem divergência o produto é armazenado e vendas é avisada; com divergência, Compras é avisada e segue a trilha do lote.",
  "quality.title": "Qualidade (CD)",
  "quality.hint":
    "Com a contagem por SKU registrada acima, conclua a conferência. Sem divergência, o produto é armazenado no CD e vendas fica sabendo. Com divergência, explique na observação: Compras é avisada e o pedido segue a trilha do lote.",
  "quality.note": "Observação (obrigatória com divergência)",
  "quality.conclude": "Concluir a conferência da qualidade",
  "quality.ok": "Conferida sem divergência · armazenada em {date}",
  "quality.divergent":
    "Conferida com divergência em {date}: segue a trilha do lote",
  "quality.waitCounts": "Registre a contagem por SKU antes de concluir.",
  "quality.done": "Conferência da qualidade concluída.",
  "receiving.error.quality_counts_required":
    "Registre a contagem de todos os itens antes de concluir a conferência.",
  "receiving.error.quality_done":
    "A conferência da qualidade já foi concluída.",
  "receiving.error.quality_note_required":
    "Com divergência, explique na observação.",
  "quality.notify.stored.subject":
    "Pedido #{n}: carga conferida e armazenada no CD",
  "quality.notify.stored.body":
    "A qualidade conferiu a carga sem divergência; o produto está no estoque do CD. {note}",
  "quality.notify.divergent.subject":
    "Pedido #{n}: carga com divergência no CD",
  "quality.notify.divergent.body":
    "A qualidade encontrou divergência entre o recebido e o pedido. {note} Segue a trilha do lote (Compras → Fornecedor → Evidência → Financeiro).",
  "quality.task.title": "Conferir a carga no CD: pedido #{n}",
  "quality.task.detail":
    "A descarga foi registrada. Confira cada SKU contra o pedido e conclua a conferência da qualidade.",
  "tasks.group.quality": "Qualidade (CD)",
  "buyerDelivery.title": "Entrega no CD do comprador",
  "buyerDelivery.hint":
    "O comprador deste pedido não é a Wellmix: a transportadora entrega no CD dele e o comprador confirma o recebimento na etapa Entrega.",
  "buyerDelivery.wellmix":
    "O comprador é a Wellmix: a carga vai ao CD da Wellmix (cartão Recebimento).",
  "buyerDelivery.buyer": "Comprador",
  "buyerDelivery.address": "Endereço de entrega",
  "buyerDelivery.noAddress":
    "Sem endereço no cadastro do cliente: complete em Cadastros → Clientes.",
  "buyerDelivery.carrier": "Transportadora",
  "buyerDelivery.noCarrier": "Ainda não designada",
  "buyerDelivery.confirm": "Quem confirma o recebimento",
  "buyerDelivery.confirmBuyer": "O comprador (etapa Entrega)",
  "receiving.done.quality": "Conferência da qualidade concluída.",
  "receiving.unit": "Contado em",
  "receiving.unit.units": "un",
  "receiving.unit.cartons": "caixas ({n} un)",
  "receiving.unit.converted": "= {n} un",
  "receiving.error.no_master_box":
    "Este item não tem caixa master no cadastro: conte por unidade.",
};

export const en: Record<keyof typeof pt, string> = {
  "delivery.paused.title": "Order paused",
  "delivery.paused.channel_red":
    "Red channel at clearance: the order has been paused since {date}. Nothing moves until an administrator resumes it.",
  "delivery.paused.channel_grey":
    "Grey channel at clearance: the order has been paused since {date}. Nothing moves until an administrator resumes it.",
  "delivery.paused.other":
    "The order has been paused since {date}. Nothing moves until an administrator resumes it.",
  "delivery.resume": "Resume the order",
  "delivery.resumeNote": "Note (optional)",
  "delivery.resumed": "Order resumed.",
  "delivery.port.title": "Arrival port and carrier",
  "delivery.port.hint":
    "By arrival port, the default carrier from Settings: Itapoá → {itapoa}; others → {other}.",
  "delivery.port.label": "Arrival port",
  "delivery.port.IOA": "Itapoá",
  "delivery.port.ITJ": "Itajaí",
  "delivery.port.NVT": "Navegantes",
  "delivery.port.OTHER": "Other port",
  "delivery.port.save": "Save the port",
  "delivery.port.saved": "Arrival port saved.",
  "delivery.carrier.suggested": "Carrier: {name}",
  "delivery.carrier.hire": "Hire {name}",
  "delivery.carrier.hired": "{name} hired for this order.",
  "delivery.carrier.missing":
    "{name} is not registered as a carrier. Register it in Partners or adjust the name in Settings.",
  "delivery.notify.paused.subject": "Order #{n} paused: {channel} channel",
  "delivery.notify.paused.body":
    "Clearance came out with {channel} channel. The order is paused indefinitely; an administrator resumes it once released.",
  "settings.label.carrierItapoaName":
    "Default carrier for cargo arriving at Itapoá (registered name)",
  "settings.label.carrierDefaultName":
    "Default carrier for the other ports (registered name)",
  "orders.error.order_paused":
    "The order is paused (grey or red channel). An administrator must resume it first.",
  "importFlow.error.order_paused":
    "The order is paused (grey or red channel). An administrator must resume it first.",
  "function.quality": "Quality (DC)",
  "function.desc.quality":
    "checks at the DC the received cargo against the order and decides: store it or follow the discrepancy track",
  "action.receiving.quality": "Conclude the quality check at the DC",
  "action.desc.receiving.quality":
    "After the per-SKU receiving count, concludes the check: without discrepancies the product is stored and sales is notified; with discrepancies, Purchasing is notified and the batch track follows.",
  "quality.title": "Quality (DC)",
  "quality.hint":
    "With the per-SKU count recorded above, conclude the check. Without discrepancies, the product is stored at the DC and sales learns about it. With discrepancies, explain in the note: Purchasing is notified and the order follows the batch track.",
  "quality.note": "Note (required with discrepancies)",
  "quality.conclude": "Conclude the quality check",
  "quality.ok": "Checked without discrepancies · stored on {date}",
  "quality.divergent":
    "Checked with discrepancies on {date}: follows the batch track",
  "quality.waitCounts": "Record the per-SKU count before concluding.",
  "quality.done": "Quality check concluded.",
  "receiving.error.quality_counts_required":
    "Record the count of every item before concluding the check.",
  "receiving.error.quality_done": "The quality check was already concluded.",
  "receiving.error.quality_note_required":
    "With discrepancies, explain in the note.",
  "quality.notify.stored.subject":
    "Order #{n}: cargo checked and stored at the DC",
  "quality.notify.stored.body":
    "Quality checked the cargo without discrepancies; the product is in the DC stock. {note}",
  "quality.notify.divergent.subject":
    "Order #{n}: cargo with discrepancies at the DC",
  "quality.notify.divergent.body":
    "Quality found discrepancies between what was received and the order. {note} The batch track follows (Purchasing → Supplier → Evidence → Finance).",
  "quality.task.title": "Check the cargo at the DC: order #{n}",
  "quality.task.detail":
    "Unloading was recorded. Check each SKU against the order and conclude the quality check.",
  "tasks.group.quality": "Quality (DC)",
  "buyerDelivery.title": "Delivery to the buyer's DC",
  "buyerDelivery.hint":
    "The buyer of this order is not Wellmix: the carrier delivers to the buyer's DC and the buyer confirms receipt in the Delivery stage.",
  "buyerDelivery.wellmix":
    "The buyer is Wellmix: the cargo goes to the Wellmix DC (Receiving card).",
  "buyerDelivery.buyer": "Buyer",
  "buyerDelivery.address": "Delivery address",
  "buyerDelivery.noAddress":
    "No address on the customer record: complete it in Registry → Customers.",
  "buyerDelivery.carrier": "Carrier",
  "buyerDelivery.noCarrier": "Not assigned yet",
  "buyerDelivery.confirm": "Who confirms receipt",
  "buyerDelivery.confirmBuyer": "The buyer (Delivery stage)",
  "receiving.done.quality": "Quality check concluded.",
  "receiving.unit": "Counted in",
  "receiving.unit.units": "pcs",
  "receiving.unit.cartons": "cartons ({n} pcs)",
  "receiving.unit.converted": "= {n} pcs",
  "receiving.error.no_master_box":
    "This item has no master carton in the registry: count by unit.",
};

export const zh: Record<keyof typeof pt, string> = {
  "delivery.paused.title": "订单已暂停",
  "delivery.paused.channel_red":
    "清关为红色通道：订单自 {date} 起暂停，管理员恢复前不会推进。",
  "delivery.paused.channel_grey":
    "清关为灰色通道：订单自 {date} 起暂停，管理员恢复前不会推进。",
  "delivery.paused.other": "订单自 {date} 起暂停，管理员恢复前不会推进。",
  "delivery.resume": "恢复订单",
  "delivery.resumeNote": "备注（可选）",
  "delivery.resumed": "订单已恢复。",
  "delivery.port.title": "到达港和运输公司",
  "delivery.port.hint":
    "按到达港使用设置中的默认运输公司：Itapoá → {itapoa}；其他港口 → {other}。",
  "delivery.port.label": "到达港",
  "delivery.port.IOA": "Itapoá",
  "delivery.port.ITJ": "Itajaí",
  "delivery.port.NVT": "Navegantes",
  "delivery.port.OTHER": "其他港口",
  "delivery.port.save": "保存港口",
  "delivery.port.saved": "到达港已保存。",
  "delivery.carrier.suggested": "运输公司：{name}",
  "delivery.carrier.hire": "委托 {name}",
  "delivery.carrier.hired": "已为此订单委托 {name}。",
  "delivery.carrier.missing":
    "{name} 未登记为运输公司。请在合作伙伴中登记，或在设置中调整名称。",
  "delivery.notify.paused.subject": "订单 #{n} 已暂停：{channel}通道",
  "delivery.notify.paused.body":
    "清关结果为{channel}通道。订单无限期暂停，放行后由管理员恢复。",
  "settings.label.carrierItapoaName":
    "Itapoá 到港货物的默认运输公司（登记名称）",
  "settings.label.carrierDefaultName": "其他港口的默认运输公司（登记名称）",
  "orders.error.order_paused":
    "订单已暂停（灰色或红色通道）。需要管理员先恢复。",
  "importFlow.error.order_paused":
    "订单已暂停（灰色或红色通道）。需要管理员先恢复。",
  "function.quality": "质检（配送中心）",
  "function.desc.quality":
    "在配送中心按订单核对收到的货物并决定：入库或进入差异流程",
  "action.receiving.quality": "完成配送中心质检",
  "action.desc.receiving.quality":
    "收货按 SKU 计数后完成质检：无差异则入库并通知销售；有差异则通知采购并进入批次流程。",
  "quality.title": "质检（配送中心）",
  "quality.hint":
    "上方已登记按 SKU 计数后，完成质检。无差异：产品入库并通知销售。有差异：请在备注中说明，将通知采购，订单进入批次流程。",
  "quality.note": "备注（有差异时必填）",
  "quality.conclude": "完成质检",
  "quality.ok": "已核对无差异 · {date} 入库",
  "quality.divergent": "{date} 核对有差异：进入批次流程",
  "quality.waitCounts": "完成前请先登记按 SKU 计数。",
  "quality.done": "质检已完成。",
  "receiving.error.quality_counts_required": "完成质检前请登记所有项目的数量。",
  "receiving.error.quality_done": "质检已完成。",
  "receiving.error.quality_note_required": "有差异时请在备注中说明。",
  "quality.notify.stored.subject": "订单 #{n}：货物已核对并入库",
  "quality.notify.stored.body":
    "质检核对货物无差异，产品已在配送中心库存中。{note}",
  "quality.notify.divergent.subject": "订单 #{n}：配送中心货物有差异",
  "quality.notify.divergent.body":
    "质检发现收货与订单不符。{note} 进入批次流程（采购 → 供应商 → 证据 → 财务）。",
  "quality.task.title": "在配送中心核对货物：订单 #{n}",
  "quality.task.detail": "卸货已登记。请按订单核对每个 SKU 并完成质检。",
  "tasks.group.quality": "质检（配送中心）",
  "buyerDelivery.title": "送至买方配送中心",
  "buyerDelivery.hint":
    "此订单的买方不是 Wellmix：运输公司送至买方配送中心，买方在交付阶段确认收货。",
  "buyerDelivery.wellmix":
    "买方是 Wellmix：货物送至 Wellmix 配送中心（收货卡片）。",
  "buyerDelivery.buyer": "买方",
  "buyerDelivery.address": "送货地址",
  "buyerDelivery.noAddress": "客户档案中没有地址：请在 档案 → 客户 中补充。",
  "buyerDelivery.carrier": "运输公司",
  "buyerDelivery.noCarrier": "尚未指定",
  "buyerDelivery.confirm": "确认收货方",
  "buyerDelivery.confirmBuyer": "买方（交付阶段）",
  "receiving.done.quality": "质检已完成。",
  "receiving.unit": "计数单位",
  "receiving.unit.units": "件",
  "receiving.unit.cartons": "箱（{n} 件）",
  "receiving.unit.converted": "= {n} 件",
  "receiving.error.no_master_box": "该项目在资料中没有外箱数量：请按件计数。",
};
