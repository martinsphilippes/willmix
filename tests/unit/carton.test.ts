import { describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Caixa master, inner e embalagem: opções que fecham a master, conferência da
 * inner, caixa grande demais, cor no lugar do tipo de embalagem, "Sem caixa
 * inner" (0) na inspeção e os textos nas três línguas.
 */
withTempStore();

const carton = await import("@/lib/carton");
const {
  compareWithSnapshot,
  compareReferenceMeasure,
  summarizeResult,
  expectedText,
  INSPECTION_MEASURES,
} = await import("@/lib/services/inspection");
const { translator } = await import("@/i18n");
const { innerQtyTexts, cartonSizeTexts, packageTypeTexts } =
  await import("@/components/carton-texts");

describe("opções de caixa inner", () => {
  it("só os números que fecham a master (sem a própria master)", () => {
    expect(carton.innerOptions(10)).toEqual([1, 2, 5]);
    expect(carton.innerOptions(12)).toEqual([1, 2, 3, 4, 6]);
    expect(carton.innerOptions(7)).toEqual([1]);
    expect(carton.innerOptions(1)).toEqual([]);
    expect(carton.innerOptions(null)).toEqual([]);
    expect(carton.innerOptions(0)).toEqual([]);
    expect(carton.innerOptions(10.5)).toEqual([]);
  });

  it("master com muitos divisores: o 1 e os maiores, no máximo 12", () => {
    const options = carton.innerOptions(240);
    expect(options).toHaveLength(12);
    expect(options[0]).toBe(1);
    expect(options).toContain(120);
    expect(options).toContain(12);
    expect(options).not.toContain(2);
    expect(options.every((n) => 240 % n === 0 && n < 240)).toBe(true);
    expect([...options].sort((a, b) => a - b)).toEqual(options);
  });
});

describe("conferência da inner com a master", () => {
  it("fecha, igual, maior, sobra e sem inner", () => {
    expect(carton.checkInner(10, 2)).toEqual({ kind: "fits", boxes: 5 });
    expect(carton.checkInner(10, 1)).toEqual({ kind: "fits", boxes: 10 });
    expect(carton.checkInner(10, 10)).toEqual({ kind: "same" });
    expect(carton.checkInner(10, 12)).toEqual({ kind: "bigger" });
    expect(carton.checkInner(10, 3)).toEqual({ kind: "rest", rest: 1 });
    expect(carton.checkInner(10, 0)).toEqual({ kind: "none" });
    // Sem inner vale mesmo sem a master preenchida.
    expect(carton.checkInner(null, 0)).toEqual({ kind: "none" });
  });

  it("nada a dizer sem os números", () => {
    expect(carton.checkInner(10, null)).toBeNull();
    expect(carton.checkInner(null, 4)).toBeNull();
    expect(carton.checkInner(10, -1)).toBeNull();
    expect(carton.checkInner(10, 2.5)).toBeNull();
  });
});

describe("caixa master grande demais", () => {
  it("o exemplo da tela: 200 × 30 × 100 cm", () => {
    expect(carton.oversizedCarton([200, 30, 100], null)).toEqual({
      kind: "size",
      sides: [200, 30, 100],
      cbm: 0.6,
    });
  });

  it("volume alto sem lado grande também avisa (≥ 0,4 m³)", () => {
    const check = carton.oversizedCarton([80, 80, 70], null);
    expect(check?.kind).toBe("size");
    expect(carton.oversizedCarton([60, 40, 40], null)).toBeNull();
  });

  it("um lado digitado em mm, antes das três medidas", () => {
    expect(carton.oversizedCarton([600, null, null], null)).toEqual({
      kind: "side",
      side: 600,
    });
  });

  it("só o CBM digitado", () => {
    expect(carton.oversizedCarton([null, null, null], 0.5)).toEqual({
      kind: "cbm",
      cbm: 0.5,
    });
    expect(carton.oversizedCarton([null, null, null], 0.05)).toBeNull();
    // Com as três medidas vale a conta pelas medidas, não o CBM digitado.
    expect(carton.oversizedCarton([40, 30, 20], 0.9)).toBeNull();
  });

  it("caixas por container dão a dimensão", () => {
    expect(carton.cartonsPerContainer(68, 0.6)).toBe(113);
    expect(carton.cartonsPerContainer(null, 0.6)).toBeNull();
    expect(carton.cartonsPerContainer(68, 0)).toBeNull();
  });
});

describe("tipo de embalagem", () => {
  it("cor no lugar do tipo", () => {
    for (const v of [
      "preto",
      "Preto",
      " azul claro ",
      "BLACK",
      "黑色",
      "浅蓝色",
      "白",
    ])
      expect(carton.looksLikeColor(v), v).toBe(true);
    for (const v of [
      "COLOR BOX",
      "BROWN BOX",
      "caixa preta",
      "blister",
      "",
      null,
    ])
      expect(carton.looksLikeColor(v), String(v)).toBe(false);
  });

  it("atalho marcado sem diferença de maiúsculas e espaços", () => {
    expect(carton.samePackageType(" color  box", "COLOR BOX")).toBe(true);
    expect(carton.samePackageType("COLOR BOX 2", "COLOR BOX")).toBe(false);
    expect(carton.packageTypeKey("OPP BAG")).toBe("oppBag");
    expect(carton.packageTypeKey("BLISTER")).toBe("blister");
  });
});

describe("inspeção com referência 0 (sem caixa inner)", () => {
  const reference = { innerBoxQty: 0, masterBoxQty: 10 } as never;
  const tol = { weight: 3, cbm: 5, dimension: 5, quantity: 0 };

  it("0 encontrado bate; caixas inner encontradas divergem", () => {
    const ok = compareWithSnapshot(
      reference,
      [{ key: "inner_box_measured", status: "done", value: "0" }],
      tol,
    );
    expect(ok).toEqual([
      expect.objectContaining({ attribute: "innerBoxQty", ok: true }),
    ]);
    expect(summarizeResult(ok)).toBe("APPROVED");
    const found = compareWithSnapshot(
      reference,
      [{ key: "inner_box_measured", status: "done", value: "6" }],
      tol,
    );
    expect(found[0].ok).toBe(false);
    expect(found[0].tolerancePercent).toBeNull();
    expect(expectedText(found[0])).toBe("0 (sem caixa inner)");
    expect(summarizeResult(found)).toBe("DIVERGENT");
  });

  it("inner igual à master vale como sem inner, dos dois lados", () => {
    const same = { innerBoxQty: 24, masterBoxQty: 24 } as never;
    const none = compareWithSnapshot(
      same,
      [{ key: "inner_box_measured", status: "done", value: "0" }],
      tol,
    );
    expect(none[0].ok).toBe(true);
    const typedMaster = compareWithSnapshot(
      { innerBoxQty: 0, masterBoxQty: 24 } as never,
      [{ key: "inner_box_measured", status: "done", value: "24" }],
      tol,
    );
    expect(typedMaster[0].ok).toBe(true);
    // Inner de verdade diferente continua divergindo.
    const real = compareWithSnapshot(
      same,
      [{ key: "inner_box_measured", status: "done", value: "6" }],
      tol,
    );
    expect(real[0].ok).toBe(false);
    expect(expectedText(real[0])).toBe("24");
  });

  it("do lado encontrado vale a master encontrada", () => {
    // Comprado sem inner (24 na master); achou master de 48 com inners de 24.
    const twoInners = compareWithSnapshot(
      { innerBoxQty: 0, masterBoxQty: 24 } as never,
      [
        { key: "master_box_measured", status: "done", value: "48" },
        { key: "inner_box_measured", status: "done", value: "24" },
      ],
      tol,
    );
    expect(twoInners.find((c) => c.attribute === "innerBoxQty")?.ok).toBe(
      false,
    );
    // Comprado 24/24; achou master de 48 com uma inner só (48): sem inner.
    const oneInner = compareWithSnapshot(
      { innerBoxQty: 24, masterBoxQty: 24 } as never,
      [
        { key: "master_box_measured", status: "done", value: "48" },
        { key: "inner_box_measured", status: "done", value: "48" },
      ],
      tol,
    );
    expect(oneInner.find((c) => c.attribute === "innerBoxQty")?.ok).toBe(true);
  });

  it("o relatório da inspeção usa a mesma conta do portão", () => {
    const inner = INSPECTION_MEASURES.find(
      (m) => m.key === "inner_box_measured",
    )!;
    const ref = { innerBoxQty: 24, masterBoxQty: 24 } as never;
    expect(compareReferenceMeasure(inner, ref, "0", tol)?.ok).toBe(true);
    expect(
      compareReferenceMeasure(
        inner,
        { innerBoxQty: 0, masterBoxQty: 24 } as never,
        "24",
        tol,
      )?.ok,
    ).toBe(true);
    expect(compareReferenceMeasure(inner, ref, "6", tol)?.ok).toBe(false);
  });
});

describe("textos", () => {
  it("as três línguas montam todas as frases, sem marcador sobrando", () => {
    for (const locale of ["pt", "en", "zh"] as const) {
      const t = translator(locale);
      const all = [
        ...Object.values(innerQtyTexts(t)),
        ...Object.values(cartonSizeTexts(t)),
        ...Object.values(packageTypeTexts(t).names),
        packageTypeTexts(t).options,
        packageTypeTexts(t).colorLike,
      ];
      for (const text of all) {
        expect(text, locale).toBeTruthy();
        expect(text.startsWith("carton."), text).toBe(false);
      }
      expect(innerQtyTexts(t).rest).toContain("{rest}");
      expect(cartonSizeTexts(t).fit).toContain("{n}");
      expect(cartonSizeTexts(t).fitOne).toContain("{type}");
      expect(cartonSizeTexts(t).noFit).toContain("{capacity}");
    }
  });
});
