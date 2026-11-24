import "server-only";
import { after } from "next/server";
import { getStore, type BookingCost, type BookingItem } from "@/lib/db";
import {
  getPriceForecastAdapter,
  type PriceForecastAdapter,
  type PriceForecastQuery,
} from "@/lib/integrations/price-forecast";
import { sankhyaConfig } from "@/lib/integrations/sankhya-client";
import {
  BOOKING_COST_BACKGROUND_MS,
  bookingCostInputs,
  bookingCostPending,
  costVerdict,
} from "@/lib/booking-cost";
import { getSettings } from "@/lib/settings";
import { brazilDay } from "@/lib/supplier-terms";

/*
 * Custo dos itens do booking pela cotação V2 do Sankhya (dono, 24/11/2026:
 * "a cotação do Sankhya é oficial"; docs/BOOKING.md, "Custo no Sankhya").
 *
 * - Cada item vai com os dados dele (NCM, pesos, peças e CBM da caixa master,
 *   preço e moeda), sem o código do Sankhya: é o custo da oferta daquele
 *   fornecedor, não o do último pedido de importação. Sem quantidade nem
 *   containers (o preço por peça não depende deles; dono, 19/11/2026), sem
 *   cliente, VIP nem rota; o frete de entrega padrão das Configurações e a
 *   data de hoje.
 * - Um item de cada vez: o Sankhya recusa duas chamadas simultâneas da mesma
 *   sessão. Ao fechar o book (ou pelo "Calcular no Sankhya"), a conta roda
 *   uns segundos na hora e o resto continua depois da resposta (`after`);
 *   cada item grava assim que volta. Um pedido novo de cálculo do book (outra
 *   data em `booking_lots.sankhyaCostAt`) faz o anterior parar.
 * - Item sem algum dado não vai ao Sankhya (grava o que faltou). Erro do
 *   Sankhya fica no item com a mensagem. Sem o Sankhya configurado, nada é
 *   gravado (nenhum custo inventado).
 */

/** Quanto o fechamento (ou o botão) espera o Sankhya antes de responder. */
export const BOOKING_COST_WAIT_MS = 8_000;

/** A consulta da cotação V2 para um item do book (dados do próprio item). */
export function bookingCostQuery(
  item: BookingItem,
  options: { deliveryFreightBrl: number | null; now: Date },
): PriceForecastQuery {
  const { sent } = bookingCostInputs(item);
  return {
    productId: item.productId ?? "",
    sankhyaCode: null,
    sku: item.factoryItemCode ?? null,
    quantity: null,
    containers: null,
    customerId: null,
    customerSankhyaCode: null,
    ncm: sent.ncm,
    netWeightKg: sent.netWeightPcKg,
    grossWeightKg: sent.grossWeightPcKg,
    masterBoxQty: sent.pcsPerCarton,
    cbmPerCarton: sent.cbmPerCarton,
    price: sent.price,
    currency: sent.currency,
    vip: null,
    route: null,
    deliveryFreightBrl: options.deliveryFreightBrl,
    sellerCode: null,
    dataRef: (brazilDay(options.now) ?? "").replace(/-/g, "") || null,
  };
}

const round4 = (n: number | null | undefined): number | null =>
  typeof n === "number" && Number.isFinite(n)
    ? Math.round(n * 10_000) / 10_000
    : null;

const EMPTY = {
  status: null,
  costBrl: null,
  salePriceBrl: null,
  targetPriceBrl: null,
  profitPct: null,
  goalPct: null,
  goalReached: null,
  verdict: null,
} as const;

/**
 * O custo de um item: o retrato para gravar, ou "manual" quando o Sankhya não
 * está configurado (nada a gravar).
 */
export async function costOfBookingItem(
  item: BookingItem,
  adapter: PriceForecastAdapter,
  options: { byUserId: string; deliveryFreightBrl: number | null; now: Date },
): Promise<BookingCost | "manual"> {
  const { sent, missing } = bookingCostInputs(item);
  const base = {
    source: "sankhya" as const,
    at: options.now.toISOString(),
    byUserId: options.byUserId,
    sent,
  };
  if (missing.length) return { ...base, ...EMPTY, missing, error: null };
  try {
    const answer = await adapter.forecast(bookingCostQuery(item, options));
    if (answer.mode === "manual") return "manual";
    if (answer.kind !== "forecast")
      return {
        ...base,
        ...EMPTY,
        missing: [],
        error:
          answer.kind === "error"
            ? answer.message.slice(0, 300) || "erro do Sankhya"
            : "resposta inesperada do Sankhya",
      };
    const profitPct = round4(answer.profitPercent);
    const goalPct = round4(answer.goalPercent);
    const goalReached = answer.goalReached ?? null;
    return {
      ...base,
      status: answer.status ?? null,
      costBrl: round4(answer.cost),
      salePriceBrl: round4(answer.salePrice),
      targetPriceBrl: round4(answer.targetPrice),
      profitPct,
      goalPct,
      goalReached,
      verdict: costVerdict(goalReached, profitPct, goalPct),
      missing: [],
      error: null,
    };
  } catch (error) {
    return {
      ...base,
      ...EMPTY,
      missing: [],
      error: (error instanceof Error ? error.message : String(error)).slice(
        0,
        300,
      ),
    };
  }
}

export interface BookingCostRun {
  /** Itens gravados nesta rodada (com custo, com falta ou com erro). */
  done: number;
  /** Itens que ficaram na fila (prazo da rodada, ou um pedido mais novo). */
  left: number;
  /** O Sankhya não está configurado: nada foi calculado. */
  manual: boolean;
}

/** Quem calcula: o adaptador dado (testes) ou o Sankhya, se configurado. */
function costAdapter(adapter?: PriceForecastAdapter) {
  if (adapter) return adapter;
  // Custo e margem: quem vê é conferido na tela ("Ver preço de compra").
  return sankhyaConfig() ? getPriceForecastAdapter(true) : null;
}

/**
 * Calcula, um de cada vez, os itens que ainda não têm o custo do Sankhya
 * desde `since` (sem `since`: os sem retrato), até o prazo. Com `lotId`, para
 * quando o book recebe um pedido de cálculo mais novo.
 */
export async function calculateBookingCosts(
  items: readonly BookingItem[],
  options: {
    byUserId: string;
    since?: string | null;
    lotId?: string;
    budgetMs?: number;
    adapter?: PriceForecastAdapter;
    now?: () => Date;
  },
): Promise<BookingCostRun> {
  const queue = items.filter((i) => bookingCostPending(i, options.since));
  if (!queue.length) return { done: 0, left: 0, manual: false };
  const adapter = costAdapter(options.adapter);
  if (!adapter) return { done: 0, left: queue.length, manual: true };
  const store = getStore();
  const now = options.now ?? (() => new Date());
  const deadline = Date.now() + (options.budgetMs ?? BOOKING_COST_WAIT_MS);
  const settings = await getSettings();
  const deliveryFreightBrl = settings.deliveryFreightDefaultBrl ?? null;
  let done = 0;
  for (const item of queue) {
    if (Date.now() >= deadline) break;
    if (options.lotId && options.since) {
      // Outro pedido de cálculo do book começou: este para.
      const lot = await store.get("booking_lots", options.lotId);
      if (!lot || (lot.sankhyaCostAt ?? null) !== options.since) break;
    }
    const cost = await costOfBookingItem(item, adapter, {
      byUserId: options.byUserId,
      deliveryFreightBrl,
      now: now(),
    });
    if (cost === "manual")
      return { done, left: queue.length - done, manual: true };
    await store.update("booking_items", item.id, { sankhyaCost: cost });
    done++;
  }
  return { done, left: queue.length - done, manual: false };
}

/**
 * Pede o custo de todos os itens do book ao Sankhya: grava a data do pedido
 * no book, espera uns segundos e deixa o resto para depois da resposta.
 * `only` limita aos itens dados (NCM trocado), sem mudar a data do book.
 */
export async function requestLotCosts(
  lotId: string,
  byUserId: string,
  options: {
    only?: readonly string[];
    budgetMs?: number;
    adapter?: PriceForecastAdapter;
    now?: () => Date;
  } = {},
): Promise<BookingCostRun> {
  const store = getStore();
  const now = options.now ?? (() => new Date());
  const all = await store.list("booking_items", { filter: { lotId } });
  const only = options.only ? new Set(options.only) : null;
  const items = only ? all.filter((i) => only.has(i.id)) : all;
  // Sem o Sankhya: nada muda no book (a tela diz que não está configurado).
  if (!costAdapter(options.adapter))
    return { done: 0, left: items.length, manual: true };
  const since = now().toISOString();
  if (!only)
    await store.update("booking_lots", lotId, { sankhyaCostAt: since });
  const run = {
    byUserId,
    since,
    lotId: only ? undefined : lotId,
    adapter: options.adapter,
    now: options.now,
  };
  const first = await calculateBookingCosts(items, {
    ...run,
    budgetMs: options.budgetMs ?? BOOKING_COST_WAIT_MS,
  });
  if (first.left && !first.manual) scheduleBookingCosts(lotId, items, run);
  return first;
}

/**
 * O resto da fila depois da resposta. Fora de uma requisição (testes,
 * scripts) não agenda: o book mostra os itens na fila e o botão.
 */
function scheduleBookingCosts(
  lotId: string,
  items: readonly BookingItem[],
  run: {
    byUserId: string;
    since: string;
    lotId?: string;
    adapter?: PriceForecastAdapter;
    now?: () => Date;
  },
) {
  try {
    after(async () => {
      try {
        // Relê os itens: os que já voltaram nesta rodada ficam de fora.
        const ids = new Set(items.map((i) => i.id));
        const fresh = (
          await getStore().list("booking_items", { filter: { lotId } })
        ).filter((i) => ids.has(i.id));
        await calculateBookingCosts(fresh, {
          ...run,
          budgetMs: BOOKING_COST_BACKGROUND_MS,
        });
      } catch (error) {
        console.error(
          "[booking-cost] cálculo no Sankhya parou",
          lotId,
          error instanceof Error ? error.message : String(error),
        );
      }
    });
  } catch {
    // Sem requisição em andamento: fica na fila.
  }
}
