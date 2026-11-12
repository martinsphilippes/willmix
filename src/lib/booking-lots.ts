import {
  SHEET_CURRENCIES,
  SHEET_INCOTERMS,
  type BookingItem,
  type BookingLot,
  type BookingLotStatus,
  type Party,
} from "@/lib/db/schema";
import { parseNumberInput } from "@/lib/number-input";

/*
 * Booking por planilha (docs/BOOKING.md, "Booking por planilha"): regras
 * puras, sem banco. O booking é a planilha de um fornecedor; os itens são as
 * linhas dela e não são produtos do cadastro.
 */

/** Campos do item que o booking exige para fechar (os com * na planilha). */
export const BOOKING_ITEM_REQUIRED = [
  "incoterm",
  "currency",
  "price",
  "masterCartonQty",
  "innerQty",
  "netWeightPcKg",
  "grossWeightPcKg",
  "cbmPerCarton",
  "lengthCm",
  "widthCm",
  "heightCm",
  "capacityMl",
  "packageType",
  "material",
  "moq",
  // NCM: por aproximação com o cadastro ou preenchido pelo despachante.
  "ncm",
] as const satisfies readonly (keyof BookingItem)[];
export type BookingItemRequiredField = (typeof BOOKING_ITEM_REQUIRED)[number];

const TEXT_FIELDS = {
  itemNumber: 40,
  factoryItemCode: 60,
  productName: 160,
  description: 2000,
  packageType: 120,
  material: 200,
  colorAssortment: 200,
  powerDetail: 60,
  purchaseSchedule: 80,
  departureIntervalDays: 40,
} as const;
const INT_FIELDS = [
  "masterCartonQty",
  "innerQty",
  "moq",
  "purchaseQty",
  "plannedQty",
] as const;
/** Campos decimais do item (os demais números são inteiros). */
export const DECIMAL_FIELDS = [
  "price",
  "netWeightPcKg",
  "grossWeightPcKg",
  "cbmPerCarton",
  "lengthCm",
  "widthCm",
  "heightCm",
  "capacityMl",
] as const;

type TextField = keyof typeof TEXT_FIELDS;
type IntField = (typeof INT_FIELDS)[number];
type DecimalField = (typeof DECIMAL_FIELDS)[number];

/** Campos do item que a tela edita, na ordem da planilha do booking. */
export const BOOKING_ITEM_FIELDS = [
  "itemNumber",
  "factoryItemCode",
  "description",
  "incoterm",
  "currency",
  "price",
  "masterCartonQty",
  "innerQty",
  "netWeightPcKg",
  "grossWeightPcKg",
  "cbmPerCarton",
  "lengthCm",
  "widthCm",
  "heightCm",
  "capacityMl",
  "packageType",
  "material",
  "moq",
  "productName",
  "colorAssortment",
  "powerDetail",
  "purchaseSchedule",
  "departureIntervalDays",
  "purchaseQty",
  "plannedQty",
] as const satisfies readonly (
  TextField | IntField | DecimalField | "incoterm" | "currency"
)[];
export type BookingItemField = (typeof BOOKING_ITEM_FIELDS)[number];

export const isBookingItemField = (f: string): f is BookingItemField =>
  (BOOKING_ITEM_FIELDS as readonly string[]).includes(f);

export const isRequiredItemField = (f: string) =>
  (BOOKING_ITEM_REQUIRED as readonly string[]).includes(f);

/** Como o campo do item é digitado na tela: texto, número ou uma das listas. */
export const bookingItemFieldKind = (
  field: BookingItemField,
): "text" | "number" | "incoterm" | "currency" =>
  field === "incoterm"
    ? "incoterm"
    : field === "currency"
      ? "currency"
      : (INT_FIELDS as readonly string[]).includes(field) ||
          (DECIMAL_FIELDS as readonly string[]).includes(field)
        ? "number"
        : "text";

/** Teto dos números do item (peças e medidas absurdas são recusadas). */
const MAX_NUMBER = 1e9;

export class BookingItemValueError extends Error {
  constructor() {
    super("booking_item_invalid");
  }
}

/**
 * Valor digitado → valor do item. Vazio apaga (null). Número que não dá para
 * ler, zero ou negativo, ou incoterm/moeda fora da lista: recusa.
 */
export function readBookingItemValue(
  field: BookingItemField,
  raw: string,
): string | number | null {
  const value = raw.replace(/\s+/g, " ").trim();
  if (!value) return null;
  if (field === "incoterm") {
    const v = value.toUpperCase().replace(/[^A-Z]/g, "");
    const found = SHEET_INCOTERMS.find((i) => i === v);
    if (!found) throw new BookingItemValueError();
    return found;
  }
  if (field === "currency") {
    const v = value.toUpperCase();
    const code = v === "CNY" ? "RMB" : v === "US$" || v === "U$" ? "USD" : v;
    const found = SHEET_CURRENCIES.find((c) => c === code);
    if (!found) throw new BookingItemValueError();
    return found;
  }
  if (field in TEXT_FIELDS)
    return value.slice(0, TEXT_FIELDS[field as TextField]);
  const int = (INT_FIELDS as readonly string[]).includes(field);
  const n = parseNumberInput(value, { int });
  if (n === null || !Number.isFinite(n) || n <= 0 || n > MAX_NUMBER)
    throw new BookingItemValueError();
  return int ? Math.round(n) : n;
}

const filled = (v: unknown) =>
  v !== null && v !== undefined && !(typeof v === "string" && !v.trim());

/* ------------------------------------------------------------------------ */
/* Capacidade: mililitros ou, quando o produto não tem volume, o tamanho      */
/* ------------------------------------------------------------------------ */

/*
 * A coluna "capacity" da planilha traz mililitros quando o produto tem
 * volume ("350", "350 ml", "1,5 L") e um tamanho quando não tem ("8X10",
 * "A4", como nos porta-retratos). O número fica em `capacityMl`; o texto,
 * em `sizeText` (o leitor da planilha já separa assim). A coluna da tela
 * mostra o que houver e aceita os dois (dono, 12/11/2026: a capacidade com
 * letras vinha da planilha e sumia da tela).
 */
type ItemCapacity = Pick<BookingItem, "capacityMl" | "sizeText">;

const VOLUME = /^([\d.,]+)\s*(ml|l)?$/i;

/** "350", "350 ml" → 350; "1,5 L" → 1500; texto ("8X10", "A4") → null. */
export function parseCapacityMl(raw: string): number | null {
  const m = VOLUME.exec(raw.replace(/\s+/g, " ").trim());
  if (!m) return null;
  const n = parseNumberInput(m[1]);
  if (n === null || !Number.isFinite(n)) return null;
  return (m[2] ?? "").toLowerCase() === "l" ? Math.round(n * 1000) : n;
}

/** O que a coluna Capacidade mostra: os mililitros ou o tamanho em texto. */
export const bookingCapacityShown = (
  item: Partial<ItemCapacity>,
): number | string | null =>
  typeof item.capacityMl === "number"
    ? item.capacityMl
    : filled(item.sizeText)
      ? (item.sizeText as string)
      : null;

/**
 * Valor digitado na coluna Capacidade → o que gravar. Número (com ou sem
 * "ml"/"L") vira mililitros; qualquer outro texto fica como tamanho; vazio
 * apaga. O tamanho só é trocado quando era ele que a coluna mostrava (um
 * tamanho que veio da coluna de medidas e estava guardado não se perde ao
 * digitar os mililitros).
 */
export function readBookingCapacity(
  raw: string,
  current: Partial<ItemCapacity>,
): ItemCapacity {
  const value = raw.replace(/\s+/g, " ").trim();
  const keptText =
    typeof current.capacityMl === "number" ? (current.sizeText ?? null) : null;
  if (!value) return { capacityMl: null, sizeText: keptText };
  if (VOLUME.test(value)) {
    const ml = parseCapacityMl(value);
    if (ml === null || ml <= 0 || ml > MAX_NUMBER)
      throw new BookingItemValueError();
    return { capacityMl: ml, sizeText: keptText };
  }
  return { capacityMl: null, sizeText: value.slice(0, 60) };
}

/** Campos obrigatórios que faltam no item (o tamanho vale como capacidade). */
export function missingItemFields(
  item: Pick<BookingItem, BookingItemRequiredField> &
    Partial<Pick<BookingItem, "sizeText">>,
): BookingItemRequiredField[] {
  return BOOKING_ITEM_REQUIRED.filter((f) =>
    f === "capacityMl" ? bookingCapacityShown(item) === null : !filled(item[f]),
  );
}

/** O que falta para fechar o booking: no cabeçalho e em cada item. */
export interface BookingLotPending {
  supplier: boolean;
  date: boolean;
  noItems: boolean;
  /** Item id → campos que faltam (só os itens incompletos). */
  items: Map<string, BookingItemRequiredField[]>;
}

export function bookingLotPending(
  lot: Pick<BookingLot, "supplierId" | "bookingDate">,
  items: BookingItem[],
): BookingLotPending {
  const map = new Map<string, BookingItemRequiredField[]>();
  for (const item of items) {
    const missing = missingItemFields(item);
    if (missing.length) map.set(item.id, missing);
  }
  return {
    supplier: !lot.supplierId,
    date: !lot.bookingDate,
    noItems: items.length === 0,
    items: map,
  };
}

export const bookingLotReady = (p: BookingLotPending) =>
  !p.supplier && !p.date && !p.noItems && p.items.size === 0;

/** Só o rascunho é editável (fornecedor, data e itens). */
export const bookingLotEditable = (status: BookingLotStatus) =>
  status === "draft";

/**
 * Em preenchimento pelo parceiro que lançou (docs/BOOKING.md, "Booking do
 * Trading"): ele confere e corrige os campos antes de enviar. Para a Wellmix
 * o booking ainda não existe: fica fora das listas, da seleção, do NCM e das
 * telas dela.
 */
export const bookingLotPreparing = (status: BookingLotStatus) =>
  status === "preparing";

/**
 * Para onde o status vai à mão. Fechar o rascunho é a ação própria (exige os
 * campos e roda a análise); o resto é escolha da equipe.
 */
const MOVES: Record<BookingLotStatus, BookingLotStatus[]> = {
  // Em preenchimento pelo parceiro: só ele manda adiante (vira rascunho).
  preparing: [],
  draft: ["cancelled"],
  closed: ["in_progress", "done", "cancelled"],
  in_progress: ["closed", "done", "cancelled"],
  done: ["in_progress"],
  cancelled: ["draft"],
};

export function bookingLotMoves(status: BookingLotStatus): BookingLotStatus[] {
  return MOVES[status];
}

export const canMoveBookingLot = (
  from: BookingLotStatus,
  to: BookingLotStatus,
) => MOVES[from].includes(to);

/* ------------------------------------------------------------------------ */
/* Fornecedor estimado pela planilha                                         */
/* ------------------------------------------------------------------------ */

/** Palavras de razão social que não ajudam a reconhecer o fornecedor. */
const COMPANY_WORDS =
  /\b(CO|COMPANY|LTD|LIMITED|LTDA|INC|CORP|CORPORATION|TRADING|FACTORY|INDUSTRIAL|INDUSTRY|IMPORT|EXPORT|IMP|EXP|GROUP|THE|E|AND)\b/g;

export function supplierKey(name: string | null | undefined): string {
  return (name ?? "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9一-鿿]+/g, " ")
    .replace(COMPANY_WORDS, " ")
    .replace(/\s+/g, "")
    .trim();
}

const digits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");
const storeKey = (s: string | null | undefined) =>
  (s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

/**
 * Fornecedor do cadastro que corresponde ao da planilha: o mesmo nome (sem
 * pontuação nem "Co., Ltd."), senão o mesmo telefone (8 dígitos finais ou
 * mais), senão (planilha sem nome) o mesmo nº de loja. Só fornecedores ativos.
 */
export function matchSheetSupplier(
  suppliers: Party[],
  hint: { name: string | null; phone: string | null; store: string | null },
): Party | null {
  const active = suppliers.filter((s) => s.type === "supplier" && s.active);
  const name = supplierKey(hint.name);
  if (name) {
    const byName = active.find((s) => supplierKey(s.name) === name);
    if (byName) return byName;
  }
  const phone = digits(hint.phone);
  if (phone.length >= 8) {
    const tail = phone.slice(-8);
    const byPhone = active.find((s) => digits(s.phone).slice(-8) === tail);
    if (byPhone) return byPhone;
  }
  // A loja só vale quando a planilha não diz o nome: nome diferente com a
  // mesma loja é outro fornecedor (ou a loja mudou de dono).
  const store = storeKey(hint.store);
  if (!name && store.length >= 3) {
    const byStore = active.find((s) => storeKey(s.storeNumber) === store);
    if (byStore) return byStore;
  }
  return null;
}

/**
 * O valor mais frequente entre as linhas (a planilha de um fornecedor repete
 * o nome, a loja e a data em todas); empate: o primeiro que apareceu.
 */
export function mostCommon(values: Array<string | null | undefined>) {
  const counts = new Map<string, number>();
  let best: string | null = null;
  let bestCount = 0;
  for (const raw of values) {
    const v = (raw ?? "").trim();
    if (!v) continue;
    const n = (counts.get(v) ?? 0) + 1;
    counts.set(v, n);
    if (n > bestCount) {
      best = v;
      bestCount = n;
    }
  }
  return best;
}

/** "2026-10-13T00:00:00.000Z" ou "2026.10.13" → data ISO (meia-noite UTC). */
export function bookingDateOf(raw: string | null | undefined): string | null {
  const m = /(\d{4})\D(\d{1,2})\D(\d{1,2})/.exec(raw ?? "");
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, mo - 1, d));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/* ------------------------------------------------------------------------ */
/* Lista dos bookings: busca e ordenação                                     */
/* ------------------------------------------------------------------------ */

/** Linha da tabela de bookings (o que a tela mostra e a busca procura). */
export interface BookingLotRow {
  id: string;
  number: number;
  status: BookingLotStatus;
  /** Texto do status no idioma da tela (a busca procura por ele também). */
  statusLabel: string;
  origin: string;
  supplier: string;
  /** Data do booking (ISO) e como a tela mostra. */
  date: string | null;
  dateText: string;
  fileName: string;
  itemCount: number;
  /** Itens com algum campo obrigatório faltando. */
  pendingItems: number;
  /** Sinais da análise do Superplan. */
  viable: number;
  below: number;
  loss: number;
  missing: number;
  owner: string;
  createdAt: string;
  createdText: string;
}

export const BOOKING_LOT_SORT_KEYS = [
  "number",
  "status",
  "origin",
  "supplier",
  "date",
  "fileName",
  "itemCount",
  "pendingItems",
  "viable",
  "owner",
  "createdAt",
] as const satisfies readonly (keyof BookingLotRow)[];
export type BookingLotSortKey = (typeof BOOKING_LOT_SORT_KEYS)[number];

const fold = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Filtra pela busca: cada palavra tem de aparecer em algum campo da linha. */
export function searchBookingLots(
  rows: BookingLotRow[],
  query: string,
): BookingLotRow[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return rows;
  return rows.filter((row) => {
    const hay = fold(
      [
        row.number,
        row.statusLabel,
        row.origin,
        row.supplier,
        row.dateText,
        row.date ?? "",
        row.fileName,
        row.itemCount,
        row.owner,
        row.createdText,
      ].join(" "),
    );
    return words.every((w) => hay.includes(w));
  });
}

/** Ordena por uma coluna; vazios sempre no fim. */
export function sortBookingLots(
  rows: BookingLotRow[],
  key: BookingLotSortKey,
  direction: "asc" | "desc",
): BookingLotRow[] {
  const sign = direction === "desc" ? -1 : 1;
  const value = (r: BookingLotRow) =>
    key === "status" ? r.statusLabel : (r[key] as string | number | null);
  return [...rows].sort((a, b) => {
    const av = value(a);
    const bv = value(b);
    const empty = (v: unknown) => v === null || v === undefined || v === "";
    if (empty(av) && empty(bv)) return 0;
    if (empty(av)) return 1;
    if (empty(bv)) return -1;
    const cmp =
      typeof av === "number" && typeof bv === "number"
        ? av - bv
        : fold(String(av)).localeCompare(fold(String(bv)), "pt", {
            numeric: true,
          });
    return cmp * sign || b.number - a.number;
  });
}

/**
 * Tipos que podem ser o responsável pelo booking: o fornecedor, os parceiros
 * à parte (Trading, Factory, Supplier, GP) e os tipos criados no painel.
 */
export const BOOKING_PARTNER_TYPES = [
  "supplier",
  "trading",
  "factory",
  "supplier_partner",
  "gp",
  "partner",
] as const;

export const isBookingPartner = (p: Pick<Party, "type">) =>
  (BOOKING_PARTNER_TYPES as readonly string[]).includes(p.type);

/** Para quem vão as solicitações do booking: o responsável ou, sem ele, o fornecedor. */
export function bookingRecipientId(
  lot: Pick<BookingLot, "supplierId" | "partnerId">,
): string | null {
  return lot.partnerId ?? lot.supplierId ?? null;
}
