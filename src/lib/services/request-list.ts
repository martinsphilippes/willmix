import "server-only";

import type { Request, Role, StageKey } from "@/lib/db";
import type { Translate } from "@/i18n";
import type { RequestDisplayStatus } from "./order-status";

/*
 * Lista de solicitações da Wellmix (tela Solicitações): situação resumida
 * para os filtros (em aberto, viraram pedido, atrasadas) e busca. Funções
 * puras: a tela e o CSV usam as mesmas regras. A RFQ, a cotação e o sinal do
 * cliente saíram em 11/11/2026: a solicitação do cliente fica como entrada
 * de pedidos até seguir o processo das solicitações ao fornecedor.
 */

export const REQUEST_SITUATIONS = ["all", "open", "ordered", "late"] as const;
export type RequestSituation = (typeof REQUEST_SITUATIONS)[number];

/** Em aberto (RFQ, cotação e sinal só existem em solicitações antigas). */
const OPEN: readonly string[] = [
  "REQUESTED",
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

export type NextStepKey = "new" | "order" | "none";

/** Com quem está a vez: equipe Wellmix ou o papel da etapa do pedido. */
export type NextStepWho = "wellmix" | Role | null;

export interface NextStep {
  key: NextStepKey;
  who: NextStepWho;
  /** Etapa atual do pedido (key "order"). */
  stage?: StageKey | null;
  /** Etapa atual com o prazo vencido. */
  late?: boolean;
}

/**
 * Próximo passo da solicitação e com quem está (função pura): a solicitação
 * nova espera a Wellmix; a que virou pedido segue a etapa atual dele.
 */
export function requestNextStep(input: {
  status: Request["status"];
  display: RequestDisplayStatus;
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
  return { key: "new", who: "wellmix" };
}

/** Texto do próximo passo (tela e CSV). */
export function nextStepText(t: Translate, n: NextStep): string {
  if (n.key === "none") return t("reqList.next.none");
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
  if (n.who === "wellmix") return t("reqList.who.wellmix");
  return t("reqList.who.role", { role: t(`role.${n.who}`) });
}
