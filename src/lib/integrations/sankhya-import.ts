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
import { convert, sankhyaDate, TOP_STAGES } from "./sankhya-mapping";
import type { ImportSet } from "./sankhya-sample";
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
  | "created"
  | "linked"
  | "existing"
  | "updated"
  | "skipped";

export type ImportEntity =
  | "productGroups"
  | "products"
  | "partners"
  | "customers"
  | "companies"
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

export async function importContext(
  user: User,
  update: boolean,
): Promise<ImportContext> {
  const store = getStore();
  const [lines, parties, products] = await Promise.all([
    store.list("product_lines"),
    store.list("parties"),
    store.list("products"),
  ]);
  return { user, out: [], update, lines, parties, products };
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
    active: convert("sn", row.ATIVO, row) !== false,
  };
}

export async function upsertProducts(
  ctx: ImportContext,
  rows: SankhyaRow[],
  lineByGroup: Map<string, string>,
) {
  const store = getStore();
  const byCode = new Map<
    string,
    { id: string; name: string; lineId: string }
  >();
  for (const row of rows) {
    const key = code(row.CODPROD);
    const fields = productFields(row);
    const groupLine = lineByGroup.get(code(row.CODGRUPOPROD));
    let product = ctx.products.find((p) => p.sankhyaCode === key);
    let outcome: ImportOutcome = "existing";
    if (product && ctx.update) {
      product = await store.update("products", product.id, {
        ...fields,
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
          ...(ctx.update ? fields : {}),
        });
        outcome = "linked";
      }
    }
    if (!product) {
      product = await store.create("products", {
        ...PRODUCT_EXTRA_DEFAULTS,
        ...fields,
        lineId: groupLine ?? (await fallbackLine(ctx)),
        specification: text(row, "CARACTERISTICAS"),
        source: "import",
        sankhyaCode: key,
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
  active: boolean;
}

export async function upsertParty(
  ctx: ImportContext,
  entity: "partners" | "customers" | "companies",
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
    contactName: data.contactName ?? null,
    active: data.active,
  };
  if (party && ctx.update) {
    party = await store.update("parties", party.id, fields);
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
      country: null,
      notes: "Importado do Sankhya",
      sankhyaCode: key,
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
  type: "supplier" | "customer",
): PartyData {
  return {
    type,
    name: text(row, "NOMEPARC") ?? `Parceiro ${code(row.CODPARC)}`,
    taxId: convert("digits", row.CGC_CPF, row) as string | null,
    email: text(row, "EMAIL"),
    phone: text(row, "TELEFONE"),
    contactName: text(row, "RAZAOSOCIAL"),
    active: convert("sn", row.ATIVO, row) !== false,
  };
}

/** Carga completa de parceiros: FORNECEDOR = S → fornecedor; CLIENTE = S → cliente. */
export async function upsertPartners(ctx: ImportContext, rows: SankhyaRow[]) {
  for (const row of rows) {
    const key = code(row.CODPARC);
    const isSupplier = convert("sn", row.FORNECEDOR, row) === true;
    const isCustomer = convert("sn", row.CLIENTE, row) === true;
    if (isSupplier)
      await upsertParty(ctx, "partners", key, partnerData(row, "supplier"));
    if (isCustomer)
      await upsertParty(ctx, "customers", key, partnerData(row, "customer"));
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
    const active = row.ATIVO == null ? true : convert("sn", row.ATIVO, row) !== false;
    let found = existing.find((c) => c.code === value);
    let outcome: ImportOutcome = "existing";
    if (found && ctx.update && (found.name !== name || found.active !== active)) {
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
): Promise<ImportLine[]> {
  const store = getStore();
  const ctx = await importContext(user, false);

  const lineByGroup = await upsertGroups(ctx, set.groups);
  const productByCode = await upsertProducts(ctx, set.products, lineByGroup);

  const supplierByCode = new Map<string, Party>();
  for (const row of set.partners) {
    const key = code(row.CODPARC);
    supplierByCode.set(
      key,
      await upsertParty(ctx, "partners", key, partnerData(row, "supplier")),
    );
  }
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
    const note = [
      `Importado do Sankhya: NUNOTA ${nunota}, TOP ${top} ${target.label}`,
      fx && `câmbio ${String(fx).replace(".", ",")}`,
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
      agencyId: null,
      brokerId: null,
      shippingLineId: null,
      carrierId: null,
      closedAt: null,
      notes: [note, text(row, "OBSERVACAO")].filter(Boolean).join("\n"),
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
      | "customer_in"
      | "supplier_out"
      | null;
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
      | "pending"
      | "confirmed"
      | "received";
    const payment = await store.create("payments", {
      ...PAYMENT_EXTRA_DEFAULTS,
      orderId: order.id,
      requestId: null,
      direction,
      amount,
      currency: "BRL",
      fxRate: null,
      method: "Sankhya",
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
    });
    out.push({
      entity: "financial",
      code: key,
      outcome: "created",
      id: payment.id,
      label: `NUFIN ${key} · R$ ${amount}`,
    });
  }

  await auditImport(user, "sample", out);
  return out;
}

export async function auditImport(
  user: User,
  scope: string,
  out: ImportLine[],
) {
  const count = (o: ImportOutcome) =>
    out.filter((l) => l.outcome === o).length;
  await audit(
    user,
    "sankhya.import",
    "sankhya",
    scope,
    `Carga do Sankhya (${scope}): ${count("created")} criados, ${count("updated")} atualizados, ${count("linked")} vinculados, ${count("existing")} já existiam, ${count("skipped")} ignorados`,
    null,
    {
      lines: out
        .slice(0, 500)
        .map(({ entity, code: c, outcome, id }) => ({
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
