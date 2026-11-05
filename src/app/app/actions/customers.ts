"use server";

import { z } from "zod";
import { assertWellmix } from "@/lib/auth/permissions";
import { assertScreen } from "@/lib/auth/screens";
import { requireUser, run, str } from "./helpers";

const ID = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

/** Volta para a lista de clientes mantendo a busca e o filtro. */
function listBack(form: FormData) {
  const back = str(form, "back");
  return /^\/app\/customers(\?[A-Za-z0-9_=&%.+-]*)?$/.test(back)
    ? back
    : "/app/customers";
}

/**
 * Operação em lote da lista de clientes: ativar ou desativar os marcados.
 * Só cliente (tipo "customer"); nada é apagado. Vai para a auditoria.
 */
export async function setCustomersActiveAction(form: FormData) {
  const user = await requireUser();
  const back = listBack(form);
  await run(back, async () => {
    assertWellmix(user);
    assertScreen(user, "parties");
    const { ids, active } = z
      .object({
        ids: z.array(ID).min(1).max(500),
        active: z.enum(["on", "off"]),
      })
      .parse({
        ids: form.getAll("ids").map(String),
        active: str(form, "active"),
      });
    const { getStore } = await import("@/lib/db");
    const { audit } = await import("@/lib/services/audit");
    const store = getStore();
    const parties = await store.list("parties", { filter: { id: ids } });
    let changed = 0;
    for (const p of parties) {
      if (p.type !== "customer") continue;
      const next = active === "on";
      if (p.active === next) continue;
      await store.update("parties", p.id, { active: next });
      await audit(
        user,
        next ? "party.activate" : "party.deactivate",
        "party",
        p.id,
        p.name,
      );
      changed++;
    }
    const sep = back.includes("?") ? "&" : "?";
    return `${back}${sep}batch=${changed}`;
  });
}
