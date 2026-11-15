import { describe, expect, it } from "vitest";
import {
  containerComposition,
  sharePercent,
} from "@/lib/container-composition";

/*
 * Composição de containers da Nova solicitação (dono, 15/11/2026;
 * docs/ORDER_TERMS.md seção 8): por programação, os produtos enchem os
 * containers em ordem, em caixas inteiras pelo CBM.
 */
describe("composição de containers", () => {
  // Container de 10 m³; A: 1 m³ por caixa de 10 peças; B: 2 m³ por caixa de 5.
  const a = {
    key: "a",
    name: "A",
    masterCartonQty: 10,
    cbmPerCarton: 1,
    pieces: [60, 100],
  };
  const b = {
    key: "b",
    name: "B",
    masterCartonQty: 5,
    cbmPerCarton: 2,
    pieces: [10, 25],
  };

  it("soma os produtos no container e passa para o próximo quando enche", () => {
    const c = containerComposition([a, b], 2, 10);
    expect(c.rounds).toBe(2);
    // Programação 1: A 6 cx (6 m³) + B 2 cx (4 m³) = 1 container cheio.
    // Programação 2: A 10 cx (10 m³) enche o 1º; B 5 cx (10 m³) enche o 2º.
    expect(c.rows).toHaveLength(2);
    expect(c.rows[0].cells.map((x) => x && sharePercent(x.share))).toEqual([
      "100",
      "100",
    ]);
    expect(c.rows[1].cells[0]).toBeNull();
    expect(c.rows[1].cells[1]?.products).toEqual([
      { key: "b", name: "B", cartons: 5, cbm: 10, share: 1 },
    ]);
    expect(
      c.rows[0].cells[0]?.products.map((p) => [p.key, p.cartons, p.share]),
    ).toEqual([
      ["a", 6, 0.6],
      ["b", 2, 0.4],
    ]);
  });

  it("divide um produto entre containers em caixas inteiras", () => {
    const c = containerComposition(
      [
        { ...a, pieces: [55] },
        { ...b, pieces: [15] },
      ],
      1,
      10,
    );
    // A: 6 cx (6 m³); B: 3 cx de 2 m³ → 2 cabem no 1º (4 m³), 1 vai ao 2º.
    expect(c.rows.map((r) => r.cells[0]?.cbm)).toEqual([10, 2]);
    expect(c.rows[1].cells[0]?.products[0]).toMatchObject({
      key: "b",
      cartons: 1,
    });
  });

  it("deixa fora quem não tem caixa ou não cabe", () => {
    const c = containerComposition(
      [
        { ...a, masterCartonQty: null },
        { ...b, cbmPerCarton: 20 },
      ],
      2,
      10,
    );
    expect(c.missing).toEqual(["A"]);
    expect(c.tooBig).toEqual(["B"]);
    expect(c.rows).toEqual([]);
  });

  it("ocupação para baixo e <1 para quase nada", () => {
    expect(sharePercent(0.269)).toBe("26");
    expect(sharePercent(0.004)).toBe("<1");
    expect(sharePercent(1)).toBe("100");
  });
});
