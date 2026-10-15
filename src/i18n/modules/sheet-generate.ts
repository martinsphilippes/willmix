/**
 * Dicionário do módulo "sheet-generate" (atalho "Gerar programação" na ficha
 * de compra: total de caixas, nº de programações e intervalo preenchem as
 * linhas): mesmas chaves em pt, en e zh.
 */
export const pt = {
  "sheet.gen.toggle": "Gerar programação",
  "sheet.gen.hint":
    "Divide as caixas igualmente entre as programações. Depois dá para ajustar qualquer linha.",
  "sheet.gen.total": "Total de caixas master",
  "sheet.gen.count": "Programações",
  "sheet.gen.interval": "Intervalo entre programações",
  "sheet.gen.days": "{n} dias",
  "sheet.gen.custom": "outro",
  "sheet.gen.first": "1ª saída (dias após o início da produção)",
  "sheet.gen.equals": "= {pieces} peças · {cbm} m³",
  "sheet.gen.replace": "Substitui as programações já preenchidas.",
  "sheet.gen.submit": "Gerar",
  "sheet.gen.cancel": "Cancelar",
  "sheet.gen.done":
    "Programação gerada: {total} caixas em {count} programações, a 1ª em {first} dias e as seguintes a cada {days} dias.",
  "sheet.gen.doneOne":
    "Programação gerada: {total} caixas numa programação só, com saída em {first} dias.",
  "sheet.gen.undo": "Desfazer",
  "sheet.gen.error.total":
    "Informe o total de caixas em número inteiro (pelo menos 1 por programação).",
  "sheet.gen.error.interval": "Informe o intervalo em dias (de 1 a 365).",
  "sheet.gen.error.first": "Informe a 1ª saída em dias (de 1 a 365).",
};

export const en: Record<keyof typeof pt, string> = {
  "sheet.gen.toggle": "Generate schedule",
  "sheet.gen.hint":
    "Splits the cartons evenly across the shipments. You can adjust any row afterwards.",
  "sheet.gen.total": "Total master cartons",
  "sheet.gen.count": "Shipments",
  "sheet.gen.interval": "Interval between shipments",
  "sheet.gen.days": "{n} days",
  "sheet.gen.custom": "other",
  "sheet.gen.first": "1st departure (days after production start)",
  "sheet.gen.equals": "= {pieces} pieces · {cbm} m³",
  "sheet.gen.replace": "Replaces the shipments already filled in.",
  "sheet.gen.submit": "Generate",
  "sheet.gen.cancel": "Cancel",
  "sheet.gen.done":
    "Schedule generated: {total} cartons in {count} shipments, the 1st in {first} days and the next ones every {days} days.",
  "sheet.gen.doneOne":
    "Schedule generated: {total} cartons in a single shipment, departing in {first} days.",
  "sheet.gen.undo": "Undo",
  "sheet.gen.error.total":
    "Enter the total cartons as a whole number (at least 1 per shipment).",
  "sheet.gen.error.interval": "Enter the interval in days (1 to 365).",
  "sheet.gen.error.first": "Enter the 1st departure in days (1 to 365).",
};

export const zh: Record<keyof typeof pt, string> = {
  "sheet.gen.toggle": "生成排期",
  "sheet.gen.hint": "将外箱数平均分配到各批次，之后可以调整任意一行。",
  "sheet.gen.total": "外箱总数",
  "sheet.gen.count": "批次数",
  "sheet.gen.interval": "批次间隔",
  "sheet.gen.days": "{n} 天",
  "sheet.gen.custom": "其他",
  "sheet.gen.first": "第 1 批出货（开始生产后天数）",
  "sheet.gen.equals": "= {pieces} 件 · {cbm} m³",
  "sheet.gen.replace": "将替换已填写的批次。",
  "sheet.gen.submit": "生成",
  "sheet.gen.cancel": "取消",
  "sheet.gen.done":
    "已生成排期：{total} 箱分 {count} 批，第 1 批 {first} 天后出货，之后每 {days} 天一批。",
  "sheet.gen.doneOne": "已生成排期：{total} 箱一批出货，{first} 天后出货。",
  "sheet.gen.undo": "撤销",
  "sheet.gen.error.total": "请输入外箱总数（整数，每批至少 1 箱）。",
  "sheet.gen.error.interval": "请输入间隔天数（1 至 365）。",
  "sheet.gen.error.first": "请输入第 1 批出货天数（1 至 365）。",
};
