import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { canOpen } from "@/lib/auth/screens";
import {
  getOrderSignatureView,
  renderOrderDocumentPdf,
} from "@/lib/services/order-signature";

export const dynamic = "force-dynamic";

/**
 * Documento do pedido em PDF (docs/ORDER_SIGNATURE.md): o fornecedor baixa,
 * assina e anexa de volta. Exige sessão, a tela Pedidos e permissão sobre o
 * documento (só a Wellmix e o fornecedor do pedido: tem o preço de compra).
 */
export async function GET(
  _request: Request,
  context: RouteContext<"/api/orders/[id]/purchase-order">,
) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const view =
    canOpen(user, "orders") && /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/.test(id)
      ? await getOrderSignatureView(user, id)
      : null;
  if (!view) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const bytes = await renderOrderDocumentPdf(view, { printedBy: user.name });
  return new NextResponse(bytes as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="purchase-order-${view.order.number}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
