/*
 * Onde fica uma imagem na grade da planilha (docs/BOOKING.md, "Fotos da
 * planilha"): as âncoras do desenho dizem a célula em que a imagem começa,
 * com um deslocamento dentro dela, e onde termina. Para saber a que linha
 * (e a que coluna) a foto pertence vale a célula do centro da imagem, não
 * a do canto: a foto colada um pouco acima da linha (o canto na linha de
 * cima) continua sendo da linha em que está quase toda.
 *
 * Cada eixo (linhas, colunas) tem um tamanho padrão e os tamanhos próprios
 * de algumas posições; a unidade é a do arquivo (EMU no .xlsx, twips e
 * 1/256 de caractere no .xls), basta ser a mesma no eixo inteiro.
 */

/** Maior posição de cada eixo (o tamanho da grade do Excel). */
export const MAX_SHEET_ROWS_INDEX = 1_048_576;
export const MAX_SHEET_COLS_INDEX = 16_384;

export class SheetAxis {
  private readonly index: number[] = [];
  /** Soma das diferenças (tamanho próprio − padrão) até cada posição explícita, inclusive. */
  private readonly prefix: number[] = [];
  private readonly sizes = new Map<number, number>();

  constructor(
    readonly defaultSize: number,
    explicit: Iterable<[number, number]>,
    readonly limit: number,
  ) {
    for (const [i, size] of explicit) {
      if (!Number.isInteger(i) || i < 0 || i >= limit) continue;
      if (!Number.isFinite(size) || size < 0) continue;
      this.sizes.set(i, size);
    }
    const sorted = [...this.sizes.keys()].sort((a, b) => a - b);
    let sum = 0;
    for (const i of sorted) {
      sum += (this.sizes.get(i) ?? defaultSize) - defaultSize;
      this.index.push(i);
      this.prefix.push(sum);
    }
  }

  size(i: number): number {
    return this.sizes.get(i) ?? this.defaultSize;
  }

  /** Início da posição `i` (soma dos tamanhos de 0 a i − 1). */
  start(i: number): number {
    const n = Math.max(0, Math.min(i, this.limit));
    // Posições explícitas antes de n (busca binária).
    let lo = 0;
    let hi = this.index.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.index[mid] < n) lo = mid + 1;
      else hi = mid;
    }
    return n * this.defaultSize + (lo > 0 ? this.prefix[lo - 1] : 0);
  }

  /** Posição que contém o ponto `p` (a última cujo início não passa de p). */
  at(p: number): number {
    if (!(p > 0)) return 0;
    let lo = 0;
    let hi = this.limit - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.start(mid) <= p) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }
}

/** Células que a imagem cobre (do zero; as pontas inclusive) e a do centro. */
export interface ImageCells {
  row: number;
  col: number;
  toRow: number;
  toCol: number;
  centerRow: number;
  centerCol: number;
}

/**
 * Retângulo da imagem (na unidade dos eixos) → células. O canto de baixo à
 * direita é exclusivo: a imagem que termina exatamente no começo da linha
 * seguinte não a cobre.
 */
export function cellsOfRect(
  rows: SheetAxis,
  cols: SheetAxis,
  rect: { x1: number; y1: number; x2: number; y2: number },
): ImageCells {
  const x1 = Math.min(rect.x1, rect.x2);
  const x2 = Math.max(rect.x1, rect.x2);
  const y1 = Math.min(rect.y1, rect.y2);
  const y2 = Math.max(rect.y1, rect.y2);
  const row = rows.at(y1);
  const col = cols.at(x1);
  const toRow = Math.max(row, y2 > y1 ? rows.at(y2 - 1e-6) : row);
  const toCol = Math.max(col, x2 > x1 ? cols.at(x2 - 1e-6) : col);
  return {
    row,
    col,
    toRow,
    toCol,
    centerRow: Math.min(toRow, Math.max(row, rows.at((y1 + y2) / 2))),
    centerCol: Math.min(toCol, Math.max(col, cols.at((x1 + x2) / 2))),
  };
}

/** Âncora numa célula (posição + deslocamento dentro dela) → ponto no eixo. */
export function pointOf(axis: SheetAxis, cell: number, offset: number): number {
  const safe = Number.isFinite(offset) && offset > 0 ? offset : 0;
  return axis.start(cell) + safe;
}
