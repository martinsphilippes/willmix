import { NextResponse } from "next/server";
import { runSankhyaSync } from "@/lib/integrations/sankhya-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Sincronização portal → Sankhya (docs/SANKHYA.md, fase 3): envia os
 * cadastros e itens de pedido pendentes. Também roda no job diário; esta rota
 * serve para um agendador externo ou chamada manual. Protegida por
 * CRON_SECRET quando definido. Com a execução no Sankhya desligada, não faz nada.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await runSankhyaSync(null));
}
