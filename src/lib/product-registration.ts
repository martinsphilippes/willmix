import { parseNumberInput } from "@/lib/number-input";

/*
 * Cadastrar produto (dono, 26/11/2026; docs/PRODUCT_REGISTRATION.md): o
 * produto que veio do book e foi aprovado na cotação ganha o cadastro do
 * Sankhya no portal, com todos os campos da tela "Produto" do Sankhya (aba
 * Compras) e as 72 colunas da planilha de cadastro da Wellmix, já
 * preenchidos com o que o processo juntou (book, seleção, negociação e
 * amostra). Daqui o cadastro vai ao Sankhya pela API (DatasetSP.save na
 * entidade Produto, TGFPRO).
 *
 * Regra pura: o catálogo de campos, o de-para com as colunas da TGFPRO e a
 * conversão dos valores. Sem banco e sem rede.
 *
 * De-para: os campos padrão da TGFPRO têm a coluna conhecida (DESCRPROD,
 * REFFORN, NCM...). Os personalizados (AD_*) do Sankhya da Wellmix não estão
 * no código: a coluna é achada no dicionário do Sankhya (TDDCAM) pela
 * descrição do campo, a mesma da tela do Sankhya ("Gerente de Produto",
 * "Factory Code"...) ou o cabeçalho da planilha. O administrador corrige um
 * campo que não for achado (ou for achado errado) na própria tela.
 */

export const REGISTRATION_SECTIONS = [
  "identity",
  "group",
  "supplier",
  "status",
  "certs",
  "features",
  "power",
  "packing",
  "measures",
  "master",
  "inner",
  "fiscal",
  "other",
] as const;
export type RegistrationSection = (typeof REGISTRATION_SECTIONS)[number];

export type RegistrationFieldType =
  /** Texto de uma linha. */
  | "text"
  /** Texto longo (várias linhas). */
  | "longtext"
  /** Número com decimais (medidas, pesos, CBM). */
  | "number"
  /** Número inteiro (peças, dias, idade). */
  | "int"
  /** Sim ou Não (as chaves do Sankhya): vai como "S" ou "N". */
  | "yesno"
  /** Data (vai como DD/MM/AAAA). */
  | "date"
  /** Código de outra tabela do Sankhya, com o nome ao lado (só na tela). */
  | "code"
  /** Linha de produto do portal: leva o grupo do Sankhya (CODGRUPOPROD). */
  | "line";

export interface RegistrationField {
  id: string;
  section: RegistrationSection;
  type: RegistrationFieldType;
  /** Coluna da TGFPRO já conhecida (campo padrão ou AD_ lido na carga). */
  column?: string;
  /**
   * Como o campo se chama no Sankhya e na planilha: a coluna é procurada no
   * dicionário (TDDCAM.DESCRCAMPO) por estes nomes.
   */
  labels: readonly string[];
  /**
   * Obrigatório: "portal" para gravar o produto no portal; "sankhya" para
   * enviar ao Sankhya (o asterisco da tela dele).
   */
  required?: "portal" | "sankhya";
  /** Unidade mostrada ao lado do número. */
  unit?: "m" | "kg" | "m3" | "days" | "pcs" | "ml";
  /** Valor de partida (S/N ou a unidade). */
  initial?: string;
  max?: number;
}

const f = (
  id: string,
  section: RegistrationSection,
  type: RegistrationFieldType,
  labels: readonly string[],
  extra: Partial<RegistrationField> = {},
): RegistrationField => ({ id, section, type, labels, ...extra });

const yes = (
  id: string,
  section: RegistrationSection,
  labels: readonly string[],
  initial: "S" | "N" = "N",
  extra: Partial<RegistrationField> = {},
) => f(id, section, "yesno", labels, { initial, ...extra });

/**
 * Os campos, na ordem da tela: os da tela do Sankhya (aba Compras) e os da
 * planilha de cadastro (CADASTRO, colunas A a BT). Cada coluna da planilha
 * tem o seu campo; os dois nomes ficam em `labels`.
 */
export const REGISTRATION_FIELDS: readonly RegistrationField[] = [
  // Identificação.
  f(
    "descrPt",
    "identity",
    "text",
    ["Descrição", "Descrição do Produto", "DESCRIÇÃO PORTUGUÊS"],
    { column: "DESCRPROD", required: "portal", max: 160 },
  ),
  f("descrEn", "identity", "text", ["Descrição Inglês", "DESCRIÇÃO INGLÊS"], {
    max: 250,
  }),
  f("descrSale", "identity", "text", ["Descrição Venda", "DESCRIÇÃO VENDA"], {
    max: 250,
  }),
  f("brand", "identity", "text", ["Marca", "NOME DA MARCA"], {
    column: "MARCA",
    required: "sankhya",
    max: 60,
  }),
  f("brandWellmix", "identity", "code", ["Marca Wellmix"], {
    column: "AD_CODMARCAWELL",
    max: 20,
  }),
  f(
    "productManager",
    "identity",
    "text",
    ["Gerente de Produto", "GERENTE DE PRODUTO"],
    { max: 120 },
  ),
  f(
    "seasonality",
    "identity",
    "text",
    ["Sazonalidade", "SAZONALIDADE (PREENCHER: NATAL,CRIANÇAS)"],
    { max: 120 },
  ),
  yes("hotsell", "identity", ["Hotsell", "HOTSELL (S/N)"]),
  yes("combat", "identity", ["Combate", "COMBATE (S/N)"]),
  // Grupo e linha.
  f("lineId", "group", "line", ["Grupo", "CÓDIGO DO GRUPO"], {
    column: "CODGRUPOPROD",
    required: "portal",
  }),
  f(
    "productLine",
    "group",
    "code",
    ["Cód.Linha", "Cód. Linha", "Código da Linha", "Linha", "NOME DA LINHA"],
    { max: 20 },
  ),
  // Fornecedor e origem.
  f("supplierName", "supplier", "text", ["Fornecedor", "FORNECEDOR"], {
    max: 160,
  }),
  f(
    "supplierCode",
    "supplier",
    "code",
    [
      "Parceiro Fornecedor",
      "Fornecedor Preferencial",
      "CÓDIGO PARCEIRO FORNECEDOR PREFERENCIAL",
    ],
    { column: "CODPARCFORN", max: 12 },
  ),
  f(
    "supplierContact",
    "supplier",
    "text",
    ["Fornec.Adress Phone", "Fornec. Adress/Phone", "FORNEC. ADRESS/PHONE"],
    { max: 250 },
  ),
  f(
    "factoryCode",
    "supplier",
    "text",
    ["Factory Code", "CÓDIGO FABRICA (PRODUTO)", "Código Fábrica"],
    { max: 60 },
  ),
  f(
    "supplierRef",
    "supplier",
    "text",
    ["Referência do Fornecedor", "CÓDIGO FABRICANTE", "Código Fabricante"],
    { column: "REFFORN", required: "sankhya", max: 60 },
  ),
  f("country", "supplier", "code", ["País de origem", "País"], {
    column: "CODPAIS",
    max: 12,
  }),
  f(
    "port",
    "supplier",
    "code",
    ["Porto de embarque", "Porto Preferencial", "PORTO DE EMBARQUE"],
    { column: "AD_IDPORTO", max: 12 },
  ),
  f(
    "leadTime",
    "supplier",
    "int",
    ["Lead time de compra", "LEAD TIME DE COMPRA (EX: 90)", "Lead Time"],
    { unit: "days" },
  ),
  f("company", "supplier", "int", ["Empresa", "EMPRESA"]),
  // Unidades e situação.
  f("unit", "status", "code", ["Unidade padrão", "Unidade"], {
    column: "CODVOL",
    required: "sankhya",
    initial: "UN",
    max: 6,
  }),
  f("purchaseUnit", "status", "code", ["Unid. Compra", "Unidade de Compra"], {
    column: "CODVOLCOMPRA",
    initial: "UN",
    max: 6,
  }),
  yes("discontinued", "status", ["Descontinuado"], "N", {
    column: "AD_DESCONTINUADO",
  }),
  f("discontinuedReason", "status", "text", ["Motivo Descontinuado"], {
    max: 250,
  }),
  f("discontinuedAt", "status", "date", ["Data Descontinuado"]),
  yes(
    "requestsPurchase",
    "status",
    ["Solicita compra?", "Solicita compra"],
    "S",
  ),
  yes(
    "canTrade",
    "status",
    [
      "Permite comprar/vender este produto?",
      "Permite comprar/vender este produto",
    ],
    "S",
  ),
  yes("catalog", "status", ["Catálogo Produto", "Catálogo"], "S"),
  yes("usesMfgDate", "status", ["Utiliza data de Fabricação"]),
  yes("usesExpiry", "status", ["Utiliza data de Validade"]),
  yes("mapa", "status", ["Obrigatório MAPA"]),
  yes("dumping", "status", ["Dumping"]),
  // Certificações.
  yes("anatel", "certs", ["Obrig. Certif. ANATEL", "ANATEL (S/N)"]),
  yes("inmetro", "certs", ["Obrig. Certif. INMETRO", "INMETRO (S/N)"]),
  yes("anvisa", "certs", ["Obrig. Certif. ANVISA", "ANVISA (S/N)"]),
  // Características do produto.
  yes("sound", "features", ["Produto tem SOM", "PRODUTO TEM SOM (S/N)"]),
  yes("light", "features", ["Produto tem LUZ", "PRODUTO TEM LUZ (S/N)"]),
  yes("movement", "features", [
    "Produto tem MOVIMENTO",
    "PRODUTO TEM MOVIMENTO (S/N)",
  ]),
  yes("freeWheel", "features", ["Roda livre", "RODA LIVRE (S/N)"]),
  yes("friction", "features", ["A fricção", "A FRICÇÃO (S/N)", "Fricção"]),
  yes("windUp", "features", ["A corda", "A CORDA (S/N)"]),
  yes("bumpAndGo", "features", ["Bate e volta", "BATE E VOLTA (S/N)"]),
  yes("remote", "features", [
    "Com controle remoto",
    "COM CONTROLE REMOTO (S/N)",
  ]),
  f("ageRange", "features", "int", ["Faixa Etária", "FAIXA ETÁRIA (NÚMERO)"]),
  f("composition", "features", "text", ["Composição", "COMPOSIÇÃO"], {
    max: 250,
  }),
  f(
    "requestedColor",
    "features",
    "text",
    ["Cor solicitada", "COR SOLICITADA (TEXTO)"],
    { max: 120 },
  ),
  f("colors", "features", "text", ["Cores Disponíveis", "Cores"], {
    max: 250,
  }),
  f("pantone", "features", "text", ["Pantone", "PANTONE"], { max: 120 }),
  f("assortmentQty", "features", "int", ["Sortimento", "QTD SORTIMENTO"]),
  yes("assortmentColor", "features", [
    "Sortimento Cor",
    "SORTIMENTO COR (S/N)",
  ]),
  yes("assortmentModel", "features", [
    "Sortimento Modelo",
    "SORTIMENTO MODELO (S/N)",
  ]),
  f(
    "capacity",
    "features",
    "number",
    ["Capacidade Volumétrica", "Capacidade", "CAPACIDADE (ML/KG)"],
    { unit: "ml" },
  ),
  yes("dishwasher", "features", ["Lava-louças", "LAVA-LOUÇAS (S/N)"]),
  yes("oven", "features", ["Forno", "FORNO (S/N)"]),
  yes("microwave", "features", [
    "Microondas",
    "Micro-ondas",
    "MICROONDAS (S/N)",
  ]),
  // Alimentação: pilhas e baterias.
  f(
    "powerType",
    "power",
    "text",
    ["Tipo Alimentação Produto", "TIPO ALIMENTAÇÃO PRODUTO"],
    { max: 120 },
  ),
  f(
    "batteryType",
    "power",
    "text",
    ["Tipo Pilha/Bateria Produto", "TIPO PILHA/ BATERIA PRODUTO"],
    { max: 120 },
  ),
  f("batteryQty", "power", "int", [
    "Qtd Pilha Bateria Produto",
    "QTD PILHA BATERIA PRODUTO",
  ]),
  f(
    "accessoryPowerType",
    "power",
    "text",
    ["Tipo Alimentação Acessório", "TIPO ALIMENTAÇÃO ACESSÓRIO"],
    { max: 120 },
  ),
  f(
    "accessoryBatteryType",
    "power",
    "text",
    ["Tipo Pilha/Bateria Acessório", "TIPO PILHA/ BATERIA ACESSÓRIO"],
    { max: 120 },
  ),
  f("accessoryBatteryQty", "power", "int", [
    "Qtd Pilha/Bateria Acessório",
    "QTD PILHA/ BATERIA ACESSÓRIO",
  ]),
  // Embalagem.
  f("packageStatus", "packing", "text", ["Situação Embalagem"], { max: 120 }),
  f("packageLayout", "packing", "text", ["Layout da Embalagem"], { max: 250 }),
  f(
    "packageType",
    "packing",
    "code",
    ["Cód. Tipo Embalagem", "Tipo de Embalagem", "TIPO DE EMBALAGEM"],
    { max: 12 },
  ),
  f(
    "piecesPerPackage",
    "packing",
    "int",
    ["Qtde de Peças na Embalagem", "QUANTIDADE DE PEÇAS NA EMBALAGEM"],
    { unit: "pcs" },
  ),
  f(
    "piecesPerDisplay",
    "packing",
    "int",
    ["Qtde de peças no Display", "QUANTIDADE DE PEÇAS NO DISPLAY"],
    { unit: "pcs" },
  ),
  f(
    "packHeight",
    "packing",
    "number",
    ["Altura da Embalagem Individual", "ALTURA DA EMBALAGEM INDIVIDUAL (M)"],
    { unit: "m" },
  ),
  f(
    "packWidth",
    "packing",
    "number",
    ["Largura da Embalagem Individual", "LARGURA DA EMBALAGEM INDIVIDUAL (M)"],
    { unit: "m" },
  ),
  f(
    "packDepth",
    "packing",
    "number",
    [
      "Profundidade da Embalagem Individual",
      "PROFUNDIDADE  DA EMBALAGEM INDIVIDUAL (M)",
    ],
    { unit: "m" },
  ),
  // A peça: medidas e pesos.
  f("height", "measures", "number", ["Altura", "ALTURA DA PEÇA (M)"], {
    column: "ALTURA",
    unit: "m",
  }),
  f("width", "measures", "number", ["Largura", "LARGURA DA PEÇA (M)"], {
    column: "LARGURA",
    unit: "m",
  }),
  f(
    "depth",
    "measures",
    "number",
    ["Espessura", "Profundidade", "PROFUNDIDADE DA PEÇA (M)"],
    { column: "ESPESSURA", unit: "m" },
  ),
  f("netWeight", "measures", "number", ["Peso Líquido", "PESO LÍQUIDO (KG)"], {
    column: "PESOLIQ",
    unit: "kg",
  }),
  f("grossWeight", "measures", "number", ["Peso Bruto", "PESO BRUTO (KG)"], {
    column: "PESOBRUTO",
    unit: "kg",
  }),
  // Caixa master.
  f(
    "masterQty",
    "master",
    "int",
    ["Qtde de Peças na Caixa Master", "QUANTIDADE DE PEÇAS  - CAIXA MASTER"],
    { unit: "pcs" },
  ),
  f(
    "masterHeight",
    "master",
    "number",
    ["Altura da Master", "ALTURA DA MASTER (M)"],
    {
      unit: "m",
    },
  ),
  f(
    "masterWidth",
    "master",
    "number",
    ["Largura da Master", "LARGURA DA MASTER (M)"],
    { unit: "m" },
  ),
  f(
    "masterDepth",
    "master",
    "number",
    ["Profundidade da Master", "PROFUNDIDADE DA MASTER (M)"],
    { unit: "m" },
  ),
  f("masterCbm", "master", "number", ["CBM Master", "CBM MASTER (M³)"], {
    unit: "m3",
  }),
  // Caixa inner.
  f(
    "innerQty",
    "inner",
    "int",
    ["Qtde de Peças na Caixa Inner", "QUANTIDADE DE PEÇAS  - CAIXA INNER"],
    { unit: "pcs" },
  ),
  f(
    "innerHeight",
    "inner",
    "number",
    ["Altura da Inner", "ALTURA DA INNER (M)"],
    {
      unit: "m",
    },
  ),
  f(
    "innerWidth",
    "inner",
    "number",
    ["Largura da Inner", "LARGURA DA INNER (M)"],
    {
      unit: "m",
    },
  ),
  f(
    "innerDepth",
    "inner",
    "number",
    ["Profundidade da Inner", "PROFUNDIDADE DA INNER (M)"],
    { unit: "m" },
  ),
  f("innerCbm", "inner", "number", ["CBM Inner", "CBM INNER (M³)"], {
    unit: "m3",
  }),
  // Fiscal.
  f("ncm", "fiscal", "text", ["NCM"], { column: "NCM", max: 10 }),
  f("ipiCode", "fiscal", "text", ["Código IPI", "CÓDIGO IPI"], { max: 20 }),
  // Informações adicionais.
  f(
    "additionalInfo",
    "other",
    "longtext",
    ["Informações Adicionais", "INFORMAÇÕES ADICIONAIS", "Características"],
    { max: 2000 },
  ),
];

const BY_ID = new Map(REGISTRATION_FIELDS.map((x) => [x.id, x]));
export const registrationField = (id: string) => BY_ID.get(id);

/** Os valores do formulário: o que foi digitado, por campo (e "<id>:name" no código). */
export type RegistrationValues = Record<string, string>;

/** Chave do nome mostrado ao lado do código (não vai ao Sankhya). */
export const nameKey = (id: string) => `${id}:name`;

/** Os valores de partida dos campos com padrão (S/N e unidade). */
export function registrationDefaults(): RegistrationValues {
  const out: RegistrationValues = {};
  for (const field of REGISTRATION_FIELDS)
    if (field.initial) out[field.id] = field.initial;
  return out;
}

/** Só as chaves do catálogo, aparadas e no tamanho máximo. */
export function cleanValues(raw: Record<string, unknown>): RegistrationValues {
  const out: RegistrationValues = {};
  for (const field of REGISTRATION_FIELDS) {
    for (const key of field.type === "code"
      ? [field.id, nameKey(field.id)]
      : [field.id]) {
      const v = raw[key];
      if (typeof v !== "string") continue;
      const max = key === field.id ? (field.max ?? 120) : 120;
      const text =
        field.type === "longtext"
          ? v.trim().slice(0, max)
          : v.replace(/\s+/g, " ").trim().slice(0, max);
      if (text) out[key] = text;
    }
  }
  return out;
}

/* ------------------------------------------------------------------------ */
/* Dicionário do Sankhya e de-para                                           */
/* ------------------------------------------------------------------------ */

export interface DictionaryField {
  /** Nome da coluna (NOMECAMPO). */
  column: string;
  /** Descrição (DESCRCAMPO), o nome na tela do Sankhya. */
  label: string;
  /** Tipo (TIPCAMPO): S texto, I inteiro, F decimal, D/H data… */
  type: string | null;
}

export interface DictionaryOption {
  value: string;
  label: string;
}

/** Os campos da TGFPRO lidos do dicionário do Sankhya (guardados no portal). */
export interface ProductDictionary {
  loadedAt: string;
  fields: DictionaryField[];
  /** Opções dos campos de lista (TDDOPC), por coluna. */
  options: Record<string, DictionaryOption[]>;
}

/** Nome comparável: sem acento, maiúsculas, só letras e números. */
export function labelKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\(S\/N\)|\(M\)|\(KG\)|\(M³\)|\(M3\)/g, "")
    .replace(/[^A-Z0-9]/g, "");
}

/** Coluna válida da TGFPRO (letras, números e "_"). */
export const isColumnName = (value: string) =>
  /^[A-Z][A-Z0-9_]{0,39}$/.test(value);

/** De onde veio a coluna do campo. */
export type ColumnSource =
  /** Coluna padrão conhecida (ou AD_ que a carga já lê). */
  | "known"
  /** Achada no dicionário pelo nome do campo. */
  | "dictionary"
  /** Escolhida pelo administrador. */
  | "override"
  /** Não achada: o campo fica só no portal. */
  | "none"
  /** O administrador marcou para não enviar. */
  | "off";

export interface ColumnResolution {
  column: string | null;
  source: ColumnSource;
  /** Opções da lista do Sankhya, quando o campo é de lista. */
  options: DictionaryOption[];
  /** A coluna conhecida ou escolhida não existe no dicionário lido. */
  absent?: boolean;
}

/** "-" no de-para do administrador: não enviar o campo. */
export const OFF = "-";

/**
 * Coluna de cada campo: a escolhida pelo administrador, a conhecida ou a
 * achada no dicionário pelo nome. Com o dicionário lido, coluna que não
 * existe nele não é enviada (o Sankhya recusaria o cadastro inteiro). Duas
 * vezes a mesma coluna: fica com o primeiro campo.
 */
export function resolveColumns(
  dictionary: ProductDictionary | null,
  overrides: Record<string, string> = {},
): Record<string, ColumnResolution> {
  const byColumn = new Map(
    (dictionary?.fields ?? []).map((x) => [x.column.toUpperCase(), x]),
  );
  const byLabel = new Map<string, DictionaryField[]>();
  for (const x of dictionary?.fields ?? []) {
    const key = labelKey(x.label);
    if (!key) continue;
    byLabel.set(key, [...(byLabel.get(key) ?? []), x]);
  }
  const used = new Set<string>();
  const out: Record<string, ColumnResolution> = {};
  const optionsOf = (column: string | null) =>
    (column && dictionary?.options[column]) || [];
  for (const field of REGISTRATION_FIELDS) {
    const override = overrides[field.id]?.trim().toUpperCase();
    if (override === OFF) {
      out[field.id] = { column: null, source: "off", options: [] };
      continue;
    }
    let column: string | null = null;
    let source: ColumnSource = "none";
    if (override && isColumnName(override)) {
      column = override;
      source = "override";
    } else if (field.column) {
      column = field.column;
      source = "known";
    } else if (dictionary) {
      for (const label of field.labels) {
        const found = (byLabel.get(labelKey(label)) ?? []).filter(
          (x) => !used.has(x.column.toUpperCase()),
        );
        // Mais de um com o mesmo nome: o personalizado (AD_) primeiro.
        const pick =
          found.find((x) => x.column.toUpperCase().startsWith("AD_")) ??
          found[0];
        if (pick) {
          column = pick.column.toUpperCase();
          source = "dictionary";
          break;
        }
      }
    }
    if (column && used.has(column)) {
      out[field.id] = { column: null, source: "none", options: [] };
      continue;
    }
    if (column) used.add(column);
    if (column && dictionary && !byColumn.has(column)) {
      out[field.id] = {
        column: null,
        source: "none",
        options: [],
        absent: true,
      };
      continue;
    }
    out[field.id] = { column, source, options: optionsOf(column) };
  }
  return out;
}

/* ------------------------------------------------------------------------ */
/* Conferência e valores para o Sankhya                                      */
/* ------------------------------------------------------------------------ */

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Número digitado (vírgula ou ponto); vazio = nulo; ilegível = NaN. */
export function registrationNumber(
  field: RegistrationField,
  raw: string | undefined,
): number | null {
  if (!raw?.trim()) return null;
  return parseNumberInput(raw, { int: field.type === "int" });
}

/** Campos com valor que não dá para ler (número, data). */
export function invalidFields(values: RegistrationValues): string[] {
  const out: string[] = [];
  for (const field of REGISTRATION_FIELDS) {
    const raw = values[field.id];
    if (!raw) continue;
    if (field.type === "number" || field.type === "int") {
      const n = registrationNumber(field, raw);
      if (n !== null && (!Number.isFinite(n) || n < 0)) out.push(field.id);
      else if (field.type === "int" && n !== null && !Number.isInteger(n))
        out.push(field.id);
    } else if (field.type === "date" && !DATE.test(raw)) out.push(field.id);
    else if (field.type === "yesno" && raw !== "S" && raw !== "N")
      out.push(field.id);
  }
  return out;
}

/** Obrigatórios sem valor, para gravar no portal ou para enviar ao Sankhya. */
export function missingRequired(
  values: RegistrationValues,
  level: "portal" | "sankhya",
): string[] {
  return REGISTRATION_FIELDS.filter(
    (x) =>
      (x.required === "portal" ||
        (level === "sankhya" && x.required === "sankhya")) &&
      !values[x.id]?.trim(),
  ).map((x) => x.id);
}

/** Opção da lista do Sankhya pelo valor ou pelo texto (sem acento). */
export function matchOption(
  options: DictionaryOption[],
  raw: string,
): string | null {
  const key = labelKey(raw);
  const hit =
    options.find((o) => o.value === raw) ??
    options.find((o) => labelKey(o.value) === key) ??
    options.find((o) => labelKey(o.label) === key);
  return hit ? hit.value : null;
}

const plain = (n: number) =>
  // Sem notação científica e sem o ruído do ponto flutuante.
  String(Math.round(n * 1e6) / 1e6);

export interface SankhyaPayload {
  values: Record<string, string>;
  /** Campos com valor que não foram (sem coluna ou fora da lista). */
  skipped: Array<{ id: string; reason: "no_column" | "off" | "option" }>;
}

/**
 * Valores da TGFPRO a partir do formulário: só os campos com coluna e com
 * valor (vazio não vai: o Sankhya fica com o padrão dele). Números com
 * ponto, S/N, datas DD/MM/AAAA, NCM só com os dígitos e a lista pelo valor
 * da opção. `groupCode` é o CODGRUPOPROD da linha escolhida.
 */
export function sankhyaPayload(
  values: RegistrationValues,
  columns: Record<string, ColumnResolution>,
  groupCode: string | null,
): SankhyaPayload {
  const out: Record<string, string> = {};
  const skipped: SankhyaPayload["skipped"] = [];
  for (const field of REGISTRATION_FIELDS) {
    const raw = values[field.id]?.trim();
    const resolution = columns[field.id];
    let value: string | null = null;
    if (field.type === "line") value = groupCode;
    else if (!raw) value = null;
    else if (field.type === "number" || field.type === "int") {
      const n = registrationNumber(field, raw);
      value = n === null || !Number.isFinite(n) ? null : plain(n);
    } else if (field.type === "date") {
      const m = DATE.exec(raw);
      value = m ? `${m[3]}/${m[2]}/${m[1]}` : null;
    } else if (field.id === "ncm") value = raw.replace(/\D/g, "") || null;
    else value = raw;
    if (value === null) continue;
    if (!resolution?.column) {
      skipped.push({
        id: field.id,
        reason: resolution?.source === "off" ? "off" : "no_column",
      });
      continue;
    }
    if (resolution.options.length && field.type !== "yesno") {
      const option = matchOption(resolution.options, value);
      if (option === null) {
        skipped.push({ id: field.id, reason: "option" });
        continue;
      }
      value = option;
    }
    out[resolution.column] = value;
  }
  return { values: out, skipped };
}

/* ------------------------------------------------------------------------ */
/* Pré-preenchimento                                                         */
/* ------------------------------------------------------------------------ */

/** O que o processo juntou para o item (book, seleção, negociação e amostra). */
export interface RegistrationSource {
  name: string | null;
  description: string | null;
  factoryCode: string | null;
  material: string | null;
  colors: string | null;
  variation: string | null;
  capacityMl: number | null;
  powerDetail: string | null;
  packageType: string | null;
  piecesPerPackage: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  netWeightKg: number | null;
  grossWeightKg: number | null;
  masterQty: number | null;
  masterCbm: number | null;
  innerQty: number | null;
  ncm: string | null;
  leadTimeDays: number | null;
  supplierName: string | null;
  supplierCode: string | null;
  supplierContact: string | null;
  /** País e porto dos outros produtos do mesmo fornecedor no Sankhya. */
  countryCode: string | null;
  countryName: string | null;
  portCode: string | null;
  productManager: string | null;
  notes: string | null;
  /** Linha sugerida (a da família do book, quando há uma só). */
  lineId: string | null;
  /** Certificações exigidas pela linha sugerida (INMETRO, ANATEL, ANVISA). */
  certifications: string[];
}

/** Número para o campo, com vírgula decimal (o portal lê vírgula ou ponto). */
const shown = (n: number | null | undefined, digits = 6) =>
  n === null || n === undefined || !Number.isFinite(n)
    ? undefined
    : String(Math.round(n * 10 ** digits) / 10 ** digits).replace(".", ",");

const meters = (cm: number | null | undefined) =>
  cm === null || cm === undefined ? null : cm / 100;

/**
 * Valores de partida do formulário: os padrões (S/N, unidade) e o que o
 * processo já tem. Nada é inventado: o que não se sabe fica em branco.
 */
export function prefillValues(source: RegistrationSource): RegistrationValues {
  const raw: Record<string, string | undefined> = {
    ...registrationDefaults(),
    descrPt: source.name ?? source.description ?? undefined,
    descrEn: source.description ?? source.name ?? undefined,
    productManager: source.productManager ?? undefined,
    lineId: source.lineId ?? undefined,
    supplierName: source.supplierName ?? undefined,
    supplierCode: source.supplierCode ?? undefined,
    [nameKey("supplierCode")]: source.supplierName ?? undefined,
    supplierContact: source.supplierContact ?? undefined,
    factoryCode: source.factoryCode ?? undefined,
    supplierRef: source.factoryCode ?? undefined,
    country: source.countryCode ?? undefined,
    [nameKey("country")]: source.countryName ?? undefined,
    port: source.portCode ?? undefined,
    leadTime: shown(source.leadTimeDays, 0),
    composition: source.material ?? undefined,
    colors: source.colors ?? undefined,
    requestedColor: source.variation ?? undefined,
    capacity: shown(source.capacityMl),
    powerType: source.powerDetail ?? undefined,
    [nameKey("packageType")]: source.packageType ?? undefined,
    piecesPerPackage: shown(source.piecesPerPackage, 0),
    height: shown(meters(source.heightCm)),
    width: shown(meters(source.widthCm)),
    depth: shown(meters(source.lengthCm)),
    netWeight: shown(source.netWeightKg),
    grossWeight: shown(source.grossWeightKg),
    masterQty: shown(source.masterQty, 0),
    masterCbm: shown(source.masterCbm),
    innerQty: shown(source.innerQty, 0),
    ncm: source.ncm ?? undefined,
    additionalInfo: source.notes ?? undefined,
  };
  const certs = new Set(source.certifications.map((c) => labelKey(c)));
  for (const id of ["inmetro", "anatel", "anvisa"] as const)
    if (certs.has(id.toUpperCase())) raw[id] = "S";
  return cleanValues(raw);
}

/**
 * O que foi gravado por cima dos valores de partida: o rascunho manda; o
 * campo que o rascunho não tem (novo no catálogo) vem do pré-preenchimento.
 */
export function mergeValues(
  prefill: RegistrationValues,
  saved: RegistrationValues | null | undefined,
): RegistrationValues {
  if (!saved) return prefill;
  return { ...prefill, ...saved };
}

/* ------------------------------------------------------------------------ */
/* O produto do portal                                                       */
/* ------------------------------------------------------------------------ */

/** Colunas do produto do portal que o formulário preenche. */
export interface RegistrationProductPatch {
  name?: string;
  sku?: string;
  supplierSku?: string;
  brand?: string;
  material?: string;
  color?: string;
  pantone?: string;
  ncm?: string;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  netWeightKg?: number;
  grossWeightKg?: number;
  masterBoxQty?: number;
  innerBoxQty?: number;
  boxLengthCm?: number;
  boxWidthCm?: number;
  boxHeightCm?: number;
  cbm?: number;
}

/**
 * O que vai para o cadastro do produto no portal (a mesma informação que vai
 * ao Sankhya, nas colunas do portal). Só o que tem valor: campo vazio não
 * apaga o que o produto já tem.
 */
export function productPatch(
  values: RegistrationValues,
): RegistrationProductPatch {
  const out: RegistrationProductPatch = {};
  const text = (id: string, max: number) => {
    const v = values[id]?.trim();
    return v ? v.slice(0, max) : undefined;
  };
  const num = (id: string, factor = 1) => {
    const field = registrationField(id);
    if (!field) return undefined;
    const n = registrationNumber(field, values[id]);
    return n === null || !Number.isFinite(n) || n < 0
      ? undefined
      : Math.round(n * factor * 10000) / 10000;
  };
  const set = <K extends keyof RegistrationProductPatch>(
    key: K,
    value: RegistrationProductPatch[K] | undefined,
  ) => {
    if (value !== undefined) out[key] = value;
  };
  set("name", text("descrPt", 160));
  set("sku", text("supplierRef", 60) ?? text("factoryCode", 60));
  set("supplierSku", text("factoryCode", 60) ?? text("supplierRef", 60));
  set("brand", text("brand", 60));
  set("material", text("composition", 120));
  set("color", text("colors", 120) ?? text("requestedColor", 120));
  set("pantone", text("pantone", 120));
  set("ncm", text("ncm", 10));
  // Medidas da planilha em metros; no portal, centímetros.
  set("heightCm", num("height", 100));
  set("widthCm", num("width", 100));
  set("lengthCm", num("depth", 100));
  set("netWeightKg", num("netWeight"));
  set("grossWeightKg", num("grossWeight"));
  set("masterBoxQty", num("masterQty"));
  set("innerBoxQty", num("innerQty"));
  set("boxHeightCm", num("masterHeight", 100));
  set("boxWidthCm", num("masterWidth", 100));
  set("boxLengthCm", num("masterDepth", 100));
  set("cbm", num("masterCbm"));
  return out;
}

/* ------------------------------------------------------------------------ */
/* Situação                                                                  */
/* ------------------------------------------------------------------------ */

export type RegistrationState =
  /** Amostra ainda não aprovada: dá para preencher, não para cadastrar. */
  | "waiting_sample"
  /** Pronto para cadastrar (sem produto ainda). */
  | "to_register"
  /** Produto gravado no portal, ainda sem o código do Sankhya. */
  | "to_send"
  /** Com o CODPROD do Sankhya. */
  | "done";

export function registrationState(input: {
  productId: string | null;
  sankhyaCode: string | null;
  sampleApproved: boolean;
}): RegistrationState {
  if (input.productId) return input.sankhyaCode ? "done" : "to_send";
  return input.sampleApproved ? "to_register" : "waiting_sample";
}
