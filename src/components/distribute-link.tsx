import Link from "next/link";
import type { Translate } from "@/i18n";
import { getCurrentUser } from "@/lib/auth/session";
import { canOpen } from "@/lib/auth/screens";
import { ASSIGN_HREF } from "@/lib/assign-href";

/*
 * "Distribuir agora" (o analista do pedido sai da divisão da linha; dono,
 * 17/11/2026; docs/EQUIPE_ACESSOS.md, etapa 5): o link leva a Equipe
 * Interna → Linhas e divisões, no ponto da distribuição, e só aparece para
 * quem abre a Equipe. Os demais leem que o administrador distribui (antes, o
 * link abria a aba errada e, para quem não abre a Equipe, a tela de acesso
 * negado).
 */
export async function DistributeLink({
  t,
  className = "text-brand-700 underline",
}: {
  t: Translate;
  className?: string;
}) {
  const user = await getCurrentUser();
  if (user && canOpen(user, "team"))
    return (
      <Link
        href={ASSIGN_HREF.analyst("")}
        className={className}
        data-distribute-link
      >
        {t("certFlow.assign.analyst")}
      </Link>
    );
  return (
    <span className="text-zinc-600" data-distribute-ask>
      {t("internalTeam.distribute.ask")}
    </span>
  );
}
