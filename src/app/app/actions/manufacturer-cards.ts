"use server";

import { z } from "zod";
import { assertScreen } from "@/lib/auth/screens";
import { requireUser, run, str } from "./helpers";

/*
 * Cartão do fabricante na página do produto: corrigir os dados lidos. O
 * serviço confere papel e isolamento (o fornecedor dono do cartão ou a
 * Wellmix; cartão de outro fornecedor nunca).
 */

const ID = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

const optional = (form: FormData, key: string, max: number) => {
  const v = str(form, key).trim();
  return v ? v.slice(0, max) : null;
};

export async function updateManufacturerCardAction(form: FormData) {
  const user = await requireUser();
  const rawBack = str(form, "back");
  // Só volta para a página do produto.
  const back = /^\/app\/products\/[A-Za-z0-9_-]{1,64}$/.test(rawBack)
    ? rawBack
    : "/app";
  await run(`${back}#manufacturer-card`, async () => {
    assertScreen(user, "products");
    const cardId = ID.parse(str(form, "cardId"));
    const factory = str(form, "isFactory");
    const { updateCardInfo } =
      await import("@/lib/services/manufacturer-cards");
    await updateCardInfo(user, cardId, {
      companyName: optional(form, "companyName", 160),
      contactName: optional(form, "contactName", 120),
      phone: optional(form, "phone", 60),
      email: optional(form, "email", 160),
      storeAddress: optional(form, "storeAddress", 2000),
      factoryAddress: optional(form, "factoryAddress", 2000),
      isFactory: factory === "yes" ? true : factory === "no" ? false : null,
    });
    return `${back}?card=saved#manufacturer-card`;
  });
}
