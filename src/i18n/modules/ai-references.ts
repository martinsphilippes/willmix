/**
 * Referências por IA na escolha do grupo e na solicitação ao fornecedor
 * (docs/SUPPLIER_REQUESTS.md, "Referências por IA"). Mesmas chaves em pt, en e zh.
 */
export const pt = {
  "aiRefs.panel.title": "Prompts de IA para o fornecedor",
  "aiRefs.panel.body":
    "A IA da OpenAI cria duas imagens aproximadas de como o produto deve ficar ao final da produção e uma ficha em texto. Os arquivos vão anexados à solicitação ao fornecedor. Os padrões ficam em Configurações; o que mudar aqui vale só para esta escolha.",
  "aiRefs.panel.dataHint":
    "Os dados do item (descrição, material, cores, medidas, embalagem) e o que a Wellmix precisa vão junto com cada prompt. Com foto no booking, as imagens partem dela.",
  "aiRefs.kind.product": "Imagem 1: produto final",
  "aiRefs.kind.detail": "Imagem 2: detalhes e embalagem",
  "aiRefs.kind.sheet": "Arquivo: ficha para o fornecedor",
  "aiRefs.panel.generate": "Gravar e gerar com IA",
  "aiRefs.panel.generating": "Gerando (1 a 2 minutos)…",
  "aiRefs.panel.saveHint":
    '"Gravar escolha" grava os prompts sem gerar. Gerar de novo troca os arquivos anteriores.',
  "aiRefs.mode.api": "OpenAI ligada ({image} e {text})",
  "aiRefs.mode.mock":
    "IA em modo MOCK: gera exemplos rotulados, não imagens reais.",
  "aiRefs.mode.manual":
    "OpenAI desligada (sem OPENAI_API_KEY ou IA em modo manual): os prompts ficam gravados e nada é gerado.",
  "aiRefs.generated":
    "{n} arquivo(s) gerado(s) com IA. Eles vão para a solicitação quando ela abrir.",
  "aiRefs.error.openai_off":
    "A OpenAI não está configurada (OPENAI_API_KEY) ou a IA está em modo manual: nada foi gerado. A escolha e os prompts foram gravados.",
  "aiRefs.error.openai_auth":
    "A OpenAI recusou a chave (OPENAI_API_KEY inválida ou sem permissão).",
  "aiRefs.error.openai_rate_limit":
    "A OpenAI está no limite de uso ou sem créditos. Tente de novo mais tarde.",
  "aiRefs.error.openai_rejected":
    "A OpenAI recusou o pedido (prompt ou modelo). Revise o prompt ou o modelo em Configurações.",
  "aiRefs.error.openai_failed":
    "A OpenAI não respondeu. Tente de novo; a escolha foi gravada.",
  "aiRefs.files": "Arquivos gerados",
  "aiRefs.none": "Ainda não gerado.",
  "aiRefs.mockBadge": "Exemplo mock",
  "aiRefs.openSheet": "Abrir ficha",
  "aiRefs.request.title": "Referências geradas por IA",
  "aiRefs.request.body":
    "Imagens aproximadas de como a Wellmix espera o produto ao final da produção e a ficha do produto. São referência: não são fotos de amostra.",
  "aiRefs.settings.section": "Referências por IA na escolha do grupo (OpenAI)",
  "aiRefs.settings.hint":
    'Prompts padrão do painel abaixo de "Gravar a escolha do grupo" (editáveis em cada escolha). Os dados do item vão junto automaticamente.',
  "aiRefs.settings.imageModel": "Modelo de imagem (OpenAI)",
  "aiRefs.settings.textModel": "Modelo de texto (OpenAI)",
  "aiRefs.settings.key.on": "OPENAI_API_KEY configurada",
  "aiRefs.settings.key.off": "Sem OPENAI_API_KEY",
  "settings.error.ai_prompt_invalid":
    "Prompt de IA vazio ou longo demais (até 2.000 caracteres).",
  "settings.error.openai_model_invalid":
    "Nome de modelo da OpenAI inválido (letras, números, ponto, hífen; até 80).",
};

export const en: typeof pt = {
  "aiRefs.panel.title": "AI prompts for the supplier",
  "aiRefs.panel.body":
    "OpenAI creates two approximate images of how the product should look at the end of production and a text sheet. The files are attached to the supplier request. Defaults live in Settings; changes here apply only to this choice.",
  "aiRefs.panel.dataHint":
    "The item data (description, material, colors, dimensions, packaging) and what Wellmix needs go with each prompt. With a booking photo, the images start from it.",
  "aiRefs.kind.product": "Image 1: finished product",
  "aiRefs.kind.detail": "Image 2: details and packaging",
  "aiRefs.kind.sheet": "File: sheet for the supplier",
  "aiRefs.panel.generate": "Save and generate with AI",
  "aiRefs.panel.generating": "Generating (1 to 2 minutes)…",
  "aiRefs.panel.saveHint":
    '"Save choice" saves the prompts without generating. Generating again replaces the previous files.',
  "aiRefs.mode.api": "OpenAI on ({image} and {text})",
  "aiRefs.mode.mock":
    "AI in MOCK mode: generates labeled examples, not real images.",
  "aiRefs.mode.manual":
    "OpenAI off (no OPENAI_API_KEY or AI in manual mode): the prompts are saved and nothing is generated.",
  "aiRefs.generated":
    "{n} file(s) generated with AI. They go to the request when it opens.",
  "aiRefs.error.openai_off":
    "OpenAI is not configured (OPENAI_API_KEY) or AI is in manual mode: nothing was generated. The choice and prompts were saved.",
  "aiRefs.error.openai_auth":
    "OpenAI rejected the key (invalid OPENAI_API_KEY or no permission).",
  "aiRefs.error.openai_rate_limit":
    "OpenAI is at its usage limit or out of credits. Try again later.",
  "aiRefs.error.openai_rejected":
    "OpenAI rejected the request (prompt or model). Review the prompt or the model in Settings.",
  "aiRefs.error.openai_failed":
    "OpenAI did not answer. Try again; the choice was saved.",
  "aiRefs.files": "Generated files",
  "aiRefs.none": "Not generated yet.",
  "aiRefs.mockBadge": "Mock example",
  "aiRefs.openSheet": "Open sheet",
  "aiRefs.request.title": "AI-generated references",
  "aiRefs.request.body":
    "Approximate images of how Wellmix expects the product at the end of production, and the product sheet. They are references, not sample photos.",
  "aiRefs.settings.section": "AI references in the group choice (OpenAI)",
  "aiRefs.settings.hint":
    'Default prompts of the panel below "Save the group\'s choice" (editable in each choice). The item data is added automatically.',
  "aiRefs.settings.imageModel": "Image model (OpenAI)",
  "aiRefs.settings.textModel": "Text model (OpenAI)",
  "aiRefs.settings.key.on": "OPENAI_API_KEY configured",
  "aiRefs.settings.key.off": "No OPENAI_API_KEY",
  "settings.error.ai_prompt_invalid":
    "AI prompt empty or too long (up to 2,000 characters).",
  "settings.error.openai_model_invalid":
    "Invalid OpenAI model name (letters, digits, dot, hyphen; up to 80).",
};

export const zh: typeof pt = {
  "aiRefs.panel.title": "给供应商的 AI 提示词",
  "aiRefs.panel.body":
    "OpenAI 会生成两张产品在生产完成后大致样子的图片和一份文字说明。这些文件会附在给供应商的询单中。默认提示词在“设置”中；此处的修改只对本次选择有效。",
  "aiRefs.panel.dataHint":
    "商品数据（描述、材质、颜色、尺寸、包装）和 Wellmix 的要求会随每个提示词一起发送。订舱单有照片时，图片以照片为基础。",
  "aiRefs.kind.product": "图片 1：成品",
  "aiRefs.kind.detail": "图片 2：细节和包装",
  "aiRefs.kind.sheet": "文件：给供应商的说明",
  "aiRefs.panel.generate": "保存并用 AI 生成",
  "aiRefs.panel.generating": "生成中（1 到 2 分钟）…",
  "aiRefs.panel.saveHint":
    "“保存选择”只保存提示词不生成。再次生成会替换之前的文件。",
  "aiRefs.mode.api": "OpenAI 已开启（{image} 和 {text}）",
  "aiRefs.mode.mock": "AI 处于 MOCK 模式：只生成带标记的示例，不是真实图片。",
  "aiRefs.mode.manual":
    "OpenAI 未开启（没有 OPENAI_API_KEY 或 AI 为手动模式）：提示词会保存，但不会生成任何内容。",
  "aiRefs.generated": "已用 AI 生成 {n} 个文件。询单打开时会一起发送。",
  "aiRefs.error.openai_off":
    "OpenAI 未配置（OPENAI_API_KEY）或 AI 为手动模式：没有生成任何内容。选择和提示词已保存。",
  "aiRefs.error.openai_auth":
    "OpenAI 拒绝了密钥（OPENAI_API_KEY 无效或无权限）。",
  "aiRefs.error.openai_rate_limit":
    "OpenAI 已达使用上限或额度不足。请稍后再试。",
  "aiRefs.error.openai_rejected":
    "OpenAI 拒绝了请求（提示词或模型）。请检查提示词或“设置”中的模型。",
  "aiRefs.error.openai_failed": "OpenAI 没有响应。请重试；选择已保存。",
  "aiRefs.files": "已生成的文件",
  "aiRefs.none": "尚未生成。",
  "aiRefs.mockBadge": "Mock 示例",
  "aiRefs.openSheet": "打开说明",
  "aiRefs.request.title": "AI 生成的参考",
  "aiRefs.request.body":
    "Wellmix 期望产品在生产完成后的大致样子图片和产品说明。仅供参考，不是样品照片。",
  "aiRefs.settings.section": "分组选择中的 AI 参考（OpenAI）",
  "aiRefs.settings.hint":
    "“保存本组的选择”下方面板的默认提示词（每次选择可修改）。商品数据会自动加入。",
  "aiRefs.settings.imageModel": "图片模型（OpenAI）",
  "aiRefs.settings.textModel": "文字模型（OpenAI）",
  "aiRefs.settings.key.on": "已配置 OPENAI_API_KEY",
  "aiRefs.settings.key.off": "没有 OPENAI_API_KEY",
  "settings.error.ai_prompt_invalid":
    "AI 提示词为空或过长（最多 2000 个字符）。",
  "settings.error.openai_model_invalid":
    "OpenAI 模型名称无效（字母、数字、点、连字符；最多 80 个）。",
};
