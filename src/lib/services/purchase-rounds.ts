import "server-only";

import { assertWellmix } from "@/lib/auth/permissions";
import { assertScreen } from "@/lib/auth/screens";
import {
  getStore,
  ORDER_EXTRA_DEFAULTS,
  REQUEST_EXTRA_DEFAULTS,
  type Order,
  type PurchaseRound,
  type User,
} from "@/lib/db";
import { dueRounds, isRoundsParent, mapLaneKey } from "@/lib/purchase-rounds";
import { todayIso } from "@/lib/workflow/request-schedule";
import type { Translate } from "@/i18n";
import { audit } from "./audit";

/*
 * Pedidos filhos da programação de compra (docs/PURCHASE_SCHEDULE.md). O
 * pedido pai guarda o total, a negociação e a Preparação (artes, certificado,
 * MOQ e prazo confirmados). No dia de cada rodada nasce um pedido filho com as
 * peças da rodada, o preço negociado e os parceiros do pai; os itens da
 * Preparação vêm feitos (cópia dos do pai, com os mesmos arquivos) e o filho
 * começa no contrato, que cada rodada assina de novo.
 *
 * Quem chama: o job diário (/api/jobs/reminders), a conclusão da Preparação
 * do pai e o botão "Gerar as rodadas do dia" no pedido pai.
 */

export class PurchaseRoundsError extends Error {}

/** Preparação do pai concluída: as artes e o certificado existem para copiar. */
async function preparationDone(orderId: string): Promise<boolean> {
  const [stage] = await getStore().list("stages", {
    filter: { orderId, key: "PREPARATION" },
  });
  return stage?.status === "done";
}

/**
 * Faz nascer os pedidos filhos das rodadas que chegaram ao dia (de um pai ou
 * de todos). Pai cancelado não gera; pai com a Preparação aberta espera.
 * Devolve os pedidos criados.
 */
export async function spawnDueRounds(
  user: User | null,
  options: { orderId?: string; now?: Date } = {},
): Promise<Order[]> {
  const store = getStore();
  const today = todayIso(options.now);
  const parents = options.orderId
    ? [await store.get("orders", options.orderId)].filter(
        (o): o is Order => !!o,
      )
    : await store
        .list("orders", { filter: { flow: "supplier_request" } })
        .catch(async (error) => {
          const { isSchemaMissing } = await import("@/lib/db/errors");
          if (isSchemaMissing(error)) return [] as Order[];
          throw error;
        });
  const created: Order[] = [];
  for (const parent of parents) {
    if (!isRoundsParent(parent) || parent.status === "CANCELLED") continue;
    if (!dueRounds(parent.purchaseRounds, today).length) continue;
    if (!(await preparationDone(parent.id))) continue;
    created.push(...(await spawnParent(user, parent, today)));
  }
  return created;
}

/** Botão do pedido pai: só a Wellmix com a tela Pedidos. */
export async function spawnRoundsNow(
  user: User,
  orderId: string,
): Promise<Order[]> {
  assertWellmix(user);
  assertScreen(user, "orders");
  const order = await getStore().get("orders", orderId);
  if (!order) throw new PurchaseRoundsError("not_found");
  if (!isRoundsParent(order))
    throw new PurchaseRoundsError("rounds_not_parent");
  return spawnDueRounds(user, { orderId });
}

async function spawnParent(
  user: User | null,
  parent: Order,
  today: string,
): Promise<Order[]> {
  const store = getStore();
  // Os filhos que já existem valem mais que a marca no pai (dois disparos
  // juntos, ou a marca que não chegou a ser gravada).
  const existing = await store.list("orders", {
    filter: { parentOrderId: parent.id },
  });
  const rounds: PurchaseRound[] = (parent.purchaseRounds ?? []).map((r) => {
    const child = existing.find((o) => o.roundIndex === r.index);
    return child && !r.orderId
      ? { ...r, orderId: child.id, createdAt: child.createdAt }
      : r;
  });
  const created: Order[] = [];
  for (const round of dueRounds(rounds, today)) {
    const child = await createRoundOrder(user, parent, round, rounds.length);
    round.orderId = child.id;
    round.createdAt = child.createdAt;
    created.push(child);
    await store.update("orders", parent.id, { purchaseRounds: rounds });
  }
  // A última rodada nasceu: o pai encerra (o resto do caminho é dos filhos).
  if (rounds.every((r) => r.orderId) && parent.status !== "CLOSED")
    await store.update("orders", parent.id, {
      purchaseRounds: rounds,
      status: "CLOSED",
      closedAt: new Date().toISOString(),
      currentStageId: null,
    });
  else if (!created.length)
    await store.update("orders", parent.id, { purchaseRounds: rounds });
  return created;
}

async function createRoundOrder(
  user: User | null,
  parent: Order,
  round: PurchaseRound,
  totalRounds: number,
): Promise<Order> {
  const store = getStore();
  const [parentItems, parentRequest] = await Promise.all([
    store.list("order_items", { filter: { orderId: parent.id } }),
    store.get("requests", parent.requestId),
  ]);
  const lines = round.items
    .map((it) => {
      const item = parentItems.find((p) => p.productId === it.productId);
      return item
        ? { item, quantity: it.quantity, colors: it.colors ?? null }
        : null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x && x.quantity > 0);
  if (!lines.length) throw new PurchaseRoundsError("rounds_empty");
  const fobTotal = lines.every((l) => l.item.unitPrice !== null)
    ? lines.reduce((sum, l) => sum + l.item.unitPrice! * l.quantity, 0)
    : null;
  const first = lines[0];
  const pieces = lines.reduce((sum, l) => sum + l.quantity, 0);
  const actor = user?.id ?? parentRequest?.createdByUserId ?? "system";

  const backing = await store.create("requests", {
    ...REQUEST_EXTRA_DEFAULTS,
    customerId: parent.customerId,
    createdByUserId: actor,
    productId: first.item.productId,
    productName: first.item.name,
    description: `Rodada ${round.index} de ${totalRounds} do pedido de compra #${parent.number}`,
    specification: null,
    quantity: pieces,
    unit: "pcs",
    deadline: null,
    status: "ORDERED",
    orderId: null,
    sellPrice: null,
    sellCurrency: null,
    downPaymentAmount: null,
    notes: null,
    origin: "supplier_request",
    ownerUserId: parent.ownerUserId ?? null,
  });
  const child = await store.create("orders", {
    ...ORDER_EXTRA_DEFAULTS,
    number: await store.nextNumber("order_number"),
    requestId: backing.id,
    customerId: parent.customerId,
    supplierId: parent.supplierId,
    lineId: parent.lineId,
    status: "ORDER_CREATED",
    currentStageId: null,
    fobTotal,
    fobCurrency: parent.fobCurrency,
    sellPrice: null,
    sellCurrency: null,
    erpSyncStatus: "pending",
    erpNumber: null,
    agencyId: parent.agencyId,
    brokerId: parent.brokerId,
    shippingLineId: parent.shippingLineId,
    carrierId: parent.carrierId,
    comexId: parent.comexId ?? null,
    logisticsId: parent.logisticsId ?? null,
    ocpId: parent.ocpId ?? null,
    marketingAgencyId: parent.marketingAgencyId ?? null,
    designerUserId: parent.designerUserId ?? null,
    closedAt: null,
    notes: null,
    ownerUserId: parent.ownerUserId ?? null,
    flow: "supplier_request",
    supplierPaymentTerms: parent.supplierPaymentTerms ?? null,
    incoterm: parent.incoterm ?? null,
    paymentConditionId: parent.paymentConditionId ?? null,
    parentOrderId: parent.id,
    roundIndex: round.index,
  });
  await store.update("requests", backing.id, { orderId: child.id });
  for (const l of lines)
    await store.create("order_items", {
      orderId: child.id,
      productId: l.item.productId,
      name: l.item.name,
      quantity: l.quantity,
      unit: l.item.unit,
      unitPrice: l.item.unitPrice,
      ...(l.item.variantId
        ? { variantId: l.item.variantId, variant: l.item.variant ?? null }
        : {}),
      // Peças de cada cor desta rodada (gravadas no pai; nada é refeito).
      ...(l.colors?.length ? { colors: l.colors } : {}),
    });
  await audit(
    user,
    "order.create_round",
    "order",
    child.id,
    `Rodada ${round.index} de ${totalRounds} do pedido de compra #${parent.number} (programado para ${round.expectedAt}): pedido #${child.number}, ${pieces} pcs`,
  );

  // Etapas do filho com a Preparação copiada do pai: ele começa no contrato.
  const { createStagesForOrder } = await import("@/lib/workflow/engine");
  await createStagesForOrder(child, () =>
    copyPreparation(parent.id, child.id, parentItems),
  );
  const fresh = (await store.get("orders", child.id)) ?? child;

  const { notify } = await import("./notifications");
  const text = (t: Translate) => ({
    subject: t("purchaseRounds.notify.child.subject", {
      n: fresh.number,
      round: round.index,
    }),
    body: t("purchaseRounds.notify.child.body", {
      n: fresh.number,
      round: round.index,
      parent: parent.number,
    }),
  });
  for (const target of [
    { role: ["admin", "operator"] as ("admin" | "operator")[] },
    { role: "supplier" as const, partyId: parent.supplierId },
  ])
    await notify(target, {
      link: `/app/orders/${fresh.id}`,
      kind: "info",
      text,
    }).catch((error) => console.error("notify(order.round)", error));
  return fresh;
}

/** Itens da Preparação do pai, já feitos, viram feitos no filho (mesmo arquivo). */
async function copyPreparation(
  parentId: string,
  childId: string,
  parentItems: Array<{ id: string; productId: string | null }>,
): Promise<void> {
  const store = getStore();
  const [parentStages, childStages, parentReqs, childReqs, childItems] =
    await Promise.all([
      store.list("stages", { filter: { orderId: parentId } }),
      store.list("stages", { filter: { orderId: childId } }),
      store.list("requirements", { filter: { orderId: parentId } }),
      store.list("requirements", { filter: { orderId: childId } }),
      store.list("order_items", { filter: { orderId: childId } }),
    ]);
  const parentPrep = parentStages.find((s) => s.key === "PREPARATION");
  const childPrep = childStages.find((s) => s.key === "PREPARATION");
  if (!parentPrep || !childPrep) return;
  for (const req of parentReqs) {
    if (req.stageId !== parentPrep.id || req.status !== "done") continue;
    const key = mapLaneKey(req.key, parentItems, childItems);
    if (!key) continue;
    const target = childReqs.find(
      (r) => r.stageId === childPrep.id && r.key === key,
    );
    if (!target || target.status === "done") continue;
    await store.update("requirements", target.id, {
      status: "done",
      value: req.value,
      documentId: req.documentId,
      submittedByUserId: req.submittedByUserId,
      submittedAt: req.submittedAt,
      note: req.note,
    });
  }
}
