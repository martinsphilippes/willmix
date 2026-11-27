/**
 * Inner exigido pelo cliente, catálogo de materiais, "Sem peso" e a tela da
 * cotação em duas colunas (dono, 21/11/2026; docs/PURCHASE_DEMAND.md, "Inner
 * do cliente, material do catálogo e Sem peso"). Mesmas chaves em pt, en e zh.
 */
export const pt = {
  "nav.materials": "Materiais",
  // Nova solicitação
  "reqInner.title": "Caixa inner exigida pelo cliente",
  "reqInner.no": "Não",
  "reqInner.yes": "Sim",
  "reqInner.qty": "Peças por inner",
  "reqInner.hint":
    "Com Sim, a consulta de compra mostra ao fornecedor como exigência do cliente, travada.",
  "reqInner.catalog": "Cadastro do produto: {n} por inner (não marca sozinho).",
  "reqBatch.error.inner_qty_required":
    "Informe as peças por inner do produto em que o cliente exige caixa inner.",
  // Cotação: o fornecedor
  "quote.notice.title": "Atualização da ficha do produto",
  "quote.notice.body":
    "Nesta consulta, solicitamos novamente os dados técnicos para atualizar as informações dos produtos da Wellmix. Informe os dados do produto e da embalagem que serão fornecidos.",
  "quote.terms.title": "Termos comerciais",
  "quote.f.master": "Peças por caixa master",
  "quote.f.code": "Código na fábrica",
  "quote.f.material": "Material",
  "quote.f.length": "Comprimento (cm)",
  "quote.f.width": "Largura (cm)",
  "quote.f.height": "Altura (cm)",
  "quote.f.cbm": "CBM por caixa (m³)",
  "quote.f.net": "Peso líquido por peça (kg)",
  "quote.f.gross": "Peso bruto da caixa master (kg)",
  "quote.sheet.grossUnknown": "Sem peso",
  "quote.sheet.grossUnknownHint":
    "Marque se você não sabe informar o peso bruto.",
  "quote.sheet.grossNotGiven": "Peso bruto não informado",
  "quote.sheet.grossUnknownDeclared": "Sem peso (declarado)",
  "quote.sheet.inner": "Peças por inner",
  "quote.sheet.innerRequired": "Exigência do cliente",
  "quote.sheet.innerRequiredHint":
    "Não dá para mudar aqui. Se não puder atender, explique na observação.",
  "quote.sheet.innerPending":
    "Caixa inner: a Wellmix vai confirmar a quantidade.",
  "quote.material.placeholder": "Buscar material cadastrado",
  "quote.material.empty": "Nenhum material encontrado.",
  "quote.material.missing":
    "Não achou o material? Fale com a Wellmix pela conversa da consulta.",
  "quote.material.legacy":
    "Material digitado antes: {text}. Escolha no catálogo.",
  "quote.material.remove": "Tirar {name}",
  "quote.material.outside": "fora do catálogo, revisar",
  "quote.error.material_not_in_catalog":
    "Escolha o material na lista do catálogo.",
  "quote.error.quote_inner_invalid":
    "Informe as peças por inner com um número inteiro maior que zero.",
  "quote.error.quote_item_not_found": "Produto não encontrado na consulta.",
  // Cotação: a Wellmix define o inner
  "quote.inner.col": "Inner exigido",
  "quote.inner.required": "{n} peças por inner (exigência do cliente)",
  "quote.inner.none": "Sem exigência",
  "quote.inner.pendingTitle": "Caixa inner a definir",
  "quote.inner.missing":
    "{product}: o cliente exige caixa inner, mas a encomenda veio sem a quantidade.",
  "quote.inner.conflict":
    "{product}: as encomendas exigem inner diferentes ({values}).",
  "quote.inner.noneValue": "sem inner",
  "quote.inner.pendingHint":
    'Enquanto não define, o fornecedor vê "a Wellmix vai confirmar" e pode responder.',
  "quote.inner.qty": "Peças por inner",
  "quote.inner.set": "Definir o inner",
  "quote.inner.setNone": "Não exigir inner",
  "quote.inner.setDone":
    "Caixa inner definida. Os fornecedores já veem a exigência; quem já respondeu pode corrigir no prazo.",
  "quote.inner.setBy": "Definida pela Wellmix em {date}.",
  "quote.notice.inner":
    "Caixa inner definida. Os fornecedores já veem a exigência; quem já respondeu pode corrigir no prazo.",
  "tasks.group.purchase_quote_inner": "Caixa inner da consulta a definir",
  // Catálogo de materiais
  "materials.title": "Materiais",
  "materials.subtitle":
    "A lista que o fornecedor escolhe na ficha técnica da consulta, sem texto livre. Nasceu da Composição dos produtos do Sankhya; ajuste os nomes e desative o que não serve.",
  "materials.col.pt": "Português",
  "materials.col.en": "Inglês",
  "materials.col.zh": "Chinês",
  "materials.col.status": "Situação",
  "materials.active": "Ativo",
  "materials.inactive": "Inativo",
  "materials.add": "Incluir material",
  "materials.save": "Salvar",
  "materials.edit": "Editar",
  "materials.cancel": "Cancelar",
  "materials.deactivate": "Desativar",
  "materials.activate": "Reativar",
  "materials.search": "Buscar material",
  "materials.showActive": "Só os ativos",
  "materials.showAll": "Mostrar também os inativos ({n})",
  "materials.count": "{n} materiais, {active} ativos",
  "materials.created": "Material incluído.",
  "materials.updated": "Material salvo.",
  "materials.toggled": "Situação do material alterada.",
  "materials.readOnly": "Só o Cadastro (ou o administrador) altera esta lista.",
  "materials.review.title": "Fichas com material fora do catálogo",
  "materials.review.hint":
    "Fichas técnicas de antes do catálogo (material digitado) ou com um material desativado. Nada foi apagado: confira e, se for o caso, inclua o material no catálogo.",
  "materials.review.empty": "Nenhuma ficha para revisar.",
  "materials.review.col.product": "Produto",
  "materials.review.col.supplier": "Fornecedor",
  "materials.review.col.material": "Material na ficha",
  "materials.error.material_names_required":
    "Preencha o nome nos três idiomas.",
  "materials.error.material_duplicate": "Já existe um material com este nome.",
  "materials.error.material_not_found": "Material não encontrado.",
  "action.materials.manage": "Manter o catálogo de materiais",
  "action.desc.materials.manage":
    "Incluir, renomear, desativar e reativar os materiais que o fornecedor escolhe na ficha técnica da consulta.",
};

export const en: Record<keyof typeof pt, string> = {
  "nav.materials": "Materials",
  "reqInner.title": "Inner box required by the customer",
  "reqInner.no": "No",
  "reqInner.yes": "Yes",
  "reqInner.qty": "Pieces per inner box",
  "reqInner.hint":
    "With Yes, the purchase inquiry shows it to the supplier as a locked customer requirement.",
  "reqInner.catalog":
    "Product record: {n} per inner box (not selected automatically).",
  "reqBatch.error.inner_qty_required":
    "Enter the pieces per inner box for the product where the customer requires an inner box.",
  "quote.notice.title": "Product sheet update",
  "quote.notice.body":
    "In this inquiry we are asking again for the technical data to update Wellmix's product information. Enter the product and packaging data that will be supplied.",
  "quote.terms.title": "Commercial terms",
  "quote.f.master": "Pieces per master carton",
  "quote.f.code": "Factory code",
  "quote.f.material": "Material",
  "quote.f.length": "Length (cm)",
  "quote.f.width": "Width (cm)",
  "quote.f.height": "Height (cm)",
  "quote.f.cbm": "CBM per carton (m³)",
  "quote.f.net": "Net weight per piece (kg)",
  "quote.f.gross": "Gross weight per master carton (kg)",
  "quote.sheet.grossUnknown": "No weight",
  "quote.sheet.grossUnknownHint":
    "Tick this if you cannot provide the gross weight.",
  "quote.sheet.grossNotGiven": "Gross weight not provided",
  "quote.sheet.grossUnknownDeclared": "No weight (declared)",
  "quote.sheet.inner": "Pieces per inner box",
  "quote.sheet.innerRequired": "Customer requirement",
  "quote.sheet.innerRequiredHint":
    "It cannot be changed here. If you cannot meet it, explain in the note.",
  "quote.sheet.innerPending": "Inner box: Wellmix will confirm the quantity.",
  "quote.material.placeholder": "Search registered materials",
  "quote.material.empty": "No material found.",
  "quote.material.missing":
    "Can't find the material? Talk to Wellmix in the inquiry chat.",
  "quote.material.legacy":
    "Material typed before: {text}. Choose from the catalogue.",
  "quote.material.remove": "Remove {name}",
  "quote.material.outside": "outside the catalogue, review",
  "quote.error.material_not_in_catalog":
    "Choose the material from the catalogue list.",
  "quote.error.quote_inner_invalid":
    "Enter the pieces per inner box as a whole number greater than zero.",
  "quote.error.quote_item_not_found": "Product not found in the inquiry.",
  "quote.inner.col": "Required inner box",
  "quote.inner.required": "{n} pieces per inner box (customer requirement)",
  "quote.inner.none": "No requirement",
  "quote.inner.pendingTitle": "Inner box to define",
  "quote.inner.missing":
    "{product}: the customer requires an inner box, but the order came without the quantity.",
  "quote.inner.conflict":
    "{product}: the orders require different inner boxes ({values}).",
  "quote.inner.noneValue": "no inner",
  "quote.inner.pendingHint":
    'Until you define it, the supplier sees "Wellmix will confirm" and can still answer.',
  "quote.inner.qty": "Pieces per inner box",
  "quote.inner.set": "Set the inner box",
  "quote.inner.setNone": "Do not require an inner box",
  "quote.inner.setDone":
    "Inner box set. Suppliers already see the requirement; those who answered can correct it before the deadline.",
  "quote.inner.setBy": "Set by Wellmix on {date}.",
  "quote.notice.inner":
    "Inner box set. Suppliers already see the requirement; those who answered can correct it before the deadline.",
  "tasks.group.purchase_quote_inner": "Quote inner box to define",
  "materials.title": "Materials",
  "materials.subtitle":
    "The list the supplier chooses from in the inquiry's technical sheet, with no free text. It came from the Composition of the Sankhya products; adjust the names and deactivate what doesn't fit.",
  "materials.col.pt": "Portuguese",
  "materials.col.en": "English",
  "materials.col.zh": "Chinese",
  "materials.col.status": "Status",
  "materials.active": "Active",
  "materials.inactive": "Inactive",
  "materials.add": "Add material",
  "materials.save": "Save",
  "materials.edit": "Edit",
  "materials.cancel": "Cancel",
  "materials.deactivate": "Deactivate",
  "materials.activate": "Reactivate",
  "materials.search": "Search material",
  "materials.showActive": "Active only",
  "materials.showAll": "Also show inactive ({n})",
  "materials.count": "{n} materials, {active} active",
  "materials.created": "Material added.",
  "materials.updated": "Material saved.",
  "materials.toggled": "Material status changed.",
  "materials.readOnly":
    "Only Product records (or the administrator) can change this list.",
  "materials.review.title": "Sheets with a material outside the catalogue",
  "materials.review.hint":
    "Technical sheets from before the catalogue (typed material) or citing a deactivated material. Nothing was deleted: check them and, if needed, add the material to the catalogue.",
  "materials.review.empty": "No sheets to review.",
  "materials.review.col.product": "Product",
  "materials.review.col.supplier": "Supplier",
  "materials.review.col.material": "Material on the sheet",
  "materials.error.material_names_required":
    "Fill in the name in the three languages.",
  "materials.error.material_duplicate":
    "A material with this name already exists.",
  "materials.error.material_not_found": "Material not found.",
  "action.materials.manage": "Maintain the materials catalogue",
  "action.desc.materials.manage":
    "Add, rename, deactivate and reactivate the materials the supplier chooses in the inquiry's technical sheet.",
};

export const zh: Record<keyof typeof pt, string> = {
  "nav.materials": "材料",
  "reqInner.title": "客户要求的内盒",
  "reqInner.no": "否",
  "reqInner.yes": "是",
  "reqInner.qty": "每内盒件数",
  "reqInner.hint": "选“是”后，采购询盘会把它作为客户要求（锁定）显示给供应商。",
  "reqInner.catalog": "产品档案：每内盒 {n} 件（不会自动选择）。",
  "reqBatch.error.inner_qty_required": "请为客户要求内盒的产品填写每内盒件数。",
  "quote.notice.title": "产品资料更新",
  "quote.notice.body":
    "本次询盘我们再次请您提供技术资料，以更新 Wellmix 的产品信息。请填写将要供应的产品和包装数据。",
  "quote.terms.title": "商务条款",
  "quote.f.master": "每外箱件数",
  "quote.f.code": "工厂编码",
  "quote.f.material": "材质",
  "quote.f.length": "长 (cm)",
  "quote.f.width": "宽 (cm)",
  "quote.f.height": "高 (cm)",
  "quote.f.cbm": "每箱体积 (m³)",
  "quote.f.net": "单件净重 (kg)",
  "quote.f.gross": "外箱毛重 (kg)",
  "quote.sheet.grossUnknown": "无重量",
  "quote.sheet.grossUnknownHint": "如果您无法提供毛重，请勾选。",
  "quote.sheet.grossNotGiven": "未提供毛重",
  "quote.sheet.grossUnknownDeclared": "无重量（已声明）",
  "quote.sheet.inner": "每内盒件数",
  "quote.sheet.innerRequired": "客户要求",
  "quote.sheet.innerRequiredHint": "此处不能修改。如无法满足，请在备注中说明。",
  "quote.sheet.innerPending": "内盒：Wellmix 将确认数量。",
  "quote.material.placeholder": "搜索已登记的材料",
  "quote.material.empty": "未找到材料。",
  "quote.material.missing": "找不到材料？请通过询盘对话联系 Wellmix。",
  "quote.material.legacy": "之前填写的材料：{text}。请从目录中选择。",
  "quote.material.remove": "移除 {name}",
  "quote.material.outside": "不在目录中，需复核",
  "quote.error.material_not_in_catalog": "请从目录列表中选择材料。",
  "quote.error.quote_inner_invalid": "请用大于零的整数填写每内盒件数。",
  "quote.error.quote_item_not_found": "询盘中未找到该产品。",
  "quote.inner.col": "要求的内盒",
  "quote.inner.required": "每内盒 {n} 件（客户要求）",
  "quote.inner.none": "无要求",
  "quote.inner.pendingTitle": "内盒待确定",
  "quote.inner.missing": "{product}：客户要求内盒，但订单没有填写数量。",
  "quote.inner.conflict": "{product}：各订单要求的内盒不同（{values}）。",
  "quote.inner.noneValue": "无内盒",
  "quote.inner.pendingHint": "确定之前，供应商看到“Wellmix 将确认”，仍可报价。",
  "quote.inner.qty": "每内盒件数",
  "quote.inner.set": "确定内盒",
  "quote.inner.setNone": "不要求内盒",
  "quote.inner.setDone":
    "内盒已确定。供应商已能看到该要求；已报价的供应商可在截止前修改。",
  "quote.inner.setBy": "由 Wellmix 于 {date} 确定。",
  "quote.notice.inner":
    "内盒已确定。供应商已能看到该要求；已报价的供应商可在截止前修改。",
  "tasks.group.purchase_quote_inner": "询盘内盒待确定",
  "materials.title": "材料",
  "materials.subtitle":
    "供应商在询盘技术资料中选择材料的列表，不能自由填写。它来自 Sankhya 产品的“成分”；可调整名称并停用不适用的材料。",
  "materials.col.pt": "葡萄牙语",
  "materials.col.en": "英语",
  "materials.col.zh": "中文",
  "materials.col.status": "状态",
  "materials.active": "启用",
  "materials.inactive": "停用",
  "materials.add": "新增材料",
  "materials.save": "保存",
  "materials.edit": "编辑",
  "materials.cancel": "取消",
  "materials.deactivate": "停用",
  "materials.activate": "重新启用",
  "materials.search": "搜索材料",
  "materials.showActive": "只看启用",
  "materials.showAll": "同时显示停用（{n}）",
  "materials.count": "共 {n} 种材料，{active} 种启用",
  "materials.created": "材料已新增。",
  "materials.updated": "材料已保存。",
  "materials.toggled": "材料状态已更改。",
  "materials.readOnly": "只有产品档案岗（或管理员）可以修改此列表。",
  "materials.review.title": "材料不在目录中的技术资料",
  "materials.review.hint":
    "目录建立之前的技术资料（手填材料）或引用了已停用材料的资料。没有删除任何内容：请核对，必要时把材料加入目录。",
  "materials.review.empty": "没有需要复核的资料。",
  "materials.review.col.product": "产品",
  "materials.review.col.supplier": "供应商",
  "materials.review.col.material": "资料中的材料",
  "materials.error.material_names_required": "请填写三种语言的名称。",
  "materials.error.material_duplicate": "已存在同名材料。",
  "materials.error.material_not_found": "未找到材料。",
  "action.materials.manage": "维护材料目录",
  "action.desc.materials.manage":
    "新增、重命名、停用和重新启用供应商在询盘技术资料中选择的材料。",
};
