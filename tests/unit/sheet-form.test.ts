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

  it("grandeza ou letra colada no número não é lida (não vira um número menor)", () => {
    for (const raw of ["2 mil", "10k", "1万", "5千", "5OO", "2O", "3x"])
      expect(parseNumberInput(raw, { int: true })).toBeNaN();
    expect(parseNumberInput("12 cx", { int: true })).toBe(12);
    expect(parseNumberInput("1.000 ml", { int: true })).toBe(1000);
    expect(parseNumberInput("2,50 USD")).toBe(2.5);
    expect(parseNumberInput("18%")).toBe(18);
    expect(parseNumberInput("30 套", { int: true })).toBe(30);
    // Notação de fornecedor: unidade composta, contadores chineses, 日.
    expect(parseNumberInput("50 pcs/ctn", { int: true })).toBe(50);
    expect(parseNumberInput("50件/箱", { int: true })).toBe(50);
    expect(parseNumberInput("0,4 kg/pc")).toBe(0.4);
    expect(parseNumberInput("0,06 cbm/ctn")).toBe(0.06);
    expect(parseNumberInput("1000片", { int: true })).toBe(1000);
    expect(parseNumberInput("30日", { int: true })).toBe(30);
    expect(parseNumberInput("50 g/pc")).toBeNaN();
    // Unidade que mudaria o tamanho do número no campo: apontado.
    for (const raw of ["50g", "300 mm", "0,3 m", "1 l"])
      expect(parseNumberInput(raw)).toBeNaN();
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

  it("programação ilegível: as peças por caixa também não mudam (a quantidade do pedido não muda pela metade)", () => {
    const { input, invalid } = parseSheet(
      formOf({
        masterCartonQty: "30",
        lot1Interval: "45",
        lot1Cartons: "20",
        lot2Interval: "45",
        lot2Cartons: "vinte",
      }),
    );
    expect(invalid.sort()).toEqual(["lots", "masterCartonQty"]);
    expect(input.lots).toBeUndefined();
    expect(input.masterCartonQty).toBeUndefined();
  });

  it("NCM com vírgula vale como com ponto", () => {
    expect(parseSheet(formOf({ ncm: "9503,00,21" })).input).toEqual({
      ncm: "9503.00.21",
    });
  });

  it("capacidade em ml: 1.000 ml é mil; fração continua valendo", () => {
    expect(parseSheet(formOf({ capacityMl: "1.000 ml" })).input).toEqual({
      capacityMl: 1000,
    });
    expect(parseSheet(formOf({ capacityMl: "7,5" })).input).toEqual({
      capacityMl: 7.5,
    });
    expect(parseSheet(formOf({ capacityMl: "0.5 ml" })).input).toEqual({
      capacityMl: 0.5,
    });
  });

  it("campo vazio limpa; campo ausente não mexe", () => {
    const { input } = parseSheet(formOf({ moq: "", ncm: "" }));
    expect(input).toEqual({ moq: null, ncm: null });
  });
});
