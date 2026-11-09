import "server-only";

import {
  getStore,
  type Approval,
  type ImportStep,
  type Order,
  type Quote,
  type Request,
  type Requirement,
  type ReviewItem,
  type Stage,
  type StageKey,
} from "@/lib/db";
import { brazilDay } from "@/lib/supplier-terms";
import { addBusinessDays } from "@/lib/sla";
import { getSettings } from "@/lib/settings";
import { requestStepDays } from "@/lib/request-stages";
import { reviewOrderId } from "./control-tower";
import { isSchemaMissing } from "./packaging-brief";
import { quoteSummary, requestNextStep } from "./request-list";

/*
 * Viagem do pedido: em que passo ele está, com os mesmos quadrados da
 * Control Tower (blocos 1 e 2). Uma regra só, usada pela Control Tower
 * (tower-board.ts) e pelo Progresso da lista de Pedidos, para os números
 * baterem entre as telas.
 */

/** Passos da viagem, na ordem: da solicitação nova (0%) ao encerrado (100%). */
export const JOURNEY_STEPS = [
  "reqNew",
  "reqRfq",
  "reqQuotes",
  "reqChoose",
  "reqApproval",
  "reqProposal",
  "reqDown",
  "ordConference",
  "ordSheet",
  "ordValidation",
  "ordArt",
  "ordArtApproval",
  "ordInspection",
  "ordBooking",
  "ordWaitingShip",
  "ordAtSea",
  "ordPort",
  "ordWaitingTruck",
  "ordInTransit",
  "ordDelivered",
  "ordClosed",
] as const;
export type JourneyStep = (typeof JOURNEY_STEPS)[number];

export const isJourneyStep = (v: string | undefined): v is JourneyStep =>
  !!v && (JOURNEY_STEPS as readonly string[]).includes(v);

/** Quadrado da solicitação aberta (bloco 1). */
export type RequestCard =
  | "reqNew"
  | "reqRfq"
  | "reqQuotes"
  | "reqChoose"
  | "reqApproval"
  | "reqProposal"
  | "reqDown";
/** Quadrado do pedido em andamento (bloco 2): inspeção com problema é o mesmo passo. */
export type OrderCard =
  Exclude<JourneyStep, RequestCard | "ordClosed"> | "ordInspectionIssue";

/** Percentual do passo: posição na viagem (0% a 100%). */
export const journeyPercent = (step: JourneyStep) =>
  Math.round((JOURNEY_STEPS.indexOf(step) / (JOURNEY_STEPS.length - 1)) * 100);

export const stepOfCard = (card: OrderCard | RequestCard): JourneyStep =>
  card === "ordInspectionIssue" ? "ordInspection" : card;

/** Itens das etapas que dividem os passos. */
export const JOURNEY_REQUIREMENT_KEYS = [
  "purchase_sheet",
  "art",
  "inspection_review",
  "ship_date",
  "vessel",
  "eta",
  "plate",
];

/** Passos que só acontecem com a carga no porto. */
const ARRIVAL_STEPS: ImportStep["key"][] = ["cargo_presence", "channel", "di"];

const NEXT_CARD: Partial<Record<string, RequestCard>> = {
  rfq: "reqNew",
  quotes: "reqRfq",
  choose: "reqChoose",
  approval: "reqApproval",
  proposal: "reqProposal",
  down: "reqDown",
};

export interface JourneyInput {
  now: Date;
  /** Etapa em andamento ou bloqueada de cada pedido. */
  activeStages: Pick<Stage, "orderId" | "status">[];
  /** Etapas dos pedidos (de que etapa é cada item). */
  stages: Pick<Stage, "id" | "orderId" | "key">[];
  /** Itens das etapas com as chaves de JOURNEY_REQUIREMENT_KEYS. */
  requirements: Pick<
    Requirement,
    "orderId" | "stageId" | "key" | "status" | "value"
  >[];
  steps: Pick<ImportStep, "orderId" | "key" | "status">[];
  reviews: Pick<ReviewItem, "orderId" | "entity" | "entityId" | "rule">[];
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
}

/** Regras da viagem sobre os dados lidos (função pura). */
export function journeyIndex(input: JourneyInput) {
  const today = brazilDay(input.now) ?? "";
  const blocked = new Set(
    input.activeStages
      .filter((s) => s.status === "blocked")
      .map((s) => s.orderId),
  );
  const stageKeyById = new Map(input.stages.map((s) => [s.id, s.key]));
  const by = <T extends { orderId: string | null }>(rows: T[]) => {
    const map = new Map<string, T[]>();
    for (const row of rows) {
      if (!row.orderId) continue;
      map.set(row.orderId, [...(map.get(row.orderId) ?? []), row]);
    }
    return map;
  };
  const reqsBy = by(input.requirements);
  const stepsBy = by(input.steps);
  const openInspectionReview = new Set(
    input.reviews
      .filter((r) => r.rule.startsWith("inspection."))
      .map((r) => reviewOrderId(r as ReviewItem))
      .filter((id): id is string => !!id),
  );
  const req = (orderId: string, key: string, stageKey: StageKey) =>
    (reqsBy.get(orderId) ?? []).find(
      (r) => r.key === key && stageKeyById.get(r.stageId) === stageKey,
    );
  const reqDone = (orderId: string, key: string, stageKey: StageKey) =>
    req(orderId, key, stageKey)?.status === "done";
  const informed = (orderId: string, key: ImportStep["key"]) => {
    const s = (stepsBy.get(orderId) ?? []).find((x) => x.key === key);
    return s?.status === "submitted" || s?.status === "validated";
  };

  /**
   * Quadrado do bloco 2: a etapa dividida pelo que já foi feito nela.
   * `stageKey`: a etapa olhada (a atual; no cancelado, a em que parou).
   */
  const orderCard = (
    o: Pick<Order, "id" | "status">,
    stageKey: StageKey = o.status as StageKey,
  ): OrderCard => {
    switch (stageKey) {
      case "ORDER_CREATED":
        return "ordConference";
      case "PREPARATION": {
        const sheet = req(o.id, "purchase_sheet", stageKey);
        return sheet && sheet.status !== "done" ? "ordSheet" : "ordValidation";
      }
      // Etapa antiga, fora do fluxo: o pedido segue para a Embalagem sozinho.
      case "SUPPLIER_PAYMENT":
        return "ordArt";
      case "PACKAGING": {
        const art = req(o.id, "art", stageKey);
        return art && art.status !== "done" ? "ordArt" : "ordArtApproval";
      }
      case "INSPECTION": {
        const review = req(o.id, "inspection_review", stageKey);
        return (o.status === "INSPECTION" && blocked.has(o.id)) ||
          openInspectionReview.has(o.id) ||
          (review && review.status !== "done")
          ? "ordInspectionIssue"
          : "ordInspection";
      }
      case "SHIPPING":
        return informed(o.id, "booking") ||
          reqDone(o.id, "vessel", stageKey) ||
          reqDone(o.id, "ship_date", stageKey)
          ? "ordWaitingShip"
          : "ordBooking";
      case "CUSTOMS": {
        // Chegou: o comex marcou a presença de carga (ou canal/DI), ou a
        // data prevista de chegada já passou.
        const eta = req(o.id, "eta", "SHIPPING")?.value ?? null;
        const etaDay = eta ? brazilDay(eta) : null;
        return ARRIVAL_STEPS.some((k) => informed(o.id, k)) ||
          (!!etaDay && etaDay <= today)
          ? "ordPort"
          : "ordAtSea";
      }
      case "TRANSPORT":
        return reqDone(o.id, "plate", stageKey)
          ? "ordInTransit"
          : "ordWaitingTruck";
      default:
        return "ordDelivered";
    }
  };

  /** Quadrado do bloco 1: o próximo passo da tela Solicitações. */
  const requestCard = (
    r: Pick<
      Request,
      "id" | "status" | "selectedQuoteId" | "proposalApprovedAt"
    >,
  ): RequestCard | null => {
    if (r.status === "ORDERED" || r.status === "CANCELLED") return null;
    const quotes = input.quotes.filter((q) => q.requestId === r.id);
    const summary = quoteSummary(quotes, r.selectedQuoteId);
    const next = requestNextStep({
      status: r.status,
      display: r.status,
      quotes: summary,
      approval:
        input.approvals.find(
          (a) => a.requestId === r.id && a.status === "pending",
        ) ?? null,
      proposalApproved: !!r.proposalApprovedAt,
      order: null,
      today,
    });
    // Já chegou cotação, mas ainda faltam outras dentro do prazo da RFQ:
    // "Cotações recebidas" (a comparação começa quando todas chegam ou o
    // prazo vence).
    if (next.key === "choose" && summary.answered < summary.invited) {
      const opened = quotes
        .map((q) => q.createdAt)
        .filter(Boolean)
        .sort()[0];
      const day = opened ? brazilDay(opened) : null;
      const due = day ? addBusinessDays(day, input.rfqDays) : null;
      if (due && due >= today) return "reqQuotes";
    }
    return NEXT_CARD[next.key] ?? null;
  };

  /** Passo do pedido: encerrado = 100%; cancelado = onde parou (nulo se não se sabe). */
  const orderStep = (
    o: Pick<Order, "id" | "status" | "cancelStageKey">,
  ): JourneyStep | null => {
    if (o.status === "CLOSED") return "ordClosed";
    if (o.status === "CANCELLED") {
      const at = o.cancelStageKey ?? null;
      if (!at) return null;
      return at === "CLOSED" ? "ordClosed" : stepOfCard(orderCard(o, at));
    }
    return stepOfCard(orderCard(o));
  };

  const requestStep = (
    r: Pick<
      Request,
      "id" | "status" | "selectedQuoteId" | "proposalApprovedAt"
    >,
  ): JourneyStep | null => {
    const card = requestCard(r);
    return card ? stepOfCard(card) : null;
  };

  return { orderCard, requestCard, orderStep, requestStep };
}

const safe = <T>(p: Promise<T[]>): Promise<T[]> =>
  p.catch((error) => {
    // Tabela que o esquema publicado ainda não tem: sem o dado, o passo
    // fica no primeiro da etapa.
    if (isSchemaMissing(error)) return [] as T[];
    throw error;
  });

/**
 * Lê o que a viagem precisa para os pedidos e solicitações dados. As
 * leituras iguais às da Control Tower saem do cache da requisição.
 */
export async function loadJourneyInput(
  orderIds: string[],
  requestIds: string[],
  now = new Date(),
): Promise<JourneyInput> {
  const store = getStore();
  const none = <T>() => Promise.resolve([] as T[]);
  const [
    activeStages,
    stages,
    requirements,
    steps,
    reviews,
    quotes,
    approvals,
  ] = await Promise.all([
    store.list("stages", { filter: { status: ["active", "blocked"] } }),
    orderIds.length
      ? store.list("stages", { filter: { orderId: orderIds } })
      : none<Stage>(),
    orderIds.length
      ? store.list("requirements", {
          filter: { orderId: orderIds, key: JOURNEY_REQUIREMENT_KEYS },
        })
      : none<Requirement>(),
    orderIds.length
      ? safe(store.list("import_steps", { filter: { orderId: orderIds } }))
      : none<ImportStep>(),
    store.list("review_items", {
      filter: { status: "open" },
      orderBy: "createdAt",
      direction: "desc",
    }),
    requestIds.length
      ? store.list("quotes", { filter: { requestId: requestIds } })
      : none<Quote>(),
    requestIds.length
      ? safe(store.list("approvals", { filter: { status: "pending" } }))
      : none<Approval>(),
  ]);
  return {
    now,
    activeStages,
    stages,
    requirements,
    steps,
    reviews,
    quotes,
    approvals,
    rfqDays: requestStepDays((await getSettings()).requestStepDays).rfq,
  };
}
