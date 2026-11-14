import type { User } from "@/lib/db/schema";
import type { Translate } from "@/i18n";
import { canCreateOrder } from "@/lib/auth/permissions";
import { canOpen } from "@/lib/auth/screens";
import { LinkButton } from "./ui";

/*
 * "Criar pedido" (dono, 14/11/2026): a entrada da encomenda do cliente
 * (/app/requests/new), no Overview do bloco Pedido, na tela do passo Pedidos
 * e na lista de pedidos. Só para quem cria (Wellmix e cliente com a tela de
 * solicitações); para os outros, nada.
 */
export function CreateOrderButton({ user, t }: { user: User; t: Translate }) {
  if (!canCreateOrder(user, canOpen(user, "requests"))) return null;
  return (
    <LinkButton href="/app/requests/new" variant="primary" data-create-order>
      + {t("flow.orders.create")}
    </LinkButton>
  );
}
