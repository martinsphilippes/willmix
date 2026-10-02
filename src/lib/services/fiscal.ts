import "server-only";

import { getStore, type User } from "@/lib/db";
import { getSettings, setSetting, type FiscalTableMeta } from "@/lib/settings";
import {
  formatNcm,
  normalizeNcm,
  parseFiscalFile,
  type FiscalKind,
} from "@/lib/fiscal";
import { audit } from "./audit";
import { notifyWellmix } from "./notifications";

/*
 * Tabela fiscal da Wellmix: alíquota do II (TEC) e do IPI (TIPI) por NCM.
 * Carregada por upload da planilha oficial (Configurações) ou pelo robô
 * mensal, que baixa dos links oficiais informados. Fica como um arquivo JSON
 * no armazenamento (cerca de 10 mil NCMs) e é lida uma vez por instância.
 */

export class FiscalError extends Error {}

/** Uma linha da tabela: II/IPI em %, null quando a parte não foi carregada. */
interface StoredRow {
  d?: string;
  ii?: number;
  ipi?: number;
  /** IPI "NT" (não tributado). */
  nt?: true;
}
interface StoredTable {
  version: 1;
  rows: Record<string, StoredRow>;
}

export interface NcmRates {
  ncm: string;
  description: string | null;
  ii: number | null;
  ipi: number | null;
  ipiNt: boolean;
}

/** Abaixo disso, o arquivo não é a planilha certa (a TEC tem ~10 mil NCMs). */
export const MIN_FISCAL_ROWS = 500;
/** Tabela mais velha que isso: aviso para conferir se houve mudança. */
export const FISCAL_STALE_DAYS = 90;

let cache: { key: string; table: StoredTable } | null = null;

async function loadTable(meta: FiscalTableMeta | null): Promise<StoredTable> {
  if (!meta?.fileKey) return { version: 1, rows: {} };
  if (cache?.key === meta.fileKey) return cache.table;
  const file = await getStore().getFile(meta.fileKey);
  if (!file) return { version: 1, rows: {} };
  const table = JSON.parse(new TextDecoder().decode(file.bytes)) as StoredTable;
  cache = { key: meta.fileKey, table };
  return table;
}

/** Alíquotas do NCM na tabela carregada; null se o NCM não está nela. */
export async function lookupNcm(raw: string | null | undefined) {
  const ncm = normalizeNcm(raw);
  if (!ncm) return null;
  const table = await loadTable((await getSettings()).fiscalTable);
  return rowToRates(ncm, table.rows[ncm]);
}

function rowToRates(ncm: string, row: StoredRow | undefined): NcmRates | null {
  if (!row) return null;
  return {
    ncm,
    description: row.d ?? null,
    ii: typeof row.ii === "number" ? row.ii : null,
    ipi: typeof row.ipi === "number" ? row.ipi : null,
    ipiNt: !!row.nt,
  };
}

/** NCMs da tabela que começam com o prefixo (ex.: posição de 6 dígitos sugerida). */
export async function ncmsWithPrefix(prefix: string, limit = 8) {
  const digits = prefix.replace(/\D/g, "");
  if (digits.length < 4) return [];
  const table = await loadTable((await getSettings()).fiscalTable);
  return Object.keys(table.rows)
    .filter((n) => n.startsWith(digits))
    .sort()
    .slice(0, limit)
    .map((n) => rowToRates(n, table.rows[n])!);
}

/** Há tabela carregada (ao menos uma das partes)? */
export async function hasFiscalTable() {
  const meta = (await getSettings()).fiscalTable;
  return !!(meta?.tec || meta?.tipi);
}

/**
 * Carrega uma planilha oficial (TEC ou TIPI) e substitui só aquela parte da
 * tabela. Devolve quantos NCMs vieram e quantas alíquotas mudaram.
 */
export async function importFiscalFile(
  user: User | null,
  kind: FiscalKind,
  bytes: Uint8Array,
  fileName: string,
  source: "upload" | "robot",
) {
  const entries = parseFiscalFile(bytes, kind);
  if (entries.length < MIN_FISCAL_ROWS)
    throw new FiscalError("fiscal_unrecognized");
  const settings = await getSettings();
  const current = await loadTable(settings.fiscalTable);
  const rows: Record<string, StoredRow> = {};
  // Copia a outra parte; a parte importada é refeita do zero.
  for (const [ncm, row] of Object.entries(current.rows)) {
    const keep: StoredRow =
      kind === "tec"
        ? { ipi: row.ipi, nt: row.nt, d: row.d }
        : { ii: row.ii, d: row.d };
    if (keep.ii !== undefined || keep.ipi !== undefined) rows[ncm] = keep;
  }
  let changed = 0;
  for (const e of entries) {
    const before = current.rows[e.ncm]?.[kind === "tec" ? "ii" : "ipi"];
    if (before !== undefined && before !== e.rate) changed++;
    const row = (rows[e.ncm] ??= {});
    if (kind === "tec") row.ii = e.rate;
    else {
      row.ipi = e.rate;
      if (e.nt) row.nt = true;
      else delete row.nt;
    }
    // Descrição: a da TEC prevalece (a da TIPI costuma ser só "-- Outros").
    if (e.description && (kind === "tec" || !row.d)) row.d = e.description;
  }
  for (const row of Object.values(rows))
    for (const k of Object.keys(row) as (keyof StoredRow)[])
      if (row[k] === undefined) delete row[k];
  const table: StoredTable = { version: 1, rows };
  const file = await getStore().putFile(
    new TextEncoder().encode(JSON.stringify(table)),
    `tabela-fiscal-${new Date().toISOString().slice(0, 10)}.json`,
    "application/json",
  );
  const meta: FiscalTableMeta = {
    fileKey: file.key,
    tec: settings.fiscalTable?.tec ?? null,
    tipi: settings.fiscalTable?.tipi ?? null,
    [kind]: {
      updatedAt: new Date().toISOString(),
      count: entries.length,
      fileName: fileName.slice(0, 120),
      source,
    },
  };
  await setSetting("fiscalTable", meta);
  cache = { key: file.key, table };
  await audit(
    user,
    "fiscal.import",
    "settings",
    "fiscalTable",
    `${kind.toUpperCase()}: ${entries.length} NCMs, ${changed} alíquota(s) alterada(s) (${source === "robot" ? "robô" : fileName})`,
  );
  return { count: entries.length, changed };
}

export interface FiscalStatus {
  tec: FiscalTableMeta["tec"];
  tipi: FiscalTableMeta["tipi"];
  /** Alguma parte com mais de FISCAL_STALE_DAYS dias (ou faltando). */
  stale: boolean;
  lastError: string | null;
  tecUrl: string;
  tipiUrl: string;
}

export async function fiscalStatus(now = new Date()): Promise<FiscalStatus> {
  const s = await getSettings();
  const old = (p: FiscalTableMeta["tec"]) =>
    !p ||
    now.getTime() - new Date(p.updatedAt).getTime() >
      FISCAL_STALE_DAYS * 86_400_000;
  return {
    tec: s.fiscalTable?.tec ?? null,
    tipi: s.fiscalTable?.tipi ?? null,
    stale: old(s.fiscalTable?.tec ?? null) || old(s.fiscalTable?.tipi ?? null),
    lastError: s.fiscalLastError,
    tecUrl: s.fiscalTecUrl,
    tipiUrl: s.fiscalTipiUrl,
  };
}

const MAX_DOWNLOAD = 15 * 1024 * 1024;

/**
 * Robô (mensal, e o botão "Atualizar agora"): baixa a TEC e a TIPI dos links
 * oficiais configurados. Falha não apaga nada: guarda o motivo e avisa a
 * Wellmix para subir a planilha à mão.
 */
export async function syncFiscalTables(
  user: User | null = null,
  fetcher: typeof fetch = fetch,
) {
  const s = await getSettings();
  const targets: Array<[FiscalKind, string]> = (
    [
      ["tec", s.fiscalTecUrl],
      ["tipi", s.fiscalTipiUrl],
    ] as Array<[FiscalKind, string]>
  ).filter(([, url]) => !!url);
  const results: Array<{
    kind: FiscalKind;
    ok: boolean;
    count?: number;
    changed?: number;
    error?: string;
  }> = [];
  for (const [kind, url] of targets) {
    try {
      const res = await fetcher(url, {
        signal: AbortSignal.timeout(60_000),
        headers: { "user-agent": "Mozilla/5.0 (Wellmix portal)" },
      });
      if (!res.ok) throw new Error(`http ${res.status}`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.length > MAX_DOWNLOAD) throw new Error("arquivo grande demais");
      const name = decodeURIComponent(
        new URL(url).pathname.split("/").filter(Boolean).pop() ?? kind,
      );
      const r = await importFiscalFile(user, kind, bytes, name, "robot");
      results.push({ kind, ok: true, ...r });
    } catch (error) {
      const reason =
        error instanceof FiscalError
          ? "planilha não reconhecida"
          : error instanceof Error
            ? error.message.slice(0, 120)
            : "erro";
      results.push({ kind, ok: false, error: reason });
    }
  }
  const failed = results.filter((r) => !r.ok);
  const lastError = failed.length
    ? failed.map((r) => `${r.kind.toUpperCase()}: ${r.error}`).join(" · ")
    : null;
  await setSetting("fiscalLastError", lastError);
  const status = await fiscalStatus();
  if (failed.length || (targets.length === 0 && status.stale))
    await notifyWellmix({
      subject: "Tabela fiscal (TEC/TIPI) precisa de atualização",
      body: failed.length
        ? `A atualização automática falhou (${lastError}). Suba a planilha oficial em Configurações.`
        : "A tabela fiscal tem mais de 90 dias ou está incompleta. Suba a planilha oficial em Configurações.",
      link: "/app/settings#fiscal",
    });
  return { results, lastError };
}

/** Texto curto do NCM para telas: "8517.13.00 · descrição". */
export function ncmLabel(rates: Pick<NcmRates, "ncm" | "description">) {
  return rates.description
    ? `${formatNcm(rates.ncm)} · ${rates.description}`
    : formatNcm(rates.ncm);
}
