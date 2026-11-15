import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { isWellmix } from "@/lib/auth/permissions";
import { canOpen } from "@/lib/auth/screens";
import { customerRca } from "@/lib/services/rca";

export const dynamic = "force-dynamic";

const ID = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

/**
 * RCA do cliente para a Nova solicitação (docs/CUSTOMER_RCA.md): o código e o
 * nome do vendedor do Sankhya vinculado ao cadastro do cliente. Só a Wellmix
 * que abre Solicitações; quem é de fora recebe "não encontrado".
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !isWellmix(user) || !canOpen(user, "requests"))
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  const parsed = ID.safeParse(
    new URL(request.url).searchParams.get("customer") ?? "",
  );
  if (!parsed.success)
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const rca = await customerRca(user, parsed.data);
  return NextResponse.json(
    { rca },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
