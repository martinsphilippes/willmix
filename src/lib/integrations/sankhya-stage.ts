import "server-only";
import { getStore, type User } from "@/lib/db";
import { listColumns } from "@/lib/db/lookup";
import { executeQuery, type SankhyaRow } from "./sankhya-client";
import type { FullLoadEntity } from "./sankhya-mapping";
import { readSetting, writeSetting } from "./sankhya-settings";

/*
 * Cópia bruta das views de pedido do Sankhya para análise (stage; dono,
 * 20/11/2026; docs/SANKHYA_PEDIDOS.md). Antes de refazer a carga dos pedidos,
 * as linhas das views ficam no banco do portal exatamente como vêm (tabela
 * `sankhya_stage_rows`), para a análise não depender de hipóteses. Não
 * alimenta tela nem regra. Só leitura no Sankhya, em páginas de 4.000
 * ordenadas por NUNOTA e SEQUENCIA (orientação do TI, LEITURA-VIEWS-PEDIDOS).
 *
 * O que entra (banco de 8 GB; dono, 20/11/2026: entender também os
 * finalizados), tudo sem filtro de TOP nem de data:
 * - purchaseHeaders: VW_AD_PEDCOMPRA_CAB_WELL inteira (~29 mil);
 * - purchaseItems: VW_AD_PEDCOMPRA_ITEM_WELL inteira;
 * - purchaseLinks: TGFVAR (de que documento cada um foi gerado) com origem
 *   ou destino num documento da view de compra ("cada etapa é um documento
 *   novo, gerado a partir do anterior", Wellmix, 20/11/2026). A TGFVAR é de
 *   todos os documentos da empresa: a leitura parte dos NUNOTAs já copiados
 *   em purchaseHeaders, em lotes, com a lista de números no IN (sem
 *   subconsulta, que o TI mediu passar de 90 s);
 * - saleHeaders: VW_AD_PEDCLIENTE_CAB_WELL inteira;
 * - saleItems: VW_AD_PEDCLIENTE_ITEM_WELL só com pendência (pedido ou item
 *   pendente, de qualquer data) ou alterada nos últimos 90 dias. A view tem
 *   4,4 milhões de linhas (~5 GB copiada inteira, mais que o banco aguenta);
 *   as pendências moram no item de venda (dono, 20/11/2026).
 */

/** TOPs de importação (Wellmix, 20/11/2026), na ordem do fluxo. */
export const IMPORT_FLOW_TOPS = [1100, 1101, 1102, 1103, 1104, 1107, 35, 1];
/** Também de importação: cotação e amostras. */
export const IMPORT_OTHER_TOPS = [1002, 1003, 140];
/** Fora da importação: compra nacional e de consumo. */
export const NOT_IMPORT_TOPS = [7, 176, 1120];

const PAGE = 4000;

export const STAGE_DATASETS = [
  "purchaseHeaders",
  "purchaseItems",
  "purchaseLinks",
  "saleHeaders",
  "saleItems",
] as const;
export type StageDataset = (typeof STAGE_DATASETS)[number];

/** Entidade da carga completa (aba Carga do Sankhya) de cada cópia. */
export const STAGE_ENTITY: Record<StageDataset, FullLoadEntity> = {
  purchaseHeaders: "stagePurchaseHeaders",
  purchaseItems: "stagePurchaseItems",
  purchaseLinks: "stagePurchaseLinks",
  saleHeaders: "stageSaleHeaders",
  saleItems: "stageSaleItems",
};

export const datasetOfEntity = (entity: string): StageDataset | null =>
  (Object.entries(STAGE_ENTITY).find(([, e]) => e === entity)?.[0] as
    StageDataset | undefined) ?? null;

const int0 = (n: number) =>
  Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;

/** Depois do último (NUNOTA, SEQUENCIA) lido. */
const after = (n: number, s: number, nunota: string, seq: string | null) =>
  seq
    ? `(${nunota} > ${int0(n)} OR (${nunota} = ${int0(n)} AND ${seq} > ${int0(s)}))`
    : `${nunota} > ${int0(n)}`;

/** SQL de uma página (puro; testado). */
export function stagePageSql(
  dataset: StageDataset,
  nunota: number,
  seq: number,
): string {
  switch (dataset) {
    case "purchaseHeaders":
      return `SELECT TOP ${PAGE} * FROM sankhya.VW_AD_PEDCOMPRA_CAB_WELL WHERE ${after(nunota, seq, "NUNOTA", null)} ORDER BY NUNOTA`;
    case "purchaseItems":
      return `SELECT TOP ${PAGE} * FROM sankhya.VW_AD_PEDCOMPRA_ITEM_WELL WHERE ${after(nunota, seq, "NUNOTA", "SEQUENCIA")} ORDER BY NUNOTA, SEQUENCIA`;
    case "purchaseLinks":
      throw new Error("purchaseLinks: use stageLinksSql");
    case "saleHeaders":
      return `SELECT TOP ${PAGE} * FROM sankhya.VW_AD_PEDCLIENTE_CAB_WELL WHERE ${after(nunota, seq, "NUNOTA", null)} ORDER BY NUNOTA`;
    case "saleItems":
      return `SELECT TOP ${PAGE} * FROM sankhya.VW_AD_PEDCLIENTE_ITEM_WELL WHERE (PEDIDO_PENDENTE = 'S' OR ITEM_PENDENTE = 'S' OR DATA_ALTERACAO_PEDIDO >= DATEADD(DAY, -90, CAST(GETDATE() AS DATE))) AND ${after(nunota, seq, "NUNOTA", "SEQUENCIA")} ORDER BY NUNOTA, SEQUENCIA`;
  }
}

/** Ligações (TGFVAR) de um lote de documentos de compra (destino ou origem). */
export function stageLinksSql(nunotas: number[]): string {
  const list = [...new Set(nunotas.map(int0).filter((n) => n > 0))];
  const inList = list.length ? list.join(", ") : "-1";
  return `SELECT V.*, D.CODTIPOPER AS TOP_DESTINO, D.TIPMOV AS TIPMOV_DESTINO, O.CODTIPOPER AS TOP_ORIGEM, O.TIPMOV AS TIPMOV_ORIGEM FROM TGFVAR V JOIN TGFCAB D ON D.NUNOTA = V.NUNOTA JOIN TGFCAB O ON O.NUNOTA = V.NUNOTAORIG WHERE V.NUNOTA IN (${inList}) OR V.NUNOTAORIG IN (${inList}) ORDER BY V.NUNOTA, V.SEQUENCIA`;
}

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const col = (row: SankhyaRow, name: string) => {
  if (name in row) return row[name];
  const k = Object.keys(row).find((c) => c.toUpperCase() === name);
  return k ? row[k] : undefined;
};

/** Chave da linha na origem. */
export function stageRowKey(dataset: StageDataset, row: SankhyaRow): string {
  const n = num(col(row, "NUNOTA"));
  if (dataset === "purchaseHeaders" || dataset === "saleHeaders")
    return String(n);
  const s = num(col(row, "SEQUENCIA"));
  if (dataset === "purchaseItems" || dataset === "saleItems")
    return `${n}:${s}`;
  return `${n}:${s}:${num(col(row, "NUNOTAORIG"))}:${num(col(row, "SEQUENCIAORIG"))}`;
}

/** A linha como JSON compacto (nomes em maiúsculas, sem os vazios). */
export function stageRow(row: SankhyaRow): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v == null) continue;
    if (typeof v === "number") out[k.toUpperCase()] = v;
    else {
      const t = String(v).trim();
      if (t) out[k.toUpperCase()] = t.slice(0, 500);
    }
  }
  return out;
}

/**
 * Corta a página cheia no último (NUNOTA, SEQUENCIA) inteiro: na TGFVAR o
 * mesmo item pode ter várias origens e a próxima página começa depois dele.
 * Devolve as linhas guardadas e o cursor.
 */
export function cutPage(
  dataset: StageDataset,
  rows: SankhyaRow[],
): { rows: SankhyaRow[]; nunota: number; seq: number; done: boolean } {
  const seqOf = (r: SankhyaRow) =>
    dataset === "purchaseHeaders" || dataset === "saleHeaders"
      ? 0
      : num(col(r, "SEQUENCIA"));
  const done = rows.length < PAGE;
  let kept = rows;
  if (!done && dataset === "purchaseLinks") {
    const last = rows[rows.length - 1];
    const same = (r: SankhyaRow) =>
      num(col(r, "NUNOTA")) === num(col(last, "NUNOTA")) &&
      seqOf(r) === seqOf(last);
    const cut = rows.filter((r) => !same(r));
    if (cut.length) kept = cut;
  }
  const tail = kept[kept.length - 1];
  return {
    rows: kept,
    nunota: tail ? num(col(tail, "NUNOTA")) : 0,
    seq: tail ? seqOf(tail) : 0,
    done,
  };
}

export interface StageProgress {
  after: number;
  afterSeq: number;
  span: number;
  done: boolean;
  remaining: number | null;
  counts: Partial<Record<"created" | "failed", number>>;
  missing: string[];
  failed?: string[];
  startedAt: string | null;
  updatedAt: string | null;
}

const keyOf = (entity: FullLoadEntity) => `sankhya.load.${entity}`;

/**
 * Copia páginas até `budgetMs` e grava o cursor a cada página (a próxima
 * rodada continua dali). "Recomeçar" volta ao início; as linhas são gravadas
 * pela chave da origem (`dataset:chave`), então ler de novo não duplica, e
 * `runId` diz de que rodada cada uma veio.
 */
export async function runStageLoad(
  user: User,
  dataset: StageDataset,
  budgetMs = 30_000,
): Promise<StageProgress> {
  void user;
  const started = Date.now();
  const entity = STAGE_ENTITY[dataset];
  const progress: StageProgress = {
    after: 0,
    afterSeq: 0,
    span: PAGE,
    done: false,
    remaining: null,
    counts: {},
    missing: [],
    startedAt: null,
    updatedAt: null,
    ...((await readSetting<StageProgress>(keyOf(entity))) ?? {}),
  };
  if (progress.done) return progress;
  progress.afterSeq ??= 0;
  progress.startedAt ??= new Date().toISOString();
  let lastMs = 0;
  if (dataset === "purchaseLinks")
    return runLinksLoad(progress, entity, started, budgetMs);
  do {
    const t0 = Date.now();
    const table = await executeQuery(
      stagePageSql(dataset, progress.after, progress.afterSeq),
    );
    const page = cutPage(dataset, table.rows);
    const now = new Date().toISOString();
    const saved = await saveRows(dataset, page.rows, progress.startedAt);
    progress.counts.created = (progress.counts.created ?? 0) + saved;
    progress.after = page.nunota || progress.after;
    progress.afterSeq = page.seq;
    progress.done = page.done;
    progress.remaining = page.done ? 0 : null;
    progress.updatedAt = now;
    await writeSetting(keyOf(entity), progress);
    lastMs = Date.now() - t0;
  } while (!progress.done && Date.now() - started + lastMs < budgetMs);
  return progress;
}

/** Grava as linhas de uma cópia (pela chave da origem). */
async function saveRows(
  dataset: StageDataset,
  rows: SankhyaRow[],
  runId: string | null,
) {
  const store = getStore();
  const now = new Date().toISOString();
  const byId = new Map<
    string,
    {
      id: string;
      dataset: string;
      rowKey: string;
      nunota: number | null;
      runId: string | null;
      row: Record<string, string | number>;
      loadedAt: string;
    }
  >();
  for (const r of rows) {
    const rowKey = stageRowKey(dataset, r);
    byId.set(`${dataset}:${rowKey}`, {
      id: `${dataset}:${rowKey}`,
      dataset,
      rowKey,
      nunota: num(col(r, "NUNOTA")) || null,
      runId,
      row: stageRow(r),
      loadedAt: now,
    });
  }
  const records = [...byId.values()];
  if (!records.length) return 0;
  if (store.upsertMany) await store.upsertMany("sankhya_stage_rows", records);
  else
    for (const r of records) {
      const found = await store.get("sankhya_stage_rows", r.id);
      if (found) await store.update("sankhya_stage_rows", r.id, r);
      else await store.create("sankhya_stage_rows", r);
    }
  return records.length;
}

/** Teto de linhas por chamada da API (o lote encolhe se chegar perto). */
const API_ROWS = 5000;

/**
 * Ligações: lotes de NUNOTAs da cópia dos cabeçalhos de compra, em ordem;
 * `span` é o tamanho do lote (começa em 100 e se ajusta pelo volume).
 */
async function runLinksLoad(
  progress: StageProgress,
  entity: FullLoadEntity,
  started: number,
  budgetMs: number,
): Promise<StageProgress> {
  const store = getStore();
  if (!progress.span || progress.span === PAGE) progress.span = 100;
  // Só a coluna do número (a linha inteira pesa).
  const headers = await listColumns(store, "sankhya_stage_rows", ["nunota"], {
    filter: { dataset: "purchaseHeaders" },
  });
  const all = [
    ...new Set(headers.map((h) => h.nunota ?? 0).filter((n) => n > 0)),
  ].sort((a, b) => a - b);
  let lastMs = 0;
  do {
    const t0 = Date.now();
    const pending = all.filter((n) => n > progress.after);
    if (!pending.length) {
      progress.done = true;
      progress.remaining = 0;
      progress.updatedAt = new Date().toISOString();
      if (!headers.length)
        progress.missing = ["Copie antes os cabeçalhos de compra"];
      await writeSetting(keyOf(entity), progress);
      break;
    }
    const batch = pending.slice(0, progress.span);
    const table = await executeQuery(stageLinksSql(batch));
    if (table.rows.length >= API_ROWS && batch.length > 1) {
      // Pode ter cortado: lê de novo com a metade.
      progress.span = Math.max(1, Math.floor(batch.length / 2));
      continue;
    }
    const saved = await saveRows(
      "purchaseLinks",
      table.rows,
      progress.startedAt,
    );
    progress.counts.created = (progress.counts.created ?? 0) + saved;
    progress.after = batch[batch.length - 1];
    progress.remaining = pending.length - batch.length;
    if (table.rows.length < API_ROWS / 4)
      progress.span = Math.min(400, progress.span * 2);
    progress.updatedAt = new Date().toISOString();
    await writeSetting(keyOf(entity), progress);
    lastMs = Date.now() - t0;
  } while (Date.now() - started + lastMs < budgetMs);
  return progress;
}
