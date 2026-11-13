/**
 * NCM dos itens do booking (docs/BOOKING.md, "NCM do item"): aproximação com
 * os produtos do cadastro, itens com o despachante e a tela dele.
 * Mesmas chaves em pt, en e zh.
 */
export const pt = {
  "bookingLots.item.col.ncm": "NCM",
  "nav.ncmItems": "NCM dos books",
  "bookingNcm.col": "NCM",
  "bookingNcm.edit": "NCM do item {n}",
  "bookingNcm.source.match": "Aproximação ({pct}%)",
  "bookingNcm.source.broker": "Despachante",
  "bookingNcm.source.manual": "Wellmix",
  "bookingNcm.reclassify": "Estimar o NCM de novo",
  "bookingNcm.reclassifyPending": "Estimando…",
  "bookingNcm.reclassifyHint":
    "{n} itens sem NCM. O cadastro mudou desde a importação?",
  "bookingNcm.reclassified":
    "NCM estimado de novo: {n} itens preenchidos por aproximação; {left} continuam sem NCM.",
  "bookingNcm.suggestions": "Sugestões",
  "bookingNcm.recommended": "Recomendado",
  "bookingNcm.fillRecommended": "Preencher com o recomendado",
  "bookingNcm.otherSuggestions": "Outras opções",
  "bookingNcm.suggestion":
    "{pct}% das palavras batem com {n} produto(s), ex.: {example}. Clique para usar.",
  "bookingNcm.pending": "Com o despachante",
  "bookingNcm.lotPending":
    "Itens sem produto parecido no cadastro foram para o despachante classificar o NCM ({n}). O book só fecha com o NCM de todos os itens.",
  "bookingNcm.lotPendingLink": "Ver os itens com o despachante",
  "bookingNcm.noBroker":
    "Nenhum despachante com acesso ao portal: preencha o NCM na coluna NCM dos itens.",
  "bookingNcm.closedHint":
    "O NCM continua editável: ao trocar, a análise do Superplan do item é refeita.",

  "bookingNcm.page.title": "NCM dos itens de book",
  "bookingNcm.page.subtitle":
    "Itens de books sem produto parecido no cadastro. Classifique os parecidos de uma vez: marque os itens do grupo, informe o NCM e aplique.",
  "bookingNcm.page.empty": "Nenhum item esperando NCM.",
  "bookingNcm.page.group": "{key} · itens: {n}",
  "bookingNcm.page.booking": "Book nº {n}",
  "bookingNcm.page.since": "Desde {date}",
  "bookingNcm.page.material": "Material",
  "bookingNcm.page.package": "Embalagem",
  "bookingNcm.page.capacity": "Capacidade (ml)",
  "bookingNcm.page.color": "Cores",
  "bookingNcm.page.function": "Função",
  "bookingNcm.page.size": "Medidas (cm)",
  "bookingNcm.page.ncm": "NCM (8 dígitos)",
  "bookingNcm.page.apply": "Aplicar aos marcados",
  "bookingNcm.page.pending": "Gravando…",
  "bookingNcm.page.done": "NCM gravado (itens: {n}).",
  "bookingNcm.task.title": "Classificar NCM: {group}",
  "bookingNcm.task.detail": "Itens de book sem NCM: {n}",
  "bookingNcm.notify.subject": "Itens de book para classificar o NCM ({n})",
  "bookingNcm.notify.body":
    "Chegaram {n} itens sem produto parecido no cadastro, em {groups} grupos de parecidos. Abra NCM dos books e classifique.",

  "bookingNcm.error.booking_ncm_invalid":
    "O NCM tem 8 dígitos (ex.: 3924.10.00).",
  "bookingNcm.error.booking_ncm_not_in_table":
    "Esse NCM não está na tabela fiscal carregada.",
  "bookingNcm.error.booking_ncm_required":
    "Book fechado precisa de NCM em todos os itens: troque por outro, sem apagar.",
  "bookingNcm.error.booking_ncm_no_items": "Marque ao menos um item.",
  "bookingNcm.error.forbidden": "Só a Wellmix e o despachante preenchem o NCM.",
};

export const en: typeof pt = {
  "bookingLots.item.col.ncm": "NCM",
  "nav.ncmItems": "Book NCMs",
  "bookingNcm.col": "NCM",
  "bookingNcm.edit": "NCM of item {n}",
  "bookingNcm.source.match": "Approximation ({pct}%)",
  "bookingNcm.source.broker": "Customs broker",
  "bookingNcm.source.manual": "Wellmix",
  "bookingNcm.reclassify": "Estimate NCM again",
  "bookingNcm.reclassifyPending": "Estimating…",
  "bookingNcm.reclassifyHint":
    "{n} items without NCM. Has the catalog changed since the import?",
  "bookingNcm.reclassified":
    "NCM estimated again: {n} items filled by approximation; {left} still without NCM.",
  "bookingNcm.suggestions": "Suggestions",
  "bookingNcm.recommended": "Recommended",
  "bookingNcm.fillRecommended": "Fill with recommended",
  "bookingNcm.otherSuggestions": "Other options",
  "bookingNcm.suggestion":
    "{pct}% of the words match {n} product(s), e.g. {example}. Click to use.",
  "bookingNcm.pending": "With the customs broker",
  "bookingNcm.lotPending":
    "Items with no similar product in the catalog went to the customs broker for the NCM ({n}). The book only closes with every item's NCM.",
  "bookingNcm.lotPendingLink": "See the items with the customs broker",
  "bookingNcm.noBroker":
    "No customs broker with portal access: fill in the NCM in the items' NCM column.",
  "bookingNcm.closedHint":
    "The NCM stays editable: changing it redoes the item's Superplan analysis.",

  "bookingNcm.page.title": "Book item NCMs",
  "bookingNcm.page.subtitle":
    "Book items with no similar product in the catalog. Classify similar ones at once: check the group's items, enter the NCM and apply.",
  "bookingNcm.page.empty": "No items waiting for an NCM.",
  "bookingNcm.page.group": "{key} · items: {n}",
  "bookingNcm.page.booking": "Book no. {n}",
  "bookingNcm.page.since": "Since {date}",
  "bookingNcm.page.material": "Material",
  "bookingNcm.page.package": "Package",
  "bookingNcm.page.capacity": "Capacity (ml)",
  "bookingNcm.page.color": "Colors",
  "bookingNcm.page.function": "Function",
  "bookingNcm.page.size": "Size (cm)",
  "bookingNcm.page.ncm": "NCM (8 digits)",
  "bookingNcm.page.apply": "Apply to checked",
  "bookingNcm.page.pending": "Saving…",
  "bookingNcm.page.done": "NCM saved (items: {n}).",
  "bookingNcm.task.title": "Classify NCM: {group}",
  "bookingNcm.task.detail": "Book items without an NCM: {n}",
  "bookingNcm.notify.subject": "Book items to classify the NCM ({n})",
  "bookingNcm.notify.body":
    "{n} items with no similar product in the catalog arrived, in {groups} groups of similar ones. Open Book NCMs and classify.",

  "bookingNcm.error.booking_ncm_invalid":
    "The NCM has 8 digits (e.g. 3924.10.00).",
  "bookingNcm.error.booking_ncm_not_in_table":
    "That NCM is not in the loaded tax table.",
  "bookingNcm.error.booking_ncm_required":
    "A closed book needs an NCM on every item: replace it, do not clear it.",
  "bookingNcm.error.booking_ncm_no_items": "Check at least one item.",
  "bookingNcm.error.forbidden":
    "Only Wellmix and the customs broker fill in the NCM.",
};

export const zh: typeof pt = {
  "bookingLots.item.col.ncm": "NCM",
  "nav.ncmItems": "Book 的 NCM",
  "bookingNcm.col": "NCM",
  "bookingNcm.edit": "条目 {n} 的 NCM",
  "bookingNcm.source.match": "近似匹配（{pct}%）",
  "bookingNcm.source.broker": "报关行",
  "bookingNcm.source.manual": "Wellmix",
  "bookingNcm.reclassify": "重新估算 NCM",
  "bookingNcm.reclassifyPending": "估算中…",
  "bookingNcm.reclassifyHint": "{n} 个项目没有 NCM。导入后商品目录有变化吗？",
  "bookingNcm.reclassified":
    "已重新估算 NCM：{n} 个项目通过近似填写；{left} 个仍无 NCM。",
  "bookingNcm.suggestions": "建议",
  "bookingNcm.recommended": "推荐",
  "bookingNcm.fillRecommended": "填入推荐值",
  "bookingNcm.otherSuggestions": "其他选项",
  "bookingNcm.suggestion":
    "{pct}% 的词与 {n} 个商品匹配，例如：{example}。点击使用。",
  "bookingNcm.pending": "报关行处理中",
  "bookingNcm.lotPending":
    "{n} 个条目在产品目录中没有相似产品，已交给报关行归类 NCM。所有条目都有 NCM 后 Book 才能关闭。",
  "bookingNcm.lotPendingLink": "查看报关行处理中的条目",
  "bookingNcm.noBroker": "没有可登录门户的报关行：请在条目的 NCM 列中填写。",
  "bookingNcm.closedHint":
    "NCM 仍可编辑：修改后会重新进行该条目的 Superplan 分析。",

  "bookingNcm.page.title": "Book 条目的 NCM",
  "bookingNcm.page.subtitle":
    "产品目录中没有相似产品的 Book 条目。一次归类相似条目：勾选组内条目，填写 NCM 并应用。",
  "bookingNcm.page.empty": "没有等待 NCM 的条目。",
  "bookingNcm.page.group": "{key}（{n} 个条目）",
  "bookingNcm.page.booking": "Book 第 {n} 号",
  "bookingNcm.page.since": "自 {date}",
  "bookingNcm.page.material": "材质",
  "bookingNcm.page.package": "包装",
  "bookingNcm.page.capacity": "容量（ml）",
  "bookingNcm.page.color": "颜色",
  "bookingNcm.page.function": "功能",
  "bookingNcm.page.size": "尺寸（cm）",
  "bookingNcm.page.ncm": "NCM（8 位）",
  "bookingNcm.page.apply": "应用到勾选的条目",
  "bookingNcm.page.pending": "正在保存…",
  "bookingNcm.page.done": "已为 {n} 个条目保存 NCM。",
  "bookingNcm.task.title": "归类 NCM：{group}",
  "bookingNcm.task.detail": "{n} 个没有 NCM 的 Book 条目",
  "bookingNcm.notify.subject": "{n} 个 Book 条目需要归类 NCM",
  "bookingNcm.notify.body":
    "收到 {n} 个在产品目录中没有相似产品的条目，分为 {groups} 组相似条目。请打开“Book 的 NCM”进行归类。",

  "bookingNcm.error.booking_ncm_invalid":
    "NCM 为 8 位数字（例如 3924.10.00）。",
  "bookingNcm.error.booking_ncm_not_in_table": "该 NCM 不在已加载的税务表中。",
  "bookingNcm.error.booking_ncm_required":
    "已关闭的 Book 每个条目都需要 NCM：请替换，不要清空。",
  "bookingNcm.error.booking_ncm_no_items": "请至少勾选一个条目。",
  "bookingNcm.error.forbidden": "只有 Wellmix 和报关行可以填写 NCM。",
};
