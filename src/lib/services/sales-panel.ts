import "server-only";
import {
  getStore,
  type CustomerGroup,
  type CustomerSaleMonth,
  type CustomerSalesLoad,
  type Party,
  type ProductFamilyRow,
  type ProductLine,
  type User,
} from "@/lib/db";
import { listByIds, listColumns } from "@/lib/db/lookup";
import { canSeeMoney } from "@/lib/auth/function-access";
import { ForbiddenError } from "@/lib/auth/permissions";
import {
  NO_GROUP,
  type ProductInfo,
  type SaleRow,
  type StockInfo,
} from "@/lib/sales-panel";
import {
  canManagePortfolio,
  canUsePortfolio,
  loadPortfolio,
} from "./portfolio";

/*
 * Painel do cliente e do grupo (dono, 19/11/2026; docs/TRADE_COMERCIAL.md, PR
 * 4): lê a base de vendas gravada (`customer_sales_monthly`, PR 3), nunca o
 * Sankhya na hora, com o catálogo do portal para o grupo (família) e a
 * categoria (linha) de cada produto. Quem gere a carteira abre qualquer
 * grupo ou cliente; os outros, os da própria carteira e da equipe abaixo.
 * Valores só para quem vê valores e margem.
 */

export type PanelScope =
  { kind: "group"; id: string } | { kind: "customer"; id: string };

/** "g:<id>" (grupo) ou "c:<id>" (cliente). */
export function parseScope(raw: string | null | undefined): PanelScope | null {
  const m = /^(g|c):([A-Za-z0-9_-]{1,64})$/.exec(raw ?? "");
  return m ? { kind: m[1] === "g" ? "group" : "customer", id: m[2] } : null;
}

export const scopeParam = (s: PanelScope) =>
  `${s.kind === "group" ? "g" : "c"}:${s.id}`;

export interface PanelCustomer {
  id: string;
  name: string;
  code: string | null;
  load: CustomerSalesLoad | null;
}

export interface PanelData {
  scope: PanelScope;
  name: string;
  customers: PanelCustomer[];
  rows: SaleRow[];
  products: Map<string, ProductInfo>;
  money: boolean;
  canManage: boolean;
  years: string[];
  groups: string[];
}

/** O que o login pode abrir no painel (a escolha do grupo ou do cliente). */
export async function panelChoices(user: User) {
  if (!canUsePortfolio(user)) throw new ForbiddenError();
  const view = await loadPortfolio(user);
  const groupIds = new Set(view.rows.map((r) => r.groupId).filter(Boolean));
  return {
    groups: view.groups.filter((g) => view.canManage || groupIds.has(g.id)),
    customers: view.rows.map((r) => ({
      id: r.customerId,
      name: r.name,
      code: r.code,
      groupName: r.groupName,
    })),
  };
}

async function scopeCustomers(
  user: User,
  scope: PanelScope,
): Promise<{ name: string; customers: Party[] } | null> {
  const store = getStore();
  const manage = canManagePortfolio(user);
  const visible = manage ? null : (await loadPortfolio(user)).rows;
  if (scope.kind === "customer") {
    const party = await store.get("parties", scope.id).catch(() => null);
    if (!party || party.type !== "customer") return null;
    if (visible && !visible.some((r) => r.customerId === party.id)) return null;
    return { name: party.name, customers: [party] };
  }
  const group = await store
    .get("customer_groups", scope.id)
    .catch(() => null as CustomerGroup | null);
  if (!group) return null;
  if (visible && !visible.some((r) => r.groupId === group.id)) return null;
  const customers = (
    await store
      .list("parties", { filter: { customerGroupId: group.id } })
      .catch(() => [] as Party[])
  )
    .filter((p) => p.type === "customer")
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  return { name: group.name, customers };
}

/** Produto do catálogo, grupo (família) e categoria (linha) de cada CODPROD. */
export async function productInfos(
  codes: string[],
): Promise<Map<string, ProductInfo>> {
  const store = getStore();
  const unique = [...new Set(codes)];
  const products: Array<{
    id: string;
    name: string;
    sku: string | null;
    lineId: string;
    sankhyaCode?: string | null;
  }> = [];
  for (let i = 0; i < unique.length; i += 200) {
    const part = await listColumns(
      store,
      "products",
      ["name", "sku", "lineId", "sankhyaCode"],
      { filter: { sankhyaCode: unique.slice(i, i + 200) } },
    ).catch(() => []);
    products.push(...part);
  }
  const lines = await listByIds(store, "product_lines", [
    ...new Set(products.map((p) => p.lineId)),
  ]).catch(() => [] as ProductLine[]);
  const lineById = new Map(lines.map((l) => [l.id, l]));
  const familyCodes = [
    ...new Set(lines.map((l) => l.familyCode).filter(Boolean)),
  ] as string[];
  const families = familyCodes.length
    ? await store
        .list("product_families", { filter: { code: familyCodes } })
        .catch(() => [] as ProductFamilyRow[])
    : [];
  const familyName = new Map(families.map((f) => [f.code, f.name]));
  const out = new Map<string, ProductInfo>();
  for (const p of products) {
    if (!p.sankhyaCode || out.has(p.sankhyaCode)) continue;
    const line = lineById.get(p.lineId);
    out.set(p.sankhyaCode, {
      name: p.name,
      sku: p.sku,
      group:
        (line?.familyCode ? familyName.get(line.familyCode) : null) ?? NO_GROUP,
      category: line?.name ?? NO_GROUP,
      productId: p.id,
    });
  }
  return out;
}

/** A base do grupo ou do cliente, pronta para os cálculos do painel. */
export async function loadPanelData(
  user: User,
  scope: PanelScope,
): Promise<PanelData | null> {
  if (!canUsePortfolio(user)) throw new ForbiddenError();
  const resolved = await scopeCustomers(user, scope);
  if (!resolved) return null;
  const store = getStore();
  const ids = resolved.customers.map((c) => c.id);
  const [sales, loads] = ids.length
    ? await Promise.all([
        store
          .list("customer_sales_monthly", { filter: { customerId: ids } })
          .catch(() => [] as CustomerSaleMonth[]),
        store
          .list("customer_sales_loads", { filter: { customerId: ids } })
          .catch(() => [] as CustomerSalesLoad[]),
      ])
    : [[] as CustomerSaleMonth[], [] as CustomerSalesLoad[]];
  const money = canSeeMoney(user);
  const rows: SaleRow[] = sales.map((s) => ({
    customerId: s.customerId,
    month: s.month,
    productCode: s.productCode,
    productName: s.productName,
    unit: s.unit,
    quantity: s.quantity,
    pieces: s.pieces,
    valueBrl: money ? s.valueBrl : null,
    orders: s.orders,
    lastOrderDate: s.lastOrderDate,
  }));
  const products = await productInfos(rows.map((r) => r.productCode));
  const loadOf = new Map(loads.map((l) => [l.customerId, l]));
  return {
    scope,
    name: resolved.name,
    customers: resolved.customers.map((c) => ({
      id: c.id,
      name: c.name,
      code: c.sankhyaCode ?? null,
      load: loadOf.get(c.id) ?? null,
    })),
    rows,
    products,
    money,
    canManage: canManagePortfolio(user),
    years: [...new Set(rows.map((r) => r.month.slice(0, 4)))].sort().reverse(),
    groups: [
      ...new Set(
        rows.map((r) => products.get(r.productCode)?.group ?? NO_GROUP),
      ),
    ].sort((a, b) => a.localeCompare(b, "pt-BR")),
  };
}

/** Estoque do portal dos produtos (livre no Brasil, trânsito e produção). */
export async function stockByProduct(
  productIds: string[],
): Promise<Map<string, StockInfo>> {
  const wanted = new Set(productIds.filter(Boolean));
  if (!wanted.size) return new Map();
  const { loadInventory } = await import("./inventory");
  const rows = await loadInventory().catch(() => []);
  const out = new Map<string, StockInfo>();
  for (const r of rows)
    if (wanted.has(r.productId))
      out.set(r.productId, {
        brazil: r.brazil,
        reserved: r.reserved ?? 0,
        transit: r.transit,
        production: r.production,
      });
  return out;
}
