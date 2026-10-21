/**
 * Dicionário do módulo "sheet-reading" (ficha pela foto do quadro e
 * divergências entre o quadro e a ficha): mesmas chaves em pt, en e zh.
 */
export const pt = {
  "board.title": "Ficha pela foto do quadro",
  "board.intro":
    "Envie a foto do quadro preenchido à mão (com o produto, a balança, a régua e o cartão). A IA transcreve o que está escrito e preenche os campos vazios da ficha. O que for diferente do que a ficha já tem fica marcado como divergente, e a Wellmix decide qual vale.",
  "board.photo": "Foto do quadro",
  "board.send": "Ler a foto e preencher a ficha",
  "board.sending": "Lendo a foto…",
  "board.done":
    "Foto lida: {filled} campo(s) preenchido(s), {divergent} divergente(s). Confira a ficha.",
  "board.mock": "Modo exemplo (mock): nenhuma foto foi lida de verdade.",
  "board.last": "Última leitura: {date}",
  "board.viewPhoto": "Ver a foto do quadro",
  "board.read": "Lido da foto: {fields}",
  "board.notes": "Observações da leitura: {notes}",
  "board.divergent.title": "Divergente: o quadro diz uma coisa e a ficha outra",
  "board.divergent.supplierHint":
    "A Wellmix vai conferir e decidir qual valor vale.",
  "board.divergent.photo": "Quadro",
  "board.divergent.sheet": "Ficha",
  "board.usePhoto": "Vale o do quadro",
  "board.useSheet": "Vale o da ficha",
  "board.resolved": "Divergência resolvida: a decisão ficou registrada.",
  "board.none": "Sem divergências: a ficha confere com o quadro.",
  "board.badge": "Divergente do quadro",
  "board.error.photo_required": "Escolha ou tire a foto do quadro.",
  "board.error.failed": "Não deu para ler a foto ({code}).",
};

export const en: Record<keyof typeof pt, string> = {
  "board.title": "Sheet from the board photo",
  "board.intro":
    "Send the photo of the handwritten board (with the product, the scale, the ruler and the card). The AI transcribes what is written and fills the empty fields of the sheet. Anything different from what the sheet already has is marked as divergent, and Wellmix decides which value is right.",
  "board.photo": "Board photo",
  "board.send": "Read the photo and fill the sheet",
  "board.sending": "Reading the photo…",
  "board.done":
    "Photo read: {filled} field(s) filled, {divergent} divergent. Check the sheet.",
  "board.mock": "Example mode (mock): no photo was actually read.",
  "board.last": "Last reading: {date}",
  "board.viewPhoto": "See the board photo",
  "board.read": "Read from the photo: {fields}",
  "board.notes": "Reading notes: {notes}",
  "board.divergent.title":
    "Divergent: the board says one thing and the sheet another",
  "board.divergent.supplierHint":
    "Wellmix will check and decide which value is right.",
  "board.divergent.photo": "Board",
  "board.divergent.sheet": "Sheet",
  "board.usePhoto": "Board is right",
  "board.useSheet": "Sheet is right",
  "board.resolved": "Divergence resolved: the decision was recorded.",
  "board.none": "No divergences: the sheet matches the board.",
  "board.badge": "Differs from the board",
  "board.error.photo_required": "Choose or take the board photo.",
  "board.error.failed": "Could not read the photo ({code}).",
};

export const zh: Record<keyof typeof pt, string> = {
  "board.title": "按报价板照片填写采购单",
  "board.intro":
    "上传手写报价板的照片（含产品、秤、尺子和名片）。AI 会转录板上写的内容，并填写采购单中的空白字段。与采购单现有内容不同的值会标记为不一致，由 Wellmix 决定以哪个为准。",
  "board.photo": "报价板照片",
  "board.send": "读取照片并填写采购单",
  "board.sending": "正在读取照片…",
  "board.done":
    "照片已读取：填写了 {filled} 个字段，{divergent} 个不一致。请核对采购单。",
  "board.mock": "示例模式（mock）：并未真正读取照片。",
  "board.last": "最近一次读取：{date}",
  "board.viewPhoto": "查看报价板照片",
  "board.read": "从照片读取：{fields}",
  "board.notes": "读取备注：{notes}",
  "board.divergent.title": "不一致：报价板与采购单的内容不同",
  "board.divergent.supplierHint": "Wellmix 将核对并决定以哪个值为准。",
  "board.divergent.photo": "报价板",
  "board.divergent.sheet": "采购单",
  "board.usePhoto": "以报价板为准",
  "board.useSheet": "以采购单为准",
  "board.resolved": "不一致已处理：决定已记录。",
  "board.none": "没有不一致：采购单与报价板相符。",
  "board.badge": "与报价板不一致",
  "board.error.photo_required": "请选择或拍摄报价板照片。",
  "board.error.failed": "无法读取照片（{code}）。",
};
