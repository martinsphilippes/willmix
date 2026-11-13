import type {
  BookingItem,
  SupplierRequest,
  SupplierRequestItem,
} from "@/lib/db/schema";
import { bookingCapacityShown } from "@/lib/booking-lots";
import { boxesFor, cbmFromDimensions } from "@/lib/logistics/cbm";
import { roundLoad } from "@/lib/purchase-rounds";

/*
 * Ficha técnica de um produto da solicitação ao fornecedor, para a tabela
 * "Produtos desta solicitação" (docs/SUPPLIER_REQUESTS.md, "Ficha técnica na
 * tabela"). Vale a cópia gravada na solicitação; o que ela não guarda
 * (solicitação antiga, campo criado depois) vem do item exato do Book
 * (`bookingItemId`), nunca de outro item com o mesmo nome ou código.
 */

/** Campos técnicos que a cópia da solicitação e o item do Book têm em comum. */
export const REQUEST_SPEC_FIELDS = [
  "description",
  "productName",
  "masterCartonQty",
  "innerQty",
  "netWeightPcKg",
  "grossWeightPcKg",
  "cbmPerCarton",
  "lengthCm",
  "widthCm",
  "heightCm",
  "capacityMl",
  "sizeText",
  "packageType",
  "material",
  "colorAssortment",
  "powerDetail",
] as const satisfies ReadonlyArray<
  keyof SupplierRequestItem & keyof BookingItem
>;

export type RequestSpecField = (typeof REQUEST_SPEC_FIELDS)[number];

/** O que a tabela lê do item do Book: só a ficha técnica (e o NCM, da Wellmix). */
export type RequestBookSpecs = Pick<BookingItem, RequestSpecField> & {
  ncm?: string | null;
};

export const requestBookSpecsOf = (item: BookingItem): RequestBookSpecs => ({
  ...(Object.fromEntries(
    REQUEST_SPEC_FIELDS.map((f) => [f, item[f] ?? null]),
  ) as Pick<BookingItem, RequestSpecField>),
  ncm: item.ncm ?? null,
});

export interface RequestItemSpecs extends Pick<
  SupplierRequestItem,
  RequestSpecField
> {
  sizeText: string | null;
  /** Mililitros (número) ou o tamanho em texto ("8X10", "A4"). */
  capacity: number | string | null;
  /** Campos que a solicitação não guardava e vieram do item do Book. */
  fromBook: RequestSpecField[];
  /** Caixas master do total pedido (inteiras; por rodada, quando há rodadas). */
  totalCartons: number | null;
  /** Cubagem do total pedido (m³): caixas × CBM da caixa master. */
  totalCbm: number | null;
  /** O CBM dos totais foi calculado das medidas (sem CBM informado). */
  cbmFromMeasures: boolean;
}

const missing = (v: unknown) =>
  v === null || v === undefined || (typeof v === "string" && !v.trim());

export function requestItemSpecs(
  request: Pick<SupplierRequest, "item" | "quantity" | "schedule">,
  book?: Partial<RequestBookSpecs> | null,
): RequestItemSpecs {
  const fromBook: RequestSpecField[] = [];
  const values: Record<string, unknown> = {};
  for (const f of REQUEST_SPEC_FIELDS) {
    const saved = request.item[f];
    if (!missing(saved)) {
      values[f] = saved;
      continue;
    }
    const other = book?.[f];
    if (!missing(other)) {
      values[f] = other;
      fromBook.push(f);
    } else values[f] = null;
  }
  const specs = values as Pick<SupplierRequestItem, RequestSpecField> & {
    sizeText: string | null;
  };

  // Mesma regra da seleção de itens: CBM informado; senão, o das medidas.
  const measured = specs.cbmPerCarton
    ? null
    : cbmFromDimensions(specs.lengthCm, specs.widthCm, specs.heightCm);
  const cbm = specs.cbmPerCarton || measured;
  // Com programação de compra, cada rodada fecha as suas caixas inteiras.
  const quantities = request.schedule?.items.length
    ? request.schedule.items.map((i) => i.quantity)
    : [request.quantity];
  const master = specs.masterCartonQty;
  let totalCartons: number | null = null;
  let totalCbm: number | null = null;
  if (master && master > 0 && quantities.every((q) => q > 0)) {
    const loads = cbm
      ? quantities.map((q) => roundLoad(q, master, cbm, null))
      : [];
    if (cbm && loads.every((l) => l)) {
      totalCartons = loads.reduce((s, l) => s + l!.cartons, 0);
      totalCbm =
        Math.round(loads.reduce((s, l) => s + l!.cbm, 0) * 10000) / 10000;
    } else
      totalCartons = quantities.reduce((s, q) => s + boxesFor(q, master), 0);
  }

  return {
    ...specs,
    capacity: bookingCapacityShown(specs),
    fromBook,
    totalCartons,
    totalCbm,
    cbmFromMeasures: totalCbm !== null && !!measured,
  };
}
