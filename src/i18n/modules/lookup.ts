/*
 * Textos da busca de produto por foto ou link (nova solicitação).
 * `pt` é a fonte; `en` e `zh` têm exatamente as mesmas chaves.
 */
export const pt = {
  "lookup.title": "Encontrar o produto por foto ou link",
  "lookup.intro":
    "Envie uma foto ou cole o link do produto (loja, marketplace, catálogo). Procuramos nos produtos cadastrados e sugerimos o preenchimento dos campos.",
  "lookup.photo": "Escolher ou tirar foto",
  "lookup.photoHint": "A busca começa assim que a foto é escolhida.",
  "lookup.url": "Link do produto",
  "lookup.urlPlaceholder": "https://…",
  "lookup.search": "Buscar produto",
  "lookup.searching": "Buscando…",
  "lookup.result": "Resultado da busca",
  "lookup.yourPhoto": "Foto enviada",
  "lookup.link": "Link",
  "lookup.linkPrice": "Preço no link (só referência)",
  "lookup.linkStatus.blocked":
    "O site não permitiu a leitura automática do link (comum em marketplaces chineses). Siga pela foto ou preencha os campos.",
  "lookup.linkStatus.failed":
    "Não conseguimos abrir o link agora. Confira o endereço ou siga pela foto.",
  "lookup.linkStatus.invalid":
    "Link inválido ou não permitido. Use um endereço público começando com http:// ou https://.",
  "lookup.matches": "Produtos cadastrados que parecem ser o seu",
  "lookup.matchesHint":
    "Escolha um para preencher o produto da solicitação, ou siga sem nenhum.",
  "lookup.use": "Usar este produto",
  "lookup.using": "Selecionado",
  "lookup.none": "Nenhum destes é o meu produto",
  "lookup.noMatch":
    'Nenhum produto cadastrado corresponde. Use as sugestões nos campos abaixo e, se for um produto novo, mantenha marcado "produto fora do catálogo".',
  "lookup.reason.category": "mesma categoria",
  "lookup.reason.word": "palavra em comum",
  "lookup.related": "Relacionados no catálogo",
  "lookup.relatedHint":
    "Produtos cadastrados da mesma categoria ou com palavras em comum. Úteis para comparar ou oferecer uma alternativa.",
  "lookup.noExact":
    "Nenhum produto cadastrado parece ser exatamente o mesmo. Veja os relacionados abaixo ou use as sugestões nos campos.",
  "lookup.reason.photo": "mesma foto",
  "lookup.reason.link_photo": "mesma foto do link",
  "lookup.reason.name": "nome parecido",
  "lookup.reason.ai": "semelhança visual (IA)",
  "lookup.ai.customerManual":
    "Não reconhecemos o produto pela foto. Descreva-o nos campos abaixo; a Wellmix confere e completa.",
  "lookup.ai.failed":
    "A IA de imagem não respondeu nesta busca. Veja o motivo em Configurações → Testar IA.",
  "lookup.ai.api": "Sugestões com IA",
  "lookup.ai.mock": "IA em modo de demonstração (mock)",
  "lookup.ai.manual":
    "IA de imagem desligada: sem ela, a busca por foto só reconhece fotos iguais às cadastradas, não o mesmo produto em outra foto. Em Configurações, deixe aiMode em AUTO e use Testar IA; na Vercel ela funciona pelo AI Gateway do projeto ou com ANTHROPIC_API_KEY.",
  "lookup.suggestionsHint":
    'Sugestões: toque em uma para preencher (dá para editar depois) ou deixe "Nenhuma dessas".',
  "lookup.fill.hint":
    "Ao escolher, nome, descrição e especificação são preenchidos com a ficha do produto; dá para editar.",
  "lookup.fill.badge": "Preenchido com a ficha",
  "lookup.fill.attachmentsHint":
    "Fotos, desenhos ou arquivos do produto que você procura (ajudam a Wellmix a encontrar fornecedores).",
  "lookup.noneOption": "Nenhuma dessas",
  "lookup.source.link": "link",
  "lookup.source.catalog": "catálogo",
  "lookup.source.ai": "IA",
  "lookup.source.mock": "mock",
  "lookup.new": "Nova busca",
  "lookup.referenceNote": "Link de referência:",
  "lookup.error.lookup_empty": "Envie uma foto ou cole um link para buscar.",
  "lookup.error.lookup_invalid_url":
    "Link inválido. Use um endereço público começando com http:// ou https://.",
  "lookup.error.lookup_not_image": "O arquivo enviado não é uma imagem.",
  "lookup.error.forbidden": "Sem permissão para buscar produtos.",
};
export const en: Record<keyof typeof pt, string> = {
  "lookup.title": "Find the product by photo or link",
  "lookup.intro":
    "Send a photo or paste the product link (store, marketplace, catalog). We search the registered products and suggest how to fill in the fields.",
  "lookup.photo": "Choose or take a photo",
  "lookup.photoHint": "The search starts as soon as the photo is chosen.",
  "lookup.url": "Product link",
  "lookup.urlPlaceholder": "https://…",
  "lookup.search": "Search product",
  "lookup.searching": "Searching…",
  "lookup.result": "Search result",
  "lookup.yourPhoto": "Uploaded photo",
  "lookup.link": "Link",
  "lookup.linkPrice": "Price on the link (reference only)",
  "lookup.linkStatus.blocked":
    "The site did not allow the link to be read automatically (common on Chinese marketplaces). Continue with the photo or fill in the fields.",
  "lookup.linkStatus.failed":
    "We could not open the link right now. Check the address or continue with the photo.",
  "lookup.linkStatus.invalid":
    "Invalid or disallowed link. Use a public address starting with http:// or https://.",
  "lookup.matches": "Registered products that look like yours",
  "lookup.matchesHint":
    "Pick one to fill in the request product, or continue without any.",
  "lookup.use": "Use this product",
  "lookup.using": "Selected",
  "lookup.none": "None of these is my product",
  "lookup.noMatch":
    'No registered product matches. Use the suggestions in the fields below and, if it is a new product, keep "product outside the catalog" checked.',
  "lookup.reason.category": "same category",
  "lookup.reason.word": "word in common",
  "lookup.related": "Related in the catalog",
  "lookup.relatedHint":
    "Registered products in the same category or sharing words. Useful to compare or offer an alternative.",
  "lookup.noExact":
    "No registered product looks exactly the same. See the related ones below or use the suggestions in the fields.",
  "lookup.reason.photo": "same photo",
  "lookup.reason.link_photo": "same photo as the link",
  "lookup.reason.name": "similar name",
  "lookup.reason.ai": "visual similarity (AI)",
  "lookup.ai.customerManual":
    "We could not recognise the product from the photo. Describe it in the fields below; Wellmix will check and complete it.",
  "lookup.ai.failed":
    "Image AI did not answer in this search. See why in Settings → Test AI.",
  "lookup.ai.api": "AI suggestions",
  "lookup.ai.mock": "AI in demo mode (mock)",
  "lookup.ai.manual":
    "Image AI is off: without it, photo search only recognises photos identical to registered ones, not the same product in another photo. In Settings, keep aiMode on AUTO and use Test AI; on Vercel it works through the project's AI Gateway or with ANTHROPIC_API_KEY.",
  "lookup.suggestionsHint":
    'Suggestions: tap one to fill in (you can edit it afterwards) or keep "None of these".',
  "lookup.fill.hint":
    "When chosen, name, description and specification are filled from the product sheet; you can edit them.",
  "lookup.fill.badge": "Filled from the sheet",
  "lookup.fill.attachmentsHint":
    "Photos, drawings or files of the product you are looking for (they help Wellmix find suppliers).",
  "lookup.noneOption": "None of these",
  "lookup.source.link": "link",
  "lookup.source.catalog": "catalog",
  "lookup.source.ai": "AI",
  "lookup.source.mock": "mock",
  "lookup.new": "New search",
  "lookup.referenceNote": "Reference link:",
  "lookup.error.lookup_empty": "Send a photo or paste a link to search.",
  "lookup.error.lookup_invalid_url":
    "Invalid link. Use a public address starting with http:// or https://.",
  "lookup.error.lookup_not_image": "The uploaded file is not an image.",
  "lookup.error.forbidden": "You are not allowed to search products.",
};
export const zh: Record<keyof typeof pt, string> = {
  "lookup.title": "通过照片或链接查找产品",
  "lookup.intro":
    "上传照片或粘贴产品链接（商店、电商平台、目录）。我们会在已登记的产品中查找，并建议如何填写各字段。",
  "lookup.photo": "上传或拍摄照片",
  "lookup.photoHint": "选择照片后立即开始查找。",
  "lookup.url": "产品链接",
  "lookup.urlPlaceholder": "https://…",
  "lookup.search": "查找产品",
  "lookup.searching": "查找中…",
  "lookup.result": "查找结果",
  "lookup.yourPhoto": "已上传的照片",
  "lookup.link": "链接",
  "lookup.linkPrice": "链接上的价格（仅供参考）",
  "lookup.linkStatus.blocked":
    "该网站不允许自动读取链接（中国电商平台常见）。请通过照片继续或手动填写。",
  "lookup.linkStatus.failed": "暂时无法打开该链接。请检查地址或通过照片继续。",
  "lookup.linkStatus.invalid":
    "链接无效或不被允许。请使用以 http:// 或 https:// 开头的公开地址。",
  "lookup.matches": "看起来与您的产品相符的已登记产品",
  "lookup.matchesHint": "选择一个来填写申请中的产品，或不选择任何产品继续。",
  "lookup.use": "使用此产品",
  "lookup.using": "已选择",
  "lookup.none": "这些都不是我的产品",
  "lookup.noMatch":
    "没有相符的已登记产品。请使用下方字段中的建议；如果是新产品，请保持勾选“目录外产品”。",
  "lookup.reason.category": "同一类别",
  "lookup.reason.word": "有共同词",
  "lookup.related": "目录中的相关产品",
  "lookup.relatedHint":
    "同一类别或有共同词的已登记产品，可用于比较或提供替代方案。",
  "lookup.noExact":
    "没有看起来完全相同的已登记产品。请查看下方相关产品或使用字段中的建议。",
  "lookup.reason.photo": "相同照片",
  "lookup.reason.link_photo": "与链接照片相同",
  "lookup.reason.name": "名称相似",
  "lookup.reason.ai": "视觉相似（AI）",
  "lookup.ai.customerManual":
    "未能通过照片识别产品。请在下方字段中描述，Wellmix 会核对并补充。",
  "lookup.ai.failed":
    "本次查找中图像 AI 未响应。请在 设置 → 测试 AI 中查看原因。",
  "lookup.ai.api": "AI 建议",
  "lookup.ai.mock": "AI 演示模式（mock）",
  "lookup.ai.manual":
    "图像 AI 未开启：没有它，照片查找只能识别与已登记照片完全相同的照片，无法识别另一张照片中的同一产品。请在设置中将 aiMode 保持为 AUTO 并使用“测试 AI”；在 Vercel 上可通过项目的 AI Gateway 或 ANTHROPIC_API_KEY 使用。",
  "lookup.suggestionsHint":
    "建议：点击其中一项即可填写（之后可修改），或保持“都不选”。",
  "lookup.fill.hint":
    "选择后，名称、描述和规格会根据产品档案自动填写，可以修改。",
  "lookup.fill.badge": "已按档案填写",
  "lookup.fill.attachmentsHint":
    "您要找的产品的照片、图纸或文件（帮助 Wellmix 寻找供应商）。",
  "lookup.noneOption": "都不选",
  "lookup.source.link": "链接",
  "lookup.source.catalog": "目录",
  "lookup.source.ai": "AI",
  "lookup.source.mock": "mock",
  "lookup.new": "重新查找",
  "lookup.referenceNote": "参考链接：",
  "lookup.error.lookup_empty": "请上传照片或粘贴链接后再查找。",
  "lookup.error.lookup_invalid_url":
    "链接无效。请使用以 http:// 或 https:// 开头的公开地址。",
  "lookup.error.lookup_not_image": "上传的文件不是图片。",
  "lookup.error.forbidden": "您没有查找产品的权限。",
};
