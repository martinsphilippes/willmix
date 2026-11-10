/**
 * Dicionário do módulo "portal-access" (acesso ao portal preso ao cadastro,
 * pedido do dono em 10/11/2026): aviso no Booking de fornecedor sem login,
 * o quadro "Usuários" do cadastro e os erros da criação do login. Mesmas
 * chaves em pt, en e zh.
 */
export const pt = {
  "portalAccess.none": "Sem acesso",
  "portalAccess.booking.title":
    "Fornecedor do Booking sem acesso ao portal: não consegue ver nem responder.",
  "portalAccess.booking.hint":
    "Toque no nome para criar o acesso. Ele fica preso ao cadastro do fornecedor, e o que já foi enviado aparece para ele assim que entrar.",
  "portalAccess.booking.noScreen":
    "Peça a quem cuida de Cadastros para criar o acesso destes fornecedores.",
  "portalAccess.create": "Criar acesso",
  "portalAccess.party.none":
    "Este cadastro ainda não tem acesso ao portal. Crie abaixo.",
  "portalAccess.party.linked":
    "O acesso criado aqui fica preso a {name}: a pessoa entra e vê só o que é deste cadastro.",
  "portalAccess.party.inactive": "Inativo",
  "portalAccess.password.hint": "Pelo menos {n} caracteres.",
  "portalAccess.saved":
    "Acesso criado e preso a {name}. Passe para a pessoa o endereço do portal, o e-mail e a senha que você digitou.",
  "catalog.error.user_email_taken":
    "Este e-mail já tem acesso ao portal. Use outro e-mail ou procure o login que já existe.",
  "catalog.error.user_password_short":
    "A senha precisa ter pelo menos 8 caracteres.",
  "catalog.error.user_party_required":
    "O acesso de parceiro precisa nascer dentro de um cadastro.",
  "catalog.error.user_role_mismatch":
    "A função do acesso precisa ser a do tipo deste cadastro.",
};

export const en: Record<keyof typeof pt, string> = {
  "portalAccess.none": "No access",
  "portalAccess.booking.title":
    "Booking supplier without portal access: cannot see or answer.",
  "portalAccess.booking.hint":
    "Tap the name to create the access. It stays tied to the supplier record, and what was already sent shows up as soon as they sign in.",
  "portalAccess.booking.noScreen":
    "Ask whoever manages Records to create the access for these suppliers.",
  "portalAccess.create": "Create access",
  "portalAccess.party.none":
    "This record has no portal access yet. Create it below.",
  "portalAccess.party.linked":
    "Access created here stays tied to {name}: the person signs in and sees only what belongs to this record.",
  "portalAccess.party.inactive": "Inactive",
  "portalAccess.password.hint": "At least {n} characters.",
  "portalAccess.saved":
    "Access created and tied to {name}. Give the person the portal address, the e-mail and the password you typed.",
  "catalog.error.user_email_taken":
    "This e-mail already has portal access. Use another e-mail or find the existing login.",
  "catalog.error.user_password_short":
    "The password needs at least 8 characters.",
  "catalog.error.user_party_required":
    "A partner access must be created inside a record.",
  "catalog.error.user_role_mismatch":
    "The role of the access must match the type of this record.",
};

export const zh: Record<keyof typeof pt, string> = {
  "portalAccess.none": "无账号",
  "portalAccess.booking.title":
    "Booking 中的供应商没有门户账号：无法查看，也无法回复。",
  "portalAccess.booking.hint":
    "点击名称创建账号。账号绑定在该供应商的档案上，登录后即可看到已发送的内容。",
  "portalAccess.booking.noScreen": "请让负责档案的同事为这些供应商创建账号。",
  "portalAccess.create": "创建账号",
  "portalAccess.party.none": "该档案还没有门户账号。请在下方创建。",
  "portalAccess.party.linked":
    "在此创建的账号绑定到 {name}：登录后只能看到属于该档案的内容。",
  "portalAccess.party.inactive": "未启用",
  "portalAccess.password.hint": "至少 {n} 个字符。",
  "portalAccess.saved":
    "账号已创建并绑定到 {name}。请把门户地址、邮箱和您输入的密码告知对方。",
  "catalog.error.user_email_taken":
    "该邮箱已有门户账号。请换一个邮箱，或查找已有的登录。",
  "catalog.error.user_password_short": "密码至少需要 8 个字符。",
  "catalog.error.user_party_required": "合作方账号必须在档案内创建。",
  "catalog.error.user_role_mismatch": "账号的角色必须与该档案的类型一致。",
};
