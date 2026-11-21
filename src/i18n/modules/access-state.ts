/**
 * Estados de cadastro e login (dono, 17/11/2026; docs/EQUIPE_ACESSOS.md,
 * R7): as mensagens da entrada, o desativar e reativar login de parceiro e a
 * regra "cadastro e login ativos", ligada pelo administrador.
 */
export const pt = {
  "access.block.login_inactive":
    "Seu login está desativado. Fale com o administrador do portal.",
  "access.block.party_inactive":
    "O cadastro da sua empresa está inativo no portal. Fale com a Wellmix.",
  "access.block.blocked_both":
    "Seu login está desativado e o cadastro da sua empresa está inativo. Fale com a Wellmix.",
  "access.session.ended": "Sua sessão foi encerrada.",
  "access.login.deactivate": "Desativar",
  "access.login.reactivate": "Reativar",
  "access.login.confirmOff":
    "Desativar o login de {name}? Ele deixa de entrar e a sessão aberta cai na próxima página.",
  "access.login.saved.off": "Login desativado: {name}. Ele não entra mais.",
  "access.login.saved.on": "Login reativado: {name}.",
  "access.login.email.change": "Alterar e-mail",
  "access.login.email.new": "Novo login ou e-mail",
  "access.login.email.hint":
    "A senha continua a mesma. O login antigo deixa de entrar.",
  "access.login.email.save": "Salvar o novo e-mail",
  "access.login.email.confirm":
    "Trocar o login de {name}? A senha continua a mesma e o login antigo deixa de entrar.",
  "access.login.email.saved":
    "E-mail do login alterado: {name} agora entra com {login}. A senha continua a mesma.",
  "catalog.error.login_email_same": "Esse já é o login de hoje.",
  "catalog.error.login_email_unsupported":
    "Trocar o e-mail do login não está disponível nesta base de dados.",
  "access.login.blockedByParty":
    "Login ativo, mas o cadastro está inativo: com a regra ligada, não entra.",
  "access.rule.title": "Regra de acesso: cadastro e login ativos",
  "access.rule.off":
    "Desligada: hoje, o login ativo entra mesmo com o cadastro da empresa inativo.",
  "access.rule.on":
    "Ligada desde {date} por {name}: só entra quem tem o login e o cadastro ativos.",
  "access.rule.affected":
    "{n} parceiro(s) com o cadastro inativo e login ativo entram hoje. Com a regra ligada, deixam de entrar:",
  "access.rule.none":
    "Nenhum parceiro com o cadastro inativo e login ativo: ligar a regra não bloqueia ninguém agora.",
  "access.rule.blockedNow":
    "{n} parceiro(s) com o cadastro inativo e login ativo estão bloqueados pela regra:",
  "access.rule.review": "Revisar a regra",
  "access.rule.turnOn": "Ligar a regra",
  "access.rule.turnOff": "Desligar a regra",
  "access.rule.turnOnHint":
    "Ao ligar, os logins listados deixam de entrar e as sessões abertas deles caem na próxima página. Para liberar um parceiro, reative o cadastro dele.",
  "access.rule.saved.on": "Regra ligada: {n} login(s) deixaram de entrar.",
  "access.rule.saved.off": "Regra desligada.",
  "access.rule.close": "Fechar",
  "access.badge.inactiveLoginActive": "Login ativo",
  "access.badge.blocked": "Bloqueado",
  "access.error.not_found":
    "Login não encontrado ou não é de parceiro ou cliente.",
};

export const en: typeof pt = {
  "access.block.login_inactive":
    "Your login is deactivated. Contact the portal administrator.",
  "access.block.party_inactive":
    "Your company's record is inactive in the portal. Contact Wellmix.",
  "access.block.blocked_both":
    "Your login is deactivated and your company's record is inactive. Contact Wellmix.",
  "access.session.ended": "Your session was ended.",
  "access.login.deactivate": "Deactivate",
  "access.login.reactivate": "Reactivate",
  "access.login.confirmOff":
    "Deactivate {name}'s login? It can no longer sign in and the open session ends on the next page.",
  "access.login.saved.off":
    "Login deactivated: {name}. It can no longer sign in.",
  "access.login.saved.on": "Login reactivated: {name}.",
  "access.login.email.change": "Change e-mail",
  "access.login.email.new": "New login or e-mail",
  "access.login.email.hint":
    "The password stays the same. The old login stops working.",
  "access.login.email.save": "Save the new e-mail",
  "access.login.email.confirm":
    "Change the login of {name}? The password stays the same and the old login stops working.",
  "access.login.email.saved":
    "Login e-mail changed: {name} now signs in with {login}. The password stays the same.",
  "catalog.error.login_email_same": "That is already the current login.",
  "catalog.error.login_email_unsupported":
    "Changing the login e-mail is not available on this database.",
  "access.login.blockedByParty":
    "Login active, but the record is inactive: with the rule on, it can't sign in.",
  "access.rule.title": "Access rule: active record and login",
  "access.rule.off":
    "Off: today, an active login signs in even when the company record is inactive.",
  "access.rule.on":
    "On since {date} by {name}: only an active login with an active record signs in.",
  "access.rule.affected":
    "{n} partner(s) with an inactive record and an active login sign in today. With the rule on, they can't:",
  "access.rule.none":
    "No partner with an inactive record and an active login: turning the rule on blocks no one now.",
  "access.rule.blockedNow":
    "{n} partner(s) with an inactive record and an active login are blocked by the rule:",
  "access.rule.review": "Review the rule",
  "access.rule.turnOn": "Turn the rule on",
  "access.rule.turnOff": "Turn the rule off",
  "access.rule.turnOnHint":
    "When on, the logins listed can no longer sign in and their open sessions end on the next page. To release a partner, reactivate its record.",
  "access.rule.saved.on": "Rule on: {n} login(s) can no longer sign in.",
  "access.rule.saved.off": "Rule off.",
  "access.rule.close": "Close",
  "access.badge.inactiveLoginActive": "Active login",
  "access.badge.blocked": "Blocked",
  "access.error.not_found":
    "Login not found, or not a partner or customer login.",
};

export const zh: typeof pt = {
  "access.block.login_inactive": "您的账号已停用。请联系门户管理员。",
  "access.block.party_inactive": "您公司的档案在门户中已停用。请联系 Wellmix。",
  "access.block.blocked_both":
    "您的账号已停用，您公司的档案也已停用。请联系 Wellmix。",
  "access.session.ended": "您的会话已结束。",
  "access.login.deactivate": "停用",
  "access.login.reactivate": "重新启用",
  "access.login.confirmOff":
    "停用 {name} 的账号？该账号将无法登录，已打开的会话会在下一页结束。",
  "access.login.saved.off": "账号已停用：{name}。该账号无法再登录。",
  "access.login.saved.on": "账号已重新启用：{name}。",
  "access.login.email.change": "修改邮箱",
  "access.login.email.new": "新的登录名或邮箱",
  "access.login.email.hint": "密码保持不变。旧的登录名将无法登录。",
  "access.login.email.save": "保存新邮箱",
  "access.login.email.confirm":
    "修改 {name} 的登录名？密码保持不变，旧的登录名将无法登录。",
  "access.login.email.saved":
    "登录邮箱已修改：{name} 现在使用 {login} 登录。密码保持不变。",
  "catalog.error.login_email_same": "这已经是当前的登录名。",
  "catalog.error.login_email_unsupported": "此数据库不支持修改登录邮箱。",
  "access.login.blockedByParty": "账号启用，但档案已停用：规则开启时无法登录。",
  "access.rule.title": "访问规则：档案和账号均为启用",
  "access.rule.off": "已关闭：目前即使公司档案已停用，启用的账号仍可登录。",
  "access.rule.on":
    "自 {date} 起由 {name} 开启：只有账号和档案均启用才能登录。",
  "access.rule.affected":
    "{n} 个合作伙伴的档案已停用但账号仍启用，目前可以登录。规则开启后将无法登录：",
  "access.rule.none":
    "没有档案已停用但账号启用的合作伙伴：开启规则目前不会阻止任何人。",
  "access.rule.blockedNow": "{n} 个档案已停用但账号启用的合作伙伴被规则阻止：",
  "access.rule.review": "查看规则",
  "access.rule.turnOn": "开启规则",
  "access.rule.turnOff": "关闭规则",
  "access.rule.turnOnHint":
    "开启后，列出的账号将无法登录，其已打开的会话会在下一页结束。要放行某个合作伙伴，请重新启用其档案。",
  "access.rule.saved.on": "规则已开启：{n} 个账号无法再登录。",
  "access.rule.saved.off": "规则已关闭。",
  "access.rule.close": "关闭",
  "access.badge.inactiveLoginActive": "账号启用",
  "access.badge.blocked": "已阻止",
  "access.error.not_found": "未找到账号，或不是合作伙伴或客户的账号。",
};
