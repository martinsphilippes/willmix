import { describe, expect, it } from "vitest";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DieCutTerms } from "@/app/app/orders/[id]/die-cut/_components/die-cut-terms";

/*
 * Pedido mínimo e prazo no quadro Die Cut (pedido do dono, 13/11/2026):
 * confirmado, o resumo no lugar do formulário, com "Editar" só enquanto dá
 * para corrigir; sem confirmação, o formulário de sempre. Abrir, cancelar,
 * o erro junto ao formulário e o envio são do navegador (E2E do caminho
 * principal); aqui, o que a página entrega antes de qualquer toque.
 */
type Props = ComponentProps<typeof DieCutTerms>;

const labels = {
  hint: "Confira os números. Se estiverem certos, é só confirmar; se mudaram, corrija e confirme.",
  moq: "Pedido mínimo (peças)",
  leadTime: "Prazo de entrega (dias)",
  submit: "Confirmar pedido mínimo e prazo",
  edit: "Editar",
  editAria: "Editar pedido mínimo e prazo de entrega: Produto novo XPTO",
  cancel: "Cancelar",
};

const render = (confirmed: boolean, canEdit: boolean) =>
  renderToStaticMarkup(
    createElement(DieCutTerms, {
      action: async (prev) => prev,
      orderId: "o1",
      itemId: "i1",
      confirmed,
      canEdit,
      initial: { moq: "132000", leadTimeDays: "15" },
      summary: confirmed
        ? createElement(
            "span",
            { "data-values": "" },
            "132.000 peças · 15 dias",
          )
        : null,
      labels,
    } as Props),
  );

describe("pedido mínimo e prazo no quadro Die Cut", () => {
  it("confirmado: o resumo com Editar, sem formulário nem o pedido de conferir", () => {
    const html = render(true, true);
    expect(html).toContain("data-die-cut-terms-summary");
    expect(html).toContain("132.000 peças · 15 dias");
    expect(html).toMatch(
      /<button[^>]*aria-label="Editar pedido mínimo e prazo de entrega: Produto novo XPTO"[^>]*data-die-cut-terms-edit="true"[^>]*>Editar<\/button>/,
    );
    expect(html).not.toContain("<form");
    expect(html).not.toContain(labels.hint);
    expect(html).not.toContain(labels.submit);
  });

  it("produto sem nome: o Editar fica com o texto visível", () => {
    const html = renderToStaticMarkup(
      createElement(DieCutTerms, {
        action: async (prev) => prev,
        orderId: "o1",
        itemId: "i1",
        confirmed: true,
        canEdit: true,
        initial: { moq: "132000", leadTimeDays: "15" },
        summary: "132.000 peças · 15 dias",
        labels: { ...labels, editAria: null },
      } as Props),
    );
    expect(html).toMatch(/<button[^>]*data-die-cut-terms-edit="true"/);
    expect(html).not.toContain("aria-label");
  });

  it("confirmado com a etapa fechada: só o resumo, sem Editar", () => {
    const html = render(true, false);
    expect(html).toContain("132.000 peças · 15 dias");
    expect(html).not.toContain("data-die-cut-terms-edit");
    expect(html).not.toContain("<form");
  });

  it("sem confirmação: o formulário de sempre, com os valores e sem Cancelar", () => {
    const html = render(false, true);
    expect(html).toContain("data-die-cut-terms");
    expect(html).not.toContain("data-die-cut-terms-summary");
    expect(html).toContain(labels.hint);
    expect(html).toMatch(/<input[^>]*name="moq"[^>]*value="132000"/);
    expect(html).toMatch(/<input[^>]*name="leadTimeDays"[^>]*value="15"/);
    expect(html).toContain(labels.submit);
    expect(html).not.toContain("data-die-cut-terms-cancel");
    // Sem recusa ainda: nenhum aviso de erro.
    expect(html).not.toContain("data-die-cut-terms-error");
  });

  it("sem confirmação e sem poder enviar: nada", () => {
    expect(render(false, false)).toBe("");
  });
});
