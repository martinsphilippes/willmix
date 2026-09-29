import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  boxesFor,
  cbmFromDimensions,
  commercialSplit,
  containerUsage,
  divergencePercent,
  resolveCbm,
} from "@/lib/logistics/cbm";
import { listSheets, readSheet } from "@/lib/services/xlsx";

describe("CBM e container", () => {
  it("calcula m³ a partir de cm e prioriza o CBM informado", () => {
    expect(cbmFromDimensions(50, 40, 30)).toBe(0.06);
    expect(cbmFromDimensions(50, 0, 30)).toBeNull();
    expect(
      resolveCbm({ cbm: 0.07, lengthCm: 50, widthCm: 40, heightCm: 30 }),
    ).toBe(0.07);
    expect(resolveCbm({ lengthCm: 50, widthCm: 40, heightCm: 30 })).toBe(0.06);
  });

  it("ocupação é determinística e configurável pela capacidade", () => {
    const items = [
      { boxCount: 100, cbmPerBox: 0.06, weightPerBoxKg: 12, orderId: "o1" },
      { boxCount: 50, cbmPerBox: 0.08, weightPerBoxKg: 10, orderId: null },
    ];
    const usage = containerUsage(items, 68, 26500);
    expect(usage.totalCbm).toBe(10);
    expect(usage.occupancyPercent).toBe(14.7);
    expect(usage.totalWeightKg).toBe(1700);
    expect(usage.overCapacity).toBe(false);
    expect(containerUsage(items, 8, null).overCapacity).toBe(true);
    expect(boxesFor(1200, 48)).toBe(25);
    expect(boxesFor(1200, null)).toBe(0);
  });

  it("separa vendido de disponível pelo vínculo com pedido", () => {
    const split = commercialSplit([
      { boxCount: 100, cbmPerBox: 0.06, orderId: "o1" },
      { boxCount: 50, cbmPerBox: 0.08, orderId: null },
    ]);
    expect(split.soldCbm).toBe(6);
    expect(split.availableCbm).toBe(4);
    expect(split.soldPercent).toBe(60);
    expect(split.availablePercent).toBe(40);
  });

  it("divergência relativa", () => {
    expect(divergencePercent(200, 150)).toBe(25);
    expect(divergencePercent(0, 150)).toBeNull();
    expect(divergencePercent(null, 1)).toBeNull();
  });
});

describe("leitor XLSX", () => {
  const bytes = new Uint8Array(
    readFileSync("tests/fixtures/produtos-china.xlsx"),
  );

  it("lista planilhas e lê cabeçalhos em chinês, textos e números", () => {
    expect(listSheets(bytes)).toEqual(["产品"]);
    const sheet = readSheet(bytes);
    expect(sheet.name).toBe("产品");
    expect(sheet.headers.slice(0, 4)).toEqual([
      "产品名称",
      "供应商",
      "单价",
      "起订量",
    ]);
    expect(sheet.rows).toHaveLength(2);
    expect(sheet.rows[0]["产品名称"]).toBe("陶瓷马克杯 350ml");
    expect(sheet.rows[0]["单价"]).toBe("2.35");
    expect(sheet.rows[0]["起订量"]).toBe("3000");
    expect(sheet.rows[1]["材质"]).toBe("不锈钢");
    expect(sheet.rows[1]["供应商编号"]).toBe("TH-500");
  });
});
