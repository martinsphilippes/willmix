import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  abc,
  compareYears,
  customers as customersOf,
  diagnosis,
  filterRows,
  frequency,
  lifecycle,
  mix,
  periods,
  productTotals,
  stock as stockOf,
  DIAGNOSIS_FOCUS,
  type DiagnosisFocus,
  type ProductTotal,
} from "@/lib/sales-panel";
import { brDay, canUsePortfolio } from "@/lib/services/portfolio";
import {
  loadPanelData,
  parseScope,
  stockByProduct,
} from "@/lib/services/sales-panel";

export const dynamic = "force-dynamic";

/**
 * CSV de cada tela do painel (docs/TRADE_COMERCIAL.md, PR 4), com os mesmos
 * filtros da tela, como o "Exportar CSV" do HTML. Valores só para quem vê
 * valores e margem.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !canUsePortfolio(user))
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  const sp = request.nextUrl.searchParams;
  const scope = parseScope(sp.get("scope"));
  if (!scope) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const data = await loadPanelData(user, scope);
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const t = await getT();
  const tab = sp.get("tab") ?? "executive";
  const year = data.years.includes(sp.get("year") ?? "") ? sp.get("year")! : "";
  const quarter = Number(sp.get("quarter") ?? "");
  const customer = data.customers.some((c) => c.id === sp.get("customer"))
    ? sp.get("customer")!
    : "";
  const customerName = new Map(data.customers.map((c) => [c.id, c.name]));
  const rows = filterRows(
    data.rows,
    data.products,
    {
      year: tab === "compare" ? undefined : year || undefined,
      quarter:
        tab === "compare" || !year || !(quarter >= 1 && quarter <= 4)
          ? undefined
          : quarter,
      group: (sp.get("group") ?? "") || undefined,
      customerId: customer || undefined,
      q: (sp.get("q") ?? "").slice(0, 120) || undefined,
    },
    customerName,
  );
  const totals = productTotals(rows, data.products);
  const today = brDay(new Date());
  const decimal = (n: number | null, digits = 2) => {
    if (n === null || !Number.isFinite(n)) return "";
    const text = String(Math.round(n * 10 ** digits) / 10 ** digits);
    return t.locale === "pt" ? text.replace(".", ",") : text;
  };
  const col = (k: string) => t(`salesPanel.col.${k}` as DictionaryKey);
  const productHead = [
    col("code"),
    col("sku"),
    col("product"),
    col("group"),
    col("category"),
    col("pieces"),
    col("customers"),
    col("orders"),
    col("last"),
    ...(data.money ? [col("value")] : []),
  ];
  const productCells = (p: ProductTotal) => [
    p.code,
    p.sku ?? "",
    p.name,
    p.group,
    p.category,
    decimal(p.pieces, 3),
    p.customers.size,
    p.orders,
    p.lastOrderDate ?? "",
    ...(data.money ? [decimal(p.valueBrl)] : []),
  ];
  let head: string[] = [];
  let body: Array<Array<string | number>> = [];
  if (tab === "abc") {
    const a = abc(totals);
    head = [col("class"), ...productHead, col("share"), col("cumulative")];
    body = a.rows.map((r) => [
      r.cls,
      ...productCells(r),
      decimal(r.share * 100),
      decimal(r.cumulative * 100),
    ]);
  } else if (tab === "frequency") {
    const q = frequency(rows, totals);
    head = productHead;
    body = q.topReach.map(productCells);
  } else if (tab === "period") {
    head = [
      col("month"),
      col("pieces"),
      col("orders"),
      ...(data.money ? [col("value")] : []),
    ];
    body = periods(rows).months.map((m) => [
      m.key,
      decimal(m.pieces, 3),
      m.orders,
      ...(data.money ? [decimal(m.valueBrl)] : []),
    ]);
  } else if (tab === "compare") {
    const yb = data.years.includes(sp.get("yb") ?? "")
      ? sp.get("yb")!
      : (data.years[0] ?? "");
    const ya = data.years.includes(sp.get("ya") ?? "")
      ? sp.get("ya")!
      : (data.years.find((y) => y < yb) ?? "");
    const cmp = compareYears(rows, ya, yb);
    head = [col("month"), ya, yb];
    body = cmp.rows.map((r) => [r.month, decimal(r.a, 3), decimal(r.b, 3)]);
  } else if (tab === "mix") {
    const m = mix(totals);
    head = [col("group"), col("category"), col("pieces")];
    body = [
      ...m.groups.map((g) => [g.label, "", decimal(g.value, 3)]),
      ...m.categories.map((g) => ["", g.label, decimal(g.value, 3)]),
    ];
  } else if (tab === "stock") {
    const s = stockOf(
      totals,
      await stockByProduct(totals.map((p) => p.productId ?? "")),
    );
    head = [...productHead, col("free"), col("transit"), col("production")];
    body = s.rows.map((r) => [
      ...productCells(r),
      decimal(r.free, 3),
      decimal(r.transit, 3),
      decimal(r.production, 3),
    ]);
  } else if (tab === "lifecycle") {
    const l = lifecycle(totals, today);
    head = [...productHead, col("days"), col("recency")];
    body = l.rows.map((r) => [
      ...productCells(r),
      r.days,
      t(`salesPanel.life.${r.recency}` as DictionaryKey),
    ]);
  } else if (tab === "customers") {
    head = [
      col("customer"),
      col("pieces"),
      col("skus"),
      col("orders"),
      col("last"),
      col("days"),
    ];
    body = customersOf(rows, today).map((c) => [
      customerName.get(c.customerId) ?? c.customerId,
      decimal(c.pieces, 3),
      c.skus,
      c.orders,
      c.lastOrderDate ?? "",
      c.daysWithoutPurchase ?? "",
    ]);
  } else if (tab === "diagnosis") {
    const focus = (DIAGNOSIS_FOCUS as readonly string[]).includes(
      sp.get("focus") ?? "",
    )
      ? (sp.get("focus") as DiagnosisFocus)
      : "all";
    head = [
      col("focus"),
      ...productHead,
      t("salesPanel.diag.prompt"),
      t("salesPanel.diag.action"),
      t("salesPanel.diag.evidence"),
    ];
    body = diagnosis(totals, focus, today, scope.kind === "group").map((p) => [
      t(`salesPanel.diag.${p.focus}.title` as DictionaryKey),
      ...productCells(p),
      t(`salesPanel.diag.${p.focus}.prompt` as DictionaryKey),
      t(`salesPanel.diag.${p.focus}.action` as DictionaryKey),
      t(`salesPanel.diag.${p.focus}.evidence` as DictionaryKey),
    ]);
  } else {
    head = productHead;
    body = totals.map(productCells);
  }
  const cell = (v: string | number) => {
    const s = String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [head, ...body].map((r) => r.map(cell).join(";"));
  const safeTab = /^[a-z]{1,20}$/.test(tab) ? tab : "painel";
  return new NextResponse(`﻿${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="painel-${safeTab}-${today}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
