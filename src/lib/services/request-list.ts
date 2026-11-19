import "server-only";

import type { Request, Role, StageKey } from "@/lib/db";
import type {
  PurchaseDecisionChoice,
  PurchaseDecisionStatus,
  PurchaseQuoteStatus,
  SupplierRequestStatus,
} from "@/lib/db/schema";
import {
  partyOfRole,
  turnWaitingKey,
  turnWithKey,
  type TurnParty,
} from "@/lib/turn";
import type { Translate } from "@/i18n";
import type { RequestDisplayStatus } from "./order-status";
import { orderMilestoneText } from "@/lib/milestones";

/*
 * Lista de solicitações da Wellmix (tela Solicitações): situação resumida
 * para os filtros (em aberto, viraram pedido, atrasadas) e busca. Funções
 * puras: a tela e o CSV usam as mesmas regras. A RFQ, a cotação e o sinal do
 * cliente saíram em 11/11/2026: a solicitação do cliente fica como entrada
 * de pedidos até seguir o processo das solicitações ao fornecedor.
 */

export const REQUEST_SITUATIONS = [
  "all",
  "open",
  "draft",
  "ordered",
  "late",
] as const;
export type RequestSituation = (typeof REQUEST_SITUATIONS)[number];

/**
 * Situações da lista de Encomendas (dono, 16/11/2026): "Viraram pedido" saiu,
 * porque a encomenda que virou pedido já não é desta etapa. `inSituation`
 * ainda entende "ordered" (a exportação e links antigos). Cards (dono,
 * 19/11/2026; docs/ORDER_LEVEL_LISTS.md, seção 6): Total | Abertas |
 * Rascunhos | Atrasadas, contados por solicitação.
 */
export const LISTED_SITUATIONS = REQUEST_SITUATIONS.filter(
  (k): k is Exclude<RequestSituation, "ordered"> => k !== "ordered",
);

/**
 * Em aberto: toda encomenda que ainda depende de uma ação, de quem for a vez
 * (a venda aguardando o cliente também, dono 18/11/2026; RFQ, cotação e sinal
 * só existem em solicitações antigas; "Fornecedor selecionado" é a vencedora
 * da cotação de compra seguindo para a solicitação ao fornecedor).
 */
const OPEN: readonly string[] = [
  "REQUESTED",
  "AWAITING_CUSTOMER",
  "RFQ_OPEN",
  "QUOTATION_RECEIVED",
  "SUPPLIER_SELECTED",
  "WAITING_DOWN_PAYMENT",
];

/** Dia de hoje (AAAA-MM-DD) em Brasília. */
export function todayBrazil(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** A solicitação está na situação do filtro? */
export function inSituation(
  r: Pick<Request, "status" | "deadline">,
  display: RequestDisplayStatus,
  situation: RequestSituation,
  today: string,
): boolean {
  switch (situation) {
    case "all":
      return true;
    case "open":
      return OPEN.includes(r.status);
    // Rascunho não é solicitação enviada: o card conta os rascunhos à parte.
    case "draft":
      return false;
    case "ordered":
      return display === "ORDERED";
    case "late":
      // Ainda sem pedido e com o prazo de resposta vencido.
      return (
        OPEN.includes(r.status) &&
        !!r.deadline &&
        r.deadline.slice(0, 10) < today
      );
  }
}

const norm = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Busca por número, produto, descrição ou cliente (sem acento). */
export function matchesRequest(
  r: Pick<Request, "number" | "productName" | "description">,
  customerName: string,
  q: string,
): boolean {
  const term = norm(q).trim().replace(/^#/, "");
  if (!term) return true;
  return [String(r.number ?? ""), r.productName, r.description, customerName]
    .map(norm)
    .some((v) => v.includes(term));
}

export type NextStepKey =
  | "new"
  | "send"
  | "strategy"
  | "order"
  | "none"
  /** Venda pela Wellmix: o cliente confirma o pedido (docs/ORDER_TERMS.md). */
  | "confirm"
  /** Ninguém pode confirmar: falta o login do cliente (vai ao administrador). */
  | "login"
  /** Pedido direto: a Diretoria aprova a estratégia. */
  | "strategy_approve"
  /** Pedido direto aprovado: gerar o pedido de compra. */
  | "strategy_order"
  /** Cotação de compra no prazo: os fornecedores respondem. */
  | "quote_answer"
  /** Cotação encerrada: o Comprador escolhe a vencedora. */
  | "quote_choose"
  /** Cotação sem resposta: o Comprador decide o que fazer. */
  | "quote_empty"
  /** Vencedora escolhida: a Diretoria aprova. */
  | "quote_approve"
  /** Solicitação ao fornecedor aberta (ou contraproposta): ele responde. */
  | "supplier_answer"
  /** Fornecedor respondeu: a Wellmix decide. */
  | "supplier_decide"
  /** Amostragem da solicitação aprovada: o fornecedor envia. */
  | "sampling_send"
  /** Amostragem enviada: a Wellmix valida. */
  | "sampling_validate"
  /** Solicitação ao fornecedor aprovada: gerar o pedido de compra. */
  | "purchase_order";

/** Com quem está a vez (src/lib/turn.ts): a equipe Wellmix ou a parte de fora. */
export type NextStepWho = TurnParty | null;

export interface NextStep {
  key: NextStepKey;
  who: NextStepWho;
  /** Etapa atual do pedido (key "order"). */
  stage?: StageKey | null;
  /** Etapa atual com o prazo vencido. */
  late?: boolean;
  /** Pedido: o prazo da etapa atual (o do marco), quando há. */
  dueAt?: string | null;
}

/**
 * Onde a encomenda está na compra (Estratégia → Cotação → Solicitação ao
 * fornecedor), lido das tabelas dela (src/lib/services/request-turns.ts).
 */
export interface PurchaseProgress {
  decision: {
    status: PurchaseDecisionStatus;
    choice: PurchaseDecisionChoice;
    orderId: string | null;
  } | null;
  /**
   * Cotação de compra da estratégia: a situação e, aberta, a fase pelas
   * respostas (`quoteClosed`/`quoteEmpty` de services/purchase-quote.ts).
   */
  quote: {
    status: PurchaseQuoteStatus;
    phase: "answering" | "choose" | "empty";
    /**
     * Convites ainda no prazo (quem responde a cotação): o parceiro e o
     * prazo dele, o mesmo da pendência de cada um (dono, 19/11/2026).
     */
    invites?: { supplierId: string; dueAt: string }[];
  } | null;
  /**
   * Solicitações ao fornecedor nascidas da vencedora: a situação, de quem é
   * a vez na negociação (`negotiationTurn`, com a contraproposta da Wellmix
   * voltando ao fornecedor) e na amostragem depois de aprovada
   * (`samplingTurn`).
   */
  supplierRequests: {
    status: SupplierRequestStatus;
    negotiation: "supplier" | "wellmix" | null;
    sampling: "supplier" | "wellmix" | null;
    /** O fornecedor da solicitação (quem responde e envia a amostragem). */
    supplierId?: string | null;
    /** Prazo da negociação (o SLA das pendências de responder e de decidir). */
    negotiationDueAt?: string | null;
    /** Prazo da amostragem com o fornecedor (o da pendência dele). */
    samplingDueAt?: string | null;
  }[];
}

/** O próximo passo da compra (estratégia, cotação, solicitação); nulo fora dela. */
function purchaseStep(p: PurchaseProgress | null | undefined): NextStep | null {
  const d = p?.decision;
  if (!p || !d || d.status === "rejected") return null;
  if (d.status === "pending")
    return { key: "strategy_approve", who: "wellmix" };
  if (d.choice === "last_supplier")
    return d.orderId ? null : { key: "strategy_order", who: "wellmix" };
  const q = p.quote;
  if (!q || q.status === "cancelled") return null;
  if (q.status === "chosen") return { key: "quote_approve", who: "wellmix" };
  if (q.status === "open")
    return q.phase === "answering"
      ? { key: "quote_answer", who: "supplier" }
      : {
          key: q.phase === "empty" ? "quote_empty" : "quote_choose",
          who: "wellmix",
        };
  // Vencedora aprovada: segue a Solicitação ao fornecedor (a negociação, a
  // amostragem e o pedido de compra), a primeira que ainda espera alguém.
  const list = p.supplierRequests;
  if (list.some((r) => r.negotiation === "supplier"))
    return { key: "supplier_answer", who: "supplier" };
  if (list.some((r) => r.negotiation === "wellmix"))
    return { key: "supplier_decide", who: "wellmix" };
  const approved = list.filter((r) => r.status === "approved");
  if (approved.some((r) => r.sampling === "supplier"))
    return { key: "sampling_send", who: "supplier" };
  if (approved.some((r) => r.sampling === "wellmix"))
    return { key: "sampling_validate", who: "wellmix" };
  if (approved.length) return { key: "purchase_order", who: "wellmix" };
  return null;
}

/**
 * Próximo passo da solicitação e com quem está (função pura; a fonte comum
 * da situação, do Próximo passo, dos filtros e das Pendências, dono
 * 18/11/2026, docs/TURNS.md): a venda pela Wellmix espera o cliente
 * confirmar; a encomenda espera o envio para cotação, a estratégia, a
 * cotação e a solicitação ao fornecedor; a que virou pedido segue a etapa
 * atual dele.
 */
export function requestNextStep(input: {
  status: Request["status"];
  display: RequestDisplayStatus;
  /** Pedido gerado: etapa atual, quem responde por ela e o prazo. */
  order: {
    status: StageKey | "CANCELLED";
    responsibleRole: Role | null;
    dueAt: string | null;
    /** Fornecedor do pedido é uma Trading: a vez aparece como Trading. */
    trading?: boolean;
  } | null;
  today: string;
  /**
   * Compra por demanda (dono, 18/11/2026): a encomenda ainda a enviar para
   * cotação ("send") ou já na fila da Estratégia de Compra ("queue").
   */
  strategy?: "send" | "queue" | null;
  /** Estratégia, cotação e solicitação ao fornecedor da encomenda. */
  purchase?: PurchaseProgress | null;
  /**
   * Venda aguardando o cliente: há login do cliente que pode confirmar?
   * `false` = ninguém pode (o caso vai para o administrador); sem a
   * informação, vale que há.
   */
  customerLogin?: boolean | null;
}): NextStep {
  const { status, display } = input;
  if (status === "CANCELLED" || display === "ORDER_CANCELLED")
    return { key: "none", who: null };
  if (status === "ORDERED") {
    const o = input.order;
    if (!o || o.status === "CANCELLED") return { key: "none", who: null };
    if (o.status === "CLOSED")
      return { key: "order", who: null, stage: o.status, late: false };
    return {
      key: "order",
      who: partyOfRole(o.responsibleRole, { trading: o.trading }),
      stage: o.status,
      late: !!o.dueAt && o.dueAt.slice(0, 10) < input.today,
      dueAt: o.dueAt,
    };
  }
  if (status === "AWAITING_CUSTOMER")
    return input.customerLogin === false
      ? { key: "login", who: "unassigned" }
      : { key: "confirm", who: "customer" };
  const purchase = purchaseStep(input.purchase);
  if (purchase) return purchase;
  if (status === "REQUESTED" && input.strategy === "send")
    return { key: "send", who: "wellmix" };
  if (status === "REQUESTED" && input.strategy === "queue")
    return { key: "strategy", who: "wellmix" };
  return { key: "new", who: "wellmix" };
}

/**
 * Texto do próximo passo (tela e CSV). Pedido: o marco da etapa atual
 * ("Pedido em 1. Pedido novo"; fase 4d, docs/MILESTONES.md).
 */
export function nextStepText(t: Translate, n: NextStep): string {
  if (n.key === "none") return t("reqList.next.none");
  if (n.key === "order")
    return n.stage === "CLOSED"
      ? t("reqList.next.closed")
      : t("reqList.next.order", {
          stage: n.stage ? orderMilestoneText(t, n.stage) : "—",
        });
  return t(`reqList.next.${n.key}`);
}

/** Com quem está a vez (tela e CSV): "com o cliente"; vazio quando ninguém. */
export function nextStepWho(t: Translate, n: NextStep): string {
  return n.who ? t(turnWithKey(n.who)) : "";
}

/** A situação de quem está com a vez ("Aguardando cliente"); vazio quando ninguém. */
export function nextStepWaiting(t: Translate, n: NextStep): string {
  return n.who ? t(turnWaitingKey(n.who)) : "";
}
