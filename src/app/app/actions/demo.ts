"use server";

import { assertRole } from "@/lib/auth/permissions";
import { requireUser, run } from "./helpers";

/**
 * Contas de demonstração (Configurações): cria as empresas e os logins de
 * demonstração que ainda não existem. Só o administrador, e só com as contas
 * de demonstração ligadas (modo memória ou NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS).
 */
export async function ensureDemoAccountsAction() {
  const user = await requireUser();
  await run("/app/settings#demo", async () => {
    assertRole(user, ["admin"]);
    const { demoAccountsEnabled } = await import("@/lib/demo");
    if (!demoAccountsEnabled()) throw new Error("forbidden");
    const { ensureDemoAccounts } = await import("@/lib/seed");
    const added = await ensureDemoAccounts();
    const params = new URLSearchParams({
      demo: String(added.users.length),
      demoFailed: added.failed
        .map((f) => `${f.email}:${f.reason}`)
        .join(",")
        .slice(0, 500),
    });
    return `/app/settings?${params.toString()}#demo`;
  });
}
