import { describe, expect, it } from "vitest";
import {
  compareKeys,
  matchesQuery,
  pageRange,
  sortKey,
} from "@/lib/table-tools";

const sorted = (values: string[], desc = false, decimalComma = true) =>
  [...values].sort((a, b) =>
    compareKeys(sortKey(a, decimalComma), sortKey(b, decimalComma), desc),
  );

describe("busca das tabelas", () => {
  it("acha todas as palavras em qualquer ordem, sem acento nem caixa", () => {
    expect(
      matchesQuery("Pedido 42 · Jarra de Vidro · Ação", "vidro acao"),
    ).toBe(true);
    expect(matchesQuery("Pedido 42 · Jarra de Vidro", "vidro metal")).toBe(
      false,
    );
    expect(matchesQuery("qualquer", "   ")).toBe(true);
  });
});

describe("ordem das tabelas", () => {
  it("ordena moeda e milhar no formato brasileiro", () => {
    expect(sorted(["R$ 1.234,56", "R$ 99,90", "R$ 12.000,00"])).toEqual([
      "R$ 99,90",
      "R$ 1.234,56",
      "R$ 12.000,00",
    ]);
    expect(sortKey("1.234")).toEqual({ kind: "number", value: 1234 });
    expect(sortKey("1,5 kg")).toEqual({ kind: "number", value: 1.5 });
    expect(sortKey("-3,5%")).toEqual({ kind: "number", value: -3.5 });
  });

  it("lê o formato em inglês quando a tela está em inglês", () => {
    expect(sortKey("US$ 1,234.56", false)).toEqual({
      kind: "number",
      value: 1234.56,
    });
    expect(sortKey("1,234", false)).toEqual({ kind: "number", value: 1234 });
  });

  it("ordena datas dd/mm/aaaa pela data, não pelo texto", () => {
    expect(sorted(["02/01/2026", "15/12/2025", "01/03/2026 10:30"])).toEqual([
      "15/12/2025",
      "02/01/2026",
      "01/03/2026 10:30",
    ]);
  });

  it("texto com número natural e vazio sempre no fim", () => {
    expect(sorted(["Item 10", "", "Item 2", "—", "item 1"])).toEqual([
      "item 1",
      "Item 2",
      "Item 10",
      "",
      "—",
    ]);
    expect(sorted(["b", "", "a"], true)).toEqual(["b", "a", ""]);
  });

  it("calcula a faixa da página e corrige página fora do total", () => {
    expect(pageRange(1, 15, 42)).toEqual({
      pages: 3,
      current: 1,
      from: 16,
      to: 30,
    });
    expect(pageRange(9, 25, 42)).toEqual({
      pages: 2,
      current: 1,
      from: 26,
      to: 42,
    });
    expect(pageRange(0, 15, 0)).toEqual({
      pages: 1,
      current: 0,
      from: 0,
      to: 0,
    });
  });
});
