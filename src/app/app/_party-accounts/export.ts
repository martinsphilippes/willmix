import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isWellmix } from "@/lib/auth/permissions";
import { canOpen } from "@/lib/auth/screens";
import { getT } from "@/i18n/server";
import {
  customerAccounts,
  customersCsv,
  emptyTotals,
  type AccountSide,
} from "@/lib/services/customer-accounts";
import { canSeeMoney } from "@/lib/auth/function-access";

/** Mesmo CSV dos dois lados (cliente ou fornecedor). */
export async function exportAccounts(request: NextRequest, side: AccountSide) {
  const user = await getCurrentUser();
  if (!user || !isWellmix(user) || !canOpen(user, "parties"))
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  const t = await getT();
  const q = request.nextUrl.searchParams;
  const status = q.get("status");
  const { rows } = await customerAccounts(
    {
      q: (q.get("q") ?? "").slice(0, 120),
      status: status === "inactive" || status === "all" ? status : "active",
    },
    side,
  );
  const money = canSeeMoney(user);
  const csv = customersCsv(
    money ? rows : rows.map((r) => ({ ...r, totals: emptyTotals() })),
    t(side === "supplier" ? "supp.csv.header" : "cust.csv.header").split(";"),
    { yes: t("cust.yes"), no: t("cust.no") },
  );
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${side === "supplier" ? "fornecedores" : "clientes"}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
