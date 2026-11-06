/**
 * Dicionário do módulo "products-list" (tela Produtos: foto, categoria,
 * código do fornecedor, observações, busca, filtros e CSV): mesmas chaves
 * em pt, en e zh.
 */
export const pt = {
  "prodList.search":
    "Buscar por nome, SKU, código do fornecedor, categoria ou observação",
  "prodList.searchButton": "Buscar",
  "prodList.allLines": "Todas as linhas",
  "prodList.allSuppliers": "Todos os fornecedores",
  "prodList.clear": "Limpar",
  "prodList.export": "Exportar (CSV)",
  "prodList.new": "Novo produto",
  "prodList.total": "{n} produto(s)",
  "prodList.empty": "Nenhum produto nesta busca ou filtro.",
  "prodList.col.photo": "Foto",
  "prodList.col.category": "Categoria",
  "prodList.col.supplierSku": "Cód. do fornecedor",
  "prodList.col.material": "Material / cor",
  "prodList.col.box": "Caixa master",
  "prodList.col.notes": "Observações",
  "prodList.col.actions": "Ações",
  "prodList.edit": "Editar a ficha do produto",
  "prodList.noPhoto": "Sem foto",
  "prodList.boxQty": "{n} un/cx",
  "prodList.csv.header":
    "Nome;SKU;Categoria;Cód. do fornecedor;Linha;Fornecedor;Preço;Moeda;MOQ;Un. por caixa;CBM por caixa;Material;Cor;Observações;NCM;Origem",
};

export const en: Record<keyof typeof pt, string> = {
  "prodList.search": "Search by name, SKU, supplier code, category or note",
  "prodList.searchButton": "Search",
  "prodList.allLines": "All lines",
  "prodList.allSuppliers": "All suppliers",
  "prodList.clear": "Clear",
  "prodList.export": "Export (CSV)",
  "prodList.new": "New product",
  "prodList.total": "{n} product(s)",
  "prodList.empty": "No product in this search or filter.",
  "prodList.col.photo": "Photo",
  "prodList.col.category": "Category",
  "prodList.col.supplierSku": "Supplier code",
  "prodList.col.material": "Material / color",
  "prodList.col.box": "Master carton",
  "prodList.col.notes": "Notes",
  "prodList.col.actions": "Actions",
  "prodList.edit": "Edit the product sheet",
  "prodList.noPhoto": "No photo",
  "prodList.boxQty": "{n} pcs/ctn",
  "prodList.csv.header":
    "Name;SKU;Category;Supplier code;Line;Supplier;Price;Currency;MOQ;Pcs per carton;CBM per carton;Material;Color;Notes;NCM;Source",
};

export const zh: Record<keyof typeof pt, string> = {
  "prodList.search": "按名称、SKU、工厂货号、分类或备注搜索",
  "prodList.searchButton": "搜索",
  "prodList.allLines": "全部产品线",
  "prodList.allSuppliers": "全部供应商",
  "prodList.clear": "清除",
  "prodList.export": "导出 (CSV)",
  "prodList.new": "新增产品",
  "prodList.total": "共 {n} 个产品",
  "prodList.empty": "该搜索或筛选下没有产品。",
  "prodList.col.photo": "图片",
  "prodList.col.category": "分类",
  "prodList.col.supplierSku": "工厂货号",
  "prodList.col.material": "材质 / 颜色",
  "prodList.col.box": "外箱",
  "prodList.col.notes": "备注",
  "prodList.col.actions": "操作",
  "prodList.edit": "编辑产品资料",
  "prodList.noPhoto": "无图片",
  "prodList.boxQty": "{n} 件/箱",
  "prodList.csv.header":
    "名称;SKU;分类;工厂货号;产品线;供应商;价格;币种;起订量;每箱数量;每箱体积;材质;颜色;备注;NCM;来源",
};
