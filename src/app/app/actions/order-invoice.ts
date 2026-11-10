"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { assertWellmix } from "@/lib/auth/permissions";
import {
  OrderInvoiceError,
  registerOrderInvoice,
} from "@/lib/services/order-invoicing";
import { requireUser, str } from "./helpers";

/*
 * "Registrar faturamento" no pedido (Wellmix): grava a data e dispara a regra
 * de processo "Pedido faturado" (Configurações → Processos; docs/PROCESSES.md).
 */

const schema = z.object({ orderId: z.string().min(1).max(64) });

export async function registerOrderInvoiceAction(form: FormData) {
  const user = await requireUser();
  assertWellmix(user);
  const { orderId } = schema.parse({ orderId: str(form, "orderId") });
  let target = `/app/orders/${orderId}?invoiced=1`;
  try {
    await registerOrderInvoice(user, orderId);
  } catch (error) {
    if (!(error instanceof OrderInvoiceError)) throw error;
    target = `/app/orders/${orderId}?error=${error.message}`;
  }
  redirect(target);
}
