import { after, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Tempo de cada rodada: abaixo dos 5 minutos da função, com folga. */
const BUDGET_MS = 240_000;

/** Rodadas seguidas no máximo: uma reserva contra laço sem fim. */
const MAX_HOPS = 12;

/**
 * Carga noturna da base de vendas do Sankhya (docs/TRADE_COMERCIAL.md, PR 3):
 * os clientes acompanhados na carteira, do lido há mais tempo para o mais
 * recente. Cron da Vercel (vercel.json) ou manual; protegido por CRON_SECRET
 * quando definido. Em partes, como a reconstrução dos resumos: se não
 * terminou, chama a si mesma (`?hop=n`) depois da resposta.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const hop = Number(url.searchParams.get("hop") ?? "0") || 0;
  const { refreshFollowedSales } =
    await import("@/lib/services/customer-sales");
  const result = await refreshFollowedSales(BUDGET_MS);
  if (result.state === "running" && hop < MAX_HOPS) {
    url.searchParams.set("hop", String(hop + 1));
    after(async () => {
      await fetch(url, {
        headers: auth ? { authorization: auth } : {},
        signal: AbortSignal.timeout(10_000),
      }).catch(() => undefined);
    });
  }
  return NextResponse.json(result);
}
