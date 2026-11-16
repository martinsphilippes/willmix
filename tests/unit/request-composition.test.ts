import { describe, expect, it } from "vitest";
import {
  requestComposition,
  shortProductName,
  unitGroup,
  type CompositionItem,
} from "@/lib/request-composition";

/*
 * Encomendas (dono, 16/11/2026): produtos, fotos e a soma das peças por
 * pedido, não pelo produto da solicitação.
 */

const req = (
  over: Partial<{
    orderId: string | null;
    productId: string | null;
    productName: string | null;
    quantity: number;
    unit: string;
  }> = {},
) => ({
  orderId: null,
  productId: "p-boneca",
  productName: "Boneca a pilha com som e luz Zoey",
  quantity: 3000,
  unit: "un",
  ...over,
});

const item = (
  productId: string | null,
  name: string,
  quantity: number,
  unit = "un",
): CompositionItem => ({ productId, name, quantity, unit });

describe("composição do pedido da linha", () => {
  it("solicitação sem pedido: o produto e a quantidade dela", () => {
    const c = requestComposition([req()], new Map());
    expect(c.products).toEqual([
      {
        key: "p:p-boneca",
        productId: "p-boneca",
        name: "Boneca a pilha com som e luz Zoey",
      },
    ]);
    expect(c.totals).toEqual([{ unit: "un", quantity: 3000 }]);
  });

  it("pedido com vários itens: todos os produtos, sem repetir, e a soma das peças", () => {
    // Pedido do histórico: a solicitação guarda só o primeiro produto.
    const items = new Map([
      [
        "o-1",
        [
          item("p-lixeira", "Lixeira tampa basculante inox redonda 5L", 1548),
          item("p-cesto", "Cesto de roupa com tampa", 600, "UN"),
          // O mesmo produto em outra cor: uma foto e um nome, peças somadas.
          item("p-lixeira", "Lixeira tampa basculante inox redonda 5L", 452),
          item("p-pote", "Pote hermético 1L", 2400, "pcs"),
        ],
      ],
    ]);
    const c = requestComposition(
      [req({ orderId: "o-1", productId: "p-lixeira", quantity: 1548 })],
      items,
    );
    expect(c.products.map((p) => p.productId)).toEqual([
      "p-lixeira",
      "p-cesto",
      "p-pote",
    ]);
    // un, UN e pcs são peças: uma soma só, com a unidade do primeiro item.
    expect(c.totals).toEqual([{ unit: "un", quantity: 5000 }]);
  });

  it("outra unidade fica à parte; quantidade zerada ou vazia não soma", () => {
    const items = new Map([
      [
        "o-2",
        [
          item("a", "Caneca", 100),
          item("b", "Prato", 20, "cx"),
          item("c", "Tigela", 0),
          { productId: "d", name: "Copo", quantity: null, unit: null },
        ],
      ],
    ]);
    const c = requestComposition([req({ orderId: "o-2" })], items);
    expect(c.products).toHaveLength(4);
    expect(c.totals).toEqual([
      { unit: "un", quantity: 100 },
      { unit: "cx", quantity: 20 },
    ]);
  });

  it("lote: cada solicitação pelo pedido dela, o mesmo pedido uma vez só", () => {
    const items = new Map([
      ["o-3", [item("p-cubo", "Cubo interativo 3x3x3", 24000)]],
    ]);
    const c = requestComposition(
      [
        req({ orderId: "o-3", productId: "p-cubo", quantity: 24000 }),
        // Ainda sem pedido: vale a solicitação.
        req({
          productId: null,
          productName: "Boneca Liuly SRT cor",
          quantity: 24000,
        }),
        // Outra solicitação do lote no mesmo pedido: não soma de novo.
        req({ orderId: "o-3", productId: "p-cubo", quantity: 24000 }),
      ],
      items,
    );
    expect(c.products.map((p) => p.name)).toEqual([
      "Cubo interativo 3x3x3",
      "Boneca Liuly SRT cor",
    ]);
    expect(c.totals).toEqual([{ unit: "un", quantity: 48000 }]);
  });

  it("pedido sem itens lidos: vale a solicitação; produto fora do catálogo pelo nome", () => {
    const c = requestComposition(
      [
        req({ orderId: "o-sem-itens" }),
        req({ productId: null, productName: "Copo de vidro", quantity: 200 }),
        req({ productId: null, productName: " copo  de VIDRO ", quantity: 50 }),
      ],
      new Map(),
    );
    expect(c.products.map((p) => p.key)).toEqual([
      "p:p-boneca",
      "n:copo de vidro",
    ]);
    expect(c.totals).toEqual([{ unit: "un", quantity: 3250 }]);
  });
});

describe("início do nome e unidade", () => {
  it("as primeiras palavras, com reticências quando corta", () => {
    expect(shortProductName("Copo de vidro")).toBe("Copo de vidro");
    expect(
      shortProductName("Boneca a pilha com som e luz Zoey Hoverboard"),
    ).toBe("Boneca a pilha com som…");
    expect(shortProductName("SUPERCALIFRAGILISTICEXPIALIDOSO", 10)).toBe(
      "SUPERCALIF…",
    );
  });

  it("peças em qualquer grafia contam juntas", () => {
    for (const u of ["un", "UN", "pcs", "PC", "pç", "peças", "Unid.", ""])
      expect(unitGroup(u)).toBe("pieces");
    expect(unitGroup("cx")).toBe("cx");
    expect(unitGroup("Kg")).toBe("kg");
  });
});
