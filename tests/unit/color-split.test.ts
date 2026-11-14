import { describe, expect, it } from "vitest";
import {
  buildColorPlan,
  colorTotals,
  colorsOf,
  colorsOfRound,
  hasVariations,
  planMatches,
  splitByColor,
  spreadCartons,
} from "@/lib/color-split";

/* Variações de cor do vencedor: cores do Book e divisão por cor e por data. */

const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

describe("cores do Book", () => {
  it("lê as cores da planilha sem repetir", () => {
    expect(colorsOf("BEGE / CARVALHO / MARROM")).toEqual([
      "BEGE",
      "CARVALHO",
      "MARROM",
    ]);
    expect(colorsOf("Azul, verde;azul | Rosa\nBranco + Preto")).toEqual([
      "Azul",
      "verde",
      "Rosa",
      "Branco",
      "Preto",
    ]);
    expect(colorsOf(null)).toEqual([]);
    expect(colorsOf("  ")).toEqual([]);
    expect(hasVariations("BEGE")).toBe(false);
    expect(hasVariations("BEGE/MARROM")).toBe(true);
  });
});

describe("divisão por cor", () => {
  it("exemplo do dono: 2.880 peças, 3 cores, 2 datas → 480 por cor por data", () => {
    const r = splitByColor({
      rounds: [1440, 1440],
      colors: ["BEGE", "CARVALHO", "MARROM"],
      carton: 12,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rows).toEqual([
      { color: "BEGE", quantity: 960, rounds: [480, 480] },
      { color: "CARVALHO", quantity: 960, rounds: [480, 480] },
      { color: "MARROM", quantity: 960, rounds: [480, 480] },
    ]);
  });

  it("divisão desigual: o saldo vai em caixas inteiras para as primeiras cores", () => {
    // 10 caixas de 12 em 3 cores: 4 + 3 + 3 caixas.
    const r = splitByColor({
      rounds: [120],
      colors: ["A", "B", "C"],
      carton: 12,
    });
    expect(r.ok && r.rows.map((x) => x.quantity)).toEqual([48, 36, 36]);
  });

  it("várias datas desiguais: cada data e cada cor fecham, em caixas inteiras", () => {
    const rounds = [480, 240, 360]; // 20 + 10 + 15 caixas de 24
    const r = splitByColor({
      rounds,
      colors: ["A", "B", "C", "D"],
      carton: 24,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Cada data soma as peças da data.
    rounds.forEach((q, i) =>
      expect(sum(r.rows.map((x) => x.rounds[i]))).toBe(q),
    );
    // Cada célula é de caixas inteiras.
    for (const row of r.rows)
      for (const q of row.rounds) expect(q % 24).toBe(0);
    // Total de cada cor: 45 caixas em 4 cores = 12, 11, 11, 11.
    expect(r.rows.map((x) => x.quantity / 24)).toEqual([12, 11, 11, 11]);
    expect(sum(r.rows.map((x) => x.quantity))).toBe(1080);
  });

  it("quantidade que não fecha caixas: diz o ajuste em vez de mudar", () => {
    const r = splitByColor({ rounds: [1000], colors: ["A", "B"], carton: 48 });
    expect(r).toEqual({
      ok: false,
      error: "colors_cartons",
      round: 0,
      pieces: 1000,
      carton: 48,
      down: 960,
      up: 1008,
    });
  });

  it("sem caixa master: divide em peças", () => {
    const r = splitByColor({
      rounds: [10, 5],
      colors: ["A", "B", "C"],
      carton: null,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rows.map((x) => x.quantity)).toEqual([5, 5, 5]);
    expect([0, 1].map((i) => sum(r.rows.map((x) => x.rounds[i])))).toEqual([
      10, 5,
    ]);
  });

  it("uma cor só fica com tudo, sem regra de caixa; nenhuma cor é erro", () => {
    expect(splitByColor({ rounds: [1000], colors: ["A"], carton: 48 })).toEqual(
      {
        ok: true,
        rows: [{ color: "A", quantity: 1000, rounds: [1000] }],
      },
    );
    expect(splitByColor({ rounds: [10], colors: [], carton: 1 })).toEqual({
      ok: false,
      error: "colors_none",
    });
  });
});

describe("plano de cores", () => {
  it("cor retirada: divide só entre as incluídas e guarda as do Book", () => {
    const out = buildColorPlan({
      assortment: "BEGE / CARVALHO / MARROM",
      included: ["bege", "MARROM"],
      rounds: [1440, 1440],
      carton: 12,
    });
    expect("plan" in out).toBe(true);
    if (!("plan" in out) || !out.plan) return;
    expect(out.plan.colors).toEqual(["BEGE", "CARVALHO", "MARROM"]);
    expect(out.plan.included).toEqual(["BEGE", "MARROM"]);
    expect(out.plan.rows).toEqual([
      { color: "BEGE", quantity: 1440, rounds: [720, 720] },
      { color: "MARROM", quantity: 1440, rounds: [720, 720] },
    ]);
    expect(planMatches(out.plan, 2880)).toBe(true);
    expect(planMatches(out.plan, 2881)).toBe(false);
    expect(colorsOfRound(out.plan, 1)).toEqual([
      { color: "BEGE", quantity: 720 },
      { color: "MARROM", quantity: 720 },
    ]);
    expect(colorTotals(out.plan)).toEqual([
      { color: "BEGE", quantity: 1440 },
      { color: "MARROM", quantity: 1440 },
    ]);
  });

  it("padrão: todas as cores incluídas", () => {
    const out = buildColorPlan({
      assortment: "A/B",
      rounds: [96],
      carton: 48,
    });
    expect("plan" in out && out.plan?.included).toEqual(["A", "B"]);
  });

  it("produto sem variações: sem plano (uma linha, fluxo de sempre)", () => {
    expect(
      buildColorPlan({ assortment: "BEGE", rounds: [1000], carton: 48 }),
    ).toEqual({ plan: null });
    expect(
      buildColorPlan({ assortment: null, rounds: [1000], carton: 48 }),
    ).toEqual({ plan: null });
  });

  it("todas as cores retiradas ou caixa que não fecha: erro, nada gravado", () => {
    const none = buildColorPlan({
      assortment: "A/B",
      included: [],
      rounds: [96],
      carton: 48,
    });
    expect("error" in none && none.error.error).toBe("colors_none");
    const off = buildColorPlan({
      assortment: "A/B",
      rounds: [100],
      carton: 48,
    });
    expect("error" in off && off.error.error).toBe("colors_cartons");
  });
});

describe("caixas por cor digitadas (dono, 14/11/2026)", () => {
  it("cada cor fica com as suas caixas, espalhadas pelas datas", () => {
    // BEGE 30, CARVALHO 20, MARROM 20 = 70 caixas de 12; datas 35 + 35.
    const r = splitByColor({
      rounds: [420, 420],
      colors: ["BEGE", "CARVALHO", "MARROM"],
      carton: 12,
      cartons: { BEGE: 30, CARVALHO: 20, MARROM: 20 },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rows).toEqual([
      { color: "BEGE", quantity: 360, rounds: [180, 180] },
      { color: "CARVALHO", quantity: 240, rounds: [120, 120] },
      { color: "MARROM", quantity: 240, rounds: [120, 120] },
    ]);
  });

  it("caixas que não somam o total das datas: recusa, nada muda", () => {
    expect(
      splitByColor({
        rounds: [480],
        colors: ["A", "B"],
        carton: 48,
        cartons: { A: 6, B: 5 },
      }),
    ).toEqual({ ok: false, error: "colors_total", expected: 10, got: 11 });
  });

  it("uma cor e cor com zero caixas também valem", () => {
    const r = splitByColor({
      rounds: [96, 48],
      colors: ["A", "B"],
      carton: 48,
      cartons: { A: 3, B: 0 },
    });
    expect(r.ok && r.rows.map((x) => x.rounds)).toEqual([
      [96, 48],
      [0, 0],
    ]);
  });

  it("plano personalizado marcado como tal", () => {
    const out = buildColorPlan({
      assortment: "A/B",
      rounds: [144],
      carton: 48,
      cartons: { A: 2, B: 1 },
    });
    expect("plan" in out && out.plan).toEqual({
      colors: ["A", "B"],
      included: ["A", "B"],
      rows: [
        { color: "A", quantity: 96, rounds: [96] },
        { color: "B", quantity: 48, rounds: [48] },
      ],
      custom: true,
    });
  });

  it("espalha um total de caixas pelas datas na proporção de cada uma", () => {
    expect(spreadCartons(70, [1440, 1440])).toEqual([35, 35]);
    expect(spreadCartons(71, [1440, 1440])).toEqual([36, 35]);
    expect(spreadCartons(10, [3, 1])).toEqual([8, 2]);
    expect(spreadCartons(5, [0, 0])).toEqual([3, 2]);
    expect(spreadCartons(5, [])).toEqual([]);
  });
});
