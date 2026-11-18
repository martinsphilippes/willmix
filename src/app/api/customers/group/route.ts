import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { isWellmix } from "@/lib/auth/permissions";
import { canOpenNewRequest } from "@/lib/auth/screens";
import { economicGroupOf } from "@/lib/services/economic-groups";

export const dynamic = "force-dynamic";

const ID = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

/**
 * Grupo econômico do cliente escolhido na Nova solicitação
 * (docs/ECONOMIC_GROUPS.md): as empresas do grupo que ele representa e a
 * distribuição padrão. `{ group: null }` = pedido de um cliente só. Só a
 * Wellmix que abre as telas de nova solicitação.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !isWellmix(user) || !canOpenNewRequest(user))
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  const parsed = ID.safeParse(
    new URL(request.url).searchParams.get("customer") ?? "",
  );
  if (!parsed.success)
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  return NextResponse.json(
    { group: await economicGroupOf(parsed.data) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
