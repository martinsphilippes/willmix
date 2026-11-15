/*
 * Composição de containers da Nova solicitação (dono, 15/11/2026;
 * docs/ORDER_TERMS.md seção 8): por programação, os produtos do pedido
 * enchem os containers em ordem (o 1º produto primeiro), em caixas master
 * inteiras, pelo CBM da caixa. Cada container de cada programação tem a
 * ocupação (soma das caixas dos produtos dentro dele) e a de cada produto.
 */

export interface CompositionItem {
  /** Chave estável da linha de produto do formulário. */
  key: string;
  name: string;
  /** Peças por caixa master; sem ela não há como saber as caixas. */
  masterCartonQty: number | null;
  /** CBM de uma caixa master. */
  cbmPerCarton: number | null;
  /** Peças em cada programação (índice = programação). */
  pieces: number[];
}

export interface CompositionShare {
  key: string;
  name: string;
  cartons: number;
  cbm: number;
  /** Fração do container (0 a 1). */
  share: number;
}

export interface CompositionCell {
  cbm: number;
  /** Fração do container ocupada (0 a 1). */
  share: number;
  products: CompositionShare[];
}

export interface CompositionRow {
  /** Container nº (1, 2…) dentro de cada programação. */
  n: number;
  /** Uma célula por programação; nula = a programação não usa este container. */
  cells: Array<CompositionCell | null>;
}

export interface Composition {
  rounds: number;
  capacityCbm: number;
  rows: CompositionRow[];
  /** Produtos sem caixa master ou CBM (ficam fora da conta). */
  missing: string[];
  /** Produtos cuja caixa não cabe no container. */
  tooBig: string[];
}

const r4 = (n: number) => Math.round(n * 10_000) / 10_000;
const pos = (n: number | null | undefined): n is number =>
  typeof n === "number" && Number.isFinite(n) && n > 0;

/** Os containers de cada programação, enchidos produto a produto. */
export function containerComposition(
  items: readonly CompositionItem[],
  rounds: number,
  capacityCbm: number,
): Composition {
  const missing: string[] = [];
  const tooBig: string[] = [];
  const usable = items.filter((item) => {
    if (!item.pieces.some((p) => p > 0)) return false;
    if (!pos(item.masterCartonQty) || !pos(item.cbmPerCarton)) {
      missing.push(item.name);
      return false;
    }
    if (item.cbmPerCarton > capacityCbm + 1e-9) {
      tooBig.push(item.name);
      return false;
    }
    return true;
  });
  // Por programação: a lista de containers, cada um com os produtos dentro.
  const perRound: CompositionCell[][] = [];
  for (let r = 0; r < rounds; r++) {
    const containers: CompositionCell[] = [];
    let current: CompositionCell | null = null;
    for (const item of usable) {
      const pieces = item.pieces[r] ?? 0;
      if (!(pieces > 0)) continue;
      let left = Math.ceil(pieces / item.masterCartonQty! - 1e-9);
      const cbm = item.cbmPerCarton!;
      while (left > 0) {
        if (!current || capacityCbm - current.cbm < cbm - 1e-9) {
          current = { cbm: 0, share: 0, products: [] };
          containers.push(current);
        }
        const fit = Math.floor((capacityCbm - current.cbm) / cbm + 1e-9);
        const take = Math.min(fit, left);
        const share = current.products.find((p) => p.key === item.key);
        if (share) {
          share.cartons += take;
          share.cbm = r4(share.cartons * cbm);
        } else
          current.products.push({
            key: item.key,
            name: item.name,
            cartons: take,
            cbm: r4(take * cbm),
            share: 0,
          });
        current.cbm = r4(current.cbm + take * cbm);
        left -= take;
      }
    }
    for (const c of containers) {
      c.share = c.cbm / capacityCbm;
      for (const p of c.products) p.share = p.cbm / capacityCbm;
    }
    perRound.push(containers);
  }
  const most = Math.max(0, ...perRound.map((c) => c.length));
  const rows: CompositionRow[] = Array.from({ length: most }, (_, i) => ({
    n: i + 1,
    cells: perRound.map((c) => c[i] ?? null),
  }));
  return { rounds, capacityCbm, rows, missing, tooBig };
}

/** Ocupação para mostrar: "26" (de 0,262), "<1" para quase nada; para baixo como nos cartões. */
export function sharePercent(share: number): string {
  const pct = Math.floor(share * 100 + 1e-9);
  return share > 0 && pct < 1 ? "<1" : String(pct);
}
