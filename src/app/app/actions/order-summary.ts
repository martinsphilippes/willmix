"use server";

import { redirect } from "next/navigation";
import { assertRole } from "@/lib/auth/permissions";
import { requireUser } from "./helpers";

const BACK = "/app/settings/summaries";

/**
 * Reconstrói o resumo de todos os pedidos (docs/RESUMOS.md), como o job
 * noturno. Só o administrador. Sem campos no formulário.
 */
export async function rebuildOrderSummariesAction() {
  const user = await requireUser();
  assertRole(user, ["admin"]);
  let target: string;
  try {
    const { rebuildOrderSummaries } =
      await import("@/lib/services/order-summary");
    const { audit } = await import("@/lib/services/audit");
    const marker = await rebuildOrderSummaries();
    await audit(
      user,
      "order_summaries.rebuild",
      "settings",
      "orderSummaries",
      `${marker.orders} pedidos, ${marker.written} gravados, ${marker.removed} apagados, ${marker.ms} ms`,
    );
    target = `${BACK}?ran=1`;
  } catch (error) {
    console.error("[order-summary] reconstrução", error);
    target = `${BACK}?error=${encodeURIComponent(
      String((error as Error).message ?? error).slice(0, 300),
    )}`;
  }
  redirect(target);
}
