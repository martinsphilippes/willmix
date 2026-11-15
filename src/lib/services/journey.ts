import "server-only";
import { listColumns } from "@/lib/db/lookup";

import {
  getStore,
  type ImportStep,
  type Order,
  type Request,
  type Requirement,
  type ReviewItem,
  type StageKey,
} from "@/lib/db";
import { stepOfItem, type MilestoneKey } from "@/lib/milestones";
import { brazilDay } from "@/lib/supplier-terms";
import { reviewOrderId } from "./control-tower";
import { isSchemaMissing } from "@/lib/db/errors";

/*
 * Viagem do pedido: em que passo ele está, com os mesmos quadrados da
 * Control Tower (blocos 1 e 2). Uma regra só, usada pela Control Tower
 * (tower-board.ts) e pelo Progresso da lista de Pedidos, para os números
 * baterem entre as telas.
 */

/** Passos da viagem, na ordem: da solicitação nova (0%) ao encerrado (100%). */
export const JOURNEY_STEPS = [
  "reqNew",
  "ordCreated",
  "ordPrep",
  "ordContract",
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

/**
 * Quadrado da solicitação aberta (bloco 1). A RFQ, a cotação e o sinal do
 * cliente saíram em 11/11/2026: a solicitação aberta é só "nova".
 */
export type RequestCard = "reqNew";
/** Quadrado do pedido em andamento (bloco 2): inspeção com problema é o mesmo passo. */
export type OrderCard =
  Exclude<JourneyStep, RequestCard | "ordClosed"> | "ordInspectionIssue";

/** Percentual do passo: posição na viagem (0% a 100%). */
export const journeyPercent = (step: JourneyStep) =>
  Math.round((JOURNEY_STEPS.indexOf(step) / (JOURNEY_STEPS.length - 1)) * 100);

export const stepOfCard = (card: OrderCard | RequestCard): JourneyStep =>
  card === "ordInspectionIssue" ? "ordInspection" : card;

/** Itens que dividem os passos. */
export const JOURNEY_REQUIREMENT_KEYS = [
  "inspection_review",
  "ship_date",
  "vessel",
  "eta",
  "plate",
];

/**
 * Grupo de quadrados de cada marco (fase 5c): a situação antiga equivalente,
 * que divide os quadrados do bloco 2 como antes.
 */
export const MILESTONE_CARD_STAGE: Record<MilestoneKey, StageKey> = {
  "new-order": "PREPARATION",
  certification: "PREPARATION",
  "art-material": "PREPARATION",
  art: "PREPARATION",
  contract: "PACKAGING",
  "down-payment": "PACKAGING",
  "pre-production": "INSPECTION",
  inspection: "INSPECTION",
  samples: "INSPECTION",
  production: "INSPECTION",
  booking: "SHIPPING",
  loading: "SHIPPING",
  shipment: "SHIPPING",
  customs: "CUSTOMS",
  "invoice-transport": "TRANSPORT",
  delivery: "DELIVERED",
};

/**
 * Grupo de quadrados do pedido pelo marco atual (fase 5g). No Pedido novo, a
 * situação gravada (derivada dos marcos) ainda separa "Pedido criado" (o
 * pedido por conferir) da Preparação.
 */
export function cardStageOf(
  current: MilestoneKey | null | undefined,
  status: string,
): StageKey | undefined {
  if (!current) return undefined;
  if (current === "new-order" && status === "ORDER_CREATED")
    return "ORDER_CREATED";
  return MILESTONE_CARD_STAGE[current];
}

/** Passo do menu dos itens que a viagem olha em cada situação antiga. */
const CARD_STEP: Partial<Record<StageKey, string>> = {
  INSPECTION: "production/inspection",
  SHIPPING: "production/shipment",
  TRANSPORT: "delivery/logistics",
};

/** Passos que só acontecem com a carga no porto. */
const ARRIVAL_STEPS: ImportStep["key"][] = ["cargo_presence", "channel", "di"];

export interface JourneyInput {
  now: Date;
  /**
   * Pedidos com marco travado (fase 5g: a trava da inspeção mora no marco,
   * `order_milestones.status = "blocked"`).
   */
  blocked?: ReadonlySet<string>;
  /** Itens com as chaves de JOURNEY_REQUIREMENT_KEYS (passo e chave, fase 5g). */
  requirements: (Pick<Requirement, "orderId" | "key" | "status" | "value"> & {
    step?: string | null;
  })[];
  steps: Pick<ImportStep, "orderId" | "key" | "status">[];
  reviews: Pick<ReviewItem, "orderId" | "entity" | "entityId" | "rule">[];
}

/** Regras da viagem sobre os dados lidos (função pura). */
export function journeyIndex(input: JourneyInput) {
  const today = brazilDay(input.now) ?? "";
  const blocked = input.blocked ?? new Set<string>();
  const by = <T extends { orderId: string | null }>(rows: T[]) => {
    const map = new Map<string, T[]>();
    for (const row of rows) {
      if (!row.orderId) continue;
      const list = map.get(row.orderId);
      if (list) list.push(row);
      else map.set(row.orderId, [row]);
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
  // Fase 5g: o item pelo passo e pela chave (`eta` existe no Embarque e no
  // Transporte).
  const req = (orderId: string, key: string, stageKey: StageKey) =>
    (reqsBy.get(orderId) ?? []).find(
      (r) => r.key === key && stepOfItem(r) === CARD_STEP[stageKey],
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
      // Pedido de compra: "Pedido criado" conclui na hora; a Preparação, arte
      // e certificação reúne as três raias (docs/PURCHASE_ORDER.md). Pedido
      // importado do Sankhya (sem fluxo no portal): a TOP define a etapa.
      case "ORDER_CREATED":
        return "ordCreated";
      // SUPPLIER_PAYMENT é etapa antiga, fora do fluxo: segue para o contrato sozinha.
      case "PREPARATION":
      case "SUPPLIER_PAYMENT":
        return "ordPrep";
      // Contrato assinado pelas duas partes (a etapa "Arte e embalagem" de antes).
      case "PACKAGING":
        return "ordContract";
      case "INSPECTION": {
        const review = req(o.id, "inspection_review", stageKey);
        return blocked.has(o.id) ||
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

  /** Quadrado do bloco 1: a solicitação ainda sem pedido. */
  const requestCard = (
    r: Pick<Request, "id" | "status">,
  ): RequestCard | null =>
    r.status === "ORDERED" || r.status === "CANCELLED" ? null : "reqNew";
  /** Passo do pedido: encerrado = 100%; cancelado = onde parou (nulo se não se sabe). */
  const orderStep = (
    o: Pick<Order, "id" | "status" | "cancelStageKey"> & {
      cancelMilestoneKey?: string | null;
    },
    /** Marco atual (fase 5g); sem ele, a situação gravada (derivada dos marcos). */
    current?: MilestoneKey | null,
  ): JourneyStep | null => {
    if (o.status === "CLOSED") return "ordClosed";
    if (o.status === "CANCELLED") {
      const byMilestone =
        o.cancelMilestoneKey && o.cancelMilestoneKey in MILESTONE_CARD_STAGE
          ? cardStageOf(
              o.cancelMilestoneKey as MilestoneKey,
              o.cancelStageKey ?? "",
            )
          : null;
      const at = byMilestone ?? o.cancelStageKey ?? null;
      if (!at) return null;
      return at === "CLOSED" ? "ordClosed" : stepOfCard(orderCard(o, at));
    }
    return stepOfCard(orderCard(o, cardStageOf(current, o.status)));
  };

  const requestStep = (
    r: Pick<Request, "id" | "status">,
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
  const [blockedRows, requirements, steps, reviews] =
    // Só as colunas usadas (com milhares de pedidos do Sankhya, as linhas
    // inteiras dos itens passavam de 80 MB).
    await Promise.all([
      orderIds.length
        ? safe(
            listColumns(store, "order_milestones", ["orderId"], {
              filter: { orderId: orderIds, status: "blocked" },
            }),
          )
        : none<{ orderId: string }>(),
      orderIds.length
        ? listColumns(
            store,
            "requirements",
            ["orderId", "step", "key", "status", "value"],
            { filter: { orderId: orderIds, key: JOURNEY_REQUIREMENT_KEYS } },
          )
        : none<JourneyInput["requirements"][number]>(),
      orderIds.length
        ? safe(
            listColumns(store, "import_steps", ["orderId", "key", "status"], {
              filter: { orderId: orderIds },
            }),
          )
        : none<JourneyInput["steps"][number]>(),
      store.list("review_items", {
        filter: { status: "open" },
        orderBy: "createdAt",
        direction: "desc",
      }),
    ]);
  return {
    now,
    blocked: new Set(blockedRows.map((r) => r.orderId)),
    requirements,
    steps,
    reviews,
  };
}
