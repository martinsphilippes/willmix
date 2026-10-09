/**
 * Dicionário do módulo "pantone" (cores Pantone com RGB na ficha de compra):
 * mesmas chaves em pt, en e zh.
 */
export const pt = {
  "pantone.label": "Cores Pantone",
  "pantone.hint":
    "Escolha as cores do produto pela tabela Pantone, com o RGB de cada uma. Valores aproximados em tela: a referência oficial é o leque físico.",
  "pantone.search":
    "Buscar por número ou nome (ex.: 185, Reflex Blue, 19-4052)",
  "pantone.scale.all": "Todas as escalas",
  "pantone.scale.C": "Solid Coated (C)",
  "pantone.scale.U": "Solid Uncoated (U)",
  "pantone.scale.M": "Metallics",
  "pantone.scale.P": "Pastels & Neons",
  "pantone.scale.TCX": "Fashion, Home + Interiors (TCX)",
  "pantone.loading": "Carregando a tabela de cores…",
  "pantone.none": "Nenhuma cor encontrada.",
  "pantone.more": "Mostrando as primeiras {n}; refine a busca.",
  "pantone.remove": "Remover",
  "pantone.max": "No máximo {n} cores por ficha.",
  "pantone.selected": "{n} cor(es) escolhida(s)",
  "pantone.empty": "Nenhuma cor Pantone escolhida.",
  "pantone.productHint":
    "Escolha pela tabela Pantone, com o RGB de cada cor. O texto Pantone e, se estiver vazia, a Cor recebem os códigos; a ficha mestre acompanha.",
  "sheet.error.pantone_too_many": "No máximo 20 cores Pantone por ficha.",
  "sheet.error.schema_outdated":
    "O banco ainda não tem a coluna nova desta ficha. Publique o esquema Appwrite (GitHub → Publicar esquema Appwrite) e salve de novo.",
};

export const en: Record<keyof typeof pt, string> = {
  "pantone.label": "Pantone colors",
  "pantone.hint":
    "Pick the product colors from the Pantone table, with the RGB of each one. On-screen approximations: the physical guide is the official reference.",
  "pantone.search": "Search by number or name (e.g. 185, Reflex Blue, 19-4052)",
  "pantone.scale.all": "All scales",
  "pantone.scale.C": "Solid Coated (C)",
  "pantone.scale.U": "Solid Uncoated (U)",
  "pantone.scale.M": "Metallics",
  "pantone.scale.P": "Pastels & Neons",
  "pantone.scale.TCX": "Fashion, Home + Interiors (TCX)",
  "pantone.loading": "Loading the color table…",
  "pantone.none": "No color found.",
  "pantone.more": "Showing the first {n}; refine the search.",
  "pantone.remove": "Remove",
  "pantone.max": "At most {n} colors per sheet.",
  "pantone.selected": "{n} color(s) selected",
  "pantone.empty": "No Pantone color selected.",
  "pantone.productHint":
    "Pick from the Pantone table, with each color's RGB. The Pantone text and, when empty, the Color get the codes; the master sheet follows.",
  "sheet.error.pantone_too_many": "At most 20 Pantone colors per sheet.",
  "sheet.error.schema_outdated":
    "The database does not have this sheet's new column yet. Publish the Appwrite schema (GitHub → Publicar esquema Appwrite) and save again.",
};

export const zh: Record<keyof typeof pt, string> = {
  "pantone.label": "Pantone 颜色",
  "pantone.hint":
    "从 Pantone 色表中选择产品颜色，并显示每种颜色的 RGB。屏幕显示为近似值，以实体色卡为准。",
  "pantone.search": "按编号或名称搜索（例如 185、Reflex Blue、19-4052）",
  "pantone.scale.all": "全部色系",
  "pantone.scale.C": "Solid Coated (C)",
  "pantone.scale.U": "Solid Uncoated (U)",
  "pantone.scale.M": "Metallics（金属色）",
  "pantone.scale.P": "Pastels & Neons（粉彩与荧光）",
  "pantone.scale.TCX": "Fashion, Home + Interiors (TCX)",
  "pantone.loading": "正在加载色表…",
  "pantone.none": "未找到颜色。",
  "pantone.more": "仅显示前 {n} 条，请缩小搜索范围。",
  "pantone.remove": "移除",
  "pantone.max": "每张采购单最多 {n} 种颜色。",
  "pantone.selected": "已选择 {n} 种颜色",
  "pantone.empty": "尚未选择 Pantone 颜色。",
  "pantone.productHint":
    "从 Pantone 色表中选择，并显示每种颜色的 RGB。Pantone 文本以及（为空时）颜色字段将填入色号；主采购单同步。",
  "sheet.error.pantone_too_many": "每张采购单最多 20 种 Pantone 颜色。",
  "sheet.error.schema_outdated":
    "数据库尚无此采购单的新字段。请先发布 Appwrite 架构（GitHub → Publicar esquema Appwrite）后重新保存。",
};
