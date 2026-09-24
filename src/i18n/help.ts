/**
 * Textos de ajuda contextual: cada tela explica a lógica e o que fazer.
 * Linhas separadas por "\n" viram itens de lista no componente PageHelp.
 */
export const helpPt = {
  "help.how": "Como funciona",
  "help.todo": "O que fazer aqui",
  "help.flow.title": "O fluxo de importação",
  "help.flow.steps":
    "Solicitação: o cliente (ou a Willmix por ele) descreve o produto, quantidade e prazo.\nRFQ: a Willmix escolhe fornecedores; cada um recebe um link e responde preço, prazo e condições.\nSeleção: a Willmix compara as cotações, escolhe o fornecedor e define o valor ao cliente e o sinal.\nSinal: o cliente paga; a Willmix confirma e o pedido nasce com todas as etapas e requisitos.\nPreparação: o fornecedor cumpre o checklist da linha (dieline, fotos, peso, etiqueta).\nPagamento ao fornecedor: a Willmix registra; o fornecedor confirma o recebimento.\nArte e embalagem: o fornecedor envia a arte; a agência aprova ou reprova.\nInspeção: fotos e peso medido; divergência acima da tolerância bloqueia até revisão da Willmix.\nEmbarque: companhia marítima informa data, previsão e BL.\nDesembaraço: despachante registra processo, documentos, custos e liberação.\nTransporte: transportador informa placa, previsão e entrega.\nEntrega: o cliente confirma o recebimento e o pedido é encerrado.",
  "help.rule":
    "Cada etapa tem requisitos com um responsável. Quando todos os obrigatórios estão concluídos, a etapa fecha sozinha, a próxima abre e o próximo responsável recebe um aviso. Ninguém precisa cobrar ninguém.",
  "help.login.body":
    "O Portal Willmix organiza a importação do pedido do cliente até a entrega. Cada participante (cliente, Willmix, fornecedor, agência, despachante, companhia marítima, transportador, jurídico) entra com a própria conta e vê apenas o que lhe cabe.",
  "help.login.roles":
    "Cliente: cria solicitações, vê a proposta, paga o sinal, acompanha a timeline e confirma o recebimento.\nWillmix (admin e operador): abre RFQs, compara cotações, escolhe fornecedor, confirma pagamentos, designa parceiros e acompanha tudo na Control Tower.\nFornecedor: responde cotações, cumpre checklists, envia fotos e peso, confirma pagamentos e vê a conta corrente.\nAgência: aprova a arte da embalagem.\nDespachante, companhia marítima e transportador: registram cada um a sua etapa.\nJurídico: acompanha multas.",
  "help.login.demo": "Contas de demonstração",
  "help.login.demoHint":
    "Toque em uma conta para preencher o formulário. Senha de todas: {password}.",
  "help.tasks.body":
    "Esta lista mostra tudo o que depende de você agora: requisitos de etapas ativas, cotações a responder, seleções e confirmações pendentes. Itens atrasados aparecem primeiro.",
  "help.tasks.steps":
    "Toque em Abrir para ir direto ao pedido ou à solicitação.\nPreencha o requisito (arquivo, número, data ou confirmação). A etapa avança sozinha quando tudo estiver completo.\nSe a lista estiver vazia, não há nada pendente para o seu papel.",
  "help.ct.body":
    "A Control Tower responde: quantos pedidos estão ativos, onde cada um está parado, quem precisa agir, quais estão atrasados e quais têm problema. Toque em um card para filtrar a lista; toque no número do pedido para abrir os detalhes.",
  "help.ct.cards":
    "Pedidos ativos: tudo que ainda não foi encerrado.\nSolicitações em aberto: pedidos que ainda não nasceram (RFQ, cotação, sinal).\nAguardando fornecedor / cliente: a próxima ação é de um deles.\nAtrasados: etapa ativa com prazo vencido. Um lembrete é enviado ao responsável todos os dias.\nCom problema: etapa bloqueada (peso divergente), documento reprovado, ERP pendente ou multa em aberto.\nExceções: a lista à direita detalha cada problema com atalho para o pedido.",
  "help.requests.body":
    "Solicitação é o pedido de cotação do cliente. Ela passa por RFQ, cotações, seleção do fornecedor e sinal; quando o sinal é confirmado, vira um pedido com etapas.",
  "help.requests.steps":
    "Nova solicitação: informe produto, descrição, quantidade e prazo desejado. Anexe referências se tiver.\nAcompanhe a situação na coluna Situação e abra para ver detalhes, proposta e sinal.",
  "help.requests.new.body":
    "Descreva o que precisa importar. Se o produto já existe no catálogo, selecione-o: o pedido herdará a linha de produto e o checklist de preparação. Caso contrário, informe o nome do produto.",
  "help.requests.new.steps":
    "Quantidade e unidade são obrigatórias; o prazo desejado orienta a cotação.\nEspecificação: material, medidas, cores, embalagem, certificações.\nAnexos: fotos de referência, desenhos, planilhas.\nAo enviar, a Willmix é avisada e abre a RFQ.",
  "help.request.body":
    "Acompanhe a solicitação por status. A Willmix vê e faz tudo; o cliente vê a proposta, o sinal e o andamento, sem ver fornecedores nem custos internos.",
  "help.request.steps":
    "Solicitado: a Willmix seleciona os fornecedores e abre a RFQ.\nRFQ aberta: os fornecedores respondem pelo link recebido.\nCotações recebidas: a Willmix compara, escolhe o fornecedor e define valor ao cliente e sinal.\nAguardando sinal: o cliente paga; a Willmix confirma (com comprovante opcional) e o pedido é criado.\nPedido criado: use Ver pedido para acompanhar as etapas.",
  "help.quote.body":
    "Esta é a sua cotação para a solicitação ao lado. Informe o preço por unidade, a moeda, o prazo de produção em dias e as condições (Incoterm, forma de pagamento). Você pode reenviar enquanto a Willmix não decidir.",
  "help.quote.steps":
    "Respondida: aguarde a decisão da Willmix.\nSelecionada: o pedido será criado quando o cliente confirmar o sinal; você receberá o checklist de preparação.\nNão selecionada: nenhuma ação necessária.",
  "help.orders.body":
    "Lista dos pedidos que você pode ver. A coluna Etapa mostra onde cada um está; Progresso, quanto da etapa atual foi cumprido; Prazo, quando a etapa vence.",
  "help.order.body":
    "O pedido avança por etapas fixas. Cada etapa lista seus requisitos e quem preenche. Preencha o que é seu; quando todos os obrigatórios estão concluídos, a próxima etapa abre automaticamente e o responsável é avisado.",
  "help.order.steps":
    "Linha do tempo: verde concluída, azul em andamento, vermelha bloqueada, cinza ainda não iniciada.\nRequisitos: envie arquivo, número, data ou confirmação. Reenviar um arquivo cria nova versão e mantém a anterior.\nBloqueio: peso divergente ou arte reprovada exige correção ou revisão antes de seguir.\nDocumentos e pagamentos ficam na coluna da direita, filtrados pelo seu papel.",
  "help.stage.ORDER_CREATED":
    "Willmix confere o pedido e libera ao fornecedor. O número do Sankhya pode ser informado agora ou depois (integração em modo manual).",
  "help.stage.PREPARATION":
    "Fornecedor cumpre o checklist da linha de produto: dieline, foto profissional, peso, foto na balança e etiqueta. O peso declarado aqui será comparado na inspeção.",
  "help.stage.SUPPLIER_PAYMENT":
    "Willmix registra o pagamento (valor, moeda, câmbio, comprovante); o fornecedor confirma o recebimento. Os dois passos são obrigatórios.",
  "help.stage.PACKAGING":
    "Fornecedor envia a arte da embalagem; a agência aprova ou reprova com observação. Reprovada, a arte volta ao fornecedor para reenvio.",
  "help.stage.INSPECTION":
    "Fornecedor envia foto sem embalagem, com embalagem, na balança e o peso medido. Divergência acima da tolerância bloqueia a etapa até a Willmix revisar.",
  "help.stage.SHIPPING":
    "Companhia marítima (ou a Willmix, se não houver uma designada) informa data de embarque, previsão de chegada, navio e o BL.",
  "help.stage.CUSTOMS":
    "Despachante registra o número do processo, documentos aduaneiros, custos previstos e realizados e a liberação.",
  "help.stage.TRANSPORT":
    "Transportador informa a placa, a previsão de entrega, a situação e confirma a entrega.",
  "help.stage.DELIVERED":
    "Cliente confirma o recebimento (a Willmix pode confirmar por ele). Com a confirmação o pedido é encerrado.",
  "help.stage.CLOSED": "Pedido encerrado. Nada mais a fazer.",
  "help.account.body":
    "Conta corrente do fornecedor: valor FOB de cada pedido, pagamentos registrados pela Willmix, câmbio e saldo. O fornecedor confirma cada recebimento; isso também conclui o requisito da etapa de pagamento.",
  "help.penalties.body":
    "Multas registradas pela Willmix por atraso, avaria ou descumprimento, com responsável, valor e evidência. O jurídico acompanha e altera a situação: contestada, paga ou cancelada.",
  "help.parties.body":
    "Parceiros são as empresas do fluxo: clientes, fornecedores, agências, despachantes, companhias marítimas e transportadores. Cada parceiro tem usuários que entram no portal com o papel correspondente.",
  "help.parties.steps":
    "Novo parceiro: tipo, nome, país e contatos.\nAbra um parceiro para criar os usuários dele (e-mail, senha inicial, idioma).\nImportar CSV: cadastro em lote com cabeçalho type,name,country,email,phone,taxId.",
  "help.party.body":
    "Edite os dados do parceiro e crie os usuários que acessam o portal por ele. Fornecedores chineses podem usar o idioma chinês; a senha inicial deve ser trocada pelo usuário.",
  "help.products.body":
    "Produtos pertencem a uma linha. Quando o cliente escolhe um produto na solicitação, o pedido herda o checklist de preparação da linha.",
  "help.lines.body":
    "Linha de produto define o manual e o checklist que o fornecedor cumpre na preparação. Formato de cada requisito: chave | rótulo | tipo (file, photo, text, number, date, confirm) | obrigatório (1/0).",
  "help.import.body":
    "Importe cadastros em lote por CSV com cabeçalho. Separador vírgula ou ponto e vírgula. Linhas inválidas são ignoradas e contadas.",
  "help.settings.body":
    "Decisões de negócio parametrizadas: quem cria solicitação, quem confirma entrega, validação da agência, tolerância de peso, percentual do sinal, validade da RFQ, prazos por etapa e lembretes. Mudanças valem para pedidos novos.",
  "help.notifications.body":
    "Avisos gerados pelo portal quando algo depende de você ou mudou em um pedido seu. E-mail e WhatsApp ainda estão em modo simulado; a lista aqui é a fonte confiável.",
};

export type HelpKey = keyof typeof helpPt;

export const helpEn: Record<HelpKey, string> = {
  "help.how": "How it works",
  "help.todo": "What to do here",
  "help.flow.title": "The import flow",
  "help.flow.steps":
    "Request: the customer (or Willmix on their behalf) describes product, quantity and deadline.\nRFQ: Willmix picks suppliers; each gets a link and answers price, lead time and terms.\nSelection: Willmix compares quotations, picks the supplier and sets the customer price and down payment.\nDown payment: the customer pays; Willmix confirms and the order is created with all stages and requirements.\nPreparation: the supplier completes the product line checklist (dieline, photos, weight, label).\nSupplier payment: Willmix registers it; the supplier confirms receipt.\nArtwork and packaging: the supplier sends the artwork; the agency approves or rejects.\nInspection: photos and measured weight; divergence above tolerance blocks until Willmix reviews.\nShipping: the shipping line informs date, ETA and BL.\nCustoms: the broker registers process, documents, costs and release.\nTransport: the carrier informs plate, ETA and delivery.\nDelivery: the customer confirms receipt and the order is closed.",
  "help.rule":
    "Every stage has requirements with an owner. When all mandatory ones are done, the stage closes by itself, the next one opens and the next owner is notified. Nobody has to chase anybody.",
  "help.login.body":
    "The Willmix Portal organizes the import from the customer's request to delivery. Each participant (customer, Willmix, supplier, agency, customs broker, shipping line, carrier, legal) signs in with their own account and sees only what concerns them.",
  "help.login.roles":
    "Customer: creates requests, sees the proposal, pays the down payment, follows the timeline and confirms receipt.\nWillmix (admin and operator): opens RFQs, compares quotations, picks suppliers, confirms payments, assigns partners and follows everything on the Control Tower.\nSupplier: answers quotations, completes checklists, sends photos and weight, confirms payments and sees the account statement.\nAgency: approves the packaging artwork.\nCustoms broker, shipping line and carrier: each registers their own stage.\nLegal: follows penalties.",
  "help.login.demo": "Demo accounts",
  "help.login.demoHint":
    "Tap an account to fill the form. Password for all: {password}.",
  "help.tasks.body":
    "This list shows everything that depends on you right now: requirements of active stages, quotations to answer, pending selections and confirmations. Overdue items come first.",
  "help.tasks.steps":
    "Tap Open to go straight to the order or request.\nFill the requirement (file, number, date or confirmation). The stage advances by itself once complete.\nAn empty list means nothing is pending for your role.",
  "help.ct.body":
    "The Control Tower answers: how many orders are active, where each one is stuck, who needs to act, which are overdue and which have issues. Tap a card to filter the list; tap the order number to open details.",
  "help.ct.cards":
    "Active orders: everything not yet closed.\nOpen requests: orders not born yet (RFQ, quotation, down payment).\nWaiting for supplier / customer: the next action is theirs.\nOverdue: active stage past its due date. A reminder goes to the owner every day.\nWith issues: blocked stage (weight divergence), rejected document, ERP pending or open penalty.\nExceptions: the list on the right details each issue with a shortcut to the order.",
  "help.requests.body":
    "A request is the customer's quotation request. It goes through RFQ, quotations, supplier selection and down payment; once the down payment is confirmed it becomes an order with stages.",
  "help.requests.steps":
    "New request: product, description, quantity and desired deadline. Attach references if you have them.\nFollow the status column and open a request to see details, proposal and down payment.",
  "help.requests.new.body":
    "Describe what you need to import. If the product already exists in the catalog, select it: the order will inherit the product line and its preparation checklist. Otherwise, type the product name.",
  "help.requests.new.steps":
    "Quantity and unit are mandatory; the desired deadline guides the quotation.\nSpecification: material, dimensions, colors, packaging, certifications.\nAttachments: reference photos, drawings, spreadsheets.\nOn submit, Willmix is notified and opens the RFQ.",
  "help.request.body":
    "Follow the request by status. Willmix sees and does everything; the customer sees the proposal, the down payment and progress, without suppliers or internal costs.",
  "help.request.steps":
    "Requested: Willmix selects suppliers and opens the RFQ.\nRFQ open: suppliers answer through the link they received.\nQuotations received: Willmix compares, picks the supplier and sets customer price and down payment.\nWaiting for down payment: the customer pays; Willmix confirms (optional proof) and the order is created.\nOrder created: use View order to follow the stages.",
  "help.quote.body":
    "This is your quotation for the request on the left. Enter unit price, currency, production lead time in days and terms (Incoterm, payment). You may resubmit until Willmix decides.",
  "help.quote.steps":
    "Answered: wait for Willmix's decision.\nSelected: the order is created when the customer confirms the down payment; you will receive the preparation checklist.\nNot selected: no action needed.",
  "help.orders.body":
    "Orders you can see. The Stage column shows where each one is; Progress, how much of the current stage is done; Due, when the stage expires.",
  "help.order.body":
    "The order moves through fixed stages. Each stage lists its requirements and who fills them. Fill what is yours; when all mandatory items are done, the next stage opens automatically and its owner is notified.",
  "help.order.steps":
    "Timeline: green done, blue in progress, red blocked, grey not started.\nRequirements: send a file, number, date or confirmation. Re-sending a file creates a new version and keeps the previous one.\nBlock: weight divergence or rejected artwork requires a fix or a review before moving on.\nDocuments and payments are on the right column, filtered by your role.",
  "help.stage.ORDER_CREATED":
    "Willmix checks the order and releases it to the supplier. The Sankhya number can be entered now or later (integration in manual mode).",
  "help.stage.PREPARATION":
    "Supplier completes the product line checklist: dieline, professional photo, weight, photo on the scale and label. The weight declared here is compared at inspection.",
  "help.stage.SUPPLIER_PAYMENT":
    "Willmix registers the payment (amount, currency, FX rate, proof); the supplier confirms receipt. Both steps are mandatory.",
  "help.stage.PACKAGING":
    "Supplier sends the packaging artwork; the agency approves or rejects with a note. If rejected, the artwork goes back to the supplier.",
  "help.stage.INSPECTION":
    "Supplier sends photos without packaging, with packaging, on the scale and the measured weight. Divergence above tolerance blocks the stage until Willmix reviews.",
  "help.stage.SHIPPING":
    "Shipping line (or Willmix if none is assigned) informs shipping date, ETA, vessel and the BL.",
  "help.stage.CUSTOMS":
    "Customs broker registers the process number, customs documents, estimated and actual costs and the release.",
  "help.stage.TRANSPORT":
    "Carrier informs the plate, delivery ETA, status and confirms delivery.",
  "help.stage.DELIVERED":
    "Customer confirms receipt (Willmix may confirm on their behalf). The order is then closed.",
  "help.stage.CLOSED": "Order closed. Nothing left to do.",
  "help.account.body":
    "Supplier account statement: FOB value per order, payments registered by Willmix, FX rate and balance. The supplier confirms each receipt; that also completes the payment stage requirement.",
  "help.penalties.body":
    "Penalties registered by Willmix for delays, damage or non-compliance, with responsible party, amount and evidence. Legal follows and updates the status: disputed, paid or cancelled.",
  "help.parties.body":
    "Partners are the companies in the flow: customers, suppliers, agencies, customs brokers, shipping lines and carriers. Each partner has users who sign in with the matching role.",
  "help.parties.steps":
    "New partner: type, name, country and contacts.\nOpen a partner to create its users (email, initial password, language).\nImport CSV: bulk registration with header type,name,country,email,phone,taxId.",
  "help.party.body":
    "Edit the partner data and create the users who access the portal for it. Chinese suppliers may use Chinese; the initial password should be changed by the user.",
  "help.products.body":
    "Products belong to a line. When the customer picks a product in the request, the order inherits the line's preparation checklist.",
  "help.lines.body":
    "A product line defines the manual and the checklist the supplier completes during preparation. Requirement format: key | label | type (file, photo, text, number, date, confirm) | mandatory (1/0).",
  "help.import.body":
    "Bulk import from CSV with header. Comma or semicolon separator. Invalid rows are skipped and counted.",
  "help.settings.body":
    "Parameterized business decisions: who creates requests, who confirms delivery, agency validation, weight tolerance, down payment percentage, RFQ validity, stage due days and reminders. Changes apply to new orders.",
  "help.notifications.body":
    "Notices generated by the portal when something depends on you or changed in one of your orders. Email and WhatsApp are still simulated; this list is the reliable source.",
};

export const helpZh: Record<HelpKey, string> = {
  "help.how": "运作方式",
  "help.todo": "在此需要做什么",
  "help.flow.title": "进口流程",
  "help.flow.steps":
    "需求：客户（或 Willmix 代为）说明产品、数量和期望交期。\n询价：Willmix 选择供应商；每家收到链接并回复价格、交期和条款。\n选定：Willmix 对比报价，选定供应商，确定客户价格和定金。\n定金：客户付款；Willmix 确认后创建订单，生成全部阶段和要求。\n备货准备：供应商完成产品线清单（刀模图、照片、重量、标签）。\n供应商付款：Willmix 登记；供应商确认收款。\n设计与包装：供应商提交设计稿；设计公司审核通过或驳回。\n验货：照片和实测重量；超出容差会阻塞，直到 Willmix 复核。\n装运：船公司填写日期、预计到达和提单。\n清关：报关行登记流程、文件、费用和放行。\n运输：承运商填写车牌、预计到达和交付。\n交付：客户确认收货，订单结案。",
  "help.rule":
    "每个阶段都有带负责人的要求。所有必填项完成后，阶段自动关闭，下一阶段开启，并通知下一位负责人。无需任何人催促。",
  "help.login.body":
    "Willmix 门户负责从客户需求到交付的整个进口流程。每位参与方（客户、Willmix、供应商、设计公司、报关行、船公司、承运商、法务）使用各自账号登录，只看到与自己相关的内容。",
  "help.login.roles":
    "客户：创建需求、查看方案、支付定金、跟踪时间线并确认收货。\nWillmix（管理员和操作员）：发起询价、对比报价、选定供应商、确认付款、指定合作方，并在控制塔跟踪一切。\n供应商：回复报价、完成清单、上传照片和重量、确认收款、查看往来账。\n设计公司：审核包装设计稿。\n报关行、船公司和承运商：各自登记自己的阶段。\n法务：跟进罚款。",
  "help.login.demo": "演示账号",
  "help.login.demoHint": "点击账号自动填写表单。所有账号密码：{password}。",
  "help.tasks.body":
    "此列表显示当前需要您处理的全部事项：进行中阶段的要求、待回复的报价、待选定和待确认项。逾期事项排在前面。",
  "help.tasks.steps":
    "点击“打开”直接进入订单或需求单。\n填写要求（文件、数字、日期或确认）。全部完成后阶段自动推进。\n列表为空表示您的角色没有待办。",
  "help.ct.body":
    "控制塔回答：有多少订单进行中、每单卡在哪里、谁需要行动、哪些逾期、哪些有问题。点击卡片筛选列表；点击订单号打开详情。",
  "help.ct.cards":
    "进行中订单：尚未结案的全部订单。\n未结需求：尚未生成订单的需求（询价、报价、定金）。\n等待供应商 / 客户：下一步由他们执行。\n已逾期：进行中阶段已过截止日。系统每天提醒负责人。\n有问题：阶段被阻塞（重量差异）、文件被驳回、ERP 待处理或有未结罚款。\n异常：右侧列表逐项说明并提供订单快捷入口。",
  "help.requests.body":
    "需求单是客户的询价请求。它经过询价、报价、选定供应商和定金；定金确认后转为带阶段的订单。",
  "help.requests.steps":
    "新建需求：填写产品、描述、数量和期望交期，可附上参考资料。\n在“状态”列跟踪进度，打开需求单查看详情、方案和定金。",
  "help.requests.new.body":
    "描述您要进口的产品。如果产品已在目录中，请选择它：订单将继承产品线及其备货清单。否则请填写产品名称。",
  "help.requests.new.steps":
    "数量和单位为必填；期望交期用于指导报价。\n规格：材质、尺寸、颜色、包装、认证。\n附件：参考照片、图纸、表格。\n提交后 Willmix 会收到通知并发起询价。",
  "help.request.body":
    "按状态跟踪需求单。Willmix 可查看并执行全部操作；客户可看到方案、定金和进度，但看不到供应商和内部成本。",
  "help.request.steps":
    "已提交：Willmix 选择供应商并发起询价。\n询价中：供应商通过收到的链接回复。\n已收到报价：Willmix 对比后选定供应商，确定客户价格和定金。\n等待定金：客户付款；Willmix 确认（可附凭证）后创建订单。\n已创建订单：点击“查看订单”跟踪各阶段。",
  "help.quote.body":
    "这是您对左侧需求的报价。请填写单价、币种、生产交期（天）和条款（贸易术语、付款方式）。在 Willmix 做出决定前可重新提交。",
  "help.quote.steps":
    "已回复：等待 Willmix 决定。\n已选定：客户确认定金后创建订单，您将收到备货清单。\n未选定：无需操作。",
  "help.orders.body":
    "您可查看的订单。“阶段”列显示每单所处位置；“进度”显示当前阶段完成度；“截止”显示阶段到期日。",
  "help.order.body":
    "订单按固定阶段推进。每个阶段列出其要求和填写人。填写属于您的项目；所有必填项完成后，下一阶段自动开启并通知负责人。",
  "help.order.steps":
    "时间线：绿色已完成，蓝色进行中，红色已阻塞，灰色未开始。\n要求：提交文件、数字、日期或确认。重新上传文件会生成新版本并保留旧版本。\n阻塞：重量差异或设计稿被驳回需先修正或复核。\n文件和付款位于右侧栏，按您的角色过滤。",
  "help.stage.ORDER_CREATED":
    "Willmix 核对订单并下达供应商。Sankhya 编号可现在或稍后填写（集成为手动模式）。",
  "help.stage.PREPARATION":
    "供应商完成产品线清单：刀模图、专业照片、重量、称重照片和标签。此处申报的重量将在验货时比对。",
  "help.stage.SUPPLIER_PAYMENT":
    "Willmix 登记付款（金额、币种、汇率、凭证）；供应商确认收款。两步均为必填。",
  "help.stage.PACKAGING":
    "供应商提交包装设计稿；设计公司审核通过或附备注驳回。被驳回后设计稿退回供应商重新提交。",
  "help.stage.INSPECTION":
    "供应商提交无包装照片、带包装照片、称重照片和实测重量。超出容差将阻塞阶段，直到 Willmix 复核。",
  "help.stage.SHIPPING":
    "船公司（未指定时由 Willmix）填写装运日期、预计到达、船名和提单。",
  "help.stage.CUSTOMS":
    "报关行登记流程编号、清关文件、预计和实际费用以及放行。",
  "help.stage.TRANSPORT": "承运商填写车牌、预计送达、状态并确认送达。",
  "help.stage.DELIVERED":
    "客户确认收货（Willmix 可代为确认）。确认后订单结案。",
  "help.stage.CLOSED": "订单已结案，无需操作。",
  "help.account.body":
    "供应商往来账：每单 FOB 金额、Willmix 登记的付款、汇率和余额。供应商确认每笔收款，同时完成付款阶段的要求。",
  "help.penalties.body":
    "Willmix 因延误、损坏或违约登记的罚款，含责任方、金额和证据。法务跟进并更新状态：争议中、已支付或已取消。",
  "help.parties.body":
    "合作伙伴是流程中的企业：客户、供应商、设计公司、报关行、船公司和承运商。每家合作伙伴拥有以对应角色登录的用户。",
  "help.parties.steps":
    "新建合作伙伴：类型、名称、国家和联系方式。\n打开合作伙伴以创建其用户（邮箱、初始密码、语言）。\n导入 CSV：使用表头 type,name,country,email,phone,taxId 批量登记。",
  "help.party.body":
    "编辑合作伙伴信息并创建通过它访问门户的用户。中国供应商可使用中文；初始密码应由用户自行修改。",
  "help.products.body":
    "产品属于产品线。客户在需求中选择产品后，订单继承该产品线的备货清单。",
  "help.lines.body":
    "产品线定义手册和供应商在备货阶段需完成的清单。每项要求格式：键 | 标签 | 类型（file, photo, text, number, date, confirm）| 必填（1/0）。",
  "help.import.body":
    "通过带表头的 CSV 批量导入。分隔符为逗号或分号。无效行会被跳过并计数。",
  "help.settings.body":
    "参数化的业务决策：谁可创建需求、谁确认交付、设计公司审核、重量容差、定金比例、询价有效期、各阶段期限和提醒。更改适用于新订单。",
  "help.notifications.body":
    "当有事项需要您处理或您的订单发生变化时，门户生成的通知。邮件和 WhatsApp 仍为模拟模式；此列表是可靠来源。",
};
