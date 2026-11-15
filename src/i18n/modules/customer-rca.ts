/**
 * RCA do cliente (dono, 15/11/2026; docs/CUSTOMER_RCA.md): o campo "RCA
 * responsável" no cadastro do cliente e os campos Solicitante, RCA do
 * cliente e Login do cliente com acesso na Nova solicitação.
 */
export const pt = {
  "rca.field": "RCA responsável",
  "rca.none": "Sem RCA",
  "rca.inactive": "{name} (inativo)",
  "rca.unknown": "Vendedor {code} (fora da lista)",
  "rca.hint":
    "Vendedor do Sankhya. A carga do Sankhya substitui o que for escolhido aqui.",
  "rca.listDate": "Lista do Sankhya de {date}: {n} vendedores.",
  "rca.listEmpty": "A lista de vendedores ainda não veio do Sankhya.",
  "rca.listDemo":
    "Lista de demonstração: {n} vendedores (no portal real ela vem do Sankhya).",
  "rca.refresh": "Trazer a lista do Sankhya",
  "rca.refreshing": "Buscando no Sankhya…",
  "rca.refreshed": "Lista de RCAs atualizada: {n} vendedores do Sankhya.",
  "catalog.error.rca_sankhya":
    "Não deu para ler os vendedores no Sankhya. Confira a integração em Configurações → Integração Sankhya.",
  "catalog.error.rca_not_customer": "O RCA é só do cadastro de cliente.",
  "requestPeople.requester": "Solicitante",
  "requestPeople.requesterHint":
    "Quem está criando a solicitação: o seu login. O portal grava pela sessão.",
  "requestPeople.rca": "RCA do cliente",
  "requestPeople.rcaHint":
    "Do cadastro do cliente (vendedor do Sankhya). Só consulta nesta tela.",
  "requestPeople.rcaNone": "Sem RCA vinculado",
  "requestPeople.rcaPick": "Escolha o cliente para ver o RCA.",
  "requestPeople.rcaLoading": "Buscando o RCA…",
  "requestPeople.rcaError": "Não deu para buscar o RCA.",
  "requestPeople.rcaStock": "Compra para estoque: sem RCA.",
  "requestPeople.rcaUnknown": "Vendedor {code}",
  "requestPeople.access": "Login do cliente com acesso",
  "requestPeople.accessHint":
    "Só este login do cliente verá a solicitação e o pedido; outros logins da mesma empresa não veem. Sem login escolhido, só a Wellmix vê.",
  "requestPeople.accessNone": "Nenhum (só a Wellmix vê)",
  "requestPeople.accessPick": "Escolha o cliente primeiro.",
  "requestPeople.accessNoLogins": "Este cliente não tem login no portal.",
  "requestPeople.accessStock": "Compra para estoque: sem acesso de cliente.",
  "requestPeople.self": "O seu login: você vê a solicitação e o pedido.",
} as const;

export const en: Record<keyof typeof pt, string> = {
  "rca.field": "Responsible sales rep (RCA)",
  "rca.none": "No sales rep",
  "rca.inactive": "{name} (inactive)",
  "rca.unknown": "Seller {code} (not in the list)",
  "rca.hint":
    "Seller from Sankhya. The Sankhya load replaces what is chosen here.",
  "rca.listDate": "Sankhya list from {date}: {n} sellers.",
  "rca.listEmpty": "The seller list has not been brought from Sankhya yet.",
  "rca.listDemo":
    "Demo list: {n} sellers (in the real portal it comes from Sankhya).",
  "rca.refresh": "Bring the list from Sankhya",
  "rca.refreshing": "Fetching from Sankhya…",
  "rca.refreshed": "Sales rep list updated: {n} sellers from Sankhya.",
  "catalog.error.rca_sankhya":
    "Could not read the sellers in Sankhya. Check the integration in Settings → Sankhya integration.",
  "catalog.error.rca_not_customer":
    "The sales rep only applies to customer records.",
  "requestPeople.requester": "Requester",
  "requestPeople.requesterHint":
    "Who is creating the request: your login. The portal records it from the session.",
  "requestPeople.rca": "Customer's sales rep (RCA)",
  "requestPeople.rcaHint":
    "From the customer record (Sankhya seller). Read-only on this screen.",
  "requestPeople.rcaNone": "No sales rep linked",
  "requestPeople.rcaPick": "Choose the customer to see the sales rep.",
  "requestPeople.rcaLoading": "Loading the sales rep…",
  "requestPeople.rcaError": "Could not load the sales rep.",
  "requestPeople.rcaStock": "Stock purchase: no sales rep.",
  "requestPeople.rcaUnknown": "Seller {code}",
  "requestPeople.access": "Customer login with access",
  "requestPeople.accessHint":
    "Only this customer login will see the request and the order; other logins of the same company do not. With no login chosen, only Wellmix sees it.",
  "requestPeople.accessNone": "None (only Wellmix sees it)",
  "requestPeople.accessPick": "Choose the customer first.",
  "requestPeople.accessNoLogins": "This customer has no portal login.",
  "requestPeople.accessStock": "Stock purchase: no customer access.",
  "requestPeople.self": "Your login: you see the request and the order.",
};

export const zh: Record<keyof typeof pt, string> = {
  "rca.field": "负责的销售代表 (RCA)",
  "rca.none": "无销售代表",
  "rca.inactive": "{name}（停用）",
  "rca.unknown": "销售员 {code}（不在列表中）",
  "rca.hint": "Sankhya 的销售员。Sankhya 同步会覆盖此处的选择。",
  "rca.listDate": "Sankhya 列表（{date}）：{n} 名销售员。",
  "rca.listEmpty": "尚未从 Sankhya 获取销售员列表。",
  "rca.listDemo": "演示列表：{n} 名销售员（正式门户中来自 Sankhya）。",
  "rca.refresh": "从 Sankhya 获取列表",
  "rca.refreshing": "正在从 Sankhya 获取…",
  "rca.refreshed": "销售代表列表已更新：Sankhya 中 {n} 名销售员。",
  "catalog.error.rca_sankhya":
    "无法读取 Sankhya 中的销售员。请在 设置 → Sankhya 集成 中检查集成。",
  "catalog.error.rca_not_customer": "销售代表只适用于客户档案。",
  "requestPeople.requester": "申请人",
  "requestPeople.requesterHint": "创建申请的人：您的账号。系统按登录会话记录。",
  "requestPeople.rca": "客户的销售代表 (RCA)",
  "requestPeople.rcaHint": "来自客户档案（Sankhya 销售员）。此处仅供查看。",
  "requestPeople.rcaNone": "未关联销售代表",
  "requestPeople.rcaPick": "请选择客户以查看销售代表。",
  "requestPeople.rcaLoading": "正在获取销售代表…",
  "requestPeople.rcaError": "无法获取销售代表。",
  "requestPeople.rcaStock": "库存采购：无销售代表。",
  "requestPeople.rcaUnknown": "销售员 {code}",
  "requestPeople.access": "有访问权限的客户账号",
  "requestPeople.accessHint":
    "只有该客户账号可以查看申请和订单；同公司的其他账号看不到。未选择账号时，仅 Wellmix 可见。",
  "requestPeople.accessNone": "无（仅 Wellmix 可见）",
  "requestPeople.accessPick": "请先选择客户。",
  "requestPeople.accessNoLogins": "该客户没有门户账号。",
  "requestPeople.accessStock": "库存采购：无客户访问。",
  "requestPeople.self": "您的账号：您可以查看申请和订单。",
};
