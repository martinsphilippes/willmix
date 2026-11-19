"use server";

import { z } from "zod";
import { ForbiddenError } from "@/lib/auth/permissions";
import { requireUser, run, str } from "./helpers";

/*
 * "Atualizar agora" do painel (docs/TRADE_COMERCIAL.md, PR 3): quem gere a
 * carteira lê de novo no Sankhya as vendas dos clientes do grupo (ou do
 * cliente) aberto no painel. A regra fica em
 * src/lib/services/customer-sales.ts.
 */

const scopeSchema = z.string().regex(/^(g|c):[A-Za-z0-9_-]{1,64}$/);
const tabSchema = z.string().regex(/^[a-z]{1,20}$/);

export async function refreshPanelSalesAction(form: FormData) {
  const user = await requireUser();
  const scope = scopeSchema.parse(str(form, "scope"));
  const tab = tabSchema.safeParse(str(form, "tab")).success
    ? str(form, "tab")
    : "executive";
  const back = `/app/portfolio/panel?scope=${encodeURIComponent(scope)}&tab=${tab}`;
  await run(back, async () => {
    const panel = await import("@/lib/services/sales-panel");
    const sales = await import("@/lib/services/customer-sales");
    const { canManagePortfolio } = await import("@/lib/services/portfolio");
    if (!canManagePortfolio(user)) throw new ForbiddenError();
    const parsed = panel.parseScope(scope)!;
    const data = await panel.loadPanelData(user, parsed);
    if (!data) throw new Error("customer_not_found");
    const results = await sales.refreshSalesFor(
      user,
      data.customers.map((c) => c.id),
    );
    if (results.some((r) => r.result.state === "not_configured"))
      throw new Error("sankhya_not_configured");
    const ok = results.filter((r) => r.result.state === "ok").length;
    return `${back}&refreshed=${ok}-${results.length}`;
  });
}
