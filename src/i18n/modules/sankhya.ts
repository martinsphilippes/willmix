/**
 * Dicionário do módulo "sankhya" (Configurações → Sankhya: conexão com o ERP,
 * dicionário de dados, consultas e escrita de registros, pedidos e cotações):
 * mesmas chaves em pt, en e zh.
 */
export const pt = {
  "sankhya.title": "Sankhya",
  "sankhya.subtitle":
    "Conexão com o ERP Sankhya Om pela API oficial: consultar qualquer tabela, ver campos e ligações, e incluir ou alterar registros, pedidos e cotações.",
  "sankhya.back": "Voltar para Configurações",
  "sankhya.open": "Abrir Sankhya",
  "sankhya.settingsHint":
    "Consultas, dicionário de dados e envio de pedidos e cotações ao ERP.",
  "sankhya.status": "Conexão",
  "sankhya.status.configured": "Configurado: {base}",
  "sankhya.status.missing":
    "Faltam credenciais: {vars}. Grave-as na aba Integração Sankhya (ou nas variáveis de ambiente da Vercel).",
  "sankhya.status.test": "Testar conexão",
  "sankhya.status.ok": "Conectado em {ms} ms ({base}). Empresas: {companies}",
  "sankhya.status.help":
    "Credenciais: Client ID e Client Secret (Área do Desenvolvedor) e o X-Token (tela Configurações Gateway do Sankhya Om).",
  "sankhya.error": "O Sankhya recusou ({code}): {detail}",
  "sankhya.dict": "Dicionário de dados",
  "sankhya.dict.hint":
    "Busque por nome ou descrição da tabela ou da entidade (ex.: PRODUTO, TGFPAR, CabecalhoNota, AD_). Inclui as tabelas personalizadas.",
  "sankhya.dict.search": "Buscar tabelas",
  "sankhya.dict.placeholder": "PRODUTO, PARCEIRO, NOTA, AD_…",
  "sankhya.dict.open": "Ver campos e ligações",
  "sankhya.table": "Tabela {table}",
  "sankhya.table.instances": "Entidades (nome para consultas e gravação)",
  "sankhya.table.fields": "Campos",
  "sankhya.table.links": "Ligações com outras tabelas",
  "sankhya.table.query": "Consultar esta entidade",
  "sankhya.records": "Consultar entidade",
  "sankhya.records.hint":
    "Qualquer entidade (Produto, Parceiro, CabecalhoNota, ItemNota, Estoque…), com as ligações que quiser trazer junto. Critério com ? e os valores, um por linha.",
  "sankhya.records.entity": "Entidade",
  "sankhya.records.fields": "Campos (* = todos)",
  "sankhya.records.joins": "Ligações (uma por linha: Ligação: CAMPO1, CAMPO2)",
  "sankhya.records.where": "Critério (ex.: CODPARC = ? AND ATIVO = ?)",
  "sankhya.records.params":
    "Valores do critério (um por linha: tipo:valor, tipos S I F D H)",
  "sankhya.records.run": "Consultar",
  "sankhya.records.total": "{shown} registros nesta página · total {total}",
  "sankhya.records.next": "Próxima página",
  "sankhya.records.prev": "Página anterior",
  "sankhya.sql": "SQL (somente leitura)",
  "sankhya.sql.hint":
    "Um SELECT no banco do Sankhya (Oracle ou SQL Server, conforme o ERP). Nada que altere dados é aceito. Exige o usuário do gateway com acesso ao Explorador de banco.",
  "sankhya.sql.run": "Executar",
  "sankhya.rows.limited": "Mostrando {shown} de {total} linhas.",
  "sankhya.rows.none": "Nenhum registro.",
  "sankhya.write": "Incluir ou alterar registro",
  "sankhya.write.hint":
    'Grava direto no ERP (DatasetSP.save). Sem chave inclui; com a chave (ex.: {"CODPARC": 123}) altera. Fica na auditoria.',
  "sankhya.write.entity": "Entidade",
  "sankhya.write.pk": "Chave (JSON, vazio para incluir)",
  "sankhya.write.values": "Campos e valores (JSON)",
  "sankhya.write.submit": "Gravar no Sankhya",
  "sankhya.write.ok": "Gravado no Sankhya: {result}",
  "sankhya.note": "Pedido, orçamento ou cotação",
  "sankhya.note.hint":
    "Inclui a nota no Sankhya (CACSP.incluirNota). O tipo (pedido de venda, de compra, orçamento, cotação) vem da TOP (CODTIPOPER) e do TIPMOV configurados no ERP. Com NUNOTA no cabeçalho, inclui ou altera os itens dessa nota (SEQUENCIA altera o item).",
  "sankhya.note.header": "Cabeçalho (JSON)",
  "sankhya.note.items": "Itens (lista JSON)",
  "sankhya.note.informPrice":
    "Usar o preço e o desconto informados (sem isso, vale a tabela de preço do ERP)",
  "sankhya.note.submit": "Enviar ao Sankhya",
  "sankhya.note.ok": "Nota no Sankhya: NUNOTA {nunota}",
  "sankhya.cancel": "Cancelar notas",
  "sankhya.cancel.hint":
    "Cancela no Sankhya (CACSP.cancelarNota). Notas faturadas não são canceladas.",
  "sankhya.cancel.nunotas": "NUNOTA (separados por vírgula)",
  "sankhya.cancel.justification": "Justificativa",
  "sankhya.cancel.submit": "Cancelar no Sankhya",
  "sankhya.cancel.ok": "Cancelado no Sankhya: {nunota}",
  "sankhya.notConfigured":
    "Grave as credenciais na aba Integração Sankhya para usar esta parte.",
};

export const en: Record<keyof typeof pt, string> = {
  "sankhya.title": "Sankhya",
  "sankhya.subtitle":
    "Connection to the Sankhya Om ERP through the official API: query any table, see fields and links, and create or update records, orders and quotes.",
  "sankhya.back": "Back to Settings",
  "sankhya.open": "Open Sankhya",
  "sankhya.settingsHint":
    "Queries, data dictionary and sending orders and quotes to the ERP.",
  "sankhya.status": "Connection",
  "sankhya.status.configured": "Configured: {base}",
  "sankhya.status.missing":
    "Missing credentials: {vars}. Save them in the Sankhya integration tab (or in the Vercel environment variables).",
  "sankhya.status.test": "Test connection",
  "sankhya.status.ok": "Connected in {ms} ms ({base}). Companies: {companies}",
  "sankhya.status.help":
    "Credentials: Client ID and Client Secret (Developer Area) and the X-Token (Gateway Settings screen in Sankhya Om).",
  "sankhya.error": "Sankhya refused ({code}): {detail}",
  "sankhya.dict": "Data dictionary",
  "sankhya.dict.hint":
    "Search by table or entity name or description (e.g. PRODUTO, TGFPAR, CabecalhoNota, AD_). Custom tables included.",
  "sankhya.dict.search": "Search tables",
  "sankhya.dict.placeholder": "PRODUTO, PARCEIRO, NOTA, AD_…",
  "sankhya.dict.open": "See fields and links",
  "sankhya.table": "Table {table}",
  "sankhya.table.instances": "Entities (name for queries and writes)",
  "sankhya.table.fields": "Fields",
  "sankhya.table.links": "Links to other tables",
  "sankhya.table.query": "Query this entity",
  "sankhya.records": "Query entity",
  "sankhya.records.hint":
    "Any entity (Produto, Parceiro, CabecalhoNota, ItemNota, Estoque…), with the linked entities you want alongside. Criteria with ? and the values, one per line.",
  "sankhya.records.entity": "Entity",
  "sankhya.records.fields": "Fields (* = all)",
  "sankhya.records.joins": "Links (one per line: Link: FIELD1, FIELD2)",
  "sankhya.records.where": "Criteria (e.g. CODPARC = ? AND ATIVO = ?)",
  "sankhya.records.params":
    "Criteria values (one per line: type:value, types S I F D H)",
  "sankhya.records.run": "Query",
  "sankhya.records.total": "{shown} records on this page · total {total}",
  "sankhya.records.next": "Next page",
  "sankhya.records.prev": "Previous page",
  "sankhya.sql": "SQL (read only)",
  "sankhya.sql.hint":
    "A SELECT on the Sankhya database (Oracle or SQL Server, depending on the ERP). Nothing that changes data is accepted. The gateway user needs access to the Database Explorer.",
  "sankhya.sql.run": "Run",
  "sankhya.rows.limited": "Showing {shown} of {total} rows.",
  "sankhya.rows.none": "No records.",
  "sankhya.write": "Create or update record",
  "sankhya.write.hint":
    'Writes straight to the ERP (DatasetSP.save). Without a key it creates; with the key (e.g. {"CODPARC": 123}) it updates. Logged in the audit trail.',
  "sankhya.write.entity": "Entity",
  "sankhya.write.pk": "Key (JSON, empty to create)",
  "sankhya.write.values": "Fields and values (JSON)",
  "sankhya.write.submit": "Save to Sankhya",
  "sankhya.write.ok": "Saved to Sankhya: {result}",
  "sankhya.note": "Order, estimate or quote",
  "sankhya.note.hint":
    "Creates the document in Sankhya (CACSP.incluirNota). Its type (sales order, purchase order, estimate, quote) comes from the TOP (CODTIPOPER) and TIPMOV set up in the ERP. With NUNOTA in the header, it adds or changes that document's items (SEQUENCIA changes the item).",
  "sankhya.note.header": "Header (JSON)",
  "sankhya.note.items": "Items (JSON list)",
  "sankhya.note.informPrice":
    "Use the price and discount given (otherwise the ERP price table applies)",
  "sankhya.note.submit": "Send to Sankhya",
  "sankhya.note.ok": "Document in Sankhya: NUNOTA {nunota}",
  "sankhya.cancel": "Cancel documents",
  "sankhya.cancel.hint":
    "Cancels in Sankhya (CACSP.cancelarNota). Invoiced documents are not cancelled.",
  "sankhya.cancel.nunotas": "NUNOTA (comma separated)",
  "sankhya.cancel.justification": "Justification",
  "sankhya.cancel.submit": "Cancel in Sankhya",
  "sankhya.cancel.ok": "Cancelled in Sankhya: {nunota}",
  "sankhya.notConfigured":
    "Save the credentials in the Sankhya integration tab to use this part.",
};

export const zh: Record<keyof typeof pt, string> = {
  "sankhya.title": "Sankhya",
  "sankhya.subtitle":
    "通过官方 API 连接 Sankhya Om ERP：查询任意表、查看字段和关联，并新增或修改记录、订单和报价。",
  "sankhya.back": "返回设置",
  "sankhya.open": "打开 Sankhya",
  "sankhya.settingsHint": "查询、数据字典以及向 ERP 发送订单和报价。",
  "sankhya.status": "连接",
  "sankhya.status.configured": "已配置：{base}",
  "sankhya.status.missing":
    "缺少凭证：{vars}。请在“Sankhya 集成”标签中保存（或在 Vercel 环境变量中设置）。",
  "sankhya.status.test": "测试连接",
  "sankhya.status.ok": "已连接，用时 {ms} 毫秒（{base}）。公司：{companies}",
  "sankhya.status.help":
    "凭据：Client ID 和 Client Secret（开发者区域）以及 X-Token（Sankhya Om 的网关设置页面）。",
  "sankhya.error": "Sankhya 拒绝（{code}）：{detail}",
  "sankhya.dict": "数据字典",
  "sankhya.dict.hint":
    "按表或实体的名称或描述搜索（如 PRODUTO、TGFPAR、CabecalhoNota、AD_）。包括自定义表。",
  "sankhya.dict.search": "搜索表",
  "sankhya.dict.placeholder": "PRODUTO、PARCEIRO、NOTA、AD_…",
  "sankhya.dict.open": "查看字段和关联",
  "sankhya.table": "表 {table}",
  "sankhya.table.instances": "实体（查询和写入使用的名称）",
  "sankhya.table.fields": "字段",
  "sankhya.table.links": "与其他表的关联",
  "sankhya.table.query": "查询此实体",
  "sankhya.records": "查询实体",
  "sankhya.records.hint":
    "任意实体（Produto、Parceiro、CabecalhoNota、ItemNota、Estoque…），可同时带出关联实体。条件中用 ?，值每行一个。",
  "sankhya.records.entity": "实体",
  "sankhya.records.fields": "字段（* = 全部）",
  "sankhya.records.joins": "关联（每行一个：关联: 字段1, 字段2）",
  "sankhya.records.where": "条件（如 CODPARC = ? AND ATIVO = ?）",
  "sankhya.records.params": "条件值（每行一个：类型:值，类型 S I F D H）",
  "sankhya.records.run": "查询",
  "sankhya.records.total": "本页 {shown} 条记录 · 共 {total}",
  "sankhya.records.next": "下一页",
  "sankhya.records.prev": "上一页",
  "sankhya.sql": "SQL（只读）",
  "sankhya.sql.hint":
    "在 Sankhya 数据库上执行 SELECT（Oracle 或 SQL Server，取决于 ERP）。不接受任何修改数据的语句。网关用户需要有数据库浏览器权限。",
  "sankhya.sql.run": "执行",
  "sankhya.rows.limited": "显示 {total} 行中的 {shown} 行。",
  "sankhya.rows.none": "没有记录。",
  "sankhya.write": "新增或修改记录",
  "sankhya.write.hint":
    '直接写入 ERP（DatasetSP.save）。无主键时新增；有主键（如 {"CODPARC": 123}）时修改。记录在审计中。',
  "sankhya.write.entity": "实体",
  "sankhya.write.pk": "主键（JSON，新增时留空）",
  "sankhya.write.values": "字段和值（JSON）",
  "sankhya.write.submit": "保存到 Sankhya",
  "sankhya.write.ok": "已保存到 Sankhya：{result}",
  "sankhya.note": "订单、估价或报价",
  "sankhya.note.hint":
    "在 Sankhya 中创建单据（CACSP.incluirNota）。类型（销售订单、采购订单、估价、报价）由 ERP 中配置的 TOP（CODTIPOPER）和 TIPMOV 决定。表头中有 NUNOTA 时，新增或修改该单据的明细（SEQUENCIA 修改该明细）。",
  "sankhya.note.header": "表头（JSON）",
  "sankhya.note.items": "明细（JSON 列表）",
  "sankhya.note.informPrice": "使用填写的价格和折扣（否则使用 ERP 价格表）",
  "sankhya.note.submit": "发送到 Sankhya",
  "sankhya.note.ok": "Sankhya 单据：NUNOTA {nunota}",
  "sankhya.cancel": "取消单据",
  "sankhya.cancel.hint":
    "在 Sankhya 中取消（CACSP.cancelarNota）。已开票的单据不会被取消。",
  "sankhya.cancel.nunotas": "NUNOTA（逗号分隔）",
  "sankhya.cancel.justification": "理由",
  "sankhya.cancel.submit": "在 Sankhya 中取消",
  "sankhya.cancel.ok": "已在 Sankhya 中取消：{nunota}",
  "sankhya.notConfigured": "请先在“Sankhya 集成”标签中保存凭证。",
};
