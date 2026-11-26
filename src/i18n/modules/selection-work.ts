/**
 * Dicionário do módulo "selection-work": ajustes da Seleção de itens e do
 * book (dono, 26/11/2026; docs/SUPPLIER_REQUESTS.md, "Trabalho na Seleção"):
 * só os itens não trabalhados dos books fechados, o filtro do nº do book, o
 * rascunho e a trava da seleção em andamento e a Família do produto na capa
 * do book. Mesmas chaves em pt, en e zh.
 */
export const pt = {
  "supplierRequests.selection.filter.book": "Book nº",
  "supplierRequests.selection.filter.bookOption":
    "nº {n} · {supplier} · {pending} a trabalhar",
  "supplierRequests.selection.filter.pendingOnly":
    "Só os itens ainda não trabalhados dos books fechados.",
  "selectionDraft.banner":
    'Seleção em andamento ({n} itens): conclua com "Gravar escolha" ou cancele antes de começar outra.',
  "selectionDraft.blocked":
    "Você já tem uma seleção em andamento ({n} itens). Conclua ou cancele aquela antes de abrir outra.",
  "selectionDraft.continue": "Continuar a seleção em andamento",
  "selectionDraft.cancel": "Cancelar a seleção em andamento",
  "selectionDraft.cancelThis": "Cancelar esta seleção",
  "selectionDraft.cancelHint":
    "Descarta o rascunho (nada é gravado) e libera para começar outra seleção.",
  "selectionDraft.saved": "Rascunho salvo às {time}",
  "selectionDraft.restored":
    "Rascunho restaurado: a seleção voltou como você deixou.",
  "selectionDraft.cancelled": "Seleção cancelada: o rascunho foi descartado.",
  "supplierRequests.error.selection_draft_other":
    "Você tem outra seleção em andamento: conclua ou cancele aquela antes.",
  "bookFamily.label": "Família do produto",
  "bookFamily.hint":
    "Grupo de produto (família) dos itens do book. Obrigatória para fechar; na cotação, sugere os fornecedores da família.",
  "bookFamily.choose": "Escolha a família",
  "bookFamily.save": "Gravar família",
  "bookFamily.option": "{name} · código {code}",
  "bookFamily.pending": "a Família do produto (na capa do book)",
  "bookFamily.saved": "Família do produto gravada.",
  "bookingLots.error.booking_family_required":
    "Escolha a Família do produto na capa do book antes de fechar.",
  "bookingLots.error.family_unknown":
    "Família não encontrada no cadastro de famílias.",
};

export const en: Record<keyof typeof pt, string> = {
  "supplierRequests.selection.filter.book": "Book no.",
  "supplierRequests.selection.filter.bookOption":
    "no. {n} · {supplier} · {pending} to work",
  "supplierRequests.selection.filter.pendingOnly":
    "Only the items not yet worked from closed books.",
  "selectionDraft.banner":
    'Selection in progress ({n} items): finish with "Save choice" or cancel before starting another.',
  "selectionDraft.blocked":
    "You already have a selection in progress ({n} items). Finish or cancel it before opening another.",
  "selectionDraft.continue": "Continue the selection in progress",
  "selectionDraft.cancel": "Cancel the selection in progress",
  "selectionDraft.cancelThis": "Cancel this selection",
  "selectionDraft.cancelHint":
    "Discards the draft (nothing is saved) and lets you start another selection.",
  "selectionDraft.saved": "Draft saved at {time}",
  "selectionDraft.restored":
    "Draft restored: the selection is back as you left it.",
  "selectionDraft.cancelled": "Selection cancelled: the draft was discarded.",
  "supplierRequests.error.selection_draft_other":
    "You have another selection in progress: finish or cancel it first.",
  "bookFamily.label": "Product family",
  "bookFamily.hint":
    "Product group (family) of the book items. Required to close; in the quotation, it suggests the family's suppliers.",
  "bookFamily.choose": "Choose the family",
  "bookFamily.save": "Save family",
  "bookFamily.option": "{name} · code {code}",
  "bookFamily.pending": "the Product family (on the book cover)",
  "bookFamily.saved": "Product family saved.",
  "bookingLots.error.booking_family_required":
    "Choose the Product family on the book cover before closing.",
  "bookingLots.error.family_unknown":
    "Family not found in the families registry.",
};

export const zh: Record<keyof typeof pt, string> = {
  "supplierRequests.selection.filter.book": "Book 编号",
  "supplierRequests.selection.filter.bookOption":
    "第 {n} 号 · {supplier} · 待处理 {pending}",
  "supplierRequests.selection.filter.pendingOnly":
    "只显示已关闭 Book 中尚未处理的产品。",
  "selectionDraft.banner":
    "选择进行中（{n} 个产品）：请用“保存选择”完成，或取消后再开始新的选择。",
  "selectionDraft.blocked":
    "您已有一个进行中的选择（{n} 个产品）。请先完成或取消它，再打开新的选择。",
  "selectionDraft.continue": "继续进行中的选择",
  "selectionDraft.cancel": "取消进行中的选择",
  "selectionDraft.cancelThis": "取消此选择",
  "selectionDraft.cancelHint": "放弃草稿（不保存任何内容），以便开始新的选择。",
  "selectionDraft.saved": "草稿已于 {time} 保存",
  "selectionDraft.restored": "草稿已恢复：选择已回到您离开时的状态。",
  "selectionDraft.cancelled": "选择已取消：草稿已放弃。",
  "supplierRequests.error.selection_draft_other":
    "您有另一个进行中的选择：请先完成或取消它。",
  "bookFamily.label": "产品系列",
  "bookFamily.hint":
    "Book 中产品的产品组（系列）。关闭前必须填写；询价时会推荐该系列的供应商。",
  "bookFamily.choose": "选择系列",
  "bookFamily.save": "保存系列",
  "bookFamily.option": "{name} · 代码 {code}",
  "bookFamily.pending": "产品系列（在 Book 封面）",
  "bookFamily.saved": "产品系列已保存。",
  "bookingLots.error.booking_family_required":
    "关闭前请在 Book 封面选择产品系列。",
  "bookingLots.error.family_unknown": "系列登记中找不到该系列。",
};
