import "server-only";

import { assertWellmix, isWellmix } from "@/lib/auth/permissions";
import { assertScreen } from "@/lib/auth/screens";
import {
  BOOKING_PARTNER_TYPES,
  bookingDateOf,
  bookingLotEditable,
  bookingLotPreparing,
  bookingLotPending,
  bookingLotReady,
  bookingRecipientId,
  canMoveBookingLot,
  isBookingPartner,
  matchSheetSupplier,
  mostCommon,
  readBookingCapacity,
  readBookingItemValue,
  supplierKey,
  type BookingItemField,
} from "@/lib/booking-lots";
import {
  getStore,
  PARTY_EXTRA_DEFAULTS,
  type BookingItem,
  type BookingLot,
  type BookingLotStatus,
  type BookingLotSupplierHint,
  type Party,
  type SheetCurrency,
  type User,
} from "@/lib/db";
import { audit } from "./audit";
import {
  fileKeyTaken,
  registerUploadedDocument,
  uploadDocument,
} from "./documents";
import {
  parseProductSheet,
  sheetBytes,
  SheetImportError,
  type ProductGroup,
  type SheetSource,
} from "./product-sheet-import";
import type { SheetImage } from "./xlsx";

/*
 * Booking por planilha (docs/BOOKING.md, "Booking por planilha"). O usuário
 * sobe a planilha de um fornecedor: nasce um booking em rascunho com os
 * itens (as linhas), o fornecedor e a data estimados da planilha. Ele ajusta
 * tudo e fecha; ao fechar, o Superplan analisa todos os itens. Nenhum
 * produto do cadastro nasce aqui: o item é ligado a um produto depois, na
 * seleção de itens.
 *
 * Só a Wellmix com a tela Booking (conferido em cada função).
 */

export class BookingLotError extends Error {}

const LOT_COUNTER = "booking_lot_number";

function assertBooking(user: User) {
  assertWellmix(user);
  assertScreen(user, "booking");
}

const clip = (s: string | null | undefined, max: number) => {
  const v = (s ?? "").replace(/\s+/g, " ").trim();
  return v ? v.slice(0, max) : null;
};
const asText = (v: unknown, max: number) =>
  typeof v === "string" || typeof v === "number" ? clip(String(v), max) : null;
const asNumber = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
const asInt = (v: unknown): number | null => {
  const n = asNumber(v);
  return n === null ? null : Math.round(n);
};

/** Tabela nova sem publicar: avisa "esquema desatualizado" em vez de falha técnica. */
async function withSchema<T>(fn: () => Promise<T>): Promise<T> {
  const { isSchemaMissing } = await import("@/lib/db/errors");
  try {
    return await fn();
  } catch (error) {
    if (isSchemaMissing(error)) throw new BookingLotError("schema_outdated");
    throw error;
  }
}

/* ------------------------------------------------------------------------ */
/* Subir a planilha                                                          */
/* ------------------------------------------------------------------------ */

/** Grupo da planilha → campos do item. */
export function itemFromGroup(
  group: ProductGroup,
): Omit<
  BookingItem,
  | "id"
  | "createdAt"
  | "updatedAt"
  | "lotId"
  | "photoDocumentId"
  | "cardDocumentId"
  | "analysis"
  | "productId"
  | "updatedByUserId"
> {
  const r = group.reading;
  const incoterm =
    r.incoterm === "FOB" || r.incoterm === "EXW" ? r.incoterm : null;
  const currency = (["USD", "RMB", "BRL", "EUR"] as const).find(
    (c) => c === r.currency,
  );
  return {
    position: group.index,
    sourceRows:
      group.firstRow === group.lastRow
        ? String(group.firstRow)
        : `${group.firstRow}-${group.lastRow}`,
    itemNumber: clip(group.itemNumber, 40),
    factoryItemCode: asText(r.factoryItemCode, 60),
    productName: clip(group.name, 160),
    description: clip(group.description, 2000),
    incoterm,
    currency: currency ?? null,
    price: asNumber(r.price),
    masterCartonQty: asInt(r.masterCartonQty),
    innerQty: asInt(r.innerQty),
    netWeightPcKg: asNumber(r.netWeightPcKg),
    grossWeightPcKg: asNumber(r.grossWeightPcKg),
    cbmPerCarton: asNumber(r.cbmPerCarton),
    lengthCm: group.lengthCm,
    widthCm: group.widthCm,
    heightCm: group.heightCm,
    capacityMl: asNumber(r.capacityMl),
    packageType: asText(r.packageType, 120),
    material: asText(r.material, 200),
    moq: asInt(r.moq),
    colorAssortment: asText(r.colorAssortment, 200),
    powerDetail: asText(r.powerDetail, 60),
    purchaseSchedule: clip(group.schedule, 80),
    departureIntervalDays: clip(group.interval, 40),
    purchaseQty: group.purchaseQty ?? null,
    plannedQty: group.plannedQty,
    sizeText: clip(group.sizeText, 60),
    extras:
      group.extras && Object.keys(group.extras).length ? group.extras : null,
  };
}

/** O fornecedor como a planilha escreveu (o mais frequente das linhas). */
export function supplierHintOf(groups: ProductGroup[]): BookingLotSupplierHint {
  const pick = (
    f: "supplierName" | "supplierStore" | "supplierPhone" | "location",
    max: number,
  ) => clip(mostCommon(groups.map((g) => asText(g.reading[f], 200))), max);
  return {
    name: pick("supplierName", 160),
    store: pick("supplierStore", 60),
    phone: pick("supplierPhone", 40),
    city: pick("location", 80),
  };
}

async function storeImage(user: User, image: SheetImage | null) {
  if (!image) return null;
  try {
    const doc = await uploadDocument(
      user,
      new File([new Uint8Array(image.bytes)], image.name, { type: image.mime }),
      { type: "photo", visibility: "internal" },
    );
    return doc.id;
  } catch {
    // Foto ilegível ou grande demais: o item entra sem ela.
    return null;
  }
}

async function keepSheetFile(
  user: User,
  source: SheetSource,
  file: { bytes: Uint8Array; name: string },
) {
  try {
    if (source instanceof File)
      return (
        await uploadDocument(user, source, {
          type: "attachment",
          visibility: "internal",
        })
      ).id;
    if ("documentId" in source) return source.documentId;
    if ("fileKey" in source)
      return (
        await registerUploadedDocument(user, source.fileKey, {
          type: "attachment",
          visibility: "internal",
        })
      ).id;
    return (
      await uploadDocument(
        user,
        new File([new Uint8Array(file.bytes)], file.name, {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        { type: "attachment", visibility: "internal" },
      )
    ).id;
  } catch {
    return null;
  }
}

/**
 * Sobe a planilha: lê as colunas conhecidas (as outras ficam guardadas como
 * informação nos itens), estima fornecedor, origem e data e cria o booking em
 * rascunho com os itens e as fotos. Devolve o booking.
 */
export async function createBookingLotFromSheet(
  user: User,
  source: SheetSource,
  options: {
    defaultCurrency?: SheetCurrency | null;
    sheet?: string | null;
  } = {},
): Promise<BookingLot> {
  assertBooking(user);
  return createLotFromSheet(user, source, options);
}

/**
 * O mesmo, sem conferir o papel (quem chama confere): o booking concorrente
 * que o parceiro convidado sobe (services/booking-invites.ts) nasce com ele
 * como responsável e com a Wellmix que convidou como dona; o booking que o
 * parceiro lança por conta própria (services/booking-partner.ts) nasce com
 * ele como responsável, sem dono interno (`ownerUserId: null`) e "em
 * preenchimento" (`preparing`): sem número e sem a aproximação de NCM, que
 * só vêm quando ele envia (`releasePreparingLot`).
 */
export async function createLotFromSheet(
  user: User,
  source: SheetSource,
  options: {
    defaultCurrency?: SheetCurrency | null;
    sheet?: string | null;
    partnerId?: string | null;
    ownerUserId?: string | null;
    /** Lançado pelo parceiro: fica em preenchimento até ele enviar. */
    preparing?: boolean;
  } = {},
): Promise<BookingLot> {
  // Login externo (convidado ou parceiro que lança): a chave tem de ser de um
  // arquivo recém-subido, nunca a de um documento já registrado (a planilha
  // guardada de outro booking, por exemplo, não é lida para dentro do dele).
  if (
    !isWellmix(user) &&
    !(source instanceof File) &&
    "fileKey" in source &&
    (await fileKeyTaken(source.fileKey))
  )
    throw new SheetImportError("file_required");
  const file = await sheetBytes(source);
  const parsed = parseProductSheet(file.bytes, {
    sheet: options.sheet ?? null,
    defaultCurrency: options.defaultCurrency ?? null,
  });
  if (!parsed.groups.length) throw new SheetImportError("no_rows");
  const store = getStore();
  const hint = supplierHintOf(parsed.groups);
  const suppliers = await store.list("parties", {
    filter: { type: "supplier", active: true },
  });
  const supplier = matchSheetSupplier(suppliers, hint);
  const sheetDate = mostCommon(
    parsed.groups.map((g) => asText(g.reading.sheetDate, 40)),
  );
  // Em preenchimento não gasta número: ele vem no envio, para a sequência
  // que a Wellmix vê não ter buracos.
  const number = options.preparing
    ? 0
    : await withSchema(() => store.nextNumber(LOT_COUNTER));
  const fileDocumentId = await keepSheetFile(user, source, file);
  const lot = await withSchema(() =>
    store.create("booking_lots", {
      number,
      status: options.preparing ? "preparing" : "draft",
      supplierId: supplier?.id ?? null,
      supplierHint: hint,
      origin: clip(supplier?.city, 80) ?? hint.city,
      bookingDate: bookingDateOf(sheetDate),
      sheetDate: clip(sheetDate, 40),
      fileName: file.name.slice(0, 255),
      fileDocumentId,
      sheetName: clip(parsed.sheetName, 120),
      extraHeaders: parsed.extraHeaders?.length ? parsed.extraHeaders : null,
      itemCount: parsed.groups.length,
      businessType: null,
      closedAt: null,
      closedByUserId: null,
      analyzedAt: null,
      statusChangedAt: null,
      statusChangedByUserId: null,
      note: null,
      ownerUserId:
        options.ownerUserId === undefined ? user.id : options.ownerUserId,
      createdByUserId: user.id,
      // Coluna opcional: só vai quando há responsável.
      ...(options.partnerId ? { partnerId: options.partnerId } : {}),
    }),
  );
  for (const group of parsed.groups) {
    const [photoDocumentId, cardDocumentId] = [
      await storeImage(user, group.photo),
      await storeImage(user, group.card),
    ];
    await store.create("booking_items", {
      ...itemFromGroup(group),
      lotId: lot.id,
      photoDocumentId,
      cardDocumentId,
      analysis: null,
      productId: null,
      updatedByUserId: null,
    });
  }
  if (options.preparing) {
    await audit(
      user,
      "booking_lot.create",
      "booking_lot",
      lot.id,
      `Booking em preenchimento pelo parceiro: ${parsed.groups.length} itens (${lot.fileName})`,
    );
    return lot;
  }
  // NCM por aproximação; sem correspondência, vai para o despachante.
  const { classifyBookingItems } = await import("./booking-ncm");
  await classifyBookingItems(
    await store.list("booking_items", { filter: { lotId: lot.id } }),
  );
  await audit(
    user,
    "booking_lot.create",
    "booking_lot",
    lot.id,
    `Booking nº ${lot.number}: ${parsed.groups.length} itens (${lot.fileName})`,
  );
  return lot;
}

/**
 * O parceiro enviou o booking que preenchia ("Enviar para Wellmix Conferir"):
 * ganha o número, vira rascunho e os itens passam pela aproximação de NCM,
 * como numa importação. A partir daqui é um booking como outro qualquer.
 * Quem chama confere quem pode (services/booking-partner.ts).
 */
export async function releasePreparingLot(
  user: User,
  lotId: string,
): Promise<BookingLot> {
  const store = getStore();
  const lot = await withSchema(() => store.get("booking_lots", lotId));
  if (!lot) throw new BookingLotError("not_found");
  if (!bookingLotPreparing(lot.status))
    throw new BookingLotError("booking_lot_locked");
  const number = await withSchema(() => store.nextNumber(LOT_COUNTER));
  const sent = await store.update("booking_lots", lot.id, {
    number,
    status: "draft",
    statusChangedAt: new Date().toISOString(),
    statusChangedByUserId: user.id,
  });
  const { classifyBookingItems } = await import("./booking-ncm");
  await classifyBookingItems(
    await store.list("booking_items", { filter: { lotId: lot.id } }),
  );
  await audit(
    user,
    "booking_lot.partner_send",
    "booking_lot",
    lot.id,
    `Booking nº ${number}: enviado pelo parceiro para a Wellmix conferir (${lot.fileName})`,
    { status: "preparing" },
    { status: "draft", number },
  );
  return sent;
}

/* ------------------------------------------------------------------------ */
/* Leitura                                                                   */
/* ------------------------------------------------------------------------ */

/**
 * O booking como a Wellmix o vê. O que o parceiro ainda está preenchendo
 * (antes de "Enviar para Wellmix Conferir") não existe para ela: nulo.
 */
async function wellmixLot(id: string): Promise<BookingLot | null> {
  const lot = await withSchema(() => getStore().get("booking_lots", id));
  return lot && !bookingLotPreparing(lot.status) ? lot : null;
}

export interface BookingLotListEntry {
  lot: BookingLot;
  supplier: Party | null;
  owner: User | null;
  pendingItems: number;
  signals: { viable: number; below: number; loss: number; missing: number };
}

/**
 * Todos os bookings com fornecedor, responsável, itens incompletos e os
 * sinais da análise. `null`: a tabela ainda não foi publicada.
 */
export async function listBookingLots(
  user: User,
): Promise<BookingLotListEntry[] | null> {
  assertBooking(user);
  const store = getStore();
  let lots: BookingLot[];
  let items: BookingItem[];
  try {
    [lots, items] = await Promise.all([
      store.list("booking_lots", { orderBy: "number", direction: "desc" }),
      store.list("booking_items"),
    ]);
  } catch (error) {
    const { isSchemaMissing } = await import("@/lib/db/errors");
    if (isSchemaMissing(error)) return null;
    throw error;
  }
  // Fora os que o parceiro ainda preenche (não foram enviados à Wellmix).
  lots = lots.filter((lot) => !bookingLotPreparing(lot.status));
  const [parties, users] = await Promise.all([
    store.list("parties", { filter: { type: "supplier" } }),
    store.list("users"),
  ]);
  const partyOf = new Map(parties.map((p) => [p.id, p]));
  const userOf = new Map(users.map((u) => [u.id, u]));
  const itemsOf = new Map<string, BookingItem[]>();
  for (const item of items) {
    const list = itemsOf.get(item.lotId) ?? [];
    list.push(item);
    itemsOf.set(item.lotId, list);
  }
  return lots.map((lot) => {
    const own = itemsOf.get(lot.id) ?? [];
    const pending = bookingLotPending(lot, own);
    const signals = { viable: 0, below: 0, loss: 0, missing: 0 };
    for (const item of own) {
      const verdict = item.analysis?.verdict;
      if (verdict) signals[verdict]++;
      else if (item.analysis) signals.missing++;
    }
    return {
      lot,
      supplier: lot.supplierId ? (partyOf.get(lot.supplierId) ?? null) : null,
      owner: lot.ownerUserId ? (userOf.get(lot.ownerUserId) ?? null) : null,
      pendingItems: pending.items.size,
      signals,
    };
  });
}

export interface BookingLotDetail {
  lot: BookingLot;
  items: BookingItem[];
  supplier: Party | null;
  suppliers: Party[];
  owner: User | null;
  /** Responsável pelo booking (quem recebe as solicitações); nulo = o fornecedor. */
  partner: Party | null;
  /** Quem pode ser o responsável: fornecedores e parceiros com login de fornecedor. */
  partners: Party[];
}

// Quem pode responder por um booking e para quem vão as solicitações dele:
// regras puras em src/lib/booking-lots.ts (também usadas pela visão do
// parceiro, que não carrega este módulo).
export { BOOKING_PARTNER_TYPES, bookingRecipientId };

export async function getBookingLot(
  user: User,
  id: string,
): Promise<BookingLotDetail | null> {
  assertBooking(user);
  const store = getStore();
  const lot = await wellmixLot(id);
  if (!lot) return null;
  const [items, suppliers, owner, partnerRows] = await Promise.all([
    store.list("booking_items", { filter: { lotId: lot.id } }),
    store.list("parties", { filter: { type: "supplier" }, orderBy: "name" }),
    lot.ownerUserId ? store.get("users", lot.ownerUserId) : null,
    store.list("parties", {
      filter: {
        type: BOOKING_PARTNER_TYPES.filter((t) => t !== "supplier") as never,
      },
      orderBy: "name",
    }),
  ]);
  items.sort((a, b) => a.position - b.position);
  const partnerId = lot.partnerId ?? null;
  const partners = [...suppliers, ...partnerRows]
    .filter((p) => p.active || p.id === partnerId)
    .sort((a, b) => a.name.localeCompare(b.name));
  return {
    lot,
    items,
    supplier: lot.supplierId
      ? (suppliers.find((s) => s.id === lot.supplierId) ?? null)
      : null,
    suppliers: suppliers.filter((s) => s.active || s.id === lot.supplierId),
    owner,
    partner: partnerId
      ? (partners.find((p) => p.id === partnerId) ??
        (await store.get("parties", partnerId)))
      : null,
    partners,
  };
}

/* ------------------------------------------------------------------------ */
/* Edição (só no rascunho)                                                   */
/* ------------------------------------------------------------------------ */

async function editableLot(id: string): Promise<BookingLot> {
  const lot = await wellmixLot(id);
  if (!lot) throw new BookingLotError("not_found");
  if (!bookingLotEditable(lot.status))
    throw new BookingLotError("booking_lot_locked");
  return lot;
}

/** Fornecedor do booking: ativo e do tipo fornecedor. A origem vira a cidade dele. */
export async function setBookingLotSupplier(
  user: User,
  lotId: string,
  supplierId: string | null,
): Promise<BookingLot> {
  assertBooking(user);
  const lot = await editableLot(lotId);
  const store = getStore();
  let origin = lot.supplierHint?.city ?? null;
  if (supplierId) {
    const party = await store.get("parties", supplierId);
    if (!party || party.type !== "supplier" || !party.active)
      throw new BookingLotError("supplier_invalid");
    origin = clip(party.city, 80) ?? origin;
  }
  const updated = await store.update("booking_lots", lot.id, {
    supplierId,
    origin,
  });
  await audit(
    user,
    "booking_lot.supplier",
    "booking_lot",
    lot.id,
    `Booking nº ${lot.number}: fornecedor ${supplierId ?? "-"}`,
    { supplierId: lot.supplierId },
    { supplierId },
  );
  return updated;
}

/**
 * Responsável pelo booking: para quem vão as solicitações dos itens dele
 * (decisão do dono, 11/11/2026). Muda em qualquer situação menos cancelado;
 * as solicitações já abertas continuam com quem as recebeu. Vazio: volta a
 * valer o fornecedor do booking.
 */
export async function setBookingLotPartner(
  user: User,
  lotId: string,
  partnerId: string | null,
): Promise<BookingLot> {
  assertBooking(user);
  const store = getStore();
  const lot = await wellmixLot(lotId);
  if (!lot) throw new BookingLotError("not_found");
  if (lot.status === "cancelled")
    throw new BookingLotError("booking_lot_locked");
  if (partnerId) {
    const party = await store.get("parties", partnerId);
    if (!party || !party.active || !isBookingPartner(party))
      throw new BookingLotError("booking_partner_invalid");
  }
  const updated = await withSchema(() =>
    store.update("booking_lots", lot.id, { partnerId }),
  );
  await audit(
    user,
    "booking_lot.partner",
    "booking_lot",
    lot.id,
    `Booking nº ${lot.number}: responsável ${partnerId ?? "o fornecedor"}`,
    { partnerId: lot.partnerId ?? null },
    { partnerId },
  );
  return updated;
}

/** Data do booking (AAAA-MM-DD); vazio tira. */
export async function setBookingLotDate(
  user: User,
  lotId: string,
  day: string | null,
): Promise<BookingLot> {
  assertBooking(user);
  const lot = await editableLot(lotId);
  const bookingDate = day ? bookingDateOf(day) : null;
  if (day && !bookingDate) throw new BookingLotError("booking_date_invalid");
  const updated = await getStore().update("booking_lots", lot.id, {
    bookingDate,
  });
  await audit(
    user,
    "booking_lot.date",
    "booking_lot",
    lot.id,
    `Booking nº ${lot.number}: data ${day ?? "-"}`,
    { bookingDate: lot.bookingDate },
    { bookingDate },
  );
  return updated;
}

/** Observação do booking (qualquer status). */
export async function setBookingLotNote(
  user: User,
  lotId: string,
  note: string | null,
): Promise<void> {
  assertBooking(user);
  const lot = await wellmixLot(lotId);
  if (!lot) throw new BookingLotError("not_found");
  await getStore().update("booking_lots", lot.id, { note: clip(note, 500) });
}

export interface SuggestedSupplierInput {
  name: string;
  storeNumber: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
}

/**
 * Cadastra o fornecedor sugerido pela planilha (Cadastros → Fornecedores,
 * sem login) e o põe no booking. Já existe um com o mesmo nome: usa esse.
 */
export async function registerBookingLotSupplier(
  user: User,
  lotId: string,
  input: SuggestedSupplierInput,
): Promise<Party> {
  assertBooking(user);
  const lot = await editableLot(lotId);
  const name = clip(input.name, 160);
  if (!name) throw new BookingLotError("supplier_name_required");
  const store = getStore();
  const suppliers = await store.list("parties", {
    filter: { type: "supplier" },
  });
  const key = supplierKey(name);
  let party =
    suppliers.find((s) => s.active && key && supplierKey(s.name) === key) ??
    null;
  if (!party) {
    party = await store.create("parties", {
      ...PARTY_EXTRA_DEFAULTS,
      type: "supplier",
      name,
      country: clip(input.country, 60) ?? "China",
      email: null,
      phone: clip(input.phone, 40),
      taxId: null,
      notes: `Cadastrado pelo booking nº ${lot.number}.`,
      city: clip(input.city, 80),
      storeNumber: clip(input.storeNumber, 60),
      active: true,
    });
    await audit(
      user,
      "party.create",
      "party",
      party.id,
      `${party.name} (booking nº ${lot.number})`,
    );
  }
  await setBookingLotSupplier(user, lot.id, party.id);
  return party;
}

/** Um campo de um item (rascunho). Devolve o item gravado. */
export async function setBookingItemField(
  user: User,
  itemId: string,
  field: BookingItemField,
  raw: string,
): Promise<BookingItem> {
  assertBooking(user);
  const store = getStore();
  const item = await withSchema(() => store.get("booking_items", itemId));
  if (!item) throw new BookingLotError("not_found");
  await editableLot(item.lotId);
  // Capacidade: mililitros ou o tamanho em texto (os dois campos juntos).
  if (field === "capacityMl") {
    const next = readBookingCapacity(raw, item);
    if (
      next.capacityMl === item.capacityMl &&
      next.sizeText === (item.sizeText ?? null)
    )
      return item;
    return store.update("booking_items", item.id, {
      ...next,
      updatedByUserId: user.id,
    });
  }
  const value = readBookingItemValue(field, raw);
  if (item[field] === value) return item;
  return store.update("booking_items", item.id, {
    [field]: value,
    updatedByUserId: user.id,
  } as Partial<BookingItem>);
}

/* ------------------------------------------------------------------------ */
/* Fechar e status                                                           */
/* ------------------------------------------------------------------------ */

/** Roda o Superplan em todos os itens e grava o retrato em cada um. */
async function analyzeLot(
  user: User | null,
  lot: BookingLot,
  items: BookingItem[],
  businessType: string | null,
) {
  const { analyzeBookingItems } = await import("./superplan-analysis");
  const snapshots = await analyzeBookingItems(items, { businessType });
  const at = new Date().toISOString();
  const store = getStore();
  for (const item of items) {
    const snapshot = snapshots.get(item.id);
    if (!snapshot) continue;
    await store.update("booking_items", item.id, {
      analysis: { ...snapshot, at, byUserId: user?.id ?? "system" },
    });
  }
  return at;
}

/**
 * Fecha o booking: fornecedor, data e os campos obrigatórios de todos os
 * itens preenchidos; roda a análise do Superplan em todos os itens (com o
 * tipo de negócio escolhido, ou o padrão) e passa a Fechado.
 */
export async function closeBookingLot(
  user: User,
  lotId: string,
  businessType: string | null,
): Promise<BookingLot> {
  assertBooking(user);
  const lot = await editableLot(lotId);
  const store = getStore();
  // Itens ainda sem NCM: tenta de novo a aproximação (o cadastro pode ter
  // ganhado produtos com NCM desde a importação).
  const { classifyBookingItems } = await import("./booking-ncm");
  await classifyBookingItems(
    await store.list("booking_items", { filter: { lotId: lot.id } }),
  );
  const items = await store.list("booking_items", {
    filter: { lotId: lot.id },
  });
  const pending = bookingLotPending(lot, items);
  if (!bookingLotReady(pending)) {
    if (pending.supplier) throw new BookingLotError("supplier_required");
    if (pending.date) throw new BookingLotError("booking_date_required");
    if (pending.noItems) throw new BookingLotError("no_rows");
    throw new BookingLotError("booking_items_incomplete");
  }
  const type = clip(businessType, 80);
  const at = await analyzeLot(user, lot, items, type);
  const updated = await store.update("booking_lots", lot.id, {
    status: "closed",
    businessType: type,
    closedAt: at,
    closedByUserId: user.id,
    analyzedAt: at,
    statusChangedAt: at,
    statusChangedByUserId: user.id,
    itemCount: items.length,
  });
  await audit(
    user,
    "booking_lot.close",
    "booking_lot",
    lot.id,
    `Booking nº ${lot.number} fechado: ${items.length} itens analisados`,
  );
  return updated;
}

/** Refaz a análise do Superplan num booking já fechado (câmbio ou parâmetros mudaram). */
export async function reanalyzeBookingLot(
  user: User,
  lotId: string,
  businessType: string | null,
): Promise<void> {
  assertBooking(user);
  const store = getStore();
  const lot = await wellmixLot(lotId);
  if (!lot) throw new BookingLotError("not_found");
  if (lot.status === "draft" || lot.status === "cancelled")
    throw new BookingLotError("booking_lot_not_closed");
  const items = await store.list("booking_items", {
    filter: { lotId: lot.id },
  });
  const type = clip(businessType, 80) ?? lot.businessType;
  const at = await analyzeLot(user, lot, items, type);
  await store.update("booking_lots", lot.id, {
    analyzedAt: at,
    businessType: type,
  });
  await audit(
    user,
    "booking_lot.analyze",
    "booking_lot",
    lot.id,
    `Booking nº ${lot.number}: análise refeita`,
  );
}

/** Status em que o booking tem análise do Superplan (fechado em diante). */
const ANALYZED_LOT_STATUSES: BookingLotStatus[] = [
  "closed",
  "in_progress",
  "done",
];

/**
 * A tabela fiscal (TEC ou TIPI) foi carregada: refaz sozinho a análise dos
 * bookings fechados, em andamento ou concluídos que têm algum item cujo II
 * ou IPI pelo NCM mudou (inclusive o que antes não estava na tabela). Os
 * outros ficam como estão: o robô roda sempre e não deve trocar câmbio e
 * parâmetros de análises que a tabela não mexeu. Cada booking refeito usa o
 * próprio tipo de negócio, como "Refazer a análise". `user` nulo = o robô.
 */
export async function reanalyzeLotsForFiscalTable(
  user: User | null,
): Promise<{ lots: number; items: number }> {
  const store = getStore();
  const { lookupNcm } = await import("./fiscal");
  const { ncmTaxPct } = await import("./superplan-analysis");
  const lots = await store.list("booking_lots", {
    filter: { status: ANALYZED_LOT_STATUSES },
  });
  const rates = new Map<string, ReturnType<typeof ncmTaxPct>>();
  const taxOf = async (ncm: string) => {
    let r = rates.get(ncm);
    if (!r) rates.set(ncm, (r = ncmTaxPct(await lookupNcm(ncm))));
    return r;
  };
  const pct = (n: number | null) => (n === null ? null : Number(n.toFixed(2)));
  let done = 0;
  let itemCount = 0;
  for (const lot of lots) {
    const items = await store.list("booking_items", {
      filter: { lotId: lot.id },
    });
    let affected = false;
    for (const item of items) {
      const ncm = item.ncm?.trim();
      const before = item.analysis?.inputs;
      if (!ncm || !item.analysis) continue;
      const now = await taxOf(ncm);
      if (
        !before ||
        before.ncmFound !== now.ncmFound ||
        (now.ncmFound &&
          (pct(now.iiPct) !== before.iiPct ||
            pct(now.ipiPct) !== before.ipiPct))
      ) {
        affected = true;
        break;
      }
    }
    if (!affected) continue;
    const at = await analyzeLot(user, lot, items, lot.businessType);
    await store.update("booking_lots", lot.id, { analyzedAt: at });
    await audit(
      user,
      "booking_lot.analyze",
      "booking_lot",
      lot.id,
      `Booking nº ${lot.number}: análise refeita (tabela fiscal atualizada)`,
    );
    done++;
    itemCount += items.length;
  }
  return { lots: done, items: itemCount };
}

/** Muda o status à mão (fechar o rascunho é `closeBookingLot`). */
export async function moveBookingLot(
  user: User,
  lotId: string,
  status: BookingLotStatus,
): Promise<void> {
  assertBooking(user);
  const store = getStore();
  const lot = await wellmixLot(lotId);
  if (!lot) throw new BookingLotError("not_found");
  if (!canMoveBookingLot(lot.status, status))
    throw new BookingLotError("booking_lot_move_invalid");
  await store.update("booking_lots", lot.id, {
    status,
    statusChangedAt: new Date().toISOString(),
    statusChangedByUserId: user.id,
  });
  await audit(
    user,
    "booking_lot.status",
    "booking_lot",
    lot.id,
    `Booking nº ${lot.number}: ${lot.status} → ${status}`,
    { status: lot.status },
    { status },
  );
}
