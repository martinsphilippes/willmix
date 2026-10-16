"use server";

import { z } from "zod";
import { CURRENCIES } from "@/lib/currencies";
import { ForbiddenError, isWellmix } from "@/lib/auth/permissions";
import { answerFreight } from "@/lib/services/freight";
import { field, requireUser, run, str } from "./helpers";
import { parseNumberInput } from "@/lib/number-input";

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
    // Valor como as pessoas digitam ("1.250,00", "1,250.00"); recusado aponta o campo.
    const amount = field(
      form,
      "amount",
      z.preprocess(
        (v) => parseNumberInput(String(v ?? "")),
        z.number().positive().max(100_000_000),
      ),
    );
    const currency = field(form, "currency", z.enum(CURRENCIES));
    const transitDays = field(form, "transitDays", optionalInt);
    const rawValid = str(form, "validUntil");
    const validUntil = rawValid
      ? z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .parse(rawValid) + "T00:00:00.000Z"
      : null;
    const notes = field(form, "notes", z.string().max(1000)) || null;
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
