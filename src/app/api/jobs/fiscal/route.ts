import { NextResponse } from "next/server";
import { syncFiscalTables } from "@/lib/services/fiscal";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Robô mensal da tabela fiscal: baixa a TEC e a TIPI dos links oficiais
 * configurados. Falhou ou sem link com tabela velha: avisa a Wellmix para subir
 * a planilha. Chamado pelo cron da Vercel (vercel.json). Protegido por CRON_SECRET.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await syncFiscalTables());
}
