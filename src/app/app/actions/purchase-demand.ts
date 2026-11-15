"use server";

import { z } from "zod";
import { assertScreen } from "@/lib/auth/screens";
import { parseNumberInput } from "@/lib/number-input";
import { field, requireUser, run, str } from "./helpers";

/*
 * Compra por demanda (mapa B10 e B14; docs/PURCHASE_DEMAND.md). Aqui só o
 * formato; o serviço confere quem pode (ação "Abrir reposição").
 */

const ID = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/);
const DAY = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => !Number.isNaN(Date.parse(`${v}T12:00:00.000Z`)));

/** Reposição aberta à mão pelo Planner: produto, quantidade e data desejada. */
export async function openReplenishmentAction(form: FormData) {
  const user = await requireUser();
  await run("/app/replenishment", async () => {
    assertScreen(user, "requests");
    const productId = ID.parse(str(form, "productId"));
    const quantity = z
      .number()
      .positive()
      .max(10_000_000)
      .parse(parseNumberInput(str(form, "quantity")));
    const day = str(form, "desiredAt");
    const desiredAt = day ? `${DAY.parse(day)}T12:00:00.000Z` : null;
    const notes = field(form, "notes", z.string().trim().max(2000)) || null;
    const { openReplenishment } =
      await import("@/lib/services/purchase-demand");
    const request = await openReplenishment(user, {
      productId,
      quantity,
      desiredAt,
      notes,
    });
    return `/app/replenishment?opened=${encodeURIComponent(request.id)}`;
  });
}

const CHOICE = z.enum(["last_supplier", "quote"]);

/** Estratégia de compra (mapa B10?): o Comprador escolhe para as demandas marcadas. */
export async function chooseStrategyAction(form: FormData) {
  const user = await requireUser();
  await run("/app/purchase-strategy", async () => {
    assertScreen(user, "quotes");
    const demandIds = z
      .array(ID)
      .min(1)
      .max(200)
      .parse(form.getAll("demandIds").map(String));
    const choice = CHOICE.parse(str(form, "choice"));
    const note = field(form, "note", z.string().trim().max(2000)) || null;
    const { chooseStrategy } = await import("@/lib/services/purchase-strategy");
    const decision = await chooseStrategy(user, { demandIds, choice, note });
    return `/app/purchase-strategy?chosen=${decision.number}#decision-${decision.id}`;
  });
}

/** A Diretoria de compras aprova ou recusa a estratégia. */
export async function decideStrategyAction(form: FormData) {
  const user = await requireUser();
  await run("/app/purchase-strategy", async () => {
    assertScreen(user, "quotes");
    const id = ID.parse(str(form, "id"));
    const approve = z.enum(["approve", "reject"]).parse(str(form, "decision"));
    const note = field(form, "note", z.string().trim().max(2000)) || null;
    const { decideStrategy } = await import("@/lib/services/purchase-strategy");
    const decision = await decideStrategy(user, id, {
      approve: approve === "approve",
      note,
    });
    return `/app/purchase-strategy?decided=${decision.number}#decision-${decision.id}`;
  });
}

/** Pedido de compra da estratégia "fornecedor da última compra", com as condições conferidas. */
export async function orderFromStrategyAction(form: FormData) {
  const user = await requireUser();
  await run("/app/purchase-strategy", async () => {
    assertScreen(user, "quotes");
    assertScreen(user, "orders");
    const id = ID.parse(str(form, "id"));
    const quantity = z
      .number()
      .positive()
      .max(1e9)
      .parse(parseNumberInput(str(form, "quantity")));
    const priceRaw = str(form, "unitPrice");
    const unitPrice = priceRaw
      ? z.number().nonnegative().max(1e9).parse(parseNumberInput(priceRaw))
      : null;
    const currency = z
      .string()
      .trim()
      .regex(/^[A-Z]{3}$/)
      .parse(str(form, "currency").toUpperCase());
    const leadRaw = str(form, "leadTimeDays");
    const leadTimeDays = leadRaw
      ? z
          .number()
          .int()
          .min(0)
          .max(1000)
          .parse(parseNumberInput(leadRaw, { int: true }))
      : null;
    const incotermRaw = str(form, "incoterm");
    const incoterm = incotermRaw
      ? z.enum(["EXW", "FOB"]).parse(incotermRaw)
      : null;
    const { orderFromStrategy } =
      await import("@/lib/services/purchase-strategy");
    const order = await orderFromStrategy(user, id, {
      unitPrice,
      currency,
      quantity,
      leadTimeDays,
      incoterm,
    });
    return `/app/orders/${order.id}?created=1`;
  });
}
