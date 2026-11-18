import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isWellmix } from "@/lib/auth/permissions";
import { canOpen } from "@/lib/auth/screens";
import { getT } from "@/i18n/server";
import { chatTypeLabel, searchChatTargets } from "@/lib/services/messages";

export const dynamic = "force-dynamic";

/**
 * Busca de quem chamar numa conversa nova de Mensagens (só a Wellmix, como o
 * formulário): o login da pessoa de fora (a conversa é privada entre os
 * dois), pelo nome, e-mail ou empresa. O valor é `user:<id>`; ao lado do
 * nome, a empresa e o login.
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
        // Empresa (ou tipo) e o login: duas pessoas de mesmo nome se distinguem.
        hint:
          [target.org ?? chatTypeLabel(t, target.type), target.login]
            .filter(Boolean)
            .join(" · ") || null,
      })),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
