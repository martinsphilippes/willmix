import "server-only";
import { ForbiddenError, isAdmin } from "@/lib/auth/permissions";
import {
  getStore,
  type CommissionAgreement,
  type CommissionEntry,
  type CommissionPayment,
  type Order,
  type Party,
  type User,
} from "@/lib/db";
import {
  COMMISSION_BASES,
  COMMISSION_EVENTS,
  COMPONENT_KINDS,
  computeCommissions,
  paidStatus,
  publicationConflicts,
  type AgreementDef,
  type CommissionComponent,
  type CommissionEvent,
  type CommissionResult,
  type Operation,
} from "@/lib/commission";
import { audit } from "./audit";

/*
 * Acordos comerciais e comissões (docs/COMMISSIONS.md): acordos com versões,
 * simulação, apuração por pedido (uma por pedido, acordo e beneficiário),
 * aprovação, liquidação (parcial ou total) e ajustes. Só o administrador.
 * A simulação e a apuração usam o mesmo cálculo (src/lib/commission.ts).
 */

function assertAdmin(user: User) {
  if (!isAdmin(user)) throw new ForbiddenError();
}

const cents = (n: number) => Math.round((n + Number.EPSILON) * 100);
const money = (c: number) => Math.round(c) / 100;
const fold = (text: string) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const isEvent = (v: unknown): v is CommissionEvent =>
  (COMMISSION_EVENTS as readonly string[]).includes(String(v));

/* ------------------------------------------------------------------------ */
/* Acordos                                                                   */
/* ------------------------------------------------------------------------ */

const list = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

/** Linha do banco → o acordo como o cálculo o lê. */
export function agreementDef(row: CommissionAgreement): AgreementDef {
  const scope = (row.scope ?? {}) as Record<string, unknown>;
  return {
    id: row.id,
    rootId: row.rootId,
    version: row.version,
    name: row.name,
    category: row.category,
    priority: row.priority,
    beneficiaryPartyId: row.beneficiaryPartyId,
    beneficiaryType: row.beneficiaryType,
    scope: {
      customerIds: list(scope.customerIds),
      supplierIds: list(scope.supplierIds),
      lineIds: list(scope.lineIds),
    },
    validFrom: row.validFrom,
    validTo: row.validTo,
    currency: row.currency,
    generateOn: isEvent(row.generateOn) ? row.generateOn : "order_created",
    releaseOn:
      row.releaseOn === "received" || isEvent(row.releaseOn)
        ? (row.releaseOn as AgreementDef["releaseOn"])
        : "delivered",
    releaseMode: row.releaseMode === "full" ? "full" : "proportional",
    dueDays: row.dueDays,
    components: Array.isArray(row.components)
      ? (row.components as CommissionComponent[])
      : [],
  };
}

export async function listAgreements(user: User) {
  assertAdmin(user);
  const rows = await getStore().list("commission_agreements");
  return rows.sort((a, b) => b.number - a.number || b.version - a.version);
}

export async function getAgreement(user: User, id: string) {
  assertAdmin(user);
  return getStore().get("commission_agreements", id);
}

/** As versões em vigor (ativas): o que a apuração usa. */
async function activeDefs(): Promise<AgreementDef[]> {
  const rows = await getStore().list("commission_agreements", {
    filter: { status: "active" },
  });
  return rows.map(agreementDef);
}

/**
 * Acha um cadastro pelo que o administrador digitou: o id, o nome exato ou
 * um único nome que contenha o texto. Vários: ambíguo.
 */
export async function findParty(text: string): Promise<Party> {
  const wanted = text.trim();
  if (!wanted) throw new Error("commission_party_required");
  const store = getStore();
  const byId = await store.get("parties", wanted).catch(() => null);
  if (byId) return byId;
  const parties = await store.list("parties");
  const key = fold(wanted);
  const exact = parties.filter((p) => fold(p.name) === key);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) throw new Error("commission_party_ambiguous");
  const partial = parties.filter((p) => fold(p.name).includes(key));
  if (partial.length === 1) return partial[0];
  throw new Error(
    partial.length ? "commission_party_ambiguous" : "commission_party_unknown",
  );
}

export interface AgreementInput {
  name: string;
  category: string;
  priority: number;
  /** Texto do beneficiário individual (nome ou id); vazio = acordo de um tipo. */
  beneficiary: string;
  beneficiaryType: string;
  customers: string[];
  suppliers: string[];
  lineIds: string[];
  validFrom: string | null;
  validTo: string | null;
  currency: string;
  generateOn: string;
  releaseOn: string;
  releaseMode: string;
  dueDays: number;
  components: CommissionComponent[];
  notes: string | null;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function cleanComponents(components: CommissionComponent[]) {
  const out: CommissionComponent[] = [];
  for (const c of components) {
    const name = (c.name ?? "").trim().slice(0, 120);
    if (!name) continue;
    if (!COMPONENT_KINDS.includes(c.kind))
      throw new Error("commission_component_invalid");
    const num = (v: number | null) =>
      v === null || !Number.isFinite(v) ? null : v;
    const rate = num(c.rate);
    const amount = num(c.amount);
    const tiers = (c.tiers ?? []).filter((t) => Number.isFinite(t.rate));
    if (c.kind === "percent") {
      if (!COMMISSION_BASES.includes(c.base))
        throw new Error("commission_component_invalid");
      if (!tiers.length && (rate === null || rate < 0 || rate > 100))
        throw new Error("commission_rate_invalid");
      if (tiers.length && c.base === "items")
        throw new Error("commission_tiers_base");
    } else if (amount === null || amount < 0)
      throw new Error("commission_amount_invalid");
    out.push({
      id: c.id || crypto.randomUUID(),
      name,
      kind: c.kind,
      base: c.kind === "percent" ? c.base : "items",
      rate: c.kind === "percent" ? rate : null,
      amount: c.kind === "percent" ? null : amount,
      lineIds: list(c.lineIds),
      tiers: c.kind === "percent" && tiers.length ? tiers : null,
      tierMode: c.tierMode === "whole" ? "whole" : "progressive",
      accumulate: !!c.accumulate,
      successEvent: isEvent(c.successEvent) ? c.successEvent : null,
      floor: num(c.floor),
      cap: num(c.cap),
    });
  }
  if (!out.length) throw new Error("commission_components_required");
  return out;
}

async function agreementData(input: AgreementInput) {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 160)
    throw new Error("commission_name_invalid");
  const beneficiary = input.beneficiary.trim()
    ? await findParty(input.beneficiary)
    : null;
  const type = input.beneficiaryType.trim() || null;
  if (!beneficiary && !type) throw new Error("commission_beneficiary_required");
  for (const d of [input.validFrom, input.validTo])
    if (d && !DATE.test(d)) throw new Error("commission_date_invalid");
  if (input.validFrom && input.validTo && input.validFrom > input.validTo)
    throw new Error("commission_date_invalid");
  if (!isEvent(input.generateOn)) throw new Error("commission_event_invalid");
  if (input.releaseOn !== "received" && !isEvent(input.releaseOn))
    throw new Error("commission_event_invalid");
  const resolve = async (names: string[]) =>
    Promise.all(
      names
        .map((n) => n.trim())
        .filter(Boolean)
        .map(async (n) => (await findParty(n)).id),
    );
  return {
    name,
    category: (input.category.trim() || "comissao").slice(0, 60),
    priority: Number.isFinite(input.priority) ? Math.round(input.priority) : 0,
    // O individual vale para a empresa; o tipo fica só no acordo padrão.
    beneficiaryPartyId: beneficiary?.id ?? null,
    beneficiaryType: beneficiary ? null : type,
    scope: {
      customerIds: await resolve(input.customers),
      supplierIds: await resolve(input.suppliers),
      lineIds: list(input.lineIds),
    },
    validFrom: input.validFrom || null,
    validTo: input.validTo || null,
    currency: (input.currency || "BRL").toUpperCase().slice(0, 3),
    generateOn: input.generateOn,
    releaseOn: input.releaseOn,
    releaseMode: input.releaseMode === "full" ? "full" : "proportional",
    dueDays: Math.max(0, Math.min(3650, Math.round(input.dueDays || 0))),
    components: cleanComponents(input.components),
    notes: input.notes?.trim() ? input.notes.trim().slice(0, 2000) : null,
  };
}

/** Cria o rascunho, ou altera um rascunho (o ativo só muda por uma nova versão). */
export async function saveAgreementDraft(
  user: User,
  id: string | null,
  input: AgreementInput,
): Promise<CommissionAgreement> {
  assertAdmin(user);
  const store = getStore();
  const data = await agreementData(input);
  if (id) {
    const before = await store.get("commission_agreements", id);
    if (!before) throw new Error("not_found");
    if (before.status !== "draft") throw new Error("commission_not_draft");
    const row = await store.update("commission_agreements", id, data);
    await audit(
      user,
      "commission.agreement_update",
      "commission_agreement",
      id,
      `Acordo nº ${row.number} v${row.version} alterado: ${row.name}`,
      before,
      row,
    );
    return row;
  }
  const number = await store.nextNumber("commission_agreement_number");
  const created = await store.create("commission_agreements", {
    ...data,
    number,
    rootId: "pending",
    version: 1,
    status: "draft",
    createdByUserId: user.id,
    activatedAt: null,
    activatedByUserId: null,
  });
  const row = await store.update("commission_agreements", created.id, {
    rootId: created.id,
  });
  await audit(
    user,
    "commission.agreement_create",
    "commission_agreement",
    row.id,
    `Acordo nº ${number} criado (rascunho): ${row.name}`,
    null,
    row,
  );
  return row;
}

const copyOf = (row: CommissionAgreement) => ({
  name: row.name,
  category: row.category,
  priority: row.priority,
  beneficiaryPartyId: row.beneficiaryPartyId,
  beneficiaryType: row.beneficiaryType,
  scope: row.scope,
  validFrom: row.validFrom,
  validTo: row.validTo,
  currency: row.currency,
  generateOn: row.generateOn,
  releaseOn: row.releaseOn,
  releaseMode: row.releaseMode,
  dueDays: row.dueDays,
  components: row.components,
  notes: row.notes,
});

/** Duplica como outro acordo (rascunho), para usar de base. */
export async function duplicateAgreement(user: User, id: string) {
  assertAdmin(user);
  const store = getStore();
  const source = await store.get("commission_agreements", id);
  if (!source) throw new Error("not_found");
  const number = await store.nextNumber("commission_agreement_number");
  const created = await store.create("commission_agreements", {
    ...copyOf(source),
    name: `${source.name} (cópia)`.slice(0, 160),
    number,
    rootId: "pending",
    version: 1,
    status: "draft",
    createdByUserId: user.id,
    activatedAt: null,
    activatedByUserId: null,
  });
  const row = await store.update("commission_agreements", created.id, {
    rootId: created.id,
  });
  await audit(
    user,
    "commission.agreement_duplicate",
    "commission_agreement",
    row.id,
    `Acordo nº ${number} duplicado do nº ${source.number}`,
  );
  return row;
}

/** Nova versão (rascunho) de um acordo: muda valor, base, fórmula, abrangência ou vencimento sem tocar no que já foi apurado. */
export async function newAgreementVersion(user: User, id: string) {
  assertAdmin(user);
  const store = getStore();
  const source = await store.get("commission_agreements", id);
  if (!source) throw new Error("not_found");
  const versions = await store.list("commission_agreements", {
    filter: { rootId: source.rootId },
  });
  const draft = versions.find((v) => v.status === "draft");
  if (draft) return draft;
  const row = await store.create("commission_agreements", {
    ...copyOf(source),
    number: source.number,
    rootId: source.rootId,
    version: Math.max(...versions.map((v) => v.version)) + 1,
    status: "draft",
    createdByUserId: user.id,
    activatedAt: null,
    activatedByUserId: null,
  });
  await audit(
    user,
    "commission.agreement_version",
    "commission_agreement",
    row.id,
    `Acordo nº ${row.number}: versão ${row.version} em rascunho`,
  );
  return row;
}

/** Outros acordos ativos que disputam com este (mesma categoria, prioridade e alcance). */
export async function agreementConflicts(row: CommissionAgreement) {
  return publicationConflicts(agreementDef(row), await activeDefs());
}

const dayBefore = (date: string) => {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

/**
 * Ativa o rascunho. Conflito com outro acordo ativo bloqueia. Sendo uma nova
 * versão, a anterior encerra na véspera do início desta (ou na hora, sem data).
 */
export async function activateAgreement(user: User, id: string) {
  assertAdmin(user);
  const store = getStore();
  const row = await store.get("commission_agreements", id);
  if (!row) throw new Error("not_found");
  if (row.status !== "draft" && row.status !== "suspended")
    throw new Error("commission_not_draft");
  if ((await agreementConflicts(row)).length)
    throw new Error("commission_conflict");
  const previous = (
    await store.list("commission_agreements", {
      filter: { rootId: row.rootId, status: "active" },
    })
  ).filter((v) => v.id !== row.id);
  const today = new Date().toISOString().slice(0, 10);
  for (const old of previous) {
    const start = row.validFrom && row.validFrom > today ? row.validFrom : null;
    await store.update(
      "commission_agreements",
      old.id,
      start
        ? { validTo: dayBefore(start) }
        : { status: "ended", validTo: today },
    );
  }
  const active = await store.update("commission_agreements", id, {
    status: "active",
    activatedAt: new Date().toISOString(),
    activatedByUserId: user.id,
  });
  await audit(
    user,
    "commission.agreement_activate",
    "commission_agreement",
    id,
    `Acordo nº ${row.number} v${row.version} ativado: ${row.name}`,
    { status: row.status },
    { status: "active", validFrom: row.validFrom, validTo: row.validTo },
  );
  return active;
}

export async function setAgreementStatus(
  user: User,
  id: string,
  status: "suspended" | "ended",
  reason: string,
) {
  assertAdmin(user);
  const store = getStore();
  const row = await store.get("commission_agreements", id);
  if (!row) throw new Error("not_found");
  if (row.status !== "active" && row.status !== "suspended")
    throw new Error("commission_not_active");
  if (reason.trim().length < 3) throw new Error("commission_reason_required");
  const next = await store.update("commission_agreements", id, {
    status,
    ...(status === "ended"
      ? { validTo: row.validTo ?? new Date().toISOString().slice(0, 10) }
      : {}),
  });
  await audit(
    user,
    `commission.agreement_${status}`,
    "commission_agreement",
    id,
    `Acordo nº ${row.number} v${row.version}: ${status}. Motivo: ${reason.trim()}`.slice(
      0,
      250,
    ),
    { status: row.status },
    { status },
  );
  return next;
}

/* ------------------------------------------------------------------------ */
/* O pedido como a comissão o vê                                             */
/* ------------------------------------------------------------------------ */

const STAGE_EVENT: Record<string, CommissionEvent> = {
  INSPECTION: "inspection_done",
  SHIPPING: "shipped",
  DELIVERED: "delivered",
};

export async function buildOperation(order: Order): Promise<Operation> {
  const store = getStore();
  const [items, stages, payments, manual] = await Promise.all([
    store.list("order_items", { filter: { orderId: order.id } }),
    store.list("stages", { filter: { orderId: order.id } }),
    store.list("payments", { filter: { orderId: order.id } }),
    store
      .list("commission_events", { filter: { orderId: order.id } })
      .catch(() => []),
  ]);
  const productIds = [
    ...new Set(items.map((i) => i.productId).filter((p): p is string => !!p)),
  ];
  const products = productIds.length
    ? await store.list("products", { filter: { id: productIds } })
    : [];
  const lineOf = new Map(products.map((p) => [p.id, p.lineId]));
  const currency = order.sellCurrency ?? order.fobCurrency ?? "USD";
  // Recebido do cliente: só o confirmado, na moeda do pedido. Pagamento em
  // outra moeda deixa a base "recebido" pendente (não converte sozinho).
  const receipts = payments.filter(
    (p) => p.direction === "customer_in" && p.status !== "pending",
  );
  const received = receipts.every((p) => p.currency === currency)
    ? money(receipts.reduce((s, p) => s + cents(p.amount), 0))
    : null;
  const events = new Set<CommissionEvent>(["order_created"]);
  for (const s of stages)
    if (s.completedAt && STAGE_EVENT[s.key]) events.add(STAGE_EVENT[s.key]);
  if (order.closedAt) events.add("closed");
  if (order.invoicedAt) events.add("invoiced");
  if (received !== null && received > 0) events.add("received_first");
  if (received !== null && order.sellPrice && received >= order.sellPrice)
    events.add("received_full");
  if (manual.some((m) => m.event === "manual")) events.add("manual");
  return {
    orderId: order.id,
    refDate: order.createdAt,
    currency,
    customerId: order.customerId,
    supplierId: order.supplierId,
    items: items.map((i) => ({
      id: i.id,
      name: i.name,
      lineId: (i.productId ? lineOf.get(i.productId) : null) ?? order.lineId,
      quantity: i.quantity,
      amount:
        i.unitPrice === null ? null : money(cents(i.unitPrice) * i.quantity),
    })),
    sellTotal: order.sellPrice,
    fobTotal: order.fobCurrency === currency ? order.fobTotal : null,
    received,
    events: [...events],
    partiesByType: {
      customer: order.customerId,
      supplier: order.supplierId,
      agency: order.agencyId ?? null,
      broker: order.brokerId ?? null,
      shipping_line: order.shippingLineId ?? null,
      carrier: order.carrierId ?? null,
      comex: order.comexId ?? null,
      logistics: order.logisticsId ?? null,
      ocp: order.ocpId ?? null,
    },
    cancelled: order.status === "CANCELLED",
  };
}

export async function orderByNumber(number: number): Promise<Order | null> {
  const [order] = await getStore().list("orders", {
    filter: { number },
    limit: 1,
  });
  return order ?? null;
}

/**
 * Simulação: o mesmo cálculo da apuração, sem gravar nada. Com `draftId`, o
 * rascunho entra junto com os acordos ativos (no lugar das outras versões dele).
 */
export async function simulate(
  user: User,
  op: Operation,
  draftId: string | null,
): Promise<CommissionResult> {
  assertAdmin(user);
  let defs = await activeDefs();
  if (draftId) {
    const draft = await getStore().get("commission_agreements", draftId);
    if (draft) {
      const def = agreementDef(draft);
      defs = [...defs.filter((d) => d.rootId !== def.rootId), def];
    }
  }
  return computeCommissions(defs, op);
}

/* ------------------------------------------------------------------------ */
/* Apuração                                                                  */
/* ------------------------------------------------------------------------ */

const entryKey = (orderId: string, rootId: string, who: string) =>
  `${orderId}:${rootId}:${who}`;
const OPEN = ["estimated", "eligible"];

const isDuplicate = (error: unknown) =>
  error instanceof Error &&
  /unique|duplicate|already exists|conflict/i.test(error.message);

/**
 * Apura (ou reapura) as comissões de um pedido. Uma apuração por pedido,
 * acordo e beneficiário: repetir o evento, ou dois processos ao mesmo tempo,
 * dão o mesmo resultado (a chave é única no banco). O lançamento em aberto é
 * recalculado; o já aprovado ou pago não muda: a diferença vira um ajuste
 * ligado a ele (estorno, quando o pedido é cancelado).
 */
export async function accrueOrder(
  actor: User | null,
  orderId: string,
): Promise<{ created: number; updated: number; adjusted: number }> {
  const store = getStore();
  const summary = { created: 0, updated: 0, adjusted: 0 };
  const order = await store.get("orders", orderId);
  if (!order) throw new Error("not_found");
  const [defs, existing] = await Promise.all([
    activeDefs(),
    store.list("commission_entries", { filter: { orderId } }),
  ]);
  if (!defs.length && !existing.length) return summary;
  const op = await buildOperation(order);
  const result = computeCommissions(defs, op);
  const now = new Date().toISOString();
  const computed = new Map(
    result.entries.map((e) => [
      entryKey(orderId, e.rootId, e.beneficiaryPartyId),
      e,
    ]),
  );
  const accruals = existing.filter((e) => e.kind === "accrual");
  const adjustmentsOf = (id: string) =>
    existing.filter((e) => e.kind === "adjustment" && e.originalEntryId === id);

  const dueFrom = (days: number) => {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString();
  };
  /** Ajuste ligado ao lançamento original (chave única: o mesmo ajuste não entra duas vezes). */
  const adjust = async (
    original: CommissionEntry,
    deltaCents: number,
    note: string,
    memory: unknown,
  ) => {
    const n = adjustmentsOf(original.id).length + 1;
    try {
      await store.create("commission_entries", {
        key: `${original.key}:adj:${n}`,
        kind: "adjustment",
        originalEntryId: original.id,
        orderId,
        beneficiaryPartyId: original.beneficiaryPartyId,
        agreementId: original.agreementId,
        rootId: original.rootId,
        version: original.version,
        category: original.category,
        currency: original.currency,
        amount: money(deltaCents),
        released: money(deltaCents),
        paidAmount: 0,
        status: "eligible",
        referenceDate: original.referenceDate,
        eligibleAt: now,
        dueAt: null,
        approvedAt: null,
        approvedByUserId: null,
        memory,
        note,
      });
      summary.adjusted++;
    } catch (error) {
      if (!isDuplicate(error)) throw error;
    }
  };

  for (const [key, e] of computed) {
    const memory = {
      lines: e.lines,
      pending: e.pending,
      replaced: result.replaced,
      conflicts: result.conflicts,
      releaseFraction: e.releaseFraction,
      agreementName: e.agreementName,
    };
    const eligible = cents(e.released) > 0;
    const row = accruals.find((x) => x.key === key);
    if (!row) {
      try {
        await store.create("commission_entries", {
          key,
          kind: "accrual",
          originalEntryId: null,
          orderId,
          beneficiaryPartyId: e.beneficiaryPartyId,
          agreementId: e.agreementId,
          rootId: e.rootId,
          version: e.version,
          category: e.category,
          currency: e.currency,
          amount: e.amount,
          released: e.released,
          paidAmount: 0,
          status: eligible ? "eligible" : "estimated",
          referenceDate: op.refDate,
          eligibleAt: eligible ? now : null,
          dueAt: eligible ? dueFrom(e.dueDays) : null,
          approvedAt: null,
          approvedByUserId: null,
          memory,
          note: null,
        });
        summary.created++;
      } catch (error) {
        // Outro processo apurou o mesmo evento no mesmo instante: vale o dele.
        if (!isDuplicate(error)) throw error;
      }
      continue;
    }
    if (OPEN.includes(row.status) || row.status === "reversed") {
      const changed =
        cents(row.amount) !== cents(e.amount) ||
        cents(row.released) !== cents(e.released) ||
        row.version !== e.version ||
        row.status === "reversed";
      if (!changed) continue;
      await store.update("commission_entries", row.id, {
        amount: e.amount,
        released: e.released,
        agreementId: e.agreementId,
        version: e.version,
        status: eligible ? "eligible" : "estimated",
        eligibleAt: eligible ? (row.eligibleAt ?? now) : null,
        dueAt: eligible ? (row.dueAt ?? dueFrom(e.dueDays)) : null,
        memory,
      });
      summary.updated++;
      continue;
    }
    // Aprovado ou pago: o histórico fica; a diferença é um ajuste.
    const settled =
      cents(row.amount) +
      adjustmentsOf(row.id)
        .filter((a) => a.status !== "reversed")
        .reduce((s, a) => s + cents(a.amount), 0);
    const delta = cents(e.amount) - settled;
    if (delta !== 0)
      await adjust(
        row,
        delta,
        delta > 0
          ? "Ajuste: valor recalculado"
          : "Ajuste: valor recalculado (a menor)",
        memory,
      );
    else if (cents(row.released) !== cents(e.released))
      await store.update("commission_entries", row.id, {
        released: e.released,
      });
  }

  // Lançamentos sem contrapartida na conta de agora (pedido cancelado,
  // acordo encerrado): em aberto, estorna; aprovado ou pago, ajuste negativo.
  for (const row of accruals) {
    if (computed.has(row.key)) continue;
    if (OPEN.includes(row.status)) {
      await store.update("commission_entries", row.id, {
        status: "reversed",
        released: 0,
        note: op.cancelled ? "Pedido cancelado" : "Sem acordo aplicável",
      });
      summary.updated++;
    } else if (row.status !== "reversed") {
      const settled =
        cents(row.amount) +
        adjustmentsOf(row.id)
          .filter((a) => a.status !== "reversed")
          .reduce((s, a) => s + cents(a.amount), 0);
      if (settled !== 0)
        await adjust(
          row,
          -settled,
          op.cancelled
            ? "Estorno: pedido cancelado"
            : "Estorno: sem acordo aplicável",
          { lines: [], pending: [], reversalOf: row.id },
        );
    }
  }
  if (summary.created || summary.updated || summary.adjusted)
    await audit(
      actor,
      "commission.accrue",
      "order",
      orderId,
      `Comissões do pedido nº ${order.number}: ${summary.created} novas, ${summary.updated} recalculadas, ${summary.adjusted} ajustes`,
    );
  return summary;
}

/** Chamado pelos eventos do pedido (nunca derruba o fluxo). */
export async function accrueOrderQuietly(orderId: string) {
  try {
    await accrueOrder(null, orderId);
  } catch (error) {
    const { isSchemaMissing } = await import("@/lib/db/errors");
    if (!isSchemaMissing(error)) console.error("[commission]", orderId, error);
  }
}

/** Confirma à mão um fato sem evento integrado (com justificativa) e reapura. */
export async function confirmManualEvent(
  user: User,
  orderId: string,
  note: string,
) {
  assertAdmin(user);
  if (note.trim().length < 5) throw new Error("commission_reason_required");
  const store = getStore();
  const order = await store.get("orders", orderId);
  if (!order) throw new Error("not_found");
  await store.create("commission_events", {
    orderId,
    event: "manual",
    note: note.trim().slice(0, 2000),
    documentId: null,
    createdByUserId: user.id,
  });
  await audit(
    user,
    "commission.manual_event",
    "order",
    orderId,
    `Confirmação manual para comissão no pedido nº ${order.number}: ${note.trim()}`.slice(
      0,
      250,
    ),
  );
  return accrueOrder(user, orderId);
}

/* ------------------------------------------------------------------------ */
/* Lançamentos, aprovação e liquidação                                       */
/* ------------------------------------------------------------------------ */

export interface EntryView {
  entry: CommissionEntry;
  beneficiary: Party | null;
  orderNumber: number | null;
  /** Liberado e ainda não pago. */
  payable: number;
}

export async function listEntries(user: User): Promise<EntryView[]> {
  assertAdmin(user);
  const store = getStore();
  const entries = await store.list("commission_entries");
  const partyIds = [...new Set(entries.map((e) => e.beneficiaryPartyId))];
  const orderIds = [...new Set(entries.map((e) => e.orderId))];
  const [parties, orders] = await Promise.all([
    partyIds.length ? store.list("parties", { filter: { id: partyIds } }) : [],
    orderIds.length ? store.list("orders", { filter: { id: orderIds } }) : [],
  ]);
  const partyOf = new Map(parties.map((p) => [p.id, p]));
  const orderOf = new Map(orders.map((o) => [o.id, o]));
  return entries
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((entry) => ({
      entry,
      beneficiary: partyOf.get(entry.beneficiaryPartyId) ?? null,
      orderNumber: orderOf.get(entry.orderId)?.number ?? null,
      payable: ["approved", "partially_paid"].includes(entry.status)
        ? money(Math.max(0, cents(entry.released) - cents(entry.paidAmount)))
        : 0,
    }));
}

/** Aprova lançamentos elegíveis (o que já está liberado pode ser pago). */
export async function approveEntries(user: User, ids: string[]) {
  assertAdmin(user);
  const store = getStore();
  let approved = 0;
  for (const id of [...new Set(ids)]) {
    const entry = await store.get("commission_entries", id);
    if (!entry) throw new Error("not_found");
    if (entry.status !== "eligible")
      throw new Error("commission_entry_not_eligible");
    await store.update("commission_entries", id, {
      status: "approved",
      approvedAt: new Date().toISOString(),
      approvedByUserId: user.id,
    });
    await audit(
      user,
      "commission.approve",
      "commission_entry",
      id,
      `Comissão aprovada: ${entry.amount} ${entry.currency}`,
      { status: entry.status },
      { status: "approved" },
    );
    approved++;
  }
  if (!approved) throw new Error("commission_pick");
  return approved;
}

export interface SettlementInput {
  allocations: Array<{ entryId: string; amount: number }>;
  paidAt: string;
  reference: string | null;
  note: string | null;
}

/**
 * Registra a liquidação (manual, auditada): um pagamento para um ou vários
 * lançamentos aprovados do mesmo beneficiário e moeda. Pagamento parcial
 * deixa o saldo em aberto no lançamento.
 */
export async function settleEntries(
  user: User,
  input: SettlementInput,
): Promise<CommissionPayment> {
  assertAdmin(user);
  const store = getStore();
  const wanted = input.allocations.filter((a) => cents(a.amount) !== 0);
  if (!wanted.length) throw new Error("commission_pick");
  if (!/^\d{4}-\d{2}-\d{2}/.test(input.paidAt))
    throw new Error("commission_date_invalid");
  const entries: CommissionEntry[] = [];
  for (const a of wanted) {
    const entry = await store.get("commission_entries", a.entryId);
    if (!entry) throw new Error("not_found");
    if (!["approved", "partially_paid"].includes(entry.status))
      throw new Error("commission_entry_not_approved");
    const open = cents(entry.released) - cents(entry.paidAmount);
    // Não paga mais que o liberado e ainda em aberto (ajuste negativo: até ele).
    if (
      open === 0 ||
      Math.sign(cents(a.amount)) !== Math.sign(open) ||
      Math.abs(cents(a.amount)) > Math.abs(open)
    )
      throw new Error("commission_amount_over");
    entries.push(entry);
  }
  const [first] = entries;
  if (
    entries.some(
      (e) =>
        e.beneficiaryPartyId !== first.beneficiaryPartyId ||
        e.currency !== first.currency,
    )
  )
    throw new Error("commission_settle_mixed");
  const total = wanted.reduce((s, a) => s + cents(a.amount), 0);
  const number = await store.nextNumber("commission_payment_number");
  const payment = await store.create("commission_payments", {
    number,
    beneficiaryPartyId: first.beneficiaryPartyId,
    amount: money(total),
    currency: first.currency,
    paidAt: new Date(input.paidAt).toISOString(),
    reference: input.reference?.trim().slice(0, 120) || null,
    documentId: null,
    note: input.note?.trim().slice(0, 2000) || null,
    allocations: wanted.map((a) => ({
      entryId: a.entryId,
      amount: money(cents(a.amount)),
    })),
    createdByUserId: user.id,
  });
  for (const a of wanted) {
    const entry = entries.find((e) => e.id === a.entryId)!;
    const paid = money(cents(entry.paidAmount) + cents(a.amount));
    await store.update("commission_entries", entry.id, {
      paidAmount: paid,
      status:
        entry.amount < 0
          ? cents(paid) <= cents(entry.amount)
            ? "paid"
            : "partially_paid"
          : paidStatus(entry.amount, paid),
    });
  }
  await audit(
    user,
    "commission.settle",
    "commission_payment",
    payment.id,
    `Liquidação nº ${number}: ${payment.amount} ${payment.currency} em ${wanted.length} lançamento(s)`,
    null,
    payment,
  );
  return payment;
}

export async function listPayments(user: User) {
  assertAdmin(user);
  const rows = await getStore().list("commission_payments");
  return rows.sort((a, b) => b.number - a.number);
}
