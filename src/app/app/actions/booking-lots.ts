"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertWellmix } from "@/lib/auth/permissions";
import { assertScreen } from "@/lib/auth/screens";
import { isBookingItemField } from "@/lib/booking-lots";
import { BOOKING_LOT_STATUSES, SHEET_CURRENCIES } from "@/lib/db/schema";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { fallbackError } from "@/i18n/error-text";
import { errorCode, requireUser, run, str, withQuery } from "./helpers";

/*
 * Booking por planilha (docs/BOOKING.md, "Booking por planilha"): subir a
 * planilha, ajustar fornecedor, data e itens no rascunho, fechar (com a
 * análise do Superplan em todos os itens) e mudar o status. Só a Wellmix com
 * a tela Booking (o serviço confere de novo).
 */

const ID = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const LIST = "/app/booking";
const IMPORT = "/app/booking/import";
const detail = (id: string) => `/app/booking/lots/${id}`;

export type InlineResult = { ok: true } | { ok: false; message: string };

async function screenUser() {
  const user = await requireUser();
  assertWellmix(user);
  assertScreen(user, "booking");
  return user;
}

/** Sobe a planilha e abre o booking criado (rascunho). */
export async function importBookingAction(form: FormData) {
  const user = await requireUser();
  await run(IMPORT, async () => {
    assertWellmix(user);
    assertScreen(user, "booking");
    const parsed = z
      .object({
        currency: z.enum(SHEET_CURRENCIES).nullable(),
        sheet: z.string().max(100).nullable(),
        uploadedFileId: z
          .string()
          .regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/)
          .nullable(),
        uploadedFileName: z.string().max(255).nullable(),
        sheetUrl: z.string().max(600).nullable(),
      })
      .parse({
        currency: str(form, "currency") || null,
        sheet: str(form, "sheet") || null,
        uploadedFileId: str(form, "uploadedFileId") || null,
        uploadedFileName: str(form, "uploadedFileName") || null,
        sheetUrl: str(form, "sheetUrl") || null,
      });
    const file = form.get("file");
    const { SheetImportError } =
      await import("@/lib/services/product-sheet-import");
    const source = parsed.uploadedFileId
      ? { fileKey: parsed.uploadedFileId, fileName: parsed.uploadedFileName }
      : file instanceof File && file.size > 0
        ? file
        : parsed.sheetUrl
          ? { url: parsed.sheetUrl }
          : null;
    if (!source) throw new SheetImportError("file_required");
    const { createBookingLotFromSheet } =
      await import("@/lib/services/booking-lots");
    const lot = await createBookingLotFromSheet(user, source, {
      defaultCurrency: parsed.currency,
      sheet: parsed.sheet,
    });
    return withQuery(detail(lot.id), "created", "1");
  });
}

/** Gravação de um campo na tabela (sem sair da tela): devolve o texto do erro. */
async function inline(
  lotId: string | null,
  save: (user: Awaited<ReturnType<typeof requireUser>>) => Promise<void>,
): Promise<InlineResult> {
  try {
    const user = await screenUser();
    await save(user);
  } catch (error) {
    const { getT } = await import("@/i18n/server");
    const t = await getT();
    const code = errorCode(LIST, error);
    const message =
      [`bookingLots.error.${code}`, `common.${code}`]
        .map((k) => [k, t(k as DictionaryKey)] as const)
        .find(([k, v]) => v !== k)?.[1] ?? fallbackError(t, code);
    return { ok: false, message };
  }
  if (lotId) revalidatePath(detail(lotId));
  revalidatePath(LIST);
  return { ok: true };
}

export async function setBookingLotSupplierAction(
  lotId: string,
  supplierId: string,
): Promise<InlineResult> {
  const id = ID.safeParse(lotId);
  return inline(id.success ? id.data : null, async (user) => {
    const input = z
      .object({ lotId: ID, supplierId: z.union([z.literal(""), ID]) })
      .parse({ lotId, supplierId });
    const { setBookingLotSupplier } =
      await import("@/lib/services/booking-lots");
    await setBookingLotSupplier(user, input.lotId, input.supplierId || null);
  });
}

export async function setBookingLotDateAction(
  lotId: string,
  day: string,
): Promise<InlineResult> {
  const id = ID.safeParse(lotId);
  return inline(id.success ? id.data : null, async (user) => {
    const input = z
      .object({
        lotId: ID,
        day: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
      })
      .parse({ lotId, day });
    const { setBookingLotDate } = await import("@/lib/services/booking-lots");
    await setBookingLotDate(user, input.lotId, input.day || null);
  });
}

export async function setBookingItemFieldAction(
  lotId: string,
  itemId: string,
  field: string,
  value: string,
): Promise<InlineResult> {
  const id = ID.safeParse(lotId);
  return inline(id.success ? id.data : null, async (user) => {
    const input = z
      .object({
        itemId: ID,
        field: z.string().refine(isBookingItemField),
        value: z.string().max(4000),
      })
      .parse({ itemId, field, value });
    if (!isBookingItemField(input.field)) throw new Error("invalid_input");
    const { setBookingItemField } = await import("@/lib/services/booking-lots");
    await setBookingItemField(user, input.itemId, input.field, input.value);
  });
}

/** Cadastra o fornecedor sugerido pela planilha e o põe no booking. */
export async function registerBookingLotSupplierAction(form: FormData) {
  const user = await requireUser();
  const raw = str(form, "lotId");
  const back = ID.safeParse(raw).success ? detail(raw) : LIST;
  await run(back, async () => {
    const input = z
      .object({
        lotId: ID,
        name: z.string().min(1).max(160),
        storeNumber: z.string().max(60).nullable(),
        phone: z.string().max(40).nullable(),
        city: z.string().max(80).nullable(),
        country: z.string().max(60).nullable(),
      })
      .parse({
        lotId: raw,
        name: str(form, "name"),
        storeNumber: str(form, "storeNumber") || null,
        phone: str(form, "phone") || null,
        city: str(form, "city") || null,
        country: str(form, "country") || null,
      });
    const { registerBookingLotSupplier } =
      await import("@/lib/services/booking-lots");
    await registerBookingLotSupplier(user, input.lotId, input);
    return withQuery(back, "supplier", "created");
  });
}

/** Fecha o booking: confere os campos e roda o Superplan em todos os itens. */
export async function closeBookingLotAction(form: FormData) {
  const user = await requireUser();
  const raw = str(form, "lotId");
  const back = ID.safeParse(raw).success ? detail(raw) : LIST;
  await run(back, async () => {
    const input = z
      .object({ lotId: ID, businessType: z.string().max(80).nullable() })
      .parse({
        lotId: raw,
        businessType: str(form, "businessType") || null,
      });
    const { closeBookingLot } = await import("@/lib/services/booking-lots");
    await closeBookingLot(user, input.lotId, input.businessType);
    return withQuery(back, "closed", "1");
  });
}

export async function reanalyzeBookingLotAction(form: FormData) {
  const user = await requireUser();
  const raw = str(form, "lotId");
  const back = ID.safeParse(raw).success ? detail(raw) : LIST;
  await run(back, async () => {
    const input = z
      .object({ lotId: ID, businessType: z.string().max(80).nullable() })
      .parse({
        lotId: raw,
        businessType: str(form, "businessType") || null,
      });
    const { reanalyzeBookingLot } = await import("@/lib/services/booking-lots");
    await reanalyzeBookingLot(user, input.lotId, input.businessType);
    return withQuery(back, "analyzed", "1");
  });
}

export async function moveBookingLotAction(form: FormData) {
  const user = await requireUser();
  const raw = str(form, "lotId");
  const back = ID.safeParse(raw).success ? detail(raw) : LIST;
  await run(back, async () => {
    const input = z
      .object({ lotId: ID, status: z.enum(BOOKING_LOT_STATUSES) })
      .parse({ lotId: raw, status: str(form, "status") });
    const { moveBookingLot } = await import("@/lib/services/booking-lots");
    await moveBookingLot(user, input.lotId, input.status);
    return withQuery(back, "moved", "1");
  });
}

export async function setBookingLotNoteAction(form: FormData) {
  const user = await requireUser();
  const raw = str(form, "lotId");
  const back = ID.safeParse(raw).success ? detail(raw) : LIST;
  await run(back, async () => {
    const input = z
      .object({ lotId: ID, note: z.string().max(500) })
      .parse({ lotId: raw, note: str(form, "note") });
    const { setBookingLotNote } = await import("@/lib/services/booking-lots");
    await setBookingLotNote(user, input.lotId, input.note || null);
    return withQuery(back, "saved", "1");
  });
}
