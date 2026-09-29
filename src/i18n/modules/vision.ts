/*
 * Textos do módulo "vision" (Visão de Produto): prompts e regras por linha,
 * atributos exigidos, sugestão de cadastro por foto (humano confirma) e ciclo
 * contínuo do produto. `pt` é a fonte; `en` e `zh` precisam ter exatamente as
 * mesmas chaves (teste de paridade).
 */
export const pt = {
  /* ---- Linhas: prompts e regras (IA) ---- */
  "vision.lines.title": "Prompts e regras (IA)",
  "vision.lines.hint":
    "Prompt Base + Linha + Produto + Contexto; nenhum prompt fica fixo em tela. A IA só sugere: a confirmação é sempre humana.",
  "vision.lines.descriptionPrompt": "Prompt de descrição (cadastro)",
  "vision.lines.marketingPrompt": "Prompt de marketing",
  "vision.lines.imagePrompt": "Prompt de imagem comercial",
  "vision.lines.requiredAttributes": "Atributos exigidos",
  "vision.lines.requiredAttributesHint":
    "Um por linha ou separados por vírgula. Conferidos automaticamente pela ficha: material, cor, pantone, categoria, descrição, sku, fornecedor, moq, preço, dimensões, peso, cbm, ncm, foto. Os demais ficam para conferência manual.",
  "vision.lines.requiredAttributesPlaceholder": "material\ncor\ndimensões",
  "vision.lines.validationRules": "Regras de validação",
  "vision.lines.validationRulesHint":
    "Uma por linha. Entram no prompt e orientam o operador (ex.: não citar marcas de terceiros).",
  "vision.lines.requiredAttributes.none": "Nenhum atributo exigido.",
  "vision.lines.rules.count": "{count} regra(s)",
  "vision.lines.configured": "Prompts configurados",
  "vision.lines.notConfigured": "Sem prompts",
  "vision.lines.save": "Salvar prompts e regras",

  /* ---- Ficha: atributos exigidos pela linha ---- */
  "vision.attrs.title": "Atributos exigidos pela linha",
  "vision.attrs.hint":
    "Conferência determinística (código, sem IA) entre o que a linha exige e o que a ficha tem.",
  "vision.attrs.none": "Esta linha não exige atributos específicos.",
  "vision.attrs.present": "Presentes",
  "vision.attrs.missing": "Faltando",
  "vision.attrs.manual": "Conferência manual",
  "vision.attrs.manualHint":
    "Sem coluna correspondente na ficha: confira à mão na especificação ou nos documentos.",
  "vision.attrs.fill": "Preencher na ficha",
  "vision.attrs.allPresent": "Todos os atributos exigidos estão preenchidos.",

  /* ---- Sugestão por foto (IA) ---- */
  "vision.ai.title": "Sugestão por foto (IA)",
  "vision.ai.hint":
    "FOTO → ANÁLISE → SUGESTÃO → você confirma campo a campo → CADASTRO. Nada entra na ficha sem marcar.",
  "vision.ai.notConfigured":
    "A IA não está configurada: defina ANTHROPIC_API_KEY no ambiente ou escolha o modo MOCK (demonstração rotulada) nas configurações. Nenhum valor é inventado.",
  "vision.ai.openSettings": "Abrir configurações",
  "vision.ai.mockNotice":
    "Modo mock: a resposta é um exemplo rotulado, nenhum dado real é analisado.",
  "vision.ai.photo": "Foto analisada",
  "vision.ai.photo.primary": "principal",
  "vision.ai.photo.none":
    "Envie uma foto primeiro (card de fotos acima) para pedir a sugestão.",
  "vision.ai.photo.noneMock":
    "Sem foto: no modo mock a sugestão sai mesmo assim, como exemplo.",
  "vision.ai.context": "Contexto (opcional)",
  "vision.ai.contextHint":
    "Cliente, mercado, instruções do operador. Entra no prompt junto com base + linha + produto.",
  "vision.ai.request": "Sugerir campos pela foto",
  "vision.ai.history": "Sugestões",
  "vision.ai.history.empty": "Nenhuma sugestão pedida ainda.",
  "vision.ai.requestedBy": "Pedida por",
  "vision.ai.source.mock": "mock",
  "vision.ai.source.api": "api",
  "vision.ai.status.suggested": "Aguardando confirmação",
  "vision.ai.status.applied": "Aplicada",
  "vision.ai.status.discarded": "Descartada",
  "vision.ai.decidedBy": "Decidido por",
  "vision.ai.applied": "Campos aplicados",
  "vision.ai.confidence": "Confiança",
  "vision.ai.confidence.low": "Baixa",
  "vision.ai.confidence.medium": "Média",
  "vision.ai.confidence.high": "Alta",
  "vision.ai.notes": "Observações da IA",
  "vision.ai.apply.title": "Confirmar campo a campo",
  "vision.ai.apply.hint":
    "Marque só o que deve entrar e ajuste o valor antes de aplicar. Material e dados comerciais exigem escolha explícita; preço, MOQ e dimensões nunca são sugeridos pela IA.",
  "vision.ai.apply.check": "Aplicar",
  "vision.ai.apply.description": "Descrição / especificação",
  "vision.ai.apply.choiceHint":
    "Marque uma das opções sugeridas ou, sem marcar nenhuma, digite outro valor. Nada é escolhido por padrão.",
  "vision.ai.apply.other": "Outro",
  "vision.ai.apply.suggested": "Sugeridos",
  "vision.ai.apply.attributes": "Anexar atributos à especificação",
  "vision.ai.apply.attributesHint":
    'Os pares "chave: valor" acima serão acrescentados ao fim da especificação.',
  "vision.ai.apply.current": "Atual",
  "vision.ai.apply.empty": "vazio",
  "vision.ai.apply.submit": "Aplicar selecionados",
  "vision.ai.apply.nothing": "A resposta não trouxe campos para aplicar.",
  "vision.ai.discard": "Descartar sugestão",
  "vision.ai.discard.note": "Motivo (opcional)",
  "vision.ai.prompt": "Prompt enviado (auditoria)",
  "vision.ai.rawText": "Resposta bruta",
  "vision.ai.noImage": "sem foto",

  /* ---- Erros (?error=) ---- */
  "vision.error.ai_unavailable":
    "A IA não está configurada (sem ANTHROPIC_API_KEY e sem modo MOCK). Nenhuma sugestão foi gerada.",
  "vision.error.ai_no_photo":
    "Sem foto para analisar: envie uma foto do produto e tente de novo.",
  "vision.error.ai_request_failed":
    "A chamada à IA falhou. Tente de novo em instantes.",
  "vision.error.ai_invalid_response":
    "A IA respondeu em formato inesperado; nada foi registrado.",
  "vision.error.already_decided":
    "Esta sugestão já foi aplicada ou descartada.",
  "vision.error.nothing_to_apply":
    "Nenhum campo marcado (ou valores vazios). Marque o que deve entrar.",
  "vision.error.not_found": "Registro não encontrado.",
  "vision.error.line_not_found": "Linha de produto não encontrada.",
  "vision.error.invalid_input": "Dados inválidos. Verifique os campos.",

  /* ---- Ciclo do produto ---- */
  "vision.cycle.title": "Ciclo do produto",
  "vision.cycle.hint":
    "Sourcing → produto → solicitações → pedidos → pós-venda → reposição → marketing. Tudo por relacionamento; nada é duplicado.",
  "vision.cycle.requests": "Solicitações",
  "vision.cycle.orders": "Pedidos",
  "vision.cycle.delivered": "Entregues",
  "vision.cycle.afterSales": "Pós-venda respondido",
  "vision.cycle.replenishments": "Reposições",
  "vision.cycle.schedules": "Programações",
  "vision.cycle.sourcing": "Sourcing de origem",
  "vision.cycle.sourcing.none": "Produto cadastrado sem item de sourcing.",
  "vision.cycle.visit": "Visita",
  "vision.cycle.requests.empty": "Nenhuma solicitação para este produto.",
  "vision.cycle.orders.empty": "Nenhum pedido para este produto.",
  "vision.cycle.afterSales.none": "Sem pós-venda",
  "vision.cycle.repurchase": "Recompra",
  "vision.cycle.kits": "Kits de marketing",
  "vision.cycle.kits.empty": "Nenhum kit de marketing para este produto.",
  "vision.cycle.kits.create": "Criar kit de marketing",
};

export const en: Record<keyof typeof pt, string> = {
  "vision.lines.title": "Prompts and rules (AI)",
  "vision.lines.hint":
    "Base prompt + line + product + context; no prompt is hard-coded in a screen. AI only suggests: confirmation is always human.",
  "vision.lines.descriptionPrompt": "Description prompt (registration)",
  "vision.lines.marketingPrompt": "Marketing prompt",
  "vision.lines.imagePrompt": "Commercial image prompt",
  "vision.lines.requiredAttributes": "Required attributes",
  "vision.lines.requiredAttributesHint":
    "One per line or comma-separated. Checked automatically against the sheet: material, cor, pantone, categoria, descrição, sku, fornecedor, moq, preço, dimensões, peso, cbm, ncm, foto (English names also work). Others are left for manual review.",
  "vision.lines.requiredAttributesPlaceholder": "material\ncolor\ndimensions",
  "vision.lines.validationRules": "Validation rules",
  "vision.lines.validationRulesHint":
    "One per line. They go into the prompt and guide the operator (e.g. do not mention third-party brands).",
  "vision.lines.requiredAttributes.none": "No required attributes.",
  "vision.lines.rules.count": "{count} rule(s)",
  "vision.lines.configured": "Prompts configured",
  "vision.lines.notConfigured": "No prompts",
  "vision.lines.save": "Save prompts and rules",

  "vision.attrs.title": "Attributes required by the line",
  "vision.attrs.hint":
    "Deterministic check (code, no AI) of what the line requires versus what the sheet has.",
  "vision.attrs.none": "This line does not require specific attributes.",
  "vision.attrs.present": "Present",
  "vision.attrs.missing": "Missing",
  "vision.attrs.manual": "Manual review",
  "vision.attrs.manualHint":
    "No matching column on the sheet: check by hand in the specification or documents.",
  "vision.attrs.fill": "Fill in on the sheet",
  "vision.attrs.allPresent": "All required attributes are filled in.",

  "vision.ai.title": "Suggestion from photo (AI)",
  "vision.ai.hint":
    "PHOTO → ANALYSIS → SUGGESTION → you confirm field by field → REGISTRATION. Nothing enters the sheet unless you tick it.",
  "vision.ai.notConfigured":
    "AI is not configured: set ANTHROPIC_API_KEY in the environment or choose MOCK mode (labelled demo) in settings. No value is invented.",
  "vision.ai.openSettings": "Open settings",
  "vision.ai.mockNotice":
    "Mock mode: the answer is a labelled example, no real data is analysed.",
  "vision.ai.photo": "Photo analysed",
  "vision.ai.photo.primary": "primary",
  "vision.ai.photo.none":
    "Upload a photo first (photos card above) to request a suggestion.",
  "vision.ai.photo.noneMock":
    "No photo: in mock mode the suggestion is produced anyway, as an example.",
  "vision.ai.context": "Context (optional)",
  "vision.ai.contextHint":
    "Customer, market, operator instructions. Goes into the prompt with base + line + product.",
  "vision.ai.request": "Suggest fields from photo",
  "vision.ai.history": "Suggestions",
  "vision.ai.history.empty": "No suggestion requested yet.",
  "vision.ai.requestedBy": "Requested by",
  "vision.ai.source.mock": "mock",
  "vision.ai.source.api": "api",
  "vision.ai.status.suggested": "Awaiting confirmation",
  "vision.ai.status.applied": "Applied",
  "vision.ai.status.discarded": "Discarded",
  "vision.ai.decidedBy": "Decided by",
  "vision.ai.applied": "Applied fields",
  "vision.ai.confidence": "Confidence",
  "vision.ai.confidence.low": "Low",
  "vision.ai.confidence.medium": "Medium",
  "vision.ai.confidence.high": "High",
  "vision.ai.notes": "AI notes",
  "vision.ai.apply.title": "Confirm field by field",
  "vision.ai.apply.hint":
    "Tick only what should enter and adjust the value before applying. Material and commercial data require an explicit choice; price, MOQ and dimensions are never suggested by AI.",
  "vision.ai.apply.check": "Apply",
  "vision.ai.apply.description": "Description / specification",
  "vision.ai.apply.choiceHint":
    "Tick one of the suggested options or, leaving them unticked, type another value. Nothing is chosen by default.",
  "vision.ai.apply.other": "Other",
  "vision.ai.apply.suggested": "Suggested",
  "vision.ai.apply.attributes": "Append attributes to the specification",
  "vision.ai.apply.attributesHint":
    'The "key: value" pairs above will be appended to the end of the specification.',
  "vision.ai.apply.current": "Current",
  "vision.ai.apply.empty": "empty",
  "vision.ai.apply.submit": "Apply selected",
  "vision.ai.apply.nothing": "The answer brought no fields to apply.",
  "vision.ai.discard": "Discard suggestion",
  "vision.ai.discard.note": "Reason (optional)",
  "vision.ai.prompt": "Prompt sent (audit)",
  "vision.ai.rawText": "Raw answer",
  "vision.ai.noImage": "no photo",

  "vision.error.ai_unavailable":
    "AI is not configured (no ANTHROPIC_API_KEY and no MOCK mode). No suggestion was generated.",
  "vision.error.ai_no_photo":
    "No photo to analyse: upload a product photo and try again.",
  "vision.error.ai_request_failed":
    "The AI call failed. Try again in a moment.",
  "vision.error.ai_invalid_response":
    "The AI answered in an unexpected format; nothing was recorded.",
  "vision.error.already_decided":
    "This suggestion was already applied or discarded.",
  "vision.error.nothing_to_apply":
    "No field ticked (or empty values). Tick what should enter.",
  "vision.error.not_found": "Record not found.",
  "vision.error.line_not_found": "Product line not found.",
  "vision.error.invalid_input": "Invalid data. Check the fields.",

  "vision.cycle.title": "Product cycle",
  "vision.cycle.hint":
    "Sourcing → product → requests → orders → after-sales → replenishment → marketing. Everything by relationship; nothing is duplicated.",
  "vision.cycle.requests": "Requests",
  "vision.cycle.orders": "Orders",
  "vision.cycle.delivered": "Delivered",
  "vision.cycle.afterSales": "After-sales answered",
  "vision.cycle.replenishments": "Replenishments",
  "vision.cycle.schedules": "Schedules",
  "vision.cycle.sourcing": "Origin sourcing",
  "vision.cycle.sourcing.none": "Product registered without a sourcing item.",
  "vision.cycle.visit": "Visit",
  "vision.cycle.requests.empty": "No request for this product.",
  "vision.cycle.orders.empty": "No order for this product.",
  "vision.cycle.afterSales.none": "No after-sales",
  "vision.cycle.repurchase": "Repurchase",
  "vision.cycle.kits": "Marketing kits",
  "vision.cycle.kits.empty": "No marketing kit for this product.",
  "vision.cycle.kits.create": "Create marketing kit",
};

export const zh: Record<keyof typeof pt, string> = {
  "vision.lines.title": "提示词与规则（AI）",
  "vision.lines.hint":
    "基础提示词 + 产品线 + 产品 + 上下文；页面中不固定任何提示词。AI 只做建议，确认始终由人完成。",
  "vision.lines.descriptionPrompt": "描述提示词（建档）",
  "vision.lines.marketingPrompt": "营销提示词",
  "vision.lines.imagePrompt": "商业图片提示词",
  "vision.lines.requiredAttributes": "必填属性",
  "vision.lines.requiredAttributesHint":
    "每行一个或用逗号分隔。以下属性按产品档案自动核对：material、cor、pantone、categoria、descrição、sku、fornecedor、moq、preço、dimensões、peso、cbm、ncm、foto（英文名亦可）。其余留待人工核对。",
  "vision.lines.requiredAttributesPlaceholder": "material\ncolor\ndimensions",
  "vision.lines.validationRules": "校验规则",
  "vision.lines.validationRulesHint":
    "每行一条。会进入提示词并指导操作员（例如：不得提及第三方品牌）。",
  "vision.lines.requiredAttributes.none": "无必填属性。",
  "vision.lines.rules.count": "{count} 条规则",
  "vision.lines.configured": "已配置提示词",
  "vision.lines.notConfigured": "未配置提示词",
  "vision.lines.save": "保存提示词与规则",

  "vision.attrs.title": "产品线要求的属性",
  "vision.attrs.hint": "确定性核对（代码，无 AI）：产品线要求 × 档案已有内容。",
  "vision.attrs.none": "该产品线未要求特定属性。",
  "vision.attrs.present": "已填写",
  "vision.attrs.missing": "缺失",
  "vision.attrs.manual": "人工核对",
  "vision.attrs.manualHint": "档案中没有对应字段：请在规格或文档中人工核对。",
  "vision.attrs.fill": "在档案中填写",
  "vision.attrs.allPresent": "所有必填属性均已填写。",

  "vision.ai.title": "照片建议（AI）",
  "vision.ai.hint":
    "照片 → 分析 → 建议 → 您逐项确认 → 建档。未勾选的内容不会进入档案。",
  "vision.ai.notConfigured":
    "AI 未配置：请在环境中设置 ANTHROPIC_API_KEY，或在设置中选择 MOCK（带标注的演示）模式。不会编造任何值。",
  "vision.ai.openSettings": "打开设置",
  "vision.ai.mockNotice": "Mock 模式：返回带标注的示例，不分析任何真实数据。",
  "vision.ai.photo": "分析的照片",
  "vision.ai.photo.primary": "主图",
  "vision.ai.photo.none": "请先上传照片（上方照片卡片）再请求建议。",
  "vision.ai.photo.noneMock": "无照片：Mock 模式下仍会生成示例建议。",
  "vision.ai.context": "上下文（可选）",
  "vision.ai.contextHint":
    "客户、市场、操作员说明。与基础提示词 + 产品线 + 产品一起进入提示词。",
  "vision.ai.request": "根据照片建议字段",
  "vision.ai.history": "建议记录",
  "vision.ai.history.empty": "尚未请求任何建议。",
  "vision.ai.requestedBy": "请求人",
  "vision.ai.source.mock": "mock",
  "vision.ai.source.api": "api",
  "vision.ai.status.suggested": "待确认",
  "vision.ai.status.applied": "已应用",
  "vision.ai.status.discarded": "已丢弃",
  "vision.ai.decidedBy": "决定人",
  "vision.ai.applied": "已应用字段",
  "vision.ai.confidence": "置信度",
  "vision.ai.confidence.low": "低",
  "vision.ai.confidence.medium": "中",
  "vision.ai.confidence.high": "高",
  "vision.ai.notes": "AI 备注",
  "vision.ai.apply.title": "逐项确认",
  "vision.ai.apply.hint":
    "只勾选应写入的字段，并在应用前调整值。材质和商业数据需明确选择；价格、MOQ 和尺寸绝不由 AI 建议。",
  "vision.ai.apply.check": "应用",
  "vision.ai.apply.description": "描述 / 规格",
  "vision.ai.apply.choiceHint":
    "勾选一个建议选项；或不勾选任何选项，直接输入其他值。默认不选任何值。",
  "vision.ai.apply.other": "其他",
  "vision.ai.apply.suggested": "建议值",
  "vision.ai.apply.attributes": "将属性追加到规格",
  "vision.ai.apply.attributesHint": "上方的“键: 值”将追加到规格末尾。",
  "vision.ai.apply.current": "当前",
  "vision.ai.apply.empty": "空",
  "vision.ai.apply.submit": "应用所选",
  "vision.ai.apply.nothing": "返回结果中没有可应用的字段。",
  "vision.ai.discard": "丢弃建议",
  "vision.ai.discard.note": "原因（可选）",
  "vision.ai.prompt": "发送的提示词（审计）",
  "vision.ai.rawText": "原始回复",
  "vision.ai.noImage": "无照片",

  "vision.error.ai_unavailable":
    "AI 未配置（无 ANTHROPIC_API_KEY 且未启用 MOCK 模式）。未生成任何建议。",
  "vision.error.ai_no_photo": "没有可分析的照片：请上传产品照片后重试。",
  "vision.error.ai_request_failed": "调用 AI 失败，请稍后重试。",
  "vision.error.ai_invalid_response": "AI 返回格式异常，未记录任何内容。",
  "vision.error.already_decided": "该建议已被应用或丢弃。",
  "vision.error.nothing_to_apply":
    "未勾选任何字段（或值为空）。请勾选要写入的内容。",
  "vision.error.not_found": "未找到记录。",
  "vision.error.line_not_found": "未找到产品线。",
  "vision.error.invalid_input": "数据无效，请检查各字段。",

  "vision.cycle.title": "产品周期",
  "vision.cycle.hint":
    "寻源 → 产品 → 需求单 → 订单 → 售后 → 补货 → 营销。全部按关联关系读取，不重复数据。",
  "vision.cycle.requests": "需求单",
  "vision.cycle.orders": "订单",
  "vision.cycle.delivered": "已交付",
  "vision.cycle.afterSales": "售后已回复",
  "vision.cycle.replenishments": "补货",
  "vision.cycle.schedules": "采购计划",
  "vision.cycle.sourcing": "来源寻源",
  "vision.cycle.sourcing.none": "该产品未关联寻源条目。",
  "vision.cycle.visit": "拜访",
  "vision.cycle.requests.empty": "该产品暂无需求单。",
  "vision.cycle.orders.empty": "该产品暂无订单。",
  "vision.cycle.afterSales.none": "无售后",
  "vision.cycle.repurchase": "复购",
  "vision.cycle.kits": "营销套件",
  "vision.cycle.kits.empty": "该产品暂无营销套件。",
  "vision.cycle.kits.create": "创建营销套件",
};
