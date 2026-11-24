import "server-only";

import { assertWellmix, isWellmix } from "@/lib/auth/permissions";
import { assertScreen } from "@/lib/auth/screens";
import { canSeePurchasePrice } from "@/lib/auth/function-access";
import {
  BOOKING_PARTNER_TYPES,
  bookingDateOf,
  bookingLotEditable,
  bookingLotPreparing,
  bookingLotPending,
  bookingLotReady,
  bookingRecipientId,
  bookManufacturer,
  bookingLotLockable,
  manufacturerMismatch,
  canMoveBookingLot,
  isBookingPartner,
  matchSheetSupplier,
  mostCommon,
  bookingItemPatch,
  supplierKey,
  type BookingItemField,
} from "@/lib/booking-lots";
import {
  getStore,
  PARTY_EXTRA_DEFAULTS,
  type BookingItem,
  type BookingLot,
  type BookingLock,
  type BookingLotSheetFile,
  type BookingLotStatus,
  type BookingLotSupplierHint,
  type Party,
  type SheetCurrency,
  type SheetIncoterm,
  type User,
} from "@/lib/db";
import {
  cleanItemType,
  lockOfLot,
  lockedSince,
  visibleLots,
  workedShare,
} from "@/lib/booking-locks";
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
 * tudo e fecha; ao fechar, a API de preço do Sankhya prevê todos os itens. Nenhum
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
    // Fabricante como a planilha escreveu nesta linha (comparado com a
    // Fábrica do book).
    sheetSupplier: asText(r.supplierName, 160),
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
 * FOB ou EXW do book e o valor do EXW (dono, 24/11/2026): com EXW o valor é
 * obrigatório e acima de zero; com FOB (ou sem escolha) não há valor.
 */
function bookIncoterm(meta: BookingLotMeta): {
  incoterm: SheetIncoterm | null;
  exwValue: number | null;
} {
  const incoterm = meta.incoterm ?? null;
  if (incoterm !== "EXW") return { incoterm, exwValue: null };
  const value = meta.exwValue ?? null;
  if (value === null || !Number.isFinite(value) || value <= 0 || value > 1e9)
    throw new BookingLotError("booking_exw_value_required");
  return { incoterm, exwValue: value };
}

/** Até quantas planilhas formam um book (dono, 23/11/2026). */
export const BOOKING_SHEETS_MAX = 10;

/** O que quem importa informa junto com a planilha (dono, 23/11/2026). */
export interface BookingLotMeta {
  /** Nº da loja e nome da Fábrica (o supplier da planilha), texto livre. */
  storeNumber?: string | null;
  supplierName?: string | null;
  /**
   * FOB ou EXW escolhido por quem importa: vale para todos os itens, seja
   * qual for o que a planilha trazia. Com EXW, o valor do EXW (acima de zero).
   */
  incoterm?: SheetIncoterm | null;
  exwValue?: number | null;
  /** Tipo de item do book. */
  itemType?: string | null;
}

/**
 * Sobe a planilha (ou várias: o book é a soma delas, na ordem): lê as
 * colunas conhecidas (as outras ficam guardadas como informação nos itens),
 * estima fornecedor, origem e data e cria o booking em rascunho com os itens
 * e as fotos. Devolve o booking.
 */
export async function createBookingLotFromSheet(
  user: User,
  source: SheetSource | SheetSource[],
  options: {
    defaultCurrency?: SheetCurrency | null;
    sheet?: string | null;
    /**
     * Fornecedor (o Supplier, dono do book, para quem vão as solicitações):
     * um parceiro do cadastro ou, sem ele, o nome de um novo, que é
     * cadastrado (dono, 24/11/2026). O book que o parceiro lança já nasce
     * com a empresa dele.
     */
    partnerId?: string | null;
    newPartnerName?: string | null;
  } & BookingLotMeta = {},
): Promise<BookingLot> {
  assertBooking(user);
  const { newPartnerName: _new, ...rest } = options;
  void _new;
  return createLotFromSheet(user, source, {
    ...rest,
    partnerId: await importPartnerId(user, options),
  });
}

/**
 * O Fornecedor escolhido na importação: o parceiro do cadastro (ativo e de
 * um tipo que responde por book) ou o novo, cadastrado pelo nome (se já
 * houver um ativo com o mesmo nome, vale esse). Nenhum: nulo (vale a
 * Fábrica do book, como antes).
 */
async function importPartnerId(
  user: User,
  options: { partnerId?: string | null; newPartnerName?: string | null },
): Promise<string | null> {
  const store = getStore();
  if (options.partnerId) {
    const party = await store.get("parties", options.partnerId);
    if (!party || !party.active || !isBookingPartner(party))
      throw new BookingLotError("booking_partner_invalid");
    return party.id;
  }
  const name = clip(options.newPartnerName, 160);
  if (!name) return null;
  const key = supplierKey(name);
  const known = (
    await store.list("parties", {
      filter: { type: [...BOOKING_PARTNER_TYPES] as never, active: true },
    })
  ).find((p) => key && supplierKey(p.name) === key);
  if (known) return known.id;
  const party = await store.create("parties", {
    ...PARTY_EXTRA_DEFAULTS,
    type: "supplier",
    name,
    country: "China",
    email: null,
    phone: null,
    taxId: null,
    notes: "Cadastrado na importação de um book.",
    active: true,
  });
  await audit(
    user,
    "party.create",
    "party",
    party.id,
    `${party.name} (fornecedor de um book importado)`,
  );
  return party.id;
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
  source: SheetSource | SheetSource[],
  options: {
    defaultCurrency?: SheetCurrency | null;
    sheet?: string | null;
    partnerId?: string | null;
    ownerUserId?: string | null;
    /** Lançado pelo parceiro: fica em preenchimento até ele enviar. */
    preparing?: boolean;
  } & BookingLotMeta = {},
): Promise<BookingLot> {
  const sources = Array.isArray(source) ? source : [source];
  const bookTerms = bookIncoterm(options);
  if (!sources.length) throw new SheetImportError("file_required");
  if (sources.length > BOOKING_SHEETS_MAX)
    throw new BookingLotError("booking_sheets_too_many");
  // Login externo (convidado ou parceiro que lança): a chave tem de ser de um
  // arquivo recém-subido, nunca a de um documento já registrado (a planilha
  // guardada de outro booking, por exemplo, não é lida para dentro do dele).
  if (!isWellmix(user))
    for (const one of sources)
      if (
        !(one instanceof File) &&
        "fileKey" in one &&
        (await fileKeyTaken(one.fileKey))
      )
        throw new SheetImportError("file_required");
  // Todas as planilhas são lidas antes de gravar: uma que não abre não deixa
  // um book pela metade.
  const sheets: Array<{
    source: SheetSource;
    file: Awaited<ReturnType<typeof sheetBytes>>;
    parsed: ReturnType<typeof parseProductSheet>;
  }> = [];
  for (const one of sources) {
    const file = await sheetBytes(one);
    const parsed = parseProductSheet(file.bytes, {
      sheet: options.sheet ?? null,
      defaultCurrency: options.defaultCurrency ?? null,
    });
    sheets.push({ source: one, file, parsed });
  }
  const groups = sheets.flatMap((sh) => sh.parsed.groups);
  if (!groups.length) throw new SheetImportError("no_rows");
  const store = getStore();
  const hint = supplierHintOf(groups);
  const suppliers = await store.list("parties", {
    filter: { type: "supplier", active: true },
  });
  const supplier = matchSheetSupplier(suppliers, hint);
  const sheetDate = mostCommon(
    groups.map((g) => asText(g.reading.sheetDate, 40)),
  );
  // Em preenchimento não gasta número: ele vem no envio, para a sequência
  // que a Wellmix vê não ter buracos.
  const number = options.preparing
    ? 0
    : await withSchema(() => store.nextNumber(LOT_COUNTER));
  const sheetFiles: BookingLotSheetFile[] = [];
  for (const sh of sheets)
    sheetFiles.push({
      name: sh.file.name.slice(0, 255),
      documentId: await keepSheetFile(user, sh.source, sh.file),
      items: sh.parsed.groups.length,
    });
  const extraHeaders = [
    ...new Set(sheets.flatMap((sh) => sh.parsed.extraHeaders ?? [])),
  ];
  const itemType = cleanItemType(options.itemType);
  const lot = await withSchema(() =>
    store.create("booking_lots", {
      number,
      status: options.preparing ? "preparing" : "draft",
      supplierId: supplier?.id ?? null,
      supplierHint: hint,
      origin: clip(supplier?.city, 80) ?? hint.city,
      bookingDate: bookingDateOf(sheetDate),
      sheetDate: clip(sheetDate, 40),
      fileName: sheetFiles
        .map((f) => f.name)
        .join(" + ")
        .slice(0, 255),
      fileDocumentId: sheetFiles[0].documentId,
      sheetName: clip(sheets[0].parsed.sheetName, 120),
      extraHeaders: extraHeaders.length ? extraHeaders : null,
      itemCount: groups.length,
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
      // Colunas opcionais: só vão quando há valor.
      ...(options.partnerId ? { partnerId: options.partnerId } : {}),
      ...(clip(options.storeNumber, 60)
        ? { storeNumber: clip(options.storeNumber, 60) }
        : {}),
      ...(clip(options.supplierName, 160)
        ? { supplierName: clip(options.supplierName, 160) }
        : {}),
      ...(itemType ? { itemType } : {}),
      ...(sheetFiles.length > 1 ? { sheetFiles } : {}),
      ...(bookTerms.incoterm ? bookTerms : {}),
    }),
  );
  // Os itens de cada planilha entram depois dos da anterior.
  let position = 0;
  for (const group of groups) {
    const [photoDocumentId, cardDocumentId] = [
      await storeImage(user, group.photo),
      await storeImage(user, group.card),
    ];
    await store.create("booking_items", {
      ...itemFromGroup(group),
      // FOB/EXW escolhido na importação: troca o da planilha em todos.
      ...(bookTerms.incoterm ? { incoterm: bookTerms.incoterm } : {}),
      position: position++,
      lotId: lot.id,
      photoDocumentId,
      cardDocumentId,
      analysis: null,
      productId: null,
      updatedByUserId: null,
    });
  }
  const many = sheetFiles.length > 1 ? `, ${sheetFiles.length} planilhas` : "";
  if (options.preparing) {
    await audit(
      user,
      "booking_lot.create",
      "booking_lot",
      lot.id,
      `Book em preenchimento pelo parceiro: ${groups.length} itens${many} (${lot.fileName})`,
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
    `Book nº ${lot.number}: ${groups.length} itens${many} (${lot.fileName})`,
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
    `Book nº ${number}: enviado pelo parceiro para a Wellmix conferir (${lot.fileName})`,
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
  /** Itens trabalhados na Seleção de itens (dono, 23/11/2026). */
  worked: { worked: number; total: number; pct: number };
  /** Quem está com o book (trava), desde quando, e a trava. Nulo: livre. */
  held: BookingLotHold | null;
}

/** Com quem está o book (docs/BOOKING.md, "Travar books"). */
export interface BookingLotHold {
  lock: BookingLock;
  user: User | null;
  /** Desde quando está com a pessoa (ISO). */
  since: string;
  /** Há quantos minutos (na hora da leitura). */
  minutes: number;
  /** Quem vê pode liberar: o gestor de quem travou ou quem supervisiona. */
  canRelease: boolean;
}

/**
 * Quem vê libera a trava? Nunca quem travou: só o gestor dele (cadeia do
 * "Responde a") ou quem supervisiona os books (dono, 24/11/2026).
 */
async function releaserOf(user: User, users: readonly User[]) {
  const supervisor = await canSuperviseBooks(user);
  const { managerChain } = await import("@/lib/team-hierarchy");
  const { canReleaseLock } = await import("@/lib/booking-locks");
  return (lockUserId: string) =>
    canReleaseLock(
      lockUserId,
      user.id,
      supervisor,
      supervisor ? [] : managerChain(lockUserId, users).chain.map((n) => n.id),
    );
}

const minutesSince = (since: string) =>
  Math.max(0, Math.floor((Date.now() - Date.parse(since)) / 60_000)) || 0;

/**
 * Supervisiona os books: vê todos, com quem está cada um e libera a trava de
 * qualquer pessoa. O administrador e quem tem a ação "Supervisionar os
 * books" (de fábrica, a Diretoria de compras).
 */
export async function canSuperviseBooks(user: User): Promise<boolean> {
  if (!isWellmix(user)) return false;
  const { isAdmin } = await import("@/lib/auth/permissions");
  if (isAdmin(user)) return true;
  const { can } = await import("@/lib/auth/function-access");
  return can(user, "booking.supervise");
}

/** As travas em vigor. Tabela ainda sem publicar: nenhuma. */
export async function listBookingLocks(): Promise<BookingLock[]> {
  try {
    return await getStore().list("booking_locks");
  } catch (error) {
    const { isSchemaMissing } = await import("@/lib/db/errors");
    if (isSchemaMissing(error)) return [];
    throw error;
  }
}

/**
 * Os books que o login vê pela regra das travas (`visibleLots`): o
 * supervisor todos; o analista com book travado só os dele; os outros, os
 * que ninguém travou.
 */
export async function lotsVisibleTo<T extends BookingLot>(
  user: User,
  lots: T[],
  locks?: BookingLock[],
): Promise<T[]> {
  const all = locks ?? (await listBookingLocks());
  if (!all.length) return lots;
  return visibleLots(lots, all, user.id, await canSuperviseBooks(user));
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
  const locks = await listBookingLocks();
  lots = await lotsVisibleTo(user, lots, locks);
  const [parties, users] = await Promise.all([
    store.list("parties", { filter: { type: "supplier" } }),
    store.list("users"),
  ]);
  const partyOf = new Map(parties.map((p) => [p.id, p]));
  const userOf = new Map(users.map((u) => [u.id, u]));
  const canRelease = await releaserOf(user, users);
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
      // Só a previsão de preço do Sankhya (os retratos antigos ficam de fora).
      const a =
        item.analysis?.source === "price_forecast" ? item.analysis : null;
      if (a?.verdict) signals[a.verdict]++;
      else if (a) signals.missing++;
    }
    return {
      lot,
      supplier: lot.supplierId ? (partyOf.get(lot.supplierId) ?? null) : null,
      owner: lot.ownerUserId ? (userOf.get(lot.ownerUserId) ?? null) : null,
      pendingItems: pending.items.size,
      signals,
      worked: workedShare(own),
      held: holdOf(lot, locks, userOf, canRelease),
    };
  });
}

function holdOf(
  lot: BookingLot,
  locks: BookingLock[],
  userOf: Map<string, User>,
  canRelease: (lockUserId: string) => boolean,
): BookingLotHold | null {
  const lock = lockOfLot(lot, locks);
  if (!lock) return null;
  const since = lockedSince(lot, lock);
  return {
    lock,
    user: userOf.get(lock.userId) ?? null,
    since,
    minutes: minutesSince(since),
    canRelease: canRelease(lock.userId),
  };
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
  /** Com quem está o book (trava). Nulo: livre. */
  held: BookingLotHold | null;
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
  // Travado por outro analista: para quem não supervisiona, não existe.
  const locks = await listBookingLocks();
  const held = lockOfLot(lot, locks);
  if (
    held &&
    held.userId !== user.id &&
    !(await lotsVisibleTo(user, [lot], locks)).length
  )
    return null;
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
    held: held
      ? {
          lock: held,
          user: await store.get("users", held.userId),
          since: lockedSince(lot, held),
          minutes: minutesSince(lockedSince(lot, held)),
          canRelease: (await releaserOf(user, await store.list("users")))(
            held.userId,
          ),
        }
      : null,
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
  // Outra Fábrica: o que foi confirmado valia para a anterior.
  if (supplierId !== lot.supplierId) await clearManufacturerOk(lot.id);
  await audit(
    user,
    "booking_lot.supplier",
    "booking_lot",
    lot.id,
    `Book nº ${lot.number}: fornecedor ${supplierId ?? "-"}`,
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
    `Book nº ${lot.number}: responsável ${partnerId ?? "o fornecedor"}`,
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
    `Book nº ${lot.number}: data ${day ?? "-"}`,
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
      notes: `Cadastrado pelo book nº ${lot.number}.`,
      city: clip(input.city, 80),
      storeNumber: clip(input.storeNumber, 60),
      active: true,
    });
    await audit(
      user,
      "party.create",
      "party",
      party.id,
      `${party.name} (book nº ${lot.number})`,
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
  // Preço e moeda: editar exige ver o preço de compra (dono, 15/11/2026;
  // docs/LINHA_DE_VISAO.md).
  if ((field === "price" || field === "currency") && !canSeePurchasePrice(user))
    throw new BookingLotError("forbidden");
  const store = getStore();
  const item = await withSchema(() => store.get("booking_items", itemId));
  if (!item) throw new BookingLotError("not_found");
  await editableLot(item.lotId);
  // A mesma regra do preenchimento em massa (bookingItemPatch).
  const patch = bookingItemPatch(item, field, raw);
  if (!patch) return item;
  return store.update("booking_items", item.id, {
    ...patch,
    updatedByUserId: user.id,
  });
}

/* ------------------------------------------------------------------------ */
/* Preenchimento em massa                                                    */
/* ------------------------------------------------------------------------ */

/** Campo do preenchimento em massa: os da célula e o NCM. */
export type BookingBulkField = BookingItemField | "ncm";

/**
 * Resultado do preenchimento em massa: os itens gravados e os recusados,
 * cada um com o campo e o erro (a ação traduz o motivo).
 */
export interface BookingBulkResult {
  updated: string[];
  failed: Array<{
    itemId: string;
    field: BookingBulkField | null;
    error: unknown;
  }>;
}

/**
 * Grava os mesmos valores em vários itens do booking, item a item, com a
 * regra da célula (bookingItemPatch). Item de outro booking fica de fora.
 * Quem chama confere o login e se o booking aceita edição.
 */
export async function applyBookingItemsBulk(
  user: User,
  lotId: string,
  itemIds: readonly string[],
  values: ReadonlyArray<readonly [BookingItemField, string]>,
): Promise<BookingBulkResult & { items: BookingItem[] }> {
  const store = getStore();
  const ids = [...new Set(itemIds)];
  const found = ids.length
    ? await withSchema(() =>
        store.list("booking_items", { filter: { id: ids } }),
      )
    : [];
  const byId = new Map(found.map((i) => [i.id, i]));
  const result: BookingBulkResult & { items: BookingItem[] } = {
    updated: [],
    failed: [],
    items: [],
  };
  for (const id of ids) {
    const item = byId.get(id);
    if (!item || item.lotId !== lotId) {
      result.failed.push({
        itemId: id,
        field: null,
        error: new BookingLotError("not_found"),
      });
      continue;
    }
    result.items.push(item);
    // Campo a campo, para dizer qual não deu.
    let field: BookingItemField | null = null;
    try {
      let current = item;
      let patch: Partial<BookingItem> | null = null;
      for (const [f, raw] of values) {
        field = f;
        const next = bookingItemPatch(current, f, raw);
        if (!next) continue;
        patch = { ...(patch ?? {}), ...next };
        current = { ...current, ...next };
      }
      if (patch)
        await store.update("booking_items", item.id, {
          ...patch,
          updatedByUserId: user.id,
        });
      result.updated.push(item.id);
    } catch (error) {
      result.failed.push({ itemId: id, field, error });
    }
  }
  if (result.updated.length && values.length)
    await audit(
      user,
      "booking_item.bulk",
      "booking_lot",
      lotId,
      `Preenchimento em massa: ${values.map(([f]) => f).join(", ")} em ${result.updated.length} item(ns)`,
      null,
      { fields: Object.fromEntries(values), itemIds: result.updated },
    );
  return result;
}

/**
 * Preenchimento em massa na tela da Wellmix (dono, 16/11/2026): os valores
 * digitados acima das colunas vão para os itens marcados. As regras são as
 * da célula: a tela Booking, o preço e a moeda só com "Ver preço de compra",
 * os campos só no rascunho e o NCM em qualquer situação menos Cancelado (o
 * mesmo serviço da célula do NCM, que refaz a análise do booking fechado).
 */
export async function setBookingItemsFields(
  user: User,
  lotId: string,
  itemIds: readonly string[],
  values: ReadonlyArray<readonly [BookingItemField, string]>,
  ncm: string | null = null,
): Promise<BookingBulkResult> {
  assertBooking(user);
  if (
    values.some(([f]) => f === "price" || f === "currency") &&
    !canSeePurchasePrice(user)
  )
    throw new BookingLotError("forbidden");
  if (values.length) await editableLot(lotId);
  else if (!(await wellmixLot(lotId))) throw new BookingLotError("not_found");
  const { items, ...result } = await applyBookingItemsBulk(
    user,
    lotId,
    itemIds,
    values,
  );
  if (ncm === null || !ncm.trim()) return result;
  // NCM: os itens do booking que gravaram os outros campos, de uma vez.
  const failed = new Set(result.failed.map((f) => f.itemId));
  const ncmIds = items.map((i) => i.id).filter((id) => !failed.has(id));
  if (!ncmIds.length) return result;
  const { setBookingItemsNcm } = await import("./booking-ncm");
  // O serviço do NCM grava até 200 itens por vez.
  for (let start = 0; start < ncmIds.length; start += 200) {
    const chunk = ncmIds.slice(start, start + 200);
    try {
      await setBookingItemsNcm(user, chunk, ncm);
    } catch (error) {
      const refused = new Set(chunk);
      result.updated = result.updated.filter((id) => !refused.has(id));
      for (const itemId of chunk)
        result.failed.push({ itemId, field: "ncm", error });
    }
  }
  return result;
}

/* ------------------------------------------------------------------------ */
/* Fechar e status                                                           */
/* ------------------------------------------------------------------------ */

/**
 * Previsão de preço de todos os itens pela API de preço do Sankhya (dono,
 * 24/11/2026; src/lib/services/booking-price-forecast.ts): agendada para
 * depois da resposta, item a item. Devolve a hora do pedido.
 */
async function analyzeLot(
  user: User | null,
  lot: BookingLot,
  items: BookingItem[],
) {
  const { scheduleBookingForecasts } = await import("./booking-price-forecast");
  const at = new Date().toISOString();
  await scheduleBookingForecasts(items, user?.id ?? "system");
  return at;
}

/**
 * Fecha o booking: fornecedor, data e os campos obrigatórios de todos os
 * itens preenchidos; pede a previsão de preço de todos os itens e passa a
 * Fechado.
 */
export async function closeBookingLot(
  user: User,
  lotId: string,
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
  // Itens de outro fabricante: remover a linha ou confirmar que a planilha
  // estava errada (dono, 24/11/2026).
  if ((await manufacturerMismatches(lot, items)).length)
    throw new BookingLotError("booking_manufacturer_mismatch");
  const pending = bookingLotPending(lot, items);
  if (!bookingLotReady(pending)) {
    if (pending.supplier) throw new BookingLotError("supplier_required");
    if (pending.date) throw new BookingLotError("booking_date_required");
    if (pending.noItems) throw new BookingLotError("no_rows");
    throw new BookingLotError("booking_items_incomplete");
  }
  const at = new Date().toISOString();
  const updated = await store.update("booking_lots", lot.id, {
    status: "closed",
    closedAt: at,
    closedByUserId: user.id,
    analyzedAt: at,
    statusChangedAt: at,
    statusChangedByUserId: user.id,
    itemCount: items.length,
  });
  await analyzeLot(user, updated, items);
  await audit(
    user,
    "booking_lot.close",
    "booking_lot",
    lot.id,
    `Book nº ${lot.number} fechado: previsão de preço de ${items.length} itens`,
  );
  return updated;
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
    `Book nº ${lot.number}: ${lot.status} → ${status}`,
    { status: lot.status },
    { status },
  );
}

/* ------------------------------------------------------------------------ */
/* Loja/Fábrica e Tipo de item (dono, 23/11/2026)                            */
/* ------------------------------------------------------------------------ */

/**
 * Loja/Fábrica e Tipo de item do book: vêm da importação e a Wellmix ajusta
 * (ou completa nos books antigos) em qualquer situação menos Cancelado.
 */
export async function setBookingLotMeta(
  user: User,
  lotId: string,
  meta: {
    storeNumber: string | null;
    supplierName: string | null;
    itemType: string | null;
    /** Só no rascunho: troca o FOB/EXW do book e de todos os itens. */
    incoterm?: SheetIncoterm | null;
    exwValue?: number | null;
  },
): Promise<BookingLot> {
  assertBooking(user);
  const lot = await wellmixLot(lotId);
  if (!lot) throw new BookingLotError("not_found");
  if (lot.status === "cancelled")
    throw new BookingLotError("booking_lot_locked");
  const itemType = cleanItemType(meta.itemType);
  const storeNumber = clip(meta.storeNumber, 60);
  const supplierName = clip(meta.supplierName, 160);
  // FOB/EXW: só no rascunho (muda os itens), e só quando veio no formulário.
  const terms =
    meta.incoterm && bookingLotEditable(lot.status) ? bookIncoterm(meta) : null;
  const store = getStore();
  const updated = await withSchema(() =>
    store.update("booking_lots", lot.id, {
      storeNumber,
      supplierName,
      itemType,
      ...(terms ?? {}),
    }),
  );
  // Outra Fábrica digitada: o que foi confirmado valia para a anterior.
  if ((lot.supplierName ?? null) !== supplierName)
    await clearManufacturerOk(lot.id);
  if (terms?.incoterm) {
    const items = await store.list("booking_items", {
      filter: { lotId: lot.id },
    });
    for (const item of items)
      if (item.incoterm !== terms.incoterm)
        await store.update("booking_items", item.id, {
          incoterm: terms.incoterm,
          updatedByUserId: user.id,
        });
  }
  await audit(
    user,
    "booking_lot.meta",
    "booking_lot",
    lot.id,
    `Book nº ${lot.number}: loja ${storeNumber ?? "-"}, supplier ${supplierName ?? "-"}, tipo de item ${itemType ?? "-"}`,
    {
      storeNumber: lot.storeNumber ?? null,
      supplierName: lot.supplierName ?? null,
      itemType: lot.itemType ?? null,
    },
    { storeNumber, supplierName, itemType, ...(terms ?? {}) },
  );
  return updated;
}

/** Tipos de item já usados nos books (sugestões do campo), em ordem alfabética. */
export async function bookingItemTypes(): Promise<string[]> {
  const { listColumns } = await import("@/lib/db/lookup");
  let rows: Array<{ itemType?: string | null }>;
  try {
    rows = await listColumns(getStore(), "booking_lots", ["itemType"]);
  } catch (error) {
    const { isSchemaMissing } = await import("@/lib/db/errors");
    if (isSchemaMissing(error)) return [];
    throw error;
  }
  const { itemTypeKey } = await import("@/lib/booking-locks");
  const byKey = new Map<string, string>();
  for (const row of rows) {
    const type = cleanItemType(row.itemType);
    if (type && !byKey.has(itemTypeKey(type)))
      byKey.set(itemTypeKey(type), type);
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b, "pt"));
}

/* ------------------------------------------------------------------------ */
/* Itens trabalhados (dono, 23/11/2026)                                      */
/* ------------------------------------------------------------------------ */

/**
 * Marca os itens como trabalhados na Seleção de itens: entraram numa escolha
 * de grupo gravada ou numa solicitação ao fornecedor. Quem chama já conferiu
 * o login. A marca não sai; o que já estava marcado fica como está. Coluna
 * ainda sem publicar: nada é marcado (a escolha não falha por isso).
 */
export async function markItemsWorked(
  user: User,
  items: ReadonlyArray<Pick<BookingItem, "id" | "workedAt" | "lotId">>,
): Promise<void> {
  const store = getStore();
  const at = new Date().toISOString();
  try {
    for (const item of items)
      if (!item.workedAt)
        await store.update("booking_items", item.id, {
          workedAt: at,
          workedByUserId: user.id,
        });
    // Book inteiro trabalhado: a trava se libera sozinha (dono, 24/11/2026).
    for (const lotId of new Set(items.map((i) => i.lotId)))
      await releaseWhenWorkDone(lotId, at);
  } catch (error) {
    const { isSchemaMissing } = await import("@/lib/db/errors");
    if (!isSchemaMissing(error)) throw error;
  }
}

/**
 * Todos os itens do book trabalhados: marca o trabalho como completo
 * (`workDoneAt`), o que tira a trava do book (a dele é apagada; a do tipo de
 * item deixa de valer para ele) e o devolve à vista de todos.
 */
async function releaseWhenWorkDone(lotId: string, at: string) {
  const store = getStore();
  const lot = await store.get("booking_lots", lotId);
  if (!lot || lot.workDoneAt) return;
  const items = await store.list("booking_items", { filter: { lotId } });
  if (!items.length || items.some((i) => !i.workedAt)) return;
  await store.update("booking_lots", lot.id, { workDoneAt: at });
  const own = (await listBookingLocks()).filter(
    (l) => l.scope === "lot" && l.lotId === lot.id,
  );
  for (const lock of own) await store.remove("booking_locks", lock.id);
  await audit(
    null,
    "booking_lock.work_done",
    "booking_lot",
    lot.id,
    `Book nº ${lot.number}: todos os ${items.length} itens trabalhados; trava liberada`,
  );
}

/* ------------------------------------------------------------------------ */
/* Travar books (dono, 23/11/2026)                                           */
/* ------------------------------------------------------------------------ */

/**
 * O analista pega o book para si. Só o book que ele vê e que está livre
 * (ninguém o travou, nem pelo tipo de item).
 */
export async function lockBookingLot(
  user: User,
  lotId: string,
): Promise<BookingLock> {
  assertBooking(user);
  const lot = await wellmixLot(lotId);
  if (!lot) throw new BookingLotError("not_found");
  // Só depois do rascunho: o book fechado é que começa a ser trabalhado na
  // seleção dos itens (dono, 24/11/2026).
  if (!bookingLotLockable(lot.status))
    throw new BookingLotError("booking_lock_draft");
  const store = getStore();
  const locks = await withSchema(() => store.list("booking_locks"));
  const held = lockOfLot(lot, locks);
  if (held)
    throw new BookingLotError(
      held.userId === user.id ? "booking_lock_mine" : "booking_lock_taken",
    );
  const lock = await store.create("booking_locks", {
    scope: "lot",
    lotId: lot.id,
    typeKey: null,
    itemType: null,
    userId: user.id,
    lockedAt: new Date().toISOString(),
  });
  await audit(
    user,
    "booking_lock.lock",
    "booking_lot",
    lot.id,
    `Book nº ${lot.number} travado por ${user.name}`,
  );
  return lock;
}

/**
 * O analista pega para si todos os books de um tipo de item (os de agora e
 * os que chegarem). Os que outra pessoa travou um a um continuam com ela.
 */
export async function lockBookingType(
  user: User,
  rawType: string,
): Promise<BookingLock> {
  assertBooking(user);
  const itemType = cleanItemType(rawType);
  const { itemTypeKey } = await import("@/lib/booking-locks");
  const typeKey = itemTypeKey(itemType);
  if (!itemType || !typeKey) throw new BookingLotError("booking_type_required");
  const store = getStore();
  const locks = await withSchema(() => store.list("booking_locks"));
  const held = locks.find((l) => l.scope === "type" && l.typeKey === typeKey);
  if (held)
    throw new BookingLotError(
      held.userId === user.id ? "booking_lock_mine" : "booking_lock_taken",
    );
  const lock = await store.create("booking_locks", {
    scope: "type",
    lotId: null,
    typeKey,
    itemType,
    userId: user.id,
    lockedAt: new Date().toISOString(),
  });
  await audit(
    user,
    "booking_lock.lock",
    "booking_lock",
    lock.id,
    `Books do tipo "${itemType}" travados por ${user.name}`,
  );
  return lock;
}

/**
 * Libera a trava: o gestor de quem travou ou quem supervisiona os books
 * (nunca quem travou; dono, 24/11/2026). Sozinha, ela se libera quando o
 * book inteiro fica trabalhado (`releaseWhenWorkDone`).
 */
export async function unlockBooking(user: User, lockId: string): Promise<void> {
  assertBooking(user);
  const store = getStore();
  const lock = await withSchema(() => store.get("booking_locks", lockId));
  if (!lock) return;
  // Nunca quem travou: só o gestor dele ou quem supervisiona os books.
  if (!(await releaserOf(user, await store.list("users")))(lock.userId))
    throw new BookingLotError("booking_lock_release_manager");
  await store.remove("booking_locks", lock.id);
  const { durationText } = await import("@/lib/booking-locks");
  const held = durationText(minutesSince(lock.lockedAt));
  await audit(
    user,
    "booking_lock.unlock",
    lock.scope === "lot" ? "booking_lot" : "booking_lock",
    lock.lotId ?? lock.id,
    lock.scope === "lot"
      ? `Book liberado (estava com ${lock.userId} havia ${held})`
      : `Books do tipo "${lock.itemType}" liberados (estavam com ${lock.userId} havia ${held})`,
  );
}

/** As travas de um login, com quantos books cada uma segura agora. */
export async function myBookingLocks(user: User): Promise<
  Array<{
    lock: BookingLock;
    lotNumber: number | null;
    minutes: number;
    canRelease: boolean;
  }>
> {
  const locks = (await listBookingLocks()).filter((l) => l.userId === user.id);
  if (!locks.length) return [];
  const store = getStore();
  // As dele mesmo: só libera se também supervisiona os books.
  const canRelease = await canSuperviseBooks(user);
  const out = [];
  for (const lock of locks) {
    const lot = lock.lotId ? await store.get("booking_lots", lock.lotId) : null;
    out.push({
      lock,
      lotNumber: lot?.number ?? null,
      minutes: minutesSince(lock.lockedAt),
      canRelease,
    });
  }
  return out;
}

/* ------------------------------------------------------------------------ */
/* Fabricante: a Fábrica do book × a planilha (dono, 24/11/2026)             */
/* ------------------------------------------------------------------------ */

/** O Fabricante do book (a Fábrica digitada; sem ela, a do cadastro ou a da planilha). */
export async function lotManufacturer(lot: BookingLot): Promise<string | null> {
  const factory =
    !lot.supplierName?.trim() && lot.supplierId
      ? await getStore().get("parties", lot.supplierId)
      : null;
  return bookManufacturer(lot, factory?.name ?? null);
}

/** Os itens cuja linha da planilha traz outro fabricante, ainda sem confirmação. */
export async function manufacturerMismatches(
  lot: BookingLot,
  items: BookingItem[],
): Promise<BookingItem[]> {
  const name = await lotManufacturer(lot);
  return items.filter((i) => manufacturerMismatch(i, name));
}

async function clearManufacturerOk(lotId: string) {
  const store = getStore();
  const items = await store.list("booking_items", { filter: { lotId } });
  for (const item of items)
    if (item.manufacturerOkAt)
      await store.update("booking_items", item.id, {
        manufacturerOkAt: null,
        manufacturerOkByUserId: null,
      });
}

/**
 * "A planilha estava errada": confirma que vale o Fabricante da tela nas
 * linhas divergentes (uma, ou todas as do book com `itemId` nulo). Quem
 * chama conferiu o login e se o book aceita edição.
 */
export async function confirmManufacturerItems(
  user: User,
  lot: BookingLot,
  itemId: string | null,
): Promise<number> {
  const store = getStore();
  const items = await store.list("booking_items", {
    filter: { lotId: lot.id },
  });
  const wrong = (await manufacturerMismatches(lot, items)).filter(
    (i) => !itemId || i.id === itemId,
  );
  const at = new Date().toISOString();
  for (const item of wrong)
    await store.update("booking_items", item.id, {
      manufacturerOkAt: at,
      manufacturerOkByUserId: user.id,
    });
  if (wrong.length)
    await audit(
      user,
      "booking_item.manufacturer_ok",
      "booking_lot",
      lot.id,
      `Fabricante confirmado pela tela em ${wrong.length} item(ns): a planilha trazia ${[...new Set(wrong.map((i) => i.sheetSupplier))].join(", ")}`,
    );
  return wrong.length;
}

/**
 * Remove um item do book (a linha de outro fabricante, por exemplo). Quem
 * chama conferiu o login e se o book aceita edição. Um item já trabalhado
 * ou ligado a um produto não sai.
 */
export async function removeLotItem(
  user: User,
  lot: BookingLot,
  itemId: string,
): Promise<void> {
  const store = getStore();
  const item = await store.get("booking_items", itemId);
  if (!item || item.lotId !== lot.id) throw new BookingLotError("not_found");
  if (item.workedAt || item.productId)
    throw new BookingLotError("booking_item_in_use");
  await store.remove("booking_items", item.id);
  const left = await store.list("booking_items", { filter: { lotId: lot.id } });
  await store.update("booking_lots", lot.id, { itemCount: left.length });
  await audit(
    user,
    "booking_item.remove",
    "booking_lot",
    lot.id,
    `Item removido do book: ${item.factoryItemCode ?? item.description ?? item.id} (linha ${item.position + 1}${item.sheetSupplier ? `, fabricante da planilha ${item.sheetSupplier}` : ""})`,
  );
}

/** Wellmix, no rascunho: confirma o Fabricante da tela (um item ou todos). */
export async function confirmBookingManufacturer(
  user: User,
  lotId: string,
  itemId: string | null,
): Promise<number> {
  assertBooking(user);
  return confirmManufacturerItems(user, await editableLot(lotId), itemId);
}

/** Wellmix, no rascunho: remove um item do book. */
export async function removeBookingItem(
  user: User,
  lotId: string,
  itemId: string,
): Promise<void> {
  assertBooking(user);
  await removeLotItem(user, await editableLot(lotId), itemId);
}

/** Quem pode ser o Fornecedor de um book: os parceiros ativos, por nome. */
export async function bookingPartnerOptions(): Promise<
  Array<Pick<Party, "id" | "name" | "type" | "city">>
> {
  const rows = await getStore().list("parties", {
    filter: { type: [...BOOKING_PARTNER_TYPES] as never, active: true },
    orderBy: "name",
  });
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type,
    city: p.city ?? null,
  }));
}
