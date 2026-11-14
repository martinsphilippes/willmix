import "server-only";

import { ForbiddenError, isWellmix } from "@/lib/auth/permissions";
import {
  getStore,
  type Order,
  type OrderItem,
  type ShippingDoc,
  type ShippingDocKind,
  type ShippingDocLine,
  type User,
} from "@/lib/db";
import {
  compareLines,
  expectedCartons,
  loadComplete,
  loadLines,
  suggestedLine,
  type LoadLine,
} from "@/lib/shipping-docs";
import { isPurchaseFlow } from "@/lib/workflow/stages";
import { audit } from "./audit";
import { notify, notifyWellmix } from "./notifications";

/*
 * Documentos do embarque do pedido de compra (mapa R7, R21, R22, R22?, R23,
 * R23?; docs/SHIPPING_DOCS.md). Decisão do dono (14/11/2026), na ordem:
 *
 * 1. Fornecedor: check list de carga, as caixas de cada item que subiram no
 *    container, abatendo do pedido até terminar.
 * 2. Fornecedor: packing list (vem do check list; ele confere peças e pesos).
 * 3. Trading (entra como o fornecedor do pedido): invoice. O sistema confere
 *    com o packing list linha a linha (caixas, peças, peso líquido e bruto);
 *    não bateu, a invoice volta para a trading refazer.
 * 4. Companhia marítima: BL, conferido com a invoice do mesmo jeito; não
 *    bateu, volta para a marítima refazer.
 *
 * O despachante não participa destes documentos. BL aceito conclui o passo
 * "BL" do desembaraço; o embarque só é confirmado com ele e com o container
 * no porto.
 */

export class ShippingDocError extends Error {}

const ORDER = ["load", "packing_list", "invoice", "bl"] as const;

const isOrderSupplier = (user: User, order: Order) =>
  user.role === "supplier" &&
  !!user.partyId &&
  user.partyId === order.supplierId;
const isOrderShippingLine = (user: User, order: Order) =>
  user.role === "shipping_line" &&
  !!user.partyId &&
  user.partyId === order.shippingLineId;

/** Quem faz cada documento (a Wellmix pode agir no lugar de quem falta). */
export function canDo(user: User, order: Order, kind: ShippingDocKind) {
  if (isWellmix(user)) return true;
  return kind === "bl"
    ? isOrderShippingLine(user, order)
    : isOrderSupplier(user, order);
}

/** Quem vê a tela: a Wellmix, o fornecedor e a marítima do pedido. */
export const canView = (user: User, order: Order) =>
  isWellmix(user) ||
  isOrderSupplier(user, order) ||
  isOrderShippingLine(user, order);

interface ItemInfo {
  item: OrderItem;
  perBox: number | null;
  netPc: number | null;
  grossPc: number | null;
  expected: number | null;
}

async function itemsOf(order: Order): Promise<ItemInfo[]> {
  const store = getStore();
  const items = (
    await store.list("order_items", { filter: { orderId: order.id } })
  ).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const ids = [
    ...new Set(items.map((i) => i.productId).filter(Boolean)),
  ] as string[];
  const products = ids.length
    ? await store.list("products", { filter: { id: ids } })
    : [];
  return items.map((item) => {
    const p = products.find((x) => x.id === item.productId);
    const v = item.variant ?? null;
    const perBox = v?.masterBoxQty ?? p?.masterBoxQty ?? null;
    return {
      item,
      perBox,
      netPc: v?.netWeightKg ?? p?.netWeightKg ?? null,
      grossPc: v?.grossWeightKg ?? p?.grossWeightKg ?? null,
      expected: expectedCartons(item.quantity, perBox),
    };
  });
}

async function docsOf(orderId: string) {
  const rows = await getStore()
    .list("shipping_docs", { filter: { orderId } })
    .catch(() => [] as ShippingDoc[]);
  const by = (k: ShippingDocKind) => rows.find((r) => r.kind === k) ?? null;
  return {
    load: by("load"),
    packing_list: by("packing_list"),
    invoice: by("invoice"),
    bl: by("bl"),
  };
}

async function stepDone(orderId: string, key: string) {
  const [step] = await getStore()
    .list("import_steps", { filter: { orderId, key: key as never } })
    .catch(() => []);
  return !!step && (step.status === "submitted" || step.status === "validated");
}

export interface ShippingDocsView {
  order: Order;
  items: ItemInfo[];
  load: LoadLine[];
  loadDone: boolean;
  docs: Awaited<ReturnType<typeof docsOf>>;
  /** O que está liberado agora (a ordem do mapa). */
  open: Record<ShippingDocKind, boolean>;
  /** O login pode fazer cada documento liberado. */
  can: Record<ShippingDocKind, boolean>;
  /** Linhas sugeridas para o próximo documento (o anterior, ou o check list). */
  suggestion: ShippingDocLine[];
}

const accepted = (d: ShippingDoc | null) => d?.status === "accepted";

export async function shippingDocsView(
  user: User,
  orderId: string,
): Promise<ShippingDocsView | null> {
  const order = await getStore().get("orders", orderId);
  if (!order || !isPurchaseFlow(order) || !canView(user, order)) return null;
  const [items, docs, emptyDone] = await Promise.all([
    itemsOf(order),
    docsOf(order.id),
    stepDone(order.id, "container_empty"),
  ]);
  const load = loadLines(
    items.map((i) => ({
      id: i.item.id,
      name: i.item.name,
      expected: i.expected,
    })),
    docs.load?.entries,
  );
  const loadDone = loadComplete(load);
  const live = order.status !== "CANCELLED" && order.status !== "CLOSED";
  const open: Record<ShippingDocKind, boolean> = {
    load: live && emptyDone && !loadDone,
    packing_list: live && loadDone && !accepted(docs.invoice),
    invoice: live && accepted(docs.packing_list) && !accepted(docs.invoice),
    bl: live && accepted(docs.invoice) && !accepted(docs.bl),
  };
  const can = Object.fromEntries(
    ORDER.map((k) => [k, open[k] && canDo(user, order, k)]),
  ) as Record<ShippingDocKind, boolean>;
  // O próximo documento vem preenchido com o anterior (o PL, com o check list).
  const suggestion = accepted(docs.invoice)
    ? docs.invoice!.lines
    : accepted(docs.packing_list)
      ? docs.packing_list!.lines.map((l) => ({
          ...l,
          unitPrice:
            items.find((i) => i.item.id === l.itemId)?.item.unitPrice ?? null,
        }))
      : items.map((i) =>
          suggestedLine({
            itemId: i.item.id,
            name: i.item.name,
            cartons: load.find((l) => l.itemId === i.item.id)?.loaded ?? 0,
            perBox: i.perBox,
            quantity: i.item.quantity,
            netPc: i.netPc,
            grossPc: i.grossPc,
          }),
        );
  return { order, items, load, loadDone, docs, open, can, suggestion };
}

async function save(
  user: User,
  order: Order,
  kind: ShippingDocKind,
  current: ShippingDoc | null,
  patch: Partial<ShippingDoc>,
) {
  const store = getStore();
  const base = {
    submittedByUserId: user.id,
    submittedAt: new Date().toISOString(),
    version: (current?.version ?? 0) + 1,
    ...patch,
  };
  return current
    ? store.update("shipping_docs", current.id, base)
    : store.create("shipping_docs", {
        orderId: order.id,
        kind,
        status: "draft",
        number: null,
        containerNumber: null,
        lines: [],
        entries: null,
        mismatches: null,
        documentId: null,
        currency: null,
        ...base,
      } as never);
}

/** Check list: as caixas de cada item que subiram agora (somam ao que já subiu). */
export async function addLoad(
  user: User,
  orderId: string,
  rows: Array<{ itemId: string; cartons: number }>,
) {
  const view = await shippingDocsView(user, orderId);
  if (!view) throw new ForbiddenError();
  if (!view.can.load) throw new ShippingDocError("shipping_load_closed");
  const entries = [...(view.docs.load?.entries ?? [])];
  const now = new Date().toISOString();
  for (const row of rows) {
    if (!Number.isInteger(row.cartons) || row.cartons <= 0) continue;
    const line = view.load.find((l) => l.itemId === row.itemId);
    if (!line) throw new ShippingDocError("item_not_found");
    if (line.remaining !== null && row.cartons > line.remaining)
      throw new ShippingDocError("shipping_load_over");
    entries.push({
      itemId: row.itemId,
      cartons: row.cartons,
      at: now,
      byUserId: user.id,
    });
  }
  if (entries.length === (view.docs.load?.entries ?? []).length)
    throw new ShippingDocError("shipping_load_empty");
  const lines = loadLines(
    view.items.map((i) => ({
      id: i.item.id,
      name: i.item.name,
      expected: i.expected,
    })),
    entries,
  );
  const complete = loadComplete(lines);
  const doc = await save(user, view.order, "load", view.docs.load, {
    entries,
    status: complete ? "accepted" : "draft",
  });
  await audit(
    user,
    "shipping.load",
    "order",
    orderId,
    `Check list de carga: ${rows
      .filter((r) => r.cartons > 0)
      .map(
        (r) =>
          `${view.items.find((i) => i.item.id === r.itemId)?.item.name ?? r.itemId} +${r.cartons} cx`,
      )
      .join(", ")}${complete ? " (carga completa)" : ""}`,
  );
  if (complete)
    await notify(
      { role: "supplier", partyId: view.order.supplierId },
      {
        kind: "action",
        link: `/app/orders/${orderId}/shipping-docs`,
        text: (t) => ({
          subject: t("shippingDocs.notify.packing.subject", {
            n: String(view.order.number),
          }),
          body: t("shippingDocs.notify.packing.body"),
        }),
      },
    );
  return doc;
}

function cleanLines(
  view: ShippingDocsView,
  lines: ShippingDocLine[],
): ShippingDocLine[] {
  return view.items.map((i) => {
    const l = lines.find((x) => x.itemId === i.item.id);
    const num = (v: unknown) =>
      typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
    return {
      itemId: i.item.id,
      name: i.item.name,
      cartons: Math.round(num(l?.cartons) ?? 0),
      pieces: Math.round(num(l?.pieces) ?? 0),
      netKg: num(l?.netKg),
      grossKg: num(l?.grossKg),
      ...(l && "unitPrice" in l ? { unitPrice: num(l.unitPrice) } : {}),
    };
  });
}

/** Packing list do fornecedor: as caixas vêm do check list; ele confere peças e pesos. */
export async function submitPackingList(
  user: User,
  orderId: string,
  input: { lines: ShippingDocLine[]; documentId: string | null },
) {
  const view = await shippingDocsView(user, orderId);
  if (!view) throw new ForbiddenError();
  if (!view.can.packing_list) throw new ShippingDocError("shipping_doc_closed");
  const loaded = new Map(view.load.map((l) => [l.itemId, l.loaded]));
  const lines = cleanLines(view, input.lines).map((l) => ({
    ...l,
    // As caixas do packing list são as do check list de carga.
    cartons: loaded.get(l.itemId) ?? 0,
  }));
  if (
    lines.some((l) => l.pieces <= 0 || l.grossKg === null || l.netKg === null)
  )
    throw new ShippingDocError("shipping_lines_required");
  const doc = await save(
    user,
    view.order,
    "packing_list",
    view.docs.packing_list,
    {
      lines,
      documentId:
        input.documentId ?? view.docs.packing_list?.documentId ?? null,
      status: "accepted",
      mismatches: null,
    },
  );
  await audit(
    user,
    "shipping.packing_list",
    "order",
    orderId,
    `Packing list enviado (versão ${doc.version})`,
  );
  // A trading (o fornecedor do pedido) faz a invoice.
  await notify(
    { role: "supplier", partyId: view.order.supplierId },
    {
      kind: "action",
      link: `/app/orders/${orderId}/shipping-docs`,
      text: (t) => ({
        subject: t("shippingDocs.notify.invoice.subject", {
          n: String(view.order.number),
        }),
        body: t("shippingDocs.notify.invoice.body"),
      }),
    },
  );
  return doc;
}

/** Invoice da trading: conferida com o packing list linha a linha. */
export async function submitInvoice(
  user: User,
  orderId: string,
  input: {
    number: string;
    lines: ShippingDocLine[];
    documentId: string | null;
    currency: string | null;
  },
) {
  const view = await shippingDocsView(user, orderId);
  if (!view) throw new ForbiddenError();
  if (!view.can.invoice) throw new ShippingDocError("shipping_doc_closed");
  const number = input.number.trim();
  if (!number) throw new ShippingDocError("shipping_number_required");
  const documentId = input.documentId ?? view.docs.invoice?.documentId ?? null;
  if (!documentId) throw new ShippingDocError("file_required");
  const lines = cleanLines(view, input.lines);
  const mismatches = compareLines(view.docs.packing_list!.lines, lines);
  const ok = mismatches.length === 0;
  const doc = await save(user, view.order, "invoice", view.docs.invoice, {
    number,
    lines,
    documentId,
    currency: input.currency ?? view.order.fobCurrency ?? null,
    status: ok ? "accepted" : "rejected",
    mismatches,
  });
  await audit(
    user,
    ok ? "shipping.invoice_ok" : "shipping.invoice_mismatch",
    "order",
    orderId,
    ok
      ? `Invoice ${number} conferida com o packing list`
      : `Invoice ${number} não bate com o packing list (${mismatches.length} diferença(s))`,
  );
  if (ok) {
    // A marítima faz o BL (sem marítima designada, a Wellmix).
    const target = view.order.shippingLineId
      ? { role: "shipping_line" as const, partyId: view.order.shippingLineId }
      : { role: ["admin", "operator"] as ("admin" | "operator")[] };
    await notify(target, {
      kind: "action",
      link: `/app/orders/${orderId}/shipping-docs`,
      text: (t) => ({
        subject: t("shippingDocs.notify.bl.subject", {
          n: String(view.order.number),
        }),
        body: t("shippingDocs.notify.bl.body"),
      }),
    });
  } else
    await notify(
      { role: "supplier", partyId: view.order.supplierId },
      {
        kind: "alert",
        actor: "recipient",
        link: `/app/orders/${orderId}/shipping-docs`,
        text: (t) => ({
          subject: t("shippingDocs.notify.invoiceRedo.subject", {
            n: String(view.order.number),
          }),
          body: t("shippingDocs.notify.invoiceRedo.body", {
            count: String(mismatches.length),
          }),
        }),
      },
    );
  return doc;
}

/** BL da marítima: conferido com a invoice linha a linha. */
export async function submitBl(
  user: User,
  orderId: string,
  input: {
    number: string;
    containerNumber: string;
    lines: ShippingDocLine[];
    documentId: string | null;
  },
) {
  const view = await shippingDocsView(user, orderId);
  if (!view) throw new ForbiddenError();
  if (!view.can.bl) throw new ShippingDocError("shipping_doc_closed");
  const number = input.number.trim();
  const containerNumber = input.containerNumber.trim().toUpperCase();
  if (!number) throw new ShippingDocError("shipping_number_required");
  if (!containerNumber)
    throw new ShippingDocError("shipping_container_required");
  const documentId = input.documentId ?? view.docs.bl?.documentId ?? null;
  if (!documentId) throw new ShippingDocError("file_required");
  // O BL não tem preço: só caixas, peças e pesos.
  const lines = cleanLines(
    view,
    input.lines.map((l) => ({ ...l, unitPrice: undefined })),
  ).map((l) => {
    const { itemId, name, cartons, pieces, netKg, grossKg } = l;
    return { itemId, name, cartons, pieces, netKg, grossKg };
  });
  const mismatches = compareLines(view.docs.invoice!.lines, lines);
  const ok = mismatches.length === 0;
  const doc = await save(user, view.order, "bl", view.docs.bl, {
    number,
    containerNumber,
    lines,
    documentId,
    status: ok ? "accepted" : "rejected",
    mismatches,
  });
  await audit(
    user,
    ok ? "shipping.bl_ok" : "shipping.bl_mismatch",
    "order",
    orderId,
    ok
      ? `BL ${number} conferido com a invoice`
      : `BL ${number} não bate com a invoice (${mismatches.length} diferença(s))`,
  );
  if (ok) {
    await bridgeBlStep(user, view.order, number, documentId);
    await notifyWellmix({
      kind: "info",
      subject: `Pedido #${view.order.number}: packing list, invoice e BL conferidos`,
      body: `O BL ${number} (container ${containerNumber}) bate com a invoice e o packing list. O embarque pode ser confirmado com o container no porto.`,
      link: `/app/orders/${orderId}/shipping-docs`,
    });
  } else {
    const target = view.order.shippingLineId
      ? { role: "shipping_line" as const, partyId: view.order.shippingLineId }
      : { role: ["admin", "operator"] as ("admin" | "operator")[] };
    await notify(target, {
      kind: "alert",
      actor: "recipient",
      link: `/app/orders/${orderId}/shipping-docs`,
      text: (t) => ({
        subject: t("shippingDocs.notify.blRedo.subject", {
          n: String(view.order.number),
        }),
        body: t("shippingDocs.notify.blRedo.body", {
          count: String(mismatches.length),
        }),
      }),
    });
  }
  return doc;
}

/**
 * BL conferido: o passo "BL" do desembaraço fica concluído (o que vem
 * depois dele, como a presença de carga, segue normalmente).
 */
async function bridgeBlStep(
  user: User,
  order: Order,
  number: string,
  documentId: string,
) {
  const store = getStore();
  const now = new Date().toISOString();
  const [step] = await store
    .list("import_steps", { filter: { orderId: order.id, key: "bl" } })
    .catch(() => []);
  const data = {
    status: "validated" as const,
    value: number,
    amount: null,
    currency: null,
    documentId,
    submittedByUserId: user.id,
    submittedAt: now,
    validatedByUserId: user.id,
    validatedAt: now,
    rejectReason: null,
  };
  if (step) await store.update("import_steps", step.id, data);
  else
    await store.create("import_steps", {
      orderId: order.id,
      key: "bl",
      ...data,
    });
}

/** Embarque do pedido de compra: o BL conferido e o container lacrado no porto. */
export async function shipmentBlockers(
  orderId: string,
): Promise<Array<"bl" | "container_at_port">> {
  const [docs, atPort] = await Promise.all([
    docsOf(orderId),
    stepDone(orderId, "container_at_port"),
  ]);
  const out: Array<"bl" | "container_at_port"> = [];
  if (!atPort) out.push("container_at_port");
  if (!accepted(docs.bl)) out.push("bl");
  return out;
}

export interface ShippingDocTask {
  order: Order;
  kind: ShippingDocKind;
  redo: boolean;
}

/** Pendências dos documentos para o login (fornecedor, marítima ou a Wellmix no lugar da marítima). */
export async function shippingDocTasks(user: User): Promise<ShippingDocTask[]> {
  const store = getStore();
  const wellmix = isWellmix(user);
  if (!wellmix && user.role !== "supplier" && user.role !== "shipping_line")
    return [];
  if (!wellmix && !user.partyId) return [];
  const orders = (
    await store
      .list("orders", {
        filter: {
          flow: "supplier_request",
          status: ["INSPECTION", "SHIPPING"],
          ...(user.role === "supplier" ? { supplierId: user.partyId! } : {}),
          ...(user.role === "shipping_line"
            ? { shippingLineId: user.partyId! }
            : {}),
        },
      })
      .catch(() => [] as Order[])
  ).filter((o) => o.status !== "CANCELLED");
  const out: ShippingDocTask[] = [];
  for (const order of orders) {
    const view = await shippingDocsView(user, order.id);
    if (!view) continue;
    for (const kind of ORDER) {
      if (!view.can[kind]) continue;
      // A Wellmix só tem a pendência do BL sem marítima designada.
      if (wellmix && (kind !== "bl" || order.shippingLineId)) continue;
      out.push({ order, kind, redo: view.docs[kind]?.status === "rejected" });
    }
  }
  return out;
}
