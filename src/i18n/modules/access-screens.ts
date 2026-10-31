/**
 * Dicionário do módulo "access" (telas por papel e por função, docs/ACCESS.md):
 * aviso de acesso negado, login sem função e a coluna "Telas" da equipe.
 * Mesmas chaves em pt, en e zh.
 */
export const pt = {
  "nav.import": "Importar planilha",
  "access.denied":
    "Você não tem acesso a {screen}. Peça ao administrador em Gestão → Equipe e divisões.",
  "access.noFunction":
    "Seu login ainda não tem função. Por enquanto você vê só o básico: Pendências, Painel de SLA, Notificações e Mensagens. Peça ao administrador para marcar suas funções em Gestão → Equipe e divisões.",
  "access.financeAdmin":
    "Financeiro (valores vendidos, recebidos, pagos e a pagar) é só do administrador.",
  "team.col.screens": "Telas",
  "team.screens.base": "Só o básico (Pendências, SLA, Notificações, Mensagens)",
  "team.screens.all": "Todas (administrador)",
  "team.screens.hint":
    "As telas seguem as funções marcadas; Financeiro, Contas a pagar, Configurações e Equipe são só do administrador.",
  "team.noFunction.notice":
    "{n} login(ns) sem função: veem só o básico. Marque as funções para liberar as telas.",
} as const;

export const en: Record<keyof typeof pt, string> = {
  "nav.import": "Import spreadsheet",
  "access.denied":
    "You do not have access to {screen}. Ask the admin in Management → Team and divisions.",
  "access.noFunction":
    "Your login has no function yet. For now you see only the basics: My tasks, SLA panel, Notifications and Messages. Ask the admin to set your functions in Management → Team and divisions.",
  "access.financeAdmin":
    "Finance (sold, received, paid and payable amounts) is for the admin only.",
  "team.col.screens": "Screens",
  "team.screens.base": "Basics only (tasks, SLA, notifications, messages)",
  "team.screens.all": "All (admin)",
  "team.screens.hint":
    "Screens follow the functions ticked; Finance, Payables, Settings and Team are admin only.",
  "team.noFunction.notice":
    "{n} login(s) without a function see only the basics. Tick functions to unlock screens.",
};

export const zh: Record<keyof typeof pt, string> = {
  "nav.import": "导入表格",
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
