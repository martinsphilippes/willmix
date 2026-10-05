/**
 * Dicionário do módulo "sheet-records" (bloco Fornecedor da ficha vem dos
 * cadastros do fornecedor e do produto): mesmas chaves em pt, en e zh.
 */
export const pt = {
  "sheet.records.hint":
    "Local, nº da loja e telefone vêm do cadastro do fornecedor; o código do item, do cadastro do produto. O que faltar no cadastro é gravado nele ao salvar esta ficha.",
  "sheet.records.hintReadOnly":
    "Local, nº da loja e telefone vêm do cadastro do fornecedor; o código do item, do cadastro do produto.",
  "sheet.records.missing": "Faltam no cadastro: {fields}.",
  "sheet.records.complete": "Cadastro do fornecedor e do produto completos.",
  "sheet.records.supplierComplete":
    "Cadastro do fornecedor completo (o código do item vale só para produto deste fornecedor).",
  "sheet.records.editSupplier": "Completar cadastro do fornecedor",
  "sheet.records.editProduct": "Completar cadastro do produto",
  "catalog.party.storeNumber": "Nº da loja no mercado",
  "catalog.party.storeNumberHint":
    'Ex.: Yiwu A 154678. Vai para o campo "Nº da loja" da ficha de compra deste fornecedor.',
};

export const en: Record<keyof typeof pt, string> = {
  "sheet.records.hint":
    "Location, store number and phone come from the supplier record; the factory item code, from the product record. Whatever the record lacks is written to it when this sheet is saved.",
  "sheet.records.hintReadOnly":
    "Location, store number and phone come from the supplier record; the factory item code, from the product record.",
  "sheet.records.missing": "Missing in the record: {fields}.",
  "sheet.records.complete": "Supplier and product records are complete.",
  "sheet.records.supplierComplete":
    "Supplier record complete (the item code only applies to this supplier's own product).",
  "sheet.records.editSupplier": "Complete the supplier record",
  "sheet.records.editProduct": "Complete the product record",
  "catalog.party.storeNumber": "Market store number",
  "catalog.party.storeNumberHint":
    'E.g. Yiwu A 154678. Goes into the "Store number" field of this supplier\'s purchase sheet.',
};

export const zh: Record<keyof typeof pt, string> = {
  "sheet.records.hint":
    "地点、店铺号和电话来自供应商档案；工厂货号来自产品档案。档案中缺少的内容会在保存此采购单时写入档案。",
  "sheet.records.hintReadOnly":
    "地点、店铺号和电话来自供应商档案；工厂货号来自产品档案。",
  "sheet.records.missing": "档案中缺少：{fields}。",
  "sheet.records.complete": "供应商和产品档案已完整。",
  "sheet.records.supplierComplete":
    "供应商档案已完整（工厂货号仅适用于该供应商自己的产品）。",
  "sheet.records.editSupplier": "补全供应商档案",
  "sheet.records.editProduct": "补全产品档案",
  "catalog.party.storeNumber": "市场店铺号",
  "catalog.party.storeNumberHint":
    "例：义乌 A 154678。将填入该供应商采购单的“店铺号”字段。",
};
