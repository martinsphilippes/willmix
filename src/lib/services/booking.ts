import "server-only";

import {
  getStore,
  type Booking,
  type BookingAnalysis,
  type BookingStatus,
  type Party,
  type Product,
  type PurchaseSheet,
  type Request,
  type User,
} from "@/lib/db";
import { ForbiddenError, isWellmix } from "@/lib/auth/permissions";
import { assertScreen, canOpen } from "@/lib/auth/screens";
import {
  BOOKING_BULK_MAX,
  BOOKING_EMPTY,
  BOOKING_REQUESTABLE,
  BOOKING_REQUEST_MAX,
  bookingMoveError,
  bookingMoveOptions,
  bookingStatusRequirementError,
  reservedQtyError,
  type BookingActor,
  type BookingErrorCode,
  type BookingRow,
} from "@/lib/booking";
import { estimatedGrossKg } from "@/lib/weights";
import { effectiveMoq } from "@/lib/moq";
import { boxCbm } from "@/lib/logistics/cbm";
import { superplanParams } from "@/lib/superplan";
import { getSettings } from "@/lib/settings";
import type { Translate } from "@/i18n";
import { audit } from "./audit";
import { isSchemaMissing } from "./packaging-brief";
import {
  productSheetDraft,
  sheetCurrency,
  withProductColumns,
} from "./product-sheet";
import { productThumbId } from "./product-list";

/*
 * Booking (docs/BOOKING.md): os produtos que chegaram pela ficha técnica,
 * antes de virar solicitação. Aqui: a lista da tela (uma linha por produto,
 * com os dados da ficha), as mudanças (etapa, cliente, quantidade reservada,
 * responsável, observação), a análise do Superplan e o "Gerar solicitação".
 *
 * Só a Wellmix com a tela Booking. As regras (quem move o quê, o que cada
 * etapa exige) são as de src/lib/booking.ts; aqui elas são conferidas de novo
 * a cada gravação. Mudança em várias linhas é tudo ou nada: primeiro confere
 * todas, depois grava; a recusa diz qual linha.
 */

/** Recusa com a linha que a causou (a tela destaca a linha). */
export class BookingRefusal extends Error {
  constructor(
    code: BookingErrorCode,
    readonly bookingId: string | null = null,
  ) {
    super(code);
  }
}

const refuse = (code: BookingErrorCode, bookingId?: string | null) =>
  new BookingRefusal(code, bookingId ?? null);

/** Etapas em português, para o histórico (auditoria). */
const STATUS_PT: Record<BookingStatus, string> = {
  new: "Novo",
  analysis: "Em análise",
  approved: "Aprovado",
  offered: "Oferecido ao cliente",
  reserved: "Reservado pelo cliente",
  requested: "Virou solicitação",
  discarded: "Descartado",
};

/** Opção "Estoque Wellmix" (compra para estoque, sem cliente). */
export const BOOKING_STOCK_OPTION = "__stock";

function assertBookingUser(user: User) {
  if (!isWellmix(user)) throw new ForbiddenError();
  assertScreen(user, "booking");
}

/** Quem analisa: abre a tela Superplan (aprova, tira da vitrine, reabre). */
export const bookingActor = (user: User): BookingActor => ({
  canApprove: canOpen(user, "superplan"),
});

const distinct = <T>(values: T[]) => [...new Set(values)];

/* ------------------------------------------------------------------------ */
/* Leitura: as linhas da tela                                                */
/* ------------------------------------------------------------------------ */

export interface BookingOption {
  id: string;
  label: string;
}

export interface BookingOptions {
  suppliers: BookingOption[];
  /** Clientes ativos (e os que já estão em alguma linha). */
  customers: BookingOption[];
  /** Logins ativos da Wellmix. */
  owners: BookingOption[];
  /** Planilhas (lotes de importação) que têm linha no Booking. */
  sources: BookingOption[];
  currencies: string[];
  /** A empresa de estoque ainda não existe: oferecer "Estoque Wellmix". */
  stockOption: boolean;
}

export interface BookingListData {
  rows: BookingRow[];
  options: BookingOptions;
  /** Quem vê pode aprovar, analisar e ver as colunas do Superplan. */
  canApprove: boolean;
  /** Tabela `bookings` ainda não publicada no Appwrite. */
  schemaMissing: boolean;
  /** Folga usada no peso estimado (%). */
  allowancePct: number;
}

interface Joined {
  products: Map<string, Product>;
  sheets: Map<string, PurchaseSheet>;
  moq: Map<string, number | null>;
}

/** Produtos e fichas mestre das linhas, em duas leituras. */
async function joinProducts(productIds: string[]): Promise<Joined> {
  const ids = distinct(productIds.filter(Boolean));
  const out: Joined = {
    products: new Map(),
    sheets: new Map(),
    moq: new Map(),
  };
  if (!ids.length) return out;
  const store = getStore();
  const [products, sheets] = await Promise.all([
    store.list("products", { filter: { id: ids } }),
    store.list("purchase_sheets", { filter: { orderId: ids } }),
  ]);
  for (const p of products) out.products.set(p.id, p);
  for (const s of sheets) out.sheets.set(s.orderId, s);
  for (const id of ids) {
    const product = out.products.get(id);
    out.moq.set(
      id,
      product ? effectiveMoq(null, out.sheets.get(id)?.moq, product.moq) : null,
    );
  }
  return out;
}

const text = (v: string | null | undefined) => {
  const s = (v ?? "").trim();
  return s ? s : null;
};
const positive = (n: number | null | undefined) =>
  typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null;

/** Medidas da peça ("33,5 × 24,8 × 1,5 cm"), no formato de quem vê. */
function sizeText(product: Product, intl: string): string | null {
  const dims = [product.lengthCm, product.widthCm, product.heightCm];
  if (dims.some((d) => positive(d) === null)) return null;
  return `${dims
    .map((d) =>
      (d as number).toLocaleString(intl, { maximumFractionDigits: 2 }),
    )
    .join(" × ")} cm`;
}

function rowOf(
  booking: Booking,
  ctx: {
    joined: Joined;
    parties: Map<string, Party>;
    users: Map<string, User>;
    photos: Parameters<typeof productThumbId>[1];
    canApprove: boolean;
    allowancePct: number;
    intl: string;
  },
): BookingRow {
  const product = ctx.joined.products.get(booking.productId) ?? null;
  const supplier = product?.supplierId
    ? (ctx.parties.get(product.supplierId) ?? null)
    : null;
  // Ficha mestre com o que falta completado pelas colunas do produto.
  const master: Partial<PurchaseSheet> = product
    ? withProductColumns(
        (ctx.joined.sheets.get(product.id) ?? {}) as Partial<PurchaseSheet>,
        productSheetDraft(product, supplier),
      )
    : {};
  const net = positive(master.netWeightPcKg);
  const gross = positive(master.grossWeightPcKg);
  const estimate = estimatedGrossKg(net, gross, ctx.allowancePct);
  const customer = booking.customerId
    ? (ctx.parties.get(booking.customerId) ?? null)
    : null;
  const owner = booking.ownerUserId
    ? (ctx.users.get(booking.ownerUserId) ?? null)
    : null;
  const currency =
    master.currency ??
    sheetCurrency(product?.currency) ??
    text(product?.currency)?.toUpperCase() ??
    null;
  return {
    id: booking.id,
    productId: booking.productId,
    status: booking.status,
    statusChangedAt: booking.statusChangedAt,
    photoDocumentId: product ? productThumbId(product, ctx.photos) : null,
    code: text(master.factoryItemCode) ?? text(product?.supplierSku),
    sku: text(product?.sku),
    name: product?.name ?? "",
    productMissing: !product || !product.active,
    supplierId: product?.supplierId ?? null,
    supplierName: supplier?.name ?? text(master.supplierName),
    supplierStore: text(master.supplierStore) ?? text(supplier?.storeNumber),
    location: text(master.location),
    sheetDate: master.sheetDate ?? null,
    incoterm: master.incoterm ?? null,
    price: positive(master.price) ?? positive(product?.price),
    currency,
    moq: ctx.joined.moq.get(booking.productId) ?? null,
    masterQty: positive(master.masterCartonQty),
    innerQty: positive(master.innerQty),
    netWeightKg: net,
    grossWeightKg: gross,
    estimatedWeightKg: estimate.kg,
    weightEstimated: estimate.estimated,
    averageUsd: positive(master.averagePrice),
    cbm: positive(master.cbmPerCarton) ?? (product ? boxCbm(product) : null),
    size: product ? sizeText(product, ctx.intl) : null,
    colors: text(master.colorAssortment) ?? text(product?.color),
    material: text(master.material) ?? text(product?.material),
    packageType: text(master.packageType),
    ncm: text(product?.ncm) ?? text(master.ncm),
    customerId: booking.customerId,
    customerName: customer?.name ?? null,
    reservedQty: booking.reservedQty,
    // A análise (custo, preço, lucro) só sai do servidor para quem analisa.
    analysis: ctx.canApprove ? (booking.analysis ?? null) : null,
    ownerUserId: booking.ownerUserId,
    ownerName: owner?.name ?? null,
    enteredAt: booking.createdAt,
    importBatchId: booking.importBatchId,
    sourceFileName: booking.sourceFileName,
    sourceRows: booking.sourceRows,
    sourceOrder: booking.sourceOrder,
    note: booking.note,
    requestId: booking.requestId,
    requestGroupId: booking.requestGroupId,
    requestNumber: booking.requestNumber,
  };
}

const byLabel = (a: BookingOption, b: BookingOption) =>
  a.label.localeCompare(b.label, undefined, { numeric: true });

async function buildRows(
  user: User,
  bookings: Booking[],
  intl: string,
): Promise<Omit<BookingListData, "schemaMissing">> {
  const store = getStore();
  const canApprove = canOpen(user, "superplan");
  const productIds = bookings.map((b) => b.productId);
  const [joined, suppliers, customers, users, settings] = await Promise.all([
    joinProducts(productIds),
    store.list("parties", { filter: { type: "supplier" } }),
    store.list("parties", { filter: { type: "customer" } }),
    store.list("users", { filter: { role: ["admin", "operator"] } }),
    getSettings(),
  ]);
  // Fotos só de quem não tem a foto principal gravada no produto.
  const needPhoto = [...joined.products.values()]
    .filter((p) => !p.primaryPhotoDocumentId)
    .map((p) => p.id);
  const photos = needPhoto.length
    ? await store.list("product_photos", { filter: { productId: needPhoto } })
    : [];
  const parties = new Map<string, Party>(
    [...suppliers, ...customers].map((p) => [p.id, p]),
  );
  const userMap = new Map(users.map((u) => [u.id, u]));
  const allowancePct = superplanParams(settings.superplan).grossEstimatePct;
  const rows = bookings.map((booking) =>
    rowOf(booking, {
      joined,
      parties,
      users: userMap,
      photos,
      canApprove,
      allowancePct,
      intl,
    }),
  );

  const usedCustomers = new Set(rows.map((r) => r.customerId));
  const usedOwners = new Set(rows.map((r) => r.ownerUserId));
  const sources = new Map<string, BookingOption>();
  for (const r of rows)
    if (r.importBatchId && !sources.has(r.importBatchId))
      sources.set(r.importBatchId, {
        id: r.importBatchId,
        label: r.sourceFileName ?? r.importBatchId,
      });
  const { STOCK_PARTY_ID } = await import("./purchase-flow");
  return {
    rows,
    canApprove,
    allowancePct,
    options: {
      suppliers: distinct(rows.map((r) => r.supplierId))
        .filter((id): id is string => !!id)
        .map((id) => ({ id, label: parties.get(id)?.name ?? id }))
        .sort(byLabel),
      customers: customers
        .filter((c) => c.active || usedCustomers.has(c.id))
        .map((c) => ({ id: c.id, label: c.name }))
        .sort(byLabel),
      owners: users
        .filter((u) => u.active || usedOwners.has(u.id))
        .map((u) => ({ id: u.id, label: u.name }))
        .sort(byLabel),
      sources: [...sources.values()].sort(byLabel),
      currencies: distinct(rows.map((r) => r.currency))
        .filter((c): c is string => !!c)
        .sort(),
      stockOption: !customers.some((c) => c.id === STOCK_PARTY_ID),
    },
  };
}

/** Todas as linhas do Booking (a tela filtra, ordena e pagina). */
export async function listBookingRows(
  user: User,
  options: { intl?: string } = {},
): Promise<BookingListData> {
  assertBookingUser(user);
  let bookings: Booking[];
  let schemaMissing = false;
  try {
    bookings = await getStore().list("bookings");
  } catch (error) {
    if (!isSchemaMissing(error)) throw error;
    bookings = [];
    schemaMissing = true;
  }
  return {
    ...(await buildRows(user, bookings, options.intl ?? "pt-BR")),
    schemaMissing,
  };
}

export interface BookingHistoryEntry {
  id: string;
  at: string;
  userName: string | null;
  action: string;
  summary: string;
}

export interface BookingDetail {
  row: BookingRow;
  /** Etapas para as quais quem vê pode mover esta linha. */
  moveOptions: BookingStatus[];
  history: BookingHistoryEntry[];
  options: BookingOptions;
  canApprove: boolean;
  allowancePct: number;
}

/** Uma linha, com o histórico. Nulo: não existe (ou a tabela não foi publicada). */
export async function getBookingDetail(
  user: User,
  id: string,
  options: { intl?: string } = {},
): Promise<BookingDetail | null> {
  assertBookingUser(user);
  const store = getStore();
  const booking = await store.get("bookings", id);
  if (!booking) return null;
  const [built, log] = await Promise.all([
    buildRows(user, [booking], options.intl ?? "pt-BR"),
    store.list("audit_log", {
      filter: { entity: "booking", entityId: id },
      orderBy: "createdAt",
      direction: "desc",
      limit: 60,
    }),
  ]);
  const userIds = distinct(
    log.map((l) => l.userId).filter((u): u is string => !!u),
  );
  const users = userIds.length
    ? await store.list("users", { filter: { id: userIds } })
    : [];
  const names = new Map(users.map((u) => [u.id, u.name]));
  return {
    row: built.rows[0],
    moveOptions: bookingMoveOptions(booking.status, bookingActor(user)),
    history: log.map((l) => ({
      id: l.id,
      at: l.createdAt,
      userName: l.userId ? (names.get(l.userId) ?? null) : null,
      action: l.action,
      summary: l.summary,
    })),
    options: built.options,
    canApprove: built.canApprove,
    allowancePct: built.allowancePct,
  };
}

/* ------------------------------------------------------------------------ */
/* Escrita                                                                   */
/* ------------------------------------------------------------------------ */

export interface BookingPatch {
  status?: BookingStatus;
  /** null tira o cliente. */
  customerId?: string | null;
  /** null tira a quantidade. */
  reservedQty?: number | null;
  ownerUserId?: string | null;
  note?: string | null;
}

type BookingWrite = Partial<
  Pick<
    Booking,
    | "status"
    | "customerId"
    | "reservedQty"
    | "ownerUserId"
    | "note"
    | "requestId"
    | "requestGroupId"
    | "requestNumber"
    | "statusChangedAt"
    | "statusChangedByUserId"
  >
>;

interface Planned {
  booking: Booking;
  write: BookingWrite;
  moved: boolean;
}

/**
 * Confere a mudança de uma linha contra as regras e devolve o que gravar
 * (nulo: nada muda). Não grava.
 */
function plan(
  booking: Booking,
  patch: BookingPatch,
  moq: number | null,
  actor: BookingActor,
  user: User,
): Planned | null {
  const status = patch.status ?? booking.status;
  const moved = status !== booking.status;
  if (moved) {
    const error = bookingMoveError(booking.status, status, actor);
    if (error) throw refuse(error, booking.id);
  }
  const customerId =
    patch.customerId !== undefined ? patch.customerId : booking.customerId;
  const reservedQty =
    patch.reservedQty !== undefined ? patch.reservedQty : booking.reservedQty;
  const customerChanged = customerId !== booking.customerId;
  const qtyChanged = reservedQty !== booking.reservedQty;
  // Já virou solicitação: cliente e quantidade são os da solicitação.
  if (
    booking.status === "requested" &&
    !moved &&
    (customerChanged || qtyChanged)
  )
    throw refuse("booking_locked", booking.id);
  if (qtyChanged) {
    const error = reservedQtyError(reservedQty, moq);
    if (error) throw refuse(error, booking.id);
  }
  if (moved || customerChanged || qtyChanged) {
    const error = bookingStatusRequirementError(status, {
      customerId,
      reservedQty,
      moq,
    });
    if (error) throw refuse(error, booking.id);
  }
  const note =
    patch.note !== undefined ? (text(patch.note) ?? null) : booking.note;
  if (note && note.length > 500)
    throw refuse("booking_note_too_long", booking.id);
  const ownerUserId =
    patch.ownerUserId !== undefined ? patch.ownerUserId : booking.ownerUserId;

  const write: BookingWrite = {};
  if (moved) {
    write.status = status;
    write.statusChangedAt = new Date().toISOString();
    write.statusChangedByUserId = user.id;
    // Reaberta: a ligação com a solicitação antiga sai (fica no histórico).
    if (booking.status === "requested") {
      write.requestId = null;
      write.requestGroupId = null;
      write.requestNumber = null;
    }
  }
  if (customerChanged) write.customerId = customerId;
  if (qtyChanged) write.reservedQty = reservedQty;
  if (ownerUserId !== booking.ownerUserId) write.ownerUserId = ownerUserId;
  if (note !== booking.note) write.note = note;
  return Object.keys(write).length ? { booking, write, moved } : null;
}

async function commit(
  user: User,
  planned: Planned,
  productName: string,
): Promise<Booking> {
  const { booking, write, moved } = planned;
  const before: Record<string, unknown> = {};
  for (const key of Object.keys(write) as (keyof BookingWrite)[])
    before[key] = booking[key];
  const saved = await getStore().update("bookings", booking.id, write);
  const what = moved
    ? `etapa ${STATUS_PT[booking.status]} → ${STATUS_PT[saved.status]}`
    : [
        "customerId" in write ? "cliente" : null,
        "reservedQty" in write ? "quantidade reservada" : null,
        "ownerUserId" in write ? "responsável" : null,
        "note" in write ? "observação" : null,
      ]
        .filter(Boolean)
        .join(", ");
  await audit(
    user,
    moved ? "booking.move" : "booking.update",
    "booking",
    booking.id,
    `Booking: ${productName || booking.productId}: ${what}`,
    before,
    write,
  );
  return saved;
}

/**
 * Oferecer ou reservar: o cliente da linha (o de agora ou o que já estava
 * nela) precisa continuar sendo uma empresa cliente ativa.
 */
async function assertRowCustomers(planned: Planned[]): Promise<void> {
  const customerOf = (p: Planned) =>
    "customerId" in p.write ? p.write.customerId : p.booking.customerId;
  const need = planned.filter(
    (p) =>
      p.moved &&
      (p.write.status === "offered" || p.write.status === "reserved"),
  );
  const ids = distinct(need.map(customerOf).filter((id): id is string => !!id));
  if (!ids.length) return;
  const parties = await getStore().list("parties", { filter: { id: ids } });
  const active = new Set(
    parties.filter((p) => p.type === "customer" && p.active).map((p) => p.id),
  );
  for (const p of need) {
    const id = customerOf(p);
    if (id && !active.has(id))
      throw refuse("booking_customer_invalid", p.booking.id);
  }
}

/** Cliente escolhido: empresa cliente ativa (ou a de estoque). */
async function resolveCustomer(
  user: User,
  raw: string,
  bookingId?: string | null,
): Promise<string> {
  if (raw === BOOKING_STOCK_OPTION) {
    const { ensureStockParty } = await import("./purchase-flow");
    return (await ensureStockParty(user)).id;
  }
  const party = await getStore().get("parties", raw);
  if (!party || party.type !== "customer" || !party.active)
    throw refuse("booking_customer_invalid", bookingId);
  return party.id;
}

async function resolveOwner(
  raw: string,
  bookingId?: string | null,
): Promise<string> {
  const owner = await getStore().get("users", raw);
  if (!owner || !owner.active || !isWellmix(owner))
    throw refuse("booking_owner_invalid", bookingId);
  return owner.id;
}

/** As linhas marcadas, na ordem pedida. Falta alguma: recusa. */
async function loadBookings(
  ids: string[],
  max: number,
  tooMany: BookingErrorCode = "booking_too_many",
): Promise<Booking[]> {
  const unique = distinct(ids);
  if (!unique.length) throw refuse("booking_none_selected");
  if (unique.length > max) throw refuse(tooMany);
  const rows = await getStore().list("bookings", { filter: { id: unique } });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return unique.map((id) => {
    const row = byId.get(id);
    if (!row) throw refuse("booking_not_found", id);
    return row;
  });
}

/** Salvar uma linha (página da linha). */
export async function saveBookingRow(
  user: User,
  id: string,
  patch: BookingPatch,
): Promise<Booking> {
  assertBookingUser(user);
  const booking = await getStore().get("bookings", id);
  if (!booking) throw refuse("booking_not_found", id);
  const resolved: BookingPatch = { ...patch };
  if (typeof patch.customerId === "string" && patch.customerId)
    resolved.customerId =
      patch.customerId === booking.customerId
        ? booking.customerId
        : await resolveCustomer(user, patch.customerId, id);
  else if (patch.customerId !== undefined) resolved.customerId = null;
  if (typeof patch.ownerUserId === "string" && patch.ownerUserId)
    resolved.ownerUserId =
      patch.ownerUserId === booking.ownerUserId
        ? booking.ownerUserId
        : await resolveOwner(patch.ownerUserId, id);
  else if (patch.ownerUserId !== undefined) resolved.ownerUserId = null;
  const joined = await joinProducts([booking.productId]);
  const planned = plan(
    booking,
    resolved,
    joined.moq.get(booking.productId) ?? null,
    bookingActor(user),
    user,
  );
  if (!planned) return booking;
  await assertRowCustomers([planned]);
  return commit(
    user,
    planned,
    joined.products.get(booking.productId)?.name ?? "",
  );
}

export interface BookingBulkInput {
  ids: string[];
  /**
   * Cliente escolhido na barra: vazio não mexe; "-" tira; "__stock" é a
   * empresa de estoque.
   */
  customer?: string;
  /** Quantidades digitadas nas linhas marcadas (id da linha → peças). */
  quantities?: Record<string, number>;
}

/** Aplica a mesma mudança a várias linhas: confere todas, depois grava. */
async function applyBulk(
  user: User,
  input: BookingBulkInput,
  extra: (booking: Booking) => BookingPatch,
): Promise<number> {
  assertBookingUser(user);
  const bookings = await loadBookings(input.ids, BOOKING_BULK_MAX);
  const customer = (input.customer ?? "").trim();
  const customerId =
    customer === ""
      ? undefined
      : customer === BOOKING_EMPTY
        ? null
        : await resolveCustomer(user, customer);
  const joined = await joinProducts(bookings.map((b) => b.productId));
  const actor = bookingActor(user);
  const planned: Planned[] = [];
  for (const booking of bookings) {
    const typed = input.quantities?.[booking.id];
    const p = plan(
      booking,
      {
        ...(customerId !== undefined ? { customerId } : {}),
        ...(typed !== undefined ? { reservedQty: typed } : {}),
        ...extra(booking),
      },
      joined.moq.get(booking.productId) ?? null,
      actor,
      user,
    );
    if (p) planned.push(p);
  }
  await assertRowCustomers(planned);
  for (const p of planned)
    await commit(user, p, joined.products.get(p.booking.productId)?.name ?? "");
  return planned.length;
}

/** Mover várias linhas de etapa (com o cliente e as quantidades informados). */
export function moveBookings(
  user: User,
  input: BookingBulkInput & { status: BookingStatus },
): Promise<number> {
  return applyBulk(user, input, () => ({ status: input.status }));
}

/** Gravar cliente e quantidades reservadas de várias linhas, sem mover. */
export function assignBookings(
  user: User,
  input: BookingBulkInput,
): Promise<number> {
  return applyBulk(user, input, () => ({}));
}

/** Trocar o responsável de várias linhas (vazio tira). */
export async function setBookingsOwner(
  user: User,
  ids: string[],
  ownerUserId: string | null,
): Promise<number> {
  assertBookingUser(user);
  const owner = ownerUserId ? await resolveOwner(ownerUserId) : null;
  return applyBulk(user, { ids }, () => ({ ownerUserId: owner }));
}

/* ------------------------------------------------------------------------ */
/* Análise do Superplan                                                      */
/* ------------------------------------------------------------------------ */

/** O retrato que o Superplan devolve (sem quem e quando). */
export type BookingSnapshot = Omit<BookingAnalysis, "at" | "byUserId">;

function assertAnalyst(user: User) {
  assertBookingUser(user);
  if (!canOpen(user, "superplan")) throw refuse("booking_analysis_forbidden");
}

async function storeAnalysis(
  user: User,
  booking: Booking,
  snapshot: BookingSnapshot,
  productName: string,
): Promise<Booking> {
  const now = new Date().toISOString();
  const analysis: BookingAnalysis = { ...snapshot, at: now, byUserId: user.id };
  // Analisar uma linha nova já a leva para "Em análise".
  const toAnalysis = booking.status === "new";
  const saved = await getStore().update("bookings", booking.id, {
    analysis,
    ...(toAnalysis
      ? {
          status: "analysis" as const,
          statusChangedAt: now,
          statusChangedByUserId: user.id,
        }
      : {}),
  });
  await audit(
    user,
    "booking.analysis",
    "booking",
    booking.id,
    `Booking: ${productName || booking.productId}: análise do Superplan gravada${
      toAnalysis ? " (Novo → Em análise)" : ""
    }`,
    /*
     * Sem custo, preço nem lucro: a tela Auditoria é aberta por quem não abre
     * o Superplan. Fica só o que a lista do Booking já mostra a todos (a
     * etapa) e o sinal; o retrato inteiro mora na linha, para quem analisa.
     */
    {
      status: booking.status,
      verdict: booking.analysis?.verdict ?? null,
      analyzedAt: booking.analysis?.at ?? null,
    },
    { status: saved.status, verdict: analysis.verdict, analyzedAt: now },
  );
  return saved;
}

/**
 * "Analisar no Superplan" em várias linhas, com os valores padrão (câmbio do
 * dia, container e tipo de negócio padrão, II/IPI do NCM). Linha cujo
 * produto saiu do cadastro fica de fora (`skipped`).
 */
export async function analyzeBookings(
  user: User,
  ids: string[],
): Promise<{ analyzed: number; skipped: number }> {
  assertAnalyst(user);
  const bookings = await loadBookings(ids, BOOKING_BULK_MAX);
  const { analyzeProductsWithDefaults } = await import("./superplan-analysis");
  const [snapshots, joined] = await Promise.all([
    analyzeProductsWithDefaults(distinct(bookings.map((b) => b.productId))),
    joinProducts(bookings.map((b) => b.productId)),
  ]);
  let analyzed = 0;
  for (const booking of bookings) {
    const snapshot = snapshots.get(booking.productId);
    if (!snapshot) continue;
    await storeAnalysis(
      user,
      booking,
      snapshot,
      joined.products.get(booking.productId)?.name ?? "",
    );
    analyzed++;
  }
  return { analyzed, skipped: bookings.length - analyzed };
}

/** "Gravar no Booking" a partir da simulação aberta no Superplan. */
export async function saveBookingAnalysis(
  user: User,
  id: string,
  snapshot: BookingSnapshot,
): Promise<Booking> {
  assertAnalyst(user);
  const booking = await getStore().get("bookings", id);
  if (!booking) throw refuse("booking_not_found", id);
  const product = await getStore().get("products", booking.productId);
  return storeAnalysis(user, booking, snapshot, product?.name ?? "");
}

/* ------------------------------------------------------------------------ */
/* Gerar solicitação                                                         */
/* ------------------------------------------------------------------------ */

let lastClaim = 0;
/**
 * Carimbo de quem toma as linhas para gerar a solicitação: a hora, nunca
 * repetida neste servidor (duas chamadas no mesmo milissegundo ganham
 * carimbos diferentes).
 */
function claimStamp(): string {
  lastClaim = Math.max(Date.now(), lastClaim + 1);
  return new Date(lastClaim).toISOString();
}

/**
 * As linhas marcadas viram uma solicitação (um lote, uma por produto) do
 * cliente escolhido. Só linhas em Aprovado, Oferecido ou Reservado; linha
 * reservada para outro cliente recusa tudo (nada é criado). Quantidade: a
 * digitada na linha, senão a reservada, senão o pedido mínimo do produto.
 * Depois, as linhas vão para "Virou solicitação" com o número dela.
 */
export async function generateRequestFromBooking(
  user: User,
  input: BookingBulkInput,
  t: Translate,
): Promise<Request[]> {
  assertBookingUser(user);
  // A solicitação nasce aqui: é preciso abrir também a tela Solicitações.
  assertScreen(user, "requests");
  const bookings = await loadBookings(
    input.ids,
    BOOKING_REQUEST_MAX,
    "booking_request_too_many",
  );
  for (const booking of bookings)
    if (!BOOKING_REQUESTABLE.includes(booking.status))
      throw refuse("booking_not_requestable", booking.id);

  // Cliente: o escolhido na barra; sem escolha, o das linhas (se for um só).
  const chosen = (input.customer ?? "").trim();
  let customerId: string;
  if (chosen && chosen !== BOOKING_EMPTY) {
    customerId = await resolveCustomer(user, chosen);
  } else {
    const own = distinct(bookings.map((b) => b.customerId));
    if (own.length !== 1 || !own[0]) throw refuse("booking_customer_required");
    customerId = await resolveCustomer(user, own[0]);
  }
  for (const booking of bookings)
    if (booking.customerId && booking.customerId !== customerId)
      throw refuse("booking_customer_mismatch", booking.id);

  const joined = await joinProducts(bookings.map((b) => b.productId));
  const { variantsByProduct } = await import("./product-variants");
  const { specificationLines } = await import("./catalog-explore");
  const variants = await variantsByProduct([...joined.products.keys()]);

  const lines = bookings.map((booking) => {
    const product = joined.products.get(booking.productId);
    if (!product || !product.active)
      throw refuse("booking_product_missing", booking.id);
    // Produto com variações: a solicitação precisa da variação escolhida.
    if ((variants.get(product.id) ?? []).some((v) => v.active !== false))
      throw refuse("booking_variant_required", booking.id);
    const moq = joined.moq.get(product.id) ?? null;
    const quantity =
      input.quantities?.[booking.id] ?? booking.reservedQty ?? moq ?? null;
    if (quantity === null) throw refuse("booking_qty_missing", booking.id);
    const error = reservedQtyError(quantity, moq);
    if (error) throw refuse(error, booking.id);
    return { booking, product, quantity };
  });

  /*
   * As linhas são tomadas ANTES de qualquer solicitação nascer: cada uma vai
   * para "Virou solicitação" com um carimbo desta chamada e é relida. Quem
   * chegou junto (outra aba, outro login) vê a linha já tomada e é recusado,
   * em vez de as duas chamadas criarem a mesma solicitação. Se a criação
   * falhar, as linhas voltam para onde estavam.
   */
  const store = getStore();
  const stamp = claimStamp();
  const mine = (b: Booking) =>
    b.status === "requested" &&
    b.statusChangedByUserId === user.id &&
    Date.parse(b.statusChangedAt ?? "") === Date.parse(stamp);
  const release = async (only?: Set<string>) => {
    for (const { booking } of lines) {
      if (only && !only.has(booking.id)) continue;
      try {
        await store.update("bookings", booking.id, {
          status: booking.status,
          statusChangedAt: booking.statusChangedAt,
          statusChangedByUserId: booking.statusChangedByUserId,
        });
      } catch (error) {
        console.error("[booking] devolver a linha falhou", booking.id, error);
      }
    }
  };
  // Releitura na hora de tomar: quem já foi tomado por outra chamada (ou
  // mudou de etapa) enquanto esta conferia as linhas recusa aqui.
  const fresh = await store.list("bookings", {
    filter: { id: lines.map((l) => l.booking.id) },
  });
  for (const { booking } of lines) {
    const now = fresh.find((f) => f.id === booking.id);
    if (!now || now.status !== booking.status)
      throw refuse("booking_not_requestable", booking.id);
  }
  const taken = new Set<string>();
  try {
    for (const { booking } of lines) {
      await store.update("bookings", booking.id, {
        status: "requested",
        statusChangedAt: stamp,
        statusChangedByUserId: user.id,
      });
      taken.add(booking.id);
    }
  } catch (error) {
    await release(taken);
    throw error;
  }
  const claimed = await store.list("bookings", {
    filter: { id: lines.map((l) => l.booking.id) },
  });
  const lost = lines.find(({ booking }) => {
    const now = claimed.find((c) => c.id === booking.id);
    return !now || !mine(now);
  });
  if (lost) {
    // Só as que ainda são desta chamada voltam; a outra chamada cuida das dela.
    await release(new Set(claimed.filter(mine).map((c) => c.id)));
    throw refuse("booking_not_requestable", lost.booking.id);
  }

  const { createRequestBatch } = await import("./requests");
  let created: Request[];
  try {
    created = await createRequestBatch(
      user,
      { customerId, deadline: null, notes: null, requestedForUserId: null },
      lines.map(({ product, quantity }) => {
        const spec = [
          product.category
            ? `${t("catalog.category")}: ${product.category}`
            : null,
          ...specificationLines(product, t),
        ].filter((l): l is string => !!l);
        return {
          productId: product.id,
          productName: product.name.slice(0, 160),
          description: `${product.name}${product.category ? ` — ${product.category}` : ""}`,
          specification: spec.length ? spec.join("\n") : null,
          quantity,
          unit: "un",
          sourcingDemand: false,
        };
      }),
    );
  } catch (error) {
    // Nada nasceu (o lote desfaz o que criou): as linhas voltam.
    await release();
    throw error;
  }

  // A solicitação existe e a linha já está tomada: falta só a ligação. Uma
  // falha aqui não desfaz nada nem deixa criar de novo; fica no log.
  for (const [i, { booking, product, quantity }] of lines.entries()) {
    const request = created[i];
    if (!request) continue;
    const write = {
      customerId,
      reservedQty: quantity,
      requestId: request.id,
      requestGroupId: request.groupId ?? null,
      requestNumber: request.number ?? null,
    };
    try {
      try {
        await store.update("bookings", booking.id, write);
      } catch {
        await store.update("bookings", booking.id, write);
      }
      await audit(
        user,
        "booking.request",
        "booking",
        booking.id,
        `Booking: ${product.name}: virou a solicitação${
          request.number ? ` #${request.number}` : ""
        } (${quantity} peças)`,
        {
          status: booking.status,
          customerId: booking.customerId,
          reservedQty: booking.reservedQty,
        },
        { status: "requested", ...write },
      );
    } catch (error) {
      console.error(
        "[booking] ligação com a solicitação falhou",
        booking.id,
        request.id,
        error,
      );
    }
  }
  return created;
}
