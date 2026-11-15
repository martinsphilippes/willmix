import "server-only";

import { getStore, type Order } from "@/lib/db";
import { isHeld } from "@/lib/db/store";
import {
  milestoneEvent,
  ruleDoesSomething,
  type MilestoneEventKey,
  type ProcessRule,
} from "@/lib/process-rules";
import type { MilestoneKey } from "@/lib/milestones";
import { audit } from "./audit";

/*
 * Eventos de marco das regras de processo (fase 4d, docs/MILESTONES.md
 * "Sankhya, regras e painéis"): `milestone:<marco>:start` quando o marco
 * passa a "em andamento" e `milestone:<marco>:done` quando conclui com todas
 * as subtarefas feitas. Disparados do mesmo ponto do aviso aos informados
 * (`applySummaryChanges`, recálculo por evento), nunca na reconstrução.
 *
 * - Uma vez por evento e pedido: o disparo fica na auditoria
 *   (`milestone.event`, com o evento). Se o marco reabrir e passar de novo,
 *   não dispara outra vez.
 * - Só o evento com regra ativa que faz alguma coisa é disparado (e
 *   auditado); o motor das regras (`emitProcessEvent`) faz o resto, como nos
 *   eventos de etapa.
 * - Histórico do Sankhya em espera e pedido cancelado: nada (a carga do
 *   histórico não passa pelas regras; os eventos de etapa antigos continuam
 *   como eram).
 */

export const MILESTONE_EVENT_ACTION = "milestone.event";

/** Eventos que a transição gera, na ordem: os que começam, depois os que concluem. */
export function milestoneTransitionEvents(
  started: readonly MilestoneKey[],
  done: readonly MilestoneKey[],
): MilestoneEventKey[] {
  return [
    ...started.map((k) => milestoneEvent(k, "start")),
    ...done.map((k) => milestoneEvent(k, "done")),
  ];
}

/**
 * Dispara as regras dos eventos de marco do pedido. Devolve os eventos
 * disparados agora. Nunca lança (o erro fica no console).
 */
export async function emitMilestoneEvents(
  order: Order,
  events: readonly MilestoneEventKey[],
  rules: readonly ProcessRule[],
): Promise<MilestoneEventKey[]> {
  if (!events.length || isHeld(order) || order.status === "CANCELLED")
    return [];
  const wanted = events.filter((e) => {
    const rule = rules.find((r) => r.event === e);
    return !!rule && ruleDoesSomething(rule);
  });
  if (!wanted.length) return [];
  const store = getStore();
  const fired = new Set(
    (
      await store.list("audit_log", {
        filter: {
          entity: "order",
          entityId: order.id,
          action: MILESTONE_EVENT_ACTION,
        },
      })
    ).map((a) => (a.after as { event?: string } | null)?.event),
  );
  const out: MilestoneEventKey[] = [];
  const { emitProcessEvent } = await import("./process-engine");
  for (const event of wanted) {
    if (fired.has(event)) continue;
    // Marca antes de disparar: um erro no Sankhya não repete o evento.
    await audit(
      null,
      MILESTONE_EVENT_ACTION,
      "order",
      order.id,
      `Pedido #${order.number}: evento ${event} (regras de processo)`,
      null,
      { event },
    );
    fired.add(event);
    out.push(event);
    await emitProcessEvent(null, event, { orderId: order.id });
  }
  return out;
}
