import { describe, expect, it } from "vitest";
import {
  formatMoneyValue,
  moneyValue,
  parseAmount,
  parseMoneyValue,
} from "@/lib/workflow/money";

describe("requisito em dinheiro", () => {
  it("lê o que a pessoa digita (vírgula ou ponto) e guarda com moeda", () => {
    expect(parseAmount("1.234,56")).toBe(1234.56);
    expect(parseAmount("1234.56")).toBe(1234.56);
    expect(parseAmount("R$ 1 234,5")).toBe(1234.5);
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("-5")).toBeNull();
    expect(moneyValue("BRL", 1234.56)).toBe("BRL 1234.56");
    expect(parseMoneyValue("USD 99.9")).toEqual({
      currency: "USD",
      amount: 99.9,
    });
    expect(parseMoneyValue("123")).toBeNull();
    expect(parseMoneyValue("XXX 1")).toBeNull();
  });

  it("mostra formatado; valor antigo só numérico fica como está", () => {
    expect(formatMoneyValue("BRL 1234.56")).toMatch(/R\$\s?1\.234,56/);
    expect(formatMoneyValue("USD 10")).toMatch(/US\$\s?10,00/);
    expect(formatMoneyValue("123")).toBe("123");
  });
});
