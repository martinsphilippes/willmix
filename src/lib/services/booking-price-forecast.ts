import "server-only";
import { after } from "next/server";
import { getStore } from "@/lib/db";
import type { BookingAnalysis, BookingItem, BookingLot } from "@/lib/db/schema";
import {
  bookingForecastMissing,
  bookingItemForecastQuery,
  forecastAnalysis,
} from "@/lib/booking-forecast";
import {
  getPriceForecastAdapter,
  type PriceForecastAdapter,
} from "@/lib/integrations/price-forecast";
import { brazilDay } from "@/lib/supplier-terms";

/*
 * Previsão de preço dos itens do Book pela API de preço do Sankhya (dono,
 * 24/11/2026; src/lib/booking-forecast.ts). Uma chamada por item, uma de
 * cada vez (o Sankhya recusa duas simultâneas da mesma sessão). Só leitura
 * do Sankhya; grava o retrato em `booking_items.analysis`. Quem chama
 * confere a permissão; o retrato só aparece para a Wellmix.
 */

const today = (now = new Date()) =>
  (brazilDay(now) ?? "").replace(/-/g, "") || null;

/** Previsão de cada item (id → retrato). Um item que falha não para os outros. */
export async function forecastBookingItems(
  items: readonly BookingItem[],
  options: {
    byUserId: string;
    /** Incoterm do book (o item sem o dele usa este). */
    incoterm?: string | null;
    adapter?: PriceForecastAdapter;
    now?: Date;
  },
): Promise<Map<string, BookingAnalysis>> {
  // Custo e margem entram no retrato: a tela só o mostra a quem vê o preço de compra.
  const adapter = options.adapter ?? getPriceForecastAdapter(true);
  const now = options.now ?? new Date();
  const at = now.toISOString();
  const dataRef = today(now);
  const out = new Map<string, BookingAnalysis>();
  for (const item of items) {
    const q = bookingItemForecastQuery(item, {
      incoterm: options.incoterm ?? null,
      dataRef,
    });
    const meta = { at, byUserId: options.byUserId };
    const missing = bookingForecastMissing(q);
    if (missing.length) {
      out.set(item.id, {
        ...forecastAnalysis({ mode: "manual" }, q, meta),
        missing,
      });
      continue;
    }
    try {
      out.set(item.id, forecastAnalysis(await adapter.forecast(q), q, meta));
    } catch (error) {
      out.set(item.id, {
        ...forecastAnalysis({ mode: "manual" }, q, meta),
        missing: ["error"],
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return out;
}

/** Roda a previsão nos itens e grava o retrato de cada um. */
export async function recordBookingForecasts(
  items: readonly BookingItem[],
  options: { byUserId: string; incoterm?: string | null },
): Promise<number> {
  const store = getStore();
  const analyses = await forecastBookingItems(items, options);
  let saved = 0;
  for (const item of items) {
    const analysis = analyses.get(item.id);
    if (!analysis) continue;
    await store.update("booking_items", item.id, { analysis });
    saved++;
  }
  return saved;
}

/**
 * Agenda a previsão do book para depois da resposta (fechar não espera o
 * Sankhya, item a item). Fora de uma requisição (testes, scripts), roda na
 * hora.
 */
export async function scheduleBookingForecasts(
  lot: Pick<BookingLot, "incoterm">,
  items: readonly BookingItem[],
  byUserId: string,
): Promise<void> {
  const run = () =>
    recordBookingForecasts(items, {
      byUserId,
      incoterm: lot.incoterm ?? null,
    });
  try {
    after(async () => {
      try {
        await run();
      } catch (error) {
        console.error(
          "[booking-forecast] previsão do book falhou",
          error instanceof Error ? error.message : String(error),
        );
      }
    });
  } catch {
    await run();
  }
}

/**
 * Previsão do item com o preço e a moeda negociados na cotação (ficha
 * negociada): refeita a cada abertura da tela; nada é gravado. Sem preço
 * negociado, nulo.
 */
export async function forecastNegotiatedItem(
  item: BookingItem,
  deal: { price: number | null; currency: string | null },
  byUserId: string,
  incoterm: string | null = null,
): Promise<BookingAnalysis | null> {
  if (deal.price === null) return null;
  const currency = (deal.currency ?? item.currency ?? "").toUpperCase();
  const negotiated: BookingItem = {
    ...item,
    price: deal.price,
    currency: (currency === "CNY"
      ? "RMB"
      : currency) as BookingItem["currency"],
  };
  return (
    (await forecastBookingItems([negotiated], { byUserId, incoterm })).get(
      item.id,
    ) ?? null
  );
}
