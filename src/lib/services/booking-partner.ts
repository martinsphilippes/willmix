import "server-only";

import {
  getStore,
  type BookingItem,
  type BookingLot,
  type Party,
  type SheetCurrency,
  type User,
} from "@/lib/db";
import { ForbiddenError, isAdmin, isWellmix } from "@/lib/auth/permissions";
import { accessFromFunctions } from "@/lib/auth/function-access";
import { assertScreen, canOpen, screensFor } from "@/lib/auth/screens";
import { bookingRecipientId, isBookingPartner } from "@/lib/booking-lots";
import type { SheetSource } from "./product-sheet-import";

/*
 * Booking para o login externo (dono, 11/11/2026): o Trading (e outro tipo
 * com login a quem a tela for liberada na Gestão de telas) abre a tela
 * Booking, LANÇA os bookings da empresa dele (sobe a planilha) e vê SÓ os
 * bookings dela.
 *
 * "Dela" = aqueles pelos quais a empresa responde: é o responsável do booking
 * ou, sem responsável, o fornecedor (a mesma regra de para quem vão as
 * solicitações, `bookingRecipientId`). O booking que uma trading lança com o
 * preço dela não aparece para a fábrica citada na planilha.
 *
 * Fica de fora, de propósito: bookings de outras empresas, a análise da
 * Wellmix (Superplan, viabilidade, margem), o NCM, o produto do cadastro, as
 * colunas extras da planilha e as notas internas. Depois de lançado, o
 * booking é conferido, ajustado, fechado ou cancelado pela Wellmix: as
 * rotinas dela (src/lib/services/booking-lots.ts) continuam só da Wellmix.
 */

export class PartnerBookingError extends Error {}

/** Até quantos bookings a mesma empresa lança em 24 horas (trava de abuso). */
export const PARTNER_DAILY_LAUNCHES = 20;

function assertPartnerBooking(user: User): string {
  assertScreen(user, "booking");
  if (isWellmix(user) || !user.partyId) throw new ForbiddenError();
  return user.partyId;
}

/** O booking é da empresa: é ela quem responde por ele. */
const isOwnLot = (
  lot: Pick<BookingLot, "supplierId" | "partnerId">,
  partyId: string,
) => bookingRecipientId(lot) === partyId;

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

/* ------------------------------------------------------------------------ */
/* Lançar                                                                    */
/* ------------------------------------------------------------------------ */

/**
 * A empresa de quem lança: login externo com a tela Booking, de um cadastro
 * ativo de um tipo que pode responder por booking (fornecedor, Trading,
 * Factory, Supplier, GP ou tipo criado no painel). Nulo: a tela é só de
 * consulta (ex.: cliente ou agência a quem ela foi liberada).
 */
async function launcherParty(user: User): Promise<Party | null> {
  if (isWellmix(user) || !user.partyId || !canOpen(user, "booking"))
    return null;
  const party = await getStore().get("parties", user.partyId);
  return party?.active && isBookingPartner(party) ? party : null;
}

/** O login pode lançar booking (mostra o botão e abre o formulário)? */
export async function canLaunchBooking(user: User): Promise<boolean> {
  return (await launcherParty(user)) !== null;
}

/** Quem da Wellmix abre a tela Booking (sem ninguém, os administradores). */
async function bookingTeamIds(): Promise<string[]> {
  const team = await getStore().list("users", {
    filter: { role: ["admin", "operator"], active: true },
  });
  const { loadFunctionDefs } = await import("./team-functions");
  const defs = await loadFunctionDefs();
  const holders = team.filter((u) =>
    screensFor(u, accessFromFunctions(u.functions, defs)).has("booking"),
  );
  return (holders.length ? holders : team.filter(isAdmin)).map((u) => u.id);
}

/**
 * O parceiro lança o booking dele: sobe a planilha e nasce um booking em
 * rascunho com a empresa dele como responsável, sem dono interno. A equipe da
 * Wellmix que abre o Booking é avisada e segue dali (confere, preenche o NCM,
 * fecha e analisa), como em qualquer outro booking.
 */
export async function launchPartnerBooking(
  user: User,
  // Só arquivo: enviado no formulário ou já subido direto ao armazenamento.
  source: Extract<SheetSource, File | { fileKey: string }>,
  options: { defaultCurrency?: SheetCurrency | null } = {},
): Promise<PartnerBookingLot> {
  assertPartnerBooking(user);
  const party = await launcherParty(user);
  if (!party) throw new ForbiddenError();
  const store = getStore();
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const recent = (
    await store.list("booking_lots", { filter: { partnerId: party.id } })
  ).filter((lot) => Date.parse(lot.createdAt) >= dayAgo);
  if (recent.length >= PARTNER_DAILY_LAUNCHES)
    throw new PartnerBookingError("booking_launch_limit");
  const { createLotFromSheet } = await import("./booking-lots");
  const lot = await createLotFromSheet(user, source, {
    defaultCurrency: options.defaultCurrency ?? null,
    partnerId: party.id,
    ownerUserId: null,
  });
  const { notify } = await import("./notifications");
  await notify(
    { userIds: await bookingTeamIds() },
    {
      kind: "action",
      link: `/app/booking/lots/${lot.id}`,
      text: (t) => ({
        subject: t("bookingLots.notify.launched.subject", { n: lot.number }),
        body: t("bookingLots.notify.launched.body", {
          partner: party.name,
          items: lot.itemCount,
          file: lot.fileName,
        }),
      }),
    },
  ).catch((error) => console.error("notify(booking_lot.launch)", error));
  return lotView(lot);
}
