import { redirect } from "next/navigation";
import { customerNewHref } from "@/lib/customer-routes";
import { renderNewParty } from "../_record/new-party";

/**
 * Novo parceiro (docs/PARTNER_TYPES.md). O novo cliente fica em Cadastros →
 * Clientes desde 17/11/2026 (docs/EQUIPE_ACESSOS.md, etapa 4): o endereço de
 * antes (?type=customer) leva para lá.
 */
export default async function NewPartyPage({
  searchParams,
}: PageProps<"/app/parties/new">) {
  const query = await searchParams;
  if (query.type === "customer") redirect(customerNewHref(query));
  return renderNewParty({ query });
}
