import { describe, expect, it } from "vitest";
import { specificationColumns } from "@/components/request-info-table";

describe("especificação em colunas", () => {
  it("cada linha 'Título: valor' vira uma coluna; linha solta vai para a coluna geral", () => {
    const cols = specificationColumns(
      "Categoria: Celular\nCor: Preto / PANTONE Black 2 C\n\nObservação livre\nMedidas do produto: 10 × 0,3 × 20 cm (C × L × A)",
      "Especificação",
    );
    expect(cols).toEqual([
      ["Categoria", "Celular"],
      ["Cor", "Preto / PANTONE Black 2 C"],
      ["Medidas do produto", "10 × 0,3 × 20 cm (C × L × A)"],
      ["Especificação", "Observação livre"],
    ]);
    expect(specificationColumns(null, "x")).toEqual([]);
  });
});
