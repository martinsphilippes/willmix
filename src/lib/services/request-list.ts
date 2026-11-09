import "server-only";

import type {
  Approval,
  ApprovalLevel,
  Payment,
  Quote,
  Request,
  Role,
  StageKey,
} from "@/lib/db";
import type { Translate } from "@/i18n";
import type { RequestDisplayStatus } from "./order-status";

/*
 * Lista de solicitações da Wellmix (tela Solicitações): situação resumida
 * para os filtros (em aberto, aguardando sinal, viraram pedido, atrasadas),
 * busca e o sinal recebido de cada solicitação. Funções puras: a tela e o
 * CSV usam as mesmas regras.
 */

export const REQUEST_SITUATIONS = [
  "all",
  "open",
  "waiting",
  "ordered",
  "late",
] as const;
export type RequestSituation = (typeof REQUEST_SITUATIONS)[number];

const OPEN: readonly string[] = [
  "REQUESTED",
  "RFQ_OPEN",
  "QUOTATION_RECEIVED",
  "SUPPLIER_SELECTED",
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
    case "waiting":
      return r.status === "WAITING_DOWN_PAYMENT";
    case "ordered":
      return display === "ORDERED";
    case "late":
      // Ainda sem pedido e com o prazo de resposta vencido.
      return (
        (OPEN.includes(r.status) || r.status === "WAITING_DOWN_PAYMENT") &&
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

/** Sinal recebido (confirmado ou recebido) por solicitação. */
export function receivedByRequest(payments: Payment[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const p of payments) {
    if (p.direction !== "customer_in" || !p.requestId) continue;
    if (p.status !== "confirmed" && p.status !== "received") continue;
    out.set(
      p.requestId,
      Math.round(((out.get(p.requestId) ?? 0) + p.amount) * 100) / 100,
    );
  }
  return out;
}

export type DownStatus = "paid" | "partial" | "pending" | "none";

/** Situação do sinal: sem sinal definido, pago, parcial ou pendente. */
export function downStatus(
  r: Pick<Request, "downPaymentAmount">,
  received: number,
): DownStatus {
  const due = r.downPaymentAmount ?? 0;
  if (!(due > 0)) return received > 0 ? "paid" : "none";
  if (received >= due - 0.005) return "paid";
  return received > 0 ? "partial" : "pending";
}

/** Resumo das cotações de uma solicitação: convites, respostas e a melhor. */
export interface QuoteSummary {
  invited: number;
  answered: number;
  /** A escolhida (se houver); senão, a mais barata entre as respondidas. */
  best: {
    price: number;
    currency: string | null;
    leadTimeDays: number | null;
    selected: boolean;
  } | null;
}

/** Convites, respostas e melhor cotação (função pura). */
export function quoteSummary(
  quotes: Pick<
    Quote,
    "id" | "status" | "price" | "currency" | "leadTimeDays" | "answeredAt"
  >[],
  selectedQuoteId: string | null,
): QuoteSummary {
  const answered = quotes.filter(
    (q) => !!q.answeredAt || q.status === "answered" || q.status === "selected",
  );
  const priced = answered.filter((q) => typeof q.price === "number");
  const chosen =
    priced.find((q) => q.id === selectedQuoteId) ??
    priced.find((q) => q.status === "selected") ??
    null;
  // Sem escolhida: a mais barata na moeda da primeira resposta (não mistura moedas).
  const sameCurrency = priced.filter(
    (q) => (q.currency ?? null) === (priced[0]?.currency ?? null),
  );
  const cheapest = sameCurrency.reduce<(typeof priced)[number] | null>(
    (min, q) => (min === null || q.price! < min.price! ? q : min),
    null,
  );
  const best = chosen ?? cheapest;
  return {
    invited: quotes.length,
    answered: answered.length,
    best: best
      ? {
          price: best.price!,
          currency: best.currency ?? null,
          leadTimeDays: best.leadTimeDays ?? null,
          selected: best === chosen,
        }
      : null,
  };
}

export type NextStepKey =
  | "rfq"
  | "quotes"
  | "choose"
  | "approval"
  | "proposal"
  | "down"
  | "order"
  | "none";

/** Com quem está a vez: equipe Wellmix, fornecedores, cliente, diretoria ou o papel da etapa. */
export type NextStepWho =
  "wellmix" | "suppliers" | "customer" | "approvers" | Role | null;

export interface NextStep {
  key: NextStepKey;
  who: NextStepWho;
  /** Nível da aprovação pendente (key "approval"). */
  level?: ApprovalLevel | null;
  /** Etapa atual do pedido (key "order"). */
  stage?: StageKey | null;
  /** Etapa atual com o prazo vencido. */
  late?: boolean;
}

/**
 * Próximo passo da solicitação e com quem está (função pura): abrir a
 * cotação, esperar os fornecedores, escolher (ou aprovar) o preço, receber o
 * sinal ou acompanhar o pedido na etapa atual.
 */
export function requestNextStep(input: {
  status: Request["status"];
  display: RequestDisplayStatus;
  quotes: Pick<QuoteSummary, "invited" | "answered">;
  /** Aprovação pendente da escolha (se houver). */
  approval: Pick<Approval, "status" | "currentLevel"> | null;
  /**
   * O cliente já aprovou a proposta (etapa "Proposta ao cliente"); sem a
   * aprovação, a vez é dele de aprovar, antes do sinal.
   */
  proposalApproved: boolean;
  /** Pedido gerado: etapa atual, quem responde por ela e o prazo. */
  order: {
    status: StageKey | "CANCELLED";
    responsibleRole: Role | null;
    dueAt: string | null;
  } | null;
  today: string;
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
      who: o.responsibleRole,
      stage: o.status,
      late: !!o.dueAt && o.dueAt.slice(0, 10) < input.today,
    };
  }
  if (status === "WAITING_DOWN_PAYMENT")
    return input.proposalApproved
      ? { key: "down", who: "customer" }
      : { key: "proposal", who: "customer" };
  if (input.approval?.status === "pending")
    return {
      key: "approval",
      who: "approvers",
      level: input.approval.currentLevel,
    };
  if (status === "REQUESTED" || input.quotes.invited === 0)
    return { key: "rfq", who: "wellmix" };
  if (status === "RFQ_OPEN" && input.quotes.answered === 0)
    return { key: "quotes", who: "suppliers" };
  return { key: "choose", who: "wellmix" };
}

/** Texto do próximo passo (tela e CSV). */
export function nextStepText(t: Translate, n: NextStep): string {
  if (n.key === "none") return t("reqList.next.none");
  if (n.key === "approval")
    return n.level
      ? t("reqList.next.approvalLevel", {
          level: t(`approvals.level.${n.level}`),
        })
      : t("reqList.next.approval");
  if (n.key === "order")
    return n.stage === "CLOSED"
      ? t("reqList.next.closed")
      : t("reqList.next.order", {
          stage: n.stage ? t(`stage.${n.stage}`) : "—",
        });
  return t(`reqList.next.${n.key}`);
}

/** Com quem está a vez (tela e CSV); vazio quando ninguém. */
export function nextStepWho(t: Translate, n: NextStep): string {
  if (!n.who) return "";
  if (
    n.who === "wellmix" ||
    n.who === "suppliers" ||
    n.who === "customer" ||
    n.who === "approvers"
  )
    return t(`reqList.who.${n.who}`);
  return t("reqList.who.role", { role: t(`role.${n.who}`) });
}
