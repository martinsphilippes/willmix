import { renderNewRequest } from "../../_new-request/new-request-screen";

/**
 * Nova solicitação de Encomendas (docs/ORDER_TERMS.md). O formulário fica em
 * src/app/app/_new-request/new-request-screen.tsx, o mesmo das telas TS -
 * Trading Sales e Venda - Encomenda (docs/REQUEST_SCREENS.md); aqui, com o
 * comportamento de sempre (mode nulo).
 */
export default async function NewRequestPage({
  searchParams,
}: PageProps<"/app/requests/new">) {
  return renderNewRequest({ mode: null, query: await searchParams });
}
