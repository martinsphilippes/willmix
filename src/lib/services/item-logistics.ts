import { boxesFor } from "@/lib/logistics/cbm";
import type { Product, VariantSnapshot } from "@/lib/db";

/*
 * Dados de cadastro e de carga de um item (pedido ou solicitação): código,
 * código do item na fábrica, especificação, cor, quantidade por caixa,
 * caixas, volume e peso. A variação escolhida vale antes do cadastro do
 * produto. Funções puras: a folha do pedido em lista (Clientes e
 * Fornecedores) e a lista de Pedidos usam a mesma conta, então os números
 * batem entre as telas.
 */

export interface ItemLogistics {
  sku: string | null;
  supplierSku: string | null;
  specification: string | null;
  color: string | null;
  unitsPerBox: number | null;
  /** Caixas master (0 sem quantidade por caixa no cadastro). */
  boxes: number;
  /** Volume total (m³) = caixas × CBM da caixa master. */
  cbm: number | null;
  /** Peso bruto total (kg) = quantidade × peso bruto por unidade. */
  weightKg: number | null;
}

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

export function itemLogistics(input: {
  quantity: number;
  variant?: Pick<
    VariantSnapshot,
    | "factoryItemCode"
    | "masterBoxQty"
    | "cbm"
    | "grossWeightKg"
    | "colorAssortment"
  > | null;
  product: Pick<
    Product,
    | "sku"
    | "supplierSku"
    | "specification"
    | "color"
    | "masterBoxQty"
    | "cbm"
    | "grossWeightKg"
  > | null;
  /** Especificação da solicitação: vale antes da do cadastro. */
  specification?: string | null;
}): ItemLogistics {
  const v = input.variant ?? null;
  const p = input.product;
  const perBox = v?.masterBoxQty ?? p?.masterBoxQty ?? null;
  const boxes = boxesFor(input.quantity, perBox);
  const boxCbm = v?.cbm ?? p?.cbm ?? null;
  const gross = v?.grossWeightKg ?? p?.grossWeightKg ?? null;
  return {
    sku: p?.sku ?? null,
    supplierSku: v?.factoryItemCode ?? p?.supplierSku ?? null,
    specification: input.specification ?? p?.specification ?? null,
    color: v?.colorAssortment ?? p?.color ?? null,
    unitsPerBox: perBox,
    boxes,
    cbm: boxCbm !== null ? round(boxes * boxCbm, 4) : null,
    weightKg: gross !== null ? round(input.quantity * gross, 2) : null,
  };
}

export interface LogisticsTotals {
  /** Nulo quando nenhum item tem o dado (mostra "—", não um 0 enganoso). */
  weightKg: number | null;
  boxes: number | null;
  cbm: number | null;
  /** Soma só quando todos os itens têm a mesma unidade. */
  quantity: { value: number; unit: string } | null;
  /** Valor por moeda (itens com preço). */
  amounts: Record<string, number>;
}

/** Linha de total da tabela de itens: soma o que cada item tem. */
export function logisticsTotals(
  items: {
    quantity: number;
    unit: string;
    logistics: ItemLogistics;
    amount: number | null;
    currency: string | null;
  }[],
): LogisticsTotals {
  const sum = (values: (number | null)[], d: number) => {
    const known = values.filter((v): v is number => v !== null);
    return known.length
      ? round(
          known.reduce((s, v) => s + v, 0),
          d,
        )
      : null;
  };
  const units = new Set(items.map((i) => i.unit));
  const amounts: Record<string, number> = {};
  for (const i of items)
    if (i.amount !== null && i.currency)
      amounts[i.currency] = round((amounts[i.currency] ?? 0) + i.amount);
  return {
    weightKg: sum(
      items.map((i) => i.logistics.weightKg),
      2,
    ),
    boxes: sum(
      items.map((i) =>
        i.logistics.unitsPerBox !== null ? i.logistics.boxes : null,
      ),
      0,
    ),
    cbm: sum(
      items.map((i) => i.logistics.cbm),
      4,
    ),
    quantity:
      items.length && units.size === 1
        ? {
            value: round(
              items.reduce((s, i) => s + i.quantity, 0),
              4,
            ),
            unit: items[0].unit,
          }
        : null,
    amounts,
  };
}
