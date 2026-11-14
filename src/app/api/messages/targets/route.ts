import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isWellmix } from "@/lib/auth/permissions";
import { canOpen } from "@/lib/auth/screens";
import { getT } from "@/i18n/server";
import { chatTypeLabel, searchChatTargets } from "@/lib/services/messages";

export const dynamic = "force-dynamic";

/**
 * Busca de quem chamar numa conversa nova de Mensagens (só a Wellmix, como o
 * formulário): empresas ativas e logins sem empresa, pelo nome. O valor é o
 * mesmo da lista antiga (`party:<id>` ou `user:<id>`); ao lado do nome, o
 * tipo da empresa ou o papel do login.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !isWellmix(user) || !canOpen(user, "messages"))
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  const q = new URL(request.url).searchParams.get("q") ?? "";
  const [t, targets] = await Promise.all([getT(), searchChatTargets(user, q)]);
  return NextResponse.json(
    {
      options: targets.map((target) => ({
        id: target.id,
        name: target.name,
        hint: chatTypeLabel(t, target.type) || null,
      })),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
