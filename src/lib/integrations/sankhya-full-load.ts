import "server-only";
import type { User } from "@/lib/db";
import {
  executeQuery,
  type SankhyaRow,
  type SankhyaTable,
} from "./sankhya-client";
import {
  FULL_LOAD_KEY,
  fullLoadProbeSql,
  fullLoadSql,
  missingColumns,
  sampleSql,
  type FullLoadEntity,
} from "./sankhya-mapping";
import {
  auditImport,
  importContext,
  upsertGroups,
  upsertPartners,
  upsertPaymentConditions,
  upsertProducts,
  type ImportLine,
  type ImportOutcome,
} from "./sankhya-import";
import { readSetting, writeSetting } from "./sankhya-settings";

/*
 * Carga completa dos cadastros do Sankhya para o portal (aba Carga do
 * Sankhya; docs/SANKHYA.md): condições de pagamento (TGFTPV), fornecedores e
 * clientes (TGFPAR com FORNECEDOR ou CLIENTE = S) e produtos (TGFPRO, com os
 * grupos que eles usam). Lê por faixas de código e grava em lotes; cada
 * chamada trabalha até o limite de tempo e guarda onde parou (tabela
 * settings, chave `sankhya.load.<entidade>`). Chamar de novo continua.
 */

export interface FullLoadProgress {
  /** Último código gravado. */
  after: number;
  /** Tamanho da faixa de código por lote (ajusta sozinho). */
  span: number;
  done: boolean;
  /** Quantos ainda faltavam na última consulta. */
  remaining: number | null;
  counts: Partial<Record<ImportOutcome, number>>;
  /** Colunas do mapeamento que o ERP não tem (lidas com *). */
  missing: string[];
  startedAt: string | null;
  updatedAt: string | null;
}

const EMPTY: FullLoadProgress = {
  after: 0,
  span: 500,
  done: false,
  remaining: null,
  counts: {},
  missing: [],
  startedAt: null,
  updatedAt: null,
};

const keyOf = (entity: FullLoadEntity) => `sankhya.load.${entity}`;

export async function getFullLoadProgress(
  entity: FullLoadEntity,
): Promise<FullLoadProgress> {
  return {
    ...EMPTY,
    ...((await readSetting<FullLoadProgress>(keyOf(entity))) ?? {}),
  };
}

export async function resetFullLoad(entity: FullLoadEntity) {
  await writeSetting(keyOf(entity), EMPTY);
}

/** Lote por faixa; coluna inexistente: refaz com * e anota as que faltam. */
async function fetchRange(
  entity: FullLoadEntity,
  after: number,
  upTo: number,
): Promise<{ table: SankhyaTable; missing: string[] }> {
  try {
    return {
      table: await executeQuery(fullLoadSql(entity, after, upTo)),
      missing: [],
    };
  } catch (error) {
    if (entity === "paymentConditions") throw error;
    const table = await executeQuery(fullLoadSql(entity, after, upTo, true));
    return { table, missing: missingColumns(entity, table.columns) };
  }
}

const MAX_ROWS = 400;
const MIN_ROWS = 100;

export interface FullLoadResult {
  progress: FullLoadProgress;
  lines: ImportLine[];
}

/**
 * Processa lotes até `budgetMs` (padrão 40 s, abaixo do limite da Vercel) e
 * devolve o progresso. Rodar de novo continua de onde parou.
 */
export async function runFullLoad(
  user: User,
  entity: FullLoadEntity,
  budgetMs = 40_000,
): Promise<FullLoadResult> {
  const started = Date.now();
  const progress = await getFullLoadProgress(entity);
  if (progress.done) return { progress, lines: [] };
  progress.startedAt ??= new Date().toISOString();
  const ctx = await importContext(user, true);
  const key = FULL_LOAD_KEY[entity];

  // Pelo menos um lote por chamada, depois até acabar o tempo.
  do {
    const probe = await executeQuery(fullLoadProbeSql(entity, progress.after));
    const next = Number(probe.rows[0]?.NEXTCODE);
    progress.remaining = Number(probe.rows[0]?.REMAINING) || 0;
    if (!Number.isFinite(next) || !progress.remaining) {
      progress.done = true;
      break;
    }
    // Começa no próximo código existente (pula buracos na numeração).
    const from = next - 1;
    const upTo = from + progress.span;
    const { table, missing } = await fetchRange(entity, from, upTo);
    if (missing.length)
      progress.missing = [...new Set([...progress.missing, ...missing])];
    const rows = table.rows;

    if (entity === "paymentConditions") {
      await upsertPaymentConditions(ctx, rows);
    } else if (entity === "partners") {
      await upsertPartners(ctx, rows);
    } else {
      const groupCodes = [
        ...new Set(rows.map((r) => r.CODGRUPOPROD).filter((v) => v != null)),
      ];
      let groups: SankhyaRow[] = [];
      if (groupCodes.length) {
        try {
          groups = (
            await executeQuery(
              sampleSql("productGroups", groupCodes as number[]),
            )
          ).rows;
        } catch {
          groups = (
            await executeQuery(
              sampleSql("productGroups", groupCodes as number[], true),
            )
          ).rows;
        }
      }
      const lineByGroup = await upsertGroups(ctx, groups);
      await upsertProducts(ctx, rows, lineByGroup);
    }

    const last = rows.length
      ? Math.max(...rows.map((r) => Number(r[key]) || 0))
      : upTo;
    progress.after = Math.max(upTo, last);
    // Faixa adaptativa: mira entre MIN_ROWS e MAX_ROWS linhas por lote.
    if (rows.length > MAX_ROWS)
      progress.span = Math.max(10, Math.floor(progress.span / 2));
    else if (rows.length < MIN_ROWS)
      progress.span = Math.min(1_000_000, progress.span * 2);
  } while (Date.now() - started < budgetMs);

  for (const line of ctx.out)
    progress.counts[line.outcome] = (progress.counts[line.outcome] ?? 0) + 1;
  progress.updatedAt = new Date().toISOString();
  await writeSetting(keyOf(entity), progress);
  if (ctx.out.length) await auditImport(user, `full:${entity}`, ctx.out);
  return { progress, lines: ctx.out };
}
