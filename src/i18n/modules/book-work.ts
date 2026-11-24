/**
 * Dinâmica dos books (dono, 23/11/2026; docs/BOOKING.md): Loja/Fábrica e
 * Tipo de item na importação, várias planilhas num book, itens trabalhados
 * na Seleção de itens, seleção direto do book e a trava (com quem está cada
 * book, há quanto tempo e o prazo).
 */
export const pt = {
  "bookWork.meta.save": "Salvar",
  "bookWork.storeNumber": "Nº da loja",
  "bookWork.supplierName": "Supplier",
  "bookWork.incoterm": "FOB ou EXW",
  "bookWork.incotermHint":
    "Vale para todos os itens do book, seja qual for o que a planilha traz.",
  "bookWork.exwValue": "Valor do EXW",
  "bookWork.exwValueHint":
    "Quanto custa levar a mercadoria até o porto, na moeda dos preços do book.",
  "bookWork.exwShown": "EXW · valor do EXW: {value}",
  "bookWork.error.booking_incoterm_required": "Escolha FOB ou EXW.",
  "bookWork.error.booking_exw_value_required":
    "Com EXW, informe o valor do EXW (acima de zero).",
  "bookingLots.error.booking_incoterm_required": "Escolha FOB ou EXW.",
  "bookingLots.error.booking_exw_value_required":
    "Com EXW, informe o valor do EXW (acima de zero).",
  "bookWork.storeNumberHint":
    "A loja do fabricante. Vai para a coluna Fabricante de todas as linhas e é comparada com a planilha.",
  "bookWork.supplierNameHint":
    "O fornecedor, dono do book: as solicitações dos itens vão para ele. Digite para buscar no cadastro; se não existir, fica o nome e você cadastra depois, na tela do book.",
  "bookWork.partner": "Fornecedor (Supplier)",
  "bookWork.partnerHint":
    "O dono do book: as solicitações dos itens vão para ele. Vazio: vale a fábrica.",
  "bookWork.partner.none": "Escolher depois (vale a fábrica)",
  "bookWork.partner.new": "Ou cadastrar um fornecedor novo",
  "bookWork.partner.newHint":
    "Só se ele ainda não está na lista: digite o nome e ele é cadastrado (sem login).",
  "bookWork.manufacturer": "Fabricante",
  "bookWork.manufacturer.sheet": "Planilha: {name}",
  "bookWork.manufacturer.confirm": "A tela está certa",
  "bookWork.manufacturer.confirmAsk":
    'A planilha diz "{sheet}" nesta linha. Confirma que a planilha estava errada e o fabricante é "{name}"?',
  "bookWork.manufacturer.remove": "Remover a linha",
  "bookWork.manufacturer.removeAsk":
    "Remover este item do book? Ele é de outra loja e não volta.",
  "bookWork.manufacturer.alert":
    "{n} linha(s) trazem outro nº de loja na planilha (o deste book é {name}). Um book tem itens de um fabricante só: remova essas linhas, ou cancele esta importação e refaça.",
  "bookWork.manufacturer.confirmAll":
    "A planilha estava errada: confirmar todas",
  "bookWork.manufacturer.confirmAllAsk":
    'Confirma que a planilha estava errada nas {n} linha(s) e que o fabricante de todas é "{name}"?',
  "bookWork.manufacturer.confirmed": "Fabricante confirmado.",
  "bookWork.manufacturer.removed": "Item removido do book.",
  "bookWork.store.mismatch":
    "O nº da loja digitado ({typed}) é diferente do que a planilha traz ({sheet}). Confira qual está certo.",
  "bookWork.lock.afterDraft":
    "O book só pode ser travado depois de fechado, quando começa a seleção dos itens.",
  "bookWork.error.booking_lock_draft":
    "O book só pode ser travado depois de fechado (deixou de ser rascunho).",
  "bookWork.error.booking_manufacturer_mismatch":
    "Há linhas com outro fabricante na planilha. Remova essas linhas ou confirme que a planilha estava errada.",
  "bookingLots.error.booking_manufacturer_mismatch":
    "Há linhas com outro fabricante na planilha. Remova essas linhas ou confirme que a planilha estava errada.",
  "bookWork.error.booking_item_in_use":
    "Este item já foi trabalhado na seleção e não pode ser removido.",
  "bookingLots.error.booking_item_in_use":
    "Este item já foi trabalhado na seleção e não pode ser removido.",
  "bookWork.template": "Baixar o modelo de book",
  "bookWork.unlock.rule":
    "Quem travou não libera: só o gestor. A trava sai sozinha quando todos os itens do book estiverem trabalhados.",
  "bookWork.error.booking_lock_release_manager":
    "Só o gestor de quem travou (ou quem supervisiona os books) libera a trava. Ela sai sozinha quando todos os itens estiverem trabalhados.",
  "bookWork.supplierSearch": "Buscar ou digitar o nome",
  "bookWork.supplier.pending": "Supplier sem cadastro: {name}",
  "bookWork.supplier.register": "Cadastrar como fornecedor do book",
  "bookWork.refuse": "Recusar os marcados",
  "bookWork.refuse.ask":
    "Recusar {n} item(ns)? Eles não vão para a seleção e ficam como trabalhados.",
  "bookWork.refuse.pending": "Recusando…",
  "bookWork.worked.refused": "Recusado",
  "bookWork.error.booking_refuse_draft":
    "Só dá para selecionar ou recusar itens depois que o book deixa de ser rascunho.",
  "bookWork.manufacturer.cancel": "Cancelar a importação para refazer",
  "bookWork.manufacturer.cancelAsk":
    "Cancelar esta importação do book? Depois é só importar a planilha de novo, com o nº da loja certo.",
  "bookWork.worked.selected": "Selecionado",
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
    "Marque um ou vários itens: leve para a Seleção de itens ou recuse (o recusado conta como trabalhado).",
  "bookWork.lock": "Travar para mim",
  "bookWork.unlock": "Liberar",
  "bookWork.unlock.type": "Liberar os books deste tipo",
  "bookWork.lock.title": "Com quem está",
  "bookWork.lock.free": "Livre",
  "bookWork.lock.body":
    "Trave o book para trabalhar nele: os outros analistas deixam de vê-lo e a sua lista passa a mostrar só o que está com você. Quem libera é o seu gestor; a trava sai sozinha quando todos os itens estiverem trabalhados. Prazo: {h} h por book.",
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
    "Trave um book (na linha dele, depois de fechado) ou todos os de um tipo de item. O que você trava some da lista dos outros analistas, e a sua lista mostra só o que está com você. Quem libera é o seu gestor; a trava sai sozinha quando todos os itens do book estiverem trabalhados. Prazo: {h} h por book.",
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
  "bookWork.supplierName": "Supplier",
  "bookWork.incoterm": "FOB or EXW",
  "bookWork.incotermHint":
    "Applies to every item of the book, whatever the spreadsheet says.",
  "bookWork.exwValue": "EXW value",
  "bookWork.exwValueHint":
    "Cost of taking the goods to the port, in the currency of the book's prices.",
  "bookWork.exwShown": "EXW · EXW value: {value}",
  "bookWork.error.booking_incoterm_required": "Choose FOB or EXW.",
  "bookWork.error.booking_exw_value_required":
    "With EXW, fill in the EXW value (above zero).",
  "bookingLots.error.booking_incoterm_required": "Choose FOB or EXW.",
  "bookingLots.error.booking_exw_value_required":
    "With EXW, fill in the EXW value (above zero).",
  "bookWork.storeNumberHint":
    "The manufacturer's store. It goes to the Manufacturer column of every row and is compared with the spreadsheet.",
  "bookWork.supplierNameHint":
    "The supplier that owns the book: requests for its items go to them. Type to search the registry; if they are not there, the name is kept and you register them later, on the book page.",
  "bookWork.partner": "Supplier",
  "bookWork.partnerHint":
    "The owner of the book: requests for its items go to them. Empty: the factory.",
  "bookWork.partner.none": "Choose later (the factory)",
  "bookWork.partner.new": "Or register a new supplier",
  "bookWork.partner.newHint":
    "Only if they are not in the list yet: type the name and they are registered (no login).",
  "bookWork.manufacturer": "Manufacturer",
  "bookWork.manufacturer.sheet": "Spreadsheet: {name}",
  "bookWork.manufacturer.confirm": "The screen is right",
  "bookWork.manufacturer.confirmAsk":
    'The spreadsheet says "{sheet}" on this row. Confirm the spreadsheet was wrong and the manufacturer is "{name}"?',
  "bookWork.manufacturer.remove": "Remove the row",
  "bookWork.manufacturer.removeAsk":
    "Remove this item from the book? It is from another store and will not come back.",
  "bookWork.manufacturer.alert":
    "{n} row(s) have another store no. in the spreadsheet (this book's is {name}). A book has items from one manufacturer only: remove those rows, or cancel this import and do it again.",
  "bookWork.manufacturer.confirmAll": "The spreadsheet was wrong: confirm all",
  "bookWork.manufacturer.confirmAllAsk":
    'Confirm the spreadsheet was wrong on the {n} row(s) and the manufacturer of all of them is "{name}"?',
  "bookWork.manufacturer.confirmed": "Manufacturer confirmed.",
  "bookWork.manufacturer.removed": "Item removed from the book.",
  "bookWork.store.mismatch":
    "The store no. typed ({typed}) differs from the one in the spreadsheet ({sheet}). Check which is right.",
  "bookWork.lock.afterDraft":
    "The book can only be locked after it is closed, when item selection starts.",
  "bookWork.error.booking_lock_draft":
    "The book can only be locked after it is closed (no longer a draft).",
  "bookWork.error.booking_manufacturer_mismatch":
    "Some rows have another manufacturer in the spreadsheet. Remove them or confirm the spreadsheet was wrong.",
  "bookingLots.error.booking_manufacturer_mismatch":
    "Some rows have another manufacturer in the spreadsheet. Remove them or confirm the spreadsheet was wrong.",
  "bookWork.error.booking_item_in_use":
    "This item has already been worked in the selection and cannot be removed.",
  "bookingLots.error.booking_item_in_use":
    "This item has already been worked in the selection and cannot be removed.",
  "bookWork.template": "Download the book template",
  "bookWork.unlock.rule":
    "Whoever locked it cannot release it: only their manager. The lock comes off by itself when every item of the book has been worked.",
  "bookWork.error.booking_lock_release_manager":
    "Only the manager of whoever locked it (or whoever supervises the books) can release the lock. It comes off by itself when every item has been worked.",
  "bookWork.supplierSearch": "Search or type the name",
  "bookWork.supplier.pending": "Supplier not registered: {name}",
  "bookWork.supplier.register": "Register as the book's supplier",
  "bookWork.refuse": "Refuse the ticked items",
  "bookWork.refuse.ask":
    "Refuse {n} item(s)? They will not go to the selection and will count as worked.",
  "bookWork.refuse.pending": "Refusing…",
  "bookWork.worked.refused": "Refused",
  "bookWork.error.booking_refuse_draft":
    "Items can only be selected or refused after the book is no longer a draft.",
  "bookWork.manufacturer.cancel": "Cancel the import and do it again",
  "bookWork.manufacturer.cancelAsk":
    "Cancel this book import? Then just import the spreadsheet again, with the right store no.",
  "bookWork.worked.selected": "Selected",
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
    "Tick one or several items: take them to Item selection or refuse them (a refused item counts as worked).",
  "bookWork.lock": "Lock for me",
  "bookWork.unlock": "Release",
  "bookWork.unlock.type": "Release the books of this type",
  "bookWork.lock.title": "Who has it",
  "bookWork.lock.free": "Free",
  "bookWork.lock.body":
    "Lock the book to work on it: other analysts stop seeing it and your list shows only what you hold. Your manager releases it; the lock comes off by itself when every item has been worked. Deadline: {h} h per book.",
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
    "Lock one book (on its row, once closed) or every book of an item type. What you lock leaves the other analysts' lists, and your list shows only what you hold. Your manager releases it; the lock comes off by itself when every item of the book has been worked. Deadline: {h} h per book.",
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
  "bookWork.supplierName": "Supplier（供应商）",
  "bookWork.incoterm": "FOB 或 EXW",
  "bookWork.incotermHint": "适用于 Book 的所有产品，无论表格中填写的是什么。",
  "bookWork.exwValue": "EXW 费用",
  "bookWork.exwValueHint": "将货物运至港口的费用，币种与 Book 价格相同。",
  "bookWork.exwShown": "EXW · EXW 费用：{value}",
  "bookWork.error.booking_incoterm_required": "请选择 FOB 或 EXW。",
  "bookWork.error.booking_exw_value_required":
    "选择 EXW 时，请填写 EXW 费用（大于零）。",
  "bookingLots.error.booking_incoterm_required": "请选择 FOB 或 EXW。",
  "bookingLots.error.booking_exw_value_required":
    "选择 EXW 时，请填写 EXW 费用（大于零）。",
  "bookWork.storeNumberHint":
    "生产厂家的店铺号。会填入所有行的“生产厂家”列，并与表格比对。",
  "bookWork.supplierNameHint":
    "Book 的所有者：产品的请求会发给他。输入即可在登记中搜索；如果不存在，名称会保留，稍后在 Book 页面登记。",
  "bookWork.partner": "供应商（Supplier）",
  "bookWork.partnerHint": "Book 的所有者：产品的请求会发给他。留空：发给工厂。",
  "bookWork.partner.none": "稍后选择（发给工厂）",
  "bookWork.partner.new": "或登记新的供应商",
  "bookWork.partner.newHint": "仅当列表中没有时：输入名称即可登记（无登录）。",
  "bookWork.manufacturer": "生产厂家",
  "bookWork.manufacturer.sheet": "表格：{name}",
  "bookWork.manufacturer.confirm": "页面正确",
  "bookWork.manufacturer.confirmAsk":
    "表格在此行写的是“{sheet}”。确认表格有误，生产厂家是“{name}”吗？",
  "bookWork.manufacturer.remove": "删除此行",
  "bookWork.manufacturer.removeAsk":
    "从 Book 中删除此产品吗？它属于其他店铺，删除后无法恢复。",
  "bookWork.manufacturer.alert":
    "有 {n} 行在表格中写的是其他店铺号（本 Book 的是 {name}）。一个 Book 只能有一个厂家的产品：请删除这些行，或取消本次导入后重新导入。",
  "bookWork.manufacturer.confirmAll": "表格有误：全部确认",
  "bookWork.manufacturer.confirmAllAsk":
    "确认这 {n} 行的表格有误，且生产厂家均为“{name}”吗？",
  "bookWork.manufacturer.confirmed": "生产厂家已确认。",
  "bookWork.manufacturer.removed": "产品已从 Book 中删除。",
  "bookWork.store.mismatch":
    "填写的店铺号（{typed}）与表格中的（{sheet}）不一致。请核对哪个正确。",
  "bookWork.lock.afterDraft": "Book 关闭后才能锁定，此时才开始选品。",
  "bookWork.error.booking_lock_draft": "Book 关闭后（不再是草稿）才能锁定。",
  "bookWork.error.booking_manufacturer_mismatch":
    "有些行在表格中写的是其他厂家。请删除这些行，或确认表格有误。",
  "bookingLots.error.booking_manufacturer_mismatch":
    "有些行在表格中写的是其他厂家。请删除这些行，或确认表格有误。",
  "bookWork.error.booking_item_in_use": "该产品已在选品中处理，无法删除。",
  "bookingLots.error.booking_item_in_use": "该产品已在选品中处理，无法删除。",
  "bookWork.template": "下载 Book 模板",
  "bookWork.unlock.rule":
    "锁定者本人不能释放，只有其主管可以。Book 的所有产品处理完后，锁定会自动解除。",
  "bookWork.error.booking_lock_release_manager":
    "只有锁定者的主管（或 Book 主管）可以释放锁定。所有产品处理完后，锁定会自动解除。",
  "bookWork.supplierSearch": "搜索或输入名称",
  "bookWork.supplier.pending": "Supplier 尚未登记：{name}",
  "bookWork.supplier.register": "登记为该 Book 的供应商",
  "bookWork.refuse": "拒绝勾选的产品",
  "bookWork.refuse.ask": "拒绝 {n} 个产品吗？它们不会进入选品，并计为已处理。",
  "bookWork.refuse.pending": "正在拒绝…",
  "bookWork.worked.refused": "已拒绝",
  "bookWork.error.booking_refuse_draft":
    "Book 不再是草稿后才能选择或拒绝产品。",
  "bookWork.manufacturer.cancel": "取消导入并重新导入",
  "bookWork.manufacturer.cancelAsk":
    "取消本次 Book 导入吗？之后用正确的店铺号重新导入表格即可。",
  "bookWork.worked.selected": "已选中",
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
  "bookWork.toSelection.hint":
    "勾选一个或多个产品：带到选品页面，或拒绝（被拒绝的产品计为已处理）。",
  "bookWork.lock": "锁定给我",
  "bookWork.unlock": "释放",
  "bookWork.unlock.type": "释放该类型的 Book",
  "bookWork.lock.title": "由谁处理",
  "bookWork.lock.free": "空闲",
  "bookWork.lock.body":
    "锁定 Book 后再处理：其他分析员将看不到它，您的列表只显示由您处理的 Book。只有您的主管可以释放；所有产品处理完后锁定自动解除。期限：每个 Book {h} 小时。",
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
    "可锁定单个 Book（关闭后，在其所在行）或某一产品类型的全部 Book。您锁定的 Book 会从其他分析员的列表中消失，您的列表只显示由您处理的 Book。只有您的主管可以释放；所有产品处理完后锁定自动解除。期限：每个 Book {h} 小时。",
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
