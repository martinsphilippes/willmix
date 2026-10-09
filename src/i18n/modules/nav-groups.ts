/**
 * Dicionário do módulo "nav-groups" (menu principal agrupado, menu do celular
 * e menu da conta): mesmas chaves em pt, en e zh.
 */
export const pt = {
  "nav.group.operations": "Operação",
  "nav.group.registry": "Cadastros",
  "nav.group.management": "Gestão",
  "nav.main": "Menu principal",
  "nav.menu": "Menu",
  "nav.menu.close": "Fechar menu",
  "nav.user": "Minha conta",
  "nav.language": "Idioma",
  "nav.demo": "Conta de demonstração",
  "nav.notifications.unread": "{n} não lida(s)",
};

export const en: Record<keyof typeof pt, string> = {
  "nav.group.operations": "Operations",
  "nav.group.registry": "Master data",
  "nav.group.management": "Management",
  "nav.main": "Main menu",
  "nav.menu": "Menu",
  "nav.menu.close": "Close menu",
  "nav.user": "My account",
  "nav.language": "Language",
  "nav.demo": "Demo account",
  "nav.notifications.unread": "{n} unread",
};

export const zh: Record<keyof typeof pt, string> = {
  "nav.group.operations": "运营",
  "nav.group.registry": "档案",
  "nav.group.management": "管理",
  "nav.main": "主菜单",
  "nav.menu": "菜单",
  "nav.menu.close": "关闭菜单",
  "nav.user": "我的账号",
  "nav.language": "语言",
  "nav.demo": "演示账号",
  "nav.notifications.unread": "{n} 条未读",
};
