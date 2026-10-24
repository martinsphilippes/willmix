/*
 * Pedido mínimo (MOQ) de um produto do catálogo, em peças. Vale o da variação
 * escolhida; sem ela, o da ficha mestre; sem ela, o do cadastro. Só se compara
 * com quantidades em peças: uma solicitação em caixas, quilos ou metros não
 * tem como ser conferida. Sem "server-only": a nova solicitação usa no
 * navegador para já sugerir (e não deixar abaixo) o mínimo.
 */

const PIECE_UNITS =
  /^(un|und|unid|unidade|unidades|pc|pcs|pç|pçs|peça|peças|piece|pieces|pz|件|个|個)\.?$/i;

/** A unidade conta peças (e por isso o pedido mínimo se aplica)? Vazia = peças. */
export function isPieceUnit(unit: string | null | undefined): boolean {
  const u = (unit ?? "").trim();
  return u === "" || PIECE_UNITS.test(u);
}

const positive = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;

/**
 * Mínimo que vale: variação, senão ficha mestre, senão cadastro; zero ou
 * vazio = sem mínimo ali. Produto sem variação: passe `null` na primeira.
 */
export function effectiveMoq(
  variantMoq: number | null | undefined,
  sheetMoq: number | null | undefined,
  productMoq: number | null | undefined,
): number | null {
  return positive(variantMoq) ?? positive(sheetMoq) ?? positive(productMoq);
}
