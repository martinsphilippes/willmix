"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { fallbackError } from "@/i18n/error-text";
import { errorCode, requireUser, run, str, withQuery } from "./helpers";

/*
 * NCM dos itens do booking (docs/BOOKING.md, "NCM do item"): a Wellmix grava
 * no campo da tabela do booking (também depois de fechado: a análise do item
 * é refeita); o despachante classifica os itens parecidos de uma vez na tela
 * /app/ncm-items. O serviço confere quem pode.
 */

const ID = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const NCM_PAGE = "/app/ncm-items";

export type InlineResult = { ok: true } | { ok: false; message: string };

/** Campo NCM de um item na tabela do booking (grava ao sair do campo). */
export async function setBookingItemNcmAction(
  lotId: string,
  itemId: string,
  value: string,
): Promise<InlineResult> {
  try {
    const user = await requireUser();
    const input = z
      .object({ lotId: ID, itemId: ID, value: z.string().max(20) })
      .parse({ lotId, itemId, value });
    const { setBookingItemsNcm } = await import("@/lib/services/booking-ncm");
    await setBookingItemsNcm(user, [input.itemId], input.value);
    revalidatePath(`/app/booking/lots/${input.lotId}`);
    revalidatePath("/app/booking");
    return { ok: true };
  } catch (error) {
    const { getT } = await import("@/i18n/server");
    const t = await getT();
    const code = errorCode("/app/booking", error);
    const message =
      [
        `bookingNcm.error.${code}`,
        `bookingLots.error.${code}`,
        `common.${code}`,
      ]
        .map((k) => [k, t(k as DictionaryKey)] as const)
        .find(([k, v]) => v !== k)?.[1] ?? fallbackError(t, code);
    return { ok: false, message };
  }
}

/** Despachante (ou Wellmix): um NCM para os itens marcados de um grupo. */
export async function applyNcmGroupAction(form: FormData) {
  const user = await requireUser();
  await run(NCM_PAGE, async () => {
    const input = z
      .object({
        itemIds: z.array(ID).min(1).max(200),
        ncm: z.string().min(1).max(20),
      })
      .parse({
        itemIds: form
          .getAll("itemIds")
          .filter((v): v is string => typeof v === "string"),
        ncm: str(form, "ncm"),
      });
    const { setBookingItemsNcm } = await import("@/lib/services/booking-ncm");
    const { updated } = await setBookingItemsNcm(
      user,
      input.itemIds,
      input.ncm,
    );
    return withQuery(NCM_PAGE, "done", String(updated));
  });
}
