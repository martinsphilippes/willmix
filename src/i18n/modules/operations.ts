/*
 * Textos do módulo "operations" (Visão de Produto): modalidade de operação do
 * cliente (importação própria / via trade / outra), habilitação RADAR e a
 * seção "IA, marketing e operação" das configurações. `pt` é a fonte; `en` e
 * `zh` precisam ter exatamente as mesmas chaves (teste de paridade).
 */
export const pt = {
  /* ---- Cliente: modalidade de operação (RADAR) ---- */
  "operations.mode.title": "Modalidade de operação",
  "operations.mode.hint":
    'Não presumimos que o cliente tem ou não RADAR: cadastro sem resposta fica "não informado" e nenhuma regra dispara. Importação própria sem RADAR abre um item de revisão ao criar o pedido (radarGateEnabled), sem bloquear o fluxo. O pedido copia a modalidade do cliente no momento da criação.',
  "operations.mode.operationMode": "Modalidade",
  "operations.mode.radar": "Habilitação RADAR",
  "operations.mode.radarHint":
    "Habilitação no Siscomex (Receita Federal): expressa, limitada ou ilimitada, conforme o limite de operação do cliente. Só faz diferença na importação própria.",
  "operations.mode.radarNotes": "Observações sobre o RADAR",
  "operations.mode.radarNotesHint":
    "Número da habilitação, limite, validade, responsável. Visível só para a Wellmix.",
  "operations.mode.notInformed": "Não informado",
  "operations.mode.save": "Salvar modalidade",
  "operations.mode.saved": "Modalidade de operação salva.",
  "operations.mode.warning":
    '{problem}: importação própria exige RADAR habilitado. Enquanto isso, cada pedido novo deste cliente entra na fila de revisão (regra "Cliente: importação própria sem RADAR") para a Wellmix decidir; nada é bloqueado.',
  "operations.mode.gateOff":
    "O gate de RADAR está desligado nas configurações (radarGateEnabled): nenhum item de revisão será aberto.",
  "operations.mode.orderHint":
    "Copiada do cadastro do cliente ao criar o pedido; define quem é o importador de registro.",
  /* Texto do problema de RADAR (mesmos casos de radarProblem em services/operations.ts). */
  "operations.radarProblem.not_informed": "RADAR do cliente não informado",
  "operations.radarProblem.none": "Cliente sem habilitação RADAR",
  "operations.operationMode.own_import": "Importação própria",
  "operations.operationMode.via_trade": "Via estrutura/trade da Wellmix",
  "operations.operationMode.other": "Outra",
  "operations.mode.badge.own_import": "Importação própria",
  "operations.mode.badge.via_trade": "Via trade",
  "operations.mode.badge.other": "Outra modalidade",
  "operations.radar.none": "Sem habilitação",
  "operations.radar.express": "Expressa",
  "operations.radar.limited": "Limitada",
  "operations.radar.unlimited": "Ilimitada",

  /* ---- Configurações: IA, marketing e operação ---- */
  "operations.settings.section": "IA, marketing e operação",
  "operations.settings.hint.aiMode":
    "AUTO usa a IA real quando há credencial: ANTHROPIC_API_KEY (direto), AI_GATEWAY_API_KEY ou, na Vercel, o AI Gateway pelo token do próprio projeto (sem chave). Sem nada disso vira manual. MOCK devolve um exemplo rotulado, para demonstração; MANUAL desliga a IA. A IA só sugere: o humano confirma.",
  "operations.settings.effective": "modo efetivo",
  "operations.settings.effective.api": "api · chave presente",
  "operations.settings.effective.anthropic": "api · chave Anthropic",
  "operations.settings.effective.gateway": "api · AI Gateway da Vercel",
  "operations.ai.test": "Testar IA",
  "operations.ai.testHint":
    "Faz uma chamada curta à IA com a configuração salva e mostra se funcionou, com qual modelo, ou o motivo da falha.",
  "operations.ai.test.ok": "IA funcionando ({model}).",
  "operations.ai.test.bad":
    "A IA respondeu, mas fora do formato esperado ({model}).",
  "operations.ai.test.manual":
    "IA desligada: modo MANUAL ou nenhuma credencial disponível.",
  "operations.ai.test.error":
    "A IA não respondeu ({model}: {code}). 401/403: o AI Gateway não aceitou o token do projeto ou precisa ser ativado na conta da Vercel (AI Gateway → créditos); 402: sem crédito; outros: veja os logs da função na Vercel.",
  "operations.settings.effective.mock": "mock",
  "operations.settings.effective.manual": "manual · sem sugestão",
  "operations.settings.hint.aiModel":
    "Modelo usado no modo API (ex.: claude-sonnet-5-5). Ignorado em MOCK e MANUAL.",
  "operations.settings.hint.marketingEnabled":
    "Marketing studio e kits de marketing (prévia → oferta → compra → liberação).",
  "operations.settings.hint.marketingKitDefaultPrice":
    "Preço padrão sugerido ao criar um kit de marketing; editável em cada kit. Nada fixo em código.",
  "operations.settings.hint.marketingKitCurrency":
    "Código ISO de 3 letras (BRL, USD, CNY).",
  "operations.settings.hint.radarGateEnabled":
    "Cliente em importação própria sem RADAR informado ou sem habilitação: o pedido novo entra na fila de revisão (não bloqueia).",
  "operations.settings.hint.importerName":
    "Importadora dona da plataforma. Preparação multi-importador: hoje um só valor; nenhum filtro muda.",

  /* ---- Erros (?error=) ---- */
  "operations.error.invalid_ai_mode":
    "Modo de IA inválido: use AUTO, MOCK ou MANUAL.",
  "operations.error.invalid_currency":
    "Moeda inválida: use um código de 3 letras (ex.: BRL).",
  "operations.error.not_found": "Parceiro não encontrado.",
  "operations.error.not_customer":
    "A modalidade de operação só se aplica a clientes.",
  "operations.error.invalid_input": "Dados inválidos. Verifique os campos.",
};

export const en: Record<keyof typeof pt, string> = {
  "operations.mode.title": "Operation mode",
  "operations.mode.hint":
    'We never assume whether the customer has RADAR: an unanswered record stays "not informed" and no rule fires. Own import without RADAR opens a review item when the order is created (radarGateEnabled), without blocking the flow. The order copies the customer\'s mode at creation time.',
  "operations.mode.operationMode": "Mode",
  "operations.mode.radar": "RADAR registration",
  "operations.mode.radarHint":
    "Siscomex registration (Brazilian Federal Revenue): express, limited or unlimited, according to the customer's operating limit. Only matters for own import.",
  "operations.mode.radarNotes": "RADAR notes",
  "operations.mode.radarNotesHint":
    "Registration number, limit, validity, responsible person. Visible to Wellmix only.",
  "operations.mode.notInformed": "Not informed",
  "operations.mode.save": "Save operation mode",
  "operations.mode.saved": "Operation mode saved.",
  "operations.mode.warning":
    '{problem}: own import requires an active RADAR. Until then, every new order for this customer enters the review queue (rule "Customer: own import without RADAR") for Wellmix to decide; nothing is blocked.',
  "operations.mode.gateOff":
    "The RADAR gate is switched off in settings (radarGateEnabled): no review item will be opened.",
  "operations.mode.orderHint":
    "Copied from the customer record when the order was created; defines the importer of record.",
  "operations.radarProblem.not_informed": "Customer RADAR not informed",
  "operations.radarProblem.none": "Customer has no RADAR registration",
  "operations.operationMode.own_import": "Own import",
  "operations.operationMode.via_trade": "Via Wellmix structure/trade",
  "operations.operationMode.other": "Other",
  "operations.mode.badge.own_import": "Own import",
  "operations.mode.badge.via_trade": "Via trade",
  "operations.mode.badge.other": "Other mode",
  "operations.radar.none": "No registration",
  "operations.radar.express": "Express",
  "operations.radar.limited": "Limited",
  "operations.radar.unlimited": "Unlimited",

  "operations.settings.section": "AI, marketing and operation",
  "operations.settings.hint.aiMode":
    "AUTO uses real AI when a credential exists: ANTHROPIC_API_KEY (direct), AI_GATEWAY_API_KEY or, on Vercel, the AI Gateway through the project's own token (no key). Without any of these it becomes manual. MOCK returns a labelled example for demos; MANUAL turns AI off. AI only suggests: a person confirms.",
  "operations.settings.effective": "effective mode",
  "operations.settings.effective.api": "api · key present",
  "operations.settings.effective.anthropic": "api · Anthropic key",
  "operations.settings.effective.gateway": "api · Vercel AI Gateway",
  "operations.ai.test": "Test AI",
  "operations.ai.testHint":
    "Makes a short AI call with the saved configuration and shows whether it worked, with which model, or why it failed.",
  "operations.ai.test.ok": "AI working ({model}).",
  "operations.ai.test.bad":
    "AI answered, but not in the expected format ({model}).",
  "operations.ai.test.manual":
    "AI off: MANUAL mode or no credential available.",
  "operations.ai.test.error":
    "AI did not answer ({model}: {code}). 401/403: the AI Gateway did not accept the project token or must be enabled in the Vercel account (AI Gateway → credits); 402: no credit; other: check the function logs on Vercel.",
  "operations.settings.effective.mock": "mock",
  "operations.settings.effective.manual": "manual · no suggestions",
  "operations.settings.hint.aiModel":
    "Model used in API mode (e.g. claude-sonnet-5-5). Ignored in MOCK and MANUAL.",
  "operations.settings.hint.marketingEnabled":
    "Marketing studio and marketing kits (preview → offer → purchase → release).",
  "operations.settings.hint.marketingKitDefaultPrice":
    "Default price suggested when creating a marketing kit; editable per kit. Nothing hard-coded.",
  "operations.settings.hint.marketingKitCurrency":
    "3-letter ISO code (BRL, USD, CNY).",
  "operations.settings.hint.radarGateEnabled":
    "Customer on own import without RADAR informed or without registration: the new order enters the review queue (does not block).",
  "operations.settings.hint.importerName":
    "Importer that owns the platform. Multi-importer preparation: a single value today; no filter changes.",

  "operations.error.invalid_ai_mode":
    "Invalid AI mode: use AUTO, MOCK or MANUAL.",
  "operations.error.invalid_currency":
    "Invalid currency: use a 3-letter code (e.g. BRL).",
  "operations.error.not_found": "Partner not found.",
  "operations.error.not_customer":
    "The operation mode only applies to customers.",
  "operations.error.invalid_input": "Invalid data. Check the fields.",
};

export const zh: Record<keyof typeof pt, string> = {
  "operations.mode.title": "运营模式",
  "operations.mode.hint":
    "我们不预设客户是否持有 RADAR：未填写的记录保持“未填写”，不触发任何规则。自主进口且无 RADAR 时，创建订单会打开复核项（radarGateEnabled），但不阻塞流程。订单在创建时复制客户的模式。",
  "operations.mode.operationMode": "模式",
  "operations.mode.radar": "RADAR 资质",
  "operations.mode.radarHint":
    "Siscomex 资质（巴西联邦税务局）：快速、有限或无限，取决于客户的操作限额。仅对自主进口有意义。",
  "operations.mode.radarNotes": "RADAR 备注",
  "operations.mode.radarNotesHint":
    "资质编号、限额、有效期、负责人。仅 Wellmix 可见。",
  "operations.mode.notInformed": "未填写",
  "operations.mode.save": "保存运营模式",
  "operations.mode.saved": "运营模式已保存。",
  "operations.mode.warning":
    "{problem}：自主进口需要有效的 RADAR。在此之前，该客户的每个新订单都会进入复核队列（规则“客户：自主进口但无 RADAR”）由 Wellmix 决定；不会阻塞。",
  "operations.mode.gateOff":
    "设置中的 RADAR 门控已关闭（radarGateEnabled）：不会打开复核项。",
  "operations.mode.orderHint": "创建订单时从客户档案复制；定义登记进口商。",
  "operations.radarProblem.not_informed": "客户 RADAR 未填写",
  "operations.radarProblem.none": "客户无 RADAR 资质",
  "operations.operationMode.own_import": "自主进口",
  "operations.operationMode.via_trade": "通过 Wellmix 结构/贸易",
  "operations.operationMode.other": "其他",
  "operations.mode.badge.own_import": "自主进口",
  "operations.mode.badge.via_trade": "通过贸易",
  "operations.mode.badge.other": "其他模式",
  "operations.radar.none": "无资质",
  "operations.radar.express": "快速",
  "operations.radar.limited": "有限",
  "operations.radar.unlimited": "无限",

  "operations.settings.section": "AI、营销与运营",
  "operations.settings.hint.aiMode":
    "AUTO 在有凭证时使用真实 AI：ANTHROPIC_API_KEY（直连）、AI_GATEWAY_API_KEY，或在 Vercel 上通过项目自身令牌使用 AI Gateway（无需密钥）。都没有时为手动。MOCK 返回带标注的示例用于演示；MANUAL 关闭 AI。AI 只提供建议，由人工确认。",
  "operations.settings.effective": "当前生效",
  "operations.settings.effective.api": "api · 已有密钥",
  "operations.settings.effective.anthropic": "api · Anthropic 密钥",
  "operations.settings.effective.gateway": "api · Vercel AI Gateway",
  "operations.ai.test": "测试 AI",
  "operations.ai.testHint":
    "用已保存的配置对 AI 进行一次简短调用，显示是否成功、使用的模型或失败原因。",
  "operations.ai.test.ok": "AI 正常（{model}）。",
  "operations.ai.test.bad": "AI 已回复，但格式不符合预期（{model}）。",
  "operations.ai.test.manual": "AI 已关闭：MANUAL 模式或没有可用凭证。",
  "operations.ai.test.error":
    "AI 未响应（{model}：{code}）。401/403：AI Gateway 未接受项目令牌，或需要在 Vercel 账户中启用（AI Gateway → 额度）；402：额度不足；其他：请查看 Vercel 上的函数日志。",
  "operations.settings.effective.mock": "mock",
  "operations.settings.effective.manual": "manual · 无建议",
  "operations.settings.hint.aiModel":
    "API 模式使用的模型（例如 claude-sonnet-5-5）。MOCK 和 MANUAL 模式忽略。",
  "operations.settings.hint.marketingEnabled":
    "营销工作室与营销套件（预览 → 报价 → 购买 → 发布）。",
  "operations.settings.hint.marketingKitDefaultPrice":
    "创建营销套件时建议的默认价格；每个套件可单独修改。代码中不写死。",
  "operations.settings.hint.marketingKitCurrency":
    "3 位 ISO 代码（BRL、USD、CNY）。",
  "operations.settings.hint.radarGateEnabled":
    "自主进口客户未填写 RADAR 或无资质：新订单进入复核队列（不阻塞）。",
  "operations.settings.hint.importerName":
    "平台所属进口商。多进口商准备：目前仅一个值；不改变任何筛选。",

  "operations.error.invalid_ai_mode":
    "AI 模式无效：请使用 AUTO、MOCK 或 MANUAL。",
  "operations.error.invalid_currency":
    "货币无效：请使用 3 位代码（例如 BRL）。",
  "operations.error.not_found": "未找到合作方。",
  "operations.error.not_customer": "运营模式仅适用于客户。",
  "operations.error.invalid_input": "数据无效。请检查字段。",
};
