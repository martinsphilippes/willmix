import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { accessStamp } from "@/lib/auth/access-stamp";

export const dynamic = "force-dynamic";

/**
 * Carimbo do acesso de quem está logado (src/lib/auth/access-stamp.ts): o
 * navegador compara com o do layout e refaz o menu quando mudou. Sem login:
 * 401 (o navegador refaz a tela, que leva à entrada).
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json(
      { stamp: null },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  return NextResponse.json(
    { stamp: accessStamp(user) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
