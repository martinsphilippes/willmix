import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isWellmix } from "@/lib/auth/permissions";
import { canOpen } from "@/lib/auth/screens";
import { customerContactsView } from "@/lib/services/customer-contacts";

export const dynamic = "force-dynamic";

/**
 * Contatos do cliente para a Nova solicitação (docs/ORDER_TERMS.md), só a
 * Wellmix: "blind" enquanto o portal nunca os atualizou (nada do cadastro
 * vai para a tela) ou os contatos gravados pelo portal.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !isWellmix(user) || !canOpen(user, "requests"))
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  const customer = new URL(request.url).searchParams.get("customer") ?? "";
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(customer))
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const view = await customerContactsView(user, customer);
  if (!view) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(view, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
