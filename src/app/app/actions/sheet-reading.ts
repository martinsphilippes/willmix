"use server";

import { z } from "zod";
import { SHEET_READING_SCOPES } from "@/lib/db";
import { assertWellmix } from "@/lib/auth/permissions";
import { aiErrorCode, AiError } from "@/lib/integrations/ai";
import { READING_FIELDS } from "@/lib/services/sheet-reading-calc";
import { files, requireUser, run, str, uploadedPhotoKeys } from "./helpers";

/*
 * Ficha pela foto do quadro: ler (fornecedor ou Wellmix, quem edita a ficha)
 * e decidir divergências (só a Wellmix). O serviço confere papel e acesso de
 * novo; a volta cai na seção do quadro (#board).
 */

const KEY = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const SCOPE = z.enum(SHEET_READING_SCOPES);

function backFor(scope: (typeof SHEET_READING_SCOPES)[number], key: string) {
  const k = encodeURIComponent(key);
  if (scope === "quote") return `/app/quotes/${k}`;
  if (scope === "order") return `/app/orders/${k}/purchase-sheet`;
  return `/app/products/${k}`;
}

export async function readSheetBoardAction(form: FormData) {
  const user = await requireUser();
  const scope = SCOPE.safeParse(str(form, "scope"));
  const key = KEY.safeParse(str(form, "sheetKey"));
  const back =
    scope.success && key.success ? backFor(scope.data, key.data) : "/app";
  await run(`${back}#board`, async () => {
    if (!scope.success || !key.success) throw new Error("invalid_input");
    const photo = files(form, "photo")[0] ?? uploadedPhotoKeys(form)[0];
    if (!photo) throw new Error("photo_required");
    const { readSheetBoard } = await import("@/lib/services/sheet-reading");
    try {
      const r = await readSheetBoard(user, scope.data, key.data, photo);
      return `${back}?board=${r.filled.length}-${r.divergent.length}#board`;
    } catch (error) {
      // Falha da própria IA vira "ai_<motivo>" (crédito, limite, fora do ar…).
      if (error instanceof AiError) throw error;
      if (error instanceof Error && /^ai_|^[a-z_]+$/.test(error.message))
        throw error;
      throw new Error(`ai_${aiErrorCode(error)}`);
    }
  });
}

export async function resolveReadingDivergenceAction(form: FormData) {
  const user = await requireUser();
  const scope = SCOPE.safeParse(str(form, "scope"));
  const key = KEY.safeParse(str(form, "sheetKey"));
  const back =
    scope.success && key.success ? backFor(scope.data, key.data) : "/app";
  await run(`${back}#board`, async () => {
    assertWellmix(user);
    const readingId = KEY.parse(str(form, "readingId"));
    const field = z.enum(READING_FIELDS).parse(str(form, "field"));
    const choice = z.enum(["photo", "sheet"]).parse(str(form, "choice"));
    const { resolveReadingDivergence } =
      await import("@/lib/services/sheet-reading");
    await resolveReadingDivergence(user, readingId, field, choice);
    return `${back}?board=resolved#board`;
  });
}
