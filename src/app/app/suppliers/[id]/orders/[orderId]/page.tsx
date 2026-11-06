import { PartySaleSheet } from "../../../../_party-accounts/sale-sheet";

/** Pedido de compra em lista (Fornecedores → fornecedor → registros de compras). */
export default function Page({
  params,
}: PageProps<"/app/suppliers/[id]/orders/[orderId]">) {
  return <PartySaleSheet side="supplier" params={params} />;
}
