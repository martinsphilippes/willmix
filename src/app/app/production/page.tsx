import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { canOpen } from "@/lib/auth/screens";
import { getT } from "@/i18n/server";
import { Empty, PageHeader, TextLink } from "@/components/ui";

/*
 * Tela "Produção" (pedido do dono, 13/11/2026): item próprio no menu, em
 * Pedidos e entrega, logo abaixo de Pedidos de compra. Primeira etapa: só a
 * tela, a rota e o item do menu, com a regra de acesso de toda tela (Equipe
 * e acessos → Telas e links; sem a tela, o endereço volta ao início com o
 * aviso). A produção de cada pedido (ETD, follow 5/15/25 e inspeções)
 * continua no bloco "Produção" do pedido.
 */
export default async function ProductionPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "production");
  const t = await getT();
  return (
    <div data-production-page>
      <PageHeader
        title={t("nav.production")}
        subtitle={t("production.page.subtitle")}
      />
      <Empty>
        <span>
          {t("production.page.soon")}{" "}
          {canOpen(user, "orders") ? (
            <TextLink href="/app/orders">
              {t("production.page.orders")}
            </TextLink>
          ) : null}
        </span>
      </Empty>
    </div>
  );
}
