"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getT } from "@/i18n/server";
import { errorTextFor } from "@/i18n/error-text";
import { assertScreen } from "@/lib/auth/screens";
import { dieCutHref, parseLeadTime, parseMoq } from "@/lib/die-cut-step";
import { errorCode, requireUser, str, withQuery } from "./helpers";

/*
 * Quadro Die Cut do pedido de compra: confirmar (ou corrigir) o pedido
 * mínimo e o prazo de entrega de um produto. Aqui só o formato; o serviço
 * confere quem pode e a etapa. O die-cut e a foto em alta sobem pelo envio
 * de item do pedido (`submitRequirementAction`, com `returnTo=die-cut`).
 *
 * Recusa não troca de tela (pedido do dono, 13/11/2026): o erro volta para
 * junto do formulário e o que foi digitado fica. Deu certo, a página volta
 * com o aviso de salvo e o bloco mostra o resumo "Confirmado".
 */

const ID = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;

type TermsField = "moq" | "leadTimeDays";

export interface DieCutTermsState {
  /** Código da recusa; nulo quando não há o que mostrar. */
  error: string | null;
  /** Texto da recusa, já no idioma de quem enviou. */
  message: string | null;
  /** Campo recusado, quando se sabe: a tela marca o campo. */
  field: TermsField | null;
}

const FIELD_OF_ERROR: Record<string, TermsField> = {
  invalid_moq: "moq",
  invalid_lead_time: "leadTimeDays",
};

export async function confirmDieCutTermsAction(
  _prev: DieCutTermsState,
  form: FormData,
): Promise<DieCutTermsState> {
  const user = await requireUser();
  const orderId = str(form, "orderId");
  const itemId = str(form, "itemId");
  const back = ID.test(orderId)
    ? dieCutHref(orderId, ID.test(itemId) ? itemId : null)
    : "/app";
  const rawMoq = str(form, "moq");
  const rawDays = str(form, "leadTimeDays");
  try {
    assertScreen(user, "orders");
    const order = z.string().regex(ID).parse(orderId);
    const item = z.string().regex(ID).parse(itemId);
    if (!rawMoq || !rawDays) throw new Error("terms_required");
    const moq = parseMoq(rawMoq);
    if (moq === null) throw new Error("invalid_moq");
    const leadTimeDays = parseLeadTime(rawDays);
    if (leadTimeDays === null) throw new Error("invalid_lead_time");
    const { confirmDieCutTerms } = await import("@/lib/services/die-cut-step");
    await confirmDieCutTerms(user, order, item, { moq, leadTimeDays });
  } catch (error) {
    const code = errorCode(back, error);
    const t = await getT();
    return {
      error: code,
      message: errorTextFor(t, code, ["dieCut.error", "orders.error"]),
      field:
        code === "terms_required"
          ? rawMoq
            ? "leadTimeDays"
            : "moq"
          : (FIELD_OF_ERROR[code] ?? null),
    };
  }
  revalidatePath("/app", "layout");
  redirect(withQuery(back, "saved", "terms"));
}
