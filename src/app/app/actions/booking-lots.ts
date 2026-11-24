"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  ForbiddenError,
  assertWellmix,
  isWellmix,
} from "@/lib/auth/permissions";
import { assertScreen } from "@/lib/auth/screens";
import { isBookingItemField, type BookingItemField } from "@/lib/booking-lots";
import {
  BOOKING_LOT_STATUSES,
  SHEET_CURRENCIES,
  SHEET_INCOTERMS,
} from "@/lib/db/schema";
import { parseNumberInput } from "@/lib/number-input";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { fallbackError } from "@/i18n/error-text";
import { errorCode, requireUser, run, str, withQuery } from "./helpers";

/*
 * Booking por planilha (docs/BOOKING.md, "Booking por planilha"): subir a
 * planilha, ajustar fornecedor, data e itens no rascunho, fechar (com a
 * previsão de preço do Sankhya em todos os itens) e mudar o status. Só a Wellmix com
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

const FILE_KEY = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/);

/**
 * Nº da loja, nome do supplier e Tipo de item: quem importa informa (dono,
 * 23 e 24/11/2026; docs/BOOKING.md, "Dinâmica dos books"). Loja e supplier
 * são texto livre, só informativos; o tipo de item é obrigatório.
 */
function bookMeta(form: FormData) {
  const parsed = z
    .object({
      storeNumber: z.string().trim().max(60).nullable(),
      supplierName: z.string().trim().max(160).nullable(),
      itemType: z.string().trim().min(1).max(80),
    })
    .safeParse({
      storeNumber: str(form, "storeNumber") || null,
      supplierName: str(form, "supplierName") || null,
      itemType: str(form, "itemType"),
    });
  if (!parsed.success) throw new Error("booking_meta_required");
  // FOB ou EXW: obrigatório na importação; com EXW, o valor do EXW.
  const terms = bookTerms(form);
  if (!terms.incoterm) throw new Error("booking_incoterm_required");
  return { ...parsed.data, ...terms };
}

/** FOB/EXW do formulário e, com EXW, o valor digitado (acima de zero). */
function bookTerms(form: FormData) {
  const incoterm = z
    .enum(SHEET_INCOTERMS)
    .nullable()
    .parse(str(form, "incoterm") || null);
  if (incoterm !== "EXW") return { incoterm, exwValue: null };
  const exwValue = parseNumberInput(str(form, "exwValue"));
  if (exwValue === null || !Number.isFinite(exwValue) || exwValue <= 0)
    throw new Error("booking_exw_value_required");
  return { incoterm, exwValue };
}

/**
 * As planilhas do formulário, na ordem: as que subiram direto ao
 * armazenamento (`uploadedFileId`, uma por arquivo) e as que vieram no
 * próprio formulário. Várias formam um book só (dono, 23/11/2026).
 */
function sheetSources(form: FormData) {
  const keys = z
    .array(FILE_KEY)
    .max(20)
    .parse(form.getAll("uploadedFileId").map(String).filter(Boolean));
  const names = form.getAll("uploadedFileName").map(String);
  const uploaded = keys.map((fileKey, i) => ({
    fileKey,
    fileName: (names[i] ?? "").slice(0, 255) || null,
  }));
  const files = form
    .getAll("file")
    .filter((f): f is File => f instanceof File && f.size > 0);
  return [...uploaded, ...files];
}

/** Sobe a planilha (ou várias) e abre o booking criado (rascunho). */
export async function importBookingAction(form: FormData) {
  const user = await requireUser();
  await run(IMPORT, async () => {
    assertWellmix(user);
    assertScreen(user, "booking");
    const parsed = z
      .object({
        currency: z.enum(SHEET_CURRENCIES).nullable(),
        sheet: z.string().max(100).nullable(),
        sheetUrl: z.string().max(600).nullable(),
      })
      .parse({
        currency: str(form, "currency") || null,
        sheet: str(form, "sheet") || null,
        sheetUrl: str(form, "sheetUrl") || null,
      });
    const meta = bookMeta(form);
    const { SheetImportError } =
      await import("@/lib/services/product-sheet-import");
    const sources = [
      ...sheetSources(form),
      ...(parsed.sheetUrl ? [{ url: parsed.sheetUrl }] : []),
    ];
    if (!sources.length) throw new SheetImportError("file_required");
    const { createBookingLotFromSheet } =
      await import("@/lib/services/booking-lots");
    const lot = await createBookingLotFromSheet(user, sources, {
      defaultCurrency: parsed.currency,
      sheet: parsed.sheet,
      ...meta,
    });
    return withQuery(detail(lot.id), "created", "1");
  });
}

/**
 * O parceiro com a tela Booking (Trading…) lança o booking dele: a planilha
 * (ou várias) vira um booking em preenchimento em nome da empresa dele. Só
 * arquivo (sem link) e só login externo; o serviço confere a empresa (ativa
 * e de um tipo que responde por booking).
 */
export async function launchBookingAction(form: FormData) {
  const user = await requireUser();
  await run(IMPORT, async () => {
    if (isWellmix(user)) throw new ForbiddenError();
    assertScreen(user, "booking");
    const parsed = z
      .object({ currency: z.enum(SHEET_CURRENCIES).nullable() })
      .parse({ currency: str(form, "currency") || null });
    const meta = bookMeta(form);
    const { SheetImportError } =
      await import("@/lib/services/product-sheet-import");
    const sources = sheetSources(form);
    if (!sources.length) throw new SheetImportError("file_required");
    const { launchPartnerBooking } =
      await import("@/lib/services/booking-partner");
    const lot = await launchPartnerBooking(user, sources, {
      defaultCurrency: parsed.currency,
      ...meta,
    });
    return withQuery(detail(lot.id), "created", "1");
  });
}

/** Gravação de um campo na tabela (sem sair da tela): devolve o texto do erro. */
async function inline(
  lotId: string | null,
  save: (user: Awaited<ReturnType<typeof requireUser>>) => Promise<void>,
  who: () => ReturnType<typeof requireUser> = screenUser,
): Promise<InlineResult> {
  try {
    const user = await who();
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

/** Responsável pelo booking (para quem vão as solicitações); vazio = o fornecedor. */
export async function setBookingLotPartnerAction(
  lotId: string,
  partnerId: string,
): Promise<InlineResult> {
  const id = ID.safeParse(lotId);
  return inline(id.success ? id.data : null, async (user) => {
    const input = z
      .object({ lotId: ID, partnerId: z.union([z.literal(""), ID]) })
      .parse({ lotId, partnerId });
    const { setBookingLotPartner } =
      await import("@/lib/services/booking-lots");
    await setBookingLotPartner(user, input.lotId, input.partnerId || null);
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

/** O login externo com a tela Booking (o parceiro que lança o booking dele). */
async function partnerUser() {
  const user = await requireUser();
  if (isWellmix(user)) throw new ForbiddenError();
  assertScreen(user, "booking");
  return user;
}

/**
 * O parceiro confere a planilha que subiu: um campo de um item grava ao sair
 * dele, sem sair da tela. Só no booking dele e só antes de enviar (o serviço
 * confere).
 */
export async function setPartnerBookingItemFieldAction(
  lotId: string,
  itemId: string,
  field: string,
  value: string,
): Promise<InlineResult> {
  const id = ID.safeParse(lotId);
  return inline(
    id.success ? id.data : null,
    async (user) => {
      const input = z
        .object({
          itemId: ID,
          field: z.string().refine(isBookingItemField),
          value: z.string().max(4000),
        })
        .parse({ itemId, field, value });
      if (!isBookingItemField(input.field)) throw new Error("invalid_input");
      const { setPartnerBookingItemField } =
        await import("@/lib/services/booking-partner");
      await setPartnerBookingItemField(
        user,
        input.itemId,
        input.field,
        input.value,
      );
    },
    partnerUser,
  );
}

/* ------------------------------------------------------------------------ */
/* Preenchimento em massa ("Carregar", dono, 16/11/2026)                     */
/* ------------------------------------------------------------------------ */

/**
 * Resultado do "Carregar": quantos itens gravaram e quais não, cada um com o
 * campo e o motivo. `ok: false` quando nada foi tentado (login, booking
 * travado, pedido inválido).
 */
export type BulkFillResult =
  | {
      ok: true;
      updated: number;
      failed: Array<{ itemId: string; field: string | null; message: string }>;
    }
  | { ok: false; message: string };

const BULK_INPUT = z.object({
  lotId: ID,
  itemIds: z.array(ID).min(1).max(500),
  values: z.record(z.string().max(40), z.string().max(4000)),
});

/** Texto do erro, como o da célula (o do NCM incluído). */
async function bulkMessages() {
  const { getT } = await import("@/i18n/server");
  const t = await getT();
  return (error: unknown) => {
    const code = errorCode(LIST, error);
    return (
      [
        `bookingLots.error.${code}`,
        `bookingNcm.error.${code}`,
        `common.${code}`,
      ]
        .map((k) => [k, t(k as DictionaryKey)] as const)
        .find(([k, v]) => v !== k)?.[1] ?? fallbackError(t, code)
    );
  };
}

/**
 * Os valores do "Carregar": só campos do item (e o NCM, na Wellmix). Campo
 * vazio fica de fora (a coluna fica como está); sem nenhum, nada a gravar.
 */
function bulkValues(values: Record<string, string>, withNcm: boolean) {
  const fields: Array<[BookingItemField, string]> = [];
  let ncm: string | null = null;
  for (const [field, raw] of Object.entries(values)) {
    const value = raw.trim();
    if (!value) continue;
    if (withNcm && field === "ncm") ncm = value;
    else if (isBookingItemField(field)) fields.push([field, value]);
    else throw new Error("invalid_input");
  }
  if (!fields.length && ncm === null) throw new Error("invalid_input");
  return { fields, ncm };
}

async function bulk(
  lotId: string,
  itemIds: string[],
  values: Record<string, string>,
  who: () => ReturnType<typeof requireUser>,
  save: (
    user: Awaited<ReturnType<typeof requireUser>>,
    input: z.infer<typeof BULK_INPUT> & ReturnType<typeof bulkValues>,
  ) => Promise<{
    updated: string[];
    failed: Array<{ itemId: string; field: string | null; error: unknown }>;
  }>,
  withNcm: boolean,
): Promise<BulkFillResult> {
  const message = await bulkMessages();
  let result: Awaited<ReturnType<typeof save>>;
  let lot: string;
  try {
    const user = await who();
    const input = BULK_INPUT.parse({ lotId, itemIds, values });
    lot = input.lotId;
    result = await save(user, {
      ...input,
      ...bulkValues(input.values, withNcm),
    });
  } catch (error) {
    return { ok: false, message: message(error) };
  }
  revalidatePath(detail(lot));
  revalidatePath(LIST);
  return {
    ok: true,
    updated: result.updated.length,
    failed: result.failed.map((f) => ({
      itemId: f.itemId,
      field: f.field,
      message: message(f.error),
    })),
  };
}

/** Wellmix: os valores acima das colunas nos itens marcados do booking. */
export async function bulkSetBookingItemsAction(
  lotId: string,
  itemIds: string[],
  values: Record<string, string>,
): Promise<BulkFillResult> {
  return bulk(
    lotId,
    itemIds,
    values,
    screenUser,
    async (user, input) => {
      const { setBookingItemsFields } =
        await import("@/lib/services/booking-lots");
      return setBookingItemsFields(
        user,
        input.lotId,
        input.itemIds,
        input.fields,
        input.ncm,
      );
    },
    true,
  );
}

/** O parceiro: os valores acima das colunas nos itens marcados do booking dele. */
export async function bulkSetPartnerBookingItemsAction(
  lotId: string,
  itemIds: string[],
  values: Record<string, string>,
): Promise<BulkFillResult> {
  return bulk(
    lotId,
    itemIds,
    values,
    partnerUser,
    async (user, input) => {
      const { setPartnerBookingItemsFields } =
        await import("@/lib/services/booking-partner");
      return setPartnerBookingItemsFields(
        user,
        input.lotId,
        input.itemIds,
        input.fields,
      );
    },
    false,
  );
}

/** "Enviar para Wellmix Conferir": o booking sai do preenchimento e a Wellmix é avisada. */
export async function sendPartnerBookingAction(form: FormData) {
  const raw = str(form, "lotId");
  const back = ID.safeParse(raw).success ? detail(raw) : LIST;
  await run(back, async () => {
    const user = await partnerUser();
    const lotId = ID.parse(raw);
    const { sendPartnerBooking } =
      await import("@/lib/services/booking-partner");
    await sendPartnerBooking(user, lotId);
    return withQuery(detail(lotId), "sent", "1");
  });
}

/** Descarta o booking que o parceiro ainda preenchia (nada chegou à Wellmix). */
export async function discardPartnerBookingAction(form: FormData) {
  const raw = str(form, "lotId");
  const back = ID.safeParse(raw).success ? detail(raw) : LIST;
  await run(back, async () => {
    const user = await partnerUser();
    const lotId = ID.parse(raw);
    const { discardPartnerBooking } =
      await import("@/lib/services/booking-partner");
    await discardPartnerBooking(user, lotId);
    return withQuery(LIST, "discarded", "1");
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

/** Fecha o booking: confere os campos e pede a previsão de preço de todos os itens. */
export async function closeBookingLotAction(form: FormData) {
  const user = await requireUser();
  const raw = str(form, "lotId");
  const back = ID.safeParse(raw).success ? detail(raw) : LIST;
  await run(back, async () => {
    const input = z.object({ lotId: ID }).parse({ lotId: raw });
    const { closeBookingLot } = await import("@/lib/services/booking-lots");
    await closeBookingLot(user, input.lotId);
    return withQuery(back, "closed", "1");
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

/* ------------------------------------------------------------------------ */
/* Loja/Fábrica, Tipo de item e travas (dono, 23/11/2026)                    */
/* ------------------------------------------------------------------------ */

/** Loja/Fábrica e Tipo de item do book, na tela da Wellmix. */
export async function setBookingLotMetaAction(form: FormData) {
  const user = await requireUser();
  const raw = str(form, "lotId");
  const back = ID.safeParse(raw).success ? detail(raw) : LIST;
  await run(back, async () => {
    const input = z
      .object({
        lotId: ID,
        storeNumber: z.string().max(60).nullable(),
        supplierName: z.string().max(160).nullable(),
        itemType: z.string().max(80).nullable(),
      })
      .parse({
        lotId: raw,
        storeNumber: str(form, "storeNumber") || null,
        supplierName: str(form, "supplierName") || null,
        itemType: str(form, "itemType") || null,
      });
    const { setBookingLotMeta } = await import("@/lib/services/booking-lots");
    await setBookingLotMeta(user, input.lotId, {
      ...input,
      ...bookTerms(form),
    });
    return withQuery(back, "saved", "1");
  });
}

/** Volta para a lista ou para o book, conforme de onde veio o botão. */
const lockBack = (form: FormData) => {
  const from = str(form, "from");
  return ID.safeParse(from).success ? detail(from) : LIST;
};

/** O analista pega o book para si. */
export async function lockBookingLotAction(form: FormData) {
  const back = lockBack(form);
  await run(back, async () => {
    const user = await screenUser();
    const lotId = ID.parse(str(form, "lotId"));
    const { lockBookingLot } = await import("@/lib/services/booking-lots");
    await lockBookingLot(user, lotId);
    revalidatePath(LIST);
    return withQuery(back, "locked", "1");
  });
}

/** O analista pega para si todos os books de um tipo de item. */
export async function lockBookingTypeAction(form: FormData) {
  await run(LIST, async () => {
    const user = await screenUser();
    const itemType = z
      .string()
      .trim()
      .min(1)
      .max(80)
      .parse(str(form, "itemType"));
    const { lockBookingType } = await import("@/lib/services/booking-lots");
    await lockBookingType(user, itemType);
    revalidatePath(LIST);
    return withQuery(LIST, "locked", "1");
  });
}

/** Libera a trava (quem travou ou quem supervisiona os books). */
export async function unlockBookingAction(form: FormData) {
  const back = lockBack(form);
  await run(back, async () => {
    const user = await screenUser();
    const lockId = ID.parse(str(form, "lockId"));
    const { unlockBooking } = await import("@/lib/services/booking-lots");
    await unlockBooking(user, lockId);
    revalidatePath(LIST);
    return withQuery(back, "unlocked", "1");
  });
}

/* ------------------------------------------------------------------------ */
/* Fabricante: remover a linha ou confirmar a tela (dono, 24/11/2026)        */
/* ------------------------------------------------------------------------ */

/**
 * "A planilha estava errada": vale o Fabricante da tela nas linhas
 * divergentes (uma, com `itemId`, ou todas). Wellmix no rascunho; o parceiro
 * no book que ainda preenche.
 */
export async function confirmBookingManufacturerAction(form: FormData) {
  const raw = str(form, "lotId");
  const back = ID.safeParse(raw).success ? detail(raw) : LIST;
  await run(back, async () => {
    const user = await requireUser();
    assertScreen(user, "booking");
    const input = z
      .object({ lotId: ID, itemId: ID.nullable() })
      .parse({ lotId: raw, itemId: str(form, "itemId") || null });
    if (isWellmix(user)) {
      const { confirmBookingManufacturer } =
        await import("@/lib/services/booking-lots");
      await confirmBookingManufacturer(user, input.lotId, input.itemId);
    } else {
      const { confirmPartnerManufacturer } =
        await import("@/lib/services/booking-partner");
      await confirmPartnerManufacturer(user, input.lotId, input.itemId);
    }
    return withQuery(back, "manufacturer", "ok");
  });
}

/** Remove um item do book (a linha de outro fabricante). */
export async function removeBookingItemAction(form: FormData) {
  const raw = str(form, "lotId");
  const back = ID.safeParse(raw).success ? detail(raw) : LIST;
  await run(back, async () => {
    const user = await requireUser();
    assertScreen(user, "booking");
    const input = z
      .object({ lotId: ID, itemId: ID })
      .parse({ lotId: raw, itemId: str(form, "itemId") });
    if (isWellmix(user)) {
      const { removeBookingItem } = await import("@/lib/services/booking-lots");
      await removeBookingItem(user, input.lotId, input.itemId);
    } else {
      const { removePartnerBookingItem } =
        await import("@/lib/services/booking-partner");
      await removePartnerBookingItem(user, input.lotId, input.itemId);
    }
    return withQuery(back, "removed", "1");
  });
}

/** Cadastra o Supplier digitado na importação e o põe como Fornecedor do book. */
export async function registerBookingLotPartnerAction(form: FormData) {
  const raw = str(form, "lotId");
  const back = ID.safeParse(raw).success ? detail(raw) : LIST;
  await run(back, async () => {
    const user = await screenUser();
    const { registerBookingLotPartner } =
      await import("@/lib/services/booking-lots");
    await registerBookingLotPartner(user, ID.parse(raw));
    return withQuery(back, "supplier", "created");
  });
}

/** Recusa os itens marcados do book (não vão para a seleção; ficam trabalhados). */
export async function refuseBookingItemsAction(
  lotId: string,
  itemIds: string[],
): Promise<InlineResult> {
  const id = ID.safeParse(lotId);
  return inline(id.success ? id.data : null, async (user) => {
    const input = z
      .object({ lotId: ID, itemIds: z.array(ID).min(1).max(500) })
      .parse({ lotId, itemIds });
    const { refuseBookingItems } = await import("@/lib/services/booking-lots");
    await refuseBookingItems(user, input.lotId, input.itemIds);
  });
}
