import "server-only";
import { cache } from "react";
import { can, holdersOf, type FunctionDef } from "@/lib/auth/function-access";
import { isWellmix, WELLMIX_ROLES } from "@/lib/auth/permissions";
import { getStore, type Order, type User } from "@/lib/db";
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
 * - Selo: a certificadora (OCP) do pedido.
 * - Memorial descritivo: o responsável interno (o analista); a validação, a
 *   certificadora.
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
  party?: { role: "ocp" | "agency"; partyId: string };
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

/** A certificadora (OCP) do pedido; sem ela, o responsável interno designa. */
export function ocpRoute(
  order: Pick<Order, "ocpId" | "ownerUserId">,
  ctx: RoutingContext,
): Route {
  if (order.ocpId)
    return { via: "ocp", party: { role: "ocp", partyId: order.ocpId } };
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
