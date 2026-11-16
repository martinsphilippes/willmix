import { renderNewRequest } from "../../_new-request/new-request-screen";

/**
 * Venda - Encomenda (dono, 16/11/2026; docs/REQUEST_SCREENS.md): a Nova
 * solicitação da Wellmix com o tipo de operação Venda fixo pela tela.
 */
export default async function SaleRequestPage({
  searchParams,
}: PageProps<"/app/new-request/sale">) {
  return renderNewRequest({ mode: "sale", query: await searchParams });
}
