import "server-only";

import { isAdmin } from "@/lib/auth/permissions";
import type { User } from "@/lib/db";
import { isColumnName, type LookupKind } from "@/lib/product-registration";
import { audit } from "./audit";

/*
 * Listas do Sankhya para o Cadastrar produto (dono, 27/11/2026;
 * docs/PRODUCT_REGISTRATION.md, "Listas do Sankhya"): as opções de Cód.
 * Linha, Cód. Tipo Embalagem, Unidade padrão, Unid. Compra, Marca, Marca
 * Wellmix e País de origem vêm do próprio Sankhya, e quem cadastra escolhe
 * digitando. O Grupo vem da árvore de grupos (TGFGRU,
 * `sankhyaProductGroups`).
 *
 * De onde vem cada lista: as tabelas padrão do Sankhya são conhecidas
 * (TGFVOL, TGFMAR, TSIPAI); as personalizadas (AD_*) são achadas no
 * dicionário (a ligação do campo da TGFPRO com a tabela dele) e o
 * administrador corrige na tela ("TABELA.CODIGO.NOME"). As listas ficam
 * guardadas no portal por 12 horas (`sankhya.productLookups`); o botão
 * "Atualizar as listas do Sankhya" lê de novo.
 */

export interface LookupOption {
  code: string;
  name: string;
}

export interface LookupSource {
  table: string;
  code: string;
  name: string;
}

export interface LookupList {
  source: LookupSource | null;
  options: LookupOption[];
  error: string | null;
}

export type ListKind = Exclude<LookupKind, "group">;
export const LIST_KINDS: readonly ListKind[] = [
  "line",
  "packageType",
  "unit",
  "brand",
  "brandWellmix",
  "country",
];

export interface RegistrationLookups {
  loadedAt: string | null;
  lists: Partial<Record<ListKind, LookupList>>;
}

const CACHE_KEY = "sankhya.productLookups";
const SOURCES_KEY = "sankhya.productLookupSources";
const TTL_MS = 12 * 60 * 60 * 1000;
const MAX_OPTIONS = 5000;

/** Coluna da TGFPRO de cada lista (para achar a tabela no dicionário). */
export const LIST_COLUMN: Record<ListKind, string> = {
  line: "AD_CODLINHA",
  packageType: "AD_CODTIPOEMB",
  unit: "CODVOL",
  brand: "CODMARCA",
  brandWellmix: "AD_CODMARCAWELL",
  country: "CODPAIS",
};

/** Tabelas padrão do Sankhya (as AD_ são achadas no dicionário). */
const KNOWN: Partial<Record<ListKind, LookupSource>> = {
  unit: { table: "TGFVOL", code: "CODVOL", name: "DESCRVOL" },
  brand: { table: "TGFMAR", code: "CODIGO", name: "DESCRICAO" },
  country: { table: "TSIPAI", code: "CODPAIS", name: "DESCRICAO" },
};

/** "TABELA.CODIGO.NOME" → a fonte (nomes só com letras, números e "_"). */
export function parseSource(
  raw: string | null | undefined,
): LookupSource | null {
  const parts = (raw ?? "").trim().toUpperCase().split(".");
  if (parts.length !== 3 || !parts.every((p) => isColumnName(p))) return null;
  return { table: parts[0], code: parts[1], name: parts[2] };
}

export const sourceText = (s: LookupSource | null | undefined) =>
  s ? `${s.table}.${s.code}.${s.name}` : "";

async function settings() {
  return import("@/lib/integrations/sankhya-settings");
}

export async function readLookupSources(): Promise<
  Partial<Record<ListKind, string>>
> {
  const { readSetting } = await settings();
  return (
    (await readSetting<Partial<Record<ListKind, string>>>(SOURCES_KEY)) ?? {}
  );
}

export async function readLookups(): Promise<RegistrationLookups> {
  const { readSetting } = await settings();
  return (
    (await readSetting<RegistrationLookups>(CACHE_KEY)) ?? {
      loadedAt: null,
      lists: {},
    }
  );
}

const text = (v: unknown) => (v == null ? "" : String(v).trim());
const errorText = (error: unknown) => {
  const e = error as { code?: string; detail?: string; message?: string };
  return `${e.code ?? "error"}: ${e.detail ?? e.message ?? String(error)}`.slice(
    0,
    300,
  );
};

/**
 * Tabela da lista de um campo personalizado, pelo dicionário do Sankhya: a
 * ligação do campo da TGFPRO (TDDLGC) leva à tabela e ao campo de destino;
 * o nome é a primeira coluna de texto "DESCR…"/"NOME…" da tabela.
 */
async function discover(column: string): Promise<LookupSource | null> {
  const { executeQuery } = await import("@/lib/integrations/sankhya-client");
  const link = await executeQuery(
    [
      "SELECT TOP 1 I.NOMETAB AS TABELA, CD.NOMECAMPO AS CAMPO",
      "FROM TDDLGC L",
      "JOIN TDDCAM CO ON CO.NUCAMPO = L.NUCAMPOORIG",
      "JOIN TDDCAM CD ON CD.NUCAMPO = L.NUCAMPODEST",
      "JOIN TDDINS I ON I.NUINSTANCIA = L.NUINSTDEST",
      `WHERE CO.NOMETAB = 'TGFPRO' AND CO.NOMECAMPO = '${column}'`,
    ].join(" "),
  );
  const table = text(link.rows[0]?.TABELA).toUpperCase();
  const code = text(link.rows[0]?.CAMPO).toUpperCase();
  if (!isColumnName(table) || !isColumnName(code)) return null;
  const fields = await executeQuery(
    `SELECT NOMECAMPO, TIPCAMPO FROM TDDCAM WHERE NOMETAB = '${table}' ORDER BY NOMECAMPO`,
  );
  const texts = fields.rows
    .filter((r) => text(r.TIPCAMPO) === "S")
    .map((r) => text(r.NOMECAMPO).toUpperCase())
    .filter((c) => isColumnName(c) && c !== code);
  const name =
    texts.find((c) => c === "DESCRICAO" || c === "NOME" || c === "DESCR") ??
    texts.find((c) => c.startsWith("DESCR")) ??
    texts.find((c) => c.startsWith("NOME")) ??
    texts[0];
  return name ? { table, code, name } : null;
}

async function loadList(source: LookupSource): Promise<LookupOption[]> {
  const { executeQuery } = await import("@/lib/integrations/sankhya-client");
  const result = await executeQuery(
    `SELECT TOP ${MAX_OPTIONS} ${source.code} AS CODIGO, ${source.name} AS NOME FROM ${source.table} ORDER BY ${source.name}`,
  );
  const seen = new Set<string>();
  const out: LookupOption[] = [];
  for (const row of result.rows) {
    const raw = text(row.CODIGO);
    // Código numérico sem os zeros e decimais que o banco devolve ("21.0").
    const n = Number(raw);
    const code =
      raw && Number.isFinite(n) && /^[\d.]+$/.test(raw) ? String(n) : raw;
    if (!code || seen.has(code)) continue;
    seen.add(code);
    out.push({ code, name: text(row.NOME) || code });
  }
  return out;
}

/**
 * As listas, da cópia do portal; vencida (12 h) ou pedida de novo, lidas do
 * Sankhya (com a credencial). Uma lista que falha fica com o erro e as
 * opções da leitura anterior.
 */
export async function registrationLookups(
  options: { refresh?: boolean } = {},
): Promise<RegistrationLookups> {
  const cached = await readLookups();
  const fresh =
    cached.loadedAt && Date.now() - Date.parse(cached.loadedAt) < TTL_MS;
  if (fresh && !options.refresh) return cached;
  const { getSankhyaConfigStatus } = await settings();
  if (!(await getSankhyaConfigStatus()).config) return cached;
  const overrides = await readLookupSources();
  const lists: RegistrationLookups["lists"] = {};
  for (const kind of LIST_KINDS) {
    const before = cached.lists[kind];
    let source: LookupSource | null =
      parseSource(overrides[kind]) ?? KNOWN[kind] ?? null;
    try {
      source ??= await discover(LIST_COLUMN[kind]);
      if (!source) {
        lists[kind] = {
          source: null,
          options: before?.options ?? [],
          error: "source_not_found",
        };
        continue;
      }
      lists[kind] = { source, options: await loadList(source), error: null };
    } catch (error) {
      lists[kind] = {
        source,
        options: before?.options ?? [],
        error: errorText(error),
      };
    }
  }
  const out: RegistrationLookups = {
    loadedAt: new Date().toISOString(),
    lists,
  };
  const { writeSetting } = await settings();
  await writeSetting(CACHE_KEY, out);
  return out;
}

/** Fonte de cada lista escolhida pelo administrador ("TABELA.CODIGO.NOME"). */
export async function saveLookupSources(
  user: User,
  raw: Partial<Record<string, string>>,
): Promise<void> {
  if (!isAdmin(user)) throw new Error("registration_admin_only");
  const out: Partial<Record<ListKind, string>> = {};
  for (const kind of LIST_KINDS) {
    const v = (raw[kind] ?? "").trim();
    if (!v) continue;
    const source = parseSource(v);
    if (!source) throw new Error("registration_source_invalid");
    out[kind] = sourceText(source);
  }
  const { writeSetting } = await settings();
  const before = await readLookupSources();
  await writeSetting(SOURCES_KEY, out);
  await audit(
    user,
    "product_registration.lookup_sources",
    "settings",
    SOURCES_KEY,
    `Tabelas das listas do cadastro de produto: ${Object.keys(out).length}`,
    before,
    out,
  );
}

/** Nome de um código numa lista (vazio quando não está nela). */
export function lookupName(
  lookups: RegistrationLookups,
  kind: ListKind,
  code: string,
): string | null {
  return (
    lookups.lists[kind]?.options.find((o) => o.code === code)?.name ?? null
  );
}
