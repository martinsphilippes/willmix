/**
 * Dicionário do módulo "import-taxes" (tabela fiscal TEC/TIPI, NCM da
 * solicitação e tributos no custo importado): mesmas chaves em pt, en e zh.
 */
export const pt = {
  "fiscal.settings.title": "Tributos da importação",
  "fiscal.settings.hint":
    "Entram no custo importado do valor ao cliente. II e IPI saem da tabela fiscal pelo NCM; PIS, COFINS, ICMS e seguro saem daqui.",
  "fiscal.settings.insurance": "Seguro internacional (% do FOB)",
  "fiscal.settings.pis": "PIS-importação (%)",
  "fiscal.settings.cofins": "COFINS-importação (%)",
  "fiscal.settings.pisHint":
    "Alíquotas gerais: 2,1% e 9,65%. Alguns produtos têm alíquota própria; confira com o despachante.",
  "fiscal.settings.icms": "ICMS da importação (%)",
  "fiscal.settings.icmsHint":
    "Alíquota do estado do desembaraço (ex.: 18%). Vazio: o ICMS fica fora da conta, com aviso.",
  "fiscal.table.title": "Tabela fiscal (TEC e TIPI)",
  "fiscal.table.hint":
    "O II vem da TEC e o IPI da TIPI, pelo NCM confirmado de cada solicitação. Envie a planilha oficial (Excel ou CSV) ou informe os links oficiais para o robô mensal.",
  "fiscal.table.tec": "TEC (imposto de importação)",
  "fiscal.table.tipi": "TIPI (IPI)",
  "fiscal.table.loaded": "{count} NCMs · atualizada em {date} · {source}",
  "fiscal.table.missing": "Não carregada",
  "fiscal.table.source.upload": "planilha enviada",
  "fiscal.table.source.robot": "robô mensal",
  "fiscal.table.stale":
    "Tabela incompleta ou com mais de 90 dias: confira se houve mudança nas alíquotas.",
  "fiscal.table.lastError": "A última atualização automática falhou: {reason}",
  "fiscal.table.kind": "Tabela",
  "fiscal.table.file": "Planilha oficial (XLSX ou CSV)",
  "fiscal.table.upload": "Enviar planilha",
  "fiscal.table.tecUrl": "Link oficial da planilha da TEC",
  "fiscal.table.tipiUrl": "Link oficial da planilha da TIPI",
  "fiscal.table.urlHint":
    "Copie o link do arquivo no site do governo (Camex para a TEC, Receita Federal para a TIPI) e salve as configurações. O robô baixa todo dia 2; se o site bloquear, a Wellmix é avisada para enviar a planilha.",
  "fiscal.table.syncNow": "Atualizar agora pelos links",
  "fiscal.table.uploaded":
    "{kind}: {count} NCMs carregados, {changed} alíquota(s) alterada(s).",
  "fiscal.table.synced.ok": "Tabela fiscal atualizada pelos links oficiais.",
  "fiscal.table.synced.partial":
    "Atualização incompleta: veja o motivo na tabela fiscal.",
  "settings.error.tax_invalid":
    "Alíquota inválida: use um número de 0 a 99,99.",
  "settings.error.fiscal_url_invalid":
    "Link inválido: use o endereço completo começando com https://.",
  "settings.error.fiscal_unrecognized":
    "Planilha não reconhecida: precisa ter as colunas NCM e alíquota (TEC ou TIPI oficial).",
  "settings.error.fiscal_file_required": "Escolha o arquivo da planilha.",
  "settings.error.fiscal_file_too_big": "Arquivo grande demais (máx. 15 MB).",
  "settings.error.fiscal_file_type": "Envie a planilha em XLSX ou CSV.",
  "settings.error.fiscal_no_urls":
    "Informe e salve os links oficiais antes de atualizar pelos links.",
  "ncm.title": "Classificação fiscal (NCM)",
  "ncm.hint":
    "O NCM define o II (TEC) e o IPI (TIPI) do valor ao cliente. A IA sugere; a Wellmix confirma.",
  "ncm.status.confirmed": "NCM confirmado",
  "ncm.status.product": "Do cadastro do produto",
  "ncm.status.none": "Falta confirmar",
  "ncm.source.ai": "sugestão da IA",
  "ncm.source.table": "palavras-chave × tabela",
  "ncm.source.manual": "digitado",
  "ncm.source.product": "cadastro do produto",
  "ncm.rates": "II {ii} · IPI {ipi}",
  "ncm.nt": "NT",
  "ncm.notInTable": "Não está na tabela fiscal carregada.",
  "ncm.noTable":
    "Tabela fiscal não carregada: envie a TEC e a TIPI em Configurações para as alíquotas entrarem sozinhas.",
  "ncm.pending":
    "Sem NCM confirmado, II e IPI ficam em 0% no valor ao cliente.",
  "ncm.suggestions": "Sugestões",
  "ncm.suggestion.ai": "IA",
  "ncm.suggestion.table": "Palavras-chave",
  "ncm.confirm": "Confirmar",
  "ncm.manual": "Outro NCM (8 dígitos)",
  "ncm.suggest": "Sugerir com IA",
  "ncm.change": "Alterar NCM",
  "ncm.noSuggestions": "Nenhuma sugestão ainda.",
  "ncm.suggesting":
    "Buscando sugestões de NCM para este produto. Atualize a página em alguns segundos.",
  "ncm.confirmedOk":
    "NCM confirmado: II e IPI atualizados no valor ao cliente.",
  "ncm.suggestedOk": "{count} sugestão(ões) de NCM.",
  "ncm.ai.not_configured": "IA não configurada",
  "ncm.aiUnavailable":
    "IA indisponível ({reason}); sugestões só pelas palavras-chave.",
  "pricing.error.ncm_invalid": "NCM inválido: informe os 8 dígitos.",
  "pricing.error.ncm_not_in_table":
    "Este NCM não existe na tabela fiscal (TEC/TIPI) carregada. Confira o código.",
  "pricing.error.request_closed": "Solicitação cancelada.",
  "pricing.calc.insurance": "Seguro ({pct}%)",
  "pricing.calc.customsValue": "Valor aduaneiro",
  "pricing.calc.pis": "PIS-importação ({pct}%)",
  "pricing.calc.cofins": "COFINS-importação ({pct}%)",
  "pricing.calc.icms": "ICMS ({pct}%)",
  "pricing.calc.missing.icms":
    "ICMS não configurado (Configurações): fora da conta.",
  "pricing.calc.taxSource.table": "TEC/TIPI · NCM {ncm}",
  "pricing.calc.taxSource.sheet": "ficha",
  "pricing.calc.taxSource.classification": "cadastro do produto",
  "pricing.calc.ncmPending":
    "NCM não confirmado: II e IPI em 0%. Confirme o NCM no quadro de classificação fiscal.",
};

export const en: Record<keyof typeof pt, string> = {
  "fiscal.settings.title": "Import taxes",
  "fiscal.settings.hint":
    "They go into the landed cost of the customer value. Import duty and IPI come from the tax table by NCM; PIS, COFINS, ICMS and insurance come from here.",
  "fiscal.settings.insurance": "International insurance (% of FOB)",
  "fiscal.settings.pis": "PIS on imports (%)",
  "fiscal.settings.cofins": "COFINS on imports (%)",
  "fiscal.settings.pisHint":
    "General rates: 2.1% and 9.65%. Some products have their own rate; check with the customs broker.",
  "fiscal.settings.icms": "ICMS on imports (%)",
  "fiscal.settings.icmsHint":
    "Rate of the clearance state (e.g. 18%). Empty: ICMS stays out of the calculation, with a warning.",
  "fiscal.table.title": "Tax table (TEC and TIPI)",
  "fiscal.table.hint":
    "Import duty comes from the TEC and IPI from the TIPI, by each request's confirmed NCM. Upload the official spreadsheet (Excel or CSV) or provide the official links for the monthly robot.",
  "fiscal.table.tec": "TEC (import duty)",
  "fiscal.table.tipi": "TIPI (IPI)",
  "fiscal.table.loaded": "{count} NCMs · updated {date} · {source}",
  "fiscal.table.missing": "Not loaded",
  "fiscal.table.source.upload": "uploaded spreadsheet",
  "fiscal.table.source.robot": "monthly robot",
  "fiscal.table.stale":
    "Table incomplete or older than 90 days: check whether rates changed.",
  "fiscal.table.lastError": "The last automatic update failed: {reason}",
  "fiscal.table.kind": "Table",
  "fiscal.table.file": "Official spreadsheet (XLSX or CSV)",
  "fiscal.table.upload": "Upload spreadsheet",
  "fiscal.table.tecUrl": "Official TEC spreadsheet link",
  "fiscal.table.tipiUrl": "Official TIPI spreadsheet link",
  "fiscal.table.urlHint":
    "Copy the file link from the government website (Camex for the TEC, Receita Federal for the TIPI) and save the settings. The robot downloads on the 2nd of each month; if the site blocks it, Wellmix is told to upload the spreadsheet.",
  "fiscal.table.syncNow": "Update now from the links",
  "fiscal.table.uploaded":
    "{kind}: {count} NCMs loaded, {changed} rate(s) changed.",
  "fiscal.table.synced.ok": "Tax table updated from the official links.",
  "fiscal.table.synced.partial":
    "Incomplete update: see the reason in the tax table.",
  "settings.error.tax_invalid": "Invalid rate: use a number from 0 to 99.99.",
  "settings.error.fiscal_url_invalid":
    "Invalid link: use the full address starting with https://.",
  "settings.error.fiscal_unrecognized":
    "Spreadsheet not recognized: it needs the NCM and rate columns (official TEC or TIPI).",
  "settings.error.fiscal_file_required": "Choose the spreadsheet file.",
  "settings.error.fiscal_file_too_big": "File too large (max. 15 MB).",
  "settings.error.fiscal_file_type": "Upload the spreadsheet as XLSX or CSV.",
  "settings.error.fiscal_no_urls":
    "Enter and save the official links before updating from them.",
  "ncm.title": "Tax classification (NCM)",
  "ncm.hint":
    "The NCM sets the import duty (TEC) and IPI (TIPI) of the customer value. AI suggests; Wellmix confirms.",
  "ncm.status.confirmed": "NCM confirmed",
  "ncm.status.product": "From the product record",
  "ncm.status.none": "Needs confirmation",
  "ncm.source.ai": "AI suggestion",
  "ncm.source.table": "keywords × table",
  "ncm.source.manual": "typed",
  "ncm.source.product": "product record",
  "ncm.rates": "Duty {ii} · IPI {ipi}",
  "ncm.nt": "NT",
  "ncm.notInTable": "Not in the loaded tax table.",
  "ncm.noTable":
    "Tax table not loaded: upload the TEC and TIPI in Settings so rates fill in automatically.",
  "ncm.pending":
    "Without a confirmed NCM, import duty and IPI stay at 0% in the customer value.",
  "ncm.suggestions": "Suggestions",
  "ncm.suggestion.ai": "AI",
  "ncm.suggestion.table": "Keywords",
  "ncm.confirm": "Confirm",
  "ncm.manual": "Other NCM (8 digits)",
  "ncm.suggest": "Suggest with AI",
  "ncm.change": "Change NCM",
  "ncm.noSuggestions": "No suggestions yet.",
  "ncm.suggesting":
    "Looking for NCM suggestions for this product. Refresh the page in a few seconds.",
  "ncm.confirmedOk":
    "NCM confirmed: duty and IPI updated in the customer value.",
  "ncm.suggestedOk": "{count} NCM suggestion(s).",
  "ncm.ai.not_configured": "AI not configured",
  "ncm.aiUnavailable": "AI unavailable ({reason}); keyword suggestions only.",
  "pricing.error.ncm_invalid": "Invalid NCM: enter the 8 digits.",
  "pricing.error.ncm_not_in_table":
    "This NCM is not in the loaded tax table (TEC/TIPI). Check the code.",
  "pricing.error.request_closed": "Request cancelled.",
  "pricing.calc.insurance": "Insurance ({pct}%)",
  "pricing.calc.customsValue": "Customs value",
  "pricing.calc.pis": "PIS on imports ({pct}%)",
  "pricing.calc.cofins": "COFINS on imports ({pct}%)",
  "pricing.calc.icms": "ICMS ({pct}%)",
  "pricing.calc.missing.icms":
    "ICMS not configured (Settings): left out of the calculation.",
  "pricing.calc.taxSource.table": "TEC/TIPI · NCM {ncm}",
  "pricing.calc.taxSource.sheet": "sheet",
  "pricing.calc.taxSource.classification": "product record",
  "pricing.calc.ncmPending":
    "NCM not confirmed: duty and IPI at 0%. Confirm the NCM in the tax classification box.",
};

export const zh: Record<keyof typeof pt, string> = {
  "fiscal.settings.title": "进口税费",
  "fiscal.settings.hint":
    "计入客户价格的进口成本。进口税和 IPI 按 NCM 取自税率表；PIS、COFINS、ICMS 和保险在此设置。",
  "fiscal.settings.insurance": "国际保险（FOB 的 %）",
  "fiscal.settings.pis": "进口 PIS (%)",
  "fiscal.settings.cofins": "进口 COFINS (%)",
  "fiscal.settings.pisHint":
    "一般税率：2.1% 和 9.65%。部分产品有特定税率，请与报关行确认。",
  "fiscal.settings.icms": "进口 ICMS (%)",
  "fiscal.settings.icmsHint":
    "清关所在州的税率（例如 18%）。留空：ICMS 不计入，并显示提示。",
  "fiscal.table.title": "税率表（TEC 和 TIPI）",
  "fiscal.table.hint":
    "进口税取自 TEC，IPI 取自 TIPI，依据每个需求已确认的 NCM。上传官方表格（Excel 或 CSV），或填写官方链接供每月自动更新。",
  "fiscal.table.tec": "TEC（进口税）",
  "fiscal.table.tipi": "TIPI（IPI）",
  "fiscal.table.loaded": "{count} 个 NCM · 更新于 {date} · {source}",
  "fiscal.table.missing": "未加载",
  "fiscal.table.source.upload": "上传的表格",
  "fiscal.table.source.robot": "每月自动更新",
  "fiscal.table.stale": "税率表不完整或超过 90 天：请确认税率是否有变化。",
  "fiscal.table.lastError": "上次自动更新失败：{reason}",
  "fiscal.table.kind": "表格",
  "fiscal.table.file": "官方表格（XLSX 或 CSV）",
  "fiscal.table.upload": "上传表格",
  "fiscal.table.tecUrl": "TEC 官方表格链接",
  "fiscal.table.tipiUrl": "TIPI 官方表格链接",
  "fiscal.table.urlHint":
    "从政府网站复制文件链接（TEC 来自 Camex，TIPI 来自巴西联邦税务局）并保存设置。系统每月 2 日自动下载；如网站拦截，将通知 Wellmix 上传表格。",
  "fiscal.table.syncNow": "立即通过链接更新",
  "fiscal.table.uploaded":
    "{kind}：已加载 {count} 个 NCM，{changed} 个税率有变化。",
  "fiscal.table.synced.ok": "税率表已通过官方链接更新。",
  "fiscal.table.synced.partial": "更新不完整：请在税率表中查看原因。",
  "settings.error.tax_invalid": "税率无效：请输入 0 到 99.99 之间的数字。",
  "settings.error.fiscal_url_invalid":
    "链接无效：请使用以 https:// 开头的完整地址。",
  "settings.error.fiscal_unrecognized":
    "无法识别表格：需要包含 NCM 和税率列（官方 TEC 或 TIPI）。",
  "settings.error.fiscal_file_required": "请选择表格文件。",
  "settings.error.fiscal_file_too_big": "文件过大（最大 15 MB）。",
  "settings.error.fiscal_file_type": "请以 XLSX 或 CSV 格式上传表格。",
  "settings.error.fiscal_no_urls": "请先填写并保存官方链接，再通过链接更新。",
  "ncm.title": "税则分类（NCM）",
  "ncm.hint":
    "NCM 决定客户价格中的进口税（TEC）和 IPI（TIPI）。AI 提供建议，Wellmix 确认。",
  "ncm.status.confirmed": "NCM 已确认",
  "ncm.status.product": "来自产品档案",
  "ncm.status.none": "待确认",
  "ncm.source.ai": "AI 建议",
  "ncm.source.table": "关键词 × 税率表",
  "ncm.source.manual": "手动输入",
  "ncm.source.product": "产品档案",
  "ncm.rates": "进口税 {ii} · IPI {ipi}",
  "ncm.nt": "NT",
  "ncm.notInTable": "不在已加载的税率表中。",
  "ncm.noTable": "未加载税率表：请在设置中上传 TEC 和 TIPI，税率即可自动填入。",
  "ncm.pending": "未确认 NCM 时，客户价格中的进口税和 IPI 按 0% 计算。",
  "ncm.suggestions": "建议",
  "ncm.suggestion.ai": "AI",
  "ncm.suggestion.table": "关键词",
  "ncm.confirm": "确认",
  "ncm.manual": "其他 NCM（8 位）",
  "ncm.suggest": "用 AI 建议",
  "ncm.change": "更改 NCM",
  "ncm.noSuggestions": "暂无建议。",
  "ncm.suggesting": "正在为该产品查找 NCM 建议。请几秒后刷新页面。",
  "ncm.confirmedOk": "NCM 已确认：客户价格中的进口税和 IPI 已更新。",
  "ncm.suggestedOk": "{count} 条 NCM 建议。",
  "ncm.ai.not_configured": "未配置 AI",
  "ncm.aiUnavailable": "AI 不可用（{reason}）；仅提供关键词建议。",
  "pricing.error.ncm_invalid": "NCM 无效：请输入 8 位数字。",
  "pricing.error.ncm_not_in_table":
    "该 NCM 不在已加载的税率表（TEC/TIPI）中。请核对代码。",
  "pricing.error.request_closed": "需求已取消。",
  "pricing.calc.insurance": "保险（{pct}%）",
  "pricing.calc.customsValue": "完税价格",
  "pricing.calc.pis": "进口 PIS（{pct}%）",
  "pricing.calc.cofins": "进口 COFINS（{pct}%）",
  "pricing.calc.icms": "ICMS（{pct}%）",
  "pricing.calc.missing.icms": "未配置 ICMS（设置）：未计入。",
  "pricing.calc.taxSource.table": "TEC/TIPI · NCM {ncm}",
  "pricing.calc.taxSource.sheet": "表格",
  "pricing.calc.taxSource.classification": "产品档案",
  "pricing.calc.ncmPending":
    "NCM 未确认：进口税和 IPI 按 0%。请在税则分类中确认 NCM。",
};
