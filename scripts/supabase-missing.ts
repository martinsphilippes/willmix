/*
 * Migração do Supabase a partir do supabase/schema.sql (docs/SUPABASE.md,
 * "Publicar o esquema"): recebe as colunas que já existem no banco e imprime
 * só o que falta (tabelas, colunas e índices, tudo com "if not exists").
 *
 * Uso: node scripts/supabase-missing.ts colunas.txt > faltando.sql
 * colunas.txt: "tabela.coluna" separados por espaço ou linha, saída de
 *   select string_agg(table_name || '.' || column_name, ' ')
 *   from information_schema.columns where table_schema = 'public';
 */
import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("Uso: node scripts/supabase-missing.ts colunas.txt");
  process.exit(1);
}
const existing = new Set(
  readFileSync(file, "utf8").split(/\s+/).filter(Boolean),
);
const existingTables = new Set([...existing].map((c) => c.split(".")[0]));
const sql = readFileSync("supabase/schema.sql", "utf8");

// Blocos por tabela: "create table ... );" seguido das linhas da tabela.
const out: string[] = [];
const touched = new Set<string>();
const lines = sql.split("\n");
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const create = line.match(/^create table if not exists public\."(\w+)"/);
  if (create && !existingTables.has(create[1])) {
    touched.add(create[1]);
    while (i < lines.length) {
      out.push(lines[i]);
      if (lines[i].startsWith(");")) break;
      i++;
    }
    continue;
  }
  const col = line.match(
    /^alter table public\."(\w+)" add column if not exists "(\w+)"/,
  );
  if (col && !existing.has(`${col[1]}.${col[2]}`)) {
    touched.add(col[1]);
    out.push(line);
    continue;
  }
  const rls = line.match(
    /^alter table public\."(\w+)" enable row level security/,
  );
  if (rls && !existingTables.has(rls[1])) out.push(line);
}
// Índices das tabelas que mudaram (if not exists: os que já existem não mudam).
for (const line of lines) {
  const idx = line.match(
    /^create (unique )?index if not exists "\w+" on public\."(\w+)"/,
  );
  if (idx && touched.has(idx[2])) out.push(line);
}
if (!out.length) {
  console.error("Nada faltando: o Supabase já está igual ao schema.sql.");
  process.exit(0);
}
console.log(
  "-- Gerado de supabase/schema.sql por scripts/supabase-missing.ts. Só adiciona.",
);
console.log(out.join("\n"));
