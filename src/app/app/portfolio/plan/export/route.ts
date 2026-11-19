import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { TRADE_ACTIVITY_STATUSES } from "@/lib/db/schema";
import { canUsePortfolio, brDay } from "@/lib/services/portfolio";
import {
  loadTradePlan,
  type TradePlanFilters,
} from "@/lib/services/trade-plan";

export const dynamic = "force-dynamic";

const STATUS_FILTERS = ["open", "late", ...TRADE_ACTIVITY_STATUSES];

/**
 * Plano de ação Trade em CSV (docs/TRADE_COMERCIAL.md, PR 2), com os mesmos
 * filtros da tela e só as ações que o login vê.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !canUsePortfolio(user))
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  const t = await getT();
  const sp = request.nextUrl.searchParams;
  const status = sp.get("status") ?? "";
  const id = (v: string | null) =>
    v && /^[A-Za-z0-9_-]{1,64}$/.test(v) ? v : undefined;
  const filters: TradePlanFilters = {
    status: STATUS_FILTERS.includes(status)
      ? (status as TradePlanFilters["status"])
      : undefined,
    responsibleId: id(sp.get("owner")),
    groupId: id(sp.get("group")),
    q: (sp.get("q") ?? "").slice(0, 120) || undefined,
  };
  const view = await loadTradePlan(user, filters);
  const cell = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const yes = t("tradePlan.csv.yes");
  const no = t("tradePlan.csv.no");
  const lines = [
    [
      t("tradePlan.csv.title"),
      t("tradePlan.csv.description"),
      t("tradePlan.csv.scope"),
      t("tradePlan.csv.product"),
      t("tradePlan.csv.responsible"),
      t("tradePlan.csv.due"),
      t("tradePlan.csv.status"),
      t("tradePlan.csv.late"),
      t("tradePlan.csv.onTime"),
      t("tradePlan.csv.notes"),
    ]
      .map(cell)
      .join(";"),
  ];
  for (const r of view.rows)
    lines.push(
      [
        r.title,
        r.description,
        r.scopeName,
        [r.productCode, r.productName].filter(Boolean).join(" · "),
        r.responsibleName,
        r.dueDate,
        t(`tradePlan.status.${r.status}` as DictionaryKey),
        r.late ? yes : no,
        r.onTime === null ? "" : r.onTime ? yes : no,
        r.notes,
      ]
        .map(cell)
        .join(";"),
    );
  return new NextResponse(`﻿${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="plano-de-acao-trade-${brDay(new Date())}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
