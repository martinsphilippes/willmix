import { describe, expect, it } from "vitest";
import { containersText, requestRounds } from "@/lib/request-rounds";

/*
 * Lista no nível do pedido (dono, 18/11/2026): programações e containers de
 * cada programação da solicitação, pela programação gravada e pela caixa
 * master de cada produto.
 */
describe("requestRounds", () => {
  const product = { masterBoxQty: 10, cbm: 1 };

  it("sem programação, uma entrega só com a quantidade toda", () => {
    const r = requestRounds(
      [{ id: "a", productName: "A", quantity: 300 }],
      () => product,
      28,
    );
    // 30 caixas de 1 m³ num container de 28 m³: 2 containers.
    expect(r).toEqual({ rounds: 1, containers: [2] });
  });

  it("a maior programação entre os produtos, e os produtos enchem juntos", () => {
    const r = requestRounds(
      [
        {
          id: "a",
          productName: "A",
          quantity: 400,
          schedule: { items: [{ quantity: 200 }, { quantity: 200 }] },
        },
        {
          id: "b",
          productName: "B",
          quantity: 100,
          schedule: { items: [{ quantity: 100 }] },
        },
      ],
      () => product,
      28,
    );
    // 1ª: 20 + 10 caixas = 30 m³ → 2; 2ª: 20 caixas → 1.
    expect(r).toEqual({ rounds: 2, containers: [2, 1] });
  });

  it("produto sem caixa master ou CBM: sem número de containers", () => {
    const r = requestRounds(
      [{ id: "a", productName: "A", quantity: 10 }],
      () => null,
      28,
    );
    expect(r).toEqual({ rounds: 1, containers: null });
  });

  it("a variação vale antes do cadastro", () => {
    const r = requestRounds(
      [
        {
          id: "a",
          productName: "A",
          quantity: 100,
          variant: { masterBoxQty: 50, cbm: 20 },
        },
      ],
      () => product,
      28,
    );
    // 2 caixas de 20 m³: uma por container.
    expect(r.containers).toEqual([2]);
  });
});

describe("containersText", () => {
  const each = (n: number) => `${n} em cada`;
  it("iguais, diferentes e muitas programações", () => {
    expect(containersText([3], each)).toBe("3");
    expect(containersText([2, 2, 2], each)).toBe("2 em cada");
    expect(containersText([2, 1], each)).toBe("2 · 1");
    expect(containersText([1, 2, 3, 1, 2, 3, 4], each)).toBe("1–4");
  });
});
