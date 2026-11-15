import "server-only";
import { can, canSeeMoney } from "@/lib/auth/function-access";
import {
  ForbiddenError,
  canSeeSellPrice,
  canViewOrder,
  isAdmin,
  isWellmix,
} from "@/lib/auth/permissions";
import { canOpen } from "@/lib/auth/screens";
import { getStore, type Order, type PaymentPlan, type User } from "@/lib/db";
import {
  PAYMENT_HOLD_REASON,
  blockingInstallments,
  chargesFromTitles,
  customerSchedule,
  planProblem,
  type CustomerCharge,
  type InstallmentView,
  type OrderPaymentPlan,
  type PaymentEventDates,
  type PaymentPlanInstallment,
} from "@/lib/customer-payment";
import { paymentEventsFor } from "@/lib/supplier-terms";
import { todayInBrazil } from "./supplier-terms";
import { sankhyaDate } from "@/lib/integrations/sankhya-mapping";
import {
  SankhyaError,
  executeQuery,
  type SankhyaClientOptions,
  type SankhyaRow,
} from "@/lib/integrations/sankhya-client";
import { audit } from "./audit";
import { notify, requesterTarget } from "./notifications";

/*
 * Forma de pagamento do cliente no pedido (dono, 15/11/2026;
 * docs/CUSTOMER_PAYMENT.md):
 *
 * - Formas configuráveis (`payment_plans`, Configurações → Formas de
 *   pagamento): parcelas (% + evento + dias), alçada com quem aprova e juros
 *   compostos ao mês das parcelas depois da entrega.
 * - No pedido: a Wellmix (quem grava a venda ao cliente) escolhe a forma e o
 *   vendedor; com alçada, a forma fica "em aprovação" até quem responde
 *   aprovar ou recusar.
 * - No momento de cada parcela (o evento), o financeiro é avisado para gerar
 *   o boleto no Sankhya (decisão do dono: o boleto nasce no Sankhya). O portal
 *   lê os títulos a receber do pedido de venda (TGFFIN pelo NUNOTA) e mostra
 *   ao cliente e ao vendedor: vencimento, valor, nosso número, linha
 *   digitável e a baixa. O financeiro também pode registrar o boleto à mão.
 */

/** Auditoria com os campos nomeados. */
const log = (
  user: User,
  e: { action: string; entity: string; entityId: string; summary: string },
) => audit(user, e.action, e.entity, e.entityId, e.summary);

/** As formas de partida (dono, 15/11/2026; a forma 1 era igual à 2). */
export const DEFAULT_PAYMENT_PLANS: ReadonlyArray<
  Pick<PaymentPlan, "name" | "installments" | "sortOrder">
> = [
  {
    name: "10% no pedido; 90% no embarque",
    installments: [
      { percent: 10, event: "order", days: 0 },
      { percent: 90, event: "shipment", days: 0 },
    ],
    sortOrder: 1,
  },
  {
    name: "20% no pedido; 0% no embarque; 80% na Presença de Carga",
    installments: [
      { percent: 20, event: "order", days: 0 },
      { percent: 0, event: "shipment", days: 0 },
      { percent: 80, event: "cargo_presence", days: 0 },
    ],
    sortOrder: 2,
  },
];

/** As formas, em ordem; sem nenhuma gravada, grava as de partida. */
export async function listPaymentPlans(): Promise<PaymentPlan[]> {
  const store = getStore();
  let plans = await store.list("payment_plans");
  if (!plans.length) {
    for (const p of DEFAULT_PAYMENT_PLANS)
      await store.create("payment_plans", {
        ...p,
        requiresApproval: false,
        approverUserId: null,
        monthlyInterestPercent: null,
        active: true,
        updatedByUserId: null,
      });
    plans = await store.list("payment_plans");
  }
  return plans.sort(
    (a, b) =>
      (a.sortOrder ?? 999) - (b.sortOrder ?? 999) ||
      a.name.localeCompare(b.name),
  );
}

export interface PaymentPlanInput {
  name: string;
  installments: PaymentPlanInstallment[];
  requiresApproval: boolean;
  approverUserId: string | null;
  monthlyInterestPercent: number | null;
  active: boolean;
  sortOrder: number | null;
}

/** Quem configura as formas: o administrador. */
export const canManagePaymentPlans = (user: User) => isAdmin(user);

export async function savePaymentPlan(
  user: User,
  id: string | null,
  input: PaymentPlanInput,
): Promise<PaymentPlan> {
  if (!canManagePaymentPlans(user)) throw new ForbiddenError();
  const problem = planProblem(input);
  if (problem) throw new Error(problem);
  const store = getStore();
  if (input.approverUserId) {
    const approver = await store.get("users", input.approverUserId);
    if (!approver?.active || !isWellmix(approver))
      throw new Error("plan_approver");
  }
  const data = {
    ...input,
    name: input.name.trim().slice(0, 160),
    approverUserId: input.requiresApproval ? input.approverUserId : null,
    updatedByUserId: user.id,
  };
  const saved = id
    ? await store.update("payment_plans", id, data)
    : await store.create("payment_plans", data);
  await log(user, {
    action: id ? "paymentPlan.update" : "paymentPlan.create",
    entity: "payment_plans",
    entityId: saved.id,
    summary: saved.name,
  });
  return saved;
}

/** Datas dos eventos do pedido (embarque e entrega pelos itens e marcos; Presença de Carga pelo passo). */
export async function paymentEventDates(
  order: Order,
  plan: OrderPaymentPlan | null,
): Promise<PaymentEventDates> {
  const store = getStore();
  const [milestones, requirements, steps] = await Promise.all([
    store
      .list("order_milestones", { filter: { orderId: order.id } })
      .catch(() => []),
    store.list("requirements", { filter: { orderId: order.id } }),
    store.list("import_steps", { filter: { orderId: order.id } }),
  ]);
  const base = paymentEventsFor(order, requirements, milestones);
  const cargo = steps.find(
    (s) => s.key === "cargo_presence" && s.status !== "rejected",
  );
  const cargoAt = cargo?.validatedAt ?? cargo?.submittedAt ?? null;
  // "No pedido": a forma vale (escolhida e, com alçada, aprovada).
  const planDay =
    plan && plan.status === "approved"
      ? ((plan.decidedAt ?? plan.chosenAt).slice(0, 10) as string)
      : null;
  return {
    order:
      planDay && base.order_created
        ? planDay > base.order_created
          ? planDay
          : base.order_created
        : null,
    shipment: planDay ? base.shipped : null,
    cargo_presence: planDay && cargoAt ? cargoAt.slice(0, 10) : null,
    delivery: planDay ? base.delivered : null,
  };
}

const isFinance = (user: User) =>
  isAdmin(user) || (isWellmix(user) && canOpen(user, "finance"));

export interface CustomerPaymentView {
  plan: OrderPaymentPlan | null;
  installments: InstallmentView[];
  sellTotal: number | null;
  currency: string;
  /** Pode escolher ou trocar a forma e o vendedor. */
  canChoose: boolean;
  /** Responde a alçada. */
  canDecide: boolean;
  /** Financeiro: busca os boletos no Sankhya e registra à mão. */
  canManageCharges: boolean;
  /** Cobra o cliente (vendedor, financeiro, quem grava a venda). */
  canCharge: boolean;
  sellerUserId: string | null;
}

/**
 * O que a pessoa vê do pagamento do cliente no pedido; nulo = não vê. O
 * cliente do pedido vê a forma aprovada e os boletos.
 */
export async function customerPaymentView(
  user: User,
  order: Order,
): Promise<CustomerPaymentView | null> {
  const wellmix = isWellmix(user);
  const plan = order.customerPaymentPlan ?? null;
  const seller = !!order.sellerUserId && order.sellerUserId === user.id;
  const approver = !!plan?.approverUserId && plan.approverUserId === user.id;
  const sees = wellmix
    ? canSeeMoney(user) ||
      can(user, "sale.record") ||
      isFinance(user) ||
      seller ||
      approver
    : user.role === "customer" &&
      canSeeSellPrice(user) &&
      canViewOrder(user, order) &&
      plan?.status === "approved";
  if (!sees || order.parentOrderId) return null;
  const events = plan
    ? await paymentEventDates(order, plan)
    : { order: null, shipment: null, cargo_presence: null, delivery: null };
  const live = order.status !== "CANCELLED";
  return {
    plan,
    installments: plan
      ? customerSchedule({
          installments: plan.installments,
          monthlyInterestPercent: plan.monthlyInterestPercent,
          sellTotal: order.sellPrice ?? null,
          events,
          charges: order.customerCharges ?? [],
          today: todayInBrazil(),
        })
      : [],
    sellTotal: order.sellPrice ?? null,
    currency: order.sellCurrency ?? "BRL",
    canChoose: wellmix && live && can(user, "sale.record"),
    canDecide:
      wellmix &&
      live &&
      plan?.status === "pending" &&
      (approver || isAdmin(user)),
    canManageCharges: live && isFinance(user) && plan?.status === "approved",
    canCharge:
      wellmix &&
      live &&
      plan?.status === "approved" &&
      (seller || isFinance(user) || can(user, "sale.record")),
    sellerUserId: order.sellerUserId ?? null,
  };
}

async function liveOrder(orderId: string): Promise<Order> {
  const order = await getStore().get("orders", orderId);
  if (!order) throw new Error("not_found");
  if (order.status === "CANCELLED") throw new Error("order_cancelled");
  if (order.parentOrderId) throw new Error("plan_child_order");
  return order;
}

/** Escolhe (ou troca) a forma de pagamento e o vendedor do pedido. */
export async function chooseOrderPaymentPlan(
  user: User,
  orderId: string,
  input: {
    planId: string;
    sellerUserId: string | null;
    saleNunota: string | null;
  },
): Promise<Order> {
  if (!isWellmix(user) || !can(user, "sale.record")) throw new ForbiddenError();
  const store = getStore();
  const order = await liveOrder(orderId);
  const plan = await store.get("payment_plans", input.planId);
  if (!plan || !plan.active) throw new Error("plan_unavailable");
  if (input.sellerUserId) {
    const seller = await store.get("users", input.sellerUserId);
    if (!seller?.active || !isWellmix(seller)) throw new Error("plan_seller");
  }
  const previous = order.customerPaymentPlan ?? null;
  const samePlan = previous?.planId === plan.id;
  // Com boleto já emitido, a forma não muda (o boleto é de uma parcela dela).
  if (!samePlan && (order.customerCharges ?? []).length)
    throw new Error("plan_has_charges");
  const now = new Date().toISOString();
  const next: OrderPaymentPlan = samePlan
    ? { ...previous!, saleNunota: input.saleNunota }
    : {
        planId: plan.id,
        name: plan.name,
        installments: plan.installments,
        monthlyInterestPercent: plan.monthlyInterestPercent,
        requiresApproval: plan.requiresApproval,
        approverUserId: plan.requiresApproval ? plan.approverUserId : null,
        status: plan.requiresApproval ? "pending" : "approved",
        chosenByUserId: user.id,
        chosenAt: now,
        decidedByUserId: null,
        decidedAt: null,
        decisionNote: null,
        saleNunota: input.saleNunota,
      };
  const saved = await store.update("orders", order.id, {
    customerPaymentPlan: next,
    paymentPlanStatus: next.status,
    sellerUserId: input.sellerUserId,
    ...(samePlan ? {} : { chargeNotices: null }),
  });
  await log(user, {
    action: "order.paymentPlan.choose",
    entity: "orders",
    entityId: order.id,
    summary: `${next.name} · ${next.status}`,
  });
  await applyPaymentHold(saved, user);
  if (!samePlan && next.status === "pending" && next.approverUserId)
    await notify(
      { userIds: [next.approverUserId] },
      {
        kind: "action",
        link: `/app/orders/${order.id}#customer-payment`,
        text: (t) => ({
          subject: t("customerPayment.notify.approveSubject", {
            n: order.number ?? "—",
          }),
          body: t("customerPayment.notify.approveBody", { plan: next.name }),
        }),
      },
    );
  return saved;
}

/** Alçada: quem responde aprova ou recusa a forma escolhida. */
export async function decideOrderPaymentPlan(
  user: User,
  orderId: string,
  approve: boolean,
  note: string | null,
): Promise<Order> {
  const store = getStore();
  const order = await liveOrder(orderId);
  const plan = order.customerPaymentPlan;
  if (!plan || plan.status !== "pending") throw new Error("plan_not_pending");
  if (!isWellmix(user) || !(plan.approverUserId === user.id || isAdmin(user)))
    throw new ForbiddenError();
  const next: OrderPaymentPlan = {
    ...plan,
    status: approve ? "approved" : "rejected",
    decidedByUserId: user.id,
    decidedAt: new Date().toISOString(),
    decisionNote: note,
  };
  const saved = await store.update("orders", order.id, {
    customerPaymentPlan: next,
    paymentPlanStatus: next.status,
  });
  if (approve) await applyPaymentHold(saved, user);
  await log(user, {
    action: approve ? "order.paymentPlan.approve" : "order.paymentPlan.reject",
    entity: "orders",
    entityId: order.id,
    summary: `${plan.name}${note ? ` · ${note}` : ""}`,
  });
  await notify(
    {
      userIds: [plan.chosenByUserId, order.sellerUserId ?? ""].filter(Boolean),
    },
    {
      kind: approve ? "done" : "alert",
      link: `/app/orders/${order.id}#customer-payment`,
      text: (t) => ({
        subject: t(
          approve
            ? "customerPayment.notify.approvedSubject"
            : "customerPayment.notify.rejectedSubject",
          { n: order.number ?? "—" },
        ),
        body: `${plan.name}${note ? `\n${note}` : ""}`,
      }),
    },
  );
  return saved;
}

/** Títulos a receber do pedido de venda no Sankhya (TGFFIN). */
export function titlesSql(nunota: number): string {
  if (!Number.isSafeInteger(nunota) || nunota <= 0)
    throw new Error("invalid_input");
  return `SELECT * FROM TGFFIN WHERE NUNOTA = ${nunota} AND RECDESP = 1 ORDER BY DTVENC, DESDOBRAMENTO`;
}

const textOf = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v).trim();
  return s ? s : null;
};

/** Um título do Sankhya → os dados do boleto (os nomes de coluna variam por versão). */
export function titleFromRow(
  row: SankhyaRow,
): Omit<CustomerCharge, "index" | "source" | "updatedAt"> {
  const amount = Number(String(row.VLRDESDOB ?? "").replace(",", "."));
  const paidAt = sankhyaDate(row.DHBAIXA);
  return {
    nufin: textOf(row.NUFIN),
    dueDate: sankhyaDate(row.DTVENC),
    amount: Number.isFinite(amount) && amount > 0 ? amount : null,
    nossoNumero: textOf(row.NOSSONUM),
    barcode:
      textOf(row.LINHADIGITAVEL) ??
      textOf(row.CODIGOBARRA) ??
      textOf(row.CODBARRA) ??
      null,
    documentId: null,
    status: paidAt ? "paid" : "open",
    paidAt,
  };
}

/**
 * Busca os boletos (títulos a receber) do pedido de venda no Sankhya e liga
 * às parcelas, na ordem do vencimento. O que foi registrado à mão fica (o PDF
 * também, quando o título é o mesmo).
 */
export async function syncSankhyaCharges(
  user: User,
  orderId: string,
  options: SankhyaClientOptions = {},
): Promise<{ titles: number }> {
  if (!isFinance(user)) throw new ForbiddenError();
  const order = await liveOrder(orderId);
  const plan = order.customerPaymentPlan;
  if (!plan || plan.status !== "approved") throw new Error("plan_not_approved");
  if (!saleNunotaOf(plan)) throw new Error("plan_no_nunota");
  return syncChargesFor(order, user, options);
}

/** NUNOTA da venda no Sankhya da forma escolhida (nulo sem um número válido). */
function saleNunotaOf(plan: OrderPaymentPlan): number | null {
  const n = Number(plan.saleNunota);
  return plan.saleNunota && Number.isSafeInteger(n) && n > 0 ? n : null;
}

/**
 * Lê os títulos a receber do pedido de venda no Sankhya e grava os boletos
 * nas parcelas; depois confere a trava (o boleto pago destrava o pedido).
 * `actor` nulo = o job diário.
 */
async function syncChargesFor(
  order: Order,
  actor: User | null,
  options: SankhyaClientOptions = {},
): Promise<{ titles: number }> {
  const plan = order.customerPaymentPlan!;
  const nunota = saleNunotaOf(plan)!;
  const table = await executeQuery(titlesSql(nunota), options);
  const now = new Date().toISOString();
  const fromErp = chargesFromTitles(
    plan.installments,
    table.rows.map(titleFromRow),
    now,
  );
  const previous = order.customerCharges ?? [];
  const merged: CustomerCharge[] = plan.installments
    .map((_, k) => {
      const index = k + 1;
      const erp = fromErp.find((c) => c.index === index);
      const old = previous.find((c) => c.index === index);
      if (erp)
        return {
          ...erp,
          documentId:
            old?.nufin === erp.nufin ? (old?.documentId ?? null) : null,
          chargedAt: old?.chargedAt ?? null,
        };
      return old ?? null;
    })
    .filter((c): c is CustomerCharge => !!c);
  const changed = JSON.stringify(merged) !== JSON.stringify(previous);
  const updated = changed
    ? await getStore().update("orders", order.id, { customerCharges: merged })
    : order;
  await applyPaymentHold(updated, actor);
  if (changed || actor)
    await audit(
      actor,
      "order.charges.sync",
      "orders",
      order.id,
      `NUNOTA ${nunota}: ${table.rows.length} título(s)${actor ? "" : " (busca diária)"}`,
    );
  return { titles: table.rows.length };
}

/**
 * Busca diária dos boletos (dono, 15/11/2026): para cada pedido com forma
 * aprovada e o NUNOTA da venda, lê os títulos no Sankhya, como o botão
 * "Buscar boletos no Sankhya". Pula o pedido com todas as parcelas pagas.
 * Sem o Sankhya configurado, para na primeira tentativa; o erro de um
 * pedido não impede os outros. Roda no job de lembretes.
 */
export async function syncAllSankhyaCharges(
  options: SankhyaClientOptions = {},
): Promise<{ orders: number; failed: number; skipped: string | null }> {
  const orders = await getStore().list("orders", {
    filter: { paymentPlanStatus: "approved" },
  });
  let synced = 0;
  let failed = 0;
  for (const order of orders) {
    const plan = order.customerPaymentPlan;
    if (!plan || !saleNunotaOf(plan)) continue;
    if (order.status === "CANCELLED" || order.parentOrderId || order.held)
      continue;
    const payable = plan.installments.filter((i) => i.percent > 0).length;
    const paid = (order.customerCharges ?? []).filter(
      (c) => c.status === "paid",
    ).length;
    if (payable > 0 && paid >= payable) continue;
    try {
      await syncChargesFor(order, null, options);
      synced++;
    } catch (e) {
      if (e instanceof SankhyaError && e.code === "sankhya_not_configured")
        return { orders: synced, failed, skipped: "sankhya_not_configured" };
      failed++;
      console.error("[charges] sync", order.id, e);
    }
  }
  return { orders: synced, failed, skipped: null };
}

/** O financeiro registra (ou corrige) o boleto de uma parcela à mão. */
export async function saveManualCharge(
  user: User,
  orderId: string,
  index: number,
  input: {
    dueDate: string | null;
    amount: number | null;
    nossoNumero: string | null;
    barcode: string | null;
    documentId: string | null;
    paid: boolean;
  },
): Promise<Order> {
  if (!isFinance(user)) throw new ForbiddenError();
  const order = await liveOrder(orderId);
  const plan = order.customerPaymentPlan;
  if (!plan || plan.status !== "approved") throw new Error("plan_not_approved");
  if (!Number.isInteger(index) || index < 1 || index > plan.installments.length)
    throw new Error("invalid_input");
  const previous = order.customerCharges ?? [];
  const old = previous.find((c) => c.index === index);
  const now = new Date().toISOString();
  const charge: CustomerCharge = {
    index,
    source: old?.source === "sankhya" ? "sankhya" : "manual",
    nufin: old?.nufin ?? null,
    dueDate: input.dueDate ?? old?.dueDate ?? null,
    amount: input.amount ?? old?.amount ?? null,
    nossoNumero: input.nossoNumero ?? old?.nossoNumero ?? null,
    barcode: input.barcode ?? old?.barcode ?? null,
    documentId: input.documentId ?? old?.documentId ?? null,
    status: input.paid ? "paid" : "open",
    paidAt: input.paid ? (old?.paidAt ?? now.slice(0, 10)) : null,
    updatedAt: now,
    chargedAt: old?.chargedAt ?? null,
  };
  const saved = await getStore().update("orders", order.id, {
    customerCharges: [
      ...previous.filter((c) => c.index !== index),
      charge,
    ].sort((a, b) => a.index - b.index),
  });
  await log(user, {
    action: "order.charges.manual",
    entity: "orders",
    entityId: order.id,
    summary: `Parcela ${index}${input.paid ? " · paga" : ""}`,
  });
  await applyPaymentHold(saved, user);
  return saved;
}

/** Cobra o cliente de uma parcela com boleto (aviso ao login que pediu). */
export async function chargeCustomer(
  user: User,
  orderId: string,
  index: number,
): Promise<void> {
  const order = await liveOrder(orderId);
  const view = await customerPaymentView(user, order);
  if (!view?.canCharge) throw new ForbiddenError();
  const row = view.installments.find((i) => i.index === index);
  if (!row?.charge || row.charge.status === "paid")
    throw new Error("charge_unavailable");
  if (!order.requestedByUserId) throw new Error("charge_no_customer");
  await notify(requesterTarget(order.requestedByUserId), {
    kind: "action",
    link: `/app/orders/${order.id}#customer-payment`,
    text: (t) => ({
      subject: t("customerPayment.notify.chargeSubject", {
        n: order.number ?? "—",
        i: index,
      }),
      body: t("customerPayment.notify.chargeBody", {
        due: row.dueDate ?? "—",
        barcode: row.charge?.barcode ?? "—",
      }),
    }),
  });
  const now = new Date().toISOString();
  await getStore().update("orders", order.id, {
    customerCharges: (order.customerCharges ?? []).map((c) =>
      c.index === index ? { ...c, chargedAt: now } : c,
    ),
  });
  await log(user, {
    action: "order.charges.charge",
    entity: "orders",
    entityId: order.id,
    summary: `Parcela ${index}`,
  });
}

/**
 * Chegou o momento de uma parcela (o evento aconteceu) e ainda não há
 * boleto: avisa o financeiro (gerar o boleto no Sankhya) e o vendedor, uma
 * vez por parcela. Roda no job de lembretes.
 */
export async function notifyChargesToIssue(): Promise<number> {
  const store = getStore();
  const orders = await store.list("orders", {
    filter: { paymentPlanStatus: "approved" },
  });
  const users = await store.list("users", { filter: { active: true } });
  const finance = users
    .filter((u) => isAdmin(u) || (isWellmix(u) && canOpen(u, "finance")))
    .map((u) => u.id);
  const today = todayInBrazil();
  let sent = 0;
  for (const order of orders) {
    const plan = order.customerPaymentPlan;
    if (!plan || order.status === "CANCELLED" || order.parentOrderId) continue;
    const rows = customerSchedule({
      installments: plan.installments,
      monthlyInterestPercent: plan.monthlyInterestPercent,
      sellTotal: order.sellPrice ?? null,
      events: await paymentEventDates(order, plan),
      charges: order.customerCharges ?? [],
      today,
    });
    // Parcela vencida sem pagamento trava o pedido (ou destrava, paga).
    await applyPaymentHold(order, null, rows);
    const notices = { ...(order.chargeNotices ?? {}) };
    const due = rows.filter(
      (r) => r.state === "to_issue" && !notices[String(r.index)],
    );
    if (!due.length) continue;
    for (const r of due) {
      await notify(
        {
          userIds: [...finance, order.sellerUserId ?? ""].filter(Boolean),
        },
        {
          kind: "action",
          link: `/app/orders/${order.id}#customer-payment`,
          text: (t) => ({
            subject: t("customerPayment.notify.issueSubject", {
              n: order.number ?? "—",
              i: r.index,
            }),
            body: t("customerPayment.notify.issueBody", {
              plan: plan.name,
              amount:
                r.amount === null
                  ? "—"
                  : `${order.sellCurrency ?? "BRL"} ${r.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              due: r.dueDate ?? "—",
              nunota: plan.saleNunota ?? "—",
            }),
          }),
        },
      );
      notices[String(r.index)] = new Date().toISOString();
      sent++;
    }
    await store.update("orders", order.id, { chargeNotices: notices });
  }
  return sent;
}

async function staffForHold(order: Order): Promise<string[]> {
  const users = await getStore().list("users", { filter: { active: true } });
  return [
    ...users
      .filter((u) => isAdmin(u) || (isWellmix(u) && canOpen(u, "finance")))
      .map((u) => u.id),
    order.sellerUserId ?? "",
  ].filter((id, k, all) => !!id && all.indexOf(id) === k);
}

/**
 * Parcela em aberto trava o pedido (dono, 15/11/2026): com uma parcela
 * vencida sem pagamento (e não liberada pelo administrador), o pedido pausa
 * com o motivo `payment_open` — nada anda até o administrador retomar
 * (`resumeOrder`, que libera as parcelas que travavam) ou o pagamento entrar
 * (a trava sai sozinha). Pedido já pausado por outro motivo fica como está.
 */
export async function applyPaymentHold(
  order: Order,
  actor: User | null,
  rows?: InstallmentView[],
): Promise<"held" | "released" | "none"> {
  const plan = order.customerPaymentPlan;
  if (!plan || plan.status !== "approved") return "none";
  if (order.status === "CANCELLED" || order.parentOrderId || order.held)
    return "none";
  const today = todayInBrazil();
  const schedule =
    rows ??
    customerSchedule({
      installments: plan.installments,
      monthlyInterestPercent: plan.monthlyInterestPercent,
      sellTotal: order.sellPrice ?? null,
      events: await paymentEventDates(order, plan),
      charges: order.customerCharges ?? [],
      today,
    });
  const blocking = blockingInstallments(schedule, plan.releases, today);
  const store = getStore();
  if (blocking.length && !order.pausedAt) {
    await store.update("orders", order.id, {
      pausedAt: new Date().toISOString(),
      pauseReason: PAYMENT_HOLD_REASON,
    });
    await audit(
      actor,
      "order.paused",
      "order",
      order.id,
      `Pedido #${order.number} travado: parcela(s) ${blocking.map((r) => r.index).join(", ")} em aberto`,
    );
    await notify(
      { userIds: await staffForHold(order) },
      {
        kind: "alert",
        actor: "recipient",
        link: `/app/orders/${order.id}#customer-payment`,
        text: (t) => ({
          subject: t("customerPayment.notify.holdSubject", {
            n: order.number ?? "—",
          }),
          body: t("customerPayment.notify.holdBody", {
            list: blocking.map((r) => r.index).join(", "),
          }),
        }),
      },
    );
    return "held";
  }
  if (!blocking.length && order.pauseReason === PAYMENT_HOLD_REASON) {
    await store.update("orders", order.id, {
      pausedAt: null,
      pauseReason: null,
    });
    await audit(
      actor,
      "order.resumed",
      "order",
      order.id,
      `Pedido #${order.number} destravado: parcelas pagas`,
    );
    return "released";
  }
  return "none";
}

/**
 * O administrador retoma o pedido travado por parcela em aberto: as parcelas
 * que travavam ficam liberadas (não travam de novo). Chamado por
 * `resumeOrder` antes de tirar a pausa.
 */
export async function releasePaymentHold(
  user: User,
  order: Order,
  note: string | null,
): Promise<void> {
  if (!isAdmin(user)) throw new ForbiddenError();
  const plan = order.customerPaymentPlan;
  if (!plan || plan.status !== "approved") return;
  const today = todayInBrazil();
  const rows = customerSchedule({
    installments: plan.installments,
    monthlyInterestPercent: plan.monthlyInterestPercent,
    sellTotal: order.sellPrice ?? null,
    events: await paymentEventDates(order, plan),
    charges: order.customerCharges ?? [],
    today,
  });
  const blocking = blockingInstallments(rows, plan.releases, today);
  if (!blocking.length) return;
  const at = new Date().toISOString();
  const releases = { ...(plan.releases ?? {}) };
  for (const r of blocking)
    releases[String(r.index)] = { byUserId: user.id, at, note };
  await getStore().update("orders", order.id, {
    customerPaymentPlan: { ...plan, releases },
  });
  await log(user, {
    action: "order.paymentHold.release",
    entity: "orders",
    entityId: order.id,
    summary: `Parcela(s) ${blocking.map((r) => r.index).join(", ")} liberada(s)${note ? `: ${note}` : ""}`,
  });
}
