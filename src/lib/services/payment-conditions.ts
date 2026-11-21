import "server-only";
import { getStore, type User } from "@/lib/db";
import type { PaymentCondition } from "@/lib/db/schema";
import { executeQuery } from "@/lib/integrations/sankhya-client";
import {
  PAYMENT_CONDITION_VIEW,
  conditionFromViewRow,
  conditionSchedule,
  missingConditionColumns,
  planConditionSync,
} from "@/lib/payment-condition-view";
import { audit } from "./audit";

/*
 * Condições de pagamento = a VW_AD_TIPONEGOCIACAO_WELL (dono, 21/11/2026):
 * a sincronização troca a tabela pela view. O que não está na view sai (as
 * ligações de pedidos e ordens de venda a elas ficam vazias); o que está
 * entra ou é atualizado, com as parcelas por tempo ou por evento lidas da
 * descrição. Se a view falha ou vem vazia, nada muda.
 */

export class PaymentConditionSyncError extends Error {}

export interface PaymentConditionSyncResult {
  created: number;
  updated: number;
  removed: number;
  /** Pedidos e ordens de venda que apontavam para uma condição removida. */
  unlinked: number;
  /** Condições a revisar (parcelas não lidas ou soma diferente de 100). */
  review: number;
  missing: string[];
}

export async function syncPaymentConditions(
  user: User,
): Promise<PaymentConditionSyncResult> {
  let rows: Record<string, unknown>[];
  let columns: string[];
  try {
    const table = await executeQuery(`SELECT V.* FROM ${PAYMENT_CONDITION_VIEW} V`);
    rows = table.rows;
    columns = table.columns.length
      ? table.columns
      : Object.keys(table.rows[0] ?? {});
  } catch (error) {
    console.error("[payment-conditions] view do Sankhya", error);
    throw new PaymentConditionSyncError("view_failed");
  }
  const store = getStore();
  const existing = await store.list("payment_conditions");
  const plan = planConditionSync(existing, rows);
  if (!plan.create.length && !plan.update.length)
    throw new PaymentConditionSyncError("view_empty");

  const now = new Date().toISOString();
  let review = 0;
  const fields = (view: (typeof plan.create)[number], rule: string | null) => {
    const s = conditionSchedule({
      name: view.name,
      scheduleRule: rule,
      cash: view.cash,
    });
    if (s.problem) review++;
    return {
      name: view.name,
      active: view.active,
      scheduleKind: s.kind,
      installments: s.installments,
      scheduleProblem: s.problem,
      sankhyaRow: view.row,
      sankhyaSyncedAt: now,
      updatedByUserId: user.id,
    } satisfies Partial<PaymentCondition>;
  };

  for (const view of plan.create)
    await store.create("payment_conditions", {
      code: view.code,
      notes: null,
      source: "sankhya",
      scheduleRule: null,
      ...fields(view, null),
    });
  const byId = new Map(existing.map((c) => [c.id, c]));
  for (const { id, view } of plan.update) {
    const before = byId.get(id);
    await store.update("payment_conditions", id, {
      source: "sankhya",
      ...fields(view, before?.scheduleRule ?? null),
    });
  }

  // As ligações às condições que saem ficam vazias antes de apagar.
  let unlinked = 0;
  const removedIds = plan.remove.map((c) => c.id);
  if (removedIds.length) {
    for (const table of ["orders", "sales_orders"] as const) {
      const linked = await store.list(table, {
        filter: { paymentConditionId: removedIds },
      });
      for (const row of linked) {
        await store.update(table, row.id, { paymentConditionId: null });
        unlinked++;
      }
    }
    for (const c of plan.remove) await store.remove("payment_conditions", c.id);
  }

  const result: PaymentConditionSyncResult = {
    created: plan.create.length,
    updated: plan.update.length,
    removed: plan.remove.length,
    unlinked,
    review,
    missing: rows.length ? missingConditionColumns(columns) : [],
  };
  await audit(
    user,
    "payment_condition.sync",
    "payment_condition",
    PAYMENT_CONDITION_VIEW,
    `Condições de pagamento trocadas pela ${PAYMENT_CONDITION_VIEW}: ${result.created} novas, ${result.updated} atualizadas, ${result.removed} removidas`,
    { codes: plan.remove.map((c) => ({ code: c.code, name: c.name })) },
    result,
  );
  return result;
}

/** Regra escrita pelo administrador (vazia = volta a ler a descrição). */
export async function savePaymentConditionRule(
  user: User,
  id: string,
  rule: string | null,
): Promise<PaymentCondition> {
  const store = getStore();
  const before = await store.get("payment_conditions", id);
  if (!before) throw new PaymentConditionSyncError("not_found");
  const cash = before.sankhyaRow
    ? conditionFromViewRow(before.sankhyaRow)?.cash === true
    : false;
  const s = conditionSchedule({ name: before.name, scheduleRule: rule, cash });
  const after = await store.update("payment_conditions", id, {
    scheduleRule: rule,
    scheduleKind: s.kind,
    installments: s.installments,
    scheduleProblem: s.problem,
    updatedByUserId: user.id,
  });
  await audit(
    user,
    "payment_condition.rule",
    "payment_condition",
    id,
    `Parcelas da condição ${before.code} ${before.name}`,
    before,
    after,
  );
  return after;
}
