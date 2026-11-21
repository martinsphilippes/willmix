import "server-only";
import { getStore, type User } from "@/lib/db";
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
  viewLoadProbeSql,
  viewLoadSql,
  type FullLoadEntity,
} from "./sankhya-mapping";
import {
  missingViewColumns,
  PRODUCT_VIEW,
  productRowFromView,
  SUPPLIER_VIEW,
} from "./sankhya-views";
import {
  applyStockBalances,
  auditImport,
  importContext,
  importSankhyaSet,
  upsertGroups,
  upsertStockLocations,
  upsertPartners,
  upsertCustomersFromView,
  upsertPaymentConditions,
  upsertProductSuppliers,
  upsertProducts,
  upsertSuppliersFromView,
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
 * docs/SANKHYA.md): condições de pagamento (TGFTPV), fornecedores
 * (VW_AD_FORNECEDOR_WELL; a TGFPAR com FORNECEDOR = S se a view falhar),
 * vendedores (VW_AD_VENDEDOR_WELL), clientes (VW_AD_CLIENTE_WELL;
 * docs/ECONOMIC_GROUPS.md), produtos (VW_AD_PRODUTO_WELL; a TGFPRO se a view
 * falhar), o vínculo produto × fornecedor (VW_AD_PRODUTO_FORNECEDOR_WELL), com os grupos que
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
  counts: Partial<Record<ImportOutcome | "failed", number>>;
  /** Colunas do mapeamento que o ERP não tem (lidas com *). */
  missing: string[];
  /** Fotos do Sankhya puladas por erro do gateway ("CODPROD COLUNA: erro"); a próxima passada tenta de novo. */
  failed?: string[];
  startedAt: string | null;
  updatedAt: string | null;
  /**
   * Fornecedores e produtos: de onde a carga leu (a view do portal ou, se ela
   * falhou, a tabela). Ausente nas cargas de antes.
   */
  source?: "view" | "table";
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
  source: "view" | "table" = "table",
): Promise<{ table: SankhyaTable; missing: string[] }> {
  if ((entity === "partners" || entity === "products") && source === "view") {
    const table = await executeQuery(viewLoadSql(entity, after, upTo));
    return {
      table,
      missing: table.rows.length
        ? missingViewColumns(
            entity === "partners" ? "suppliers" : "products",
            table.columns.length ? table.columns : Object.keys(table.rows[0]),
          ).map(
            (c) =>
              `${entity === "partners" ? SUPPLIER_VIEW : PRODUCT_VIEW}.${c}`,
          )
        : [],
    };
  }
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
  // Vendedores: uma leitura só (rca.ts).
  sellers: { min: 1, max: 1 },
  customers: { min: 40, max: 120 },
  products: { min: 40, max: 120 },
  // Linhas da view (vários portos por par): as de um produto ficam juntas.
  productSuppliers: { min: 100, max: 400 },
  stockLocations: { min: 100, max: 400 },
  stockBalances: { min: 100, max: 400 },
  // Lotes de até 8 notas (12/11/2026): com a nota levando ~1,3 s no portal,
  // a consulta ao Sankhya (custo quase fixo por lote) pesava mais que a
  // gravação; o cursor continua gravado a cada lote.
  orders: { min: 3, max: 8 },
  // Fotos: a faixa e os lotes ficam em sankhya-images.ts.
  productImages: { min: 60, max: 200 },
  // Caixas: a faixa e os lotes ficam em sankhya-cartons.ts.
  productCartons: { min: 100, max: 600 },
  // Cópia para análise: páginas de 4.000 em sankhya-stage.ts.
  stagePurchaseHeaders: { min: 1, max: 4000 },
  stagePurchaseItems: { min: 1, max: 4000 },
  stagePurchaseLinks: { min: 1, max: 4000 },
  stagePurchaseTracks: { min: 1, max: 4000 },
  stageSaleHeaders: { min: 1, max: 4000 },
  stageSaleItems: { min: 1, max: 4000 },
  stageSaleLinks: { min: 1, max: 4000 },
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
/**
 * Carga antiga do histórico de pedidos (TGFCAB das TOPs de importação, um
 * pedido por documento): errada, criou um pedido por TOP da mesma compra.
 * Os 16.268 pedidos dela foram apagados em 21/11/2026 (dono) e ela fica
 * desligada até a carga nova (docs/SANKHYA_INTEGRACAO.md, seção 9). Só roda
 * com a chave `sankhya.legacyOrders` = "enabled" (os testes da regra antiga).
 */
export const LEGACY_ORDERS_KEY = "sankhya.legacyOrders";

export async function legacyOrdersEnabled() {
  return (await readSetting<string>(LEGACY_ORDERS_KEY)) === "enabled";
}

export async function runFullLoad(
  user: User,
  entity: FullLoadEntity,
  budgetMs = 30_000,
): Promise<FullLoadResult> {
  if (entity === "orders" && !(await legacyOrdersEnabled())) {
    const progress: FullLoadProgress = {
      ...(await getFullLoadProgress("orders")),
      done: true,
      remaining: 0,
      missing: [
        "Carga antiga desligada (21/11/2026): substituída pela carga nova dos pedidos",
      ],
    };
    return { progress, lines: [] };
  }
  if (entity === "productCartons") {
    const { runCartonLoad } = await import("./sankhya-cartons");
    return { progress: await runCartonLoad(user, budgetMs), lines: [] };
  }
  if (entity === "productImages") {
    const { runImageLoad } = await import("./sankhya-images");
    return { progress: await runImageLoad(user, budgetMs), lines: [] };
  }
  if (entity === "sellers") return runSellerLoad(user);
  if (entity.startsWith("stage")) {
    const { datasetOfEntity, runStageLoad } = await import("./sankhya-stage");
    const dataset = datasetOfEntity(entity);
    if (dataset)
      return {
        progress: await runStageLoad(user, dataset, budgetMs),
        lines: [],
      };
  }
  const started = Date.now();
  const progress = await getFullLoadProgress(entity);
  if (progress.done) return { progress, lines: [] };
  if (progress.startedAt == null && entity === "orders") progress.span = 50;
  progress.startedAt ??= new Date().toISOString();
  const erp = await getSankhyaErpSettings();
  const codEmp = erp.codEmp ?? null;
  // O histórico de notas monta o próprio contexto (só os códigos da nota).
  const ctx = await importContext(
    user,
    true,
    entity === "orders" ? { parties: [], products: [], lines: [] } : undefined,
  );
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
  // Fornecedores e produtos: a view do portal; se ela falhar, a tabela
  // (fica a escolha da primeira rodada até recomeçar).
  const viewEntity = entity === "partners" || entity === "products";
  const probeOf = async (after: number) => {
    if (viewEntity && progress.source !== "table") {
      try {
        const table = await executeQuery(viewLoadProbeSql(entity, after));
        progress.source = "view";
        return table;
      } catch (error) {
        if (progress.source === "view") throw error;
        console.warn(
          `[sankhya-load] ${entity}: view falhou, lendo a tabela`,
          error,
        );
        progress.source = "table";
      }
    }
    return executeQuery(fullLoadProbeSql(entity, after, codEmp));
  };
  do {
    const batchStarted = Date.now();
    const probe = await probeOf(progress.after);
    const next = Number(probe.rows[0]?.NEXTCODE);
    progress.remaining = Number(probe.rows[0]?.REMAINING) || 0;
    if (!Number.isFinite(next) || !progress.remaining) {
      progress.done = true;
      break;
    }
    // Começa no próximo código existente (pula buracos na numeração).
    const from = next - 1;
    const upTo = from + progress.span;
    const fetched = await fetchRange(
      entity,
      from,
      upTo,
      codEmp,
      progress.source,
    );
    if (fetched.missing.length)
      progress.missing = [
        ...new Set([...progress.missing, ...fetched.missing]),
      ];
    // Lote grande demais: grava só o começo e continua dali (os saldos de
    // um mesmo produto ficam juntos).
    const all = fetched.table.rows;
    let rows = all.slice(0, limit.max);
    if (
      all.length > limit.max &&
      (entity === "stockBalances" || entity === "productSuppliers")
    ) {
      const lastProd = rows[rows.length - 1]?.[key];
      rows = all.filter((r, i) => i < limit.max || r[key] === lastProd);
    }
    const truncated = rows.length < all.length;

    if (entity === "paymentConditions") {
      await upsertPaymentConditions(ctx, rows);
    } else if (entity === "partners") {
      if (progress.source === "view") await upsertSuppliersFromView(ctx, rows);
      else await upsertPartners(ctx, rows);
    } else if (entity === "productSuppliers") {
      await upsertProductSuppliers(ctx, rows);
    } else if (entity === "customers") {
      await upsertCustomersFromView(ctx, rows);
    } else if (entity === "stockLocations") {
      await upsertStockLocations(ctx, rows);
    } else if (entity === "stockBalances") {
      await applyStockBalances(ctx, rows);
    } else if (entity === "orders") {
      // Notas que já estão no portal saem antes da consulta ao Sankhya (itens,
      // produtos e parceiros de uma nota grande levavam até 30 s só para a
      // carga descobrir depois que ela já existia).
      const known = await knownOrders(rows.map((r) => String(r.NUNOTA)));
      for (const r of rows)
        if (known.has(String(r.NUNOTA)))
          ctx.out.push({
            entity: "orders",
            code: String(r.NUNOTA),
            outcome: "existing",
            id: known.get(String(r.NUNOTA))!,
            label: `NUNOTA ${r.NUNOTA}`,
          });
      const fresh = rows.filter((r) => !known.has(String(r.NUNOTA)));
      if (fresh.length) {
        const t0 = Date.now();
        const set = await fetchImportSetFor(fresh);
        const t1 = Date.now();
        ctx.out.push(...(await importSankhyaSet(user, set, erp, null)));
        // Tempo de cada lado, nos logs da Vercel (onde a nota gasta tempo).
        console.info(
          `[sankhya-load] notas ${fresh.length} (já no portal ${rows.length - fresh.length}) itens ${set.items.length}: Sankhya ${t1 - t0} ms, portal ${Date.now() - t1} ms`,
        );
      }
    } else {
      const fromView = progress.source === "view";
      if (fromView) rows = rows.map(productRowFromView);
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
      await upsertProducts(ctx, rows, lineByGroup, erp.currency, {
        fromView,
      });
    }

    // Na view de fornecedores o código é COD_FORNECEDOR; os produtos já
    // viraram linhas da TGFPRO (CODPROD).
    const keyOf =
      entity === "partners" && progress.source === "view"
        ? "COD_FORNECEDOR"
        : key;
    const last = rows.length
      ? Math.max(...rows.map((r) => Number(r[keyOf]) || 0))
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

/**
 * Vendedores (RCAs) pela VW_AD_VENDEDOR_WELL (20/11/2026): uma leitura só,
 * que troca a lista de RCAs do portal e liga o vendedor ao login da equipe
 * pelo e-mail (rca.ts, syncSellers).
 */
async function runSellerLoad(user: User): Promise<FullLoadResult> {
  const { syncSellers } = await import("@/lib/services/rca");
  const now = new Date().toISOString();
  const before = await getFullLoadProgress("sellers");
  const result = await syncSellers(user);
  const progress: FullLoadProgress = {
    ...EMPTY,
    after: result.list.sellers.length,
    done: true,
    remaining: 0,
    counts: {
      updated: result.list.sellers.length,
      linked: result.linkedUsers,
    },
    missing: result.missing,
    startedAt: before.startedAt ?? now,
    updatedAt: now,
    source: result.source,
  };
  await writeSetting(keyOf("sellers"), progress);
  return { progress, lines: [] };
}

/** NUNOTAs que já viraram pedido no portal (pelo código do Sankhya ou nº do ERP). */
async function knownOrders(nunotas: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!nunotas.length) return out;
  const store = getStore();
  const [byCode, byErp] = await Promise.all([
    store.list("orders", { filter: { sankhyaCode: nunotas } }),
    store.list("orders", { filter: { erpNumber: nunotas } }),
  ]);
  for (const o of [...byCode, ...byErp]) {
    const key =
      o.sankhyaCode && nunotas.includes(o.sankhyaCode)
        ? o.sankhyaCode
        : String(o.erpNumber);
    if (!out.has(key)) out.set(key, o.id);
  }
  return out;
}
