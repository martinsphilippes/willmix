import "server-only";
import {
  getStore,
  LINE_EXTRA_DEFAULTS,
  ORDER_EXTRA_DEFAULTS,
  PARTY_EXTRA_DEFAULTS,
  PAYMENT_EXTRA_DEFAULTS,
  PRODUCT_EXTRA_DEFAULTS,
  REQUEST_EXTRA_DEFAULTS,
  type Order,
  type Party,
  type Product,
  type ProductLine,
  type User,
} from "@/lib/db";
import { STAGE_KEYS } from "@/lib/db/schema";
import { DEFAULT_PREPARATION_REQUIREMENTS } from "@/lib/workflow/stages";
import { createStagesForOrder } from "@/lib/workflow/engine";
import { audit } from "@/lib/services/audit";
import type { SankhyaRow } from "./sankhya-client";
import { convert, refsOf, sankhyaDate, TOP_STAGES } from "./sankhya-mapping";
import type { ImportSet } from "./sankhya-sample";
import {
  partnerExtras,
  productExtras,
  titleTypeNames,
  type PartnerExtra,
  type ProductExtra,
} from "./sankhya-relations";
import {
  DEFAULT_SANKHYA_ERP,
  type SankhyaErpSettings,
} from "./sankhya-settings";

/*
 * Grava no portal o que veio do Sankhya (aba Carga do Sankhya; docs/SANKHYA.md):
 * a amostra (notas com tudo o que elas usam) e a carga completa de cadastros
 * (fornecedores, clientes, produtos, linhas e condições de pagamento).
 *
 * Decisões da Wellmix: pedidos entram como pedidos normais, a TOP define a
 * etapa, a moeda do pedido é a do Sankhya com o câmbio do pedido (USD =
 * VLRNOTA ÷ VLRMOEDA); sem câmbio, R$. REFFORN = SKU (código interno),
 * CODPROD = vínculo, REFERENCIA = EAN.
 *
 * Idempotente: cada cadastro guarda o código do Sankhya (`sankhyaCode`). O que
 * já existe é reaproveitado pelo código; sem código, por CNPJ/nome
 * (parceiro), SKU (produto) ou nome (linha), e ganha o código. Na carga
 * completa (`update`), os campos que vêm do Sankhya são atualizados: o
 * Sankhya é a fonte desses cadastros. Estoque não é gravado (o portal calcula).
 */

export type ImportOutcome =
  "created" | "linked" | "existing" | "updated" | "skipped";

export type ImportEntity =
  | "productGroups"
  | "products"
  | "partners"
  | "customers"
  | "companies"
  | "carriers"
  | "stockLocations"
  | "stockBalances"
  | "orders"
  | "financial"
  | "paymentConditions";

export interface ImportLine {
  entity: ImportEntity;
  code: string;
  outcome: ImportOutcome;
  /** Id no portal (quando há). */
  id: string | null;
  label: string;
  /** Motivo de "skipped". */
  reason?: string;
}

const text = (row: SankhyaRow, column: string) =>
  convert("text", row[column], row) as string | null;
const number = (row: SankhyaRow, column: string) =>
  convert("number", row[column], row) as number | null;
const code = (v: unknown) => (v == null ? "" : String(v).trim());
const norm = (v: unknown) =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
const round = (n: number, places = 4) =>
  Math.round(n * 10 ** places) / 10 ** places;

/** Só as chaves com valor (não apaga o que o portal já tem). */
const filled = <T extends Record<string, unknown>>(data: T): Partial<T> =>
  Object.fromEntries(
    Object.entries(data).filter(([, v]) => v != null && v !== ""),
  ) as Partial<T>;

/** Marca o que veio do Sankhya como sincronizado (não volta para lá). */
const syncedNow = () => new Date(Date.now() + 10_000).toISOString();

/** "AAAA-MM-DD" → ISO ao meio-dia de Brasília (evita virar o dia). */
const isoOf = (value: unknown) => {
  const day = sankhyaDate(value);
  return day ? `${day}T15:00:00.000Z` : null;
};

/* ------------------------------------------------------------------------ */
/* Contexto: cadastros do portal carregados uma vez por lote                 */
/* ------------------------------------------------------------------------ */

export interface ImportContext {
  user: User;
  out: ImportLine[];
  /** Carga completa: atualiza os campos vindos do Sankhya nos que já existem. */
  update: boolean;
  lines: ProductLine[];
  parties: Party[];
  products: Product[];
}

/**
 * Só os cadastros destes códigos do Sankhya (mais os nascidos no portal, sem
 * código, que a carga pode ligar por CNPJ, nome ou referência). Sem escopo, as
 * tabelas inteiras.
 */
export interface ContextScope {
  parties: string[];
  products: string[];
  lines: string[];
}

export async function importContext(
  user: User,
  update: boolean,
  scope?: ContextScope,
): Promise<ImportContext> {
  const store = getStore();
  if (!scope) {
    const [lines, parties, products] = await Promise.all([
      store.list("product_lines"),
      store.list("parties"),
      store.list("products"),
    ]);
    return { user, out: [], update, lines, parties, products };
  }
  // Uma nota do histórico usa poucos parceiros e produtos: ler as tabelas
  // inteiras (dezenas de milhares de linhas) a cada nota estourava os 60 s
  // da Vercel.
  const byCodes = async <K extends "product_lines" | "parties" | "products">(
    table: K,
    codes: string[],
  ) => {
    const unique = [...new Set(codes.filter(Boolean))];
    const [coded, portal] = await Promise.all([
      unique.length
        ? store.list(table, {
            filter: { sankhyaCode: unique } as never,
          })
        : Promise.resolve([]),
      store.list(table, { filter: { sankhyaCode: null } as never }),
    ]);
    return [...coded, ...portal];
  };
  const [lines, parties, products] = await Promise.all([
    byCodes("product_lines", scope.lines),
    byCodes("parties", scope.parties),
    byCodes("products", scope.products),
  ]);
  return {
    user,
    out: [],
    update,
    lines: lines as ProductLine[],
    parties: parties as Party[],
    products: products as Product[],
  };
}

/* ---- Linhas de produto (grupos) ---- */

export async function upsertGroups(ctx: ImportContext, rows: SankhyaRow[]) {
  const store = getStore();
  const lineByGroup = new Map<string, string>();
  for (const row of rows) {
    const key = code(row.CODGRUPOPROD);
    const name = text(row, "DESCRGRUPOPROD") ?? `Grupo ${key}`;
    const active = convert("sn", row.ATIVO, row) !== false;
    let line = ctx.lines.find((l) => l.sankhyaCode === key);
    let outcome: ImportOutcome = "existing";
    if (line && ctx.update && (line.name !== name || line.active !== active)) {
      line = await store.update("product_lines", line.id, { name, active });
      outcome = "updated";
    }
    if (!line) {
      line = ctx.lines.find((l) => norm(l.name) === norm(name));
      if (line) {
        line = await store.update("product_lines", line.id, {
          sankhyaCode: key,
        });
        outcome = "linked";
      }
    }
    if (!line) {
      line = await store.create("product_lines", {
        ...LINE_EXTRA_DEFAULTS,
        name,
        manualDocumentId: null,
        requirements: DEFAULT_PREPARATION_REQUIREMENTS,
        requiredCertifications: null,
        active,
        sankhyaCode: key,
      });
      ctx.lines.push(line);
      outcome = "created";
    }
    replaceIn(ctx.lines, line);
    lineByGroup.set(key, line.id);
    ctx.out.push({
      entity: "productGroups",
      code: key,
      outcome,
      id: line.id,
      label: line.name,
    });
  }
  return lineByGroup;
}

function replaceIn<T extends { id: string }>(list: T[], row: T) {
  const i = list.findIndex((r) => r.id === row.id);
  if (i >= 0) list[i] = row;
}

/** Produto sem grupo no Sankhya: linha "Importados do Sankhya". */
async function fallbackLine(ctx: ImportContext) {
  const name = "Importados do Sankhya";
  const found = ctx.lines.find((l) => l.name === name);
  if (found) return found.id;
  const created = await getStore().create("product_lines", {
    ...LINE_EXTRA_DEFAULTS,
    name,
    manualDocumentId: null,
    requirements: DEFAULT_PREPARATION_REQUIREMENTS,
    requiredCertifications: null,
    active: true,
  });
  ctx.lines.push(created);
  return created.id;
}

/* ---- Produtos ---- */

/** Campos do produto que vêm do Sankhya. */
function productFields(row: SankhyaRow) {
  const cm = (column: string) =>
    convert("metersToCm", row[column], row) as number | null;
  return {
    name: text(row, "DESCRPROD") ?? `Produto ${code(row.CODPROD)}`,
    sku: text(row, "REFFORN"),
    ean: convert("digits", row.REFERENCIA, row) as string | null,
    ncm: convert("digits", row.NCM, row) as string | null,
    grossWeightKg: number(row, "PESOBRUTO"),
    netWeightKg: number(row, "PESOLIQ"),
    heightCm: cm("ALTURA"),
    widthCm: cm("LARGURA"),
    lengthCm: cm("ESPESSURA"),
    minStock: number(row, "ESTMIN"),
    brand: text(row, "MARCA"),
    sankhyaRefs: refsOf(row),
    active: convert("sn", row.ATIVO, row) !== false,
  };
}

/**
 * Campos que vêm de outras tabelas (fornecedor e preço da última compra,
 * caixas) e da descrição complementar: só preenchem o que estiver vazio no
 * portal (a negociação feita no portal vale mais).
 */
function productExtraFields(
  ctx: ImportContext,
  row: SankhyaRow,
  extra: ProductExtra | undefined,
  currency: string,
) {
  const supplier = extra?.supplierCode
    ? ctx.parties.find(
        (p) => p.type === "supplier" && p.sankhyaCode === extra.supplierCode,
      )
    : undefined;
  const fx = extra?.lastFx && extra.lastFx > 0 ? extra.lastFx : null;
  const price =
    extra?.lastPrice != null
      ? fx
        ? round(extra.lastPrice / fx)
        : extra.lastPrice
      : null;
  const notes = text(row, "COMPLDESC");
  return {
    supplierId: supplier?.id ?? null,
    price,
    currency: price == null ? null : fx ? currency : "BRL",
    masterBoxQty: extra?.masterBoxQty ?? null,
    innerBoxQty: extra?.innerBoxQty ?? null,
    notes: notes || null,
  };
}

export async function upsertProducts(
  ctx: ImportContext,
  rows: SankhyaRow[],
  lineByGroup: Map<string, string>,
  currency = DEFAULT_SANKHYA_ERP.currency,
) {
  const store = getStore();
  const extras = await productExtras(rows);
  const byCode = new Map<
    string,
    { id: string; name: string; lineId: string }
  >();
  for (const row of rows) {
    const key = code(row.CODPROD);
    const fields = productFields(row);
    const extra = productExtraFields(ctx, row, extras.get(key), currency);
    const emptyOnly = (p: Product) =>
      filled(
        Object.fromEntries(
          Object.entries(extra).filter(
            ([k]) =>
              p[k as keyof Product] == null || p[k as keyof Product] === "",
          ),
        ),
      );
    const groupLine = lineByGroup.get(code(row.CODGRUPOPROD));
    let product = ctx.products.find((p) => p.sankhyaCode === key);
    let outcome: ImportOutcome = "existing";
    if (product && ctx.update) {
      product = await store.update("products", product.id, {
        ...fields,
        ...emptyOnly(product),
        sankhyaSyncedAt: syncedNow(),
        ...(groupLine ? { lineId: groupLine } : {}),
        // Especificação do portal só é preenchida quando estiver vazia.
        ...(product.specification
          ? {}
          : { specification: text(row, "CARACTERISTICAS") }),
      });
      outcome = "updated";
    }
    if (!product && fields.sku) {
      const sku = fields.sku.toUpperCase();
      product = ctx.products.find(
        (p) => !p.sankhyaCode && (p.sku ?? "").toUpperCase() === sku,
      );
      if (product) {
        product = await store.update("products", product.id, {
          sankhyaCode: key,
          sankhyaSyncedAt: syncedNow(),
          ...(ctx.update ? fields : {}),
          ...emptyOnly(product),
        });
        outcome = "linked";
      }
    }
    if (!product) {
      product = await store.create("products", {
        ...PRODUCT_EXTRA_DEFAULTS,
        ...fields,
        ...extra,
        lineId: groupLine ?? (await fallbackLine(ctx)),
        specification: text(row, "CARACTERISTICAS"),
        source: "import",
        sankhyaCode: key,
        sankhyaSyncedAt: syncedNow(),
      });
      ctx.products.push(product);
      outcome = "created";
    }
    replaceIn(ctx.products, product);
    byCode.set(key, {
      id: product.id,
      name: product.name,
      lineId: product.lineId,
    });
    ctx.out.push({
      entity: "products",
      code: key,
      outcome,
      id: product.id,
      label: `${product.sku ?? ""} ${product.name}`.trim(),
    });
  }
  return byCode;
}

/* ---- Parceiros: fornecedores, clientes e empresas ---- */

interface PartyData {
  type: Party["type"];
  name: string;
  taxId: string | null;
  email?: string | null;
  phone?: string | null;
  contactName?: string | null;
  legalName?: string | null;
  stateRegistration?: string | null;
  personType?: string | null;
  city?: string | null;
  country?: string | null;
  address?: string | null;
  sankhyaRefs?: Record<string, string | number> | null;
  active: boolean;
}

export async function upsertParty(
  ctx: ImportContext,
  entity: "partners" | "customers" | "companies" | "carriers",
  key: string,
  data: PartyData,
) {
  const store = getStore();
  // O mesmo CODPARC pode ser fornecedor e cliente: um cadastro por tipo.
  let party = ctx.parties.find(
    (p) => p.sankhyaCode === key && p.type === data.type,
  );
  let outcome: ImportOutcome = "existing";
  const fields = {
    name: data.name,
    taxId: data.taxId,
    email: data.email ?? null,
    phone: data.phone ?? null,
    active: data.active,
    // Vindos de outras tabelas: só quando o Sankhya tem (não apaga o portal).
    ...filled({
      contactName: data.contactName,
      legalName: data.legalName,
      stateRegistration: data.stateRegistration,
      personType: data.personType,
      city: data.city,
      country: data.country,
      address: data.address,
      sankhyaRefs:
        data.sankhyaRefs && Object.keys(data.sankhyaRefs).length
          ? data.sankhyaRefs
          : null,
    }),
  };
  if (party && ctx.update) {
    party = await store.update("parties", party.id, {
      ...fields,
      sankhyaSyncedAt: syncedNow(),
    });
    outcome = "updated";
  }
  if (!party) {
    party = ctx.parties.find(
      (p) =>
        p.type === data.type &&
        !p.sankhyaCode &&
        ((data.taxId && (p.taxId ?? "").replace(/\D/g, "") === data.taxId) ||
          norm(p.name) === norm(data.name)),
    );
    if (party) {
      party = await store.update("parties", party.id, {
        sankhyaCode: key,
        sankhyaSyncedAt: syncedNow(),
        ...(ctx.update ? fields : {}),
      });
      outcome = "linked";
    }
  }
  if (!party) {
    party = await store.create("parties", {
      ...PARTY_EXTRA_DEFAULTS,
      ...fields,
      type: data.type,
      country: fields.country ?? null,
      notes: "Importado do Sankhya",
      sankhyaCode: key,
      sankhyaSyncedAt: syncedNow(),
    });
    ctx.parties.push(party);
    outcome = "created";
  }
  replaceIn(ctx.parties, party);
  ctx.out.push({ entity, code: key, outcome, id: party.id, label: party.name });
  return party;
}

/** Dados do parceiro (TGFPAR) para o portal. */
export function partnerData(
  row: SankhyaRow,
  type: "supplier" | "customer" | "carrier",
  extra?: PartnerExtra,
): PartyData {
  const person = text(row, "TIPPESSOA")?.toUpperCase().slice(0, 1) ?? null;
  return {
    type,
    name: text(row, "NOMEPARC") ?? `Parceiro ${code(row.CODPARC)}`,
    taxId: convert("digits", row.CGC_CPF, row) as string | null,
    email: text(row, "EMAIL") ?? extra?.contactEmail ?? null,
    phone: text(row, "TELEFONE") ?? extra?.contactPhone ?? null,
    contactName: extra?.contactName ?? null,
    legalName: text(row, "RAZAOSOCIAL"),
    stateRegistration: text(row, "IDENTINSCESTAD"),
    personType: person === "F" || person === "J" ? person : null,
    city: extra?.city ?? null,
    country: extra?.country ?? null,
    address: extra?.address ?? null,
    sankhyaRefs: refsOf(row),
    active: convert("sn", row.ATIVO, row) !== false,
  };
}

/** Carga completa de parceiros: FORNECEDOR = S → fornecedor; CLIENTE = S → cliente. */
export async function upsertPartners(ctx: ImportContext, rows: SankhyaRow[]) {
  const extras = await partnerExtras(rows);
  for (const row of rows) {
    const key = code(row.CODPARC);
    const extra = extras.get(key);
    const isSupplier = convert("sn", row.FORNECEDOR, row) === true;
    const isCustomer = convert("sn", row.CLIENTE, row) === true;
    if (isSupplier)
      await upsertParty(
        ctx,
        "partners",
        key,
        partnerData(row, "supplier", extra),
      );
    if (isCustomer)
      await upsertParty(
        ctx,
        "customers",
        key,
        partnerData(row, "customer", extra),
      );
    if (!isSupplier && !isCustomer)
      ctx.out.push({
        entity: "partners",
        code: key,
        outcome: "skipped",
        id: null,
        label: text(row, "NOMEPARC") ?? key,
        reason: "nem fornecedor nem cliente",
      });
  }
}

/* ---- Condições de pagamento (TGFTPV) ---- */

export async function upsertPaymentConditions(
  ctx: ImportContext,
  rows: SankhyaRow[],
) {
  const store = getStore();
  const existing = await store.list("payment_conditions");
  for (const row of rows) {
    const value = Number(row.CODTIPVENDA);
    if (!Number.isInteger(value)) continue;
    const name =
      text(row, "DESCRTIPVENDA") ?? `Condição ${String(value).trim()}`;
    const active =
      row.ATIVO == null ? true : convert("sn", row.ATIVO, row) !== false;
    let found = existing.find((c) => c.code === value);
    let outcome: ImportOutcome = "existing";
    if (
      found &&
      ctx.update &&
      (found.name !== name || found.active !== active)
    ) {
      found = await store.update("payment_conditions", found.id, {
        name,
        active,
        updatedByUserId: ctx.user.id,
      });
      outcome = "updated";
    }
    if (!found) {
      found = await store.create("payment_conditions", {
        code: value,
        name,
        active,
        notes: null,
        source: "sankhya",
        updatedByUserId: ctx.user.id,
      });
      existing.push(found);
      outcome = "created";
    }
    ctx.out.push({
      entity: "paymentConditions",
      code: String(value),
      outcome,
      id: found.id,
      label: found.name,
    });
  }
}

/* ------------------------------------------------------------------------ */
/* Amostra: notas com tudo o que elas usam                                  */
/* ------------------------------------------------------------------------ */

export async function importSankhyaSet(
  user: User,
  set: ImportSet,
  erp: SankhyaErpSettings = DEFAULT_SANKHYA_ERP,
  /** Rótulo da auditoria; null = quem chamou audita (carga completa). */
  auditLabel: string | null = "sample",
): Promise<ImportLine[]> {
  const store = getStore();
  const ctx = await importContext(user, false, {
    parties: [
      ...[...set.partners, ...(set.carriers ?? [])].map((r) => code(r.CODPARC)),
      // Empresas (TSIEMP) são gravadas com o código "EMP-<CODEMP>".
      ...[...(set.companies ?? []), ...set.orders].map(
        (c) => `EMP-${code(c.CODEMP)}`,
      ),
    ],
    products: set.products.map((r) => code(r.CODPROD)),
    lines: set.groups.map((r) => code(r.CODGRUPOPROD)),
  });

  // Parceiros antes dos produtos: o fornecedor da última compra do produto
  // é ligado pelo código do parceiro.
  const extras = await partnerExtras([
    ...set.partners,
    ...(set.carriers ?? []),
  ]);
  const supplierByCode = new Map<string, Party>();
  for (const row of set.partners) {
    const key = code(row.CODPARC);
    supplierByCode.set(
      key,
      await upsertParty(
        ctx,
        "partners",
        key,
        partnerData(row, "supplier", extras.get(key)),
      ),
    );
  }
  const carrierByCode = new Map<string, Party>();
  for (const row of set.carriers ?? []) {
    const key = code(row.CODPARC);
    carrierByCode.set(
      key,
      await upsertParty(
        ctx,
        "carriers",
        key,
        partnerData(row, "carrier", extras.get(key)),
      ),
    );
  }

  const lineByGroup = await upsertGroups(ctx, set.groups);
  const productByCode = await upsertProducts(
    ctx,
    set.products,
    lineByGroup,
    erp.currency,
  );
  const conditionByCode = new Map(
    (await store.list("payment_conditions")).map((c) => [String(c.code), c]),
  );
  const titleNames = await titleTypeNames(set.financial);
  const customerByEmp = new Map<string, Party>();
  const companyName = (emp: string) =>
    text(
      set.companies.find((c) => code(c.CODEMP) === emp) ?? {},
      "NOMEFANTASIA",
    ) ?? `Empresa ${emp}`;
  for (const emp of [
    ...new Set(set.orders.map((o) => code(o.CODEMP)).filter(Boolean)),
  ]) {
    customerByEmp.set(
      emp,
      await upsertParty(ctx, "companies", `EMP-${emp}`, {
        type: "customer",
        name: companyName(emp),
        taxId: null,
        active: true,
      }),
    );
  }

  /* ---- Pedidos (com solicitação, itens e etapas pela TOP) ---- */
  const out = ctx.out;
  const orderByNunota = new Map<string, Order>();
  for (const row of set.orders) {
    const nunota = code(row.NUNOTA);
    const top = Number(row.CODTIPOPER);
    const [existing] = [
      ...(await store.list("orders", {
        filter: { sankhyaCode: nunota },
        limit: 1,
      })),
      ...(await store.list("orders", {
        filter: { erpNumber: nunota },
        limit: 1,
      })),
    ];
    if (existing) {
      orderByNunota.set(nunota, existing);
      out.push({
        entity: "orders",
        code: nunota,
        outcome: "existing",
        id: existing.id,
        label: `#${existing.number}`,
      });
      continue;
    }
    const target = TOP_STAGES[top];
    const supplier = supplierByCode.get(code(row.CODPARC));
    const customer = customerByEmp.get(code(row.CODEMP));
    const items = set.items.filter((i) => code(i.NUNOTA) === nunota);
    const skip = (reason: string) =>
      out.push({
        entity: "orders",
        code: nunota,
        outcome: "skipped",
        id: null,
        label: `NUNOTA ${nunota}`,
        reason,
      });
    if (!target) {
      skip(`TOP ${top} fora da tabela de etapas`);
      continue;
    }
    if (!supplier) {
      skip(`parceiro ${code(row.CODPARC)} não encontrado`);
      continue;
    }
    if (!customer) {
      skip(`empresa ${code(row.CODEMP)} não encontrada`);
      continue;
    }
    if (!items.length) {
      skip("nota sem itens");
      continue;
    }

    // Moeda: com câmbio no pedido, valores na moeda do pedido (USD); sem, R$.
    const rate = number(row, "VLRMOEDA");
    const fx = rate && rate > 0 ? rate : null;
    const currency = fx ? erp.currency : "BRL";
    const inCurrency = (v: number | null) =>
      v == null ? null : fx ? round(v / fx) : v;

    const first = items[0];
    const firstProduct = productByCode.get(code(first.CODPROD)) ?? null;
    const createdAt = isoOf(row.DTNEG) ?? new Date().toISOString();
    const erpNumber =
      erp.erpNumberField === "NUMNOTA" && code(row.NUMNOTA)
        ? code(row.NUMNOTA)
        : nunota;
    const expected = sankhyaDate(row.DTPREVENT);
    const note = [
      `Importado do Sankhya: NUNOTA ${nunota}, TOP ${top} ${target.label}`,
      fx && `câmbio ${String(fx).replace(".", ",")}`,
      expected && `previsão de entrega ${expected}`,
    ]
      .filter(Boolean)
      .join(", ");
    const request = await store.create("requests", {
      ...REQUEST_EXTRA_DEFAULTS,
      customerId: customer.id,
      createdByUserId: user.id,
      productId: firstProduct?.id ?? null,
      productName:
        text(first, "DESCRPROD") ??
        firstProduct?.name ??
        `Produto ${code(first.CODPROD)}`,
      description: note,
      specification: null,
      quantity: number(first, "QTDNEG") ?? 0,
      unit: text(first, "CODVOL") ?? "UN",
      deadline: null,
      status: "ORDERED",
      selectedQuoteId: null,
      orderId: null,
      sellPrice: null,
      sellCurrency: null,
      downPaymentAmount: null,
      notes: note,
      origin: "manual",
    });
    const order = await store.create("orders", {
      ...ORDER_EXTRA_DEFAULTS,
      number: await store.nextNumber("order_number"),
      requestId: request.id,
      customerId: customer.id,
      supplierId: supplier.id,
      lineId: firstProduct?.lineId ?? null,
      status: "ORDER_CREATED",
      currentStageId: null,
      fobTotal: inCurrency(number(row, "VLRNOTA")),
      fobCurrency: currency,
      sellPrice: null,
      sellCurrency: null,
      erpSyncStatus: "synced",
      erpNumber,
      sankhyaCode: nunota,
      sankhyaSyncedAt: syncedNow(),
      agencyId: null,
      brokerId: null,
      shippingLineId: null,
      carrierId: carrierByCode.get(code(row.CODPARCTRANSP))?.id ?? null,
      closedAt: null,
      notes: [note, text(row, "OBSERVACAO")].filter(Boolean).join("\n"),
      incoterm: convert("incoterm", row.CIF_FOB, row) as string | null,
      paymentConditionId:
        conditionByCode.get(code(row.CODTIPVENDA))?.id ?? null,
      fxRate: fx,
      sankhyaRefs: refsOf(row),
    });
    await store.update("requests", request.id, { orderId: order.id });
    for (const item of items) {
      const product = productByCode.get(code(item.CODPROD)) ?? null;
      await store.create("order_items", {
        orderId: order.id,
        productId: product?.id ?? null,
        name:
          text(item, "DESCRPROD") ??
          product?.name ??
          `Produto ${code(item.CODPROD)}`,
        quantity: number(item, "QTDNEG") ?? 0,
        unit: text(item, "CODVOL") ?? "UN",
        unitPrice: inCurrency(number(item, "VLRUNIT")),
        sankhyaCode: code(item.SEQUENCIA) || null,
        sankhyaRefs: refsOf(item),
      });
    }
    await createStagesForOrder(order);
    await advanceStages(order.id, target.stage, !!target.closed, createdAt);
    const saved = (await store.get("orders", order.id)) ?? order;
    orderByNunota.set(nunota, saved);
    out.push({
      entity: "orders",
      code: nunota,
      outcome: "created",
      id: order.id,
      label: `#${order.number} · ${target.label}`,
    });
  }

  /* ---- Financeiro (títulos das notas, em R$) ---- */
  for (const row of set.financial) {
    const key = code(row.NUFIN);
    const [existing] = await store.list("payments", {
      filter: { sankhyaCode: key },
      limit: 1,
    });
    if (existing) {
      out.push({
        entity: "financial",
        code: key,
        outcome: "existing",
        id: existing.id,
        label: `NUFIN ${key}`,
      });
      continue;
    }
    const order = orderByNunota.get(code(row.NUNOTA));
    const direction = convert("recDesp", row.RECDESP, row) as
      "customer_in" | "supplier_out" | null;
    const amount = number(row, "VLRDESDOB");
    if (!order || !direction || amount == null) {
      out.push({
        entity: "financial",
        code: key,
        outcome: "skipped",
        id: null,
        label: `NUFIN ${key}`,
        reason: !order
          ? "pedido da nota não importado"
          : !direction
            ? "RECDESP sem direção"
            : "sem valor",
      });
      continue;
    }
    const status = convert("paidAt", row.DHBAIXA, row) as
      "pending" | "confirmed" | "received";
    const payment = await store.create("payments", {
      ...PAYMENT_EXTRA_DEFAULTS,
      orderId: order.id,
      requestId: null,
      direction,
      amount,
      currency: "BRL",
      fxRate: order.fxRate ?? null,
      method: titleNames.get(code(row.CODTIPTIT)) ?? "Sankhya",
      status,
      proofDocumentId: null,
      registeredByUserId: user.id,
      confirmedByUserId: status === "pending" ? null : user.id,
      confirmedAt: status === "pending" ? null : isoOf(row.DHBAIXA),
      note: [
        `Sankhya NUFIN ${key}`,
        sankhyaDate(row.DTVENC) && `vencimento ${sankhyaDate(row.DTVENC)}`,
        text(row, "HISTORICO"),
      ]
        .filter(Boolean)
        .join(" · "),
      sankhyaCode: key,
      sankhyaRefs: refsOf(row),
    });
    out.push({
      entity: "financial",
      code: key,
      outcome: "created",
      id: payment.id,
      label: `NUFIN ${key} · R$ ${amount}`,
    });
  }

  if (auditLabel) await auditImport(user, auditLabel, out);
  return out;
}

/* ---- Locais de estoque (TGFLOC) ---- */

export async function upsertStockLocations(
  ctx: ImportContext,
  rows: SankhyaRow[],
) {
  const store = getStore();
  const existing = await store.list("stock_locations");
  for (const row of rows) {
    const key = code(row.CODLOCAL);
    const codeNum = Number(key);
    if (!Number.isInteger(codeNum)) continue;
    const name =
      text(row, "DESCRLOCAL") ?? text(row, "DESCRICAO") ?? `Local ${key}`;
    const active = convert("sn", row.ATIVO, row) !== false;
    const found = existing.find((l) => l.code === codeNum);
    if (found) {
      await store.update("stock_locations", found.id, {
        name,
        active,
        sankhyaCode: key,
      });
      ctx.out.push({
        entity: "stockLocations",
        code: key,
        outcome: "updated",
        id: found.id,
        label: `${key} ${name}`,
      });
    } else {
      const created = await store.create("stock_locations", {
        code: codeNum,
        name,
        active,
        notes: null,
        sankhyaCode: key,
      });
      existing.push(created);
      ctx.out.push({
        entity: "stockLocations",
        code: key,
        outcome: "created",
        id: created.id,
        label: `${key} ${name}`,
      });
    }
  }
}

/* ---- Saldos de estoque por local (TGFEST) ---- */

/**
 * Deixa o saldo do portal igual ao do Sankhya em cada produto e local: grava
 * a diferença como movimentação "Saldo do Sankhya". Rodar de novo só grava o
 * que mudou. Produto sem vínculo é pulado; local sem cadastro é criado.
 */
export async function applyStockBalances(
  ctx: ImportContext,
  rows: SankhyaRow[],
) {
  const store = getStore();
  const locations = await store.list("stock_locations");
  const productIds = new Map(
    ctx.products.filter((p) => p.sankhyaCode).map((p) => [p.sankhyaCode!, p]),
  );
  const ids = [
    ...new Set(
      rows
        .map((r) => productIds.get(code(r.CODPROD))?.id)
        .filter(Boolean) as string[],
    ),
  ];
  const movements = ids.length
    ? await store.list("stock_movements", { filter: { productId: ids } })
    : [];
  for (const row of rows) {
    const prod = code(row.CODPROD);
    const loc = code(row.CODLOCAL);
    const product = productIds.get(prod);
    const label = `CODPROD ${prod} · local ${loc}`;
    if (!product) {
      ctx.out.push({
        entity: "stockBalances",
        code: `${prod}/${loc}`,
        outcome: "skipped",
        id: null,
        label,
        reason: "produto não carregado",
      });
      continue;
    }
    let location = locations.find((l) => String(l.code) === loc);
    if (!location && Number.isInteger(Number(loc))) {
      location = await store.create("stock_locations", {
        code: Number(loc),
        name: `Local ${loc}`,
        active: true,
        notes: "Criado pela carga de saldos",
        sankhyaCode: loc,
      });
      locations.push(location);
    }
    const target = number(row, "ESTOQUE") ?? 0;
    const current = movements
      .filter(
        (m) =>
          m.productId === product.id &&
          (m.locationId ?? null) === (location?.id ?? null),
      )
      .reduce((sum, m) => sum + m.quantity, 0);
    const delta = round(target - current, 6);
    if (Math.abs(delta) < 1e-6) {
      ctx.out.push({
        entity: "stockBalances",
        code: `${prod}/${loc}`,
        outcome: "existing",
        id: product.id,
        label: `${product.name} · ${loc}: ${target}`,
      });
      continue;
    }
    const movement = await store.create("stock_movements", {
      productId: product.id,
      kind: "sankhya_balance",
      quantity: delta,
      unit: "UN",
      orderId: null,
      countId: null,
      countItemId: null,
      note: `Saldo do Sankhya: local ${loc} = ${target}`,
      createdByUserId: ctx.user.id,
      processEventId: null,
      locationId: location?.id ?? null,
    });
    movements.push(movement);
    ctx.out.push({
      entity: "stockBalances",
      code: `${prod}/${loc}`,
      outcome: current ? "updated" : "created",
      id: product.id,
      label: `${product.name} · ${loc}: ${target}`,
    });
  }
}

export async function auditImport(
  user: User,
  scope: string,
  out: ImportLine[],
) {
  const count = (o: ImportOutcome) => out.filter((l) => l.outcome === o).length;
  await audit(
    user,
    "sankhya.import",
    "sankhya",
    scope,
    `Carga do Sankhya (${scope}): ${count("created")} criados, ${count("updated")} atualizados, ${count("linked")} vinculados, ${count("existing")} já existiam, ${count("skipped")} ignorados`,
    null,
    {
      lines: out.slice(0, 500).map(({ entity, code: c, outcome, id }) => ({
        entity,
        code: c,
        outcome,
        id,
      })),
    },
  );
}

/**
 * Pedido histórico: as etapas antes da etapa da TOP ficam concluídas (com os
 * requisitos dados como feitos), a da TOP fica ativa; FINALIZADO encerra tudo.
 */
async function advanceStages(
  orderId: string,
  target: (typeof STAGE_KEYS)[number],
  closed: boolean,
  at: string,
) {
  const store = getStore();
  const stages = (await store.list("stages", { filter: { orderId } })).sort(
    (a, b) => a.sequence - b.sequence,
  );
  const targetIndex = STAGE_KEYS.indexOf(target);
  let current: string | null = null;
  for (const stage of stages) {
    const index = STAGE_KEYS.indexOf(stage.key);
    const done = closed || index < targetIndex;
    if (done) {
      await store.update("stages", stage.id, {
        status: "done",
        percent: 100,
        startedAt: stage.startedAt ?? at,
        completedAt: at,
        dueAt: null,
      });
      for (const req of await store.list("requirements", {
        filter: { stageId: stage.id },
      }))
        if (req.status === "pending")
          await store.update("requirements", req.id, {
            status: "done",
            note: "Etapa concluída no Sankhya (carga do histórico)",
            submittedAt: at,
          });
    } else if (index === targetIndex) {
      await store.update("stages", stage.id, {
        status: "active",
        startedAt: at,
      });
      current = stage.id;
    } else {
      await store.update("stages", stage.id, {
        status: "pending",
        startedAt: null,
        dueAt: null,
      });
    }
  }
  const last = stages[stages.length - 1];
  await store.update("orders", orderId, {
    status: target,
    currentStageId: closed ? (last?.id ?? null) : current,
    closedAt: closed ? at : null,
  });
}
