"use server";

import { redirect } from "next/navigation";
import { assertRole } from "@/lib/auth/permissions";
import type { RebuildState } from "@/lib/services/order-summary";
import { requireUser } from "./helpers";

const BACK = "/app/settings/summaries";

/**
 * Tempo de cada rodada da reconstrução pela tela: bem abaixo dos 5 minutos
 * da página, para o andamento aparecer logo e a rodada nunca ser cortada.
 */
const STEP_BUDGET_MS = 45_000;

async function auditDone(
  user: Awaited<ReturnType<typeof requireUser>>,
  result: RebuildState,
) {
  if (result.state !== "done") return;
  const { audit } = await import("@/lib/services/audit");
  const { marker } = result;
  await audit(
    user,
    "order_summaries.rebuild",
    "settings",
    "orderSummaries",
    `${marker.orders} pedidos, ${marker.written} gravados, ${marker.removed} apagados, ${marker.ms} ms`,
  );
}

/**
 * Reconstrói o resumo de todos os pedidos (docs/RESUMOS.md), como o job
 * noturno, em partes: começa (ou continua a que está em andamento) e faz a
 * primeira rodada. Terminou: volta com `ran=1`; senão, a tela segue com as
 * rodadas (`continueOrderSummariesAction`). Só o administrador. Sem campos no
 * formulário.
 */
export async function rebuildOrderSummariesAction() {
  const user = await requireUser();
  assertRole(user, ["admin"]);
  let target: string;
  try {
    const { rebuildOrderSummariesStep } =
      await import("@/lib/services/order-summary");
    const result = await rebuildOrderSummariesStep({
      budgetMs: STEP_BUDGET_MS,
      start: true,
    });
    await auditDone(user, result);
    target = result.state === "done" ? `${BACK}?ran=1` : BACK;
  } catch (error) {
    console.error("[order-summary] reconstrução", error);
    target = `${BACK}?error=${encodeURIComponent(
      String((error as Error).message ?? error).slice(0, 300),
    )}`;
  }
  redirect(target);
}

/**
 * Uma rodada da reconstrução em andamento, chamada pela tela até terminar.
 * Não começa uma nova. Sem campos. Só o administrador.
 */
export async function continueOrderSummariesAction(): Promise<
  RebuildState | { state: "error"; detail: string }
> {
  const user = await requireUser();
  assertRole(user, ["admin"]);
  try {
    const { rebuildOrderSummariesStep } =
      await import("@/lib/services/order-summary");
    const result = await rebuildOrderSummariesStep({
      budgetMs: STEP_BUDGET_MS,
    });
    await auditDone(user, result);
    return result;
  } catch (error) {
    console.error("[order-summary] reconstrução", error);
    return {
      state: "error",
      detail: String((error as Error).message ?? error).slice(0, 300),
    };
  }
}
