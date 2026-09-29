import "server-only";

import { getStore, type ReviewItem, type Role, type User } from "@/lib/db";
import { assertWellmix } from "@/lib/auth/permissions";
import { audit } from "./audit";

/**
 * Fila "itens para revisão": cada regra violada vira um item com esperado × encontrado,
 * responsável e ação. Regras são código determinístico (nunca IA). Um item por
 * (entidade, regra): a mesma violação repetida atualiza o item aberto em vez de duplicar.
 */
export interface OpenReviewInput {
  orderId?: string | null;
  entity: string;
  entityId: string;
  rule: string;
  problem: string;
  expected?: string | number | null;
  found?: string | number | null;
  responsibleRole?: Role | null;
  action?: string | null;
  link?: string | null;
}

const asText = (v: string | number | null | undefined) =>
  v === null || v === undefined ? null : String(v).slice(0, 120);

export async function openReview(
  user: User | null,
  input: OpenReviewInput,
): Promise<ReviewItem> {
  const store = getStore();
  const [existing] = await store.list("review_items", {
    filter: {
      entity: input.entity,
      entityId: input.entityId,
      rule: input.rule,
      status: "open",
    },
    limit: 1,
  });
  const data = {
    orderId: input.orderId ?? null,
    entity: input.entity,
    entityId: input.entityId,
    rule: input.rule,
    problem: input.problem.slice(0, 2000),
    expected: asText(input.expected),
    found: asText(input.found),
    responsibleRole: input.responsibleRole ?? "operator",
    action: input.action ?? null,
    link: input.link ?? null,
  };
  if (existing) {
    return store.update("review_items", existing.id, data);
  }
  const item = await store.create("review_items", {
    ...data,
    status: "open",
    resolvedByUserId: null,
    resolvedAt: null,
    resolutionNote: null,
  });
  await audit(
    user,
    "review.open",
    "review_item",
    item.id,
    `${input.rule}: ${input.problem}`,
  );
  return item;
}

/** Resolve (ou dispensa) os itens abertos de uma entidade, opcionalmente só de um prefixo de regra. */
export async function resolveReviews(
  user: User | null,
  entity: string,
  entityId: string,
  options: {
    rulePrefix?: string;
    status?: "resolved" | "dismissed";
    note?: string;
  } = {},
) {
  const store = getStore();
  const open = await store.list("review_items", {
    filter: { entity, entityId, status: "open" },
  });
  const now = new Date().toISOString();
  let count = 0;
  for (const item of open) {
    if (options.rulePrefix && !item.rule.startsWith(options.rulePrefix))
      continue;
    await store.update("review_items", item.id, {
      status: options.status ?? "resolved",
      resolvedByUserId: user?.id ?? null,
      resolvedAt: now,
      resolutionNote: options.note ?? null,
    });
    count++;
  }
  return count;
}

export async function resolveReviewById(
  user: User,
  id: string,
  status: "resolved" | "dismissed",
  note?: string | null,
) {
  assertWellmix(user);
  const store = getStore();
  const item = await store.get("review_items", id);
  if (!item) throw new Error("review_not_found");
  const updated = await store.update("review_items", id, {
    status,
    resolvedByUserId: user.id,
    resolvedAt: new Date().toISOString(),
    resolutionNote: note ?? null,
  });
  await audit(
    user,
    `review.${status}`,
    "review_item",
    id,
    `${item.rule}: ${note ?? ""}`,
  );
  return updated;
}

export async function listOpenReviews(orderId?: string) {
  const store = getStore();
  return store.list("review_items", {
    filter: orderId ? { status: "open", orderId } : { status: "open" },
    orderBy: "createdAt",
    direction: "desc",
  });
}
