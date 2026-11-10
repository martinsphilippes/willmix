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
  type User,
} from "@/lib/db";
import { STAGE_KEYS } from "@/lib/db/schema";
import { DEFAULT_PREPARATION_REQUIREMENTS } from "@/lib/workflow/stages";
import { createStagesForOrder } from "@/lib/workflow/engine";
import { audit } from "@/lib/services/audit";
import type { SankhyaRow } from "./sankhya-client";
import { convert, sankhyaDate, TOP_STAGES } from "./sankhya-mapping";
import type { ImportSet } from "./sankhya-sample";

/*
 * Grava no portal a amostra lida do Sankhya (aba Carga do Sankhya; docs/SANKHYA.md).
 * Decisões da Wellmix: os pedidos entram como pedidos normais, a TOP (IMP)
 * define a etapa e os valores ficam em R$.
 *
 * Idempotente: cada cadastro guarda o código do Sankhya (`sankhyaCode`; nos
 * pedidos, `erpNumber` = NUNOTA). O que já existe é reaproveitado: pelo
 * código; sem código, pelo CNPJ/nome (parceiro), SKU = REFFORN (produto) ou
 * nome (linha), e ganha o código. Estoque não é gravado (o portal calcula).
 */

export type ImportOutcome = "created" | "linked" | "existing" | "skipped";

export interface ImportLine {
  entity:
    | "productGroups"
    | "products"
    | "partners"
    | "companies"
    | "orders"
    | "financial";
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

/** "AAAA-MM-DD" → ISO ao meio-dia de Brasília (evita virar o dia). */
const isoOf = (value: unknown) => {
  const day = sankhyaDate(value);
  return day ? `${day}T15:00:00.000Z` : null;
};

export async function importSankhyaSet(
  user: User,
  set: ImportSet,
): Promise<ImportLine[]> {
  const store = getStore();
  const out: ImportLine[] = [];

  /* ---- Linhas de produto (grupos) ---- */
  const lines = await store.list("product_lines");
  const lineByGroup = new Map<string, string>();
  for (const row of set.groups) {
    const key = code(row.CODGRUPOPROD);
    const name = text(row, "DESCRGRUPOPROD") ?? `Grupo ${key}`;
    let line = lines.find((l) => l.sankhyaCode === key);
    let outcome: ImportOutcome = "existing";
    if (!line) {
      line = lines.find((l) => norm(l.name) === norm(name));
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
        active: convert("sn", row.ATIVO, row) !== false,
        sankhyaCode: key,
      });
      lines.push(line);
      outcome = "created";
    }
    lineByGroup.set(key, line.id);
    out.push({
      entity: "productGroups",
      code: key,
      outcome,
      id: line.id,
      label: line.name,
    });
  }
  /** Produto sem grupo no Sankhya: linha "Importados do Sankhya". */
  const fallbackLine = async () => {
    const name = "Importados do Sankhya";
    const found = lines.find((l) => l.name === name);
    if (found) return found.id;
    const created = await store.create("product_lines", {
      ...LINE_EXTRA_DEFAULTS,
      name,
      manualDocumentId: null,
      requirements: DEFAULT_PREPARATION_REQUIREMENTS,
      requiredCertifications: null,
      active: true,
    });
    lines.push(created);
    return created.id;
  };

  /* ---- Produtos ---- */
  const productByCode = new Map<
    string,
    { id: string; name: string; lineId: string }
  >();
  for (const row of set.products) {
    const key = code(row.CODPROD);
    const sku = text(row, "REFFORN");
    let [product] = await store.list("products", {
      filter: { sankhyaCode: key },
      limit: 1,
    });
    let outcome: ImportOutcome = "existing";
    if (!product && sku) {
      [product] = await store.list("products", { filter: { sku }, limit: 1 });
      if (product) {
        product = await store.update("products", product.id, {
          sankhyaCode: key,
        });
        outcome = "linked";
      }
    }
    if (!product) {
      const lineId =
        lineByGroup.get(code(row.CODGRUPOPROD)) ?? (await fallbackLine());
      const cm = (column: string) =>
        convert("metersToCm", row[column], row) as number | null;
      product = await store.create("products", {
        ...PRODUCT_EXTRA_DEFAULTS,
        lineId,
        name: text(row, "DESCRPROD") ?? `Produto ${key}`,
        sku,
        specification: text(row, "CARACTERISTICAS"),
        active: convert("sn", row.ATIVO, row) !== false,
        ncm: convert("digits", row.NCM, row) as string | null,
        grossWeightKg: number(row, "PESOBRUTO"),
        netWeightKg: number(row, "PESOLIQ"),
        heightCm: cm("ALTURA"),
        widthCm: cm("LARGURA"),
        lengthCm: cm("ESPESSURA"),
        minStock: number(row, "ESTMIN"),
        source: "import",
        sankhyaCode: key,
      });
      outcome = "created";
    }
    productByCode.set(key, {
      id: product.id,
      name: product.name,
      lineId: product.lineId,
    });
    out.push({
      entity: "products",
      code: key,
      outcome,
      id: product.id,
      label: `${product.sku ?? ""} ${product.name}`.trim(),
    });
  }

  /* ---- Parceiros (fornecedores das notas) e empresas (clientes) ---- */
  const parties = await store.list("parties");
  const findOrCreateParty = async (
    entity: "partners" | "companies",
    key: string,
    data: {
      name: string;
      taxId: string | null;
      email?: string | null;
      phone?: string | null;
      contactName?: string | null;
      active: boolean;
      type: Party["type"];
    },
  ) => {
    let party = parties.find((p) => p.sankhyaCode === key);
    let outcome: ImportOutcome = "existing";
    if (!party) {
      party = parties.find(
        (p) =>
          p.type === data.type &&
          ((data.taxId && (p.taxId ?? "").replace(/\D/g, "") === data.taxId) ||
            norm(p.name) === norm(data.name)),
      );
      if (party) {
        party = await store.update("parties", party.id, { sankhyaCode: key });
        outcome = "linked";
      }
    }
    if (!party) {
      party = await store.create("parties", {
        ...PARTY_EXTRA_DEFAULTS,
        type: data.type,
        name: data.name,
        country: null,
        email: data.email ?? null,
        phone: data.phone ?? null,
        taxId: data.taxId,
        notes: "Importado do Sankhya",
        active: data.active,
        contactName: data.contactName ?? null,
        sankhyaCode: key,
      });
      parties.push(party);
      outcome = "created";
    }
    out.push({ entity, code: key, outcome, id: party.id, label: party.name });
    return party;
  };

  const supplierByCode = new Map<string, Party>();
  for (const row of set.partners) {
    const key = code(row.CODPARC);
    supplierByCode.set(
      key,
      await findOrCreateParty("partners", key, {
        type: "supplier",
        name: text(row, "NOMEPARC") ?? `Parceiro ${key}`,
        taxId: convert("digits", row.CGC_CPF, row) as string | null,
        email: text(row, "EMAIL"),
        phone: text(row, "TELEFONE"),
        contactName: text(row, "RAZAOSOCIAL"),
        active: convert("sn", row.ATIVO, row) !== false,
      }),
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
      await findOrCreateParty("companies", `EMP-${emp}`, {
        type: "customer",
        name: companyName(emp),
        taxId: null,
        active: true,
      }),
    );
  }

  /* ---- Pedidos (com solicitação, itens e etapas pela TOP) ---- */
  const orderByNunota = new Map<string, Order>();
  for (const row of set.orders) {
    const nunota = code(row.NUNOTA);
    const top = Number(row.CODTIPOPER);
    const [existing] = await store.list("orders", {
      filter: { erpNumber: nunota },
      limit: 1,
    });
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

    const first = items[0];
    const firstProduct = productByCode.get(code(first.CODPROD)) ?? null;
    const createdAt = isoOf(row.DTNEG) ?? new Date().toISOString();
    const note = `Importado do Sankhya: NUNOTA ${nunota}, TOP ${top} ${target.label}`;
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
      fobTotal: number(row, "VLRNOTA"),
      fobCurrency: "BRL",
      sellPrice: null,
      sellCurrency: null,
      erpSyncStatus: "synced",
      erpNumber: nunota,
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
        unitPrice: number(item, "VLRUNIT"),
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

  const count = (o: ImportOutcome) => out.filter((l) => l.outcome === o).length;
  await audit(
    user,
    "sankhya.import",
    "sankhya",
    "sample",
    `Carga do Sankhya: ${count("created")} criados, ${count("linked")} vinculados, ${count("existing")} já existiam, ${count("skipped")} ignorados`,
    null,
    {
      lines: out.map(({ entity, code: c, outcome, id }) => ({
        entity,
        code: c,
        outcome,
        id,
      })),
    },
  );
  return out;
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
