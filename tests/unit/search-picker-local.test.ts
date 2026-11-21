import { describe, expect, it } from "vitest";
import {
  filterSearchOptions,
  searchOptionSummary,
  type SearchOption,
} from "@/components/search-picker";

/*
 * Buscador único dos formulários (dono, 21/11/2026): a lista local busca
 * como a do banco (palavras soltas, em qualquer ordem, sem acento) e o
 * escolhido aparece como "Código - Item".
 */
describe("buscador com lista local", () => {
  const options: SearchOption[] = [
    { id: "10", name: "JOÃO DA SILVA", code: "1201", group: "Do cliente" },
    { id: "11", name: "MARIA SOUZA", code: "1305", group: "Outros" },
    { id: "12", name: "Pedro", code: null },
    { id: "CHINA|45", name: "CHINA - NINGBO", keywords: "china" },
  ];
  it("palavras em qualquer ordem, sem acento nem caixa, também pelo código", () => {
    const ids = (q: string) => filterSearchOptions(options, q).map((o) => o.id);
    expect(ids("silva joao")).toEqual(["10"]);
    expect(ids("1305")).toEqual(["11"]);
    expect(ids("ningbo")).toEqual(["CHINA|45"]);
    expect(ids("outros")).toEqual(["11"]);
    expect(ids("")).toHaveLength(4);
    expect(ids("maria pedro")).toEqual([]);
  });
  it("Código - Item; sem código, só o item", () => {
    expect(searchOptionSummary(options[0])).toBe("1201 - JOÃO DA SILVA");
    expect(searchOptionSummary(options[2])).toBe("Pedro");
  });
});
