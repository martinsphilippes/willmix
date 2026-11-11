import "server-only";

import { getStore, TABLES, type TableName, type User } from "@/lib/db";
import { isAdmin } from "@/lib/auth/permissions";
import { dataMode } from "@/lib/env";
import { audit } from "./audit";

/*
 * Cópia Appwrite → Supabase (docs/SUPABASE.md, etapa 4). Roda no próprio
 * portal (Configurações → Supabase), que já tem as chaves dos dois lados:
 * 1. tabelas: todas, em lotes, com o mesmo id e as datas de origem (upsert:
 *    rodar de novo atualiza, não duplica);
 * 2. arquivos: cada documento com a mesma chave no Supabase Storage;
 * 3. contas: cada usuário ativo ganha a conta no Supabase Auth (sem senha:
 *    a pessoa define pelo link do e-mail).
 * Cada chamada trabalha até o limite de tempo e guarda onde parou
 * (settings `supabase.copy`). Só antes da virada (DATA_MODE ≠ supabase).
 */

const KEY = "supabase.copy";
const TABLE_PAGE = 500;
const FILE_PAGE = 25;
const USER_PAGE = 100;

export type CopyPhase = "tables" | "files" | "accounts" | "done";

export interface CopyProgress {
  phase: CopyPhase;
  tableIndex: number;
  cursor: string | null;
  rows: Record<string, number>;
  files: { copied: number; existing: number; missing: number };
  accounts: { created: number; existing: number; failed: number };
  errors: string[];
  startedAt: string | null;
  updatedAt: string | null;
}

const EMPTY: CopyProgress = {
  phase: "tables",
  tableIndex: 0,
  cursor: null,
  rows: {},
  files: { copied: 0, existing: 0, missing: 0 },
  accounts: { created: 0, existing: 0, failed: 0 },
  errors: [],
  startedAt: null,
  updatedAt: null,
};

type Row = Record<string, unknown> & { id: string };

/** Origem (Appwrite) e destino (Supabase): o que a cópia usa de cada um. */
export interface CopySource {
  listPage(
    table: TableName,
    after: string | null,
    limit: number,
  ): Promise<Row[]>;
  getFile(key: string): Promise<{ bytes: Uint8Array; mime: string } | null>;
}
export interface CopyTarget {
  upsertRaw(table: TableName, rows: Row[]): Promise<void>;
  statFile(key: string): Promise<unknown | null>;
  putFileAt(key: string, bytes: Uint8Array, mime: string): Promise<void>;
  clearTable(table: TableName): Promise<void>;
}
export interface CopyAuth {
  ensureUser(email: string, name: string): Promise<"created" | "existing">;
}

export interface CopyDeps {
  source: CopySource;
  target: CopyTarget;
  auth: CopyAuth;
}

/** Os dois lados a partir das variáveis da Vercel. */
async function defaultDeps(): Promise<CopyDeps> {
  const { publicEnv, serverEnv, supabaseEnv } = await import("@/lib/env");
  const env = serverEnv();
  const supa = supabaseEnv();
  if (!publicEnv || !env.success) throw new Error("appwrite_not_configured");
  if (!supa) throw new Error("supabase_not_configured");
  const { AppwriteStore } = await import("@/lib/db/appwrite-store");
  const { SupabaseStore } = await import("@/lib/db/supabase-store");
  const { supabaseEnsureUser } = await import("@/lib/auth/supabase-auth");
  const source = new AppwriteStore(
    publicEnv.NEXT_PUBLIC_APPWRITE_ENDPOINT,
    publicEnv.NEXT_PUBLIC_APPWRITE_PROJECT_ID,
    env.data.APPWRITE_API_KEY,
  );
  const target = new SupabaseStore(supa.url, supa.key);
  return {
    source: {
      listPage: (t, after, limit) =>
        source.listPage(t, after, limit) as unknown as Promise<Row[]>,
      getFile: (key) => source.getFile(key),
    },
    target: {
      upsertRaw: (t, rows) => target.upsertRaw(t, rows),
      statFile: (key) => target.statFile(key),
      putFileAt: (key, bytes, mime) => target.putFileAt(key, bytes, mime),
      clearTable: (t) => target.clearTable(t),
    },
    auth: { ensureUser: supabaseEnsureUser },
  };
}

async function readProgress(): Promise<CopyProgress> {
  const [row] = await getStore().list("settings", {
    filter: { key: KEY },
    limit: 1,
  });
  return { ...EMPTY, ...((row?.value as Partial<CopyProgress>) ?? {}) };
}

async function writeProgress(progress: CopyProgress) {
  const store = getStore();
  const [row] = await store.list("settings", {
    filter: { key: KEY },
    limit: 1,
  });
  if (row) await store.update("settings", row.id, { value: progress });
  else await store.create("settings", { key: KEY, value: progress });
}

export const getCopyProgress = readProgress;

function assertCanCopy(user: User) {
  if (!isAdmin(user)) throw new Error("forbidden");
  // Depois da virada o portal já lê o Supabase: copiar de novo apagaria
  // o que foi feito nele.
  if (dataMode() === "supabase") throw new Error("already_on_supabase");
}

const TABLE_LIST = Object.keys(TABLES) as TableName[];

/** Trabalha até `budgetMs` e devolve onde parou. */
export async function runCopy(
  user: User,
  { budgetMs = 40_000, deps }: { budgetMs?: number; deps?: CopyDeps } = {},
): Promise<CopyProgress> {
  assertCanCopy(user);
  const { source, target, auth } = deps ?? (await defaultDeps());
  const started = Date.now();
  const progress = await readProgress();
  progress.startedAt ??= new Date().toISOString();
  // Pelo menos um lote por chamada; depois, até acabar o tempo.
  let first = true;
  const left = () => {
    if (first) {
      first = false;
      return true;
    }
    return Date.now() - started < budgetMs;
  };

  try {
    // 1. Tabelas.
    while (progress.phase === "tables" && left()) {
      const table = TABLE_LIST[progress.tableIndex];
      if (!table) {
        progress.phase = "files";
        progress.cursor = null;
        break;
      }
      const rows = await source.listPage(table, progress.cursor, TABLE_PAGE);
      // A própria marcação da cópia não vai junto (é desta cópia, não do portal).
      const copy =
        table === "settings" ? rows.filter((r) => r.key !== KEY) : rows;
      await target.upsertRaw(table, copy);
      progress.rows[table] = (progress.rows[table] ?? 0) + copy.length;
      if (rows.length < TABLE_PAGE) {
        progress.tableIndex++;
        progress.cursor = null;
      } else progress.cursor = rows[rows.length - 1].id;
    }

    // 2. Arquivos dos documentos (mesma chave).
    while (progress.phase === "files" && left()) {
      const docs = await source.listPage(
        "documents",
        progress.cursor,
        FILE_PAGE,
      );
      for (const doc of docs) {
        const key = String(doc.storageKey ?? "");
        if (!key) continue;
        if (await target.statFile(key)) {
          progress.files.existing++;
          continue;
        }
        const file = await source.getFile(key);
        if (!file) {
          progress.files.missing++;
          continue;
        }
        await target.putFileAt(key, file.bytes, file.mime);
        progress.files.copied++;
      }
      if (docs.length < FILE_PAGE) {
        progress.phase = "accounts";
        progress.cursor = null;
      } else progress.cursor = docs[docs.length - 1].id;
    }

    // 3. Contas no Supabase Auth (sem senha; link por e-mail depois).
    while (progress.phase === "accounts" && left()) {
      const users = await source.listPage("users", progress.cursor, USER_PAGE);
      for (const u of users) {
        if (!u.active || !u.email) continue;
        try {
          const r = await auth.ensureUser(
            String(u.email),
            String(u.name ?? ""),
          );
          progress.accounts[r]++;
        } catch (error) {
          progress.accounts.failed++;
          if (progress.errors.length < 20)
            progress.errors.push(
              `conta ${String(u.email)}: ${String((error as Error).message ?? error).slice(0, 200)}`,
            );
        }
      }
      if (users.length < USER_PAGE) {
        progress.phase = "done";
        progress.cursor = null;
      } else progress.cursor = users[users.length - 1].id;
    }
  } catch (error) {
    // Erro num lote: guarda onde parou e o motivo; rodar de novo continua.
    const where =
      progress.phase === "tables"
        ? (TABLE_LIST[progress.tableIndex] ?? "?")
        : progress.phase;
    if (progress.errors.length < 20)
      progress.errors.push(
        `${where}: ${String((error as Error).message ?? error).slice(0, 300)}`,
      );
    progress.updatedAt = new Date().toISOString();
    await writeProgress(progress);
    throw error;
  }
  progress.updatedAt = new Date().toISOString();
  await writeProgress(progress);
  if (progress.phase === "done")
    await audit(
      user,
      "supabase.copy",
      "system",
      "supabase",
      `Cópia Appwrite → Supabase concluída: ${Object.values(progress.rows).reduce((a, b) => a + b, 0)} linhas, ${progress.files.copied} arquivos, ${progress.accounts.created} contas`,
    );
  return progress;
}

export const COPY_CONFIRM_WORD = "COPIAR";

/**
 * Recomeça do zero: esvazia as tabelas no Supabase (os arquivos ficam e são
 * conferidos de novo) e zera o progresso. Só antes da virada.
 */
export async function resetCopy(
  user: User,
  confirm: string,
  { deps }: { deps?: CopyDeps } = {},
) {
  assertCanCopy(user);
  if (confirm.trim().toUpperCase() !== COPY_CONFIRM_WORD)
    throw new Error("copy_confirm");
  const { target } = deps ?? (await defaultDeps());
  for (const table of TABLE_LIST) await target.clearTable(table);
  await writeProgress({ ...EMPTY });
  await audit(
    user,
    "supabase.copy.reset",
    "system",
    "supabase",
    "Cópia Appwrite → Supabase recomeçada do zero (tabelas do Supabase esvaziadas)",
  );
}
