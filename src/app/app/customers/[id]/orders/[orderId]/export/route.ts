import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isWellmix } from "@/lib/auth/permissions";
import { canOpen } from "@/lib/auth/screens";
import { getT } from "@/i18n/server";
import { loadSaleSheet } from "@/lib/services/sale-sheet";

export const dynamic = "force-dynamic";

/**
 * Linhas do pedido de venda em CSV. Só a Wellmix com a tela Cadastros;
 * preço e valor só para quem abre Finanças.
 */
export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/app/customers/[id]/orders/[orderId]/export">,
) {
  const user = await getCurrentUser();
  if (!user || !isWellmix(user) || !canOpen(user, "parties"))
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { id, orderId } = await ctx.params;
  const sheet = await loadSaleSheet(id, orderId);
  if (!sheet) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const t = await getT();
  const money = canOpen(user, "finance");
  const cell = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const out = [t("sale.csv.header")];
  sheet.lines.forEach((l, i) =>
    out.push(
      [
        i + 1,
        `#${l.orderNumber}`,
        l.name,
        l.variantName,
        l.sku,
        l.supplierSku,
        l.specification,
        l.color,
        l.weightKg,
        l.quantity,
        l.unit,
        l.unitsPerBox,
        l.boxes,
        l.cbm,
        money && l.unitPrice !== null ? l.unitPrice.toFixed(4) : "",
        money && l.amount !== null ? l.amount.toFixed(2) : "",
        money ? l.currency : "",
        l.delivered,
        l.notes,
      ]
        .map(cell)
        .join(";"),
    ),
  );
  return new NextResponse(`﻿${out.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pedido-${sheet.order.number}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
