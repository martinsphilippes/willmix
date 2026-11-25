import "server-only";
import { after } from "next/server";
import { getStore } from "@/lib/db";
import type { BookingAnalysis, BookingItem } from "@/lib/db/schema";
import {
  bookingForecastMissing,
  bookingForecastPending,
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
 * do Sankhya; grava o retrato em `booking_items.analysis` assim que cada item
 * volta. Quem chama confere a permissão; o retrato só aparece para a Wellmix.
 *
 * Sem botão de refazer (dono, 24/11/2026): a previsão é pedida ao fechar o
 * book e ao trocar o NCM, e o job de hora em hora (`fillBookingForecasts`,
 * /api/jobs/booking-forecasts) completa o que faltar nos books fechados.
 */

const today = (now = new Date()) =>
  (brazilDay(now) ?? "").replace(/-/g, "") || null;

/** Previsão de cada item (id → retrato). Um item que falha não para os outros. */
export async function forecastBookingItems(
  items: readonly BookingItem[],
  options: {
    byUserId: string;
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
    const q = bookingItemForecastQuery(item, { dataRef });
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

/**
 * Roda a previsão nos itens e grava o retrato de cada um assim que volta (o
 * que já voltou fica gravado mesmo se a função parar no meio). Com
 * `deadline` (ms desde a época), para antes de começar um item depois dele.
 */
export async function recordBookingForecasts(
  items: readonly BookingItem[],
  options: {
    byUserId: string;
    adapter?: PriceForecastAdapter;
    deadline?: number;
  },
): Promise<number> {
  const store = getStore();
  let saved = 0;
  for (const item of items) {
    if (options.deadline !== undefined && Date.now() >= options.deadline) break;
    const analysis = (
      await forecastBookingItems([item], {
        byUserId: options.byUserId,
        adapter: options.adapter,
      })
    ).get(item.id);
    if (!analysis) continue;
    await store.update("booking_items", item.id, { analysis });
    saved++;
  }
  return saved;
}

/**
 * Agenda a previsão dos itens para depois da resposta (fechar não espera o
 * Sankhya, item a item). Fora de uma requisição (testes, scripts), roda na
 * hora. O que não couber no tempo da função o job completa.
 */
export async function scheduleBookingForecasts(
  items: readonly BookingItem[],
  byUserId: string,
): Promise<void> {
  const run = () => recordBookingForecasts(items, { byUserId });
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

/** Status em que o book já foi fechado (a previsão vale para eles). */
const CLOSED_STATUSES = ["closed", "in_progress", "done"] as const;

export interface BookingForecastFill {
  /** Itens previstos nesta rodada (com preço, com falta de dado ou com erro). */
  done: number;
  /** Itens que ainda esperam (o tempo da rodada acabou). */
  left: number;
  /** Books que tiveram item previsto nesta rodada. */
  lots: number;
}

/**
 * Job de hora em hora (dono, 24/11/2026: "trazer em todos esses já fechados o
 * cálculo do Sankhya", sem botão): pede a previsão dos itens dos books
 * fechados, em andamento ou concluídos que ainda não têm a do Sankhya, ou que
 * ficaram sem ela porque o Sankhya não estava disponível ou não respondeu (de
 * novo só uma vez por dia; `bookingForecastPending`). `since` = começo da rodada: o item já previsto
 * desde então não vai de novo nas rodadas seguintes do mesmo dia. Um item de
 * cada vez, até o tempo da rodada; grava a hora no book (`analyzedAt`).
 */
export async function fillBookingForecasts(
  options: {
    budgetMs?: number;
    since?: string | null;
    adapter?: PriceForecastAdapter;
  } = {},
): Promise<BookingForecastFill> {
  const store = getStore();
  const deadline = Date.now() + (options.budgetMs ?? 240_000);
  const since = options.since ?? null;
  const lots = await store.list("booking_lots", {
    filter: { status: [...CLOSED_STATUSES] },
  });
  const out: BookingForecastFill = { done: 0, left: 0, lots: 0 };
  for (const lot of lots) {
    const items = (
      await store.list("booking_items", { filter: { lotId: lot.id } })
    ).filter((i) => bookingForecastPending(i.analysis, since));
    if (!items.length) continue;
    if (Date.now() >= deadline) {
      out.left += items.length;
      continue;
    }
    const saved = await recordBookingForecasts(items, {
      byUserId: "system",
      adapter: options.adapter,
      deadline,
    });
    out.done += saved;
    out.left += items.length - saved;
    if (saved) {
      out.lots++;
      await store.update("booking_lots", lot.id, {
        analyzedAt: new Date().toISOString(),
      });
    }
  }
  return out;
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
    (await forecastBookingItems([negotiated], { byUserId })).get(item.id) ??
    null
  );
}
