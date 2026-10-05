import { describe, expect, it } from "vitest";
import {
  MAX_PANTONE_PER_SHEET,
  PANTONE_SCALES,
  allPantone,
  findPantone,
  hexToRgb,
  pantoneLabel,
  parsePantoneRefs,
  searchPantone,
} from "@/lib/pantone";

/* Tabela Pantone → RGB da ficha de compra: integridade, busca e leitura do campo. */

describe("tabela", () => {
  it("tem todas as escalas, códigos únicos e hex válido", () => {
    const all = allPantone();
    expect(all.length).toBeGreaterThan(5000);
    const codes = new Set(all.map((c) => c.code.toUpperCase()));
    expect(codes.size).toBe(all.length);
    for (const c of all) {
      expect(c.hex).toMatch(/^#[0-9a-f]{6}$/);
      expect(PANTONE_SCALES).toContain(c.scale);
      expect(c.code.length).toBeGreaterThan(0);
    }
    const byScale = Object.fromEntries(
      PANTONE_SCALES.map((s) => [s, all.filter((c) => c.scale === s).length]),
    );
    expect(byScale.C).toBeGreaterThan(1000);
    expect(byScale.U).toBeGreaterThan(1000);
    expect(byScale.M).toBeGreaterThan(200);
    expect(byScale.P).toBeGreaterThan(100);
    expect(byScale.TCX).toBeGreaterThan(2000);
  });

  it("valores de referência conhecidos (sRGB publicado pela Pantone)", () => {
    expect(findPantone("185 C")?.hex).toBe("#e4002b");
    expect(findPantone("Process Blue C")?.hex).toBe("#0085ca");
    expect(findPantone("Reflex Blue C")?.hex).toBe("#001489");
    expect(findPantone("Yellow C")?.hex).toBe("#fedd00");
    expect(findPantone("Black C")?.hex).toBe("#2d2926");
    expect(findPantone("Cool Gray 11 C")?.hex).toBe("#53565a");
    expect(findPantone("19-4052 TCX")?.name).toBe("Classic Blue");
    expect(hexToRgb("#e4002b")).toEqual([228, 0, 43]);
    expect(pantoneLabel({ code: "185 C" })).toBe("PANTONE 185 C");
  });

  it("acha por código sem diferenciar maiúsculas e espaços", () => {
    expect(findPantone("185 c")?.code).toBe("185 C");
    expect(findPantone("  cool   gray 11 u ")?.code).toBe("Cool Gray 11 U");
    expect(findPantone("nada")).toBeNull();
  });
});

describe("busca", () => {
  it("número casa pelo início do código; nome por texto; filtro por escala", () => {
    const n = searchPantone("185");
    expect(n[0].code).toBe("185 C");
    expect(n.some((c) => c.code === "185 U")).toBe(true);
    expect(
      n.every((c) => c.code.startsWith("185") || c.code.includes("185")),
    ).toBe(true);
    const reflex = searchPantone("reflex");
    expect(reflex.map((c) => c.code)).toContain("Reflex Blue C");
    const tcx = searchPantone("blue", "TCX", 10);
    expect(tcx.length).toBe(10);
    expect(tcx.every((c) => c.scale === "TCX")).toBe(true);
    expect(searchPantone("", "M", 5).every((c) => c.scale === "M")).toBe(true);
    expect(searchPantone("zzzz")).toEqual([]);
  });
});

describe("campo da ficha", () => {
  it("lê o JSON do seletor, usa o hex da tabela e ignora repetidos", () => {
    const refs = parsePantoneRefs(
      JSON.stringify([
        { code: "185 c", hex: "#000000" },
        "Black C",
        { code: "185 C", hex: "#e4002b" },
      ]),
    );
    expect(refs).toEqual([
      { code: "185 C", hex: "#e4002b" },
      { code: "Black C", hex: "#2d2926" },
    ]);
  });

  it("vazio vira nulo; código desconhecido só com hex válido; lixo é recusado", () => {
    expect(parsePantoneRefs("")).toBeNull();
    expect(parsePantoneRefs("[]")).toBeNull();
    expect(parsePantoneRefs(null)).toBeNull();
    expect(
      parsePantoneRefs(JSON.stringify([{ code: "9999 X", hex: "#ABCDEF" }])),
    ).toEqual([{ code: "9999 X", hex: "#abcdef" }]);
    expect(() => parsePantoneRefs(JSON.stringify(["9999 X"]))).toThrow(
      "invalid_input",
    );
    expect(() =>
      parsePantoneRefs(JSON.stringify([{ code: "<b>", hex: "#abcdef" }])),
    ).toThrow("invalid_input");
    expect(() => parsePantoneRefs("{")).toThrow("invalid_input");
    expect(() => parsePantoneRefs(JSON.stringify([1]))).toThrow(
      "invalid_input",
    );
    const many = allPantone()
      .slice(0, MAX_PANTONE_PER_SHEET + 1)
      .map((c) => c.code);
    expect(() => parsePantoneRefs(JSON.stringify(many))).toThrow(
      "pantone_too_many",
    );
  });
});
