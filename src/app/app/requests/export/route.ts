import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { canViewRequest, isWellmix } from "@/lib/auth/permissions";
import { canOpen } from "@/lib/auth/screens";
import { getStore } from "@/lib/db";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  cancelledOrderIds,
  requestDisplayStatus,
} from "@/lib/services/order-status";
import {
  REQUEST_SITUATIONS,
  inSituation,
  matchesRequest,
  receivedByRequest,
  todayBrazil,
  type RequestSituation,
} from "@/lib/services/request-list";

export const dynamic = "force-dynamic";

/**
 * Solicitações em CSV ("tabela de fluxo"), com a mesma situação e busca da
 * tela. Só a Wellmix com a tela Solicitações; valores só para quem abre
 * Finanças. Canceladas e excluídas ficam fora, como na lista principal.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !isWellmix(user) || !canOpen(user, "requests"))
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  const t = await getT();
  const sp = request.nextUrl.searchParams;
  const situation: RequestSituation = (
    REQUEST_SITUATIONS as readonly string[]
  ).includes(sp.get("situ") ?? "")
    ? (sp.get("situ") as RequestSituation)
    : "all";
  const q = (sp.get("q") ?? "").slice(0, 120);
  const money = canOpen(user, "finance");
  const store = getStore();
  const [all, parties, users, payments] = await Promise.all([
    store.list("requests", { orderBy: "createdAt", direction: "desc" }),
    store.list("parties", { filter: { type: "customer" } }),
    store.list("users"),
    money
      ? store.list("payments", { filter: { direction: "customer_in" } })
      : Promise.resolve([]),
  ]);
  const visible = all.filter((r) => canViewRequest(user, r));
  const cancelled = await cancelledOrderIds(visible.map((r) => r.orderId));
  const today = todayBrazil();
  const name = (id: string) => parties.find((p) => p.id === id)?.name ?? "";
  const rows = visible.filter((r) => {
    const display = requestDisplayStatus(r, cancelled);
    if (r.status === "CANCELLED" || display === "ORDER_CANCELLED") return false;
    return (
      inSituation(r, display, situation, today) &&
      matchesRequest(r, name(r.customerId), q)
    );
  });
  const orderIds = rows.map((r) => r.orderId).filter(Boolean) as string[];
  const orders = orderIds.length
    ? await store.list("orders", { filter: { id: orderIds } })
    : [];
  const received = receivedByRequest(payments);
  const cell = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [t("reqList.csv.header")];
  for (const r of rows)
    lines.push(
      [
        r.number ?? "",
        r.createdAt.slice(0, 10),
        r.productName,
        name(r.customerId),
        users.find((u) => u.id === r.ownerUserId)?.name ?? "",
        r.quantity,
        r.unit,
        t(
          `reqStatusLabel.${requestDisplayStatus(r, cancelled)}` as DictionaryKey,
        ),
        r.deadline?.slice(0, 10) ?? "",
        money && r.sellPrice !== null ? r.sellPrice.toFixed(2) : "",
        money ? (r.sellCurrency ?? "") : "",
        money && r.downPaymentAmount !== null
          ? r.downPaymentAmount.toFixed(2)
          : "",
        money ? (received.get(r.id) ?? 0).toFixed(2) : "",
        r.orderId
          ? `#${orders.find((o) => o.id === r.orderId)?.number ?? "?"}`
          : "",
      ]
        .map(cell)
        .join(";"),
    );
  return new NextResponse(`﻿${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="solicitacoes-${today}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
