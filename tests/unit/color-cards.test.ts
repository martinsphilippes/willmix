import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ColorCards,
  columnClasses,
  moneyParts,
  valueFontSize,
  type ColorCard,
} from "@/components/color-cards";

/*
 * Cartões de valores do pedido (pedido do dono, 14/11/2026): valores longos
 * em RMB e negativos em reais saíam cortados. A moeda vai numa linha menor,
 * o número inteiro fica numa linha só (o sinal junto), o tamanho é o mesmo
 * em todos os cartões e a grade segue a largura da área de conteúdo. Que
 * nada corta em cada largura é do navegador (conferido em 26 tamanhos de
 * aparelho e de 320 a 1920 px, com o menu aberto e recolhido); aqui, as
 * regras e o que a página entrega.
 */
describe("valor em dinheiro: moeda à parte, sinal no número", () => {
  it("separa a moeda e mantém todos os dígitos, separadores e casas", () => {
    expect(moneyParts({ amount: 339187.5, currency: "RMB" }, "pt-BR")).toEqual({
      currency: "RMB",
      number: "339.187,50",
    });
    expect(
      moneyParts({ amount: -287929.23, currency: "BRL" }, "pt-BR"),
    ).toEqual({ currency: "R$", number: "-287.929,23" });
    expect(moneyParts({ amount: 0, currency: "BRL" }, "pt-BR")).toEqual({
      currency: "R$",
      number: "0,00",
    });
    expect(
      moneyParts({ amount: -12345678.9, currency: "BRL" }, "en-US"),
    ).toEqual({ currency: "R$", number: "-12,345,678.90" });
    // Sem moeda: real.
    expect(moneyParts({ amount: 10, currency: null }, "pt-BR").currency).toBe(
      "R$",
    );
  });
});

describe("cartões por linha e tamanho do número", () => {
  it("1, 2, 3, 4 e todos por linha, conforme a largura da área", () => {
    expect(columnClasses(7)).toEqual([
      "@[20.5rem]:grid-cols-2",
      "@[32rem]:grid-cols-3",
      "@[43rem]:grid-cols-4",
      "@[76rem]:grid-cols-7",
    ]);
    // O cliente vê três: nunca mais colunas que cartões.
    expect(columnClasses(3)).toEqual([
      "@[20.5rem]:grid-cols-2",
      "@[32rem]:grid-cols-3",
    ]);
    expect(columnClasses(1)).toEqual([]);
  });

  it("o maior número do conjunto cabe na largura do cartão, até 22 px", () => {
    expect(valueFontSize(14)).toBe("min(1.375rem, 11.161cqi)");
    // Números curtos não crescem além do teto (mínimo de 6 caracteres na conta).
    expect(valueFontSize(4)).toBe(valueFontSize(6));
  });
});

describe("cartões renderizados", () => {
  const items: ColorCard[] = [
    {
      key: "fob",
      label: "Valor de compra (FOB)",
      money: { amount: 339187.5, currency: "RMB" },
      tone: "slate",
    },
    {
      key: "margin",
      label: "Margem",
      money: { amount: -287929.23, currency: "BRL", approx: true },
      sub: "-84,9%",
      tone: "violet",
    },
    { key: "none", label: "Margem", value: "—", tone: "violet" },
  ];
  const html = renderToStaticMarkup(
    createElement(ColorCards, { items, name: "order", intl: "pt-BR" }),
  );

  it("moeda numa linha menor e o número inteiro, sem quebrar, embaixo", () => {
    expect(html).toMatch(
      /data-color-card-currency="true">RMB<\/span><span class="block whitespace-nowrap" data-color-card-number="true">339\.187,50</,
    );
    // Estimado: "~" antes da moeda; o sinal fica com o número.
    expect(html).toMatch(
      /data-color-card-currency="true">~ R\$<\/span><span class="block whitespace-nowrap" data-color-card-number="true">-287\.929,23</,
    );
    expect(html).toContain("-84,9%");
    expect(html).toContain('data-color-card-number="true">—<');
    // Rótulos de sempre.
    expect(html).toContain("Valor de compra (FOB)");
  });

  it("o mesmo tamanho em todos os cartões, pelo maior número", () => {
    const sizes = [...html.matchAll(/style="font-size:([^"]+)"/g)].map(
      (m) => m[1],
    );
    expect(sizes).toHaveLength(3);
    expect(new Set(sizes).size).toBe(1);
    expect(sizes[0]).toBe(valueFontSize("-287.929,23".length));
  });

  it("a grade segue a área de conteúdo (container), não a janela", () => {
    expect(html).toMatch(
      /<div class="@container mb-4" data-color-cards="order">/,
    );
    expect(html).toContain("@[32rem]:grid-cols-3");
    expect(html).not.toContain("@[43rem]:grid-cols-4");
  });
});
