import {
  BUCKET_ID,
  BUCKET_MAX_BYTES,
  TABLES,
  type ColumnDef,
  type TableName,
} from "./schema.ts";

/*
 * Esquema do Postgres (Supabase) gerado de src/lib/db/schema.ts, como o
 * appwrite.config.json. Só adiciona: tabela, coluna e índice com
 * "if not exists"; rodar de novo não muda nada do que já existe (mesma regra
 * do "Publicar esquema Appwrite"). Arquivo gerado: supabase/schema.sql
 * (npm run supabase:sql).
 *
 * - Colunas com o nome do portal (camelCase entre aspas) e id/createdAt/
 *   updatedAt em toda tabela.
 * - Tipos: texto → text (o tamanho do Appwrite fica só na validação do app),
 *   int → bigint, float → double precision, bool → boolean, datetime →
 *   timestamptz, json → jsonb. Sem NOT NULL além do id: linhas antigas do
 *   Appwrite podem vir com obrigatórias vazias e a cópia não pode falhar.
 * - RLS ligado e nenhuma política: só o servidor (chave service_role) lê e
 *   grava, como no Appwrite (toda escrita passa por Server Action).
 * - next_number(): contador atômico (numeração de pedidos e solicitações).
 */

const q = (name: string) => `"${name.replace(/"/g, '""')}"`;

export function pgType(def: ColumnDef): string {
  switch (def.type) {
    case "string":
    case "text":
      return "text";
    case "int":
      return "bigint";
    case "float":
      return "double precision";
    case "bool":
      return "boolean";
    case "datetime":
      return "timestamptz";
    case "json":
    case "json_large":
      return "jsonb";
  }
}

/** Nome curto e estável do índice (Postgres corta em 63 caracteres). */
function indexName(table: string, key: string) {
  return `${table}_${key}`.slice(0, 63);
}

export function tableSql(table: TableName): string {
  const def = TABLES[table];
  const lines = [
    `create table if not exists public.${q(table)} (`,
    `  "id" text primary key,`,
    `  "createdAt" timestamptz not null default now(),`,
    `  "updatedAt" timestamptz not null default now()`,
    `);`,
    `alter table public.${q(table)} enable row level security;`,
  ];
  for (const [col, c] of Object.entries(def.columns))
    lines.push(
      `alter table public.${q(table)} add column if not exists ${q(col)} ${pgType(c)};`,
    );
  for (const idx of def.indexes ?? []) {
    const cols = idx.columns.map((c) => q(c)).join(", ");
    lines.push(
      `create ${idx.type === "unique" ? "unique " : ""}index if not exists ${q(indexName(table, idx.key))} on public.${q(table)} (${cols});`,
    );
  }
  lines.push(
    `create index if not exists ${q(indexName(table, "created"))} on public.${q(table)} ("createdAt");`,
  );
  return lines.join("\n");
}

export const NEXT_NUMBER_SQL = `create or replace function public.next_number(counter_key text)
returns bigint
language sql
security definer
set search_path = public
as $$
  insert into public.counters ("id", "key", "value")
  values (gen_random_uuid()::text, counter_key, 1)
  on conflict ("key") do update
    set "value" = public.counters."value" + 1, "updatedAt" = now()
  returning "value";
$$;
revoke all on function public.next_number(text) from public, anon, authenticated;
grant execute on function public.next_number(text) to service_role;`;

/** Bucket privado dos arquivos (só quando o schema storage existe: Supabase). */
export const BUCKET_SQL = `do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit)
    values ('${BUCKET_ID}', '${BUCKET_ID}', false, ${BUCKET_MAX_BYTES})
    on conflict (id) do nothing;
  end if;
end $$;`;

export function schemaSql(): string {
  const tables = Object.keys(TABLES) as TableName[];
  return [
    "-- Gerado por npm run supabase:sql a partir de src/lib/db/schema.ts. Não edite.",
    "-- Só adiciona (if not exists): pode rodar de novo a qualquer momento.",
    "",
    ...tables.map((t) => tableSql(t) + "\n"),
    NEXT_NUMBER_SQL,
    "",
    BUCKET_SQL,
    "",
  ].join("\n");
}
