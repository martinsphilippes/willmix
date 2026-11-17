import { redirect } from "next/navigation";
import { getStore } from "@/lib/db";
import { renderPartyRecord } from "../../../parties/_record/party-record";

/**
 * Cadastro do cliente em Cadastros → Clientes (dono, 17/11/2026;
 * docs/EQUIPE_ACESSOS.md, etapa 4): a edição, o RCA e o quadro de acesso,
 * os mesmos do cadastro de parceiro. Cadastro que não é de cliente volta
 * para o endereço dele.
 */
export default async function CustomerEditPage({
  params,
  searchParams,
}: PageProps<"/app/customers/[id]/edit">) {
  const { id } = await params;
  const query = await searchParams;
  const party = await getStore().get("parties", id);
  if (party && party.type !== "customer") redirect(`/app/parties/${id}`);
  return renderPartyRecord({ id, query });
}
