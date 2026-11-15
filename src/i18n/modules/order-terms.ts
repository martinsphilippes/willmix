/**
 * Condições do pedido e contatos do cliente na Nova solicitação (dono,
 * 15/11/2026; docs/ORDER_TERMS.md).
 */
export const pt = {
  "orderTerms.title": "Condições do pedido",
  "orderTerms.hint":
    "Valem para todos os produtos desta solicitação. Escolha o país e o grupo antes dos produtos.",
  "orderTerms.operationType": "Tipo de operação",
  "orderTerms.operation.ts": "TS (Trading Sales)",
  "orderTerms.operation.sale": "Venda",
  "orderTerms.saleFormat": "Formato de venda",
  "orderTerms.format.wd": "WD",
  "orderTerms.format.wellmix": "Wellmix",
  "orderTerms.tier": "Formato Wellmix",
  "orderTerms.tierChoose": "Escolha o formato",
  "orderTerms.tier.pleno": "Pleno",
  "orderTerms.tier.mega": "Mega",
  "orderTerms.tier.hiper": "Hiper",
  "orderTerms.tier.ultra": "Ultra",
  "orderTerms.tier.evo": "Evo",
  "orderTerms.tier.super": "Super",
  "orderTerms.delivery": "Entrega",
  "orderTerms.carrier": "Transportador",
  "orderTerms.carrierNone": "Escolha o transportador",
  "orderTerms.redispatch": "Re-despacho",
  "orderTerms.redispatchNone": "Sem re-despacho",
  "orderTerms.carrierSankhya": "Sankhya",
  "orderTerms.carrierSankhyaOff":
    "Integração Sankhya não configurada: só as transportadoras do cadastro do portal.",
  "orderTerms.carrierSankhyaError":
    "Não deu para ler as transportadoras no Sankhya agora: só as do cadastro do portal.",
  "orderTerms.country": "País (de origem)",
  "orderTerms.countryChoose": "Escolha o país",
  "orderTerms.countryUnknown": "País não informado no cadastro",
  "orderTerms.group": "Grupo de produto (família)",
  "orderTerms.groupChoose": "Escolha o grupo",
  "orderTerms.groupPickCountry": "Escolha o país primeiro",
  "orderTerms.groupNone": "Nenhum grupo com produto neste país",
  "orderTerms.originHint":
    "País do fornecedor do produto (cadastro ou Sankhya) e família (o grupo acima das linhas no Sankhya). Só os produtos deste país e família entram no pedido; produto sem país não é vendido.",
  "orderTerms.originFirst":
    "Escolha o país de origem e o grupo de produto nas condições do pedido para buscar o produto.",
  "orderTerms.loading": "Carregando…",
  "orderTerms.error": "Não deu para carregar as opções. Recarregue a página.",
  "orderTerms.productsCount": "{n} produtos",
  "orderTerms.stock":
    "Compra para estoque: sem condições de venda nem contatos do cliente.",
  "orderTerms.disclaimerTitle": "Atenção: sem devoluções",
  "orderTerms.disclaimer":
    "Não nos responsabilizamos por defeitos ou quebras de produtos neste modelo de venda, ou seja, não há devoluções previstas para esta operação. Isto acontece, pois nosso processo prevê que o cliente seja o responsável pelas inspeções e aprovações necessárias durante o processo de produção.",
  "orderTerms.accept": "Li e concordo",
  "reqBatch.error.order_terms_accept":
    'Marque "Li e concordo" no aviso de que não há devoluções.',
  "reqBatch.error.order_terms_carrier_required":
    "Escolha ao menos o transportador.",
  "composition.title": "Composição de containers",
  "composition.hint":
    "Ocupação de cada container em cada programação, somando os produtos do pedido (em caixas master inteiras, pelo CBM). Abra a linha para ver cada produto.",
  "composition.empty":
    "Escolha os produtos e as quantidades: a ocupação aparece aqui.",
  "composition.container": "Container",
  "composition.containerN": "Container {n}",
  "composition.roundN": "Programação {n}",
  "composition.expand": "Abrir",
  "composition.collapse": "Fechar",
  "composition.unused": "—",
  "composition.reference": "Container de referência: {code} ({cbm} m³).",
  "composition.mixed":
    "Há produto com outro container escolhido; a conta usa este.",
  "composition.missing":
    "Sem caixa master ou CBM no cadastro (fora da conta): {names}.",
  "composition.tooBig":
    "A caixa não cabe no container (fora da conta): {names}.",
  "composition.cartons": "{cartons} cx",
  "orderTerms.operationDisabled": "(em breve)",
  "orderTerms.redispatchYes": "Sim",
  "orderTerms.redispatchNo": "Não",
  "orderTerms.redispatchHint":
    "Com re-despacho, o cliente informa o CNPJ da transportadora ao confirmar o pedido.",
  "orderTerms.countryDisabled": "(não vale no TS)",
  "orderTerms.confirmNote":
    'Depois do envio, o cliente confirma o pedido no portal (aviso "sem devoluções" e, com re-despacho, a transportadora). Só então ele entra na fila da Wellmix.',
  "orderTerms.view.redispatchPending":
    "o cliente informa a transportadora na confirmação",
  "orderTerms.view.confirmed":
    'Confirmado pelo cliente ({name}) em {date}: aviso "sem devoluções" aceito.',
  "orderTerms.view.sellerAccepted":
    'Aviso "sem devoluções" aceito pelo vendedor no lançamento.',
  "orderTerms.view.awaiting": "Aguardando a confirmação do cliente.",
  "reqStatusLabel.AWAITING_CUSTOMER": "Aguardando confirmação do cliente",
  "reqBatch.error.order_terms_operation_disabled":
    "Por enquanto só TS: o tipo Venda ainda não está liberado.",
  "reqBatch.error.order_terms_country_disabled":
    "No TS o país de origem não pode ser BRASIL.",
  "reqBatch.error.order_terms_redispatch":
    "Marque se o pedido tem re-despacho (Sim ou Não).",
  "reqBatch.error.access_required":
    "Escolha o login do cliente com acesso: é ele quem confirma o pedido. Cliente sem login: crie um em Cadastros → Clientes.",
  "reqBatch.error.cnpj_invalid": "CNPJ inválido. Confira os 14 números.",
  "reqBatch.error.cnpj_not_found":
    "CNPJ não encontrado na Receita. Confira o número.",
  "reqBatch.error.cnpj_required":
    "Informe o CNPJ da transportadora do re-despacho.",
  "reqBatch.error.carrier_name_required": "Digite o nome da transportadora.",
  "reqBatch.error.confirm_not_allowed":
    "Este pedido não está aguardando a sua confirmação.",
  "reqBatch.error.confirm_accept_required":
    'Marque "Li e concordo" para confirmar o pedido.',
  "requestPeople.accessRequired":
    "Obrigatório na venda: é este login que confirma o pedido. Só ele (no cliente) verá a solicitação e o pedido.",
  "requestPeople.accessChoose": "Escolha o login do cliente",
  "customerConfirm.title": "Confirme o seu pedido",
  "customerConfirm.intro":
    "A Wellmix lançou este pedido para você. Leia o aviso e confirme para ele seguir.",
  "customerConfirm.redispatchTitle": "Transportadora do re-despacho",
  "customerConfirm.redispatchHint":
    "Digite o CNPJ e toque em Buscar: completamos os dados da transportadora para o cadastro.",
  "customerConfirm.cnpj": "CNPJ da transportadora",
  "customerConfirm.cnpjPlaceholder": "00.000.000/0000-00",
  "customerConfirm.lookup": "Buscar",
  "customerConfirm.looking": "Buscando…",
  "customerConfirm.cnpjInvalid": "CNPJ inválido. Confira os 14 números.",
  "customerConfirm.notFound":
    "CNPJ não encontrado na Receita. Confira o número.",
  "customerConfirm.manual":
    "Não deu para consultar o CNPJ agora: digite o nome da transportadora (a Wellmix confere o cadastro).",
  "customerConfirm.carrierName": "Nome da transportadora",
  "customerConfirm.found": "Transportadora encontrada",
  "customerConfirm.submit": "Confirmar pedido",
  "customerConfirm.submitting": "Confirmando…",
  "customerConfirm.done": "Pedido confirmado. A Wellmix já recebeu.",
  "customerConfirm.awaitingWellmix":
    'Aguardando a confirmação do cliente: o login do cliente com acesso precisa confirmar o pedido (aviso "sem devoluções" e, com re-despacho, a transportadora). Só então ele entra na fila.',
  "requestDraft.save": "Salvar rascunho",
  "requestDraft.saved":
    'Rascunho salvo. Complete quando quiser: ele fica em "Seus rascunhos", no alto desta tela.',
  "requestDraft.deleted": "Rascunho apagado.",
  "requestDraft.title": "Seus rascunhos",
  "requestDraft.noCustomer": "Sem cliente",
  "requestDraft.updated": "salvo em {date}",
  "requestDraft.open": "Aberto",
  "requestDraft.resume": "Continuar",
  "requestDraft.delete": "Apagar",
  "reqBatch.error.draft_not_found":
    "Rascunho não encontrado (já enviado ou apagado).",
  "historyPick.add": "Acrescentar ao pedido",
  "historyPick.inOrder": "No pedido",
  "historyPick.filtered":
    "Só os produtos da família escolhida ({n} de outras famílias não aparecem).",
  "composition.goTo": "Ir para o produto no pedido",
  "orderTerms.view.title": "Condições do pedido",
  "orderTerms.view.none": "—",
  "reqBatch.error.order_terms_operation":
    "Escolha o tipo de operação (TS ou Venda).",
  "reqBatch.error.order_terms_format":
    "Escolha o formato de venda (WD ou Wellmix).",
  "reqBatch.error.order_terms_tier":
    "Formato Wellmix: escolha Pleno, Mega, Hiper, Ultra, Evo ou Super.",
  "reqBatch.error.order_terms_carrier":
    "A transportadora escolhida não está mais na lista. Escolha de novo.",
  "reqBatch.error.order_terms_origin":
    "Escolha o país de origem e o grupo de produto.",
  "reqBatch.error.order_terms_invalid": "Confira as condições do pedido.",
  "reqBatch.error.order_terms_mismatch":
    "Há produto de outro país ou grupo. Um pedido só tem produtos do país e do grupo escolhidos.",
  "reqBatch.error.contacts_required":
    "Preencha os contatos do cliente (sócio, comprador, financeiro e fiscal, logística).",
  "reqBatch.error.contacts_invalid":
    "Confira os contatos do cliente: telefone com DDD e e-mail válidos em todos.",
  "reqBatch.error.contacts_same_as_seller":
    "Os contatos do cliente não podem ser iguais aos do representante ou vendedor.",
  "reqBatch.error.contacts_not_customer": "Os contatos são só de cliente.",
  "customerContacts.title": "Cliente",
  "customerContacts.intro":
    "Atualize os contatos do cliente. Ficam no cadastro dele e aparecem na próxima venda.",
  "customerContacts.pick": "Escolha o cliente no formulário.",
  "customerContacts.stock": "Compra para estoque: sem contatos do cliente.",
  "customerContacts.loading": "Buscando o cliente…",
  "customerContacts.error":
    "Não deu para buscar o cliente. Recarregue a página.",
  "customerContacts.blind":
    "Primeira atualização pelo portal: preencha todos os contatos com o cliente.",
  "customerContacts.known": "Edite o que mudou. Grava junto com a solicitação.",
  "customerContacts.updated": "Atualizados em {date} por {name}.",
  "customerContacts.edit": "Editar contatos",
  "customerContacts.cancel": "Cancelar edição",
  "customerContacts.phone": "Telefone",
  "customerContacts.email": "E-mail",
  "customerContacts.rule":
    "Os dados não podem ser iguais aos do representante ou vendedor.",
  "customerContacts.role.partner": "Sócio",
  "customerContacts.role.buyer": "Comprador",
  "customerContacts.role.finance": "Financeiro e Fiscal",
  "customerContacts.role.logistics": "Logística",
};

export const en: Record<keyof typeof pt, string> = {
  "orderTerms.title": "Order terms",
  "orderTerms.hint":
    "They apply to every product in this request. Choose the country and the group before the products.",
  "orderTerms.operationType": "Operation type",
  "orderTerms.operation.ts": "TS (Trading Sales)",
  "orderTerms.operation.sale": "Sale",
  "orderTerms.saleFormat": "Sales format",
  "orderTerms.format.wd": "WD",
  "orderTerms.format.wellmix": "Wellmix",
  "orderTerms.tier": "Wellmix format",
  "orderTerms.tierChoose": "Choose the format",
  "orderTerms.tier.pleno": "Pleno",
  "orderTerms.tier.mega": "Mega",
  "orderTerms.tier.hiper": "Hiper",
  "orderTerms.tier.ultra": "Ultra",
  "orderTerms.tier.evo": "Evo",
  "orderTerms.tier.super": "Super",
  "orderTerms.delivery": "Delivery",
  "orderTerms.carrier": "Carrier",
  "orderTerms.carrierNone": "Choose the carrier",
  "orderTerms.redispatch": "Redispatch",
  "orderTerms.redispatchNone": "No redispatch",
  "orderTerms.carrierSankhya": "Sankhya",
  "orderTerms.carrierSankhyaOff":
    "Sankhya integration not configured: only the carriers registered in the portal.",
  "orderTerms.carrierSankhyaError":
    "Could not read the carriers from Sankhya right now: only the portal ones.",
  "orderTerms.country": "Country (of origin)",
  "orderTerms.countryChoose": "Choose the country",
  "orderTerms.countryUnknown": "Country not registered",
  "orderTerms.group": "Product group (family)",
  "orderTerms.groupChoose": "Choose the group",
  "orderTerms.groupPickCountry": "Choose the country first",
  "orderTerms.groupNone": "No group with products in this country",
  "orderTerms.originHint":
    "Country of the product's supplier (portal or Sankhya) and family (the group above the lines in Sankhya). Only products of this country and family go into the order; products without a country are not sold.",
  "orderTerms.originFirst":
    "Choose the country of origin and the product group in the order terms to search for the product.",
  "orderTerms.loading": "Loading…",
  "orderTerms.error": "Could not load the options. Reload the page.",
  "orderTerms.productsCount": "{n} products",
  "orderTerms.stock":
    "Stock purchase: no sales terms and no customer contacts.",
  "orderTerms.disclaimerTitle": "Attention: no returns",
  "orderTerms.disclaimer":
    "We are not responsible for product defects or breakage in this sales model, that is, no returns are foreseen for this operation. This is because our process provides that the customer is responsible for the inspections and approvals required during production.",
  "orderTerms.accept": "I have read and agree",
  "reqBatch.error.order_terms_accept":
    'Tick "I have read and agree" on the no-returns notice.',
  "reqBatch.error.order_terms_carrier_required": "Choose at least the carrier.",
  "composition.title": "Container composition",
  "composition.hint":
    "Occupancy of each container in each schedule, adding up the order's products (whole master cartons, by CBM). Open a row to see each product.",
  "composition.empty":
    "Choose the products and quantities: the occupancy shows up here.",
  "composition.container": "Container",
  "composition.containerN": "Container {n}",
  "composition.roundN": "Schedule {n}",
  "composition.expand": "Open",
  "composition.collapse": "Close",
  "composition.unused": "—",
  "composition.reference": "Reference container: {code} ({cbm} m³).",
  "composition.mixed":
    "A product has another container chosen; the calculation uses this one.",
  "composition.missing":
    "No master carton or CBM registered (left out): {names}.",
  "composition.tooBig":
    "The carton does not fit the container (left out): {names}.",
  "composition.cartons": "{cartons} ctn",
  "orderTerms.operationDisabled": "(coming soon)",
  "orderTerms.redispatchYes": "Yes",
  "orderTerms.redispatchNo": "No",
  "orderTerms.redispatchHint":
    "With redispatch, the customer enters the carrier's CNPJ when confirming the order.",
  "orderTerms.countryDisabled": "(not allowed in TS)",
  "orderTerms.confirmNote":
    'After sending, the customer confirms the order in the portal ("no returns" notice and, with redispatch, the carrier). Only then does it go to Wellmix\'s queue.',
  "orderTerms.view.redispatchPending":
    "the customer enters the carrier when confirming",
  "orderTerms.view.confirmed":
    'Confirmed by the customer ({name}) on {date}: "no returns" notice accepted.',
  "orderTerms.view.sellerAccepted":
    '"No returns" notice accepted by the seller when entering the order.',
  "orderTerms.view.awaiting": "Waiting for the customer's confirmation.",
  "reqStatusLabel.AWAITING_CUSTOMER": "Awaiting customer confirmation",
  "reqBatch.error.order_terms_operation_disabled":
    "For now only TS: the Sale type is not available yet.",
  "reqBatch.error.order_terms_country_disabled":
    "In TS the country of origin cannot be BRASIL.",
  "reqBatch.error.order_terms_redispatch":
    "Mark whether the order has redispatch (Yes or No).",
  "reqBatch.error.access_required":
    "Choose the customer login with access: that login confirms the order. Customer without a login: create one in Records → Customers.",
  "reqBatch.error.cnpj_invalid": "Invalid CNPJ. Check the 14 digits.",
  "reqBatch.error.cnpj_not_found":
    "CNPJ not found at the Federal Revenue. Check the number.",
  "reqBatch.error.cnpj_required": "Enter the redispatch carrier's CNPJ.",
  "reqBatch.error.carrier_name_required": "Type the carrier's name.",
  "reqBatch.error.confirm_not_allowed":
    "This order is not waiting for your confirmation.",
  "reqBatch.error.confirm_accept_required":
    'Tick "I have read and agree" to confirm the order.',
  "requestPeople.accessRequired":
    "Required for sales: this login confirms the order. Only it (on the customer side) will see the request and the order.",
  "requestPeople.accessChoose": "Choose the customer login",
  "customerConfirm.title": "Confirm your order",
  "customerConfirm.intro":
    "Wellmix entered this order for you. Read the notice and confirm so it can proceed.",
  "customerConfirm.redispatchTitle": "Redispatch carrier",
  "customerConfirm.redispatchHint":
    "Type the CNPJ and tap Search: we fill in the carrier's data for the record.",
  "customerConfirm.cnpj": "Carrier CNPJ",
  "customerConfirm.cnpjPlaceholder": "00.000.000/0000-00",
  "customerConfirm.lookup": "Search",
  "customerConfirm.looking": "Searching…",
  "customerConfirm.cnpjInvalid": "Invalid CNPJ. Check the 14 digits.",
  "customerConfirm.notFound":
    "CNPJ not found at the Federal Revenue. Check the number.",
  "customerConfirm.manual":
    "Could not look up the CNPJ right now: type the carrier's name (Wellmix checks the record).",
  "customerConfirm.carrierName": "Carrier name",
  "customerConfirm.found": "Carrier found",
  "customerConfirm.submit": "Confirm order",
  "customerConfirm.submitting": "Confirming…",
  "customerConfirm.done": "Order confirmed. Wellmix has received it.",
  "customerConfirm.awaitingWellmix":
    'Waiting for the customer\'s confirmation: the customer login with access must confirm the order ("no returns" notice and, with redispatch, the carrier). Only then does it go to the queue.',
  "requestDraft.save": "Save draft",
  "requestDraft.saved":
    'Draft saved. Finish it whenever you want: it stays under "Your drafts" at the top of this screen.',
  "requestDraft.deleted": "Draft deleted.",
  "requestDraft.title": "Your drafts",
  "requestDraft.noCustomer": "No customer",
  "requestDraft.updated": "saved on {date}",
  "requestDraft.open": "Open",
  "requestDraft.resume": "Continue",
  "requestDraft.delete": "Delete",
  "reqBatch.error.draft_not_found":
    "Draft not found (already sent or deleted).",
  "historyPick.add": "Add to the order",
  "historyPick.inOrder": "In the order",
  "historyPick.filtered":
    "Only products of the chosen family ({n} from other families are hidden).",
  "composition.goTo": "Go to the product in the order",
  "orderTerms.view.title": "Order terms",
  "orderTerms.view.none": "—",
  "reqBatch.error.order_terms_operation":
    "Choose the operation type (TS or Sale).",
  "reqBatch.error.order_terms_format":
    "Choose the sales format (WD or Wellmix).",
  "reqBatch.error.order_terms_tier":
    "Wellmix format: choose Pleno, Mega, Hiper, Ultra, Evo or Super.",
  "reqBatch.error.order_terms_carrier":
    "The chosen carrier is no longer on the list. Choose again.",
  "reqBatch.error.order_terms_origin":
    "Choose the country of origin and the product group.",
  "reqBatch.error.order_terms_invalid": "Check the order terms.",
  "reqBatch.error.order_terms_mismatch":
    "There is a product from another country or group. An order only has products of the chosen country and group.",
  "reqBatch.error.contacts_required":
    "Fill in the customer contacts (partner, buyer, finance and tax, logistics).",
  "reqBatch.error.contacts_invalid":
    "Check the customer contacts: valid phone (with area code) and e-mail in all of them.",
  "reqBatch.error.contacts_same_as_seller":
    "The customer contacts cannot be the same as the sales rep's or seller's.",
  "reqBatch.error.contacts_not_customer": "Contacts are for customers only.",
  "customerContacts.title": "Customer",
  "customerContacts.intro":
    "Update the customer contacts. They stay in the customer record and show up on the next sale.",
  "customerContacts.pick": "Choose the customer in the form.",
  "customerContacts.stock": "Stock purchase: no customer contacts.",
  "customerContacts.loading": "Looking up the customer…",
  "customerContacts.error": "Could not look up the customer. Reload the page.",
  "customerContacts.blind":
    "First update through the portal: fill in every contact with the customer.",
  "customerContacts.known": "Edit what changed. It is saved with the request.",
  "customerContacts.updated": "Updated on {date} by {name}.",
  "customerContacts.edit": "Edit contacts",
  "customerContacts.cancel": "Cancel editing",
  "customerContacts.phone": "Phone",
  "customerContacts.email": "E-mail",
  "customerContacts.rule":
    "The data cannot be the same as the sales rep's or seller's.",
  "customerContacts.role.partner": "Partner",
  "customerContacts.role.buyer": "Buyer",
  "customerContacts.role.finance": "Finance and Tax",
  "customerContacts.role.logistics": "Logistics",
};

export const zh: Record<keyof typeof pt, string> = {
  "orderTerms.title": "订单条件",
  "orderTerms.hint":
    "适用于本申请的所有产品。请先选择国家和产品组，再选择产品。",
  "orderTerms.operationType": "业务类型",
  "orderTerms.operation.ts": "TS（贸易销售）",
  "orderTerms.operation.sale": "销售",
  "orderTerms.saleFormat": "销售模式",
  "orderTerms.format.wd": "WD",
  "orderTerms.format.wellmix": "Wellmix",
  "orderTerms.tier": "Wellmix 模式",
  "orderTerms.tierChoose": "选择模式",
  "orderTerms.tier.pleno": "Pleno",
  "orderTerms.tier.mega": "Mega",
  "orderTerms.tier.hiper": "Hiper",
  "orderTerms.tier.ultra": "Ultra",
  "orderTerms.tier.evo": "Evo",
  "orderTerms.tier.super": "Super",
  "orderTerms.delivery": "交货",
  "orderTerms.carrier": "承运商",
  "orderTerms.carrierNone": "请选择承运商",
  "orderTerms.redispatch": "转运",
  "orderTerms.redispatchNone": "无转运",
  "orderTerms.carrierSankhya": "Sankhya",
  "orderTerms.carrierSankhyaOff":
    "未配置 Sankhya 集成：仅显示门户登记的承运商。",
  "orderTerms.carrierSankhyaError":
    "暂时无法从 Sankhya 读取承运商：仅显示门户登记的承运商。",
  "orderTerms.country": "原产国",
  "orderTerms.countryChoose": "选择国家",
  "orderTerms.countryUnknown": "登记中未填写国家",
  "orderTerms.group": "产品组（产品系列）",
  "orderTerms.groupChoose": "选择产品组",
  "orderTerms.groupPickCountry": "请先选择国家",
  "orderTerms.groupNone": "该国家没有含产品的产品组",
  "orderTerms.originHint":
    "产品供应商所在国家（门户或 Sankhya）以及产品系列（Sankhya 中产品线的上一级分组）。订单只包含该国家和产品系列的产品；没有国家的产品不予销售。",
  "orderTerms.originFirst": "请先在订单条件中选择原产国和产品组，再搜索产品。",
  "orderTerms.loading": "加载中…",
  "orderTerms.error": "无法加载选项，请刷新页面。",
  "orderTerms.productsCount": "{n} 个产品",
  "orderTerms.stock": "库存采购：无销售条件，也无客户联系人。",
  "orderTerms.disclaimerTitle": "注意：不予退货",
  "orderTerms.disclaimer":
    "在此销售模式下，我们不对产品缺陷或破损负责，即本业务不提供退货。这是因为我们的流程规定，客户负责生产过程中所需的检验和确认。",
  "orderTerms.accept": "我已阅读并同意",
  "reqBatch.error.order_terms_accept":
    "请在不予退货的提示中勾选“我已阅读并同意”。",
  "reqBatch.error.order_terms_carrier_required": "请至少选择承运商。",
  "composition.title": "集装箱组成",
  "composition.hint":
    "每个排程中每个集装箱的占用率，按订单产品合计（整箱外箱，按 CBM）。展开一行查看每个产品。",
  "composition.empty": "选择产品和数量后，占用率会显示在这里。",
  "composition.container": "集装箱",
  "composition.containerN": "集装箱 {n}",
  "composition.roundN": "排程 {n}",
  "composition.expand": "展开",
  "composition.collapse": "收起",
  "composition.unused": "—",
  "composition.reference": "参考集装箱：{code}（{cbm} m³）。",
  "composition.mixed": "有产品选择了其他集装箱；计算使用此集装箱。",
  "composition.missing": "未登记外箱或 CBM（不计入）：{names}。",
  "composition.tooBig": "外箱放不进集装箱（不计入）：{names}。",
  "composition.cartons": "{cartons} 箱",
  "orderTerms.operationDisabled": "（即将开放）",
  "orderTerms.redispatchYes": "是",
  "orderTerms.redispatchNo": "否",
  "orderTerms.redispatchHint": "如需转运，客户在确认订单时填写承运商的 CNPJ。",
  "orderTerms.countryDisabled": "（TS 不适用）",
  "orderTerms.confirmNote":
    "提交后，客户需在门户中确认订单（“不予退货”提示，如需转运还要填写承运商）。确认后订单才进入 Wellmix 的队列。",
  "orderTerms.view.redispatchPending": "客户在确认时填写承运商",
  "orderTerms.view.confirmed":
    "客户（{name}）已于 {date} 确认：已接受“不予退货”提示。",
  "orderTerms.view.sellerAccepted": "销售员在录入时已接受“不予退货”提示。",
  "orderTerms.view.awaiting": "等待客户确认。",
  "reqStatusLabel.AWAITING_CUSTOMER": "等待客户确认",
  "reqBatch.error.order_terms_operation_disabled":
    "目前只开放 TS：销售类型尚未开放。",
  "reqBatch.error.order_terms_country_disabled": "TS 的原产国不能是 BRASIL。",
  "reqBatch.error.order_terms_redispatch": "请选择订单是否转运（是或否）。",
  "reqBatch.error.access_required":
    "请选择有访问权限的客户登录：由该登录确认订单。客户没有登录：请在“档案 → 客户”中创建。",
  "reqBatch.error.cnpj_invalid": "CNPJ 无效，请检查 14 位数字。",
  "reqBatch.error.cnpj_not_found": "税务局未找到该 CNPJ，请检查号码。",
  "reqBatch.error.cnpj_required": "请填写转运承运商的 CNPJ。",
  "reqBatch.error.carrier_name_required": "请输入承运商名称。",
  "reqBatch.error.confirm_not_allowed": "此订单不在等待您确认。",
  "reqBatch.error.confirm_accept_required":
    "请勾选“我已阅读并同意”以确认订单。",
  "requestPeople.accessRequired":
    "销售时必填：由该登录确认订单。只有它（客户方）能看到申请和订单。",
  "requestPeople.accessChoose": "选择客户登录",
  "customerConfirm.title": "确认您的订单",
  "customerConfirm.intro":
    "Wellmix 为您录入了此订单。请阅读提示并确认，订单才会继续。",
  "customerConfirm.redispatchTitle": "转运承运商",
  "customerConfirm.redispatchHint":
    "输入 CNPJ 并点击“查询”：我们会补全承运商资料用于建档。",
  "customerConfirm.cnpj": "承运商 CNPJ",
  "customerConfirm.cnpjPlaceholder": "00.000.000/0000-00",
  "customerConfirm.lookup": "查询",
  "customerConfirm.looking": "查询中…",
  "customerConfirm.cnpjInvalid": "CNPJ 无效，请检查 14 位数字。",
  "customerConfirm.notFound": "税务局未找到该 CNPJ，请检查号码。",
  "customerConfirm.manual":
    "暂时无法查询 CNPJ：请输入承运商名称（Wellmix 会核对档案）。",
  "customerConfirm.carrierName": "承运商名称",
  "customerConfirm.found": "已找到承运商",
  "customerConfirm.submit": "确认订单",
  "customerConfirm.submitting": "确认中…",
  "customerConfirm.done": "订单已确认，Wellmix 已收到。",
  "customerConfirm.awaitingWellmix":
    "等待客户确认：有访问权限的客户登录需要确认订单（“不予退货”提示，如需转运还要填写承运商）。确认后才进入队列。",
  "requestDraft.save": "保存草稿",
  "requestDraft.saved":
    "草稿已保存。随时可以继续完成：它在本页顶部的“我的草稿”中。",
  "requestDraft.deleted": "草稿已删除。",
  "requestDraft.title": "我的草稿",
  "requestDraft.noCustomer": "无客户",
  "requestDraft.updated": "保存于 {date}",
  "requestDraft.open": "已打开",
  "requestDraft.resume": "继续",
  "requestDraft.delete": "删除",
  "reqBatch.error.draft_not_found": "未找到草稿（已提交或已删除）。",
  "historyPick.add": "加入订单",
  "historyPick.inOrder": "已在订单中",
  "historyPick.filtered":
    "只显示所选产品系列的产品（其他系列的 {n} 个已隐藏）。",
  "composition.goTo": "跳转到订单中的该产品",
  "orderTerms.view.title": "订单条件",
  "orderTerms.view.none": "—",
  "reqBatch.error.order_terms_operation": "请选择业务类型（TS 或销售）。",
  "reqBatch.error.order_terms_format": "请选择销售模式（WD 或 Wellmix）。",
  "reqBatch.error.order_terms_tier":
    "Wellmix 模式：请选择 Pleno、Mega、Hiper、Ultra、Evo 或 Super。",
  "reqBatch.error.order_terms_carrier": "所选承运商已不在列表中，请重新选择。",
  "reqBatch.error.order_terms_origin": "请选择原产国和产品组。",
  "reqBatch.error.order_terms_invalid": "请检查订单条件。",
  "reqBatch.error.order_terms_mismatch":
    "有来自其他国家或产品组的产品。订单只能包含所选国家和产品组的产品。",
  "reqBatch.error.contacts_required":
    "请填写客户联系人（股东、采购、财务和税务、物流）。",
  "reqBatch.error.contacts_invalid":
    "请检查客户联系人：每项都需有效的电话（含区号）和邮箱。",
  "reqBatch.error.contacts_same_as_seller":
    "客户联系人不能与代表或销售员的相同。",
  "reqBatch.error.contacts_not_customer": "联系人仅适用于客户。",
  "customerContacts.title": "客户",
  "customerContacts.intro":
    "更新客户联系人。信息保存在客户档案中，下次销售时显示。",
  "customerContacts.pick": "请在表单中选择客户。",
  "customerContacts.stock": "库存采购：无客户联系人。",
  "customerContacts.loading": "正在查找客户…",
  "customerContacts.error": "无法查找客户，请刷新页面。",
  "customerContacts.blind": "首次通过门户更新：请与客户一起填写所有联系人。",
  "customerContacts.known": "修改有变化的内容，随申请一起保存。",
  "customerContacts.updated": "{name} 于 {date} 更新。",
  "customerContacts.edit": "编辑联系人",
  "customerContacts.cancel": "取消编辑",
  "customerContacts.phone": "电话",
  "customerContacts.email": "邮箱",
  "customerContacts.rule": "这些信息不能与代表或销售员的相同。",
  "customerContacts.role.partner": "股东",
  "customerContacts.role.buyer": "采购",
  "customerContacts.role.finance": "财务和税务",
  "customerContacts.role.logistics": "物流",
};
