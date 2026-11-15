import "server-only";

import { getStore, type Order, type User } from "@/lib/db";
import { isHeld } from "@/lib/db/store";
import { holdersOf } from "@/lib/auth/function-access";
import { isAdmin } from "@/lib/auth/permissions";
import {
  MILESTONES,
  milestoneTitle,
  type MilestoneInformed,
  type MilestoneKey,
} from "@/lib/milestones";
import { audit } from "./audit";
import { loadFunctionDefs } from "./team-functions";
import { notify, requesterTarget, type NotifyTarget } from "./notifications";

/*
 * Aviso aos informados (I) quando um marco do pedido conclui (fase 4c,
 * docs/MILESTONES.md "Avisos, lembretes e SLA"). Chamado só pelo recálculo do
 * resumo por evento (`applySummaryChanges`), nunca pela reconstrução noturna
 * nem pela troca de formato. Um aviso por marco e pedido: o envio fica na
 * auditoria (`milestone.informed`) e não repete se o marco reabrir e
 * concluir de novo.
 */

export const MILESTONE_INFORMED_ACTION = "milestone.informed";

/** Âncora da linha do tempo dos marcos na tela do pedido. */
export const milestonesLink = (orderId: string) =>
  `/app/orders/${orderId}#order-stages`;

const FUNCTION_OF: Partial<Record<MilestoneInformed, string>> = {
  buyer: "buyer",
  finance: "finance",
  planner: "planner",
  product_manager: "product_manager",
  designer: "designer",
  comex_internal: "comex_internal",
};

/** Alvos dos informados de um marco no pedido (só os que existem). */
async function targetsFor(
  order: Order,
  informed: readonly MilestoneInformed[],
  team: () => Promise<User[]>,
): Promise<NotifyTarget[]> {
  const userIds = new Set<string>();
  const out: NotifyTarget[] = [];
  for (const who of informed) {
    const fn = FUNCTION_OF[who];
    if (fn) {
      for (const u of await team())
        if (u.functions?.includes(fn)) userIds.add(u.id);
      continue;
    }
    switch (who) {
      case "owner":
        for (const u of await team()) if (isAdmin(u)) userIds.add(u.id);
        break;
      case "sales": {
        const holders = holdersOf(
          await team(),
          "purchaseOrder.salesNotice",
          await loadFunctionDefs(),
        );
        for (const u of holders) userIds.add(u.id);
        break;
      }
      case "customer":
        out.push(requesterTarget(order.requestedByUserId));
        break;
      case "supplier":
        out.push({ role: "supplier", partyId: order.supplierId ?? null });
        break;
      case "agency":
        out.push({ role: "agency", partyId: order.agencyId ?? null });
        break;
      case "ocp":
        out.push({ role: "ocp", partyId: order.ocpId ?? null });
        break;
      case "logistics":
        out.push({ role: "logistics", partyId: order.logisticsId ?? null });
        break;
    }
  }
  if (userIds.size) out.unshift({ userIds: [...userIds] });
  return out;
}

/**
 * Avisa os informados dos marcos que acabaram de concluir no pedido. Pedido
 * do histórico em espera, cancelado ou sem marco novo: nada. Devolve os
 * marcos avisados.
 */
export async function informMilestones(
  order: Order,
  keys: readonly MilestoneKey[],
): Promise<MilestoneKey[]> {
  if (!keys.length || isHeld(order) || order.status === "CANCELLED") return [];
  const store = getStore();
  const sent = new Set(
    (
      await store.list("audit_log", {
        filter: {
          entity: "order",
          entityId: order.id,
          action: MILESTONE_INFORMED_ACTION,
        },
      })
    ).map((a) => (a.after as { milestone?: string } | null)?.milestone),
  );
  let teamCache: Promise<User[]> | null = null;
  const team = () =>
    (teamCache ??= store.list("users", {
      filter: { role: ["admin", "operator"], active: true },
    }));
  const done: MilestoneKey[] = [];
  for (const key of keys) {
    if (sent.has(key)) continue;
    const def = MILESTONES.find((d) => d.key === key);
    if (!def) continue;
    // Marca antes de avisar: um erro no envio não repete o aviso depois.
    await audit(
      null,
      MILESTONE_INFORMED_ACTION,
      "order",
      order.id,
      `Pedido #${order.number}: marco ${key} concluído (informados avisados)`,
      null,
      { milestone: key },
    );
    sent.add(key);
    done.push(key);
    for (const target of await targetsFor(order, def.informed, team))
      await notify(target, {
        kind: "done",
        actor: null,
        link: milestonesLink(order.id),
        text: (t) => {
          const milestone = milestoneTitle(t, key);
          return {
            subject: t("milestone.notify.subject", {
              n: order.number,
              milestone,
            }),
            body: t("milestone.notify.body", { n: order.number, milestone }),
          };
        },
      });
  }
  return done;
}
