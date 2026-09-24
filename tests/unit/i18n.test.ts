import { describe, expect, it } from "vitest";
import { dictionaries, pt } from "@/i18n/dictionaries";

describe("dicionários", () => {
  it("en e zh têm todas as chaves de pt", () => {
    const keys = Object.keys(pt);
    for (const locale of ["en", "zh"] as const) {
      const missing = keys.filter((k) => !(k in dictionaries[locale]));
      expect(missing, `${locale} sem chaves`).toEqual([]);
    }
  });
});
