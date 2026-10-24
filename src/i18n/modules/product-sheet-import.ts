/**
 * Cadastro de produtos pela planilha da ficha técnica (Cadastros → Produtos →
 * Importar ficha técnica): formulário, leitura e resultado com o que falta.
 */
export const pt = {
  "sheetImport.title": "Importar ficha técnica",
  "sheetImport.subtitle":
    "Suba a planilha da ficha (modelo SUPPLIER INFO): os produtos são cadastrados na hora, com ficha mestre e fotos, e o portal mostra o que falta em cada um.",
  "sheetImport.form.title": "Planilha",
  "sheetImport.file": "Planilha (.xlsx)",
  "sheetImport.fileHint":
    "O modelo com as colunas PHOTO, DATE, SUPPLIER NAME, SKU, PRICE, QTY/BOX, N.W, G.W, CBM, SIZE, COLOR, MATERIAL e MOQ. Arquivo .xls antigo: abra no Excel e salve como .xlsx.",
  "sheetImport.line": "Linha do produto",
  "sheetImport.lineHint": "A planilha não diz a linha: todos os produtos desta importação entram nela.",
  "sheetImport.currency": "Moeda do preço",
  "sheetImport.currencyHint": "Usada só quando o cabeçalho não diz (\"PRICE / U$\" já diz dólar).",
  "sheetImport.prefix": "Nome base (opcional)",
  "sheetImport.prefixHint":
    "Entra antes da descrição e do tamanho: \"Porta-retrato\" vira \"Porta-retrato STONE MARBLE A4\".",
  "sheetImport.prefixPlaceholder": "ex.: Porta-retrato",
  "sheetImport.submit": "Importar e cadastrar",
  "sheetImport.pending": "Lendo a planilha…",
  "sheetImport.how.title": "Como o portal lê a planilha",
  "sheetImport.how.body":
    "Sem mapear coluna por coluna: o portal reconhece o cabeçalho do modelo (em inglês, português ou chinês).",
  "sheetImport.how.columns":
    "Preço, caixa master, inner, pesos, CBM, medidas, embalagem, cor, material, função e MOQ vão para a ficha mestre do produto.",
  "sheetImport.how.groups":
    "Cada linha é uma cor; linhas seguidas com o mesmo código, descrição, tamanho e preço viram um produto só, com as cores juntas.",
  "sheetImport.how.photos":
    "A foto da coluna PHOTO vira a foto original do produto e a do cartão vira o cartão do fornecedor.",
  "sheetImport.how.supplier":
    "Fornecedor que ainda não existe é cadastrado com nome, nº da loja e telefone.",
  "sheetImport.how.missing":
    "No fim, cada produto mostra o que ainda falta (medidas da caixa, fotos da ficha, NCM…).",
  "sheetImport.previous": "Importações anteriores",
  "sheetImport.previous.empty": "Nenhuma importação de ficha técnica ainda.",
  "sheetImport.previous.line": "{created} criado(s) · {updated} atualizado(s) · {errors} erro(s)",
  "sheetImport.result.title": "Importação: {file}",
  "sheetImport.result.summary":
    "{created} produto(s) criado(s), {updated} atualizado(s), {errors} com erro · {suppliers} fornecedor(es) novo(s) · {photos} foto(s)",
  "sheetImport.result.incomplete":
    "{n} produto(s) ainda com informação faltando: abra cada um e complete o que está marcado.",
  "sheetImport.result.allComplete": "Todos os produtos entraram com a ficha completa.",
  "sheetImport.result.product": "Produto",
  "sheetImport.result.photos": "Fotos",
  "sheetImport.result.missing": "O que falta",
  "sheetImport.result.status": "Situação",
  "sheetImport.result.complete": "Ficha completa",
  "sheetImport.result.group": "Grupo {n}",
  "sheetImport.result.again": "Importar outra planilha",
  "sheetImport.result.goList": "Ver produtos",
  "sheetImport.status.created": "Criado",
  "sheetImport.status.updated": "Atualizado",
  "sheetImport.status.error": "Erro",
  "sheetImport.error.xls_format":
    "Arquivo .xls (Excel antigo): abra no Excel, salve como .xlsx e envie de novo.",
  "sheetImport.error.invalid_file": "Não foi possível ler o arquivo: envie a planilha em .xlsx.",
  "sheetImport.error.no_header":
    "Não achei o cabeçalho da ficha (DATE, SUPPLIER NAME, SKU, PRICE, QTY/BOX…). Confira se é o modelo.",
  "sheetImport.error.no_rows": "A planilha não tem linhas de produto preenchidas.",
  "sheetImport.error.too_many": "Muitos produtos de uma vez (máximo 300 por planilha).",
  "sheetImport.error.file_required": "Escolha a planilha.",
  "sheetImport.error.line_required": "Escolha a linha do produto.",
};

export const en = {
  "sheetImport.title": "Import technical sheet",
  "sheetImport.subtitle":
    "Upload the sheet spreadsheet (SUPPLIER INFO template): products are registered at once, with master sheet and photos, and the portal shows what is still missing in each one.",
  "sheetImport.form.title": "Spreadsheet",
  "sheetImport.file": "Spreadsheet (.xlsx)",
  "sheetImport.fileHint":
    "The template with the columns PHOTO, DATE, SUPPLIER NAME, SKU, PRICE, QTY/BOX, N.W, G.W, CBM, SIZE, COLOR, MATERIAL and MOQ. Old .xls file: open it in Excel and save as .xlsx.",
  "sheetImport.line": "Product line",
  "sheetImport.lineHint": "The sheet does not say the line: every product in this import goes into it.",
  "sheetImport.currency": "Price currency",
  "sheetImport.currencyHint": "Used only when the header does not say it (\"PRICE / U$\" already means dollars).",
  "sheetImport.prefix": "Base name (optional)",
  "sheetImport.prefixHint":
    "Goes before the description and the size: \"Photo frame\" becomes \"Photo frame STONE MARBLE A4\".",
  "sheetImport.prefixPlaceholder": "e.g. Photo frame",
  "sheetImport.submit": "Import and register",
  "sheetImport.pending": "Reading the spreadsheet…",
  "sheetImport.how.title": "How the portal reads the sheet",
  "sheetImport.how.body":
    "No column mapping: the portal recognises the template header (in English, Portuguese or Chinese).",
  "sheetImport.how.columns":
    "Price, master carton, inner, weights, CBM, size, packaging, colour, material, function and MOQ go to the product's master sheet.",
  "sheetImport.how.groups":
    "Each row is a colour; consecutive rows with the same code, description, size and price become one product with the colours together.",
  "sheetImport.how.photos":
    "The picture in the PHOTO column becomes the product's original photo and the card picture becomes the supplier's business card.",
  "sheetImport.how.supplier":
    "A supplier that does not exist yet is registered with name, store number and phone.",
  "sheetImport.how.missing":
    "At the end, each product shows what is still missing (carton size, sheet photos, NCM…).",
  "sheetImport.previous": "Previous imports",
  "sheetImport.previous.empty": "No technical-sheet import yet.",
  "sheetImport.previous.line": "{created} created · {updated} updated · {errors} error(s)",
  "sheetImport.result.title": "Import: {file}",
  "sheetImport.result.summary":
    "{created} product(s) created, {updated} updated, {errors} with errors · {suppliers} new supplier(s) · {photos} photo(s)",
  "sheetImport.result.incomplete":
    "{n} product(s) still missing information: open each one and complete what is marked.",
  "sheetImport.result.allComplete": "Every product came in with a complete sheet.",
  "sheetImport.result.product": "Product",
  "sheetImport.result.photos": "Photos",
  "sheetImport.result.missing": "Missing",
  "sheetImport.result.status": "Status",
  "sheetImport.result.complete": "Sheet complete",
  "sheetImport.result.group": "Group {n}",
  "sheetImport.result.again": "Import another spreadsheet",
  "sheetImport.result.goList": "See products",
  "sheetImport.status.created": "Created",
  "sheetImport.status.updated": "Updated",
  "sheetImport.status.error": "Error",
  "sheetImport.error.xls_format":
    ".xls file (old Excel): open it in Excel, save as .xlsx and upload again.",
  "sheetImport.error.invalid_file": "The file could not be read: upload the spreadsheet as .xlsx.",
  "sheetImport.error.no_header":
    "The sheet header was not found (DATE, SUPPLIER NAME, SKU, PRICE, QTY/BOX…). Check that it is the template.",
  "sheetImport.error.no_rows": "The spreadsheet has no filled product rows.",
  "sheetImport.error.too_many": "Too many products at once (maximum 300 per spreadsheet).",
  "sheetImport.error.file_required": "Choose the spreadsheet.",
  "sheetImport.error.line_required": "Choose the product line.",
};

export const zh = {
  "sheetImport.title": "导入产品技术表",
  "sheetImport.subtitle":
    "上传技术表（SUPPLIER INFO 模板）：产品会立即建档，附带主表和照片，门户会显示每个产品还缺什么。",
  "sheetImport.form.title": "表格",
  "sheetImport.file": "表格（.xlsx）",
  "sheetImport.fileHint":
    "包含 PHOTO、DATE、SUPPLIER NAME、SKU、PRICE、QTY/BOX、N.W、G.W、CBM、SIZE、COLOR、MATERIAL、MOQ 等列的模板。旧版 .xls：请在 Excel 中另存为 .xlsx。",
  "sheetImport.line": "产品线",
  "sheetImport.lineHint": "表格中没有产品线：本次导入的所有产品都归入所选产品线。",
  "sheetImport.currency": "价格币种",
  "sheetImport.currencyHint": "仅在表头未注明时使用（\"PRICE / U$\" 已表示美元）。",
  "sheetImport.prefix": "基础名称（可选）",
  "sheetImport.prefixHint": "放在描述和尺寸之前：“相框”变为“相框 STONE MARBLE A4”。",
  "sheetImport.prefixPlaceholder": "例如：相框",
  "sheetImport.submit": "导入并建档",
  "sheetImport.pending": "正在读取表格…",
  "sheetImport.how.title": "门户如何读取表格",
  "sheetImport.how.body": "无需逐列映射：门户自动识别模板表头（英文、葡文或中文）。",
  "sheetImport.how.columns":
    "价格、外箱装量、内盒、重量、CBM、尺寸、包装、颜色、材质、功能和起订量写入产品主表。",
  "sheetImport.how.groups":
    "每行是一种颜色；编码、描述、尺寸和价格相同的连续行合并为一个产品，颜色一并记录。",
  "sheetImport.how.photos": "PHOTO 列的图片成为产品原始照片，名片图片成为供应商名片。",
  "sheetImport.how.supplier": "尚未建档的供应商将按名称、店铺号和电话自动建档。",
  "sheetImport.how.missing": "最后，每个产品都会显示还缺什么（外箱尺寸、主表照片、NCM 等）。",
  "sheetImport.previous": "历史导入",
  "sheetImport.previous.empty": "尚无技术表导入记录。",
  "sheetImport.previous.line": "新建 {created} · 更新 {updated} · 错误 {errors}",
  "sheetImport.result.title": "导入：{file}",
  "sheetImport.result.summary":
    "新建 {created} 个产品，更新 {updated} 个，{errors} 个出错 · 新增供应商 {suppliers} 个 · 照片 {photos} 张",
  "sheetImport.result.incomplete": "{n} 个产品仍缺少信息：请逐个打开并补全标记项。",
  "sheetImport.result.allComplete": "所有产品的主表均已完整。",
  "sheetImport.result.product": "产品",
  "sheetImport.result.photos": "照片",
  "sheetImport.result.missing": "缺少",
  "sheetImport.result.status": "状态",
  "sheetImport.result.complete": "主表完整",
  "sheetImport.result.group": "第 {n} 组",
  "sheetImport.result.again": "导入另一个表格",
  "sheetImport.result.goList": "查看产品",
  "sheetImport.status.created": "已新建",
  "sheetImport.status.updated": "已更新",
  "sheetImport.status.error": "错误",
  "sheetImport.error.xls_format": ".xls 文件（旧版 Excel）：请在 Excel 中另存为 .xlsx 后重新上传。",
  "sheetImport.error.invalid_file": "无法读取文件：请上传 .xlsx 表格。",
  "sheetImport.error.no_header":
    "未找到技术表表头（DATE、SUPPLIER NAME、SKU、PRICE、QTY/BOX…）。请确认是否为模板。",
  "sheetImport.error.no_rows": "表格中没有已填写的产品行。",
  "sheetImport.error.too_many": "一次产品过多（每个表格最多 300 个）。",
  "sheetImport.error.file_required": "请选择表格。",
  "sheetImport.error.line_required": "请选择产品线。",
};
