import { redirect } from "next/navigation";
import { getStore } from "@/lib/db";
import { customerEditHref } from "@/lib/customer-routes";
import { renderPartyRecord } from "../_record/party-record";

/**
 * Cadastro do parceiro (Equipe Externa). O de cliente fica em Cadastros →
 * Clientes desde 17/11/2026 (docs/EQUIPE_ACESSOS.md, etapa 4): este endereço
 * leva para lá, com os parâmetros (links antigos, notificações e a Auditoria
 * continuam abrindo).
 */
export default async function PartyPage({
  params,
  searchParams,
}: PageProps<"/app/parties/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  const party = await getStore().get("parties", id);
  if (party?.type === "customer") redirect(customerEditHref(id, query));
  return renderPartyRecord({ id, query });
}
