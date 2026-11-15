import "server-only";

import { can, holdersOf, type ActionKey } from "@/lib/auth/function-access";
import { canOpen } from "@/lib/auth/screens";
import {
  ForbiddenError,
  canViewOrder,
  isAdmin,
  isWellmix,
} from "@/lib/auth/permissions";
import {
  getStore,
  type DivergenceKind,
  type DivergenceLot,
  type DivergenceLotItem,
  type DivergenceLotStep,
  type Order,
  type OrderItem,
  type ReceivingItem,
  type User,
} from "@/lib/db";
import { audit } from "./audit";
import { notify, type NotifyTarget } from "./notifications";
import { loadFunctionDefs } from "./team-functions";

/*
 * Lote com divergência (mapa E21, E24 a E27; docs/RECEIVING.md). Decisões
 * do dono (15/11/2026), pelo mapa:
 *
 * - cada divergência da contagem por SKU vira um lote numerado com os itens
 *   e quantidades com problema; um pedido pode ter mais de um lote;
 * - E24: o sistema avisa Compras (Diretoria de compras e compradores) sozinho;
 * - E25: a Diretoria de compras abre a divergência com o fornecedor; a
 *   Trading (o fornecedor do pedido) responde: aceita, contesta ou repõe;
 * - E26: Compras com a Logística juntam fotos e vídeos; a Trading aprova;
 * - E27: o Financeiro (com o Agente de carga do pedido) registra a
 *   mitigação; a Trading aprova o Acordo de Divergência, que fecha o lote.
 *
 * O administrador age por todos (também pela Trading, quando ela não tem
 * login). Os passos antigos da divergência por pedido (import_steps) ficam
 * como estão nos pedidos que já os têm.
 */

export class DivergenceLotError extends Error {}

export type LotStepKey = "supplier" | "evidence" | "finance";
export const LOT_STEPS: readonly LotStepKey[] = [
  "supplier",
  "evidence",
  "finance",
];
export const SUPPLIER_CHOICES = ["accepts", "contests", "replaces"] as const;
export const FINANCE_CHOICES = [
  "discount",
  "credit",
  "penalty",
  "none",
] as const;

const field = {
  supplier: "supplierStep",
  evidence: "evidenceStep",
  finance: "financeStep",
} as const;

export const emptyStep = (): DivergenceLotStep => ({
  status: "pending",
  text: null,
  choice: null,
  amount: null,
  currency: null,
  documentIds: [],
  submittedByUserId: null,
  submittedAt: null,
  decidedByUserId: null,
  decidedAt: null,
  decisionText: null,
});

/** O que divergiu num item da contagem (função pura). */
export function kindsOf(i: ReceivingItem): DivergenceKind[] {
  const kinds: DivergenceKind[] = [];
  if (i.received < i.expected) kinds.push("shortage");
  if (i.received > i.expected) kinds.push("excess");
  if (i.damaged > 0) kinds.push("damage");
  return kinds;
}

/** E27 só abre com E25 respondido e E26 aprovado pela Trading. */
export function stepReady(lot: DivergenceLot, step: LotStepKey): boolean {
  if (lot.status !== "open") return false;
  if (step === "finance")
    return (
      lot.supplierStep.status === "approved" &&
      lot.evidenceStep.status === "approved"
    );
  return true;
}

/* ---- Quem faz cada passo ------------------------------------------------ */

async function team() {
  return getStore().list("users", {
    filter: { role: ["admin", "operator"], active: true },
  });
}

async function holders(actions: ActionKey[]) {
  const users = await team();
  const defs = await loadFunctionDefs();
  const out = new Map<string, User>();
  for (const a of actions)
    for (const u of holdersOf(users, a, defs)) out.set(u.id, u);
  return [...out.values()];
}

/** Sem ninguém com a ação, o passo fica com os administradores. */
async function targetOf(actions: ActionKey[]): Promise<NotifyTarget> {
  const list = await holders(actions);
  const ids = list.length
    ? list.map((u) => u.id)
    : (await team()).filter(isAdmin).map((u) => u.id);
  return { userIds: ids };
}

/** Compras avisada no E24: Diretoria de compras e compradores. */
const PURCHASING: ActionKey[] = [
  "approve.purchasingDirector",
  "receiving.follow",
];
/** E25: a Diretoria de compras. */
const DIRECTOR: ActionKey[] = ["approve.purchasingDirector"];
/** E26: Compras com a Logística (acompanha o recebimento ou a qualidade do CD). */
const EVIDENCE: ActionKey[] = [
  "approve.purchasingDirector",
  "receiving.follow",
  "receiving.quality",
];

function isTrading(user: User, order: Order) {
  return (
    user.role === "supplier" &&
    !!user.partyId &&
    user.partyId === order.supplierId
  );
}

function isAgent(user: User, order: Order) {
  return (
    user.role === "logistics" &&
    !!user.partyId &&
    user.partyId === order.logisticsId
  );
}

const isFinance = (user: User) =>
  isWellmix(user) &&
  (canOpen(user, "finance") || can(user, "numerario.manage"));

async function canDo(user: User, order: Order, step: LotStepKey) {
  if (isAdmin(user)) return true;
  if (step === "finance") return isFinance(user) || isAgent(user, order);
  if (!isWellmix(user)) return false;
  const list = await holders(step === "supplier" ? DIRECTOR : EVIDENCE);
  // Sem ninguém com a ação na equipe, a Wellmix faz.
  return list.length === 0 || list.some((u) => u.id === user.id);
}

const canApprove = (user: User, order: Order) =>
  isAdmin(user) || isTrading(user, order);

/* ---- Leitura ------------------------------------------------------------ */

export interface LotView {
  lot: DivergenceLot;
  order: Order;
  can: Record<LotStepKey, { submit: boolean; decide: boolean }>;
}

export async function lotsOfOrder(orderId: string) {
  return getStore()
    .list("divergence_lots", { filter: { orderId } })
    .catch(() => [] as DivergenceLot[]);
}

/** Quem vê o lote: quem vê o pedido (Wellmix, Trading, Agente de carga). */
export async function lotView(
  user: User,
  lotId: string,
): Promise<LotView | null> {
  const store = getStore();
  const lot = await store.get("divergence_lots", lotId).catch(() => null);
  if (!lot) return null;
  const order = await store.get("orders", lot.orderId);
  if (!order || !canViewOrder(user, order)) return null;
  if (!isWellmix(user) && !isTrading(user, order) && !isAgent(user, order))
    return null;
  const out = {} as LotView["can"];
  for (const step of LOT_STEPS) {
    const s = lot[field[step]];
    const ready = stepReady(lot, step);
    out[step] = {
      submit:
        ready &&
        (s.status === "pending" || s.status === "rejected") &&
        (await canDo(user, order, step)),
      decide: ready && s.status === "submitted" && canApprove(user, order),
    };
  }
  return { lot, order, can: out };
}

/** Lista de lotes (Wellmix: todos; Trading e Agente: os dos seus pedidos). */
export async function listLots(user: User) {
  const store = getStore();
  const lots = await store
    .list("divergence_lots")
    .catch(() => [] as DivergenceLot[]);
  if (!lots.length) return [];
  const ids = [...new Set(lots.map((l) => l.orderId))];
  const orders = await store.list("orders", { filter: { id: ids } });
  return lots
    .map((lot) => ({ lot, order: orders.find((o) => o.id === lot.orderId)! }))
    .filter(
      ({ order }) =>
        !!order &&
        canViewOrder(user, order) &&
        (isWellmix(user) || isTrading(user, order) || isAgent(user, order)),
    )
    .sort(
      (a, b) =>
        Number(a.lot.status === "closed") - Number(b.lot.status === "closed") ||
        b.lot.number - a.lot.number,
    );
}

/* ---- E21 + E24: o lote nasce e Compras é avisada ------------------------ */

/**
 * A contagem por SKU achou divergências novas (receiving.ts, saveCounts):
 * nasce um lote com esses itens e o sistema avisa Compras (E24 concluído);
 * a Diretoria de compras (E25) e Compras/Logística (E26) ficam com a vez.
 */
export async function createDivergenceLot(
  user: User,
  order: Order,
  rows: ReceivingItem[],
  orderItems: OrderItem[],
): Promise<DivergenceLot | null> {
  if (!rows.length) return null;
  if (order.status === "CANCELLED" || order.status === "CLOSED") return null;
  const store = getStore();
  const items: DivergenceLotItem[] = rows.map((r) => {
    const oi = orderItems.find((i) => i.id === r.orderItemId);
    return {
      orderItemId: r.orderItemId,
      productId: oi?.productId ?? null,
      name: oi?.name ?? "—",
      expected: r.expected,
      received: r.received,
      damaged: r.damaged,
      kinds: kindsOf(r),
    };
  });
  const purchasing = await targetOf(PURCHASING);
  const now = new Date().toISOString();
  const lot = await store.create("divergence_lots", {
    number: await store.nextNumber("divergence_lot_number"),
    orderId: order.id,
    items,
    status: "open",
    note: null,
    createdByUserId: user.id,
    purchasingNotifiedAt: now,
    purchasingUserIds: purchasing.userIds ?? [],
    supplierStep: emptyStep(),
    evidenceStep: emptyStep(),
    financeStep: emptyStep(),
    closedAt: null,
  });
  await audit(
    user,
    "divergence.lot_opened",
    "order",
    order.id,
    `Lote com divergência #${lot.number}: ${items.map((i) => `${i.name} ${i.received}/${i.expected}${i.damaged ? `, ${i.damaged} avariadas` : ""}`).join("; ")}. Compras avisada.`,
  );
  const link = `/app/orders/${order.id}/lots/${lot.id}`;
  // E24: Compras avisada pelo sistema.
  await notify(purchasing, {
    kind: "alert",
    link,
    text: (t) => ({
      subject: t("lot.notify.opened.subject", {
        n: String(lot.number),
        order: String(order.number),
      }),
      body: t("lot.notify.opened.body", {
        items: items.map((i) => i.name).join(", "),
      }),
    }),
  });
  // E25 e E26 ficam com a vez.
  for (const step of ["supplier", "evidence"] as const)
    await notifyDoer(order, lot, step);
  return lot;
}

async function notifyDoer(order: Order, lot: DivergenceLot, step: LotStepKey) {
  const link = `/app/orders/${order.id}/lots/${lot.id}`;
  const targets: NotifyTarget[] = [
    await targetOf(
      step === "supplier"
        ? DIRECTOR
        : step === "evidence"
          ? EVIDENCE
          : ["numerario.manage"],
    ),
  ];
  if (step === "finance" && order.logisticsId)
    targets.push({ role: "logistics", partyId: order.logisticsId });
  for (const target of targets)
    await notify(target, {
      kind: "action",
      link,
      text: (t) => ({
        subject: t("lot.notify.do.subject", {
          n: String(lot.number),
          step: t(`lot.step.${step}`),
        }),
        body: t("lot.notify.do.body"),
      }),
    });
}

async function notifyTrading(
  order: Order,
  lot: DivergenceLot,
  step: LotStepKey,
) {
  const target: NotifyTarget = order.supplierId
    ? { role: "supplier", partyId: order.supplierId }
    : { userIds: (await team()).filter(isAdmin).map((u) => u.id) };
  await notify(target, {
    kind: "action",
    link: `/app/orders/${order.id}/lots/${lot.id}`,
    text: (t) => ({
      subject: t("lot.notify.decide.subject", {
        n: String(lot.number),
        step: t(`lot.step.${step}`),
      }),
      body: t("lot.notify.decide.body"),
    }),
  });
}

/* ---- E25, E26, E27: quem faz envia; a Trading decide -------------------- */

async function openLot(user: User, lotId: string) {
  const view = await lotView(user, lotId);
  if (!view) throw new DivergenceLotError("lot_not_found");
  if (view.lot.status !== "open") throw new DivergenceLotError("lot_closed");
  return view;
}

/**
 * Quem faz envia o passo: E25 o que foi comunicado ao fornecedor; E26 o
 * texto e as fotos e vídeos (obrigatórios); E27 a mitigação (tipo, valor e
 * moeda; valor dispensado em "sem valor") e o arquivo do acordo.
 */
export async function submitLotStep(
  user: User,
  lotId: string,
  step: LotStepKey,
  input: {
    text: string | null;
    choice: string | null;
    amount: number | null;
    currency: string | null;
    documentIds: string[];
  },
) {
  const { lot, order, can: rights } = await openLot(user, lotId);
  if (!stepReady(lot, step)) throw new DivergenceLotError("lot_step_waiting");
  if (!rights[step].submit) throw new ForbiddenError();
  const text = input.text?.trim() || null;
  if (!text) throw new DivergenceLotError("lot_text_required");
  const prev = lot[field[step]];
  const documentIds = [...prev.documentIds, ...input.documentIds];
  let choice: string | null = null;
  let amount: number | null = null;
  let currency: string | null = null;
  if (step === "evidence" && !documentIds.length)
    throw new DivergenceLotError("lot_evidence_required");
  if (step === "finance") {
    if (!(FINANCE_CHOICES as readonly string[]).includes(input.choice ?? ""))
      throw new DivergenceLotError("lot_choice_required");
    choice = input.choice;
    if (choice !== "none") {
      if (!(input.amount && input.amount > 0))
        throw new DivergenceLotError("lot_amount_required");
      amount = input.amount;
      currency = input.currency || "USD";
    }
  }
  const next: DivergenceLotStep = {
    ...prev,
    status: "submitted",
    text,
    choice,
    amount,
    currency,
    documentIds,
    submittedByUserId: user.id,
    submittedAt: new Date().toISOString(),
    decidedByUserId: null,
    decidedAt: null,
    decisionText: null,
  };
  await getStore().update("divergence_lots", lot.id, { [field[step]]: next });
  await audit(
    user,
    `divergence.${step}_submitted`,
    "order",
    order.id,
    `Lote #${lot.number}, ${step}: ${text}${choice ? ` (${choice}${amount ? ` ${currency} ${amount}` : ""})` : ""}`,
  );
  await notifyTrading(order, lot, step);
}

/**
 * A Trading decide: E25 responde (aceita, contesta ou repõe, com texto) e o
 * passo fica concluído; E26 e E27 aprova ou devolve com o motivo. Aprovado o
 * E27 (Acordo de Divergência), o lote fecha.
 */
export async function decideLotStep(
  user: User,
  lotId: string,
  step: LotStepKey,
  input: { approve: boolean; choice: string | null; text: string | null },
) {
  const { lot, order, can: rights } = await openLot(user, lotId);
  if (!rights[step].decide) throw new ForbiddenError();
  const text = input.text?.trim() || null;
  const prev = lot[field[step]];
  let status: DivergenceLotStep["status"];
  let choice = prev.choice;
  if (step === "supplier") {
    if (!(SUPPLIER_CHOICES as readonly string[]).includes(input.choice ?? ""))
      throw new DivergenceLotError("lot_choice_required");
    if (!text) throw new DivergenceLotError("lot_text_required");
    choice = input.choice;
    status = "approved";
  } else if (input.approve) status = "approved";
  else {
    if (!text) throw new DivergenceLotError("lot_reason_required");
    status = "rejected";
  }
  const now = new Date().toISOString();
  const updated: DivergenceLotStep = {
    ...prev,
    status,
    choice,
    decidedByUserId: user.id,
    decidedAt: now,
    decisionText: text,
  };
  const closes = step === "finance" && status === "approved";
  const store = getStore();
  const saved = await store.update("divergence_lots", lot.id, {
    [field[step]]: updated,
    ...(closes ? { status: "closed" as const, closedAt: now } : {}),
  });
  await audit(
    user,
    `divergence.${step}_${status}`,
    "order",
    order.id,
    `Lote #${lot.number}, ${step}: ${status}${choice && step === "supplier" ? ` (${choice})` : ""}${text ? `: ${text}` : ""}`,
  );
  if (status === "rejected") await notifyDoer(order, lot, step);
  // E25 e E26 aprovados: o Financeiro (e o Agente de carga) entram.
  if (
    status === "approved" &&
    step !== "finance" &&
    stepReady(saved, "finance")
  )
    await notifyDoer(order, saved, "finance");
  if (closes) {
    const target = await targetOf(["numerario.manage", ...DIRECTOR]);
    await notify(target, {
      kind: "info",
      link: `/app/orders/${order.id}/lots/${lot.id}`,
      text: (t) => ({
        subject: t("lot.notify.closed.subject", { n: String(lot.number) }),
        body: t("lot.notify.closed.body"),
      }),
    });
  }
  return saved;
}

/* ---- Pendências --------------------------------------------------------- */

export interface LotTask {
  lot: DivergenceLot;
  order: Order;
  step: LotStepKey;
  kind: "do" | "decide";
}

/** O que cada um tem a fazer nos lotes abertos. */
export async function lotTasks(user: User): Promise<LotTask[]> {
  const out: LotTask[] = [];
  for (const { lot } of await listLots(user)) {
    if (lot.status !== "open") continue;
    const view = await lotView(user, lot.id);
    if (!view) continue;
    for (const step of LOT_STEPS) {
      if (view.can[step].submit)
        out.push({ lot, order: view.order, step, kind: "do" });
      if (view.can[step].decide)
        out.push({ lot, order: view.order, step, kind: "decide" });
    }
  }
  return out;
}
