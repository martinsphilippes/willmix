/**
 * Dicionário do módulo "portal-access" (acesso ao portal preso ao cadastro,
 * pedido do dono em 10/11/2026): aviso no Booking de fornecedor sem login,
 * o quadro "Usuários" do cadastro, o login por nome de usuário (sem e-mail),
 * o quadro "Perfil" do cadastro e os erros da criação do login. Mesmas
 * chaves em pt, en e zh.
 */
export const pt = {
  "portalAccess.login.field": "Login ou e-mail",
  "portalAccess.login.label": "Login",
  "portalAccess.login.hint":
    "Nome de usuário, sem espaços: letras, números, ponto ou hífen. Não precisa de e-mail.",
  "portalAccess.copy": "Copiar login e senha",
  "portalAccess.copied": "Copiado",
  "portalAccess.copy.empty": "Preencha o login e a senha antes de copiar.",
  "portalAccess.copy.portal": "Portal",
  "portalAccess.copy.hint":
    "Copie antes de criar e mande para a pessoa: a senha não aparece de novo depois.",
  "portalAccess.saved.login":
    "Acesso criado e preso a {name}. Login: {login}. Passe para a pessoa o endereço do portal, o login e a senha.",
  "catalog.error.user_login_invalid":
    "Login inválido. Use de 3 a 40 letras minúsculas, números, ponto ou hífen, sem espaços (ou um e-mail).",
  "partyProfile.title": "Perfil",
  "partyProfile.identity": "Quem é",
  "partyProfile.store": "Loja e endereço",
  "partyProfile.contact": "Contato",
  "partyProfile.access": "Acesso ao portal",
  "partyProfile.active": "Ativo",
  "partyProfile.inactive": "Inativo",
  "partyProfile.since": "Cadastrado em",
  "partyProfile.owner": "Responsável na Wellmix",
  "partyProfile.products": "Produtos",
  "partyProfile.card": "Cartão do fabricante",
  "partyProfile.cardOpen": "Abrir o cartão",
  "partyProfile.cardStore": "Loja (no cartão)",
  "partyProfile.cardFactory": "Fábrica (no cartão)",
  "partyProfile.passwordNote":
    "A senha não fica à vista: é a que foi passada na criação do acesso.",
  "portalAccess.none": "Sem acesso",
  "portalAccess.booking.title":
    "Fornecedor do Book sem acesso ao portal: não consegue ver nem responder.",
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
  "portalAccess.password.hint":
    "Pelo menos {n} caracteres. Já vem uma sugestão; pode trocar.",
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
  "portalAccess.login.field": "Login or email",
  "portalAccess.login.label": "Login",
  "portalAccess.login.hint":
    "User name, no spaces: letters, numbers, dot or hyphen. No e-mail needed.",
  "portalAccess.copy": "Copy login and password",
  "portalAccess.copied": "Copied",
  "portalAccess.copy.empty":
    "Fill in the login and the password before copying.",
  "portalAccess.copy.portal": "Portal",
  "portalAccess.copy.hint":
    "Copy before creating and send it to the person: the password is not shown again.",
  "portalAccess.saved.login":
    "Access created and tied to {name}. Login: {login}. Give the person the portal address, the login and the password.",
  "catalog.error.user_login_invalid":
    "Invalid login. Use 3 to 40 lowercase letters, numbers, dot or hyphen, no spaces (or an e-mail).",
  "partyProfile.title": "Profile",
  "partyProfile.identity": "Who it is",
  "partyProfile.store": "Store and address",
  "partyProfile.contact": "Contact",
  "partyProfile.access": "Portal access",
  "partyProfile.active": "Active",
  "partyProfile.inactive": "Inactive",
  "partyProfile.since": "Registered on",
  "partyProfile.owner": "Wellmix owner",
  "partyProfile.products": "Products",
  "partyProfile.card": "Manufacturer card",
  "partyProfile.cardOpen": "Open the card",
  "partyProfile.cardStore": "Store (on the card)",
  "partyProfile.cardFactory": "Factory (on the card)",
  "partyProfile.passwordNote":
    "The password is not shown: it is the one given when the access was created.",
  "portalAccess.none": "No access",
  "portalAccess.booking.title":
    "Book supplier without portal access: cannot see or answer.",
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
  "portalAccess.password.hint":
    "At least {n} characters. A suggestion is filled in; you can change it.",
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
  "portalAccess.login.field": "登录名或邮箱",
  "portalAccess.login.label": "登录名",
  "portalAccess.login.hint":
    "用户名，不含空格：字母、数字、点或连字符。无需邮箱。",
  "portalAccess.copy": "复制登录名和密码",
  "portalAccess.copied": "已复制",
  "portalAccess.copy.empty": "请先填写登录名和密码再复制。",
  "portalAccess.copy.portal": "门户",
  "portalAccess.copy.hint": "请在创建前复制并发给对方：之后密码不再显示。",
  "portalAccess.saved.login":
    "账号已创建并绑定到 {name}。登录名：{login}。请把门户地址、登录名和密码告知对方。",
  "catalog.error.user_login_invalid":
    "登录名无效。请使用 3 到 40 个小写字母、数字、点或连字符，不含空格（或邮箱）。",
  "partyProfile.title": "资料",
  "partyProfile.identity": "基本信息",
  "partyProfile.store": "店铺与地址",
  "partyProfile.contact": "联系方式",
  "partyProfile.access": "门户账号",
  "partyProfile.active": "启用",
  "partyProfile.inactive": "未启用",
  "partyProfile.since": "建档日期",
  "partyProfile.owner": "Wellmix 负责人",
  "partyProfile.products": "产品",
  "partyProfile.card": "厂家名片",
  "partyProfile.cardOpen": "打开名片",
  "partyProfile.cardStore": "店铺（名片）",
  "partyProfile.cardFactory": "工厂（名片）",
  "partyProfile.passwordNote": "密码不显示：即创建账号时提供的密码。",
  "portalAccess.none": "无账号",
  "portalAccess.booking.title":
    "Book 中的供应商没有门户账号：无法查看，也无法回复。",
  "portalAccess.booking.hint":
    "点击名称创建账号。账号绑定在该供应商的档案上，登录后即可看到已发送的内容。",
  "portalAccess.booking.noScreen": "请让负责档案的同事为这些供应商创建账号。",
  "portalAccess.create": "创建账号",
  "portalAccess.party.none": "该档案还没有门户账号。请在下方创建。",
  "portalAccess.party.linked":
    "在此创建的账号绑定到 {name}：登录后只能看到属于该档案的内容。",
  "portalAccess.party.inactive": "未启用",
  "portalAccess.password.hint": "至少 {n} 个字符。已填入建议密码，可修改。",
  "portalAccess.saved":
    "账号已创建并绑定到 {name}。请把门户地址、邮箱和您输入的密码告知对方。",
  "catalog.error.user_email_taken":
    "该邮箱已有门户账号。请换一个邮箱，或查找已有的登录。",
  "catalog.error.user_password_short": "密码至少需要 8 个字符。",
  "catalog.error.user_party_required": "合作方账号必须在档案内创建。",
  "catalog.error.user_role_mismatch": "账号的角色必须与该档案的类型一致。",
};
