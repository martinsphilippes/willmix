import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { canOpen } from "@/lib/auth/screens";
import {
  ConfirmationError,
  lookupCnpj,
} from "@/lib/services/customer-confirmation";

export const dynamic = "force-dynamic";

/**
 * Dados públicos de um CNPJ (BrasilAPI) para a confirmação do pedido pelo
 * cliente: a transportadora do re-despacho (docs/ORDER_TERMS.md seção 4).
 * Quem abre Solicitações. "manual" = sem a consulta: o nome se digita.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canOpen(user, "requests"))
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  const cnpj = new URL(request.url).searchParams.get("cnpj") ?? "";
  try {
    return NextResponse.json(await lookupCnpj(cnpj.slice(0, 30)), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof ConfirmationError)
      return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
}
