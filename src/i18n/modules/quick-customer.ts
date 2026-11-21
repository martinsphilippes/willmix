/**
 * Cadastro rápido de cliente pelo "+" da Nova solicitação (dono, 21/11/2026;
 * docs/ORDER_TERMS.md, seção 11.25).
 */
export const pt = {
  "quickCustomer.open": "Cadastrar cliente novo",
  "quickCustomer.title": "Cliente novo",
  "quickCustomer.hint":
    "Digite o CNPJ: a Receita preenche o resto, e dá para corrigir antes de salvar. O cliente vai para o Sankhya e fica escolhido neste pedido; o restante do cadastro fica em Cadastros → Clientes.",
  "quickCustomer.cnpj": "CNPJ",
  "quickCustomer.name": "Nome (fantasia)",
  "quickCustomer.legalName": "Razão social",
  "quickCustomer.city": "Cidade",
  "quickCustomer.state": "UF",
  "quickCustomer.phone": "Telefone",
  "quickCustomer.email": "E-mail",
  "quickCustomer.lookup.searching": "Buscando o CNPJ na Receita…",
  "quickCustomer.lookup.found":
    "Dados da Receita preenchidos. Confira antes de salvar.",
  "quickCustomer.lookup.notFound":
    "CNPJ não encontrado na Receita: preencha os dados.",
  "quickCustomer.lookup.manual":
    "A consulta à Receita não respondeu agora: preencha os dados.",
  "quickCustomer.lookup.invalid": "CNPJ inválido: confira os 14 dígitos.",
  "quickCustomer.existing": "Este CNPJ já é do cliente {name}.",
  "quickCustomer.existingInactive":
    "Este CNPJ é do cliente {name}, que está inativo. Peça a reativação em Cadastros → Clientes.",
  "quickCustomer.useExisting": "Usar este cliente",
  "quickCustomer.save": "Cadastrar e usar no pedido",
  "quickCustomer.saving": "Cadastrando…",
  "quickCustomer.cancel": "Cancelar",
  "quickCustomer.done": "Cliente {name} cadastrado e escolhido no pedido.",
  "quickCustomer.error.name": "Informe o nome (pelo menos 2 letras).",
  "quickCustomer.error.email": "E-mail inválido.",
  "quickCustomer.error.forbidden": "Seu login não pode cadastrar clientes.",
  "quickCustomer.error.failed": "Não foi possível cadastrar. Tente de novo.",
};

export const en: Record<keyof typeof pt, string> = {
  "quickCustomer.open": "Register a new customer",
  "quickCustomer.title": "New customer",
  "quickCustomer.hint":
    "Type the CNPJ: the Federal Revenue fills in the rest, and you can correct it before saving. The customer goes to Sankhya and stays selected in this order; the rest of the record is in Records → Customers.",
  "quickCustomer.cnpj": "CNPJ",
  "quickCustomer.name": "Name (trade name)",
  "quickCustomer.legalName": "Legal name",
  "quickCustomer.city": "City",
  "quickCustomer.state": "State",
  "quickCustomer.phone": "Phone",
  "quickCustomer.email": "Email",
  "quickCustomer.lookup.searching": "Looking up the CNPJ…",
  "quickCustomer.lookup.found":
    "Federal Revenue data filled in. Check it before saving.",
  "quickCustomer.lookup.notFound":
    "CNPJ not found at the Federal Revenue: fill in the data.",
  "quickCustomer.lookup.manual":
    "The Federal Revenue lookup did not answer now: fill in the data.",
  "quickCustomer.lookup.invalid": "Invalid CNPJ: check the 14 digits.",
  "quickCustomer.existing": "This CNPJ already belongs to customer {name}.",
  "quickCustomer.existingInactive":
    "This CNPJ belongs to customer {name}, which is inactive. Ask for it to be reactivated in Records → Customers.",
  "quickCustomer.useExisting": "Use this customer",
  "quickCustomer.save": "Register and use in the order",
  "quickCustomer.saving": "Registering…",
  "quickCustomer.cancel": "Cancel",
  "quickCustomer.done": "Customer {name} registered and selected in the order.",
  "quickCustomer.error.name": "Enter the name (at least 2 letters).",
  "quickCustomer.error.email": "Invalid email.",
  "quickCustomer.error.forbidden": "Your login cannot register customers.",
  "quickCustomer.error.failed": "Could not register. Try again.",
};

export const zh: Record<keyof typeof pt, string> = {
  "quickCustomer.open": "登记新客户",
  "quickCustomer.title": "新客户",
  "quickCustomer.hint":
    "输入 CNPJ：税务局数据会自动填写其余信息，保存前可以修改。客户会发送到 Sankhya，并在本订单中选中；其余资料在 登记 → 客户 中维护。",
  "quickCustomer.cnpj": "CNPJ",
  "quickCustomer.name": "名称（商号）",
  "quickCustomer.legalName": "公司全称",
  "quickCustomer.city": "城市",
  "quickCustomer.state": "州",
  "quickCustomer.phone": "电话",
  "quickCustomer.email": "电子邮件",
  "quickCustomer.lookup.searching": "正在查询 CNPJ…",
  "quickCustomer.lookup.found": "已填入税务局数据。保存前请核对。",
  "quickCustomer.lookup.notFound": "税务局未找到该 CNPJ：请手动填写。",
  "quickCustomer.lookup.manual": "税务局查询暂时没有响应：请手动填写。",
  "quickCustomer.lookup.invalid": "CNPJ 无效：请核对 14 位数字。",
  "quickCustomer.existing": "该 CNPJ 已属于客户 {name}。",
  "quickCustomer.existingInactive":
    "该 CNPJ 属于已停用的客户 {name}。请在 登记 → 客户 中申请重新启用。",
  "quickCustomer.useExisting": "使用该客户",
  "quickCustomer.save": "登记并用于订单",
  "quickCustomer.saving": "正在登记…",
  "quickCustomer.cancel": "取消",
  "quickCustomer.done": "客户 {name} 已登记并在订单中选中。",
  "quickCustomer.error.name": "请填写名称（至少 2 个字）。",
  "quickCustomer.error.email": "电子邮件无效。",
  "quickCustomer.error.forbidden": "您的账号不能登记客户。",
  "quickCustomer.error.failed": "登记失败，请重试。",
};
