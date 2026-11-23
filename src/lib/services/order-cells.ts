import "server-only";
import { getStore } from "@/lib/db";
import { listByIds, listColumns } from "@/lib/db/lookup";
import type { Request } from "@/lib/db/schema";
import { itemPrices, orderTermsCells } from "@/lib/order-table";
import type { OrderTermsCells } from "@/lib/order-table";
import { encomendaTotals } from "@/lib/request-totals";
import type { SaleTotal, TotalPart } from "@/lib/request-totals";
import {
  loadRequestPacking,
  packingRounds,
  packingTotalsLine,
} from "./request-packing";
import type { RequestPacking } from "./request-packing";
import { isStockCustomer } from "./stock-party";

/*
 * Tabela padrão de pedidos fora das Encomendas (dono, 22/11/2026;
 * docs/ORDER_TABLES.md): Pedidos, Cotação e as outras listas chegam às
 * condições do pedido pela solicitação ligada. Aqui, as colunas que vêm da
 * solicitação, lidas só para as linhas da página.
 *
 * Linha sem solicitação (pedido que veio só do Sankhya): tudo nulo, a tela
 * mostra "—". Nada é inventado.
 */

export interface OrderCells {
  terms: OrderTermsCells;
  /** Dia em que o pedido foi lançado (a solicitação mais antiga). */
  negotiationDate: string | null;
  group: string | null;
  customerCode: string | null;
  customerName: string | null;
  /** Produtos diferentes do pedido. */
  items: number;
  /** Entregas programadas no pedido. */
  deliveries: number;
  cbm: TotalPart;
  sale: SaleTotal;
  /** Fornecedor do pedido de compra, a partir de quando ele existe. */
  supplier: string | null;
}

/** O que a tabela de itens lê da solicitação de cada produto. */
export interface OrderItemCells {
  prices: ReturnType<typeof itemPrices>;
  currency: string | null;
  packing: RequestPacking | null;
}

export interface OrderCellsResult {
  /** Pela chave da linha (a mesma que quem chama passou). */
  byKey: Map<string, OrderCells>;
  byRequest: Map<string, OrderItemCells>;
}

export async function loadOrderCells(
  groups: ReadonlyArray<{ key: string; requestIds: readonly string[] }>,
): Promise<OrderCellsResult> {
  const byKey = new Map<string, OrderCells>();
  const byRequest = new Map<string, OrderItemCells>();
  const ids = [...new Set(groups.flatMap((g) => g.requestIds))];
  if (!ids.length) return { byKey, byRequest };
  const store = getStore();
  const requests = await store.list("requests", { filter: { id: ids } });
  const requestById = new Map(requests.map((r) => [r.id, r]));
  const [parties, packing] = await Promise.all([
    listByIds(store, "parties", [
      ...new Set(requests.map((r) => r.customerId)),
    ]),
    loadRequestPacking(requests),
  ]);
  const partyById = new Map(parties.map((p) => [p.id, p]));
  // Fornecedor: o do pedido que a solicitação virou.
  const orderIds = [
    ...new Set(requests.map((r) => r.orderId).filter((v): v is string => !!v)),
  ];
  const orders = orderIds.length
    ? await listColumns(store, "orders", ["supplierId"], {
        filter: { id: orderIds },
      })
    : [];
  const suppliers = await listByIds(store, "parties", [
    ...new Set(orders.map((o) => o.supplierId).filter(Boolean)),
  ]);
  const supplierOf = (r: Request) => {
    const order = r.orderId ? orders.find((o) => o.id === r.orderId) : null;
    return order?.supplierId
      ? (suppliers.find((p) => p.id === order.supplierId)?.name ?? null)
      : null;
  };
  for (const r of requests)
    byRequest.set(r.id, {
      prices: itemPrices(r.priceForecast ?? null),
      currency: r.priceForecast?.currency ?? null,
      packing: packing.get(r.id) ?? null,
    });
  for (const g of groups) {
    const rows = g.requestIds
      .map((id) => requestById.get(id))
      .filter((r): r is Request => !!r)
      .sort(
        (a, b) =>
          a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
      );
    const first = rows[0];
    if (!first) continue;
    const party = partyById.get(first.customerId) ?? null;
    const totals = encomendaTotals(
      rows.map((r) => packingTotalsLine(r, packing.get(r.id), r.productName)),
    );
    byKey.set(g.key, {
      terms: orderTermsCells(first, isStockCustomer(first.customerId)),
      negotiationDate: first.createdAt,
      group: party?.economicGroupName ?? null,
      customerCode:
        party?.sankhyaCode !== null && party?.sankhyaCode !== undefined
          ? String(party.sankhyaCode)
          : null,
      customerName: party?.name ?? null,
      items: new Set(rows.map((r) => r.productId ?? `n:${r.productName}`)).size,
      deliveries: packingRounds(rows, packing, null).rounds,
      cbm: totals.cbm,
      sale: totals.sale,
      supplier:
        [...new Set(rows.map(supplierOf).filter(Boolean))].join(", ") || null,
    });
  }
  return { byKey, byRequest };
}
