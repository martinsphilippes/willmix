"use server";

import { z } from "zod";
import {
  assertWellmix,
  canViewOrder,
  ForbiddenError,
  isWellmix,
} from "@/lib/auth/permissions";
import { getStore, REPURCHASE_INTERESTS } from "@/lib/db";
import {
  answerAfterSales,
  closeAfterSales,
  getAfterSales,
  openAfterSales,
} from "@/lib/services/after-sales";
import { createFollowUpRequest } from "@/lib/services/requests";
import { num, requireUser, run, str } from "./helpers";

/*
 * Módulo cliente 2 (Segunda Onda): pós-venda no pedido (responder, encerrar,
 * abrir retroativamente) e "comprar de novo / nova proposta" a partir de um
 * pedido encerrado. As regras de papel e isolamento ficam nos serviços;
 * aqui só validação de entrada (zod) e redirecionamento.
 */

const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .transform((s) => (s.trim() === "" ? null : s.trim()))
    .nullable();

const answerSchema = z.object({
  afterSalesId: z.string().min(1),
  orderId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  experience: optionalText(2000),
  problems: optionalText(2000),
  perceivedCosts: optionalText(2000),
  suggestions: optionalText(2000),
  repurchaseInterest: z.enum(REPURCHASE_INTERESTS).nullable(),
});

/** Cliente (dono do pedido) ou Wellmix responde o pós-venda aberto. */
export async function answerAfterSalesAction(form: FormData) {
  const user = await requireUser();
  const orderId = str(form, "orderId");
  const back = `/app/orders/${orderId}#after-sales`;
  await run(back, async () => {
    const interest = str(form, "repurchaseInterest");
    const parsed = answerSchema.parse({
      afterSalesId: str(form, "afterSalesId"),
      orderId,
      rating: num(form, "rating"),
      experience: str(form, "experience"),
      problems: str(form, "problems"),
      perceivedCosts: str(form, "perceivedCosts"),
      suggestions: str(form, "suggestions"),
      repurchaseInterest: interest === "" ? null : interest,
    });
    const row = await getStore().get("after_sales", parsed.afterSalesId);
    if (!row || row.orderId !== orderId) throw new Error("not_found");
    if (row.status !== "open") throw new Error("already_answered");
    // Papel (cliente dono ou Wellmix) e isolamento são checados no serviço.
    await answerAfterSales(user, parsed.afterSalesId, {
      rating: parsed.rating,
      experience: parsed.experience,
      problems: parsed.problems,
      perceivedCosts: parsed.perceivedCosts,
      suggestions: parsed.suggestions,
      repurchaseInterest: parsed.repurchaseInterest,
    });
    return back;
  });
}

/** Wellmix encerra o pós-venda com observação do que foi feito. */
export async function closeAfterSalesAction(form: FormData) {
  const user = await requireUser();
  const orderId = str(form, "orderId");
  const back = `/app/orders/${orderId}#after-sales`;
  await run(back, async () => {
    assertWellmix(user);
    const parsed = z
      .object({
        afterSalesId: z.string().min(1),
        notes: optionalText(2000),
      })
      .parse({
        afterSalesId: str(form, "afterSalesId"),
        notes: str(form, "notes"),
      });
    const row = await getStore().get("after_sales", parsed.afterSalesId);
    if (!row || row.orderId !== orderId) throw new Error("not_found");
    if (row.status === "closed") throw new Error("already_closed");
    await closeAfterSales(user, parsed.afterSalesId, parsed.notes);
    return back;
  });
}

/** Pedidos encerrados antes do recurso: Wellmix abre o pós-venda manualmente. */
export async function openAfterSalesAction(form: FormData) {
  const user = await requireUser();
  const orderId = str(form, "orderId");
  const back = `/app/orders/${orderId}#after-sales`;
  await run(back, async () => {
    assertWellmix(user);
    const order = await getStore().get("orders", orderId);
    if (!order) throw new Error("not_found");
    if (order.status !== "CLOSED" && order.status !== "DELIVERED")
      throw new Error("order_not_delivered");
    if (await getAfterSales(orderId)) throw new Error("already_open");
    const row = await openAfterSales(user, order);
    if (!row) throw new Error("after_sales_disabled");
    return back;
  });
}

const followUpSchema = z.object({
  orderId: z.string().min(1),
  quantity: z.number().positive(),
  origin: z.enum(["replenishment", "proposal"]),
  notes: optionalText(2000),
  deadline: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
});

/**
 * "Comprar de novo" (reposição) ou "Quero nova proposta": abre uma solicitação
 * pré-preenchida com o produto do pedido e redireciona para ela.
 * Cliente só nos próprios pedidos; Wellmix em qualquer um.
 */
export async function createFollowUpRequestAction(form: FormData) {
  const user = await requireUser();
  const orderId = str(form, "orderId");
  const back = `/app/orders/${orderId}#followup`;
  await run(back, async () => {
    if (!(isWellmix(user) || user.role === "customer"))
      throw new ForbiddenError();
    const parsed = followUpSchema.parse({
      orderId,
      quantity: num(form, "quantity"),
      origin: str(form, "origin"),
      notes: str(form, "notes"),
      deadline: str(form, "deadline") || null,
    });
    const order = await getStore().get("orders", orderId);
    if (!order || !canViewOrder(user, order)) throw new ForbiddenError();
    if (order.status !== "CLOSED" && order.status !== "DELIVERED")
      throw new Error("order_not_delivered");
    const request = await createFollowUpRequest(user, orderId, {
      quantity: parsed.quantity,
      origin: parsed.origin,
      notes: parsed.notes,
      deadline: parsed.deadline,
    });
    return `/app/requests/${request.id}`;
  });
}
