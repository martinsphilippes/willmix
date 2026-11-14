/**
 * Dicionário do módulo "flow" (blocos e passos do menu lateral, Overview e
 * telas dos passos; docs/FLOW_MENU.md): mesmas chaves em pt, en e zh.
 */
export const pt = {
  "flow.preproduction.title": "Pré-produção do pedido #{n}",
  "flow.preproduction.detail":
    "Sinal pago: dados da produção (fábrica ou trade) e ETD",
  "flow.receiving.title": "Recebimento do pedido #{n}",
  "flow.receiving.storage":
    "Descarga no CD: lacre, fotos, checklist e contagem por SKU",
  "flow.receiving.return":
    "RIC, devolução do container e fechamento do recebimento",
  "flow.work.receiving": "Recebimento no CD",
  "flow.work.openContract": "Abrir o documento do pedido",
  "flow.work.openSamples": "Abrir o pedido de amostras",
  "flow.work.openDieCut": "Abrir o quadro Die Cut",
  "flow.work.openSheet": "Abrir a ficha de compra",
  "flow.work.saved": "Salvo.",
  "flow.work.title": "Resolver aqui",
  "flow.work.order": "Pedido #{n}",
  "flow.work.openOrder": "Abrir o pedido completo",
  "nav.group.newProduct": "Produto novo",
  "nav.group.order": "Pedido",
  "nav.group.arrival": "Entrega",
  "nav.group.sales": "Vendas",
  "flow.overview": "Overview",
  "flow.badge": "{n} esperando ação",
  "flow.badge.overdue": "{n} esperando ação, {late} atrasada(s)",
  "flow.overview.subtitle":
    "{n} esperando ação neste bloco, {late} atrasada(s). Clique num passo para ver os casos.",
  "flow.overview.late": "{n} atrasada(s)",
  "flow.overview.days": "média {avg} d · mais antiga {max} d",
  "flow.overview.openStep": "Abrir a tela do passo",
  "flow.step.back": "Voltar ao Overview de {block}",
  "flow.cases.empty": "Nada esperando ação neste passo.",
  "flow.cases.what": "O que espera",
  "flow.cases.due": "Prazo",
  "flow.cases.since": "Há",
  "flow.cases.days": "{n} dia(s)",
  "flow.cases.open": "Resolver",
  "flow.cases.filter": "Filtrar por prazo",
  "flow.due.all": "Todas",
  "flow.due.overdue": "Atrasadas",
  "flow.due.today": "Hoje",
  "flow.due.week": "Até 7 dias",
  "settings.superplan.body":
    "Estudo de viabilidade de um produto (passo B3 do mapa). Saiu do menu lateral e fica aqui.",
  "settings.superplan.open": "Abrir o Superplan",
  "flow.block.new-product": "Produto novo",
  "flow.block.order": "Pedido",
  "flow.block.production": "Produção",
  "flow.block.delivery": "Entrega",
  "flow.block.sales": "Vendas",
  "flow.block.finance": "Financeiro",
  "flow.block.registry": "Cadastros",
  "flow.step.new-product.books": "Books",
  "flow.help.new-product.books":
    "Books recebidos do GP, da Wellmix, da trading ou do fornecedor (B1, B2, B11).",
  "flow.step.new-product.selection": "Seleção de itens",
  "flow.help.new-product.selection":
    "Itens dos books comparados e escolhidos, com o produto filho (B4).",
  "flow.step.new-product.quotes": "Cotações",
  "flow.help.new-product.quotes":
    "Convites de book: o fornecedor manda a cotação do item (B7).",
  "flow.step.new-product.negotiations": "Negociações",
  "flow.help.new-product.negotiations":
    "Solicitações ao fornecedor: análise, negociação e amostragem até a aprovação da amostra (B7 a B9).",
  "flow.step.order.orders": "Pedidos",
  "flow.help.order.orders":
    "Pedidos de compra: confirmação, programação de compra e ficha do pedido (P2, P3).",
  "flow.step.order.certification": "Certificação",
  "flow.help.order.certification":
    "Certificação com o OCP e o selo, quando a linha exige (P6, P8, P15).",
  "flow.step.order.art-material": "Material de arte",
  "flow.help.order.art-material":
    "Die cut e foto em alta do fornecedor, com pedido mínimo e prazo (P4).",
  "flow.step.order.art": "Arte",
  "flow.help.order.art":
    "Arte, validação da Wellmix e arte final com o selo (P5, P5?, P7).",
  "flow.step.order.review": "Revisão",
  "flow.help.order.review": "Pedidos na fila de revisão.",
  "flow.step.order.contract": "Contrato",
  "flow.help.order.contract":
    "Documento do pedido, contratos de amostras e as duas assinaturas (P10, P11, P17).",
  "flow.step.production.pre-production": "Pré-produção",
  "flow.help.production.pre-production":
    "Do sinal pago ao início da produção: pedidos de compra sem os dados da produção e o ETD.",
  "flow.step.production.inspection": "Inspeção",
  "flow.help.production.inspection":
    "Fotos, peso e vídeo da produção, conformidade e aprovação dos SKUs (R3, R4?, R10).",
  "flow.step.production.sample": "Amostra",
  "flow.help.production.sample":
    "Retirada e envio das amostras ao Brasil e à agência na China, fotos reais e devolução (R12 a R16).",
  "flow.step.production.production": "Produção",
  "flow.help.production.production":
    "Acompanhamento da produção: follows 5/15/25 e ETD (R1, R11).",
  "flow.step.production.booking": "Booking",
  "flow.help.production.booking": "Booking com a marítima (R8).",
  "flow.step.production.logistics": "Logística",
  "flow.help.production.logistics":
    "Transportadora, cotação de frete e container no depósito da fábrica (R17, R19).",
  "flow.step.production.loading": "Carregamento",
  "flow.help.production.loading":
    "Fotos e vídeos do container, carregamento, lacre e número (R20, R7, R25).",
  "flow.step.production.cargo-docs": "Documentos de carga",
  "flow.help.production.cargo-docs":
    "Check list, packing list, invoice e BL conferidos linha a linha (R21 a R23?).",
  "flow.step.production.shipment": "Embarque",
  "flow.help.production.shipment":
    "Container de volta ao porto, rastreio e embarque (R26, R27).",
  "flow.step.delivery.lpco": "LPCO",
  "flow.help.delivery.lpco":
    "Licenças, permissões e certificados da importação (E5). Ainda sem pendências no sistema.",
  "flow.step.delivery.cargo-presence": "Presença de carga",
  "flow.help.delivery.cargo-presence":
    "Presença de carga, numerário, DI, despacho e liberação (E6, E7).",
  "flow.step.delivery.channel": "Canal cinza ou vermelho",
  "flow.help.delivery.channel":
    "Canal de parametrização e o alerta de canal cinza ou vermelho (E7?, E11).",
  "flow.step.delivery.logistics": "Logística",
  "flow.help.delivery.logistics":
    "Transportadora do porto de chegada e programação da entrega (E12 a E15).",
  "flow.step.delivery.invoice": "Nota fiscal",
  "flow.help.delivery.invoice": "Emissão da nota fiscal (E16).",
  "flow.step.delivery.delivery": "Entrega",
  "flow.help.delivery.delivery":
    "Entrega no CD da Wellmix ou do comprador e confirmação do recebimento (E9, E18).",
  "flow.step.delivery.return": "Retorno",
  "flow.help.delivery.return":
    "RIC da transportadora, devolução do container e fechamento do recebimento (E19, E20).",
  "flow.step.delivery.storage": "Armazenagem",
  "flow.help.delivery.storage":
    "Descarga no CD, lacre, fotos, checklist e contagem por SKU, antes do lote e do armazenamento (E21, E22).",
  "flow.step.sales.stock": "Estoque",
  "flow.help.sales.stock": "Estoque em produção, em trânsito e no Brasil.",
  "flow.step.sales.samples": "Amostras",
  "flow.help.sales.samples":
    "Oferta de amostras aos clientes (E23). Ainda sem pendências no sistema.",
  "flow.step.sales.offers": "Ofertas",
  "flow.help.sales.offers":
    "Oferta ativa aos clientes e oferta na vitrine (V2, V5). Ainda sem pendências no sistema.",
  "flow.step.sales.sale": "Venda",
  "flow.help.sales.sale":
    "Pedidos de clientes, ordem de venda e pós-venda (V6, V7, E10).",
  "flow.step.finance.finance": "Financeiro",
  "flow.help.finance.finance":
    "Sinal ao fornecedor, pagamentos e faturas a vencer.",
  "flow.step.registry.products": "Produtos",
  "flow.help.registry.products":
    "NCM a classificar e fichas mestre incompletas.",
};

export const en: Record<keyof typeof pt, string> = {
  "flow.preproduction.title": "Pre-production for order #{n}",
  "flow.preproduction.detail":
    "Down payment cleared: production data (factory or trade) and ETD",
  "flow.receiving.title": "Receiving for order #{n}",
  "flow.receiving.storage":
    "Unloading at the DC: seal, photos, checklist and count per SKU",
  "flow.receiving.return":
    "Container receipt, container return and closing the receiving",
  "flow.work.receiving": "Receiving at the DC",
  "flow.work.openContract": "Open the order document",
  "flow.work.openSamples": "Open the sample order",
  "flow.work.openDieCut": "Open the Die Cut board",
  "flow.work.openSheet": "Open the purchase sheet",
  "flow.work.saved": "Saved.",
  "flow.work.title": "Resolve here",
  "flow.work.order": "Order #{n}",
  "flow.work.openOrder": "Open the full order",
  "nav.group.newProduct": "New product",
  "nav.group.order": "Order",
  "nav.group.arrival": "Delivery",
  "nav.group.sales": "Sales",
  "flow.overview": "Overview",
  "flow.badge": "{n} awaiting action",
  "flow.badge.overdue": "{n} awaiting action, {late} overdue",
  "flow.overview.subtitle":
    "{n} awaiting action in this block, {late} overdue. Click a step to see its cases.",
  "flow.overview.late": "{n} overdue",
  "flow.overview.days": "avg {avg} d · oldest {max} d",
  "flow.overview.openStep": "Open the step screen",
  "flow.step.back": "Back to the {block} overview",
  "flow.cases.empty": "Nothing awaiting action in this step.",
  "flow.cases.what": "What is waiting",
  "flow.cases.due": "Due",
  "flow.cases.since": "Waiting",
  "flow.cases.days": "{n} day(s)",
  "flow.cases.open": "Resolve",
  "flow.cases.filter": "Filter by due date",
  "flow.due.all": "All",
  "flow.due.overdue": "Overdue",
  "flow.due.today": "Today",
  "flow.due.week": "Within 7 days",
  "settings.superplan.body":
    "Product feasibility study (map step B3). It left the sidebar and lives here.",
  "settings.superplan.open": "Open Superplan",
  "flow.block.new-product": "New product",
  "flow.block.order": "Order",
  "flow.block.production": "Production",
  "flow.block.delivery": "Delivery",
  "flow.block.sales": "Sales",
  "flow.block.finance": "Finance",
  "flow.block.registry": "Master data",
  "flow.step.new-product.books": "Books",
  "flow.help.new-product.books":
    "Books received from the PM, Wellmix, trading company or supplier (B1, B2, B11).",
  "flow.step.new-product.selection": "Item selection",
  "flow.help.new-product.selection":
    "Book items compared and chosen, with the child product (B4).",
  "flow.step.new-product.quotes": "Quotes",
  "flow.help.new-product.quotes":
    "Book invitations: the supplier sends the item quote (B7).",
  "flow.step.new-product.negotiations": "Negotiations",
  "flow.help.new-product.negotiations":
    "Supplier requests: review, negotiation and sampling up to sample approval (B7 to B9).",
  "flow.step.order.orders": "Orders",
  "flow.help.order.orders":
    "Purchase orders: confirmation, purchase schedule and order sheet (P2, P3).",
  "flow.step.order.certification": "Certification",
  "flow.help.order.certification":
    "Certification with the body and seal, when the line requires it (P6, P8, P15).",
  "flow.step.order.art-material": "Art material",
  "flow.help.order.art-material":
    "Supplier die cut and high-res photo, with minimum order and lead time (P4).",
  "flow.step.order.art": "Artwork",
  "flow.help.order.art":
    "Artwork, Wellmix review and final art with the seal (P5, P5?, P7).",
  "flow.step.order.review": "Review",
  "flow.help.order.review": "Orders in the review queue.",
  "flow.step.order.contract": "Contract",
  "flow.help.order.contract":
    "Order document, sample contracts and both signatures (P10, P11, P17).",
  "flow.step.production.pre-production": "Pre-production",
  "flow.help.production.pre-production":
    "From the down payment to the start of production: purchase orders without production data and ETD.",
  "flow.step.production.inspection": "Inspection",
  "flow.help.production.inspection":
    "Production photos, weight and video, conformity and SKU approval (R3, R4?, R10).",
  "flow.step.production.sample": "Sample",
  "flow.help.production.sample":
    "Sample pickup, shipping to Brazil and to the agency in China, real photos and return (R12 to R16).",
  "flow.step.production.production": "Production",
  "flow.help.production.production":
    "Production follow-up: 5/15/25 follows and ETD (R1, R11).",
  "flow.step.production.booking": "Booking",
  "flow.help.production.booking": "Booking with the shipping line (R8).",
  "flow.step.production.logistics": "Logistics",
  "flow.help.production.logistics":
    "Carrier, freight quote and container at the factory yard (R17, R19).",
  "flow.step.production.loading": "Loading",
  "flow.help.production.loading":
    "Container photos and videos, loading, seal and number (R20, R7, R25).",
  "flow.step.production.cargo-docs": "Cargo documents",
  "flow.help.production.cargo-docs":
    "Check list, packing list, invoice and BL checked line by line (R21 to R23?).",
  "flow.step.production.shipment": "Shipment",
  "flow.help.production.shipment":
    "Container back at the port, tracking and shipment (R26, R27).",
  "flow.step.delivery.lpco": "LPCO",
  "flow.help.delivery.lpco":
    "Import licences, permits and certificates (E5). No tasks in the system yet.",
  "flow.step.delivery.cargo-presence": "Cargo presence",
  "flow.help.delivery.cargo-presence":
    "Cargo presence, customs advance, import declaration, clearance and release (E6, E7).",
  "flow.step.delivery.channel": "Grey or red channel",
  "flow.help.delivery.channel":
    "Customs channel and the grey or red channel alert (E7?, E11).",
  "flow.step.delivery.logistics": "Logistics",
  "flow.help.delivery.logistics":
    "Carrier from the arrival port and delivery scheduling (E12 to E15).",
  "flow.step.delivery.invoice": "Invoice (NF)",
  "flow.help.delivery.invoice": "Issuing the invoice (E16).",
  "flow.step.delivery.delivery": "Delivery",
  "flow.help.delivery.delivery":
    "Delivery to the Wellmix or buyer DC and receipt confirmation (E9, E18).",
  "flow.step.delivery.return": "Return",
  "flow.help.delivery.return":
    "Carrier container receipt, container return and closing the receiving (E19, E20).",
  "flow.step.delivery.storage": "Storage",
  "flow.help.delivery.storage":
    "Unloading at the DC, seal, photos, checklist and count per SKU, before lot and storage (E21, E22).",
  "flow.step.sales.stock": "Inventory",
  "flow.help.sales.stock": "Inventory in production, in transit and in Brazil.",
  "flow.step.sales.samples": "Samples",
  "flow.help.sales.samples":
    "Offering samples to customers (E23). No tasks in the system yet.",
  "flow.step.sales.offers": "Offers",
  "flow.help.sales.offers":
    "Active offers to customers and storefront offers (V2, V5). No tasks in the system yet.",
  "flow.step.sales.sale": "Sale",
  "flow.help.sales.sale":
    "Customer requests, sales order and after-sales (V6, V7, E10).",
  "flow.step.finance.finance": "Finance",
  "flow.help.finance.finance":
    "Supplier down payment, payments and invoices due.",
  "flow.step.registry.products": "Products",
  "flow.help.registry.products":
    "NCM to classify and incomplete master sheets.",
};

export const zh: Record<keyof typeof pt, string> = {
  "flow.preproduction.title": "订单 #{n} 产前",
  "flow.preproduction.detail": "定金已付：生产信息（工厂或贸易）和 ETD",
  "flow.receiving.title": "订单 #{n} 收货",
  "flow.receiving.storage": "配送中心卸货：铅封、照片、检查表和按 SKU 清点",
  "flow.receiving.return": "设备交接单、还柜和收货结单",
  "flow.work.receiving": "配送中心收货",
  "flow.work.openContract": "打开订单文件",
  "flow.work.openSamples": "打开样品订单",
  "flow.work.openDieCut": "打开刀模图面板",
  "flow.work.openSheet": "打开采购表",
  "flow.work.saved": "已保存。",
  "flow.work.title": "在此处理",
  "flow.work.order": "订单 #{n}",
  "flow.work.openOrder": "打开完整订单",
  "nav.group.newProduct": "新产品",
  "nav.group.order": "订单",
  "nav.group.arrival": "交付",
  "nav.group.sales": "销售",
  "flow.overview": "概览",
  "flow.badge": "{n} 项待处理",
  "flow.badge.overdue": "{n} 项待处理，{late} 项逾期",
  "flow.overview.subtitle":
    "本模块 {n} 项待处理，{late} 项逾期。点击环节查看明细。",
  "flow.overview.late": "{n} 项逾期",
  "flow.overview.days": "平均 {avg} 天 · 最久 {max} 天",
  "flow.overview.openStep": "打开该环节页面",
  "flow.step.back": "返回{block}概览",
  "flow.cases.empty": "该环节暂无待处理事项。",
  "flow.cases.what": "待处理事项",
  "flow.cases.due": "期限",
  "flow.cases.since": "已等待",
  "flow.cases.days": "{n} 天",
  "flow.cases.open": "处理",
  "flow.cases.filter": "按期限筛选",
  "flow.due.all": "全部",
  "flow.due.overdue": "逾期",
  "flow.due.today": "今天",
  "flow.due.week": "7 天内",
  "settings.superplan.body":
    "产品可行性研究（流程图 B3）。已从侧边栏移到这里。",
  "settings.superplan.open": "打开 Superplan",
  "flow.block.new-product": "新产品",
  "flow.block.order": "订单",
  "flow.block.production": "生产",
  "flow.block.delivery": "交付",
  "flow.block.sales": "销售",
  "flow.block.finance": "财务",
  "flow.block.registry": "档案",
  "flow.step.new-product.books": "Book",
  "flow.help.new-product.books":
    "来自产品经理、Wellmix、贸易商或供应商的 Book（B1、B2、B11）。",
  "flow.step.new-product.selection": "选品",
  "flow.help.new-product.selection": "比较并选定 Book 中的商品及子商品（B4）。",
  "flow.step.new-product.quotes": "报价",
  "flow.help.new-product.quotes": "Book 邀请：供应商提交商品报价（B7）。",
  "flow.step.new-product.negotiations": "谈判",
  "flow.help.new-product.negotiations":
    "供应商请求：分析、谈判和打样，直到样品批准（B7–B9）。",
  "flow.step.order.orders": "订单",
  "flow.help.order.orders": "采购订单：确认、采购排期和订单表（P2、P3）。",
  "flow.step.order.certification": "认证",
  "flow.help.order.certification":
    "产品线需要时，由认证机构认证并加贴标志（P6、P8、P15）。",
  "flow.step.order.art-material": "设计素材",
  "flow.help.order.art-material":
    "供应商刀模图和高清照片，以及起订量和交期（P4）。",
  "flow.step.order.art": "设计稿",
  "flow.help.order.art": "设计稿、Wellmix 审核和带标志的终稿（P5、P5?、P7）。",
  "flow.step.order.review": "审核",
  "flow.help.order.review": "待审核的订单。",
  "flow.step.order.contract": "合同",
  "flow.help.order.contract": "订单文件、样品合同和双方签字（P10、P11、P17）。",
  "flow.step.production.pre-production": "产前",
  "flow.help.production.pre-production":
    "从支付定金到开始生产：尚未填写生产信息和 ETD 的采购订单。",
  "flow.step.production.inspection": "验货",
  "flow.help.production.inspection":
    "生产照片、重量和视频，合规声明及 SKU 批准（R3、R4?、R10）。",
  "flow.step.production.sample": "样品",
  "flow.help.production.sample":
    "样品提取、寄往巴西和中国代理、实拍照片及退回（R12–R16）。",
  "flow.step.production.production": "生产",
  "flow.help.production.production":
    "生产跟进：5/15/25 跟单和 ETD（R1、R11）。",
  "flow.step.production.booking": "订舱",
  "flow.help.production.booking": "向船公司订舱（R8）。",
  "flow.step.production.logistics": "物流",
  "flow.help.production.logistics":
    "承运商、运费报价和工厂堆场的集装箱（R17、R19）。",
  "flow.step.production.loading": "装柜",
  "flow.help.production.loading":
    "集装箱照片和视频、装柜、铅封和柜号（R20、R7、R25）。",
  "flow.step.production.cargo-docs": "货运单据",
  "flow.help.production.cargo-docs":
    "逐行核对检查表、装箱单、发票和提单（R21–R23?）。",
  "flow.step.production.shipment": "装船",
  "flow.help.production.shipment": "集装箱返港、跟踪和装船（R26、R27）。",
  "flow.step.delivery.lpco": "LPCO",
  "flow.help.delivery.lpco": "进口许可证和证书（E5）。系统中暂无待办。",
  "flow.step.delivery.cargo-presence": "货物到港",
  "flow.help.delivery.cargo-presence":
    "货物到港、清关预付款、进口申报、清关和放行（E6、E7）。",
  "flow.step.delivery.channel": "灰色或红色通道",
  "flow.help.delivery.channel":
    "海关查验通道及灰色或红色通道警报（E7?、E11）。",
  "flow.step.delivery.logistics": "物流",
  "flow.help.delivery.logistics": "到港承运商和送货排期（E12–E15）。",
  "flow.step.delivery.invoice": "发票（NF）",
  "flow.help.delivery.invoice": "开具发票（E16）。",
  "flow.step.delivery.delivery": "交付",
  "flow.help.delivery.delivery":
    "送达 Wellmix 或买家配送中心并确认收货（E9、E18）。",
  "flow.step.delivery.return": "返回",
  "flow.help.delivery.return": "承运商设备交接单、还柜和收货结单（E19、E20）。",
  "flow.step.delivery.storage": "仓储",
  "flow.help.delivery.storage":
    "配送中心卸货、铅封、照片、检查表和按 SKU 清点，之后入批次和仓储（E21、E22）。",
  "flow.step.sales.stock": "库存",
  "flow.help.sales.stock": "生产中、在途和巴西的库存。",
  "flow.step.sales.samples": "样品",
  "flow.help.sales.samples": "向客户提供样品（E23）。系统中暂无待办。",
  "flow.step.sales.offers": "报价推广",
  "flow.help.sales.offers":
    "主动向客户推荐和橱窗推荐（V2、V5）。系统中暂无待办。",
  "flow.step.sales.sale": "销售",
  "flow.help.sales.sale": "客户需求、销售订单和售后（V6、V7、E10）。",
  "flow.step.finance.finance": "财务",
  "flow.help.finance.finance": "供应商定金、付款和到期发票。",
  "flow.step.registry.products": "产品",
  "flow.help.registry.products": "待归类的 NCM 和不完整的主数据表。",
};
