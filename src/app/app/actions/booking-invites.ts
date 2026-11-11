"use server";

import { z } from "zod";
import { SHEET_CURRENCIES } from "@/lib/db";
import { ForbiddenError, isWellmix } from "@/lib/auth/permissions";
import { assertScreen } from "@/lib/auth/screens";
import { requireUser, run, str } from "./helpers";

/*
 * Convite para booking concorrente (docs/BOOKING_INVITES.md): a Wellmix
 * convida (e cancela) na tela do item; o parceiro convidado (ou a Wellmix por
 * ele) responde subindo a planilha. O serviço confere papel e isolamento.
 */

const ID = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

export async function inviteForItemAction(form: FormData) {
  const user = await requireUser();
  const itemId = str(form, "itemId").slice(0, 64);
  const back = `/app/booking/invite/${encodeURIComponent(itemId)}`;
  await run(back, async () => {
    if (!isWellmix(user)) throw new ForbiddenError();
    assertScreen(user, "booking");
    const input = z
      .object({
        itemId: ID,
        partnerIds: z.array(ID).max(100),
        message: z.string().max(4000).nullable(),
      })
      .parse({
        itemId,
        partnerIds: form
          .getAll("partnerIds")
          .filter((v): v is string => typeof v === "string" && !!v),
        message: str(form, "message") || null,
      });
    const { inviteForItem } = await import("@/lib/services/booking-invites");
    const created = await inviteForItem(user, input);
    return `${back}?invited=${created.length}`;
  });
}

export async function cancelInviteAction(form: FormData) {
  const user = await requireUser();
  const itemId = str(form, "itemId").slice(0, 64);
  const back = `/app/booking/invite/${encodeURIComponent(itemId)}`;
  await run(back, async () => {
    if (!isWellmix(user)) throw new ForbiddenError();
    assertScreen(user, "booking");
    const inviteId = ID.parse(str(form, "inviteId"));
    const { cancelInvite } = await import("@/lib/services/booking-invites");
    await cancelInvite(user, inviteId);
    return `${back}?cancelled=1`;
  });
}

/** O convidado responde subindo a planilha do booking concorrente. */
export async function answerInviteAction(form: FormData) {
  const user = await requireUser();
  const inviteId = str(form, "inviteId").slice(0, 64);
  const back = `/app/supplier-requests/invites/${encodeURIComponent(inviteId)}`;
  await run(back, async () => {
    assertScreen(user, isWellmix(user) ? "booking" : "quotes");
    const parsed = z
      .object({
        inviteId: ID,
        currency: z.enum(SHEET_CURRENCIES).nullable(),
        uploadedFileId: z
          .string()
          .regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/)
          .nullable(),
        uploadedFileName: z.string().max(255).nullable(),
      })
      .parse({
        inviteId,
        currency: str(form, "currency") || null,
        uploadedFileId: str(form, "uploadedFileId") || null,
        uploadedFileName: str(form, "uploadedFileName") || null,
      });
    const file = form.get("file");
    const { SheetImportError } =
      await import("@/lib/services/product-sheet-import");
    const source = parsed.uploadedFileId
      ? { fileKey: parsed.uploadedFileId, fileName: parsed.uploadedFileName }
      : file instanceof File && file.size > 0
        ? file
        : null;
    if (!source) throw new SheetImportError("file_required");
    const { answerInviteWithSheet } =
      await import("@/lib/services/booking-invites");
    await answerInviteWithSheet(user, parsed.inviteId, source, {
      defaultCurrency: parsed.currency,
    });
    return `${back}?answered=1`;
  });
}
