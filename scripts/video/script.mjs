/*
 * Roteiro dos dois vídeos institucionais do portal (docs/videos/institucional).
 *
 * Cada cena tem as falas da narração (`say`): `en` é o que a voz diz; `pt` e
 * `zh` são as legendas. Nas legendas, "|" quebra a linha e "||" abre outra
 * legenda dentro da mesma fala (o tempo é dividido pelo tamanho do texto).
 * Limites de docs/videos/GUIA.md: pt até 42 caracteres por linha, zh até 16,
 * duas linhas por legenda (build.mjs confere).
 *
 * `props` é o que a cena desenha (film/scenes.js). Nos textos da tela, *assim*
 * sai em vermelho. `c` é a fala em que o elemento aparece.
 *
 * Só afirma o que o portal faz hoje (docs/videos/institucional/README.md,
 * "O que os vídeos não prometem").
 */

const ROLES = [
  { icon: "store", label: "Customer" },
  { icon: "factory", label: "Supplier" },
  { icon: "pen-tool", label: "Art agency" },
  { icon: "badge-check", label: "Certification body" },
  { icon: "camera", label: "Marketing agency" },
  { icon: "container", label: "Freight forwarder" },
  { icon: "ship", label: "Shipping line" },
  { icon: "briefcase", label: "Comex advisory" },
  { icon: "landmark", label: "Customs broker" },
  { icon: "truck", label: "Carrier" },
  { icon: "scale", label: "Legal" },
  { icon: "users", label: "Wellmix team" },
];

const HANDOFFS = [
  { icon: "factory", label: "Supplier" },
  { icon: "pen-tool", label: "Art agency" },
  { icon: "badge-check", label: "Certification" },
  { icon: "ship", label: "Freight" },
  { icon: "landmark", label: "Customs" },
  { icon: "truck", label: "Carrier" },
];

const END = {
  id: "end",
  type: "end",
  noBrand: true,
  // Folgas da cena final: a marca entra junto com o acorde final da música
  // e o vídeo termina com ela (tts/track.py mostra a diferença).
  pre: 0.3,
  post: 1.7,
  props: {
    lines: ["One portal.", "Every partner.", "Every step."],
    tagline: "Imports from order to delivery",
  },
};

export const VIDEOS = {
  /* ─────────────────────────── Vídeo curto ─────────────────────────── */
  short: {
    title: "Wellmix Portal · One portal for the whole import",
    scenes: [
      {
        id: "route",
        type: "route",
        cls: "first",
        pre: 1.0,
        props: {
          kicker: "The challenge",
          title: "One import.\nDozens of *handoffs.*",
          handoffs: HANDOFFS,
          handoffsAt: 2.2,
        },
        say: [
          {
            en: "From a factory abroad to a customer in Brazil, an import takes dozens of handoffs.",
            pt: "Da fábrica no exterior|ao cliente no Brasil,||uma importação passa|por dezenas de mãos.",
            zh: "从海外工厂到巴西客户，||一次进口要经过|几十次交接。",
          },
        ],
      },
      {
        id: "chaos",
        type: "chaos",
        props: {
          title:
            "Different inboxes.\nDifferent spreadsheets.\nDifferent *chats.*",
        },
        say: [
          {
            en: "Suppliers, agencies, freight, customs, carriers.",
            pt: "Fornecedores, agências, frete,|alfândega, transportadoras.",
            zh: "供应商、代理、货运、|清关、运输公司。",
          },
          {
            en: "Each one in a different inbox, spreadsheet and chat.",
            pt: "Cada um em um e-mail, uma planilha|e uma conversa diferente.",
            zh: "各自用不同的邮箱、|表格和聊天群。",
          },
        ],
      },
      {
        id: "hub",
        type: "hub",
        noBrand: true,
        props: { title: "One portal. *One workflow.*", roles: ROLES },
        say: [
          {
            en: "The Wellmix Portal brings them all into one workflow.",
            pt: "O Portal Wellmix reúne todos|em um único fluxo.",
            zh: "Wellmix 门户把所有人|汇聚到同一条流程中。",
          },
        ],
      },
      {
        id: "steps",
        type: "focus",
        props: {
          kicker: "Every step",
          title: "An owner.\nA deadline.\nA *status.*",
          shots: [{ shot: "order-progress", ox: "50%", oy: "22%", zoom: 1.16 }],
          chips: [
            { icon: "user-cog", label: "Owner", c: 0, d: 1.0 },
            { icon: "clock", label: "Deadline", c: 0, d: 1.5 },
            { icon: "list-checks", label: "Status", c: 0, d: 2.0 },
          ],
        },
        say: [
          {
            en: "Every step has an owner, a deadline and a status.",
            pt: "Cada etapa tem um responsável,|um prazo e uma situação.",
            zh: "每一步都有负责人、|期限和状态。",
          },
        ],
      },
      {
        id: "comms",
        type: "comms",
        props: {
          kicker: "One conversation",
          title: "Everything stays\n*with the order.*",
          shot: "order",
          bubbles: [
            {
              who: "Customer",
              icon: "store",
              text: "Can we add 500 units to this order?",
              side: "l",
            },
            {
              who: "Supplier",
              icon: "factory",
              text: "样品视频已上传，请查看。",
              side: "r",
            },
            {
              who: "Wellmix",
              icon: "users",
              text: "Artwork approved. Contract ready to sign.",
              side: "l",
            },
          ],
        },
        say: [
          {
            en: "Every message, photo and document stays with the order.",
            pt: "Cada mensagem, foto e documento|fica junto do pedido.",
            zh: "每条消息、每张照片、|每份文件都跟着订单走。",
          },
        ],
      },
      {
        id: "langs",
        type: "trio",
        props: {
          kicker: "Every partner",
          title: "Its own view.\n*Its own language.*",
          shot: "supplier",
        },
        say: [
          {
            en: "Each partner sees only its own part, in Portuguese, English or Chinese.",
            pt: "Cada parceiro vê só a sua parte,|em português, inglês ou chinês.",
            zh: "每个伙伴只看到自己的部分，||支持葡语、英语和中文。",
          },
        ],
      },
      {
        id: "evidence",
        type: "focus",
        cls: "flip",
        props: {
          kicker: "Quality",
          title: "Checked *before*\nthe cargo moves",
          shots: [{ shot: "shipping-docs", ox: "55%", oy: "30%", zoom: 1.14 }],
          chips: [
            { icon: "search-check", label: "Inspection", c: 0, d: 0.4 },
            { icon: "package-check", label: "Samples", c: 0, d: 1.2 },
            { icon: "file-check", label: "Shipping documents", c: 0, d: 2.0 },
          ],
        },
        say: [
          {
            en: "Inspections, samples and shipping documents are checked before the cargo moves.",
            pt: "Inspeções, amostras e documentos de carga|são conferidos antes do embarque.",
            zh: "验货、样品和出运单据，|在发货前逐一核对。",
          },
        ],
      },
      {
        id: "tower",
        type: "focus",
        props: {
          kicker: "Control Tower",
          title: "What is late.\nWhat is next.\n*Who is responsible.*",
          shots: [{ shot: "tower", ox: "62%", oy: "34%", zoom: 1.12 }],
        },
        say: [
          {
            en: "And management sees what is late, what is next and who is responsible.",
            pt: "E a gestão vê o que está atrasado,|o que vem a seguir e quem é o responsável.",
            zh: "管理层一眼看清：||哪些逾期、接下来做什么、|由谁负责。",
          },
        ],
      },
      {
        ...END,
        pre: 0.6,
        post: 3.9,
        props: {
          lines: [],
          tagline: "Imports from order to delivery",
          sub: "One portal · Every partner · Every step",
        },
        say: [
          {
            en: "Wellmix. Imports from order to delivery, in one place.",
            pt: "Wellmix. Importação do pedido à entrega,|em um só lugar.",
            zh: "Wellmix：从下单到交付，|进口全程尽在一处。",
          },
        ],
      },
    ],
  },

  /* ────────────────────────── Vídeo completo ────────────────────────── */
  full: {
    title: "Wellmix Portal · What each role can do",
    scenes: [
      {
        id: "route",
        type: "route",
        cls: "first",
        pre: 1.0,
        props: {
          kicker: "The challenge",
          title: "One import.\nDozens of *handoffs.*",
          handoffs: HANDOFFS,
          handoffsC: 1,
        },
        say: [
          {
            en: "Bringing a product from a factory abroad to a customer in Brazil is a long relay.",
            pt: "Trazer um produto da fábrica no exterior|até o cliente no Brasil||é um longo revezamento.",
            zh: "把产品从海外工厂|送到巴西客户手中，||是一场漫长的接力。",
          },
          {
            en: "Suppliers, agencies, certifiers, freight, customs, carriers.",
            pt: "Fornecedores, agências, certificadoras,|frete, alfândega, transportadoras.",
            zh: "供应商、代理、认证机构、|货运、清关、运输公司。",
          },
        ],
      },
      {
        id: "chaos",
        type: "chaos",
        props: {
          title:
            "Different inboxes.\nDifferent spreadsheets.\nDifferent *chats.*",
        },
        say: [
          {
            en: "Each one with its own e-mails, spreadsheets and chat groups.",
            pt: "Cada um com seus e-mails,|planilhas e grupos de conversa.",
            zh: "各有各的邮件、|表格和聊天群。",
          },
          {
            en: "And nobody sees the whole picture.",
            pt: "E ninguém enxerga o todo.",
            zh: "没有人能看到全貌。",
          },
        ],
      },
      {
        id: "hub",
        type: "hub",
        noBrand: true,
        props: {
          title: "One portal. *One workflow.*",
          roles: ROLES,
          note: "13 login roles · each one sees only its own part",
          noteC: 2,
        },
        say: [
          {
            en: "The Wellmix Portal puts the entire operation in one place.",
            pt: "O Portal Wellmix coloca|toda a operação em um só lugar.",
            zh: "Wellmix 门户把整个业务|集中在一个地方。",
          },
          {
            en: "One workflow, shared by Wellmix, its suppliers, its service partners and its customers.",
            pt: "Um só fluxo, compartilhado pela Wellmix,|seus fornecedores, parceiros e clientes.",
            zh: "一条流程，|由 Wellmix、供应商、||服务伙伴和客户共用。",
          },
          {
            en: "Each login sees only its own part.",
            pt: "Cada login vê apenas a sua parte.",
            zh: "每个账号只看到|自己的部分。",
          },
        ],
      },
      {
        id: "journey",
        type: "journey",
        chapter: "The journey",
        props: {
          title: "From the first book to the *final delivery*",
          blocks: [
            {
              icon: "file-spreadsheet",
              name: "Book",
              steps: [
                "Supplier price books",
                "Item selection",
                "Negotiation",
                "Samples",
              ],
            },
            {
              icon: "file-signature",
              name: "Order",
              steps: [
                "Purchase order",
                "Artwork",
                "Certification",
                "Signed contract",
              ],
            },
            {
              icon: "factory",
              name: "Production",
              steps: [
                "Follow-ups",
                "Inspection",
                "Loading",
                "Shipping documents",
              ],
            },
            {
              icon: "truck",
              name: "Delivery",
              steps: ["Customs", "Transport", "Receiving"],
            },
            {
              icon: "tag",
              name: "Sales",
              steps: ["Offers", "Sales orders", "Delivery schedule"],
            },
          ],
          footer: [
            { icon: "user-cog", label: "An owner" },
            { icon: "clock", label: "A deadline" },
            { icon: "list-checks", label: "A status" },
          ],
          footerC: 6,
        },
        say: [
          {
            en: "The portal follows the import from start to finish, in five blocks.",
            pt: "O portal acompanha a importação|do início ao fim, em cinco blocos.",
            zh: "门户分五个板块，|全程跟进进口流程。",
          },
          {
            en: "Book: supplier price books, item selection, negotiation and samples.",
            pt: "Book: planilhas dos fornecedores,|seleção de itens, negociação e amostras.",
            zh: "Book：供应商报价表、|选品、谈判和样品。",
          },
          {
            en: "Order: the purchase order, artwork, certification and the signed contract.",
            pt: "Pedido: pedido de compra, arte,|certificação e contrato assinado.",
            zh: "订单：采购订单、包装设计、|认证和合同签署。",
          },
          {
            en: "Production: follow-ups, inspection, loading and shipping documents.",
            pt: "Produção: acompanhamento, inspeção,|carregamento e documentos de carga.",
            zh: "生产：跟进、验货、|装柜和出运单据。",
          },
          {
            en: "Delivery: customs, transport and receiving.",
            pt: "Entrega: desembaraço,|transporte e recebimento.",
            zh: "交付：清关、运输和收货。",
          },
          {
            en: "And Sales: offers, sales orders and the delivery schedule.",
            pt: "E Vendas: ofertas, ordens de venda|e agenda de entregas.",
            zh: "销售：报价、销售订单|和送货日程。",
          },
          {
            en: "Every step has an owner, a deadline and a status.",
            pt: "Cada etapa tem um responsável,|um prazo e uma situação.",
            zh: "每一步都有负责人、|期限和状态。",
          },
        ],
      },
      {
        id: "customer",
        type: "role",
        chapter: "Who does what",
        props: {
          role: "Customer",
          icon: "store",
          title: "Order status without a single call",
          shot: "customer",
          oy: "18%",
          bullets: [
            { t: "<b>Places orders</b> and follows every stage", c: 0, d: 1.4 },
            { t: "<b>Payment plan</b>, instalments and bank slips", c: 1 },
            { t: "<b>Confirms receipt</b> and rates the purchase", c: 2 },
          ],
        },
        say: [
          {
            en: "The customer places an order and follows every stage without picking up the phone.",
            pt: "O cliente faz o pedido e acompanha|cada etapa sem pegar o telefone.",
            zh: "客户下单后，无需打电话|即可跟进每个阶段。",
          },
          {
            en: "The payment plan, instalments and bank slips are on the same screen.",
            pt: "Forma de pagamento, parcelas|e boletos ficam na mesma tela.",
            zh: "付款方式、分期和银行付款单|都在同一页面。",
          },
          {
            en: "On arrival, they confirm receipt and rate the purchase.",
            pt: "Na chegada, confirma o recebimento|e avalia a compra.",
            zh: "到货后确认收货，|并为本次采购评分。",
          },
        ],
      },
      {
        id: "supplier",
        type: "role",
        cls: "flip",
        props: {
          role: "Supplier",
          icon: "factory",
          title: "One task list, in Chinese or English",
          shot: "supplier",
          oy: "16%",
          bullets: [
            {
              t: "Answers with <b>price, minimum order and lead time</b>",
              c: 1,
            },
            {
              t: "<b>Sample photos and videos</b>, production dates, inspection",
              c: 2,
            },
            { t: "<b>Payment forecast</b> for every order", c: 3 },
          ],
        },
        say: [
          {
            en: "The supplier works from a single task list, in Chinese or English.",
            pt: "O fornecedor trabalha com uma lista única|de tarefas, em chinês ou inglês.",
            zh: "供应商只需一份待办清单，|中文或英文均可。",
          },
          {
            en: "They answer requests with price, minimum order and lead time.",
            pt: "Responde às solicitações com preço,|pedido mínimo e prazo.",
            zh: "回复询价：价格、|起订量和交期。",
          },
          {
            en: "They upload sample photos and videos, production dates and inspection evidence.",
            pt: "Envia fotos e vídeos das amostras,|datas de produção e dados da inspeção.",
            zh: "上传样品照片和视频、|生产日期和验货资料。",
          },
          {
            en: "And they see the payment forecast for every order.",
            pt: "E consulta a previsão de pagamento|de cada pedido.",
            zh: "还能查看|每笔订单的付款预计。",
          },
        ],
      },
      {
        id: "agency",
        type: "role",
        props: {
          role: "Art agency",
          icon: "pen-tool",
          title: "Briefing, files and feedback in one desk",
          shot: "agency",
          oy: "30%",
          bullets: [
            {
              t: "Receives the <b>die cut and product photos</b>",
              c: 0,
              d: 1.6,
            },
            {
              t: "Uploads the artwork, gets <b>feedback with a reason</b>",
              c: 1,
            },
            { t: "Delivers the <b>final art with the seal</b>", c: 2 },
          ],
        },
        say: [
          {
            en: "The art agency receives the die cut and the product photos in its workdesk.",
            pt: "A agência de arte recebe a faca e as fotos|do produto na sua mesa de trabalho.",
            zh: "设计公司在工作台收到|刀模和产品照片。",
          },
          {
            en: "It uploads the artwork and gets feedback with a clear reason.",
            pt: "Envia a arte e recebe|o retorno com o motivo.",
            zh: "上传设计稿，|并收到附带原因的反馈。",
          },
          {
            en: "Then it delivers the final art with the certification seal.",
            pt: "Depois entrega a arte final|com o selo de certificação.",
            zh: "最后交付带认证标志的终稿。",
          },
        ],
      },
      {
        id: "ocp",
        type: "role",
        cls: "flip",
        props: {
          role: "Certification body",
          icon: "badge-check",
          title: "One queue of certificates to issue",
          shot: "ocp",
          oy: "14%",
          bullets: [
            {
              t: "Reads the <b>purchase sheet</b> and the product photos",
              c: 1,
            },
            {
              t: "Uploads the <b>technical description, seal and certificate</b>",
              c: 1,
              d: 2.2,
            },
          ],
        },
        say: [
          {
            en: "The certification body has one queue of certificates to issue.",
            pt: "A certificadora tem uma fila única|de certificados a emitir.",
            zh: "认证机构有一个|待签发证书的队列。",
          },
          {
            en: "It reads the purchase sheet and uploads the technical description, the seal and the certificate.",
            pt: "Consulta a ficha de compra e envia|o memorial, o selo e o certificado.",
            zh: "查看采购单，||上传技术说明书、|认证标志和证书。",
          },
        ],
      },
      {
        id: "marketing",
        type: "role",
        props: {
          role: "Marketing agency · at origin",
          icon: "camera",
          title: "Real photos before the cargo ships",
          shot: "marketing",
          oy: "40%",
          bullets: [
            { t: "Confirms the <b>sample has arrived</b>", c: 0, d: 1.2 },
            { t: "Uploads <b>real photos and videos</b> per product", c: 1 },
            {
              t: "<b>Returns the sample</b> to ship with the order",
              c: 1,
              d: 2.6,
            },
          ],
        },
        say: [
          {
            en: "At origin, the marketing agency confirms that the sample has arrived.",
            pt: "Na origem, a agência de marketing|confirma a chegada da amostra.",
            zh: "在原产地，营销代理|确认样品已送达。",
          },
          {
            en: "It uploads real photos and videos of each product, and returns the sample.",
            pt: "Envia fotos e vídeos reais de cada produto|e devolve a amostra.",
            zh: "上传每个产品的|实拍照片和视频，||然后归还样品。",
          },
        ],
      },
      {
        id: "freight",
        type: "duo",
        props: {
          items: [
            {
              role: "Freight forwarder",
              icon: "container",
              title: "Ocean booking and container at origin",
              shot: "forwarder",
              oy: "40%",
              c: 0,
            },
            {
              role: "Shipping line",
              icon: "ship",
              title: "Freight quotes, bill of lading, shipment",
              shot: "line",
              oy: "10%",
              c: 1,
            },
          ],
        },
        say: [
          {
            en: "The freight forwarder registers the ocean booking and follows the container at origin.",
            pt: "O agente de carga registra|a reserva no navio||e acompanha o container na origem.",
            zh: "货运代理登记订舱，|并跟进起运地的货柜。",
          },
          {
            en: "The shipping line answers freight requests, issues the bill of lading and confirms the shipment.",
            pt: "A companhia marítima responde|às cotações de frete,||emite o BL e confirma o embarque.",
            zh: "船公司回复运费询价，||签发提单并确认出运。",
          },
        ],
      },
      {
        id: "customs",
        type: "duo",
        props: {
          items: [
            {
              role: "Comex advisory",
              icon: "briefcase",
              title: "Licences, funds and import declaration",
              shot: "comex",
              oy: "40%",
              c: 0,
            },
            {
              role: "Customs broker",
              icon: "landmark",
              title: "Tax classification and clearance",
              shot: "broker",
              oy: "14%",
              c: 0,
              d: 1.6,
            },
          ],
          note: "Every step shows who does it and who validates it",
          noteC: 1,
        },
        say: [
          {
            en: "In Brazil, the foreign trade advisory and the customs broker handle licences, documents and clearance.",
            pt: "No Brasil, a assessoria de comex|e o despachante||cuidam de licenças,|documentos e desembaraço.",
            zh: "在巴西，外贸代理和报关行||负责许可、单据和清关。",
          },
          {
            en: "Every step shows who does it and who validates it.",
            pt: "Cada passo mostra quem faz|e quem valida.",
            zh: "每一步都显示|谁执行、谁审核。",
          },
        ],
      },
      {
        id: "carrier",
        type: "role",
        cls: "flip",
        props: {
          role: "Carrier",
          icon: "truck",
          title: "From the port to the customer's door",
          shot: "carrier",
          oy: "22%",
          phone: "m-carrier",
          bullets: [
            {
              t: "<b>Cargo and delivery address</b> on one card",
              c: 0,
              d: 1.2,
            },
            { t: "Updates the <b>status on the road</b>", c: 1 },
            { t: "<b>Confirms delivery</b> from a phone", c: 1, d: 2.0 },
          ],
        },
        say: [
          {
            en: "The carrier sees the cargo and the delivery address on one card.",
            pt: "O transportador vê a carga|e o endereço de entrega em um só cartão.",
            zh: "运输公司在一张卡片上|看到货物和送货地址。",
          },
          {
            en: "It updates the status on the road and confirms the delivery from a phone.",
            pt: "Atualiza a situação na estrada|e confirma a entrega pelo celular.",
            zh: "在途中更新状态，|并用手机确认送达。",
          },
        ],
      },
      {
        id: "team1",
        type: "team",
        props: {
          kicker: "Inside Wellmix",
          title: "Every function has *its own view*",
          tiles: [
            {
              icon: "shopping-cart",
              name: "Buyer",
              text: "Imports supplier books, selects items, negotiates",
              c: 1,
            },
            {
              icon: "package",
              name: "Product manager",
              text: "Evaluates samples, keeps the product sheet",
              c: 2,
            },
            {
              icon: "calendar-check",
              name: "Planner",
              text: "Production dates, containers and freight",
              c: 3,
            },
            {
              icon: "database",
              name: "Registration",
              text: "Validates tax codes and master data",
              c: 4,
            },
            {
              icon: "palette",
              name: "Designer",
              text: "Artwork and approval of real photos",
              c: 4,
              d: 1.6,
            },
            {
              icon: "scale",
              name: "Legal",
              text: "Penalties and their status",
              c: 4,
              d: 2.0,
            },
          ],
        },
        say: [
          {
            en: "Inside Wellmix, every function has its own screens and tasks.",
            pt: "Dentro da Wellmix, cada função|tem as suas telas e pendências.",
            zh: "在 Wellmix 内部，|每个职能都有自己的页面和待办。",
          },
          {
            en: "Buyers import supplier books, select items and negotiate.",
            pt: "Compradores importam os books,|selecionam itens e negociam.",
            zh: "采购员导入供应商报价表、|选品并谈判。",
          },
          {
            en: "Product managers evaluate samples and keep the product sheet.",
            pt: "Gerentes de produto avaliam amostras|e cuidam da ficha do produto.",
            zh: "产品经理评估样品，|维护产品资料。",
          },
          {
            en: "Planners follow production dates, containers and freight.",
            pt: "Planners acompanham datas de produção,|containers e fretes.",
            zh: "计划员跟进生产日期、|货柜和运费。",
          },
          {
            en: "Registration validates tax codes and master data.",
            pt: "O cadastro valida a classificação fiscal|e a ficha mestre.",
            zh: "建档专员审核|税则归类和主数据。",
          },
        ],
      },
      {
        id: "team2",
        type: "team",
        props: {
          kicker: "Inside Wellmix",
          title: "From finance to *the board*",
          tiles: [
            {
              icon: "wallet",
              name: "Finance",
              text: "Validates import costs, registers the invoice",
              c: 0,
            },
            {
              icon: "clipboard-check",
              name: "Quality",
              text: "Checks every container: seal, photos, count",
              c: 1,
            },
            {
              icon: "tag",
              name: "Sales",
              text: "Offers, sales orders and delivery dates",
              c: 2,
            },
            {
              icon: "handshake",
              name: "Directors",
              text: "Approve the purchase strategy, sign the contract",
              c: 3,
            },
            {
              icon: "key-round",
              name: "Administrator",
              text: "Access, deadlines and settings",
              c: 4,
            },
            {
              icon: "ship",
              name: "Comex · internal",
              text: "Daily container tracking status",
              c: 4,
              d: 1.8,
            },
          ],
        },
        say: [
          {
            en: "Finance validates import costs and registers the invoice.",
            pt: "O financeiro valida custos de importação|e registra a nota fiscal.",
            zh: "财务审核进口费用，|并登记发票。",
          },
          {
            en: "Quality checks every container on arrival: seal, photos and count.",
            pt: "A qualidade confere cada container|na chegada: lacre, fotos e contagem.",
            zh: "质检在到货时检查每个货柜：|铅封、照片和清点。",
          },
          {
            en: "Sales records offers, opens sales orders and schedules deliveries.",
            pt: "Vendas registra ofertas,|abre ordens de venda e agenda as entregas.",
            zh: "销售登记报价、|创建销售订单并安排送货。",
          },
          {
            en: "Directors approve the purchase strategy and sign the contract.",
            pt: "A diretoria aprova a estratégia de compra|e assina o contrato.",
            zh: "总监审批采购策略，|并签署合同。",
          },
          {
            en: "And the administrator controls access, deadlines and settings.",
            pt: "E o administrador controla acessos,|prazos e configurações.",
            zh: "管理员掌管权限、|期限和系统设置。",
          },
        ],
      },
      {
        id: "comms",
        type: "comms",
        chapter: "One conversation",
        props: {
          kicker: "Communication",
          title: "Everything stays\n*inside the portal*",
          shot: "order",
          bubbles: [
            {
              who: "Customer",
              icon: "store",
              text: "Can we add 500 units to this order?",
              side: "l",
              c: 1,
            },
            {
              who: "Supplier",
              icon: "factory",
              text: "样品视频已上传，请查看。",
              side: "r",
              c: 2,
            },
            {
              who: "Wellmix",
              icon: "users",
              text: "Artwork approved. Contract ready to sign.",
              side: "l",
              c: 2,
              d: 1.6,
            },
          ],
          cards: [
            { icon: "bell", label: "Notifications", value: "3 new", c: 3 },
            {
              icon: "inbox",
              label: "My tasks",
              value: "5 waiting",
              c: 3,
              d: 1.4,
            },
            {
              icon: "clock",
              label: "Reply owed by",
              value: "Supplier · 1 business day",
              c: 4,
            },
          ],
        },
        say: [
          {
            en: "All communication lives inside the portal.",
            pt: "Toda a comunicação acontece|dentro do portal.",
            zh: "所有沟通都在门户内进行。",
          },
          {
            en: "Each company has one conversation with Wellmix, organised by order and by item.",
            pt: "Cada empresa tem uma só conversa|com a Wellmix,||organizada por pedido e por item.",
            zh: "每家公司与 Wellmix|只有一个会话，||按订单和产品分类。",
          },
          {
            en: "Photos, videos and files stay attached to the subject they belong to.",
            pt: "Fotos, vídeos e arquivos ficam|junto do assunto a que pertencem.",
            zh: "照片、视频和文件|都归在对应的主题下。",
          },
          {
            en: "A notification bell and a task inbox show each person what is waiting for them.",
            pt: "O sino de notificações e as pendências|mostram a cada pessoa o que a espera.",
            zh: "通知铃和待办清单||告诉每个人|有什么在等他处理。",
          },
          {
            en: "And the portal shows who owes a reply.",
            pt: "E o portal mostra|quem deve a resposta.",
            zh: "门户还会显示该由谁回复。",
          },
        ],
      },
      {
        id: "langs",
        type: "trio",
        chapter: "Built for control",
        props: {
          kicker: "Three languages",
          title: "Português. English. *中文.*",
          shot: "supplier",
        },
        say: [
          {
            en: "The portal speaks Portuguese, English and Chinese.",
            pt: "O portal fala português,|inglês e chinês.",
            zh: "门户支持葡萄牙语、|英语和中文。",
          },
        ],
      },
      {
        id: "access",
        type: "access",
        props: {
          kicker: "Access by role",
          title: "Each partner sees *its own orders.*\nNothing else.",
          views: [
            {
              role: "Customer",
              icon: "store",
              sees: ["Own orders and status", "Payment plan and bank slips"],
              hidden: ["Supplier", "Purchase price", "Margin"],
              c: 1,
            },
            {
              role: "Art agency",
              icon: "pen-tool",
              sees: ["Die cut and product photos", "Artwork feedback"],
              hidden: ["Prices"],
              c: 1,
              d: 0.5,
            },
            {
              role: "Carrier",
              icon: "truck",
              sees: ["Cargo and delivery address", "Delivery to confirm"],
              hidden: ["Prices", "Supplier"],
              c: 1,
              d: 1.0,
            },
          ],
        },
        say: [
          {
            en: "Access is defined by role.",
            pt: "O acesso é definido pelo papel.",
            zh: "权限按角色设定。",
          },
          {
            en: "Each partner sees its own orders, and nothing else.",
            pt: "Cada parceiro vê os seus pedidos,|e nada além disso.",
            zh: "每个合作伙伴|只看到自己的订单。",
          },
          {
            en: "Customers never see the supplier, the purchase price or the margin.",
            pt: "O cliente nunca vê o fornecedor,|o preço de compra nem a margem.",
            zh: "客户永远看不到供应商、|采购价和利润。",
          },
        ],
      },
      {
        id: "evidence",
        type: "focus",
        post: 0.4,
        cls: "flip",
        props: {
          kicker: "Quality",
          title: "Documented at *every stage*",
          shots: [
            {
              shot: "order-inspection",
              ox: "55%",
              oy: "20%",
              zoom: 1.12,
              c: 0,
            },
            { shot: "order-container", ox: "55%", oy: "34%", zoom: 1.12, c: 2 },
            { shot: "shipping-docs", ox: "55%", oy: "30%", zoom: 1.12, c: 3 },
          ],
          chips: [
            {
              icon: "video",
              label: "Inspection · photos, weight, video",
              c: 1,
            },
            {
              icon: "container",
              label: "Loading · photos, seal, container number",
              c: 2,
            },
            {
              icon: "file-check",
              label: "Documents · checked line by line",
              c: 3,
            },
          ],
        },
        say: [
          {
            en: "Quality is documented at every stage.",
            pt: "A qualidade fica documentada|em cada etapa.",
            zh: "每个阶段的质量|都有记录可查。",
          },
          {
            en: "Inspection with photos, weight and video.",
            pt: "Inspeção com fotos, peso e vídeo.",
            zh: "验货：照片、重量和视频。",
          },
          {
            en: "Container loading with photos, seal and container number.",
            pt: "Carregamento do container com fotos,|lacre e número do container.",
            zh: "装柜：照片、铅封和柜号。",
          },
          {
            en: "Packing list, invoice and bill of lading, checked line by line.",
            pt: "Packing list, invoice e BL|conferidos linha a linha.",
            zh: "装箱单、发票和提单，|逐行核对。",
          },
        ],
      },
      {
        id: "control",
        type: "focus",
        post: 0.45,
        props: {
          kicker: "For management",
          title: "The whole process, *by stage*",
          shots: [
            { shot: "tower", ox: "62%", oy: "34%", zoom: 1.12, c: 0 },
            { shot: "sla", ox: "55%", oy: "24%", zoom: 1.1, c: 1 },
            { shot: "audit", ox: "55%", oy: "30%", zoom: 1.1, c: 2 },
          ],
          chips: [
            { icon: "layout-dashboard", label: "Control Tower", c: 0, d: 0.8 },
            {
              icon: "gauge",
              label: "SLA panel · overdue, due today, owner",
              c: 1,
            },
            { icon: "history", label: "Dashboards and audit trail", c: 2 },
          ],
        },
        say: [
          {
            en: "For management, the Control Tower shows the whole process by stage.",
            pt: "Para a gestão, a Control Tower|mostra todo o processo por etapa.",
            zh: "对管理层，控制塔|按阶段展示整个流程。",
          },
          {
            en: "The SLA panel shows what is overdue, what is due today and who is responsible.",
            pt: "O painel de SLA mostra o que atrasou,|o que vence hoje e quem é o responsável.",
            zh: "SLA 面板显示哪些已逾期、||哪些今天到期，|以及谁负责。",
          },
          {
            en: "Dashboards and a full audit trail complete the picture.",
            pt: "Painéis e uma trilha de auditoria|completam o quadro.",
            zh: "再加上看板|和完整的审计记录。",
          },
        ],
      },
      {
        id: "devices",
        type: "devices",
        post: 0.15,
        props: {
          kicker: "Anywhere",
          title: "Any screen.\n*Installs like an app.*",
          shot: "tower",
          phones: ["m-tower", "m-supplier"],
          chip: {
            icon: "link",
            label: "Built to work with the Sankhya ERP",
            c: 1,
          },
        },
        say: [
          {
            en: "It works on any screen, and installs like an app on a phone.",
            pt: "Funciona em qualquer tela|e se instala como aplicativo no celular.",
            zh: "适配任何屏幕，|还能像应用一样安装到手机上。",
          },
          {
            en: "And it is built to work with Sankhya, the company's ERP.",
            say: "And it is built to work with Sankia, the company's E R P.",
            pt: "E foi feito para trabalhar com o Sankhya,|o ERP da empresa.",
            zh: "并可与公司的 ERP 系统|Sankhya 协同工作。",
          },
        ],
      },
      {
        ...END,
        say: [
          {
            en: "One portal. Every partner. Every step of the journey.",
            pt: "Um portal. Todos os parceiros.|Cada etapa da jornada.",
            zh: "一个门户，所有伙伴，|全程每一步。",
          },
          {
            en: "Wellmix. Imports from order to delivery.",
            pt: "Wellmix. Importação do pedido à entrega.",
            zh: "Wellmix：|从下单到交付的进口管理。",
          },
        ],
      },
    ],
  },
};
