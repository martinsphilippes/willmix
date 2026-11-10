"use server";

import { z } from "zod";
import { parseNumberInput } from "@/lib/number-input";
import {
  files,
  requireUser,
  run,
  str,
  uploadedPhotoKeys,
  withQuery,
} from "./helpers";

/*
 * Etapa "Die Cut" do fornecedor escolhido (src/lib/services/die-cut-step.ts):
 * foto em alta, pedido mínimo e prazo de entrega, pela cotação escolhida ou
 * pelo pedido. O die-cut em si sobe pela ação da embalagem
 * (uploadDielineAction). O serviço confere se é o fornecedor da cotação
 * escolhida (ou a Wellmix); aqui só o formato.
 */

const ID = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/);

/** Volta para a tela de onde a ação partiu (só caminhos do portal). */
function returnTarget(form: FormData): string {
  const returnTo = str(form, "back");
  return /^\/app\/[\w\-./?=&#%]*$/.test(returnTo) ? returnTo : "/app";
}

export async function sendDieCutStepAction(form: FormData) {
  const user = await requireUser();
  const target = returnTarget(form);
  await run(target, async () => {
    const orderId = str(form, "orderId");
    const quoteId = str(form, "quoteId");
    const from = orderId
      ? { orderId: ID.parse(orderId) }
      : { quoteId: ID.parse(quoteId) };
    const item = z.enum(["hd", "terms"]).parse(str(form, "item"));
    const number = (key: string, code: string) => {
      const v = parseNumberInput(str(form, key), { int: true });
      if (v === null) return null;
      if (Number.isNaN(v)) throw new Error(code);
      return v;
    };
    let hdPhotos: (File | string)[] = [];
    let moq: number | null = null;
    let leadTimeDays: number | null = null;
    if (item === "hd") {
      hdPhotos = [...files(form, "hd"), ...uploadedPhotoKeys(form)];
      if (!hdPhotos.length) throw new Error("photo_required");
    } else {
      moq = number("moq", "invalid_moq");
      leadTimeDays = number("leadTimeDays", "invalid_lead_time");
      if (moq === null || leadTimeDays === null)
        throw new Error("terms_required");
    }
    const { sendDieCutStep } = await import("@/lib/services/die-cut-step");
    await sendDieCutStep(user, from, { hdPhotos, moq, leadTimeDays });
    return withQuery(target, "dieline", item);
  });
}
