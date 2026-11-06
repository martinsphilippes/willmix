import { PartyAccountList } from "../_party-accounts/list";

/** Fornecedores (Cadastros): lista com a conta de cada um (ver _party-accounts). */
export default function Page({ searchParams }: PageProps<"/app/suppliers">) {
  return <PartyAccountList side="supplier" searchParams={searchParams} />;
}
