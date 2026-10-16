import { describe, expect, it } from "vitest";
import { syncColorText } from "@/lib/pantone/color-text";

/* "Cor / sortimento" acompanha o seletor Pantone sem apagar o que foi escrito à mão. */
const c = (code: string) => ({ code });

describe("syncColorText", () => {
  it("campo vazio: as cores escolhidas entram na ordem, separadas por /", () => {
    expect(syncColorText("", [], [c("100 U")])).toBe("PANTONE 100 U");
    expect(
      syncColorText("PANTONE 100 U", [c("100 U")], [c("100 U"), c("186 C")]),
    ).toBe("PANTONE 100 U / PANTONE 186 C");
  });

  it("texto escrito à mão fica; a cor nova vai para o fim", () => {
    expect(syncColorText("BRANCO / PRETO", [], [c("Cool Gray 11 C")])).toBe(
      "BRANCO / PRETO / PANTONE Cool Gray 11 C",
    );
  });

  it("remover a cor tira só o trecho dela", () => {
    expect(
      syncColorText(
        "BRANCO / PANTONE 100 U / PANTONE 186 C",
        [c("100 U"), c("186 C")],
        [c("186 C")],
      ),
    ).toBe("BRANCO / PANTONE 186 C");
    expect(syncColorText("PANTONE 100 U", [c("100 U")], [])).toBe("");
  });

  it("não duplica (maiúsculas e espaços não importam) e não passa do tamanho máximo", () => {
    expect(syncColorText("pantone  100 u", [], [c("100 U")])).toBe(
      "pantone  100 u",
    );
    const long = syncColorText(
      "",
      [],
      [c("19-4052 TCX"), c("11-0601 TCX"), c("Reflex Blue C")],
      45,
    );
    expect(long).toBe("PANTONE 19-4052 TCX / PANTONE 11-0601 TCX");
    expect(long.length).toBeLessThanOrEqual(45);
  });

  it("trecho que só cita a cor (ex.: BRANCO (PANTONE 11-0601 TCX)) não é apagado", () => {
    expect(
      syncColorText("BRANCO (PANTONE 11-0601 TCX)", [c("11-0601 TCX")], []),
    ).toBe("BRANCO (PANTONE 11-0601 TCX)");
  });
});
