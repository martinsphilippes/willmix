/*
 * Painel do cliente e do grupo (dono, 19/11/2026; docs/TRADE_COMERCIAL.md,
 * PR 4): os cálculos das telas 01 a 11 do painel do Projeto Campineira, agora
 * sobre as vendas reais do Sankhya por mês, cliente e produto
 * (`customer_sales_monthly`). Funções puras: a tela e os testes chamam as
 * mesmas. Peças = quantidade pedida convertida para unidades (a caixa vira
 * peças pelo volume do Sankhya); valores só para quem vê valores (a tela
 * decide).
 */

/** Uma linha da base: mês × cliente × produto × unidade. */
export interface SaleRow {
  customerId: string;
  /** AAAA-MM */
  month: string;
  productCode: string;
  productName: string | null;
  unit: string | null;
  quantity: number;
  /** Peças (unidades); nulo quando a unidade não converte. */
  pieces: number | null;
  valueBrl: number | null;
  orders: number;
  /** AAAA-MM-DD do pedido mais recente do mês. */
  lastOrderDate: string | null;
}

/** O produto do catálogo de um CODPROD (grupo = família; categoria = linha). */
export interface ProductInfo {
  name: string;
  sku: string | null;
  group: string;
  category: string;
  productId: string | null;
}

export interface StockInfo {
  brazil: number;
  reserved: number;
  transit: number;
  production: number;
}

export interface PanelFilters {
  /** Ano (AAAA) das vendas; vazio = todos. */
  year?: string;
  /** Trimestre do ano (1 a 4); só com o ano. */
  quarter?: number;
  /** Grupo de produto (família). */
  group?: string;
  /** SKU, código, descrição ou cliente. */
  q?: string;
  /** Só este cliente (dentro do grupo). */
  customerId?: string;
}

export const NO_GROUP = "Sem grupo";

const add = (a: number, b: number) => Math.round((a + b) * 1e6) / 1e6;

export const quarterOf = (month: string) =>
  Math.floor((Number(month.slice(5, 7)) - 1) / 3) + 1;

/** Linhas que passam nos filtros (período, grupo, busca e cliente). */
export function filterRows(
  rows: readonly SaleRow[],
  products: ReadonlyMap<string, ProductInfo>,
  filters: PanelFilters,
  customerNames: ReadonlyMap<string, string> = new Map(),
): SaleRow[] {
  const q = (filters.q ?? "").trim().toLowerCase();
  return rows.filter((r) => {
    if (filters.customerId && r.customerId !== filters.customerId) return false;
    if (filters.year && r.month.slice(0, 4) !== filters.year) return false;
    if (
      filters.year &&
      filters.quarter &&
      quarterOf(r.month) !== filters.quarter
    )
      return false;
    const info = products.get(r.productCode);
    if (filters.group && (info?.group ?? NO_GROUP) !== filters.group)
      return false;
    if (q) {
      const text = [
        r.productCode,
        r.productName,
        info?.sku,
        info?.name,
        customerNames.get(r.customerId),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!text.includes(q)) return false;
    }
    return true;
  });
}

/** Total de um produto no recorte. */
export interface ProductTotal {
  code: string;
  name: string;
  sku: string | null;
  group: string;
  category: string;
  productId: string | null;
  pieces: number;
  valueBrl: number | null;
  orders: number;
  customers: Set<string>;
  months: Set<string>;
  lastOrderDate: string | null;
  /** Linhas sem peças (unidade sem conversão). */
  unconverted: number;
}

export function productTotals(
  rows: readonly SaleRow[],
  products: ReadonlyMap<string, ProductInfo>,
): ProductTotal[] {
  const out = new Map<string, ProductTotal>();
  for (const r of rows) {
    const info = products.get(r.productCode);
    let p = out.get(r.productCode);
    if (!p) {
      p = {
        code: r.productCode,
        name: info?.name ?? r.productName ?? r.productCode,
        sku: info?.sku ?? null,
        group: info?.group ?? NO_GROUP,
        category: info?.category ?? NO_GROUP,
        productId: info?.productId ?? null,
        pieces: 0,
        valueBrl: 0,
        orders: 0,
        customers: new Set(),
        months: new Set(),
        lastOrderDate: null,
        unconverted: 0,
      };
      out.set(r.productCode, p);
    }
    if (r.pieces === null) p.unconverted++;
    else p.pieces = add(p.pieces, r.pieces);
    p.valueBrl =
      p.valueBrl === null || r.valueBrl === null
        ? null
        : add(p.valueBrl, r.valueBrl);
    p.orders += r.orders;
    p.customers.add(r.customerId);
    p.months.add(r.month);
    if (
      r.lastOrderDate &&
      (!p.lastOrderDate || r.lastOrderDate > p.lastOrderDate)
    )
      p.lastOrderDate = r.lastOrderDate;
  }
  return [...out.values()].sort(
    (a, b) => b.pieces - a.pieces || a.name.localeCompare(b.name, "pt-BR"),
  );
}

const sum = (list: readonly number[]) => list.reduce((a, b) => add(a, b), 0);

/** 01 · Visão executiva. */
export function executive(totals: readonly ProductTotal[]) {
  const pieces = sum(totals.map((p) => p.pieces));
  const top10 = sum(totals.slice(0, 10).map((p) => p.pieces));
  const customers = new Set<string>();
  for (const p of totals) for (const c of p.customers) customers.add(c);
  const groups = new Map<string, number>();
  for (const p of totals)
    groups.set(p.group, add(groups.get(p.group) ?? 0, p.pieces));
  const value = totals.some((p) => p.valueBrl === null)
    ? null
    : sum(totals.map((p) => p.valueBrl ?? 0));
  return {
    pieces,
    skus: totals.length,
    customers: customers.size,
    orders: totals.reduce((a, p) => a + p.orders, 0),
    valueBrl: value,
    top10Share: pieces > 0 ? top10 / pieces : 0,
    top10: totals.slice(0, 10),
    groups: [...groups.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value),
    unconverted: totals.reduce((a, p) => a + p.unconverted, 0),
  };
}

export type AbcClass = "A" | "B" | "C";

/** 03 · Curva ABC por peças: A até 80%, B até 95%, C o resto. */
export function abc(totals: readonly ProductTotal[]) {
  const rows = totals.filter((p) => p.pieces > 0);
  const total = sum(rows.map((p) => p.pieces));
  let cumulative = 0;
  const classes: Record<AbcClass, { skus: number; pieces: number }> = {
    A: { skus: 0, pieces: 0 },
    B: { skus: 0, pieces: 0 },
    C: { skus: 0, pieces: 0 },
  };
  const out = rows.map((p) => {
    const before = total > 0 ? cumulative / total : 0;
    const cls: AbcClass = before < 0.8 ? "A" : before < 0.95 ? "B" : "C";
    cumulative = add(cumulative, p.pieces);
    classes[cls].skus++;
    classes[cls].pieces = add(classes[cls].pieces, p.pieces);
    return {
      ...p,
      cls,
      share: total > 0 ? p.pieces / total : 0,
      cumulative: total > 0 ? cumulative / total : 0,
    };
  });
  return { rows: out, classes, total };
}

/** 04 · Frequência: alcance por cliente e recompra (2+ pedidos). */
export function frequency(
  rows: readonly SaleRow[],
  totals: readonly ProductTotal[],
) {
  const pairs = new Map<string, number>();
  const skusByCustomer = new Map<string, Set<string>>();
  for (const r of rows) {
    const key = `${r.customerId}|${r.productCode}`;
    pairs.set(key, (pairs.get(key) ?? 0) + r.orders);
    const set = skusByCustomer.get(r.customerId) ?? new Set<string>();
    set.add(r.productCode);
    skusByCustomer.set(r.customerId, set);
  }
  const customers = skusByCustomer.size;
  const repurchased = [...pairs.values()].filter((n) => n >= 2).length;
  return {
    customers,
    pairs: pairs.size,
    multiCustomerSkus: totals.filter((p) => p.customers.size >= 2).length,
    avgSkusPerCustomer:
      customers > 0
        ? [...skusByCustomer.values()].reduce((a, s) => a + s.size, 0) /
          customers
        : 0,
    repurchased,
    repurchaseRate: pairs.size > 0 ? repurchased / pairs.size : 0,
    topReach: [...totals]
      .sort(
        (a, b) =>
          b.customers.size - a.customers.size ||
          b.orders - a.orders ||
          b.pieces - a.pieces,
      )
      .slice(0, 10),
    topVariety: [...skusByCustomer.entries()]
      .map(([customerId, set]) => ({ customerId, skus: set.size }))
      .sort((a, b) => b.skus - a.skus),
  };
}

export interface PeriodPoint {
  key: string;
  pieces: number;
  valueBrl: number | null;
  orders: number;
}

function grouped(
  rows: readonly SaleRow[],
  keyOf: (r: SaleRow) => string,
): PeriodPoint[] {
  const out = new Map<string, PeriodPoint>();
  for (const r of rows) {
    const key = keyOf(r);
    const p = out.get(key) ?? { key, pieces: 0, valueBrl: 0, orders: 0 };
    p.pieces = add(p.pieces, r.pieces ?? 0);
    p.valueBrl =
      p.valueBrl === null || r.valueBrl === null
        ? null
        : add(p.valueBrl, r.valueBrl);
    p.orders += r.orders;
    out.set(key, p);
  }
  return [...out.values()].sort((a, b) => a.key.localeCompare(b.key));
}

/** 05 · Vendas por mês e por trimestre. */
export function periods(rows: readonly SaleRow[]) {
  return {
    months: grouped(rows, (r) => r.month),
    quarters: grouped(
      rows,
      (r) => `${r.month.slice(0, 4)} · T${quarterOf(r.month)}`,
    ),
    years: grouped(rows, (r) => r.month.slice(0, 4)),
  };
}

/**
 * 06 · Ano contra ano: as peças de cada mês nos dois anos; o acumulado só
 * compara os mesmos meses (o ano atual até o último mês com dado).
 */
export function compareYears(
  rows: readonly SaleRow[],
  yearA: string,
  yearB: string,
) {
  const months = Array.from({ length: 12 }, (_, i) =>
    String(i + 1).padStart(2, "0"),
  );
  const a = new Map(
    grouped(
      rows.filter((r) => r.month.startsWith(yearA)),
      (r) => r.month.slice(5, 7),
    ).map((p) => [p.key, p]),
  );
  const b = new Map(
    grouped(
      rows.filter((r) => r.month.startsWith(yearB)),
      (r) => r.month.slice(5, 7),
    ).map((p) => [p.key, p]),
  );
  const lastB = [...b.keys()].sort().pop() ?? "00";
  const same = months.filter((m) => m <= lastB);
  const totalA = sum(same.map((m) => a.get(m)?.pieces ?? 0));
  const totalB = sum(same.map((m) => b.get(m)?.pieces ?? 0));
  return {
    rows: months.map((m) => ({
      month: m,
      a: a.get(m)?.pieces ?? 0,
      b: b.get(m)?.pieces ?? 0,
    })),
    sameMonths: same.length,
    totalA,
    totalB,
    change: totalA > 0 ? (totalB - totalA) / totalA : null,
  };
}

/** 07 · Mix: peças por grupo e por categoria. */
export function mix(totals: readonly ProductTotal[]) {
  const groups = new Map<string, number>();
  const categories = new Map<string, number>();
  for (const p of totals) {
    groups.set(p.group, add(groups.get(p.group) ?? 0, p.pieces));
    categories.set(p.category, add(categories.get(p.category) ?? 0, p.pieces));
  }
  const list = (m: Map<string, number>) =>
    [...m.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  return { groups: list(groups), categories: list(categories) };
}

/** 08 · Estoque dos produtos que o cliente (ou o grupo) compra. */
export function stock(
  totals: readonly ProductTotal[],
  byProduct: ReadonlyMap<string, StockInfo>,
) {
  const rows = totals.map((p) => {
    const s = p.productId ? byProduct.get(p.productId) : undefined;
    const free = s ? Math.max(0, s.brazil - s.reserved) : 0;
    return {
      ...p,
      free,
      transit: s?.transit ?? 0,
      production: s?.production ?? 0,
      inCatalog: !!p.productId,
    };
  });
  return {
    rows,
    withStock: rows.filter((r) => r.free > 0).length,
    withoutStock: rows.filter((r) => r.free <= 0).length,
    soldWithoutStock: rows.filter((r) => r.free <= 0 && r.pieces > 0).length,
    coming: rows.filter((r) => r.free <= 0 && r.transit + r.production > 0)
      .length,
  };
}

export type Recency = "d90" | "d180" | "d365" | "older";
export const RECENCIES: readonly Recency[] = ["d90", "d180", "d365", "older"];

const daysBetween = (from: string, to: string) =>
  Math.round(
    (Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) /
      86_400_000,
  );

/** 09 · Ciclo de vida: dias desde a última compra de cada SKU. */
export function lifecycle(totals: readonly ProductTotal[], today: string) {
  const rows = totals
    .filter((p) => p.lastOrderDate)
    .map((p) => {
      const days = daysBetween(p.lastOrderDate!, today);
      const recency: Recency =
        days <= 90
          ? "d90"
          : days <= 180
            ? "d180"
            : days <= 365
              ? "d365"
              : "older";
      return { ...p, days, recency };
    });
  const counts: Record<Recency, number> = {
    d90: 0,
    d180: 0,
    d365: 0,
    older: 0,
  };
  for (const r of rows) counts[r.recency]++;
  return {
    rows: [...rows].sort((a, b) => b.days - a.days),
    counts,
  };
}

/** 10 · Clientes do grupo: peças, SKUs, pedidos e última compra. */
export function customers(rows: readonly SaleRow[], today: string) {
  const out = new Map<
    string,
    {
      customerId: string;
      pieces: number;
      skus: Set<string>;
      orders: number;
      last: string | null;
    }
  >();
  for (const r of rows) {
    const c = out.get(r.customerId) ?? {
      customerId: r.customerId,
      pieces: 0,
      skus: new Set<string>(),
      orders: 0,
      last: null,
    };
    c.pieces = add(c.pieces, r.pieces ?? 0);
    c.skus.add(r.productCode);
    c.orders += r.orders;
    if (r.lastOrderDate && (!c.last || r.lastOrderDate > c.last))
      c.last = r.lastOrderDate;
    out.set(r.customerId, c);
  }
  return [...out.values()]
    .map((c) => ({
      customerId: c.customerId,
      pieces: c.pieces,
      skus: c.skus.size,
      orders: c.orders,
      lastOrderDate: c.last,
      daysWithoutPurchase: c.last ? daysBetween(c.last, today) : null,
    }))
    .sort((a, b) => b.pieces - a.pieces);
}

export type DiagnosisFocus = "leaders" | "reach" | "low" | "recency" | "all";
export const DIAGNOSIS_FOCUS: readonly DiagnosisFocus[] = [
  "leaders",
  "reach",
  "low",
  "recency",
  "all",
];

/**
 * 11 · Diagnóstico (as regras do HTML, com a base real): proteger o Top 10,
 * ampliar o alcance (SKU em um cliente só do grupo), investigar o baixo
 * volume (abaixo da média) e o SKU sem compra há mais de 180 dias. Cada SKU
 * cai no primeiro foco que se aplica, nessa ordem.
 */
export function diagnosisFocusOf(
  p: Pick<ProductTotal, "code" | "pieces" | "customers" | "lastOrderDate">,
  ctx: {
    top10: ReadonlySet<string>;
    mean: number;
    today: string;
    groupScope: boolean;
  },
): Exclude<DiagnosisFocus, "all"> | "growth" {
  if (ctx.top10.has(p.code)) return "leaders";
  if (p.lastOrderDate && daysBetween(p.lastOrderDate, ctx.today) > 180)
    return "recency";
  if (ctx.groupScope && p.customers.size === 1) return "reach";
  if (p.pieces < ctx.mean) return "low";
  return "growth";
}

export function diagnosis(
  totals: readonly ProductTotal[],
  focus: DiagnosisFocus,
  today: string,
  groupScope: boolean,
) {
  const top10 = new Set(totals.slice(0, 10).map((p) => p.code));
  const mean = totals.length
    ? sum(totals.map((p) => p.pieces)) / totals.length
    : 0;
  const ctx = { top10, mean, today, groupScope };
  return totals
    .map((p) => ({ ...p, focus: diagnosisFocusOf(p, ctx) }))
    .filter((p) => focus === "all" || p.focus === focus);
}
