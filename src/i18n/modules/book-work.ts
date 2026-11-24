/**
 * Dinâmica dos books (dono, 23/11/2026; docs/BOOKING.md): Loja/Fábrica e
 * Tipo de item na importação, várias planilhas num book, itens trabalhados
 * na Seleção de itens, seleção direto do book e a trava (com quem está cada
 * book, há quanto tempo e o prazo).
 */
export const pt = {
  "bookWork.meta.save": "Salvar",
  "bookWork.storeNumber": "Nº da loja",
  "bookWork.supplierName": "Nome do supplier",
  "bookWork.itemType": "Tipo de item",
  "bookWork.itemTypeHint":
    "Ex.: vidro, plástico, utilidades. Use o mesmo nome dos outros books do mesmo tipo.",
  "bookWork.import.multiHint":
    "Pode escolher várias planilhas de uma vez (até 10): elas formam um book só, uma depois da outra.",
  "bookWork.import.files": "Planilhas escolhidas: {n}",
  "bookWork.sheetItems": "({n} itens)",
  "bookWork.col.worked": "Seleção",
  "bookWork.col.workedPct": "Trabalhados",
  "bookWork.worked.title": "Itens trabalhados",
  "bookWork.worked.yes": "Trabalhado",
  "bookWork.worked.no": "A trabalhar",
  "bookWork.worked.share": "Trabalhados: {worked} de {total} ({pct}%)",
  "bookWork.worked.count": "{worked} de {total}",
  "bookWork.bulk.allRows": "Sem marcadas: todas as linhas",
  "bookWork.toSelection": "Selecionar os marcados",
  "bookWork.toSelection.none": "Marque um ou mais itens na tabela.",
  "bookWork.toSelection.max": "Até {n} itens por vez.",
  "bookWork.toSelection.hint":
    "Marque um ou vários itens e leve direto para a Seleção de itens.",
  "bookWork.lock": "Travar para mim",
  "bookWork.unlock": "Liberar",
  "bookWork.unlock.type": "Liberar os books deste tipo",
  "bookWork.lock.title": "Com quem está",
  "bookWork.lock.free": "Livre",
  "bookWork.lock.body":
    "Trave o book para trabalhar nele: os outros analistas deixam de vê-lo e a sua lista passa a mostrar só o que está com você. Prazo: {h} h por book.",
  "bookWork.lock.heldBy": "Com {name} há {time}.",
  "bookWork.lock.byType": "Travado pelo tipo de item: {type}.",
  "bookWork.lock.byTypeShort": "pelo tipo",
  "bookWork.lock.type": "Travar o tipo",
  "bookWork.lock.typeLabel": "Travar todos os books do tipo de item",
  "bookWork.lock.done": "Travado. Agora a lista mostra só o que está com você.",
  "bookWork.unlock.done": "Liberado.",
  "bookWork.sla.ok": "No prazo ({h} h)",
  "bookWork.sla.late": "Atrasado (prazo de {h} h)",
  "bookWork.bar.title": "Travar books",
  "bookWork.bar.body":
    "Trave um book (na linha dele) ou todos os de um tipo de item. O que você trava some da lista dos outros analistas, e a sua lista mostra só o que está com você. Prazo: {h} h por book.",
  "bookWork.bar.supervisor":
    "Você vê todos os books, com quem está cada um e há quanto tempo. Prazo: {h} h por book. Pode liberar a trava de qualquer pessoa.",
  "bookWork.bar.mineLot": "Book nº {n}",
  "bookWork.bar.mineType": "Tipo: {type}",
  "bookWork.settings.sla": "Prazo do book travado (horas)",
  "bookWork.settings.slaHint":
    "Tempo do analista com cada book travado, contado de quando ele travou. Passou disso, o book aparece atrasado para o administrador e para quem supervisiona os books.",
  "bookWork.error.booking_lock_taken":
    "Este book (ou este tipo de item) já está com outra pessoa.",
  "bookWork.error.booking_lock_mine": "Já está travado com você.",
  "bookWork.error.booking_type_required": "Escolha o tipo de item.",
  "bookWork.error.booking_meta_required": "Informe o Tipo de item do book.",
  "bookWork.error.booking_sheets_too_many":
    "São muitas planilhas de uma vez: até 10 por book.",
  "bookingLots.error.booking_meta_required": "Informe o Tipo de item do book.",
  "bookingLots.error.booking_sheets_too_many":
    "São muitas planilhas de uma vez: até 10 por book.",
  "settings.error.booking_lock_sla_invalid":
    "Prazo do book travado: de 0,25 a 240 horas.",
  "bookingLots.col.itemType": "Tipo de item",
  "bookingLots.col.sourceKind": "Loja / Supplier",
  "bookingLots.col.workedPct": "Trabalhados",
  "bookingLots.col.holder": "Com quem está",
  "bookingLots.col.heldMinutes": "Há quanto tempo",
  "action.booking.supervise": "Supervisionar os books",
  "action.desc.booking.supervise":
    "Vê todos os books, também os travados por um analista, com quem está cada um, há quanto tempo e o prazo; libera a trava de qualquer pessoa.",
};

export const en: typeof pt = {
  "bookWork.meta.save": "Save",
  "bookWork.storeNumber": "Store no.",
  "bookWork.supplierName": "Supplier name",
  "bookWork.itemType": "Item type",
  "bookWork.itemTypeHint":
    "E.g. glass, plastic, housewares. Use the same name as the other books of the same type.",
  "bookWork.import.multiHint":
    "You can pick several spreadsheets at once (up to 10): they make a single book, one after the other.",
  "bookWork.import.files": "Spreadsheets chosen: {n}",
  "bookWork.sheetItems": "({n} items)",
  "bookWork.col.worked": "Selection",
  "bookWork.col.workedPct": "Worked",
  "bookWork.worked.title": "Worked items",
  "bookWork.worked.yes": "Worked",
  "bookWork.worked.no": "To do",
  "bookWork.worked.share": "Worked: {worked} of {total} ({pct}%)",
  "bookWork.worked.count": "{worked} of {total}",
  "bookWork.bulk.allRows": "None ticked: every row",
  "bookWork.toSelection": "Select the ticked items",
  "bookWork.toSelection.none": "Tick one or more items in the table.",
  "bookWork.toSelection.max": "Up to {n} items at a time.",
  "bookWork.toSelection.hint":
    "Tick one or several items and take them straight to Item selection.",
  "bookWork.lock": "Lock for me",
  "bookWork.unlock": "Release",
  "bookWork.unlock.type": "Release the books of this type",
  "bookWork.lock.title": "Who has it",
  "bookWork.lock.free": "Free",
  "bookWork.lock.body":
    "Lock the book to work on it: other analysts stop seeing it and your list shows only what you hold. Deadline: {h} h per book.",
  "bookWork.lock.heldBy": "With {name} for {time}.",
  "bookWork.lock.byType": "Locked by item type: {type}.",
  "bookWork.lock.byTypeShort": "by type",
  "bookWork.lock.type": "Lock the type",
  "bookWork.lock.typeLabel": "Lock every book of the item type",
  "bookWork.lock.done": "Locked. Your list now shows only what you hold.",
  "bookWork.unlock.done": "Released.",
  "bookWork.sla.ok": "On time ({h} h)",
  "bookWork.sla.late": "Late ({h} h deadline)",
  "bookWork.bar.title": "Lock books",
  "bookWork.bar.body":
    "Lock one book (on its row) or every book of an item type. What you lock leaves the other analysts' lists, and your list shows only what you hold. Deadline: {h} h per book.",
  "bookWork.bar.supervisor":
    "You see every book, who has each one and for how long. Deadline: {h} h per book. You can release anyone's lock.",
  "bookWork.bar.mineLot": "Book no. {n}",
  "bookWork.bar.mineType": "Type: {type}",
  "bookWork.settings.sla": "Locked book deadline (hours)",
  "bookWork.settings.slaHint":
    "Time the analyst has with each locked book, counted from the lock. Past it, the book shows as late to the administrator and to whoever supervises the books.",
  "bookWork.error.booking_lock_taken":
    "This book (or this item type) is already with someone else.",
  "bookWork.error.booking_lock_mine": "It is already locked by you.",
  "bookWork.error.booking_type_required": "Choose the item type.",
  "bookWork.error.booking_meta_required": "Fill in the book's item type.",
  "bookWork.error.booking_sheets_too_many":
    "Too many spreadsheets at once: up to 10 per book.",
  "bookingLots.error.booking_meta_required": "Fill in the book's item type.",
  "bookingLots.error.booking_sheets_too_many":
    "Too many spreadsheets at once: up to 10 per book.",
  "settings.error.booking_lock_sla_invalid":
    "Locked book deadline: from 0.25 to 240 hours.",
  "bookingLots.col.itemType": "Item type",
  "bookingLots.col.sourceKind": "Store / Supplier",
  "bookingLots.col.workedPct": "Worked",
  "bookingLots.col.holder": "Who has it",
  "bookingLots.col.heldMinutes": "For how long",
  "action.booking.supervise": "Supervise the books",
  "action.desc.booking.supervise":
    "Sees every book, including those locked by an analyst, who has each one, for how long and the deadline; releases anyone's lock.",
};

export const zh: typeof pt = {
  "bookWork.meta.save": "保存",
  "bookWork.storeNumber": "店铺号",
  "bookWork.supplierName": "供应商名称",
  "bookWork.itemType": "产品类型",
  "bookWork.itemTypeHint":
    "例如：玻璃、塑料、日用品。同类型的 Book 请使用相同的名称。",
  "bookWork.import.multiHint":
    "可一次选择多个表格（最多 10 个）：它们按顺序合并为一个 Book。",
  "bookWork.import.files": "已选表格：{n}",
  "bookWork.sheetItems": "（{n} 项）",
  "bookWork.col.worked": "选品",
  "bookWork.col.workedPct": "已处理",
  "bookWork.worked.title": "已处理的产品",
  "bookWork.worked.yes": "已处理",
  "bookWork.worked.no": "待处理",
  "bookWork.worked.share": "已处理：{worked} / {total}（{pct}%）",
  "bookWork.worked.count": "{worked} / {total}",
  "bookWork.bulk.allRows": "未勾选：所有行",
  "bookWork.toSelection": "选择勾选的产品",
  "bookWork.toSelection.none": "请在表格中勾选一个或多个产品。",
  "bookWork.toSelection.max": "每次最多 {n} 个产品。",
  "bookWork.toSelection.hint": "勾选一个或多个产品，直接带到选品页面。",
  "bookWork.lock": "锁定给我",
  "bookWork.unlock": "释放",
  "bookWork.unlock.type": "释放该类型的 Book",
  "bookWork.lock.title": "由谁处理",
  "bookWork.lock.free": "空闲",
  "bookWork.lock.body":
    "锁定 Book 后再处理：其他分析员将看不到它，您的列表只显示由您处理的 Book。期限：每个 Book {h} 小时。",
  "bookWork.lock.heldBy": "由 {name} 处理，已 {time}。",
  "bookWork.lock.byType": "按产品类型锁定：{type}。",
  "bookWork.lock.byTypeShort": "按类型",
  "bookWork.lock.type": "锁定该类型",
  "bookWork.lock.typeLabel": "锁定某一产品类型的全部 Book",
  "bookWork.lock.done": "已锁定。列表现在只显示由您处理的 Book。",
  "bookWork.unlock.done": "已释放。",
  "bookWork.sla.ok": "按时（{h} 小时）",
  "bookWork.sla.late": "超时（期限 {h} 小时）",
  "bookWork.bar.title": "锁定 Book",
  "bookWork.bar.body":
    "可锁定单个 Book（在其所在行）或某一产品类型的全部 Book。您锁定的 Book 会从其他分析员的列表中消失，您的列表只显示由您处理的 Book。期限：每个 Book {h} 小时。",
  "bookWork.bar.supervisor":
    "您可以看到所有 Book、各自由谁处理以及已处理多久。期限：每个 Book {h} 小时。您可以释放任何人的锁定。",
  "bookWork.bar.mineLot": "Book 编号 {n}",
  "bookWork.bar.mineType": "类型：{type}",
  "bookWork.settings.sla": "锁定 Book 的期限（小时）",
  "bookWork.settings.slaHint":
    "分析员处理每个锁定 Book 的时间，从锁定时起算。超过后，该 Book 会向管理员和 Book 主管显示为超时。",
  "bookWork.error.booking_lock_taken": "该 Book（或该产品类型）已由他人处理。",
  "bookWork.error.booking_lock_mine": "已由您锁定。",
  "bookWork.error.booking_type_required": "请选择产品类型。",
  "bookWork.error.booking_meta_required": "请填写 Book 的产品类型。",
  "bookWork.error.booking_sheets_too_many":
    "一次选择的表格过多：每个 Book 最多 10 个。",
  "bookingLots.error.booking_meta_required": "请填写 Book 的产品类型。",
  "bookingLots.error.booking_sheets_too_many":
    "一次选择的表格过多：每个 Book 最多 10 个。",
  "settings.error.booking_lock_sla_invalid":
    "锁定 Book 的期限：0.25 至 240 小时。",
  "bookingLots.col.itemType": "产品类型",
  "bookingLots.col.sourceKind": "店铺 / 供应商",
  "bookingLots.col.workedPct": "已处理",
  "bookingLots.col.holder": "由谁处理",
  "bookingLots.col.heldMinutes": "已处理多久",
  "action.booking.supervise": "监管 Book",
  "action.desc.booking.supervise":
    "可查看所有 Book（包括被分析员锁定的）、各自由谁处理、已处理多久及期限；可释放任何人的锁定。",
};
