/*
 * Textos do módulo "marketing" (Visão de Produto): marketing studio, prévia e
 * venda do kit de marketing. `pt` é a fonte; `en` e `zh` precisam ter
 * exatamente as mesmas chaves (teste de paridade).
 */
export const pt = {
  /* ---- Lista ---- */
  "marketing.title": "Marketing",
  "marketing.subtitle":
    "Kits de marketing por produto: prévia → oferta → compra → pagamento → liberação.",
  "marketing.help.list.body":
    "Cada kit nasce da ficha do produto (nome, categoria, material, cores, Pantone e imagens comerciais). A Wellmix escreve ou revisa os textos (a IA só sugere), envia prévias e oferece ao cliente com um preço. O cliente compra, a Wellmix confirma o pagamento em modo manual e libera os arquivos finais.",
  "marketing.help.list.steps":
    "Criar: escolha o produto e, se já souber, o cliente e o preço.\nPreparar: textos, prévias e sugestão de IA no studio do kit.\nOferecer: o cliente passa a ver a prévia e o preço.\nCompra e pagamento: o cliente compra; a Wellmix confirma o recebimento.\nLiberar: envie os arquivos finais e libere o download.",
  "marketing.help.customer.body":
    "Aqui ficam os kits de marketing que a Wellmix preparou para os seus produtos. Você vê a prévia e o preço a partir da oferta; ao comprar, a Wellmix confirma o pagamento e libera os arquivos finais para download.",
  "marketing.help.customer.steps":
    'Prévia: abra o kit e veja as imagens e textos propostos.\nCompra: aceite a oferta pelo botão "Comprar kit".\nLiberação: depois da confirmação do pagamento, baixe os arquivos finais.',
  "marketing.customer.intro":
    "Prévia → compra → liberação. Você recebe a prévia quando a Wellmix faz a oferta; depois da compra e da confirmação do pagamento, os arquivos finais ficam disponíveis para download.",
  "marketing.newKit": "Novo kit",
  "marketing.disabled":
    "O marketing studio está desligado nas configurações (marketingEnabled). Os kits existentes continuam visíveis, mas nenhuma ação nova é possível.",
  "marketing.filter.status": "Situação",
  "marketing.filter.customer": "Cliente",
  "marketing.filter.product": "Produto",
  "marketing.filter.apply": "Filtrar",
  "marketing.filter.clear": "Limpar filtros",
  "marketing.status.draft": "Rascunho",
  "marketing.status.preview": "Prévia",
  "marketing.status.offered": "Oferecido",
  "marketing.status.purchased": "Comprado",
  "marketing.status.paid": "Pago",
  "marketing.status.released": "Liberado",
  "marketing.status.cancelled": "Cancelado",
  "marketing.col.kit": "Kit",
  "marketing.col.created": "Criado",
  "marketing.col.offered": "Oferta",
  "marketing.col.released": "Liberação",
  "marketing.open": "Abrir",
  "marketing.none": "Nenhum kit encontrado.",
  "marketing.none.customer": "Nenhum kit oferecido a você ainda.",
  "marketing.noCustomer": "Sem cliente",
  "marketing.ok": "Ação registrada.",

  /* ---- Novo kit ---- */
  "marketing.new.title": "Novo kit de marketing",
  "marketing.new.help.body":
    "O kit é alimentado pela ficha do produto: nome, categoria, material, cor, Pantone e imagens comerciais entram automaticamente. O preço padrão vem das configurações e pode ser alterado por kit até a compra.",
  "marketing.new.help.steps":
    "Produto: escolha um produto ativo do catálogo.\nCliente: opcional agora; obrigatório para oferecer.\nPreço: confirme ou ajuste o valor e a moeda.\nDepois: o studio do kit abre para textos, prévias e oferta.",
  "marketing.new.product": "Produto",
  "marketing.new.customer": "Cliente",
  "marketing.new.customerHint":
    "Opcional agora; obrigatório para oferecer o kit.",
  "marketing.new.name": "Nome do kit",
  "marketing.new.nameHint":
    'Em branco, o sistema gera "Kit de marketing · <produto>".',
  "marketing.new.price": "Preço do kit",
  "marketing.new.priceHint":
    "Padrão das configurações (marketingKitDefaultPrice); editável até a compra.",
  "marketing.new.currency": "Moeda",
  "marketing.new.submit": "Criar kit",
  "marketing.new.noProducts": "Nenhum produto ativo no catálogo.",

  /* ---- Studio ---- */
  "marketing.kit.help.body":
    'Studio do kit: o produto alimenta o card "Produto" (somente leitura); os textos são seus, com ou sem sugestão de IA (a IA só sugere, você confirma campo a campo). Prévias ficam visíveis ao cliente a partir da oferta; os arquivos finais só depois de liberados.',
  "marketing.kit.help.steps":
    "Textos: escreva ou revise conceito, slogan, descrição, campanha e cores.\nIA: peça uma sugestão e use só o que aprovar.\nPrévias: envie imagens ou PDF de prévia.\nOferecer: com cliente definido, ofereça o kit pelo preço combinado.\nPagamento e liberação: confirme o pagamento, envie os arquivos finais e libere.",
  "marketing.kit.help.customer.body":
    "Este é o kit de marketing preparado pela Wellmix para o seu produto. Veja a prévia e os textos propostos; ao comprar, a Wellmix confirma o pagamento e libera os arquivos finais para download.",
  "marketing.kit.help.customer.steps":
    'Prévia: confira as imagens e os textos.\nComprar: aceite a oferta pelo preço indicado.\nBaixar: depois da liberação, os arquivos finais aparecem em "Arquivos finais".',
  "marketing.kit.timeline": "Linha do tempo",
  "marketing.kit.cancelled": "Kit cancelado",
  "marketing.kit.cancelledNote": "Motivo",
  "marketing.step.draft": "Rascunho",
  "marketing.step.preview": "Prévia",
  "marketing.step.offered": "Oferta",
  "marketing.step.purchased": "Compra",
  "marketing.step.paid": "Pagamento",
  "marketing.step.released": "Liberação",
  "marketing.dates.created": "Criado em",
  "marketing.dates.offered": "Oferecido em",
  "marketing.dates.purchased": "Comprado em",
  "marketing.dates.paid": "Pago em",
  "marketing.dates.released": "Liberado em",

  "marketing.product.title": "Produto",
  "marketing.product.fromSheet":
    "Alimentado pela ficha do produto (somente leitura).",
  "marketing.product.primaryPhoto": "Foto principal",
  "marketing.product.commercialPhotos": "Imagens comerciais",
  "marketing.product.noPhotos": "Nenhuma imagem disponível para este kit.",
  "marketing.product.openSheet": "Abrir ficha do produto",
  "marketing.product.missing": "Produto não encontrado.",
  "marketing.field.line": "Linha",
  "marketing.field.sku": "SKU",
  "marketing.field.category": "Categoria",
  "marketing.field.material": "Material",
  "marketing.field.color": "Cor",
  "marketing.field.pantone": "Pantone",
  "marketing.field.specification": "Especificação",
  "marketing.field.name": "Nome do kit",
  "marketing.field.customer": "Cliente",
  "marketing.field.price": "Preço",
  "marketing.field.currency": "Moeda",
  "marketing.field.concept": "Conceito",
  "marketing.field.slogan": "Slogan",
  "marketing.field.description": "Descrição comercial",
  "marketing.field.campaign": "Campanha",
  "marketing.field.colors": "Cores",
  "marketing.field.colorsHint": "Uma cor por linha (ou separadas por vírgula).",
  "marketing.field.notes": "Notas internas",

  "marketing.texts.title": "Textos do kit",
  "marketing.texts.customerLocked": "Cliente travado depois da oferta.",
  "marketing.texts.priceLocked": "Preço e moeda travados depois da compra.",
  "marketing.texts.priceEditable": "Editável até a compra.",
  "marketing.texts.save": "Salvar textos",
  "marketing.texts.empty": "Textos ainda não definidos.",

  "marketing.ai.title": "Sugestão de textos (IA)",
  "marketing.ai.principle":
    'A IA só sugere. Nada entra no kit sem um humano revisar e confirmar os textos pelo botão "Usar estes textos (revisados)".',
  "marketing.ai.manual":
    "A IA não está configurada (modo manual): sem ANTHROPIC_API_KEY ou com aiMode = MANUAL nenhuma sugestão é gerada. Escreva os textos manualmente.",
  "marketing.ai.manualAdmin": "Configurar em Configurações",
  "marketing.ai.context": "Contexto (opcional)",
  "marketing.ai.contextHint":
    "Ex.: campanha de Dia das Mães, público jovem, tom informal.",
  "marketing.ai.request": "Pedir sugestão",
  "marketing.ai.mock": "mock",
  "marketing.ai.api": "API",
  "marketing.ai.mockHint":
    "Modo mock: exemplo rotulado para demonstração; nenhum dado real foi analisado.",
  "marketing.ai.model": "Modelo",
  "marketing.ai.status.suggested": "Aguardando revisão",
  "marketing.ai.status.applied": "Usada",
  "marketing.ai.status.discarded": "Descartada",
  "marketing.ai.latest": "Sugestão mais recente",
  "marketing.ai.review":
    "Revise cada campo abaixo antes de confirmar; o que você editar é o que entra no kit.",
  "marketing.ai.use": "Usar estes textos (revisados)",
  "marketing.ai.prompt": "Prompt enviado",
  "marketing.ai.imagePrompt": "Prompt de imagem sugerido",
  "marketing.ai.none": "Nenhuma sugestão pedida ainda.",
  "marketing.ai.history": "Sugestões anteriores",

  "marketing.previews.title": "Prévias",
  "marketing.previews.hint": "Visíveis ao cliente a partir da oferta.",
  "marketing.previews.none": "Nenhuma prévia enviada.",
  "marketing.previews.upload": "Enviar prévias",
  "marketing.files.title": "Arquivos finais",
  "marketing.files.hint": "Visíveis ao cliente só depois da liberação.",
  "marketing.files.none": "Nenhum arquivo final enviado.",
  "marketing.files.upload": "Enviar arquivos finais",
  "marketing.files.afterPayment":
    "Os arquivos finais são liberados após a confirmação do pagamento.",
  "marketing.files.select": "Arquivos (imagem ou PDF)",

  "marketing.status.title": "Situação e ações",
  "marketing.action.offer": "Oferecer ao cliente",
  "marketing.action.offerHint":
    'Defina o cliente no card "Textos do kit" para poder oferecer.',
  "marketing.action.offerReady":
    "O cliente passa a ver as prévias e o preço; o preço continua editável até a compra.",
  "marketing.action.cancel": "Cancelar kit",
  "marketing.action.cancelNote": "Motivo (opcional)",
  "marketing.action.purchaseByCustomer": "Registrar compra pelo cliente",
  "marketing.action.purchaseByCustomerHint":
    "Use quando o cliente aceitou a oferta fora do portal. Cria o pagamento pendente.",
  "marketing.action.awaitingCustomer": "Aguardando o cliente aceitar a oferta.",
  "marketing.payment.pending": "Pagamento pendente",
  "marketing.payment.amount": "Valor",
  "marketing.payment.manual":
    "Modo manual: a Wellmix confirma o recebimento; nenhum gateway está conectado.",
  "marketing.payment.proof": "Comprovante (opcional)",
  "marketing.payment.confirm": "Confirmar pagamento",
  "marketing.payment.confirmed": "Pagamento confirmado",
  "marketing.action.release": "Liberar arquivos",
  "marketing.action.releaseHint":
    "Envie ao menos um arquivo final antes de liberar.",
  "marketing.action.releaseReady":
    "{count} arquivo(s) final(is) pronto(s) para liberar ao cliente.",
  "marketing.released.summary":
    "Kit liberado. O cliente já pode baixar os arquivos finais.",

  "marketing.customer.offer": "A Wellmix ofereceu este kit a você.",
  "marketing.customer.buy": "Comprar kit",
  "marketing.customer.buyHint":
    "Ao comprar, um pagamento pendente é registrado; a Wellmix confirma o recebimento (modo manual) e libera os arquivos finais.",
  "marketing.customer.awaitingPayment":
    "Compra registrada. Aguardando a confirmação do pagamento pela Wellmix.",
  "marketing.customer.awaitingRelease":
    "Pagamento confirmado. Aguardando a liberação dos arquivos finais.",
  "marketing.customer.released":
    'Arquivos liberados: baixe em "Arquivos finais".',

  /* ---- Erros (?error=) ---- */
  "marketing.error.marketing_disabled":
    "O marketing studio está desligado nas configurações.",
  "marketing.error.not_found": "Kit ou produto não encontrado.",
  "marketing.error.invalid_customer": "Cliente inválido.",
  "marketing.error.invalid_price":
    "Preço inválido (use um valor maior ou igual a zero).",
  "marketing.error.kit_cancelled":
    "Este kit está cancelado; nada pode ser alterado.",
  "marketing.error.invalid_status":
    "A ação não vale para a situação atual do kit.",
  "marketing.error.customer_required":
    "Defina o cliente antes de oferecer o kit.",
  "marketing.error.forbidden": "Você não tem permissão para esta ação.",
  "marketing.error.no_final_files":
    "Envie ao menos um arquivo final antes de liberar.",
  "marketing.error.file_required": "Selecione ao menos um arquivo.",
  "marketing.error.ai_unavailable":
    "A IA não está configurada (modo manual). Nenhuma sugestão foi gerada.",
  "marketing.error.ai_invalid_response":
    "A IA respondeu em formato inesperado. Tente de novo ou escreva os textos manualmente.",
  "marketing.error.ai_request_failed": "Falha ao chamar a IA. Tente de novo.",
  "marketing.error.already_decided":
    "Esta sugestão já foi usada ou descartada.",
  "marketing.error.invalid_input": "Dados inválidos. Verifique os campos.",
  "marketing.error.mime": "Formato de arquivo não aceito: envie imagem ou PDF.",
  "marketing.error.too_large": "Arquivo grande demais.",
  "marketing.error.empty": "Arquivo vazio.",
};

export const en: Record<keyof typeof pt, string> = {
  "marketing.title": "Marketing",
  "marketing.subtitle":
    "Marketing kits per product: preview → offer → purchase → payment → release.",
  "marketing.help.list.body":
    "Each kit is fed by the product sheet (name, category, material, colors, Pantone and commercial images). Wellmix writes or reviews the texts (AI only suggests), uploads previews and offers the kit to the customer at a price. The customer buys, Wellmix confirms the payment manually and releases the final files.",
  "marketing.help.list.steps":
    "Create: pick the product and, if known, the customer and price.\nPrepare: texts, previews and AI suggestion in the kit studio.\nOffer: the customer starts seeing the preview and the price.\nPurchase and payment: the customer buys; Wellmix confirms receipt.\nRelease: upload the final files and release the download.",
  "marketing.help.customer.body":
    "These are the marketing kits Wellmix prepared for your products. You see the preview and the price once offered; after purchase, Wellmix confirms the payment and releases the final files for download.",
  "marketing.help.customer.steps":
    'Preview: open the kit and review the proposed images and texts.\nPurchase: accept the offer with the "Buy kit" button.\nRelease: after the payment is confirmed, download the final files.',
  "marketing.customer.intro":
    "Preview → purchase → release. You receive the preview when Wellmix makes the offer; after purchase and payment confirmation, the final files become available for download.",
  "marketing.newKit": "New kit",
  "marketing.disabled":
    "The marketing studio is turned off in settings (marketingEnabled). Existing kits remain visible, but no new action is possible.",
  "marketing.filter.status": "Status",
  "marketing.filter.customer": "Customer",
  "marketing.filter.product": "Product",
  "marketing.filter.apply": "Filter",
  "marketing.filter.clear": "Clear filters",
  "marketing.status.draft": "Draft",
  "marketing.status.preview": "Preview",
  "marketing.status.offered": "Offered",
  "marketing.status.purchased": "Purchased",
  "marketing.status.paid": "Paid",
  "marketing.status.released": "Released",
  "marketing.status.cancelled": "Cancelled",
  "marketing.col.kit": "Kit",
  "marketing.col.created": "Created",
  "marketing.col.offered": "Offer",
  "marketing.col.released": "Release",
  "marketing.open": "Open",
  "marketing.none": "No kit found.",
  "marketing.none.customer": "No kit has been offered to you yet.",
  "marketing.noCustomer": "No customer",
  "marketing.ok": "Action recorded.",

  "marketing.new.title": "New marketing kit",
  "marketing.new.help.body":
    "The kit is fed by the product sheet: name, category, material, color, Pantone and commercial images come in automatically. The default price comes from settings and can be changed per kit until purchase.",
  "marketing.new.help.steps":
    "Product: pick an active product from the catalog.\nCustomer: optional now; required to offer.\nPrice: confirm or adjust the amount and currency.\nNext: the kit studio opens for texts, previews and offer.",
  "marketing.new.product": "Product",
  "marketing.new.customer": "Customer",
  "marketing.new.customerHint": "Optional now; required to offer the kit.",
  "marketing.new.name": "Kit name",
  "marketing.new.nameHint":
    'Leave blank and the system generates "Kit de marketing · <product>".',
  "marketing.new.price": "Kit price",
  "marketing.new.priceHint":
    "Default from settings (marketingKitDefaultPrice); editable until purchase.",
  "marketing.new.currency": "Currency",
  "marketing.new.submit": "Create kit",
  "marketing.new.noProducts": "No active product in the catalog.",

  "marketing.kit.help.body":
    'Kit studio: the product feeds the "Product" card (read-only); the texts are yours, with or without an AI suggestion (AI only suggests, you confirm field by field). Previews are visible to the customer from the offer on; final files only after release.',
  "marketing.kit.help.steps":
    "Texts: write or review concept, slogan, description, campaign and colors.\nAI: request a suggestion and use only what you approve.\nPreviews: upload preview images or PDF.\nOffer: with a customer set, offer the kit at the agreed price.\nPayment and release: confirm the payment, upload the final files and release.",
  "marketing.kit.help.customer.body":
    "This is the marketing kit Wellmix prepared for your product. Review the preview and the proposed texts; after purchase, Wellmix confirms the payment and releases the final files for download.",
  "marketing.kit.help.customer.steps":
    'Preview: check the images and texts.\nBuy: accept the offer at the indicated price.\nDownload: after release, the final files appear under "Final files".',
  "marketing.kit.timeline": "Timeline",
  "marketing.kit.cancelled": "Kit cancelled",
  "marketing.kit.cancelledNote": "Reason",
  "marketing.step.draft": "Draft",
  "marketing.step.preview": "Preview",
  "marketing.step.offered": "Offer",
  "marketing.step.purchased": "Purchase",
  "marketing.step.paid": "Payment",
  "marketing.step.released": "Release",
  "marketing.dates.created": "Created on",
  "marketing.dates.offered": "Offered on",
  "marketing.dates.purchased": "Purchased on",
  "marketing.dates.paid": "Paid on",
  "marketing.dates.released": "Released on",

  "marketing.product.title": "Product",
  "marketing.product.fromSheet": "Fed by the product sheet (read-only).",
  "marketing.product.primaryPhoto": "Main photo",
  "marketing.product.commercialPhotos": "Commercial images",
  "marketing.product.noPhotos": "No image available for this kit.",
  "marketing.product.openSheet": "Open product sheet",
  "marketing.product.missing": "Product not found.",
  "marketing.field.line": "Line",
  "marketing.field.sku": "SKU",
  "marketing.field.category": "Category",
  "marketing.field.material": "Material",
  "marketing.field.color": "Color",
  "marketing.field.pantone": "Pantone",
  "marketing.field.specification": "Specification",
  "marketing.field.name": "Kit name",
  "marketing.field.customer": "Customer",
  "marketing.field.price": "Price",
  "marketing.field.currency": "Currency",
  "marketing.field.concept": "Concept",
  "marketing.field.slogan": "Slogan",
  "marketing.field.description": "Commercial description",
  "marketing.field.campaign": "Campaign",
  "marketing.field.colors": "Colors",
  "marketing.field.colorsHint": "One color per line (or comma-separated).",
  "marketing.field.notes": "Internal notes",

  "marketing.texts.title": "Kit texts",
  "marketing.texts.customerLocked": "Customer locked after the offer.",
  "marketing.texts.priceLocked": "Price and currency locked after purchase.",
  "marketing.texts.priceEditable": "Editable until purchase.",
  "marketing.texts.save": "Save texts",
  "marketing.texts.empty": "Texts not defined yet.",

  "marketing.ai.title": "Text suggestion (AI)",
  "marketing.ai.principle":
    'AI only suggests. Nothing enters the kit until a human reviews and confirms the texts with the "Use these texts (reviewed)" button.',
  "marketing.ai.manual":
    "AI is not configured (manual mode): without ANTHROPIC_API_KEY or with aiMode = MANUAL no suggestion is generated. Write the texts manually.",
  "marketing.ai.manualAdmin": "Configure in Settings",
  "marketing.ai.context": "Context (optional)",
  "marketing.ai.contextHint":
    "E.g.: Mother's Day campaign, young audience, informal tone.",
  "marketing.ai.request": "Request suggestion",
  "marketing.ai.mock": "mock",
  "marketing.ai.api": "API",
  "marketing.ai.mockHint":
    "Mock mode: labeled example for demonstration; no real data was analyzed.",
  "marketing.ai.model": "Model",
  "marketing.ai.status.suggested": "Awaiting review",
  "marketing.ai.status.applied": "Used",
  "marketing.ai.status.discarded": "Discarded",
  "marketing.ai.latest": "Latest suggestion",
  "marketing.ai.review":
    "Review each field below before confirming; what you edit is what enters the kit.",
  "marketing.ai.use": "Use these texts (reviewed)",
  "marketing.ai.prompt": "Prompt sent",
  "marketing.ai.imagePrompt": "Suggested image prompt",
  "marketing.ai.none": "No suggestion requested yet.",
  "marketing.ai.history": "Previous suggestions",

  "marketing.previews.title": "Previews",
  "marketing.previews.hint": "Visible to the customer from the offer on.",
  "marketing.previews.none": "No preview uploaded.",
  "marketing.previews.upload": "Upload previews",
  "marketing.files.title": "Final files",
  "marketing.files.hint": "Visible to the customer only after release.",
  "marketing.files.none": "No final file uploaded.",
  "marketing.files.upload": "Upload final files",
  "marketing.files.afterPayment":
    "Final files are released after the payment is confirmed.",
  "marketing.files.select": "Files (image or PDF)",

  "marketing.status.title": "Status and actions",
  "marketing.action.offer": "Offer to customer",
  "marketing.action.offerHint":
    'Set the customer in the "Kit texts" card to be able to offer.',
  "marketing.action.offerReady":
    "The customer starts seeing the previews and the price; the price stays editable until purchase.",
  "marketing.action.cancel": "Cancel kit",
  "marketing.action.cancelNote": "Reason (optional)",
  "marketing.action.purchaseByCustomer": "Record purchase by customer",
  "marketing.action.purchaseByCustomerHint":
    "Use when the customer accepted the offer outside the portal. Creates the pending payment.",
  "marketing.action.awaitingCustomer":
    "Waiting for the customer to accept the offer.",
  "marketing.payment.pending": "Payment pending",
  "marketing.payment.amount": "Amount",
  "marketing.payment.manual":
    "Manual mode: Wellmix confirms receipt; no gateway is connected.",
  "marketing.payment.proof": "Proof (optional)",
  "marketing.payment.confirm": "Confirm payment",
  "marketing.payment.confirmed": "Payment confirmed",
  "marketing.action.release": "Release files",
  "marketing.action.releaseHint":
    "Upload at least one final file before releasing.",
  "marketing.action.releaseReady":
    "{count} final file(s) ready to release to the customer.",
  "marketing.released.summary":
    "Kit released. The customer can now download the final files.",

  "marketing.customer.offer": "Wellmix offered this kit to you.",
  "marketing.customer.buy": "Buy kit",
  "marketing.customer.buyHint":
    "When you buy, a pending payment is recorded; Wellmix confirms receipt (manual mode) and releases the final files.",
  "marketing.customer.awaitingPayment":
    "Purchase recorded. Waiting for Wellmix to confirm the payment.",
  "marketing.customer.awaitingRelease":
    "Payment confirmed. Waiting for the final files to be released.",
  "marketing.customer.released":
    'Files released: download them under "Final files".',

  "marketing.error.marketing_disabled":
    "The marketing studio is turned off in settings.",
  "marketing.error.not_found": "Kit or product not found.",
  "marketing.error.invalid_customer": "Invalid customer.",
  "marketing.error.invalid_price":
    "Invalid price (use a value greater than or equal to zero).",
  "marketing.error.kit_cancelled":
    "This kit is cancelled; nothing can be changed.",
  "marketing.error.invalid_status":
    "The action does not apply to the kit's current status.",
  "marketing.error.customer_required":
    "Set the customer before offering the kit.",
  "marketing.error.forbidden": "You do not have permission for this action.",
  "marketing.error.no_final_files":
    "Upload at least one final file before releasing.",
  "marketing.error.file_required": "Select at least one file.",
  "marketing.error.ai_unavailable":
    "AI is not configured (manual mode). No suggestion was generated.",
  "marketing.error.ai_invalid_response":
    "The AI answered in an unexpected format. Try again or write the texts manually.",
  "marketing.error.ai_request_failed": "The AI call failed. Try again.",
  "marketing.error.already_decided":
    "This suggestion was already used or discarded.",
  "marketing.error.invalid_input": "Invalid data. Check the fields.",
  "marketing.error.mime": "File format not accepted: upload an image or PDF.",
  "marketing.error.too_large": "File too large.",
  "marketing.error.empty": "Empty file.",
};

export const zh: Record<keyof typeof pt, string> = {
  "marketing.title": "营销",
  "marketing.subtitle": "按产品的营销套件：预览 → 报价 → 购买 → 付款 → 发布。",
  "marketing.help.list.body":
    "每个套件由产品档案生成（名称、类别、材质、颜色、Pantone 和商业图片）。Wellmix 撰写或审核文案（AI 仅提供建议），上传预览并以一定价格向客户报价。客户购买后，Wellmix 手动确认付款并发布最终文件。",
  "marketing.help.list.steps":
    "创建：选择产品，如已知则选择客户和价格。\n准备：在套件工作室中编辑文案、预览和 AI 建议。\n报价：客户开始看到预览和价格。\n购买与付款：客户购买；Wellmix 确认收款。\n发布：上传最终文件并开放下载。",
  "marketing.help.customer.body":
    "这里是 Wellmix 为您的产品准备的营销套件。报价后您可以看到预览和价格；购买后，Wellmix 确认付款并发布最终文件供下载。",
  "marketing.help.customer.steps":
    "预览：打开套件，查看建议的图片和文案。\n购买：点击“购买套件”接受报价。\n发布：付款确认后，下载最终文件。",
  "marketing.customer.intro":
    "预览 → 购买 → 发布。Wellmix 报价后您会收到预览；购买并确认付款后，最终文件即可下载。",
  "marketing.newKit": "新建套件",
  "marketing.disabled":
    "营销工作室已在设置中关闭（marketingEnabled）。现有套件仍可查看，但无法执行新操作。",
  "marketing.filter.status": "状态",
  "marketing.filter.customer": "客户",
  "marketing.filter.product": "产品",
  "marketing.filter.apply": "筛选",
  "marketing.filter.clear": "清除筛选",
  "marketing.status.draft": "草稿",
  "marketing.status.preview": "预览",
  "marketing.status.offered": "已报价",
  "marketing.status.purchased": "已购买",
  "marketing.status.paid": "已付款",
  "marketing.status.released": "已发布",
  "marketing.status.cancelled": "已取消",
  "marketing.col.kit": "套件",
  "marketing.col.created": "创建",
  "marketing.col.offered": "报价",
  "marketing.col.released": "发布",
  "marketing.open": "打开",
  "marketing.none": "未找到套件。",
  "marketing.none.customer": "尚未向您报价任何套件。",
  "marketing.noCustomer": "无客户",
  "marketing.ok": "操作已记录。",

  "marketing.new.title": "新建营销套件",
  "marketing.new.help.body":
    "套件由产品档案生成：名称、类别、材质、颜色、Pantone 和商业图片自动带入。默认价格来自设置，购买前可按套件修改。",
  "marketing.new.help.steps":
    "产品：从目录中选择一个有效产品。\n客户：现在可选；报价时必填。\n价格：确认或调整金额和币种。\n下一步：打开套件工作室编辑文案、预览和报价。",
  "marketing.new.product": "产品",
  "marketing.new.customer": "客户",
  "marketing.new.customerHint": "现在可选；报价时必须填写。",
  "marketing.new.name": "套件名称",
  "marketing.new.nameHint": "留空则系统生成“Kit de marketing · <产品>”。",
  "marketing.new.price": "套件价格",
  "marketing.new.priceHint":
    "来自设置的默认值（marketingKitDefaultPrice）；购买前可修改。",
  "marketing.new.currency": "币种",
  "marketing.new.submit": "创建套件",
  "marketing.new.noProducts": "目录中没有有效产品。",

  "marketing.kit.help.body":
    "套件工作室：产品档案填充“产品”卡片（只读）；文案由您编写，可参考 AI 建议（AI 仅建议，由您逐项确认）。预览自报价起对客户可见；最终文件仅在发布后可见。",
  "marketing.kit.help.steps":
    "文案：撰写或审核概念、口号、描述、活动和颜色。\nAI：请求建议，只采用您认可的内容。\n预览：上传预览图片或 PDF。\n报价：设定客户后，按约定价格报价。\n付款与发布：确认付款，上传最终文件并发布。",
  "marketing.kit.help.customer.body":
    "这是 Wellmix 为您的产品准备的营销套件。查看预览和建议文案；购买后，Wellmix 确认付款并发布最终文件供下载。",
  "marketing.kit.help.customer.steps":
    "预览：查看图片和文案。\n购买：按标示价格接受报价。\n下载：发布后，最终文件显示在“最终文件”中。",
  "marketing.kit.timeline": "时间线",
  "marketing.kit.cancelled": "套件已取消",
  "marketing.kit.cancelledNote": "原因",
  "marketing.step.draft": "草稿",
  "marketing.step.preview": "预览",
  "marketing.step.offered": "报价",
  "marketing.step.purchased": "购买",
  "marketing.step.paid": "付款",
  "marketing.step.released": "发布",
  "marketing.dates.created": "创建于",
  "marketing.dates.offered": "报价于",
  "marketing.dates.purchased": "购买于",
  "marketing.dates.paid": "付款于",
  "marketing.dates.released": "发布于",

  "marketing.product.title": "产品",
  "marketing.product.fromSheet": "由产品档案生成（只读）。",
  "marketing.product.primaryPhoto": "主图",
  "marketing.product.commercialPhotos": "商业图片",
  "marketing.product.noPhotos": "此套件暂无可用图片。",
  "marketing.product.openSheet": "打开产品档案",
  "marketing.product.missing": "未找到产品。",
  "marketing.field.line": "产品线",
  "marketing.field.sku": "SKU",
  "marketing.field.category": "类别",
  "marketing.field.material": "材质",
  "marketing.field.color": "颜色",
  "marketing.field.pantone": "Pantone",
  "marketing.field.specification": "规格",
  "marketing.field.name": "套件名称",
  "marketing.field.customer": "客户",
  "marketing.field.price": "价格",
  "marketing.field.currency": "币种",
  "marketing.field.concept": "概念",
  "marketing.field.slogan": "口号",
  "marketing.field.description": "商业描述",
  "marketing.field.campaign": "活动",
  "marketing.field.colors": "颜色",
  "marketing.field.colorsHint": "每行一种颜色（或用逗号分隔）。",
  "marketing.field.notes": "内部备注",

  "marketing.texts.title": "套件文案",
  "marketing.texts.customerLocked": "报价后客户已锁定。",
  "marketing.texts.priceLocked": "购买后价格和币种已锁定。",
  "marketing.texts.priceEditable": "购买前可修改。",
  "marketing.texts.save": "保存文案",
  "marketing.texts.empty": "尚未定义文案。",

  "marketing.ai.title": "文案建议（AI）",
  "marketing.ai.principle":
    "AI 仅提供建议。未经人工审核并点击“使用这些文案（已审核）”确认，任何内容都不会进入套件。",
  "marketing.ai.manual":
    "AI 未配置（手动模式）：没有 ANTHROPIC_API_KEY 或 aiMode = MANUAL 时不会生成建议。请手动编写文案。",
  "marketing.ai.manualAdmin": "在设置中配置",
  "marketing.ai.context": "上下文（可选）",
  "marketing.ai.contextHint": "例如：母亲节活动、年轻受众、轻松语气。",
  "marketing.ai.request": "请求建议",
  "marketing.ai.mock": "mock",
  "marketing.ai.api": "API",
  "marketing.ai.mockHint":
    "Mock 模式：仅为演示的标注示例；未分析任何真实数据。",
  "marketing.ai.model": "模型",
  "marketing.ai.status.suggested": "待审核",
  "marketing.ai.status.applied": "已采用",
  "marketing.ai.status.discarded": "已弃用",
  "marketing.ai.latest": "最新建议",
  "marketing.ai.review": "确认前请逐项审核；您编辑的内容才会进入套件。",
  "marketing.ai.use": "使用这些文案（已审核）",
  "marketing.ai.prompt": "发送的提示词",
  "marketing.ai.imagePrompt": "建议的图片提示词",
  "marketing.ai.none": "尚未请求建议。",
  "marketing.ai.history": "历史建议",

  "marketing.previews.title": "预览",
  "marketing.previews.hint": "自报价起对客户可见。",
  "marketing.previews.none": "尚未上传预览。",
  "marketing.previews.upload": "上传预览",
  "marketing.files.title": "最终文件",
  "marketing.files.hint": "仅在发布后对客户可见。",
  "marketing.files.none": "尚未上传最终文件。",
  "marketing.files.upload": "上传最终文件",
  "marketing.files.afterPayment": "最终文件将在付款确认后发布。",
  "marketing.files.select": "文件（图片或 PDF）",

  "marketing.status.title": "状态与操作",
  "marketing.action.offer": "向客户报价",
  "marketing.action.offerHint": "请先在“套件文案”卡片中设定客户，才能报价。",
  "marketing.action.offerReady": "客户将看到预览和价格；购买前价格仍可修改。",
  "marketing.action.cancel": "取消套件",
  "marketing.action.cancelNote": "原因（可选）",
  "marketing.action.purchaseByCustomer": "代客户登记购买",
  "marketing.action.purchaseByCustomerHint":
    "当客户在门户之外接受报价时使用。将创建待付款记录。",
  "marketing.action.awaitingCustomer": "等待客户接受报价。",
  "marketing.payment.pending": "待付款",
  "marketing.payment.amount": "金额",
  "marketing.payment.manual":
    "手动模式：由 Wellmix 确认收款；未连接任何支付网关。",
  "marketing.payment.proof": "凭证（可选）",
  "marketing.payment.confirm": "确认付款",
  "marketing.payment.confirmed": "付款已确认",
  "marketing.action.release": "发布文件",
  "marketing.action.releaseHint": "发布前请至少上传一个最终文件。",
  "marketing.action.releaseReady": "{count} 个最终文件可发布给客户。",
  "marketing.released.summary": "套件已发布。客户现在可以下载最终文件。",

  "marketing.customer.offer": "Wellmix 已向您报价此套件。",
  "marketing.customer.buy": "购买套件",
  "marketing.customer.buyHint":
    "购买后将登记一笔待付款；Wellmix 确认收款（手动模式）后发布最终文件。",
  "marketing.customer.awaitingPayment": "购买已登记。等待 Wellmix 确认付款。",
  "marketing.customer.awaitingRelease": "付款已确认。等待发布最终文件。",
  "marketing.customer.released": "文件已发布：请在“最终文件”中下载。",

  "marketing.error.marketing_disabled": "营销工作室已在设置中关闭。",
  "marketing.error.not_found": "未找到套件或产品。",
  "marketing.error.invalid_customer": "客户无效。",
  "marketing.error.invalid_price": "价格无效（请使用大于或等于零的值）。",
  "marketing.error.kit_cancelled": "此套件已取消；无法更改。",
  "marketing.error.invalid_status": "该操作不适用于套件的当前状态。",
  "marketing.error.customer_required": "报价前请先设定客户。",
  "marketing.error.forbidden": "您没有执行此操作的权限。",
  "marketing.error.no_final_files": "发布前请至少上传一个最终文件。",
  "marketing.error.file_required": "请至少选择一个文件。",
  "marketing.error.ai_unavailable": "AI 未配置（手动模式）。未生成任何建议。",
  "marketing.error.ai_invalid_response":
    "AI 返回了意外格式。请重试或手动编写文案。",
  "marketing.error.ai_request_failed": "调用 AI 失败。请重试。",
  "marketing.error.already_decided": "此建议已被采用或弃用。",
  "marketing.error.invalid_input": "数据无效。请检查各字段。",
  "marketing.error.mime": "不支持的文件格式：请上传图片或 PDF。",
  "marketing.error.too_large": "文件过大。",
  "marketing.error.empty": "文件为空。",
};
