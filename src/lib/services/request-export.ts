import "server-only";

import type { Translate } from "@/i18n";
import { getStore } from "@/lib/db";
import { listColumns } from "@/lib/db/lookup";
import { orderMilestoneText, type CompactMilestone } from "@/lib/milestones";

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
