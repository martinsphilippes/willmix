import "server-only";
import { columnsExcept, listByIds, listColumns } from "@/lib/db/lookup";

import {
  getStore,
  type ArtIssue,
  type BookingLot,
  type Certification,
  type ImportStep,
  type Order,
  type OrderItem,
  type Party,
  type Penalty,
  type Product,
  type ProductionTrack,
  type Receiving,
  type Requirement,
  type ReviewItem,
  type SkuInspection,
  type Stage,
  type StageKey,
  type SupplierRequest,
} from "@/lib/db";
import type { InstallmentStatus } from "@/lib/supplier-terms";
import { brazilDay } from "@/lib/supplier-terms";
import { reviewOrderId, type TowerRow } from "./control-tower";
import { stepTemplate } from "./import-flow";
import { JOURNEY_REQUIREMENT_KEYS, journeyIndex } from "./journey";
import { isSchemaMissing } from "@/lib/db/errors";
import { followupsDue, latestByItem } from "./production";
import { getSettings } from "@/lib/settings";
import { ORDER_SIGNED_WELLMIX } from "@/lib/workflow/stages";
import { LANE_KEYS, baseKeyOf, blockedBy, laneOf } from "@/lib/purchase-lanes";
import {
  negotiationTurn,
  supplierRequestLate,
  supplierRequestSlaDue,
} from "@/lib/supplier-requests";

/*
 * Quadros da operação na Control Tower: o processo de hoje, de ponta a ponta
 * (docs/WORKFLOW.md, "Control Tower: por etapa"):
 *
 * Booking (as planilhas) → seleção e solicitação ao fornecedor (negociação) →
 * aprovação e produto → pedido de compra → Preparação, arte e certificação
 * (três raias em paralelo) → contrato assinado pelas duas partes → produção e
 * inspeção → embarque e mar → porto e alfândega → entrega → encerrado.
 *
 * - Posição: cada lote, solicitação ou pedido em andamento cai em um quadrado
 *   só; encerrados e cancelados contam só no mês.
 * - Em paralelo: raias, produção, parcelas, documentos, numerário, canal,
 *   recebimento; o mesmo pedido pode estar em vários.
 * - Problemas.
 *
 * Pedido importado do Sankhya (sem `flow`) entra só pela etapa que a TOP
 * definiu, para dar visibilidade: sem raias, contrato, atraso nem bloqueio do
 * portal (ainda não há fluxo dele no portal).
 *
 * Só leitura: nada aqui grava. Quantidade sempre; valor e os quadrados de
 * dinheiro (parcelas, a receber) só para quem abre Finanças.
 */

export type BoardBlock =
  "booking" | "request" | "order" | "parallel" | "problem";

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
  // Booking: as planilhas dos fornecedores.
  { key: "bkDraft", block: "booking" },
  { key: "bkClosed", block: "booking" },
  { key: "bkProgress", block: "booking" },
  // Solicitação ao fornecedor: negociação até virar produto e pedido.
  { key: "srWaitingSupplier", block: "request" },
  { key: "srWaitingWellmix", block: "request" },
  { key: "srApproved", block: "request" },
  { key: "srToOrder", block: "request" },
  // Pedido: onde está agora.
  { key: "ordPrepPortal", block: "order" },
  { key: "ordPrepSankhya", block: "order" },
  { key: "ordContractWellmix", block: "order" },
  { key: "ordContractSupplier", block: "order" },
  { key: "ordContractSankhya", block: "order" },
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
  // Em paralelo: as três raias da Preparação e o que anda junto.
  { key: "lnSupplier", block: "parallel" },
  { key: "lnArt", block: "parallel" },
  { key: "lnArtReview", block: "parallel" },
  { key: "lnCert", block: "parallel" },
  { key: "parProduction", block: "parallel" },
  { key: "parProductionLate", block: "parallel" },
  { key: "parFollowupDue", block: "parallel" },
  { key: "parSkuRejected", block: "parallel" },
  { key: "parInstallmentOverdue", block: "parallel", finance: true },
  { key: "parInstallmentDueSoon", block: "parallel", finance: true },
  { key: "parInstallmentRequested", block: "parallel", finance: true },
  { key: "parArtIssue", block: "parallel" },
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
  /** Lotes, solicitações, pedidos ou certificações do quadrado (a lista de baixo). */
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

/** Etapas antes do embarque: a produção ainda conta. */
const BEFORE_SHIPPING: StageKey[] = [
  "ORDER_CREATED",
  "PREPARATION",
  "SUPPLIER_PAYMENT",
  "PACKAGING",
  "INSPECTION",
];

/** Itens das etapas que dividem os quadrados de posição (journey.ts). */
export const BOARD_REQUIREMENT_KEYS = JOURNEY_REQUIREMENT_KEYS;

/** Documentos de embarque validados por alguém (numerário tem quadrado próprio). */
const NOT_DOCUMENTS: ImportStep["key"][] = ["numerario", "numerario_paid"];
/** Passos da certificação do cartão antigo: não são "documento para validar" (a certificação é a raia da certificadora). */
const CERT_STEPS: ImportStep["key"][] = [
  "cert_memorial",
  "cert_lab",
  "cert_registration",
  "cert_seal",
  "cert_seal_art",
];
const ALERT_CHANNELS = ["yellow", "red", "grey"];

/** Pedido de compra (tem o fluxo do portal); o importado do Sankhya não tem. */
const isPortalOrder = (o: Pick<Order, "flow">) => o.flow === "supplier_request";

export interface BoardInput {
  now: Date;
  finance: boolean;
  orders: Omit<Order, "sankhyaRefs">[];
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
  /** Todos os itens dos pedidos de compra (raias e contrato). */
  laneRequirements?: Pick<
    Requirement,
    "orderId" | "stageId" | "key" | "status"
  >[];
  /** Bookings (planilhas) ainda em andamento: rascunho, fechado ou em andamento. */
  lots?: Pick<
    BookingLot,
    "id" | "number" | "status" | "supplierId" | "fileName" | "itemCount"
  >[];
  /** Solicitações ao fornecedor abertas, respondidas ou aprovadas. */
  supplierRequests?: Pick<
    SupplierRequest,
    | "id"
    | "number"
    | "status"
    | "supplierId"
    | "item"
    | "createdAt"
    | "negotiation"
    | "productId"
    | "orderId"
  >[];
  /** SLA da negociação com o fornecedor, em minutos. */
  supplierRequestSlaMinutes?: number;
  steps: ImportStep[];
  tracks: ProductionTrack[];
  skus: SkuInspection[];
  artIssues: Pick<ArtIssue, "orderId" | "status">[];
  receivings: Receiving[];
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
  const stageKeyById = new Map(input.stages.map((s) => [s.id, s.key]));
  const laneReqsBy = by(input.laneRequirements ?? []);

  // Passo do pedido: a mesma regra do Progresso de Pedidos (journey.ts).
  const journey = journeyIndex({
    ...input,
    reviews: input.reviews,
  });
  const step = (o: Order, key: ImportStep["key"]) =>
    (stepsBy.get(o.id) ?? []).find((s) => s.key === key);
  const informed = (s: ImportStep | undefined) =>
    s?.status === "submitted" || s?.status === "validated";

  // Prazo vencido e bloqueio são do fluxo do portal; o pedido importado só dá visibilidade.
  const isOverdue = (o: Order) => {
    if (!isPortalOrder(o)) return false;
    const stage = stageOf.get(o.id);
    return !!stage?.dueAt && Date.parse(stage.dueAt) < now;
  };
  const orderRow = (o: Order): TowerRow => {
    const stage = stageOf.get(o.id);
    const closed = o.status === "CLOSED";
    const cancelled = o.status === "CANCELLED";
    const portal = isPortalOrder(o);
    return {
      id: o.id,
      number: `#${o.number}`,
      customer: partyName(o.customerId),
      product: firstItem.get(o.id) ?? "—",
      stageKey: cancelled ? (o.cancelStageKey ?? null) : (o.status as StageKey),
      requestStatus: null,
      responsible:
        closed || cancelled || !portal
          ? null
          : (stage?.responsibleRole ?? null),
      dueAt: closed
        ? o.closedAt
        : cancelled
          ? (o.cancelledAt ?? null)
          : portal
            ? (stage?.dueAt ?? null)
            : null,
      overdue: !closed && !cancelled && isOverdue(o),
      blocked: !closed && !cancelled && portal && stage?.status === "blocked",
      link: `/app/orders/${o.id}`,
      kind: "order",
      cancelled,
      origin: portal ? "portal" : "sankhya",
    };
  };

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

  /* Booking: as planilhas ainda em andamento. */
  const LOT_CARD = {
    draft: "bkDraft",
    closed: "bkClosed",
    in_progress: "bkProgress",
  } as const;
  for (const lot of input.lots ?? []) {
    const key = LOT_CARD[lot.status as keyof typeof LOT_CARD];
    if (!key) continue;
    rows.get(key)!.push({
      id: lot.id,
      number: `B${lot.number}`,
      customer: partyName(lot.supplierId),
      product: `${lot.fileName} · ${lot.itemCount}`,
      stageKey: null,
      requestStatus: null,
      responsible: "operator",
      dueAt: null,
      overdue: false,
      blocked: false,
      link: `/app/booking/lots/${lot.id}`,
      kind: "booking",
      statusKey: `board.card.${key}`,
    });
  }

  /* Solicitação ao fornecedor: de quem é a vez; aprovada espera produto e pedido. */
  const slaMinutes = input.supplierRequestSlaMinutes ?? 30;
  for (const r of input.supplierRequests ?? []) {
    let key: BoardCardKey | null = null;
    if (r.status === "open" || r.status === "answered") {
      key =
        negotiationTurn(r) === "supplier"
          ? "srWaitingSupplier"
          : "srWaitingWellmix";
    } else if (r.status === "approved" && !r.orderId) {
      key = r.productId ? "srToOrder" : "srApproved";
    }
    if (!key) continue;
    const active = r.status === "open" || r.status === "answered";
    rows.get(key)!.push({
      id: r.id,
      number: `SF${r.number}`,
      customer: partyName(r.supplierId),
      product: r.item.description ?? r.item.productName ?? "—",
      stageKey: null,
      requestStatus: null,
      responsible: key === "srWaitingSupplier" ? "supplier" : "operator",
      dueAt: active ? supplierRequestSlaDue(r, slaMinutes) : null,
      overdue: active && supplierRequestLate(r, slaMinutes, input.now),
      blocked: false,
      link: `/app/supplier-requests/${r.id}`,
      kind: "supplier_request",
      statusKey: `board.card.${key}`,
    });
  }

  /* Pedido: cada pedido em andamento num quadrado só. */
  const live = input.orders.filter(
    (o) => o.status !== "CLOSED" && o.status !== "CANCELLED",
  );
  const signedByWellmix = (o: Order) =>
    (laneReqsBy.get(o.id) ?? []).some(
      (r) => r.key === ORDER_SIGNED_WELLMIX && r.status === "done",
    );
  for (const o of live) {
    const card = journey.orderCard(o);
    const portal = isPortalOrder(o);
    if (card === "ordCreated" || card === "ordPrep")
      addOrder(portal ? "ordPrepPortal" : "ordPrepSankhya", o);
    else if (card === "ordContract")
      addOrder(
        !portal
          ? "ordContractSankhya"
          : signedByWellmix(o)
            ? "ordContractSupplier"
            : "ordContractWellmix",
        o,
      );
    else addOrder(card, o);
  }
  for (const o of input.orders) {
    if (o.status === "CLOSED" && brazilDay(o.closedAt)?.slice(0, 7) === month)
      addOrder("ordClosedMonth", o);
    if (
      o.status === "CANCELLED" &&
      brazilDay(o.cancelledAt ?? null)?.slice(0, 7) === month
    )
      addOrder("ordCancelledMonth", o);
  }

  /* Em paralelo: as raias da Preparação e o que anda junto (o mesmo pedido pode estar em vários). */
  const artIssue = new Set(
    input.artIssues
      .filter((i) => i.status !== "accepted")
      .map((i) => i.orderId),
  );
  for (const o of live) {
    // Raias (pedido de compra, etapa Preparação): o que ainda falta e já está liberado.
    if (isPortalOrder(o) && o.status === "PREPARATION") {
      const mine = (laneReqsBy.get(o.id) ?? []).filter(
        (r) => stageKeyById.get(r.stageId) === "PREPARATION",
      );
      const open = mine.filter(
        (r) => r.status !== "done" && blockedBy(r.key, mine).length === 0,
      );
      const has = (pred: (base: string, lane: string) => boolean) =>
        open.some((r) => pred(baseKeyOf(r.key), laneOf(r.key)));
      if (has((_, lane) => lane === "supplier")) addOrder("lnSupplier", o);
      if (has((base) => base === LANE_KEYS.art || base === LANE_KEYS.artFinal))
        addOrder("lnArt", o);
      if (has((base) => base === LANE_KEYS.artReview))
        addOrder("lnArtReview", o);
      if (has((base) => base === LANE_KEYS.certificate)) addOrder("lnCert", o);
    }
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

  /* Problemas. */
  const rejected = new Set(input.rejected.map((r) => r.orderId));
  const penalties = new Set(input.penalties.map((p) => p.orderId));
  for (const o of live) {
    if (isOverdue(o)) addOrder("probOverdue", o);
    if (isPortalOrder(o) && stageOf.get(o.id)?.status === "blocked")
      addOrder("probBlocked", o);
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
 * (pedidos, etapas, multas, revisão) saem do cache da requisição, sem ir de
 * novo ao banco.
 */
export async function loadTowerBoard(options: {
  finance: boolean;
  now?: Date;
}): Promise<TowerBoard> {
  const store = getStore();
  const now = options.now ?? new Date();
  const [
    orders,
    items,
    activeStages,
    penalties,
    rejected,
    reviews,
    certifications,
    containers,
    lots,
    supplierRequests,
    settings,
  ] = await Promise.all([
    // Sem a cópia do registro do ERP (sankhyaRefs): com milhares de pedidos
    // do Sankhya, as linhas inteiras estouravam a memória da função.
    listColumns(store, "orders", columnsExcept("orders", ["sankhyaRefs"]), {
      orderBy: "number",
      direction: "desc",
    }),
    listColumns(store, "order_items", ["orderId", "name"]),
    store.list("stages", { filter: { status: ["active", "blocked"] } }),
    store.list("penalties", { filter: { status: ["open", "disputed"] } }),
    store.list("requirements", { filter: { status: "rejected" } }),
    store.list("review_items", {
      filter: { status: "open" },
      orderBy: "createdAt",
      direction: "desc",
    }),
    import("./compliance").then((m) => m.expiringCertifications()),
    store.list("containers"),
    safe(
      store.list("booking_lots", {
        filter: { status: ["draft", "closed", "in_progress"] },
      }),
    ),
    safe(
      store.list("supplier_requests", {
        filter: { status: ["open", "answered", "approved"] },
      }),
    ),
    getSettings(),
  ]);
  // Parceiros e produtos: só os que aparecem nos quadrados (antes: as
  // tabelas inteiras, ~32 mil parceiros e ~17 mil produtos).
  const [parties, products] = await Promise.all([
    listByIds(store, "parties", [
      ...orders.map((o) => o.customerId),
      ...lots.map((l) => l.supplierId),
      ...supplierRequests.map((r) => r.supplierId),
      ...certifications
        .filter((c) => c.entity === "party")
        .map((c) => c.entityId),
    ]),
    listByIds(
      store,
      "products",
      certifications
        .filter((c) => c.entity === "product")
        .map((c) => c.entityId),
    ),
  ]);
  const live = orders.filter(
    (o) => o.status !== "CLOSED" && o.status !== "CANCELLED",
  );
  const ids = live.map((o) => o.id);
  const portalIds = live.filter(isPortalOrder).map((o) => o.id);
  const liveIds = new Set(ids);
  const none = <T>() => Promise.resolve([] as T[]);
  const [
    stages,
    requirements,
    laneRequirements,
    steps,
    tracks,
    skus,
    artIssues,
    receivings,
    payables,
    finance,
  ] = await Promise.all([
    ids.length
      ? listColumns(store, "stages", ["orderId", "key"], {
          filter: { orderId: ids },
        })
      : none<BoardInput["stages"][number]>(),
    ids.length
      ? listColumns(
          store,
          "requirements",
          ["orderId", "stageId", "key", "status", "value"],
          { filter: { orderId: ids, key: BOARD_REQUIREMENT_KEYS } },
        )
      : none<BoardInput["requirements"][number]>(),
    portalIds.length
      ? listColumns(
          store,
          "requirements",
          ["orderId", "stageId", "key", "status"],
          { filter: { orderId: portalIds } },
        )
      : none<NonNullable<BoardInput["laneRequirements"]>[number]>(),
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
    laneRequirements,
    lots,
    supplierRequests,
    supplierRequestSlaMinutes: settings.supplierRequestSlaMinutes,
    steps,
    tracks,
    skus,
    artIssues,
    receivings,
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
