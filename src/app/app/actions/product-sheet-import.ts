"use server";

import { z } from "zod";
import { SHEET_CURRENCIES } from "@/lib/db";
import { requireUser, run, str } from "./helpers";

/*
 * Cadastro de produtos pela planilha da ficha técnica (Cadastros → Produtos
 * → Importar ficha técnica). Só a Wellmix (o serviço confere).
 */

const BACK = "/app/products/import";

export async function importProductSheetAction(form: FormData) {
  const user = await requireUser();
  await run(BACK, async () => {
    const parsed = z
      .object({
        lineId: z.string().min(1).max(64),
        namePrefix: z.string().max(60).nullable(),
        currency: z.enum(SHEET_CURRENCIES).nullable(),
        sheet: z.string().max(100).nullable(),
      })
      .parse({
        lineId: str(form, "lineId"),
        namePrefix: str(form, "namePrefix") || null,
        currency: str(form, "currency") || null,
        sheet: str(form, "sheet") || null,
      });
    const file = form.get("file");
    const { importProductSheet, SheetImportError } =
      await import("@/lib/services/product-sheet-import");
    if (!(file instanceof File) || file.size === 0)
      throw new SheetImportError("file_required");
    const result = await importProductSheet(user, file, {
      lineId: parsed.lineId,
      namePrefix: parsed.namePrefix,
      defaultCurrency: parsed.currency,
      sheet: parsed.sheet,
    });
    return `/app/products/import/${result.batchId}`;
  });
}
