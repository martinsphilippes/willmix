/*
 * Roteiro do vídeo completo em mandarim (pedido do dono, 24/11/2026): telas do
 * portal em chinês, narração por voz feminina em mandarim, SEM legenda. Gêmeo
 * de VIDEOS_BR.full_br (script.br.mjs): mesmas cenas, mesma ordem, mesmos
 * tipos de cena (film/scenes.js); muda o texto.
 *
 * - Chinês simplificado, mandarim padrão. Os termos são os do próprio portal
 *   em chinês (src/i18n: 待办, 验货, 装柜, 提单, 报关行, 控制塔...), para a voz e
 *   os textos da cena dizerem o que a tela mostra.
 * - `say[i].zh` é o texto falado. `speak()` troca o que a voz deve ler de outro
 *   jeito; `say[i].say` escreve a fala inteira para a voz, quando um caso pede.
 * - A narração evita caracteres de duas leituras em posição arriscada para a
 *   voz sintética (应付/应收: "付给供应商的货款" e "向客户收取的货款").
 * - `props` é o que a cena desenha. Nos textos da tela, *assim* sai em
 *   vermelho; sem espaços entre palavras, o palco separa as palavras do chinês
 *   sozinho (film.js, Intl.Segmenter).
 * - Só afirma o que o portal faz hoje (docs/videos/institucional/README.md,
 *   seção "O que os vídeos não prometem").
 */

const ROLES = [
  { icon: "store", label: "客户" },
  { icon: "factory", label: "供应商" },
  { icon: "pen-tool", label: "设计公司" },
  { icon: "badge-check", label: "认证机构" },
  { icon: "camera", label: "营销代理" },
  { icon: "container", label: "货代" },
  { icon: "ship", label: "船公司" },
  { icon: "briefcase", label: "外贸代理" },
  { icon: "landmark", label: "报关行" },
  { icon: "truck", label: "承运商" },
  { icon: "scale", label: "法务" },
  { icon: "users", label: "Wellmix 团队" },
];

const HANDOFFS = [
  { icon: "factory", label: "供应商", pos: "right" },
  { icon: "pen-tool", label: "设计公司" },
  { icon: "badge-check", label: "认证" },
  { icon: "ship", label: "海运" },
  { icon: "landmark", label: "海关" },
  { icon: "truck", label: "承运商" },
];

/**
 * Como a voz deve ler o que o texto escreve de outro jeito: [expressão,
 * leitura]. Em mandarim a voz lê "Wellmix", "Book", "ERP" e "SLA" como estão
 * (palavra inglesa e letras); a lista fica para o que a medição mostrar.
 */
const LEXICON = [];
export const speak = (text) =>
  LEXICON.reduce((t, [from, to]) => t.replace(from, to), text);

const END = {
  id: "end",
  type: "end",
  noBrand: true,
  // Folgas da cena final: a marca entra junto com o acorde final da música
  // (tts/track.py mostra a diferença).
  pre: 0.2,
  post: 0.55,
  props: {
    lines: ["一个门户。", "所有伙伴。", "每个环节。"],
    tagline: "从下单到交付的进口管理",
  },
};

export const VIDEOS_ZH = {
  full_zh: {
    title: "Wellmix 门户 · 每个角色做什么",
    voice: "zh",
    noSubs: true,
    lang: "zh",
    // Telas do portal em chinês com a base de demonstração em chinês
    // (data-zh.mjs, shots.mjs zh --out cn, inspection/flow.mjs com
    // LANGUAGE=zh); a cena dos três idiomas usa as mesmas telas em pt, en e zh.
    shots: "cn",
    speak,
    ui: {
      portal: "Wellmix 门户",
      brazil: "巴西",
      sees: "可见",
      neverSees: "永不可见",
      chaos: {
        mail: "邮件",
        sheet: "表格",
        chat: "聊天群",
        phone: "电话",
        pdf: "PDF",
        attach: "附件",
      },
    },
    scenes: [
      {
        id: "route",
        type: "route",
        cls: "first",
        pre: 1.0,
        props: {
          kicker: "挑战",
          title: "一次进口。\n*几十双手。*",
          handoffs: HANDOFFS,
          handoffsC: 1,
        },
        say: [
          {
            zh: "把一件产品从海外工厂送到巴西客户手中，是一场漫长的接力赛。",
          },
          { zh: "供应商、设计公司、认证机构、海运、海关、承运商。" },
        ],
      },
      {
        id: "chaos",
        type: "chaos",
        props: {
          title: "邮件、\n表格、\n零散的*聊天群。*",
        },
        say: [
          { zh: "各有各的邮件、表格和聊天群。" },
          { zh: "却没有人能看到全貌。" },
        ],
      },
      {
        id: "hub",
        type: "hub",
        noBrand: true,
        props: {
          title: "一个门户。*一条流程。*",
          roles: ROLES,
          note: "13 种登录角色 · 各自只看到自己的部分",
          noteC: 2,
        },
        say: [
          { zh: "Wellmix 门户把整个业务集中到一个地方。" },
          {
            zh: "一条统一的流程，由 Wellmix、供应商、服务伙伴和客户共同使用。",
          },
          { zh: "每个账号只能看到自己的部分。" },
        ],
      },
      {
        id: "journey",
        type: "journey",
        chapter: "全流程",
        props: {
          title: "从第一份 Book 到*最终交付*",
          blocks: [
            {
              icon: "file-spreadsheet",
              name: "Book",
              steps: ["供应商的 Book", "选品", "洽谈", "样品"],
            },
            {
              icon: "file-signature",
              name: "订单",
              steps: ["采购订单", "设计稿", "认证", "合同签署"],
            },
            {
              icon: "factory",
              name: "生产",
              steps: ["跟进", "验货", "装柜", "货运单据"],
            },
            {
              icon: "truck",
              name: "交付",
              steps: ["清关", "运输", "收货"],
            },
            {
              icon: "tag",
              name: "销售",
              steps: ["报价推广", "销售订单", "送货日程"],
            },
            {
              icon: "wallet",
              name: "财务",
              steps: ["应付账款", "应收账款", "现金流", "佣金"],
            },
          ],
          footer: [
            { icon: "user-cog", label: "一位负责人" },
            { icon: "clock", label: "一个期限" },
            { icon: "list-checks", label: "一个状态" },
          ],
          footerC: 7,
        },
        say: [
          { zh: "门户分为六个板块，从头到尾跟进整个进口流程。" },
          { zh: "Book：供应商的报价表、选品、洽谈和样品。" },
          { zh: "订单：采购订单、设计稿、认证和合同签署。" },
          { zh: "生产：跟进、验货、装柜和货运单据。" },
          { zh: "交付：清关、运输和收货。" },
          { zh: "销售：报价推广、销售订单和送货日程。" },
          {
            zh: "还有财务：付给供应商的货款、向客户收取的货款、现金流和佣金。",
          },
          { zh: "每个环节都有负责人、期限和状态。" },
        ],
      },
      {
        id: "customer",
        type: "role",
        chapter: "谁做什么",
        props: {
          role: "客户",
          icon: "store",
          title: "不打一个电话，\n订单进度一目了然",
          shot: "customer",
          oy: "18%",
          bullets: [
            { t: "<b>下单</b>并跟进每个环节", c: 0, d: 1.4 },
            { t: "<b>付款方式</b>、分期和付款单", c: 1 },
            { t: "<b>确认收货</b>并为采购评分", c: 2 },
          ],
        },
        say: [
          { zh: "客户下单以后，不用打一个电话，就能跟进每个环节。" },
          { zh: "付款方式、分期和银行付款单，都在同一个页面。" },
          { zh: "到货以后，客户确认收货，并为这次采购评分。" },
        ],
      },
      {
        id: "supplier",
        type: "role",
        cls: "flip",
        props: {
          role: "供应商",
          icon: "factory",
          title: "一份待办清单，\n中文或英文",
          shot: "supplier",
          oy: "16%",
          bullets: [
            { t: "回复<b>价格、起订量和交期</b>", c: 1 },
            { t: "<b>样品照片和视频</b>、生产日期、验货", c: 2 },
            { t: "每笔订单的<b>付款预计</b>", c: 3 },
          ],
        },
        say: [
          { zh: "供应商只需要一份待办清单，中文或英文都可以。" },
          { zh: "回复询单，填写价格、起订量和交期。" },
          { zh: "上传样品的照片和视频、生产日期和验货资料。" },
          { zh: "还能查看每笔订单的付款预计。" },
        ],
      },
      {
        id: "agency",
        type: "role",
        props: {
          role: "设计公司",
          icon: "pen-tool",
          title: "需求、文件和反馈，\n都在一个工作台",
          shot: "agency",
          oy: "30%",
          bullets: [
            { t: "收到<b>刀模图和产品照片</b>", c: 0, d: 1.6 },
            { t: "上传设计稿，收到<b>注明原因的反馈</b>", c: 1 },
            { t: "交付<b>带认证标志的终稿</b>", c: 2 },
            {
              t: "<b>工厂文件</b>随待办送达；有疑问，在对话里问 Wellmix",
              c: 3,
            },
          ],
        },
        say: [
          {
            zh: "设计公司在自己的工作台上，收到工厂提供的刀模图和产品照片。",
          },
          { zh: "上传设计稿，并收到注明原因的反馈。" },
          { zh: "最后交付带有认证标志的终稿。" },
          {
            // Não há chat direto entre agência e fornecedor: cada empresa
            // conversa com a Wellmix; o que passa de um para o outro são as
            // pendências e os arquivos do pedido (docs/PURCHASE_ORDER.md).
            zh: "设计公司在巴西，工厂在海外：文件和待办都通过门户流转，双方各自与 Wellmix 沟通。不再需要邮件。",
          },
        ],
      },
      {
        id: "ocp",
        type: "role",
        cls: "flip",
        props: {
          role: "认证机构",
          icon: "badge-check",
          title: "一份清单，\n列出待出具的证书",
          shot: "ocp",
          oy: "14%",
          bullets: [
            { t: "查看<b>采购单</b>和产品照片", c: 1 },
            {
              t: "上传<b>技术说明书、认证标志和证书</b>",
              c: 1,
              d: 2.2,
            },
          ],
        },
        say: [
          { zh: "认证机构有一份统一的清单，列出所有待出具的证书。" },
          { zh: "查看采购单，上传技术说明书、认证标志和证书。" },
        ],
      },
      {
        // Inspeção pelo celular: telas reais do passo Produção > Inspeção com o
        // login do fornecedor (inspection/flow.mjs com LANGUAGE=zh). `tap` é o
        // ponto tocado em pixels da janela de 390 × 844; vêm de out/insp/state.json.
        id: "inspect",
        type: "mobile",
        post: 0.85,
        props: {
          role: "供应商 · 工厂车间",
          icon: "smartphone",
          title: "验货，*用手机就行*",
          screens: [
            { shot: "m-insp-1", tap: [110, 378] },
            { shot: "m-insp-2", c: 1, d: 1.5, tap: [110, 490] },
            { shot: "m-insp-3", c: 2, d: 0.5, tap: [191, 602] },
            { shot: "m-insp-4", c: 3, d: -0.2 },
          ],
          desk: {
            before: "insp-desk-0",
            shot: "insp-desk",
            c: 3,
            d: 0.35,
            ox: "46%",
            oy: "45%",
            zoom0: 1.45,
            zoom: 1.6,
            icon: "eye",
            label: "Wellmix 看到的页面",
          },
          bullets: [
            { t: "<b>照片</b>随拍随存", c: 1 },
            { t: "录入<b>实测重量</b>和尺寸", c: 2 },
            { t: "<b>Wellmix</b> 在订单里看到每一项", c: 3 },
          ],
        },
        say: [
          { zh: "在工厂车间，用手机就能完成验货。" },
          { zh: "供应商每拍一张照片，门户都会即时保存。" },
          { zh: "然后输入实测重量，点击提交。" },
          { zh: "另一边，Wellmix 在订单里就能看到每一项。" },
        ],
      },
      {
        id: "marketing",
        type: "role",
        cls: "flip",
        props: {
          role: "营销代理 · 原产地",
          icon: "camera",
          title: "货物出运前的实物照片",
          shot: "marketing",
          oy: "40%",
          bullets: [
            { t: "确认<b>样品已送达</b>", c: 0, d: 1.2 },
            { t: "上传每个产品的<b>实物照片和视频</b>", c: 1 },
            { t: "<b>归还样品</b>，随订单一起出运", c: 1, d: 2.6 },
          ],
        },
        say: [
          { zh: "在原产地，营销代理确认样品已经送达。" },
          { zh: "上传每个产品的实物照片和视频，然后归还样品。" },
        ],
      },
      {
        id: "freight",
        type: "duo",
        props: {
          items: [
            {
              role: "货代",
              icon: "container",
              title: "订舱和起运地的集装箱",
              shot: "forwarder",
              oy: "40%",
              c: 0,
            },
            {
              role: "船公司",
              icon: "ship",
              title: "运费报价、提单、装船",
              shot: "line",
              oy: "10%",
              c: 1,
            },
          ],
        },
        say: [
          { zh: "货代登记订舱信息，并跟进起运地的集装箱。" },
          { zh: "船公司回复运费询价，签发提单，并确认装船。" },
        ],
      },
      {
        id: "customs",
        type: "duo",
        props: {
          items: [
            {
              role: "外贸代理",
              icon: "briefcase",
              title: "许可证、清关备用金和进口申报",
              shot: "comex",
              oy: "40%",
              c: 0,
            },
            {
              role: "报关行",
              icon: "landmark",
              title: "税则归类和清关",
              shot: "broker",
              oy: "14%",
              c: 0,
              d: 1.6,
            },
          ],
          note: "每一步都显示谁执行、谁审核",
          noteC: 1,
        },
        say: [
          { zh: "在巴西，外贸代理和报关行负责许可证、单据和清关。" },
          { zh: "每一步都显示由谁执行、由谁审核。" },
        ],
      },
      {
        id: "carrier",
        type: "role",
        cls: "flip",
        props: {
          role: "承运商",
          icon: "truck",
          title: "从港口到客户门口",
          shot: "carrier",
          oy: "22%",
          phone: "m-carrier",
          bullets: [
            { t: "<b>货物和送货地址</b>在一张卡片上", c: 0, d: 1.2 },
            { t: "更新<b>在途状态</b>", c: 1 },
            { t: "用手机<b>确认送达</b>", c: 1, d: 2.0 },
          ],
        },
        say: [
          { zh: "承运商在一张卡片上，就能看到货物和送货地址。" },
          { zh: "在运输途中更新状态，并用手机确认送达。" },
        ],
      },
      {
        id: "team1",
        type: "team",
        props: {
          kicker: "Wellmix 内部",
          title: "每个岗位都有*自己的视图*",
          tiles: [
            {
              icon: "shopping-cart",
              name: "采购员",
              text: "导入供应商的 Book、选品、洽谈",
              c: 1,
            },
            {
              icon: "package",
              name: "产品经理",
              text: "评估样品，维护产品档案",
              c: 2,
            },
            {
              icon: "calendar-check",
              name: "计划员",
              text: "生产日期、集装箱和运费",
              c: 3,
            },
            {
              icon: "database",
              name: "建档",
              text: "审核税则归类和主档资料",
              c: 4,
            },
            {
              icon: "palette",
              name: "设计师",
              text: "制作设计稿，审核实物照片",
              c: 4,
              d: 1.6,
            },
            {
              icon: "scale",
              name: "法务",
              text: "罚款及其处理状态",
              c: 4,
              d: 2.0,
            },
          ],
        },
        say: [
          { zh: "在 Wellmix 内部，每个岗位都有自己的页面和待办。" },
          { zh: "采购员导入供应商的 Book，选品并洽谈。" },
          { zh: "产品经理评估样品，并维护产品档案。" },
          { zh: "计划员跟进生产日期、集装箱和运费。" },
          { zh: "建档专员审核税则归类和主档资料。" },
        ],
      },
      {
        id: "team2",
        type: "team",
        props: {
          kicker: "Wellmix 内部",
          title: "从财务到*总监*",
          tiles: [
            {
              icon: "wallet",
              name: "财务",
              text: "审核进口费用，登记发票",
              c: 0,
            },
            {
              icon: "clipboard-check",
              name: "质检",
              text: "核对每个集装箱：铅封、照片、清点",
              c: 1,
            },
            {
              icon: "tag",
              name: "销售",
              text: "报价、销售订单和送货日期",
              c: 2,
            },
            {
              icon: "handshake",
              name: "总监",
              text: "审批采购策略，签署合同",
              c: 3,
            },
            {
              icon: "key-round",
              name: "管理员",
              text: "权限、期限和系统设置",
              c: 4,
            },
            {
              icon: "ship",
              name: "进出口 · 内部",
              text: "每天更新集装箱的跟踪状态",
              c: 4,
              d: 1.8,
            },
          ],
        },
        say: [
          { zh: "财务审核进口费用，并登记发票。" },
          { zh: "质检在到货时核对每个集装箱：铅封、照片和清点。" },
          { zh: "销售登记报价，创建销售订单，并安排送货。" },
          { zh: "总监审批采购策略，并签署合同。" },
          { zh: "管理员则负责权限、期限和系统设置。" },
        ],
      },
      {
        // O chat do portal no lugar dos e-mails: a tela real de Mensagens, com a
        // conversa de seed-chat.mjs (LANGUAGE=zh).
        id: "chat",
        type: "chat",
        chapter: "一个对话",
        post: 0.85,
        props: {
          kicker: "沟通",
          title: "邮件往来，\n*到此为止。*",
          shot: "messages",
          phone: "m-messages",
          phoneAt: { c: 2, d: 1.2 },
          ox: "100%",
          oy: "50%",
          zoom0: 1.14,
          zoom: 1.3,
          gone: [
            { icon: "mail", label: "邮件往来", c: 1 },
            { icon: "message-circle", label: "聊天群", c: 1 },
            { icon: "file-spreadsheet", label: "零散文件", c: 1 },
          ],
          chips: [
            {
              icon: "messages-square",
              label: "每家公司与 Wellmix 一个对话",
              c: 2,
            },
            {
              icon: "list-checks",
              label: "按订单和产品归类",
              c: 2,
              d: 2.0,
            },
            {
              icon: "paperclip",
              label: "照片、视频和文件都在对话里",
              c: 3,
            },
          ],
        },
        say: [
          { zh: "所有沟通都在门户内进行。" },
          { zh: "零散的邮件往来，到此为止。" },
          { zh: "每家公司与 Wellmix 只有一个对话，按订单和产品归类。" },
          { zh: "照片、视频和文件，都放在各自对应的主题下。" },
          { zh: "不遗漏，不混乱。" },
        ],
      },
      {
        id: "comms",
        type: "focus",
        cls: "flip",
        post: 0.75,
        props: {
          kicker: "待办与通知",
          title: "人人都清楚\n*有什么待办*",
          shots: [
            { shot: "broker", ox: "55%", oy: "18%", zoom: 1.12, c: 0 },
            {
              shot: "messages-control",
              ox: "55%",
              oy: "22%",
              zoom: 1.12,
              c: 1,
            },
          ],
          chips: [
            { icon: "bell", label: "通知铃铛", c: 0, d: 0.6 },
            {
              icon: "inbox",
              label: "我的待办 · 等您处理的事",
              c: 0,
              d: 2.2,
            },
            {
              icon: "clock",
              label: "Wellmix 看到该由谁回复 · 1 个工作日",
              c: 1,
            },
          ],
        },
        say: [
          { zh: "通知铃铛和待办清单，让每个人都清楚有哪些事在等自己处理。" },
          { zh: "Wellmix 也能看到该由谁来回复。" },
        ],
      },
      {
        id: "langs",
        type: "trio",
        chapter: "为管控而设计",
        props: {
          kicker: "三种语言",
          title: "Português. English. *中文。*",
          shot: "supplier",
          dirs: { pt: "cn-pt", en: "cn-en", zh: "cn-zh" },
          // Nome do portal na barra de cada janela, no idioma dela (app.name).
          names: {
            pt: "Portal Wellmix",
            en: "Wellmix Portal",
            zh: "Wellmix 门户",
          },
        },
        say: [{ zh: "门户支持葡萄牙语、英语和中文。" }],
      },
      {
        id: "access",
        type: "access",
        props: {
          kicker: "按角色授权",
          title: "每个伙伴只看到*自己的订单。*\n仅此而已。",
          views: [
            {
              role: "客户",
              icon: "store",
              sees: ["自己的订单和状态", "付款方式和付款单"],
              hidden: ["供应商", "采购价", "利润"],
              c: 1,
            },
            {
              role: "供应商",
              icon: "factory",
              sees: ["自己的询单和订单", "付款预计"],
              hidden: ["对客户的销售价", "利润"],
              c: 1,
              d: 0.5,
            },
            {
              role: "服务伙伴",
              icon: "handshake",
              sees: ["只有自己参与的订单", "自己的待办和期限"],
              hidden: ["其他公司的订单", "利润"],
              c: 1,
              d: 1.0,
            },
          ],
        },
        say: [
          { zh: "权限按角色设定。" },
          { zh: "每个合作伙伴只能看到自己的订单，仅此而已。" },
          { zh: "客户永远看不到供应商、采购价和利润。" },
        ],
      },
      {
        id: "evidence",
        type: "focus",
        post: 0.4,
        cls: "flip",
        props: {
          kicker: "质量",
          title: "*每个环节*都有记录",
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
            { icon: "video", label: "验货 · 照片、重量、视频", c: 1 },
            { icon: "container", label: "装柜 · 照片、铅封、柜号", c: 2 },
            { icon: "file-check", label: "单据 · 逐行核对", c: 3 },
          ],
        },
        say: [
          { zh: "每个环节的质量都有记录可查。" },
          { zh: "验货有照片、重量和视频。" },
          { zh: "装柜有照片、铅封和柜号。" },
          { zh: "装箱单、发票和提单，逐行核对。" },
        ],
      },
      {
        id: "control",
        type: "focus",
        post: 0.45,
        props: {
          kicker: "管理视角",
          title: "整个流程，\n*按阶段呈现*",
          shots: [
            { shot: "tower", ox: "62%", oy: "34%", zoom: 1.12, c: 0 },
            { shot: "sla", ox: "55%", oy: "24%", zoom: 1.1, c: 1 },
            { shot: "audit", ox: "55%", oy: "30%", zoom: 1.1, c: 2 },
          ],
          chips: [
            { icon: "layout-dashboard", label: "控制塔", c: 0, d: 0.8 },
            {
              icon: "gauge",
              label: "SLA 面板 · 逾期、今天到期、负责人",
              c: 1,
            },
            { icon: "history", label: "看板和审计记录", c: 2 },
          ],
        },
        say: [
          { zh: "对管理层来说，控制塔按阶段展示整个流程。" },
          { zh: "SLA 面板显示哪些已经逾期、哪些今天到期，以及由谁负责。" },
          { zh: "各类看板和完整的审计记录，让全貌清晰可见。" },
        ],
      },
      {
        id: "devices",
        type: "devices",
        post: 0.55,
        props: {
          kicker: "随时随地",
          title: "任何屏幕。\n*像应用一样安装。*",
          shot: "tower",
          phones: ["m-tower", "m-supplier"],
          chip: {
            icon: "link",
            label: "专为 Wellmix 的 ERP 而设计",
            c: 1,
          },
        },
        say: [
          { zh: "门户适配任何屏幕，还能像应用一样安装到手机上。" },
          { zh: "而且专为配合 Wellmix 的 ERP 系统而设计。" },
        ],
      },
      {
        ...END,
        say: [
          { zh: "一个门户，所有伙伴，全程每个环节。" },
          { zh: "Wellmix，从下单到交付的进口管理。" },
        ],
      },
    ],
  },
};
