"use server";

import { z } from "zod";
import { files, requireUser, run, str, uploadedPhotoKeys } from "./helpers";

/*
 * Cartão do fabricante na cotação: enviar (já fica confirmado), escolher um
 * já enviado e corrigir os dados lidos. O serviço confere papel e isolamento
 * (só o fornecedor da cotação ou a Wellmix; cartão de outro fornecedor nunca).
 */

const ID = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

const quoteBack = (quoteId: string) =>
  `/app/quotes/${encodeURIComponent(quoteId)}`;

export async function addManufacturerCardAction(form: FormData) {
  const user = await requireUser();
  const quoteId = str(form, "quoteId").slice(0, 64);
  const back = quoteBack(quoteId);
  await run(`${back}#manufacturer-card`, async () => {
    ID.parse(quoteId);
    const photo = files(form, "photo")[0] ?? uploadedPhotoKeys(form)[0];
    if (!photo) throw new Error("photo_required");
    const { addCardToQuote } =
      await import("@/lib/services/manufacturer-cards");
    await addCardToQuote(user, quoteId, photo);
    return `${back}?card=added#manufacturer-card`;
  });
}

export async function confirmManufacturerCardAction(form: FormData) {
  const user = await requireUser();
  const quoteId = str(form, "quoteId").slice(0, 64);
  const back = quoteBack(quoteId);
  await run(`${back}#manufacturer-card`, async () => {
    ID.parse(quoteId);
    const cardId = ID.parse(str(form, "cardId"));
    const { confirmCardForQuote } =
      await import("@/lib/services/manufacturer-cards");
    await confirmCardForQuote(user, quoteId, cardId);
    return `${back}?card=confirmed#manufacturer-card`;
  });
}

const optional = (form: FormData, key: string, max: number) => {
  const v = str(form, key).trim();
  return v ? v.slice(0, max) : null;
};

export async function updateManufacturerCardAction(form: FormData) {
  const user = await requireUser();
  const rawBack = str(form, "back");
  // Só volta para telas do app (cotação ou produto).
  const back = /^\/app\/(quotes|products)\/[A-Za-z0-9_-]{1,64}$/.test(rawBack)
    ? rawBack
    : "/app";
  await run(`${back}#manufacturer-card`, async () => {
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
