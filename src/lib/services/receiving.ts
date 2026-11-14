import "server-only";
import { holdersOf } from "@/lib/auth/function-access";
import { loadFunctionDefs } from "./team-functions";

import {
  getStore,
  type Order,
  type OrderItem,
  type Receiving,
  type ReceivingItem,
  type User,
} from "@/lib/db";
import {
  RECEIVING_CHECKS,
  type ReceivingCheck,
  type YesNo,
} from "@/lib/db/schema";
import { ForbiddenError, isAdmin, isWellmix } from "@/lib/auth/permissions";
import { audit } from "./audit";
import { notify } from "./notifications";
import { isSchemaMissing } from "@/lib/db/errors";

/*
 * Recebimento (Fase E, docs/RECEIVING.md): a Wellmix confere o container no
 * armazém. Lacre e fotos, checklist da descarga, quantidade recebida e
 * avariada por SKU (divergência avisa comprador e fornecedor), RIC,
 * devolução do container e fechamento com o resumo financeiro (o que o
 * cliente pagou × o que falta; o que foi pago ao fornecedor × FOB).
 */

export class ReceivingError extends Error {}

/** O recebimento aparece do desembaraço em diante. */
export const RECEIVING_STATUSES = [
  "CUSTOMS",
  "TRANSPORT",
  "DELIVERED",
  "CLOSED",
] as const;

export async function getReceiving(orderId: string): Promise<Receiving | null> {
  try {
    const [row] = await getStore().list("receivings", {
      filter: { orderId },
      limit: 1,
    });
    return row ?? null;
  } catch (error) {
    if (isSchemaMissing(error)) return null;
    throw error;
  }
}

async function load(user: User, orderId: string) {
  if (!isWellmix(user)) throw new ForbiddenError();
  const order = await getStore().get("orders", orderId);
  if (!order) throw new ReceivingError("order_not_found");
  if (order.status === "CANCELLED") throw new ReceivingError("order_cancelled");
  const current = await getReceiving(orderId);
  if (current?.closedAt) throw new ReceivingError("closed");
  return { order, current };
}

async function upsert(
  user: User,
  orderId: string,
  current: Receiving | null,
  patch: Partial<Receiving>,
) {
  const store = getStore();
  if (current)
    return store.update("receivings", current.id, {
      ...patch,
      updatedByUserId: user.id,
    });
  return store.create("receivings", {
    orderId,
    sealNumber: null,
    sealIntact: null,
    sealPhotoDocumentId: null,
    containerPhotoDocumentIds: [],
    checklist: [],
    items: [],
    ricNumber: null,
    ricDocumentId: null,
    containerReturnedAt: null,
    containerReturnDocumentId: null,
    closedAt: null,
    closedByUserId: null,
    closingNote: null,
    ...patch,
    updatedByUserId: user.id,
  });
}

/** Lacre, fotos e checklist da descarga. Lacre violado avisa a Wellmix. */
export async function saveUnloading(
  user: User,
  orderId: string,
  input: {
    sealNumber: string | null;
    sealIntact: YesNo | null;
    sealPhotoDocumentId?: string | null;
    containerPhotoDocumentIds?: string[];
    checklist: ReceivingCheck[];
  },
) {
  const { order, current } = await load(user, orderId);
  const checklist = input.checklist.filter((c) =>
    (RECEIVING_CHECKS as readonly string[]).includes(c),
  );
  const row = await upsert(user, orderId, current, {
    sealNumber: input.sealNumber?.trim() || null,
    sealIntact: input.sealIntact,
    ...(input.sealPhotoDocumentId
      ? { sealPhotoDocumentId: input.sealPhotoDocumentId }
      : {}),
    containerPhotoDocumentIds: [
      ...(current?.containerPhotoDocumentIds ?? []),
      ...(input.containerPhotoDocumentIds ?? []),
    ],
    checklist,
  });
  await audit(
    user,
    "receiving.unloading",
    "order",
    orderId,
    `Descarga: lacre ${row.sealNumber ?? "—"} (${row.sealIntact === "no" ? "violado" : row.sealIntact === "yes" ? "íntegro" : "—"}), checklist ${checklist.length}/${RECEIVING_CHECKS.length}`,
  );
  if (input.sealIntact === "no" && current?.sealIntact !== "no")
    await notify(
      { role: ["admin", "operator"] },
      {
        link: `/app/orders/${orderId}#receiving`,
        kind: "alert",
        actor: null,
        text: (t) => ({
          subject: t("receiving.notify.seal.subject", {
            n: String(order.number),
          }),
          body: t("receiving.notify.seal.body", {
            seal: row.sealNumber ?? "—",
          }),
        }),
      },
    );
  return row;
}

const hasDivergence = (i: ReceivingItem) =>
  i.received !== i.expected || i.damaged > 0;

/** Caixa master de cada item do pedido (variante, senão produto). */
export async function perBoxOf(
  items: OrderItem[],
): Promise<Map<string, number | null>> {
  const ids = [
    ...new Set(items.map((i) => i.productId).filter(Boolean)),
  ] as string[];
  const products = ids.length
    ? await getStore().list("products", { filter: { id: ids } })
    : [];
  return new Map(
    items.map((i) => {
      const p = products.find((x) => x.id === i.productId);
      const box = i.variant?.masterBoxQty ?? p?.masterBoxQty ?? null;
      return [i.id, box && box > 0 ? box : null];
    }),
  );
}

/** Quantidade recebida e avariada por SKU; divergência nova avisa. */
export async function saveCounts(
  user: User,
  orderId: string,
  counts: {
    orderItemId: string;
    received: number;
    damaged: number;
    note: string | null;
    /** Contado em caixas: `received` são caixas, convertidas pela caixa master. */
    inCartons?: boolean;
  }[],
) {
  const { order, current } = await load(user, orderId);
  const items = await getStore().list("order_items", {
    filter: { orderId },
  });
  const perBox = await perBoxOf(items);
  const rows: ReceivingItem[] = [];
  for (const item of items) {
    const c = counts.find((x) => x.orderItemId === item.id);
    if (!c) {
      const kept = current?.items.find((x) => x.orderItemId === item.id);
      if (kept) rows.push(kept);
      continue;
    }
    // Por caixas: as caixas contadas × a caixa master do cadastro.
    const cartons = c.inCartons ? c.received : null;
    if (c.inCartons) {
      const box = perBox.get(item.id);
      if (!box) throw new ReceivingError("no_master_box");
      c.received = c.received * box;
    }
    if (
      !Number.isFinite(c.received) ||
      !Number.isFinite(c.damaged) ||
      c.received < 0 ||
      c.damaged < 0 ||
      c.damaged > c.received
    )
      throw new ReceivingError("invalid_count");
    rows.push({
      orderItemId: item.id,
      expected: item.quantity,
      received: c.received,
      damaged: c.damaged,
      note: c.note?.trim() || null,
      cartons: c.inCartons ? cartons : null,
    });
  }
  const before = new Set(
    (current?.items ?? []).filter(hasDivergence).map((i) => i.orderItemId),
  );
  const fresh = rows.filter(
    (i) => hasDivergence(i) && !before.has(i.orderItemId),
  );
  const row = await upsert(user, orderId, current, { items: rows });
  const name = (id: string) => items.find((i) => i.id === id)?.name ?? "—";
  await audit(
    user,
    "receiving.counts",
    "order",
    orderId,
    rows
      .map(
        (i) =>
          `${name(i.orderItemId)}: ${i.received}/${i.expected}${i.damaged ? ` (${i.damaged} avariadas)` : ""}`,
      )
      .join("; "),
  );
  if (fresh.length) {
    const detail = fresh
      .map(
        (i) =>
          `${name(i.orderItemId)}: ${i.received}/${i.expected}${i.damaged ? `, ${i.damaged} avariadas` : ""}${i.note ? ` (${i.note})` : ""}`,
      )
      .join("; ");
    const message = {
      link: `/app/orders/${orderId}#receiving`,
      kind: "alert" as const,
      actor: null,
    };
    // Wellmix: analista do pedido, comprador (ou a equipe).
    const team = await getStore().list("users", {
      filter: { role: ["admin", "operator"], active: true },
    });
    const ids = new Set<string>();
    if (order.ownerUserId) ids.add(order.ownerUserId);
    for (const u of holdersOf(
      team,
      "receiving.follow",
      await loadFunctionDefs(),
    ))
      ids.add(u.id);
    if (!ids.size) for (const u of team.filter(isAdmin)) ids.add(u.id);
    await notify(
      { userIds: [...ids] },
      {
        ...message,
        text: (t) => ({
          subject: t("receiving.notify.divergence.subject", {
            n: String(order.number),
          }),
          body: detail,
        }),
      },
    );
    // Fornecedor: para a reclamação (sem o pedido do cliente nem preços).
    await notify(
      { role: "supplier", partyId: order.supplierId },
      {
        ...message,
        link: `/app/orders/${orderId}`,
        text: (t) => ({
          subject: t("receiving.notify.divergence.subject", {
            n: String(order.number),
          }),
          body: detail,
        }),
      },
    );
  }
  return row;
}

/** RIC (registro de inspeção do container no terminal). */
export async function saveRic(
  user: User,
  orderId: string,
  input: { ricNumber: string | null; ricDocumentId?: string | null },
) {
  const { current } = await load(user, orderId);
  const row = await upsert(user, orderId, current, {
    ricNumber: input.ricNumber?.trim() || null,
    ...(input.ricDocumentId ? { ricDocumentId: input.ricDocumentId } : {}),
  });
  await audit(
    user,
    "receiving.ric",
    "order",
    orderId,
    `RIC ${row.ricNumber ?? "—"}`,
  );
  return row;
}

/** Devolução do container vazio (data e comprovante). */
export async function saveReturn(
  user: User,
  orderId: string,
  input: { returnedAt: string; documentId?: string | null },
) {
  const { current } = await load(user, orderId);
  const row = await upsert(user, orderId, current, {
    containerReturnedAt: input.returnedAt,
    ...(input.documentId
      ? { containerReturnDocumentId: input.documentId }
      : {}),
  });
  await audit(
    user,
    "receiving.container_returned",
    "order",
    orderId,
    `Container devolvido em ${input.returnedAt.slice(0, 10)}`,
  );
  return row;
}

export interface ReceivingMissing {
  seal: boolean;
  photos: boolean;
  checklist: boolean;
  counts: boolean;
  ric: boolean;
  containerReturn: boolean;
}

/** O que falta para encerrar o recebimento. */
export function missingForClose(
  row: Receiving | null,
  items: OrderItem[],
): (keyof ReceivingMissing)[] {
  const out: (keyof ReceivingMissing)[] = [];
  if (!row?.sealNumber || !row.sealIntact) out.push("seal");
  if (!row?.sealPhotoDocumentId || !row.containerPhotoDocumentIds?.length)
    out.push("photos");
  if ((row?.checklist?.length ?? 0) < RECEIVING_CHECKS.length)
    out.push("checklist");
  if (items.some((i) => !row?.items?.some((x) => x.orderItemId === i.id)))
    out.push("counts");
  if (!row?.ricNumber) out.push("ric");
  if (!row?.containerReturnedAt) out.push("containerReturn");
  return out;
}

/** Encerra o recebimento (tudo conferido). Avisa o financeiro. */
export async function closeReceiving(
  user: User,
  orderId: string,
  note: string | null,
) {
  const { order, current } = await load(user, orderId);
  const items = await getStore().list("order_items", { filter: { orderId } });
  const missing = missingForClose(current, items);
  if (missing.length) throw new ReceivingError("incomplete");
  const row = await upsert(user, orderId, current, {
    closedAt: new Date().toISOString(),
    closedByUserId: user.id,
    closingNote: note?.trim() || null,
  });
  const summary = await financialSummary(order);
  await audit(
    user,
    "receiving.closed",
    "order",
    orderId,
    `Recebimento encerrado; cliente: pago ${summary.customerPaid} de ${summary.customerTotal ?? "—"} ${summary.customerCurrency ?? ""}`,
  );
  const team = await getStore().list("users", {
    filter: { role: ["admin", "operator"], active: true },
  });
  const finance = holdersOf(team, "numerario.manage", await loadFunctionDefs());
  await notify(
    {
      userIds: (finance.length ? finance : team.filter(isAdmin)).map(
        (u) => u.id,
      ),
    },
    {
      link: `/app/orders/${orderId}#receiving`,
      kind: "action",
      text: (t) => ({
        subject: t("receiving.notify.closed.subject", {
          n: String(order.number),
        }),
        body: t("receiving.notify.closed.body"),
      }),
    },
  );
  return row;
}

export interface FinancialSummary {
  customerTotal: number | null;
  customerCurrency: string | null;
  customerPaid: number;
  customerDue: number | null;
  supplierTotal: number | null;
  supplierCurrency: string | null;
  supplierPaid: number;
  supplierDue: number | null;
}

/** Fechamento: adiantado × devido, dos dois lados. */
export async function financialSummary(
  order: Order,
): Promise<FinancialSummary> {
  const store = getStore();
  const [byOrder, byRequest] = await Promise.all([
    store.list("payments", { filter: { orderId: order.id } }),
    store.list("payments", { filter: { requestId: order.requestId } }),
  ]);
  const all = [...byOrder, ...byRequest.filter((p) => !p.orderId)];
  const settled = (p: (typeof all)[number]) =>
    p.status === "confirmed" || p.status === "received";
  const sum = (dir: "customer_in" | "supplier_out", currency: string | null) =>
    all
      .filter(
        (p) =>
          p.direction === dir &&
          settled(p) &&
          (!currency || p.currency === currency),
      )
      .reduce((acc, p) => acc + p.amount, 0);
  const customerPaid = sum("customer_in", order.sellCurrency);
  const supplierPaid = sum("supplier_out", order.fobCurrency);
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    customerTotal: order.sellPrice,
    customerCurrency: order.sellCurrency,
    customerPaid: round(customerPaid),
    customerDue:
      order.sellPrice !== null ? round(order.sellPrice - customerPaid) : null,
    supplierTotal: order.fobTotal,
    supplierCurrency: order.fobCurrency,
    supplierPaid: round(supplierPaid),
    supplierDue:
      order.fobTotal !== null ? round(order.fobTotal - supplierPaid) : null,
  };
}

export interface ReceivingView {
  row: Receiving | null;
  items: OrderItem[];
  /** Caixa master por item (contagem por caixas). */
  perBox: Record<string, number | null>;
  missing: (keyof ReceivingMissing)[];
  divergences: number;
  finance: FinancialSummary;
}

export async function receivingView(order: Order): Promise<ReceivingView> {
  const [row, items, finance] = await Promise.all([
    getReceiving(order.id),
    getStore().list("order_items", { filter: { orderId: order.id } }),
    financialSummary(order),
  ]);
  return {
    row,
    items,
    perBox: Object.fromEntries(await perBoxOf(items)),
    missing: missingForClose(row, items),
    divergences: (row?.items ?? []).filter(hasDivergence).length,
    finance,
  };
}

/* ---------------- Qualidade no CD (mapa E19, E19?, E22) ---------------- */

/*
 * Pedido do dono (14/11/2026): a qualidade confere o produto recebido no CD
 * contra o pedido. Ela usa a conferência por SKU acima e conclui: sem
 * divergência, o produto é armazenado (E22) e vendas fica sabendo; com
 * divergência, Compras é avisada e o pedido segue a trilha do lote
 * (E21: Compras → Fornecedor → Evidência → Financeiro).
 *
 * Quem conclui: quem tem a ação "Concluir a conferência da qualidade"
 * (padrão: a função Qualidade (CD)); sem ninguém com ela na equipe, a
 * Wellmix (como antes) e sempre o administrador.
 */

async function qualityHolders() {
  const team = await getStore().list("users", {
    filter: { role: ["admin", "operator"], active: true },
  });
  return holdersOf(team, "receiving.quality", await loadFunctionDefs());
}

export async function canDoQuality(user: User): Promise<boolean> {
  if (isAdmin(user)) return true;
  if (!isWellmix(user)) return false;
  const holders = await qualityHolders();
  return holders.length === 0 || holders.some((u) => u.id === user.id);
}

/** A qualidade conclui a conferência (a contagem por SKU já registrada). */
export async function concludeQuality(
  user: User,
  orderId: string,
  note: string | null,
) {
  if (!(await canDoQuality(user))) throw new ForbiddenError();
  const { order, current } = await load(user, orderId);
  const items = await getStore().list("order_items", { filter: { orderId } });
  if (
    !current ||
    items.some((i) => !current.items.some((x) => x.orderItemId === i.id))
  )
    throw new ReceivingError("quality_counts_required");
  if (current.qualityAt) throw new ReceivingError("quality_done");
  const divergent = current.items.some(hasDivergence);
  const now = new Date().toISOString();
  const clean = note?.trim() || null;
  if (divergent && !clean) throw new ReceivingError("quality_note_required");
  const row = await upsert(user, orderId, current, {
    qualityResult: divergent ? "divergent" : "ok",
    qualityAt: now,
    qualityByUserId: user.id,
    qualityNote: clean,
    ...(divergent ? {} : { storedAt: now }),
  });
  await audit(
    user,
    divergent ? "receiving.quality_divergent" : "receiving.quality_ok",
    "order",
    orderId,
    divergent
      ? `Qualidade: carga com divergência${clean ? ` (${clean})` : ""}; segue a trilha do lote`
      : "Qualidade: carga conferida sem divergência; armazenada no CD",
  );
  const team = await getStore().list("users", {
    filter: { role: ["admin", "operator"], active: true },
  });
  const defs = await loadFunctionDefs();
  const ids = (key: Parameters<typeof holdersOf>[1]) => {
    const set = new Set(holdersOf(team, key, defs).map((u) => u.id));
    if (order.ownerUserId) set.add(order.ownerUserId);
    if (!set.size) for (const u of team.filter(isAdmin)) set.add(u.id);
    return [...set];
  };
  await notify(
    {
      // Sem divergência: vendas (o produto está no estoque); com ela, Compras.
      userIds: ids(
        divergent ? "receiving.follow" : "purchaseOrder.salesNotice",
      ),
    },
    {
      link: `/app/orders/${orderId}#receiving`,
      kind: divergent ? "alert" : "info",
      actor: null,
      text: (t) => ({
        subject: t(
          divergent
            ? "quality.notify.divergent.subject"
            : "quality.notify.stored.subject",
          { n: String(order.number) },
        ),
        body: t(
          divergent
            ? "quality.notify.divergent.body"
            : "quality.notify.stored.body",
          { note: clean ?? "" },
        ),
      }),
    },
  );
  return row;
}

/**
 * Pendências da qualidade: recebimentos com a descarga registrada e a
 * conferência da qualidade por concluir (lê os recebimentos e os pedidos
 * deles por id).
 */
export async function qualityTasks(user: User): Promise<Order[]> {
  if (!(await canDoQuality(user))) return [];
  const rows = await getStore()
    .list("receivings")
    .catch(() => [] as Receiving[]);
  const open = rows.filter(
    (r) => !r.closedAt && !r.qualityAt && (r.checklist?.length ?? 0) > 0,
  );
  if (!open.length) return [];
  const orders = await getStore().list("orders", {
    filter: { id: open.map((r) => r.orderId) },
  });
  return orders.filter((o) => o.status !== "CANCELLED" && !o.held);
}
