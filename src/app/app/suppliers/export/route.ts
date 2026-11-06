import type { NextRequest } from "next/server";
import { exportAccounts } from "../../_party-accounts/export";

export const dynamic = "force-dynamic";

/** Lista de fornecedores em CSV (mesmas regras da de clientes). */
export function GET(request: NextRequest) {
  return exportAccounts(request, "supplier");
}
