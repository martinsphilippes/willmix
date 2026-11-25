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
      `create ${idx.type === "unique" ? "unique " : ""}index if not exists ${q(indexName(table, idx.key))} on public.${q(table)} (${cols})${idx.where ? ` where ${idx.where}` : ""};`,
    );
  }
  lines.push(
    `create index if not exists ${q(indexName(table, "created"))} on public.${q(table)} ("createdAt");`,
  );
  // As listas sempre ordenam por (campo, id) e paginam por offset
  // (SupabaseStore.list): sem índice nessa ordem, cada página de 1000 linhas
  // ordenava a tabela inteira (parceiros por nome: ~1 s por página, com
  // escrita em disco). Um índice por ordenação usada: criação e nome.
  lines.push(
    `create index if not exists ${q(indexName(table, "created_id"))} on public.${q(table)} ("createdAt", "id");`,
  );
  if ("name" in def.columns)
    lines.push(
      `create index if not exists ${q(indexName(table, "name_id"))} on public.${q(table)} ("name", "id");`,
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

/**
 * Peso bruto maior que o líquido no item do book (dono, 25/11/2026), também
 * no banco: gatilho que recusa a linha nova ou a troca de um dos pesos com
 * bruto ≤ líquido. Só confere quando um dos pesos muda: linhas antigas fora
 * da regra continuam aceitando as outras gravações (previsão, NCM) até a
 * correção do peso. A mesma regra do app: bookingWeightsOk
 * (src/lib/booking-lots.ts).
 */
export const BOOKING_WEIGHT_GUARD_SQL = `create or replace function public.booking_items_weight_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new."netWeightPcKg" is not distinct from old."netWeightPcKg"
     and new."grossWeightPcKg" is not distinct from old."grossWeightPcKg" then
    return new;
  end if;
  if new."grossWeightPcKg" is not null and new."netWeightPcKg" is not null
     and new."grossWeightPcKg" <= new."netWeightPcKg" then
    raise exception 'booking_gross_not_above_net' using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists booking_items_weight_guard on public."booking_items";
create trigger booking_items_weight_guard
  before insert or update on public."booking_items"
  for each row execute function public.booking_items_weight_guard();`;

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
    BOOKING_WEIGHT_GUARD_SQL,
    "",
    BUCKET_SQL,
    "",
  ].join("\n");
}
