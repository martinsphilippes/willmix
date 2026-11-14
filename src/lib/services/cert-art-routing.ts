import "server-only";
import { cache } from "react";
import { can, holdersOf, type FunctionDef } from "@/lib/auth/function-access";
import { isWellmix, WELLMIX_ROLES } from "@/lib/auth/permissions";
import {
  getStore,
  type Order,
  type Requirement,
  type Role,
  type User,
} from "@/lib/db";
import {
  LANE_KEYS,
  baseKeyOf,
  isRoutedLaneKey,
  itemIdOf,
  laneKey,
} from "@/lib/purchase-lanes";
import { getSettings } from "@/lib/settings";
import { artRole } from "@/lib/workflow/stages";
import { loadFunctionDefs } from "./team-functions";
import type { NotifyTarget } from "./notifications";

/*
 * Para quem vai cada tarefa dos cartões Certificação e Artes do pedido
 * (docs/CERTIFICATION.md, "Quem recebe cada tarefa"; pedido do dono,
 * 13/11/2026). Reaproveita o que o pedido já tem: Parceiros do pedido (a
 * certificadora e a agência), o Designer do pedido (cartão Artes) e o
 * analista do pedido (`ownerUserId`, o mesmo do painel de SLA).
 *
 * - Selo: o despachante do pedido (a certificação é dele; dono, 13/11/2026).
 * - Memorial descritivo: o responsável interno (o analista); a validação, o
 *   despachante.
 * - Arte com o selo e correção da arte: o designer do pedido; sem ele, a
 *   agência quando é ela quem faz a arte; senão a Wellmix (quem tem a função
 *   Designer; sem ninguém, o analista).
 * - Validação da arte: o analista, se ele pode validar arte (ação "Validar a
 *   arte"); senão quem pode.
 *
 * Sem quem receber, a tarefa fica com a equipe Wellmix inteira e a tela
 * aponta o que falta designar (`missing`). As pendências são calculadas na
 * hora a partir disso: trocar o responsável muda o dono da pendência aberta,
 * sem duplicar, e o que já foi feito continua com quem fez.
 */

import type { MissingAssignment } from "@/lib/assign-href";
export type { MissingAssignment } from "@/lib/assign-href";

/** Por que a tarefa foi para esse destino (a tela diz "Com: …"). */
export type RouteVia =
  | "broker"
  | "ocp"
  | "agency"
  | "designer"
  | "art_design"
  | "analyst"
  | "art_validate"
  | "reporter"
  | "team";

export interface Route {
  via: RouteVia;
  /** Logins certos (da Wellmix ou o designer da agência). */
  userIds?: string[];
  /** Empresa parceira: todos os logins ativos dela. */
  party?: { role: "broker" | "ocp" | "agency"; partyId: string };
  /** Ninguém designado: a equipe Wellmix inteira. */
  team?: true;
  /** O que falta designar (sinalizado na visão interna). */
  missing?: MissingAssignment;
}

/** O que o encaminhamento precisa saber, lido uma vez por tela ou lista. */
export interface RoutingContext {
  /** Logins ativos da Wellmix (administradores e operadores). */
  team: User[];
  /** Logins ativos por id (Wellmix e agências: designers do pedido). */
  users: Map<string, User>;
  defs: FunctionDef[];
  /** Configurações: a agência do pedido faz a arte. */
  agencyDoesArt: boolean;
}

/** Lido uma vez por requisição (a tela do pedido e as pendências pedem várias vezes). */
export const loadRoutingContext = cache(async (): Promise<RoutingContext> => {
  const [users, defs, settings] = await Promise.all([
    getStore().list("users", {
      filter: { role: [...WELLMIX_ROLES, "agency"], active: true },
    }),
    loadFunctionDefs(),
    getSettings(),
  ]);
  return {
    team: users.filter(isWellmix),
    users: new Map(users.map((u) => [u.id, u])),
    defs,
    agencyDoesArt: settings.agencyValidationEnabled,
  };
});

const team = (missing: MissingAssignment): Route => ({
  via: "team",
  team: true,
  missing,
});

/** O analista do pedido, se ainda é da equipe ativa. */
function analystOf(order: Pick<Order, "ownerUserId">, ctx: RoutingContext) {
  const owner = order.ownerUserId ? ctx.users.get(order.ownerUserId) : null;
  return owner && isWellmix(owner) ? owner : null;
}

/** Responsável interno do pedido: o analista; sem ele, a equipe. */
export function internalRoute(
  order: Pick<Order, "ownerUserId">,
  ctx: RoutingContext,
): Route {
  const owner = analystOf(order, ctx);
  return owner ? { via: "analyst", userIds: [owner.id] } : team("analyst");
}

/**
 * Quem certifica: o despachante do pedido (a Wellmix não trabalha com
 * certificadora; dono, 13/11/2026). Sem ele, o responsável interno designa
 * o despachante em Parceiros do pedido.
 */
export function ocpRoute(
  order: Pick<Order, "brokerId" | "ownerUserId">,
  ctx: RoutingContext,
): Route {
  if (order.brokerId)
    return {
      via: "broker",
      party: { role: "broker", partyId: order.brokerId },
    };
  return { ...internalRoute(order, ctx), missing: "ocp" };
}

/**
 * Designer do pedido ainda válido: login ativo da Wellmix ou da agência do
 * pedido (agência trocada depois: o login da agência antiga deixa de valer).
 */
export function orderDesigner(
  order: Pick<Order, "designerUserId" | "agencyId">,
  ctx: RoutingContext,
): User | null {
  const designer = order.designerUserId
    ? ctx.users.get(order.designerUserId)
    : null;
  if (!designer) return null;
  if (isWellmix(designer)) return designer;
  return designer.role === "agency" &&
    !!designer.partyId &&
    designer.partyId === order.agencyId
    ? designer
    : null;
}

/** A arte do pedido é feita pela agência (Configurações + agência designada). */
export const agencyMakesArt = (
  order: Pick<Order, "agencyId">,
  ctx: RoutingContext,
) => artRole(order, ctx.agencyDoesArt) === "agency";

/**
 * Quem faz a arte (aplica o selo, corrige a não conformidade): o designer do
 * pedido; sem ele, a agência quando é ela quem faz a arte; senão a Wellmix
 * (função Designer; sem ninguém nela, o analista), com o designer em falta.
 */
export function artMakerRoute(
  order: Pick<Order, "designerUserId" | "agencyId" | "ownerUserId">,
  ctx: RoutingContext,
): Route {
  const designer = orderDesigner(order, ctx);
  if (designer) return { via: "designer", userIds: [designer.id] };
  if (order.agencyId && agencyMakesArt(order, ctx))
    return {
      via: "agency",
      party: { role: "agency", partyId: order.agencyId },
    };
  const designers = holdersOf(ctx.team, "art.design", ctx.defs);
  if (designers.length)
    return {
      via: "art_design",
      userIds: designers.map((u) => u.id),
      missing: "designer",
    };
  return { ...internalRoute(order, ctx), missing: "designer" };
}

/** Pode validar a arte (ação "Validar a arte"; o administrador sempre). */
export const canValidateArt = (user: User, ctx: RoutingContext) =>
  isWellmix(user) && can(user, "art.validate", ctx.defs);

/**
 * Quem valida a arte: o analista, se ele pode validar arte; senão quem tem a
 * ação. Quem enviou não valida o próprio envio: fica com os outros.
 */
export function artValidatorRoute(
  order: Pick<Order, "ownerUserId">,
  ctx: RoutingContext,
  submitterId?: string | null,
): Route {
  const able = ctx.team.filter(
    (u) => u.id !== submitterId && canValidateArt(u, ctx),
  );
  const owner = analystOf(order, ctx);
  if (owner && able.some((u) => u.id === owner.id))
    return { via: "analyst", userIds: [owner.id] };
  const missing = owner ? undefined : ("analyst" as const);
  if (able.length)
    return {
      via: "art_validate",
      userIds: able.map((u) => u.id),
      ...(missing ? { missing } : {}),
    };
  return team("analyst");
}

/**
 * Conferir a correção de uma não conformidade da arte (cartão Artes): quem
 * apontou, se ainda é da equipe e pode validar arte; senão quem valida a arte
 * do pedido. Quem corrigiu não confere a própria correção.
 */
export function artReviewRoute(
  order: Pick<Order, "ownerUserId">,
  issue: { reportedByUserId: string; fixedByUserId: string | null },
  ctx: RoutingContext,
): Route {
  const reporter = ctx.users.get(issue.reportedByUserId);
  if (
    reporter &&
    reporter.id !== issue.fixedByUserId &&
    canValidateArt(reporter, ctx)
  )
    return { via: "reporter", userIds: [reporter.id] };
  return artValidatorRoute(order, ctx, issue.fixedByUserId);
}

/**
 * Validação feita pela Wellmix: quem enviou não valida o próprio passo. Se a
 * validação iria só para quem enviou, vai para o resto da equipe.
 */
export function withoutSubmitter(
  route: Route,
  ctx: RoutingContext,
  submitterId: string | null | undefined,
): Route {
  if (!submitterId || !route.userIds?.includes(submitterId)) return route;
  const rest = route.userIds.filter((id) => id !== submitterId);
  if (rest.length) return { ...route, userIds: rest };
  const others = ctx.team.filter((u) => u.id !== submitterId);
  return others.length
    ? { ...route, via: "team", userIds: others.map((u) => u.id) }
    : route;
}

/** A pendência é deste login? */
export function reaches(
  user: Pick<User, "id" | "role" | "partyId">,
  route: Route,
): boolean {
  if (route.userIds?.includes(user.id)) return true;
  if (route.party)
    return (
      user.role === route.party.role &&
      !!user.partyId &&
      user.partyId === route.party.partyId
    );
  return !!route.team && isWellmix(user);
}

/** Destino dos avisos: o mesmo da pendência. */
export function notifyTargetOf(route: Route): NotifyTarget {
  if (route.userIds?.length) return { userIds: route.userIds };
  if (route.party)
    return { role: route.party.role, partyId: route.party.partyId };
  return { role: [...WELLMIX_ROLES] };
}

/**
 * Dono da pendência no painel de SLA: o login da Wellmix que a recebeu,
 * quando é um só; senão o analista do pedido.
 */
export function routeOwnerUserId(
  route: Route,
  order: Pick<Order, "ownerUserId">,
  ctx: RoutingContext,
): string | null {
  const [only, ...more] = route.userIds ?? [];
  if (only && !more.length && ctx.team.some((u) => u.id === only)) return only;
  return order.ownerUserId ?? null;
}

/** Nome de quem está com a tarefa, para a visão interna ("Com: …"). */
export async function routeLabel(
  route: Route,
  ctx: RoutingContext,
): Promise<string | null> {
  if (route.party) {
    const party = await getStore().get("parties", route.party.partyId);
    return party?.name ?? null;
  }
  if (route.userIds?.length) {
    const names = route.userIds
      .map((id) => ctx.users.get(id)?.name)
      .filter((n): n is string => !!n);
    return names.length ? names.join(", ") : null;
  }
  return null;
}

/* ------------------------------------------------------------------------ */
/* Raias do pedido de compra: arte, validação, certificado e arte final      */
/* ------------------------------------------------------------------------ */

/*
 * As quatro tarefas da etapa "Die-Cut, Arte e Certificação" do pedido de
 * compra, produto a produto, cada uma no login responsável (dono,
 * 14/11/2026; docs/PURCHASE_ORDER.md, "Quem faz cada tarefa"):
 *
 * - Arte e arte final com o selo: o designer do pedido (cartão Artes), pela
 *   mesma regra de quem faz a arte (`artMakerRoute`).
 * - Validação da arte pela Wellmix: o Operador Wellmix responsável pelo
 *   pedido (o analista), se ele pode validar arte; senão os operadores com a
 *   ação "Validar a arte". Nunca quem faz a arte do pedido nem quem a enviou
 *   (`laneReviewRoute`).
 * - Certificado (Inmetro): a certificadora (OCP) do pedido, em Parceiros do
 *   pedido. Sem ela, o responsável interno designa (`missing: "certifier"`).
 *   Só o certificado das raias: o selo e o memorial do cartão Certificação
 *   continuam com o despachante (dono, 13/11/2026).
 *
 * Quem vê e quem age sai daqui, calculado na hora a partir do pedido: trocar
 * o designer, a certificadora ou o analista muda o dono da tarefa aberta, sem
 * duplicar; o que já foi feito continua com quem fez. O administrador vê
 * todas (gestão interna) e pode agir em qualquer uma.
 */

export { isRoutedLaneKey };

/** O que o encaminhamento das raias lê do pedido. */
export type LaneOrder = Pick<
  Order,
  "designerUserId" | "agencyId" | "ownerUserId" | "ocpId"
>;

/** Os outros itens do pedido (quem enviou a arte não valida a própria arte). */
export type LaneSibling = Pick<Requirement, "key" | "submittedByUserId">;

/** Certificado das raias: a certificadora (OCP) do pedido; sem ela, o responsável interno designa. */
export function laneCertificateRoute(
  order: Pick<Order, "ocpId" | "ownerUserId">,
  ctx: RoutingContext,
): Route {
  if (order.ocpId)
    return { via: "ocp", party: { role: "ocp", partyId: order.ocpId } };
  return { ...internalRoute(order, ctx), missing: "certifier" };
}

/**
 * Validação da arte das raias: o Operador Wellmix responsável pelo pedido (o
 * analista), se ele pode validar arte; senão os operadores com a ação
 * "Validar a arte" (Equipe → Funções e acessos). Nunca quem faz a arte do
 * pedido (o designer) nem quem a enviou. O administrador vê todas, mas não
 * é o responsável: pedido com o administrador como analista vai para os
 * operadores. Sem operador que possa, a regra dos cartões (`artValidatorRoute`).
 */
export function laneReviewRoute(
  order: LaneOrder,
  ctx: RoutingContext,
  submitterId: string | null,
): Route {
  const makers = new Set(artMakerRoute(order, ctx).userIds ?? []);
  const able = ctx.team.filter(
    (u) =>
      u.role === "operator" &&
      u.id !== submitterId &&
      !makers.has(u.id) &&
      canValidateArt(u, ctx),
  );
  const owner = analystOf(order, ctx);
  if (owner && able.some((u) => u.id === owner.id))
    return { via: "analyst", userIds: [owner.id] };
  if (able.length)
    return {
      via: "art_validate",
      userIds: able.map((u) => u.id),
      ...(owner ? {} : { missing: "analyst" as const }),
    };
  return artValidatorRoute(order, ctx, submitterId);
}

/** Quem enviou a arte do mesmo produto (a validação não fica com ele). */
const artSubmitterOf = (key: string, siblings: readonly LaneSibling[]) => {
  const item = itemIdOf(key);
  if (!item) return null;
  const artKey = laneKey(LANE_KEYS.art, item);
  return siblings.find((r) => r.key === artKey)?.submittedByUserId ?? null;
};

/** Quem recebe a tarefa; nulo quando não é uma das quatro. */
export function laneRoute(
  key: string,
  order: LaneOrder,
  ctx: RoutingContext,
  siblings: readonly LaneSibling[] = [],
): Route | null {
  if (!isRoutedLaneKey(key)) return null;
  switch (baseKeyOf(key)) {
    case LANE_KEYS.art:
    case LANE_KEYS.artFinal:
      return artMakerRoute(order, ctx);
    case LANE_KEYS.artReview:
      return laneReviewRoute(order, ctx, artSubmitterOf(key, siblings));
    default:
      return laneCertificateRoute(order, ctx);
  }
}

type LaneUser = Pick<User, "id" | "role" | "partyId"> &
  Partial<Pick<User, "functions" | "screens">>;

/**
 * Vê a tarefa (Pendências, linha do tempo e detalhes da etapa): quem a
 * recebe; o administrador vê todas. Validar a arte, só quem pode validar.
 */
export function seesLaneTask(
  user: LaneUser,
  key: string,
  order: LaneOrder,
  ctx: RoutingContext,
  siblings: readonly LaneSibling[] = [],
): boolean {
  const route = laneRoute(key, order, ctx, siblings);
  if (!route || user.role === "admin") return true;
  if (!reaches(user, route)) return false;
  if (baseKeyOf(key) === LANE_KEYS.artReview)
    return canValidateArt(user as User, ctx);
  return true;
}

/**
 * Pode agir (enviar, trocar o arquivo, validar ou devolver): quem recebe a
 * tarefa; o administrador sempre. O certificado só a certificadora do pedido
 * (o responsável interno que o recebe sem ela só designa); a validação, só
 * quem pode validar arte e nunca quem enviou a arte.
 */
export function canActOnLane(
  user: LaneUser,
  key: string,
  order: LaneOrder,
  ctx: RoutingContext,
  siblings: readonly LaneSibling[] = [],
): boolean {
  const route = laneRoute(key, order, ctx, siblings);
  if (!route || user.role === "admin") return true;
  if (!reaches(user, route)) return false;
  const base = baseKeyOf(key);
  if (base === LANE_KEYS.certificate) return !!route.party;
  if (base === LANE_KEYS.artReview)
    return (
      canValidateArt(user as User, ctx) &&
      artSubmitterOf(key, siblings) !== user.id
    );
  return true;
}

/**
 * Papel gravado na tarefa, coerente com quem a recebe (a etiqueta e os
 * filtros por papel usam): arte e arte final, a agência quando é ela quem faz
 * a arte (o designer da agência ou a agência sem designer); senão a Wellmix.
 * Validação, a Wellmix; certificado, a certificadora.
 */
export function laneRoleFor(
  key: string,
  order: LaneOrder,
  ctx: RoutingContext,
): Role | null {
  if (!isRoutedLaneKey(key)) return null;
  switch (baseKeyOf(key)) {
    case LANE_KEYS.art:
    case LANE_KEYS.artFinal:
      return artMakerRoute(order, ctx).party?.role === "agency" ||
        orderDesigner(order, ctx)?.role === "agency"
        ? "agency"
        : "operator";
    case LANE_KEYS.artReview:
      return "operator";
    default:
      return "ocp";
  }
}

/** Confere no servidor, antes de gravar, se o login pode agir na tarefa. */
export async function assertLaneActor(
  user: User,
  order: Order,
  requirement: Pick<Requirement, "key" | "orderId">,
): Promise<void> {
  if (!isRoutedLaneKey(requirement.key)) return;
  if (user.role === "admin") return;
  const [ctx, siblings] = await Promise.all([
    loadRoutingContext(),
    getStore().list("requirements", {
      filter: { orderId: requirement.orderId },
    }),
  ]);
  if (!canActOnLane(user, requirement.key, order, ctx, siblings)) {
    const { WorkflowError } = await import("@/lib/workflow/engine");
    throw new WorkflowError("lane_not_assignee");
  }
}

/**
 * O que quem faz a arte abre no pedido: a faca e a foto em alta do
 * fornecedor (a base da arte), a arte, o certificado (o selo) e a arte final.
 */
const ART_MAKER_FILES = new Set<string>([
  LANE_KEYS.dieCut,
  LANE_KEYS.hdPhoto,
  LANE_KEYS.art,
  LANE_KEYS.certificate,
  LANE_KEYS.artFinal,
]);

/**
 * Arquivos das raias para quem faz a arte (e para a certificadora o dela):
 * o designer do pedido abre a faca, a foto em alta, a arte, o certificado e a
 * arte final, mesmo os gravados como internos (precisa deles para fazer e
 * finalizar a arte); a certificadora, o certificado.
 */
export async function laneDocumentAccess(
  user: User,
  order: Order,
  requirementId: string,
): Promise<boolean> {
  const requirement = await getStore().get("requirements", requirementId);
  if (!requirement || requirement.orderId !== order.id) return false;
  if (!itemIdOf(requirement.key)) return false;
  const base = baseKeyOf(requirement.key);
  if (!ART_MAKER_FILES.has(base)) return false;
  const ctx = await loadRoutingContext();
  if (reaches(user, artMakerRoute(order, ctx))) return true;
  return (
    base === LANE_KEYS.certificate &&
    reaches(user, laneCertificateRoute(order, ctx))
  );
}
