import { describe, expect, it } from "vitest";
import {
  lotMatchesFilters,
  otherGroupItems,
  parseGroupIds,
  parseSelectionFilters,
  searchSuggestions,
  suggestBlocks,
} from "@/lib/booking-selection";

/* Seleção de itens: filtros do endereço, blocos sugeridos e autocompletar. */

const item = (id: string, description: string, supplierId: string | null) => ({
  item: { id, description, productName: null },
  supplierId,
});

describe("filtros da seleção", () => {
  it("lê o endereço e descarta o que não vale", () => {
    const f = parseSelectionFilters({
      status: ["draft", "bogus", "closed,done"],
      from: "2026-10-31",
      to: "2026-10-01",
      supplier: "sup1",
      origin: " Yiwu ",
    });
    expect(f.statuses).toEqual(["draft", "closed", "done"]);
    // Intervalo invertido é desvirado.
    expect([f.from, f.to]).toEqual(["2026-10-01", "2026-10-31"]);
    expect(f.supplierId).toBe("sup1");
    expect(f.origin).toBe("Yiwu");
    expect(parseSelectionFilters({ from: "31/10/2026" }).from).toBeNull();
  });

  it("filtra o booking por status (padrão sem cancelado), data, fornecedor e origem", () => {
    const lot = {
      status: "draft" as const,
      bookingDate: "2026-10-13T00:00:00.000Z",
      supplierId: "s1",
      origin: "São Paulo",
    };
    const none = parseSelectionFilters({});
    expect(lotMatchesFilters(lot, none)).toBe(true);
    expect(lotMatchesFilters({ ...lot, status: "cancelled" }, none)).toBe(
      false,
    );
    expect(lotMatchesFilters(lot, { ...none, statuses: ["closed"] })).toBe(
      false,
    );
    expect(
      lotMatchesFilters(lot, { ...none, from: "2026-10-13", to: "2026-10-13" }),
    ).toBe(true);
    expect(lotMatchesFilters(lot, { ...none, from: "2026-10-14" })).toBe(false);
    expect(
      lotMatchesFilters(
        { ...lot, bookingDate: null },
        { ...none, to: "2026-12-01" },
      ),
    ).toBe(false);
    expect(lotMatchesFilters(lot, { ...none, supplierId: "s2" })).toBe(false);
    expect(lotMatchesFilters(lot, { ...none, origin: "sao paulo" })).toBe(true);
    expect(lotMatchesFilters(lot, { ...none, origin: "Yiwu" })).toBe(false);
  });

  it("ids do grupo: sem repetição, só ids válidos, até 60", () => {
    expect(parseGroupIds("a,b,a,,x y,<z>")).toEqual(["a", "b"]);
    const many = Array.from({ length: 80 }, (_, i) => `id${i}`).join(",");
    expect(parseGroupIds(many)).toHaveLength(60);
  });
});

describe("blocos sugeridos", () => {
  it("junta itens de nomes parecidos, de vários fornecedores primeiro", () => {
    const blocks = suggestBlocks([
      item("1", "Glass cup 350ml", "A"),
      item("2", "Glass cup with handle", "B"),
      item("3", "Glass cup double wall", "C"),
      item("4", "Plastic bottle 500ml", "A"),
      item("5", "Plastic bottle sport", "A"),
      item("6", "Bamboo cutting board", "B"),
    ]);
    expect(blocks.map((b) => b.ids.sort())).toEqual([
      ["1", "2", "3"],
      ["4", "5"],
    ]);
    expect(blocks[0]).toMatchObject({ suppliers: 3, label: ["glass", "cup"] });
    expect(blocks[1].suppliers).toBe(1);
  });

  it("não liga itens só por uma palavra comum entre muitas diferentes", () => {
    const blocks = suggestBlocks([
      item("1", "Steel lunch box insulated", "A"),
      item("2", "Steel kitchen knife", "B"),
    ]);
    expect(blocks).toEqual([]);
  });
});

describe("autocompletar", () => {
  it("valores distintos, sem repetir por acento ou caixa", () => {
    expect(
      searchSuggestions([
        "Glass cup",
        "glass CUP",
        "São Paulo",
        "sao paulo",
        "x",
        null,
      ]),
    ).toEqual(["Glass cup", "São Paulo"]);
  });
});

describe("itens não escolhidos do grupo", () => {
  const have = new Map([
    ["a", { id: "a" }],
    ["b", { id: "b" }],
    ["c", { id: "c" }],
  ]);
  const find = (id: string) => have.get(id);

  it("mantém a ordem dada, tira o ganhador e conta os que não existem mais", () => {
    expect(otherGroupItems(["c", "a", "b"], "a", find)).toEqual({
      rows: [{ id: "c" }, { id: "b" }],
      missing: 0,
    });
    // Item que não existe mais: contado, não some calado.
    expect(otherGroupItems(["a", "x", "b", "y"], "a", find)).toEqual({
      rows: [{ id: "b" }],
      missing: 2,
    });
  });

  it("id repetido conta uma vez; grupo só com o ganhador não tem outros", () => {
    expect(otherGroupItems(["a", "b", "b", "a", "x", "x"], "a", find)).toEqual({
      rows: [{ id: "b" }],
      missing: 1,
    });
    expect(otherGroupItems(["a"], "a", find)).toEqual({ rows: [], missing: 0 });
    expect(otherGroupItems([], "a", find)).toEqual({ rows: [], missing: 0 });
  });
});
