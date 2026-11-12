import { listSheets, readGrid } from "@/lib/services/xlsx";

/*
 * Tabela fiscal (funções puras): lê as planilhas oficiais da TEC (alíquota do
 * imposto de importação) e da TIPI (alíquota do IPI) e devolve NCM de 8
 * dígitos → alíquota. Aceita XLSX ou CSV, com títulos acima do cabeçalho.
 *
 * Cabeçalho reconhecido: coluna "NCM" (ou "Código"), "Descrição" e a coluna da
 * alíquota ("TEC", "Alíquota", "II", "IPI", "%"). Na TIPI, linhas de "Ex" são
 * exceções de um destaque específico e ficam fora (vale a alíquota do NCM).
 * "NT" (não tributado) vira 0%.
 */

export type FiscalKind = "tec" | "tipi";

export interface FiscalEntry {
  ncm: string;
  description: string | null;
  /** Alíquota em % (0 a 100). */
  rate: number;
  /** "NT" na TIPI: não tributado (0%). */
  nt: boolean;
}

/** Só dígitos; NCM válido tem 8. */
export function normalizeNcm(raw: string | null | undefined): string | null {
  const digits = String(raw ?? "").replace(/\D/g, "");
  return digits.length === 8 ? digits : null;
}

/** 85171300 → 8517.13.00 */
export function formatNcm(ncm: string): string {
  const d = ncm.replace(/\D/g, "");
  if (d.length !== 8) return ncm;
  return `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6)}`;
}

const NCM_CELL = /^\s*\d{4}\.?\d{2}\.?\d{2}\s*$/;

/** "18", "18%", "18,5", "NT" → número; vazio ou texto → null. */
export function parseRate(
  raw: string | null | undefined,
): { rate: number; nt: boolean } | null {
  const v = String(raw ?? "")
    .trim()
    .toUpperCase();
  if (!v) return null;
  if (v === "NT") return { rate: 0, nt: true };
  const m = /^(\d+(?:[.,]\d+)?)\s*%?$/.exec(v);
  if (!m) return null;
  const n = Number(m[1].replace(",", "."));
  return Number.isFinite(n) && n >= 0 && n <= 1000
    ? { rate: n, nt: false }
    : null;
}

const fold = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();

interface Columns {
  header: number;
  ncm: number;
  description: number | null;
  rate: number;
  ex: number | null;
}

/** Acha a linha de cabeçalho e as colunas; sem cabeçalho, deduz pelos valores. */
function findColumns(grid: string[][], kind: FiscalKind): Columns | null {
  for (let r = 0; r < Math.min(grid.length, 40); r++) {
    const cells = grid[r].map((c) => fold(c ?? ""));
    const ncm = cells.findIndex((c) => /^(NCM|CODIGO)\b/.test(c));
    if (ncm < 0) continue;
    const description = cells.findIndex((c) => c.startsWith("DESCRI"));
    const ex = cells.findIndex((c) => c === "EX" || c.startsWith("EX "));
    const ratePatterns =
      kind === "tec"
        ? [/^TEC\b/, /^II\b/, /ALIQ/, /%/]
        : [/ALIQ/, /^IPI\b/, /%/];
    let rate = -1;
    for (const p of ratePatterns) {
      rate = cells.findIndex((c, i) => i !== ncm && p.test(c));
      if (rate >= 0) break;
    }
    if (rate < 0) continue;
    return {
      header: r,
      ncm,
      description: description >= 0 ? description : null,
      rate,
      ex: ex >= 0 ? ex : null,
    };
  }
  // Sem cabeçalho: coluna com mais NCMs; alíquota = coluna seguinte com mais números.
  const sample = grid.slice(0, 300);
  const width = Math.max(0, ...sample.map((r) => r.length));
  const score = (col: number, test: (v: string) => boolean) =>
    sample.filter((r) => test(r[col] ?? "")).length;
  let ncm = -1;
  let best = 0;
  for (let c = 0; c < width; c++) {
    const s = score(c, (v) => NCM_CELL.test(v));
    if (s > best) [ncm, best] = [c, s];
  }
  if (ncm < 0 || best < 10) return null;
  let rate = -1;
  best = 0;
  for (let c = ncm + 1; c < width; c++) {
    const s = score(c, (v) => parseRate(v) !== null);
    if (s > best) [rate, best] = [c, s];
  }
  if (rate < 0) return null;
  let description: number | null = null;
  let longest = 0;
  for (let c = 0; c < width; c++) {
    if (c === ncm || c === rate) continue;
    const len = sample.reduce((n, r) => n + (r[c] ?? "").length, 0);
    if (len > longest) [description, longest] = [c, len];
  }
  return { header: -1, ncm, description, rate, ex: null };
}

/** Linhas da planilha → alíquota por NCM de 8 dígitos (a 1ª ocorrência vale). */
export function parseFiscalGrid(
  grid: string[][],
  kind: FiscalKind,
): FiscalEntry[] {
  const cols = findColumns(grid, kind);
  if (!cols) return [];
  const out = new Map<string, FiscalEntry>();
  for (const row of grid.slice(cols.header + 1)) {
    if (cols.ex !== null && (row[cols.ex] ?? "").trim()) continue;
    const ncm = normalizeNcm(row[cols.ncm]);
    if (!ncm || out.has(ncm)) continue;
    const rate = parseRate(row[cols.rate]);
    if (!rate) continue;
    const description =
      cols.description !== null
        ? (row[cols.description] ?? "").trim().slice(0, 300) || null
        : null;
    out.set(ncm, { ncm, description, ...rate });
  }
  const entries = [...out.values()];
  // Planilha com formato de porcentagem: 0,18 em vez de 18.
  const max = Math.max(0, ...entries.map((e) => e.rate));
  if (max > 0 && max <= 1)
    for (const e of entries) e.rate = Math.round(e.rate * 10000) / 100;
  return entries;
}

/** CSV/TXT em linhas (separador ; , ou tab; aspas duplas). */
export function csvGrid(text: string): string[][] {
  const lines = text
    .replace(/^﻿/, "")
    .replace(/\r/g, "")
    .split("\n")
    .filter((l) => l.trim() !== "");
  const first = lines.slice(0, 20).join("\n");
  const count = (ch: string) => first.split(ch).length;
  const sep = [";", "\t", ","].sort((a, b) => count(b) - count(a))[0];
  return lines.map((line) => {
    const out: string[] = [];
    let cur = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (quoted && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else quoted = !quoted;
      } else if (ch === sep && !quoted) {
        out.push(cur.trim());
        cur = "";
      } else cur += ch;
    }
    out.push(cur.trim());
    return out;
  });
}

const MAX_ROWS = 30_000;

/** Lê o arquivo (XLSX ou CSV) e devolve a alíquota de cada NCM; usa a aba com mais NCMs. */
export function parseFiscalFile(
  bytes: Uint8Array,
  kind: FiscalKind,
): FiscalEntry[] {
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (!isZip) {
    let text = new TextDecoder("utf-8").decode(bytes);
    if (text.includes("�")) text = new TextDecoder("latin1").decode(bytes);
    return parseFiscalGrid(csvGrid(text), kind);
  }
  let best: FiscalEntry[] = [];
  const sheets = listSheets(bytes).length;
  for (let sheet = 0; sheet < Math.min(sheets, 10); sheet++) {
    const entries = parseFiscalGrid(
      readGrid(bytes, sheet, MAX_ROWS).grid,
      kind,
    );
    if (entries.length > best.length) best = entries;
  }
  return best;
}

/** O link baixou uma página (HTML) e não a planilha? */
export function looksLikeHtml(bytes: Uint8Array, contentType: string | null) {
  if (/html/i.test(contentType ?? "")) return true;
  const head = new TextDecoder()
    .decode(bytes.slice(0, 512))
    .replace(/^﻿/, "")
    .trimStart()
    .toLowerCase();
  return head.startsWith("<!doctype html") || head.startsWith("<html");
}

/** "11-11-2026-anexos…" → 20261111 (para achar a versão mais nova); sem data, 0. */
function dateInName(url: string) {
  const m = /(\d{2})[-_.](\d{2})[-_.](\d{4})/.exec(url);
  return m ? Number(`${m[3]}${m[2]}${m[1]}`) : 0;
}

/**
 * Link da planilha dentro de uma página oficial: assim o robô aceita a página
 * da Camex ("Anexos compilados", tarifas vigentes), cujo arquivo muda de nome a
 * cada versão. TEC: a planilha dos "anexos I a X" (Resolução Gecex 272) mais
 * nova pela data no nome; TIPI: a planilha com "tipi" no nome. Sem nenhuma, null.
 */
export function findSheetLink(
  html: string,
  pageUrl: string,
  kind: FiscalKind,
): string | null {
  const links = new Set<string>();
  for (const m of html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
    let href = m[1].replace(/&amp;/g, "&").trim();
    // Plone (gov.br): ".../arquivo.xlsx/view" e ".../arquivo.xlsx/@@download/file/..." apontam para o arquivo.
    href = href.replace(
      /(\.(?:xlsx|xls|csv))\/(?:view|@@download\/.*)$/i,
      "$1",
    );
    if (!/\.(xlsx|xls|csv)(\?.*)?$/i.test(href)) continue;
    try {
      const url = new URL(href, pageUrl);
      if (url.protocol === "https:") links.add(url.toString());
    } catch {
      // link quebrado: ignora
    }
  }
  const name = (u: string) => decodeURIComponent(u).toLowerCase();
  const wanted = [...links].filter((u) =>
    kind === "tec"
      ? /anexos?[-_ ]i[-_ ]a[-_ ]x/.test(name(u)) ||
        /(^|[^a-z])tec([^a-z]|$)/.test(name(u).split("/").pop() ?? "")
      : /tipi/.test(name(u).split("/").pop() ?? ""),
  );
  if (!wanted.length) return null;
  return wanted.sort((a, b) => dateInName(b) - dateInName(a))[0];
}
