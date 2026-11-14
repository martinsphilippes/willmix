/**
 * Dicionário do módulo "certification-artwork" (Fase F: certificação com o
 * OCP, artes do pedido com designer e não conformidade por SKU, tabela de
 * preços): mesmas chaves em pt, en e zh.
 */
export const pt = {
  "role.ocp": "OCP (certificação)",
  "party.ocp": "OCP (certificação)",
  "messages.type.ocp": "OCP",
  "function.designer": "Designer",
  "function.comex_internal": "Comex (interno)",
  "certFlow.title": "Certificação",
  "importFlow.step.cert_memorial": "Memorial descritivo",
  "importFlow.step.cert_lab": "Ensaio em laboratório (laudo)",
  "importFlow.step.cert_registration": "Número de registro (certificado)",
  "importFlow.actor.ocp": "OCP",
  "importFlow.ph.cert_memorial": "",
  "importFlow.ph.cert_lab": "Laboratório / nº do laudo",
  "importFlow.ph.cert_registration": "Nº de registro",
  "importFlow.step.cert_seal": "Selo",
  "certFlow.featured.hint":
    "Memorial e selo: anexe aqui o memorial descritivo em PDF e o selo (com o número do selo ou do registro, se houver). Ao enviar o selo, ele fica vinculado ao pedido, o pedido segue para a próxima etapa e quem faz a arte passa a ver o selo para aplicar na embalagem.",
  "certFlow.featured.follow":
    "Memorial e selo: a certificadora (OCP) do pedido preenche e envia os dois. Aqui você acompanha a situação e abre os arquivos enviados.",
  "certFlow.featured.goto": "Enviar no quadro do alto",
  "importFlow.step.cert_seal_art": "Selo aplicado na arte",
  "importFlow.actor.agency": "agência",
  "importFlow.ph.cert_seal": "Nº do selo ou do registro (opcional)",
  "importFlow.ph.cert_seal_art": "",
  "importFlow.fileReady":
    "Arquivo pronto: {name} ({size}). Agora clique no botão para enviar.",
  "importFlow.error.schema_pending":
    "Este passo ainda não está liberado no sistema. Avise a Wellmix e tente de novo depois.",
  "certFlow.sealHint":
    "Selo de certificação: a certificadora (OCP) do pedido envia o selo. Quem faz a arte da embalagem (a agência do pedido ou a Wellmix) baixa o selo, aplica na arte e envia a arte com o selo. A Wellmix confere.",
  "certFlow.sheetNote": "Certificação pedida na ficha: {note}",
  "certFlow.sheet.intro":
    "Ficha de compra do pedido, para a certificação: fornecedor, produto, caixa, programação, fotos, preço e classificação fiscal. Só leitura.",
  "certFlow.sheet.photosHint": "Fotos do produto e da caixa enviadas na ficha.",
  "certFlow.dossier.hint":
    "Para gerar o selo, o pedido completo está aqui: os itens com foto e código, a ficha de compra (dados técnicos, preço e fotos) e os arquivos do pedido.",
  "certFlow.dossier.certs":
    "Certificações já registradas do produto e do fornecedor:",
  "certFlow.sealReplaced":
    "O despachante trocou o selo (o arquivo ou o número). Aplique o selo atual na arte e envie a arte de novo.",
  "certFlow.notify.sealRequested.subject":
    "Pedido #{n}: gerar o selo de certificação",
  "certFlow.notify.sealRequested.body":
    "Um pedido novo chegou para certificação. Envie no pedido o selo de certificação e, quando o cartão pedir, o memorial descritivo. Quem faz a arte da embalagem recebe o selo para aplicar.",
  "certFlow.notify.sealReady.subject":
    "Pedido #{n}: selo de certificação disponível",
  "certFlow.notify.sealReady.body":
    "O despachante enviou o selo de certificação. Baixe o selo no pedido, aplique na arte da embalagem e envie a arte com o selo.",
  "certFlow.notify.sealChanged.subject":
    "Pedido #{n}: selo de certificação trocado",
  "certFlow.notify.sealChanged.body":
    "O despachante enviou um selo novo. Baixe o selo no pedido, aplique na arte da embalagem e envie a arte com o selo de novo.",
  "certFlow.notify.noOcp.subject":
    "Pedido #{n}: sem certificadora (OCP) para o selo e o memorial",
  "certFlow.notify.noOcp.body":
    "O selo de certificação e o memorial descritivo são enviados pela certificadora (OCP) do pedido, e este está sem ela. Vincule a certificadora em Parceiros do pedido.",
  "certFlow.brief.sealPending":
    "Selo de certificação: aguardando o despachante. Deixe o espaço do selo na arte.",
  "certFlow.brief.sealReady":
    "Selo de certificação disponível: baixe no pedido, aplique na arte e envie a arte com o selo.",
  "certFlow.brief.sealSent": "Arte com o selo enviada; a Wellmix confere.",
  "certFlow.brief.sealDone":
    "Selo de certificação aplicado na arte e conferido.",
  "certFlow.brief.sealRejected":
    "Arte com o selo a refazer: veja o motivo no pedido e envie a arte de novo.",
  "certFlow.brief.open": "Ver no pedido",
  "tasks.group.cert_step": "Certificação",
  "tasks.group.cert_validate": "Validar certificação",
  "tasks.seal.issue.title": "Gerar o selo de certificação: pedido #{n}",
  "tasks.seal.issue.detail":
    "Envie o arquivo do selo no pedido. Quem faz a arte recebe para aplicar na embalagem.",
  "tasks.seal.apply.title":
    "Aplicar o selo de certificação na arte: pedido #{n}",
  "tasks.seal.apply.detail":
    "Baixe o selo no pedido e envie a arte com o selo aplicado.",
  "tasks.seal.validate.title": "Validar o selo aplicado na arte: pedido #{n}",
  "tasks.seal.validate.detail":
    "Confira o selo na arte e valide, ou recuse com o motivo.",
  "tasks.seal.assign.title": "Vincular a certificadora (OCP): pedido #{n}",
  "tasks.seal.assign.detail":
    "O pedido está sem certificadora (OCP). Vincule em Parceiros do pedido: o memorial descritivo e o selo são preenchidos e enviados por ela.",
  "tasks.memorial.send.title": "Enviar o memorial descritivo: pedido #{n}",
  "tasks.memorial.send.detail":
    "Anexe o memorial descritivo em PDF no quadro do alto do cartão Certificação.",
  "tasks.memorial.validate.title": "Validar o memorial descritivo: pedido #{n}",
  "tasks.memorial.validate.detail":
    "Confira o memorial no cartão Certificação e valide, ou recuse com o motivo.",
  "tasks.missing.designer":
    "O pedido está sem designer: designe em Artes → Designer do pedido.",
  "tasks.missing.certifier":
    "O pedido está sem certificadora: vincule em Parceiros do pedido.",
  "tasks.missing.analyst":
    "O pedido está sem analista: distribua em Equipe e acessos.",
  "tasks.art.fix.title": "Corrigir a arte de {item}: pedido #{n}",
  "tasks.art.fix.detail":
    "Veja a não conformidade no cartão Artes e envie a correção.",
  "tasks.art.review.title":
    "Conferir a correção da arte de {item}: pedido #{n}",
  "tasks.art.review.detail":
    "Aceite a correção no cartão Artes ou reabra com o motivo.",
  "tasks.group.art_fix": "Corrigir arte",
  "tasks.group.art_review": "Conferir arte",
  "certFlow.assignee.do": "Com: {name}",
  "certFlow.assignee.validate": "Para validar: {name}",
  "certFlow.assignee.team": "equipe Wellmix",
  "certFlow.missing.ocp": "Sem despachante.",
  "certFlow.missing.designer": "Sem designer.",
  "certFlow.missing.certifier": "Sem certificadora.",
  "certFlow.missing.analyst": "Sem analista.",
  "certFlow.assign.ocp": "Designar em Parceiros do pedido",
  "certFlow.assign.designer": "Designar em Artes",
  "certFlow.assign.certifier": "Vincular em Parceiros do pedido",
  "lane.with": "Com: {name}",
  "lane.undefined": "Responsável não definido",
  "lane.input.review": "Arte para validar",
  "lane.input.art": "Arte validada",
  "lane.input.certificate": "Certificado (selo)",
  "certFlow.assign.analyst": "Distribuir em Equipe e acessos",
  "certFlow.missingHint.designer":
    "A arte deste pedido é feita pela Wellmix e ele está sem designer: a aplicação do selo e as correções da arte ficam com {who}. Escolha o designer no cartão Artes.",
  "certFlow.missingHint.analyst":
    "Este pedido está sem analista (responsável interno): o memorial e as validações ficam com toda a equipe Wellmix. Distribua em Equipe e acessos.",
  "certFlow.noCertNeeded":
    "Os produtos deste pedido não exigem certificação (linha do produto): o selo, o memorial e a arte com o selo não viram pendência.",
  "certFlow.sealDownload": "Baixar o selo",
  "artwork.maker": "Quem faz a arte: {name}",
  "artwork.maker.team": "equipe Wellmix",
  "artwork.missingDesigner":
    "Sem designer: a arte é feita pela Wellmix e as correções ficam com {who}. Escolha o designer acima.",
  "artwork.title": "Artes",
  "artwork.downloadAll": "Baixar todas as artes",
  "artwork.designer": "Designer",
  "artwork.saveDesigner": "Salvar designer",
  "artwork.noCandidates":
    "Ninguém disponível: dê a função Designer em Equipe ou designe a agência do pedido.",
  "artwork.noIssues": "Sem não conformidade",
  "artwork.status.open": "Não conforme",
  "artwork.status.fixed": "Corrigida, aguardando aceite",
  "artwork.status.accepted": "Aceita",
  "artwork.file": "Arquivo",
  "artwork.fix": "Correção: {note} ({date})",
  "artwork.fixPh": "O que foi corrigido",
  "artwork.sendFix": "Enviar correção",
  "artwork.reopenPh": "Motivo (obrigatório para reabrir)",
  "artwork.accept": "Aceitar",
  "artwork.reopen": "Reabrir",
  "artwork.issuePh": "Não conformidade na arte deste SKU",
  "artwork.report": "Apontar",
  "artwork.done.designer": "Designer salvo.",
  "artwork.done.reported": "Não conformidade enviada ao designer.",
  "artwork.done.fixed": "Correção enviada.",
  "artwork.done.accepted": "Correção aceita.",
  "artwork.done.reopened": "Reaberta; o designer foi avisado.",
  "artwork.notify.assigned.subject": "Pedido #{n}: você é o designer",
  "artwork.notify.assigned.body": "Acompanhe as artes do pedido.",
  "artwork.notify.issue.subject": "Pedido #{n}: arte de {item} não conforme",
  "artwork.notify.fixed.subject": "Pedido #{n}: arte corrigida",
  "artwork.notify.reopened.subject": "Pedido #{n}: correção da arte reaberta",
  "artwork.error.invalid_designer":
    "Essa pessoa não pode ser designer deste pedido.",
  "artwork.error.item_not_found": "Item não encontrado neste pedido.",
  "artwork.error.note_required": "Escreva o motivo.",
  "artwork.error.invalid_status": "Essa não conformidade mudou; recarregue.",
  "artwork.error.not_found": "Não encontrada.",
  "artwork.error.order_cancelled": "Pedido cancelado.",
  "priceTable.title": "Tabela de preços",
  "priceTable.subtitle":
    "Último preço praticado de cada produto ativo (valor ao cliente ÷ quantidade) e o FOB. Só a Wellmix vê.",
  "priceTable.csv": "Baixar CSV",
  "priceTable.empty": "Nenhum produto ativo.",
  "priceTable.product": "Produto",
  "priceTable.line": "Linha",
  "priceTable.moq": "Pedido mínimo",
  "priceTable.unitPrice": "Preço unitário",
  "priceTable.fob": "FOB unitário",
  "priceTable.soldAt": "Última venda",
} as const;

export const en: Record<keyof typeof pt, string> = {
  "role.ocp": "Certification body (OCP)",
  "party.ocp": "Certification body (OCP)",
  "messages.type.ocp": "OCP",
  "function.designer": "Designer",
  "function.comex_internal": "Comex (internal)",
  "certFlow.title": "Certification",
  "importFlow.step.cert_memorial": "Technical description",
  "importFlow.step.cert_lab": "Lab testing (report)",
  "importFlow.step.cert_registration": "Registration number (certificate)",
  "importFlow.actor.ocp": "OCP",
  "importFlow.ph.cert_memorial": "",
  "importFlow.ph.cert_lab": "Lab / report no.",
  "importFlow.ph.cert_registration": "Registration no.",
  "importFlow.step.cert_seal": "Seal",
  "certFlow.featured.hint":
    "Technical description and seal: attach the technical description (PDF) and the seal here (with the seal or registration number, if any). Once the seal is sent, it is linked to the order, the order moves to the next step and whoever makes the artwork can see the seal to apply it to the packaging.",
  "certFlow.featured.follow":
    "Technical description and seal: the order's certifier (OCP) fills in and sends both. Here you follow their status and open the files sent.",
  "certFlow.featured.goto": "Send in the box at the top",
  "importFlow.step.cert_seal_art": "Seal applied to the artwork",
  "importFlow.actor.agency": "agency",
  "importFlow.ph.cert_seal": "Seal or registration no. (optional)",
  "importFlow.ph.cert_seal_art": "",
  "importFlow.fileReady":
    "File ready: {name} ({size}). Now click the button to send it.",
  "importFlow.error.schema_pending":
    "This step is not available in the system yet. Tell Wellmix and try again later.",
  "certFlow.sealHint":
    "Certification seal: the order's certifier (OCP) sends the seal. Whoever makes the packaging artwork (the order's agency or Wellmix) downloads the seal, applies it to the artwork and sends the artwork with the seal. Wellmix checks it.",
  "certFlow.sheetNote": "Certification requested on the sheet: {note}",
  "certFlow.sheet.intro":
    "Purchase sheet of the order, for certification: supplier, product, carton, schedule, photos, price and tax classification. Read only.",
  "certFlow.sheet.photosHint":
    "Photos of the product and the carton sent on the sheet.",
  "certFlow.dossier.hint":
    "To issue the seal, the complete order is here: the items with photo and code, the purchase sheet (technical data, price and photos) and the order files.",
  "certFlow.dossier.certs":
    "Certifications already registered for the product and the supplier:",
  "certFlow.sealReplaced":
    "The customs broker replaced the seal (the file or the number). Apply the current seal to the artwork and send the artwork again.",
  "certFlow.notify.sealRequested.subject":
    "Order #{n}: issue the certification seal",
  "certFlow.notify.sealRequested.body":
    "A new order arrived for certification. Send the certification seal on the order and, when the card asks for it, the technical description. Whoever makes the packaging artwork receives the seal to apply it.",
  "certFlow.notify.sealReady.subject":
    "Order #{n}: certification seal available",
  "certFlow.notify.sealReady.body":
    "The customs broker sent the certification seal. Download the seal on the order, apply it to the packaging artwork and send the artwork with the seal.",
  "certFlow.notify.sealChanged.subject":
    "Order #{n}: certification seal replaced",
  "certFlow.notify.sealChanged.body":
    "The customs broker sent a new seal. Download the seal on the order, apply it to the packaging artwork and send the artwork with the seal again.",
  "certFlow.notify.noOcp.subject":
    "Order #{n}: no certifier (OCP) for the seal and the technical description",
  "certFlow.notify.noOcp.body":
    "The certification seal and the technical description are sent by the order's certifier (OCP), and this order has none. Link the certifier under Order partners.",
  "certFlow.brief.sealPending":
    "Certification seal: waiting for the customs broker. Leave room for the seal in the artwork.",
  "certFlow.brief.sealReady":
    "Certification seal available: download it on the order, apply it to the artwork and send the artwork with the seal.",
  "certFlow.brief.sealSent":
    "Artwork with the seal sent; Wellmix is checking it.",
  "certFlow.brief.sealDone":
    "Certification seal applied to the artwork and checked.",
  "certFlow.brief.sealRejected":
    "Artwork with the seal to be redone: see the reason on the order and send the artwork again.",
  "certFlow.brief.open": "View on the order",
  "tasks.group.cert_step": "Certification",
  "tasks.group.cert_validate": "Validate certification",
  "tasks.seal.issue.title": "Issue the certification seal: order #{n}",
  "tasks.seal.issue.detail":
    "Send the seal file on the order. Whoever makes the artwork receives it to apply to the packaging.",
  "tasks.seal.apply.title":
    "Apply the certification seal to the artwork: order #{n}",
  "tasks.seal.apply.detail":
    "Download the seal on the order and send the artwork with the seal applied.",
  "tasks.seal.validate.title":
    "Validate the seal applied to the artwork: order #{n}",
  "tasks.seal.validate.detail":
    "Check the seal on the artwork and validate it, or reject it with the reason.",
  "tasks.seal.assign.title": "Link the certifier (OCP): order #{n}",
  "tasks.seal.assign.detail":
    "The order has no certifier (OCP). Link one under Order partners: the technical description and the seal are filled in and sent by them.",
  "tasks.memorial.send.title": "Send the technical description: order #{n}",
  "tasks.memorial.send.detail":
    "Attach the technical description (PDF) in the box at the top of the Certification card.",
  "tasks.memorial.validate.title":
    "Validate the technical description: order #{n}",
  "tasks.memorial.validate.detail":
    "Check the technical description on the Certification card and validate it, or reject it with the reason.",
  "tasks.missing.designer":
    "The order has no designer: assign one under Artwork → Order designer.",
  "tasks.missing.certifier":
    "The order has no certifier: link one under Order partners.",
  "tasks.missing.analyst":
    "The order has no analyst: distribute it under Team and access.",
  "tasks.art.fix.title": "Fix the artwork of {item}: order #{n}",
  "tasks.art.fix.detail":
    "See the non-conformity on the Artwork card and send the fix.",
  "tasks.art.review.title": "Check the artwork fix of {item}: order #{n}",
  "tasks.art.review.detail":
    "Accept the fix on the Artwork card or reopen it with the reason.",
  "tasks.group.art_fix": "Fix artwork",
  "tasks.group.art_review": "Check artwork",
  "certFlow.assignee.do": "With: {name}",
  "certFlow.assignee.validate": "To validate: {name}",
  "certFlow.assignee.team": "Wellmix team",
  "certFlow.missing.ocp": "No customs broker.",
  "certFlow.missing.designer": "No designer.",
  "certFlow.missing.certifier": "No certifier.",
  "certFlow.missing.analyst": "No analyst.",
  "certFlow.assign.ocp": "Assign under Order partners",
  "certFlow.assign.designer": "Assign on Artwork",
  "certFlow.assign.certifier": "Link under Order partners",
  "lane.with": "With: {name}",
  "lane.undefined": "No assignee defined",
  "lane.input.review": "Artwork to validate",
  "lane.input.art": "Validated artwork",
  "lane.input.certificate": "Certificate (seal)",
  "certFlow.assign.analyst": "Distribute under Team and access",
  "certFlow.missingHint.designer":
    "Wellmix makes the artwork of this order and it has no designer: applying the seal and fixing the artwork stay with {who}. Choose the designer on the Artwork card.",
  "certFlow.missingHint.analyst":
    "This order has no analyst (internal owner): the technical description and the validations stay with the whole Wellmix team. Distribute it under Team and access.",
  "certFlow.noCertNeeded":
    "The products of this order do not require certification (product line): the seal, the technical description and the artwork with the seal do not become tasks.",
  "certFlow.sealDownload": "Download the seal",
  "artwork.maker": "Who makes the artwork: {name}",
  "artwork.maker.team": "Wellmix team",
  "artwork.missingDesigner":
    "No designer: Wellmix makes the artwork and the fixes stay with {who}. Choose the designer above.",
  "artwork.title": "Artwork",
  "artwork.downloadAll": "Download all artwork",
  "artwork.designer": "Designer",
  "artwork.saveDesigner": "Save designer",
  "artwork.noCandidates":
    "Nobody available: give someone the Designer function in Team or assign the order's agency.",
  "artwork.noIssues": "No non-conformity",
  "artwork.status.open": "Non-conforming",
  "artwork.status.fixed": "Fixed, awaiting acceptance",
  "artwork.status.accepted": "Accepted",
  "artwork.file": "File",
  "artwork.fix": "Fix: {note} ({date})",
  "artwork.fixPh": "What was fixed",
  "artwork.sendFix": "Send fix",
  "artwork.reopenPh": "Reason (required to reopen)",
  "artwork.accept": "Accept",
  "artwork.reopen": "Reopen",
  "artwork.issuePh": "Non-conformity in this SKU's artwork",
  "artwork.report": "Report",
  "artwork.done.designer": "Designer saved.",
  "artwork.done.reported": "Non-conformity sent to the designer.",
  "artwork.done.fixed": "Fix sent.",
  "artwork.done.accepted": "Fix accepted.",
  "artwork.done.reopened": "Reopened; the designer was notified.",
  "artwork.notify.assigned.subject": "Order #{n}: you are the designer",
  "artwork.notify.assigned.body": "Follow the order's artwork.",
  "artwork.notify.issue.subject": "Order #{n}: {item} artwork non-conforming",
  "artwork.notify.fixed.subject": "Order #{n}: artwork fixed",
  "artwork.notify.reopened.subject": "Order #{n}: artwork fix reopened",
  "artwork.error.invalid_designer":
    "This person cannot be this order's designer.",
  "artwork.error.item_not_found": "Item not found on this order.",
  "artwork.error.note_required": "Write the reason.",
  "artwork.error.invalid_status": "This non-conformity changed; reload.",
  "artwork.error.not_found": "Not found.",
  "artwork.error.order_cancelled": "Order cancelled.",
  "priceTable.title": "Price table",
  "priceTable.subtitle":
    "Last price charged for each active product (customer value ÷ quantity) and the FOB. Wellmix only.",
  "priceTable.csv": "Download CSV",
  "priceTable.empty": "No active products.",
  "priceTable.product": "Product",
  "priceTable.line": "Line",
  "priceTable.moq": "Minimum order",
  "priceTable.unitPrice": "Unit price",
  "priceTable.fob": "Unit FOB",
  "priceTable.soldAt": "Last sale",
};

export const zh: Record<keyof typeof pt, string> = {
  "role.ocp": "认证机构（OCP）",
  "party.ocp": "认证机构（OCP）",
  "messages.type.ocp": "OCP",
  "function.designer": "设计师",
  "function.comex_internal": "进出口（内部）",
  "certFlow.title": "认证",
  "importFlow.step.cert_memorial": "技术说明书",
  "importFlow.step.cert_lab": "实验室检测（报告）",
  "importFlow.step.cert_registration": "注册号（证书）",
  "importFlow.actor.ocp": "OCP",
  "importFlow.ph.cert_memorial": "",
  "importFlow.ph.cert_lab": "实验室 / 报告编号",
  "importFlow.ph.cert_registration": "注册号",
  "importFlow.step.cert_seal": "认证标志",
  "certFlow.featured.hint":
    "技术说明书和认证标志：请在此上传技术说明书（PDF）和认证标志（如有标志编号或注册号，一并填写）。认证标志上传后即关联到订单，订单进入下一环节，负责设计稿的一方即可看到该标志并用于包装。",
  "certFlow.featured.follow":
    "技术说明书和认证标志：由订单的认证机构（OCP）填写并提交。您可以在此查看状态并打开已提交的文件。",
  "certFlow.featured.goto": "在顶部方框中上传",
  "importFlow.step.cert_seal_art": "认证标志已用于设计稿",
  "importFlow.actor.agency": "设计公司",
  "importFlow.ph.cert_seal": "标志或注册编号（选填）",
  "importFlow.ph.cert_seal_art": "",
  "importFlow.fileReady": "文件已就绪：{name}（{size}）。现在请点击按钮提交。",
  "importFlow.error.schema_pending":
    "此步骤尚未在系统中开通。请通知 Wellmix，稍后再试。",
  "certFlow.sealHint":
    "认证标志：由订单的认证机构（OCP）提交认证标志。负责包装设计稿的一方（订单的设计公司或 Wellmix）下载标志，放入设计稿，并提交带标志的设计稿。由 Wellmix 核对。",
  "certFlow.sheetNote": "采购单要求的认证：{note}",
  "certFlow.sheet.intro":
    "订单采购单（供认证使用）：供应商、产品、外箱、排期、照片和价格和税则归类。仅可查看。",
  "certFlow.sheet.photosHint": "采购单中上传的产品和外箱照片。",
  "certFlow.dossier.hint":
    "出具标志所需的完整订单资料都在这里：带照片和编码的产品明细、采购单（技术数据、价格和照片）以及订单文件。",
  "certFlow.dossier.certs": "产品和供应商已登记的认证：",
  "certFlow.sealReplaced":
    "报关行更换了认证标志（文件或编号）。请在设计稿中使用当前标志，并重新提交设计稿。",
  "certFlow.notify.sealRequested.subject": "订单 #{n}：请出具认证标志",
  "certFlow.notify.sealRequested.body":
    "有新订单需要认证。请在订单中提交认证标志，并在卡片要求时提交技术说明书。负责包装设计稿的一方会收到标志并放入设计稿。",
  "certFlow.notify.sealReady.subject": "订单 #{n}：认证标志已可用",
  "certFlow.notify.sealReady.body":
    "报关行已提交认证标志。请在订单中下载标志，放入包装设计稿，并提交带标志的设计稿。",
  "certFlow.notify.sealChanged.subject": "订单 #{n}：认证标志已更换",
  "certFlow.notify.sealChanged.body":
    "报关行提交了新的认证标志。请在订单中下载标志，放入包装设计稿，并重新提交带标志的设计稿。",
  "certFlow.notify.noOcp.subject":
    "订单 #{n}：尚未关联负责标志和说明书的认证机构（OCP）",
  "certFlow.notify.noOcp.body":
    "认证标志和技术说明书由订单的认证机构（OCP）提交，而此订单尚未关联认证机构。请在“订单合作方”中关联认证机构。",
  "certFlow.brief.sealPending":
    "认证标志：等待报关行提交。请在设计稿中预留标志位置。",
  "certFlow.brief.sealReady":
    "认证标志已可用：请在订单中下载，放入设计稿，并提交带标志的设计稿。",
  "certFlow.brief.sealSent": "带标志的设计稿已提交，Wellmix 正在核对。",
  "certFlow.brief.sealDone": "认证标志已放入设计稿并核对通过。",
  "certFlow.brief.sealRejected":
    "带标志的设计稿需要重做：请在订单中查看原因并重新提交设计稿。",
  "certFlow.brief.open": "在订单中查看",
  "tasks.group.cert_step": "认证",
  "tasks.group.cert_validate": "审核认证",
  "tasks.seal.issue.title": "出具认证标志：订单 #{n}",
  "tasks.seal.issue.detail":
    "请在订单中提交标志文件。负责设计稿的一方会收到并用于包装。",
  "tasks.seal.apply.title": "将认证标志放入设计稿：订单 #{n}",
  "tasks.seal.apply.detail": "请在订单中下载标志，并提交带标志的设计稿。",
  "tasks.seal.validate.title": "审核设计稿中的认证标志：订单 #{n}",
  "tasks.seal.validate.detail":
    "请核对设计稿中的标志并审核通过，或填写原因后退回。",
  "tasks.seal.assign.title": "关联认证机构（OCP）：订单 #{n}",
  "tasks.seal.assign.detail":
    "此订单尚未关联认证机构（OCP）。请在“订单合作方”中关联：技术说明书和认证标志由其填写并提交。",
  "tasks.memorial.send.title": "提交技术说明书：订单 #{n}",
  "tasks.memorial.send.detail":
    "请在“认证”卡片顶部的方框中上传技术说明书（PDF）。",
  "tasks.memorial.validate.title": "审核技术说明书：订单 #{n}",
  "tasks.memorial.validate.detail":
    "请在“认证”卡片中核对技术说明书并审核通过，或填写原因后退回。",
  "tasks.missing.designer":
    "此订单没有设计师：请在“设计稿 → 订单设计师”中指定。",
  "tasks.missing.certifier": "此订单没有认证机构：请在“订单合作方”中关联。",
  "tasks.missing.analyst": "此订单没有专员：请在“团队与权限”中分配。",
  "tasks.art.fix.title": "修改 {item} 的设计稿：订单 #{n}",
  "tasks.art.fix.detail": "请在“设计稿”卡片中查看不合格项并提交修改。",
  "tasks.art.review.title": "核对 {item} 的设计稿修改：订单 #{n}",
  "tasks.art.review.detail":
    "请在“设计稿”卡片中接受修改，或填写原因后重新打开。",
  "tasks.group.art_fix": "修改设计稿",
  "tasks.group.art_review": "核对设计稿",
  "certFlow.assignee.do": "负责人：{name}",
  "certFlow.assignee.validate": "审核人：{name}",
  "certFlow.assignee.team": "Wellmix 团队",
  "certFlow.missing.ocp": "未指定报关行。",
  "certFlow.missing.designer": "未指定设计师。",
  "certFlow.missing.certifier": "未关联认证机构。",
  "certFlow.missing.analyst": "未指定专员。",
  "certFlow.assign.ocp": "在订单合作方中指定",
  "certFlow.assign.designer": "在设计稿中指定",
  "certFlow.assign.certifier": "在订单合作方中关联",
  "lane.with": "负责：{name}",
  "lane.undefined": "未指定负责人",
  "lane.input.review": "待审核的设计稿",
  "lane.input.art": "已审核的设计稿",
  "lane.input.certificate": "证书（标志）",
  "certFlow.assign.analyst": "在团队与权限中分配",
  "certFlow.missingHint.designer":
    "此订单的设计稿由 Wellmix 制作，且未指定设计师：放入标志和修改设计稿由 {who} 负责。请在“设计稿”卡片中选择设计师。",
  "certFlow.missingHint.analyst":
    "此订单没有专员（内部负责人）：技术说明书和审核由整个 Wellmix 团队负责。请在“团队与权限”中分配。",
  "certFlow.noCertNeeded":
    "此订单的产品无需认证（按产品线）：标志、技术说明书和带标志的设计稿不会生成待办。",
  "certFlow.sealDownload": "下载标志",
  "artwork.maker": "设计稿制作方：{name}",
  "artwork.maker.team": "Wellmix 团队",
  "artwork.missingDesigner":
    "未指定设计师：设计稿由 Wellmix 制作，修改由 {who} 负责。请在上方选择设计师。",
  "artwork.title": "设计稿",
  "artwork.downloadAll": "下载全部设计稿",
  "artwork.designer": "设计师",
  "artwork.saveDesigner": "保存设计师",
  "artwork.noCandidates":
    "暂无人选：请在团队中分配设计师职能，或为订单指定代理公司。",
  "artwork.noIssues": "无不符合项",
  "artwork.status.open": "不符合",
  "artwork.status.fixed": "已修改，待确认",
  "artwork.status.accepted": "已确认",
  "artwork.file": "文件",
  "artwork.fix": "修改：{note}（{date}）",
  "artwork.fixPh": "修改内容",
  "artwork.sendFix": "提交修改",
  "artwork.reopenPh": "原因（重新打开时必填）",
  "artwork.accept": "确认",
  "artwork.reopen": "重新打开",
  "artwork.issuePh": "该 SKU 设计稿的不符合项",
  "artwork.report": "提出",
  "artwork.done.designer": "设计师已保存。",
  "artwork.done.reported": "不符合项已发送给设计师。",
  "artwork.done.fixed": "修改已提交。",
  "artwork.done.accepted": "修改已确认。",
  "artwork.done.reopened": "已重新打开，已通知设计师。",
  "artwork.notify.assigned.subject": "订单 #{n}：您是设计师",
  "artwork.notify.assigned.body": "请跟进订单的设计稿。",
  "artwork.notify.issue.subject": "订单 #{n}：{item} 设计稿不符合",
  "artwork.notify.fixed.subject": "订单 #{n}：设计稿已修改",
  "artwork.notify.reopened.subject": "订单 #{n}：设计稿修改被重新打开",
  "artwork.error.invalid_designer": "此人不能担任该订单的设计师。",
  "artwork.error.item_not_found": "该订单中未找到此产品。",
  "artwork.error.note_required": "请填写原因。",
  "artwork.error.invalid_status": "该不符合项已变更，请刷新。",
  "artwork.error.not_found": "未找到。",
  "artwork.error.order_cancelled": "订单已取消。",
  "priceTable.title": "价格表",
  "priceTable.subtitle":
    "每个在售产品的最近成交价（客户金额 ÷ 数量）及 FOB。仅 Wellmix 可见。",
  "priceTable.csv": "下载 CSV",
  "priceTable.empty": "没有在售产品。",
  "priceTable.product": "产品",
  "priceTable.line": "产品线",
  "priceTable.moq": "起订量",
  "priceTable.unitPrice": "单价",
  "priceTable.fob": "FOB 单价",
  "priceTable.soldAt": "最近销售",
};
