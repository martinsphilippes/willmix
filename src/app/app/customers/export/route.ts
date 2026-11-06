import type { NextRequest } from "next/server";
import { exportAccounts } from "../../_party-accounts/export";

export const dynamic = "force-dynamic";

/**
 * Lista de clientes em CSV, com a mesma busca e filtro da tela. Só a Wellmix
 * com a tela Cadastros; os valores só saem para quem abre Finanças.
 */
export function GET(request: NextRequest) {
  return exportAccounts(request, "customer");
}
