"use server";

import { z } from "zod";
import { CURRENCIES } from "@/lib/currencies";
import { ForbiddenError, isWellmix } from "@/lib/auth/permissions";
import { answerFreight } from "@/lib/services/freight";
import { requireUser, run, str } from "./helpers";

/*
 * Companhia marítima (ou a Wellmix por ela) informa o frete de um pedido de
 * frete. O serviço confere se o pedido é da companhia do usuário.
 */

const ID = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

const optionalInt = z.preprocess(
  (v) => (v === "" ? null : v),
  z.coerce.number().int().min(0).max(365).nullable(),
);

export async function answerFreightAction(form: FormData) {
  const user = await requireUser();
  const freightId = str(form, "freightId").slice(0, 64);
  const back = `/app/freight/${encodeURIComponent(freightId)}`;
  await run(back, async () => {
    ID.parse(freightId);
    if (!isWellmix(user) && user.role !== "shipping_line")
      throw new ForbiddenError();
    const amount = z.coerce
      .number()
      .positive()
      .max(100_000_000)
      .parse(str(form, "amount").replace(",", "."));
    const currency = z.enum(CURRENCIES).parse(str(form, "currency"));
    const transitDays = optionalInt.parse(str(form, "transitDays"));
    const rawValid = str(form, "validUntil");
    const validUntil = rawValid
      ? z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .parse(rawValid) + "T00:00:00.000Z"
      : null;
    const notes = z.string().max(1000).parse(str(form, "notes")) || null;
    await answerFreight(user, freightId, {
      amount,
      currency,
      transitDays,
      validUntil,
      notes,
    });
    return `${back}?saved=1`;
  });
}
