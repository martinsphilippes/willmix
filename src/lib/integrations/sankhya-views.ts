import type { SankhyaRow } from "./sankhya-client";

/*
 * Views do Sankhya feitas para o portal (dicionário de 20/11/2026;
 * docs/SANKHYA.md, "Views do Sankhya"). Clientes já vinham da
 * VW_AD_CLIENTE_WELL; agora também fornecedores, produtos, o vínculo produto
 * × fornecedor e os vendedores (RCAs).
 *
 * As views usam nomes próprios (COD_PRODUTO, COD_GRUPO...). O resto do
 * portal (códigos do registro em `sankhyaRefs`, a escrita no Sankhya, o país
 * de origem pelo CODPARCFORN, o histórico de notas) conhece os nomes das
 * tabelas (CODPROD, CODGRUPOPROD...). Aqui a linha da view vira a linha da
 * tabela, só com as colunas que a view tem: o que ela não traz fica de fora
 * (e não apaga o que o portal já tem).
 */

export const SUPPLIER_VIEW = "sankhya.VW_AD_FORNECEDOR_WELL";
export const PRODUCT_VIEW = "sankhya.VW_AD_PRODUTO_WELL";
export const PRODUCT_SUPPLIER_VIEW = "sankhya.VW_AD_PRODUTO_FORNECEDOR_WELL";
export const SELLER_VIEW = "sankhya.VW_AD_VENDEDOR_WELL";

/** Colunas do dicionário de cada view (para avisar das que faltarem). */
export const VIEW_COLUMNS = {
  suppliers: [
    "COD_FORNECEDOR",
    "NOME_FORNECEDOR",
    "RAZAO_SOCIAL",
    "TIPO_PESSOA",
    "DOCUMENTO",
    "INSCRICAO_ESTADUAL",
    "ATIVO",
    "E_FORNECEDOR",
    "ENDERECO",
    "NUMERO",
    "COMPLEMENTO",
    "BAIRRO",
    "COD_CIDADE",
    "CIDADE",
    "UF",
    "PAIS",
    "CEP",
    "TELEFONE",
    "EMAIL",
  ],
  products: [
    "COD_PRODUTO",
    "DESCRICAO",
    "COMPLEMENTO",
    "REFERENCIA",
    "REFERENCIA_FORNECEDOR",
    "MARCA",
    "COD_GRUPO",
    "NCM",
    "UNIDADE",
    "PESO_BRUTO",
    "PESO_LIQUIDO",
    "ALTURA",
    "LARGURA",
    "ESPESSURA",
    "ATIVO",
    "COD_PAIS_ORIGEM",
    "COD_FORNECEDOR_PRINCIPAL",
  ],
  productSuppliers: [
    "COD_PRODUTO",
    "COD_FORNECEDOR",
    "COD_PORTO",
    "PORTO",
    "COD_PAIS",
    "PAIS_PORTO",
    "FORNECEDOR_PREFERENCIAL",
    "ORIGEM",
    "QTD_PROCESSOS",
    "DATA_ULTIMA_COMPRA",
    "ULTIMO_PRECO_ORIGEM",
    "COD_MOEDA",
    "MOEDA",
    "VALIDADO",
    "DATA_ALTERACAO",
  ],
} as const;

/** Colunas esperadas que a view não trouxe. */
export function missingViewColumns(
  view: keyof typeof VIEW_COLUMNS,
  columns: string[],
): string[] {
  const have = new Set(columns.map((c) => c.toUpperCase()));
  return VIEW_COLUMNS[view].filter((c) => !have.has(c));
}

const blank = (v: unknown) => v == null || String(v).trim() === "";

/** Coluna da view (nomes em maiúsculas, como vêm do Sankhya). */
const col = (row: SankhyaRow, name: string): unknown => {
  if (name in row) return row[name];
  const key = Object.keys(row).find((k) => k.toUpperCase() === name);
  return key ? row[key] : undefined;
};

/** A linha da view como JSON simples (datas em texto). */
export function viewSnapshot(
  row: SankhyaRow,
): Record<string, string | number | null> {
  const out: Record<string, string | number | null> = {};
  for (const [k, v] of Object.entries(row)) {
    const key = k.toUpperCase();
    if (v == null) out[key] = null;
    else if (typeof v === "number") out[key] = v;
    else out[key] = String(v).trim().slice(0, 500) || null;
  }
  return out;
}

/* ---- Produtos: VW_AD_PRODUTO_WELL → TGFPRO ---- */

/** Coluna da view → coluna da TGFPRO (dicionário, coluna ORIGEM). */
const PRODUCT_COLUMNS: Array<[view: string, table: string]> = [
  ["COD_PRODUTO", "CODPROD"],
  ["DESCRICAO", "DESCRPROD"],
  ["COMPLEMENTO", "COMPLDESC"],
  ["COD_WELLMIX_COMPLEMENTO", "AD_COMPLEMENTO"],
  ["REFERENCIA", "REFERENCIA"],
  ["REFERENCIA_FORNECEDOR", "REFFORN"],
  ["MARCA", "MARCA"],
  ["COD_MARCA_WELLMIX", "AD_CODMARCAWELL"],
  ["COD_GRUPO", "CODGRUPOPROD"],
  ["NCM", "NCM"],
  ["UNIDADE", "CODVOL"],
  ["UNIDADE_COMPRA", "CODVOLCOMPRA"],
  ["PESO_BRUTO", "PESOBRUTO"],
  ["PESO_LIQUIDO", "PESOLIQ"],
  ["CUBAGEM_M3", "M3"],
  ["ALTURA", "ALTURA"],
  ["LARGURA", "LARGURA"],
  ["ESPESSURA", "ESPESSURA"],
  ["QTD_EMBALAGENS", "QTDEMB"],
  ["QTD_PECAS_POR_CAIXA", "AD_QTDEPECASEMB"],
  ["QTD_CAIXAS_POR_PALLET", "AD_CXPALLET"],
  ["ATIVO", "ATIVO"],
  ["DESCONTINUADO", "AD_DESCONTINUADO"],
  ["USA_WMS", "UTILIZAWMS"],
  ["INTEGRA_WMS", "AD_TCPINTEGWMS"],
  ["COD_PORTO_PREFERENCIAL", "AD_IDPORTO"],
  ["COD_PAIS_ORIGEM", "CODPAIS"],
  ["COD_FORNECEDOR_PRINCIPAL", "CODPARCFORN"],
  ["DATA_CADASTRO", "AD_DTCADASTRO"],
  ["DATA_ALTERACAO", "DTALTER"],
  // Ainda fora da view (dono, 20/11/2026: pedir ao TI). Se vierem com o
  // nome da tabela, valem.
  ["CARACTERISTICAS", "CARACTERISTICAS"],
  ["ESTMIN", "ESTMIN"],
];

/**
 * A linha da VW_AD_PRODUTO_WELL com os nomes da TGFPRO. Só as colunas que a
 * view trouxe: sem ESTMIN, o estoque mínimo do portal não muda; sem
 * CARACTERISTICAS, a especificação também não.
 */
export function productRowFromView(row: SankhyaRow): SankhyaRow {
  const out: SankhyaRow = {};
  for (const [view, table] of PRODUCT_COLUMNS) {
    const v = col(row, view);
    if (v !== undefined) out[table] = v as SankhyaRow[string];
  }
  // Fornecedor principal "0" = nenhum.
  if (blank(out.CODPARCFORN) || String(out.CODPARCFORN).trim() === "0")
    delete out.CODPARCFORN;
  return out;
}

/* ---- Vínculo produto × fornecedor ---- */

export interface ProductSupplierViewRow {
  productCode: string;
  supplierCode: string;
  portCode: string | null;
  port: string | null;
  countryCode: string | null;
  country: string | null;
  preferential: boolean;
  origin: string | null;
  processes360d: number | null;
  lastPurchaseAt: string | null;
  lastPrice: number | null;
  currencyCode: string | null;
  currency: string | null;
  validated: boolean;
  updatedAt: string | null;
}

/** Código do Sankhya ("0" ou vazio = nenhum). */
export const viewCode = (v: unknown): string | null => {
  if (blank(v)) return null;
  const c = String(v).trim();
  return c !== "0" && /^\d{1,12}$/.test(c) ? String(Number(c)) : null;
};

const text = (v: unknown, max = 160) =>
  blank(v) ? null : String(v).trim().slice(0, max);

const num = (v: unknown) => {
  if (blank(v)) return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const yes = (v: unknown) =>
  String(v ?? "")
    .trim()
    .toUpperCase() === "S";

/** Datas da view ("10/11/2026", "10112026 00:00:00", ISO) → ISO. */
export function viewDate(value: unknown): string | null {
  if (blank(value)) return null;
  const s = String(value).trim();
  let m =
    /^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(s);
  if (!m) {
    const c = /^(\d{2})(\d{2})(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(
      s,
    );
    if (c) m = c;
  }
  if (m)
    return `${m[3]}-${m[2]}-${m[1]}T${m[4] ?? "12"}:${m[5] ?? "00"}:${m[6] ?? "00"}.000Z`;
  const iso =
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(s);
  if (iso)
    return `${iso[1]}-${iso[2]}-${iso[3]}T${iso[4] ?? "12"}:${iso[5] ?? "00"}:${iso[6] ?? "00"}.000Z`;
  return null;
}

/** Uma linha da VW_AD_PRODUTO_FORNECEDOR_WELL; nula sem produto ou fornecedor. */
export function productSupplierFromView(
  row: SankhyaRow,
): ProductSupplierViewRow | null {
  const productCode = viewCode(col(row, "COD_PRODUTO"));
  const supplierCode = viewCode(col(row, "COD_FORNECEDOR"));
  if (!productCode || !supplierCode) return null;
  return {
    productCode,
    supplierCode,
    portCode: viewCode(col(row, "COD_PORTO")),
    port: text(col(row, "PORTO"), 120),
    countryCode: viewCode(col(row, "COD_PAIS")),
    country: text(col(row, "PAIS_PORTO"), 60),
    preferential: yes(col(row, "FORNECEDOR_PREFERENCIAL")),
    origin: text(col(row, "ORIGEM"), 20),
    processes360d: num(col(row, "QTD_PROCESSOS")),
    lastPurchaseAt: viewDate(col(row, "DATA_ULTIMA_COMPRA")),
    lastPrice: num(col(row, "ULTIMO_PRECO_ORIGEM")),
    currencyCode: viewCode(col(row, "COD_MOEDA")),
    currency: text(col(row, "MOEDA"), 40),
    validated: yes(col(row, "VALIDADO")),
    updatedAt: viewDate(col(row, "DATA_ALTERACAO")),
  };
}

/* ---- Vendedores (RCAs): VW_AD_VENDEDOR_WELL ---- */

export interface SellerViewRow {
  code: string;
  name: string;
  active: boolean;
  partnerCode: string | null;
  /** Tipo do Sankhya por extenso (Vendedor, Gerente...). */
  type?: string | null;
  /** Tipo Wellmix por extenso (Vendedor externo, Key account...). */
  wellmixType?: string | null;
  email?: string | null;
  phone?: string | null;
  manager?: string | null;
  team?: string | null;
  region?: string | null;
  states?: string | null;
}

const sellerCode = (v: unknown): string | null => {
  if (blank(v)) return null;
  const s = String(v).trim();
  if (!/^\d{1,10}$/.test(s)) return null;
  const c = s.replace(/^0+(?=\d)/, "");
  return c === "0" ? null : c;
};

/**
 * Um vendedor da VW_AD_VENDEDOR_WELL (ou da TGFVEN, quando a view falha:
 * CODVEND, APELIDO, CODPARC). Nulo sem código ou sem nome. Os campos a mais
 * só aparecem quando a view os traz.
 */
export function sellerFromRow(row: SankhyaRow): SellerViewRow | null {
  const code = sellerCode(col(row, "COD_VENDEDOR") ?? col(row, "CODVEND"));
  const name = String(
    col(row, "NOME_VENDEDOR") ?? col(row, "APELIDO") ?? "",
  ).trim();
  if (!code || !name) return null;
  const out: SellerViewRow = {
    code,
    name,
    active:
      String(col(row, "ATIVO") ?? "S")
        .trim()
        .toUpperCase() !== "N",
    partnerCode: sellerCode(col(row, "COD_PARCEIRO") ?? col(row, "CODPARC")),
  };
  const extra = (key: keyof SellerViewRow, ...columns: string[]) => {
    for (const c of columns) {
      const v = text(col(row, c), 200);
      if (v) {
        (out as unknown as Record<string, unknown>)[key] = v;
        return;
      }
    }
  };
  extra("type", "TIPO_DESCR");
  extra("wellmixType", "TIPO_WELLMIX");
  extra("email", "EMAIL");
  extra("phone", "TELEFONE");
  extra("manager", "GERENTE_WELLMIX", "GERENTE", "SUPERIOR");
  extra("team", "EQUIPE");
  extra("region", "REGIAO");
  extra("states", "ESTADO_ATUACAO");
  if (out.email) out.email = out.email.toLowerCase();
  return out;
}
