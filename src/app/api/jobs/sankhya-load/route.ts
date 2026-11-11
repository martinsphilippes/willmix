import { NextResponse } from "next/server";
import {
  cronTokenOk,
  runServerLoadTick,
} from "@/lib/integrations/sankhya-load-queue";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Carga do Sankhya no servidor (docs/SANKHYA.md): uma rodada de ~30 s da fila
 * ligada em Configurações → Sankhya. Chamada a cada 30 segundos pelo agendador do
 * Supabase (pg_cron, com a chave guardada no banco) ou com CRON_SECRET.
 * Sem fila ativa, não faz nada.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  const secret = process.env.CRON_SECRET;
  const ok = (secret && bearer === secret) || (await cronTokenOk(bearer));
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await runServerLoadTick());
}
