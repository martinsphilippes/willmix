import { describe, expect, it } from "vitest";
import { WELLMIX_FUNCTIONS } from "@/lib/db/schema";
import { functionDescription } from "@/lib/auth/function-access";
import { translator } from "@/i18n";

/*
 * Funções de fábrica (Equipe → Funções e acessos): toda função tem nome e
 * descrição nos três idiomas. A tela mostrava a chave crua
 * ("function.desc.comex_internal") quando a função nova veio sem descrição.
 */
describe("textos das funções de fábrica", () => {
  it("nome e descrição em pt, en e zh", () => {
    for (const locale of ["pt", "en", "zh"] as const) {
      const t = translator(locale);
      const translate = (k: string) => t(k as Parameters<typeof t>[0]);
      for (const key of WELLMIX_FUNCTIONS) {
        expect(
          translate(`function.${key}`),
          `${locale}: function.${key}`,
        ).not.toBe(`function.${key}`);
        expect(
          functionDescription(key, translate),
          `${locale}: function.desc.${key}`,
        ).toBeTruthy();
      }
    }
  });

  it("sem texto no dicionário (ou função criada), não mostra a chave crua", () => {
    const echo = (k: string) => k;
    expect(functionDescription("comex_internal", echo)).toBeNull();
    expect(
      functionDescription("fn_minha_funcao", (k) => `texto ${k}`),
    ).toBeNull();
    expect(
      functionDescription(
        "comex_internal",
        translator("pt") as (k: string) => string,
      ),
    ).toBe(
      "rastreia o container todo dia, da fábrica ao embarque; acompanha containers e fretes",
    );
  });
});
