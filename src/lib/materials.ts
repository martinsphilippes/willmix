/*
 * Catálogo de materiais (dono, 21/11/2026; docs/PURCHASE_DEMAND.md,
 * "Inner do cliente, material do catálogo e Sem peso"). Puro: a lista
 * inicial, a chave de busca e a leitura de um texto de composição.
 *
 * A lista inicial é a "Composição:" dos produtos ativos do Sankhya
 * (8.019 produtos, 654 textos, ~255 grafias), unificada: grafias diferentes
 * do mesmo material ("plástico", "plastico", "plático") viram um material
 * só, com as grafias como apelidos. O Cadastro ajusta depois, na tela.
 */

export interface MaterialSeed {
  pt: string;
  en: string;
  zh: string;
  /** Outras grafias da Composição que são este material. */
  aliases?: readonly string[];
}

/** Sem acento, minúsculas, espaços simples e sem pontuação nas pontas. */
export function materialKey(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[\t\s]+/g, " ")
    .replace(/^[\s.;:,]+|[\s.;:,]+$/g, "")
    .trim();
}

/**
 * Id fixo de um material da lista inicial ("Polipropileno (PP)" →
 * "mat-polipropileno-pp"): o mesmo em todo banco, para a carga não repetir.
 * Os incluídos depois pelo Cadastro ganham id comum.
 */
export function materialSeedId(pt: string): string {
  return `mat-${materialKey(pt)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")}`.slice(0, 60);
}

export const MATERIAL_SEED: readonly MaterialSeed[] = [
  // Plásticos
  {
    pt: "Plástico",
    en: "Plastic",
    zh: "塑料",
    aliases: ["plastic", "plasticos", "plastica", "plastio", "platico"],
  },
  {
    pt: "Polipropileno (PP)",
    en: "Polypropylene (PP)",
    zh: "聚丙烯 (PP)",
    aliases: [
      "polipropileno",
      "pp",
      "plastico polipropileno",
      "pp (plastico polipropileno)",
      "platico polipropileno",
      "plastico pp",
      "plastico polpropileno",
      "plastico poliproprileno",
      "plastico propileno",
    ],
  },
  {
    pt: "Poliestireno (PS)",
    en: "Polystyrene (PS)",
    zh: "聚苯乙烯 (PS)",
    aliases: [
      "poliestireno",
      "ps",
      "plastico poliestireno",
      "ps (plastico poliestireno)",
      "plastico ps",
      "plasrtico poliestireno",
      "plasticos poliestireno",
    ],
  },
  {
    pt: "Poliestireno de alto impacto (HIPS)",
    en: "High-impact polystyrene (HIPS)",
    zh: "高抗冲聚苯乙烯 (HIPS)",
    aliases: [
      "hips",
      "hips (poliestireno de alto impacto)",
      "hips (poliestireno alto impacto)",
      "poliestireno de alto impacto",
      "poliestireno de alto impacto (hips)",
    ],
  },
  {
    pt: "PVC (policloreto de vinila)",
    en: "PVC (polyvinyl chloride)",
    zh: "PVC（聚氯乙烯）",
    aliases: [
      "pvc",
      "policloreto de vinila",
      "pvc (policloreto de vinil)",
      "vinil",
      "vinil atoxico de alta densidade",
    ],
  },
  {
    pt: "ABS (acrilonitrila butadieno estireno)",
    en: "ABS (acrylonitrile butadiene styrene)",
    zh: "ABS（丙烯腈-丁二烯-苯乙烯）",
    aliases: [
      "abs",
      "acrilonitrila butadieno estireno",
      "acrilonitrila butadieno e estireno",
      "acrilontrila butadieno estireno",
      "acrilontrila butadieno e estireno",
      "abs (acrilonitrila butadieno estireno",
      "plastico abs (acrilonitrila butadieno estireno)",
    ],
  },
  {
    pt: "Polietileno (PE)",
    en: "Polyethylene (PE)",
    zh: "聚乙烯 (PE)",
    aliases: ["polietileno", "pe", "plastico polietileno", "pe (plastico polietileno)"],
  },
  {
    pt: "PET (polietileno tereftalato)",
    en: "PET (polyethylene terephthalate)",
    zh: "PET（聚对苯二甲酸乙二醇酯）",
    aliases: [
      "pet",
      "pet (politereflalato de etileno)",
      "pet (polimero politereftalato de etileno)",
    ],
  },
  {
    pt: "Policarbonato (PC)",
    en: "Polycarbonate (PC)",
    zh: "聚碳酸酯 (PC)",
    aliases: ["policarbonato", "pc", "pc (policarbonato)"],
  },
  {
    pt: "Acrílico",
    en: "Acrylic",
    zh: "亚克力",
    aliases: ["as (acrilico)"],
  },
  {
    pt: "Melamina",
    en: "Melamine",
    zh: "密胺",
    aliases: ["plastico melamina"],
  },
  {
    pt: "Poliuretano (PU)",
    en: "Polyurethane (PU)",
    zh: "聚氨酯 (PU)",
    aliases: ["poliuretano", "pu", "pu (poliuretano)", "poliuterano"],
  },
  {
    pt: "EVA (etileno acetato de vinila)",
    en: "EVA (ethylene-vinyl acetate)",
    zh: "EVA（乙烯-醋酸乙烯酯）",
    aliases: [
      "eva",
      "eva (etileno vinil acetato)",
      "eva (acetato de vinila)",
      "eva (etileno-acetato de vinila)",
    ],
  },
  {
    pt: "TPR (borracha termoplástica)",
    en: "TPR (thermoplastic rubber)",
    zh: "TPR（热塑性橡胶）",
    aliases: [
      "tpr",
      "borracha termoplastica",
      "borracha termoplastica (tpr)",
      "tpr (borracha termoplastica)",
    ],
  },
  {
    pt: "TPE (elastômero termoplástico)",
    en: "TPE (thermoplastic elastomer)",
    zh: "TPE（热塑性弹性体）",
    aliases: ["tpe", "tpe (borracha termoplastica)"],
  },
  { pt: "Silicone", en: "Silicone", zh: "硅胶" },
  {
    pt: "Borracha",
    en: "Rubber",
    zh: "橡胶",
    aliases: ["borracha latex", "latex"],
  },
  {
    pt: "Nylon (poliamida)",
    en: "Nylon (polyamide)",
    zh: "尼龙",
    aliases: ["nylon", "poliamida"],
  },
  {
    pt: "Poliéster",
    en: "Polyester",
    zh: "聚酯（涤纶）",
    aliases: ["poliester", "plastico poliester"],
  },
  {
    pt: "EPE (polietileno expandido)",
    en: "EPE (expanded polyethylene foam)",
    zh: "EPE 珍珠棉",
    aliases: ["epe", "polietileno expandido"],
  },
  {
    pt: "EPP (polipropileno expandido)",
    en: "EPP (expanded polypropylene)",
    zh: "EPP（发泡聚丙烯）",
    aliases: ["epp", "polipropileno expandido"],
  },
  {
    pt: "Isopor (EPS)",
    en: "Expanded polystyrene (EPS)",
    zh: "发泡聚苯乙烯 (EPS)",
    aliases: ["isopor", "eps"],
  },
  { pt: "Espuma", en: "Foam", zh: "泡沫" },
  {
    pt: "Resina",
    en: "Resin",
    zh: "树脂",
    aliases: ["resina sintetica"],
  },
  {
    pt: "Celuloide (acetato de celulose)",
    en: "Celluloid (cellulose acetate)",
    zh: "赛璐珞（醋酸纤维）",
    aliases: ["celuloide", "acetato de celuloide", "acetato de celulose"],
  },
  {
    pt: "BOPP",
    en: "BOPP film",
    zh: "BOPP 薄膜",
    aliases: ["bopp"],
  },
  // Vidro e cerâmica
  {
    pt: "Vidro",
    en: "Glass",
    zh: "玻璃",
    aliases: ["lentes de vidro"],
  },
  {
    pt: "Vidro borossilicato",
    en: "Borosilicate glass",
    zh: "高硼硅玻璃",
    aliases: ["vidro de borossilicato"],
  },
  {
    pt: "Vidro sodalime",
    en: "Soda-lime glass",
    zh: "钠钙玻璃",
    aliases: ["vidro soda-lime", "vidro soda lime"],
  },
  {
    pt: "Vidro cristal",
    en: "Crystal glass",
    zh: "水晶玻璃",
    aliases: ["vidro cristal ecologico", "cristal"],
  },
  { pt: "Cerâmica", en: "Ceramic", zh: "陶瓷" },
  { pt: "Baquelite", en: "Bakelite", zh: "电木" },
  // Metais
  { pt: "Metal", en: "Metal", zh: "金属" },
  {
    pt: "Componentes metálicos",
    en: "Metal components",
    zh: "金属配件",
    aliases: ["componente metalicos", "componentes metalico"],
  },
  {
    pt: "Aço inox",
    en: "Stainless steel",
    zh: "不锈钢",
    aliases: ["inox", "aco inoxidavel", "aco inox"],
  },
  { pt: "Aço", en: "Steel", zh: "钢" },
  { pt: "Aço carbono", en: "Carbon steel", zh: "碳钢" },
  { pt: "Ferro", en: "Iron", zh: "铁" },
  {
    pt: "Alumínio",
    en: "Aluminium",
    zh: "铝",
    aliases: ["aluminium", "aluminion", "aluminum"],
  },
  { pt: "Ímã", en: "Magnet", zh: "磁铁", aliases: ["ima"] },
  // Eletrônicos
  {
    pt: "Componentes eletrônicos",
    en: "Electronic components",
    zh: "电子元件",
    aliases: [
      "componentes eletronico",
      "componente eletronicos",
      "componetes eletronicos",
      "componenntes eletronicos",
      "ccomponentes eletronicos",
    ],
  },
  { pt: "LED", en: "LED", zh: "LED" },
  { pt: "LCD", en: "LCD", zh: "液晶屏 (LCD)" },
  // Papel, madeira e fibras naturais
  { pt: "Papel", en: "Paper", zh: "纸" },
  { pt: "Papel adesivo", en: "Adhesive paper", zh: "不干胶纸" },
  { pt: "Madeira", en: "Wood", zh: "木材" },
  {
    pt: "MDF",
    en: "MDF (medium-density fibreboard)",
    zh: "中密度纤维板 (MDF)",
    aliases: ["mdf (medium density fiberboard)"],
  },
  { pt: "Bambu", en: "Bamboo", zh: "竹" },
  { pt: "Fibra de coco", en: "Coconut fibre", zh: "椰棕" },
  { pt: "Palha", en: "Straw", zh: "稻草" },
  { pt: "Ráfia", en: "Raffia", zh: "拉菲草" },
  // Têxteis
  {
    pt: "Tecido",
    en: "Fabric",
    zh: "布料",
    aliases: ["fibra textil", "fibras texteis"],
  },
  { pt: "Algodão", en: "Cotton", zh: "棉" },
  { pt: "Feltro", en: "Felt", zh: "毛毡" },
  { pt: "Cetim", en: "Satin", zh: "缎面" },
  {
    pt: "TNT (não tecido)",
    en: "Non-woven fabric",
    zh: "无纺布",
    aliases: ["tnt", "nao tecido"],
  },
  { pt: "Fibra siliconizada", en: "Siliconised fibre", zh: "硅化纤维棉" },
  { pt: "Elástico", en: "Elastic", zh: "松紧带" },
  { pt: "Couro", en: "Leather", zh: "皮革" },
  { pt: "Pena", en: "Feather", zh: "羽毛" },
  // Outros
  { pt: "Parafina", en: "Paraffin wax", zh: "石蜡" },
  { pt: "Cera", en: "Wax", zh: "蜡" },
  { pt: "Água em gel", en: "Water gel", zh: "水凝胶" },
  { pt: "Corante", en: "Colorant", zh: "色素" },
];

/** O que a tela e o servidor precisam de um material. */
export interface MaterialOption {
  id: string;
  namePt: string;
  nameEn: string;
  nameZh: string;
  nameKey: string;
  active: boolean;
}

/** O nome no idioma da tela (o português quando falta a tradução). */
export function materialName(
  m: Pick<MaterialOption, "namePt" | "nameEn" | "nameZh">,
  locale: string,
): string {
  if (locale.startsWith("zh")) return m.nameZh || m.namePt;
  if (locale.startsWith("en")) return m.nameEn || m.namePt;
  return m.namePt;
}

/**
 * Os materiais escolhidos por extenso ("Plástico / Papel"), na ordem da
 * escolha; os que não estão no catálogo ficam de fora.
 */
export function materialsText(
  ids: readonly string[],
  catalog: ReadonlyMap<string, Pick<MaterialOption, "namePt" | "nameEn" | "nameZh">>,
  locale = "pt",
): string {
  return ids
    .map((id) => catalog.get(id))
    .filter((m): m is NonNullable<typeof m> => !!m)
    .map((m) => materialName(m, locale))
    .join(" / ");
}

/** Partes de um texto de composição ("Aço inox e plástico / Papel"). */
export function compositionParts(text: string): string[] {
  return text
    .split(/\s*(?:\/|,|;|\+|\s+e\s+|\s+and\s+)\s*/i)
    .map((p) => materialKey(p))
    .filter(Boolean);
}

/**
 * Os materiais do catálogo que um texto de composição cita (pelo nome em
 * qualquer idioma ou por uma grafia conhecida). O que não bate fica em
 * `unknown`, para quem revisa ver; nada é inventado.
 */
export function matchMaterials(
  text: string | null | undefined,
  catalog: readonly MaterialOption[],
  aliases: ReadonlyMap<string, string> = SEED_ALIASES,
): { ids: string[]; unknown: string[] } {
  const byKey = new Map<string, string>();
  for (const m of catalog) {
    if (!m.active) continue;
    for (const name of [m.namePt, m.nameEn, m.nameZh])
      if (name) byKey.set(materialKey(name), m.id);
  }
  const byNameKey = new Map(catalog.filter((m) => m.active).map((m) => [m.nameKey, m.id]));
  const ids: string[] = [];
  const unknown: string[] = [];
  for (const part of compositionParts(text ?? "")) {
    const id =
      byKey.get(part) ??
      (aliases.has(part) ? byNameKey.get(aliases.get(part)!) : undefined);
    if (id) {
      if (!ids.includes(id)) ids.push(id);
    } else unknown.push(part);
  }
  return { ids, unknown };
}

/** Grafia conhecida → chave do material da lista inicial. */
export const SEED_ALIASES: ReadonlyMap<string, string> = new Map(
  MATERIAL_SEED.flatMap((m) =>
    (m.aliases ?? []).map((a) => [materialKey(a), materialKey(m.pt)] as const),
  ),
);
