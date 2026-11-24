import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { isWellmix } from "@/lib/auth/permissions";
import { canSeePurchasePrice } from "@/lib/auth/function-access";
import { getStore } from "@/lib/db";
import {
  bookingForecastMissing,
  bookingItemForecastQuery,
} from "@/lib/booking-forecast";
import { getPriceForecastAdapter } from "@/lib/integrations/price-forecast";
import { brazilDay } from "@/lib/supplier-terms";

export const dynamic = "force-dynamic";

const ID = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const DECIMAL = z
  .string()
  .regex(/^\d{1,9}([.,]\d{1,4})?$/)
  .transform((v) => Number(v.replace(",", ".")))
  .refine((n) => n > 0);
const QUERY = z.object({
  itemId: ID,
  // Preço e moeda da contraproposta (no lugar dos da planilha).
  price: DECIMAL.optional(),
  currency: z.enum(["RMB", "CNY", "USD", "EUR"]).optional(),
  // Preço de venda desejado (R$ por peça): a conta inversa.
  target: DECIMAL.optional(),
});

/**
 * Previsão de preço de um item do book com o preço da contraproposta (dono,
 * 24/11/2026; src/lib/booking-forecast.ts): a mesma API de preço do Sankhya
 * da Nova solicitação, com a ficha do item e o NCM. Sem `target`: venda
 * prevista e custo; com `target`: o preço máximo de compra. Só a Wellmix com
 * "Ver preço de compra". Sem o Sankhya: `{ mode: "manual" }`.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !isWellmix(user) || !canSeePurchasePrice(user))
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  const params = new URL(request.url).searchParams;
  const parsed = QUERY.safeParse({
    itemId: params.get("itemId") ?? undefined,
    price: params.get("price") || undefined,
    currency: params.get("currency") || undefined,
    target: params.get("target") || undefined,
  });
  if (!parsed.success)
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const { itemId, price, currency, target } = parsed.data;
  const store = getStore();
  const item = await store.get("booking_items", itemId);
  if (!item) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const q = bookingItemForecastQuery(item, {
    price: price ?? item.price,
    currency: currency ?? item.currency,
    dataRef: (brazilDay(new Date()) ?? "").replace(/-/g, "") || null,
  });
  const missing = bookingForecastMissing(q);
  // Na conta inversa o preço não precisa estar preenchido.
  const blocking = target ? missing.filter((m) => m !== "price") : missing;
  const headers = { "Cache-Control": "private, no-store" };
  if (blocking.length)
    return NextResponse.json(
      { mode: "missing", missing: blocking },
      { headers },
    );
  const adapter = getPriceForecastAdapter(true);
  const answer = target
    ? await adapter.solve({ ...q, targetFinalPriceBrl: target })
    : await adapter.forecast(q);
  return NextResponse.json(answer, { headers });
}
