import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

/*
 * Caixa "Como funciona" de todas as telas: começa recolhida (a tela abre direto
 * no trabalho) e mostra "Ver" para abrir, nas três línguas.
 */
const { PageHelp } = await import("@/components/page-help");
const { translator } = await import("@/i18n");

describe("caixa Como funciona", () => {
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
