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
  "booking.filter.reset": "Zerar o filtro de {col}",
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
    "está em {stage}, que não gera solicitação. Com as linhas marcadas, no grupo Etapa escolha “Aprovado” e toque em Mover.",
  "booking.guide.stage.fixAdmin":
    "está em {stage}. Aprovar é do administrador: peça a ele para mover estas linhas para “Aprovado”.",
  "booking.guide.customer": "Compra para",
  "booking.guide.customer.ok": "{name}.",
  "booking.guide.customer.stock":
    "Estoque Wellmix (linha sem cliente é compra para o estoque).",
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
  "booking.bulk.assign": "Salvar as quantidades digitadas",
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
    "Para gerar a solicitação: marque as linhas e toque em Gerar solicitação. Cada linha é do fornecedor escolhido ao subir a ficha e a compra vai para o Estoque Wellmix. A quantidade é a digitada na linha (sem ela, a planejada ou o pedido mínimo). Até {max} linhas por vez.",
  "booking.bulk.working": "Gravando…",
  "booking.done.moved": "{n} linha(s) movida(s) de etapa.",
  "booking.done.edited":
    "Dados de {n} produto(s) gravados (cadastro e ficha mestre).",
  "booking.edit.start": "Editar dados dos produtos",
  "booking.edit.startHint":
    "Muda direto na tabela o nome, fornecedor, código, local/porto de saída, loja, data, preço, moeda, MOQ, caixa, inner, pesos, média, CBM, medidas, cores, material e embalagem de qualquer produto da lista.",
  "booking.edit.stop": "Sair da edição",
  "booking.edit.save": "Salvar dados",
  "booking.edit.saving": "Salvando…",
  "booking.edit.hint":
    "Mude o que precisar nas células e toque em Salvar dados: só o que mudou é gravado, no cadastro e na ficha mestre do produto (o mesmo produto da tela Produtos). Etapa, cliente, quantidade e responsável mudam pela barra acima; custo e sinal vêm do Superplan.",
  "booking.edit.field": "{field} de {name}",
  "booking.edit.location": "Local / Porto de saída",
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
  "booking.row.customer": "Cliente de {name}",
  "booking.row.saving": "Gravando…",
  "booking.row.saved": "Gravado ✓",
  "booking.row.failed": "Não gravou. Tente de novo.",
  "booking.row.invalid":
    "Não deu para ler este valor (número, data ou nome com menos de 2 letras). Nada foi gravado.",
  "booking.row.autosave":
    "Os campos da tabela gravam sozinhos: escolha na lista ou digite e saia do campo. Aparece “Gravado ✓” embaixo; se não puder gravar, o motivo aparece em vermelho.",
  "booking.next.open_rfq":
    "Próximo passo: abrir a RFQ, que envia o pedido de preço ao fornecedor.",
  "booking.next.wait_supplier":
    "Esperando o fornecedor enviar a cotação (confirmar ou mudar o preço). Se ele já respondeu por fora, registre a resposta na cotação.",
  "booking.next.offer_declined":
    "O fornecedor não aceitou o preço. Converse com ele ou mude o preço aqui na tabela.",
  "booking.next.negotiating":
    "Cotação devolvida: esperando a resposta do fornecedor.",
  "booking.next.choose_quote":
    "O fornecedor enviou a cotação. Próximo passo: conferir e confirmar a cotação (com o valor de venda).",
  "booking.next.supplier_draft":
    "A ficha da cotação já foi preenchida em parte, mas a cotação ainda não foi enviada. Abra para ver o que falta ou registrar a resposta pelo fornecedor.",
  "booking.next.sign_wellmix":
    "Virou pedido. Próximo passo: a Wellmix assina o documento do pedido para ele seguir ao fornecedor.",
  "booking.next.sign_supplier":
    "Documento do pedido enviado. Esperando o fornecedor baixar, assinar e anexar de volta.",
  "booking.next.signed":
    "Documento do pedido assinado pelos dois e guardado no pedido.",
  "booking.next.count": "({answered} de {total} cotações enviadas)",
  "booking.next.label.open_rfq": "Abrir RFQ",
  "booking.next.label.wait_supplier": "Aguardando fornecedor",
  "booking.next.label.supplier_draft": "Cotação em rascunho",
  "booking.next.label.offer_declined": "Preço não aceito",
  "booking.next.label.negotiating": "Em negociação",
  "booking.next.label.choose_quote": "Cotação enviada",
  "booking.next.label.wait_down_payment": "Cotação confirmada",
  "booking.next.label.ordered": "Pedido criado",
  "booking.next.label.sign_wellmix": "Pedido: assinar documento",
  "booking.next.label.sign_supplier": "Documento com o fornecedor",
  "booking.next.label.signed": "Documento assinado",
  "booking.next.label.cancelled": "Cancelada",
  "booking.next.go.confirm": "Conferir e confirmar",
  "booking.next.go.document": "Abrir documento do pedido",
  "booking.next.wait_down_payment":
    "Fornecedor escolhido. Próximo passo: confirmar o sinal (ou a aprovação) na solicitação.",
  "booking.next.ordered": "Já virou pedido. Daqui em diante, siga pelo pedido.",
  "booking.next.cancelled": "A solicitação foi cancelada.",
  "booking.next.go.request": "Abrir solicitação",
  "booking.next.go.quote": "Abrir cotação",
  "booking.next.go.order": "Abrir pedido",
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
  "booking.filter.reset": "Clear the {col} filter",
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
  "booking.guide.customer": "Purchase for",
  "booking.guide.customer.stock":
    "Wellmix stock (a row with no customer is a purchase for stock).",
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
  "booking.bulk.assign": "Save the typed quantities",
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
    "To create the request: tick the rows and tap Create request. Each row belongs to the supplier chosen when the sheet was uploaded and the purchase goes to Wellmix stock. The quantity is the one typed in the row (without it, the planned one or the minimum order). Up to {max} rows at a time.",
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
  "booking.edit.location": "Place / Port of departure",
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
  "booking.row.customer": "Customer of {name}",
  "booking.row.saving": "Saving…",
  "booking.row.saved": "Saved ✓",
  "booking.row.failed": "Not saved. Try again.",
  "booking.row.invalid":
    "This value could not be read (number, date or a name shorter than 2 letters). Nothing was saved.",
  "booking.row.autosave":
    "The table fields save by themselves: choose from the list, or type and leave the field. “Saved ✓” shows below; if it cannot be saved, the reason shows in red.",
  "booking.next.open_rfq":
    "Next step: open the RFQ, which sends the price request to the supplier.",
  "booking.next.wait_supplier":
    "Waiting for the supplier to send the quote (confirm or change the price). If they already answered elsewhere, record the answer in the quote.",
  "booking.next.offer_declined":
    "The supplier did not accept the price. Talk to them or change the price here in the table.",
  "booking.next.negotiating":
    "Quote returned: waiting for the supplier's answer.",
  "booking.next.choose_quote":
    "The supplier sent the quote. Next step: check and confirm the quote (with the sale price).",
  "booking.next.supplier_draft":
    "The quote sheet is partly filled in, but the quote has not been sent yet. Open it to see what is missing or to record the supplier's answer.",
  "booking.next.sign_wellmix":
    "It became an order. Next step: Wellmix signs the order document so it goes to the supplier.",
  "booking.next.sign_supplier":
    "Order document sent. Waiting for the supplier to download, sign and attach it back.",
  "booking.next.signed":
    "Order document signed by both sides and stored in the order.",
  "booking.next.count": "({answered} of {total} quotes sent)",
  "booking.next.label.open_rfq": "Open RFQ",
  "booking.next.label.wait_supplier": "Waiting for supplier",
  "booking.next.label.supplier_draft": "Quote in draft",
  "booking.next.label.offer_declined": "Price not accepted",
  "booking.next.label.negotiating": "Negotiating",
  "booking.next.label.choose_quote": "Quote sent",
  "booking.next.label.wait_down_payment": "Quote confirmed",
  "booking.next.label.ordered": "Order created",
  "booking.next.label.sign_wellmix": "Order: sign document",
  "booking.next.label.sign_supplier": "Document with supplier",
  "booking.next.label.signed": "Document signed",
  "booking.next.label.cancelled": "Cancelled",
  "booking.next.go.confirm": "Check and confirm",
  "booking.next.go.document": "Open order document",
  "booking.next.wait_down_payment":
    "Supplier chosen. Next step: confirm the down payment (or the approval) in the request.",
  "booking.next.ordered":
    "It is already an order. From here on, follow the order.",
  "booking.next.cancelled": "The request was cancelled.",
  "booking.next.go.request": "Open request",
  "booking.next.go.quote": "Open quote",
  "booking.next.go.order": "Open order",
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
  "booking.filter.reset": "清除 {col} 的筛选",
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
  "booking.guide.customer": "采购对象",
  "booking.guide.customer.stock": "Wellmix 库存（没有客户的行即为库存采购）。",
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
  "booking.bulk.assign": "保存填写的数量",
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
    "生成询价单：勾选行，然后点击“生成询价单”。每一行属于上传表格时选择的供应商，采购归入 Wellmix 库存。数量取行内填写的数量（没有则用计划数量或起订量）。每次最多 {max} 行。",
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
  "booking.edit.location": "地点 / 起运港",
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
  "booking.row.customer": "{name} 的客户",
  "booking.row.saving": "保存中…",
  "booking.row.saved": "已保存 ✓",
  "booking.row.failed": "未保存，请重试。",
  "booking.row.invalid":
    "无法读取该值（数字、日期，或名称少于 2 个字）。未保存任何内容。",
  "booking.row.autosave":
    "表格中的字段会自动保存：从列表中选择，或输入后离开该字段。下方显示“已保存 ✓”；无法保存时，原因以红色显示。",
  "booking.next.open_rfq": "下一步：开启询价（RFQ），向供应商发送报价请求。",
  "booking.next.wait_supplier":
    "等待供应商提交报价（确认或修改价格）。如对方已通过其他方式回复，请在报价中登记。",
  "booking.next.offer_declined":
    "供应商未接受该价格。请与对方沟通，或在此表格中修改价格。",
  "booking.next.negotiating": "报价已退回：等待供应商回复。",
  "booking.next.choose_quote":
    "供应商已提交报价。下一步：核对并确认报价（含销售价格）。",
  "booking.next.supplier_draft":
    "报价采购单已填写一部分，但报价尚未提交。请打开查看缺少的内容，或代供应商登记回复。",
  "booking.next.sign_wellmix":
    "已转为订单。下一步：Wellmix 签署订单文件，以便发给供应商。",
  "booking.next.sign_supplier": "订单文件已发送。等待供应商下载、签署并上传。",
  "booking.next.signed": "订单文件已由双方签署并保存在订单中。",
  "booking.next.count": "（已提交 {answered}/{total} 份报价）",
  "booking.next.label.open_rfq": "开启询价",
  "booking.next.label.wait_supplier": "等待供应商",
  "booking.next.label.supplier_draft": "报价草稿",
  "booking.next.label.offer_declined": "价格未接受",
  "booking.next.label.negotiating": "协商中",
  "booking.next.label.choose_quote": "报价已提交",
  "booking.next.label.wait_down_payment": "报价已确认",
  "booking.next.label.ordered": "订单已创建",
  "booking.next.label.sign_wellmix": "订单：签署文件",
  "booking.next.label.sign_supplier": "文件在供应商处",
  "booking.next.label.signed": "文件已签署",
  "booking.next.label.cancelled": "已取消",
  "booking.next.go.confirm": "核对并确认",
  "booking.next.go.document": "打开订单文件",
  "booking.next.wait_down_payment":
    "已选定供应商。下一步：在询价单中确认定金（或审批）。",
  "booking.next.ordered": "已转为订单。之后请在订单中跟进。",
  "booking.next.cancelled": "询价单已取消。",
  "booking.next.go.request": "打开询价单",
  "booking.next.go.quote": "打开报价",
  "booking.next.go.order": "打开订单",
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
