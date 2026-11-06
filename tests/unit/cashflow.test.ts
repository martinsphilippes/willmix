import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  buildCashflow,
  mondayOf,
  type CashItem,
} from "@/lib/services/cashflow";

const item = (
  type: CashItem["type"],
  day: string | null,
  amount: number,
  currency = "BRL",
): CashItem => ({ type, day, amount, currency, label: "x", href: "/x" });

const rate = (c: string) => (c === "BRL" ? 1 : c === "USD" ? 5 : null);

describe("fluxo de caixa previsto", () => {
  it("segunda-feira da semana", () => {
    expect(mondayOf("2026-11-06")).toBe("2026-11-02"); // sexta
    expect(mondayOf("2026-11-02")).toBe("2026-11-02"); // segunda
    expect(mondayOf("2026-11-08")).toBe("2026-11-02"); // domingo
  });

  it("separa atrasado, semanas, depois e sem data; acumula em reais", () => {
    const { buckets, missingRates } = buildCashflow({
      today: "2026-11-06",
      weeks: 2,
      rate,
      inflows: [
        item("balance", "2026-10-20", 1000), // atrasado
        item("down", "2026-11-06", 500), // esta semana
        item("balance", null, 999), // sem data
      ],
      outflows: [
        item("installment", "2026-11-10", 100, "USD"), // semana 2 = 500 BRL
        item("installment", "2027-01-10", 50), // depois
      ],
    });
    expect(missingRates).toEqual([]);
    const by = Object.fromEntries(buckets.map((b) => [b.key, b]));
    expect(by.overdue.net).toBe(1000);
    expect(by.w0.net).toBe(500);
    expect(by.w1.net).toBe(-500);
    expect(by.w1.outflow.get("USD")).toBe(100);
    expect(by.later.net).toBe(-50);
    expect(by.w1.cumulative).toBe(1000);
    expect(by.later.cumulative).toBe(950);
    expect(by.nodate.items).toHaveLength(1);
    expect(by.nodate.cumulative).toBeNull();
  });

  it("sem câmbio não inventa saldo e avisa a moeda", () => {
    const { buckets, missingRates } = buildCashflow({
      today: "2026-11-06",
      weeks: 2,
      rate,
      inflows: [item("down", "2026-11-06", 500)],
      outflows: [item("installment", "2026-11-04", 10, "CNY")],
    });
    expect(missingRates).toEqual(["CNY"]);
    const w0 = buckets.find((b) => b.key === "w0")!;
    expect(w0.net).toBeNull();
    expect(w0.cumulative).toBeNull();
    expect(buckets.find((b) => b.key === "w1")!.cumulative).toBeNull();
  });

  it("ignora valor zero", () => {
    const { buckets } = buildCashflow({
      today: "2026-11-06",
      weeks: 1,
      rate,
      inflows: [item("balance", "2026-11-06", 0)],
      outflows: [],
    });
    expect(buckets.every((b) => b.items.length === 0)).toBe(true);
  });
});
