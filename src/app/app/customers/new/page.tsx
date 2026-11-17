import { renderNewParty } from "../../parties/_record/new-party";

/**
 * Novo cliente em Cadastros → Clientes (dono, 17/11/2026;
 * docs/EQUIPE_ACESSOS.md, etapa 4): o formulário de cadastro com o tipo
 * Cliente já marcado.
 */
export default async function NewCustomerPage({
  searchParams,
}: PageProps<"/app/customers/new">) {
  const query = await searchParams;
  return renderNewParty({ query: { ...query, type: "customer" } });
}
