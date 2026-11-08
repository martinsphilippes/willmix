import { describe, expect, it } from "vitest";
import { itemLogistics, logisticsTotals } from "@/lib/services/item-logistics";

/* Conta de cadastro e carga do item: a mesma na folha do fornecedor e em Pedidos. */

const product = {
  sku: "BRQ-001",
  supplierSku: "F-123",
  specification: "Plástico ABS",
  color: "Vermelho",
  masterBoxQty: 12,
  cbm: 0.05,
  grossWeightKg: 0.5,
};

describe("itemLogistics", () => {
  it("usa o cadastro do produto: caixas arredondam para cima, volume por caixa e peso por unidade", () => {
    expect(itemLogistics({ quantity: 100, product })).toEqual({
      sku: "BRQ-001",
      supplierSku: "F-123",
      specification: "Plástico ABS",
      color: "Vermelho",
      unitsPerBox: 12,
      boxes: 9,
      cbm: 0.45,
      weightKg: 50,
    });
  });

  it("a variação escolhida vale antes do cadastro; a especificação da solicitação também", () => {
    const l = itemLogistics({
      quantity: 48,
      product,
      variant: {
        factoryItemCode: "V-8X10",
        masterBoxQty: 24,
        cbm: 0.1,
        grossWeightKg: 0.25,
        colorAssortment: "Sortido",
      },
      specification: "8x10 com moldura",
    });
    expect(l).toMatchObject({
      sku: "BRQ-001",
      supplierSku: "V-8X10",
      specification: "8x10 com moldura",
      color: "Sortido",
      unitsPerBox: 24,
      boxes: 2,
      cbm: 0.2,
      weightKg: 12,
    });
  });

  it("variação sem o dado cai no cadastro do produto", () => {
    const l = itemLogistics({
      quantity: 24,
      product,
      variant: {
        factoryItemCode: null,
        masterBoxQty: null,
        cbm: null,
        grossWeightKg: null,
        colorAssortment: null,
      },
      specification: null,
    });
    expect(l).toMatchObject({
      supplierSku: "F-123",
      specification: "Plástico ABS",
      color: "Vermelho",
      unitsPerBox: 12,
      boxes: 2,
      cbm: 0.1,
      weightKg: 12,
    });
  });

  it("sem produto e sem variação: nada inventado", () => {
    expect(itemLogistics({ quantity: 10, product: null })).toEqual({
      sku: null,
      supplierSku: null,
      specification: null,
      color: null,
      unitsPerBox: null,
      boxes: 0,
      cbm: null,
      weightKg: null,
    });
  });
});

describe("logisticsTotals", () => {
  const line = (
    quantity: number,
    unit: string,
    p: typeof product | null,
    amount: number | null = null,
    currency: string | null = null,
  ) => ({
    quantity,
    unit,
    logistics: itemLogistics({ quantity, product: p }),
    amount,
    currency,
  });

  it("soma peso, caixas, volume, quantidade e valor por moeda", () => {
    const t = logisticsTotals([
      line(100, "un", product, 200, "USD"),
      line(24, "un", product, 48, "USD"),
      line(10, "un", product, 30, "CNY"),
    ]);
    expect(t).toEqual({
      weightKg: 67,
      boxes: 9 + 2 + 1,
      cbm: 0.6,
      quantity: { value: 134, unit: "un" },
      amounts: { USD: 248, CNY: 30 },
    });
  });

  it("dado que nenhum item tem fica nulo; quantidade só soma na mesma unidade", () => {
    const t = logisticsTotals([
      line(10, "un", null),
      line(5, "kg", null, 12.5, "USD"),
    ]);
    expect(t.weightKg).toBeNull();
    expect(t.boxes).toBeNull();
    expect(t.cbm).toBeNull();
    expect(t.quantity).toBeNull();
    expect(t.amounts).toEqual({ USD: 12.5 });
  });

  it("item sem cadastro de caixa não entra na soma de caixas", () => {
    const t = logisticsTotals([line(100, "un", product), line(7, "un", null)]);
    expect(t.boxes).toBe(9);
    expect(t.weightKg).toBe(50);
    expect(t.quantity).toEqual({ value: 107, unit: "un" });
  });
});
