import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/* Ficha sem conta à mão: total de caixas pela quantidade e CBM da caixa pelas medidas. */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const ps = await import("@/lib/services/product-sheet");
const { cartonTotalFor, withBoxCbm } =
  await import("@/lib/services/purchase-sheet-calc");
const { parseSheet } = await import("@/app/app/actions/sheet-form");
const { cbmFromDimensions } = await import("@/lib/logistics/cbm");
type User = import("@/lib/db").User;

let admin: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
});

describe("total de caixas do atalho Gerar programação", () => {
  const base = {
    lotsCartons: 0,
    masterCartonQty: 48,
    requested: [] as { quantity: number }[],
    unit: "un",
    target: { quantity: 5000, unit: "un" },
  };

  it("quantidade pedida ÷ peças por caixa, arredondado para cima", () => {
    expect(cartonTotalFor(base)).toEqual({
      source: "quantity",
      cartons: 105,
      quantity: 5000,
      perCarton: 48,
      pieces: 5040,
    });
    expect(
      cartonTotalFor({ ...base, target: { quantity: 4800, unit: "pcs" } }),
    ).toMatchObject({ cartons: 100, pieces: 4800 });
  });

  it("programação do cliente: cada uma arredondada para cima", () => {
    expect(
      cartonTotalFor({
        ...base,
        requested: [{ quantity: 3000 }, { quantity: 2000 }],
      }),
    ).toEqual({
      source: "requested",
      cartons: 63 + 42,
      quantity: 5000,
      perCarton: 48,
      pieces: 105 * 48,
    });
  });

  it("programações já preenchidas valem antes de tudo", () => {
    expect(cartonTotalFor({ ...base, lotsCartons: 80 })).toEqual({
      source: "lots",
      cartons: 80,
    });
  });

  it("sem peças por caixa: diz o que falta", () => {
    for (const masterCartonQty of [null, 0, 2.5])
      expect(cartonTotalFor({ ...base, masterCartonQty })).toEqual({
        source: "missing",
        need: "masterCartonQty",
      });
  });

  it("unidade que não conta peças (caixas, kg) ou sem quantidade: sem conta", () => {
    expect(
      cartonTotalFor({ ...base, target: { quantity: 100, unit: "cx" } }),
    ).toBeNull();
    expect(
      cartonTotalFor({
        ...base,
        unit: "kg",
        requested: [{ quantity: 50 }],
        target: { quantity: 50, unit: "kg" },
      }),
    ).toBeNull();
    expect(cartonTotalFor({ ...base, target: null })).toBeNull();
    expect(
      cartonTotalFor({ ...base, target: { quantity: 0, unit: "un" } }),
    ).toBeNull();
  });
});

describe("CBM da caixa master pelas medidas", () => {
  it("com as três medidas, o calculado substitui o digitado", () => {
    const patch: Record<string, unknown> = {
      heightCm: 30,
      widthCm: 40,
      lengthCm: 50,
      cbmPerCarton: 1,
    };
    withBoxCbm(patch);
    expect(patch.cbmPerCarton).toBe(0.06);
  });

  it("medida que não veio no salvamento vem da ficha", () => {
    const patch: Record<string, unknown> = { heightCm: 25 };
    withBoxCbm(patch, { heightCm: 30, widthCm: 40, lengthCm: 50 });
    expect(patch.cbmPerCarton).toBe(0.05);
  });

  it("faltando medida, fica o informado; sem mexer em medida nem CBM, nada muda", () => {
    const partial: Record<string, unknown> = {
      heightCm: 30,
      widthCm: null,
      cbmPerCarton: 0.08,
    };
    withBoxCbm(partial, { widthCm: 40, lengthCm: 50 });
    expect(partial.cbmPerCarton).toBe(0.08);
    const other: Record<string, unknown> = { price: 2 };
    withBoxCbm(other, { heightCm: 30, widthCm: 40, lengthCm: 50 });
    expect(other).toEqual({ price: 2 });
  });

  it("formulário: CBM ilegível não impede salvar quando há medidas", () => {
    const form = new FormData();
    form.set("cbmPerCarton", "0,06,5");
    form.set("heightCm", "30");
    form.set("widthCm", "40");
    form.set("lengthCm", "50");
    const { input, invalid } = parseSheet(form);
    expect(input.cbmPerCarton).toBe(0.06);
    expect(invalid).not.toContain("cbmPerCarton");
    // Sem medidas, o CBM ilegível continua apontado.
    const only = new FormData();
    only.set("cbmPerCarton", "0,06,5");
    expect(parseSheet(only).invalid).toContain("cbmPerCarton");
  });

  it("medida que arredonda para 0 m³ (digitada em metros) não troca o CBM informado", () => {
    expect(cbmFromDimensions(0.5, 0.4, 0.3)).toBeNull();
    const patch: Record<string, unknown> = {
      heightCm: 0.3,
      widthCm: 0.4,
      lengthCm: 0.5,
      cbmPerCarton: 0.06,
    };
    withBoxCbm(patch);
    expect(patch.cbmPerCarton).toBe(0.06);
  });

  it("completar o cadastro (fill) não troca o CBM nem mistura caixas", async () => {
    const store = getStore();
    // Produto com CBM informado e sem medidas da caixa, sem ficha mestre.
    await store.update("products", "prod-panela", {
      cbm: 0.065,
      boxHeightCm: null,
      boxWidthCm: null,
      boxLengthCm: null,
    });
    const box = { heightCm: 30, widthCm: 40, lengthCm: 50, cbmPerCarton: 0.06 };
    for (const supplier of ["fornecedor-a", "fornecedor-b"]) {
      const filled = await ps.completeMasterFromSheet(
        admin,
        "prod-panela",
        { ...box, material: "AÇO" },
        supplier,
        "fill",
      );
      expect(filled).not.toContain("heightCm");
      expect(filled).not.toContain("cbmPerCarton");
    }
    const product = await store.get("products", "prod-panela");
    expect(product?.cbm).toBe(0.065);
    expect(product?.boxLengthCm ?? null).toBeNull();
    // Adotar (Wellmix, fornecedor principal) troca a caixa inteira.
    await ps.completeMasterFromSheet(
      admin,
      "prod-panela",
      box,
      "fornecedor-a",
      "adopt",
    );
    const adopted = await store.get("products", "prod-panela");
    expect(adopted?.cbm).toBe(0.06);
    expect(adopted?.boxLengthCm).toBe(50);
  });

  it("completar termina uma caixa pela metade com a mesma caixa, sem misturar outra", async () => {
    const store = getStore();
    // Sem ficha mestre: o cadastro tem altura e largura, sem comprimento nem CBM.
    await store.update("products", "prod-boneca", {
      cbm: null,
      boxHeightCm: 30,
      boxWidthCm: 40,
      boxLengthCm: null,
    });
    // Outra caixa (altura diferente): nada muda.
    const other = await ps.completeMasterFromSheet(
      admin,
      "prod-boneca",
      { heightCm: 35, widthCm: 40, lengthCm: 50 },
      "fornecedor-c",
      "fill",
    );
    expect(other).not.toContain("lengthCm");
    // Só o comprimento (caixa pela metade na ficha): nada muda.
    const half = await ps.completeMasterFromSheet(
      admin,
      "prod-boneca",
      { lengthCm: 50 },
      "fornecedor-c",
      "fill",
    );
    expect(half).not.toContain("lengthCm");
    expect((await store.get("products", "prod-boneca"))?.cbm ?? null).toBeNull();
    // A mesma caixa inteira: completa o comprimento e o CBM sai das medidas.
    const same = await ps.completeMasterFromSheet(
      admin,
      "prod-boneca",
      { heightCm: 30, widthCm: 40, lengthCm: 50 },
      "fornecedor-c",
      "fill",
    );
    expect(same).toContain("lengthCm");
    const product = await store.get("products", "prod-boneca");
    expect(product?.boxLengthCm).toBe(50);
    expect(product?.cbm).toBe(0.06);
  });

  it("ficha mestre: grava o calculado na ficha e no cadastro do produto", async () => {
    const { sheet } = await ps.saveProductSheet(admin, "prod-jarra", {
      heightCm: 30,
      widthCm: 40,
      lengthCm: 50,
      cbmPerCarton: 1,
    });
    expect(sheet.cbmPerCarton).toBe(0.06);
    const product = await getStore().get("products", "prod-jarra");
    expect(product?.cbm).toBe(0.06);
    // Só uma medida muda: o CBM acompanha com as outras duas da ficha.
    const again = await ps.saveProductSheet(admin, "prod-jarra", {
      heightCm: 25,
    });
    expect(again.sheet.cbmPerCarton).toBe(0.05);
  });
});
