"use server";

import { z } from "zod";
import { assertScreen } from "@/lib/auth/screens";
import { confirmCustomerOrder } from "@/lib/services/customer-confirmation";
import { requireUser, run, str } from "./helpers";

/*
 * Confirmação do pedido pelo cliente (dono, 15/11/2026; docs/ORDER_TERMS.md
 * seção 4): o login do cliente com acesso aceita o aviso "sem devoluções"
 * e, com re-despacho, informa o CNPJ da transportadora.
 */

const INPUT = z.object({
  requestId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  accept: z.boolean(),
  cnpj: z.string().max(30),
  carrierName: z.string().max(160),
  mainCnpj: z.string().max(30),
  mainCarrierName: z.string().max(160),
});

export async function confirmCustomerOrderAction(form: FormData) {
  const user = await requireUser();
  const requestId = str(form, "requestId").slice(0, 64);
  const back = `/app/requests/${encodeURIComponent(requestId)}`;
  await run(`${back}#confirmar`, async () => {
    assertScreen(user, "requests");
    const input = INPUT.parse({
      requestId,
      accept: str(form, "accept") === "1",
      cnpj: str(form, "cnpj"),
      carrierName: str(form, "carrierName"),
      mainCnpj: str(form, "mainCnpj"),
      mainCarrierName: str(form, "mainCarrierName"),
    });
    await confirmCustomerOrder(user, input.requestId, input);
    return `${back}?confirmed=1`;
  });
}
