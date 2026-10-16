import { describe, expect, it } from "vitest";
import { parseNumberInput } from "@/lib/number-input";
import { parseSheet } from "@/app/app/actions/sheet-form";

/* A ficha nunca perde o que foi digitado: números como as pessoas digitam e campo ilegível não derruba o resto. */

describe("parseNumberInput", () => {
  it("lê os formatos do Brasil, dos EUA e da China", () => {
    expect(parseNumberInput("1.000", { int: true })).toBe(1000);
    expect(parseNumberInput("1,000", { int: true })).toBe(1000);
    expect(parseNumberInput("1.000.000", { int: true })).toBe(1000000);
    expect(parseNumberInput("1.234,56")).toBe(1234.56);
    expect(parseNumberInput("1,234.56")).toBe(1234.56);
    expect(parseNumberInput("0,050")).toBe(0.05);
    expect(parseNumberInput("0.050")).toBe(0.05);
    expect(parseNumberInput("1,5")).toBe(1.5);
    expect(parseNumberInput(" 24 ")).toBe(24);
  });

  it("ignora a unidade no fim e espaços", () => {
    expect(parseNumberInput("0,4 kg")).toBe(0.4);
    expect(parseNumberInput("24 pcs", { int: true })).toBe(24);
    expect(parseNumberInput("24个", { int: true })).toBe(24);
    expect(parseNumberInput("45 dias", { int: true })).toBe(45);
    expect(parseNumberInput("0,06 m³")).toBe(0.06);
    expect(parseNumberInput("1 000", { int: true })).toBe(1000);
  });

  it("vazio é nulo; o que não é número é NaN", () => {
    expect(parseNumberInput("")).toBeNull();
    expect(parseNumberInput("   ")).toBeNull();
    expect(parseNumberInput(null)).toBeNull();
    expect(parseNumberInput("abc")).toBeNaN();
    expect(parseNumberInput("1.2.3,4.5")).toBeNaN();
    // Decimal com um ponto num campo inteiro não vira milhar.
    expect(parseNumberInput("1.5", { int: true })).toBe(1.5);
  });
});

const formOf = (fields: Record<string, string>) => {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  return form;
};

describe("parseSheet", () => {
  it("campo ilegível fica de fora e é apontado; o resto é lido", () => {
    const { input, invalid } = parseSheet(
      formOf({
        supplierName: "Shenzhen Supplier A",
        moq: "1.000",
        masterCartonQty: "24 pcs",
        netWeightPcKg: "0,4 kg",
        grossWeightPcKg: "meio quilo",
        cbmPerCarton: "0,050",
        colorAssortment: "BRANCO",
        material: "PVC",
        ncm: "9503-00-21",
      }),
    );
    expect(invalid).toEqual(["grossWeightPcKg"]);
    expect(input).toMatchObject({
      supplierName: "Shenzhen Supplier A",
      moq: 1000,
      masterCartonQty: 24,
      netWeightPcKg: 0.4,
      cbmPerCarton: 0.05,
      colorAssortment: "BRANCO",
      material: "PVC",
      ncm: "95030021",
    });
    expect("grossWeightPcKg" in input).toBe(false);
  });

  it("número inteiro com fração e texto longo demais são apontados, não derrubam a ficha", () => {
    const { input, invalid } = parseSheet(
      formOf({
        moq: "10,5",
        location: "x".repeat(200),
        material: "VIDRO",
      }),
    );
    expect(invalid.sort()).toEqual(["location", "moq"]);
    expect(input).toEqual({ material: "VIDRO" });
  });

  it("programação: uma linha ilegível não apaga as outras (a programação fica como estava)", () => {
    const form = formOf({
      lot1Interval: "45",
      lot1Cartons: "1.000",
      lot2Interval: "45",
      lot2Cartons: "vinte",
    });
    const { input, invalid } = parseSheet(form);
    expect(invalid).toEqual(["lots"]);
    expect(input.lots).toBeUndefined();
    const ok = parseSheet(
      formOf({ lot1Interval: "45 dias", lot1Cartons: "1.000" }),
    );
    expect(ok.invalid).toEqual([]);
    expect(ok.input.lots?.[0]).toEqual({
      departureIntervalDays: 45,
      masterCartons: 1000,
    });
  });

  it("campo vazio limpa; campo ausente não mexe", () => {
    const { input } = parseSheet(formOf({ moq: "", ncm: "" }));
    expect(input).toEqual({ moq: null, ncm: null });
  });
});
