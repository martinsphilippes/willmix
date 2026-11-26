/**
 * Gera src/lib/project-management/plataforma-html.ts com o HTML da
 * Plataforma Wellmix v2 (docs/PROJECT_MANAGEMENT.md, "Atualizar a
 * plataforma"). Uso: node scripts/project-management-html.mjs <arquivo.html>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const src = process.argv[2];
if (!src) {
  console.error("Uso: node scripts/project-management-html.mjs <arquivo.html>");
  process.exit(1);
}
const html = readFileSync(resolve(src), "utf8");
const out = resolve(
  import.meta.dirname,
  "..",
  "src/lib/project-management/plataforma-html.ts",
);
writeFileSync(
  out,
  `// Gerado por scripts/project-management-html.mjs: não editar à mão.\n// Plataforma Wellmix v2 (docs/PROJECT_MANAGEMENT.md).\nexport const PLATAFORMA_HTML: string = ${JSON.stringify(html)};\n`,
);
console.log(`✓ ${out} (${html.length} caracteres)`);
