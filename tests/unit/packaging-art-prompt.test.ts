import { describe, expect, it } from "vitest";
import {
  ART_PROMPT_WISH_MAX,
  buildArtPrompt,
} from "@/lib/packaging-art-prompt";

const base = {
  intro: "Crie a arte da embalagem.",
  wishLabel: "O que você quer na arte",
  closing: "Regras: não invente dados.",
};

describe("prompt da arte da embalagem", () => {
  it("junta os dados do briefing com o que a pessoa escreveu", () => {
    const prompt = buildArtPrompt({
      ...base,
      facts: [
        ["Produto", "STONE MARBLE 6X8"],
        ["Quantidade", "2.400 un"],
        ["Especificação", "Material: PS+PVC\r\n  Cor: White / Gray \n\n"],
      ],
      wish: "  Fundo claro, marca Wellmix na frente  ",
    });
    expect(prompt).toBe(
      [
        "Crie a arte da embalagem.",
        "Produto: STONE MARBLE 6X8\nQuantidade: 2.400 un\nEspecificação:\n  Material: PS+PVC\n  Cor: White / Gray",
        "O que você quer na arte: Fundo claro, marca Wellmix na frente",
        "Regras: não invente dados.",
      ].join("\n\n"),
    );
  });

  it("dado vazio fica de fora (nada é inventado) e sem pedido o prompt ainda sai", () => {
    const prompt = buildArtPrompt({
      ...base,
      facts: [
        ["Produto", "Copo"],
        ["Caixa master", null],
        ["Material", "   "],
        ["Pantone", undefined],
      ],
      wish: "",
    });
    expect(prompt).toBe(
      "Crie a arte da embalagem.\n\nProduto: Copo\n\nRegras: não invente dados.",
    );
  });

  it("o texto livre tem limite", () => {
    const prompt = buildArtPrompt({
      ...base,
      facts: [],
      wish: "a".repeat(ART_PROMPT_WISH_MAX + 50),
    });
    expect(prompt).toContain("a".repeat(ART_PROMPT_WISH_MAX));
    expect(prompt).not.toContain("a".repeat(ART_PROMPT_WISH_MAX + 1));
  });
});
