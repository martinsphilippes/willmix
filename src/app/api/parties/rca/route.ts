import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { isWellmix } from "@/lib/auth/permissions";
import { canOpenNewRequest } from "@/lib/auth/screens";
import { customerRcaField } from "@/lib/services/rca";

export const dynamic = "force-dynamic";

const ID = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

/**
 * RCA do cliente para a Nova solicitação (docs/CUSTOMER_RCA.md): o código e o
 * nome do vendedor do Sankhya vinculado ao cadastro do cliente. Só a Wellmix
 * que abre Solicitações; quem é de fora recebe "não encontrado".
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  // Telas de nova solicitação (Encomendas, TS e Venda; docs/REQUEST_SCREENS.md).
  if (!user || !isWellmix(user) || !canOpenNewRequest(user))
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  const parsed = ID.safeParse(
    new URL(request.url).searchParams.get("customer") ?? "",
  );
  if (!parsed.success)
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  // Cliente sem RCA (dono, 19/11/2026): também os RCAs para escolher, ou o
  // que fechou a última venda (padrão por 30 dias).
  const field = await customerRcaField(user, parsed.data);
  return NextResponse.json(field, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
