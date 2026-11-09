import "server-only";

import {
  getStore,
  type Approval,
  type ArtIssue,
  type Certification,
  type ImportStep,
  type Order,
  type OrderItem,
  type Party,
  type Penalty,
  type Product,
  type ProductionTrack,
  type PurchaseSheet,
  type Quote,
  type Receiving,
  type Request,
  type Requirement,
  type ReviewItem,
  type SkuInspection,
  type Stage,
  type StageKey,
} from "@/lib/db";
import type { InstallmentStatus } from "@/lib/supplier-terms";
import { brazilDay } from "@/lib/supplier-terms";
import { reviewOrderId, type TowerRow } from "./control-tower";
import { importStepDone, stepTemplate } from "./import-flow";
import { JOURNEY_REQUIREMENT_KEYS, journeyIndex } from "./journey";
import { isSchemaMissing } from "./packaging-brief";
import { followupsDue, latestByItem } from "./production";
import { getSettings } from "@/lib/settings";
import { requestStepDays } from "@/lib/request-stages";

/*
 * Quadros da operação na Control Tower: o pedido de ponta a ponta, em quatro
 * blocos escolhidos pelo dono (docs/WORKFLOW.md, "Control Tower: quadros da
 * operação").
 *
 * 1. Antes de virar pedido: a solicitação, pelo mesmo "próximo passo" da
 *    tela Solicitações.
 * 2. Onde o pedido está agora: cada pedido em andamento cai em um quadrado
 *    só (a etapa, dividida pelo que já foi feito dentro dela); encerrados e
 *    cancelados contam só no mês.
 * 3. Acontece ao mesmo tempo: produção, parcelas, arte, certificação,
 *    documentos, numerário, canal, recebimento; o mesmo pedido pode estar em
 *    vários.
 * 4. Problemas.
 *
 * Só leitura: nada aqui grava. Quantidade sempre; valor e os quadrados de
 * dinheiro (parcelas, a receber) só para quem abre Finanças.
 */

export type BoardBlock = "request" | "order" | "parallel" | "problem";

interface CardDef {
  key: string;
  block: BoardBlock;
  /** Só para quem abre Finanças. */
  finance?: boolean;
  /** Leva a outra tela (não filtra a lista de baixo). */
  href?: string;
}

/** Quadrados na ordem da tela. */
export const BOARD_CARDS = [
  { key: "reqNew", block: "request" },
  { key: "reqRfq", block: "request" },
  { key: "reqQuotes", block: "request" },
  { key: "reqChoose", block: "request" },
  { key: "reqApproval", block: "request" },
  { key: "reqProposal", block: "request" },
  { key: "reqDown", block: "request" },
  // Correm ao lado (a mesma solicitação também está num dos de cima).
  { key: "reqDieline", block: "request" },
  { key: "reqPackaging", block: "request" },
  { key: "ordConference", block: "order" },
  { key: "ordSheet", block: "order" },
  { key: "ordValidation", block: "order" },
  { key: "ordArt", block: "order" },
  { key: "ordArtApproval", block: "order" },
  { key: "ordInspection", block: "order" },
  { key: "ordInspectionIssue", block: "order" },
  { key: "ordBooking", block: "order" },
  { key: "ordWaitingShip", block: "order" },
  { key: "ordAtSea", block: "order" },
  { key: "ordPort", block: "order" },
  { key: "ordWaitingTruck", block: "order" },
  { key: "ordInTransit", block: "order" },
  { key: "ordDelivered", block: "order" },
  { key: "ordClosedMonth", block: "order" },
  { key: "ordCancelledMonth", block: "order" },
  { key: "parProduction", block: "parallel" },
  { key: "parProductionLate", block: "parallel" },
  { key: "parFollowupDue", block: "parallel" },
  { key: "parSkuRejected", block: "parallel" },
  { key: "parInstallmentOverdue", block: "parallel", finance: true },
  { key: "parInstallmentDueSoon", block: "parallel", finance: true },
  { key: "parInstallmentRequested", block: "parallel", finance: true },
  { key: "parArtIssue", block: "parallel" },
  { key: "parCertification", block: "parallel" },
  { key: "parDocsToValidate", block: "parallel" },
  { key: "parNumerario", block: "parallel" },
  { key: "parChannel", block: "parallel" },
  { key: "parReceiving", block: "parallel" },
  { key: "parReceivingDiff", block: "parallel" },
  { key: "parContainerReturn", block: "parallel" },
  { key: "parReceivable", block: "parallel", finance: true },
  { key: "parContainers", block: "parallel", href: "/app/containers" },
  { key: "probOverdue", block: "problem" },
  { key: "probBlocked", block: "problem" },
  { key: "probDocRejected", block: "problem" },
  { key: "probErp", block: "problem" },
  { key: "probPenalty", block: "problem" },
  { key: "probReviews", block: "problem", href: "/app/reviews" },
  { key: "probCertExpiring", block: "problem" },
  { key: "probCancelRequest", block: "problem" },
] as const satisfies readonly CardDef[];

export type BoardCardKey = (typeof BOARD_CARDS)[number]["key"];

export const isBoardCardKey = (key: string | undefined): key is BoardCardKey =>
  !!key && BOARD_CARDS.some((c) => c.key === key);

export interface BoardCard {
  key: BoardCardKey;
  block: BoardBlock;
  /** Quadrado que leva a outra tela (containers, revisão). */
  href: string | null;
  /** Pedidos, solicitações ou certificações do quadrado (a lista de baixo). */
  rows: TowerRow[];
  count: number;
  /** Quantos do quadrado estão com o prazo vencido. */
  overdue: number;
  /** Valor de venda somado (a receber, no quadrado "A receber"); nulo sem Finanças. */
  value: number | null;
}

export interface TowerBoard {
  cards: BoardCard[];
  /** Moeda dos valores (a de venda principal). */
  currency: string;
}

/** Situações da solicitação ainda aberta (as mesmas da Control Tower). */
const OPEN_REQUESTS: Request["status"][] = [
  "REQUESTED",
  "RFQ_OPEN",
  "QUOTATION_RECEIVED",
  "SUPPLIER_SELECTED",
  "WAITING_DOWN_PAYMENT",
];

/** Etapas antes do embarque: a produção ainda conta. */
const BEFORE_SHIPPING: StageKey[] = [
  "ORDER_CREATED",
  "PREPARATION",
  "SUPPLIER_PAYMENT",
  "PACKAGING",
  "INSPECTION",
];

/** Itens das etapas que dividem os quadrados do bloco 2 (journey.ts). */
export const BOARD_REQUIREMENT_KEYS = JOURNEY_REQUIREMENT_KEYS;

/** Documentos de embarque validados por alguém (numerário tem quadrado próprio). */
const NOT_DOCUMENTS: ImportStep["key"][] = ["numerario", "numerario_paid"];
const CERT_STEPS: ImportStep["key"][] = [
  "cert_memorial",
  "cert_lab",
  "cert_registration",
];
const ALERT_CHANNELS = ["yellow", "red", "grey"];

export interface BoardInput {
  now: Date;
  finance: boolean;
  orders: Order[];
  parties: Pick<Party, "id" | "name">[];
  items: Pick<OrderItem, "orderId" | "name">[];
  products: Pick<Product, "id" | "name">[];
  /** Etapa em andamento ou bloqueada de cada pedido. */
  activeStages: Stage[];
  /** Todas as etapas dos pedidos em andamento (para achar o Embarque). */
  stages: Pick<Stage, "id" | "orderId" | "key">[];
  /** Itens das etapas com as chaves de BOARD_REQUIREMENT_KEYS. */
  requirements: Pick<
    Requirement,
    "orderId" | "stageId" | "key" | "status" | "value"
  >[];
  requests: Request[];
  quotes: Pick<
    Quote,
    | "id"
    | "requestId"
    | "status"
    | "price"
    | "currency"
    | "leadTimeDays"
    | "answeredAt"
    | "createdAt"
  >[];
  approvals: Pick<Approval, "requestId" | "status" | "currentLevel">[];
  /** Prazo da RFQ em dias úteis (Configurações → requestStepDays.rfq). */
  rfqDays: number;
  /** Briefings de embalagem abertos (ainda sendo feitos). */
  briefRequestIds: string[];
  /** Solicitações cuja faca (die-cut) obrigatória ainda não chegou. */
  dielineRequestIds?: string[];
  steps: ImportStep[];
  tracks: ProductionTrack[];
  skus: SkuInspection[];
  artIssues: Pick<ArtIssue, "orderId" | "status">[];
  receivings: Receiving[];
  /** Pedidos cuja ficha pede certificação. */
  certificationOrderIds: string[];
  penalties: Pick<Penalty, "orderId">[];
  rejected: Pick<Requirement, "orderId">[];
  reviews: ReviewItem[];
  certifications: Certification[];
  containers: { open: number };
  /** Parcelas ao fornecedor (só com Finanças). */
  installments: { orderId: string; status: InstallmentStatus }[];
  /** Valor de venda e saldo a receber por pedido (só com Finanças). */
  money: Map<string, { sell: number; currency: string; receivable: number }>;
  currency: string;
}

/** Monta os quadrados (função pura; `loadTowerBoard` busca os dados). */
export function buildTowerBoard(input: BoardInput): TowerBoard {
  const now = input.now.getTime();
  const today = brazilDay(input.now) ?? "";
  const month = today.slice(0, 7);
  const parties = new Map(input.parties.map((p) => [p.id, p.name]));
  const partyName = (id: string | null | undefined) =>
    (id && parties.get(id)) || "—";
  const firstItem = new Map<string, string>();
  for (const i of input.items)
    if (!firstItem.has(i.orderId)) firstItem.set(i.orderId, i.name);
  const stageOf = new Map(input.activeStages.map((s) => [s.orderId, s]));
  const by = <T extends { orderId: string | null }>(rows: T[]) => {
    const map = new Map<string, T[]>();
    for (const row of rows) {
      if (!row.orderId) continue;
      map.set(row.orderId, [...(map.get(row.orderId) ?? []), row]);
    }
    return map;
  };
  const stepsBy = by(input.steps);
  const skusBy = by(input.skus);
  const trackOf = new Map(input.tracks.map((t) => [t.orderId, t]));
  const receivingOf = new Map(input.receivings.map((r) => [r.orderId, r]));

  // Passo da viagem (blocos 1 e 2): a mesma regra do Progresso de Pedidos.
  const journey = journeyIndex(input);
  const step = (o: Order, key: ImportStep["key"]) =>
    (stepsBy.get(o.id) ?? []).find((s) => s.key === key);
  const informed = (s: ImportStep | undefined) =>
    s?.status === "submitted" || s?.status === "validated";

  const isOverdue = (o: Order) => {
    const stage = stageOf.get(o.id);
    return !!stage?.dueAt && Date.parse(stage.dueAt) < now;
  };
  const orderRow = (o: Order): TowerRow => {
    const stage = stageOf.get(o.id);
    const closed = o.status === "CLOSED";
    const cancelled = o.status === "CANCELLED";
    return {
      id: o.id,
      number: `#${o.number}`,
      customer: partyName(o.customerId),
      product: firstItem.get(o.id) ?? "—",
      stageKey: cancelled ? (o.cancelStageKey ?? null) : (o.status as StageKey),
      requestStatus: null,
      responsible:
        closed || cancelled ? null : (stage?.responsibleRole ?? null),
      dueAt: closed
        ? o.closedAt
        : cancelled
          ? (o.cancelledAt ?? null)
          : (stage?.dueAt ?? null),
      overdue: !closed && !cancelled && isOverdue(o),
      blocked: !closed && !cancelled && stage?.status === "blocked",
      link: `/app/orders/${o.id}`,
      kind: "order",
      cancelled,
    };
  };
  const requestRow = (r: Request): TowerRow => ({
    id: r.id,
    number: "S",
    customer: partyName(r.customerId),
    product: r.productName,
    stageKey: null,
    requestStatus: r.status,
    responsible:
      r.status === "RFQ_OPEN"
        ? "supplier"
        : r.status === "WAITING_DOWN_PAYMENT"
          ? "customer"
          : "operator",
    dueAt: r.deadline,
    overdue: !!r.deadline && r.deadline.slice(0, 10) < today,
    blocked: false,
    link: `/app/requests/${r.id}`,
    kind: "request",
  });

  const rows = new Map<BoardCardKey, TowerRow[]>(
    BOARD_CARDS.map((c) => [c.key, []]),
  );
  const values = new Map<BoardCardKey, number>();
  const sellOf = (o: Order) => {
    const m = input.money.get(o.id);
    return m && m.currency === input.currency ? m.sell : 0;
  };
  const addOrder = (key: BoardCardKey, o: Order, value = sellOf(o)) => {
    rows.get(key)!.push(orderRow(o));
    values.set(key, (values.get(key) ?? 0) + value);
  };

  /* Bloco 1: a solicitação, pelo próximo passo da tela Solicitações. */
  const openRequests = input.requests.filter((r) =>
    OPEN_REQUESTS.includes(r.status),
  );
  for (const r of openRequests) {
    const key = journey.requestCard(r);
    if (!key) continue;
    rows.get(key)!.push(requestRow(r));
    if (r.sellPrice !== null && r.sellCurrency === input.currency)
      values.set(key, (values.get(key) ?? 0) + r.sellPrice);
  }
  const briefs = new Set(input.briefRequestIds);
  for (const r of openRequests)
    if (briefs.has(r.id)) rows.get("reqPackaging")!.push(requestRow(r));
  // Faca (die-cut): depois da escolha, o fornecedor escolhido envia.
  const dielines = new Set(input.dielineRequestIds ?? []);
  for (const r of openRequests)
    if (r.selectedQuoteId && dielines.has(r.id))
      rows.get("reqDieline")!.push(requestRow(r));

  /* Bloco 2: cada pedido em andamento num quadrado só. */
  const live = input.orders.filter(
    (o) => o.status !== "CLOSED" && o.status !== "CANCELLED",
  );
  for (const o of live) addOrder(journey.orderCard(o), o);
  for (const o of input.orders) {
    if (o.status === "CLOSED" && brazilDay(o.closedAt)?.slice(0, 7) === month)
      addOrder("ordClosedMonth", o);
    if (
      o.status === "CANCELLED" &&
      brazilDay(o.cancelledAt ?? null)?.slice(0, 7) === month
    )
      addOrder("ordCancelledMonth", o);
  }

  /* Bloco 3: o que anda junto (o mesmo pedido pode estar em vários). */
  const certSheet = new Set(input.certificationOrderIds);
  const artIssue = new Set(
    input.artIssues
      .filter((i) => i.status !== "accepted")
      .map((i) => i.orderId),
  );
  for (const o of live) {
    const track = trackOf.get(o.id) ?? null;
    const preShipping = BEFORE_SHIPPING.includes(o.status as StageKey);
    if (preShipping && track?.productionStartAt) {
      addOrder("parProduction", o);
      const last = [...(track.followups ?? [])].sort(
        (a, b) => b.day - a.day,
      )[0];
      const etd = brazilDay(track.etd);
      if (last?.status === "delayed" || (!!etd && etd < today))
        addOrder("parProductionLate", o);
      if (followupsDue(track, input.now).length) addOrder("parFollowupDue", o);
    }
    const skus = [...latestByItem(skusBy.get(o.id) ?? []).values()];
    if (skus.some((s) => s.result === "rejected"))
      addOrder("parSkuRejected", o);
    if (artIssue.has(o.id)) addOrder("parArtIssue", o);
    const certs = CERT_STEPS.map((k) => step(o, k));
    const withCert = !!o.ocpId || certSheet.has(o.id) || certs.some((s) => !!s);
    if (withCert && certs.some((s) => !s || !importStepDone(s)))
      addOrder("parCertification", o);
    if (
      (stepsBy.get(o.id) ?? []).some(
        (s) =>
          s.status === "submitted" &&
          !NOT_DOCUMENTS.includes(s.key) &&
          !CERT_STEPS.includes(s.key) &&
          !!stepTemplate(s.key)?.validator,
      )
    )
      addOrder("parDocsToValidate", o);
    if (informed(step(o, "numerario")) && !informed(step(o, "numerario_paid")))
      addOrder("parNumerario", o);
    if (
      o.status === "CUSTOMS" &&
      ALERT_CHANNELS.includes(step(o, "channel")?.value ?? "")
    )
      addOrder("parChannel", o);
    const rec = receivingOf.get(o.id);
    if (rec && !rec.closedAt) {
      addOrder("parReceiving", o);
      if (
        (rec.items ?? []).some(
          (i) => i.received !== i.expected || i.damaged > 0,
        )
      )
        addOrder("parReceivingDiff", o);
    }
    const unloaded =
      !!rec &&
      (!!rec.sealNumber ||
        (rec.checklist ?? []).length > 0 ||
        (rec.items ?? []).length > 0);
    if (unloaded && !rec.containerReturnedAt) addOrder("parContainerReturn", o);
  }
  if (input.finance) {
    const ordersById = new Map(input.orders.map((o) => [o.id, o]));
    const INSTALLMENT_CARD: Partial<Record<InstallmentStatus, BoardCardKey>> = {
      overdue: "parInstallmentOverdue",
      due_soon: "parInstallmentDueSoon",
      requested: "parInstallmentRequested",
    };
    for (const [status, key] of Object.entries(INSTALLMENT_CARD)) {
      const ids = new Set(
        input.installments
          .filter((i) => i.status === status)
          .map((i) => i.orderId),
      );
      for (const id of ids) {
        const o = ordersById.get(id);
        // Parcela é do lado do fornecedor (outra moeda): sem o valor de venda.
        if (o && o.status !== "CANCELLED") addOrder(key!, o, 0);
      }
    }
    for (const o of input.orders) {
      const m = input.money.get(o.id);
      if (o.status !== "CANCELLED" && m && m.receivable > 0.005)
        addOrder(
          "parReceivable",
          o,
          m.currency === input.currency ? m.receivable : 0,
        );
    }
  }

  /* Bloco 4: problemas. */
  const rejected = new Set(input.rejected.map((r) => r.orderId));
  const penalties = new Set(input.penalties.map((p) => p.orderId));
  for (const o of live) {
    if (isOverdue(o)) addOrder("probOverdue", o);
    if (stageOf.get(o.id)?.status === "blocked") addOrder("probBlocked", o);
    if (
      rejected.has(o.id) ||
      (stepsBy.get(o.id) ?? []).some((s) => s.status === "rejected")
    )
      addOrder("probDocRejected", o);
    if (o.erpSyncStatus === "pending") addOrder("probErp", o);
    if (o.cancelRequestStatus === "requested") addOrder("probCancelRequest", o);
  }
  for (const o of input.orders)
    if (penalties.has(o.id) && o.status !== "CANCELLED")
      addOrder("probPenalty", o);
  const products = new Map(input.products.map((p) => [p.id, p]));
  for (const c of input.certifications) {
    const product = c.entity === "product" ? products.get(c.entityId) : null;
    rows.get("probCertExpiring")!.push({
      id: c.id,
      number: c.kind,
      customer: c.entity === "party" ? partyName(c.entityId) : "—",
      product: product?.name ?? "—",
      stageKey: null,
      requestStatus: null,
      responsible: null,
      dueAt: c.validUntil,
      overdue: !!c.validUntil && Date.parse(c.validUntil) < now,
      blocked: false,
      link: product
        ? `/app/products/${product.id}`
        : `/app/parties/${c.entityId}`,
      kind: "cert",
    });
  }
  const cancelled = new Set(
    input.orders.filter((o) => o.status === "CANCELLED").map((o) => o.id),
  );
  const reviewsOpen = input.reviews.filter(
    (r) => !cancelled.has(reviewOrderId(r) ?? ""),
  ).length;

  const cards = BOARD_CARDS.filter(
    (c) => input.finance || !("finance" in c && c.finance),
  ).map((c): BoardCard => {
    const list = rows.get(c.key)!;
    const href = "href" in c ? c.href : null;
    const count =
      c.key === "parContainers"
        ? input.containers.open
        : c.key === "probReviews"
          ? reviewsOpen
          : list.length;
    const value = values.get(c.key);
    return {
      key: c.key,
      block: c.block,
      href,
      rows: list,
      count,
      overdue: list.filter((r) => r.overdue).length,
      value:
        input.finance && value !== undefined && value > 0.005 ? value : null,
    };
  });
  return { cards, currency: input.currency };
}

const safe = <T>(p: Promise<T[]>): Promise<T[]> =>
  p.catch((error) => {
    // Tabela que o esquema publicado ainda não tem: o quadrado fica vazio.
    if (isSchemaMissing(error)) return [] as T[];
    throw error;
  });

/**
 * Lê o que os quadrados precisam. As leituras iguais às da Control Tower
 * (pedidos, etapas, solicitações, multas, revisão) saem do cache da
 * requisição, sem ir de novo ao banco.
 */
export async function loadTowerBoard(options: {
  finance: boolean;
  now?: Date;
}): Promise<TowerBoard> {
  const store = getStore();
  const now = options.now ?? new Date();
  const [
    orders,
    parties,
    items,
    products,
    activeStages,
    requests,
    approvals,
    briefs,
    penalties,
    rejected,
    reviews,
    certifications,
    containers,
  ] = await Promise.all([
    store.list("orders", { orderBy: "number", direction: "desc" }),
    store.list("parties"),
    store.list("order_items"),
    store.list("products"),
    store.list("stages", { filter: { status: ["active", "blocked"] } }),
    store.list("requests", { filter: { status: OPEN_REQUESTS } }),
    safe(store.list("approvals", { filter: { status: "pending" } })),
    safe(store.list("packaging_briefs", { filter: { status: "open" } })),
    store.list("penalties", { filter: { status: ["open", "disputed"] } }),
    store.list("requirements", { filter: { status: "rejected" } }),
    store.list("review_items", {
      filter: { status: "open" },
      orderBy: "createdAt",
      direction: "desc",
    }),
    import("./compliance").then((m) => m.expiringCertifications()),
    store.list("containers"),
  ]);
  const live = orders.filter(
    (o) => o.status !== "CLOSED" && o.status !== "CANCELLED",
  );
  const ids = live.map((o) => o.id);
  const liveIds = new Set(ids);
  const requestIds = requests.map((r) => r.id);
  const none = <T>() => Promise.resolve([] as T[]);
  const [
    stages,
    requirements,
    steps,
    tracks,
    skus,
    artIssues,
    receivings,
    sheets,
    quotes,
    payables,
    finance,
  ] = await Promise.all([
    ids.length
      ? store.list("stages", { filter: { orderId: ids } })
      : none<Stage>(),
    ids.length
      ? store.list("requirements", {
          filter: { orderId: ids, key: BOARD_REQUIREMENT_KEYS },
        })
      : none<Requirement>(),
    ids.length
      ? safe(store.list("import_steps", { filter: { orderId: ids } }))
      : none<ImportStep>(),
    ids.length
      ? safe(store.list("production_tracks", { filter: { orderId: ids } }))
      : none<ProductionTrack>(),
    ids.length
      ? safe(store.list("sku_inspections", { filter: { orderId: ids } }))
      : none<SkuInspection>(),
    ids.length
      ? safe(
          store.list("art_issues", {
            filter: { orderId: ids, status: ["open", "fixed"] },
          }),
        )
      : none<ArtIssue>(),
    ids.length
      ? safe(store.list("receivings", { filter: { orderId: ids } }))
      : none<Receiving>(),
    ids.length
      ? safe(store.list("purchase_sheets", { filter: { orderId: ids } }))
      : none<PurchaseSheet>(),
    requestIds.length
      ? store.list("quotes", { filter: { requestId: requestIds } })
      : none<Quote>(),
    options.finance
      ? import("./supplier-terms").then((m) => m.listPayables())
      : Promise.resolve([]),
    options.finance
      ? import("./finance").then((m) => m.loadFinance({ estimate: false }))
      : Promise.resolve(null),
  ]);
  const money = new Map(
    (finance?.rows ?? []).map((r) => [
      r.order.id,
      { sell: r.sell, currency: r.sellCurrency, receivable: r.receivable },
    ]),
  );
  return buildTowerBoard({
    now,
    finance: options.finance,
    orders,
    parties,
    items,
    products,
    activeStages,
    stages,
    requirements,
    requests,
    quotes,
    approvals,
    rfqDays: requestStepDays((await getSettings()).requestStepDays).rfq,
    briefRequestIds: briefs.map((b) => b.requestId),
    // Faca obrigatória ainda não enviada (o fornecedor escolhido manda).
    dielineRequestIds: briefs
      .filter((b) => b.requiredKeys.includes("dieline") && !b.dielineDocumentId)
      .map((b) => b.requestId),
    steps,
    tracks,
    skus,
    artIssues,
    receivings,
    certificationOrderIds: sheets
      .filter((s) => s.certificationRequired === "yes")
      .map((s) => s.orderId),
    penalties,
    rejected: rejected.filter((r) => liveIds.has(r.orderId)),
    reviews,
    certifications,
    containers: {
      open: containers.filter((c) => c.status !== "closed").length,
    },
    installments: payables.flatMap((p) =>
      p.schedule.installments.map((i) => ({
        orderId: p.order.id,
        status: i.status,
      })),
    ),
    money,
    currency: finance?.summary.currency ?? "BRL",
  });
}
