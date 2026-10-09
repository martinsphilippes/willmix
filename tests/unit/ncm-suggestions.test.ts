import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/* Sugestões de NCM para o campo da ficha: cadastro do produto primeiro,
   depois classificações (validadas antes das sugeridas), depois palavras-chave;
   sem repetição e com as alíquotas quando a tabela tem. */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const svc = await import("@/lib/services/ncm-suggestions");
const taxes = await import("@/lib/services/taxes");
const { translator } = await import("@/i18n");
type User = import("@/lib/db").User;

let admin: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
});

describe("sugestões de NCM na ficha", () => {
  it("sem produto, nada; sem tabela fiscal, as posições por palavra-chave não viram chip", async () => {
    expect(await svc.ncmSuggestionsFor(null)).toEqual([]);
    // "panela" casa a posição 7615.10 (6 dígitos): só vira NCM completo com a tabela.
    expect(await svc.ncmSuggestionsFor("prod-panela")).toEqual([]);
  });

  it("NCM do cadastro vem primeiro; classificação registrada aparece", async () => {
    const store = getStore();
    await store.update("products", "prod-jarra", { ncm: "70133700" });
    await taxes.addTaxCandidate(admin, "prod-jarra", {
      ncm: "70139900",
      description: "Outros objetos de vidro",
      source: "manual",
      sourceRef: null,
    });
    const chips = await svc.ncmSuggestionsFor("prod-jarra");
    expect(new Set(chips.map((c) => c.ncm)).size).toBe(chips.length);
    for (const c of chips) expect(c.ncm).toMatch(/^\d{8}$/);
    expect(chips[0]).toMatchObject({ ncm: "70133700", source: "product" });
    expect(
      chips.some((c) => c.ncm === "70139900" && c.source === "suggested"),
    ).toBe(true);
    const view = svc.ncmChipsView(translator("pt"), chips.slice(0, 1));
    expect(view[0].label).toBe("7013.37.00");
  });
});
