/*
 * Programações e containers de uma solicitação (lista no nível do pedido;
 * dono, 18/11/2026): quantas programações (entregas) o pedido tem e quantos
 * containers cada uma enche, pela programação gravada em cada produto
 * (`requests.schedule`) e pela caixa master (peças e CBM da variação ou do
 * cadastro). Os produtos enchem os containers em ordem, como na Composição
 * de containers da Nova solicitação (src/lib/container-composition.ts).
 *
 * Sem programação, o produto é uma entrega só (a quantidade toda na 1ª).
 * O container de referência é o que a tela passa (o maior das
 * Configurações): a solicitação não grava o tipo escolhido no formulário.
 */

import { containerComposition } from "./container-composition";

export interface RoundsRequest {
  id: string;
  productName: string | null;
  quantity: number | null;
  schedule?: { items?: ReadonlyArray<{ quantity: number }> | null } | null;
  variant?: { masterBoxQty?: number | null; cbm?: number | null } | null;
}

export interface RoundsProduct {
  masterBoxQty?: number | null;
  cbm?: number | null;
}

export interface RequestRounds {
  /** Programações do pedido (a maior entre os produtos; 1 sem programação). */
  rounds: number;
  /**
   * Containers de cada programação (índice = programação); nulo quando
   * algum produto com peças não tem caixa master ou CBM (a conta ficaria
   * menor do que é).
   */
  containers: number[] | null;
}

/** Peças de cada programação de um produto. */
function piecesOf(r: RoundsRequest): number[] {
  const items = r.schedule?.items ?? [];
  if (items.length) return items.map((i) => Number(i.quantity) || 0);
  const q = Number(r.quantity) || 0;
  return [q];
}

export function requestRounds(
  rows: readonly RoundsRequest[],
  productOf: (r: RoundsRequest) => RoundsProduct | null,
  capacityCbm: number | null,
): RequestRounds {
  const pieces = rows.map(piecesOf);
  const rounds = Math.max(1, ...pieces.map((p) => p.length));
  if (!capacityCbm || capacityCbm <= 0) return { rounds, containers: null };
  const comp = containerComposition(
    rows.map((r, i) => {
      const product = productOf(r);
      return {
        key: r.id,
        name: r.productName ?? "",
        masterCartonQty: r.variant?.masterBoxQty ?? product?.masterBoxQty ?? null,
        cbmPerCarton: r.variant?.cbm ?? product?.cbm ?? null,
        pieces: pieces[i],
      };
    }),
    rounds,
    capacityCbm,
  );
  if (comp.missing.length || comp.tooBig.length)
    return { rounds, containers: null };
  return {
    rounds,
    containers: Array.from(
      { length: rounds },
      (_, r) => comp.rows.filter((row) => row.cells[r]).length,
    ),
  };
}

/** "2 · 2 · 1" (iguais: "2 em cada"); mais de 6 programações, o menor e o maior. */
export function containersText(
  containers: readonly number[],
  eachLabel: (n: number) => string,
): string {
  if (!containers.length) return "—";
  if (containers.every((c) => c === containers[0]))
    return containers.length > 1
      ? eachLabel(containers[0])
      : String(containers[0]);
  if (containers.length > 6) {
    const min = Math.min(...containers);
    const max = Math.max(...containers);
    return `${min}–${max}`;
  }
  return containers.join(" · ");
}
