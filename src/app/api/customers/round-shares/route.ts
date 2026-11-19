import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { isWellmix } from "@/lib/auth/permissions";
import { canOpenNewRequest } from "@/lib/auth/screens";
import { roundSharesOf } from "@/lib/services/delivery-round-shares";

export const dynamic = "force-dynamic";

const QUERY = z.object({
  customer: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  rounds: z.coerce.number().int().min(2).max(60),
});

/**
 * Distribuição padrão entre as entregas do cliente para N entregas
 * (docs/ECONOMIC_GROUPS.md). `{ percents: null }` = sem padrão (partes
 * iguais). Só a Wellmix que abre as telas de nova solicitação.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !isWellmix(user) || !canOpenNewRequest(user))
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  const params = new URL(request.url).searchParams;
  const parsed = QUERY.safeParse({
    customer: params.get("customer") ?? "",
    rounds: params.get("rounds") ?? "",
  });
  if (!parsed.success)
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  return NextResponse.json(
    {
      percents: await roundSharesOf(parsed.data.customer, parsed.data.rounds),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
