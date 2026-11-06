import type { NextRequest } from "next/server";
import { exportSaleSheet } from "../../../../../_party-accounts/sale-export";

export const dynamic = "force-dynamic";

/** Linhas do pedido em lista em CSV (mesmas regras da tela). */
export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/app/suppliers/[id]/orders/[orderId]/export">,
) {
  const { id, orderId } = await ctx.params;
  return exportSaleSheet("supplier", id, orderId);
}
