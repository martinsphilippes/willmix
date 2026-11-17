"use server";

import { z } from "zod";
import {
  CustomerContactsError,
  customerContactsView,
  saveCustomerContacts,
  type ContactsView,
} from "@/lib/services/customer-contacts";
import { contactsFromEntries } from "@/lib/order-terms";
import { requireUser } from "./helpers";

/*
 * "Salvar dados do cliente" no bloco Cliente da Nova solicitação (dono,
 * 17/11/2026): grava os contatos do cliente na hora, sem enviar o pedido.
 * Mesmas regras do envio (todos obrigatórios, nenhum igual ao do vendedor);
 * a tela recebe os contatos gravados de volta.
 */

const INPUT = z.object({
  customerId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  values: z.record(z.string().max(80), z.string().max(200)),
});

export async function saveCustomerContactsAction(input: {
  customerId: string;
  values: Record<string, string>;
}): Promise<
  { ok: true; view: ContactsView | null } | { ok: false; error: string }
> {
  const user = await requireUser();
  try {
    const { customerId, values } = INPUT.parse(input);
    const contacts = contactsFromEntries(
      (k) => (values[k] ?? "").trim(),
      Object.keys(values),
    );
    await saveCustomerContacts(user, customerId, contacts);
    return { ok: true, view: await customerContactsView(user, customerId) };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof CustomerContactsError ? error.message : "save_failed",
    };
  }
}
