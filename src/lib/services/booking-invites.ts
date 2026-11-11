import "server-only";

import { randomUUID } from "node:crypto";
import {
  getStore,
  type BookingInvite,
  type BookingItem,
  type BookingLot,
  type Party,
  type SheetCurrency,
  type User,
} from "@/lib/db";
import {
  ForbiddenError,
  assertWellmix,
  isWellmix,
} from "@/lib/auth/permissions";
import { assertScreen } from "@/lib/auth/screens";
import { getSettings } from "@/lib/settings";
import { sheetQuantity } from "@/lib/supplier-requests";
import { audit } from "./audit";
import type { SheetSource } from "./product-sheet-import";

/*
 * Convite para booking concorrente (decisão do dono, 11/11/2026;
 * docs/BOOKING_INVITES.md). Ao avaliar um item de booking na Seleção de
 * itens, a Wellmix convida fornecedores e tradings a subir um booking
 * concorrente. Cada convidado recebe o aviso e a pendência, com o prazo do
 * SLA (Configurações, padrão 1 dia), e responde subindo a planilha: o booking
 * nasce em rascunho com ele como responsável e entra na seleção quando a
 * Wellmix fechar, como qualquer outro.
 */

export class BookingInviteError extends Error {}

/** Quem pode ser convidado: fornecedores e tradings (ativos). */
export const INVITE_PARTNER_TYPES = ["supplier", "trading"] as const;

/** Até quantos parceiros por convite. */
export const INVITE_MAX_PARTNERS = 30;

const COUNTER = "booking_invite_number";

async function withSchema<T>(fn: () => Promise<T>): Promise<T> {
  const { isSchemaMissing } = await import("@/lib/db/errors");
  try {
    return await fn();
  } catch (error) {
    if (isSchemaMissing(error)) throw new BookingInviteError("schema_outdated");
    throw error;
  }
}

function assertBookingScreen(user: User) {
  assertWellmix(user);
  assertScreen(user, "booking");
}

/** O convidado (login do parceiro) ou a Wellmix. */
export function canSeeInvite(
  user: Pick<User, "role" | "partyId">,
  invite: Pick<BookingInvite, "partnerId">,
): boolean {
  if (isWellmix(user as User)) return true;
  return (
    user.role === "supplier" &&
    !!user.partyId &&
    user.partyId === invite.partnerId
  );
}

/** Prazo do convite: agora + o SLA em dias corridos. */
export function inviteDueAt(now: Date, days: number): string {
  return new Date(now.getTime() + days * 86_400_000).toISOString();
}

/** Atrasado: aberto e com o prazo vencido. */
export function inviteLate(
  invite: Pick<BookingInvite, "status" | "dueAt">,
  now = new Date(),
): boolean {
  return invite.status === "open" && Date.parse(invite.dueAt) < now.getTime();
}

export interface InviteScreen {
  item: BookingItem;
  lot: BookingLot;
  supplier: Party | null;
  /** Quem pode ser convidado, com o tipo. */
  partners: Party[];
  invites: BookingInvite[];
  slaDays: number;
}

/** Tela de convite de um item (Wellmix com a tela Booking). */
export async function inviteScreen(
  user: User,
  itemId: string,
): Promise<InviteScreen | null> {
  assertBookingScreen(user);
  const store = getStore();
  const item = await store.get("booking_items", itemId);
  if (!item) return null;
  const lot = await store.get("booking_lots", item.lotId);
  if (!lot) return null;
  const [partners, invites, settings] = await Promise.all([
    store.list("parties", {
      filter: { type: [...INVITE_PARTNER_TYPES], active: true },
      orderBy: "name",
    }),
    withSchema(() =>
      store.list("booking_invites", {
        filter: { bookingItemId: item.id },
        orderBy: "createdAt",
        direction: "desc",
      }),
    ),
    getSettings(),
  ]);
  return {
    item,
    lot,
    supplier: lot.supplierId
      ? (partners.find((p) => p.id === lot.supplierId) ??
        (await store.get("parties", lot.supplierId)))
      : null,
    partners,
    invites,
    slaDays: settings.bookingInviteSlaDays,
  };
}

export interface InviteInput {
  itemId: string;
  partnerIds: string[];
  message: string | null;
}

/**
 * Convida os parceiros a subir um booking concorrente do item. Quem já tem
 * convite aberto para o item não recebe outro. Devolve os convites criados.
 */
export async function inviteForItem(
  user: User,
  input: InviteInput,
): Promise<BookingInvite[]> {
  assertBookingScreen(user);
  const ids = [...new Set(input.partnerIds)];
  if (!ids.length) throw new BookingInviteError("booking_invite_choose");
  if (ids.length > INVITE_MAX_PARTNERS)
    throw new BookingInviteError("booking_invite_too_many");
  const store = getStore();
  const item = await store.get("booking_items", input.itemId);
  if (!item) throw new BookingInviteError("not_found");
  const lot = await store.get("booking_lots", item.lotId);
  if (!lot || lot.status === "cancelled")
    throw new BookingInviteError("not_found");
  const parties = await store.list("parties", { filter: { id: ids } });
  if (
    parties.length !== ids.length ||
    parties.some(
      (p) =>
        !p.active ||
        !(INVITE_PARTNER_TYPES as readonly string[]).includes(p.type),
    )
  )
    throw new BookingInviteError("booking_invite_partner_invalid");
  const open = await withSchema(() =>
    store.list("booking_invites", {
      filter: { bookingItemId: item.id, status: "open" },
    }),
  );
  const fresh = parties.filter((p) => !open.some((i) => i.partnerId === p.id));
  if (!fresh.length) throw new BookingInviteError("booking_invite_exists");
  const { bookingInviteSlaDays } = await getSettings();
  const now = new Date();
  const dueAt = inviteDueAt(now, bookingInviteSlaDays);
  const groupId = randomUUID();
  const copy: BookingInvite["item"] = {
    description: item.description,
    productName: item.productName,
    factoryItemCode: item.factoryItemCode,
    material: item.material,
    capacityMl: item.capacityMl,
    lengthCm: item.lengthCm,
    widthCm: item.widthCm,
    heightCm: item.heightCm,
    packageType: item.packageType,
    colorAssortment: item.colorAssortment,
    photoDocumentId: item.photoDocumentId,
    quantity: sheetQuantity(item),
  };
  const message = input.message?.trim().slice(0, 4000) || null;
  const created: BookingInvite[] = [];
  for (const partner of fresh) {
    const invite = await withSchema(async () =>
      store.create("booking_invites", {
        number: await store.nextNumber(COUNTER),
        groupId,
        status: "open",
        bookingItemId: item.id,
        bookingLotId: lot.id,
        item: copy,
        partnerId: partner.id,
        message,
        dueAt,
        answeredAt: null,
        answeredByUserId: null,
        answeredLotId: null,
        cancelledAt: null,
        createdByUserId: user.id,
      }),
    );
    created.push(invite);
  }
  await audit(
    user,
    "booking_invite.create",
    "booking_lot",
    lot.id,
    `Convite para booking concorrente do item ${item.factoryItemCode ?? item.description ?? item.id} (booking nº ${lot.number}): ${fresh.map((p) => p.name).join(", ")}`,
  );
  const { notify } = await import("./notifications");
  const label = (item.description ?? item.productName ?? "").slice(0, 80);
  for (const invite of created)
    await notify(
      { role: "supplier", partyId: invite.partnerId },
      {
        kind: "action",
        link: `/app/supplier-requests/invites/${invite.id}`,
        text: (t) => ({
          subject: t("bookingInvites.notify.subject", { n: invite.number }),
          body: t("bookingInvites.notify.body", {
            item: label,
            days: bookingInviteSlaDays,
          }),
        }),
      },
    ).catch((error) => console.error("notify(booking_invite)", error));
  return created;
}

/** Cancela um convite ainda aberto (Wellmix). */
export async function cancelInvite(user: User, inviteId: string) {
  assertBookingScreen(user);
  const store = getStore();
  const invite = await withSchema(() => store.get("booking_invites", inviteId));
  if (!invite) throw new BookingInviteError("not_found");
  if (invite.status !== "open")
    throw new BookingInviteError("booking_invite_closed");
  const updated = await store.update("booking_invites", invite.id, {
    status: "cancelled",
    cancelledAt: new Date().toISOString(),
  });
  await audit(
    user,
    "booking_invite.cancel",
    "booking_lot",
    invite.bookingLotId,
    `Convite nº ${invite.number} cancelado`,
  );
  return updated;
}

/** Convites do parceiro (os dele; a Wellmix vê todos). Nulo: tabela não publicada. */
export async function listInvitesFor(
  user: User,
): Promise<BookingInvite[] | null> {
  const store = getStore();
  try {
    if (isWellmix(user))
      return await store.list("booking_invites", {
        orderBy: "createdAt",
        direction: "desc",
      });
    if (user.role !== "supplier" || !user.partyId) return [];
    return await store.list("booking_invites", {
      filter: { partnerId: user.partyId },
      orderBy: "createdAt",
      direction: "desc",
    });
  } catch (error) {
    const { isSchemaMissing } = await import("@/lib/db/errors");
    if (isSchemaMissing(error)) return null;
    throw error;
  }
}

/** Um convite para quem pode vê-lo; nulo para os demais. */
export async function getInvite(
  user: User,
  inviteId: string,
): Promise<BookingInvite | null> {
  const invite = await withSchema(() =>
    getStore().get("booking_invites", inviteId),
  );
  return invite && canSeeInvite(user, invite) ? invite : null;
}

/**
 * O convidado (ou a Wellmix por ele) responde subindo a planilha do booking:
 * nasce o booking em rascunho com ele como responsável e a Wellmix que
 * convidou como dona; o convite fica respondido e ela é avisada.
 */
export async function answerInviteWithSheet(
  user: User,
  inviteId: string,
  source: SheetSource,
  options: { defaultCurrency?: SheetCurrency | null } = {},
): Promise<BookingLot> {
  const store = getStore();
  const invite = await withSchema(() => store.get("booking_invites", inviteId));
  if (!invite || !canSeeInvite(user, invite))
    throw new BookingInviteError("not_found");
  if (isWellmix(user)) assertBookingScreen(user);
  else assertScreen(user, "quotes");
  if (invite.status !== "open")
    throw new BookingInviteError("booking_invite_closed");
  const { createLotFromSheet } = await import("./booking-lots");
  const lot = await createLotFromSheet(user, source, {
    defaultCurrency: options.defaultCurrency ?? null,
    partnerId: invite.partnerId,
    ownerUserId: invite.createdByUserId,
  });
  await store.update("booking_invites", invite.id, {
    status: "answered",
    answeredAt: new Date().toISOString(),
    answeredByUserId: user.id,
    answeredLotId: lot.id,
  });
  const partner = await store.get("parties", invite.partnerId);
  await audit(
    user,
    "booking_invite.answer",
    "booking_lot",
    lot.id,
    `Convite nº ${invite.number}: ${partner?.name ?? invite.partnerId} subiu o booking nº ${lot.number}`,
  );
  const { notify } = await import("./notifications");
  await notify(
    { userIds: [invite.createdByUserId] },
    {
      kind: "action",
      link: `/app/booking/lots/${lot.id}`,
      text: (t) => ({
        subject: t("bookingInvites.notify.answered.subject", {
          n: invite.number,
        }),
        body: t("bookingInvites.notify.answered.body", {
          partner: partner?.name ?? "",
          lot: lot.number,
        }),
      }),
    },
  ).catch((error) => console.error("notify(booking_invite.answer)", error));
  return lot;
}

/** O convidado vê a foto do item do convite (o documento é interno). */
export async function partnerSeesInvitePhoto(
  user: User,
  documentId: string,
): Promise<boolean> {
  if (user.role !== "supplier" || !user.partyId) return false;
  try {
    const rows = await getStore().list("booking_invites", {
      filter: { partnerId: user.partyId },
    });
    return rows.some((r) => r.item?.photoDocumentId === documentId);
  } catch {
    return false;
  }
}

/** Pendências do convidado: os convites abertos, com o prazo. */
export async function openInvitesFor(user: User): Promise<BookingInvite[]> {
  if (user.role !== "supplier" || !user.partyId) return [];
  try {
    return await getStore().list("booking_invites", {
      filter: { partnerId: user.partyId, status: "open" },
    });
  } catch {
    return [];
  }
}

/** Só para conferir quem chama (ações). */
export function assertInviteManager(user: User) {
  if (!isWellmix(user)) throw new ForbiddenError();
  assertBookingScreen(user);
}
