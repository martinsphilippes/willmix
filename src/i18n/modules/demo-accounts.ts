/**
 * Dicionário do módulo "demo-accounts" (contas de demonstração: criar as que
 * faltam em Configurações e a troca de conta no topo): mesmas chaves em pt,
 * en e zh.
 */
export const pt = {
  "settings.demo.title": "Contas de demonstração",
  "settings.demo.intro":
    "Logins de teste, todos com a senha {password}. Quando o portal ganha um papel novo (Comex, agente de carga, OCP…), a conta dele precisa ser criada aqui.",
  "settings.demo.exists": "Criada",
  "settings.demo.missing": "Falta criar",
  "settings.demo.create": "Criar as contas que faltam",
  "settings.demo.allCreated": "Todas as contas de demonstração existem.",
  "settings.demo.done": "{n} conta(s) criada(s). Já dá para entrar com elas.",
  "settings.demo.none": "Nenhuma conta nova para criar.",
  "settings.demo.failed": "Não foi possível criar: {list}",
  "settings.demo.reason.schema_outdated":
    "esquema desatualizado (publique o esquema Appwrite e tente de novo)",
  "settings.demo.reason.party_missing": "a empresa dela não foi criada",
  "settings.demo.reason.unexpected":
    "erro inesperado (o motivo está no registro do servidor)",
  "settings.demo.detail": "[detalhe técnico: {detail}]",
  "demo.switch.missing":
    "Essa conta ainda não existe no banco. Peça ao administrador: Configurações → Contas de demonstração.",
  "demo.switch.failed": "Não foi possível trocar de conta. Tente de novo.",
} as const;

export const en: Record<keyof typeof pt, string> = {
  "settings.demo.title": "Demo accounts",
  "settings.demo.intro":
    "Test logins, all with the password {password}. When the portal gains a new role (comex, freight forwarder, OCP…), its account must be created here.",
  "settings.demo.exists": "Created",
  "settings.demo.missing": "Not created yet",
  "settings.demo.create": "Create the missing accounts",
  "settings.demo.allCreated": "All demo accounts exist.",
  "settings.demo.done":
    "{n} account(s) created. You can sign in with them now.",
  "settings.demo.none": "No new account to create.",
  "settings.demo.failed": "Could not create: {list}",
  "settings.demo.reason.schema_outdated":
    "schema outdated (publish the Appwrite schema and try again)",
  "settings.demo.reason.party_missing": "its company was not created",
  "settings.demo.reason.unexpected":
    "unexpected error (the reason is in the server log)",
  "settings.demo.detail": "[technical detail: {detail}]",
  "demo.switch.missing":
    "This account does not exist in the database yet. Ask the admin: Settings → Demo accounts.",
  "demo.switch.failed": "Could not switch account. Try again.",
};

export const zh: Record<keyof typeof pt, string> = {
  "settings.demo.title": "演示账号",
  "settings.demo.intro":
    "测试登录账号，密码均为 {password}。门户新增角色（外贸代理、货代、OCP 等）时，需在此创建其账号。",
  "settings.demo.exists": "已创建",
  "settings.demo.missing": "尚未创建",
  "settings.demo.create": "创建缺少的账号",
  "settings.demo.allCreated": "所有演示账号均已存在。",
  "settings.demo.done": "已创建 {n} 个账号，现在可以登录。",
  "settings.demo.none": "没有需要创建的新账号。",
  "settings.demo.failed": "无法创建：{list}",
  "settings.demo.reason.schema_outdated":
    "架构未更新（请先发布 Appwrite 架构后重试）",
  "settings.demo.reason.party_missing": "其公司未创建",
  "settings.demo.reason.unexpected": "意外错误（原因见服务器日志）",
  "settings.demo.detail": "[技术细节：{detail}]",
  "demo.switch.missing":
    "该账号在数据库中尚不存在。请联系管理员：设置 → 演示账号。",
  "demo.switch.failed": "无法切换账号，请重试。",
};
