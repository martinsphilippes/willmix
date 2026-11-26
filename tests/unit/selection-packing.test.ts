import { describe, expect, it } from "vitest";
import {
  alteredCbm,
  artKey,
  checkPacking,
  cleanVariation,
  comboKey,
  packCombos,
  packOptions,
  packSku,
  piecesToPacks,
  skuItemOf,
  splitPacking,
  trivialPacking,
} from "@/lib/selection-packing";
import type { SupplierRequestItem } from "@/lib/db/schema";

/* Embalagens e variações do vencedor (dono, 26/11/2026). */

const item: SupplierRequestItem = {
  itemNumber: "1",
  factoryItemCode: "COPO-500",
  productName: null,
  description: "Copo térmico 500 ml",
  incoterm: "FOB",
  currency: "RMB",
  price: 10.5,
  masterCartonQty: 48,
  innerQty: 12,
  netWeightPcKg: 0.2,
  grossWeightPcKg: 0.25,
  cbmPerCarton: 0.12,
  lengthCm: 50,
  widthCm: 40,
  heightCm: 60,
  capacityMl: 500,
  packageType: "Caixa",
  material: "Inox",
  moq: 1000,
  colorAssortment: "AZUL / ROSA",
  powerDetail: null,
  photoDocumentId: null,
};

describe("Alterar a Qtd/caixa", () => {
  it("o CBM acompanha na proporção: CBM × x1 ÷ x0", () => {
    expect(alteredCbm(0.12, 48, 24)).toBe(0.06);
    expect(alteredCbm(0.12, 48, 60)).toBe(0.15);
    // Sem CBM ou sem a caixa original, fica como estava.
    expect(alteredCbm(null, 48, 24)).toBeNull();
    expect(alteredCbm(0.12, null, 24)).toBe(0.12);
  });
});

describe("embalagens novas", () => {
  it("preço × N, caixa ÷ N e MOQ ÷ N para cima", () => {
    expect(packSku({ price: 10.5, moq: 1000, cbm: 0.12 }, 48, 3)).toEqual({
      price: 31.5,
      cartonQty: 16,
      moq: 334,
      cbm: 0.12,
    });
    expect(packSku({ price: null, moq: null, cbm: null }, 48, 2)).toEqual({
      price: null,
      cartonQty: 24,
      moq: null,
      cbm: null,
    });
  });

  it("a tabela pai conta como opção só com o toggle (ou sem embalagem nova)", () => {
    expect(packOptions({ packs: [], parentOption: false })).toEqual([
      { units: 1, parent: true },
    ]);
    expect(packOptions({ packs: [2, 4], parentOption: false })).toEqual([
      { units: 2, parent: false },
      { units: 4, parent: false },
    ]);
    expect(packOptions({ packs: [2], parentOption: true })).toEqual([
      { units: 1, parent: true },
      { units: 2, parent: false },
    ]);
  });

  it("confere a caixa e as embalagens", () => {
    const base = {
      carton: null,
      packs: [] as number[],
      parentOption: true,
      mix: false,
      variations: [],
    };
    expect(checkPacking({ ...base, packs: [3] }, 48)).toEqual({
      ok: true,
      carton: 48,
    });
    expect(checkPacking({ ...base, packs: [5] }, 48)).toEqual({
      ok: false,
      error: "selection_pack_divide",
    });
    // A caixa alterada é a que vale para dividir.
    expect(checkPacking({ ...base, carton: 50, packs: [5] }, 48)).toEqual({
      ok: true,
      carton: 50,
    });
    expect(checkPacking({ ...base, packs: [1] }, 48)).toEqual({
      ok: false,
      error: "selection_pack_units",
    });
    expect(checkPacking({ ...base, packs: [2, 2] }, 48)).toEqual({
      ok: false,
      error: "selection_pack_repeat",
    });
    expect(checkPacking({ ...base, carton: 0 }, 48)).toEqual({
      ok: false,
      error: "selection_pack_carton",
    });
    expect(
      checkPacking(
        {
          ...base,
          variations: [
            { label: "Azul", custom: false },
            { label: "azul", custom: true },
          ],
        },
        48,
      ),
    ).toEqual({ ok: false, error: "selection_variation_repeat" });
  });
});

describe("variação × embalagem", () => {
  const variations = [
    { label: "AZUL", custom: false },
    { label: "Preto fosco", custom: true },
  ];

  it("uma combinação por variação e embalagem, variação por variação", () => {
    const combos = packCombos(
      variations,
      packOptions({ packs: [3], parentOption: true }),
    );
    expect(combos.map((c) => c.key)).toEqual([
      "AZUL|1",
      "AZUL|3",
      "Preto fosco|1",
      "Preto fosco|3",
    ]);
    // Sem variação: uma linha por embalagem.
    expect(
      packCombos([], packOptions({ packs: [], parentOption: true })),
    ).toEqual([{ key: "|1", variation: null, units: 1 }]);
  });

  it("com o Mix de cores, a imagem é da embalagem", () => {
    expect(artKey(false, "AZUL", 3)).toBe("AZUL|3");
    expect(artKey(true, "AZUL", 3)).toBe("|3");
    expect(comboKey(null, 1)).toBe("|1");
  });

  it("as peças se dividem em caixas inteiras da caixa final", () => {
    const combos = packCombos(
      variations,
      packOptions({ packs: [3], parentOption: true }),
    );
    // 8 caixas de 24 peças em 2 datas, 4 combinações: 2 caixas cada.
    const r = splitPacking({ rounds: [96, 96], combos, carton: 24 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rows.map((x) => x.quantity)).toEqual([48, 48, 48, 48]);
    expect(r.rows.every((x) => x.quantity % 24 === 0)).toBe(true);
    // Caixas digitadas por combinação.
    const typed = splitPacking({
      rounds: [192],
      combos,
      carton: 24,
      cartons: {
        "AZUL|1": 5,
        "AZUL|3": 1,
        "Preto fosco|1": 1,
        "Preto fosco|3": 1,
      },
    });
    expect(typed.ok && typed.rows.map((x) => x.quantity)).toEqual([
      120, 24, 24, 24,
    ]);
    // Embalagens de 3: 24 peças = 8 embalagens.
    expect(piecesToPacks(24, 3)).toBe(8);
  });

  it("a cópia do item do SKU vem em embalagens", () => {
    const sku = skuItemOf(
      item,
      { carton: 24, cbm: 0.06 },
      { variation: "Preto fosco", units: 3 },
    );
    expect(sku).toMatchObject({
      price: 31.5,
      masterCartonQty: 8,
      moq: 334,
      cbmPerCarton: 0.06,
      innerQty: 4,
      netWeightPcKg: 0.6,
      grossWeightPcKg: 0.75,
      colorAssortment: "Preto fosco",
    });
    // Sem alteração, a caixa e o CBM são os do item.
    expect(
      skuItemOf(
        item,
        { carton: null, cbm: null },
        { variation: null, units: 1 },
      ),
    ).toMatchObject({
      price: 10.5,
      masterCartonQty: 48,
      cbmPerCarton: 0.12,
      colorAssortment: "AZUL / ROSA",
    });
  });

  it("texto livre sem o separador da chave", () => {
    expect(cleanVariation("  Preto |  fosco ")).toBe("Preto / fosco");
  });

  it("uma linha só, sem nada mudado, é o fluxo de sempre", () => {
    const base = {
      carton: null,
      cbm: null,
      packs: [],
      parentOption: true,
      mix: false,
      variations: [],
      lines: [
        {
          key: "|1",
          variation: null,
          units: 1,
          quantity: 480,
          rounds: [480],
          artDocumentId: null,
        },
      ],
    };
    expect(trivialPacking(base, 0)).toBe(true);
    expect(trivialPacking({ ...base, carton: 24 }, 0)).toBe(false);
    expect(
      trivialPacking(
        { ...base, lines: [{ ...base.lines[0], artDocumentId: "doc1" }] },
        0,
      ),
    ).toBe(false);
    // Uma cor das duas do Book: a variação diz qual (não é trivial).
    const one = { ...base, variations: [{ label: "AZUL", custom: false }] };
    expect(trivialPacking(one, 1)).toBe(true);
    expect(trivialPacking(one, 2)).toBe(false);
  });
});
