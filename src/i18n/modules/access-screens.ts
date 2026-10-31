/**
 * Dicionário do módulo "access" (telas por papel e por função, docs/ACCESS.md):
 * aviso de acesso negado, login sem função e a coluna "Telas" da equipe.
 * Mesmas chaves em pt, en e zh.
 */
export const pt = {
  "nav.import": "Importar planilha",
  "team.edit": "Editar acessos",
  "team.person.title": "Acessos de {name}",
  "team.person.back": "Voltar à equipe",
  "team.block.data": "Dados",
  "team.block.functions": "Funções (o que a pessoa faz no processo)",
  "team.block.screens": "Telas que o login abre",
  "team.screens.mode.default": "Padrão das funções",
  "team.screens.mode.custom": "Personalizado (marcar uma a uma)",
  "team.screens.mode.hint":
    "No padrão, as telas seguem as funções marcadas acima. No personalizado, valem só as caixas marcadas abaixo (o básico fica sempre). O administrador pode liberar qualquer tela, inclusive Financeiro.",
  "team.screens.custom": "Personalizado ({n} telas)",
  "team.screens.default": "Padrão das funções ({n} telas)",
  "team.screens.alwaysOn": "sempre",
  "team.screens.adminNote":
    "Administrador: abre todas as telas; não há o que marcar.",
  "team.screens.saveHint": "As telas valem na próxima tela que a pessoa abrir.",
  "function.desc.buyer":
    "abre RFQ, escolhe fornecedor, valida ficha e imagens, acompanha produção e recebimento",
  "function.desc.product_manager":
    "libera dumping; cuida de produto, linha, vitrine, marketing e pós-venda",
  "function.desc.planner":
    "aprova o pré-custo (1º nível), acompanha ETD, follow, containers e fretes",
  "function.desc.catalog":
    "valida o cadastro do produto no pedido, importa fichas e planilhas",
  "function.desc.finance": "valida e paga o numerário dentro do pedido",
  "function.desc.purchasing_director":
    "aprova o pré-custo (2º nível), painéis e auditoria",
  "function.desc.executive_director":
    "aprova o pré-custo acima do limite (3º nível), painéis e auditoria",
  "function.desc.designer": "artes, embalagem, fotos e marketing",
  "access.denied":
    "Você não tem acesso a {screen}. Peça ao administrador em Gestão → Equipe e divisões.",
  "access.noFunction":
    "Seu login ainda não tem função nem tela liberada. Por enquanto você vê só o básico: Pendências, Painel de SLA, Notificações e Mensagens. Peça ao administrador para liberar seus acessos em Gestão → Equipe e divisões.",
  "access.financeAdmin":
    "Financeiro (valores vendidos, recebidos, pagos e a pagar) é só do administrador.",
  "team.col.screens": "Telas",
  "team.screens.base": "Só o básico (Pendências, SLA, Notificações, Mensagens)",
  "team.screens.all": "Todas (administrador)",
  "team.screens.hint":
    "As telas seguem as funções marcadas, ou a lista marcada uma a uma em Editar acessos. Financeiro, Contas a pagar, Configurações e Equipe só abrem para o administrador ou para quem ele liberar.",
  "team.noFunction.notice":
    "{n} login(ns) sem função nem tela: veem só o básico. Abra Editar acessos para liberar.",
} as const;

export const en: Record<keyof typeof pt, string> = {
  "nav.import": "Import spreadsheet",
  "team.edit": "Edit access",
  "team.person.title": "Access for {name}",
  "team.person.back": "Back to team",
  "team.block.data": "Details",
  "team.block.functions": "Functions (what the person does in the process)",
  "team.block.screens": "Screens this login opens",
  "team.screens.mode.default": "Function defaults",
  "team.screens.mode.custom": "Custom (tick one by one)",
  "team.screens.mode.hint":
    "With defaults, screens follow the functions ticked above. With custom, only the boxes ticked below count (the basics always stay). The admin can grant any screen, including Finance.",
  "team.screens.custom": "Custom ({n} screens)",
  "team.screens.default": "Function defaults ({n} screens)",
  "team.screens.alwaysOn": "always",
  "team.screens.adminNote": "Admin: opens every screen; nothing to tick.",
  "team.screens.saveHint": "Screens apply on the next page the person opens.",
  "function.desc.buyer":
    "opens RFQs, picks the supplier, validates sheet and images, follows production and receiving",
  "function.desc.product_manager":
    "releases dumping holds; owns product, line, storefront, marketing and after-sales",
  "function.desc.planner":
    "approves pre-cost (level 1), follows ETD, follow-ups, containers and freight",
  "function.desc.catalog":
    "validates the product record on the order, imports sheets and spreadsheets",
  "function.desc.finance":
    "validates and pays the customs cash inside the order",
  "function.desc.purchasing_director":
    "approves pre-cost (level 2), dashboards and audit",
  "function.desc.executive_director":
    "approves pre-cost above the limit (level 3), dashboards and audit",
  "function.desc.designer": "artwork, packaging, photos and marketing",
  "access.denied":
    "You do not have access to {screen}. Ask the admin in Management → Team and divisions.",
  "access.noFunction":
    "Your login has no function or screen yet. For now you see only the basics: My tasks, SLA panel, Notifications and Messages. Ask the admin to grant your access in Management → Team and divisions.",
  "access.financeAdmin":
    "Finance (sold, received, paid and payable amounts) is for the admin only.",
  "team.col.screens": "Screens",
  "team.screens.base": "Basics only (tasks, SLA, notifications, messages)",
  "team.screens.all": "All (admin)",
  "team.screens.hint":
    "Screens follow the functions ticked, or the list ticked one by one under Edit access. Finance, Payables, Settings and Team open only for the admin or whoever the admin grants.",
  "team.noFunction.notice":
    "{n} login(s) without a function or screen see only the basics. Open Edit access to grant.",
};

export const zh: Record<keyof typeof pt, string> = {
  "nav.import": "导入表格",
  "team.edit": "编辑权限",
  "team.person.title": "{name} 的权限",
  "team.person.back": "返回团队",
  "team.block.data": "基本信息",
  "team.block.functions": "职能（此人在流程中做什么）",
  "team.block.screens": "此账号可打开的页面",
  "team.screens.mode.default": "按职能默认",
  "team.screens.mode.custom": "自定义（逐个勾选）",
  "team.screens.mode.hint":
    "默认模式下，页面随上方勾选的职能。自定义模式下，只有下方勾选的页面有效（基础页面始终保留）。管理员可开放任何页面，包括财务。",
  "team.screens.custom": "自定义（{n} 个页面）",
  "team.screens.default": "按职能默认（{n} 个页面）",
  "team.screens.alwaysOn": "始终",
  "team.screens.adminNote": "管理员：可打开所有页面，无需勾选。",
  "team.screens.saveHint": "此人下次打开页面时生效。",
  "function.desc.buyer": "发起询价、选定供应商、审核资料和图片、跟进生产和收货",
  "function.desc.product_manager":
    "解除反倾销锁定；负责产品、产品线、橱窗、营销和售后",
  "function.desc.planner": "审批预成本（第一级），跟进 ETD、跟单、集装箱和运费",
  "function.desc.catalog": "审核订单中的产品档案，导入资料和表格",
  "function.desc.finance": "在订单内审核并支付清关款",
  "function.desc.purchasing_director": "审批预成本（第二级）、看板和审计",
  "function.desc.executive_director": "审批超限预成本（第三级）、看板和审计",
  "function.desc.designer": "设计稿、包装、照片和营销",
  "access.denied": "您无权访问{screen}。请联系管理员：管理 → 团队与事业部。",
  "access.noFunction":
    "您的账号尚未分配职能，目前只能看到基础页面：待办、SLA 面板、通知和消息。请管理员在“管理 → 团队与事业部”中设置职能。",
  "access.financeAdmin": "财务（已售、已收、已付、应付金额）仅管理员可见。",
  "team.col.screens": "页面",
  "team.screens.base": "仅基础（待办、SLA、通知、消息）",
  "team.screens.all": "全部（管理员）",
  "team.screens.hint":
    "页面随所勾选的职能开放；财务、应付账款、设置和团队仅管理员可用。",
  "team.noFunction.notice":
    "{n} 个账号未分配职能，只能看到基础页面。勾选职能以开放页面。",
};
