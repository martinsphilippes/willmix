"use server";

import { z } from "zod";
import { can } from "@/lib/auth/function-access";
import { ForbiddenError } from "@/lib/auth/permissions";
import { CURRENCIES } from "@/lib/currencies";
import { MAX_UNIT_PRICE, recordOrderSale } from "@/lib/services/order-sale";
import { recordOrderSaleByFormat } from "@/lib/services/order-sale-quote";
import { SALE_FORMATS } from "@/lib/order-terms";
import { field, requireUser, run, str } from "./helpers";

/*
 * Venda ao cliente por pedido e por produto (dono, 14/11/2026;
 * docs/ORDER_SALE.md): o card "Venda ao cliente" do detalhe do pedido grava o
 * preço de cada produto (`price.<item>`) e a moeda do pedido; o total é a
 * soma. Quem tem a ação "Gravar a venda ao cliente" (o serviço confere de
 * novo).
 */

const ID = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const PRICE = z.number().finite().min(0).max(MAX_UNIT_PRICE);

export async function recordOrderSaleAction(form: FormData) {
  const user = await requireUser();
  const orderId = str(form, "orderId").slice(0, 64);
  const back = `/app/orders/${encodeURIComponent(orderId)}`;
  await run(back, async () => {
    if (!can(user, "sale.record")) throw new ForbiddenError("sale_forbidden");
    ID.parse(orderId);
    const currency = field(form, "currency", z.enum(CURRENCIES));
    const prices: Record<string, number | null> = {};
    for (const [key, value] of form.entries()) {
      if (!key.startsWith("price.")) continue;
      const itemId = ID.parse(key.slice("price.".length));
      const raw = typeof value === "string" ? value.trim() : "";
      prices[itemId] =
        raw === "" ? null : PRICE.parse(Number(raw.replace(",", ".")));
    }
    // Preço digitado (sem o Sankhya ligado): a venda não é de um formato.
    await recordOrderSale(user, orderId, {
      currency,
      prices,
      saleFormat: null,
    });
    return `${back}?sale=saved#order-sale`;
  });
}

/**
 * Venda pelos preços da cotação (dono, 24/11/2026; docs/ORDER_SALE.md,
 * "Preços pela API"): só o formato escolhido (WD ou Wellmix) vem da tela; o
 * servidor refaz a cotação do dia de cada produto e grava em R$.
 */
export async function recordOrderSaleFormatAction(form: FormData) {
  const user = await requireUser();
  const orderId = str(form, "orderId").slice(0, 64);
  const back = `/app/orders/${encodeURIComponent(orderId)}`;
  await run(back, async () => {
    if (!can(user, "sale.record")) throw new ForbiddenError("sale_forbidden");
    ID.parse(orderId);
    const format = field(form, "format", z.enum(SALE_FORMATS));
    await recordOrderSaleByFormat(user, orderId, format);
    return `${back}?sale=saved#order-sale`;
  });
}
