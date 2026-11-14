import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { getT } from "@/i18n/server";
import { FlowOverview } from "@/components/flow-overview";

/*
 * Tela "Produção" (pedido do dono, 13/11/2026), com a regra de acesso de toda
 * tela (Equipe e acessos → Telas e links). Desde 14/11/2026 é o Overview do
 * bloco Produção do menu (docs/FLOW_MENU.md): a linha do tempo dos passos,
 * da pré-produção ao embarque, com o que espera ação, o que atrasou e há
 * quantos dias, e a tabela dos casos do passo escolhido. A produção de cada
 * pedido (ETD, follow 5/15/25 e inspeções) continua no bloco "Produção" do
 * pedido.
 */
export default async function ProductionPage({
  searchParams,
}: PageProps<"/app/production">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "production");
  const { step } = await searchParams;
  const t = await getT();
  return (
    <div data-production-page>
      <FlowOverview
        user={user}
        block="production"
        selected={typeof step === "string" ? step : null}
        t={t}
        basePath="/app/production"
      />
    </div>
  );
}
