import { PartyAccountDetail } from "../../_party-accounts/detail";

/** Ficha do fornecedor: conta, pedidos, pagamentos e cadastro. */
export default function Page({
  params,
  searchParams,
}: PageProps<"/app/suppliers/[id]">) {
  return (
    <PartyAccountDetail
      side="supplier"
      params={params}
      searchParams={searchParams}
    />
  );
}
