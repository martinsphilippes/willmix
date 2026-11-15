/**
 * Condições do pedido e contatos do cliente na Nova solicitação (dono,
 * 15/11/2026; docs/ORDER_TERMS.md).
 */
export const pt = {
  "orderTerms.title": "Condições do pedido",
  "orderTerms.hint":
    "Valem para todos os produtos desta solicitação. Escolha o país e o grupo antes dos produtos.",
  "orderTerms.operationType": "Tipo de operação",
  "orderTerms.operation.ts": "TS (Trading Sales)",
  "orderTerms.operation.sale": "Venda",
  "orderTerms.saleFormat": "Formato de venda",
  "orderTerms.format.wd": "WD",
  "orderTerms.format.wellmix": "Wellmix",
  "orderTerms.tier": "Formato Wellmix",
  "orderTerms.tierChoose": "Escolha o formato",
  "orderTerms.tier.pleno": "Pleno",
  "orderTerms.tier.mega": "Mega",
  "orderTerms.tier.hiper": "Hiper",
  "orderTerms.tier.ultra": "Ultra",
  "orderTerms.tier.evo": "Evo",
  "orderTerms.tier.super": "Super",
  "orderTerms.delivery": "Entrega",
  "orderTerms.carrier": "Transportador",
  "orderTerms.carrierNone": "Não escolhido",
  "orderTerms.redispatch": "Re-despacho",
  "orderTerms.redispatchNone": "Sem re-despacho",
  "orderTerms.carrierSankhya": "Sankhya",
  "orderTerms.carrierSankhyaOff":
    "Integração Sankhya não configurada: só as transportadoras do cadastro do portal.",
  "orderTerms.carrierSankhyaError":
    "Não deu para ler as transportadoras no Sankhya agora: só as do cadastro do portal.",
  "orderTerms.country": "País (de origem)",
  "orderTerms.countryChoose": "Escolha o país",
  "orderTerms.countryUnknown": "País não informado no cadastro",
  "orderTerms.group": "Grupo de produto",
  "orderTerms.groupChoose": "Escolha o grupo",
  "orderTerms.groupPickCountry": "Escolha o país primeiro",
  "orderTerms.groupNone": "Nenhum grupo com produto neste país",
  "orderTerms.originHint":
    "País do fornecedor do produto (cadastro ou Sankhya) e grupo do Sankhya. Só os produtos deste país e grupo podem entrar no pedido.",
  "orderTerms.originFirst":
    "Escolha o país de origem e o grupo de produto nas condições do pedido para buscar o produto.",
  "orderTerms.loading": "Carregando…",
  "orderTerms.error": "Não deu para carregar as opções. Recarregue a página.",
  "orderTerms.productsCount": "{n} produtos",
  "orderTerms.stock":
    "Compra para estoque: sem condições de venda nem contatos do cliente.",
  "orderTerms.disclaimerTitle": "Atenção: sem devoluções",
  "orderTerms.disclaimer":
    "Não nos responsabilizamos por defeitos ou quebras de produtos neste modelo de venda, ou seja, não há devoluções previstas para esta operação. Isto acontece, pois nosso processo prevê que o cliente seja o responsável pelas inspeções e aprovações necessárias durante o processo de produção.",
  "orderTerms.view.title": "Condições do pedido",
  "orderTerms.view.none": "—",
  "reqBatch.error.order_terms_operation":
    "Escolha o tipo de operação (TS ou Venda).",
  "reqBatch.error.order_terms_format":
    "Escolha o formato de venda (WD ou Wellmix).",
  "reqBatch.error.order_terms_tier":
    "Formato Wellmix: escolha Pleno, Mega, Hiper, Ultra, Evo ou Super.",
  "reqBatch.error.order_terms_carrier":
    "A transportadora escolhida não está mais na lista. Escolha de novo.",
  "reqBatch.error.order_terms_origin":
    "Escolha o país de origem e o grupo de produto.",
  "reqBatch.error.order_terms_invalid": "Confira as condições do pedido.",
  "reqBatch.error.order_terms_mismatch":
    "Há produto de outro país ou grupo. Um pedido só tem produtos do país e do grupo escolhidos.",
  "reqBatch.error.contacts_required":
    "Preencha os contatos do cliente (sócio, comprador, financeiro e fiscal, logística).",
  "reqBatch.error.contacts_invalid":
    "Confira os contatos do cliente: telefone com DDD e e-mail válidos em todos.",
  "reqBatch.error.contacts_same_as_seller":
    "Os contatos do cliente não podem ser iguais aos do representante ou vendedor.",
  "reqBatch.error.contacts_not_customer": "Os contatos são só de cliente.",
  "customerContacts.title": "Cliente",
  "customerContacts.intro":
    "Atualize os contatos do cliente. Ficam no cadastro dele e aparecem na próxima venda.",
  "customerContacts.pick": "Escolha o cliente no formulário.",
  "customerContacts.stock": "Compra para estoque: sem contatos do cliente.",
  "customerContacts.loading": "Buscando o cliente…",
  "customerContacts.error":
    "Não deu para buscar o cliente. Recarregue a página.",
  "customerContacts.blind":
    "Primeira atualização pelo portal: preencha todos os contatos com o cliente.",
  "customerContacts.known": "Edite o que mudou. Grava junto com a solicitação.",
  "customerContacts.updated": "Atualizados em {date} por {name}.",
  "customerContacts.edit": "Editar contatos",
  "customerContacts.cancel": "Cancelar edição",
  "customerContacts.phone": "Telefone",
  "customerContacts.email": "E-mail",
  "customerContacts.rule":
    "Os dados não podem ser iguais aos do representante ou vendedor.",
  "customerContacts.role.partner": "Sócio",
  "customerContacts.role.buyer": "Comprador",
  "customerContacts.role.finance": "Financeiro e Fiscal",
  "customerContacts.role.logistics": "Logística",
};

export const en: Record<keyof typeof pt, string> = {
  "orderTerms.title": "Order terms",
  "orderTerms.hint":
    "They apply to every product in this request. Choose the country and the group before the products.",
  "orderTerms.operationType": "Operation type",
  "orderTerms.operation.ts": "TS (Trading Sales)",
  "orderTerms.operation.sale": "Sale",
  "orderTerms.saleFormat": "Sales format",
  "orderTerms.format.wd": "WD",
  "orderTerms.format.wellmix": "Wellmix",
  "orderTerms.tier": "Wellmix format",
  "orderTerms.tierChoose": "Choose the format",
  "orderTerms.tier.pleno": "Pleno",
  "orderTerms.tier.mega": "Mega",
  "orderTerms.tier.hiper": "Hiper",
  "orderTerms.tier.ultra": "Ultra",
  "orderTerms.tier.evo": "Evo",
  "orderTerms.tier.super": "Super",
  "orderTerms.delivery": "Delivery",
  "orderTerms.carrier": "Carrier",
  "orderTerms.carrierNone": "Not chosen",
  "orderTerms.redispatch": "Redispatch",
  "orderTerms.redispatchNone": "No redispatch",
  "orderTerms.carrierSankhya": "Sankhya",
  "orderTerms.carrierSankhyaOff":
    "Sankhya integration not configured: only the carriers registered in the portal.",
  "orderTerms.carrierSankhyaError":
    "Could not read the carriers from Sankhya right now: only the portal ones.",
  "orderTerms.country": "Country (of origin)",
  "orderTerms.countryChoose": "Choose the country",
  "orderTerms.countryUnknown": "Country not registered",
  "orderTerms.group": "Product group",
  "orderTerms.groupChoose": "Choose the group",
  "orderTerms.groupPickCountry": "Choose the country first",
  "orderTerms.groupNone": "No group with products in this country",
  "orderTerms.originHint":
    "Country of the product's supplier (portal or Sankhya) and Sankhya group. Only products of this country and group can be in the order.",
  "orderTerms.originFirst":
    "Choose the country of origin and the product group in the order terms to search for the product.",
  "orderTerms.loading": "Loading…",
  "orderTerms.error": "Could not load the options. Reload the page.",
  "orderTerms.productsCount": "{n} products",
  "orderTerms.stock":
    "Stock purchase: no sales terms and no customer contacts.",
  "orderTerms.disclaimerTitle": "Attention: no returns",
  "orderTerms.disclaimer":
    "We are not responsible for product defects or breakage in this sales model, that is, no returns are foreseen for this operation. This is because our process provides that the customer is responsible for the inspections and approvals required during production.",
  "orderTerms.view.title": "Order terms",
  "orderTerms.view.none": "—",
  "reqBatch.error.order_terms_operation":
    "Choose the operation type (TS or Sale).",
  "reqBatch.error.order_terms_format":
    "Choose the sales format (WD or Wellmix).",
  "reqBatch.error.order_terms_tier":
    "Wellmix format: choose Pleno, Mega, Hiper, Ultra, Evo or Super.",
  "reqBatch.error.order_terms_carrier":
    "The chosen carrier is no longer on the list. Choose again.",
  "reqBatch.error.order_terms_origin":
    "Choose the country of origin and the product group.",
  "reqBatch.error.order_terms_invalid": "Check the order terms.",
  "reqBatch.error.order_terms_mismatch":
    "There is a product from another country or group. An order only has products of the chosen country and group.",
  "reqBatch.error.contacts_required":
    "Fill in the customer contacts (partner, buyer, finance and tax, logistics).",
  "reqBatch.error.contacts_invalid":
    "Check the customer contacts: valid phone (with area code) and e-mail in all of them.",
  "reqBatch.error.contacts_same_as_seller":
    "The customer contacts cannot be the same as the sales rep's or seller's.",
  "reqBatch.error.contacts_not_customer": "Contacts are for customers only.",
  "customerContacts.title": "Customer",
  "customerContacts.intro":
    "Update the customer contacts. They stay in the customer record and show up on the next sale.",
  "customerContacts.pick": "Choose the customer in the form.",
  "customerContacts.stock": "Stock purchase: no customer contacts.",
  "customerContacts.loading": "Looking up the customer…",
  "customerContacts.error": "Could not look up the customer. Reload the page.",
  "customerContacts.blind":
    "First update through the portal: fill in every contact with the customer.",
  "customerContacts.known": "Edit what changed. It is saved with the request.",
  "customerContacts.updated": "Updated on {date} by {name}.",
  "customerContacts.edit": "Edit contacts",
  "customerContacts.cancel": "Cancel editing",
  "customerContacts.phone": "Phone",
  "customerContacts.email": "E-mail",
  "customerContacts.rule":
    "The data cannot be the same as the sales rep's or seller's.",
  "customerContacts.role.partner": "Partner",
  "customerContacts.role.buyer": "Buyer",
  "customerContacts.role.finance": "Finance and Tax",
  "customerContacts.role.logistics": "Logistics",
};

export const zh: Record<keyof typeof pt, string> = {
  "orderTerms.title": "订单条件",
  "orderTerms.hint":
    "适用于本申请的所有产品。请先选择国家和产品组，再选择产品。",
  "orderTerms.operationType": "业务类型",
  "orderTerms.operation.ts": "TS（贸易销售）",
  "orderTerms.operation.sale": "销售",
  "orderTerms.saleFormat": "销售模式",
  "orderTerms.format.wd": "WD",
  "orderTerms.format.wellmix": "Wellmix",
  "orderTerms.tier": "Wellmix 模式",
  "orderTerms.tierChoose": "选择模式",
  "orderTerms.tier.pleno": "Pleno",
  "orderTerms.tier.mega": "Mega",
  "orderTerms.tier.hiper": "Hiper",
  "orderTerms.tier.ultra": "Ultra",
  "orderTerms.tier.evo": "Evo",
  "orderTerms.tier.super": "Super",
  "orderTerms.delivery": "交货",
  "orderTerms.carrier": "承运商",
  "orderTerms.carrierNone": "未选择",
  "orderTerms.redispatch": "转运",
  "orderTerms.redispatchNone": "无转运",
  "orderTerms.carrierSankhya": "Sankhya",
  "orderTerms.carrierSankhyaOff":
    "未配置 Sankhya 集成：仅显示门户登记的承运商。",
  "orderTerms.carrierSankhyaError":
    "暂时无法从 Sankhya 读取承运商：仅显示门户登记的承运商。",
  "orderTerms.country": "原产国",
  "orderTerms.countryChoose": "选择国家",
  "orderTerms.countryUnknown": "登记中未填写国家",
  "orderTerms.group": "产品组",
  "orderTerms.groupChoose": "选择产品组",
  "orderTerms.groupPickCountry": "请先选择国家",
  "orderTerms.groupNone": "该国家没有含产品的产品组",
  "orderTerms.originHint":
    "产品供应商所在国家（门户或 Sankhya）和 Sankhya 产品组。订单中只能包含该国家和产品组的产品。",
  "orderTerms.originFirst": "请先在订单条件中选择原产国和产品组，再搜索产品。",
  "orderTerms.loading": "加载中…",
  "orderTerms.error": "无法加载选项，请刷新页面。",
  "orderTerms.productsCount": "{n} 个产品",
  "orderTerms.stock": "库存采购：无销售条件，也无客户联系人。",
  "orderTerms.disclaimerTitle": "注意：不予退货",
  "orderTerms.disclaimer":
    "在此销售模式下，我们不对产品缺陷或破损负责，即本业务不提供退货。这是因为我们的流程规定，客户负责生产过程中所需的检验和确认。",
  "orderTerms.view.title": "订单条件",
  "orderTerms.view.none": "—",
  "reqBatch.error.order_terms_operation": "请选择业务类型（TS 或销售）。",
  "reqBatch.error.order_terms_format": "请选择销售模式（WD 或 Wellmix）。",
  "reqBatch.error.order_terms_tier":
    "Wellmix 模式：请选择 Pleno、Mega、Hiper、Ultra、Evo 或 Super。",
  "reqBatch.error.order_terms_carrier": "所选承运商已不在列表中，请重新选择。",
  "reqBatch.error.order_terms_origin": "请选择原产国和产品组。",
  "reqBatch.error.order_terms_invalid": "请检查订单条件。",
  "reqBatch.error.order_terms_mismatch":
    "有来自其他国家或产品组的产品。订单只能包含所选国家和产品组的产品。",
  "reqBatch.error.contacts_required":
    "请填写客户联系人（股东、采购、财务和税务、物流）。",
  "reqBatch.error.contacts_invalid":
    "请检查客户联系人：每项都需有效的电话（含区号）和邮箱。",
  "reqBatch.error.contacts_same_as_seller":
    "客户联系人不能与代表或销售员的相同。",
  "reqBatch.error.contacts_not_customer": "联系人仅适用于客户。",
  "customerContacts.title": "客户",
  "customerContacts.intro":
    "更新客户联系人。信息保存在客户档案中，下次销售时显示。",
  "customerContacts.pick": "请在表单中选择客户。",
  "customerContacts.stock": "库存采购：无客户联系人。",
  "customerContacts.loading": "正在查找客户…",
  "customerContacts.error": "无法查找客户，请刷新页面。",
  "customerContacts.blind": "首次通过门户更新：请与客户一起填写所有联系人。",
  "customerContacts.known": "修改有变化的内容，随申请一起保存。",
  "customerContacts.updated": "{name} 于 {date} 更新。",
  "customerContacts.edit": "编辑联系人",
  "customerContacts.cancel": "取消编辑",
  "customerContacts.phone": "电话",
  "customerContacts.email": "邮箱",
  "customerContacts.rule": "这些信息不能与代表或销售员的相同。",
  "customerContacts.role.partner": "股东",
  "customerContacts.role.buyer": "采购",
  "customerContacts.role.finance": "财务和税务",
  "customerContacts.role.logistics": "物流",
};
