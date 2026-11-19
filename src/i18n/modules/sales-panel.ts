/**
 * Dicionário do módulo "salesPanel": base de vendas do Sankhya e o painel do
 * cliente e do grupo (dono, 19/11/2026; docs/TRADE_COMERCIAL.md, PRs 3 e 4;
 * as telas 01 a 11 do painel do Projeto Campineira).
 */
export const pt = {
  "nav.salesPanel": "Painel comercial",
  "salesPanel.title": "Painel comercial",
  "salesPanel.titleOf": "Painel · {name}",
  "salesPanel.subtitle":
    "Vendas do Sankhya por mês, produto e cliente (peças pedidas): as telas do painel do Projeto Campineira, agora com a venda real.",
  "salesPanel.choose.title": "Escolha o grupo ou o cliente",
  "salesPanel.choose.groups": "Grupos econômicos",
  "salesPanel.choose.customers": "Clientes da carteira",
  "salesPanel.choose.empty":
    "Nenhum grupo ou cliente acompanhado ainda. Monte os grupos em Carteira e atendimento → Grupos econômicos.",
  "salesPanel.scope.group": "Grupo econômico",
  "salesPanel.scope.customer": "Cliente",
  "salesPanel.customersCount": "{n} clientes",
  "salesPanel.customersOne": "1 cliente",
  "salesPanel.loaded": "Vendas atualizadas em {date}",
  "salesPanel.neverLoaded":
    'As vendas ainda não foram carregadas do Sankhya. Use "Atualizar agora" (quem gere a carteira) ou espere a carga da noite.',
  "salesPanel.loadError": "{customer}: a última leitura falhou ({message}).",
  "salesPanel.noCode": "{customer} está sem código do Sankhya no cadastro.",
  "salesPanel.incomplete":
    "{customer}: a base passou do limite de leitura; os totais podem estar menores.",
  "salesPanel.refresh": "Atualizar agora",
  "salesPanel.refreshHint":
    "Lê de novo as vendas no Sankhya (alguns segundos por cliente). A carga também roda toda noite.",
  "salesPanel.notice.refreshed":
    "Vendas atualizadas: {ok} de {total} cliente(s).",
  "salesPanel.notConfigured":
    "O Sankhya não está configurado: sem a base de vendas, o painel fica vazio.",
  "salesPanel.empty": "Sem vendas na base para este recorte.",
  "salesPanel.unconverted":
    "{n} linha(s) vendidas numa unidade sem conversão para peças ficaram fora das peças.",
  "salesPanel.openPanel": "Painel",
  "salesPanel.back": "← Painel comercial",

  "salesPanel.tab.executive": "01 · Visão executiva",
  "salesPanel.tab.ranking": "02 · Ranking de produtos",
  "salesPanel.tab.abc": "03 · Curva ABC",
  "salesPanel.tab.frequency": "04 · Frequência por SKU",
  "salesPanel.tab.period": "05 · Análise por período",
  "salesPanel.tab.compare": "06 · Comparativo anual",
  "salesPanel.tab.mix": "07 · Mix e categorias",
  "salesPanel.tab.stock": "08 · Estoque e disponibilidade",
  "salesPanel.tab.lifecycle": "09 · Ciclo de vida",
  "salesPanel.tab.customers": "10 · Clientes",
  "salesPanel.tab.diagnosis": "11 · Diagnóstico",
  "salesPanel.tab.plan": "12 · Plano de ação",

  "salesPanel.filter.year": "Ano",
  "salesPanel.filter.allYears": "Todos",
  "salesPanel.filter.quarter": "Trimestre",
  "salesPanel.filter.allQuarters": "Ano todo",
  "salesPanel.filter.q1": "1º trimestre",
  "salesPanel.filter.q2": "2º trimestre",
  "salesPanel.filter.q3": "3º trimestre",
  "salesPanel.filter.q4": "4º trimestre",
  "salesPanel.filter.group": "Grupo de produto",
  "salesPanel.filter.allGroups": "Todos os grupos",
  "salesPanel.filter.search": "SKU, produto ou cliente",
  "salesPanel.filter.customer": "Cliente",
  "salesPanel.filter.allCustomers": "Todos",
  "salesPanel.filter.apply": "Filtrar",
  "salesPanel.export": "Exportar CSV",

  "salesPanel.kpi.pieces": "Peças pedidas",
  "salesPanel.kpi.skus": "SKUs distintos",
  "salesPanel.kpi.customers": "Clientes com compra",
  "salesPanel.kpi.top10": "Concentração Top 10",
  "salesPanel.kpi.orders": "Pedidos",
  "salesPanel.kpi.value": "Valor (R$)",

  "salesPanel.chart.top10": "Top 10 produtos por peças",
  "salesPanel.chart.groups": "Peças por grupo",
  "salesPanel.chart.categories": "Peças por categoria",
  "salesPanel.chart.reach": "Produtos com mais clientes",
  "salesPanel.chart.variety": "Clientes com mais SKUs",
  "salesPanel.chart.months": "Peças por mês",
  "salesPanel.chart.quarters": "Peças por trimestre",
  "salesPanel.chart.stockTop": "Maior estoque livre no Brasil",
  "salesPanel.chart.noStock": "Comprados e sem estoque livre",
  "salesPanel.chart.recency": "SKUs por tempo desde a última compra",
  "salesPanel.chart.customersPieces": "Clientes por peças",

  "salesPanel.col.sku": "SKU",
  "salesPanel.col.code": "Código",
  "salesPanel.col.product": "Produto",
  "salesPanel.col.group": "Grupo",
  "salesPanel.col.category": "Categoria",
  "salesPanel.col.pieces": "Peças",
  "salesPanel.col.customers": "Clientes",
  "salesPanel.col.orders": "Pedidos",
  "salesPanel.col.last": "Última compra",
  "salesPanel.col.share": "Participação",
  "salesPanel.col.cumulative": "Acumulado",
  "salesPanel.col.class": "Classe",
  "salesPanel.col.value": "Valor (R$)",
  "salesPanel.col.free": "Livre no Brasil",
  "salesPanel.col.transit": "Em trânsito",
  "salesPanel.col.production": "Em produção",
  "salesPanel.col.days": "Dias sem compra",
  "salesPanel.col.recency": "Recência",
  "salesPanel.col.customer": "Cliente",
  "salesPanel.col.month": "Mês",
  "salesPanel.col.skus": "SKUs",
  "salesPanel.col.focus": "Foco",

  "salesPanel.abc.class": "Classe {c}",
  "salesPanel.abc.note":
    "Curva ABC pelas peças pedidas: A até 80% do volume, B até 95%, C o resto. Recalcula com os filtros.",
  "salesPanel.abc.filter": "Classe",
  "salesPanel.abc.all": "Todas",
  "salesPanel.abc.skus": "{n} SKUs",

  "salesPanel.freq.pairs": "Pares SKU–cliente",
  "salesPanel.freq.multi": "SKUs em 2+ clientes",
  "salesPanel.freq.avg": "Média de SKUs por cliente",
  "salesPanel.freq.repurchase": "Recompra",
  "salesPanel.freq.repurchaseHint":
    "Pares SKU–cliente com dois pedidos ou mais: {n} de {total}.",

  "salesPanel.period.note":
    "Vendas reais pela data do pedido (peças pedidas). O HTML só tinha a data da última compra; aqui é o pedido mês a mês.",

  "salesPanel.compare.yearA": "Ano base",
  "salesPanel.compare.yearB": "Comparar com",
  "salesPanel.compare.total":
    "Mesmos meses ({n}): {a} peças em {ya} × {b} peças em {yb}",
  "salesPanel.compare.change": "Variação: {pct}",
  "salesPanel.compare.none": "A base ainda não tem os dois anos.",

  "salesPanel.stock.with": "SKUs com estoque livre",
  "salesPanel.stock.without": "SKUs sem estoque livre",
  "salesPanel.stock.soldWithout": "Comprados e sem estoque",
  "salesPanel.stock.coming": "Sem estoque, mas chegando",
  "salesPanel.stock.note":
    "Estoque do portal (tela Estoque): livre no Brasil = físico menos as reservas; em trânsito e em produção pelos containers e pedidos.",
  "salesPanel.stock.outCatalog": "fora do catálogo do portal",
  "salesPanel.stock.none":
    "Nenhum produto do recorte com estoque livre no Brasil.",
  "salesPanel.stock.allStocked":
    "Todos os produtos comprados têm estoque livre.",

  "salesPanel.life.d90": "Até 90 dias",
  "salesPanel.life.d180": "91 a 180 dias",
  "salesPanel.life.d365": "181 a 365 dias",
  "salesPanel.life.older": "Mais de 1 ano",
  "salesPanel.life.note":
    "Dias desde a última compra de cada SKU até hoje (data do pedido no Sankhya).",

  "salesPanel.customers.note":
    "Clientes do recorte: peças, SKUs, pedidos e dias desde a última compra.",

  "salesPanel.diag.focus": "Foco",
  "salesPanel.diag.focus.leaders": "Proteger Top 10",
  "salesPanel.diag.focus.reach": "Ampliar alcance",
  "salesPanel.diag.focus.low": "Investigar baixo volume",
  "salesPanel.diag.focus.recency": "Sem compra há mais de 180 dias",
  "salesPanel.diag.focus.growth": "Validar crescimento",
  "salesPanel.diag.focus.all": "Todos os SKUs",
  "salesPanel.diag.prompt": "Pergunta",
  "salesPanel.diag.action": "Ação proposta",
  "salesPanel.diag.evidence": "Evidência necessária",
  "salesPanel.diag.create": "Criar ação no plano",
  "salesPanel.diag.inPlan": "No plano: {status}",
  "salesPanel.diag.count": "{n} SKU(s) · mostrando até 18",
  "salesPanel.diag.note":
    "Hipóteses a partir das vendas (peças, clientes e última compra), como no HTML: confirme na loja antes de decidir.",
  "salesPanel.diag.line":
    "{pieces} peças · {customers} cliente(s) · última compra {date}",
  "salesPanel.diag.leaders.title": "Proteger o produto líder",
  "salesPanel.diag.leaders.prompt":
    "Este SKU está exposto e disponível nas lojas prioritárias? Qual evidência comprova?",
  "salesPanel.diag.leaders.action":
    "Auditar exposição, estoque de loja e reposição",
  "salesPanel.diag.leaders.evidence":
    "Foto de gôndola, estoque por loja e sell-out",
  "salesPanel.diag.reach.title": "Investigar alcance restrito",
  "salesPanel.diag.reach.prompt":
    "Por que este SKU aparece em apenas um cliente do grupo? Há espaço para um piloto?",
  "salesPanel.diag.reach.action": "Selecionar lojas e testar ampliação de mix",
  "salesPanel.diag.reach.evidence":
    "Lojas elegíveis, presença atual e sell-out",
  "salesPanel.diag.low.title": "Testar potencial antes de descartar",
  "salesPanel.diag.low.prompt":
    "O baixo volume decorre de exposição, preço, distribuição ou demanda?",
  "salesPanel.diag.low.action":
    "Definir teste de exposição com critério de sucesso",
  "salesPanel.diag.low.evidence":
    "Preço de gôndola, foto, sell-out antes/depois",
  "salesPanel.diag.recency.title": "Retomar o produto parado",
  "salesPanel.diag.recency.prompt":
    "Por que o cliente parou de comprar este SKU: ruptura, troca de mix ou concorrência?",
  "salesPanel.diag.recency.action":
    "Verificar estoque, exposição e preço; propor a recompra",
  "salesPanel.diag.recency.evidence":
    "Estoque de loja, foto de gôndola e pedido de recompra",
  "salesPanel.diag.growth.title": "Validar oportunidade de crescimento",
  "salesPanel.diag.growth.prompt":
    "A distribuição e a execução de loja estão compatíveis com o volume observado?",
  "salesPanel.diag.growth.action":
    "Comparar presença, ruptura e oportunidades de mix",
  "salesPanel.diag.growth.evidence": "Sell-out e disponibilidade por loja",

  "portfolio.col.lastPurchase": "Última compra",
  "portfolio.daysSince": "há {n} dias",
  "portfolio.panelLink": "Painel do cliente",
  "portfolio.groups.panelLink": "Painel do grupo",
};

export const en: Record<keyof typeof pt, string> = {
  "nav.salesPanel": "Sales panel",
  "salesPanel.title": "Sales panel",
  "salesPanel.titleOf": "Panel · {name}",
  "salesPanel.subtitle":
    "Sankhya sales by month, product and customer (ordered pieces): the screens of the Campineira Project panel, now with real sales.",
  "salesPanel.choose.title": "Choose the group or the customer",
  "salesPanel.choose.groups": "Economic groups",
  "salesPanel.choose.customers": "Followed customers",
  "salesPanel.choose.empty":
    "No followed group or customer yet. Build the groups in Accounts and customer service → Economic groups.",
  "salesPanel.scope.group": "Economic group",
  "salesPanel.scope.customer": "Customer",
  "salesPanel.customersCount": "{n} customers",
  "salesPanel.customersOne": "1 customer",
  "salesPanel.loaded": "Sales updated on {date}",
  "salesPanel.neverLoaded":
    'Sales have not been loaded from Sankhya yet. Use "Update now" (account managers) or wait for the nightly load.',
  "salesPanel.loadError": "{customer}: the last read failed ({message}).",
  "salesPanel.noCode": "{customer} has no Sankhya code in the registry.",
  "salesPanel.incomplete":
    "{customer}: the base went over the read limit; totals may be lower.",
  "salesPanel.refresh": "Update now",
  "salesPanel.refreshHint":
    "Reads the sales from Sankhya again (a few seconds per customer). The load also runs every night.",
  "salesPanel.notice.refreshed": "Sales updated: {ok} of {total} customer(s).",
  "salesPanel.notConfigured":
    "Sankhya is not configured: without the sales base, the panel stays empty.",
  "salesPanel.empty": "No sales in the base for this selection.",
  "salesPanel.unconverted":
    "{n} line(s) sold in a unit with no conversion to pieces were left out of the pieces.",
  "salesPanel.openPanel": "Panel",
  "salesPanel.back": "← Sales panel",

  "salesPanel.tab.executive": "01 · Executive view",
  "salesPanel.tab.ranking": "02 · Product ranking",
  "salesPanel.tab.abc": "03 · ABC curve",
  "salesPanel.tab.frequency": "04 · Frequency per SKU",
  "salesPanel.tab.period": "05 · Period analysis",
  "salesPanel.tab.compare": "06 · Year over year",
  "salesPanel.tab.mix": "07 · Mix and categories",
  "salesPanel.tab.stock": "08 · Stock and availability",
  "salesPanel.tab.lifecycle": "09 · Life cycle",
  "salesPanel.tab.customers": "10 · Customers",
  "salesPanel.tab.diagnosis": "11 · Diagnosis",
  "salesPanel.tab.plan": "12 · Action plan",

  "salesPanel.filter.year": "Year",
  "salesPanel.filter.allYears": "All",
  "salesPanel.filter.quarter": "Quarter",
  "salesPanel.filter.allQuarters": "Whole year",
  "salesPanel.filter.q1": "1st quarter",
  "salesPanel.filter.q2": "2nd quarter",
  "salesPanel.filter.q3": "3rd quarter",
  "salesPanel.filter.q4": "4th quarter",
  "salesPanel.filter.group": "Product group",
  "salesPanel.filter.allGroups": "All groups",
  "salesPanel.filter.search": "SKU, product or customer",
  "salesPanel.filter.customer": "Customer",
  "salesPanel.filter.allCustomers": "All",
  "salesPanel.filter.apply": "Filter",
  "salesPanel.export": "Export CSV",

  "salesPanel.kpi.pieces": "Ordered pieces",
  "salesPanel.kpi.skus": "Distinct SKUs",
  "salesPanel.kpi.customers": "Customers who bought",
  "salesPanel.kpi.top10": "Top 10 concentration",
  "salesPanel.kpi.orders": "Orders",
  "salesPanel.kpi.value": "Value (R$)",

  "salesPanel.chart.top10": "Top 10 products by pieces",
  "salesPanel.chart.groups": "Pieces by group",
  "salesPanel.chart.categories": "Pieces by category",
  "salesPanel.chart.reach": "Products with most customers",
  "salesPanel.chart.variety": "Customers with most SKUs",
  "salesPanel.chart.months": "Pieces by month",
  "salesPanel.chart.quarters": "Pieces by quarter",
  "salesPanel.chart.stockTop": "Largest free stock in Brazil",
  "salesPanel.chart.noStock": "Bought and without free stock",
  "salesPanel.chart.recency": "SKUs by time since last purchase",
  "salesPanel.chart.customersPieces": "Customers by pieces",

  "salesPanel.col.sku": "SKU",
  "salesPanel.col.code": "Code",
  "salesPanel.col.product": "Product",
  "salesPanel.col.group": "Group",
  "salesPanel.col.category": "Category",
  "salesPanel.col.pieces": "Pieces",
  "salesPanel.col.customers": "Customers",
  "salesPanel.col.orders": "Orders",
  "salesPanel.col.last": "Last purchase",
  "salesPanel.col.share": "Share",
  "salesPanel.col.cumulative": "Cumulative",
  "salesPanel.col.class": "Class",
  "salesPanel.col.value": "Value (R$)",
  "salesPanel.col.free": "Free in Brazil",
  "salesPanel.col.transit": "In transit",
  "salesPanel.col.production": "In production",
  "salesPanel.col.days": "Days without purchase",
  "salesPanel.col.recency": "Recency",
  "salesPanel.col.customer": "Customer",
  "salesPanel.col.month": "Month",
  "salesPanel.col.skus": "SKUs",
  "salesPanel.col.focus": "Focus",

  "salesPanel.abc.class": "Class {c}",
  "salesPanel.abc.note":
    "ABC curve by ordered pieces: A up to 80% of the volume, B up to 95%, C the rest. Recalculated with the filters.",
  "salesPanel.abc.filter": "Class",
  "salesPanel.abc.all": "All",
  "salesPanel.abc.skus": "{n} SKUs",

  "salesPanel.freq.pairs": "SKU–customer pairs",
  "salesPanel.freq.multi": "SKUs in 2+ customers",
  "salesPanel.freq.avg": "Average SKUs per customer",
  "salesPanel.freq.repurchase": "Repurchase",
  "salesPanel.freq.repurchaseHint":
    "SKU–customer pairs with two orders or more: {n} of {total}.",

  "salesPanel.period.note":
    "Real sales by order date (ordered pieces). The HTML only had the last purchase date; here it is the order, month by month.",

  "salesPanel.compare.yearA": "Base year",
  "salesPanel.compare.yearB": "Compare with",
  "salesPanel.compare.total":
    "Same months ({n}): {a} pieces in {ya} × {b} pieces in {yb}",
  "salesPanel.compare.change": "Change: {pct}",
  "salesPanel.compare.none": "The base does not have both years yet.",

  "salesPanel.stock.with": "SKUs with free stock",
  "salesPanel.stock.without": "SKUs without free stock",
  "salesPanel.stock.soldWithout": "Bought and without stock",
  "salesPanel.stock.coming": "Without stock, but arriving",
  "salesPanel.stock.note":
    "Portal stock (Stock screen): free in Brazil = physical minus reservations; in transit and in production from containers and orders.",
  "salesPanel.stock.outCatalog": "not in the portal catalog",
  "salesPanel.stock.none":
    "No product in the selection with free stock in Brazil.",
  "salesPanel.stock.allStocked": "Every product bought has free stock.",

  "salesPanel.life.d90": "Up to 90 days",
  "salesPanel.life.d180": "91 to 180 days",
  "salesPanel.life.d365": "181 to 365 days",
  "salesPanel.life.older": "Over 1 year",
  "salesPanel.life.note":
    "Days from each SKU's last purchase until today (Sankhya order date).",

  "salesPanel.customers.note":
    "Customers in the selection: pieces, SKUs, orders and days since the last purchase.",

  "salesPanel.diag.focus": "Focus",
  "salesPanel.diag.focus.leaders": "Protect the Top 10",
  "salesPanel.diag.focus.reach": "Widen reach",
  "salesPanel.diag.focus.low": "Investigate low volume",
  "salesPanel.diag.focus.recency": "No purchase in over 180 days",
  "salesPanel.diag.focus.growth": "Validate growth",
  "salesPanel.diag.focus.all": "All SKUs",
  "salesPanel.diag.prompt": "Question",
  "salesPanel.diag.action": "Proposed action",
  "salesPanel.diag.evidence": "Evidence needed",
  "salesPanel.diag.create": "Create action in the plan",
  "salesPanel.diag.inPlan": "In the plan: {status}",
  "salesPanel.diag.count": "{n} SKU(s) · showing up to 18",
  "salesPanel.diag.note":
    "Hypotheses from the sales (pieces, customers and last purchase), as in the HTML: confirm in store before deciding.",
  "salesPanel.diag.line":
    "{pieces} pieces · {customers} customer(s) · last purchase {date}",
  "salesPanel.diag.leaders.title": "Protect the leading product",
  "salesPanel.diag.leaders.prompt":
    "Is this SKU displayed and available in the priority stores? What evidence proves it?",
  "salesPanel.diag.leaders.action":
    "Audit display, store stock and replenishment",
  "salesPanel.diag.leaders.evidence":
    "Shelf photo, stock per store and sell-out",
  "salesPanel.diag.reach.title": "Investigate restricted reach",
  "salesPanel.diag.reach.prompt":
    "Why does this SKU appear in only one customer of the group? Is there room for a pilot?",
  "salesPanel.diag.reach.action": "Select stores and test a wider mix",
  "salesPanel.diag.reach.evidence":
    "Eligible stores, current presence and sell-out",
  "salesPanel.diag.low.title": "Test the potential before dropping",
  "salesPanel.diag.low.prompt":
    "Is the low volume due to display, price, distribution or demand?",
  "salesPanel.diag.low.action":
    "Define a display test with a success criterion",
  "salesPanel.diag.low.evidence": "Shelf price, photo, sell-out before/after",
  "salesPanel.diag.recency.title": "Bring back the stalled product",
  "salesPanel.diag.recency.prompt":
    "Why did the customer stop buying this SKU: stockout, mix change or competition?",
  "salesPanel.diag.recency.action":
    "Check stock, display and price; propose the repurchase",
  "salesPanel.diag.recency.evidence":
    "Store stock, shelf photo and repurchase order",
  "salesPanel.diag.growth.title": "Validate the growth opportunity",
  "salesPanel.diag.growth.prompt":
    "Are distribution and store execution in line with the observed volume?",
  "salesPanel.diag.growth.action":
    "Compare presence, stockouts and mix opportunities",
  "salesPanel.diag.growth.evidence": "Sell-out and availability per store",

  "portfolio.col.lastPurchase": "Last purchase",
  "portfolio.daysSince": "{n} days ago",
  "portfolio.panelLink": "Customer panel",
  "portfolio.groups.panelLink": "Group panel",
};

export const zh: Record<keyof typeof pt, string> = {
  "nav.salesPanel": "销售看板",
  "salesPanel.title": "销售看板",
  "salesPanel.titleOf": "看板 · {name}",
  "salesPanel.subtitle":
    "按月份、产品和客户的 Sankhya 销售（订购件数）：Campineira 项目看板的各个页面，现在使用真实销售数据。",
  "salesPanel.choose.title": "选择集团或客户",
  "salesPanel.choose.groups": "经济集团",
  "salesPanel.choose.customers": "跟进的客户",
  "salesPanel.choose.empty":
    "还没有跟进的集团或客户。请在 客户组合与拜访 → 经济集团 中建立集团。",
  "salesPanel.scope.group": "经济集团",
  "salesPanel.scope.customer": "客户",
  "salesPanel.customersCount": "{n} 个客户",
  "salesPanel.customersOne": "1 个客户",
  "salesPanel.loaded": "销售更新于 {date}",
  "salesPanel.neverLoaded":
    "销售尚未从 Sankhya 加载。请使用“立即更新”（客户组合管理者）或等待夜间加载。",
  "salesPanel.loadError": "{customer}：上次读取失败（{message}）。",
  "salesPanel.noCode": "{customer} 在资料中没有 Sankhya 代码。",
  "salesPanel.incomplete": "{customer}：数据超过读取上限；合计可能偏小。",
  "salesPanel.refresh": "立即更新",
  "salesPanel.refreshHint":
    "重新从 Sankhya 读取销售（每个客户几秒钟）。每晚也会自动加载。",
  "salesPanel.notice.refreshed": "销售已更新：{total} 个客户中的 {ok} 个。",
  "salesPanel.notConfigured": "Sankhya 未配置：没有销售数据，看板为空。",
  "salesPanel.empty": "此范围没有销售数据。",
  "salesPanel.unconverted": "{n} 行以无法换算为件数的单位销售，未计入件数。",
  "salesPanel.openPanel": "看板",
  "salesPanel.back": "← 销售看板",

  "salesPanel.tab.executive": "01 · 总览",
  "salesPanel.tab.ranking": "02 · 产品排名",
  "salesPanel.tab.abc": "03 · ABC 曲线",
  "salesPanel.tab.frequency": "04 · SKU 频次",
  "salesPanel.tab.period": "05 · 期间分析",
  "salesPanel.tab.compare": "06 · 年度对比",
  "salesPanel.tab.mix": "07 · 组合与类别",
  "salesPanel.tab.stock": "08 · 库存与可用性",
  "salesPanel.tab.lifecycle": "09 · 生命周期",
  "salesPanel.tab.customers": "10 · 客户",
  "salesPanel.tab.diagnosis": "11 · 诊断",
  "salesPanel.tab.plan": "12 · 行动计划",

  "salesPanel.filter.year": "年份",
  "salesPanel.filter.allYears": "全部",
  "salesPanel.filter.quarter": "季度",
  "salesPanel.filter.allQuarters": "全年",
  "salesPanel.filter.q1": "第一季度",
  "salesPanel.filter.q2": "第二季度",
  "salesPanel.filter.q3": "第三季度",
  "salesPanel.filter.q4": "第四季度",
  "salesPanel.filter.group": "产品组",
  "salesPanel.filter.allGroups": "所有组",
  "salesPanel.filter.search": "SKU、产品或客户",
  "salesPanel.filter.customer": "客户",
  "salesPanel.filter.allCustomers": "全部",
  "salesPanel.filter.apply": "筛选",
  "salesPanel.export": "导出 CSV",

  "salesPanel.kpi.pieces": "订购件数",
  "salesPanel.kpi.skus": "不同 SKU",
  "salesPanel.kpi.customers": "有购买的客户",
  "salesPanel.kpi.top10": "前 10 集中度",
  "salesPanel.kpi.orders": "订单",
  "salesPanel.kpi.value": "金额（R$）",

  "salesPanel.chart.top10": "件数前 10 的产品",
  "salesPanel.chart.groups": "按组的件数",
  "salesPanel.chart.categories": "按类别的件数",
  "salesPanel.chart.reach": "客户最多的产品",
  "salesPanel.chart.variety": "SKU 最多的客户",
  "salesPanel.chart.months": "按月件数",
  "salesPanel.chart.quarters": "按季度件数",
  "salesPanel.chart.stockTop": "巴西可用库存最多",
  "salesPanel.chart.noStock": "已购买但无可用库存",
  "salesPanel.chart.recency": "按距上次购买时间的 SKU",
  "salesPanel.chart.customersPieces": "按件数的客户",

  "salesPanel.col.sku": "SKU",
  "salesPanel.col.code": "代码",
  "salesPanel.col.product": "产品",
  "salesPanel.col.group": "组",
  "salesPanel.col.category": "类别",
  "salesPanel.col.pieces": "件数",
  "salesPanel.col.customers": "客户",
  "salesPanel.col.orders": "订单",
  "salesPanel.col.last": "上次购买",
  "salesPanel.col.share": "占比",
  "salesPanel.col.cumulative": "累计",
  "salesPanel.col.class": "等级",
  "salesPanel.col.value": "金额（R$）",
  "salesPanel.col.free": "巴西可用",
  "salesPanel.col.transit": "在途",
  "salesPanel.col.production": "生产中",
  "salesPanel.col.days": "未购买天数",
  "salesPanel.col.recency": "最近程度",
  "salesPanel.col.customer": "客户",
  "salesPanel.col.month": "月份",
  "salesPanel.col.skus": "SKU",
  "salesPanel.col.focus": "重点",

  "salesPanel.abc.class": "{c} 类",
  "salesPanel.abc.note":
    "按订购件数的 ABC 曲线：A 为前 80% 的量，B 到 95%，C 为其余。随筛选重新计算。",
  "salesPanel.abc.filter": "等级",
  "salesPanel.abc.all": "全部",
  "salesPanel.abc.skus": "{n} 个 SKU",

  "salesPanel.freq.pairs": "SKU–客户组合",
  "salesPanel.freq.multi": "2 个以上客户的 SKU",
  "salesPanel.freq.avg": "每个客户的平均 SKU",
  "salesPanel.freq.repurchase": "复购",
  "salesPanel.freq.repurchaseHint":
    "有两次及以上订单的 SKU–客户组合：{total} 个中的 {n} 个。",

  "salesPanel.period.note":
    "按订单日期的真实销售（订购件数）。HTML 只有上次购买日期；这里是逐月的订单。",

  "salesPanel.compare.yearA": "基准年",
  "salesPanel.compare.yearB": "对比年",
  "salesPanel.compare.total":
    "相同月份（{n}）：{ya} 年 {a} 件 × {yb} 年 {b} 件",
  "salesPanel.compare.change": "变化：{pct}",
  "salesPanel.compare.none": "数据中还没有两个年份。",

  "salesPanel.stock.with": "有可用库存的 SKU",
  "salesPanel.stock.without": "无可用库存的 SKU",
  "salesPanel.stock.soldWithout": "已购买但无库存",
  "salesPanel.stock.coming": "无库存但在途",
  "salesPanel.stock.note":
    "门户库存（库存页面）：巴西可用 = 实物减去预留；在途和生产中来自集装箱和订单。",
  "salesPanel.stock.outCatalog": "不在门户目录中",
  "salesPanel.stock.none": "范围内没有在巴西有可用库存的产品。",
  "salesPanel.stock.allStocked": "所有已购买的产品都有可用库存。",

  "salesPanel.life.d90": "90 天内",
  "salesPanel.life.d180": "91 至 180 天",
  "salesPanel.life.d365": "181 至 365 天",
  "salesPanel.life.older": "超过 1 年",
  "salesPanel.life.note":
    "每个 SKU 从上次购买到今天的天数（Sankhya 订单日期）。",

  "salesPanel.customers.note":
    "范围内的客户：件数、SKU、订单和距上次购买的天数。",

  "salesPanel.diag.focus": "重点",
  "salesPanel.diag.focus.leaders": "保护前 10",
  "salesPanel.diag.focus.reach": "扩大覆盖",
  "salesPanel.diag.focus.low": "调查低销量",
  "salesPanel.diag.focus.recency": "超过 180 天未购买",
  "salesPanel.diag.focus.growth": "验证增长",
  "salesPanel.diag.focus.all": "所有 SKU",
  "salesPanel.diag.prompt": "问题",
  "salesPanel.diag.action": "建议行动",
  "salesPanel.diag.evidence": "所需证据",
  "salesPanel.diag.create": "在计划中创建行动",
  "salesPanel.diag.inPlan": "已在计划中：{status}",
  "salesPanel.diag.count": "{n} 个 SKU · 最多显示 18 个",
  "salesPanel.diag.note":
    "根据销售（件数、客户和上次购买）得出的假设，同 HTML：决定前请在门店确认。",
  "salesPanel.diag.line": "{pieces} 件 · {customers} 个客户 · 上次购买 {date}",
  "salesPanel.diag.leaders.title": "保护领先产品",
  "salesPanel.diag.leaders.prompt":
    "此 SKU 在重点门店是否陈列并有货？有什么证据？",
  "salesPanel.diag.leaders.action": "审核陈列、门店库存和补货",
  "salesPanel.diag.leaders.evidence": "货架照片、各门店库存和销量",
  "salesPanel.diag.reach.title": "调查覆盖受限",
  "salesPanel.diag.reach.prompt":
    "为什么此 SKU 只在集团的一个客户中出现？是否有试点空间？",
  "salesPanel.diag.reach.action": "选择门店并测试扩大组合",
  "salesPanel.diag.reach.evidence": "合适门店、当前覆盖和销量",
  "salesPanel.diag.low.title": "放弃前测试潜力",
  "salesPanel.diag.low.prompt": "低销量是由于陈列、价格、分销还是需求？",
  "salesPanel.diag.low.action": "制定带成功标准的陈列测试",
  "salesPanel.diag.low.evidence": "货架价格、照片、前后销量",
  "salesPanel.diag.recency.title": "恢复停滞的产品",
  "salesPanel.diag.recency.prompt":
    "客户为什么停止购买此 SKU：缺货、组合调整还是竞争？",
  "salesPanel.diag.recency.action": "检查库存、陈列和价格；建议复购",
  "salesPanel.diag.recency.evidence": "门店库存、货架照片和复购订单",
  "salesPanel.diag.growth.title": "验证增长机会",
  "salesPanel.diag.growth.prompt": "分销和门店执行是否与观察到的销量相符？",
  "salesPanel.diag.growth.action": "比较覆盖、缺货和组合机会",
  "salesPanel.diag.growth.evidence": "各门店的销量和可用性",

  "portfolio.col.lastPurchase": "上次购买",
  "portfolio.daysSince": "{n} 天前",
  "portfolio.panelLink": "客户看板",
  "portfolio.groups.panelLink": "集团看板",
};
