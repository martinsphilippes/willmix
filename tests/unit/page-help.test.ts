import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

/*
 * Caixa "Como funciona" de todas as telas: começa recolhida (a tela abre direto
 * no trabalho) e mostra "Ver" para abrir, nas três línguas.
 */
const { PageHelp, PAGE_HELP_ENABLED } = await import("@/components/page-help");
const { PageHeader } = await import("@/components/ui");
const { translator } = await import("@/i18n");

describe("caixa Como funciona", () => {
  it("não aparece em nenhuma tela: o cabeçalho das páginas não a mostra (pedido do dono)", () => {
    expect(PAGE_HELP_ENABLED).toBe(false);
    const html = renderToStaticMarkup(
      createElement(PageHeader, {
        t: translator("pt"),
        title: "Pedidos",
        help: { body: "help.finance.body", steps: "help.finance.steps" },
      }),
    );
    expect(html).toContain("Pedidos");
    expect(html).not.toContain("data-page-help");
    expect(html).not.toContain("Como funciona");
  });

  // O componente e os textos ficam guardados (para voltar, basta ligar).
  it("começa recolhida, com o título e o convite para abrir", () => {
    for (const [locale, how, show] of [
      ["pt", "Como funciona", "Ver"],
      ["en", "How it works", "Show"],
      ["zh", "运作方式", "查看"],
    ] as const) {
      const html = renderToStaticMarkup(
        createElement(PageHelp, {
          t: translator(locale),
          help: { body: "help.finance.body", steps: "help.finance.steps" },
        }),
      );
      expect(html).toMatch(/^<details data-page-help=""/);
      expect(html).not.toMatch(/<details[^>]*\bopen\b/);
      expect(html).toContain(how);
      expect(html).toContain(show);
      // O texto continua lá (abre sem ir ao servidor).
      expect(html).toContain(
        translator(locale)("help.finance.body").slice(0, 20),
      );
    }
  });
});
