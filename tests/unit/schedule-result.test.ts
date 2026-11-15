import { describe, expect, it } from "vitest";
import {
  cartonsPerContainer,
  equivalentPercent,
  roundLoad,
  scheduleResult,
} from "@/lib/purchase-rounds";

/*
 * "Resultado da programação" (dono, 15/11/2026): a faixa embaixo de "Gerar
 * programação" (Seleção de itens e Nova solicitação, o mesmo componente).
 * Por programação, o menor e o maior valor; no total, a soma e a ocupação
 * equivalente (o total em containers do tipo escolhido), arredondada só ao
 * mostrar e acima de 100% quando passa de um container.
 */

// A referência da imagem: 24 peças e 0,0731 m³ por caixa, 40HC de 68 m³.
const PCS = 24;
const CBM = 0.0731;
const HC = 68;
const per = cartonsPerContainer(CBM, HC);
const loadsOf = (pieces: number[]) =>
  pieces.map((p) => roundLoad(p, PCS, CBM, HC)!);

describe("resultado da programação", () => {
  it("2 programações de 100 caixas: por programação e o total", () => {
    expect(per).toBe(930);
    const pieces = [2400, 2400];
    const out = scheduleResult(pieces, loadsOf(pieces), per)!;
    expect(out.rounds).toBe(2);
    expect(out.perRound).toEqual({
      cartons: [100, 100],
      pieces: [2400, 2400],
      cbm: [7.31, 7.31],
      // 100 ÷ 930 = 10,75% → 10%, como o cartão da programação.
      pct: [10, 10],
    });
    expect(out.total).toMatchObject({ cartons: 200, pieces: 4800 });
    expect(out.total.cbm).toBe(14.62);
    // Sem arredondar: 200 ÷ 930.
    expect(out.total.equivalent).toBe(200 / 930);
    // Só ao mostrar: 21,5% → 22% (0,22 → 22% de 1 × 40HC).
    expect(equivalentPercent(out.total.equivalent)).toBe("22");
  });

  it("programações diferentes: o menor e o maior valor", () => {
    const pieces = [101 * PCS, 100 * PCS];
    const out = scheduleResult(pieces, loadsOf(pieces), per)!;
    expect(out.perRound.cartons).toEqual([100, 101]);
    expect(out.perRound.pieces).toEqual([2400, 2424]);
    expect(out.total.cartons).toBe(201);
  });

  it("acima de um container: mais de 100%, por programação e no total", () => {
    const pieces = [1395 * PCS, 1395 * PCS];
    const out = scheduleResult(pieces, loadsOf(pieces), per)!;
    // 1.395 ÷ 930 = 1,5 container por programação.
    expect(out.perRound.pct).toEqual([150, 150]);
    expect(equivalentPercent(out.total.equivalent)).toBe("300");
  });

  it("quase nada: <1%; e nulo sem programação ou sem a conta do container", () => {
    const pieces = [PCS];
    const out = scheduleResult(pieces, loadsOf(pieces), per)!;
    expect(out.perRound.pct).toEqual([0, 0]);
    expect(equivalentPercent(out.total.equivalent)).toBe("<1");
    expect(equivalentPercent(0)).toBe("0");
    expect(scheduleResult([], [], per)).toBeNull();
    expect(scheduleResult(pieces, loadsOf(pieces), null)).toBeNull();
    expect(scheduleResult([1, 2], loadsOf([1]), per)).toBeNull();
  });
});

describe("a faixa na tela (o mesmo componente nas duas telas)", async () => {
  const { createElement } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { translator } = await import("@/i18n");
  const { SelectionQuantity } = await import("@/components/selection-quantity");
  const { generateLabels, purchaseScheduleLabels } =
    await import("@/components/generate-labels");
  const t = translator("pt");
  type Carton = import("@/components/selection-quantity").SelectionCarton;
  /** O card com 2 programações gravadas de 100 caixas (a referência). */
  const render = (item: Partial<Carton>) =>
    renderToStaticMarkup(
      createElement(SelectionQuantity, {
        label: "Quantidade (peças)",
        hint: "",
        scheduledHint: "",
        defaultQuantity: 4800,
        schedule: {
          intervalDays: 30,
          firstDate: "2027-03-15",
          items: [
            { index: 1, quantity: 2400, expectedAt: "2027-03-15" },
            { index: 2, quantity: 2400, expectedAt: "2027-04-14" },
          ],
        },
        labels: purchaseScheduleLabels(t, t.intl),
        gen: generateLabels(t),
        items: [
          {
            id: "item-a",
            masterCartonQty: PCS,
            cbmPerCarton: CBM,
            sheetQty: null,
            ...item,
          },
        ],
        chosenItemId: "item-a",
        containerTypes: [
          { code: "20GP", capacityCbm: 28 },
          { code: "40GP", capacityCbm: 58 },
          { code: "40HC", capacityCbm: HC },
        ],
      }),
    );
  /** Rótulo e valor de um campo da faixa. */
  const field = (html: string, key: string) => {
    const m = new RegExp(
      `data-generate-field="${key}"><dt[^>]*>([^<]*)</dt><dd[^>]*>([^<]*)</dd>`,
    ).exec(html);
    return m ? [m[1], m[2].replace(/ /g, " ")] : null;
  };

  it("título, os três grupos na ordem e os resultados, sem o texto do cálculo", () => {
    const html = render({
      innerQty: 6,
      netWeight: { value: 3.21, unit: "kg", basis: "carton" },
    });
    expect(html).toContain(">Resultado da programação<");
    expect(html).not.toContain(">Cálculo<");
    expect(
      [...html.matchAll(/data-generate-group="([^"]+)"/g)].map((m) => m[1]),
    ).toEqual(["carton", "per-round", "total"]);
    expect(field(html, "pieces-per-carton")).toEqual(["Peças por caixa", "24"]);
    expect(field(html, "inner")).toEqual(["Caixa inner", "6"]);
    expect(field(html, "cbm-per-carton")).toEqual([
      "CBM por caixa",
      "0,0731 m³",
    ]);
    expect(field(html, "net-weight")).toEqual([
      "Peso líquido por caixa master",
      "3,21 kg",
    ]);
    expect(field(html, "capacity")).toEqual([
      "Capacidade 40HC",
      "930 caixas · 22.320 peças",
    ]);
    expect(field(html, "occupancy")).toEqual(["Ocupação 40HC", "10%"]);
    expect(field(html, "equivalent")).toEqual([
      "Ocupação equivalente",
      "22% de 1 × 40HC",
    ]);
  });

  it('caixa inner sem quantidade e o peso: a base no rótulo, "—" sem valor', () => {
    const piece = render({
      innerQty: null,
      netWeight: { value: 0.134, unit: "kg", basis: "piece" },
    });
    expect(field(piece, "inner")).toEqual(["Caixa inner", "—"]);
    expect(field(piece, "net-weight")).toEqual([
      "Peso líquido por peça",
      "0,134 kg",
    ]);
    expect(
      field(
        render({ netWeight: { value: 80.25, unit: "kg", basis: "total" } }),
        "net-weight",
      ),
    ).toEqual(["Peso líquido total", "80,25 kg"]);
    expect(
      field(
        render({ netWeight: { value: null, unit: "kg", basis: "piece" } }),
        "net-weight",
      ),
    ).toEqual(["Peso líquido por peça", "—"]);
    // Sem saber a base (nem o peso): o rótulo sem base e "—".
    expect(field(render({}), "net-weight")).toEqual(["Peso líquido", "—"]);
  });
});
