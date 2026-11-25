import { describe, expect, it } from "vitest";
import {
  SELECTION_DIMENSIONS,
  SELECTION_TABS,
  formatMeasure,
  lotMatchesFilters,
  otherGroupItems,
  parseGroupIds,
  parseSelectionFilters,
  parseSelectionTab,
  searchSuggestions,
  storedDecimals,
  suggestBlocks,
} from "@/lib/booking-selection";
import { compareKeys, sortKey } from "@/lib/table-tools";

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
      supplier: "Ningbo Home-In Import and Export Co., Ltd",
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
    // O Supplier do book pelo nome, sem pontuação nem "Co., Ltd.".
    expect(
      lotMatchesFilters(lot, {
        ...none,
        supplierId: "NINGBO HOME-IN IMPORT AND EXPORT",
      }),
    ).toBe(true);
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

/* Abas da tela (dono, 14/11/2026): Itens → Seleção → Blocos Sugeridos → Com
   Solicitação Aberta; o endereço escolhe a aba e, sem ela, fica Itens. */
describe("abas da Seleção de itens", () => {
  it("quatro abas, nesta ordem", () => {
    expect(SELECTION_TABS).toEqual([
      "items",
      "selection",
      "blocks",
      "requested",
    ]);
  });

  it("a aba do endereço; sem ela ou com um valor estranho, Itens", () => {
    expect(parseSelectionTab("selection")).toBe("selection");
    expect(parseSelectionTab("blocks")).toBe("blocks");
    expect(parseSelectionTab("requested")).toBe("requested");
    expect(parseSelectionTab(["blocks", "items"])).toBe("blocks");
    expect(parseSelectionTab(undefined)).toBe("items");
    expect(parseSelectionTab("")).toBe("items");
    expect(parseSelectionTab("outra")).toBe("items");
  });
});

describe("medidas em três colunas (Comprimento, Largura e Altura)", () => {
  /** As três células da linha, na ordem das colunas. */
  const cells = (
    dims: {
      lengthCm: number | null;
      widthCm: number | null;
      heightCm: number | null;
    },
    intl = "pt-BR",
  ) => SELECTION_DIMENSIONS.map((d) => formatMeasure(dims[d.field], intl));

  it("cada coluna lê o seu campo, na ordem da planilha (LENGTH, WIDTH, HEIGHT) e do cadastro", () => {
    expect(SELECTION_DIMENSIONS.map((d) => [d.key, d.field])).toEqual([
      ["length", "lengthCm"],
      ["width", "widthCm"],
      ["height", "heightCm"],
    ]);
    // Três valores diferentes: nenhum troca de coluna.
    expect(cells({ lengthCm: 12.5, widthCm: 8.5, heightCm: 9 })).toEqual([
      "12,5",
      "8,5",
      "9",
    ]);
  });

  it("vírgula decimal e as casas gravadas, sem arredondar nem completar", () => {
    expect(formatMeasure(8.3, "pt-BR")).toBe("8,3");
    expect(formatMeasure(20.125, "pt-BR")).toBe("20,125");
    expect(formatMeasure(0.05, "pt-BR")).toBe("0,05");
    expect(formatMeasure(7, "pt-BR")).toBe("7");
    expect(formatMeasure(1234.5, "pt-BR")).toBe("1.234,5");
    // Inglês e chinês: o separador do idioma, como nas outras colunas.
    expect(formatMeasure(20.125, "en-US")).toBe("20.125");
    expect(formatMeasure(8.3, "zh-CN")).toBe("8.3");
    // Casas da escrita mais curta; resto de conta não vira precisão.
    expect(storedDecimals(8.3)).toBe(1);
    expect(storedDecimals(1.5e-7)).toBe(8);
    expect(storedDecimals(1e21)).toBe(0);
    expect(formatMeasure(0.1 + 0.2, "pt-BR")).toBe("0,3");
  });

  it('medida ausente vira "—" só na coluna dela', () => {
    expect(cells({ lengthCm: 10, widthCm: null, heightCm: 20 })).toEqual([
      "10",
      "—",
      "20",
    ]);
    expect(cells({ lengthCm: null, widthCm: null, heightCm: null })).toEqual([
      "—",
      "—",
      "—",
    ]);
    expect(formatMeasure(undefined, "pt-BR")).toBe("—");
    expect(formatMeasure(Number.NaN, "pt-BR")).toBe("—");
  });

  it("a tabela ordena pelo número da célula, com os ausentes sempre no fim", () => {
    const values = [20.5, null, 8.3, 100, 9, 20.125, 1234.5];
    const order = (intl: string, desc: boolean) =>
      values
        .map((n) => formatMeasure(n, intl))
        .sort((a, b) =>
          compareKeys(
            sortKey(a, intl === "pt-BR"),
            sortKey(b, intl === "pt-BR"),
            desc,
          ),
        );
    expect(order("pt-BR", false)).toEqual([
      "8,3",
      "9",
      "20,125",
      "20,5",
      "100",
      "1.234,5",
      "—",
    ]);
    expect(order("pt-BR", true)).toEqual([
      "1.234,5",
      "100",
      "20,5",
      "20,125",
      "9",
      "8,3",
      "—",
    ]);
    expect(order("en-US", false)).toEqual([
      "8.3",
      "9",
      "20.125",
      "20.5",
      "100",
      "1,234.5",
      "—",
    ]);
  });
});
