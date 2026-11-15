import "server-only";

import type { Translate } from "@/i18n";
import { getStore, type Order, type Requirement, type Role } from "@/lib/db";
import { listColumns } from "@/lib/db/lookup";
import {
  milestoneDueOf,
  milestoneOfStatus,
  orderMilestoneText,
  responsibleOfItems,
  type CompactMilestone,
} from "@/lib/milestones";
import { storedMilestone } from "./order-milestones";

/*
 * Coluna "Marco" da exportação das solicitações (fase 4d, docs/MILESTONES.md
 * "Sankhya, regras e painéis"): o marco atual do pedido gerado, pelo resumo
 * (`order_summaries.facts.m`, só essa chave) ou, sem resumo no formato atual,
 * pela situação (`milestoneOfStatus`). A coluna "Etapa do pedido" continua.
 */

/** Marcos guardados no resumo dos pedidos dados (só os do formato atual). */
export async function orderMilestonesOf(
  ids: string[],
): Promise<Map<string, CompactMilestone[]>> {
  const out = new Map<string, CompactMilestone[]>();
  if (!ids.length) return out;
  const { SUMMARY_VERSION } = await import("./order-summary");
  const rows = await listColumns(
    getStore(),
    "order_summaries",
    ["version", "facts"],
    { filter: { id: ids }, jsonKeys: { facts: ["m"] } },
  ).catch(() => []);
  for (const row of rows) {
    const m = (row.facts as { m?: CompactMilestone[] } | null)?.m;
    if (row.version === SUMMARY_VERSION && m?.length) out.set(row.id, m);
  }
  return out;
}

/** Texto da célula: "N. Marco"; cancelado ou sem marco, o nome da situação. */
export const exportMilestoneCell = (
  t: Translate,
  status: string,
  m?: readonly CompactMilestone[] | null,
) => orderMilestoneText(t, status, m);

/**
 * Quem age agora e o prazo de cada pedido (fase 5g, no lugar da etapa
 * atual, `orders.currentStageId`): do resumo (`facts.resp` e o prazo dos
 * marcos em andamento, `facts.m`); sem resumo, dos itens e das linhas de
 * `order_milestones` gravados.
 */
export async function orderNextInfoOf(
  orders: readonly Pick<Order, "id" | "status" | "milestoneKey">[],
): Promise<
  Map<string, { responsibleRole: Role | null; dueAt: string | null }>
> {
  const out = new Map<
    string,
    { responsibleRole: Role | null; dueAt: string | null }
  >();
  const ids = orders.map((o) => o.id);
  if (!ids.length) return out;
  const store = getStore();
  const { SUMMARY_VERSION } = await import("./order-summary");
  const rows = await listColumns(
    store,
    "order_summaries",
    ["version", "facts"],
    {
      filter: { id: ids },
      jsonKeys: { facts: ["m", "resp"] },
    },
  ).catch(() => []);
  for (const row of rows) {
    const f = row.facts as {
      m?: CompactMilestone[];
      resp?: Role | null;
    } | null;
    if (row.version !== SUMMARY_VERSION || !f) continue;
    out.set(row.id, {
      responsibleRole: f.resp ?? null,
      dueAt: milestoneDueOf(f.m) ?? null,
    });
  }
  const missing = orders.filter((o) => !out.has(o.id));
  if (!missing.length) return out;
  const missingIds = missing.map((o) => o.id);
  const [items, milestoneRows] = await Promise.all([
    listColumns(
      store,
      "requirements",
      ["orderId", "key", "step", "milestoneKey", "required", "status", "role"],
      { filter: { orderId: missingIds } },
    ),
    store
      .list("order_milestones", {
        filter: { orderId: missingIds, status: ["active", "blocked"] },
      })
      .catch(() => []),
  ]);
  for (const o of missing)
    out.set(o.id, {
      responsibleRole: responsibleOfItems(
        storedMilestone(o.milestoneKey) ?? milestoneOfStatus(o.status),
        (items as Requirement[]).filter((r) => r.orderId === o.id),
      ),
      dueAt:
        milestoneDueOf(
          null,
          milestoneRows.filter((r) => r.orderId === o.id),
        ) ?? null,
    });
  return out;
}
