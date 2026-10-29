import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isWellmix } from "@/lib/auth/permissions";
import { priceTable, priceTableCsv } from "@/lib/services/price-table";

export const dynamic = "force-dynamic";

/** Tabela de preços em CSV (só a Wellmix). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !isWellmix(user))
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  const csv = priceTableCsv(await priceTable(user));
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tabela-precos-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
