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
};
