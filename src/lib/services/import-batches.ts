import "server-only";

import {
  getStore,
  PARTY_EXTRA_DEFAULTS,
  PARTY_TYPES,
  PRODUCT_EXTRA_DEFAULTS,
  type ImportBatch,
  type PartyType,
  type Product,
  type SourcingItem,
  type User,
} from "@/lib/db";
import { assertWellmix } from "@/lib/auth/permissions";
import { boxCbm } from "@/lib/logistics/cbm";
import { DEFAULT_PREPARATION_REQUIREMENTS } from "@/lib/workflow/stages";
import { audit } from "./audit";
import { parseCsv } from "./import";
import { uploadDocument } from "./documents";
import { listSheets, readSheet } from "./xlsx";

/**
 * Importação de planilhas do sistema chinês (e de qualquer origem) em etapas:
 * UPLOAD → LEITURA → MAPEAMENTO → NORMALIZAÇÃO → PREVIEW → DECISÃO → IMPORTAÇÃO.
 * Nada é gravado nas tabelas finais antes da confirmação. Cada linha recebe uma
 * correspondência com o cadastro existente (matching determinístico) e uma
 * decisão: criar, atualizar ou ignorar. Sem duplicar fornecedor/produto.
 */

export const IMPORT_ENTITIES = [
  "products",
  "sourcing_items",
  "parties",
  "lines",
] as const;
export type ImportEntity = (typeof IMPORT_ENTITIES)[number];
export const MAX_ROWS = 2000;

export interface TargetField {
  key: string;
  /** Chave i18n do rótulo (import.field.<key>). */
  required?: boolean;
  kind: "text" | "number" | "currency";
}

const PRODUCT_FIELDS: TargetField[] = [
  { key: "name", required: true, kind: "text" },
  { key: "sku", kind: "text" },
  { key: "supplierSku", kind: "text" },
  { key: "supplier", kind: "text" },
  { key: "line", kind: "text" },
  { key: "category", kind: "text" },
  { key: "description", kind: "text" },
  { key: "material", kind: "text" },
  { key: "color", kind: "text" },
  { key: "pantone", kind: "text" },
  { key: "price", kind: "number" },
  { key: "currency", kind: "currency" },
  { key: "moq", kind: "number" },
  { key: "masterBoxQty", kind: "number" },
  { key: "innerBoxQty", kind: "number" },
  { key: "netWeightKg", kind: "number" },
  { key: "grossWeightKg", kind: "number" },
  { key: "lengthCm", kind: "number" },
  { key: "widthCm", kind: "number" },
  { key: "heightCm", kind: "number" },
  { key: "boxLengthCm", kind: "number" },
  { key: "boxWidthCm", kind: "number" },
  { key: "boxHeightCm", kind: "number" },
  { key: "cbm", kind: "number" },
  { key: "notes", kind: "text" },
];

export const TARGET_FIELDS: Record<ImportEntity, TargetField[]> = {
  products: PRODUCT_FIELDS,
  sourcing_items: PRODUCT_FIELDS.filter(
    (f) => f.key !== "line" && f.key !== "sku",
  ),
  parties: [
    { key: "type", kind: "text" },
    { key: "name", required: true, kind: "text" },
    { key: "country", kind: "text" },
    { key: "email", kind: "text" },
    { key: "phone", kind: "text" },
    { key: "taxId", kind: "text" },
    { key: "city", kind: "text" },
    { key: "address", kind: "text" },
    { key: "contactName", kind: "text" },
    { key: "wechat", kind: "text" },
    { key: "notes", kind: "text" },
  ],
  lines: [{ key: "name", required: true, kind: "text" }],
};

/** Sinônimos de cabeçalho (pt, en, zh) → campo. Comparação sem acento, sem caixa. */
const SYNONYMS: Record<string, string[]> = {
  name: [
    "nome",
    "produto",
    "product",
    "product name",
    "item",
    "name",
    "描述",
    "产品名称",
    "产品",
    "品名",
    "名称",
    "货品名称",
  ],
  sku: [
    "sku",
    "codigo",
    "código",
    "code",
    "codigo interno",
    "item code",
    "货号",
    "编号",
    "编码",
    "内部编码",
  ],
  supplierSku: [
    "codigo fornecedor",
    "supplier sku",
    "supplier code",
    "ref fornecedor",
    "供应商编号",
    "供应商货号",
    "厂家编号",
    "型号",
    "model",
  ],
  supplier: [
    "fornecedor",
    "supplier",
    "vendor",
    "fabrica",
    "fábrica",
    "factory",
    "供应商",
    "厂家",
    "工厂",
  ],
  line: ["linha", "line", "product line", "产品线", "系列"],
  category: ["categoria", "category", "类别", "分类", "品类"],
  description: [
    "descricao",
    "descrição",
    "description",
    "spec",
    "规格",
    "描述",
    "说明",
  ],
  material: ["material", "材质", "材料"],
  color: ["cor", "color", "colour", "颜色"],
  pantone: ["pantone", "潘通", "色号"],
  price: [
    "preco",
    "preço",
    "price",
    "unit price",
    "preco unitario",
    "fob",
    "fob price",
    "单价",
    "价格",
    "报价",
    "fob价",
  ],
  currency: ["moeda", "currency", "币种", "货币"],
  moq: [
    "moq",
    "minimo",
    "mínimo",
    "min order",
    "起订量",
    "最小起订量",
    "最低起订量",
  ],
  masterBoxQty: [
    "master box",
    "master",
    "caixa master",
    "qty per carton",
    "pcs per carton",
    "pcs/ctn",
    "pcs/ctn",
    "外箱装量",
    "装箱数",
    "每箱数量",
    "箱规",
    "外箱数量",
  ],
  innerBoxQty: [
    "inner box",
    "inner",
    "caixa interna",
    "pcs per inner",
    "内盒",
    "内盒装量",
    "内盒数量",
  ],
  netWeightKg: [
    "peso liquido",
    "peso líquido",
    "net weight",
    "n.w.",
    "nw",
    "净重",
    "净重(kg)",
    "净重kg",
  ],
  grossWeightKg: [
    "peso bruto",
    "gross weight",
    "g.w.",
    "gw",
    "毛重",
    "毛重(kg)",
    "毛重kg",
  ],
  lengthCm: ["comprimento", "length", "l", "长", "长(cm)", "长度", "产品长"],
  widthCm: ["largura", "width", "w", "宽", "宽(cm)", "宽度", "产品宽"],
  heightCm: ["altura", "height", "h", "高", "高(cm)", "高度", "产品高"],
  boxLengthCm: [
    "comprimento caixa",
    "carton length",
    "carton l",
    "外箱长",
    "箱长",
  ],
  boxWidthCm: ["largura caixa", "carton width", "carton w", "外箱宽", "箱宽"],
  boxHeightCm: ["altura caixa", "carton height", "carton h", "外箱高", "箱高"],
  cbm: ["cbm", "volume", "m3", "m³", "体积", "立方", "外箱体积"],
  notes: [
    "observacoes",
    "observações",
    "obs",
    "notes",
    "remark",
    "remarks",
    "备注",
  ],
  type: ["tipo", "type", "类型"],
  country: ["pais", "país", "country", "国家"],
  email: ["email", "e-mail", "邮箱", "电子邮件"],
  phone: ["telefone", "phone", "tel", "电话", "手机"],
  taxId: ["cnpj", "tax id", "taxid", "税号"],
  city: ["cidade", "city", "城市"],
  address: ["endereco", "endereço", "address", "地址"],
  contactName: ["contato", "contact", "contact name", "联系人"],
  wechat: ["wechat", "微信"],
};

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[\s_\-./()（）]+/g, " ")
    .trim();

/** Sugere o mapeamento cabeçalho → campo por sinônimo exato e depois por "contém". */
export function suggestMapping(
  headers: string[],
  entity: ImportEntity,
): Record<string, string> {
  const allowed = new Set(TARGET_FIELDS[entity].map((f) => f.key));
  const mapping: Record<string, string> = {};
  const used = new Set<string>();
  const tryMatch = (header: string, exact: boolean) => {
    const h = fold(header);
    for (const [field, names] of Object.entries(SYNONYMS)) {
      if (!allowed.has(field) || used.has(field)) continue;
      const hit = names.some((n) => {
        const f = fold(n);
        return exact ? h === f : f.length >= 3 && h.includes(f);
      });
      if (hit) {
        mapping[header] = field;
        used.add(field);
        return true;
      }
    }
    return false;
  };
  for (const header of headers) tryMatch(header, true);
  for (const header of headers) if (!mapping[header]) tryMatch(header, false);
  return mapping;
}

/* ------------------------------------------------------------------------ */
/* Normalização                                                              */
/* ------------------------------------------------------------------------ */

export function parseNumber(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/[^\d.,\-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "") // separador de milhar "1.200"
    .replace(",", ".");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function detectCurrency(
  raw: string | undefined,
  fallback: string,
): string {
  if (!raw) return fallback;
  const s = raw.toUpperCase();
  if (/[¥￥]|RMB|CNY|元/.test(s)) return "CNY";
  if (/R\$|BRL/.test(s)) return "BRL";
  if (/US\$|USD|\$/.test(s)) return "USD";
  if (/€|EUR/.test(s)) return "EUR";
  const code = s.replace(/[^A-Z]/g, "");
  return code.length === 3 ? code : fallback;
}

export interface NormalizedRow {
  fields: Record<string, string | number | null>;
  problems: string[];
}

export function normalizeRow(
  row: Record<string, string>,
  mapping: Record<string, string>,
  entity: ImportEntity,
  options: { defaultCurrency?: string } = {},
): NormalizedRow {
  const fields: Record<string, string | number | null> = {};
  const problems: string[] = [];
  const defs = TARGET_FIELDS[entity];
  for (const [header, target] of Object.entries(mapping)) {
    if (!target || target.startsWith("__")) continue;
    const def = defs.find((f) => f.key === target);
    if (!def) continue;
    const raw = (row[header] ?? "").trim();
    if (raw === "") continue;
    if (def.kind === "number") {
      const n = parseNumber(raw);
      if (n === null) problems.push(`invalid_number:${target}`);
      else fields[target] = n;
      // Preço com símbolo de moeda define a moeda quando não há coluna própria.
      if (target === "price" && fields.currency === undefined) {
        const cur = detectCurrency(raw, "");
        if (cur) fields.currency = cur;
      }
    } else if (def.kind === "currency") {
      fields[target] = detectCurrency(raw, options.defaultCurrency ?? "USD");
    } else {
      fields[target] = raw;
    }
  }
  if (fields.price !== undefined && fields.currency === undefined)
    fields.currency = options.defaultCurrency ?? "USD";
  for (const def of defs) {
    if (
      def.required &&
      (fields[def.key] === undefined || fields[def.key] === "")
    )
      problems.push(`missing:${def.key}`);
  }
  return { fields, problems };
}

/* ------------------------------------------------------------------------ */
/* Lote                                                                      */
/* ------------------------------------------------------------------------ */

const isXlsx = (file: File) =>
  /\.xls[xm]$/i.test(file.name) ||
  file.type ===
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function createImportBatch(
  user: User,
  entity: ImportEntity,
  file: File,
  sheet?: string,
): Promise<ImportBatch> {
  assertWellmix(user);
  if (!IMPORT_ENTITIES.includes(entity)) throw new Error("invalid_entity");
  const bytes = new Uint8Array(await file.arrayBuffer());
  let headers: string[];
  let rows: Record<string, string>[];
  let sheetName: string | null = null;
  if (isXlsx(file)) {
    const data = readSheet(bytes, sheet, MAX_ROWS);
    headers = data.headers;
    rows = data.rows;
    sheetName = data.name;
  } else {
    rows = parseCsv(new TextDecoder().decode(bytes)).slice(0, MAX_ROWS);
    headers = rows[0] ? Object.keys(rows[0]) : [];
  }
  if (headers.length === 0) throw new Error("empty_file");
  // O arquivo original fica guardado (evidência do que foi importado).
  const doc = await uploadDocument(user, file, {
    type: "attachment",
    visibility: "internal",
  }).catch(() => null);
  const store = getStore();
  const batch = await store.create("import_batches", {
    entity,
    fileDocumentId: doc?.id ?? null,
    fileName: file.name,
    sheetName,
    headers,
    rows,
    mapping: suggestMapping(headers, entity),
    decisions: {},
    status: "uploaded",
    summary: null,
    rowCount: rows.length,
    createdByUserId: user.id,
  });
  await audit(
    user,
    "import.upload",
    "import_batch",
    batch.id,
    `${entity}: ${file.name} (${rows.length} linhas)`,
  );
  return batch;
}

export async function listSheetNames(file: File): Promise<string[]> {
  if (!isXlsx(file)) return [];
  return listSheets(new Uint8Array(await file.arrayBuffer()));
}

export async function setBatchMapping(
  user: User,
  batchId: string,
  mapping: Record<string, string>,
) {
  assertWellmix(user);
  const store = getStore();
  const batch = await store.get("import_batches", batchId);
  if (!batch || batch.status === "imported") throw new Error("invalid_batch");
  return store.update("import_batches", batchId, { mapping, status: "mapped" });
}

/* ------------------------------------------------------------------------ */
/* Preview com correspondências                                              */
/* ------------------------------------------------------------------------ */

export interface PreviewRow {
  index: number;
  fields: Record<string, string | number | null>;
  problems: string[];
  match: { id: string; label: string; reason: string } | null;
  suggested: "create" | "update" | "skip";
  /** Fornecedor/linha resolvidos por nome. */
  supplierId: string | null;
  lineId: string | null;
}

export async function previewBatch(batch: ImportBatch): Promise<PreviewRow[]> {
  const store = getStore();
  const entity = batch.entity as ImportEntity;
  const [products, parties, lines, sourcing] = await Promise.all([
    entity === "products"
      ? store.list("products")
      : Promise.resolve([] as Product[]),
    store.list("parties"),
    store.list("product_lines"),
    entity === "sourcing_items"
      ? store.list("sourcing_items")
      : Promise.resolve([] as SourcingItem[]),
  ]);
  const suppliers = parties.filter((p) => p.type === "supplier");
  const byFold = <T extends { name: string }>(rows: T[], name: string) =>
    rows.find((r) => fold(r.name) === fold(name)) ?? null;
  const defaultLineId = batch.mapping.__defaultLineId ?? null;
  const defaultCurrency = batch.mapping.__defaultCurrency ?? "USD";

  return batch.rows.map((row, index) => {
    const { fields, problems } = normalizeRow(row, batch.mapping, entity, {
      defaultCurrency,
    });
    let match: PreviewRow["match"] = null;
    let supplierId: string | null = null;
    let lineId: string | null = null;

    if (entity === "products" || entity === "sourcing_items") {
      const supplierName = fields.supplier as string | undefined;
      if (supplierName) {
        const s = byFold(suppliers, supplierName);
        if (s) supplierId = s.id;
        else problems.push("supplier_not_found");
      }
    }
    if (entity === "products") {
      const lineName = fields.line as string | undefined;
      const line = lineName
        ? (byFold(lines, lineName) ??
          lines.find((l) => l.id === lineName) ??
          null)
        : null;
      lineId = line?.id ?? defaultLineId;
      if (!lineId) problems.push("line_not_found");
      const sku = fields.sku as string | undefined;
      const supplierSku = fields.supplierSku as string | undefined;
      const name = fields.name as string | undefined;
      const found =
        (sku && products.find((p) => p.sku && fold(p.sku) === fold(sku))) ||
        (supplierSku &&
          products.find(
            (p) =>
              p.supplierSku &&
              fold(p.supplierSku) === fold(supplierSku) &&
              (!supplierId || !p.supplierId || p.supplierId === supplierId),
          )) ||
        (name && byFold(products, name)) ||
        null;
      if (found)
        match = {
          id: found.id,
          label: `${found.name}${found.sku ? ` (${found.sku})` : ""}`,
          reason:
            sku && found.sku && fold(found.sku) === fold(sku)
              ? "sku"
              : supplierSku && found.supplierSku
                ? "supplierSku"
                : "name",
        };
    } else if (entity === "sourcing_items") {
      const supplierSku = fields.supplierSku as string | undefined;
      const name = fields.name as string | undefined;
      const found =
        (supplierSku &&
          sourcing.find(
            (s) => s.supplierSku && fold(s.supplierSku) === fold(supplierSku),
          )) ||
        (name && byFold(sourcing, name)) ||
        null;
      if (found)
        match = {
          id: found.id,
          label: found.name,
          reason: supplierSku ? "supplierSku" : "name",
        };
    } else if (entity === "parties") {
      const taxId = fields.taxId as string | undefined;
      const email = fields.email as string | undefined;
      const name = fields.name as string | undefined;
      const found =
        (taxId &&
          parties.find(
            (p) =>
              p.taxId &&
              p.taxId.replace(/\D/g, "") === taxId.replace(/\D/g, ""),
          )) ||
        (email &&
          parties.find(
            (p) => p.email && p.email.toLowerCase() === email.toLowerCase(),
          )) ||
        (name && byFold(parties, name)) ||
        null;
      if (found)
        match = {
          id: found.id,
          label: found.name,
          reason: taxId ? "taxId" : email ? "email" : "name",
        };
      const type = (
        (fields.type as string | undefined) ?? "supplier"
      ).toLowerCase();
      if (!(PARTY_TYPES as readonly string[]).includes(type))
        problems.push("invalid_type");
      fields.type = type;
    } else if (entity === "lines") {
      const name = fields.name as string | undefined;
      const found = name ? byFold(lines, name) : null;
      if (found) match = { id: found.id, label: found.name, reason: "name" };
    }

    const blocking = problems.some(
      (p) =>
        p.startsWith("missing:") ||
        p === "line_not_found" ||
        p === "invalid_type",
    );
    const suggested: PreviewRow["suggested"] = blocking
      ? "skip"
      : match
        ? "update"
        : "create";
    return { index, fields, problems, match, suggested, supplierId, lineId };
  });
}

/* ------------------------------------------------------------------------ */
/* Aplicação                                                                 */
/* ------------------------------------------------------------------------ */

const productPatch = (
  fields: Record<string, string | number | null>,
  supplierId: string | null,
) => {
  const n = (k: string) =>
    typeof fields[k] === "number" ? (fields[k] as number) : null;
  const s = (k: string) =>
    typeof fields[k] === "string" && fields[k] !== ""
      ? (fields[k] as string)
      : null;
  const base = {
    supplierId,
    supplierSku: s("supplierSku"),
    category: s("category"),
    material: s("material"),
    color: s("color"),
    pantone: s("pantone"),
    moq: n("moq"),
    price: n("price"),
    currency: s("currency"),
    masterBoxQty: n("masterBoxQty"),
    innerBoxQty: n("innerBoxQty"),
    netWeightKg: n("netWeightKg"),
    grossWeightKg: n("grossWeightKg"),
    widthCm: n("widthCm"),
    heightCm: n("heightCm"),
    lengthCm: n("lengthCm"),
    boxLengthCm: n("boxLengthCm"),
    boxWidthCm: n("boxWidthCm"),
    boxHeightCm: n("boxHeightCm"),
    cbm: null as number | null,
    notes: s("notes"),
  };
  base.cbm = boxCbm(base);
  return base;
};

/** Só sobrescreve com valores presentes na planilha; o que não veio fica como está. */
function definedOnly<T extends Record<string, unknown>>(patch: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v !== null && v !== undefined) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

export async function applyImportBatch(
  user: User,
  batchId: string,
  decisions: Record<string, string>,
) {
  assertWellmix(user);
  const store = getStore();
  const batch = await store.get("import_batches", batchId);
  if (!batch || batch.status === "imported") throw new Error("invalid_batch");
  const entity = batch.entity as ImportEntity;
  const preview = await previewBatch(batch);
  const summary = { created: 0, updated: 0, skipped: 0, errors: 0 };

  for (const row of preview) {
    const decision = decisions[String(row.index)] ?? row.suggested;
    if (decision === "skip") {
      summary.skipped++;
      continue;
    }
    const updateId =
      decision === "update"
        ? (row.match?.id ?? null)
        : decision.startsWith("update:")
          ? decision.slice(7)
          : null;
    try {
      const f = row.fields;
      const name = String(f.name ?? "");
      if (entity === "products") {
        const patch = productPatch(f, row.supplierId);
        if (updateId) {
          await store.update("products", updateId, {
            ...definedOnly(patch),
            ...(f.sku ? { sku: String(f.sku) } : {}),
            ...(f.description ? { specification: String(f.description) } : {}),
          });
          summary.updated++;
        } else {
          if (!row.lineId) throw new Error("line_not_found");
          await store.create("products", {
            ...PRODUCT_EXTRA_DEFAULTS,
            ...patch,
            lineId: row.lineId,
            name,
            sku: f.sku ? String(f.sku) : null,
            specification: f.description ? String(f.description) : null,
            active: true,
            source: "import",
          });
          summary.created++;
        }
      } else if (entity === "sourcing_items") {
        const patch = productPatch(f, row.supplierId);
        if (updateId) {
          await store.update("sourcing_items", updateId, {
            ...definedOnly(patch),
            ...(f.supplier ? { supplierName: String(f.supplier) } : {}),
            ...(f.description ? { description: String(f.description) } : {}),
          });
          summary.updated++;
        } else {
          await store.create("sourcing_items", {
            ...patch,
            visitId: null,
            supplierName: f.supplier ? String(f.supplier) : null,
            productId: null,
            lineId: null,
            name,
            description: f.description ? String(f.description) : null,
            conditions: null,
            foundAt: null,
            city: null,
            location: null,
            status: "draft",
            primaryPhotoDocumentId: null,
            createdByUserId: user.id,
          });
          summary.created++;
        }
      } else if (entity === "parties") {
        const s = (k: string) =>
          typeof f[k] === "string" && f[k] !== "" ? (f[k] as string) : null;
        const data = {
          type: (f.type as PartyType) ?? "supplier",
          name,
          country: s("country"),
          email: s("email"),
          phone: s("phone"),
          taxId: s("taxId"),
          notes: s("notes"),
          city: s("city"),
          address: s("address"),
          contactName: s("contactName"),
          wechat: s("wechat"),
        };
        if (updateId) {
          const { type: _type, name: _name, ...rest } = data;
          void _type;
          void _name;
          await store.update("parties", updateId, definedOnly(rest));
          summary.updated++;
        } else {
          await store.create("parties", {
            ...PARTY_EXTRA_DEFAULTS,
            ...data,
            active: true,
          });
          summary.created++;
        }
      } else if (entity === "lines") {
        if (updateId) {
          summary.skipped++;
        } else {
          await store.create("product_lines", {
            name,
            manualDocumentId: null,
            requirements: DEFAULT_PREPARATION_REQUIREMENTS,
            active: true,
          });
          summary.created++;
        }
      }
    } catch {
      summary.errors++;
    }
  }
  await store.update("import_batches", batchId, {
    decisions,
    status: "imported",
    summary,
  });
  await audit(
    user,
    "import.apply",
    "import_batch",
    batchId,
    `${entity}: ${summary.created} criados, ${summary.updated} atualizados, ${summary.skipped} ignorados, ${summary.errors} erros`,
  );
  return summary;
}

/** Cancela um lote ainda não importado; nada foi gravado nas tabelas finais. */
export async function cancelImportBatch(user: User, batchId: string) {
  assertWellmix(user);
  const store = getStore();
  const batch = await store.get("import_batches", batchId);
  if (!batch || batch.status === "imported") throw new Error("invalid_batch");
  await store.update("import_batches", batchId, { status: "cancelled" });
  await audit(user, "import.cancel", "import_batch", batchId, batch.fileName);
}
