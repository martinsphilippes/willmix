import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QuantityStepper } from "@/components/quantity-stepper";
import { ExploreAddForm } from "@/components/explore-add-form";

/*
 * Quantidade na vitrine: começa no pedido mínimo, o − não desce dele, a caixa
 * aceita digitar o total; o botão do cartão diz a quantidade que vai entrar.
 */
const labels = {
  label: "Quantidade (un)",
  decreaseLabel: "Diminuir",
  increaseLabel: "Aumentar",
  belowMoqText: "Pedido mínimo: 300 un.",
};

describe("controle de quantidade", () => {
  it("começa no mínimo, com o − desligado e a caixa travada nele", () => {
    const html = renderToStaticMarkup(
      createElement(QuantityStepper, {
        id: "q",
        defaultValue: 1,
        moq: 300,
        ...labels,
      }),
    );
    expect(html).toContain('value="300"');
    expect(html).toContain('min="300"');
    expect(html).toContain('data-quantity-min="300"');
    // O − começa desabilitado (já está no mínimo); o + não.
    expect(html).toMatch(
      /data-quantity-decrease=""[^>]*disabled=""|disabled=""[^>]*data-quantity-decrease=""/,
    );
    expect(html).not.toMatch(/disabled=""[^>]*data-quantity-increase=""/);
    expect(html).not.toContain("data-below-moq");
  });

  it("valor inicial acima do mínimo fica; sem mínimo, o piso é 1", () => {
    const above = renderToStaticMarkup(
      createElement(QuantityStepper, {
        id: "q",
        defaultValue: 450,
        moq: 300,
        ...labels,
      }),
    );
    expect(above).toContain('value="450"');
    expect(above).not.toMatch(
      /disabled=""[^>]*data-quantity-decrease=""|data-quantity-decrease=""[^>]*disabled=""/,
    );
    const none = renderToStaticMarkup(
      createElement(QuantityStepper, {
        id: "q",
        defaultValue: 0,
        moq: null,
        ...labels,
      }),
    );
    expect(none).toContain('value="1"');
    expect(none).toContain('min="1"');
  });

  it("cartão da vitrine: controle compacto e botão com a quantidade do mínimo", () => {
    const html = renderToStaticMarkup(
      createElement(ExploreAddForm, {
        productId: "prod-boneca",
        back: "/app/explore",
        moq: 2000,
        startQty: 1,
        intl: "pt-BR",
        labels: {
          add: "Adicionar {n} un",
          quantity: "Quantidade (un)",
          decrease: "Diminuir",
          increase: "Aumentar",
          belowMoq: "Pedido mínimo: 2.000 un.",
        },
      }),
    );
    expect(html).toContain('data-explore-add-form="prod-boneca"');
    expect(html).toContain('name="productId" value="prod-boneca"');
    expect(html).toContain('value="2000"');
    expect(html).toContain("Adicionar 2.000 un");
    expect(html).toContain('data-explore-add="prod-boneca"');
    // Sem rótulo visível no cartão (só para leitores de tela).
    expect(html).toContain("sr-only");
  });
});
