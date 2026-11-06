import { PartySaleSheet } from "../../../../_party-accounts/sale-sheet";

/** Pedido de venda em lista (Clientes → cliente → registro de vendas). */
export default function Page({
  params,
}: PageProps<"/app/customers/[id]/orders/[orderId]">) {
  return <PartySaleSheet side="customer" params={params} />;
}
