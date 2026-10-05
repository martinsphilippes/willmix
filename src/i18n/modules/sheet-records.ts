/**
 * Dicionário do módulo "sheet-records" (bloco Fornecedor da ficha vem dos
 * cadastros do fornecedor e do produto): mesmas chaves em pt, en e zh.
 */
export const pt = {
  "sheet.records.hint":
    "Local, nº da loja e telefone vêm do cadastro do fornecedor; o código do item, do cadastro do produto. O que faltar no cadastro é gravado nele ao salvar esta ficha.",
  "sheet.records.missing": "Faltam no cadastro: {fields}.",
  "sheet.records.complete": "Cadastro do fornecedor e do produto completos.",
  "sheet.records.editSupplier": "Completar cadastro do fornecedor",
  "sheet.records.editProduct": "Completar cadastro do produto",
  "catalog.party.storeNumber": "Nº da loja (Yiwu)",
  "catalog.party.storeNumberHint":
    'Vai para o campo "Nº da loja" da ficha de compra deste fornecedor.',
};

export const en: Record<keyof typeof pt, string> = {
  "sheet.records.hint":
    "Location, store number and phone come from the supplier record; the factory item code, from the product record. Whatever the record lacks is written to it when this sheet is saved.",
  "sheet.records.missing": "Missing in the record: {fields}.",
  "sheet.records.complete": "Supplier and product records are complete.",
  "sheet.records.editSupplier": "Complete the supplier record",
  "sheet.records.editProduct": "Complete the product record",
  "catalog.party.storeNumber": "Store number (Yiwu)",
  "catalog.party.storeNumberHint":
    'Goes into the "Store number" field of this supplier\'s purchase sheet.',
};

export const zh: Record<keyof typeof pt, string> = {
  "sheet.records.hint":
    "地点、店铺号和电话来自供应商档案；工厂货号来自产品档案。档案中缺少的内容会在保存此采购单时写入档案。",
  "sheet.records.missing": "档案中缺少：{fields}。",
  "sheet.records.complete": "供应商和产品档案已完整。",
  "sheet.records.editSupplier": "补全供应商档案",
  "sheet.records.editProduct": "补全产品档案",
  "catalog.party.storeNumber": "店铺号（义乌）",
  "catalog.party.storeNumberHint": "将填入该供应商采购单的“店铺号”字段。",
};
