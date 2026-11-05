import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isWellmix } from "@/lib/auth/permissions";
import { canOpen } from "@/lib/auth/screens";
import { getT } from "@/i18n/server";
import {
  customerAccounts,
  customersCsv,
  emptyTotals,
} from "@/lib/services/customer-accounts";

export const dynamic = "force-dynamic";

/**
 * Lista de clientes em CSV, com a mesma busca e filtro da tela. Só a Wellmix
 * com a tela Cadastros; os valores só saem para quem abre Finanças.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !isWellmix(user) || !canOpen(user, "parties"))
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  const t = await getT();
  const q = request.nextUrl.searchParams;
  const status = q.get("status");
  const { rows } = await customerAccounts({
    q: (q.get("q") ?? "").slice(0, 120),
    status: status === "inactive" || status === "all" ? status : "active",
  });
  const money = canOpen(user, "finance");
  const csv = customersCsv(
    money ? rows : rows.map((r) => ({ ...r, totals: emptyTotals() })),
    t("cust.csv.header").split(";"),
    { yes: t("cust.yes"), no: t("cust.no") },
  );
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="clientes-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
