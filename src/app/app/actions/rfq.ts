"use server";

import { z } from "zod";
import { assertRole } from "@/lib/auth/permissions";
import { assertScreen } from "@/lib/auth/screens";
import { requireUser, run, str } from "./helpers";

/*
 * RFQ em espera (docs/RFQ_STANDBY.md): ligar ou colocar a RFQ em espera. Só o
 * administrador; a mudança fica na auditoria.
 */
/**
 * RFQ em espera: enviar a um fornecedor o produto que ainda não foi a nenhum
 * (o que vem do Booking já vai sozinho). Um fornecedor só; com a RFQ ligada
 * o envio é pelo cartão "Abrir RFQ" da solicitação.
 */
export async function sendRequestToSupplierAction(form: FormData) {
  const user = await requireUser();
  await run("/app/rfq", async () => {
    assertScreen(user, "rfq");
    const ID = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
    const requestId = ID.parse(str(form, "requestId"));
    const supplierId = ID.parse(str(form, "supplierId"));
    const { assertRfqStandby, openRfq } =
      await import("@/lib/services/requests");
    await assertRfqStandby([requestId], [supplierId]);
    await openRfq(user, requestId, [supplierId]);
    return `/app/rfq?sent=1#req-${requestId}`;
  });
}

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
