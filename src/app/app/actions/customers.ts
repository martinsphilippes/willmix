"use server";

import { z } from "zod";
import { assertWellmix } from "@/lib/auth/permissions";
import { assertScreen } from "@/lib/auth/screens";
import { requireUser, run, str } from "./helpers";

const ID = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

/** Volta para a lista de clientes mantendo a busca e o filtro. */
function listBack(form: FormData) {
  const back = str(form, "back");
  if (/^\/app\/(customers|suppliers)(\?[A-Za-z0-9_=&%.+-]*)?$/.test(back))
    return back;
  return str(form, "type") === "supplier" ? "/app/suppliers" : "/app/customers";
}

/**
 * Operação em lote das listas de clientes e de fornecedores: ativar ou
 * desativar os marcados. Só empresas do tipo da lista; nada é apagado. Vai
 * para a auditoria.
 */
export async function setCustomersActiveAction(form: FormData) {
  const user = await requireUser();
  const back = listBack(form);
  await run(back, async () => {
    assertWellmix(user);
    assertScreen(user, "parties");
    const { ids, active, type } = z
      .object({
        ids: z.array(ID).min(1).max(500),
        active: z.enum(["on", "off"]),
        type: z.enum(["customer", "supplier"]),
      })
      .parse({
        ids: form.getAll("ids").map(String),
        active: str(form, "active"),
        type: str(form, "type") || "customer",
      });
    const { getStore } = await import("@/lib/db");
    const { audit } = await import("@/lib/services/audit");
    const store = getStore();
    const parties = await store.list("parties", { filter: { id: ids } });
    let changed = 0;
    for (const p of parties) {
      if (p.type !== type) continue;
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
