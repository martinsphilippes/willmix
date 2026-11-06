import { PartyAccountDetail } from "../../_party-accounts/detail";

/** Ficha do cliente: conta, pedidos, recebimentos e cadastro. */
export default function Page({
  params,
  searchParams,
}: PageProps<"/app/customers/[id]">) {
  return (
    <PartyAccountDetail
      side="customer"
      params={params}
      searchParams={searchParams}
    />
  );
}
