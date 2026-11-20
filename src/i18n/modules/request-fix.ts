/**
 * Dicionário do módulo "request-fix" (resolver pelo balão "Quem pode agir",
 * dono, 20/11/2026; docs/ORDER_LEVEL_LISTS.md, seção 10): o formulário curto
 * que cria o login do cliente sem nenhum acesso e os botões dos outros
 * avisos (escolher o login na encomenda, criar o acesso do parceiro, abrir
 * Funções e acessos). Mesmas chaves em pt, en e zh.
 */
export const pt = {
  "reqFix.customerLogin.title": "Criar o login de {customer}",
  "reqFix.customerLogin.titleNoName": "Criar o login do cliente",
  "reqFix.customerLogin.login": "Login ou e-mail",
  "reqFix.customerLogin.loginHint":
    "Já vem o e-mail de um contato do cliente ou um nome de usuário. Pode trocar.",
  "reqFix.customerLogin.name": "Nome",
  "reqFix.customerLogin.password": "Senha provisória",
  "reqFix.customerLogin.passwordHint":
    "Pelo menos {n} caracteres. O cliente troca no 1º acesso.",
  "reqFix.customerLogin.submit": "Criar login do cliente",
  "reqFix.customerLogin.working": "Criando…",
  "reqFix.customerLogin.done":
    "Login criado no cadastro do cliente. Passe a ele o endereço do portal, o login e a senha.",
  "reqFix.customerLogin.changeHint":
    "A senha é provisória: o cliente troca no 1º acesso. Ela não aparece de novo depois de atualizar a tela.",
  "reqFix.customerLogin.reassigned":
    "A encomenda passou a ter este login com acesso.",
  "reqFix.copy": "Copiar login e senha",
  "reqFix.copied": "Copiado",
  "reqFix.copyFailed":
    "Não deu para copiar. Anote o login e a senha que estão acima.",
  "reqFix.portal": "Portal",
  "reqFix.login": "Login",
  "reqFix.refresh": "Atualizar a tela",
  "reqFix.chooseLogin": "Escolher o login na encomenda",
  "reqFix.partnerLogin": "Criar o acesso de {name}",
  "reqFix.function": "Abrir Funções e acessos",
  "reqFix.error.forbidden": "Só o administrador cria o login do cliente.",
  "reqFix.error.not_found":
    "Encomenda ou cliente não encontrado. Atualize a tela.",
  "reqFix.error.invalid_input": "Confira o login, o nome e a senha.",
} as const;

export const en: Record<keyof typeof pt, string> = {
  "reqFix.customerLogin.title": "Create the login for {customer}",
  "reqFix.customerLogin.titleNoName": "Create the customer login",
  "reqFix.customerLogin.login": "Login or e-mail",
  "reqFix.customerLogin.loginHint":
    "Pre-filled with a customer contact's e-mail or a username. You can change it.",
  "reqFix.customerLogin.name": "Name",
  "reqFix.customerLogin.password": "Temporary password",
  "reqFix.customerLogin.passwordHint":
    "At least {n} characters. The customer changes it on first sign-in.",
  "reqFix.customerLogin.submit": "Create customer login",
  "reqFix.customerLogin.working": "Creating…",
  "reqFix.customerLogin.done":
    "Login created in the customer record. Send them the portal address, the login and the password.",
  "reqFix.customerLogin.changeHint":
    "The password is temporary: the customer changes it on first sign-in. It is not shown again after you refresh the screen.",
  "reqFix.customerLogin.reassigned":
    "This order now has this login with access.",
  "reqFix.copy": "Copy login and password",
  "reqFix.copied": "Copied",
  "reqFix.copyFailed":
    "Could not copy. Write down the login and password shown above.",
  "reqFix.portal": "Portal",
  "reqFix.login": "Login",
  "reqFix.refresh": "Refresh the screen",
  "reqFix.chooseLogin": "Choose the login on the order",
  "reqFix.partnerLogin": "Create access for {name}",
  "reqFix.function": "Open Functions and access",
  "reqFix.error.forbidden": "Only the administrator creates customer logins.",
  "reqFix.error.not_found": "Order or customer not found. Refresh the screen.",
  "reqFix.error.invalid_input": "Check the login, the name and the password.",
};

export const zh: Record<keyof typeof pt, string> = {
  "reqFix.customerLogin.title": "为 {customer} 创建登录",
  "reqFix.customerLogin.titleNoName": "创建客户登录",
  "reqFix.customerLogin.login": "登录名或电子邮箱",
  "reqFix.customerLogin.loginHint":
    "已预填客户联系人的电子邮箱或用户名，可以修改。",
  "reqFix.customerLogin.name": "名称",
  "reqFix.customerLogin.password": "临时密码",
  "reqFix.customerLogin.passwordHint": "至少 {n} 个字符。客户首次登录时修改。",
  "reqFix.customerLogin.submit": "创建客户登录",
  "reqFix.customerLogin.working": "正在创建…",
  "reqFix.customerLogin.done":
    "已在客户档案中创建登录。请把门户地址、登录名和密码发给客户。",
  "reqFix.customerLogin.changeHint":
    "这是临时密码：客户首次登录时修改。刷新页面后将不再显示。",
  "reqFix.customerLogin.reassigned": "该订单已使用此登录作为有权限的登录。",
  "reqFix.copy": "复制登录名和密码",
  "reqFix.copied": "已复制",
  "reqFix.copyFailed": "无法复制。请记下上面的登录名和密码。",
  "reqFix.portal": "门户",
  "reqFix.login": "登录名",
  "reqFix.refresh": "刷新页面",
  "reqFix.chooseLogin": "在订单中选择登录",
  "reqFix.partnerLogin": "为 {name} 创建访问权限",
  "reqFix.function": "打开职能与权限",
  "reqFix.error.forbidden": "只有管理员可以创建客户登录。",
  "reqFix.error.not_found": "未找到订单或客户。请刷新页面。",
  "reqFix.error.invalid_input": "请检查登录名、名称和密码。",
};
