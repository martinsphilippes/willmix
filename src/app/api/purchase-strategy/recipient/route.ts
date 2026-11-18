import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isWellmix } from "@/lib/auth/permissions";
import { canOpen } from "@/lib/auth/screens";
import { checkRecipients } from "@/lib/services/purchase-recipients";
import { getT } from "@/i18n/server";

export const dynamic = "force-dynamic";

/**
 * Estratégia de Compra (dono, 18/11/2026): a conferência de um parceiro
 * escolhido na busca (recebe e responde no portal? o que falta?). Só a
 * equipe da Wellmix que abre a Estratégia de Compra.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !isWellmix(user) || !canOpen(user, "purchaseStrategy"))
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/.test(id))
    return NextResponse.json({ error: "id" }, { status: 400 });
  const check = (await checkRecipients([id], await getT())).get(id) ?? null;
  if (!check) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(
    { check },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
