import "server-only";

import {
  getStore,
  type BookingItem,
  type BookingLot,
  type User,
} from "@/lib/db";
import { ForbiddenError, isWellmix } from "@/lib/auth/permissions";
import { assertScreen } from "@/lib/auth/screens";

/*
 * Booking para o login externo (dono, 11/11/2026): o Trading (e outro tipo
 * com login a quem a tela for liberada na Gestão de telas) abre a tela
 * Booking e vê SÓ os bookings da empresa dele: aqueles em que ela é o
 * responsável ou o fornecedor. Só leitura.
 *
 * Fica de fora, de propósito: bookings de outros fornecedores, a análise da
 * Wellmix (Superplan, viabilidade, margem), o NCM, o produto do cadastro, as
 * colunas extras da planilha e as notas internas. As rotinas da Wellmix
 * (src/lib/services/booking-lots.ts) continuam só da Wellmix.
 */

function assertPartnerBooking(user: User): string {
  assertScreen(user, "booking");
  if (isWellmix(user) || !user.partyId) throw new ForbiddenError();
  return user.partyId;
}

/** O booking é da empresa: ela é o responsável ou o fornecedor dele. */
const isOwnLot = (
  lot: Pick<BookingLot, "supplierId" | "partnerId">,
  partyId: string,
) => lot.partnerId === partyId || lot.supplierId === partyId;

export type PartnerBookingLot = Pick<
  BookingLot,
  | "id"
  | "number"
  | "status"
  | "origin"
  | "bookingDate"
  | "fileName"
  | "itemCount"
  | "createdAt"
>;

const lotView = (lot: BookingLot): PartnerBookingLot => ({
  id: lot.id,
  number: lot.number,
  status: lot.status,
  origin: lot.origin ?? null,
  bookingDate: lot.bookingDate ?? null,
  fileName: lot.fileName,
  itemCount: lot.itemCount,
  createdAt: lot.createdAt,
});

/** Só o que veio da planilha dele: nada da análise nem do cadastro da Wellmix. */
export type PartnerBookingItem = Pick<
  BookingItem,
  | "id"
  | "position"
  | "itemNumber"
  | "factoryItemCode"
  | "productName"
  | "description"
  | "incoterm"
  | "currency"
  | "price"
  | "masterCartonQty"
  | "innerQty"
  | "netWeightPcKg"
  | "grossWeightPcKg"
  | "cbmPerCarton"
  | "lengthCm"
  | "widthCm"
  | "heightCm"
  | "capacityMl"
  | "packageType"
  | "material"
  | "moq"
  | "colorAssortment"
>;

const itemView = (i: BookingItem): PartnerBookingItem => ({
  id: i.id,
  position: i.position,
  itemNumber: i.itemNumber,
  factoryItemCode: i.factoryItemCode,
  productName: i.productName,
  description: i.description,
  incoterm: i.incoterm,
  currency: i.currency,
  price: i.price,
  masterCartonQty: i.masterCartonQty,
  innerQty: i.innerQty,
  netWeightPcKg: i.netWeightPcKg,
  grossWeightPcKg: i.grossWeightPcKg,
  cbmPerCarton: i.cbmPerCarton,
  lengthCm: i.lengthCm,
  widthCm: i.widthCm,
  heightCm: i.heightCm,
  capacityMl: i.capacityMl,
  packageType: i.packageType,
  material: i.material,
  moq: i.moq,
  colorAssortment: i.colorAssortment,
});

/** Os bookings da empresa de quem abre, do mais novo para o mais antigo. */
export async function listPartnerBookingLots(
  user: User,
): Promise<PartnerBookingLot[] | null> {
  const partyId = assertPartnerBooking(user);
  const store = getStore();
  let lots: BookingLot[];
  try {
    // Duas consultas pelo vínculo (responsável e fornecedor): os bookings das
    // outras empresas nem são lidos.
    lots = (
      await Promise.all([
        store.list("booking_lots", { filter: { partnerId: partyId } }),
        store.list("booking_lots", { filter: { supplierId: partyId } }),
      ])
    ).flat();
  } catch (error) {
    const { isSchemaMissing } = await import("@/lib/db/errors");
    if (isSchemaMissing(error)) return null;
    throw error;
  }
  const own = new Map(
    lots.filter((lot) => isOwnLot(lot, partyId)).map((lot) => [lot.id, lot]),
  );
  return [...own.values()].sort((a, b) => b.number - a.number).map(lotView);
}

/** Um booking da empresa de quem abre, com os itens; nulo se não é dela. */
export async function getPartnerBookingLot(
  user: User,
  lotId: string,
): Promise<{ lot: PartnerBookingLot; items: PartnerBookingItem[] } | null> {
  const partyId = assertPartnerBooking(user);
  const store = getStore();
  const lot = await store.get("booking_lots", lotId);
  if (!lot || !isOwnLot(lot, partyId)) return null;
  const items = await store.list("booking_items", { filter: { lotId } });
  return {
    lot: lotView(lot),
    items: items.sort((a, b) => a.position - b.position).map(itemView),
  };
}
