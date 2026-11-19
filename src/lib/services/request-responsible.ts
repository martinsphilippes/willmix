import "server-only";

import type { Request, User } from "@/lib/db";
import { getStore } from "@/lib/db";
import { listByIds } from "@/lib/db/lookup";
import { isAdmin, isWellmix } from "@/lib/auth/permissions";
import {
  accessFromFunctions,
  functionLabel,
  type ActionKey,
} from "@/lib/auth/function-access";
import { screensFor } from "@/lib/auth/screens";
import type { TaskGate } from "@/lib/task-owner";
import type { PeopleDirectory, Person } from "@/lib/request-responsible";
import type { RequestTurnContext } from "./request-turns";

/*
 * Pessoas de cada passo da encomenda (dono, 19/11/2026; docs/ORDER_LEVEL_LISTS.md,
 * seção 6): quem tem a função ou a tela da etapa (a porta das Pendências),
 * os administradores, os logins do cliente que confirmam e os logins dos
 * parceiros. Só leitura; nada é gravado.
 *
 * O login (e-mail) só vai para o administrador, como na Equipe Externa
 * (docs/EQUIPE_ACESSOS.md); os outros veem o nome e a empresa ou papel.
 */

/** Login que pode agir agora: ativo e não suspenso. */
const canAct = (u: User) => u.active !== false && !u.loginSuspended;

export async function peopleDirectory(
  viewer: User,
  input: {
    /** Todos os logins (a lista já os lê para o Analista). */
    users: readonly User[];
    requests: readonly Request[];
    ctx: RequestTurnContext | null;
    /** Parceiros dos passos do fornecedor (cotação, solicitação, amostragem). */
    partnerIds: readonly string[];
    /** Nome do cliente pelo id (os clientes da lista). */
    customerName: (id: string) => string | null;
    translate: (key: string) => string;
  },
): Promise<PeopleDirectory> {
  const showLogin = isAdmin(viewer);
  const person = (u: User): Person => ({
    id: u.id,
    name: u.name,
    login: showLogin ? (u.email ?? null) : null,
  });
  const byName = (a: Person, b: Person) => a.name.localeCompare(b.name, "pt");
  const { loadFunctionDefs } = await import("./team-functions");
  const defs = isWellmix(viewer) ? await loadFunctionDefs() : [];
  const wellmix = input.users.filter(
    (u) => (u.role === "admin" || u.role === "operator") && canAct(u),
  );
  const admins = wellmix
    .filter((u) => u.role === "admin")
    .map(person)
    .sort(byName);
  const operators = wellmix.filter((u) => u.role === "operator");
  const accessOf = new Map(
    operators.map((u) => [u.id, accessFromFunctions(u.functions, defs)]),
  );
  const passes = (u: User, gate: TaskGate) => {
    const access = accessOf.get(u.id);
    if (!access) return false;
    if ("admin" in gate) return false;
    if ("action" in gate) return access.actions.includes(gate.action);
    return screensFor(u, access).has(gate.screen);
  };
  const has = (u: User, action: ActionKey) =>
    !!accessOf.get(u.id)?.actions.includes(action);
  const teamCache = new Map<string, ReturnType<PeopleDirectory["team"]>>();
  const team: PeopleDirectory["team"] = (gate, except) => {
    const key = `${JSON.stringify(gate)}|${except ?? ""}`;
    const cached = teamCache.get(key);
    if (cached) return cached;
    const holders = operators.filter(
      (u) => passes(u, gate) && !(except && has(u, except)),
    );
    // As funções que liberam a etapa a essas pessoas (o nome da equipe).
    const keys = new Set<string>();
    for (const u of holders)
      for (const fn of u.functions ?? []) {
        const def = defs.find((d) => d.key === fn && !d.archived);
        if (!def) continue;
        const grants =
          "action" in gate
            ? def.actions.includes(gate.action)
            : "screen" in gate
              ? def.screens.includes(gate.screen)
              : false;
        if (grants) keys.add(fn);
      }
    const out = {
      people: holders.map(person).sort(byName),
      functions: [...keys]
        .map((k) => functionLabel(k, defs, input.translate))
        .sort((a, b) => a.localeCompare(b, "pt")),
    };
    teamCache.set(key, out);
    return out;
  };
  const usersById = new Map(input.users.map((u) => [u.id, u]));
  const requestById = new Map(input.requests.map((r) => [r.id, r]));
  const partners = await listByIds(getStore(), "parties", [
    ...new Set(input.partnerIds),
  ]);
  const partnerById = new Map(partners.map((p) => [p.id, p]));
  const external = (u: User) =>
    u.role !== "admin" && u.role !== "operator" && u.role !== "customer";
  return {
    team,
    admins: () => admins,
    confirmers: (requestId) => {
      const request = requestById.get(requestId);
      if (!request || !input.ctx) return [];
      return input.ctx
        .confirmersOf(request)
        .map((id) => usersById.get(id))
        .filter((u): u is User => !!u && canAct(u))
        .map(person)
        .sort(byName);
    },
    customer: (id) => input.customerName(id),
    partner: (partyId) => ({
      name: partnerById.get(partyId)?.name ?? "—",
      people: input.users
        .filter((u) => u.partyId === partyId && external(u) && canAct(u))
        .map(person)
        .sort(byName),
    }),
  };
}
