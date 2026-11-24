import { after, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Tempo de cada rodada: abaixo dos 5 minutos da função, com folga para o fim. */
const BUDGET_MS = 240_000;

/** Rodadas seguidas no máximo (cerca de 1 hora): uma reserva contra laço sem fim. */
const MAX_HOPS = 15;

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

/**
 * Previsão de preço do Sankhya nos books fechados (dono, 24/11/2026: sem
 * botão, "trazer em todos esses já fechados o cálculo do Sankhya"; docs/
 * BOOKING.md, "Previsão de preço do item"). Cron diário da Vercel
 * (vercel.json) ou manual; protegido por CRON_SECRET quando definido.
 *
 * Pede a previsão dos itens que ainda não têm a do Sankhya (ou que ficaram
 * sem ela porque o Sankhya não estava disponível), um de cada vez, até ~4
 * minutos. Se sobrar, chama a si mesma (`?hop=n&since=…`) depois da resposta
 * para a próxima rodada; `since` evita pedir de novo, no mesmo dia, o item que
 * já voltou nesta rodada.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const hop = Number(url.searchParams.get("hop") ?? "0") || 0;
  const sinceParam = url.searchParams.get("since") ?? "";
  const since = ISO.test(sinceParam) ? sinceParam : new Date().toISOString();
  const { fillBookingForecasts } =
    await import("@/lib/services/booking-price-forecast");
  const result = await fillBookingForecasts({ budgetMs: BUDGET_MS, since });
  if (result.left > 0 && result.done > 0 && hop < MAX_HOPS) {
    url.searchParams.set("hop", String(hop + 1));
    url.searchParams.set("since", since);
    after(async () => {
      // Só dispara a próxima rodada: ela segue sozinha, numa função nova.
      await fetch(url, {
        headers: auth ? { authorization: auth } : {},
        signal: AbortSignal.timeout(10_000),
      }).catch(() => undefined);
    });
  }
  return NextResponse.json({ ...result, hop, since });
}
