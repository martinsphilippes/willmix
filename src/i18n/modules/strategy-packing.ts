/*
 * Embalagem e cubagem na Estratégia de compra (dono, 18/11/2026;
 * docs/PURCHASE_DEMAND.md, "Embalagem e cubagem na Estratégia"): quantidade
 * em peças, caixas master, caixas inner e cubagem total ao lado da
 * quantidade, o formulário do pedido direto e a estratégia bloqueada por
 * encomenda cancelada ou já em outro pedido.
 */
export const pt = {
  "strategyPack.pieces": "Quantidade (peças)",
  "strategyPack.master": "Caixas master (total)",
  "strategyPack.inner": "Caixas inner (total)",
  "strategyPack.cbm": "Cubagem total (m³)",
  "strategyPack.perMaster": "{n} peças por master",
  "strategyPack.perMasterMissing": "Peças por master: não informado",
  "strategyPack.perInner": "Peças por inner: {n}",
  "strategyPack.perInnerMissing": "Peças por inner: não informado",
  "strategyPack.noInner": "Sem caixa inner",
  "strategyPack.cbmPerMaster": "{cbm} m³ por master",
  "strategyPack.cbmPerMasterMissing": "CBM da master: não informado",
  "strategyPack.calculated": "calculado",
  "strategyPack.legend":
    "Em branco, o que você edita; em cinza, os totais calculados pela embalagem do produto (mudam com a quantidade).",
  "strategyPack.note.masterExact": "{pieces} ÷ {per} = {boxes} caixas master",
  "strategyPack.note.masterUp":
    "{pieces} ÷ {per} = {exact} → {boxes} caixas master (para cima)",
  "strategyPack.note.masterRounds":
    "{list} caixas master, uma conta por programação",
  "strategyPack.note.cbm": "{boxes} × {cbm} m³ = {total} m³",
  "strategyPack.warn.masterIncomplete":
    "A última caixa master fica com {rest} de {per} peças.",
  "strategyPack.warn.masterIncompleteRounds":
    "{n} programação(ões) termina(m) com caixa master incompleta ({list} peças na última).",
  "strategyPack.warn.innerIncomplete":
    "A última caixa inner fica com {rest} de {per} peças.",
  "strategyPack.warn.innerMismatch":
    "A inner ({inner}) não fecha a master ({master}): confira a embalagem.",
  "strategyPack.warn.innerBigger":
    "A inner ({inner}) tem mais peças que a master ({master}): confira a embalagem.",
  "strategyPack.warn.innerSame":
    "A inner tem as mesmas peças da master: na prática, sem caixa inner.",
  "strategyPack.warn.cbmOtherBox":
    "O CBM informado é de uma caixa de {box} peças e a conta usa caixas de {per}: confira a embalagem.",
  "strategyPack.warn.scheduleMismatch":
    "A soma da programação não bate com a quantidade: as caixas saem pelo total.",
  "strategyPack.warn.boxUnitNoMaster":
    "Encomenda em caixas sem peças por master: não dá para converter em peças.",
  "strategyPack.warn.mixedBasis":
    "As encomendas deste produto têm embalagens diferentes: confira a ficha de cada uma.",
  "strategyPack.warn.qtyInvalid": "Informe a quantidade em peças.",
  "strategyPack.leadTime": "Prazo de produção (dias)",
  "strategyPack.closed.cancelled": "Cancelada",
  "strategyPack.closed.ordered": "Já em outro pedido",
  "strategyPack.closed.missing": "Não encontrada",
  "strategyPack.closed.title": "Estratégia parada",
  "strategyPack.closed.body":
    "{list}: esta estratégia não gera o pedido de compra nem pode ser aprovada. Para tirá-la de Em andamento, use “Encerrar estratégia”.",
  "strategyPack.closed.bodyPending":
    "{list}: esta estratégia não pode ser aprovada nem gerar o pedido de compra. Para tirá-la de Em andamento, recuse com o motivo.",
  "strategyPack.closed.item": "Encomenda nº {n} ({reason})",
  "strategy.error.strategy_demand_closed":
    "Alguma encomenda desta estratégia foi cancelada ou já está em outro pedido: a estratégia não é aprovada nem gera o pedido.",
  "strategy.error.strategy_packing_changed":
    "A embalagem de algum produto mudou desde que a tela abriu. Confira os totais e gere o pedido de novo.",
  "strategy.status.closed": "Encerrada",
  "strategyClose.button": "Encerrar estratégia",
  "strategyClose.hint":
    "Tira a estratégia de Em andamento sem gerar pedido. As encomendas desta solicitação que continuam abertas voltam para a fila, para uma nova escolha; a cancelada segue cancelada.",
  "strategyClose.note": "Observação (opcional)",
  "strategyClose.confirm":
    "Encerrar a estratégia nº {n}? Ela sai de Em andamento sem gerar pedido.",
  "strategyClose.done": "Estratégia nº {n} encerrada.",
  "strategyClose.doneReopened":
    "Estratégia nº {n} encerrada; {count} encomenda(s) voltaram para a fila.",
  "strategy.error.strategy_not_stopped":
    "Só dá para encerrar a estratégia aprovada que parou (encomenda cancelada ou já em outro pedido).",
} as const;

export const en: Record<keyof typeof pt, string> = {
  "strategyPack.pieces": "Quantity (pieces)",
  "strategyPack.master": "Master cartons (total)",
  "strategyPack.inner": "Inner boxes (total)",
  "strategyPack.cbm": "Total volume (m³)",
  "strategyPack.perMaster": "{n} pieces per master",
  "strategyPack.perMasterMissing": "Pieces per master: not provided",
  "strategyPack.perInner": "Pieces per inner: {n}",
  "strategyPack.perInnerMissing": "Pieces per inner: not provided",
  "strategyPack.noInner": "No inner box",
  "strategyPack.cbmPerMaster": "{cbm} m³ per master",
  "strategyPack.cbmPerMasterMissing": "Master CBM: not provided",
  "strategyPack.calculated": "calculated",
  "strategyPack.legend":
    "White fields are the ones you edit; grey totals are calculated from the product packaging (they change with the quantity).",
  "strategyPack.note.masterExact": "{pieces} ÷ {per} = {boxes} master cartons",
  "strategyPack.note.masterUp":
    "{pieces} ÷ {per} = {exact} → {boxes} master cartons (rounded up)",
  "strategyPack.note.masterRounds":
    "{list} master cartons, one count per delivery",
  "strategyPack.note.cbm": "{boxes} × {cbm} m³ = {total} m³",
  "strategyPack.warn.masterIncomplete":
    "The last master carton holds {rest} of {per} pieces.",
  "strategyPack.warn.masterIncompleteRounds":
    "{n} delivery(ies) end with a partial master carton ({list} pieces in the last one).",
  "strategyPack.warn.innerIncomplete":
    "The last inner box holds {rest} of {per} pieces.",
  "strategyPack.warn.innerMismatch":
    "The inner ({inner}) does not fill the master ({master}): check the packaging.",
  "strategyPack.warn.innerBigger":
    "The inner ({inner}) holds more pieces than the master ({master}): check the packaging.",
  "strategyPack.warn.innerSame":
    "The inner holds as many pieces as the master: in practice, no inner box.",
  "strategyPack.warn.cbmOtherBox":
    "The CBM provided is for a carton of {box} pieces and the count uses cartons of {per}: check the packaging.",
  "strategyPack.warn.scheduleMismatch":
    "The delivery schedule does not add up to the quantity: cartons are counted from the total.",
  "strategyPack.warn.boxUnitNoMaster":
    "Order placed in cartons without pieces per master: it cannot be converted to pieces.",
  "strategyPack.warn.mixedBasis":
    "The orders for this product have different packaging: check each one's sheet.",
  "strategyPack.warn.qtyInvalid": "Enter the quantity in pieces.",
  "strategyPack.leadTime": "Production lead time (days)",
  "strategyPack.closed.cancelled": "Cancelled",
  "strategyPack.closed.ordered": "Already in another order",
  "strategyPack.closed.missing": "Not found",
  "strategyPack.closed.title": "Strategy on hold",
  "strategyPack.closed.body":
    "{list}: this strategy does not generate the purchase order and cannot be approved. To take it out of In progress, use “Close strategy”.",
  "strategyPack.closed.bodyPending":
    "{list}: this strategy cannot be approved or generate the purchase order. To take it out of In progress, reject it with the reason.",
  "strategyPack.closed.item": "Customer order no. {n} ({reason})",
  "strategy.error.strategy_demand_closed":
    "An order in this strategy was cancelled or is already in another order: the strategy is not approved and does not generate the order.",
  "strategy.error.strategy_packing_changed":
    "A product's packaging changed since the screen was opened. Check the totals and generate the order again.",
  "strategy.status.closed": "Closed",
  "strategyClose.button": "Close strategy",
  "strategyClose.hint":
    "Takes the strategy out of In progress without generating an order. This request's orders that are still open go back to the queue for a new choice; the cancelled one stays cancelled.",
  "strategyClose.note": "Note (optional)",
  "strategyClose.confirm":
    "Close strategy no. {n}? It leaves In progress without generating an order.",
  "strategyClose.done": "Strategy no. {n} closed.",
  "strategyClose.doneReopened":
    "Strategy no. {n} closed; {count} order(s) went back to the queue.",
  "strategy.error.strategy_not_stopped":
    "Only an approved strategy that stopped (order cancelled or already in another order) can be closed.",
};

export const zh: Record<keyof typeof pt, string> = {
  "strategyPack.pieces": "数量（件）",
  "strategyPack.master": "外箱（合计）",
  "strategyPack.inner": "内盒（合计）",
  "strategyPack.cbm": "总体积（m³）",
  "strategyPack.perMaster": "每外箱 {n} 件",
  "strategyPack.perMasterMissing": "每外箱件数：未填写",
  "strategyPack.perInner": "每内盒件数：{n}",
  "strategyPack.perInnerMissing": "每内盒件数：未填写",
  "strategyPack.noInner": "无内盒",
  "strategyPack.cbmPerMaster": "每外箱 {cbm} m³",
  "strategyPack.cbmPerMasterMissing": "外箱体积：未填写",
  "strategyPack.calculated": "计算值",
  "strategyPack.legend":
    "白色为可编辑字段；灰色为按产品包装计算的合计（随数量变化）。",
  "strategyPack.note.masterExact": "{pieces} ÷ {per} = {boxes} 个外箱",
  "strategyPack.note.masterUp":
    "{pieces} ÷ {per} = {exact} → {boxes} 个外箱（向上取整）",
  "strategyPack.note.masterRounds": "{list} 个外箱，按每批交货分别计算",
  "strategyPack.note.cbm": "{boxes} × {cbm} m³ = {total} m³",
  "strategyPack.warn.masterIncomplete": "最后一个外箱装 {rest}/{per} 件。",
  "strategyPack.warn.masterIncompleteRounds":
    "{n} 批交货的最后一个外箱未装满（最后一箱 {list} 件）。",
  "strategyPack.warn.innerIncomplete": "最后一个内盒装 {rest}/{per} 件。",
  "strategyPack.warn.innerMismatch":
    "内盒（{inner}）不能装满外箱（{master}）：请核对包装。",
  "strategyPack.warn.innerBigger":
    "内盒（{inner}）件数多于外箱（{master}）：请核对包装。",
  "strategyPack.warn.innerSame": "内盒件数与外箱相同：实际上没有内盒。",
  "strategyPack.warn.cbmOtherBox":
    "填写的体积对应每箱 {box} 件的外箱，而计算使用每箱 {per} 件：请核对包装。",
  "strategyPack.warn.scheduleMismatch":
    "交货计划合计与数量不符：外箱按总数计算。",
  "strategyPack.warn.boxUnitNoMaster":
    "订单以箱为单位但没有每外箱件数：无法换算为件。",
  "strategyPack.warn.mixedBasis": "该产品的订单包装不同：请分别核对每张资料。",
  "strategyPack.warn.qtyInvalid": "请填写件数。",
  "strategyPack.leadTime": "生产周期（天）",
  "strategyPack.closed.cancelled": "已取消",
  "strategyPack.closed.ordered": "已在其他订单中",
  "strategyPack.closed.missing": "未找到",
  "strategyPack.closed.title": "策略已暂停",
  "strategyPack.closed.body":
    "{list}：此策略不生成采购订单，也不能审批。如需移出“进行中”，请使用“关闭策略”。",
  "strategyPack.closed.bodyPending":
    "{list}：此策略不能审批，也不能生成采购订单。如需移出“进行中”，请填写原因后拒绝。",
  "strategyPack.closed.item": "客户订单 {n} 号（{reason}）",
  "strategy.error.strategy_demand_closed":
    "此策略中有客户订单已取消或已在其他订单中：策略不能审批，也不生成订单。",
  "strategy.error.strategy_packing_changed":
    "打开页面后某产品的包装已变更。请核对合计后重新生成订单。",
  "strategy.status.closed": "已关闭",
  "strategyClose.button": "关闭策略",
  "strategyClose.hint":
    "将策略移出“进行中”，不生成订单。该申请中仍未关闭的客户订单回到队列，重新选择；已取消的保持取消。",
  "strategyClose.note": "备注（可选）",
  "strategyClose.confirm": "关闭第 {n} 号策略？它将移出“进行中”，不生成订单。",
  "strategyClose.done": "第 {n} 号策略已关闭。",
  "strategyClose.doneReopened":
    "第 {n} 号策略已关闭；{count} 个客户订单回到队列。",
  "strategy.error.strategy_not_stopped":
    "只有已审批但已暂停的策略（客户订单已取消或已在其他订单中）才能关闭。",
};
