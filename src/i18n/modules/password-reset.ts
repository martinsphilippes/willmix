/**
 * Dicionário do módulo "password-reset" (esqueci minha senha e nova senha,
 * Supabase Auth): mesmas chaves em pt, en e zh.
 */
export const pt = {
  "pwReset.forgotLink": "Esqueci minha senha",
  "pwReset.forgot.title": "Esqueci minha senha",
  "pwReset.forgot.hint":
    "Digite seu e-mail. Se ele tiver acesso ao portal, você recebe um link para definir uma senha nova.",
  "pwReset.forgot.submit": "Enviar link",
  "pwReset.forgot.sent":
    "Pronto. Se o e-mail tiver acesso ao portal, o link chega em alguns minutos (veja também o spam).",
  "pwReset.forgot.rate":
    "Muitos pedidos seguidos. Espere alguns minutos e tente de novo.",
  "pwReset.forgot.invalid": "Digite um e-mail válido.",
  "pwReset.unavailable":
    "A troca de senha por e-mail ainda não está ligada. Fale com o administrador do portal.",
  "pwReset.back": "Voltar para o login",
  "pwReset.reset.title": "Definir nova senha",
  "pwReset.reset.password": "Nova senha (mínimo 8 caracteres)",
  "pwReset.reset.confirm": "Repita a nova senha",
  "pwReset.reset.submit": "Salvar senha",
  "pwReset.reset.noToken":
    "Abra esta página pelo link que chegou no seu e-mail.",
  "pwReset.reset.done": "Senha salva. Já pode entrar.",
  "pwReset.reset.short": "A senha precisa ter pelo menos 8 caracteres.",
  "pwReset.reset.mismatch": "As duas senhas não são iguais.",
  "pwReset.reset.expired":
    'O link expirou ou já foi usado. Peça um novo em "Esqueci minha senha".',
  "pwReset.reset.failed": "Não deu para salvar a senha. Tente de novo.",
  "pwReset.reset.again": "Pedir um novo link",
};

export const en: Record<keyof typeof pt, string> = {
  "pwReset.forgotLink": "Forgot my password",
  "pwReset.forgot.title": "Forgot my password",
  "pwReset.forgot.hint":
    "Enter your e-mail. If it has access to the portal, you will receive a link to set a new password.",
  "pwReset.forgot.submit": "Send link",
  "pwReset.forgot.sent":
    "Done. If the e-mail has access to the portal, the link arrives in a few minutes (check spam too).",
  "pwReset.forgot.rate": "Too many requests. Wait a few minutes and try again.",
  "pwReset.forgot.invalid": "Enter a valid e-mail.",
  "pwReset.unavailable":
    "Password reset by e-mail is not on yet. Talk to the portal administrator.",
  "pwReset.back": "Back to sign in",
  "pwReset.reset.title": "Set a new password",
  "pwReset.reset.password": "New password (at least 8 characters)",
  "pwReset.reset.confirm": "Repeat the new password",
  "pwReset.reset.submit": "Save password",
  "pwReset.reset.noToken": "Open this page from the link sent to your e-mail.",
  "pwReset.reset.done": "Password saved. You can sign in now.",
  "pwReset.reset.short": "The password needs at least 8 characters.",
  "pwReset.reset.mismatch": "The two passwords are not the same.",
  "pwReset.reset.expired":
    'The link expired or was already used. Ask for a new one in "Forgot my password".',
  "pwReset.reset.failed": "Could not save the password. Try again.",
  "pwReset.reset.again": "Ask for a new link",
};

export const zh: Record<keyof typeof pt, string> = {
  "pwReset.forgotLink": "忘记密码",
  "pwReset.forgot.title": "忘记密码",
  "pwReset.forgot.hint":
    "请输入您的邮箱。如果该邮箱有门户访问权限，您将收到设置新密码的链接。",
  "pwReset.forgot.submit": "发送链接",
  "pwReset.forgot.sent":
    "已完成。如果该邮箱有门户访问权限，链接将在几分钟内送达（也请查看垃圾邮件）。",
  "pwReset.forgot.rate": "请求过于频繁。请等待几分钟后重试。",
  "pwReset.forgot.invalid": "请输入有效的邮箱。",
  "pwReset.unavailable": "邮件重置密码功能尚未开启。请联系门户管理员。",
  "pwReset.back": "返回登录",
  "pwReset.reset.title": "设置新密码",
  "pwReset.reset.password": "新密码（至少 8 个字符）",
  "pwReset.reset.confirm": "再次输入新密码",
  "pwReset.reset.submit": "保存密码",
  "pwReset.reset.noToken": "请通过邮件中的链接打开此页面。",
  "pwReset.reset.done": "密码已保存。现在可以登录了。",
  "pwReset.reset.short": "密码至少需要 8 个字符。",
  "pwReset.reset.mismatch": "两次输入的密码不一致。",
  "pwReset.reset.expired": "链接已过期或已被使用。请在“忘记密码”中重新申请。",
  "pwReset.reset.failed": "无法保存密码。请重试。",
  "pwReset.reset.again": "重新申请链接",
};
