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
  applyStockBalances,
  auditImport,
  importContext,
  importSankhyaSet,
  upsertGroups,
  upsertStockLocations,
  upsertPartners,
  upsertPaymentConditions,
  upsertProducts,
  type ImportLine,
  type ImportOutcome,
} from "./sankhya-import";
import {
  getSankhyaErpSettings,
  readSetting,
  writeSetting,
} from "./sankhya-settings";
import { fetchImportSetFor } from "./sankhya-sample";

/*
 * Carga completa do Sankhya para o portal (aba Carga do Sankhya;
 * docs/SANKHYA.md): condições de pagamento (TGFTPV), fornecedores e clientes
 * (TGFPAR com FORNECEDOR ou CLIENTE = S), produtos (TGFPRO, com os grupos que
 * eles usam), locais de estoque (TGFLOC), saldos por local (TGFEST da empresa
 * da Integração) e o histórico de notas de importação (TGFCAB das TOPs de
 * importação, com itens, títulos e cadastros). Lê por faixas de código e grava em lotes; cada
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

/**
 * Lote por faixa. Parceiros e produtos pedem todas as colunas (para guardar
 * todos os códigos do Sankhya); se o ERP recusar, cai nas colunas do
 * mapeamento. Locais, saldos e notas já vêm prontos do SQL.
 */
async function fetchRange(
  entity: FullLoadEntity,
  after: number,
  upTo: number,
  codEmp: number | null,
): Promise<{ table: SankhyaTable; missing: string[] }> {
  if (entity === "partners" || entity === "products") {
    try {
      const table = await executeQuery(fullLoadSql(entity, after, upTo, true));
      return { table, missing: missingColumns(entity, table.columns) };
    } catch {
      return {
        table: await executeQuery(fullLoadSql(entity, after, upTo)),
        missing: [],
      };
    }
  }
  return {
    table: await executeQuery(fullLoadSql(entity, after, upTo, false, codEmp)),
    missing: [],
  };
}

/** Linhas por lote: notas são pesadas (pedido, itens, etapas, títulos). */
const ROWS: Record<FullLoadEntity, { min: number; max: number }> = {
  paymentConditions: { min: 100, max: 400 },
  // Cada parceiro/produto grava várias linhas no banco: lotes menores
  // cabem na rodada (no Supabase, 300 por lote passava do limite de 60 s).
  partners: { min: 40, max: 120 },
  products: { min: 40, max: 120 },
  stockLocations: { min: 100, max: 400 },
  stockBalances: { min: 100, max: 400 },
  orders: { min: 3, max: 10 },
};

export interface FullLoadResult {
  progress: FullLoadProgress;
  lines: ImportLine[];
}

/**
 * Processa lotes até `budgetMs` (padrão 30 s, abaixo do limite de 60 s da
 * Vercel) e
 * devolve o progresso. Rodar de novo continua de onde parou.
 */
export async function runFullLoad(
  user: User,
  entity: FullLoadEntity,
  budgetMs = 30_000,
): Promise<FullLoadResult> {
  const started = Date.now();
  const progress = await getFullLoadProgress(entity);
  if (progress.done) return { progress, lines: [] };
  if (progress.startedAt == null && entity === "orders") progress.span = 50;
  progress.startedAt ??= new Date().toISOString();
  const erp = await getSankhyaErpSettings();
  const codEmp = erp.codEmp ?? null;
  const ctx = await importContext(user, true);
  const key = FULL_LOAD_KEY[entity];
  const limit = ROWS[entity];

  // O progresso é gravado a cada lote: se a função for cortada no limite de
  // tempo, a próxima rodada continua do último lote gravado.
  let counted = 0;
  const persist = async () => {
    for (const line of ctx.out.slice(counted))
      progress.counts[line.outcome] = (progress.counts[line.outcome] ?? 0) + 1;
    counted = ctx.out.length;
    progress.updatedAt = new Date().toISOString();
    await writeSetting(keyOf(entity), progress);
  };
  // Pelo menos um lote por chamada; outro só se couber no tempo que falta
  // (pelo tempo do último lote).
  let lastBatchMs = 0;
  do {
    const batchStarted = Date.now();
    const probe = await executeQuery(
      fullLoadProbeSql(entity, progress.after, codEmp),
    );
    const next = Number(probe.rows[0]?.NEXTCODE);
    progress.remaining = Number(probe.rows[0]?.REMAINING) || 0;
    if (!Number.isFinite(next) || !progress.remaining) {
      progress.done = true;
      break;
    }
    // Começa no próximo código existente (pula buracos na numeração).
    const from = next - 1;
    const upTo = from + progress.span;
    const fetched = await fetchRange(entity, from, upTo, codEmp);
    if (fetched.missing.length)
      progress.missing = [
        ...new Set([...progress.missing, ...fetched.missing]),
      ];
    // Lote grande demais: grava só o começo e continua dali (os saldos de
    // um mesmo produto ficam juntos).
    const all = fetched.table.rows;
    let rows = all.slice(0, limit.max);
    if (all.length > limit.max && entity === "stockBalances") {
      const lastProd = rows[rows.length - 1]?.[key];
      rows = all.filter((r, i) => i < limit.max || r[key] === lastProd);
    }
    const truncated = rows.length < all.length;

    if (entity === "paymentConditions") {
      await upsertPaymentConditions(ctx, rows);
    } else if (entity === "partners") {
      await upsertPartners(ctx, rows);
    } else if (entity === "stockLocations") {
      await upsertStockLocations(ctx, rows);
    } else if (entity === "stockBalances") {
      await applyStockBalances(ctx, rows);
    } else if (entity === "orders") {
      if (rows.length) {
        const set = await fetchImportSetFor(rows);
        ctx.out.push(...(await importSankhyaSet(user, set, erp, null)));
      }
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
      await upsertProducts(ctx, rows, lineByGroup, erp.currency);
    }

    const last = rows.length
      ? Math.max(...rows.map((r) => Number(r[key]) || 0))
      : upTo;
    progress.after = truncated ? last : Math.max(upTo, last);
    // Faixa adaptativa: mira entre o mínimo e o máximo de linhas por lote.
    if (all.length > limit.max)
      progress.span = Math.max(1, Math.floor(progress.span / 2));
    else if (all.length < limit.min)
      progress.span = Math.min(1_000_000, progress.span * 2);
    await persist();
    lastBatchMs = Date.now() - batchStarted;
  } while (Date.now() - started + lastBatchMs < budgetMs);

  await persist();
  if (ctx.out.length) await auditImport(user, `full:${entity}`, ctx.out);
  return { progress, lines: ctx.out };
}
