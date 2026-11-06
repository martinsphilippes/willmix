import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isWellmix } from "@/lib/auth/permissions";
import { canOpen } from "@/lib/auth/screens";
import { getStore } from "@/lib/db";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { listLinksForProducts } from "@/lib/services/product-suppliers";
import {
  inProductFilter,
  matchesProduct,
  readProductFilter,
} from "@/lib/services/product-list";

export const dynamic = "force-dynamic";

/**
 * Produtos ativos em CSV, com a mesma busca e filtros da tela. Só a Wellmix
 * com a tela Produtos (os mesmos dados que a tabela já mostra).
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !isWellmix(user) || !canOpen(user, "products"))
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  const t = await getT();
  const sp = request.nextUrl.searchParams;
  const filter = readProductFilter({
    q: sp.get("q") ?? undefined,
    line: sp.get("line") ?? undefined,
    supplier: sp.get("supplier") ?? undefined,
  });
  const store = getStore();
  const [all, lines, suppliers] = await Promise.all([
    store.list("products", { orderBy: "name" }),
    store.list("product_lines", { orderBy: "name" }),
    store.list("parties", { filter: { type: "supplier" } }),
  ]);
  const active = all.filter((p) => p.active);
  const links = await listLinksForProducts(active.map((p) => p.id));
  const supplierName = (id: string | null) =>
    id ? (suppliers.find((s) => s.id === id)?.name ?? "") : "";
  const rows = active.filter(
    (p) =>
      inProductFilter(
        p,
        filter,
        new Set(
          links.filter((l) => l.productId === p.id).map((l) => l.supplierId),
        ),
      ) && matchesProduct(p, supplierName(p.supplierId), filter.q),
  );
  const cell = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const out = [t("prodList.csv.header")];
  for (const p of rows)
    out.push(
      [
        p.name,
        p.sku,
        p.category,
        p.supplierSku,
        lines.find((l) => l.id === p.lineId)?.name ?? "",
        supplierName(p.supplierId),
        p.price !== null ? p.price.toFixed(2) : "",
        p.currency,
        p.moq,
        p.masterBoxQty,
        p.cbm,
        p.material,
        p.color,
        p.notes,
        p.ncm,
        p.source ? t(`catalog.source.${p.source}` as DictionaryKey) : "",
      ]
        .map(cell)
        .join(";"),
    );
  const today = new Date().toISOString().slice(0, 10);
  return new NextResponse(`﻿${out.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="produtos-${today}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
