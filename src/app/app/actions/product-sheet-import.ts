"use server";

import { z } from "zod";
import { assertWellmix } from "@/lib/auth/permissions";
import { assertScreen } from "@/lib/auth/screens";
import { SHEET_CURRENCIES } from "@/lib/db";
import { requireUser, run, str } from "./helpers";

/*
 * Cadastro de produtos pela planilha da ficha técnica (Cadastros → Produtos
 * → Importar ficha técnica). Só a Wellmix (o serviço confere). Mandar para o
 * Booking (na importação ou relendo uma planilha antiga) exige também a tela
 * Booking.
 */

const BACK = "/app/products/import";

/** Id de lote (UUID ou id do Appwrite): letras, números, "_" e "-". */
const BATCH_ID = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/);

/**
 * Booking sem a tabela publicada: a importação recusa antes de gravar. A tela
 * ganha o aviso próprio (o "schema_outdated" da importação fala das variações).
 */
async function withBookingSchemaError<T>(fn: () => Promise<T>): Promise<T> {
  const { SheetImportError } =
    await import("@/lib/services/product-sheet-import");
  try {
    return await fn();
  } catch (error) {
    if (
      error instanceof SheetImportError &&
      error.message === "schema_outdated"
    )
      throw new SheetImportError("booking_schema_outdated");
    throw error;
  }
}

export async function importProductSheetAction(form: FormData) {
  const user = await requireUser();
  await run(BACK, async () => {
    assertScreen(user, "products");
    const parsed = z
      .object({
        lineId: z.string().min(1).max(64),
        namePrefix: z.string().max(60).nullable(),
        currency: z.enum(SHEET_CURRENCIES).nullable(),
        sheet: z.string().max(100).nullable(),
        // Planilha grande (com fotos) já subida direto ao armazenamento.
        uploadedFileId: z.string().max(64).nullable(),
        uploadedFileName: z.string().max(255).nullable(),
        // Link de uma planilha do Google Sheets compartilhada com o link.
        sheetUrl: z.string().max(600).nullable(),
        // Resultado: produtos no Booking (um por linha), um produto com
        // variações (padrão de quem não informa) ou um produto por linha.
        mode: z.enum(["booking", "variants", "products"]),
        // Fornecedor dos produtos desta importação (obrigatório no Booking).
        supplierId: z.string().max(64).nullable(),
      })
      .parse({
        lineId: str(form, "lineId"),
        namePrefix: str(form, "namePrefix") || null,
        currency: str(form, "currency") || null,
        sheet: str(form, "sheet") || null,
        uploadedFileId: str(form, "uploadedFileId") || null,
        uploadedFileName: str(form, "uploadedFileName") || null,
        sheetUrl: str(form, "sheetUrl") || null,
        mode: str(form, "mode") || "variants",
        supplierId: str(form, "supplierId") || null,
      });
    // Mandar para o Booking: só quem abre a tela Booking (o serviço confere de novo).
    if (parsed.mode === "booking") assertScreen(user, "booking");
    const file = form.get("file");
    const { importProductSheet, SheetImportError } =
      await import("@/lib/services/product-sheet-import");
    const source = parsed.uploadedFileId
      ? { fileKey: parsed.uploadedFileId, fileName: parsed.uploadedFileName }
      : file instanceof File && file.size > 0
        ? file
        : parsed.sheetUrl
          ? { url: parsed.sheetUrl }
          : null;
    if (!source) throw new SheetImportError("file_required");
    // Cada Booking que sobe é de um fornecedor: sem ele, não importa.
    if (parsed.mode === "booking" && !parsed.supplierId)
      throw new SheetImportError("supplier_required");
    const options = {
      lineId: parsed.lineId,
      namePrefix: parsed.namePrefix,
      defaultCurrency: parsed.currency,
      sheet: parsed.sheet,
      mode: parsed.mode,
      supplierId: parsed.supplierId,
    };
    const result =
      parsed.mode === "booking"
        ? await withBookingSchemaError(() =>
            importProductSheet(user, source, options),
          )
        : await importProductSheet(user, source, options);
    return `/app/products/import/${result.batchId}`;
  });
}

/**
 * "Mandar para o Booking" numa importação anterior (com variações ou um
 * produto por linha): relê a planilha guardada do lote e cria um produto por
 * linha no Booking. Nasce um lote novo; o produto com variações da importação
 * antiga fica como está.
 */
export async function reimportSheetToBookingAction(form: FormData) {
  const user = await requireUser();
  const raw = str(form, "batchId");
  // Volta para o resultado do lote (o erro aparece lá); id estranho, para a lista.
  const back = BATCH_ID.safeParse(raw).success ? `${BACK}/${raw}` : BACK;
  await run(back, async () => {
    assertWellmix(user);
    assertScreen(user, "products");
    assertScreen(user, "booking");
    const batchId = BATCH_ID.parse(raw);
    const { reimportSheetToBooking } =
      await import("@/lib/services/product-sheet-import");
    const result = await withBookingSchemaError(() =>
      reimportSheetToBooking(user, batchId),
    );
    return `/app/products/import/${result.batchId}`;
  });
}
