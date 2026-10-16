/**
 * Dicionário do módulo "sheet-safety" (ficha nunca perde o que foi digitado:
 * campo ilegível não derruba o envio; rascunho restaurado depois de falha):
 * mesmas chaves em pt, en e zh.
 */
export const pt = {
  "sheet.invalidFields":
    "Não deu para ler: {fields}. Use números como 1000, 1.000 ou 0,05. O resto da ficha foi salvo.",
  "sheet.error.invalid_fields":
    "Alguns campos não puderam ser lidos e ficaram sem salvar; o resto foi salvo. Veja abaixo.",
  "sheet.field.colorPantones": "Cores Pantone",
  "sheet.field.lots": "Programação",
  "productSheet.register.title": "Este produto ainda não está no catálogo",
  "productSheet.register.hint":
    "Cadastre com os dados desta ficha: na próxima venda o produto já vem preenchido.",
  "productSheet.register.line": "Linha",
  "productSheet.register.submit": "Cadastrar no catálogo",
  "sheet.error.invalid_line": "Escolha a linha do produto.",
  "productSheet.autoHint":
    "O cadastro do produto acompanha esta ficha: ao salvar, a ficha mestre do produto é atualizada.",
  "sheet.draftRestored":
    "O envio não deu certo, mas o que você digitou foi mantido nesta tela. Confira e salve de novo.",
};

export const en: Record<keyof typeof pt, string> = {
  "sheet.invalidFields":
    "Could not read: {fields}. Use numbers like 1000, 1,000 or 0.05. The rest of the sheet was saved.",
  "sheet.error.invalid_fields":
    "Some fields could not be read and were not saved; the rest was saved. See below.",
  "sheet.field.colorPantones": "Pantone colors",
  "sheet.field.lots": "Schedule",
  "productSheet.register.title": "This product is not in the catalog yet",
  "productSheet.register.hint":
    "Register it with this sheet's data: next time the product comes pre-filled.",
  "productSheet.register.line": "Line",
  "productSheet.register.submit": "Add to catalog",
  "sheet.error.invalid_line": "Choose the product line.",
  "productSheet.autoHint":
    "The product record follows this sheet: saving updates the product's master sheet.",
  "sheet.draftRestored":
    "Sending did not work, but what you typed was kept on this screen. Check it and save again.",
};

export const zh: Record<keyof typeof pt, string> = {
  "sheet.invalidFields":
    "无法识别：{fields}。请填写数字，例如 1000、1,000 或 0.05。采购单其余内容已保存。",
  "sheet.error.invalid_fields":
    "部分字段无法识别，未保存；其余内容已保存。请看下方。",
  "sheet.field.colorPantones": "Pantone 颜色",
  "sheet.field.lots": "排期",
  "productSheet.register.title": "该产品尚未加入产品库",
  "productSheet.register.hint":
    "用此采购单的数据登记：下次销售时产品信息会自动带出。",
  "productSheet.register.line": "产品线",
  "productSheet.register.submit": "加入产品库",
  "sheet.error.invalid_line": "请选择产品线。",
  "productSheet.autoHint":
    "产品主档随此采购单更新：保存时会同步产品的主采购单。",
  "sheet.draftRestored":
    "提交未成功，但您填写的内容已保留在此页面。请检查后再次保存。",
};
