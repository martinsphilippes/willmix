/**
 * Dicionário do módulo "rfq-standby" (RFQ em espera, docs/RFQ_STANDBY.md): a
 * tela Pedidos → RFQ, o cartão "Enviar ao fornecedor" da solicitação e a
 * "análise do Booking" na visão do fornecedor. Mesmas chaves em pt, en e zh.
 */
export const pt = {
  "nav.rfq": "RFQ (em espera)",
  "rfqStandby.title": "RFQ",
  "rfqStandby.subtitle":
    "Pedido de preço a vários fornecedores ao mesmo tempo, com comparação e disputa. Está guardado aqui, pronto para voltar quando você decidir.",
  "rfqStandby.state.off": "Em espera",
  "rfqStandby.state.on": "Ativa",
  "rfqStandby.now.title": "Como está funcionando agora",
  "rfqStandby.now.off":
    "A RFQ está em espera. Cada produto do Booking é do fornecedor escolhido ao subir a ficha técnica. Ao gerar a solicitação, o produto vai direto para esse fornecedor analisar (preço, prazo, pedido mínimo e fotos). Não há disputa entre fornecedores: um fornecedor por produto.",
  "rfqStandby.now.on":
    "A RFQ está ativa. Na solicitação você escolhe vários fornecedores, compara as cotações e decide pela disputa. O produto do Booking não vai sozinho para o fornecedor: a RFQ é aberta na solicitação.",
  "rfqStandby.kept.title": "O que está guardado (nada foi apagado)",
  "rfqStandby.kept.1":
    "Abrir a RFQ para vários fornecedores de uma vez, na solicitação e no lote.",
  "rfqStandby.kept.2": "Convidar mais fornecedores depois de aberta.",
  "rfqStandby.kept.3":
    "Comparação das cotações lado a lado e a disputa de fornecedores (ranking por preço, prazo e nota).",
  "rfqStandby.kept.4":
    "Tudo o que já foi cotado antes continua nas solicitações, com o histórico.",
  "rfqStandby.switch.title": "Ligar ou deixar em espera",
  "rfqStandby.switch.hintOff":
    "Ao ativar, a tela da solicitação volta a oferecer a RFQ para vários fornecedores e o Booking deixa de enviar o produto sozinho ao fornecedor.",
  "rfqStandby.switch.hintOn":
    "Ao colocar em espera, cada produto volta a ir para um fornecedor só. As RFQs já abertas continuam valendo até serem concluídas.",
  "rfqStandby.switch.adminOnly":
    "Só o administrador liga ou coloca a RFQ em espera.",
  "rfqStandby.switch.on": "Ativar a RFQ",
  "rfqStandby.switch.off": "Colocar a RFQ em espera",
  "rfqStandby.saved.on": "RFQ ativada.",
  "rfqStandby.saved.off": "RFQ em espera.",
  "rfqStandby.list.title": "Solicitações em cotação",
  "rfqStandby.list.empty": "Nenhuma solicitação em cotação agora.",
  "rfqStandby.list.number": "Nº",
  "rfqStandby.list.product": "Produto",
  "rfqStandby.list.status": "Situação",
  "rfqStandby.list.suppliers": "Fornecedores",
  "rfqStandby.list.answered": "Responderam",
  "rfqStandby.list.open": "Abrir",
  "rfqStandby.list.none": "Ainda não enviado",
  "rfqStandby.send.title": "Enviar ao fornecedor",
  "rfqStandby.send.hint":
    "Escolha o fornecedor que vai analisar este produto. O fornecedor do produto já vem marcado. Um fornecedor só: a RFQ para vários está em espera.",
  "rfqStandby.send.submit": "Enviar ao fornecedor",
  "pricing.error.rfq_standby_one":
    "A RFQ para vários fornecedores está em espera: escolha um fornecedor só.",
  "pricing.error.rfq_standby_sent":
    "Este produto já foi enviado a outro fornecedor. A RFQ para vários fornecedores está em espera.",
  "reqBatch.error.rfq_standby_one":
    "A RFQ para vários fornecedores está em espera: escolha um fornecedor só.",
  "reqBatch.error.rfq_standby_sent":
    "Há produto deste lote já enviado a outro fornecedor. A RFQ para vários fornecedores está em espera.",
  "booking.next.send_supplier":
    "Próximo passo: enviar ao fornecedor do produto, para ele analisar.",
  "booking.next.label.send_supplier": "Enviar ao fornecedor",
  "bookingAnalysis.title": "Análise do Booking: {product}",
  "bookingAnalysis.hint":
    "Este produto é do seu Booking com a Wellmix. Analise e responda com preço, prazo, pedido mínimo e fotos. Não há outros fornecedores neste produto.",
  "bookingAnalysis.badge": "Booking",
  "bookingAnalysis.task": "Analisar o Booking: {product}",
};

export const en: Record<keyof typeof pt, string> = {
  "nav.rfq": "RFQ (on hold)",
  "rfqStandby.title": "RFQ",
  "rfqStandby.subtitle":
    "Price request to several suppliers at once, with comparison and competition. It is stored here, ready to come back when you decide.",
  "rfqStandby.state.off": "On hold",
  "rfqStandby.state.on": "Active",
  "rfqStandby.now.title": "How it works now",
  "rfqStandby.now.off":
    "The RFQ is on hold. Each Booking product belongs to the supplier chosen when the product sheet was uploaded. When the request is created, the product goes straight to that supplier to review (price, lead time, minimum order and photos). There is no competition between suppliers: one supplier per product.",
  "rfqStandby.now.on":
    "The RFQ is active. In the request you choose several suppliers, compare the quotes and decide by the competition. The Booking product does not go to the supplier by itself: the RFQ is opened in the request.",
  "rfqStandby.kept.title": "What is stored (nothing was deleted)",
  "rfqStandby.kept.1":
    "Opening the RFQ to several suppliers at once, in the request and in the batch.",
  "rfqStandby.kept.2": "Inviting more suppliers after it is open.",
  "rfqStandby.kept.3":
    "Side-by-side comparison of quotes and the supplier competition (ranking by price, lead time and score).",
  "rfqStandby.kept.4":
    "Everything quoted before stays in the requests, with the history.",
  "rfqStandby.switch.title": "Turn on or keep on hold",
  "rfqStandby.switch.hintOff":
    "When activated, the request screen offers the RFQ to several suppliers again and the Booking stops sending the product to the supplier by itself.",
  "rfqStandby.switch.hintOn":
    "When put on hold, each product goes to a single supplier again. RFQs already open remain valid until they are finished.",
  "rfqStandby.switch.adminOnly":
    "Only the administrator turns the RFQ on or puts it on hold.",
  "rfqStandby.switch.on": "Activate the RFQ",
  "rfqStandby.switch.off": "Put the RFQ on hold",
  "rfqStandby.saved.on": "RFQ activated.",
  "rfqStandby.saved.off": "RFQ on hold.",
  "rfqStandby.list.title": "Requests being quoted",
  "rfqStandby.list.empty": "No request being quoted right now.",
  "rfqStandby.list.number": "No.",
  "rfqStandby.list.product": "Product",
  "rfqStandby.list.status": "Status",
  "rfqStandby.list.suppliers": "Suppliers",
  "rfqStandby.list.answered": "Answered",
  "rfqStandby.list.open": "Open",
  "rfqStandby.list.none": "Not sent yet",
  "rfqStandby.send.title": "Send to the supplier",
  "rfqStandby.send.hint":
    "Choose the supplier who will review this product. The product's supplier is already ticked. One supplier only: the RFQ to several suppliers is on hold.",
  "rfqStandby.send.submit": "Send to the supplier",
  "pricing.error.rfq_standby_one":
    "The RFQ to several suppliers is on hold: choose one supplier only.",
  "pricing.error.rfq_standby_sent":
    "This product was already sent to another supplier. The RFQ to several suppliers is on hold.",
  "reqBatch.error.rfq_standby_one":
    "The RFQ to several suppliers is on hold: choose one supplier only.",
  "reqBatch.error.rfq_standby_sent":
    "A product in this batch was already sent to another supplier. The RFQ to several suppliers is on hold.",
  "booking.next.send_supplier":
    "Next step: send to the product's supplier, for them to review.",
  "booking.next.label.send_supplier": "Send to the supplier",
  "bookingAnalysis.title": "Booking review: {product}",
  "bookingAnalysis.hint":
    "This product is from your Booking with Wellmix. Review it and reply with price, lead time, minimum order and photos. There are no other suppliers on this product.",
  "bookingAnalysis.badge": "Booking",
  "bookingAnalysis.task": "Review the Booking: {product}",
};

export const zh: Record<keyof typeof pt, string> = {
  "nav.rfq": "询价（暂停）",
  "rfqStandby.title": "询价 (RFQ)",
  "rfqStandby.subtitle":
    "同时向多家供应商询价，并进行比较和竞价。该功能保存在这里，您决定后即可恢复。",
  "rfqStandby.state.off": "暂停",
  "rfqStandby.state.on": "启用",
  "rfqStandby.now.title": "目前的运作方式",
  "rfqStandby.now.off":
    "询价已暂停。Booking 中的每个产品都属于上传产品表时选择的供应商。生成询价单后，产品直接发给该供应商分析（价格、交期、起订量和照片）。供应商之间不竞价：每个产品只有一家供应商。",
  "rfqStandby.now.on":
    "询价已启用。在询价单中可选择多家供应商、比较报价并通过竞价决定。Booking 的产品不会自动发给供应商：需在询价单中发起询价。",
  "rfqStandby.kept.title": "已保存的内容（没有删除任何东西）",
  "rfqStandby.kept.1": "在询价单和批次中一次向多家供应商发起询价。",
  "rfqStandby.kept.2": "发起后再邀请更多供应商。",
  "rfqStandby.kept.3": "报价并排比较及供应商竞价（按价格、交期和评分排名）。",
  "rfqStandby.kept.4": "以前的所有报价仍保留在询价单中，并带有历史记录。",
  "rfqStandby.switch.title": "启用或保持暂停",
  "rfqStandby.switch.hintOff":
    "启用后，询价单页面将重新提供向多家供应商询价，Booking 不再自动把产品发给供应商。",
  "rfqStandby.switch.hintOn":
    "暂停后，每个产品重新只发给一家供应商。已发起的询价在完成前继续有效。",
  "rfqStandby.switch.adminOnly": "只有管理员可以启用或暂停询价。",
  "rfqStandby.switch.on": "启用询价",
  "rfqStandby.switch.off": "暂停询价",
  "rfqStandby.saved.on": "询价已启用。",
  "rfqStandby.saved.off": "询价已暂停。",
  "rfqStandby.list.title": "报价中的询价单",
  "rfqStandby.list.empty": "目前没有报价中的询价单。",
  "rfqStandby.list.number": "编号",
  "rfqStandby.list.product": "产品",
  "rfqStandby.list.status": "状态",
  "rfqStandby.list.suppliers": "供应商",
  "rfqStandby.list.answered": "已回复",
  "rfqStandby.list.open": "打开",
  "rfqStandby.list.none": "尚未发送",
  "rfqStandby.send.title": "发送给供应商",
  "rfqStandby.send.hint":
    "选择分析此产品的供应商。产品的供应商已默认选中。只能选一家：向多家供应商询价的功能已暂停。",
  "rfqStandby.send.submit": "发送给供应商",
  "pricing.error.rfq_standby_one":
    "向多家供应商询价的功能已暂停：请只选择一家供应商。",
  "pricing.error.rfq_standby_sent":
    "此产品已发送给另一家供应商。向多家供应商询价的功能已暂停。",
  "reqBatch.error.rfq_standby_one":
    "向多家供应商询价的功能已暂停：请只选择一家供应商。",
  "reqBatch.error.rfq_standby_sent":
    "该批次中有产品已发送给另一家供应商。向多家供应商询价的功能已暂停。",
  "booking.next.send_supplier": "下一步：发送给该产品的供应商进行分析。",
  "booking.next.label.send_supplier": "发送给供应商",
  "bookingAnalysis.title": "Booking 分析：{product}",
  "bookingAnalysis.hint":
    "此产品来自您与 Wellmix 的 Booking。请分析并回复价格、交期、起订量和照片。此产品没有其他供应商。",
  "bookingAnalysis.badge": "Booking",
  "bookingAnalysis.task": "分析 Booking：{product}",
};
