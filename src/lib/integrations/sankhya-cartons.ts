import "server-only";
import { getStore, type Product, type User } from "@/lib/db";
import { audit } from "@/lib/services/audit";
import { executeQuery, type SankhyaRow } from "./sankhya-client";
import type { FullLoadProgress } from "./sankhya-full-load";
import { boxQuantities, IGNORED_VOLUMES } from "./sankhya-mapping";
import { readSetting, writeSetting } from "./sankhya-settings";

/*
 * Carga extra das caixas (dono, 15/11/2026): lê só os volumes alternativos
 * do Sankhya (TGFVOA), por faixa de CODPROD, e acerta a caixa dos produtos
 * que já estão no portal, sem mexer em nome, SKU, medidas ou preço:
 *
 * - CBM da caixa master (M3 do volume da master) quando o CBM está vazio e a
 *   quantidade por caixa do portal é a mesma da master do Sankhya;
 * - peças por caixa master quando estão vazias;
 * - caixa interna que veio do volume C1 (resto de cadastro antigo): troca
 *   pela interna certa dos outros volumes, ou vazio.
 *
 * Roda como mais uma entidade da Carga completa (`productCartons`); o cursor
 * fica em settings (`sankhya.load.productCartons`).
 */

const KEY = "sankhya.load.productCartons";
const ROWS = { min: 100, max: 600 };

const EMPTY: FullLoadProgress = {
  after: 0,
  span: 2000,
  done: false,
  remaining: null,
  counts: {},
  missing: [],
  startedAt: null,
  updatedAt: null,
};

const int0 = (n: number) => Math.max(0, Math.trunc(Number(n) || 0));
const num = (v: unknown) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return v == null || String(v).trim() === "" || !Number.isFinite(n) ? null : n;
};

export function cartonProbeSql(after: number) {
  return `SELECT MIN(CODPROD) AS NEXTCODE, COUNT(DISTINCT CODPROD) AS REMAINING FROM TGFVOA WHERE CODPROD > ${int0(after)}`;
}

export function cartonRangeSql(after: number, upTo: number) {
  return `SELECT * FROM TGFVOA WHERE CODPROD > ${int0(after)} AND CODPROD <= ${int0(upTo)} ORDER BY CODPROD`;
}

/** O que muda na caixa do produto pelos volumes do Sankhya (vazio = nada). */
export function cartonPatch(
  product: Pick<Product, "masterBoxQty" | "innerBoxQty" | "cbm">,
  volumes: SankhyaRow[],
): Partial<Pick<Product, "masterBoxQty" | "innerBoxQty" | "cbm">> {
  const box = boxQuantities(volumes);
  const patch: Partial<Pick<Product, "masterBoxQty" | "innerBoxQty" | "cbm">> =
    {};
  const master = product.masterBoxQty ?? box.masterBoxQty;
  if (product.masterBoxQty == null && box.masterBoxQty != null)
    patch.masterBoxQty = box.masterBoxQty;
  if (
    !(product.cbm != null && product.cbm > 0) &&
    box.masterCbm != null &&
    master === box.masterBoxQty
  )
    patch.cbm = box.masterCbm;
  // A interna gravada é a quantidade do C1: troca pela certa (ou vazio).
  const c1 = new Set(
    volumes
      .filter((v) =>
        IGNORED_VOLUMES.has(
          String(v.CODVOL ?? "")
            .trim()
            .toUpperCase(),
        ),
      )
      .map((v) => num(v.QUANTIDADE)),
  );
  if (
    product.innerBoxQty != null &&
    c1.has(product.innerBoxQty) &&
    box.innerBoxQty !== product.innerBoxQty
  )
    patch.innerBoxQty = box.innerBoxQty;
  return patch;
}

export async function runCartonLoad(
  user: User,
  budgetMs = 30_000,
  now: () => number = () => Date.now(),
): Promise<FullLoadProgress> {
  const started = now();
  const progress: FullLoadProgress = {
    ...EMPTY,
    ...((await readSetting<FullLoadProgress>(KEY)) ?? {}),
  };
  if (progress.done) return progress;
  progress.startedAt ??= new Date().toISOString();
  const store = getStore();
  let changed = 0;
  let worked = false;
  while (!worked || now() - started < budgetMs) {
    worked = true;
    const probe = await executeQuery(cartonProbeSql(progress.after));
    const next = Number(probe.rows[0]?.NEXTCODE);
    progress.remaining = Number(probe.rows[0]?.REMAINING) || 0;
    if (!Number.isFinite(next) || !progress.remaining) {
      progress.done = true;
      break;
    }
    const from = next - 1;
    const upTo = from + progress.span;
    const rows = (await executeQuery(cartonRangeSql(from, upTo))).rows;
    if (rows.length > ROWS.max)
      progress.span = Math.max(1, Math.floor(progress.span / 2));
    else if (rows.length < ROWS.min)
      progress.span = Math.min(1_000_000, progress.span * 2);
    const byCode = new Map<string, SankhyaRow[]>();
    for (const r of rows) {
      const code = String(Number(r.CODPROD));
      byCode.set(code, [...(byCode.get(code) ?? []), r]);
    }
    const products = byCode.size
      ? await store.list("products", {
          filter: { sankhyaCode: [...byCode.keys()] },
        })
      : [];
    for (const p of products) {
      const patch = cartonPatch(p, byCode.get(p.sankhyaCode!) ?? []);
      if (!Object.keys(patch).length) {
        progress.counts.existing = (progress.counts.existing ?? 0) + 1;
        continue;
      }
      await store.update("products", p.id, patch);
      progress.counts.updated = (progress.counts.updated ?? 0) + 1;
      changed++;
    }
    progress.counts.skipped =
      (progress.counts.skipped ?? 0) + (byCode.size - products.length);
    progress.after = upTo;
    progress.updatedAt = new Date().toISOString();
    await writeSetting(KEY, progress);
  }
  progress.updatedAt = new Date().toISOString();
  await writeSetting(KEY, progress);
  if (changed)
    await audit(
      user,
      "sankhya.cartons",
      "system",
      "sankhya",
      `Caixas do Sankhya: ${changed} produtos acertados (até CODPROD ${progress.after})`,
    );
  return progress;
}
