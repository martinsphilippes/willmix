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
  "sheet.field.leadTimeDays": "Prazo de produção (dias)",
  "sheet.field.conditions": "Condições de pagamento e observações",
  "productSheet.register.title": "Este produto ainda não está no catálogo",
  "productSheet.register.hint":
    "Cadastre com os dados desta ficha: na próxima venda o produto já vem preenchido.",
  "productSheet.register.line": "Linha",
  "productSheet.register.submit": "Cadastrar no catálogo",
  "sheet.error.invalid_line": "Escolha a linha do produto.",
  "productSheet.autoHint":
    "O cadastro do produto acompanha esta ficha: ao salvar, a ficha mestre do produto é atualizada.",
  "pricing.error.sheet_changed":
    "A ficha da cotação mudou depois da conta (outra quantidade de caixas). Confira o valor ao cliente na tela atualizada e selecione de novo.",
  "sheet.qty.quoteDraft":
    "ao salvar ou enviar a ficha, a cotação passa a valer {to} {unit} ({diff} em relação aos {from} pedidos).",
  "sheet.draftRestored":
    "O que você digitou nesta ficha ainda não está salvo e foi mantido nesta tela. Confira e salve.",
  "sheet.draftDiscard": "Descartar e ver o que está salvo",
  "form.invalid.before": "Confira o valor de: ",
  "sheet.error.too_large":
    "Foto grande demais. Tire de novo ou envie uma menor.",
  "sheet.error.mime":
    "Formato não aceito: envie foto (JPG, PNG, WEBP, HEIC) ou PDF.",
  "sheet.error.empty": "O arquivo chegou vazio. Escolha a foto de novo.",
  "sheet.error.upload_missing":
    "A foto não terminou de subir. Escolha de novo (de preferência no Wi-Fi).",
};

export const en: Record<keyof typeof pt, string> = {
  "sheet.invalidFields":
    "Could not read: {fields}. Use numbers like 1000, 1,000 or 0.05. The rest of the sheet was saved.",
  "sheet.error.invalid_fields":
    "Some fields could not be read and were not saved; the rest was saved. See below.",
  "sheet.field.colorPantones": "Pantone colors",
  "sheet.field.lots": "Schedule",
  "sheet.field.leadTimeDays": "Production lead time (days)",
  "sheet.field.conditions": "Payment terms and notes",
  "productSheet.register.title": "This product is not in the catalog yet",
  "productSheet.register.hint":
    "Register it with this sheet's data: next time the product comes pre-filled.",
  "productSheet.register.line": "Line",
  "productSheet.register.submit": "Add to catalog",
  "sheet.error.invalid_line": "Choose the product line.",
  "productSheet.autoHint":
    "The product record follows this sheet: saving updates the product's master sheet.",
  "pricing.error.sheet_changed":
    "The quote sheet changed after the calculation (a different number of cartons). Check the customer value on the refreshed screen and select again.",
  "sheet.qty.quoteDraft":
    "once the sheet is saved or sent, the quote is for {to} {unit} ({diff} versus the {from} requested).",
  "sheet.draftRestored":
    "What you typed in this sheet is not saved yet and was kept on this screen. Check it and save.",
  "sheet.draftDiscard": "Discard and show what is saved",
  "form.invalid.before": "Check the value of: ",
  "sheet.error.too_large":
    "Photo too large. Take it again or send a smaller one.",
  "sheet.error.mime":
    "Format not accepted: send a photo (JPG, PNG, WEBP, HEIC) or a PDF.",
  "sheet.error.empty": "The file arrived empty. Pick the photo again.",
  "sheet.error.upload_missing":
    "The photo did not finish uploading. Pick it again (preferably on Wi-Fi).",
};

export const zh: Record<keyof typeof pt, string> = {
  "sheet.invalidFields":
    "无法识别：{fields}。请填写数字，例如 1000、1,000 或 0.05。采购单其余内容已保存。",
  "sheet.error.invalid_fields":
    "部分字段无法识别，未保存；其余内容已保存。请看下方。",
  "sheet.field.colorPantones": "Pantone 颜色",
  "sheet.field.lots": "排期",
  "sheet.field.leadTimeDays": "生产周期（天）",
  "sheet.field.conditions": "付款条件和备注",
  "productSheet.register.title": "该产品尚未加入产品库",
  "productSheet.register.hint":
    "用此采购单的数据登记：下次销售时产品信息会自动带出。",
  "productSheet.register.line": "产品线",
  "productSheet.register.submit": "加入产品库",
  "sheet.error.invalid_line": "请选择产品线。",
  "productSheet.autoHint":
    "产品主档随此采购单更新：保存时会同步产品的主采购单。",
  "pricing.error.sheet_changed":
    "计算后报价采购单已更改（箱数不同）。请在刷新后的页面核对客户金额，然后重新选择。",
  "sheet.qty.quoteDraft":
    "保存或提交采购单后，本报价数量为 {to} {unit}（与需求 {from} 相差 {diff}）。",
  "sheet.draftRestored":
    "您在此采购单中填写的内容尚未保存，已保留在此页面。请检查后保存。",
  "sheet.draftDiscard": "放弃并查看已保存内容",
  "form.invalid.before": "请检查以下字段：",
  "sheet.error.too_large": "照片太大。请重新拍摄或上传较小的照片。",
  "sheet.error.mime": "格式不支持：请上传照片（JPG、PNG、WEBP、HEIC）或 PDF。",
  "sheet.error.empty": "文件为空。请重新选择照片。",
  "sheet.error.upload_missing":
    "照片未上传完成。请重新选择（最好使用 Wi-Fi）。",
};
