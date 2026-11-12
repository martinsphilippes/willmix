import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Reconstrução noturna do resumo dos pedidos (docs/RESUMOS.md): a reserva da
 * atualização por evento. Grava só o que mudou. Cron da Vercel (vercel.json)
 * ou manual; protegido por CRON_SECRET quando definido.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { rebuildOrderSummaries } =
    await import("@/lib/services/order-summary");
  return NextResponse.json(await rebuildOrderSummaries());
}
