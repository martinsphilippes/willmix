import "server-only";

import { getStore, type User } from "@/lib/db";
import { ForbiddenError, isWellmix } from "@/lib/auth/permissions";

/*
 * Tabela de preços (Fase F, docs/ARTWORK.md): para o marketing e o comercial,
 * cada produto ativo do catálogo com o último preço de venda praticado
 * (valor ao cliente ÷ quantidade da última solicitação com fornecedor
 * escolhido), o pedido mínimo e a data. Só a Wellmix (tem o custo FOB).
 */

export interface PriceRow {
  productId: string;
  sku: string | null;
  name: string;
  line: string;
  moq: number | null;
  unitPrice: number | null;
  currency: string | null;
  fobUnit: number | null;
  fobCurrency: string | null;
  soldAt: string | null;
}

const SOLD = ["WAITING_DOWN_PAYMENT", "ORDERED"];

export async function priceTable(user: User): Promise<PriceRow[]> {
  if (!isWellmix(user)) throw new ForbiddenError();
  const store = getStore();
  const [products, lines, requests] = await Promise.all([
    store.list("products", { filter: { active: true }, orderBy: "name" }),
    store.list("product_lines", {}),
    store.list("requests", { filter: { status: SOLD as never } }),
  ]);
  const quoteIds = requests
    .map((r) => r.selectedQuoteId)
    .filter((id): id is string => !!id);
  const quotes = quoteIds.length
    ? await store.list("quotes", { filter: { id: quoteIds } })
    : [];
  return products.map((p) => {
    const last = requests
      .filter(
        (r) => r.productId === p.id && r.sellPrice !== null && r.quantity > 0,
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    const quote = last
      ? quotes.find((q) => q.id === last.selectedQuoteId)
      : undefined;
    return {
      productId: p.id,
      sku: p.sku,
      name: p.name,
      line: lines.find((l) => l.id === p.lineId)?.name ?? "—",
      moq: p.moq,
      unitPrice: last
        ? Math.round(((last.sellPrice ?? 0) / last.quantity) * 10000) / 10000
        : null,
      currency: last?.sellCurrency ?? null,
      fobUnit: quote?.price ?? p.price ?? null,
      fobCurrency: quote?.currency ?? p.currency ?? null,
      soldAt: last?.updatedAt ?? null,
    };
  });
}

/** CSV (separador ";", como o Excel em português abre). */
export function priceTableCsv(rows: PriceRow[]): string {
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    // Evita fórmula no Excel (=, +, -, @ no começo).
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return /[;"\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const head = [
    "SKU",
    "Produto",
    "Linha",
    "Pedido mínimo",
    "Preço unitário",
    "Moeda",
    "FOB unitário",
    "Moeda FOB",
    "Última venda",
  ];
  const lines = rows.map((r) =>
    [
      r.sku,
      r.name,
      r.line,
      r.moq,
      r.unitPrice !== null ? String(r.unitPrice).replace(".", ",") : "",
      r.currency,
      r.fobUnit !== null ? String(r.fobUnit).replace(".", ",") : "",
      r.fobCurrency,
      r.soldAt?.slice(0, 10) ?? "",
    ]
      .map(esc)
      .join(";"),
  );
  return "﻿" + [head.join(";"), ...lines].join("\r\n");
}
