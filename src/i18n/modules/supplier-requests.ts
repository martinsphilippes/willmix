/**
 * Seleção de itens e solicitação ao fornecedor (docs/SUPPLIER_REQUESTS.md).
 * Mesmas chaves em pt, en e zh.
 */
export const pt = {
  "supplierRequests.detail.createdNoLogin":
    "Solicitação aberta. O fornecedor ainda não tem acesso ao portal: crie o acesso ou registre a resposta dele aqui (veja o aviso acima).",
  "supplierRequests.noLogin.selection":
    "Fornecedores sem acesso ao portal: a solicitação aberta a eles não chega a ninguém até o login ser criado.",
  "supplierRequests.noLogin.request":
    "Fornecedor sem acesso ao portal: ele não vê nem responde esta solicitação.",
  "supplierRequests.noLogin.requestHint":
    "Crie o acesso no cadastro dele (ele passa a ver esta solicitação assim que entrar) ou registre aqui a resposta que ele der por fora (WeChat, e-mail).",
  "nav.bookingSelection": "Seleção de itens",
  "nav.supplierRequests": "Solicitações ao fornecedor",

  "supplierRequests.selection.title": "Seleção de itens",
  "supplierRequests.selection.subtitle":
    "Itens dos bookings, inclusive os rascunhos. Filtre, agrupe itens de vários fornecedores, compare os parecidos e abra a solicitação ao fornecedor do melhor (booking fechado).",
  "supplierRequests.selection.search":
    "Buscar em qualquer campo (descrição, código, material, fornecedor, origem…)",
  "supplierRequests.selection.searchPlaceholder":
    "Ex.: copo vidro, garrafa térmica, 350",
  "supplierRequests.selection.filter": "Filtrar",
  "supplierRequests.selection.clear": "Limpar",
  "supplierRequests.selection.count": "{n} itens",
  "supplierRequests.selection.truncated":
    "Mostrando {shown} de {n} itens. Refine a busca para ver o resto.",
  "supplierRequests.selection.empty":
    "Nenhum item de booking fechado combina com a busca.",
  "supplierRequests.selection.noItems":
    "Nenhum booking fechado ainda. Feche um booking para os itens dele aparecerem aqui.",
  "supplierRequests.selection.schemaMissing":
    "As tabelas novas ainda não foram publicadas no banco (npm run appwrite:push).",
  "supplierRequests.selection.best": "Melhor preço mínimo",
  "supplierRequests.selection.similar": "ver parecidos",
  "supplierRequests.selection.tab.items": "Itens",
  "supplierRequests.selection.tab.selection": "Seleção",
  "supplierRequests.selection.pick": "Agrupar",
  "supplierRequests.selection.pickAll": "Marcar todos os da tela",
  "supplierRequests.selection.pickHint":
    'Esta aba é só para agrupar: marque os itens (um a um ou todos os da tela, com filtro e busca) e clique em "Agrupar para seleção". A solicitação ao fornecedor abre na aba Seleção, com o grupo.',
  "supplierRequests.selection.draftHint":
    "Feche o booking para abrir a solicitação deste item",
  "supplierRequests.selection.filter.period": "Período do booking",
  "supplierRequests.selection.filter.anyDate": "Qualquer data",
  "supplierRequests.selection.filter.apply": "Aplicar",
  "supplierRequests.selection.filter.clearDates": "Limpar datas",
  "supplierRequests.selection.filter.last7": "Últimos 7 dias",
  "supplierRequests.selection.filter.last30": "Últimos 30 dias",
  "supplierRequests.selection.filter.thisMonth": "Este mês",
  "supplierRequests.selection.filter.lastMonth": "Mês passado",
  "supplierRequests.selection.filter.previous": "Mês anterior",
  "supplierRequests.selection.filter.next": "Próximo mês",
  "supplierRequests.selection.filter.supplier": "Fornecedor",
  "supplierRequests.selection.filter.origin": "Origem",
  "supplierRequests.selection.filter.all": "Todos",
  "supplierRequests.selection.filter.status": "Status",
  "supplierRequests.selection.basket.count": "{n} itens marcados",
  "supplierRequests.selection.basket.group": "Agrupar para seleção",
  "supplierRequests.selection.basket.clear": "Limpar",
  "supplierRequests.selection.basket.limit": "Até {max} itens por grupo",
  "supplierRequests.selection.group.title":
    "Grupo para seleção: {n} itens de {suppliers} fornecedores",
  "supplierRequests.selection.group.empty":
    "Nenhum item do grupo foi encontrado.",
  "supplierRequests.selection.group.back": "Voltar para os itens",
  "supplierRequests.selection.blocks.title": "Blocos sugeridos",
  "supplierRequests.selection.blocks.hint":
    "Itens parecidos pelo nome, dos bookings do filtro. Abra um bloco para comparar e escolher.",
  "supplierRequests.selection.blocks.size":
    "{n} itens · {suppliers} fornecedores",
  "supplierRequests.selection.blocks.more": "e mais {n}",
  "supplierRequests.selection.blocks.open": "Comparar e selecionar",
  "supplierRequests.selection.blocks.empty":
    "Nenhum bloco de itens parecidos com os filtros atuais.",
  "supplierRequests.selection.inRequest": "Solicitação nº {n}",
  "supplierRequests.selection.col.choose": "Escolher",
  "supplierRequests.selection.col.alternative": "Alternativa",
  "supplierRequests.selection.col.photo": "Foto",
  "supplierRequests.selection.col.item": "Item",
  "supplierRequests.selection.col.supplier": "Fornecedor",
  "supplierRequests.selection.col.booking": "Booking",
  "supplierRequests.selection.col.price": "Preço",
  "supplierRequests.selection.col.priceUsd": "Preço (US$)",
  "supplierRequests.selection.col.moq": "MOQ",
  "supplierRequests.selection.col.box": "Qtd/caixa",
  "supplierRequests.selection.col.cbm": "CBM",
  "supplierRequests.selection.col.size": "Medidas (cm)",
  "supplierRequests.selection.col.capacity": "Capacidade (ml)",
  "supplierRequests.selection.col.material": "Material / embalagem",
  "supplierRequests.selection.col.sheetQty": "Qtd da planilha",
  "supplierRequests.selection.col.superplan": "Superplan",
  "supplierRequests.selection.col.situation": "Situação",
  "supplierRequests.selection.form.title": "Gravar a escolha do grupo",
  "supplierRequests.selection.form.body":
    "Marque o item que ganhou (um só) e informe a quantidade de peças. O botão só grava a escolha: nada vai ao fornecedor agora. A solicitação é aberta depois, nos blocos, só do item que ganhou de cada grupo.",
  "supplierRequests.selection.form.quantity": "Quantidade (peças)",
  "supplierRequests.selection.form.quantityHint":
    "Em branco: a quantidade da planilha do item escolhido.",
  "supplierRequests.selection.form.needs": "O que a Wellmix precisa no produto",
  "supplierRequests.selection.form.needsHint":
    "Cor, embalagem, logo, ajuste… O fornecedor lê este texto.",
  "supplierRequests.selection.form.submit": "Gravar escolha",
  "supplierRequests.selection.form.pending": "Gravando…",

  "supplierRequests.list.title": "Solicitações ao fornecedor",
  "supplierRequests.list.subtitle":
    "O que a Wellmix pediu aos fornecedores a partir da seleção de itens, com a resposta de cada um.",
  "supplierRequests.list.subtitleSupplier":
    "Pedidos da Wellmix para saber se você faz um item e em que condições. Abra e responda.",
  "supplierRequests.list.empty": "Nenhuma solicitação ainda.",
  "supplierRequests.list.toSelection": "Seleção de itens",
  "supplierRequests.col.number": "Nº",
  "supplierRequests.col.status": "Situação",
  "supplierRequests.col.supplier": "Fornecedor",
  "supplierRequests.col.item": "Item",
  "supplierRequests.col.quantity": "Quantidade",
  "supplierRequests.col.answer": "Resposta",
  "supplierRequests.col.createdAt": "Aberta em",
  "supplierRequests.status.open": "Aberta",
  "supplierRequests.status.answered": "Respondida",
  "supplierRequests.status.approved": "Aprovada",
  "supplierRequests.status.declined": "Recusada",
  "supplierRequests.status.cancelled": "Cancelada",
  "supplierRequests.answer.yes": "Faz: {price}",
  "supplierRequests.answer.yesNoPrice": "Faz",
  "supplierRequests.answer.no": "Não faz",
  "supplierRequests.answer.waiting": "Esperando o fornecedor",

  "supplierRequests.detail.title": "Solicitação ao fornecedor nº {n}",
  "supplierRequests.detail.back": "Voltar às solicitações",
  "supplierRequests.detail.created":
    "Solicitação aberta. O fornecedor foi avisado e responde no portal.",
  "supplierRequests.detail.answered": "Resposta registrada.",
  "supplierRequests.detail.decided.approved":
    "Solicitação aprovada. Crie o produto ou associe a um existente no bloco Produto, logo abaixo.",
  "supplierRequests.detail.decided.declined": "Solicitação recusada.",
  "supplierRequests.detail.decided.cancelled": "Solicitação cancelada.",
  "supplierRequests.detail.request": "O que a Wellmix pede",
  "supplierRequests.detail.quantity": "Quantidade",
  "supplierRequests.detail.pieces": "{n} peças",
  "supplierRequests.detail.needs": "O que a Wellmix precisa no produto",
  "supplierRequests.detail.needsNone": "Nada além do item como está.",
  "supplierRequests.detail.item": "Item",
  "supplierRequests.detail.bookingPrice": "Preço do booking",
  "supplierRequests.detail.booking": "Booking",
  "supplierRequests.detail.bookingOf": "Booking nº {n} · {file}",
  "supplierRequests.detail.supplier": "Fornecedor",
  "supplierRequests.detail.answer.title": "Resposta do fornecedor",
  "supplierRequests.detail.answer.none": "O fornecedor ainda não respondeu.",
  "supplierRequests.detail.answer.canDo": "Faz o que foi pedido?",
  "supplierRequests.detail.answer.yes": "Sim, faço",
  "supplierRequests.detail.answer.no": "Não faço",
  "supplierRequests.detail.answer.price": "Preço por peça",
  "supplierRequests.detail.answer.currency": "Moeda",
  "supplierRequests.detail.answer.moq": "Pedido mínimo (peças)",
  "supplierRequests.detail.answer.leadTime": "Prazo de produção (dias)",
  "supplierRequests.detail.answer.note": "Observação",
  "supplierRequests.detail.answer.submit": "Enviar resposta",
  "supplierRequests.detail.answer.submitWellmix":
    "Registrar a resposta do fornecedor",
  "supplierRequests.detail.answer.wellmixHint":
    "Use quando o fornecedor respondeu por fora do portal (WeChat, e-mail).",
  "supplierRequests.detail.answer.pending": "Enviando…",
  "supplierRequests.detail.answer.at": "Respondido em {date}",
  "supplierRequests.detail.answer.change":
    "Você pode mudar a resposta até a Wellmix decidir.",
  "supplierRequests.detail.decide.title": "Decisão da Wellmix",
  "supplierRequests.detail.decide.approved": "Aprovar",
  "supplierRequests.detail.decide.declined": "Recusar",
  "supplierRequests.detail.decide.cancelled": "Cancelar a solicitação",
  "supplierRequests.detail.decide.note": "Observação da decisão",
  "supplierRequests.detail.decide.at": "Decidido em {date}",
  "supplierRequests.detail.alternatives": "Alternativas ({n})",
  "supplierRequests.detail.alternativesNone": "Nenhuma alternativa guardada.",
  "supplierRequests.detail.alternativesHint":
    "Só a Wellmix vê: itens parecidos de outros bookings, para comparar ou abrir outra solicitação.",
  "supplierRequests.detail.chosenSuperplan": "Superplan do item escolhido",

  "supplierRequests.error.supplier_request_choose":
    "Marque o item escolhido antes de abrir a solicitação.",
  "supplierRequests.error.supplier_request_lot_not_closed":
    "O booking deste item não está fechado. Feche o booking antes de abrir a solicitação.",
  "supplierRequests.error.supplier_request_no_supplier":
    "O booking deste item não tem fornecedor.",
  "supplierRequests.error.supplier_invalid":
    "O fornecedor deste item está inativo ou não existe mais.",
  "supplierRequests.error.supplier_request_exists":
    "Este item já tem uma solicitação em andamento. Abra a que existe.",
  "supplierRequests.error.supplier_request_qty_required":
    "A planilha não traz quantidade para este item: digite a quantidade.",
  "supplierRequests.error.supplier_request_closed":
    "A Wellmix já decidiu esta solicitação: a resposta não muda mais.",
  "supplierRequests.error.supplier_request_price_required":
    "Informe o preço por peça para dizer que faz.",
  "supplierRequests.error.supplier_request_decision_invalid":
    "Essa decisão não vale para a situação atual da solicitação.",
  "supplierRequests.error.schema_outdated":
    "As tabelas novas ainda não foram publicadas no banco (npm run appwrite:push).",
  "supplierRequests.error.not_found": "Solicitação ou item não encontrado.",
  "supplierRequests.error.invalid_input":
    "Algum valor não dá para ler. Use números maiores que zero.",

  "supplierRequests.notify.open.subject": "Nova solicitação da Wellmix nº {n}",
  "supplierRequests.notify.open.body":
    "A Wellmix quer saber se você faz o item {code} ({qty} peças). Abra a solicitação nº {n} e responda.",
  "supplierRequests.notify.answer.subject":
    "O fornecedor respondeu a solicitação nº {n}",
  "supplierRequests.notify.answer.yes":
    "O fornecedor disse que faz. Confira as condições na solicitação nº {n} e decida.",
  "supplierRequests.notify.answer.no":
    "O fornecedor disse que não faz o pedido da solicitação nº {n}.",
  "supplierRequests.notify.approved.subject": "Solicitação nº {n} aprovada",
  "supplierRequests.notify.approved.body":
    "A Wellmix aprovou a solicitação nº {n}. Os próximos passos chegam pelo portal.",
  "supplierRequests.notify.declined.subject": "Solicitação nº {n} recusada",
  "supplierRequests.notify.declined.body":
    "A Wellmix não vai seguir com a solicitação nº {n} desta vez.",
  "supplierRequests.notify.cancelled.subject": "Solicitação nº {n} cancelada",
  "supplierRequests.notify.cancelled.body":
    "A Wellmix cancelou a solicitação nº {n}. Não é preciso responder.",
  "supplierRequests.table.title": "Produtos desta solicitação",
  "supplierRequests.table.subtitle":
    "{n} produto(s) que a Wellmix pediu a você neste booking",
  "supplierRequests.table.col.photo": "Foto",
  "supplierRequests.table.col.item": "Produto",
  "supplierRequests.table.col.quantity": "Quantidade",
  "supplierRequests.table.col.bookingPrice": "Preço do booking",
  "supplierRequests.table.col.answer": "Sua resposta",
  "supplierRequests.table.col.status": "Situação",
  "supplierRequests.table.col.actions": "Ações",
  "supplierRequests.table.photo": "Ampliar a foto",
  "supplierRequests.table.photoOpen": "Abrir a foto em tamanho real",
  "supplierRequests.table.noPhoto": "Sem foto",
  "supplierRequests.table.close": "Fechar",
  "supplierRequests.table.needs": "A Wellmix precisa",
  "supplierRequests.table.current": "Esta solicitação",
  "supplierRequests.table.proposalPending":
    "Contraproposta esperando você: abra o produto para responder.",
  "supplierRequests.table.message": "Mensagem",
  "supplierRequests.table.messageTitle":
    "Mensagem à Wellmix · solicitação nº {n}",
  "supplierRequests.table.messageText": "Mensagem",
  "supplierRequests.table.send": "Enviar",
  "supplierRequests.table.sending": "Enviando…",
  "supplierRequests.table.answer": "Sim / Não",
  "supplierRequests.table.answerTitle":
    "Resposta definitiva · solicitação nº {n}",
  "supplierRequests.table.yes": "Sim, faço",
  "supplierRequests.table.no": "Não faço",
  "supplierRequests.table.open": "Abrir produto",
  "supplierRequests.table.back": "Ver todos os produtos",
  "supplierRequests.selection.saved":
    "Escolha gravada. O grupo aparece abaixo como resolvido, com o item escolhido em verde. Nada foi enviado ao fornecedor ainda.",
  "supplierRequests.selection.opened":
    "Solicitações abertas e enviadas aos fornecedores: {n}.",
  "supplierRequests.selection.openFailed":
    "Não abriram e continuam gravadas: {n}.",
  "supplierRequests.selection.open.ready":
    "Grupos resolvidos esperando a solicitação: {n}. Vai ao fornecedor só o item escolhido de cada um.",
  "supplierRequests.selection.open.none":
    "Nenhum grupo resolvido esperando. Abra um bloco, compare e grave a escolha.",
  "supplierRequests.selection.open.marked": "Abrir solicitação dos marcados",
  "supplierRequests.selection.open.all": "Abrir solicitação de todos ({n})",
  "supplierRequests.selection.open.mark": "Marcar para abrir a solicitação",
  "supplierRequests.selection.resolved": "Resolvido",
  "supplierRequests.selection.requested": "Solicitação nº {n} aberta",
  "supplierRequests.selection.requestedNoLink": "Solicitação aberta",
  "supplierRequests.selection.winner": "Escolhido · {qty} peças",
  "supplierRequests.selection.blocks.reopen": "Rever a escolha",
  "supplierRequests.selection.blocks.sizeManual": "{n} itens comparados",
  "supplierRequests.error.selection_group_pick":
    "Marque ao menos um grupo resolvido, ou use o botão de abrir todos.",
  "supplierRequests.error.selection_group_none":
    "Nenhum grupo resolvido esperando a solicitação.",
  "supplierRequests.table.subtitleWellmix":
    "{n} produto(s) pedidos a este fornecedor neste booking",
  "supplierRequests.table.hintWellmix":
    "Uma informação por coluna. Pelos ícones: mensagem ao fornecedor, registrar a resposta dele (quando chega por fora) e abrir a tela do produto.",
  "supplierRequests.table.answerWellmix": "Registrar a resposta do fornecedor",
  "supplierRequests.table.answerTitleWellmix":
    "Resposta do fornecedor (registrada pela Wellmix) · solicitação nº {n}",
  "supplierRequests.table.proposalPendingWellmix":
    "Contraproposta esperando o fornecedor.",
  "supplierRequests.table.late": "Atrasada",
  "supplierRequests.table.canDoYes": "Faz",
  "supplierRequests.table.canDoNo": "Não faz",
  "supplierRequests.table.canDoWaiting": "Esperando",
  "supplierRequests.table.col.number": "Nº",
  "supplierRequests.table.col.factoryCode": "Cód. fábrica",
  "supplierRequests.table.col.itemNumber": "Nº do item",
  "supplierRequests.table.col.material": "Material",
  "supplierRequests.table.col.bookingMoq": "MOQ do booking",
  "supplierRequests.table.col.bookingCurrency": "Moeda",
  "supplierRequests.table.col.bookingIncoterm": "Entrega do booking",
  "supplierRequests.table.col.needs": "A Wellmix precisa",
  "supplierRequests.table.col.canDo": "Faz?",
  "supplierRequests.table.col.sla": "SLA",
  "supplierRequests.table.col.turn": "Vez",
  "supplierRequests.table.col.openedAt": "Aberta em",
  "supplierRequests.table.col.firstAnswerAt": "1ª resposta",
  "supplierRequests.table.col.lastAnswerAt": "Última resposta",
  "supplierRequests.detail.answer.incoterm": "Modalidade de entrega",
  "supplierRequests.chat.open": "Abrir a conversa",
  "supplierRequests.chat.title": "Conversa · solicitação nº {n}",
  "supplierRequests.chat.close": "Fechar a conversa",
  "supplierRequests.chat.empty":
    "Nenhuma mensagem ainda. Escreva abaixo; dá para anexar foto, PDF ou Excel.",
  "supplierRequests.chat.placeholder": "Escreva uma mensagem",
  "supplierRequests.chat.send": "Enviar",
  "supplierRequests.chat.closed":
    "Solicitação encerrada: a conversa fica só para leitura.",
  "supplierRequests.timeline.title": "Histórico de interações",
  "supplierRequests.timeline.days": "{n} dias",
  "supplierRequests.timeline.opened": "Solicitação aberta: {n} peças",
  "supplierRequests.timeline.answerYes": "Fornecedor respondeu: faz",
  "supplierRequests.timeline.answerYesOnBehalf":
    "Resposta registrada pela Wellmix: faz",
  "supplierRequests.timeline.answerNo": "Fornecedor respondeu: não faz",
  "supplierRequests.timeline.proposal": "Contraproposta da Wellmix",
  "supplierRequests.timeline.accept":
    "Contraproposta aceita: os valores viraram a resposta",
  "supplierRequests.timeline.counter": "Nova proposta do fornecedor",
  "supplierRequests.timeline.reject":
    "Contraproposta recusada: fica a resposta anterior",
  "supplierRequests.timeline.message": "Mensagem",
  "supplierRequests.timeline.file": "Arquivo enviado",
  "supplierRequests.timeline.decided.approved": "Aprovada pela Wellmix",
  "supplierRequests.timeline.decided.declined": "Recusada pela Wellmix",
  "supplierRequests.timeline.decided.cancelled": "Cancelada pela Wellmix",
  "supplierRequests.timeline.productCreated": "Produto criado",
  "supplierRequests.timeline.productLinked": "Associada a um produto existente",
  "supplierRequests.timeline.showcase": "Produto liberado na vitrine",
  "supplierRequests.timeline.erp": "CODPROD conferido no Sankhya",
  "supplierRequests.table.hint":
    "Uma informação por coluna. Pelos ícones: mensagem à Wellmix, resposta sim/não e abrir a tela do produto.",
  "supplierRequests.table.answerHint":
    "Para responder sim, informe o preço por peça. Pedido mínimo e modalidade de entrega (FOB/EXW) vão junto; o prazo fica como está (mude na tela do produto).",
  "supplierRequests.table.col.initial": "Condições iniciais (booking)",
  "supplierRequests.table.col.final": "Condições finais (última proposta)",
  "supplierRequests.table.col.cond.price": "Preço",
  "supplierRequests.table.col.cond.currency": "Moeda",
  "supplierRequests.table.col.cond.moq": "MOQ",
  "supplierRequests.table.col.cond.incoterm": "FOB/EXW",
  "supplierRequests.table.col.cond.leadTime": "Prazo (dias)",
  "supplierRequests.list.count":
    "{n} solicitações · {products} produtos distintos",
  "supplierRequests.col.products": "Produtos distintos",
  "supplierRequests.col.finishedAt": "Finalizada em",
  "supplierRequests.list.finishedLate": "Em atraso",
  "supplierRequests.list.finishedOnTime": "Dentro do SLA",
  "supplierRequests.table.col.cond.state": "Situação",
  "supplierRequests.table.state.answer": "Resposta do fornecedor",
  "supplierRequests.table.state.pending": "Contraproposta enviada",
  "supplierRequests.table.state.accepted": "Aceita",
  "supplierRequests.table.state.rejected": "Recusada",
  "supplierRequests.table.state.counter": "Nova proposta do fornecedor",
};

export const en: typeof pt = {
  "supplierRequests.detail.createdNoLogin":
    "Request opened. The supplier has no portal access yet: create the access or record their answer here (see the notice above).",
  "supplierRequests.noLogin.selection":
    "Suppliers without portal access: a request opened to them reaches no one until the login is created.",
  "supplierRequests.noLogin.request":
    "Supplier without portal access: they cannot see or answer this request.",
  "supplierRequests.noLogin.requestHint":
    "Create the access in their record (they see this request as soon as they log in) or record here the answer they give outside the portal (WeChat, e-mail).",
  "nav.bookingSelection": "Item selection",
  "nav.supplierRequests": "Supplier requests",

  "supplierRequests.selection.title": "Item selection",
  "supplierRequests.selection.subtitle":
    "Items from the bookings, drafts included. Filter, group items from several suppliers, compare similar ones and open a request to the best one's supplier (closed booking).",
  "supplierRequests.selection.search":
    "Search any field (description, code, material, supplier, origin…)",
  "supplierRequests.selection.searchPlaceholder":
    "E.g.: glass cup, thermos, 350",
  "supplierRequests.selection.filter": "Filter",
  "supplierRequests.selection.clear": "Clear",
  "supplierRequests.selection.count": "{n} items",
  "supplierRequests.selection.truncated":
    "Showing {shown} of {n} items. Refine the search to see the rest.",
  "supplierRequests.selection.empty":
    "No item from a closed booking matches the search.",
  "supplierRequests.selection.noItems":
    "No closed booking yet. Close a booking for its items to show up here.",
  "supplierRequests.selection.schemaMissing":
    "The new tables are not published in the database yet (npm run appwrite:push).",
  "supplierRequests.selection.best": "Best minimum price",
  "supplierRequests.selection.similar": "see similar",
  "supplierRequests.selection.tab.items": "Items",
  "supplierRequests.selection.tab.selection": "Selection",
  "supplierRequests.selection.pick": "Group",
  "supplierRequests.selection.pickAll": "Select all on screen",
  "supplierRequests.selection.pickHint":
    'This tab is only for grouping: tick the items (one by one or all on screen, with filter and search) and click "Group for selection". The supplier request is opened in the Selection tab, with the group.',
  "supplierRequests.selection.draftHint":
    "Close the booking to open the request for this item",
  "supplierRequests.selection.filter.period": "Booking period",
  "supplierRequests.selection.filter.anyDate": "Any date",
  "supplierRequests.selection.filter.apply": "Apply",
  "supplierRequests.selection.filter.clearDates": "Clear dates",
  "supplierRequests.selection.filter.last7": "Last 7 days",
  "supplierRequests.selection.filter.last30": "Last 30 days",
  "supplierRequests.selection.filter.thisMonth": "This month",
  "supplierRequests.selection.filter.lastMonth": "Last month",
  "supplierRequests.selection.filter.previous": "Previous month",
  "supplierRequests.selection.filter.next": "Next month",
  "supplierRequests.selection.filter.supplier": "Supplier",
  "supplierRequests.selection.filter.origin": "Origin",
  "supplierRequests.selection.filter.all": "All",
  "supplierRequests.selection.filter.status": "Status",
  "supplierRequests.selection.basket.count": "{n} items ticked",
  "supplierRequests.selection.basket.group": "Group for selection",
  "supplierRequests.selection.basket.clear": "Clear",
  "supplierRequests.selection.basket.limit": "Up to {max} items per group",
  "supplierRequests.selection.group.title":
    "Group for selection: {n} items from {suppliers} suppliers",
  "supplierRequests.selection.group.empty": "No item of the group was found.",
  "supplierRequests.selection.group.back": "Back to items",
  "supplierRequests.selection.blocks.title": "Suggested blocks",
  "supplierRequests.selection.blocks.hint":
    "Items with similar names, from the filtered bookings. Open a block to compare and choose.",
  "supplierRequests.selection.blocks.size": "{n} items · {suppliers} suppliers",
  "supplierRequests.selection.blocks.more": "and {n} more",
  "supplierRequests.selection.blocks.open": "Compare and select",
  "supplierRequests.selection.blocks.empty":
    "No block of similar items with the current filters.",
  "supplierRequests.selection.inRequest": "Request no. {n}",
  "supplierRequests.selection.col.choose": "Choose",
  "supplierRequests.selection.col.alternative": "Alternative",
  "supplierRequests.selection.col.photo": "Photo",
  "supplierRequests.selection.col.item": "Item",
  "supplierRequests.selection.col.supplier": "Supplier",
  "supplierRequests.selection.col.booking": "Booking",
  "supplierRequests.selection.col.price": "Price",
  "supplierRequests.selection.col.priceUsd": "Price (US$)",
  "supplierRequests.selection.col.moq": "MOQ",
  "supplierRequests.selection.col.box": "Qty/box",
  "supplierRequests.selection.col.cbm": "CBM",
  "supplierRequests.selection.col.size": "Size (cm)",
  "supplierRequests.selection.col.capacity": "Capacity (ml)",
  "supplierRequests.selection.col.material": "Material / package",
  "supplierRequests.selection.col.sheetQty": "Spreadsheet qty",
  "supplierRequests.selection.col.superplan": "Superplan",
  "supplierRequests.selection.col.situation": "Status",
  "supplierRequests.selection.form.title": "Save the group's choice",
  "supplierRequests.selection.form.body":
    "Mark the winning item (only one) and enter the quantity in pieces. The button only saves the choice: nothing goes to the supplier now. The request is opened later, in the blocks, only for the winning item of each group.",
  "supplierRequests.selection.form.quantity": "Quantity (pieces)",
  "supplierRequests.selection.form.quantityHint":
    "Blank: the chosen item's spreadsheet quantity.",
  "supplierRequests.selection.form.needs": "What Wellmix needs in the product",
  "supplierRequests.selection.form.needsHint":
    "Color, package, logo, adjustment… The supplier reads this text.",
  "supplierRequests.selection.form.submit": "Save choice",
  "supplierRequests.selection.form.pending": "Saving…",

  "supplierRequests.list.title": "Supplier requests",
  "supplierRequests.list.subtitle":
    "What Wellmix asked suppliers from the item selection, with each answer.",
  "supplierRequests.list.subtitleSupplier":
    "Wellmix asks whether you make an item and on what terms. Open and answer.",
  "supplierRequests.list.empty": "No requests yet.",
  "supplierRequests.list.toSelection": "Item selection",
  "supplierRequests.col.number": "No.",
  "supplierRequests.col.status": "Status",
  "supplierRequests.col.supplier": "Supplier",
  "supplierRequests.col.item": "Item",
  "supplierRequests.col.quantity": "Quantity",
  "supplierRequests.col.answer": "Answer",
  "supplierRequests.col.createdAt": "Opened at",
  "supplierRequests.status.open": "Open",
  "supplierRequests.status.answered": "Answered",
  "supplierRequests.status.approved": "Approved",
  "supplierRequests.status.declined": "Declined",
  "supplierRequests.status.cancelled": "Cancelled",
  "supplierRequests.answer.yes": "Can do: {price}",
  "supplierRequests.answer.yesNoPrice": "Can do",
  "supplierRequests.answer.no": "Cannot do",
  "supplierRequests.answer.waiting": "Waiting for the supplier",

  "supplierRequests.detail.title": "Supplier request no. {n}",
  "supplierRequests.detail.back": "Back to requests",
  "supplierRequests.detail.created":
    "Request opened. The supplier was notified and answers in the portal.",
  "supplierRequests.detail.answered": "Answer recorded.",
  "supplierRequests.detail.decided.approved":
    "Request approved. Create the product or link an existing one in the Product block below.",
  "supplierRequests.detail.decided.declined": "Request declined.",
  "supplierRequests.detail.decided.cancelled": "Request cancelled.",
  "supplierRequests.detail.request": "What Wellmix asks",
  "supplierRequests.detail.quantity": "Quantity",
  "supplierRequests.detail.pieces": "{n} pieces",
  "supplierRequests.detail.needs": "What Wellmix needs in the product",
  "supplierRequests.detail.needsNone": "Nothing beyond the item as it is.",
  "supplierRequests.detail.item": "Item",
  "supplierRequests.detail.bookingPrice": "Booking price",
  "supplierRequests.detail.booking": "Booking",
  "supplierRequests.detail.bookingOf": "Booking no. {n} · {file}",
  "supplierRequests.detail.supplier": "Supplier",
  "supplierRequests.detail.answer.title": "Supplier's answer",
  "supplierRequests.detail.answer.none": "The supplier has not answered yet.",
  "supplierRequests.detail.answer.canDo": "Can you do what was asked?",
  "supplierRequests.detail.answer.yes": "Yes, I can",
  "supplierRequests.detail.answer.no": "No, I can't",
  "supplierRequests.detail.answer.price": "Price per piece",
  "supplierRequests.detail.answer.currency": "Currency",
  "supplierRequests.detail.answer.moq": "Minimum order (pieces)",
  "supplierRequests.detail.answer.leadTime": "Production lead time (days)",
  "supplierRequests.detail.answer.note": "Note",
  "supplierRequests.detail.answer.submit": "Send answer",
  "supplierRequests.detail.answer.submitWellmix":
    "Record the supplier's answer",
  "supplierRequests.detail.answer.wellmixHint":
    "Use when the supplier answered outside the portal (WeChat, e-mail).",
  "supplierRequests.detail.answer.pending": "Sending…",
  "supplierRequests.detail.answer.at": "Answered on {date}",
  "supplierRequests.detail.answer.change":
    "You can change the answer until Wellmix decides.",
  "supplierRequests.detail.decide.title": "Wellmix decision",
  "supplierRequests.detail.decide.approved": "Approve",
  "supplierRequests.detail.decide.declined": "Decline",
  "supplierRequests.detail.decide.cancelled": "Cancel the request",
  "supplierRequests.detail.decide.note": "Decision note",
  "supplierRequests.detail.decide.at": "Decided on {date}",
  "supplierRequests.detail.alternatives": "Alternatives ({n})",
  "supplierRequests.detail.alternativesNone": "No alternatives kept.",
  "supplierRequests.detail.alternativesHint":
    "Wellmix only: similar items from other bookings, to compare or open another request.",
  "supplierRequests.detail.chosenSuperplan": "Superplan of the chosen item",

  "supplierRequests.error.supplier_request_choose":
    "Mark the chosen item before opening the request.",
  "supplierRequests.error.supplier_request_lot_not_closed":
    "This item's booking is not closed. Close the booking before opening the request.",
  "supplierRequests.error.supplier_request_no_supplier":
    "This item's booking has no supplier.",
  "supplierRequests.error.supplier_invalid":
    "This item's supplier is inactive or no longer exists.",
  "supplierRequests.error.supplier_request_exists":
    "This item already has a request in progress. Open the existing one.",
  "supplierRequests.error.supplier_request_qty_required":
    "The spreadsheet has no quantity for this item: type the quantity.",
  "supplierRequests.error.supplier_request_closed":
    "Wellmix has already decided this request: the answer no longer changes.",
  "supplierRequests.error.supplier_request_price_required":
    "Enter the price per piece to say you can do it.",
  "supplierRequests.error.supplier_request_decision_invalid":
    "That decision does not apply to the request's current status.",
  "supplierRequests.error.schema_outdated":
    "The new tables are not published in the database yet (npm run appwrite:push).",
  "supplierRequests.error.not_found": "Request or item not found.",
  "supplierRequests.error.invalid_input":
    "Some value cannot be read. Use numbers above zero.",

  "supplierRequests.notify.open.subject": "New Wellmix request no. {n}",
  "supplierRequests.notify.open.body":
    "Wellmix wants to know whether you make item {code} ({qty} pieces). Open request no. {n} and answer.",
  "supplierRequests.notify.answer.subject":
    "The supplier answered request no. {n}",
  "supplierRequests.notify.answer.yes":
    "The supplier said they can do it. Check the terms in request no. {n} and decide.",
  "supplierRequests.notify.answer.no":
    "The supplier said they cannot do request no. {n}.",
  "supplierRequests.notify.approved.subject": "Request no. {n} approved",
  "supplierRequests.notify.approved.body":
    "Wellmix approved request no. {n}. Next steps will come through the portal.",
  "supplierRequests.notify.declined.subject": "Request no. {n} declined",
  "supplierRequests.notify.declined.body":
    "Wellmix will not move forward with request no. {n} this time.",
  "supplierRequests.notify.cancelled.subject": "Request no. {n} cancelled",
  "supplierRequests.notify.cancelled.body":
    "Wellmix cancelled request no. {n}. No answer is needed.",
  "supplierRequests.table.title": "Products in this request",
  "supplierRequests.table.subtitle":
    "{n} product(s) Wellmix requested from you in this booking",
  "supplierRequests.table.col.photo": "Photo",
  "supplierRequests.table.col.item": "Product",
  "supplierRequests.table.col.quantity": "Quantity",
  "supplierRequests.table.col.bookingPrice": "Booking price",
  "supplierRequests.table.col.answer": "Your answer",
  "supplierRequests.table.col.status": "Status",
  "supplierRequests.table.col.actions": "Actions",
  "supplierRequests.table.photo": "Enlarge photo",
  "supplierRequests.table.photoOpen": "Open photo at full size",
  "supplierRequests.table.noPhoto": "No photo",
  "supplierRequests.table.close": "Close",
  "supplierRequests.table.needs": "Wellmix needs",
  "supplierRequests.table.current": "This request",
  "supplierRequests.table.proposalPending":
    "Counter-offer waiting for you: open the product to reply.",
  "supplierRequests.table.message": "Message",
  "supplierRequests.table.messageTitle": "Message to Wellmix · request no. {n}",
  "supplierRequests.table.messageText": "Message",
  "supplierRequests.table.send": "Send",
  "supplierRequests.table.sending": "Sending…",
  "supplierRequests.table.answer": "Yes / No",
  "supplierRequests.table.answerTitle": "Final answer · request no. {n}",
  "supplierRequests.table.yes": "Yes, I can",
  "supplierRequests.table.no": "No, I can't",
  "supplierRequests.table.open": "Open product",
  "supplierRequests.table.back": "See all products",
  "supplierRequests.selection.saved":
    "Choice saved. The group appears below as resolved, with the chosen item in green. Nothing was sent to the supplier yet.",
  "supplierRequests.selection.opened":
    "Requests opened and sent to the suppliers: {n}.",
  "supplierRequests.selection.openFailed":
    "Did not open and remain saved: {n}.",
  "supplierRequests.selection.open.ready":
    "Resolved groups waiting for the request: {n}. Only the chosen item of each goes to the supplier.",
  "supplierRequests.selection.open.none":
    "No resolved group waiting. Open a block, compare and save the choice.",
  "supplierRequests.selection.open.marked": "Open request for the marked ones",
  "supplierRequests.selection.open.all": "Open request for all ({n})",
  "supplierRequests.selection.open.mark": "Mark to open the request",
  "supplierRequests.selection.resolved": "Resolved",
  "supplierRequests.selection.requested": "Request no. {n} opened",
  "supplierRequests.selection.requestedNoLink": "Request opened",
  "supplierRequests.selection.winner": "Chosen · {qty} pieces",
  "supplierRequests.selection.blocks.reopen": "Review the choice",
  "supplierRequests.selection.blocks.sizeManual": "{n} items compared",
  "supplierRequests.error.selection_group_pick":
    "Mark at least one resolved group, or use the open-all button.",
  "supplierRequests.error.selection_group_none":
    "No resolved group waiting for the request.",
  "supplierRequests.table.subtitleWellmix":
    "{n} product(s) requested from this supplier in this booking",
  "supplierRequests.table.hintWellmix":
    "One piece of information per column. Icons: message the supplier, record their answer (when it arrives elsewhere) and open the product screen.",
  "supplierRequests.table.hint":
    "One piece of information per column. Icons: message Wellmix, yes/no answer and open the product screen.",
  "supplierRequests.table.answerHint":
    "To answer yes, enter the price per piece. Minimum order and delivery terms (FOB/EXW) go with it; the lead time stays as it is (change it on the product screen).",
  "supplierRequests.table.answerWellmix": "Record the supplier's answer",
  "supplierRequests.table.answerTitleWellmix":
    "Supplier's answer (recorded by Wellmix) · request no. {n}",
  "supplierRequests.table.proposalPendingWellmix":
    "Counter-offer waiting for the supplier.",
  "supplierRequests.table.late": "Late",
  "supplierRequests.table.canDoYes": "Can do",
  "supplierRequests.table.canDoNo": "Can't do",
  "supplierRequests.table.canDoWaiting": "Waiting",
  "supplierRequests.table.col.number": "No.",
  "supplierRequests.table.col.factoryCode": "Factory code",
  "supplierRequests.table.col.itemNumber": "Item no.",
  "supplierRequests.table.col.material": "Material",
  "supplierRequests.table.col.bookingMoq": "Booking MOQ",
  "supplierRequests.table.col.bookingCurrency": "Currency",
  "supplierRequests.table.col.bookingIncoterm": "Booking terms",
  "supplierRequests.table.col.needs": "Wellmix needs",
  "supplierRequests.table.col.canDo": "Can do?",
  "supplierRequests.table.col.sla": "SLA",
  "supplierRequests.table.col.turn": "Turn",
  "supplierRequests.table.col.openedAt": "Opened",
  "supplierRequests.table.col.firstAnswerAt": "First answer",
  "supplierRequests.table.col.lastAnswerAt": "Last answer",
  "supplierRequests.detail.answer.incoterm": "Delivery terms",
  "supplierRequests.chat.open": "Open the conversation",
  "supplierRequests.chat.title": "Conversation · request no. {n}",
  "supplierRequests.chat.close": "Close the conversation",
  "supplierRequests.chat.empty":
    "No messages yet. Write below; you can attach a photo, PDF or Excel.",
  "supplierRequests.chat.placeholder": "Write a message",
  "supplierRequests.chat.send": "Send",
  "supplierRequests.chat.closed":
    "Request closed: the conversation is read-only.",
  "supplierRequests.timeline.title": "Interaction history",
  "supplierRequests.timeline.days": "{n} days",
  "supplierRequests.timeline.opened": "Request opened: {n} pieces",
  "supplierRequests.timeline.answerYes": "Supplier answered: can do",
  "supplierRequests.timeline.answerYesOnBehalf":
    "Answer recorded by Wellmix: can do",
  "supplierRequests.timeline.answerNo": "Supplier answered: can't do",
  "supplierRequests.timeline.proposal": "Wellmix counter-offer",
  "supplierRequests.timeline.accept":
    "Counter-offer accepted: the values became the answer",
  "supplierRequests.timeline.counter": "New proposal from the supplier",
  "supplierRequests.timeline.reject":
    "Counter-offer declined: the previous answer stays",
  "supplierRequests.timeline.message": "Message",
  "supplierRequests.timeline.file": "File sent",
  "supplierRequests.timeline.decided.approved": "Approved by Wellmix",
  "supplierRequests.timeline.decided.declined": "Declined by Wellmix",
  "supplierRequests.timeline.decided.cancelled": "Cancelled by Wellmix",
  "supplierRequests.timeline.productCreated": "Product created",
  "supplierRequests.timeline.productLinked": "Linked to an existing product",
  "supplierRequests.timeline.showcase": "Product released to the showcase",
  "supplierRequests.timeline.erp": "CODPROD checked in Sankhya",
  "supplierRequests.table.col.initial": "Initial terms (booking)",
  "supplierRequests.table.col.final": "Final terms (last proposal)",
  "supplierRequests.table.col.cond.price": "Price",
  "supplierRequests.table.col.cond.currency": "Currency",
  "supplierRequests.table.col.cond.moq": "MOQ",
  "supplierRequests.table.col.cond.incoterm": "FOB/EXW",
  "supplierRequests.table.col.cond.leadTime": "Lead time (days)",
  "supplierRequests.list.count": "{n} requests · {products} distinct products",
  "supplierRequests.col.products": "Distinct products",
  "supplierRequests.col.finishedAt": "Finished on",
  "supplierRequests.list.finishedLate": "Late",
  "supplierRequests.list.finishedOnTime": "Within SLA",
  "supplierRequests.table.col.cond.state": "Status",
  "supplierRequests.table.state.answer": "Supplier's answer",
  "supplierRequests.table.state.pending": "Counter-offer sent",
  "supplierRequests.table.state.accepted": "Accepted",
  "supplierRequests.table.state.rejected": "Declined",
  "supplierRequests.table.state.counter": "New proposal from the supplier",
};

export const zh: typeof pt = {
  "supplierRequests.detail.createdNoLogin":
    "询单已发起。该供应商还没有门户账号：请创建账号或在此记录其回复（见上方提示）。",
  "supplierRequests.noLogin.selection":
    "这些供应商没有门户账号：在创建登录之前，发给他们的询单无人接收。",
  "supplierRequests.noLogin.request":
    "该供应商没有门户账号：无法查看或回复此询单。",
  "supplierRequests.noLogin.requestHint":
    "请在其登记中创建账号（登录后即可看到此询单），或在此记录其在门户之外（微信、邮件）给出的回复。",
  "nav.bookingSelection": "条目筛选",
  "nav.supplierRequests": "供应商询单",

  "supplierRequests.selection.title": "条目筛选",
  "supplierRequests.selection.subtitle":
    "所有 booking 的条目（包括草稿）。筛选、将多个供应商的条目分组、比较相似条目，并向最佳条目的供应商发起询单（booking 须已关闭）。",
  "supplierRequests.selection.search":
    "搜索任意字段（描述、编码、材质、供应商、产地…）",
  "supplierRequests.selection.searchPlaceholder": "例如：玻璃杯、保温瓶、350",
  "supplierRequests.selection.filter": "筛选",
  "supplierRequests.selection.clear": "清除",
  "supplierRequests.selection.count": "{n} 个条目",
  "supplierRequests.selection.truncated":
    "显示 {n} 个中的 {shown} 个。请细化搜索以查看其余条目。",
  "supplierRequests.selection.empty": "没有已关闭 booking 的条目符合搜索。",
  "supplierRequests.selection.noItems":
    "还没有已关闭的 booking。关闭一个 booking 后其条目会出现在这里。",
  "supplierRequests.selection.schemaMissing":
    "新数据表尚未发布到数据库（npm run appwrite:push）。",
  "supplierRequests.selection.best": "最低价最优",
  "supplierRequests.selection.similar": "查看相似",
  "supplierRequests.selection.tab.items": "项目",
  "supplierRequests.selection.tab.selection": "选择",
  "supplierRequests.selection.pick": "分组",
  "supplierRequests.selection.pickAll": "全选本页",
  "supplierRequests.selection.pickHint":
    "此页签仅用于分组：勾选产品（逐个或勾选当前页全部，可配合筛选和搜索），然后点击“分组以便选择”。供应商申请在“选择”页签中按分组发起。",
  "supplierRequests.selection.draftHint":
    "关闭该 booking 后才能为此项目发起请求",
  "supplierRequests.selection.filter.period": "Booking 日期范围",
  "supplierRequests.selection.filter.anyDate": "任意日期",
  "supplierRequests.selection.filter.apply": "应用",
  "supplierRequests.selection.filter.clearDates": "清除日期",
  "supplierRequests.selection.filter.last7": "最近 7 天",
  "supplierRequests.selection.filter.last30": "最近 30 天",
  "supplierRequests.selection.filter.thisMonth": "本月",
  "supplierRequests.selection.filter.lastMonth": "上月",
  "supplierRequests.selection.filter.previous": "上个月",
  "supplierRequests.selection.filter.next": "下个月",
  "supplierRequests.selection.filter.supplier": "供应商",
  "supplierRequests.selection.filter.origin": "产地",
  "supplierRequests.selection.filter.all": "全部",
  "supplierRequests.selection.filter.status": "状态",
  "supplierRequests.selection.basket.count": "已勾选 {n} 个项目",
  "supplierRequests.selection.basket.group": "分组选择",
  "supplierRequests.selection.basket.clear": "清除",
  "supplierRequests.selection.basket.limit": "每组最多 {max} 个项目",
  "supplierRequests.selection.group.title":
    "选择分组：{n} 个项目，来自 {suppliers} 个供应商",
  "supplierRequests.selection.group.empty": "未找到该分组的项目。",
  "supplierRequests.selection.group.back": "返回项目",
  "supplierRequests.selection.blocks.title": "建议分组",
  "supplierRequests.selection.blocks.hint":
    "来自筛选 booking 的名称相似项目。打开一个分组进行比较和选择。",
  "supplierRequests.selection.blocks.size": "{n} 个项目 · {suppliers} 个供应商",
  "supplierRequests.selection.blocks.more": "还有 {n} 个",
  "supplierRequests.selection.blocks.open": "比较并选择",
  "supplierRequests.selection.blocks.empty": "当前筛选下没有相似项目的分组。",
  "supplierRequests.selection.inRequest": "询单第 {n} 号",
  "supplierRequests.selection.col.choose": "选择",
  "supplierRequests.selection.col.alternative": "备选",
  "supplierRequests.selection.col.photo": "照片",
  "supplierRequests.selection.col.item": "条目",
  "supplierRequests.selection.col.supplier": "供应商",
  "supplierRequests.selection.col.booking": "Booking",
  "supplierRequests.selection.col.price": "价格",
  "supplierRequests.selection.col.priceUsd": "价格（US$）",
  "supplierRequests.selection.col.moq": "MOQ",
  "supplierRequests.selection.col.box": "每箱数量",
  "supplierRequests.selection.col.cbm": "CBM",
  "supplierRequests.selection.col.size": "尺寸（cm）",
  "supplierRequests.selection.col.capacity": "容量（ml）",
  "supplierRequests.selection.col.material": "材质 / 包装",
  "supplierRequests.selection.col.sheetQty": "表格数量",
  "supplierRequests.selection.col.superplan": "Superplan",
  "supplierRequests.selection.col.situation": "状态",
  "supplierRequests.selection.form.title": "保存本组的选择",
  "supplierRequests.selection.form.body":
    "勾选胜出的产品（仅一个）并填写数量（件）。此按钮只保存选择：现在不会发给供应商。询问稍后在分组中打开，只发送每组胜出的产品。",
  "supplierRequests.selection.form.quantity": "数量（件）",
  "supplierRequests.selection.form.quantityHint":
    "留空：使用选中条目的表格数量。",
  "supplierRequests.selection.form.needs": "Wellmix 对产品的要求",
  "supplierRequests.selection.form.needsHint":
    "颜色、包装、标志、调整……供应商会阅读这段文字。",
  "supplierRequests.selection.form.submit": "保存选择",
  "supplierRequests.selection.form.pending": "保存中…",

  "supplierRequests.list.title": "供应商询单",
  "supplierRequests.list.subtitle":
    "Wellmix 根据条目筛选向供应商提出的询单，以及每个供应商的回复。",
  "supplierRequests.list.subtitleSupplier":
    "Wellmix 想了解您是否能生产某个条目以及条件。请打开并回复。",
  "supplierRequests.list.empty": "还没有询单。",
  "supplierRequests.list.toSelection": "条目筛选",
  "supplierRequests.col.number": "编号",
  "supplierRequests.col.status": "状态",
  "supplierRequests.col.supplier": "供应商",
  "supplierRequests.col.item": "条目",
  "supplierRequests.col.quantity": "数量",
  "supplierRequests.col.answer": "回复",
  "supplierRequests.col.createdAt": "发起时间",
  "supplierRequests.status.open": "待回复",
  "supplierRequests.status.answered": "已回复",
  "supplierRequests.status.approved": "已批准",
  "supplierRequests.status.declined": "已拒绝",
  "supplierRequests.status.cancelled": "已取消",
  "supplierRequests.answer.yes": "可以生产：{price}",
  "supplierRequests.answer.yesNoPrice": "可以生产",
  "supplierRequests.answer.no": "无法生产",
  "supplierRequests.answer.waiting": "等待供应商",

  "supplierRequests.detail.title": "供应商询单第 {n} 号",
  "supplierRequests.detail.back": "返回询单列表",
  "supplierRequests.detail.created":
    "询单已发起。已通知供应商，供应商在门户中回复。",
  "supplierRequests.detail.answered": "回复已记录。",
  "supplierRequests.detail.decided.approved":
    "询单已批准。请在下方“产品”区域创建产品或关联到已有产品。",
  "supplierRequests.detail.decided.declined": "询单已拒绝。",
  "supplierRequests.detail.decided.cancelled": "询单已取消。",
  "supplierRequests.detail.request": "Wellmix 的要求",
  "supplierRequests.detail.quantity": "数量",
  "supplierRequests.detail.pieces": "{n} 件",
  "supplierRequests.detail.needs": "Wellmix 对产品的要求",
  "supplierRequests.detail.needsNone": "按条目现状即可，无其他要求。",
  "supplierRequests.detail.item": "条目",
  "supplierRequests.detail.bookingPrice": "Booking 价格",
  "supplierRequests.detail.booking": "Booking",
  "supplierRequests.detail.bookingOf": "Booking 第 {n} 号 · {file}",
  "supplierRequests.detail.supplier": "供应商",
  "supplierRequests.detail.answer.title": "供应商回复",
  "supplierRequests.detail.answer.none": "供应商尚未回复。",
  "supplierRequests.detail.answer.canDo": "能否按要求生产？",
  "supplierRequests.detail.answer.yes": "可以",
  "supplierRequests.detail.answer.no": "不可以",
  "supplierRequests.detail.answer.price": "单价",
  "supplierRequests.detail.answer.currency": "币种",
  "supplierRequests.detail.answer.moq": "最小起订量（件）",
  "supplierRequests.detail.answer.leadTime": "生产周期（天）",
  "supplierRequests.detail.answer.note": "备注",
  "supplierRequests.detail.answer.submit": "发送回复",
  "supplierRequests.detail.answer.submitWellmix": "记录供应商的回复",
  "supplierRequests.detail.answer.wellmixHint":
    "供应商在门户之外（微信、邮件）回复时使用。",
  "supplierRequests.detail.answer.pending": "正在发送…",
  "supplierRequests.detail.answer.at": "回复于 {date}",
  "supplierRequests.detail.answer.change":
    "在 Wellmix 决定之前，您可以修改回复。",
  "supplierRequests.detail.decide.title": "Wellmix 的决定",
  "supplierRequests.detail.decide.approved": "批准",
  "supplierRequests.detail.decide.declined": "拒绝",
  "supplierRequests.detail.decide.cancelled": "取消询单",
  "supplierRequests.detail.decide.note": "决定备注",
  "supplierRequests.detail.decide.at": "决定于 {date}",
  "supplierRequests.detail.alternatives": "备选（{n}）",
  "supplierRequests.detail.alternativesNone": "未保存备选条目。",
  "supplierRequests.detail.alternativesHint":
    "仅 Wellmix 可见：其他 booking 中的相似条目，用于比较或另行发起询单。",
  "supplierRequests.detail.chosenSuperplan": "选中条目的 Superplan",

  "supplierRequests.error.supplier_request_choose":
    "发起询单前请勾选选中的条目。",
  "supplierRequests.error.supplier_request_lot_not_closed":
    "该条目的 booking 尚未关闭。请先关闭 booking 再发起询单。",
  "supplierRequests.error.supplier_request_no_supplier":
    "该条目的 booking 没有供应商。",
  "supplierRequests.error.supplier_invalid": "该条目的供应商已停用或不存在。",
  "supplierRequests.error.supplier_request_exists":
    "该条目已有进行中的询单。请打开现有询单。",
  "supplierRequests.error.supplier_request_qty_required":
    "表格中没有该条目的数量：请输入数量。",
  "supplierRequests.error.supplier_request_closed":
    "Wellmix 已对该询单作出决定：回复不能再修改。",
  "supplierRequests.error.supplier_request_price_required":
    "如能生产，请填写单价。",
  "supplierRequests.error.supplier_request_decision_invalid":
    "该决定不适用于询单的当前状态。",
  "supplierRequests.error.schema_outdated":
    "新数据表尚未发布到数据库（npm run appwrite:push）。",
  "supplierRequests.error.not_found": "未找到询单或条目。",
  "supplierRequests.error.invalid_input":
    "有数值无法读取。请使用大于零的数字。",

  "supplierRequests.notify.open.subject": "Wellmix 新询单第 {n} 号",
  "supplierRequests.notify.open.body":
    "Wellmix 想了解您是否能生产条目 {code}（{qty} 件）。请打开询单第 {n} 号并回复。",
  "supplierRequests.notify.answer.subject": "供应商已回复询单第 {n} 号",
  "supplierRequests.notify.answer.yes":
    "供应商表示可以生产。请在询单第 {n} 号中核对条件并作出决定。",
  "supplierRequests.notify.answer.no":
    "供应商表示无法满足询单第 {n} 号的要求。",
  "supplierRequests.notify.approved.subject": "询单第 {n} 号已批准",
  "supplierRequests.notify.approved.body":
    "Wellmix 已批准询单第 {n} 号。后续步骤将通过门户通知。",
  "supplierRequests.notify.declined.subject": "询单第 {n} 号已拒绝",
  "supplierRequests.notify.declined.body":
    "Wellmix 这次不会继续询单第 {n} 号。",
  "supplierRequests.notify.cancelled.subject": "询单第 {n} 号已取消",
  "supplierRequests.notify.cancelled.body":
    "Wellmix 已取消询单第 {n} 号。无需回复。",
  "supplierRequests.table.title": "本次询单的产品",
  "supplierRequests.table.subtitle": "Wellmix 在此订舱中向您询问的 {n} 个产品",
  "supplierRequests.table.col.photo": "图片",
  "supplierRequests.table.col.item": "产品",
  "supplierRequests.table.col.quantity": "数量",
  "supplierRequests.table.col.bookingPrice": "订舱价格",
  "supplierRequests.table.col.answer": "您的答复",
  "supplierRequests.table.col.status": "状态",
  "supplierRequests.table.col.actions": "操作",
  "supplierRequests.table.photo": "放大图片",
  "supplierRequests.table.photoOpen": "以原尺寸打开图片",
  "supplierRequests.table.noPhoto": "无图片",
  "supplierRequests.table.close": "关闭",
  "supplierRequests.table.needs": "Wellmix 需要",
  "supplierRequests.table.current": "本询单",
  "supplierRequests.table.proposalPending":
    "有还价等待您答复：请打开产品页面回复。",
  "supplierRequests.table.message": "留言",
  "supplierRequests.table.messageTitle": "给 Wellmix 的留言 · 询单 {n} 号",
  "supplierRequests.table.messageText": "留言",
  "supplierRequests.table.send": "发送",
  "supplierRequests.table.sending": "发送中…",
  "supplierRequests.table.answer": "是 / 否",
  "supplierRequests.table.answerTitle": "最终答复 · 询单 {n} 号",
  "supplierRequests.table.yes": "是，可以做",
  "supplierRequests.table.no": "不能做",
  "supplierRequests.table.open": "打开产品",
  "supplierRequests.table.back": "查看全部产品",
  "supplierRequests.selection.saved":
    "选择已保存。该组在下方显示为已解决，所选产品为绿色。尚未发送给供应商。",
  "supplierRequests.selection.opened": "已打开 {n} 个询问并发送给供应商。",
  "supplierRequests.selection.openFailed": "{n} 个未能打开，仍保持已保存：",
  "supplierRequests.selection.open.ready":
    "{n} 个已解决的组等待询问。只把每组所选产品发给供应商。",
  "supplierRequests.selection.open.none":
    "没有等待中的已解决组。请打开一个分组，比较并保存选择。",
  "supplierRequests.selection.open.marked": "为已勾选的打开询问",
  "supplierRequests.selection.open.all": "为全部打开询问（{n}）",
  "supplierRequests.selection.open.mark": "勾选以打开询问",
  "supplierRequests.selection.resolved": "已解决",
  "supplierRequests.selection.requested": "询问 {n} 号已打开",
  "supplierRequests.selection.requestedNoLink": "询问已打开",
  "supplierRequests.selection.winner": "已选 · {qty} 件",
  "supplierRequests.selection.blocks.reopen": "重新选择",
  "supplierRequests.selection.blocks.sizeManual": "比较了 {n} 个产品",
  "supplierRequests.error.selection_group_pick":
    "请至少勾选一个已解决的组，或使用全部打开按钮。",
  "supplierRequests.error.selection_group_none": "没有等待询问的已解决组。",
  "supplierRequests.table.subtitleWellmix":
    "此订舱中向该供应商询问的 {n} 个产品",
  "supplierRequests.table.hintWellmix":
    "每列一项信息。图标：给供应商留言、登记供应商的答复（通过其他渠道收到时）、打开产品页面。",
  "supplierRequests.table.hint":
    "每列一项信息。图标：给 Wellmix 留言、是/否答复、打开产品页面。",
  "supplierRequests.table.answerHint":
    "答复“是”时请填写单价。起订量和交货方式（FOB/EXW）一并提交；交期保持不变（可在产品页面修改）。",
  "supplierRequests.table.answerWellmix": "登记供应商的答复",
  "supplierRequests.table.answerTitleWellmix":
    "供应商答复（由 Wellmix 登记）· 询单 {n} 号",
  "supplierRequests.table.proposalPendingWellmix": "还价等待供应商答复。",
  "supplierRequests.table.late": "已超时",
  "supplierRequests.table.canDoYes": "可以做",
  "supplierRequests.table.canDoNo": "不能做",
  "supplierRequests.table.canDoWaiting": "等待中",
  "supplierRequests.table.col.number": "编号",
  "supplierRequests.table.col.factoryCode": "工厂货号",
  "supplierRequests.table.col.itemNumber": "项目号",
  "supplierRequests.table.col.material": "材质",
  "supplierRequests.table.col.bookingMoq": "订舱起订量",
  "supplierRequests.table.col.bookingCurrency": "币种",
  "supplierRequests.table.col.bookingIncoterm": "订舱交货方式",
  "supplierRequests.table.col.needs": "Wellmix 需要",
  "supplierRequests.table.col.canDo": "能做？",
  "supplierRequests.table.col.sla": "SLA",
  "supplierRequests.table.col.turn": "轮到",
  "supplierRequests.table.col.openedAt": "开单时间",
  "supplierRequests.table.col.firstAnswerAt": "首次答复",
  "supplierRequests.table.col.lastAnswerAt": "最近答复",
  "supplierRequests.detail.answer.incoterm": "交货方式",
  "supplierRequests.chat.open": "打开对话",
  "supplierRequests.chat.title": "对话 · 询单 {n} 号",
  "supplierRequests.chat.close": "关闭对话",
  "supplierRequests.chat.empty":
    "还没有消息。请在下方输入；可附图片、PDF 或 Excel。",
  "supplierRequests.chat.placeholder": "输入消息",
  "supplierRequests.chat.send": "发送",
  "supplierRequests.chat.closed": "询单已结束：对话仅供查看。",
  "supplierRequests.timeline.title": "互动记录",
  "supplierRequests.timeline.days": "{n} 天",
  "supplierRequests.timeline.opened": "开单：{n} 件",
  "supplierRequests.timeline.answerYes": "供应商答复：可以做",
  "supplierRequests.timeline.answerYesOnBehalf": "Wellmix 登记的答复：可以做",
  "supplierRequests.timeline.answerNo": "供应商答复：不能做",
  "supplierRequests.timeline.proposal": "Wellmix 还价",
  "supplierRequests.timeline.accept": "接受还价：数值成为答复",
  "supplierRequests.timeline.counter": "供应商新报价",
  "supplierRequests.timeline.reject": "拒绝还价：保留之前的答复",
  "supplierRequests.timeline.message": "消息",
  "supplierRequests.timeline.file": "已发送文件",
  "supplierRequests.timeline.decided.approved": "Wellmix 已批准",
  "supplierRequests.timeline.decided.declined": "Wellmix 已拒绝",
  "supplierRequests.timeline.decided.cancelled": "Wellmix 已取消",
  "supplierRequests.timeline.productCreated": "已创建产品",
  "supplierRequests.timeline.productLinked": "已关联现有产品",
  "supplierRequests.timeline.showcase": "产品已上架展示",
  "supplierRequests.timeline.erp": "已在 Sankhya 核对 CODPROD",
  "supplierRequests.table.col.initial": "初始条件（订舱）",
  "supplierRequests.table.col.final": "最终条件（最近报价）",
  "supplierRequests.table.col.cond.price": "价格",
  "supplierRequests.table.col.cond.currency": "币种",
  "supplierRequests.table.col.cond.moq": "起订量",
  "supplierRequests.table.col.cond.incoterm": "FOB/EXW",
  "supplierRequests.table.col.cond.leadTime": "交期（天）",
  "supplierRequests.list.count": "{n} 个询单 · {products} 个不同产品",
  "supplierRequests.col.products": "不同产品",
  "supplierRequests.col.finishedAt": "完成时间",
  "supplierRequests.list.finishedLate": "超时",
  "supplierRequests.list.finishedOnTime": "在 SLA 内",
  "supplierRequests.table.col.cond.state": "状态",
  "supplierRequests.table.state.answer": "供应商答复",
  "supplierRequests.table.state.pending": "已发出还价",
  "supplierRequests.table.state.accepted": "已接受",
  "supplierRequests.table.state.rejected": "已拒绝",
  "supplierRequests.table.state.counter": "供应商新报价",
};
