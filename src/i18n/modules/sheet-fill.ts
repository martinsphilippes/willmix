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
  "sheet.fill.exactNow": "{n} container(s) fechado(s).",
  "sheet.fill.up":
    "Para cima: +{cartons} caixas ({pieces} peças, {cbm} m³) fecham {n} container(s).",
  "sheet.fill.upNoPieces":
    "Para cima: +{cartons} caixas ({cbm} m³) fecham {n} container(s).",
  "sheet.fill.applyUp": "Aumentar para {n}: +{cartons} caixas",
  "sheet.fill.down":
    "Para baixo: −{cartons} caixas ({pieces} peças) fecham {n} container(s).",
  "sheet.fill.downNoPieces":
    "Para baixo: −{cartons} caixas fecham {n} container(s).",
  "sheet.fill.applyDown": "Reduzir para {n}: −{cartons} caixas",
  "sheet.fill.appliedTotal":
    "Programações ajustadas: {cartons} caixas no total ({pieces} peças).",
  "sheet.fill.cbmHigh":
    "Confira o CBM da caixa master: {cbm} m³ por caixa é muito (um container inteiro tem {capacity} m³). Uma caixa costuma ter de 0,02 a 0,3 m³; ex.: 0,050.",
  "sheet.fill.cbmMismatch":
    "Confira o CBM da caixa master: {cbm} m³ não bate com a medida da caixa ({size} m³).",
  "sheet.qty.title": "Quantidade do pedido",
  "sheet.qty.same": "{to} {unit}, igual às caixas da programação.",
  "sheet.qty.order":
    "{from} → {to} {unit} ({diff}) ao salvar. O preço por unidade fica; FOB e valor ao cliente acompanham, e o cliente é avisado.",
  "sheet.qty.quote":
    "esta cotação vale para {to} {unit} ({diff} em relação aos {from} pedidos). A proposta ao cliente usa essa quantidade.",
  "sheet.qty.readonly":
    "{from} {unit}. A programação soma {to} {unit} ({diff}); a Wellmix confirma a mudança ao salvar.",
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
  "sheet.fill.exactNow": "{n} container(s) exactly filled.",
  "sheet.fill.up":
    "Up: +{cartons} cartons ({pieces} pieces, {cbm} m³) fill {n} container(s).",
  "sheet.fill.upNoPieces":
    "Up: +{cartons} cartons ({cbm} m³) fill {n} container(s).",
  "sheet.fill.applyUp": "Increase to {n}: +{cartons} cartons",
  "sheet.fill.down":
    "Down: −{cartons} cartons ({pieces} pieces) close at {n} container(s).",
  "sheet.fill.downNoPieces":
    "Down: −{cartons} cartons close at {n} container(s).",
  "sheet.fill.applyDown": "Reduce to {n}: −{cartons} cartons",
  "sheet.fill.appliedTotal":
    "Shipments adjusted: {cartons} cartons in total ({pieces} pieces).",
  "sheet.fill.cbmHigh":
    "Check the master carton CBM: {cbm} m³ per carton is too much (a whole container holds {capacity} m³). A carton is usually 0.02 to 0.3 m³; e.g. 0.050.",
  "sheet.fill.cbmMismatch":
    "Check the master carton CBM: {cbm} m³ does not match the carton size ({size} m³).",
  "sheet.qty.title": "Order quantity",
  "sheet.qty.same": "{to} {unit}, same as the scheduled cartons.",
  "sheet.qty.order":
    "{from} → {to} {unit} ({diff}) on save. The unit price stays; FOB and customer value follow, and the customer is notified.",
  "sheet.qty.quote":
    "this quote is for {to} {unit} ({diff} versus the {from} requested). The customer proposal uses this quantity.",
  "sheet.qty.readonly":
    "{from} {unit}. The schedule adds up to {to} {unit} ({diff}); Wellmix confirms the change on save.",
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
  "sheet.fill.exactNow": "正好装满 {n} 个集装箱。",
  "sheet.fill.up":
    "增加：+{cartons} 箱（{pieces} 件，{cbm} 立方米）可装满 {n} 个集装箱。",
  "sheet.fill.upNoPieces":
    "增加：+{cartons} 箱（{cbm} 立方米）可装满 {n} 个集装箱。",
  "sheet.fill.applyUp": "增加到 {n} 个：+{cartons} 箱",
  "sheet.fill.down": "减少：−{cartons} 箱（{pieces} 件）可凑整 {n} 个集装箱。",
  "sheet.fill.downNoPieces": "减少：−{cartons} 箱可凑整 {n} 个集装箱。",
  "sheet.fill.applyDown": "减少到 {n} 个：−{cartons} 箱",
  "sheet.fill.appliedTotal": "各批次已调整：共 {cartons} 箱（{pieces} 件）。",
  "sheet.fill.cbmHigh":
    "请核对外箱体积：每箱 {cbm} 立方米过大（整个集装箱才 {capacity} 立方米）。外箱通常为 0.02–0.3 立方米，例如 0.050。",
  "sheet.fill.cbmMismatch":
    "请核对外箱体积：{cbm} 立方米与外箱尺寸（{size} 立方米）不符。",
  "sheet.qty.title": "订单数量",
  "sheet.qty.same": "{to} {unit}，与排期箱数一致。",
  "sheet.qty.order":
    "保存后 {from} → {to} {unit}（{diff}）。单价不变，FOB 和客户金额随之调整，并通知客户。",
  "sheet.qty.quote":
    "本报价数量为 {to} {unit}（与客户需求 {from} 相差 {diff}）。给客户的报价按此数量计算。",
  "sheet.qty.readonly":
    "{from} {unit}。排期合计 {to} {unit}（{diff}），由 Wellmix 保存时确认。",
};
