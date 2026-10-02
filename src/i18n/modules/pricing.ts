/**
 * Dicionário do módulo "pricing" (preço ao cliente: custo importado + margem,
 * câmbio PTAX, frete por CBM): mesmas chaves em pt, en e zh.
 */
export const pt = {
  "pricing.fx.source.ecb": "Banco Central Europeu (referência)",
  "pricing.fx.lastError": "Última busca falhou: {reason}",
  "pricing.fx.fetchNow": "Buscar cotações",
  "pricing.fx.fetching": "Buscando...",
  "pricing.fx.fetchedFrom":
    "Cotações de {source} ({when}). Já valem para os cálculos; salve para guardar também nos campos.",
  "pricing.fx.source.ptax": "PTAX Banco Central",
  "pricing.fx.source.awesomeapi": "AwesomeAPI (comercial)",
  "pricing.fx.fetchError":
    "Não foi possível buscar agora: nenhuma fonte respondeu. Informe o valor manualmente.",
  "pricing.calc.useCalculated": "Usar valor calculado",
  "pricing.refresh": "Atualizar proposta com o câmbio de hoje",
  "pricing.refreshed":
    "Proposta atualizada com o câmbio de hoje. O cliente foi avisado.",
  "pricing.error.proof_already_sent":
    "O cliente já enviou o comprovante do sinal: a proposta não pode mudar.",
  "pricing.error.no_pricing":
    "Esta proposta não tem cálculo automático para atualizar.",
  "pricing.error.not_brl":
    "A atualização pelo câmbio vale só para propostas em Real.",
  "pricing.settings.title": "Preço ao cliente",
  "pricing.settings.hint":
    "Ao selecionar o fornecedor, o valor ao cliente vem calculado: preço da ficha × quantidade convertido pela PTAX do dia + frete + imposto de importação + IPI da ficha, mais a margem. O operador ainda pode ajustar.",
  "pricing.settings.margin": "Margem geral (%)",
  "pricing.settings.marginHint":
    "Vale quando o cliente e a linha do produto não têm margem própria.",
  "pricing.settings.freight": "Frete estimado por CBM",
  "pricing.settings.freightHint":
    "Vazio: sem estimativa (o operador informa o frete do transportador).",
  "pricing.settings.freightCurrency": "Moeda do frete",
  "pricing.settings.fx": "Câmbio do dia",
  "pricing.settings.fxManualHint":
    'Câmbio manual de reserva: só é usado se nenhuma cotação tiver sido obtida. "Buscar cotações" consulta a do dia e preenche os três campos.',
  "pricing.settings.byLine": "Margem por linha de produto (facultativa)",
  "pricing.settings.byOptionalHint":
    "Vazio: usa a margem geral. Vale quando o cliente não tem margem própria.",
  "pricing.settings.byCustomer": "Margem por cliente (facultativa)",
  "pricing.settings.byCustomerHint":
    "Vazio: usa a da linha ou a geral. Tem prioridade sobre as demais.",
  "pricing.settings.inherit": "linha/geral",
  "pricing.fx.status.today": "Cotação de hoje",
  "pricing.fx.status.stale":
    "Busca falhou: usando a última PTAX ({day}) como sugestão",
  "pricing.fx.status.manual": "Sem PTAX: usando câmbio manual",
  "pricing.fx.status.none": "Sem câmbio: informe o manual",
  "settings.error.margin_invalid":
    "Margem inválida: use um número de 0 a 1000.",
  "settings.error.freight_invalid": "Frete por CBM inválido.",
  "settings.error.fx_invalid": "Câmbio manual inválido.",
  "pricing.calc.title": "Valor ao cliente calculado",
  "pricing.calc.fob": "Produto (FOB): {qty} × {price}",
  "pricing.calc.fx": "Câmbio {currency}: R$ {rate}",
  "pricing.calc.freightCarrier": "Frete informado pelo transportador",
  "pricing.calc.freightCbm": "Frete estimado: {cbm} m³ × {rate}",
  "pricing.calc.freightNone": "Frete: não informado",
  "pricing.calc.importTax": "Imposto de importação ({pct}%)",
  "pricing.calc.ipi": "IPI ({pct}%)",
  "pricing.calc.landed": "Custo importado",
  "pricing.calc.margin": "Margem {pct}% ({source})",
  "pricing.calc.source.customer": "do cliente",
  "pricing.calc.source.line": "da linha",
  "pricing.calc.source.default": "geral",
  "pricing.calc.sell": "Valor ao cliente",
  "pricing.calc.carrierFreight": "Frete do transportador (R$)",
  "pricing.calc.carrierFreightHint":
    "Se informado, substitui a estimativa por CBM.",
  "pricing.calc.missing.price": "A ficha não tem preço.",
  "pricing.calc.missing.fx": "Sem câmbio para a moeda da ficha.",
  "pricing.calc.missing.freight":
    "Sem frete: informe o do transportador ou configure o frete por CBM.",
  "pricing.calc.missing.cbm":
    "Sem CBM na ficha (caixa master e CBM da caixa): frete não estimado.",
  "pricing.calc.missing.importTax":
    "Imposto de importação não informado na ficha (0%).",
  "pricing.calc.missing.ipi": "IPI não informado na ficha (0%).",
  "pricing.calc.noSheet":
    "Este fornecedor respondeu sem a ficha de compra: informe o valor ao cliente manualmente.",
  "pricing.calc.marginZero":
    "Margem 0%: o valor sai igual ao custo. Configure a margem em Configurações.",
  "pricing.calc.fxStale":
    "PTAX de hoje indisponível: usando a de {day} como sugestão.",
  "pricing.variance":
    "O câmbio mudou {pct}% desde a proposta ({currency} R$ {from} → R$ {to}). Revise o valor antes de confirmar o sinal.",
};

export const en: Record<keyof typeof pt, string> = {
  "pricing.fx.source.ecb": "European Central Bank (reference)",
  "pricing.fx.lastError": "Last fetch failed: {reason}",
  "pricing.fx.fetchNow": "Fetch rates",
  "pricing.fx.fetching": "Fetching...",
  "pricing.fx.fetchedFrom":
    "Rates from {source} ({when}). They already apply to calculations; save to keep them in the fields too.",
  "pricing.fx.source.ptax": "Central Bank PTAX",
  "pricing.fx.source.awesomeapi": "AwesomeAPI (commercial)",
  "pricing.fx.fetchError":
    "Could not fetch now: no source responded. Enter the value manually.",
  "pricing.calc.useCalculated": "Use calculated value",
  "pricing.refresh": "Update proposal with today's exchange rate",
  "pricing.refreshed":
    "Proposal updated with today's exchange rate. The customer was notified.",
  "pricing.error.proof_already_sent":
    "The customer already sent the deposit proof: the proposal cannot change.",
  "pricing.error.no_pricing":
    "This proposal has no automatic calculation to update.",
  "pricing.error.not_brl":
    "Exchange-rate update only applies to proposals in Real.",
  "pricing.settings.title": "Price to customer",
  "pricing.settings.hint":
    "When the supplier is selected, the customer value is calculated: sheet price × quantity converted at today's PTAX + freight + import duty + IPI from the sheet, plus the margin. The operator can still adjust it.",
  "pricing.settings.margin": "Default margin (%)",
  "pricing.settings.marginHint":
    "Used when neither the customer nor the product line has its own margin.",
  "pricing.settings.freight": "Estimated freight per CBM",
  "pricing.settings.freightHint":
    "Empty: no estimate (the operator enters the carrier's freight).",
  "pricing.settings.freightCurrency": "Freight currency",
  "pricing.settings.fx": "Today's exchange rate",
  "pricing.settings.fxManualHint":
    'Manual fallback rate: only used if no rate has ever been obtained. "Fetch rates" gets today\'s rates and fills all three fields.',
  "pricing.settings.byLine": "Margin per product line (optional)",
  "pricing.settings.byOptionalHint":
    "Empty: uses the default margin. Applies when the customer has no margin of its own.",
  "pricing.settings.byCustomer": "Margin per customer (optional)",
  "pricing.settings.byCustomerHint":
    "Empty: uses the line or default margin. Takes priority over the others.",
  "pricing.settings.inherit": "line/default",
  "pricing.fx.status.today": "Today's rate",
  "pricing.fx.status.stale":
    "Fetch failed: using the last PTAX ({day}) as a suggestion",
  "pricing.fx.status.manual": "No PTAX: using the manual rate",
  "pricing.fx.status.none": "No exchange rate: enter the manual one",
  "settings.error.margin_invalid":
    "Invalid margin: use a number from 0 to 1000.",
  "settings.error.freight_invalid": "Invalid freight per CBM.",
  "settings.error.fx_invalid": "Invalid manual exchange rate.",
  "pricing.calc.title": "Calculated customer value",
  "pricing.calc.fob": "Product (FOB): {qty} × {price}",
  "pricing.calc.fx": "Rate {currency}: R$ {rate}",
  "pricing.calc.freightCarrier": "Freight quoted by the carrier",
  "pricing.calc.freightCbm": "Estimated freight: {cbm} m³ × {rate}",
  "pricing.calc.freightNone": "Freight: not provided",
  "pricing.calc.importTax": "Import duty ({pct}%)",
  "pricing.calc.ipi": "IPI ({pct}%)",
  "pricing.calc.landed": "Landed cost",
  "pricing.calc.margin": "Margin {pct}% ({source})",
  "pricing.calc.source.customer": "customer",
  "pricing.calc.source.line": "product line",
  "pricing.calc.source.default": "default",
  "pricing.calc.sell": "Customer value",
  "pricing.calc.carrierFreight": "Carrier freight (R$)",
  "pricing.calc.carrierFreightHint":
    "If provided, it replaces the per-CBM estimate.",
  "pricing.calc.missing.price": "The sheet has no price.",
  "pricing.calc.missing.fx": "No exchange rate for the sheet currency.",
  "pricing.calc.missing.freight":
    "No freight: enter the carrier's or set the freight per CBM.",
  "pricing.calc.missing.cbm":
    "No CBM on the sheet (master carton and CBM per carton): freight not estimated.",
  "pricing.calc.missing.importTax": "Import duty not on the sheet (0%).",
  "pricing.calc.missing.ipi": "IPI not on the sheet (0%).",
  "pricing.calc.noSheet":
    "This supplier answered without the purchase sheet: enter the customer value manually.",
  "pricing.calc.marginZero":
    "Margin 0%: the value equals the cost. Set the margin in Settings.",
  "pricing.calc.fxStale":
    "Today's PTAX unavailable: using {day} as a suggestion.",
  "pricing.variance":
    "The exchange rate changed {pct}% since the proposal ({currency} R$ {from} → R$ {to}). Review the value before confirming the deposit.",
};

export const zh: Record<keyof typeof pt, string> = {
  "pricing.fx.source.ecb": "欧洲央行（参考汇率）",
  "pricing.fx.lastError": "上次获取失败：{reason}",
  "pricing.fx.fetchNow": "获取汇率",
  "pricing.fx.fetching": "获取中...",
  "pricing.fx.fetchedFrom":
    "汇率来源：{source}（{when}）。已用于计算；保存后也会写入字段。",
  "pricing.fx.source.ptax": "巴西央行 PTAX",
  "pricing.fx.source.awesomeapi": "AwesomeAPI（商业汇率）",
  "pricing.fx.fetchError": "暂时无法获取：没有任何来源响应。请手动填写。",
  "pricing.calc.useCalculated": "使用计算值",
  "pricing.refresh": "按今日汇率更新报价",
  "pricing.refreshed": "报价已按今日汇率更新，已通知客户。",
  "pricing.error.proof_already_sent": "客户已提交定金凭证：报价不能更改。",
  "pricing.error.no_pricing": "此报价没有可更新的自动计算。",
  "pricing.error.not_brl": "按汇率更新仅适用于雷亚尔报价。",
  "pricing.settings.title": "客户价格",
  "pricing.settings.hint":
    "选择供应商时自动计算客户价格：采购单价格 × 数量，按当日 PTAX 汇率换算，加运费、进口税和 IPI，再加利润率。操作员仍可调整。",
  "pricing.settings.margin": "默认利润率（%）",
  "pricing.settings.marginHint": "客户和产品线都没有单独利润率时使用。",
  "pricing.settings.freight": "每立方米预估运费",
  "pricing.settings.freightHint": "留空：不预估（由操作员填写承运人运费）。",
  "pricing.settings.freightCurrency": "运费币种",
  "pricing.settings.fx": "当日汇率",
  "pricing.settings.fxManualHint":
    "手动备用汇率：仅在从未获取任何汇率时使用。“获取汇率”可查询当日汇率并填入三个字段。",
  "pricing.settings.byLine": "按产品线利润率（可选）",
  "pricing.settings.byOptionalHint":
    "留空：使用默认利润率。客户无单独利润率时适用。",
  "pricing.settings.byCustomer": "按客户利润率（可选）",
  "pricing.settings.byCustomerHint":
    "留空：使用产品线或默认利润率。优先于其他设置。",
  "pricing.settings.inherit": "产品线/默认",
  "pricing.fx.status.today": "今日汇率",
  "pricing.fx.status.stale": "获取失败：使用最近的 PTAX（{day}）作为建议",
  "pricing.fx.status.manual": "无 PTAX：使用手动汇率",
  "pricing.fx.status.none": "无汇率：请填写手动汇率",
  "settings.error.margin_invalid": "利润率无效：请输入 0 到 1000 之间的数字。",
  "settings.error.freight_invalid": "每立方米运费无效。",
  "settings.error.fx_invalid": "手动汇率无效。",
  "pricing.calc.title": "计算的客户价格",
  "pricing.calc.fob": "产品（FOB）：{qty} × {price}",
  "pricing.calc.fx": "{currency} 汇率：R$ {rate}",
  "pricing.calc.freightCarrier": "承运人报价运费",
  "pricing.calc.freightCbm": "预估运费：{cbm} m³ × {rate}",
  "pricing.calc.freightNone": "运费：未提供",
  "pricing.calc.importTax": "进口税（{pct}%）",
  "pricing.calc.ipi": "IPI（{pct}%）",
  "pricing.calc.landed": "到岸成本",
  "pricing.calc.margin": "利润率 {pct}%（{source}）",
  "pricing.calc.source.customer": "客户",
  "pricing.calc.source.line": "产品线",
  "pricing.calc.source.default": "默认",
  "pricing.calc.sell": "客户价格",
  "pricing.calc.carrierFreight": "承运人运费（R$）",
  "pricing.calc.carrierFreightHint": "填写后将替代按立方米的预估。",
  "pricing.calc.missing.price": "采购单没有价格。",
  "pricing.calc.missing.fx": "没有采购单币种的汇率。",
  "pricing.calc.missing.freight":
    "没有运费：请填写承运人运费或设置每立方米运费。",
  "pricing.calc.missing.cbm":
    "采购单没有体积（外箱数量和每箱体积）：未预估运费。",
  "pricing.calc.missing.importTax": "采购单未填写进口税（0%）。",
  "pricing.calc.missing.ipi": "采购单未填写 IPI（0%）。",
  "pricing.calc.noSheet": "该供应商未提交采购单：请手动填写客户价格。",
  "pricing.calc.marginZero":
    "利润率为 0%：价格等于成本。请在设置中配置利润率。",
  "pricing.calc.fxStale": "今日 PTAX 不可用：使用 {day} 的汇率作为建议。",
  "pricing.variance":
    "自报价以来汇率变化了 {pct}%（{currency} R$ {from} → R$ {to}）。确认定金前请复核价格。",
};
