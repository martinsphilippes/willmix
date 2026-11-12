import { after, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Tempo de cada rodada: abaixo dos 5 minutos da função, com folga para o fim. */
const BUDGET_MS = 240_000;

/** Rodadas seguidas no máximo (cerca de 2 horas): uma reserva contra laço sem fim. */
const MAX_HOPS = 30;

/**
 * Reconstrução noturna do resumo dos pedidos (docs/RESUMOS.md): a reserva da
 * atualização por evento. Grava só o que mudou. Cron da Vercel (vercel.json)
 * ou manual; protegido por CRON_SECRET quando definido.
 *
 * Em partes: cada chamada começa a reconstrução (ou continua a que está em
 * andamento) e trabalha até ~4 minutos. Se não terminou, chama a si mesma
 * (`?hop=n`) depois da resposta para a próxima rodada.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const hop = Number(url.searchParams.get("hop") ?? "0") || 0;
  const { rebuildOrderSummariesStep } =
    await import("@/lib/services/order-summary");
  const result = await rebuildOrderSummariesStep({
    budgetMs: BUDGET_MS,
    start: hop === 0,
  });
  if (result.state === "running" && !result.busy && hop < MAX_HOPS) {
    url.searchParams.set("hop", String(hop + 1));
    after(async () => {
      // Só dispara a próxima rodada: ela segue sozinha, numa função nova.
      await fetch(url, {
        headers: auth ? { authorization: auth } : {},
        signal: AbortSignal.timeout(10_000),
      }).catch(() => undefined);
    });
  }
  return NextResponse.json(result);
}
