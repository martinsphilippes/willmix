/**
 * Dicionário do módulo "sheet-fill" (programação da ficha ao vivo e sugestão
 * para fechar o container): mesmas chaves em pt, en e zh.
 */
export const pt = {
  "sheet.fill.live":
    "Peças, CBM, datas e containers atualizam enquanto você digita.",
  "sheet.fill.title": "Fechar o container",
  "sheet.fill.partial":
    "{containers} containers de {capacity} m³: o último fica {pct}% ocupado.",
  "sheet.fill.add":
    "Faltam {cartons} caixas ({pieces} peças, {cbm} m³) para fechar {n} container(s).",
  "sheet.fill.addNoPieces":
    "Faltam {cartons} caixas ({cbm} m³) para fechar {n} container(s).",
  "sheet.fill.apply":
    "Completar para {n}: +{cartons} caixas na programação {lot}",
  "sheet.fill.remove":
    "Ou tirar {cartons} caixas ({pieces} peças) para fechar em {n}.",
  "sheet.fill.removeNoPieces": "Ou tirar {cartons} caixas para fechar em {n}.",
  "sheet.fill.applyRemove": "Reduzir para {n}: −{cartons} caixas",
  "sheet.fill.exact": "{n} container(s) fechado(s). Nada a ajustar.",
  "sheet.fill.full":
    "Não cabe mais nenhuma caixa inteira sem abrir outro container.",
  "sheet.fill.need":
    "Para a sugestão, informe o CBM da caixa master e as caixas de cada programação (com peças por caixa, mostra também as peças).",
  "sheet.fill.applied": "Programação {lot} ajustada para {cartons} caixas.",
};

export const en: Record<keyof typeof pt, string> = {
  "sheet.fill.live": "Pieces, CBM, dates and containers update as you type.",
  "sheet.fill.title": "Fill the container",
  "sheet.fill.partial":
    "{containers} containers of {capacity} m³: the last one is {pct}% full.",
  "sheet.fill.add":
    "{cartons} more cartons ({pieces} pieces, {cbm} m³) fill {n} container(s).",
  "sheet.fill.addNoPieces":
    "{cartons} more cartons ({cbm} m³) fill {n} container(s).",
  "sheet.fill.apply": "Fill up to {n}: +{cartons} cartons in shipment {lot}",
  "sheet.fill.remove":
    "Or remove {cartons} cartons ({pieces} pieces) to close at {n}.",
  "sheet.fill.removeNoPieces": "Or remove {cartons} cartons to close at {n}.",
  "sheet.fill.applyRemove": "Reduce to {n}: −{cartons} cartons",
  "sheet.fill.exact": "{n} container(s) exactly filled. Nothing to adjust.",
  "sheet.fill.full": "No whole carton fits without opening another container.",
  "sheet.fill.need":
    "For the suggestion, enter the master carton CBM and the cartons of each shipment (pieces per carton also shows the pieces).",
  "sheet.fill.applied": "Shipment {lot} set to {cartons} cartons.",
};

export const zh: Record<keyof typeof pt, string> = {
  "sheet.fill.live": "件数、体积、日期和集装箱数会随输入实时更新。",
  "sheet.fill.title": "装满集装箱",
  "sheet.fill.partial":
    "{containers} 个 {capacity} 立方米集装箱：最后一个装了 {pct}%。",
  "sheet.fill.add":
    "再加 {cartons} 箱（{pieces} 件，{cbm} 立方米）即可装满 {n} 个集装箱。",
  "sheet.fill.addNoPieces":
    "再加 {cartons} 箱（{cbm} 立方米）即可装满 {n} 个集装箱。",
  "sheet.fill.apply": "补齐到 {n} 个：第 {lot} 批 +{cartons} 箱",
  "sheet.fill.remove": "或减少 {cartons} 箱（{pieces} 件）以凑整 {n} 个。",
  "sheet.fill.removeNoPieces": "或减少 {cartons} 箱以凑整 {n} 个。",
  "sheet.fill.applyRemove": "减少到 {n} 个：−{cartons} 箱",
  "sheet.fill.exact": "正好装满 {n} 个集装箱，无需调整。",
  "sheet.fill.full": "不开新集装箱就放不下任何整箱了。",
  "sheet.fill.need":
    "如需建议，请填写外箱体积和各批次箱数（填写每箱件数后同时显示件数）。",
  "sheet.fill.applied": "第 {lot} 批已调整为 {cartons} 箱。",
};
