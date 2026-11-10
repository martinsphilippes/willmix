/**
 * Página de uma linha do Booking: edição (etapa, cliente, reserva,
 * responsável, observação), dados da ficha, análise do Superplan e histórico
 * (docs/BOOKING.md). Mesmas chaves em pt, en e zh.
 */
export const pt = {
  "booking.detail.back": "Voltar ao Booking",
  "booking.detail.product": "Abrir o produto",
  "booking.detail.superplan": "Abrir no Superplan",
  "booking.detail.saved": "Linha salva.",
  "booking.detail.analysisSaved": "Análise do Superplan gravada nesta linha.",
  "booking.detail.edit.title": "Etapa, cliente e reserva",
  "booking.detail.status": "Etapa",
  "booking.detail.status.hint":
    "Aprovar, tirar da vitrine ou reabrir é de quem analisa no Superplan.",
  "booking.detail.customer": "Cliente",
  "booking.detail.customer.none": "Sem cliente",
  "booking.detail.qty": "Quantidade reservada (peças)",
  "booking.detail.qty.hint": "Pedido mínimo do produto: {moq} peças.",
  "booking.detail.owner": "Responsável",
  "booking.detail.owner.none": "Sem responsável",
  "booking.detail.note": "Observação",
  "booking.detail.save": "Salvar",
  "booking.detail.saving": "Salvando…",
  "booking.detail.locked":
    "Esta linha já virou solicitação. Cliente e quantidade mudam na solicitação.",
  "booking.detail.hidden":
    "O cliente ainda não vê este produto. Ele entra na vitrine quando for aprovado.",
  "booking.detail.visible": "Este produto já aparece na vitrine do cliente.",
  "booking.detail.sheet.title": "Dados da ficha técnica",
  "booking.detail.source": "Planilha de origem",
  "booking.detail.sourceRows": "{file} (linhas {rows})",
  "booking.detail.incoterm": "Incoterm",
  "booking.detail.ncm": "NCM",
  "booking.detail.sku": "Código no portal",
  "booking.detail.estimatedNote": "estimado: líquido + {pct}%",
  "booking.detail.analysis.title": "Análise do Superplan",
  "booking.detail.analysis.none":
    "Ainda sem análise. Abra o Superplan por esta linha e toque em “Gravar no Booking”, ou use “Analisar no Superplan” na lista.",
  "booking.detail.analysis.businessType": "Tipo de negócio",
  "booking.detail.analysis.cost": "Custo por peça",
  "booking.detail.analysis.minimum": "Preço mínimo",
  "booking.detail.analysis.sale": "Preço de venda",
  "booking.detail.analysis.saleMinimum": "{price} (o preço mínimo)",
  "booking.detail.analysis.profit": "Lucro",
  "booking.detail.analysis.profitValue": "{pct}% (meta {target}%)",
  "booking.detail.analysis.target": "Preço para bater a meta",
  "booking.detail.analysis.when": "Gravada em {date} por {name}.",
  "booking.detail.analysis.assumptions": "O que foi considerado",
  "booking.detail.analysis.rates":
    "Dólar oficial {official} · dólar futuro {future} · RMB por dólar {rmb}",
  "booking.detail.analysis.taxes": "II {ii}% · IPI {ipi}%",
  "booking.detail.analysis.noNcm":
    "Sem NCM na tabela fiscal: II e IPI entraram como 0 (o sinal sai otimista). Ajuste no Superplan e grave de novo.",
  "booking.detail.analysis.container":
    "Container {container} · frete US$ {freight}",
  "booking.detail.analysis.grossEstimated":
    "Peso bruto estimado (líquido + folga da embalagem).",
  "booking.detail.analysis.stale":
    "É um retrato daquele dia: não muda sozinho quando o câmbio ou o frete mudam.",
  "booking.detail.history.title": "Histórico",
  "booking.detail.history.empty": "Sem histórico.",
  "booking.detail.request": "Solicitação gerada",
  "booking.superplan.banner":
    "Analisando para o Booking: {name}. Ajuste o que precisar e toque em “Gravar no Booking”.",
  "booking.superplan.back": "Voltar à linha do Booking",
  "booking.superplan.title": "Gravar esta simulação no Booking",
  "booking.superplan.hint":
    "Guarda na linha o tipo de negócio, o preço testado, o custo, o lucro e o sinal como estão agora. Linha em Novo vai para Em análise.",
  "booking.superplan.save": "Gravar no Booking",
  "booking.superplan.missing":
    "Esta linha do Booking não existe mais (ou o produto saiu do cadastro).",
};

export const en: Record<keyof typeof pt, string> = {
  "booking.detail.back": "Back to Booking",
  "booking.detail.product": "Open the product",
  "booking.detail.superplan": "Open in Superplan",
  "booking.detail.saved": "Row saved.",
  "booking.detail.analysisSaved": "Superplan analysis saved on this row.",
  "booking.detail.edit.title": "Stage, customer and reservation",
  "booking.detail.status": "Stage",
  "booking.detail.status.hint":
    "Approving, removing from the showcase or reopening is for whoever analyzes in Superplan.",
  "booking.detail.customer": "Customer",
  "booking.detail.customer.none": "No customer",
  "booking.detail.qty": "Reserved quantity (pieces)",
  "booking.detail.qty.hint": "Product minimum order: {moq} pieces.",
  "booking.detail.owner": "Owner",
  "booking.detail.owner.none": "No owner",
  "booking.detail.note": "Note",
  "booking.detail.save": "Save",
  "booking.detail.saving": "Saving…",
  "booking.detail.locked":
    "This row already became a request. Customer and quantity change in the request.",
  "booking.detail.hidden":
    "The customer does not see this product yet. It enters the showcase when it is approved.",
  "booking.detail.visible":
    "This product already appears in the customer's showcase.",
  "booking.detail.sheet.title": "Technical sheet data",
  "booking.detail.source": "Source spreadsheet",
  "booking.detail.sourceRows": "{file} (rows {rows})",
  "booking.detail.incoterm": "Incoterm",
  "booking.detail.ncm": "NCM",
  "booking.detail.sku": "Portal code",
  "booking.detail.estimatedNote": "estimated: net + {pct}%",
  "booking.detail.analysis.title": "Superplan analysis",
  "booking.detail.analysis.none":
    "No analysis yet. Open Superplan from this row and tap “Save to Booking”, or use “Analyze in Superplan” in the list.",
  "booking.detail.analysis.businessType": "Business type",
  "booking.detail.analysis.cost": "Cost per piece",
  "booking.detail.analysis.minimum": "Minimum price",
  "booking.detail.analysis.sale": "Sale price",
  "booking.detail.analysis.saleMinimum": "{price} (the minimum price)",
  "booking.detail.analysis.profit": "Profit",
  "booking.detail.analysis.profitValue": "{pct}% (target {target}%)",
  "booking.detail.analysis.target": "Price to hit the target",
  "booking.detail.analysis.when": "Saved on {date} by {name}.",
  "booking.detail.analysis.assumptions": "What was considered",
  "booking.detail.analysis.rates":
    "Official dollar {official} · future dollar {future} · RMB per dollar {rmb}",
  "booking.detail.analysis.taxes": "II {ii}% · IPI {ipi}%",
  "booking.detail.analysis.noNcm":
    "No NCM in the tax table: II and IPI were counted as 0 (the signal is optimistic). Adjust in Superplan and save again.",
  "booking.detail.analysis.container":
    "Container {container} · freight US$ {freight}",
  "booking.detail.analysis.grossEstimated":
    "Estimated gross weight (net + packaging allowance).",
  "booking.detail.analysis.stale":
    "It is a snapshot of that day: it does not change by itself when the exchange rate or freight change.",
  "booking.detail.history.title": "History",
  "booking.detail.history.empty": "No history.",
  "booking.detail.request": "Request created",
  "booking.superplan.banner":
    "Analyzing for the Booking: {name}. Adjust what you need and tap “Save to Booking”.",
  "booking.superplan.back": "Back to the Booking row",
  "booking.superplan.title": "Save this simulation to the Booking",
  "booking.superplan.hint":
    "Stores on the row the business type, the tested price, cost, profit and signal as they are now. A row in New moves to Under analysis.",
  "booking.superplan.save": "Save to Booking",
  "booking.superplan.missing":
    "This Booking row no longer exists (or the product left the catalog).",
};

export const zh: Record<keyof typeof pt, string> = {
  "booking.detail.back": "返回 Booking",
  "booking.detail.product": "打开产品",
  "booking.detail.superplan": "在 Superplan 中打开",
  "booking.detail.saved": "该行已保存。",
  "booking.detail.analysisSaved": "Superplan 分析已保存到该行。",
  "booking.detail.edit.title": "阶段、客户和预订",
  "booking.detail.status": "阶段",
  "booking.detail.status.hint":
    "批准、从展示页撤下或重新打开，只能由在 Superplan 中分析的人操作。",
  "booking.detail.customer": "客户",
  "booking.detail.customer.none": "无客户",
  "booking.detail.qty": "预订数量（件）",
  "booking.detail.qty.hint": "该产品的起订量：{moq} 件。",
  "booking.detail.owner": "负责人",
  "booking.detail.owner.none": "无负责人",
  "booking.detail.note": "备注",
  "booking.detail.save": "保存",
  "booking.detail.saving": "保存中…",
  "booking.detail.locked": "该行已生成询价单。客户和数量请在询价单中修改。",
  "booking.detail.hidden": "客户暂时看不到该产品。批准后才进入展示页。",
  "booking.detail.visible": "该产品已出现在客户的展示页中。",
  "booking.detail.sheet.title": "技术表数据",
  "booking.detail.source": "来源表格",
  "booking.detail.sourceRows": "{file}（第 {rows} 行）",
  "booking.detail.incoterm": "贸易术语",
  "booking.detail.ncm": "NCM",
  "booking.detail.sku": "平台编码",
  "booking.detail.estimatedNote": "估算：净重 + {pct}%",
  "booking.detail.analysis.title": "Superplan 分析",
  "booking.detail.analysis.none":
    "尚无分析。从该行打开 Superplan 并点击“保存到 Booking”，或在列表中使用“在 Superplan 中分析”。",
  "booking.detail.analysis.businessType": "业务类型",
  "booking.detail.analysis.cost": "单件成本",
  "booking.detail.analysis.minimum": "最低价",
  "booking.detail.analysis.sale": "售价",
  "booking.detail.analysis.saleMinimum": "{price}（最低价）",
  "booking.detail.analysis.profit": "利润",
  "booking.detail.analysis.profitValue": "{pct}%（目标 {target}%）",
  "booking.detail.analysis.target": "达到目标的价格",
  "booking.detail.analysis.when": "{date} 由 {name} 保存。",
  "booking.detail.analysis.assumptions": "计算时采用的条件",
  "booking.detail.analysis.rates":
    "官方美元 {official} · 远期美元 {future} · 每美元兑人民币 {rmb}",
  "booking.detail.analysis.taxes": "II {ii}% · IPI {ipi}%",
  "booking.detail.analysis.noNcm":
    "税表中没有 NCM：II 和 IPI 按 0 计算（信号偏乐观）。请在 Superplan 中调整后重新保存。",
  "booking.detail.analysis.container":
    "集装箱 {container} · 运费 US$ {freight}",
  "booking.detail.analysis.grossEstimated": "毛重为估算值（净重 + 包装余量）。",
  "booking.detail.analysis.stale":
    "这是当天的快照：汇率或运费变化时不会自动更新。",
  "booking.detail.history.title": "历史记录",
  "booking.detail.history.empty": "暂无历史记录。",
  "booking.detail.request": "已生成的询价单",
  "booking.superplan.banner":
    "正在为 Booking 分析：{name}。按需调整后点击“保存到 Booking”。",
  "booking.superplan.back": "返回 Booking 的该行",
  "booking.superplan.title": "把这次模拟保存到 Booking",
  "booking.superplan.hint":
    "把当前的业务类型、测试价格、成本、利润和信号保存到该行。处于“新增”的行会移到“分析中”。",
  "booking.superplan.save": "保存到 Booking",
  "booking.superplan.missing": "该 Booking 行已不存在（或产品已不在目录中）。",
};
