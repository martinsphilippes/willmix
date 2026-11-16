import { renderNewRequest } from "../../_new-request/new-request-screen";

/**
 * TS - Trading Sales (dono, 16/11/2026; docs/REQUEST_SCREENS.md): a Nova
 * solicitação da Wellmix com o tipo de operação TS fixo pela tela.
 */
export default async function TradingSalesRequestPage({
  searchParams,
}: PageProps<"/app/new-request/ts">) {
  return renderNewRequest({ mode: "ts", query: await searchParams });
}
