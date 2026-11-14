import "server-only";
import { indexBy, listByIds } from "@/lib/db/lookup";
import { loadFunctionDefs } from "./team-functions";

import {
  getStore,
  type Division,
  type JobLevel,
  type RequestStatus,
  type User,
} from "@/lib/db";
import { ForbiddenError, isAdmin } from "@/lib/auth/permissions";
import { WELLMIX_BASE, validScreens } from "@/lib/auth/screens";
import { loginLabel } from "@/lib/auth/login-id";
import { audit } from "./audit";

/*
 * Equipe da Wellmix e divisões (painel de SLA, docs/SLA_PANEL.md). Cada login
 * da Wellmix tem cargo, chefe e divisão (Wellmix ou WellKids); cada linha de
 * produto pertence a uma divisão. A solicitação nova cai sozinha no analista
 * da divisão da linha do produto com menos pendências abertas, e o pedido
 * herda. Quem vê o painel de quem: o administrador vê todos; os demais, o
 * próprio e de toda a equipe abaixo. Só o administrador muda equipe e linhas.
 */

export class TeamError extends Error {}

/** Logins ativos da Wellmix (admin e operadores), por nome. */
export async function wellmixTeam(): Promise<User[]> {
  const users = await getStore().list("users", {
    filter: { role: ["admin", "operator"], active: true },
    orderBy: "name",
  });
  return users;
}

/**
 * Ids de quem está abaixo do login na árvore (subordinados diretos e os
 * deles), sem ele. Resistente a ciclo (cadastro antigo ou corrompido).
 */
export function descendantsOf(userId: string, team: User[]): Set<string> {
  const below = new Set<string>();
  const queue = [userId];
  while (queue.length) {
    const current = queue.shift()!;
    for (const u of team)
      if (u.managerUserId === current && u.id !== userId && !below.has(u.id)) {
        below.add(u.id);
        queue.push(u.id);
      }
  }
  return below;
}

/** Quem o login vê no painel: admin, todos; os demais, ele e quem está abaixo. */
export function visibleTeamIds(viewer: User, team: User[]): Set<string> {
  if (isAdmin(viewer)) return new Set(team.map((u) => u.id));
  return new Set([viewer.id, ...descendantsOf(viewer.id, team)]);
}

/** Muda cargo e chefe de um login da Wellmix (só admin; sem ciclo). */
export async function setTeamMember(
  user: User,
  targetId: string,
  input: {
    jobLevel: JobLevel | null;
    managerUserId: string | null;
    division: Division | null;
    /** Funções (de fábrica ou criadas); ausente = não muda. */
    functions?: string[];
    /**
     * Telas marcadas uma a uma (docs/ACCESS.md): lista = personalizado;
     * null = volta ao padrão das funções; ausente = não muda.
     */
    screens?: string[] | null;
    /**
     * Telas do Início desmarcadas no Personalizado (users.screensBaseOff):
     * lista = grava; null = todas abrem; ausente = não muda. Com
     * `screens: null` (padrão das funções) volta a nula.
     */
    screensBaseOff?: string[] | null;
  },
): Promise<void> {
  if (!isAdmin(user)) throw new ForbiddenError();
  const store = getStore();
  const team = await wellmixTeam();
  const target = team.find((u) => u.id === targetId);
  if (!target) throw new TeamError("not_found");
  if (input.managerUserId) {
    if (input.managerUserId === target.id) throw new TeamError("manager_self");
    if (!team.some((u) => u.id === input.managerUserId))
      throw new TeamError("manager_invalid");
    // O chefe não pode estar abaixo do próprio subordinado.
    if (descendantsOf(target.id, team).has(input.managerUserId))
      throw new TeamError("manager_cycle");
  }
  const before = {
    jobLevel: target.jobLevel ?? null,
    managerUserId: target.managerUserId ?? null,
    division: target.division ?? null,
    functions: target.functions ?? [],
    screens: target.screens ?? null,
    screensBaseOff: target.screensBaseOff ?? null,
  };
  // Só funções existentes e ativas, na ordem da lista (Equipe → Funções e acessos).
  const defs = input.functions ? await loadFunctionDefs() : [];
  const functions = input.functions
    ? defs
        .filter((d) => !d.archived && input.functions!.includes(d.key))
        .map((d) => d.key)
    : undefined;
  // Telas: só chaves válidas, sem o Início (que tem a lista própria abaixo).
  const screens =
    input.screens === undefined
      ? undefined
      : input.screens === null
        ? null
        : validScreens(input.screens).filter((s) => !WELLMIX_BASE.includes(s));
  // Início desmarcado no Personalizado: só telas do Início, na ordem do menu;
  // vazia vira nula (todas abrem). Padrão das funções: nula. Grava só quando
  // muda (o login que nunca teve a lista continua sem ela).
  const baseOffInput = screens === null ? null : input.screensBaseOff;
  const baseOffOf = (list: unknown) => {
    const valid = validScreens(list);
    const off = WELLMIX_BASE.filter((s) => valid.includes(s));
    return off.length ? off : null;
  };
  const screensBaseOff =
    baseOffInput === undefined ? undefined : baseOffOf(baseOffInput);
  const baseOffChanged =
    screensBaseOff !== undefined &&
    JSON.stringify(screensBaseOff) !==
      JSON.stringify(baseOffOf(target.screensBaseOff));
  await store.update("users", target.id, {
    jobLevel: input.jobLevel,
    managerUserId: input.managerUserId,
    division: input.division,
    ...(functions ? { functions } : {}),
    ...(screens !== undefined ? { screens } : {}),
    ...(baseOffChanged ? { screensBaseOff } : {}),
  });
  await audit(
    user,
    "team.member",
    "user",
    target.id,
    `Equipe: ${target.name} (cargo, chefe, divisão, funções e telas)`,
    before,
    {
      ...input,
      ...(screens !== undefined ? { screens } : {}),
      ...(screensBaseOff !== undefined ? { screensBaseOff } : {}),
    },
  );
}

/**
 * O que a tela mostra antes de excluir o acesso: quantas pessoas respondem a
 * ela, para quem elas podem passar (o chefe dela, se ativo), quantas
 * pendências abertas estão com ela e se é o último administrador.
 */
export async function teamMemberRemoval(
  member: User,
  team: User[],
): Promise<{
  reports: number;
  moveTo: { id: string; name: string } | null;
  openWork: number;
  lastAdmin: boolean;
}> {
  const load = await openLoad([member]);
  const boss = reportsTarget(member, team);
  return {
    reports: team.filter((u) => u.managerUserId === member.id).length,
    moveTo: boss ? { id: boss.id, name: boss.name } : null,
    openWork: load.get(member.id) ?? 0,
    lastAdmin:
      isAdmin(member) && !team.some((u) => isAdmin(u) && u.id !== member.id),
  };
}

/** O chefe de quem sai, se ainda está ativo na equipe: recebe os subordinados. */
function reportsTarget(member: User, team: User[]): User | null {
  const boss = member.managerUserId
    ? team.find((u) => u.id === member.managerUserId)
    : null;
  return boss && boss.id !== member.id ? boss : null;
}

/** Opções da confirmação de "Excluir acesso" (marcadas por padrão na tela). */
export interface RemovalOptions {
  /** Quem respondia à pessoa passa a responder ao chefe dela. */
  moveReports?: boolean;
  /** As pendências abertas dela vão para a divisão, como "Distribuir agora". */
  redistribute?: boolean;
}

export interface RemovalResult {
  removed: User;
  /** Quantas pessoas passaram para o chefe dela, e quem é ele. */
  moved: number;
  movedTo: User | null;
  /** Pendências que passaram para outra pessoa da divisão. */
  redistributed: number;
  /** Pendências dela que ficaram sem responsável (linha sem divisão etc.). */
  unassigned: number;
}

/**
 * Exclui o acesso de um login da equipe (pedido do dono, 13/11/2026): o login
 * fica inativo e sai da equipe. Não entra mais no portal, e as sessões abertas
 * caem na próxima página (a sessão relê o login a cada requisição). Nada é
 * apagado: o cadastro, o histórico, os registros ligados a ele e a autoria
 * das ações anteriores continuam. Só o administrador; não exclui o próprio
 * acesso nem o último administrador ativo. Fica na Auditoria quem excluiu,
 * qual acesso e quando.
 */
export async function removeTeamMember(
  user: User,
  targetId: string,
  options: RemovalOptions = {},
): Promise<RemovalResult> {
  if (!isAdmin(user)) throw new ForbiddenError();
  const store = getStore();
  const team = await wellmixTeam();
  const target = team.find((u) => u.id === targetId);
  if (!target) throw new TeamError("not_found");
  if (target.id === user.id) throw new TeamError("delete_self");
  const otherAdmins = (list: User[]) =>
    list.some((u) => isAdmin(u) && u.id !== target.id);
  if (isAdmin(target) && !otherAdmins(team))
    throw new TeamError("delete_last_admin");
  await store.update("users", target.id, { active: false });
  try {
    // Dois administradores excluindo um ao outro ao mesmo tempo: se não
    // sobrou nenhum ativo, esta exclusão é desfeita.
    if (isAdmin(target) && !otherAdmins(await wellmixTeam()))
      throw new TeamError("delete_last_admin");
    await audit(
      user,
      "team.member.delete",
      "user",
      target.id,
      `Acesso excluído: ${target.name} (${loginLabel(target.email)})`,
      {
        active: true,
        role: target.role,
        jobLevel: target.jobLevel ?? null,
        managerUserId: target.managerUserId ?? null,
        division: target.division ?? null,
        functions: target.functions ?? [],
        screens: target.screens ?? null,
      },
      { active: false },
    );
  } catch (error) {
    // Nada pela metade: sem o registro na Auditoria (ou deixando a equipe sem
    // administrador), o acesso volta como estava e a tela mostra o erro.
    await store
      .update("users", target.id, { active: true })
      .catch((undo) => console.error("[team] desfazer exclusão", undo));
    throw error;
  }
  const { forgetUserSessions } = await import("@/lib/auth/session");
  forgetUserSessions(target.id);
  const result: RemovalResult = {
    removed: target,
    moved: 0,
    movedTo: null,
    redistributed: 0,
    unassigned: 0,
  };
  // Opções da confirmação, depois da exclusão já gravada. Se falharem, a
  // exclusão fica (está na Auditoria) e a tela diz o que conferir; cada
  // passagem também vai para a Auditoria (team.member e team.distribute).
  try {
    if (options.moveReports) {
      const after = await wellmixTeam();
      const boss = reportsTarget(target, after);
      if (boss)
        for (const report of after.filter(
          (u) => u.managerUserId === target.id && u.id !== boss.id,
        )) {
          // Cadastro antigo com ciclo: essa pessoa fica para ajustar à mão.
          if (descendantsOf(report.id, after).has(boss.id)) continue;
          await setTeamMember(user, report.id, {
            jobLevel: report.jobLevel ?? null,
            managerUserId: boss.id,
            division: report.division ?? null,
          });
          result.moved++;
          result.movedTo = boss;
        }
    }
    if (options.redistribute) {
      const done = await distributeUnassigned(user, {
        fromUserId: target.id,
        fromName: target.name,
      });
      result.redistributed = done.requests + done.orders;
      result.unassigned = done.left;
    }
  } catch (error) {
    console.error("[team] depois de excluir o acesso", error);
    throw new TeamError("delete_followup");
  }
  return result;
}

/** Define a divisão de uma linha de produto (só admin). */
export async function setLineDivision(
  user: User,
  lineId: string,
  division: Division | null,
): Promise<void> {
  if (!isAdmin(user)) throw new ForbiddenError();
  const store = getStore();
  const line = await store.get("product_lines", lineId);
  if (!line) throw new TeamError("not_found");
  await store.update("product_lines", line.id, { division });
  await audit(
    user,
    "team.line_division",
    "product_line",
    line.id,
    `Divisão da linha ${line.name}`,
    { division: line.division ?? null },
    { division },
  );
}

const OPEN_REQUEST_STATUSES: RequestStatus[] = [
  "REQUESTED",
  "RFQ_OPEN",
  "QUOTATION_RECEIVED",
  "SUPPLIER_SELECTED",
  "WAITING_DOWN_PAYMENT",
];

/**
 * Pendências abertas por analista: solicitações antes do pedido e pedidos em
 * andamento. Só os analistas dados contam (os pedidos sem dono da equipe,
 * como os milhares do histórico do Sankhya, nem são lidos).
 */
async function openLoad(team: User[]): Promise<Map<string, number>> {
  const store = getStore();
  const load = new Map<string, number>();
  const ids = team.map((u) => u.id);
  if (!ids.length) return load;
  const [requests, orders] = await Promise.all([
    store.list("requests", {
      filter: { status: OPEN_REQUEST_STATUSES, ownerUserId: ids },
    }),
    store.list("orders", { filter: { ownerUserId: ids } }),
  ]);
  const add = (id: string | null | undefined) => {
    if (id) load.set(id, (load.get(id) ?? 0) + 1);
  };
  for (const r of requests) add(r.ownerUserId);
  for (const o of orders)
    if (o.status !== "CLOSED" && o.status !== "CANCELLED") add(o.ownerUserId);
  return load;
}

/**
 * Analista para um produto: a divisão da linha do produto; entre os analistas
 * ativos da divisão, o com menos pendências abertas (empate: ordem do nome).
 * Sem produto, sem linha, linha sem divisão ou divisão sem analista: nulo.
 */
export async function pickOwner(
  productId: string | null | undefined,
  context?: {
    team: User[];
    load: Map<string, number>;
    /** Divisão já lida de cada produto (distribuição em lote). */
    divisionOf?: (productId: string) => string | null | undefined;
  },
): Promise<string | null> {
  if (!productId) return null;
  const store = getStore();
  let division: string | null | undefined;
  if (context?.divisionOf) division = context.divisionOf(productId);
  else {
    const product = await store.get("products", productId);
    if (!product?.lineId) return null;
    const line = await store.get("product_lines", product.lineId);
    division = line?.division ?? null;
  }
  if (!division) return null;
  const team = context?.team ?? (await wellmixTeam());
  const candidates = team.filter((u) => u.division === division);
  if (!candidates.length) return null;
  const load = context?.load ?? (await openLoad(team));
  const chosen = [...candidates].sort(
    (a, b) => (load.get(a.id) ?? 0) - (load.get(b.id) ?? 0),
  )[0];
  load.set(chosen.id, (load.get(chosen.id) ?? 0) + 1);
  return chosen.id;
}

/**
 * Distribui o que está sem responsável (só admin): solicitações abertas pela
 * divisão da linha do produto; pedidos em andamento pela solicitação (ou pelo
 * produto do pedido). Para dados de antes da regra ou de antes da divisão.
 * Com `fromUserId` (Excluir acesso), só as pendências daquele login; as
 * outras sem responsável ficam para "Distribuir agora". `left`: as que não
 * tinham para quem ir (linha sem divisão ou divisão sem analista).
 */
export async function distributeUnassigned(
  user: User,
  scope: { fromUserId?: string; fromName?: string } = {},
): Promise<{ requests: number; orders: number; left: number }> {
  if (!isAdmin(user)) throw new ForbiddenError();
  const store = getStore();
  const team = await wellmixTeam();
  const valid = (id: string | null | undefined) =>
    !!id && team.some((u) => u.id === id);
  const inScope = (id: string | null | undefined) =>
    !scope.fromUserId || id === scope.fromUserId;
  const result = { requests: 0, orders: 0, left: 0 };
  const [load, openAll, liveOrders] = await Promise.all([
    openLoad(team),
    store.list("requests", { filter: { status: OPEN_REQUEST_STATUSES } }),
    store.list("orders"),
  ]);
  const open = openAll.filter((r) => inScope(r.ownerUserId));
  const orders = liveOrders.filter(
    (o) =>
      o.status !== "CLOSED" &&
      o.status !== "CANCELLED" &&
      !valid(o.ownerUserId) &&
      inScope(o.ownerUserId),
  );
  // Lidos de uma vez (antes: solicitação, item, produto e linha por pedido).
  const [orderRequests, items] = await Promise.all([
    listByIds(
      store,
      "requests",
      orders.map((o) => o.requestId),
    ),
    orders.length
      ? store.list("order_items", {
          filter: { orderId: orders.map((o) => o.id) },
        })
      : Promise.resolve([]),
  ]);
  const requestById = indexBy(orderRequests, "id");
  const firstItem = indexBy(items, "orderId");
  const products = indexBy(
    await listByIds(store, "products", [
      ...open.map((r) => r.productId),
      ...items.map((i) => i.productId),
      ...orderRequests.map((r) => r.productId),
    ]),
    "id",
  );
  const lines = indexBy(
    await listByIds(
      store,
      "product_lines",
      [...products.values()].map((p) => p.lineId),
    ),
    "id",
  );
  const context = {
    team,
    load,
    divisionOf: (productId: string) => {
      const lineId = products.get(productId)?.lineId;
      return lineId ? (lines.get(lineId)?.division ?? null) : null;
    },
  };
  for (const r of open) {
    if (valid(r.ownerUserId)) continue;
    const owner = await pickOwner(r.productId, context);
    if (!owner) {
      result.left++;
      continue;
    }
    await store.update("requests", r.id, { ownerUserId: owner });
    // O pedido desta solicitação herda o responsável logo abaixo (como antes,
    // quando a solicitação era lida de novo depois desta passada).
    const same = requestById.get(r.id);
    if (same) same.ownerUserId = owner;
    result.requests++;
  }
  for (const o of orders) {
    const request = o.requestId ? requestById.get(o.requestId) : null;
    let owner = valid(request?.ownerUserId) ? request!.ownerUserId! : null;
    if (!owner)
      owner = await pickOwner(
        firstItem.get(o.id)?.productId ?? request?.productId,
        context,
      );
    if (!owner) {
      result.left++;
      continue;
    }
    await store.update("orders", o.id, { ownerUserId: owner });
    result.orders++;
  }
  await audit(
    user,
    "team.distribute",
    "system",
    "team",
    scope.fromUserId
      ? `Distribuição das pendências de ${scope.fromName ?? "acesso excluído"} (acesso excluído): ${result.requests} solicitação(ões) e ${result.orders} pedido(s)`
      : `Distribuição automática: ${result.requests} solicitação(ões) e ${result.orders} pedido(s)`,
  );
  return result;
}
