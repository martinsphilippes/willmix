import { describe, expect, it } from "vitest";
import {
  lastMonths,
  monthOf,
  paidInMonth,
  salesByMonth,
  topBy,
} from "@/lib/services/owner-panel";

const row = (over: Record<string, unknown>) =>
  ({
    order: {
      status: "PACKAGING",
      createdAt: "2026-11-03T12:00:00.000Z",
      customerId: "c1",
      ...((over.order as object) ?? {}),
    },
    sell: 100,
    margin: 20,
    sellCurrency: "BRL",
    customerName: "Loja",
    ...over,
  }) as never;

describe("painel do dono", () => {
  it("mês em Brasília e os últimos meses", () => {
    // 1º de novembro 01:00 UTC ainda é 31 de outubro em Brasília.
    expect(monthOf("2026-11-01T01:00:00.000Z")).toBe("2026-10");
    expect(lastMonths(new Date("2026-11-06T12:00:00Z"), 3)).toEqual([
      "2026-09",
      "2026-10",
      "2026-11",
    ]);
    expect(lastMonths(new Date("2026-02-10T12:00:00Z"), 3)).toEqual([
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });

  it("vendas e margem por mês, sem cancelados, sem estoque e só na moeda principal", () => {
    const r = salesByMonth(
      [
        row({}),
        row({ sell: 50, margin: null }),
        row({ order: { status: "CANCELLED" } }),
        row({ order: { customerId: "wellmix-estoque" } }),
        row({ sellCurrency: "USD" }),
        row({ order: { createdAt: "2026-10-10T12:00:00.000Z" }, sell: 80 }),
      ],
      "BRL",
    );
    expect(r.sell.get("2026-11")).toBe(150);
    expect(r.margin.get("2026-11")).toBe(20);
    expect(r.marginSell.get("2026-11")).toBe(100);
    expect(r.orders.get("2026-11")).toBe(2);
    expect(r.sell.get("2026-10")).toBe(80);
  });

  it("pagamentos confirmados do mês por moeda e maiores contas", () => {
    const base = {
      status: "confirmed",
      confirmedAt: "2026-11-02T12:00:00.000Z",
      createdAt: "2026-11-02T12:00:00.000Z",
    };
    const paid = paidInMonth(
      [
        { ...base, direction: "customer_in", amount: 10, currency: "BRL" },
        { ...base, direction: "customer_in", amount: 5, currency: "BRL" },
        {
          ...base,
          direction: "customer_in",
          amount: 99,
          currency: "BRL",
          status: "pending",
        },
        { ...base, direction: "supplier_out", amount: 7, currency: "USD" },
      ] as never,
      "customer_in",
      "2026-11",
    );
    expect([...paid]).toEqual([["BRL", 15]]);
    const top = topBy(
      [
        { k: "a", v: 10 },
        { k: "b", v: 30 },
        { k: "a", v: 25 },
        { k: null, v: 99 },
      ],
      (i) => i.k,
      (i) => i.v,
      1,
    );
    expect(top).toEqual([{ key: "a", value: 35, count: 2 }]);
  });
});
