"use server";

import { z } from "zod";
import { assertRole } from "@/lib/auth/permissions";
import { assertScreen } from "@/lib/auth/screens";
import { requireUser, run, str } from "./helpers";

/*
 * RFQ em espera (docs/RFQ_STANDBY.md): ligar ou colocar a RFQ em espera. Só o
 * administrador; a mudança fica na auditoria.
 */
export async function setRfqEnabledAction(form: FormData) {
  const user = await requireUser();
  await run("/app/rfq", async () => {
    assertScreen(user, "rfq");
    assertRole(user, ["admin"]);
    const enabled = z.enum(["on", "off"]).parse(str(form, "enabled")) === "on";
    const { getSettings, setSetting } = await import("@/lib/settings");
    const before = (await getSettings()).rfqEnabled;
    if (before !== enabled) {
      await setSetting("rfqEnabled", enabled);
      const { audit } = await import("@/lib/services/audit");
      await audit(
        user,
        "settings.rfq",
        "setting",
        "rfqEnabled",
        enabled ? "RFQ ativada" : "RFQ colocada em espera",
        { rfqEnabled: before },
        { rfqEnabled: enabled },
      );
    }
    return `/app/rfq?saved=${enabled ? "on" : "off"}`;
  });
}
