import { PartyAccountList } from "../_party-accounts/list";

/** Clientes (Cadastros): lista com a conta de cada um (ver _party-accounts). */
export default function Page({ searchParams }: PageProps<"/app/customers">) {
  return <PartyAccountList side="customer" searchParams={searchParams} />;
}
