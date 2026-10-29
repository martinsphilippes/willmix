import "server-only";

import {
  getStore,
  type Order,
  type OrderItem,
  type ProductionTrack,
  type SkuInspection,
  type User,
} from "@/lib/db";
import {
  FOLLOWUP_DAYS,
  type FollowupStatus,
  type ProductionMode,
  type SkuInspectionResult,
} from "@/lib/db/schema";
import { ForbiddenError, isAdmin, isWellmix } from "@/lib/auth/permissions";
import { audit } from "./audit";
import { notify } from "./notifications";
import { isSchemaMissing } from "./packaging-brief";

/*
 * Produção (Fase C, docs/PRODUCTION.md), fora das etapas do pedido:
 * - fornecedor fábrica ou trade (trade: informar a fábrica, onde se inspeciona);
 * - início da produção e ETD; mudar o ETD exige motivo e avisa a Wellmix (ou
 *   o fornecedor, quando foi a Wellmix);
 * - follow aos 5, 15 e 25 dias do início (pendência da Wellmix); atraso avisa
 *   o analista e o planner;
 * - inspeção agendada (o fornecedor é avisado) e resultado por SKU: reprovado
 *   volta ao fornecedor, que diz o que corrigiu; a Wellmix inspeciona de novo.
 */

export class ProductionError extends Error {}

const DAY = 24 * 60 * 60 * 1000;

/** Quem mexe na produção: Wellmix ou o fornecedor do pedido. */
export function canEditProduction(user: User, order: Order): boolean {
  if (isWellmix(user)) return true;
  return (
    user.role === "supplier" &&
    !!user.partyId &&
    order.supplierId === user.partyId
  );
}

async function loadOrder(orderId: string) {
  const order = await getStore().get("orders", orderId);
  if (!order) throw new ProductionError("order_not_found");
  if (order.status === "CANCELLED" || order.status === "CLOSED")
    throw new ProductionError("order_closed");
  return order;
}

export async function getTrack(
  orderId: string,
): Promise<ProductionTrack | null> {
  try {
    const [track] = await getStore().list("production_tracks", {
      filter: { orderId },
      limit: 1,
    });
    return track ?? null;
  } catch (error) {
    if (isSchemaMissing(error)) return null;
    throw error;
  }
}

async function ensureTrack(user: User, orderId: string) {
  const existing = await getTrack(orderId);
  if (existing) return existing;
  return getStore().create("production_tracks", {
    orderId,
    mode: null,
    factoryName: null,
    factoryAddress: null,
    productionStartAt: null,
    etd: null,
    etdOriginal: null,
    etdHistory: [],
    followups: [],
    inspectionScheduledAt: null,
    inspectionNote: null,
    updatedByUserId: user.id,
  });
}

/** Analista do pedido + logins com as funções (ninguém: os admins). */
async function wellmixFor(order: Order, fns: string[]): Promise<string[]> {
  const team = await getStore().list("users", {
    filter: { role: ["admin", "operator"], active: true },
  });
  const ids = new Set<string>();
  if (order.ownerUserId) ids.add(order.ownerUserId);
  for (const u of team)
    if ((u.functions ?? []).some((f) => fns.includes(f))) ids.add(u.id);
  if (!ids.size) for (const u of team.filter(isAdmin)) ids.add(u.id);
  return [...ids];
}

const day = (iso: string | null) => (iso ? iso.slice(0, 10) : "—");

export interface PlanInput {
  mode?: ProductionMode | null;
  factoryName?: string | null;
  factoryAddress?: string | null;
  productionStartAt?: string | null;
  etd?: string | null;
  etdReason?: string | null;
}

/** Fábrica/trade, início da produção e ETD (Wellmix ou fornecedor). */
export async function savePlan(user: User, orderId: string, input: PlanInput) {
  const order = await loadOrder(orderId);
  if (!canEditProduction(user, order)) throw new ForbiddenError();
  const store = getStore();
  const track = await ensureTrack(user, orderId);
  const patch: Partial<ProductionTrack> = { updatedByUserId: user.id };
  if (input.mode !== undefined) patch.mode = input.mode;
  if (input.factoryName !== undefined) patch.factoryName = input.factoryName;
  if (input.factoryAddress !== undefined)
    patch.factoryAddress = input.factoryAddress;
  if (input.productionStartAt !== undefined)
    patch.productionStartAt = input.productionStartAt;

  const etdChanged =
    input.etd !== undefined &&
    input.etd !== null &&
    day(input.etd) !== day(track.etd);
  if (etdChanged) {
    const reason = input.etdReason?.trim() || null;
    // Primeiro ETD não precisa de motivo; mudar um ETD informado precisa.
    if (track.etd && !reason) throw new ProductionError("etd_reason_required");
    patch.etd = input.etd!;
    if (!track.etdOriginal) patch.etdOriginal = input.etd!;
    patch.etdHistory = [
      ...(track.etdHistory ?? []),
      {
        from: track.etd,
        to: input.etd!,
        at: new Date().toISOString(),
        byUserId: user.id,
        reason,
      },
    ];
  }
  const updated = await store.update("production_tracks", track.id, patch);
  await audit(
    user,
    "production.plan",
    "order",
    orderId,
    etdChanged
      ? `ETD ${day(track.etd)} → ${day(input.etd!)}${input.etdReason ? ` (${input.etdReason})` : ""}`
      : "Dados da produção atualizados",
    {
      mode: track.mode,
      productionStartAt: track.productionStartAt,
      etd: track.etd,
    },
    {
      mode: updated.mode,
      productionStartAt: updated.productionStartAt,
      etd: updated.etd,
    },
  );
  if (etdChanged && track.etd) {
    const link = `/app/orders/${orderId}#production`;
    const message = {
      link,
      actor: null,
      text: (
        t: Parameters<NonNullable<Parameters<typeof notify>[1]["text"]>>[0],
      ) => ({
        subject: t("production.notify.etd.subject", {
          n: String(order.number),
        }),
        body: t("production.notify.etd.body", {
          from: day(track.etd),
          to: day(input.etd!),
          reason: input.etdReason ?? "—",
        }),
      }),
    };
    // Mudou pelo fornecedor: avisa a Wellmix; pela Wellmix: avisa o fornecedor.
    if (isWellmix(user))
      await notify(
        { role: "supplier", partyId: order.supplierId },
        { ...message, kind: "info" },
      );
    else
      await notify(
        { userIds: await wellmixFor(order, ["planner", "buyer"]) },
        { ...message, kind: "alert" },
      );
  }
  return updated;
}

/** Follows que já venceram e ainda não foram registrados. */
export function followupsDue(
  track: Pick<ProductionTrack, "productionStartAt" | "followups"> | null,
  now = new Date(),
): { day: number; dueAt: string }[] {
  if (!track?.productionStartAt) return [];
  const start = Date.parse(track.productionStartAt);
  if (Number.isNaN(start)) return [];
  const done = new Set((track.followups ?? []).map((f) => f.day));
  return FOLLOWUP_DAYS.filter((d) => !done.has(d))
    .map((d) => ({ day: d, dueAt: new Date(start + d * DAY).toISOString() }))
    .filter((f) => Date.parse(f.dueAt) <= now.getTime());
}

/** Wellmix registra o follow do dia (5, 15 ou 25). Atraso avisa o planner. */
export async function recordFollowup(
  user: User,
  orderId: string,
  input: { day: number; status: FollowupStatus; note: string | null },
) {
  if (!isWellmix(user)) throw new ForbiddenError();
  const order = await loadOrder(orderId);
  if (!(FOLLOWUP_DAYS as readonly number[]).includes(input.day))
    throw new ProductionError("invalid_day");
  const track = await getTrack(orderId);
  if (!track?.productionStartAt) throw new ProductionError("no_start");
  if ((track.followups ?? []).some((f) => f.day === input.day))
    throw new ProductionError("followup_done");
  if (input.status === "delayed" && !input.note?.trim())
    throw new ProductionError("note_required");
  const updated = await getStore().update("production_tracks", track.id, {
    followups: [
      ...(track.followups ?? []),
      {
        day: input.day,
        status: input.status,
        note: input.note?.trim() || null,
        at: new Date().toISOString(),
        byUserId: user.id,
      },
    ],
    updatedByUserId: user.id,
  });
  await audit(
    user,
    "production.followup",
    "order",
    orderId,
    `Follow de ${input.day} dias: ${input.status === "delayed" ? "atrasado" : "no prazo"}${input.note ? ` · ${input.note}` : ""}`,
  );
  if (input.status === "delayed")
    await notify(
      { userIds: await wellmixFor(order, ["planner"]) },
      {
        link: `/app/orders/${orderId}#production`,
        kind: "alert",
        actor: null,
        text: (t) => ({
          subject: t("production.notify.delayed.subject", {
            n: String(order.number),
          }),
          body: t("production.notify.delayed.body", {
            day: String(input.day),
            note: input.note ?? "—",
          }),
        }),
      },
    );
  return updated;
}

/** Wellmix agenda a inspeção; trade precisa da fábrica informada. */
export async function scheduleInspection(
  user: User,
  orderId: string,
  input: { at: string; note: string | null },
) {
  if (!isWellmix(user)) throw new ForbiddenError();
  const order = await loadOrder(orderId);
  const track = await ensureTrack(user, orderId);
  if (track.mode === "trade" && !track.factoryAddress?.trim())
    throw new ProductionError("factory_required");
  const updated = await getStore().update("production_tracks", track.id, {
    inspectionScheduledAt: input.at,
    inspectionNote: input.note?.trim() || null,
    updatedByUserId: user.id,
  });
  await audit(
    user,
    "production.inspection_scheduled",
    "order",
    orderId,
    `Inspeção agendada para ${day(input.at)}`,
  );
  await notify(
    { role: "supplier", partyId: order.supplierId },
    {
      link: `/app/orders/${orderId}#production`,
      kind: "action",
      text: (t) => ({
        subject: t("production.notify.scheduled.subject", {
          n: String(order.number),
        }),
        body: t("production.notify.scheduled.body", {
          date: day(input.at),
          note: input.note ?? "—",
        }),
      }),
    },
  );
  return updated;
}

async function inspectionsOf(orderId: string): Promise<SkuInspection[]> {
  try {
    return await getStore().list("sku_inspections", {
      filter: { orderId },
    });
  } catch (error) {
    if (isSchemaMissing(error)) return [];
    throw error;
  }
}

/** Última inspeção de cada item. */
export function latestByItem(rows: SkuInspection[]) {
  const map = new Map<string, SkuInspection>();
  for (const row of rows) {
    const current = map.get(row.orderItemId);
    if (!current || row.round > current.round) map.set(row.orderItemId, row);
  }
  return map;
}

/** Wellmix registra o resultado da inspeção de um SKU (nova rodada). */
export async function inspectSku(
  user: User,
  orderId: string,
  input: {
    orderItemId: string;
    result: SkuInspectionResult;
    note: string | null;
  },
) {
  if (!isWellmix(user)) throw new ForbiddenError();
  const order = await loadOrder(orderId);
  const store = getStore();
  const item = await store.get("order_items", input.orderItemId);
  if (!item || item.orderId !== orderId)
    throw new ProductionError("item_not_found");
  if (input.result === "rejected" && !input.note?.trim())
    throw new ProductionError("note_required");
  const previous = latestByItem(await inspectionsOf(orderId)).get(item.id);
  if (previous?.result === "approved")
    throw new ProductionError("already_approved");
  // Reprovado: espera o fornecedor dizer o que corrigiu antes da nova rodada.
  if (previous?.result === "rejected" && !previous.supplierRespondedAt)
    throw new ProductionError("waiting_supplier");
  const row = await store.create("sku_inspections", {
    orderId,
    orderItemId: item.id,
    round: (previous?.round ?? 0) + 1,
    result: input.result,
    note: input.note?.trim() || null,
    inspectedByUserId: user.id,
    inspectedAt: new Date().toISOString(),
    supplierAction: null,
    supplierRespondedAt: null,
    supplierRespondedByUserId: null,
  });
  await audit(
    user,
    "production.sku_inspected",
    "order",
    orderId,
    `Inspeção ${row.round}ª rodada de ${item.name}: ${input.result === "approved" ? "aprovado" : "reprovado"}${row.note ? ` · ${row.note}` : ""}`,
  );
  if (input.result === "rejected")
    await notify(
      { role: "supplier", partyId: order.supplierId },
      {
        link: `/app/orders/${orderId}#production`,
        kind: "action",
        text: (t) => ({
          subject: t("production.notify.rejected.subject", {
            n: String(order.number),
            item: item.name,
          }),
          body: t("production.notify.rejected.body", { note: row.note ?? "—" }),
        }),
      },
    );
  return row;
}

/** Fornecedor diz o que corrigiu no SKU reprovado (volta para a Wellmix). */
export async function respondSku(
  user: User,
  inspectionId: string,
  action: string,
) {
  const store = getStore();
  const row = await store.get("sku_inspections", inspectionId);
  if (!row) throw new ProductionError("not_found");
  const order = await loadOrder(row.orderId);
  if (!canEditProduction(user, order)) throw new ForbiddenError();
  const latest = latestByItem(await inspectionsOf(order.id)).get(
    row.orderItemId,
  );
  if (
    latest?.id !== row.id ||
    row.result !== "rejected" ||
    row.supplierRespondedAt
  )
    throw new ProductionError("invalid_status");
  if (!action.trim()) throw new ProductionError("action_required");
  const updated = await store.update("sku_inspections", row.id, {
    supplierAction: action.trim(),
    supplierRespondedAt: new Date().toISOString(),
    supplierRespondedByUserId: user.id,
  });
  const item = await store.get("order_items", row.orderItemId);
  await audit(
    user,
    "production.sku_fixed",
    "order",
    order.id,
    `Correção informada para ${item?.name ?? "item"}: ${action.trim()}`,
  );
  await notify(
    { userIds: await wellmixFor(order, ["buyer"]) },
    {
      link: `/app/orders/${order.id}#production`,
      kind: "action",
      text: (t) => ({
        subject: t("production.notify.fixed.subject", {
          n: String(order.number),
          item: item?.name ?? "—",
        }),
        body: t("production.notify.fixed.body", { action: action.trim() }),
      }),
    },
  );
  return updated;
}

export interface ProductionView {
  track: ProductionTrack | null;
  items: { item: OrderItem; latest: SkuInspection | null; rounds: number }[];
  due: { day: number; dueAt: string }[];
  allApproved: boolean;
}

/** Tudo o que o cartão "Produção" mostra. */
export async function productionView(order: Order): Promise<ProductionView> {
  const [track, items, rows] = await Promise.all([
    getTrack(order.id),
    getStore().list("order_items", { filter: { orderId: order.id } }),
    inspectionsOf(order.id),
  ]);
  const latest = latestByItem(rows);
  const view = items.map((item) => ({
    item,
    latest: latest.get(item.id) ?? null,
    rounds: rows.filter((r) => r.orderItemId === item.id).length,
  }));
  return {
    track,
    items: view,
    due: followupsDue(track),
    allApproved:
      view.length > 0 && view.every((v) => v.latest?.result === "approved"),
  };
}

export interface ProductionTaskDraft {
  kind: "production_follow" | "sku_inspection" | "sku_fix";
  order: Order;
  title: string;
  detail: string;
  dueAt: string | null;
}

/** Pendências da produção: follow e reinspeção (Wellmix); correção (fornecedor). */
export async function productionTasks(
  user: User,
  orders: Order[],
): Promise<ProductionTaskDraft[]> {
  const live = orders.filter(
    (o) => o.status !== "CANCELLED" && o.status !== "CLOSED",
  );
  if (!live.length) return [];
  const store = getStore();
  let tracks: ProductionTrack[] = [];
  let rows: SkuInspection[] = [];
  try {
    [tracks, rows] = await Promise.all([
      store.list("production_tracks", {
        filter: { orderId: live.map((o) => o.id) },
      }),
      store.list("sku_inspections", {
        filter: { orderId: live.map((o) => o.id) },
      }),
    ]);
  } catch (error) {
    if (isSchemaMissing(error)) return [];
    throw error;
  }
  const out: ProductionTaskDraft[] = [];
  const latest = [...latestByItem(rows).values()];
  const wellmix = isWellmix(user);
  for (const order of live) {
    if (wellmix) {
      const track = tracks.find((t) => t.orderId === order.id) ?? null;
      for (const f of followupsDue(track))
        out.push({
          kind: "production_follow",
          order,
          title: `Follow de ${f.day} dias: pedido #${order.number}`,
          detail: `ETD ${day(track?.etd ?? null)}`,
          dueAt: f.dueAt,
        });
      const fixed = latest.filter(
        (r) =>
          r.orderId === order.id &&
          r.result === "rejected" &&
          r.supplierRespondedAt,
      );
      if (fixed.length)
        out.push({
          kind: "sku_inspection",
          order,
          title: `Inspecionar de novo: pedido #${order.number}`,
          detail: `${fixed.length} SKU(s) corrigido(s) pelo fornecedor`,
          dueAt: track?.inspectionScheduledAt ?? null,
        });
    } else if (user.role === "supplier" && order.supplierId === user.partyId) {
      const open = latest.filter(
        (r) =>
          r.orderId === order.id &&
          r.result === "rejected" &&
          !r.supplierRespondedAt,
      );
      if (open.length)
        out.push({
          kind: "sku_fix",
          order,
          title: `Corrigir SKU reprovado: pedido #${order.number}`,
          detail: open
            .map((r) => r.note ?? "")
            .filter(Boolean)
            .join(" · "),
          dueAt: null,
        });
    }
  }
  return out;
}
