import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * Chave de texto repetida entre módulos sobrescreve a outra em silêncio (o
 * último módulo vence). Cada chave em pt deve existir em um só arquivo.
 */
describe("dicionários", () => {
  it("nenhuma chave em pt aparece em mais de um arquivo", () => {
    const dir = "src/i18n/modules";
    const files = [
      "src/i18n/dictionaries.ts",
      ...readdirSync(dir)
        .filter((f) => f.endsWith(".ts") && f !== "index.ts")
        .map((f) => join(dir, f)),
    ];
    const seen = new Map<string, string>();
    const dups: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      const block = /export const pt[^=]*=\s*\{([\s\S]*?)\n\};/.exec(text);
      if (!block) continue;
      for (const [, key] of block[1].matchAll(/^\s*"([^"]+)":/gm)) {
        const first = seen.get(key);
        if (first && first !== file) dups.push(`${key} (${first}, ${file})`);
        else seen.set(key, file);
      }
    }
    expect(seen.size).toBeGreaterThan(500);
    expect(dups).toEqual([]);
  });
});
