import { describe, expect, it } from "vitest";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SlaDueToggle } from "@/app/app/supplier-requests/_components/sla-due-toggle";

/*
 * Prazo do SLA na coluna "Situação / SLA" da solicitação (pedido do dono,
 * 13/11/2026): o selo com o "+" à direita e a data e a hora recolhidas por
 * padrão. Abrir e fechar é do navegador (E2E da solicitação); aqui, o que a
 * página entrega antes de qualquer toque.
 */
type Props = ComponentProps<typeof SlaDueToggle>;

const render = (late: boolean) =>
  renderToStaticMarkup(
    createElement(
      SlaDueToggle,
      {
        due: "13/11/2026, 14:32",
        late,
        labels: {
          show: "Mostrar data e hora do prazo",
          hide: "Ocultar data e hora do prazo",
        },
      } as Props,
      createElement(
        "span",
        { "data-badge": "" },
        late ? "Atrasada" : "No prazo",
      ),
    ),
  );

describe("prazo do SLA na tabela da solicitação", () => {
  it("começa recolhido, com o botão + à direita do selo", () => {
    const html = render(true);
    // O selo e o botão na mesma linha, nessa ordem.
    expect(html).toMatch(
      /<span class="flex items-center gap-1"><span data-badge="">Atrasada<\/span><button/,
    );
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-label="Mostrar data e hora do prazo"');
    expect(html).toContain('data-supplier-table-sla-toggle="closed"');
    expect(html).toMatch(/<span aria-hidden="true">\+<\/span>/);
    // A data e a hora já estão na célula, escondidas até o "+".
    expect(html).toMatch(/<span id="[^"]+" hidden=""[^>]*>13\/11\/2026, 14:32/);
  });

  it("o botão aponta para a data que ele mostra", () => {
    const html = render(false);
    const controls = html.match(/aria-controls="([^"]+)"/)?.[1];
    expect(controls).toBeTruthy();
    expect(html).toContain(`id="${controls}"`);
  });

  it("a data do atrasado fica em vermelho; a do no prazo, em cinza", () => {
    expect(render(true)).toContain("text-red-700");
    expect(render(false)).toContain("text-zinc-500");
    expect(render(false)).not.toContain("text-red-700");
  });
});
