/**
 * Booking por planilha (docs/BOOKING.md, "Booking por planilha"): a lista
 * dos bookings, a importação da planilha e o detalhamento com os itens.
 * Mesmas chaves em pt, en e zh.
 */
export const pt = {
  "bookingLots.title": "Booking",
  "bookingLots.partner.subtitle":
    "Os bookings da sua empresa: os que ela lançou e os que a Wellmix carregou em nome dela.",
  "bookingLots.partner.empty":
    "Nenhum booking da sua empresa ainda. Quando a Wellmix carregar uma planilha sua, ela aparece aqui.",
  "bookingLots.partner.lot": "Booking nº {n}",
  "bookingLots.partner.back": "Voltar aos bookings",
  "bookingLots.partner.items": "Itens do booking ({n})",
  "bookingLots.partner.noItems": "Este booking não tem itens.",
  "bookingLots.partner.emptyLaunch":
    'Nenhum booking da sua empresa ainda. Use "Lançar booking" para enviar a planilha do primeiro.',
  "bookingLots.partner.launch": "Lançar booking",
  "bookingLots.partner.launch.subtitle":
    "Envie a planilha do seu booking. Depois você confere os campos na tela e envia para a Wellmix conferir.",
  "bookingLots.partner.launch.submit": "Carregar planilha",
  "bookingLots.partner.launch.after":
    'Depois de carregar, todos os campos aparecem na tela, já preenchidos, para você conferir e corrigir. A Wellmix só recebe o booking quando você apertar "Enviar para Wellmix Conferir".',
  "bookingLots.partner.unsent": "Novo booking (não enviado)",
  "bookingLots.partner.unsentHint":
    'Há booking em preenchimento que ainda não foi enviado. A Wellmix só o recebe depois de você apertar "Enviar para Wellmix Conferir".',
  "bookingLots.partner.loaded":
    'Planilha carregada. Confira os campos abaixo, corrija o que precisar e aperte "Enviar para Wellmix Conferir".',
  "bookingLots.partner.preparingHint":
    'Este booking ainda não foi enviado. Confira os campos e aperte "Enviar para Wellmix Conferir": a Wellmix só o recebe depois disso.',
  "bookingLots.partner.editHint":
    "Tudo veio da planilha e pode ser corrigido aqui: cada campo grava ao sair dele. Com * os que a Wellmix precisa para fechar o booking.",
  "bookingLots.partner.blanks":
    "{n} campo(s) com * em branco, destacado(s) em amarelo.",
  "bookingLots.partner.send": "Enviar para Wellmix Conferir",
  "bookingLots.partner.sending": "Enviando…",
  "bookingLots.partner.sendHint":
    "Depois de enviar, a Wellmix confere e analisa o booking, e você passa a só consultar.",
  "bookingLots.partner.sendConfirmBlanks":
    "Ainda há {n} campo(s) com * em branco. Enviar assim mesmo?",
  "bookingLots.partner.sent":
    "Booking nº {n} enviado. A Wellmix foi avisada e vai conferir.",
  "bookingLots.partner.discard": "Descartar",
  "bookingLots.partner.discardConfirm":
    "Descartar este booking? A planilha carregada e as correções feitas aqui serão apagadas. Nada foi enviado à Wellmix.",
  "bookingLots.partner.discarded":
    "Booking descartado. Nada foi enviado à Wellmix.",
  "bookingLots.error.booking_partner_sent":
    "Este booking já foi enviado para a Wellmix. Para corrigir ou cancelar, fale com a Wellmix.",
  "bookingLots.partner.status.preparing": "Em preenchimento: falta enviar",
  "bookingLots.partner.status.draft": "Em conferência na Wellmix",
  "bookingLots.partner.status.closed": "Conferido pela Wellmix",
  "bookingLots.notify.launched.subject":
    "Booking nº {n} lançado por um parceiro",
  "bookingLots.notify.launched.body":
    "{partner} lançou o booking ({items} itens, {file}). Confira, complete o que faltar e feche para analisar.",
  "bookingLots.error.booking_launch_limit":
    "Sua empresa já lançou muitos bookings nas últimas 24 horas. Tente mais tarde ou fale com a Wellmix.",
  "bookingLots.subtitle":
    "Planilhas de booking dos fornecedores. Suba a planilha, confira fornecedor, data e itens e feche: o Superplan analisa todos os itens.",
  "bookingLots.import": "Importar booking",
  "bookingLots.productsQueue": "Fila de produtos",
  "bookingLots.backToList": "Voltar aos bookings",
  "bookingLots.search": "Buscar em qualquer coluna",
  "bookingLots.searchPlaceholder": "Fornecedor, origem, nº, planilha, status…",
  "bookingLots.count": "{n} de {total} bookings",
  "bookingLots.empty":
    "Nenhum booking carregado ainda. Clique em Importar booking para subir a primeira planilha.",
  "bookingLots.noMatch": "Nenhum booking com esse texto.",
  "bookingLots.schemaMissing":
    "As tabelas do booking ainda não foram publicadas no banco (npm run appwrite:push). Até lá não dá para subir planilhas.",
  "bookingLots.sortBy": "Ordenar por {col}",
  "bookingLots.col.number": "Nº",
  "bookingLots.col.status": "Status",
  "bookingLots.col.origin": "Origem",
  "bookingLots.col.supplier": "Fornecedor",
  "bookingLots.col.date": "Data",
  "bookingLots.col.fileName": "Planilha",
  "bookingLots.col.itemCount": "Itens",
  "bookingLots.col.pendingItems": "Incompletos",
  "bookingLots.col.viable": "Superplan",
  "bookingLots.col.owner": "Responsável",
  "bookingLots.col.createdAt": "Carregado em",
  "bookingLots.status.preparing": "Em preenchimento (parceiro)",
  "bookingLots.status.draft": "Rascunho",
  "bookingLots.status.closed": "Fechado",
  "bookingLots.status.in_progress": "Em andamento",
  "bookingLots.status.done": "Concluído",
  "bookingLots.status.cancelled": "Cancelado",
  "bookingLots.signals.none": "Sem análise",
  "bookingLots.supplierNone": "Sem fornecedor",
  "bookingLots.supplierSheet": "Da planilha: {name}",

  "bookingLots.import.title": "Importar booking",
  "bookingLots.import.subtitle":
    "Planilha de booking de um fornecedor. As colunas conhecidas são lidas; as outras ficam guardadas nos itens como informação. Nenhum produto é criado.",
  "bookingLots.import.form": "Planilha do booking",
  "bookingLots.import.file": "Arquivo",
  "bookingLots.import.fileHint": "Excel (.xlsx ou .xls), até 80 itens.",
  "bookingLots.import.currency": "Moeda quando a planilha não diz",
  "bookingLots.import.currencyHint":
    "Vale para os preços sem moeda na coluna nem no cabeçalho.",
  "bookingLots.import.submit": "Importar booking",
  "bookingLots.import.submitting": "Lendo a planilha…",
  "bookingLots.import.columns.title": "Colunas lidas",
  "bookingLots.import.columns.body":
    "Fornecedor (nome, nº da loja, telefone e cidade), data, product number list, SKU/factory item code e description. Com * os obrigatórios para fechar o booking: FOB/EXW*, coin US$/RMB*, price*, qty/box*, qty/inner*, N.W./pc*, G.W./pc*, CBM*, size (cm) length*, width* e height*, capacity (ml)*, package*, material* e MOQ*.",
  "bookingLots.import.columns.extra":
    "Também são guardados: color assortment, function/battery/110/220, purchase schedule, departure interval in days, purchase qty in pcs, foto e supplier business card, e qualquer outra coluna da planilha (só como informação, fora da tela).",
  "bookingLots.import.after":
    "Depois de importar, o booking abre em rascunho: confira o fornecedor e a data estimados, complete os itens e feche.",

  "bookingLots.detail.title": "Booking nº {n}",
  "bookingLots.detail.created":
    "Booking carregado com {n} itens. Confira o fornecedor e a data, que vieram da planilha, e complete os itens.",
  "bookingLots.detail.closed":
    "Booking fechado. O Superplan analisou todos os itens.",
  "bookingLots.detail.analyzed": "Análise do Superplan refeita.",
  "bookingLots.detail.moved": "Status alterado.",
  "bookingLots.detail.saved": "Observação salva.",
  "bookingLots.detail.supplierCreated":
    "Fornecedor cadastrado e ligado a este booking.",
  "bookingLots.detail.header": "Dados do booking",
  "bookingLots.detail.status": "Status",
  "bookingLots.detail.origin": "Origem",
  "bookingLots.detail.originHint": "Cidade do fornecedor.",
  "bookingLots.detail.supplier": "Fornecedor",
  "bookingLots.detail.supplierField": "Fornecedor do booking",
  "bookingLots.detail.supplierSearch": "Digite para buscar o fornecedor",
  "bookingLots.detail.supplierNoMatch": "Nenhum fornecedor encontrado",
  "bookingLots.detail.date": "Data",
  "bookingLots.detail.dateField": "Data do booking",
  "bookingLots.detail.dateSheet": "Da planilha: {date}",
  "bookingLots.detail.file": "Planilha",
  "bookingLots.detail.owner": "Responsável",
  "bookingLots.detail.items": "Itens",
  "bookingLots.detail.note": "Observação",
  "bookingLots.detail.noteSave": "Salvar observação",
  "bookingLots.detail.suggest.title": "Fornecedor da planilha sem cadastro",
  "bookingLots.detail.suggest.body":
    "Confira os dados que vieram da planilha e cadastre. Ele entra em Cadastros → Fornecedores, sem login, e passa a ser o fornecedor deste booking.",
  "bookingLots.detail.suggest.name": "Nome",
  "bookingLots.detail.suggest.store": "Nº da loja",
  "bookingLots.detail.suggest.phone": "Telefone",
  "bookingLots.detail.suggest.city": "Cidade",
  "bookingLots.detail.suggest.country": "País",
  "bookingLots.detail.suggest.submit": "Cadastrar e usar neste booking",
  "bookingLots.detail.suggest.pending": "Cadastrando…",
  "bookingLots.detail.itemsTitle": "Itens ({n})",
  "bookingLots.detail.itemsHint":
    "Cada campo grava sozinho ao sair dele (ou no Enter). * obrigatório para fechar.",
  "bookingLots.detail.itemsLocked":
    "Booking {status}: os itens não mudam mais.",
  "bookingLots.detail.pending": "Falta para fechar: {list}.",
  "bookingLots.detail.ready": "Tudo preenchido: o booking pode ser fechado.",
  "bookingLots.pending.supplier": "o fornecedor",
  "bookingLots.pending.date": "a data",
  "bookingLots.pending.items": "itens incompletos ({n})",
  "bookingLots.pending.noItems": "itens",
  "bookingLots.detail.close.title": "Fechar o booking",
  "bookingLots.detail.close.body":
    "Ao fechar, o Superplan analisa todos os itens com os valores padrão (câmbio do dia, container e frete padrão) e o booking deixa de ser editável.",
  "bookingLots.detail.close.businessType": "Tipo de negócio do Superplan",
  "bookingLots.detail.close.default": "{name} (padrão)",
  "bookingLots.detail.close.submit": "Fechar e analisar",
  "bookingLots.detail.close.pending": "Analisando…",
  "bookingLots.detail.reanalyze": "Refazer a análise",
  "bookingLots.detail.reanalyzePending": "Analisando…",
  "bookingLots.detail.move": "Mudar status",
  "bookingLots.detail.moveTo": "Novo status",
  "bookingLots.detail.moveSubmit": "Mudar",
  "bookingLots.detail.analysisAt": "Analisado em {date} · {type}",
  "bookingLots.detail.extra": "Outras colunas guardadas: {list}",

  "bookingLots.item.col.position": "#",
  "bookingLots.item.col.photo": "Foto",
  "bookingLots.item.col.itemNumber": "Nº do item",
  "bookingLots.item.col.factoryItemCode": "SKU / código da fábrica",
  "bookingLots.item.col.description": "Descrição",
  "bookingLots.item.col.incoterm": "FOB/EXW",
  "bookingLots.item.col.currency": "Moeda (US$/RMB)",
  "bookingLots.item.col.price": "Preço",
  "bookingLots.item.col.masterCartonQty": "Qtd/caixa",
  "bookingLots.item.col.innerQty": "Qtd/inner",
  "bookingLots.item.col.netWeightPcKg": "Peso líq./pç (kg)",
  "bookingLots.item.col.grossWeightPcKg": "Peso bruto/pç (kg)",
  "bookingLots.item.col.cbmPerCarton": "CBM",
  "bookingLots.item.col.lengthCm": "Comprimento (cm)",
  "bookingLots.item.col.widthCm": "Largura (cm)",
  "bookingLots.item.col.heightCm": "Altura (cm)",
  "bookingLots.item.col.capacityMl": "Capacidade (ml)",
  "bookingLots.item.col.packageType": "Embalagem",
  "bookingLots.item.col.material": "Material",
  "bookingLots.item.col.moq": "MOQ",
  "bookingLots.item.col.productName": "Nome",
  "bookingLots.item.col.colorAssortment": "Cores",
  "bookingLots.item.col.powerDetail": "Função / bateria / 110 / 220",
  "bookingLots.item.col.purchaseSchedule": "Programação de compra",
  "bookingLots.item.col.departureIntervalDays": "Intervalo de saída (dias)",
  "bookingLots.item.col.purchaseQty": "Qtd de compra (pç)",
  "bookingLots.item.col.plannedQty": "Peças planejadas (TT PCS)",
  "bookingLots.item.col.analysis": "Superplan",
  "bookingLots.item.col.check": "Conferência",
  "bookingLots.item.edit": "{field} do item {n}",
  "bookingLots.item.missing": "Falta: {list}",
  "bookingLots.item.complete": "Completo",
  "bookingLots.item.card": "Cartão",
  "bookingLots.item.minimum": "Mínimo {price}",
  "bookingLots.item.profit": "Lucro {pct}%",
  "bookingLots.item.missingData": "Faltou: {list}",

  "bookingLots.partner.title": "Responsável pelo booking",
  "bookingLots.partner.supplier": "O fornecedor do booking",
  "bookingLots.partner.hint":
    "As solicitações dos itens deste booking vão para ele. Vazio: vão para o fornecedor.",
  "bookingLots.error.booking_partner_invalid":
    "Escolha um parceiro ativo: fornecedor, Trading, Factory, Supplier, GP ou outro tipo com login.",
  "bookingLots.error.supplier_required":
    "Escolha o fornecedor do booking (ou cadastre o da planilha) antes de fechar.",
  "bookingLots.error.booking_date_required":
    "Informe a data do booking antes de fechar.",
  "bookingLots.error.booking_items_incomplete":
    "Há itens com campos obrigatórios vazios. Complete os campos marcados em cada item e feche de novo.",
  "bookingLots.error.booking_lot_locked":
    "Este booking não está mais em rascunho: os dados não mudam.",
  "bookingLots.error.booking_item_invalid":
    "Valor que não dá para ler. Use número maior que zero, FOB ou EXW, e USD, RMB, BRL ou EUR.",
  "bookingLots.error.supplier_invalid":
    "Fornecedor inexistente ou inativo. Escolha outro da lista.",
  "bookingLots.error.supplier_name_required": "Informe o nome do fornecedor.",
  "bookingLots.error.booking_date_invalid": "Data inválida.",
  "bookingLots.error.booking_lot_move_invalid":
    "Esse status não pode vir depois do atual.",
  "bookingLots.error.booking_lot_not_closed":
    "Só um booking fechado tem análise para refazer.",
  "bookingLots.error.schema_outdated":
    "As tabelas do booking ainda não foram publicadas no banco (npm run appwrite:push).",
  "bookingLots.error.not_found": "Booking ou item não encontrado.",
};

export const en: typeof pt = {
  "bookingLots.title": "Booking",
  "bookingLots.partner.subtitle":
    "Your company's bookings: the ones it submitted and the ones Wellmix loaded on its behalf.",
  "bookingLots.partner.empty":
    "No booking from your company yet. When Wellmix loads one of your spreadsheets, it shows up here.",
  "bookingLots.partner.lot": "Booking no. {n}",
  "bookingLots.partner.back": "Back to bookings",
  "bookingLots.partner.items": "Booking items ({n})",
  "bookingLots.partner.noItems": "This booking has no items.",
  "bookingLots.partner.emptyLaunch":
    'No booking from your company yet. Use "Submit booking" to send the spreadsheet of the first one.',
  "bookingLots.partner.launch": "Submit booking",
  "bookingLots.partner.launch.subtitle":
    "Send your booking spreadsheet. Then you check the fields on screen and send it to Wellmix for review.",
  "bookingLots.partner.launch.submit": "Load spreadsheet",
  "bookingLots.partner.launch.after":
    'After loading, every field shows on screen, already filled in, for you to check and fix. Wellmix only receives the booking when you press "Send to Wellmix for review".',
  "bookingLots.partner.unsent": "New booking (not sent)",
  "bookingLots.partner.unsentHint":
    'There is a booking being filled in that has not been sent yet. Wellmix only receives it after you press "Send to Wellmix for review".',
  "bookingLots.partner.loaded":
    'Spreadsheet loaded. Check the fields below, fix what is needed and press "Send to Wellmix for review".',
  "bookingLots.partner.preparingHint":
    'This booking has not been sent yet. Check the fields and press "Send to Wellmix for review": Wellmix only receives it after that.',
  "bookingLots.partner.editHint":
    "Everything came from the spreadsheet and can be fixed here: each field saves when you leave it. Fields with * are the ones Wellmix needs to close the booking.",
  "bookingLots.partner.blanks":
    "{n} field(s) with * left blank, highlighted in yellow.",
  "bookingLots.partner.send": "Send to Wellmix for review",
  "bookingLots.partner.sending": "Sending…",
  "bookingLots.partner.sendHint":
    "After you send it, Wellmix reviews and analyzes the booking, and you can only view it.",
  "bookingLots.partner.sendConfirmBlanks":
    "There are still {n} field(s) with * left blank. Send anyway?",
  "bookingLots.partner.sent":
    "Booking no. {n} sent. Wellmix was notified and will review it.",
  "bookingLots.partner.discard": "Discard",
  "bookingLots.partner.discardConfirm":
    "Discard this booking? The loaded spreadsheet and the fixes made here will be deleted. Nothing was sent to Wellmix.",
  "bookingLots.partner.discarded":
    "Booking discarded. Nothing was sent to Wellmix.",
  "bookingLots.error.booking_partner_sent":
    "This booking has already been sent to Wellmix. To fix or cancel it, contact Wellmix.",
  "bookingLots.partner.status.preparing": "Being filled in: not sent yet",
  "bookingLots.partner.status.draft": "Under review at Wellmix",
  "bookingLots.partner.status.closed": "Reviewed by Wellmix",
  "bookingLots.notify.launched.subject":
    "Booking no. {n} submitted by a partner",
  "bookingLots.notify.launched.body":
    "{partner} submitted the booking ({items} items, {file}). Review it, fill in what is missing and close it to analyze.",
  "bookingLots.error.booking_launch_limit":
    "Your company has already submitted many bookings in the last 24 hours. Try again later or contact Wellmix.",
  "bookingLots.subtitle":
    "Suppliers' booking spreadsheets. Upload the spreadsheet, check supplier, date and items, then close: Superplan analyzes every item.",
  "bookingLots.import": "Import booking",
  "bookingLots.productsQueue": "Product queue",
  "bookingLots.backToList": "Back to bookings",
  "bookingLots.search": "Search any column",
  "bookingLots.searchPlaceholder": "Supplier, origin, no., file, status…",
  "bookingLots.count": "{n} of {total} bookings",
  "bookingLots.empty":
    "No bookings uploaded yet. Click Import booking to upload the first spreadsheet.",
  "bookingLots.noMatch": "No booking matches this text.",
  "bookingLots.schemaMissing":
    "The booking tables are not published in the database yet (npm run appwrite:push). Until then spreadsheets cannot be uploaded.",
  "bookingLots.sortBy": "Sort by {col}",
  "bookingLots.col.number": "No.",
  "bookingLots.col.status": "Status",
  "bookingLots.col.origin": "Origin",
  "bookingLots.col.supplier": "Supplier",
  "bookingLots.col.date": "Date",
  "bookingLots.col.fileName": "Spreadsheet",
  "bookingLots.col.itemCount": "Items",
  "bookingLots.col.pendingItems": "Incomplete",
  "bookingLots.col.viable": "Superplan",
  "bookingLots.col.owner": "Owner",
  "bookingLots.col.createdAt": "Uploaded on",
  "bookingLots.status.preparing": "Being filled in (partner)",
  "bookingLots.status.draft": "Draft",
  "bookingLots.status.closed": "Closed",
  "bookingLots.status.in_progress": "In progress",
  "bookingLots.status.done": "Done",
  "bookingLots.status.cancelled": "Cancelled",
  "bookingLots.signals.none": "Not analyzed",
  "bookingLots.supplierNone": "No supplier",
  "bookingLots.supplierSheet": "From the spreadsheet: {name}",

  "bookingLots.import.title": "Import booking",
  "bookingLots.import.subtitle":
    "A supplier's booking spreadsheet. Known columns are read; the others are kept in the items as information. No product is created.",
  "bookingLots.import.form": "Booking spreadsheet",
  "bookingLots.import.file": "File",
  "bookingLots.import.fileHint": "Excel (.xlsx or .xls), up to 80 items.",
  "bookingLots.import.currency": "Currency when the spreadsheet does not say",
  "bookingLots.import.currencyHint":
    "Applies to prices with no currency in the column or header.",
  "bookingLots.import.submit": "Import booking",
  "bookingLots.import.submitting": "Reading the spreadsheet…",
  "bookingLots.import.columns.title": "Columns read",
  "bookingLots.import.columns.body":
    "Supplier (name, store no., phone and city), date, product number list, SKU/factory item code and description. Marked * are required to close the booking: FOB/EXW*, coin US$/RMB*, price*, qty/box*, qty/inner*, N.W./pc*, G.W./pc*, CBM*, size (cm) length*, width* and height*, capacity (ml)*, package*, material* and MOQ*.",
  "bookingLots.import.columns.extra":
    "Also kept: color assortment, function/battery/110/220, purchase schedule, departure interval in days, purchase qty in pcs, photo and supplier business card, and any other column of the spreadsheet (as information only, off screen).",
  "bookingLots.import.after":
    "After importing, the booking opens as a draft: check the estimated supplier and date, complete the items and close.",

  "bookingLots.detail.title": "Booking no. {n}",
  "bookingLots.detail.created":
    "Booking uploaded with {n} items. Check the supplier and date taken from the spreadsheet and complete the items.",
  "bookingLots.detail.closed": "Booking closed. Superplan analyzed every item.",
  "bookingLots.detail.analyzed": "Superplan analysis redone.",
  "bookingLots.detail.moved": "Status changed.",
  "bookingLots.detail.saved": "Note saved.",
  "bookingLots.detail.supplierCreated":
    "Supplier registered and linked to this booking.",
  "bookingLots.detail.header": "Booking data",
  "bookingLots.detail.status": "Status",
  "bookingLots.detail.origin": "Origin",
  "bookingLots.detail.originHint": "The supplier's city.",
  "bookingLots.detail.supplier": "Supplier",
  "bookingLots.detail.supplierField": "Booking supplier",
  "bookingLots.detail.supplierSearch": "Type to search the supplier",
  "bookingLots.detail.supplierNoMatch": "No supplier found",
  "bookingLots.detail.date": "Date",
  "bookingLots.detail.dateField": "Booking date",
  "bookingLots.detail.dateSheet": "From the spreadsheet: {date}",
  "bookingLots.detail.file": "Spreadsheet",
  "bookingLots.detail.owner": "Owner",
  "bookingLots.detail.items": "Items",
  "bookingLots.detail.note": "Note",
  "bookingLots.detail.noteSave": "Save note",
  "bookingLots.detail.suggest.title": "Spreadsheet supplier not registered",
  "bookingLots.detail.suggest.body":
    "Check the data from the spreadsheet and register it. It goes to Records → Suppliers, with no login, and becomes this booking's supplier.",
  "bookingLots.detail.suggest.name": "Name",
  "bookingLots.detail.suggest.store": "Store no.",
  "bookingLots.detail.suggest.phone": "Phone",
  "bookingLots.detail.suggest.city": "City",
  "bookingLots.detail.suggest.country": "Country",
  "bookingLots.detail.suggest.submit": "Register and use in this booking",
  "bookingLots.detail.suggest.pending": "Registering…",
  "bookingLots.detail.itemsTitle": "Items ({n})",
  "bookingLots.detail.itemsHint":
    "Each field saves on its own when you leave it (or press Enter). * required to close.",
  "bookingLots.detail.itemsLocked": "Booking {status}: items no longer change.",
  "bookingLots.detail.pending": "Missing to close: {list}.",
  "bookingLots.detail.ready": "All filled in: the booking can be closed.",
  "bookingLots.pending.supplier": "the supplier",
  "bookingLots.pending.date": "the date",
  "bookingLots.pending.items": "incomplete items ({n})",
  "bookingLots.pending.noItems": "items",
  "bookingLots.detail.close.title": "Close the booking",
  "bookingLots.detail.close.body":
    "On closing, Superplan analyzes every item with the default values (today's exchange rate, default container and freight) and the booking can no longer be edited.",
  "bookingLots.detail.close.businessType": "Superplan business type",
  "bookingLots.detail.close.default": "{name} (default)",
  "bookingLots.detail.close.submit": "Close and analyze",
  "bookingLots.detail.close.pending": "Analyzing…",
  "bookingLots.detail.reanalyze": "Redo the analysis",
  "bookingLots.detail.reanalyzePending": "Analyzing…",
  "bookingLots.detail.move": "Change status",
  "bookingLots.detail.moveTo": "New status",
  "bookingLots.detail.moveSubmit": "Change",
  "bookingLots.detail.analysisAt": "Analyzed on {date} · {type}",
  "bookingLots.detail.extra": "Other columns kept: {list}",

  "bookingLots.item.col.position": "#",
  "bookingLots.item.col.photo": "Photo",
  "bookingLots.item.col.itemNumber": "Product number",
  "bookingLots.item.col.factoryItemCode": "SKU / factory item code",
  "bookingLots.item.col.description": "Description",
  "bookingLots.item.col.incoterm": "FOB/EXW",
  "bookingLots.item.col.currency": "Coin (US$/RMB)",
  "bookingLots.item.col.price": "Price",
  "bookingLots.item.col.masterCartonQty": "Qty/box",
  "bookingLots.item.col.innerQty": "Qty/inner",
  "bookingLots.item.col.netWeightPcKg": "N.W./pc (kg)",
  "bookingLots.item.col.grossWeightPcKg": "G.W./pc (kg)",
  "bookingLots.item.col.cbmPerCarton": "CBM",
  "bookingLots.item.col.lengthCm": "Length (cm)",
  "bookingLots.item.col.widthCm": "Width (cm)",
  "bookingLots.item.col.heightCm": "Height (cm)",
  "bookingLots.item.col.capacityMl": "Capacity (ml)",
  "bookingLots.item.col.packageType": "Package",
  "bookingLots.item.col.material": "Material",
  "bookingLots.item.col.moq": "MOQ",
  "bookingLots.item.col.productName": "Name",
  "bookingLots.item.col.colorAssortment": "Color assortment",
  "bookingLots.item.col.powerDetail": "Function / battery / 110 / 220",
  "bookingLots.item.col.purchaseSchedule": "Purchase schedule",
  "bookingLots.item.col.departureIntervalDays": "Departure interval (days)",
  "bookingLots.item.col.purchaseQty": "Purchase qty (pcs)",
  "bookingLots.item.col.plannedQty": "Planned pieces (TT PCS)",
  "bookingLots.item.col.analysis": "Superplan",
  "bookingLots.item.col.check": "Check",
  "bookingLots.item.edit": "{field} of item {n}",
  "bookingLots.item.missing": "Missing: {list}",
  "bookingLots.item.complete": "Complete",
  "bookingLots.item.card": "Card",
  "bookingLots.item.minimum": "Minimum {price}",
  "bookingLots.item.profit": "Profit {pct}%",
  "bookingLots.item.missingData": "Missing: {list}",

  "bookingLots.partner.title": "Booking owner",
  "bookingLots.partner.supplier": "The booking supplier",
  "bookingLots.partner.hint":
    "Requests for this booking's items go to this partner. Empty: they go to the supplier.",
  "bookingLots.error.booking_partner_invalid":
    "Choose an active partner: supplier, Trading, Factory, Supplier, GP or another type with login.",
  "bookingLots.error.supplier_required":
    "Choose the booking's supplier (or register the one from the spreadsheet) before closing.",
  "bookingLots.error.booking_date_required":
    "Enter the booking date before closing.",
  "bookingLots.error.booking_items_incomplete":
    "Some items have empty required fields. Complete the marked fields in each item and close again.",
  "bookingLots.error.booking_lot_locked":
    "This booking is no longer a draft: its data no longer changes.",
  "bookingLots.error.booking_item_invalid":
    "Unreadable value. Use a number above zero, FOB or EXW, and USD, RMB, BRL or EUR.",
  "bookingLots.error.supplier_invalid":
    "Supplier not found or inactive. Choose another one from the list.",
  "bookingLots.error.supplier_name_required": "Enter the supplier's name.",
  "bookingLots.error.booking_date_invalid": "Invalid date.",
  "bookingLots.error.booking_lot_move_invalid":
    "That status cannot follow the current one.",
  "bookingLots.error.booking_lot_not_closed":
    "Only a closed booking has an analysis to redo.",
  "bookingLots.error.schema_outdated":
    "The booking tables are not published in the database yet (npm run appwrite:push).",
  "bookingLots.error.not_found": "Booking or item not found.",
};

export const zh: typeof pt = {
  "bookingLots.title": "Booking",
  "bookingLots.partner.subtitle":
    "贵公司的订舱：贵公司提交的，以及 Wellmix 代贵公司导入的。",
  "bookingLots.partner.empty":
    "暂无贵公司的订舱。Wellmix 导入贵公司的表格后会显示在这里。",
  "bookingLots.partner.lot": "订舱 {n}",
  "bookingLots.partner.back": "返回订舱列表",
  "bookingLots.partner.items": "订舱产品（{n}）",
  "bookingLots.partner.noItems": "此订舱没有产品。",
  "bookingLots.partner.emptyLaunch":
    "暂无贵公司的订舱。请点击“提交订舱”上传第一份表格。",
  "bookingLots.partner.launch": "提交订舱",
  "bookingLots.partner.launch.subtitle":
    "上传贵公司的订舱表格。之后您在页面上核对各字段，再提交给 Wellmix 核对。",
  "bookingLots.partner.launch.submit": "上传表格",
  "bookingLots.partner.launch.after":
    "上传后，所有字段会显示在页面上并已填好，供您核对和修改。只有在您点击“提交给 Wellmix 核对”后，Wellmix 才会收到该订舱。",
  "bookingLots.partner.unsent": "新订舱（未提交）",
  "bookingLots.partner.unsentHint":
    "有正在填写、尚未提交的订舱。只有在您点击“提交给 Wellmix 核对”后，Wellmix 才会收到。",
  "bookingLots.partner.loaded":
    "表格已上传。请核对下方字段，修改需要更正的内容，然后点击“提交给 Wellmix 核对”。",
  "bookingLots.partner.preparingHint":
    "此订舱尚未提交。请核对字段并点击“提交给 Wellmix 核对”：之后 Wellmix 才会收到。",
  "bookingLots.partner.editHint":
    "所有内容均来自表格，可在此修改：离开字段时自动保存。带 * 的字段是 Wellmix 关闭订舱所需的。",
  "bookingLots.partner.blanks": "有 {n} 个带 * 的字段为空，已用黄色标出。",
  "bookingLots.partner.send": "提交给 Wellmix 核对",
  "bookingLots.partner.sending": "正在提交…",
  "bookingLots.partner.sendHint":
    "提交后，Wellmix 会核对并分析该订舱，您只能查看。",
  "bookingLots.partner.sendConfirmBlanks":
    "仍有 {n} 个带 * 的字段为空。仍要提交吗？",
  "bookingLots.partner.sent": "订舱 {n} 已提交。已通知 Wellmix 进行核对。",
  "bookingLots.partner.discard": "放弃",
  "bookingLots.partner.discardConfirm":
    "放弃此订舱？已上传的表格和在此所做的修改将被删除。尚未向 Wellmix 提交任何内容。",
  "bookingLots.partner.discarded": "订舱已放弃。未向 Wellmix 提交任何内容。",
  "bookingLots.error.booking_partner_sent":
    "此订舱已提交给 Wellmix。如需修改或取消，请联系 Wellmix。",
  "bookingLots.partner.status.preparing": "填写中：尚未提交",
  "bookingLots.partner.status.draft": "Wellmix 核对中",
  "bookingLots.partner.status.closed": "Wellmix 已核对",
  "bookingLots.notify.launched.subject": "合作方提交了订舱 {n}",
  "bookingLots.notify.launched.body":
    "{partner} 提交了订舱（{items} 个商品，{file}）。请核对、补全缺失信息并关闭以进行分析。",
  "bookingLots.error.booking_launch_limit":
    "贵公司在过去 24 小时内提交的订舱过多。请稍后再试或联系 Wellmix。",
  "bookingLots.subtitle":
    "供应商的 booking 表格。上传表格，核对供应商、日期和条目，然后关闭：Superplan 会分析所有条目。",
  "bookingLots.import": "导入 booking",
  "bookingLots.productsQueue": "产品队列",
  "bookingLots.backToList": "返回 booking 列表",
  "bookingLots.search": "搜索任意列",
  "bookingLots.searchPlaceholder": "供应商、产地、编号、表格、状态…",
  "bookingLots.count": "{n} / {total} 个 booking",
  "bookingLots.empty": "还没有上传 booking。点击“导入 booking”上传第一张表格。",
  "bookingLots.noMatch": "没有符合此文字的 booking。",
  "bookingLots.schemaMissing":
    "booking 数据表尚未发布到数据库（npm run appwrite:push）。在此之前无法上传表格。",
  "bookingLots.sortBy": "按{col}排序",
  "bookingLots.col.number": "编号",
  "bookingLots.col.status": "状态",
  "bookingLots.col.origin": "产地",
  "bookingLots.col.supplier": "供应商",
  "bookingLots.col.date": "日期",
  "bookingLots.col.fileName": "表格",
  "bookingLots.col.itemCount": "条目",
  "bookingLots.col.pendingItems": "不完整",
  "bookingLots.col.viable": "Superplan",
  "bookingLots.col.owner": "负责人",
  "bookingLots.col.createdAt": "上传日期",
  "bookingLots.status.preparing": "填写中（合作方）",
  "bookingLots.status.draft": "草稿",
  "bookingLots.status.closed": "已关闭",
  "bookingLots.status.in_progress": "进行中",
  "bookingLots.status.done": "已完成",
  "bookingLots.status.cancelled": "已取消",
  "bookingLots.signals.none": "未分析",
  "bookingLots.supplierNone": "无供应商",
  "bookingLots.supplierSheet": "表格中：{name}",

  "bookingLots.import.title": "导入 booking",
  "bookingLots.import.subtitle":
    "供应商的 booking 表格。读取已知的列，其他列作为信息保存在条目中。不会创建产品。",
  "bookingLots.import.form": "Booking 表格",
  "bookingLots.import.file": "文件",
  "bookingLots.import.fileHint": "Excel（.xlsx 或 .xls），最多 80 个条目。",
  "bookingLots.import.currency": "表格未注明时的币种",
  "bookingLots.import.currencyHint": "用于列和表头都没有币种的价格。",
  "bookingLots.import.submit": "导入 booking",
  "bookingLots.import.submitting": "正在读取表格…",
  "bookingLots.import.columns.title": "读取的列",
  "bookingLots.import.columns.body":
    "供应商（名称、店铺号、电话和城市）、日期、product number list、SKU/factory item code 和 description。带 * 的为关闭 booking 的必填项：FOB/EXW*、coin US$/RMB*、price*、qty/box*、qty/inner*、N.W./pc*、G.W./pc*、CBM*、size (cm) length*、width* 和 height*、capacity (ml)*、package*、material* 和 MOQ*。",
  "bookingLots.import.columns.extra":
    "同时保存：color assortment、function/battery/110/220、purchase schedule、departure interval in days、purchase qty in pcs、照片和 supplier business card，以及表格中的其他任何列（仅作信息，不在页面显示）。",
  "bookingLots.import.after":
    "导入后 booking 以草稿打开：核对估计的供应商和日期，补全条目后关闭。",

  "bookingLots.detail.title": "Booking 第 {n} 号",
  "bookingLots.detail.created":
    "已上传 booking，共 {n} 个条目。请核对来自表格的供应商和日期，并补全条目。",
  "bookingLots.detail.closed": "Booking 已关闭。Superplan 已分析所有条目。",
  "bookingLots.detail.analyzed": "已重新进行 Superplan 分析。",
  "bookingLots.detail.moved": "状态已更改。",
  "bookingLots.detail.saved": "备注已保存。",
  "bookingLots.detail.supplierCreated": "供应商已登记并关联到此 booking。",
  "bookingLots.detail.header": "Booking 信息",
  "bookingLots.detail.status": "状态",
  "bookingLots.detail.origin": "产地",
  "bookingLots.detail.originHint": "供应商所在城市。",
  "bookingLots.detail.supplier": "供应商",
  "bookingLots.detail.supplierField": "Booking 供应商",
  "bookingLots.detail.supplierSearch": "输入以搜索供应商",
  "bookingLots.detail.supplierNoMatch": "未找到供应商",
  "bookingLots.detail.date": "日期",
  "bookingLots.detail.dateField": "Booking 日期",
  "bookingLots.detail.dateSheet": "表格中：{date}",
  "bookingLots.detail.file": "表格",
  "bookingLots.detail.owner": "负责人",
  "bookingLots.detail.items": "条目",
  "bookingLots.detail.note": "备注",
  "bookingLots.detail.noteSave": "保存备注",
  "bookingLots.detail.suggest.title": "表格中的供应商未登记",
  "bookingLots.detail.suggest.body":
    "核对来自表格的信息并登记。它会进入“登记 → 供应商”（无登录），并成为此 booking 的供应商。",
  "bookingLots.detail.suggest.name": "名称",
  "bookingLots.detail.suggest.store": "店铺号",
  "bookingLots.detail.suggest.phone": "电话",
  "bookingLots.detail.suggest.city": "城市",
  "bookingLots.detail.suggest.country": "国家",
  "bookingLots.detail.suggest.submit": "登记并用于此 booking",
  "bookingLots.detail.suggest.pending": "正在登记…",
  "bookingLots.detail.itemsTitle": "条目（{n}）",
  "bookingLots.detail.itemsHint":
    "每个字段离开时（或按 Enter）自动保存。* 为关闭所需。",
  "bookingLots.detail.itemsLocked": "Booking {status}：条目不再更改。",
  "bookingLots.detail.pending": "关闭前还缺：{list}。",
  "bookingLots.detail.ready": "已全部填写：可以关闭 booking。",
  "bookingLots.pending.supplier": "供应商",
  "bookingLots.pending.date": "日期",
  "bookingLots.pending.items": "{n} 个不完整条目",
  "bookingLots.pending.noItems": "条目",
  "bookingLots.detail.close.title": "关闭 booking",
  "bookingLots.detail.close.body":
    "关闭时，Superplan 用默认值（当日汇率、默认集装箱和运费）分析所有条目，booking 将不能再编辑。",
  "bookingLots.detail.close.businessType": "Superplan 业务类型",
  "bookingLots.detail.close.default": "{name}（默认）",
  "bookingLots.detail.close.submit": "关闭并分析",
  "bookingLots.detail.close.pending": "正在分析…",
  "bookingLots.detail.reanalyze": "重新分析",
  "bookingLots.detail.reanalyzePending": "正在分析…",
  "bookingLots.detail.move": "更改状态",
  "bookingLots.detail.moveTo": "新状态",
  "bookingLots.detail.moveSubmit": "更改",
  "bookingLots.detail.analysisAt": "分析于 {date} · {type}",
  "bookingLots.detail.extra": "其他已保存的列：{list}",

  "bookingLots.item.col.position": "#",
  "bookingLots.item.col.photo": "照片",
  "bookingLots.item.col.itemNumber": "条目编号",
  "bookingLots.item.col.factoryItemCode": "SKU / 工厂货号",
  "bookingLots.item.col.description": "描述",
  "bookingLots.item.col.incoterm": "FOB/EXW",
  "bookingLots.item.col.currency": "币种（US$/RMB）",
  "bookingLots.item.col.price": "价格",
  "bookingLots.item.col.masterCartonQty": "每箱数量",
  "bookingLots.item.col.innerQty": "内盒数量",
  "bookingLots.item.col.netWeightPcKg": "单件净重（kg）",
  "bookingLots.item.col.grossWeightPcKg": "单件毛重（kg）",
  "bookingLots.item.col.cbmPerCarton": "CBM",
  "bookingLots.item.col.lengthCm": "长（cm）",
  "bookingLots.item.col.widthCm": "宽（cm）",
  "bookingLots.item.col.heightCm": "高（cm）",
  "bookingLots.item.col.capacityMl": "容量（ml）",
  "bookingLots.item.col.packageType": "包装",
  "bookingLots.item.col.material": "材质",
  "bookingLots.item.col.moq": "MOQ",
  "bookingLots.item.col.productName": "名称",
  "bookingLots.item.col.colorAssortment": "颜色",
  "bookingLots.item.col.powerDetail": "功能 / 电池 / 110 / 220",
  "bookingLots.item.col.purchaseSchedule": "采购计划",
  "bookingLots.item.col.departureIntervalDays": "出货间隔（天）",
  "bookingLots.item.col.purchaseQty": "采购数量（件）",
  "bookingLots.item.col.plannedQty": "计划件数（TT PCS）",
  "bookingLots.item.col.analysis": "Superplan",
  "bookingLots.item.col.check": "核对",
  "bookingLots.item.edit": "条目 {n} 的{field}",
  "bookingLots.item.missing": "缺少：{list}",
  "bookingLots.item.complete": "完整",
  "bookingLots.item.card": "名片",
  "bookingLots.item.minimum": "最低 {price}",
  "bookingLots.item.profit": "利润 {pct}%",
  "bookingLots.item.missingData": "缺少：{list}",

  "bookingLots.partner.title": "订舱负责人",
  "bookingLots.partner.supplier": "订舱的供应商",
  "bookingLots.partner.hint": "此订舱商品的询价都发给该合作方。留空：发给供应商。",
  "bookingLots.error.booking_partner_invalid":
    "请选择启用的合作方：供应商、Trading、Factory、Supplier、GP 或其他可登录类型。",
  "bookingLots.error.supplier_required":
    "关闭前请选择 booking 的供应商（或登记表格中的供应商）。",
  "bookingLots.error.booking_date_required": "关闭前请填写 booking 日期。",
  "bookingLots.error.booking_items_incomplete":
    "有条目的必填字段为空。请补全每个条目中标出的字段后再关闭。",
  "bookingLots.error.booking_lot_locked":
    "此 booking 已不是草稿：数据不再更改。",
  "bookingLots.error.booking_item_invalid":
    "无法读取的值。请使用大于零的数字、FOB 或 EXW，以及 USD、RMB、BRL 或 EUR。",
  "bookingLots.error.supplier_invalid":
    "供应商不存在或已停用。请从列表中另选。",
  "bookingLots.error.supplier_name_required": "请填写供应商名称。",
  "bookingLots.error.booking_date_invalid": "日期无效。",
  "bookingLots.error.booking_lot_move_invalid": "该状态不能接在当前状态之后。",
  "bookingLots.error.booking_lot_not_closed":
    "只有已关闭的 booking 才能重新分析。",
  "bookingLots.error.schema_outdated":
    "booking 数据表尚未发布到数据库（npm run appwrite:push）。",
  "bookingLots.error.not_found": "未找到 booking 或条目。",
};
