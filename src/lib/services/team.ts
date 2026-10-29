import "server-only";

import {
  WELLMIX_FUNCTIONS,
  getStore,
  type Division,
  type JobLevel,
  type User,
  type WellmixFunction,
} from "@/lib/db";
import { ForbiddenError, isAdmin } from "@/lib/auth/permissions";
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
    /** Funções (comprador, planner, diretoria…); ausente = não muda. */
    functions?: WellmixFunction[];
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
  };
  const functions = input.functions
    ? WELLMIX_FUNCTIONS.filter((f) => input.functions!.includes(f))
    : undefined;
  await store.update("users", target.id, {
    jobLevel: input.jobLevel,
    managerUserId: input.managerUserId,
    division: input.division,
    ...(functions ? { functions } : {}),
  });
  await audit(
    user,
    "team.member",
    "user",
    target.id,
    `Equipe: ${target.name} (cargo, chefe, divisão e funções)`,
    before,
    input,
  );
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

/** Pendências abertas por analista: solicitações antes do pedido e pedidos em andamento. */
async function openLoad(): Promise<Map<string, number>> {
  const store = getStore();
  const [requests, orders] = await Promise.all([
    store.list("requests", {
      filter: {
        status: [
          "REQUESTED",
          "RFQ_OPEN",
          "QUOTATION_RECEIVED",
          "SUPPLIER_SELECTED",
          "WAITING_DOWN_PAYMENT",
        ],
      },
    }),
    store.list("orders"),
  ]);
  const load = new Map<string, number>();
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
  context?: { team: User[]; load: Map<string, number> },
): Promise<string | null> {
  if (!productId) return null;
  const store = getStore();
  const product = await store.get("products", productId);
  if (!product?.lineId) return null;
  const line = await store.get("product_lines", product.lineId);
  const division = line?.division ?? null;
  if (!division) return null;
  const team = context?.team ?? (await wellmixTeam());
  const candidates = team.filter((u) => u.division === division);
  if (!candidates.length) return null;
  const load = context?.load ?? (await openLoad());
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
 */
export async function distributeUnassigned(
  user: User,
): Promise<{ requests: number; orders: number }> {
  if (!isAdmin(user)) throw new ForbiddenError();
  const store = getStore();
  const context = { team: await wellmixTeam(), load: await openLoad() };
  const valid = (id: string | null | undefined) =>
    !!id && context.team.some((u) => u.id === id);
  const result = { requests: 0, orders: 0 };
  const open = await store.list("requests", {
    filter: {
      status: [
        "REQUESTED",
        "RFQ_OPEN",
        "QUOTATION_RECEIVED",
        "SUPPLIER_SELECTED",
        "WAITING_DOWN_PAYMENT",
      ],
    },
  });
  for (const r of open) {
    if (valid(r.ownerUserId)) continue;
    const owner = await pickOwner(r.productId, context);
    if (!owner) continue;
    await store.update("requests", r.id, { ownerUserId: owner });
    result.requests++;
  }
  const orders = (await store.list("orders")).filter(
    (o) =>
      o.status !== "CLOSED" &&
      o.status !== "CANCELLED" &&
      !valid(o.ownerUserId),
  );
  for (const o of orders) {
    const request = o.requestId
      ? await store.get("requests", o.requestId)
      : null;
    let owner = valid(request?.ownerUserId) ? request!.ownerUserId! : null;
    if (!owner) {
      const [item] = await store.list("order_items", {
        filter: { orderId: o.id },
        limit: 1,
      });
      owner = await pickOwner(item?.productId ?? request?.productId, context);
    }
    if (!owner) continue;
    await store.update("orders", o.id, { ownerUserId: owner });
    result.orders++;
  }
  await audit(
    user,
    "team.distribute",
    "system",
    "team",
    `Distribuição automática: ${result.requests} solicitação(ões) e ${result.orders} pedido(s)`,
  );
  return result;
}
