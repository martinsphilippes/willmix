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
import {
  BOOKING_ITEM_FIELDS,
  bookingLotPreparing,
  bookingRecipientId,
  isBookingPartner,
  bookingItemPatch,
  type BookingItemField,
} from "@/lib/booking-lots";
import { listByIds } from "@/lib/db/lookup";
import { audit } from "./audit";
import type { BookingBulkResult } from "./booking-lots";
import type { SheetSource } from "./product-sheet-import";

/*
 * Booking para o login externo (dono, 11/11/2026): o Trading, o Factory, o
 * Supplier e o GP (e outro tipo com login a quem a tela for liberada na
 * Gestão de telas) abrem a tela Booking, LANÇAM os bookings da empresa deles
 * e veem SÓ os bookings dela.
 *
 * Lançar tem dois passos (dono, 12/11/2026):
 *   1. Sobe a planilha: nasce o booking "em preenchimento" (`preparing`), com
 *      todos os campos da planilha abertos e já preenchidos. Ele confere e
 *      corrige na tela (cada campo grava ao sair dele). A Wellmix ainda não
 *      vê o booking.
 *   2. "Enviar para Wellmix Conferir": o booking ganha o número, vira
 *      rascunho, a Wellmix é avisada e ele passa a só consultar.
 *
 * "Dela" = aqueles pelos quais a empresa responde: é o responsável do booking
 * ou, sem responsável, o fornecedor (a mesma regra de para quem vão as
 * solicitações, `bookingRecipientId`). O booking que uma trading lança com o
 * preço dela não aparece para a fábrica citada na planilha.
 *
 * Fica de fora, de propósito: bookings de outras empresas, a análise da
 * Wellmix (custo no Sankhya, sinal, margem), o NCM, o produto do cadastro, as
 * colunas extras da planilha e as notas internas. Depois de enviado, o
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
> & {
  /** Loja/Fábrica e Tipo de item informados na importação (dono, 23/11/2026). */
  storeNumber: string | null;
  supplierName: string | null;
  /** FOB ou EXW escolhido na importação e o valor do EXW. */
  incoterm: BookingLot["incoterm"];
  exwValue: number | null;
  itemType: string | null;
  /**
   * Itens trabalhados pela Wellmix na Seleção de itens (dono, 23/11/2026):
   * quantos e o percentual. Só nas leituras que carregam os itens.
   */
  worked?: { worked: number; total: number; pct: number };
};

const lotView = (lot: BookingLot): PartnerBookingLot => ({
  id: lot.id,
  number: lot.number,
  status: lot.status,
  origin: lot.origin ?? null,
  bookingDate: lot.bookingDate ?? null,
  fileName: lot.fileName,
  itemCount: lot.itemCount,
  createdAt: lot.createdAt,
  storeNumber: lot.storeNumber ?? null,
  supplierName: lot.supplierName ?? null,
  incoterm: lot.incoterm ?? null,
  exwValue: lot.exwValue ?? null,
  itemType: lot.itemType ?? null,
});

/**
 * Só o que veio da planilha dele (os campos que a tela edita, na ordem da
 * planilha): nada da análise, do NCM nem do cadastro da Wellmix.
 */
export type PartnerBookingItem = Pick<
  BookingItem,
  // `sizeText`: o tamanho que veio na coluna da capacidade ("8X10", "A4").
  "id" | "position" | "sizeText" | BookingItemField
> & {
  /**
   * Foto do item e cartão do fabricante que vieram na planilha: o parceiro
   * vê as fotos dos itens dos books da empresa dele, também dos que a
   * Wellmix carregou por ele (dono, 16/11/2026; o arquivo abre pela regra
   * `partnerSeesBookingPhoto`). Nulo: sem foto.
   */
  photoDocumentId?: string | null;
  cardDocumentId?: string | null;
  /**
   * Capacidade (ml) da tabela de consulta. Item com tamanho em texto ("A4")
   * e mililitros ao mesmo tempo (porta-retrato com "0,5 ml": provável erro
   * da planilha) vale o que o cadastro do produto diz (ficha mestre); sem
   * produto ou com o campo em branco lá, nulo ("—"). Os demais, os
   * mililitros do book (dono, 16/11/2026).
   */
  capacityMlShown?: number | null;
  /** Trabalhado pela Wellmix na Seleção de itens (só o fato, sem a análise). */
  worked?: boolean;
};

const itemView = (i: BookingItem): PartnerBookingItem => {
  const view = {
    id: i.id,
    position: i.position,
    sizeText: i.sizeText ?? null,
  } as PartnerBookingItem;
  for (const field of BOOKING_ITEM_FIELDS)
    (view as Record<string, unknown>)[field] = i[field];
  return view;
};

/**
 * Os bookings da empresa de quem abre: primeiro os que ele ainda preenche
 * (falta enviar), depois os enviados, do mais novo para o mais antigo.
 */
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
  const preparing = (lot: BookingLot) => bookingLotPreparing(lot.status);
  // Percentual trabalhado de cada book (só a coluna da marca é lida).
  const share = new Map<string, { worked: number; total: number }>();
  if (own.size) {
    const { listColumns } = await import("@/lib/db/lookup");
    try {
      const marks = await listColumns(
        store,
        "booking_items",
        ["lotId", "workedAt"],
        { filter: { lotId: [...own.keys()] } },
      );
      for (const m of marks) {
        const s = share.get(m.lotId) ?? { worked: 0, total: 0 };
        s.total++;
        if (m.workedAt) s.worked++;
        share.set(m.lotId, s);
      }
    } catch (error) {
      const { isSchemaMissing } = await import("@/lib/db/errors");
      if (!isSchemaMissing(error)) throw error;
    }
  }
  const withShare = (lot: BookingLot): PartnerBookingLot => {
    const s = share.get(lot.id) ?? { worked: 0, total: 0 };
    return {
      ...lotView(lot),
      worked: {
        ...s,
        pct: s.total ? Math.round((s.worked / s.total) * 100) : 0,
      },
    };
  };
  return [...own.values()]
    .sort((a, b) =>
      preparing(a) !== preparing(b)
        ? Number(preparing(b)) - Number(preparing(a))
        : preparing(a)
          ? b.createdAt.localeCompare(a.createdAt)
          : b.number - a.number,
    )
    .map(withShare);
}

/**
 * Foto do item e cartão do fabricante de um book da empresa de quem abre
 * (dono, 16/11/2026: o parceiro vê as fotos dos itens dos books dele, também
 * dos que a Wellmix carregou por ele). Só o login externo com a tela Booking
 * e só os books pelos quais a empresa dele responde (`isOwnLot`, a regra da
 * tela). Usado por `canAccessDocument` (src/lib/services/documents.ts).
 */
export async function partnerSeesBookingPhoto(
  user: User,
  documentId: string,
): Promise<boolean> {
  if (isWellmix(user) || !user.partyId || !canOpen(user, "booking"))
    return false;
  const store = getStore();
  try {
    const [byPhoto, byCard] = await Promise.all([
      store.list("booking_items", {
        filter: { photoDocumentId: documentId },
        limit: 20,
      }),
      store.list("booking_items", {
        filter: { cardDocumentId: documentId },
        limit: 20,
      }),
    ]);
    const lotIds = [...byPhoto, ...byCard].map((i) => i.lotId);
    if (!lotIds.length) return false;
    const lots = await listByIds(store, "booking_lots", lotIds);
    return lots.some((lot) => isOwnLot(lot, user.partyId as string));
  } catch {
    return false;
  }
}

/** Um booking da empresa de quem abre, com os itens; nulo se não é dela. */
export async function getPartnerBookingLot(
  user: User,
  lotId: string,
): Promise<{
  lot: PartnerBookingLot;
  items: PartnerBookingItem[];
  /** Nome do Fornecedor (responsável pelo book) e da Fábrica, do cadastro. */
  partnerName: string | null;
  factoryName: string | null;
} | null> {
  const partyId = assertPartnerBooking(user);
  const store = getStore();
  const lot = await store.get("booking_lots", lotId);
  if (!lot || !isOwnLot(lot, partyId)) return null;
  const items = await store.list("booking_items", { filter: { lotId } });
  // Cabeçalho (dono, 14/11/2026): o Fornecedor e a Fábrica do registro, pelo
  // cadastro (nunca pelo nome do arquivo), como na tela da Wellmix.
  const partyIds = [lot.partnerId, lot.supplierId].filter(
    (id): id is string => !!id,
  );
  const parties = partyIds.length
    ? await store.list("parties", { filter: { id: partyIds } })
    : [];
  const nameOf = (id: string | null | undefined) =>
    (id && parties.find((p) => p.id === id)?.name) || null;
  /* Capacidade suspeita (tamanho em texto e mililitros juntos): vale o
     cadastro do produto ligado ao item (ficha mestre, `purchase_sheets` com
     orderId = id do produto); em branco, "—". */
  const suspicious = (i: BookingItem) =>
    typeof i.capacityMl === "number" && !!i.sizeText?.trim();
  const productIds = [
    ...new Set(
      items
        .filter(suspicious)
        .map((i) => i.productId)
        .filter((id): id is string => !!id),
    ),
  ];
  const masters = productIds.length
    ? await store.list("purchase_sheets", { filter: { orderId: productIds } })
    : [];
  const registryMl = new Map(masters.map((m) => [m.orderId, m.capacityMl]));
  const capacityShown = (i: BookingItem) => {
    if (!suspicious(i)) return i.capacityMl ?? null;
    const ml = i.productId ? registryMl.get(i.productId) : null;
    return typeof ml === "number" && ml > 0 ? ml : null;
  };
  const { workedShare } = await import("@/lib/booking-locks");
  return {
    lot: { ...lotView(lot), worked: workedShare(items) },
    items: items
      .sort((a, b) => a.position - b.position)
      .map((i) => ({
        ...itemView(i),
        worked: !!i.workedAt,
        // O parceiro vê as fotos dos itens dos books dele (dono, 16/11/2026).
        photoDocumentId: i.photoDocumentId ?? null,
        cardDocumentId: i.cardDocumentId ?? null,
        capacityMlShown: capacityShown(i),
      })),
    partnerName: nameOf(lot.partnerId),
    factoryName: nameOf(lot.supplierId),
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
 * Primeiro passo do lançamento: o parceiro sobe a planilha e nasce o booking
 * "em preenchimento", com a empresa dele como responsável, sem dono interno
 * e sem número. A Wellmix ainda não o vê nem é avisada: isso é no envio
 * (`sendPartnerBooking`).
 */
export async function launchPartnerBooking(
  user: User,
  // Só arquivo: enviado no formulário ou já subido direto ao armazenamento.
  // Uma planilha ou várias (o book é a soma delas; dono, 23/11/2026).
  source:
    | Extract<SheetSource, File | { fileKey: string }>
    | Array<Extract<SheetSource, File | { fileKey: string }>>,
  options: {
    defaultCurrency?: SheetCurrency | null;
    storeNumber?: string | null;
    supplierName?: string | null;
    incoterm?: BookingLot["incoterm"];
    exwValue?: number | null;
    itemType?: string | null;
  } = {},
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
    storeNumber: options.storeNumber ?? null,
    supplierName: options.supplierName ?? null,
    incoterm: options.incoterm ?? null,
    exwValue: options.exwValue ?? null,
    itemType: options.itemType ?? null,
    partnerId: party.id,
    ownerUserId: null,
    preparing: true,
  });
  return lotView(lot);
}

/* ------------------------------------------------------------------------ */
/* Conferir, enviar e descartar (só em preenchimento)                         */
/* ------------------------------------------------------------------------ */

/** O booking é dele e ainda está em preenchimento (não foi enviado). */
async function ownPreparingLot(user: User, lotId: string): Promise<BookingLot> {
  const partyId = assertPartnerBooking(user);
  const lot = await getStore().get("booking_lots", lotId);
  // De outra empresa ou inexistente: a mesma resposta.
  if (!lot || !isOwnLot(lot, partyId))
    throw new PartnerBookingError("not_found");
  if (!bookingLotPreparing(lot.status))
    throw new PartnerBookingError("booking_partner_sent");
  return lot;
}

/**
 * Um campo de um item, enquanto ele confere a planilha. As mesmas regras da
 * tela da Wellmix (`readBookingItemValue`): vazio apaga; número ilegível,
 * zero ou negativo, incoterm ou moeda fora da lista recusam.
 */
export async function setPartnerBookingItemField(
  user: User,
  itemId: string,
  field: BookingItemField,
  raw: string,
): Promise<void> {
  assertPartnerBooking(user);
  const store = getStore();
  const item = await store.get("booking_items", itemId);
  if (!item) throw new PartnerBookingError("not_found");
  await ownPreparingLot(user, item.lotId);
  // A mesma regra da tela da Wellmix e do preenchimento em massa.
  const patch = bookingItemPatch(item, field, raw);
  if (!patch) return;
  await store.update("booking_items", item.id, {
    ...patch,
    updatedByUserId: user.id,
  });
}

/**
 * Preenchimento em massa do parceiro (dono, 16/11/2026): os valores
 * digitados acima das colunas vão para os itens marcados, com as regras da
 * célula (só o booking dele e só antes de enviar).
 */
export async function setPartnerBookingItemsFields(
  user: User,
  lotId: string,
  itemIds: readonly string[],
  values: ReadonlyArray<readonly [BookingItemField, string]>,
): Promise<BookingBulkResult> {
  await ownPreparingLot(user, lotId);
  const { applyBookingItemsBulk } = await import("./booking-lots");
  const { updated, failed } = await applyBookingItemsBulk(
    user,
    lotId,
    itemIds,
    values,
  );
  return { updated, failed };
}

/**
 * "Enviar para Wellmix Conferir": o booking ganha o número, vira rascunho,
 * passa pela aproximação de NCM e quem da Wellmix abre o Booking é avisado.
 * Dali em diante ele só consulta.
 */
export async function sendPartnerBooking(
  user: User,
  lotId: string,
): Promise<PartnerBookingLot> {
  const lot = await ownPreparingLot(user, lotId);
  const party = await launcherParty(user);
  if (!party) throw new ForbiddenError();
  const { releasePreparingLot } = await import("./booking-lots");
  const sent = await releasePreparingLot(user, lot.id);
  const { notify } = await import("./notifications");
  await notify(
    { userIds: await bookingTeamIds() },
    {
      kind: "action",
      link: `/app/booking/lots/${sent.id}`,
      text: (t) => ({
        subject: t("bookingLots.notify.launched.subject", { n: sent.number }),
        body: t("bookingLots.notify.launched.body", {
          partner: party.name,
          items: sent.itemCount,
          file: sent.fileName,
        }),
      }),
    },
  ).catch((error) => console.error("notify(booking_lot.partner_send)", error));
  return lotView(sent);
}

/**
 * Descartar o booking que ele ainda preenchia (planilha errada, por exemplo):
 * some o booking, os itens e os arquivos que este lançamento criou. Nada
 * disso chegou à Wellmix. Depois de enviado não há descarte: é com a Wellmix.
 */
export async function discardPartnerBooking(
  user: User,
  lotId: string,
): Promise<void> {
  const lot = await ownPreparingLot(user, lotId);
  const store = getStore();
  const items = await store.list("booking_items", {
    filter: { lotId: lot.id },
  });
  for (const item of items) await store.remove("booking_items", item.id);
  await store.remove("booking_lots", lot.id);
  // A planilha, as fotos e os cartões: só os que este login subiu.
  const { fileKeyTaken } = await import("./documents");
  const documentIds = [
    lot.fileDocumentId,
    ...items.flatMap((i) => [i.photoDocumentId, i.cardDocumentId]),
  ].filter((id): id is string => !!id);
  for (const id of new Set(documentIds)) {
    try {
      const doc = await store.get("documents", id);
      if (!doc || doc.uploadedByUserId !== user.id) continue;
      await store.remove("documents", doc.id);
      if (!(await fileKeyTaken(doc.storageKey)))
        await store.removeFile(doc.storageKey);
    } catch (error) {
      console.error("discardPartnerBooking: arquivo não apagado", error);
    }
  }
  await audit(
    user,
    "booking_lot.partner_discard",
    "booking_lot",
    lot.id,
    `Book em preenchimento descartado pelo parceiro: ${lot.itemCount} itens (${lot.fileName})`,
  );
}
