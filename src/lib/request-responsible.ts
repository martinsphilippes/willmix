import type { ActionKey } from "@/lib/auth/function-access";
import type {
  NextStep,
  NextStepKey,
  PurchaseProgress,
} from "@/lib/services/request-list";
import { kindGate, type TaskGate } from "@/lib/task-owner";
import type { TurnParty } from "@/lib/turn";

/*
 * Quem age e até quando em cada passo da encomenda (dono, 19/11/2026;
 * docs/ORDER_LEVEL_LISTS.md, seção 6, e docs/TURNS.md). Regras puras: a
 * lista de Encomendas, o CSV e os testes usam a mesma resposta.
 *
 * Nada é gravado: o responsável sai da mesma regra que põe a ação nas
 * Pendências. Na Wellmix é quem tem a função (ou a tela) da etapa, pela
 * porta das Pendências (`kindGate`, src/lib/task-owner.ts); os
 * administradores podem agir em tudo e aparecem à parte. No cliente, os
 * logins que podem confirmar a venda. No fornecedor, o parceiro da cotação
 * ou da solicitação e os logins dele. O Analista é outro campo e não entra.
 */

/** De quem é o passo: a mesma regra de quem recebe a pendência. */
export type StepOwner =
  /** Equipe Wellmix pela porta da pendência (sem quem tem `except`). */
  | { kind: "team"; gate: TaskGate; except?: ActionKey }
  /** Os logins do cliente que podem confirmar a venda. */
  | { kind: "customer" }
  /** Os parceiros da cotação ou da solicitação ao fornecedor. */
  | { kind: "partners" }
  /**
   * Falta quem aja: o cliente sem login que confirme (`login`, a pendência
   * vai ao administrador) ou a etapa sem responsável no fluxo (`flow`,
   * decisões em aberto do docs/TURNS.md).
   */
  | { kind: "missing"; reason: "login" | "flow" }
  /** Pedido gerado: a parte do marco atual (só no filtro de um lote). */
  | { kind: "order" };

const team = (kind: string, except?: ActionKey): StepOwner => ({
  kind: "team",
  gate: kindGate(kind) ?? { admin: true },
  ...(except ? { except } : {}),
});

/** A regra de quem age em cada passo (nulo: nada a fazer). */
export function stepOwner(key: NextStepKey): StepOwner | null {
  switch (key) {
    case "none":
      return null;
    case "confirm":
      return { kind: "customer" };
    case "login":
      return { kind: "missing", reason: "login" };
    // "Gerar o pedido de compra" depois da amostragem: ainda não é
    // pendência de ninguém (docs/TURNS.md, decisão 5).
    case "purchase_order":
      return { kind: "missing", reason: "flow" };
    case "quote_answer":
    case "supplier_answer":
    case "sampling_send":
      return { kind: "partners" };
    case "order":
      return { kind: "order" };
    // "Enviar para cotação": quem abre Encomendas (o Comprador também).
    case "send":
      return team("new_request");
    // "Encomenda nova": quem abre Encomendas, menos quem escolhe a
    // estratégia (que a vê no passo Estratégia de compra).
    case "new":
      return team("new_request", "purchaseStrategy.choose");
    case "strategy":
      return team("purchase_strategy");
    case "strategy_approve":
      return team("purchase_strategy_approve");
    case "strategy_order":
      return team("purchase_strategy_order");
    case "quote_choose":
      return team("purchase_quote_choose");
    case "quote_empty":
      return team("purchase_quote_empty");
    case "quote_approve":
      return team("purchase_quote_approve");
    case "supplier_decide":
      return team("supplier_request");
    case "sampling_validate":
      return team("sampling_validate");
  }
}

/** Parceiro que age no passo e o prazo da pendência dele. */
export interface StepPartner {
  supplierId: string;
  dueAt: string | null;
}

/**
 * Os parceiros do passo do fornecedor, cada um uma vez (o prazo mais
 * próximo): convidados ainda no prazo (cotação), fornecedor com a vez na
 * negociação ou com a amostragem a enviar.
 */
export function stepPartners(
  key: NextStepKey,
  purchase: PurchaseProgress | null | undefined,
): StepPartner[] {
  const list: StepPartner[] =
    key === "quote_answer"
      ? (purchase?.quote?.invites ?? []).map((i) => ({
          supplierId: i.supplierId,
          dueAt: i.dueAt,
        }))
      : key === "supplier_answer"
        ? (purchase?.supplierRequests ?? [])
            .filter((r) => r.negotiation === "supplier" && r.supplierId)
            .map((r) => ({
              supplierId: r.supplierId!,
              dueAt: r.negotiationDueAt ?? null,
            }))
        : key === "sampling_send"
          ? (purchase?.supplierRequests ?? [])
              .filter(
                (r) =>
                  r.status === "approved" &&
                  r.sampling === "supplier" &&
                  r.supplierId,
              )
              .map((r) => ({
                supplierId: r.supplierId!,
                dueAt: r.samplingDueAt ?? null,
              }))
          : [];
  const out = new Map<string, StepPartner>();
  for (const p of list) {
    const cur = out.get(p.supplierId);
    if (!cur || (p.dueAt && (!cur.dueAt || p.dueAt < cur.dueAt)))
      out.set(p.supplierId, p);
  }
  return [...out.values()];
}

/**
 * Prazo da ação: um instante (SLA da pendência) ou um dia (o prazo de
 * resposta da solicitação e o do marco do pedido, que vencem no dia
 * seguinte).
 */
export interface StepDue {
  at: string;
  day: boolean;
}

const earliest = (list: readonly (string | null | undefined)[]) =>
  list
    .filter((v): v is string => !!v)
    .sort((a, b) => Date.parse(a) - Date.parse(b))[0] ?? null;

/**
 * Prazo da pendência do passo (dono, 19/11/2026, decisão 4): o mesmo das
 * Pendências. Cotação: o convite de cada parceiro; resposta e decisão na
 * solicitação ao fornecedor: o SLA da negociação; amostragem: o SLA dela;
 * pedido: o prazo do marco. As outras pendências não têm prazo próprio:
 * vale o prazo de resposta da solicitação.
 */
export function stepDue(
  step: NextStep,
  request: { deadline?: string | null },
  purchase: PurchaseProgress | null | undefined,
): StepDue | null {
  const own =
    step.key === "quote_answer" ||
    step.key === "supplier_answer" ||
    step.key === "sampling_send"
      ? earliest(stepPartners(step.key, purchase).map((p) => p.dueAt))
      : step.key === "supplier_decide"
        ? earliest(
            (purchase?.supplierRequests ?? [])
              .filter((r) => r.negotiation === "wellmix")
              .map((r) => r.negotiationDueAt),
          )
        : null;
  if (own) return { at: own, day: false };
  if (step.key === "order")
    return step.dueAt ? { at: step.dueAt.slice(0, 10), day: true } : null;
  if (step.key === "none") return null;
  return request.deadline
    ? { at: request.deadline.slice(0, 10), day: true }
    : null;
}

/** O prazo já passou? Por dia: vence no dia seguinte (Brasília). */
export function isOverdue(
  due: StepDue | null | undefined,
  now: Date,
  today: string,
): boolean {
  if (!due) return false;
  return due.day ? due.at < today : Date.parse(due.at) <= now.getTime();
}

/** O prazo mais próximo entre vários (o que vence primeiro). */
export function earliestDue(
  list: readonly (StepDue | null | undefined)[],
): StepDue | null {
  const start = (d: StepDue) =>
    d.day ? Date.parse(`${d.at}T23:59:59-03:00`) : Date.parse(d.at);
  return (
    list
      .filter((d): d is StepDue => !!d)
      .sort((a, b) => start(a) - start(b))[0] ?? null
  );
}

/** Uma pessoa que pode agir. O login (e-mail) só vai para quem pode vê-lo. */
export interface Person {
  id: string;
  name: string;
  login: string | null;
}

/** Quem age no passo, como a lista mostra. */
export interface Responsible {
  /** A parte no processo (Cliente, Wellmix, Fornecedor…). */
  party: TurnParty | null;
  /** Empresa do cliente ou do parceiro; funções da equipe Wellmix. */
  group: string | null;
  /** As pessoas que a pendência alcança (sem os administradores). */
  people: Person[];
  /** Wellmix: os administradores, que podem agir em toda etapa. */
  admins: Person[];
  /** Vários parceiros (cotação): cada um com o prazo e os logins. */
  partners: {
    id: string;
    name: string;
    dueAt: string | null;
    people: Person[];
  }[];
  /**
   * Falta atribuição: ninguém da equipe com a função (`function`), cliente
   * sem login que confirme (`login`), parceiro sem login (`partner_login`)
   * ou etapa sem responsável no fluxo (`flow`).
   */
  missing: null | "function" | "login" | "partner_login" | "flow";
}

/** O que a lista precisa saber das pessoas (o servidor preenche). */
export interface PeopleDirectory {
  /** Equipe Wellmix ativa que passa a porta, sem os administradores. */
  team(
    gate: TaskGate,
    except?: ActionKey,
  ): {
    people: Person[];
    functions: string[];
  };
  /** Os administradores ativos. */
  admins(): Person[];
  /** Os logins do cliente que podem confirmar a venda desta encomenda. */
  confirmers(requestId: string): Person[];
  /** O nome do cliente. */
  customer(customerId: string): string | null;
  /** O parceiro (nome) e os logins ativos dele. */
  partner(partyId: string): { name: string; people: Person[] };
}

/** Quem age no passo da encomenda (nulo: nada a fazer). */
export function responsibleOf(
  step: NextStep,
  request: { id: string; customerId: string },
  purchase: PurchaseProgress | null | undefined,
  dir: PeopleDirectory,
): Responsible | null {
  const owner = stepOwner(step.key);
  if (!owner) return null;
  const base: Responsible = {
    party: step.who,
    group: null,
    people: [],
    admins: [],
    partners: [],
    missing: null,
  };
  switch (owner.kind) {
    case "customer": {
      const people = dir.confirmers(request.id);
      return {
        ...base,
        party: "customer",
        group: dir.customer(request.customerId),
        people,
        missing: people.length ? null : "login",
      };
    }
    case "missing":
      return {
        ...base,
        // Quem resolve: o administrador (login do cliente) ou a gestão.
        admins: dir.admins(),
        missing: owner.reason,
      };
    case "team": {
      const { people, functions } = dir.team(owner.gate, owner.except);
      return {
        ...base,
        party: "wellmix",
        group: functions.length ? functions.join(", ") : null,
        people,
        admins: dir.admins(),
        missing: people.length ? null : "function",
      };
    }
    case "partners": {
      const partners = stepPartners(step.key, purchase).map((p) => ({
        id: p.supplierId,
        dueAt: p.dueAt,
        ...dir.partner(p.supplierId),
      }));
      if (partners.length === 1) {
        const [only] = partners;
        return {
          ...base,
          group: only.name,
          people: only.people,
          missing: only.people.length ? null : "partner_login",
        };
      }
      return {
        ...base,
        partners,
        missing: !partners.length
          ? "flow"
          : partners.every((p) => !p.people.length)
            ? "partner_login"
            : null,
      };
    }
    case "order":
      return base;
  }
}

/** Chave para juntar passos iguais com os mesmos responsáveis. */
export function responsibleKey(r: Responsible | null): string {
  if (!r) return "";
  return [
    r.party ?? "",
    r.missing ?? "",
    r.group ?? "",
    r.people.map((p) => p.id).join(","),
    r.partners.map((p) => p.id).join(","),
  ].join("|");
}

/** Textos da 2ª linha (a tela traduz). */
export interface ResponsibleLabels {
  /** "Responsável não definido". */
  undefined: string;
  /** "{n} pessoas". */
  people: (n: number) => string;
  /** "{n} parceiros". */
  partners: (n: number) => string;
  /** O nome da parte ("Cliente", "Wellmix"). */
  party: (party: TurnParty) => string;
}

/**
 * A 2ª linha da Próxima ação: quem age e a empresa, equipe ou papel
 * ("Ana Costa · Cliente", "Comprador (3) · Wellmix", "3 parceiros ·
 * Fornecedor"). `warn`: falta atribuição (pendência de cadastro ou do fluxo).
 */
export function responsibleLine(
  r: Responsible,
  labels: ResponsibleLabels,
): { who: string; where: string | null; warn: boolean } {
  const where =
    r.party && r.party !== "unassigned" ? labels.party(r.party) : null;
  if (r.partners.length > 1)
    return {
      who: labels.partners(r.partners.length),
      where,
      warn: r.missing !== null,
    };
  if (r.people.length === 1)
    return { who: r.people[0].name, where, warn: false };
  if (r.people.length > 1) {
    // Equipe de uma função só: o nome dela e quantas pessoas; mais de uma
    // função, só a quantidade (os nomes ficam na informação complementar).
    // Cliente: quantos logins; parceiro: a empresa.
    const who =
      r.party === "wellmix" && r.group && !r.group.includes(",")
        ? `${r.group} (${r.people.length})`
        : r.party !== "wellmix" && r.party !== "customer" && r.group
          ? r.group
          : labels.people(r.people.length);
    return { who, where, warn: false };
  }
  // Parceiro conhecido sem login: a empresa, com o aviso.
  if (r.missing === "partner_login" && r.group)
    return { who: r.group, where, warn: true };
  return { who: labels.undefined, where: null, warn: true };
}
