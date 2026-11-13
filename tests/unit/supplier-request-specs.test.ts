import { describe, expect, it } from "vitest";
import type { SupplierRequestItem } from "@/lib/db/schema";
import {
  requestBookSpecsOf,
  requestItemSpecs,
} from "@/lib/supplier-request-specs";

/*
 * Ficha técnica da tabela "Produtos desta solicitação"
 * (docs/SUPPLIER_REQUESTS.md, "Ficha técnica na tabela"): vale a cópia da
 * solicitação; o que falta vem do item exato do Book; totais só com dados.
 */
const empty: SupplierRequestItem = {
  itemNumber: null,
  factoryItemCode: null,
  productName: null,
  description: null,
  incoterm: null,
  currency: null,
  price: null,
  masterCartonQty: null,
  innerQty: null,
  netWeightPcKg: null,
  grossWeightPcKg: null,
  cbmPerCarton: null,
  lengthCm: null,
  widthCm: null,
  heightCm: null,
  capacityMl: null,
  packageType: null,
  material: null,
  moq: null,
  colorAssortment: null,
  powerDetail: null,
  photoDocumentId: null,
};
const full: SupplierRequestItem = {
  ...empty,
  description: "GARRAFA 500ML",
  masterCartonQty: 36,
  innerQty: 12,
  netWeightPcKg: 0.2,
  grossWeightPcKg: 0.25,
  cbmPerCarton: 0.05,
  lengthCm: 7,
  widthCm: 7,
  heightCm: 22,
  capacityMl: 500,
  packageType: "COLOR BOX",
  material: "PS+PVC",
  colorAssortment: "AZUL / ROSA",
};

describe("requestItemSpecs", () => {
  it("item completo: usa a cópia e calcula caixas e cubagem do total", () => {
    const s = requestItemSpecs({ item: full, quantity: 5000, schedule: null });
    expect(s.masterCartonQty).toBe(36);
    expect(s.innerQty).toBe(12);
    expect(s.capacity).toBe(500);
    expect(s.fromBook).toEqual([]);
    // 5000 / 36 = 138,9 → 139 caixas inteiras × 0,05 m³.
    expect(s.totalCartons).toBe(139);
    expect(s.totalCbm).toBe(6.95);
    expect(s.cbmFromMeasures).toBe(false);
  });

  it("a cópia vence o Book; só o que falta vem do item exato do Book", () => {
    const s = requestItemSpecs(
      {
        item: { ...empty, description: "PORTA-RETRATO", masterCartonQty: 24 },
        quantity: 240,
        schedule: null,
      },
      { masterCartonQty: 48, sizeText: "8X10", packageType: "PVC BOX" },
    );
    expect(s.masterCartonQty).toBe(24);
    expect(s.capacity).toBe("8X10");
    expect(s.packageType).toBe("PVC BOX");
    expect(s.fromBook).toEqual(["sizeText", "packageType"]);
    // Sem CBM nem medidas: as caixas saem, a cubagem não.
    expect(s.totalCartons).toBe(10);
    expect(s.totalCbm).toBeNull();
  });

  it("item antigo sem dados: nada inventado", () => {
    const s = requestItemSpecs({ item: empty, quantity: 100, schedule: null });
    expect(s.capacity).toBeNull();
    expect(s.totalCartons).toBeNull();
    expect(s.totalCbm).toBeNull();
    expect(s.cbmFromMeasures).toBe(false);
  });

  it("sem CBM informado, a cubagem vem das medidas (regra da seleção)", () => {
    const s = requestItemSpecs({
      item: {
        ...empty,
        masterCartonQty: 10,
        lengthCm: 50,
        widthCm: 40,
        heightCm: 30,
      },
      quantity: 100,
      schedule: null,
    });
    expect(s.cbmPerCarton).toBeNull();
    expect(s.totalCartons).toBe(10);
    expect(s.totalCbm).toBe(0.6);
    expect(s.cbmFromMeasures).toBe(true);
  });

  it("com rodadas, cada rodada fecha as suas caixas inteiras", () => {
    const schedule = {
      items: [{ quantity: 50 }, { quantity: 50 }],
    } as never;
    const s = requestItemSpecs({ item: full, quantity: 100, schedule });
    // 50 / 36 → 2 caixas por rodada (uma conta só daria 3).
    expect(s.totalCartons).toBe(4);
    expect(s.totalCbm).toBe(0.2);
  });

  it("do Book só sai a ficha técnica (sem preço nem análise)", () => {
    const specs = requestBookSpecsOf({
      ...full,
      price: 9,
      analysis: { costBrl: 1 },
      ncm: "39241000",
    } as never);
    expect(specs.ncm).toBe("39241000");
    expect(specs.masterCartonQty).toBe(36);
    expect("price" in specs).toBe(false);
    expect("analysis" in specs).toBe(false);
  });
});
