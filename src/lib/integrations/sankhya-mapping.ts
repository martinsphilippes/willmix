/*
 * Mapeamento Sankhya → portal (docs/SANKHYA.md, "Carga do Sankhya").
 *
 * Cada entidade do portal que tem par no Sankhya lista os campos de origem
 * (tabela do ERP), o campo de destino no portal e a regra de conversão. A
 * amostra (1 a 5 registros) é lida por SQL somente leitura e coerente entre
 * si: as últimas notas de importação → seus parceiros, itens, produtos,
 * grupos, estoque e financeiro. Nada é gravado no portal nesta etapa.
 *
 * Puro (sem rede nem banco): a busca fica em sankhya-sample.ts.
 */

import type { StageKey } from "@/lib/db/schema";

export type Transform =
  | "text"
  | "number"
  | "int"
  | "sn" // "S"/"N" → true/false
  | "digits" // só os números (CNPJ/CPF)
  | "metersToCm"
  | "date" // data do Sankhya → AAAA-MM-DD
  | "partyType" // FORNECEDOR/CLIENTE → supplier/customer
  | "recDesp" // 1 receita / -1 despesa → customer_in / supplier_out
  | "paidAt" // DHBAIXA preenchida → confirmed/received; vazia → pending
  | "incoterm"; // CIF_FOB: C → CIF, F → FOB

export interface FieldMap {
  /** Coluna no Sankhya (com o alias da tabela no SQL, quando houver). */
  sankhya: string;
  /** Campo no portal; null = sem campo no portal (só mostrado). */
  portal: string | null;
  transform?: Transform;
  /** Colunas extras que a regra usa (ex.: CLIENTE para o tipo do parceiro). */
  uses?: string[];
  /** Observação curta sobre a conversão. */
  note?: string;
  /**
   * Valor que vem de outra tabela (ligação): não entra no SQL da entidade;
   * é buscado à parte (sankhya-relations.ts) e, se a tabela ou coluna não
   * existir, só aquele valor fica vazio.
   */
  via?: string;
}

export const SANKHYA_ENTITIES = [
  "orders",
  "partners",
  "orderItems",
  "products",
  "productGroups",
  "stock",
  "financial",
] as const;
export type SankhyaEntityKey = (typeof SANKHYA_ENTITIES)[number];

export interface EntityMap {
  key: SankhyaEntityKey;
  /** Tabela e entidade no Sankhya. */
  table: string;
  sankhyaEntity: string;
  /** Tabela no portal (null = o portal calcula, não guarda). */
  portalTable: string | null;
  /** Coluna-chave no Sankhya (vira o vínculo do registro no portal). */
  key_: string;
  fields: FieldMap[];
}

/**
 * TOP (CODTIPOPER) do processo de importação no Sankhya da Wellmix → etapa do
 * pedido no portal (resposta da Wellmix: a TOP define a etapa; os pedidos
 * entram como pedidos normais). `closed` = pedido encerrado. TOPs fora daqui
 * (cotação, pré-pedido, amostra, despesas, notas fiscais avulsas) não viram
 * pedido.
 */
export const TOP_STAGES: Record<
  number,
  { stage: StageKey; closed?: boolean; label: string }
> = {
  33: { stage: "ORDER_CREATED", label: "PEDIDO COMPRA - IMPORTAÇÃO" },
  1101: { stage: "ORDER_CREATED", label: "(IMP) PEDIDO DE COMPRA" },
  1104: { stage: "SUPPLIER_PAYMENT", label: "(IMP) ATV FIN/PRODUÇÃO" },
  1102: { stage: "PACKAGING", label: "(IMP) MARKETING" },
  1105: { stage: "INSPECTION", label: "(IMP) INSPECTION" },
  1103: { stage: "SHIPPING", label: "(IMP) CHECK ETD/ETA" },
  1106: { stage: "SHIPPING", label: "(IMP) CHECK-IN" },
  1107: { stage: "CUSTOMS", label: "(IMP) EMBARCADO" },
  1109: { stage: "CUSTOMS", label: "(IMP) VALIDAÇÃO DI" },
  1201: { stage: "TRANSPORT", label: "(IMP) NOTA IMPORTAÇÃO" },
  1401: { stage: "DELIVERED", label: "(IMP) RECEBIMENTO WMS" },
  1402: { stage: "CLOSED", label: "(IMP) FECHAMENTO" },
  1403: { stage: "CLOSED", closed: true, label: "(IMP) FINALIZADO" },
};

export const IMPORT_TOPS = Object.keys(TOP_STAGES).join(", ");

export const ENTITY_MAPS: Record<SankhyaEntityKey, EntityMap> = {
  orders: {
    key: "orders",
    table: "TGFCAB",
    sankhyaEntity: "CabecalhoNota",
    portalTable: "orders",
    key_: "NUNOTA",
    fields: [
      {
        sankhya: "NUNOTA",
        portal: "sankhyaCode",
        transform: "text",
        note: "Vínculo; o número exibido (erpNumber) é NUNOTA ou NUMNOTA, conforme a Integração",
      },
      {
        sankhya: "NUMNOTA",
        portal: null,
        note: "Nº do pedido/nota no ERP: vai para erpNumber quando escolhido na Integração",
      },
      {
        sankhya: "CODEMP",
        portal: "sankhyaRefs",
        note: "Empresa que emitiu (guardada nos códigos do Sankhya)",
      },
      {
        sankhya: "CODTIPOPER",
        portal: "status",
        transform: "int",
        note: "TOP (IMP) → etapa do pedido (tabela TOP_STAGES)",
      },
      {
        sankhya: "CODPARC",
        portal: "supplierId",
        transform: "int",
        note: "Parceiro da nota → fornecedor do portal (pelo vínculo do parceiro)",
      },
      { sankhya: "DTNEG", portal: "createdAt", transform: "date" },
      {
        sankhya: "VLRNOTA",
        portal: "fobTotal",
        transform: "number",
        note: "Valor da nota em R$; com câmbio (VLRMOEDA), vira USD = VLRNOTA ÷ VLRMOEDA",
      },
      { sankhya: "CODMOEDA", portal: null, note: "Moeda da nota (TSIMOE)" },
      {
        sankhya: "VLRMOEDA",
        portal: "fxRate",
        transform: "number",
        note: "Taxa de câmbio do pedido (ex.: 5,16); com ela os valores vão na moeda do pedido",
      },
      {
        sankhya: "CODTIPVENDA",
        portal: "paymentConditionId",
        transform: "int",
        note: "Ligação com Condições de pagamento (pelo código)",
      },
      {
        sankhya: "CIF_FOB",
        portal: "incoterm",
        transform: "incoterm",
        note: "C → CIF, F → FOB; outros valores ficam vazios",
      },
      {
        sankhya: "CODPARCTRANSP",
        portal: "carrierId",
        transform: "int",
        note: "Transportadora → parceiro do tipo transportadora (pelo vínculo)",
      },
      {
        sankhya: "DTPREVENT",
        portal: null,
        transform: "date",
        note: "Previsão de entrega: vai nas observações do pedido",
      },
      {
        sankhya: "STATUSNOTA",
        portal: null,
        note: "L = liberada, A = em aberto",
      },
      { sankhya: "OBSERVACAO", portal: "notes", transform: "text" },
    ],
  },
  partners: {
    key: "partners",
    table: "TGFPAR",
    sankhyaEntity: "Parceiro",
    portalTable: "parties",
    key_: "CODPARC",
    fields: [
      {
        sankhya: "CODPARC",
        portal: "sankhyaCode",
        transform: "text",
        note: "Vínculo com o Sankhya",
      },
      { sankhya: "NOMEPARC", portal: "name", transform: "text" },
      { sankhya: "RAZAOSOCIAL", portal: "legalName", transform: "text" },
      { sankhya: "CGC_CPF", portal: "taxId", transform: "digits" },
      {
        sankhya: "IDENTINSCESTAD",
        portal: "stateRegistration",
        transform: "text",
      },
      {
        sankhya: "TIPPESSOA",
        portal: "personType",
        transform: "text",
        note: "F = física, J = jurídica",
      },
      { sankhya: "EMAIL", portal: "email", transform: "text" },
      { sankhya: "TELEFONE", portal: "phone", transform: "text" },
      {
        sankhya: "FORNECEDOR",
        portal: "type",
        transform: "partyType",
        uses: ["CLIENTE"],
        note: "FORNECEDOR = S → supplier; CLIENTE = S → customer (os dois: dois cadastros)",
      },
      { sankhya: "CLIENTE", portal: null },
      { sankhya: "ATIVO", portal: "active", transform: "sn" },
      {
        sankhya: "CODCID",
        portal: null,
        note: "Cidade (TSICID) → city e country",
      },
      {
        sankhya: "CODEND",
        portal: null,
        note: "Logradouro (TSIEND) → address",
      },
      { sankhya: "NUMEND", portal: null, note: "Número → address" },
      { sankhya: "COMPLEMENTO", portal: null, note: "→ address" },
      { sankhya: "CODBAI", portal: null, note: "Bairro (TSIBAI) → address" },
      { sankhya: "CEP", portal: null, note: "→ address" },
      {
        sankhya: "TSICID.NOMECID / TSIUFS.UF",
        portal: "city",
        via: "TSICID, TSIUFS",
        note: "Cidade - UF",
      },
      {
        sankhya: "TSIPAI.DESCRICAO",
        portal: "country",
        via: "TSICID → TSIUFS → TSIPAI",
      },
      {
        sankhya: "TSIEND + NUMEND + COMPLEMENTO + TSIBAI + CEP",
        portal: "address",
        via: "TSIEND, TSIBAI",
      },
      {
        sankhya: "TGFCTT.NOMECONTATO",
        portal: "contactName",
        via: "TGFCTT",
        note: "Primeiro contato do parceiro (e-mail e telefone dele quando o parceiro não tem)",
      },
    ],
  },
  orderItems: {
    key: "orderItems",
    table: "TGFITE",
    sankhyaEntity: "ItemNota",
    portalTable: "order_items",
    key_: "NUNOTA, SEQUENCIA",
    fields: [
      {
        sankhya: "NUNOTA",
        portal: "orderId",
        transform: "int",
        note: "Pelo vínculo da nota",
      },
      {
        sankhya: "SEQUENCIA",
        portal: "sankhyaCode",
        transform: "text",
        note: "Vínculo do item (a nota é o vínculo do pedido)",
      },
      {
        sankhya: "CODPROD",
        portal: "productId",
        transform: "int",
        note: "Pelo vínculo do produto",
      },
      {
        sankhya: "DESCRPROD",
        portal: "name",
        transform: "text",
        note: "Do produto (TGFPRO)",
      },
      { sankhya: "QTDNEG", portal: "quantity", transform: "number" },
      { sankhya: "CODVOL", portal: "unit", transform: "text" },
      { sankhya: "VLRUNIT", portal: "unitPrice", transform: "number" },
      {
        sankhya: "VLRTOT",
        portal: null,
        note: "Total do item (o portal calcula)",
      },
    ],
  },
  products: {
    key: "products",
    table: "TGFPRO",
    sankhyaEntity: "Produto",
    portalTable: "products",
    key_: "CODPROD",
    fields: [
      {
        sankhya: "CODPROD",
        portal: "sankhyaCode",
        transform: "text",
        note: "Vínculo com o Sankhya",
      },
      { sankhya: "DESCRPROD", portal: "name", transform: "text" },
      {
        sankhya: "REFFORN",
        portal: "sku",
        transform: "text",
        note: "Código WX (ex.: WX7588)",
      },
      {
        sankhya: "REFERENCIA",
        portal: "ean",
        transform: "digits",
        note: "EAN",
      },
      {
        sankhya: "CODGRUPOPROD",
        portal: "lineId",
        transform: "int",
        note: "Grupo → linha (pelo vínculo do grupo)",
      },
      { sankhya: "NCM", portal: "ncm", transform: "digits" },
      {
        sankhya: "CARACTERISTICAS",
        portal: "specification",
        transform: "text",
      },
      { sankhya: "PESOBRUTO", portal: "grossWeightKg", transform: "number" },
      { sankhya: "PESOLIQ", portal: "netWeightKg", transform: "number" },
      { sankhya: "ALTURA", portal: "heightCm", transform: "metersToCm" },
      { sankhya: "LARGURA", portal: "widthCm", transform: "metersToCm" },
      { sankhya: "ESPESSURA", portal: "lengthCm", transform: "metersToCm" },
      {
        sankhya: "CODVOL",
        portal: null,
        note: "Unidade padrão (vai para o item do pedido)",
      },
      { sankhya: "MARCA", portal: "brand", transform: "text" },
      {
        sankhya: "COMPLDESC",
        portal: "notes",
        transform: "text",
        note: "Descrição complementar (só se vazio)",
      },
      {
        sankhya: "TGFCAB.CODPARC (última compra)",
        portal: "supplierId",
        via: "TGFITE + TGFCAB",
        note: "Fornecedor da última nota de importação com o produto (só se o produto não tiver fornecedor)",
      },
      {
        sankhya: "TGFITE.VLRUNIT ÷ TGFCAB.VLRMOEDA",
        portal: "price",
        via: "TGFITE + TGFCAB",
        note: "Preço da última compra na moeda do pedido (só se vazio)",
      },
      {
        sankhya: "TGFVOA.QUANTIDADE (maior)",
        portal: "masterBoxQty",
        via: "TGFVOA",
        note: "Volumes alternativos: o maior vira a caixa master (só se vazio)",
      },
      {
        sankhya: "TGFVOA.QUANTIDADE (menor > 1)",
        portal: "innerBoxQty",
        via: "TGFVOA",
        note: "Com dois ou mais volumes, o menor vira a caixa interna (só se vazio)",
      },
      { sankhya: "ESTMIN", portal: "minStock", transform: "number" },
      { sankhya: "ATIVO", portal: "active", transform: "sn" },
    ],
  },
  productGroups: {
    key: "productGroups",
    table: "TGFGRU",
    sankhyaEntity: "GrupoProduto",
    portalTable: "product_lines",
    key_: "CODGRUPOPROD",
    fields: [
      {
        sankhya: "CODGRUPOPROD",
        portal: "sankhyaCode",
        transform: "text",
        note: "Vínculo com o Sankhya",
      },
      { sankhya: "DESCRGRUPOPROD", portal: "name", transform: "text" },
      { sankhya: "ATIVO", portal: "active", transform: "sn" },
    ],
  },
  stock: {
    key: "stock",
    table: "TGFEST",
    sankhyaEntity: "Estoque",
    portalTable: "stock_movements",
    key_: "CODEMP, CODPROD, CODLOCAL, CONTROLE",
    fields: [
      {
        sankhya: "CODEMP",
        portal: null,
        note: "A carga lê só a empresa da Integração (CODEMP)",
      },
      {
        sankhya: "CODPROD",
        portal: "productId",
        transform: "int",
        note: "Pelo vínculo do produto",
      },
      {
        sankhya: "CODLOCAL",
        portal: "locationId",
        transform: "int",
        note: "Local de estoque (TGFLOC → stock_locations)",
      },
      {
        sankhya: "CONTROLE",
        portal: null,
        note: "Lote/controle: somado por produto e local",
      },
      {
        sankhya: "ESTOQUE",
        portal: "quantity",
        transform: "number",
        note: 'Saldo por produto e local: a carga grava a diferença como movimentação "Saldo do Sankhya"',
      },
      { sankhya: "RESERVADO", portal: null },
    ],
  },
  financial: {
    key: "financial",
    table: "TGFFIN",
    sankhyaEntity: "Financeiro",
    portalTable: "payments",
    key_: "NUFIN",
    fields: [
      {
        sankhya: "NUFIN",
        portal: "sankhyaCode",
        transform: "text",
        note: "Vínculo com o Sankhya",
      },
      {
        sankhya: "NUNOTA",
        portal: "orderId",
        transform: "int",
        note: "Pelo vínculo da nota",
      },
      { sankhya: "RECDESP", portal: "direction", transform: "recDesp" },
      {
        sankhya: "VLRDESDOB",
        portal: "amount",
        transform: "number",
        note: "Em R$",
      },
      {
        sankhya: "DTVENC",
        portal: null,
        note: "Vencimento (vai na observação)",
      },
      { sankhya: "CODPARC", portal: null, note: "Parceiro do título" },
      {
        sankhya: "CODTIPTIT",
        portal: null,
        note: "Tipo de título (TGFTIT) → method",
      },
      {
        sankhya: "TGFTIT.DESCRTIPTIT",
        portal: "method",
        via: "TGFTIT",
        note: "Forma de pagamento (boleto, câmbio...)",
      },
      {
        sankhya: "DHBAIXA",
        portal: "status",
        transform: "paidAt",
        uses: ["RECDESP"],
        note: "Baixado → confirmed/received; em aberto → pending",
      },
      { sankhya: "HISTORICO", portal: "note", transform: "text" },
    ],
  },
};

/* ---- SQL da amostra (só leitura; listas de inteiros já validadas) ---- */

const ints = (values: Array<number | string | null | undefined>) => {
  const list = [
    ...new Set(
      values.map((v) => Number(v)).filter((v) => Number.isInteger(v) && v >= 0),
    ),
  ];
  return list.length ? list.join(", ") : "-1";
};

const cols = (entity: SankhyaEntityKey, alias: string) =>
  ENTITY_MAPS[entity].fields
    .filter((f) => !f.via)
    .filter((f) => f.sankhya !== "DESCRPROD" || entity !== "orderItems")
    .map((f) => `${alias}.${f.sankhya}`)
    .join(", ");

/**
 * SQL de cada entidade da amostra. `ids` vem das entidades anteriores
 * (notas → parceiros/itens/financeiro; itens → produtos → grupos/estoque).
 * Com `star`, pede todas as colunas (para descobrir as que existem).
 */
export function sampleSql(
  entity: SankhyaEntityKey,
  ids: Array<number | string | null | undefined> = [],
  star = false,
): string {
  const list = ints(ids);
  switch (entity) {
    case "orders":
      return `SELECT ${star ? "C.*" : cols("orders", "C")} FROM TGFCAB C WHERE C.CODTIPOPER IN (${IMPORT_TOPS}) AND C.NUNOTA > (SELECT MAX(NUNOTA) - 50000 FROM TGFCAB) ORDER BY C.NUNOTA DESC`;
    case "partners":
      return `SELECT ${star ? "P.*" : cols("partners", "P")} FROM TGFPAR P WHERE P.CODPARC IN (${list}) ORDER BY P.CODPARC`;
    case "orderItems":
      return `SELECT ${star ? "I.*" : cols("orderItems", "I")}, P.DESCRPROD FROM TGFITE I JOIN TGFPRO P ON P.CODPROD = I.CODPROD WHERE I.NUNOTA IN (${list}) ORDER BY I.NUNOTA DESC, I.SEQUENCIA`;
    case "products":
      return `SELECT ${star ? "P.*" : cols("products", "P")} FROM TGFPRO P WHERE P.CODPROD IN (${list}) ORDER BY P.CODPROD`;
    case "productGroups":
      return `SELECT ${star ? "G.*" : cols("productGroups", "G")} FROM TGFGRU G WHERE G.CODGRUPOPROD IN (${list}) ORDER BY G.CODGRUPOPROD`;
    case "stock":
      return `SELECT ${star ? "E.*" : cols("stock", "E")} FROM TGFEST E WHERE E.CODPROD IN (${list}) ORDER BY E.CODPROD, E.CODLOCAL`;
    case "financial":
      return `SELECT ${star ? "F.*" : cols("financial", "F")} FROM TGFFIN F WHERE F.NUNOTA IN (${list}) ORDER BY F.NUFIN DESC`;
  }
}

/* ---- Conversão de um registro ---- */

type Row = Record<string, unknown>;

const blank = (v: unknown) => v == null || String(v).trim() === "";

/** Datas do Sankhya: "10/11/2026", "10112026 00:00:00", "2026-11-10…". */
export function sankhyaDate(value: unknown): string | null {
  if (blank(value)) return null;
  const text = String(value).trim();
  let m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(text);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  m = /^(\d{2})(\d{2})(\d{4})(\s|$)/.exec(text);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

const num = (v: unknown) => {
  if (blank(v)) return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

export function convert(
  transform: Transform | undefined,
  value: unknown,
  row: Row,
): unknown {
  switch (transform) {
    case undefined:
    case "text":
      return blank(value) ? null : String(value).trim();
    case "number":
      return num(value);
    case "int": {
      const n = num(value);
      return n == null ? null : Math.trunc(n);
    }
    case "sn":
      return blank(value) ? null : String(value).trim().toUpperCase() === "S";
    case "digits":
      return blank(value) ? null : String(value).replace(/\D/g, "") || null;
    case "metersToCm": {
      const n = num(value);
      return n == null ? null : Math.round(n * 1000) / 10;
    }
    case "date":
      return sankhyaDate(value);
    case "partyType": {
      const types = [
        String(value ?? "").toUpperCase() === "S" && "supplier",
        String(row.CLIENTE ?? "").toUpperCase() === "S" && "customer",
      ].filter(Boolean);
      return types.length ? types.join(" + ") : null;
    }
    case "recDesp": {
      const n = num(value);
      return n === 1 ? "customer_in" : n === -1 ? "supplier_out" : null;
    }
    case "incoterm": {
      const v = String(value ?? "")
        .trim()
        .toUpperCase();
      return v === "C" ? "CIF" : v === "F" ? "FOB" : null;
    }
    case "paidAt": {
      if (blank(value)) return "pending";
      return num(row.RECDESP) === 1 ? "received" : "confirmed";
    }
  }
}

export interface MappedValue {
  portal: string;
  sankhya: string;
  raw: unknown;
  value: unknown;
}

/** Valores do portal a partir de uma linha do Sankhya (só campos com destino). */
export function mapRow(entity: SankhyaEntityKey, row: Row): MappedValue[] {
  return ENTITY_MAPS[entity].fields
    .filter(
      (f): f is FieldMap & { portal: string } => f.portal !== null && !f.via,
    )
    .map((f) => ({
      portal: f.portal,
      sankhya: f.sankhya,
      raw: row[f.sankhya] ?? null,
      value: convert(f.transform, row[f.sankhya], row),
    }));
}

/** Colunas do mapeamento que não vieram do ERP (nomes a corrigir). */
export function missingColumns(
  entity: SankhyaEntityKey,
  columns: string[],
): string[] {
  const have = new Set(columns.map((c) => c.toUpperCase()));
  return ENTITY_MAPS[entity].fields
    .filter((f) => !f.via)
    .map((f) => f.sankhya)
    .filter((c) => !have.has(c.toUpperCase()));
}

/* ---- Carga completa por faixa de código (só leitura) ---- */

export const FULL_LOAD_ENTITIES = [
  "paymentConditions",
  "partners",
  "products",
  "stockLocations",
  "stockBalances",
  "orders",
  /* Fotos dos produtos (TGFPRO.IMAGEM e AD_IMAGEM*; sankhya-images.ts). */
  "productImages",
] as const;
export type FullLoadEntity = (typeof FULL_LOAD_ENTITIES)[number];

const FULL_LOAD_TABLE: Record<
  "partners" | "products",
  {
    entity: SankhyaEntityKey;
    table: string;
    alias: string;
    key: string;
    where: string;
  }
> = {
  partners: {
    entity: "partners",
    table: "TGFPAR",
    alias: "P",
    key: "CODPARC",
    where: "(P.FORNECEDOR = 'S' OR P.CLIENTE = 'S')",
  },
  products: {
    entity: "products",
    table: "TGFPRO",
    alias: "P",
    key: "CODPROD",
    where: "1 = 1",
  },
};

const int0 = (n: number) =>
  Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;

/**
 * SQL de um lote da carga completa: códigos em (after, upTo], em ordem. Faixa
 * de código em vez de "LIMIT" para valer no Oracle e no SQL Server.
 */
export function fullLoadSql(
  entity: FullLoadEntity,
  after: number,
  upTo: number,
  star = false,
  codEmp: number | null = null,
): string {
  const range = (col: string) =>
    `${col} > ${int0(after)} AND ${col} <= ${int0(upTo)}`;
  if (entity === "stockLocations")
    return `SELECT * FROM TGFLOC WHERE ${range("CODLOCAL")} ORDER BY CODLOCAL`;
  if (entity === "stockBalances")
    return `SELECT E.CODPROD, E.CODLOCAL, SUM(E.ESTOQUE) AS ESTOQUE, SUM(E.RESERVADO) AS RESERVADO FROM TGFEST E WHERE ${empFilter("E", codEmp)}${range("E.CODPROD")} GROUP BY E.CODPROD, E.CODLOCAL ORDER BY E.CODPROD, E.CODLOCAL`;
  if (entity === "orders")
    return `SELECT C.* FROM TGFCAB C WHERE C.CODTIPOPER IN (${IMPORT_TOPS}) AND ${range("C.NUNOTA")} ORDER BY C.NUNOTA`;
  if (entity === "paymentConditions")
    return `SELECT CODTIPVENDA, MAX(DESCRTIPVENDA) AS DESCRTIPVENDA FROM TGFTPV WHERE CODTIPVENDA > ${int0(after)} AND CODTIPVENDA <= ${int0(upTo)} GROUP BY CODTIPVENDA ORDER BY CODTIPVENDA`;
  if (entity === "productImages")
    throw new Error("productImages: SQL em sankhya-images.ts");
  const t = FULL_LOAD_TABLE[entity];
  const a = t.alias;
  return `SELECT ${star ? `${a}.*` : cols(t.entity, a)} FROM ${t.table} ${a} WHERE ${t.where} AND ${a}.${t.key} > ${int0(after)} AND ${a}.${t.key} <= ${int0(upTo)} ORDER BY ${a}.${t.key}`;
}

const empFilter = (alias: string, codEmp: number | null) =>
  codEmp != null && Number.isInteger(codEmp) && codEmp > 0
    ? `${alias}.CODEMP = ${codEmp} AND `
    : "";

/** Próximo código (para pular buracos) e total de registros da carga. */
export function fullLoadProbeSql(
  entity: FullLoadEntity,
  after: number,
  codEmp: number | null = null,
) {
  if (entity === "stockLocations")
    return `SELECT MIN(CODLOCAL) AS NEXTCODE, COUNT(*) AS REMAINING FROM TGFLOC WHERE CODLOCAL > ${int0(after)}`;
  if (entity === "stockBalances")
    return `SELECT MIN(E.CODPROD) AS NEXTCODE, COUNT(DISTINCT E.CODPROD) AS REMAINING FROM TGFEST E WHERE ${empFilter("E", codEmp)}E.CODPROD > ${int0(after)}`;
  if (entity === "orders")
    return `SELECT MIN(C.NUNOTA) AS NEXTCODE, COUNT(*) AS REMAINING FROM TGFCAB C WHERE C.CODTIPOPER IN (${IMPORT_TOPS}) AND C.NUNOTA > ${int0(after)}`;
  if (entity === "paymentConditions")
    return `SELECT MIN(CODTIPVENDA) AS NEXTCODE, COUNT(DISTINCT CODTIPVENDA) AS REMAINING FROM TGFTPV WHERE CODTIPVENDA > ${int0(after)}`;
  if (entity === "productImages")
    throw new Error("productImages: SQL em sankhya-images.ts");
  const t = FULL_LOAD_TABLE[entity];
  const a = t.alias;
  return `SELECT MIN(${a}.${t.key}) AS NEXTCODE, COUNT(*) AS REMAINING FROM ${t.table} ${a} WHERE ${t.where} AND ${a}.${t.key} > ${int0(after)}`;
}

export const FULL_LOAD_KEY: Record<FullLoadEntity, string> = {
  paymentConditions: "CODTIPVENDA",
  partners: "CODPARC",
  products: "CODPROD",
  stockLocations: "CODLOCAL",
  stockBalances: "CODPROD",
  orders: "NUNOTA",
  productImages: "CODPROD",
};

/* ---- Códigos do Sankhya guardados no registro (sankhyaRefs) ---- */

/** Colunas de endereço que também vão nos códigos (para incluir no Sankhya). */
const REF_EXTRA = new Set([
  "NUMEND",
  "COMPLEMENTO",
  "CEP",
  "TIPPESSOA",
  "TIPMOV",
  "CIF_FOB",
  "STATUSNOTA",
]);

/** Coluna que é código/ligação do Sankhya (COD*, NU*, chaves e endereço). */
export function isRefColumn(column: string) {
  const c = column.toUpperCase();
  return (
    c.startsWith("COD") ||
    c.startsWith("NU") ||
    c === "SEQUENCIA" ||
    REF_EXTRA.has(c)
  );
}

/**
 * Todos os códigos do registro do Sankhya (colunas COD*, NU*, SEQUENCIA e
 * endereço), sem os vazios: guardam as ligações com outras entidades do ERP
 * mesmo quando o portal não tem campo para elas.
 */
export function refsOf(row: Row): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(row)) {
    if (!isRefColumn(k) || blank(v)) continue;
    out[k.toUpperCase()] =
      typeof v === "number" ? v : String(v).trim().slice(0, 200);
  }
  return out;
}

/* ---- Ligações (valores de outras tabelas; sankhya-relations.ts) ---- */

/** Primeiro valor preenchido entre colunas candidatas (nomes variam por versão). */
export function pick(row: Row | undefined, ...columns: string[]) {
  if (!row) return null;
  for (const c of columns) {
    const v = row[c];
    if (!blank(v)) return String(v).trim();
  }
  return null;
}

/** "Itajaí - SC". */
export function cityLabel(city: Row | undefined, state: Row | undefined) {
  const name = pick(city, "NOMECID", "DESCRICAO");
  const uf = pick(state, "UF", "SIGLA");
  return name ? (uf ? `${name} - ${uf}` : name) : null;
}

/** "Rua X, 120 - Sala 3 - Centro - CEP 88300-000". */
export function addressLine(
  partner: Row,
  street: Row | undefined,
  district: Row | undefined,
) {
  const kind = pick(street, "TIPO");
  const name = pick(street, "NOMEEND", "DESCRICAO");
  const number = pick(partner, "NUMEND");
  const cep = String(partner.CEP ?? "").replace(/\D/g, "");
  const parts = [
    name
      ? [kind, name].filter(Boolean).join(" ") + (number ? `, ${number}` : "")
      : null,
    pick(partner, "COMPLEMENTO"),
    pick(district, "NOMEBAI", "DESCRICAO"),
    cep.length === 8 ? `CEP ${cep.slice(0, 5)}-${cep.slice(5)}` : cep || null,
  ].filter(Boolean);
  return parts.length ? parts.join(" - ").slice(0, 255) : null;
}

/**
 * Volumes alternativos do produto (TGFVOA: CX = 24 UN...): o maior vira a
 * caixa master; com dois ou mais, o menor acima de 1 vira a caixa interna.
 */
export function boxQuantities(rows: Row[]) {
  const qty = [
    ...new Set(
      rows
        .filter((r) => String(r.DIVIDEMULTIPLICA ?? "M").toUpperCase() !== "D")
        .map((r) => num(r.QUANTIDADE))
        .filter((n): n is number => n != null && n > 1),
    ),
  ].sort((a, b) => a - b);
  return {
    masterBoxQty: qty.length ? qty[qty.length - 1] : null,
    innerBoxQty: qty.length > 1 ? qty[0] : null,
  };
}
