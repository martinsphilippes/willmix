"use server";

import { z } from "zod";
import { assertScreen } from "@/lib/auth/screens";
import { dieCutHref, parseLeadTime, parseMoq } from "@/lib/die-cut-step";
import { requireUser, run, str, withQuery } from "./helpers";

/*
 * Quadro Die Cut do pedido de compra: confirmar (ou corrigir) o pedido
 * mínimo e o prazo de entrega de um produto. Aqui só o formato; o serviço
 * confere quem pode e a etapa. O die-cut e a foto em alta sobem pelo envio
 * de item do pedido (`submitRequirementAction`, com `returnTo=die-cut`).
 */

const ID = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;

export async function confirmDieCutTermsAction(form: FormData) {
  const user = await requireUser();
  const orderId = str(form, "orderId");
  const itemId = str(form, "itemId");
  const back = ID.test(orderId)
    ? dieCutHref(orderId, ID.test(itemId) ? itemId : null)
    : "/app";
  await run(back, async () => {
    assertScreen(user, "orders");
    const order = z.string().regex(ID).parse(orderId);
    const item = z.string().regex(ID).parse(itemId);
    const rawMoq = str(form, "moq");
    const rawDays = str(form, "leadTimeDays");
    if (!rawMoq || !rawDays) throw new Error("terms_required");
    const moq = parseMoq(rawMoq);
    if (moq === null) throw new Error("invalid_moq");
    const leadTimeDays = parseLeadTime(rawDays);
    if (leadTimeDays === null) throw new Error("invalid_lead_time");
    const { confirmDieCutTerms } = await import("@/lib/services/die-cut-step");
    await confirmDieCutTerms(user, order, item, { moq, leadTimeDays });
    return withQuery(back, "saved", "terms");
  });
}
