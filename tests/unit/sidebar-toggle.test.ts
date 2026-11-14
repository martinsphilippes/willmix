import { describe, expect, it, vi } from "vitest";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({ usePathname: () => "/app" }));

const { AppSidebar } = await import("@/components/app-nav");

/*
 * Botão de recolher e expandir o menu lateral (dono, 14/11/2026): no iPad, no
 * fim da página, a barra "sticky" subia e o botão ficava embaixo do
 * cabeçalho. A barra passa a ser fixa abaixo do cabeçalho, com o espaço dela
 * guardado na linha; o botão tem área própria no alto. Que nada o cobre ao
 * rolar e ao alternar é do navegador (tests/e2e/sidebar-toggle.spec.ts);
 * aqui, o que a página entrega (aberta, como vem do servidor).
 */
type Props = ComponentProps<typeof AppSidebar>;
const html = renderToStaticMarkup(
  createElement(AppSidebar, {
    entries: [],
    footer: [],
    labels: {
      main: "Menu principal",
      collapse: "Recolher menu",
      expand: "Expandir menu",
    },
  } as Props),
);

describe("menu lateral: barra fixa e botão de recolher", () => {
  it("a barra fica fixa abaixo do cabeçalho, com o espaço dela na linha", () => {
    const aside = html.match(/<aside[^>]*>/)?.[0] ?? "";
    for (const c of ["fixed", "top-(--wm-header)", "bottom-0", "w-64"])
      expect(aside).toContain(c);
    expect(aside).not.toContain("sticky");
    // O lugar na linha vem antes da barra, com a mesma largura.
    expect(html).toMatch(
      /<div aria-hidden="true" data-sidebar-space="true" class="[^"]*\bw-64\b[^"]*"><\/div><aside/,
    );
  });

  it("o botão tem área própria no alto, à direita da barra aberta, 44 px e o rótulo", () => {
    expect(html).toMatch(
      /<aside[^>]*><div class="[^"]*\bjustify-end\b[^"]*" data-sidebar-toggle-area="true"><button/,
    );
    const button = html.match(/<button[^>]*data-sidebar-toggle[^>]*>/)?.[0];
    expect(button).toContain('aria-label="Recolher menu"');
    expect(button).toContain('title="Recolher menu"');
    expect(button).toContain("h-11 w-11");
  });
});
