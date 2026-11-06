import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isWellmix } from "@/lib/auth/permissions";
import { canOpen } from "@/lib/auth/screens";
import { getT } from "@/i18n/server";
import {
  inventoryData,
  lineValue,
  qtyFor,
  readInventoryFilter,
} from "../_data";

export const dynamic = "force-dynamic";

/**
 * Estoque em CSV, com a mesma situação e busca da tela. Só a Wellmix com a
 * tela Produtos; preço e valor só para quem abre Finanças.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !isWellmix(user) || !canOpen(user, "products"))
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  const t = await getT();
  const sp = request.nextUrl.searchParams;
  const filter = readInventoryFilter({ situ: sp.get("situ"), q: sp.get("q") });
  const money = canOpen(user, "finance");
  const { lines } = await inventoryData(filter);
  const cell = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const out = [t("inv.csv.header")];
  for (const l of lines) {
    const p = l.product;
    const value = lineValue(l, filter.situation);
    out.push(
      [
        p?.name,
        p?.sku,
        p?.category,
        p?.supplierSku,
        p?.specification,
        p?.color,
        l.boxes,
        l.brazil,
        l.transit,
        l.production,
        qtyFor(l, filter.situation),
        p?.minStock ?? "",
        l.unit,
        money && p?.price != null ? p.price.toFixed(2) : "",
        money ? p?.currency : "",
        money && value !== null ? value.toFixed(2) : "",
        p?.notes,
        l.lastAt?.slice(0, 10),
      ]
        .map(cell)
        .join(";"),
    );
  }
  const today = new Date().toISOString().slice(0, 10);
  return new NextResponse(`﻿${out.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="estoque-${today}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
