import { describe, expect, it } from "vitest";
import {
  ORDERS_PAGE_SIZE,
  filterOrderRows,
  ordersPage,
  ordersPhaseFilter,
  parseOrdersSort,
  type OrdersFilterRow,
} from "@/lib/orders-filter";

const row = (
  n: number,
  over: Partial<OrdersFilterRow> = {},
): OrdersFilterRow => ({
  number: `#${n}`,
  product: `Produto ${n}`,
  customer: "Cliente",
  supplier: "Fornecedor",
  phaseKey: "stage:SHIPPING",
  phaseRank: 105,
  state: "active",
  progress: 50,
  step: "ordBooking",
  due: "",
  updated: "2026-11-12",
  items: [
    { name: `Item ${n}`, variant: null, state: "active", step: "ordBooking" },
  ],
  ...over,
});
const opts = { today: "2026-11-12", showCustomer: true, showSupplier: true };

describe("filtro e página da tela Pedidos (servidor e navegador)", () => {
  it("acha pelo nome de outro item do pedido, sem acento nem caixa", () => {
    const rows = [
      row(1, {
        items: [
          {
            name: "Garrafa térmica",
            variant: null,
            state: "active",
            step: null,
          },
        ],
      }),
      row(2),
    ];
    expect(filterOrderRows(rows, { p: "TERMICA" }, null, opts)).toEqual([
      rows[0],
    ]);
  });

  it("ordena pelo número e respeita a ordem pedida", () => {
    const rows = [row(3), row(10), row(2)];
    expect(
      filterOrderRows(rows, {}, parseOrdersSort("-number"), opts).map(
        (r) => r.number,
      ),
    ).toEqual(["#10", "#3", "#2"]);
    expect(parseOrdersSort("coluna-que-nao-existe")).toBeNull();
  });

  it("página: dentro do total, e a última quando pedem além", () => {
    expect(ordersPage(undefined, 120)).toEqual({ page: 1, pages: 3, start: 0 });
    expect(ordersPage("2", 120)).toEqual({
      page: 2,
      pages: 3,
      start: ORDERS_PAGE_SIZE,
    });
    expect(ordersPage("99", 120).page).toBe(3);
    expect(ordersPage("abc", 0)).toEqual({ page: 1, pages: 1, start: 0 });
  });

  it("filtro de marco (fase 4a): link antigo pela etapa vira o marco dela", () => {
    expect(ordersPhaseFilter("stage:PREPARATION")).toBe("milestone:new-order");
    expect(ordersPhaseFilter("SHIPPING")).toBe("milestone:shipment");
    expect(ordersPhaseFilter("stage:CUSTOMS")).toBe("milestone:customs");
    expect(ordersPhaseFilter("milestone:art")).toBe("milestone:art");
    expect(ordersPhaseFilter("request:CANCELLED")).toBe("request:CANCELLED");
    expect(ordersPhaseFilter("request:RFQ_OPEN")).toBe("request:RFQ_OPEN");
    expect(ordersPhaseFilter(undefined)).toBe("");
    // Filtra pela chave do marco que a linha guarda.
    const rows = [
      row(1, { phaseKey: "milestone:new-order" }),
      row(2, { phaseKey: "milestone:shipment" }),
    ];
    expect(
      filterOrderRows(
        rows,
        { ph: ordersPhaseFilter("stage:SHIPPING") },
        null,
        opts,
      ).map((r) => r.number),
    ).toEqual(["#2"]);
  });
});
