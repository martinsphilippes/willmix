import { describe, expect, it } from "vitest";
import { translator } from "@/i18n";
import { SCREEN_ROUTES } from "@/lib/auth/screens";
import { TRAINING_PATH } from "@/lib/training";

/*
 * Treinamento do Portal (dono, 16/11/2026; docs/TRAINING.md): o capelo da
 * barra vermelha e a página, nos três idiomas, aberta a todo login.
 */
describe("Treinamento do Portal", () => {
  it("o texto do ícone e o título nos três idiomas", () => {
    const pt = translator("pt");
    expect(pt("nav.training")).toBe("Treinamento do Portal");
    expect(pt("training.title")).toBe("Treinamento do Portal");
    const en = translator("en");
    expect(en("nav.training")).toBe("Portal Training");
    expect(en("training.title")).toBe("Portal Training");
    const zh = translator("zh");
    expect(zh("nav.training")).toBe("门户培训");
    expect(zh("training.title")).toBe("门户培训");
  });

  it("fica fora do controle de telas: nenhuma caixa de acesso tira a página", () => {
    expect(TRAINING_PATH).toBe("/app/training");
    expect(
      SCREEN_ROUTES.some(
        ([route]) =>
          route === TRAINING_PATH || route.startsWith(`${TRAINING_PATH}/`),
      ),
    ).toBe(false);
  });
});
