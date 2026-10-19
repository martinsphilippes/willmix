/**
 * Dicionário do módulo "data-reset" (Configurações → Limpar dados de teste:
 * apaga as vendas de teste, mantém catálogo e cadastros): mesmas chaves em
 * pt, en e zh.
 */
export const pt = {
  "reset.link": "Limpar dados de teste",
  "reset.title": "Limpar dados de teste",
  "reset.intro":
    "Apaga para sempre as vendas feitas nos testes, para começar de novo. Não tem como desfazer.",
  "reset.removeTitle": "Vai ser apagado",
  "reset.keepTitle": "Fica como está",
  "reset.keepList":
    "Catálogo de produtos (fichas mestres, fotos, fornecedores do produto, certificações e NCM), sourcing cadastrado pela equipe, programações de compra, clientes, fornecedores, usuários, linhas de produto, configurações e tabela fiscal.",
  "reset.row.requests": "Solicitações",
  "reset.row.quotes": "Cotações",
  "reset.row.orders": "Pedidos",
  "reset.row.payments": "Pagamentos",
  "reset.row.containers": "Containers",
  "reset.row.documents": "Documentos e arquivos de venda",
  "reset.row.notifications": "Notificações",
  "reset.row.aiSuggestions": "Sugestões da IA",
  "reset.row.kits": "Kits de marketing",
  "reset.row.sourcing": "Itens de sourcing criados por solicitações",
  "reset.remaining":
    "Ainda restam {n} registros (há um limite por vez). Toque em Apagar de novo para terminar.",
  "reset.row.other":
    "Etapas, itens, fichas de pedido e cotação, inspeções, revisões e histórico",
  "reset.row.total": "Total",
  "reset.unlink":
    "{n} registros que ficam só perdem a ligação com vendas apagadas (ex.: programação de compra que virou pedido volta a planejada).",
  "reset.counters":
    "A numeração recomeça: a próxima solicitação e o próximo pedido serão o #1.",
  "reset.nothing": "Não há vendas para apagar.",
  "reset.confirmLabel": "Para confirmar, digite APAGAR",
  "reset.submit": "Apagar dados de teste",
  "reset.done":
    "Pronto: as vendas de teste foram apagadas. Pode começar os testes de novo.",
  "reset.error.confirm": "Digite APAGAR para confirmar. Nada foi apagado.",
  "reset.error.blocked":
    "Não deu para começar a limpeza ({code}). Nada foi apagado.",
  "reset.error.failed":
    "A limpeza parou no meio ({code}). O que deve ficar continua; toque em Apagar de novo para terminar.",
  "reset.back": "Voltar às configurações",
};

export const en: Record<keyof typeof pt, string> = {
  "reset.link": "Clear test data",
  "reset.title": "Clear test data",
  "reset.intro":
    "Permanently deletes the sales made during testing, to start over. This cannot be undone.",
  "reset.removeTitle": "Will be deleted",
  "reset.keepTitle": "Stays as it is",
  "reset.keepList":
    "Product catalog (master sheets, photos, product suppliers, certifications and NCM), sourcing entered by the team, purchase schedules, customers, suppliers, users, product lines, settings and tax table.",
  "reset.row.requests": "Requests",
  "reset.row.quotes": "Quotes",
  "reset.row.orders": "Orders",
  "reset.row.payments": "Payments",
  "reset.row.containers": "Containers",
  "reset.row.documents": "Sales documents and files",
  "reset.row.notifications": "Notifications",
  "reset.row.aiSuggestions": "AI suggestions",
  "reset.row.kits": "Marketing kits",
  "reset.row.sourcing": "Sourcing items created by requests",
  "reset.remaining":
    "{n} records are still left (there is a limit per run). Tap Delete again to finish.",
  "reset.row.other":
    "Stages, items, order and quote sheets, inspections, reviews and history",
  "reset.row.total": "Total",
  "reset.unlink":
    "{n} records that stay only lose their link to deleted sales (e.g. a purchase schedule that became an order goes back to planned).",
  "reset.counters":
    "Numbering restarts: the next request and the next order will be #1.",
  "reset.nothing": "There are no sales to delete.",
  "reset.confirmLabel": "To confirm, type APAGAR",
  "reset.submit": "Delete test data",
  "reset.done":
    "Done: the test sales were deleted. You can start testing again.",
  "reset.error.confirm": "Type APAGAR to confirm. Nothing was deleted.",
  "reset.error.blocked":
    "The cleanup could not start ({code}). Nothing was deleted.",
  "reset.error.failed":
    "The cleanup stopped halfway ({code}). What should stay is intact; tap Delete again to finish.",
  "reset.back": "Back to settings",
};

export const zh: Record<keyof typeof pt, string> = {
  "reset.link": "清除测试数据",
  "reset.title": "清除测试数据",
  "reset.intro": "永久删除测试中产生的销售数据，以便重新开始。此操作无法撤销。",
  "reset.removeTitle": "将被删除",
  "reset.keepTitle": "保持不变",
  "reset.keepList":
    "产品目录（主采购单、照片、产品供应商、认证和 NCM）、团队录入的寻源、采购计划、客户、供应商、用户、产品线、设置和税率表。",
  "reset.row.requests": "需求",
  "reset.row.quotes": "报价",
  "reset.row.orders": "订单",
  "reset.row.payments": "付款",
  "reset.row.containers": "集装箱",
  "reset.row.documents": "销售文件及附件",
  "reset.row.notifications": "通知",
  "reset.row.aiSuggestions": "AI 建议",
  "reset.row.kits": "营销素材包",
  "reset.row.sourcing": "由需求创建的寻源项目",
  "reset.remaining":
    "仍剩余 {n} 条记录（每次有数量上限）。请再次点击删除以完成。",
  "reset.row.other": "阶段、明细、订单和报价采购单、验货、复核及历史记录",
  "reset.row.total": "合计",
  "reset.unlink":
    "{n} 条保留的记录仅解除与已删除销售的关联（例如已转为订单的采购计划恢复为计划中）。",
  "reset.counters": "编号重新开始：下一个需求和下一个订单将为 #1。",
  "reset.nothing": "没有可删除的销售数据。",
  "reset.confirmLabel": "请输入 APAGAR 以确认",
  "reset.submit": "删除测试数据",
  "reset.done": "完成：测试销售数据已删除，可以重新开始测试。",
  "reset.error.confirm": "请输入 APAGAR 以确认。未删除任何数据。",
  "reset.error.blocked": "清理无法开始（{code}）。未删除任何数据。",
  "reset.error.failed":
    "清除中途停止（{code}）。应保留的数据完好；再次点击删除以完成。",
  "reset.back": "返回设置",
};
