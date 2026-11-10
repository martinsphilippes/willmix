/**
 * Tela do Booking (lista): ajuda, cartões das etapas, filtros por coluna,
 * ações em várias linhas e avisos (docs/BOOKING.md). Mesmas chaves em pt, en
 * e zh.
 */
export const pt = {
  "booking.help.body":
    "Aqui ficam os produtos que chegaram pela ficha técnica, antes de existir solicitação. Cada linha é um produto. Enquanto está em Novo, Em análise ou Descartado, o cliente não vê o produto; ele entra na vitrine quando é aprovado.",
  "booking.help.steps":
    "Entrada: importe a ficha técnica com a opção “Mandar para o Booking”. As linhas chegam em Novo.\nAnalisar: marque as linhas e toque em “Analisar no Superplan” (custo, preço mínimo e preço para a meta). O sinal verde, amarelo ou vermelho aparece quando você testa um preço de venda no Superplan, pela linha, e grava.\nAprovar: mova para Aprovado as que valem a pena; descarte as outras.\nOferecer e reservar: escolha o cliente, digite a quantidade na linha e mova para Oferecido ou Reservado.\nGerar solicitação: marque as linhas do cliente e toque em “Gerar solicitação”.\nFiltros: cada coluna tem o seu filtro logo abaixo do título; toque no título para ordenar.",
  "booking.import": "Importar ficha técnica",
  "booking.schemaMissing":
    "O banco ainda não tem a tabela do Booking. Publique o esquema (Configurações) para a tela funcionar.",
  "booking.empty":
    "Nenhum produto no Booking ainda. Importe uma ficha técnica com a opção “Mandar para o Booking”.",
  "booking.emptyFiltered": "Nenhuma linha com esses filtros.",
  "booking.cards.all": "Todas",
  "booking.cards.hiddenHint":
    "Novo, Em análise e Descartado: o cliente ainda não vê o produto.",
  "booking.search.placeholder":
    "Buscar em tudo (produto, código, fornecedor, cliente…)",
  "booking.filter.apply": "Filtrar",
  "booking.filter.clear": "Limpar filtros ({n})",
  "booking.filter.all": "Todos",
  "booking.filter.empty": "(vazio)",
  "booking.filter.contains": "contém…",
  "booking.filter.min": "de",
  "booking.filter.max": "até",
  "booking.filter.of": "Filtro de {col}",
  "booking.filter.search": "Busca",
  "booking.filter.remove": "Tirar este filtro",
  "booking.sort.by": "Ordenar por {col}",
  "booking.count": "{from} a {to} de {total} linhas",
  "booking.count.filtered": "({all} no total)",
  "booking.page.prev": "Anterior",
  "booking.page.next": "Próxima",
  "booking.bulk.title": "Com as linhas marcadas",
  "booking.bulk.selectAll": "Marcar todas desta página",
  "booking.bulk.selectRow": "Marcar {name}",
  "booking.bulk.customer.keep": "Cliente (não mexer)",
  "booking.bulk.customer.none": "Sem cliente (tirar)",
  "booking.bulk.stock": "Estoque Wellmix (compra para estoque)",
  "booking.guide.title":
    "Para gerar a solicitação, cada linha marcada precisa de três coisas:",
  "booking.guide.stage": "Etapa",
  "booking.guide.stage.rule": "estar em Aprovado, Oferecido ou Reservado.",
  "booking.guide.stage.ok": "está em {stage}.",
  "booking.guide.stage.fix":
    "está em {stage}. Com as linhas marcadas, no grupo Etapa escolha “Aprovado” e toque em Mover.",
  "booking.guide.stage.fixAdmin":
    "está em {stage}. Aprovar é do administrador: peça a ele para mover estas linhas para “Aprovado”.",
  "booking.guide.customer": "Cliente",
  "booking.guide.customer.ok": "{name}.",
  "booking.guide.customer.fix":
    "a linha não tem cliente. No grupo Cliente, escolha o cliente (ou “Estoque Wellmix”) antes de gerar.",
  "booking.guide.qty": "Quantidade",
  "booking.guide.qty.ok": "{n} peças.",
  "booking.guide.qty.fix":
    "digite a quantidade na coluna “Qtd. reservada” da linha.",
  "booking.guide.qty.fixMoq":
    "digite na coluna “Qtd. reservada” uma quantidade a partir do pedido mínimo ({moq}).",
  "booking.guide.then":
    "Depois, com as linhas marcadas, toque em “Gerar solicitação” de novo. O que você marcou e digitou continua na tela.",
  "booking.bulk.assign": "Salvar cliente e quantidades",
  "booking.bulk.assign.short": "Salvar",
  "booking.bulk.setOwner.short": "Trocar",
  "booking.bulk.status": "Mover para…",
  "booking.bulk.move": "Mover",
  "booking.bulk.move.confirm": "Mover {n} linha(s) para “{stage}”?",
  "booking.bulk.owner.keep": "Responsável…",
  "booking.bulk.owner.none": "Sem responsável",
  "booking.bulk.setOwner": "Trocar responsável",
  "booking.bulk.analyze": "Analisar no Superplan",
  "booking.bulk.request": "Gerar solicitação",
  "booking.bulk.request.confirm":
    "Gerar uma solicitação com {n} linha(s) marcada(s)? (até {max} por vez)",
  "booking.bulk.hint":
    "A quantidade digitada na linha e o cliente escolhido aqui valem para as linhas marcadas. Gerar solicitação usa a quantidade da linha (sem ela, o pedido mínimo) e aceita até {max} linhas por vez.",
  "booking.bulk.working": "Gravando…",
  "booking.done.moved": "{n} linha(s) movida(s) de etapa.",
  "booking.done.edited":
    "Dados de {n} produto(s) gravados (cadastro e ficha mestre).",
  "booking.edit.start": "Editar dados dos produtos",
  "booking.edit.startHint":
    "Muda direto na tabela o nome, fornecedor, código, local, loja, data, preço, moeda, MOQ, caixa, inner, pesos, média, CBM, medidas, cores, material e embalagem de qualquer produto da lista.",
  "booking.edit.stop": "Sair da edição",
  "booking.edit.save": "Salvar dados",
  "booking.edit.saving": "Salvando…",
  "booking.edit.hint":
    "Mude o que precisar nas células e toque em Salvar dados: só o que mudou é gravado, no cadastro e na ficha mestre do produto (o mesmo produto da tela Produtos). Etapa, cliente, quantidade e responsável mudam pela barra acima; custo e sinal vêm do Superplan.",
  "booking.edit.field": "{field} de {name}",
  "booking.edit.location": "Local",
  "booking.edit.store": "Loja",
  "booking.edit.length": "Comprimento (cm)",
  "booking.edit.width": "Largura (cm)",
  "booking.edit.height": "Altura (cm)",
  "booking.done.saved": "{n} linha(s) atualizada(s).",
  "booking.done.owners": "Responsável trocado em {n} linha(s).",
  "booking.done.analyzed": "{n} linha(s) analisada(s) no Superplan.",
  "booking.done.skipped":
    "{n} linha(s) ficaram de fora: o produto saiu do cadastro.",
  "booking.done.none": "Nada mudou: as linhas já estavam assim.",
  "booking.done.kept":
    "{n} linha(s) com simulação gravada à mão ficaram como estavam. Para refazer, abra a linha no Superplan e grave de novo.",
  "booking.done.norates":
    "{n} analisada(s) sem II ou IPI informado (em geral, produto sem NCM na tabela fiscal): o que faltou contou 0 e o custo sai menor que o real.",
  "booking.draftRestored":
    "A ação não foi concluída. O que você tinha digitado e marcado voltou.",
  "booking.draftDiscard": "Descartar e ver o que está salvo",
  "booking.row.noRates": "II/IPI 0",
  "booking.row.noRatesHint":
    "Sem II ou IPI informado: entrou como 0. O custo real é maior.",
  "booking.row.open": "Abrir",
  "booking.row.superplan": "Superplan",
  "booking.row.estimated": "Estimado: líquido + {pct}%",
  "booking.row.qty": "Quantidade reservada de {name}",
  "booking.row.qtyMin": "mín. {moq}",
  "booking.row.rows": "linhas {rows}",
  "booking.row.error": "Linha: {name}",
  "booking.row.analysisAt": "Análise de {date}",
  "booking.row.minimum": "mínimo",
  "booking.row.request": "Solicitação #{n}",
  "booking.row.requestOpen": "Abrir solicitação",
  "booking.row.requestPending": "criando…",
  "booking.row.requestMissing": "sem solicitação",
  "booking.col.actions": "Ações",
};

export const en: Record<keyof typeof pt, string> = {
  "booking.help.body":
    "This is where products that arrived through the technical sheet stay before a request exists. Each row is a product. While it is in New, Under analysis or Discarded the customer does not see the product; it enters the showcase when it is approved.",
  "booking.help.steps":
    "Entry: import the technical sheet with the “Send to Booking” option. Rows arrive in New.\nAnalyze: tick the rows and tap “Analyze in Superplan” (cost, minimum price and price for the target). The green, yellow or red signal appears when you test a sale price in Superplan, from the row, and save.\nApprove: move the worthwhile ones to Approved; discard the others.\nOffer and reserve: choose the customer, type the quantity in the row and move to Offered or Reserved.\nCreate request: tick the customer's rows and tap “Create request”.\nFilters: every column has its own filter right below the title; tap the title to sort.",
  "booking.import": "Import technical sheet",
  "booking.schemaMissing":
    "The database does not have the Booking table yet. Publish the schema (Settings) for this screen to work.",
  "booking.empty":
    "No products in Booking yet. Import a technical sheet with the “Send to Booking” option.",
  "booking.emptyFiltered": "No rows match these filters.",
  "booking.cards.all": "All",
  "booking.cards.hiddenHint":
    "New, Under analysis and Discarded: the customer does not see the product yet.",
  "booking.search.placeholder":
    "Search everything (product, code, supplier, customer…)",
  "booking.filter.apply": "Filter",
  "booking.filter.clear": "Clear filters ({n})",
  "booking.filter.all": "All",
  "booking.filter.empty": "(empty)",
  "booking.filter.contains": "contains…",
  "booking.filter.min": "from",
  "booking.filter.max": "to",
  "booking.filter.of": "Filter for {col}",
  "booking.filter.search": "Search",
  "booking.filter.remove": "Remove this filter",
  "booking.sort.by": "Sort by {col}",
  "booking.count": "{from} to {to} of {total} rows",
  "booking.count.filtered": "({all} in total)",
  "booking.page.prev": "Previous",
  "booking.page.next": "Next",
  "booking.bulk.title": "With the ticked rows",
  "booking.bulk.selectAll": "Tick all on this page",
  "booking.bulk.selectRow": "Tick {name}",
  "booking.bulk.customer.keep": "Customer (leave as is)",
  "booking.bulk.customer.none": "No customer (remove)",
  "booking.bulk.stock": "Wellmix stock (purchase for stock)",
  "booking.guide.title":
    "To create the request, each ticked row needs three things:",
  "booking.guide.stage": "Stage",
  "booking.guide.stage.rule": "be in Approved, Offered or Reserved.",
  "booking.guide.stage.ok": "it is in {stage}.",
  "booking.guide.stage.fix":
    "it is in {stage}. With the rows ticked, choose “Approved” in the Stage group and tap Move.",
  "booking.guide.stage.fixAdmin":
    "it is in {stage}. Approving is for the administrator: ask them to move these rows to “Approved”.",
  "booking.guide.customer": "Customer",
  "booking.guide.customer.ok": "{name}.",
  "booking.guide.customer.fix":
    "the row has no customer. In the Customer group, choose the customer (or “Wellmix stock”) before creating.",
  "booking.guide.qty": "Quantity",
  "booking.guide.qty.ok": "{n} pieces.",
  "booking.guide.qty.fix":
    "type the quantity in the row's “Reserved qty” column.",
  "booking.guide.qty.fixMoq":
    "type in the “Reserved qty” column a quantity from the minimum order ({moq}) up.",
  "booking.guide.then":
    "Then, with the rows ticked, tap “Create request” again. What you ticked and typed stays on the screen.",
  "booking.bulk.assign": "Save customer and quantities",
  "booking.bulk.assign.short": "Save",
  "booking.bulk.setOwner.short": "Change",
  "booking.bulk.status": "Move to…",
  "booking.bulk.move": "Move",
  "booking.bulk.move.confirm": "Move {n} row(s) to “{stage}”?",
  "booking.bulk.owner.keep": "Owner…",
  "booking.bulk.owner.none": "No owner",
  "booking.bulk.setOwner": "Change owner",
  "booking.bulk.analyze": "Analyze in Superplan",
  "booking.bulk.request": "Create request",
  "booking.bulk.request.confirm":
    "Create a request with {n} ticked row(s)? (up to {max} at a time)",
  "booking.bulk.hint":
    "The quantity typed in the row and the customer chosen here apply to the ticked rows. Create request uses the row's quantity (without it, the minimum order) and takes up to {max} rows at a time.",
  "booking.bulk.working": "Saving…",
  "booking.done.moved": "{n} row(s) moved to another stage.",
  "booking.done.edited":
    "Data of {n} product(s) saved (catalog and master sheet).",
  "booking.edit.start": "Edit product data",
  "booking.edit.startHint":
    "Change right in the table the name, supplier, code, location, store, date, price, currency, MOQ, carton, inner, weights, average, CBM, size, colours, material and packaging of any product in the list.",
  "booking.edit.stop": "Leave editing",
  "booking.edit.save": "Save data",
  "booking.edit.saving": "Saving…",
  "booking.edit.hint":
    "Change what you need in the cells and tap Save data: only what changed is saved, in the product catalog and master sheet (the same product as in Products). Stage, customer, quantity and owner change through the bar above; cost and signal come from Superplan.",
  "booking.edit.field": "{field} of {name}",
  "booking.edit.location": "Location",
  "booking.edit.store": "Store",
  "booking.edit.length": "Length (cm)",
  "booking.edit.width": "Width (cm)",
  "booking.edit.height": "Height (cm)",
  "booking.done.saved": "{n} row(s) updated.",
  "booking.done.owners": "Owner changed on {n} row(s).",
  "booking.done.analyzed": "{n} row(s) analyzed in Superplan.",
  "booking.done.skipped":
    "{n} row(s) were left out: the product is no longer in the catalog.",
  "booking.done.none": "Nothing changed: the rows were already like that.",
  "booking.done.kept":
    "{n} row(s) with a simulation saved by hand stayed as they were. To redo one, open the row in Superplan and save again.",
  "booking.done.norates":
    "{n} analyzed without II or IPI informed (usually a product without NCM in the tax table): the missing one counted as 0 and the cost is lower than the real one.",
  "booking.draftRestored":
    "The action was not completed. What you had typed and ticked is back.",
  "booking.draftDiscard": "Discard and show what is saved",
  "booking.row.noRates": "II/IPI 0",
  "booking.row.noRatesHint":
    "No II or IPI informed: counted as 0. The real cost is higher.",
  "booking.row.open": "Open",
  "booking.row.superplan": "Superplan",
  "booking.row.estimated": "Estimated: net + {pct}%",
  "booking.row.qty": "Reserved quantity of {name}",
  "booking.row.qtyMin": "min. {moq}",
  "booking.row.rows": "rows {rows}",
  "booking.row.error": "Row: {name}",
  "booking.row.analysisAt": "Analysis of {date}",
  "booking.row.minimum": "minimum",
  "booking.row.request": "Request #{n}",
  "booking.row.requestOpen": "Open request",
  "booking.row.requestPending": "creating…",
  "booking.row.requestMissing": "no request",
  "booking.col.actions": "Actions",
};

export const zh: Record<keyof typeof pt, string> = {
  "booking.help.body":
    "通过技术表进入的产品，在生成询价单之前都在这里。每一行是一个产品。处于“新增”“分析中”或“已放弃”时，客户看不到该产品；批准后才进入展示页。",
  "booking.help.steps":
    "进入：导入技术表时选择“发送到 Booking”。新行处于“新增”。\n分析：勾选行并点击“在 Superplan 中分析”（成本、最低价和达标价格）。在 Superplan 中从该行测试售价并保存后，才会出现绿、黄、红信号。\n批准：把值得做的移到“已批准”；其余的放弃。\n推荐和预订：选择客户，在行内填写数量，然后移到“已推荐”或“已预订”。\n生成询价单：勾选该客户的行并点击“生成询价单”。\n筛选：每一列的标题下方都有自己的筛选；点击标题可排序。",
  "booking.import": "导入技术表",
  "booking.schemaMissing":
    "数据库中还没有 Booking 表。请发布数据结构（设置）后再使用此页面。",
  "booking.empty": "Booking 中还没有产品。请导入技术表并选择“发送到 Booking”。",
  "booking.emptyFiltered": "没有符合这些筛选条件的行。",
  "booking.cards.all": "全部",
  "booking.cards.hiddenHint":
    "“新增”“分析中”和“已放弃”：客户暂时看不到该产品。",
  "booking.search.placeholder": "全部搜索（产品、货号、供应商、客户…）",
  "booking.filter.apply": "筛选",
  "booking.filter.clear": "清除筛选（{n}）",
  "booking.filter.all": "全部",
  "booking.filter.empty": "（空）",
  "booking.filter.contains": "包含…",
  "booking.filter.min": "从",
  "booking.filter.max": "到",
  "booking.filter.of": "{col} 的筛选",
  "booking.filter.search": "搜索",
  "booking.filter.remove": "移除此筛选",
  "booking.sort.by": "按 {col} 排序",
  "booking.count": "第 {from} 到 {to} 行，共 {total} 行",
  "booking.count.filtered": "（总共 {all} 行）",
  "booking.page.prev": "上一页",
  "booking.page.next": "下一页",
  "booking.bulk.title": "对勾选的行",
  "booking.bulk.selectAll": "勾选本页全部",
  "booking.bulk.selectRow": "勾选 {name}",
  "booking.bulk.customer.keep": "客户（不修改）",
  "booking.bulk.customer.none": "无客户（移除）",
  "booking.bulk.stock": "Wellmix 库存（为库存采购）",
  "booking.guide.title": "要生成询价单，每个勾选的行需要三项：",
  "booking.guide.stage": "阶段",
  "booking.guide.stage.rule": "处于“已批准”“已推荐”或“已预订”。",
  "booking.guide.stage.ok": "处于“{stage}”。",
  "booking.guide.stage.fix":
    "处于“{stage}”。勾选这些行后，在“阶段”组选择“已批准”并点击“移动”。",
  "booking.guide.stage.fixAdmin":
    "处于“{stage}”。批准由管理员操作：请让其把这些行移到“已批准”。",
  "booking.guide.customer": "客户",
  "booking.guide.customer.ok": "{name}。",
  "booking.guide.customer.fix":
    "该行没有客户。生成之前，请在“客户”组选择客户（或“Wellmix 库存”）。",
  "booking.guide.qty": "数量",
  "booking.guide.qty.ok": "{n} 件。",
  "booking.guide.qty.fix": "请在该行的“预订数量”列填写数量。",
  "booking.guide.qty.fixMoq":
    "请在“预订数量”列填写不低于起订量（{moq}）的数量。",
  "booking.guide.then":
    "然后保持勾选，再次点击“生成询价单”。您勾选和填写的内容仍保留在页面上。",
  "booking.bulk.assign": "保存客户和数量",
  "booking.bulk.assign.short": "保存",
  "booking.bulk.setOwner.short": "更换",
  "booking.bulk.status": "移到…",
  "booking.bulk.move": "移动",
  "booking.bulk.move.confirm": "把 {n} 行移到“{stage}”？",
  "booking.bulk.owner.keep": "负责人…",
  "booking.bulk.owner.none": "无负责人",
  "booking.bulk.setOwner": "更换负责人",
  "booking.bulk.analyze": "在 Superplan 中分析",
  "booking.bulk.request": "生成询价单",
  "booking.bulk.request.confirm":
    "用勾选的 {n} 行生成一张询价单？（每次最多 {max} 行）",
  "booking.bulk.hint":
    "行内填写的数量和这里选择的客户只对勾选的行生效。生成询价单使用该行的数量（没有则用起订量），每次最多 {max} 行。",
  "booking.bulk.working": "保存中…",
  "booking.done.moved": "已移动 {n} 行的阶段。",
  "booking.done.edited": "已保存 {n} 个产品的数据（目录和主表）。",
  "booking.edit.start": "编辑产品数据",
  "booking.edit.startHint":
    "可直接在表格中修改列表内任一产品的名称、供应商、编号、地点、店铺、日期、价格、币种、起订量、外箱、内盒、重量、均价、体积、尺寸、颜色、材质和包装。",
  "booking.edit.stop": "退出编辑",
  "booking.edit.save": "保存数据",
  "booking.edit.saving": "正在保存…",
  "booking.edit.hint":
    "在单元格中修改所需内容后点击“保存数据”：只保存改动的部分，写入产品目录和主表（与“产品”页面是同一个产品）。阶段、客户、数量和负责人通过上方工具栏修改；成本和信号来自 Superplan。",
  "booking.edit.field": "{name} 的{field}",
  "booking.edit.location": "地点",
  "booking.edit.store": "店铺",
  "booking.edit.length": "长度（厘米）",
  "booking.edit.width": "宽度（厘米）",
  "booking.edit.height": "高度（厘米）",
  "booking.done.saved": "已更新 {n} 行。",
  "booking.done.owners": "已更换 {n} 行的负责人。",
  "booking.done.analyzed": "已在 Superplan 中分析 {n} 行。",
  "booking.done.skipped": "有 {n} 行未处理：产品已不在目录中。",
  "booking.done.none": "没有变化：这些行本来就是这样。",
  "booking.done.kept":
    "有 {n} 行保留了手动保存的模拟。如需重做，请在 Superplan 中打开该行并重新保存。",
  "booking.done.norates":
    "有 {n} 行在未填写 II 或 IPI 的情况下分析（通常是税表中没有该产品的 NCM）：缺少的一项按 0 计算，成本低于实际。",
  "booking.draftRestored": "操作未完成。您填写和勾选的内容已恢复。",
  "booking.draftDiscard": "放弃并显示已保存的内容",
  "booking.row.noRates": "II/IPI 0",
  "booking.row.noRatesHint": "未填写 II 或 IPI：按 0 计算。实际成本更高。",
  "booking.row.open": "打开",
  "booking.row.superplan": "Superplan",
  "booking.row.estimated": "估算：净重 + {pct}%",
  "booking.row.qty": "{name} 的预订数量",
  "booking.row.qtyMin": "最少 {moq}",
  "booking.row.rows": "第 {rows} 行",
  "booking.row.error": "行：{name}",
  "booking.row.analysisAt": "{date} 的分析",
  "booking.row.minimum": "最低价",
  "booking.row.request": "询价单 #{n}",
  "booking.row.requestOpen": "打开询价单",
  "booking.row.requestPending": "创建中…",
  "booking.row.requestMissing": "无询价单",
  "booking.col.actions": "操作",
};
