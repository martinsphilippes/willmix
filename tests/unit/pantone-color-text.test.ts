import { describe, expect, it } from "vitest";
import { cutAtSeparator, syncColorText } from "@/lib/pantone/color-text";

/* "Cor / sortimento" acompanha o seletor Pantone sem mexer no que foi escrito à mão. */
const c = (code: string) => ({ code });

describe("syncColorText", () => {
  it("campo vazio: as cores escolhidas entram na ordem, separadas por /", () => {
    expect(syncColorText("", [], [c("100 U")])).toBe("PANTONE 100 U");
    expect(
      syncColorText("PANTONE 100 U", [c("100 U")], [c("100 U"), c("186 C")]),
    ).toBe("PANTONE 100 U / PANTONE 186 C");
  });

  it("texto escrito à mão fica igual; a cor nova vai para o fim", () => {
    expect(syncColorText("BRANCO / PRETO", [], [c("Cool Gray 11 C")])).toBe(
      "BRANCO / PRETO / PANTONE Cool Gray 11 C",
    );
    // Barras sem espaço e "1/2" não são reescritos.
    expect(syncColorText("P/B", [], [c("185 C")])).toBe("P/B / PANTONE 185 C");
    expect(syncColorText("AZUL 1/2", [], [])).toBe("AZUL 1/2");
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
    expect(
      syncColorText(
        "PANTONE 100 U / PANTONE 186 C",
        [c("100 U"), c("186 C")],
        [c("186 C")],
      ),
    ).toBe("PANTONE 186 C");
    expect(syncColorText("PANTONE 100 U/BRANCO", [c("100 U")], [])).toBe(
      "BRANCO",
    );
    // Removido à mão antes: remover a cor não acrescenta nada.
    expect(syncColorText("AZUL", [c("185 C"), c("186 C")], [c("186 C")])).toBe(
      "AZUL",
    );
  });

  it("só a cor nova entra: a que a pessoa tirou ou citou à mão não volta", () => {
    expect(
      syncColorText(
        "VERMELHO (PANTONE 185 C)",
        [c("185 C")],
        [c("185 C"), c("186 C")],
      ),
    ).toBe("VERMELHO (PANTONE 185 C) / PANTONE 186 C");
    expect(
      syncColorText("BRANCO", [c("100 U")], [c("100 U"), c("186 C")]),
    ).toBe("BRANCO / PANTONE 186 C");
    // Cor nova já citada dentro do texto não é repetida.
    expect(syncColorText("AZUL (PANTONE 186 C)", [], [c("186 C")])).toBe(
      "AZUL (PANTONE 186 C)",
    );
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
    // Texto perto do limite: a cor que não cabe fica só no seletor.
    const near = "AZUL/BRANCO/VERMELHO/PRETO/VERDE/AMARELO/ROSA/CINZA";
    expect(syncColorText(near, [], [c("185 C")], 60)).toBe(near);
  });

  it("citação dentro de outro texto não é apagada", () => {
    expect(
      syncColorText("BRANCO (PANTONE 11-0601 TCX)", [c("11-0601 TCX")], []),
    ).toBe("BRANCO (PANTONE 11-0601 TCX)");
    // 100 U não casa com "100 UV".
    expect(syncColorText("PANTONE 100 UV", [c("100 U")], [])).toBe(
      "PANTONE 100 UV",
    );
  });
});

describe("cutAtSeparator", () => {
  it("corta entre trechos, sem partir um código", () => {
    expect(
      cutAtSeparator(
        "PANTONE 19-4052 TCX / PANTONE 11-0601 TCX / PANTONE 185 C",
        45,
      ),
    ).toBe("PANTONE 19-4052 TCX / PANTONE 11-0601 TCX");
    expect(cutAtSeparator("curto", 60)).toBe("curto");
    expect(cutAtSeparator("x".repeat(70), 60)).toBe("x".repeat(60));
  });
});
