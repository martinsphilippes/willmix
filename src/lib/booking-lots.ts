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

/**
 * Campos do item que o booking exige para fechar (os com * na planilha).
 * Sem o INNER (peças por caixa inner): opcional desde 16/11/2026 (dono);
 * em branco fica sem valor (nulo, nunca zero) e não trava salvar, enviar
 * para conferência nem fechar. Preenchido, segue as regras de número.
 */
export const BOOKING_ITEM_REQUIRED = [
  "incoterm",
  "currency",
  "price",
  "masterCartonQty",
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

/* ------------------------------------------------------------------------ */
/* O que gravar: um campo (a célula) ou vários (o preenchimento em massa)    */
/* ------------------------------------------------------------------------ */

type PatchableItem = Pick<BookingItem, BookingItemField> &
  Partial<Pick<BookingItem, "sizeText">>;

/**
 * O que gravar no item para o valor digitado num campo: a mesma regra na
 * célula e no preenchimento em massa (dono, 16/11/2026). null quando nada
 * muda; valor que não dá para ler: BookingItemValueError.
 */
export function bookingItemPatch(
  item: PatchableItem,
  field: BookingItemField,
  raw: string,
): Partial<BookingItem> | null {
  // Capacidade: mililitros ou o tamanho em texto (os dois campos juntos).
  if (field === "capacityMl") {
    const next = readBookingCapacity(raw, item);
    return next.capacityMl === item.capacityMl &&
      next.sizeText === (item.sizeText ?? null)
      ? null
      : next;
  }
  const value = readBookingItemValue(field, raw);
  return item[field] === value
    ? null
    : ({ [field]: value } as Partial<BookingItem>);
}

/**
 * Vários campos no mesmo item (preenchimento em massa): um a um, na ordem,
 * sobre o item já com os anteriores. null quando nada muda.
 */
export function bookingItemPatches(
  item: PatchableItem,
  values: ReadonlyArray<readonly [BookingItemField, string]>,
): Partial<BookingItem> | null {
  let current = item;
  let patch: Partial<BookingItem> | null = null;
  for (const [field, raw] of values) {
    const next = bookingItemPatch(current, field, raw);
    if (!next) continue;
    patch = { ...(patch ?? {}), ...next };
    current = { ...current, ...next } as PatchableItem;
  }
  return patch;
}

/**
 * Valor do preenchimento em massa que a gravação aceita: as mesmas leituras
 * da célula (número acima de zero, incoterm e moeda da lista, NCM com 8
 * dígitos). Vazio não é valor (a coluna fica como está).
 */
export function bulkValueValid(
  field: BookingItemField | "ncm",
  raw: string,
): boolean {
  const value = raw.trim();
  if (!value) return false;
  // A mesma conta de normalizeNcm (src/lib/fiscal.ts): só os dígitos, 8.
  if (field === "ncm") return value.replace(/\D/g, "").length === 8;
  try {
    if (field === "capacityMl") readBookingCapacity(value, {});
    else readBookingItemValue(field, value);
    return true;
  } catch {
    return false;
  }
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

/** Item incompleto na lista de pendências do fechamento. */
export interface IncompleteBookingItem {
  itemId: string;
  /** Nome do item (sem ele, a descrição, encurtada). */
  name: string | null;
  /** SKU / código da fábrica (sem ele, o nº do item da planilha). */
  code: string | null;
  /** Linha na tabela (a coluna #): identifica o item sem nome nem código. */
  line: number;
  /** Campos obrigatórios que faltam, na ordem da validação. */
  fields: BookingItemRequiredField[];
}

const shown = (v: string | null | undefined, max: number) => {
  const text = (v ?? "").replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
};

/**
 * Lista de pendências do aviso de "Fechar e analisar" (dono, 14/11/2026):
 * os itens incompletos, na ordem da tabela, cada um com os campos que faltam.
 * Sai de `bookingLotPending`, a mesma validação que trava o fechamento: a
 * lista e o "Falta para fechar" contam os mesmos itens.
 */
export function incompleteBookingItems(
  items: readonly BookingItem[],
  pending: Pick<BookingLotPending, "items">,
): IncompleteBookingItem[] {
  return items
    .filter((item) => pending.items.has(item.id))
    .map((item) => ({
      itemId: item.id,
      name: shown(item.productName, 80) ?? shown(item.description, 60),
      code: shown(item.factoryItemCode, 60) ?? shown(item.itemNumber, 40),
      line: item.position + 1,
      fields: pending.items.get(item.id) ?? [],
    }));
}

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
  /** Tipo de item e Loja/Fábrica (já no idioma da tela). */
  itemType: string;
  sourceKind: string;
  /** Itens trabalhados na Seleção de itens: percentual e "3 de 10". */
  workedPct: number;
  workedText: string;
  /** Com quem está o book (trava); vazio = livre. */
  holder: string;
  /** A trava: id, se é de quem vê, se é do tipo de item, há quanto tempo e o prazo. */
  lockId: string | null;
  lockMine: boolean;
  /** Quem vê pode liberar (o gestor de quem travou ou quem supervisiona). */
  lockCanRelease: boolean;
  lockByType: boolean;
  heldMinutes: number | null;
  heldText: string;
  /** Até quando fica no prazo ("24/11 19:52"; vazio sem trava). */
  heldDueText: string;
  heldLate: boolean;
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
  "itemType",
  "sourceKind",
  "workedPct",
  "holder",
  "heldMinutes",
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
        row.itemType,
        row.sourceKind,
        row.holder,
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

/* ------------------------------------------------------------------------ */
/* Fabricante: a Fábrica do book × a planilha, linha a linha                 */
/* ------------------------------------------------------------------------ */

/*
 * Dono, 24/11/2026 (docs/BOOKING.md, "Fábrica, Fornecedor e Fabricante"): o
 * que a planilha chama de supplier é a Fábrica do book. Quem importa digita
 * a Fábrica; a coluna Fabricante repete esse nome em todas as linhas e é
 * comparada com o que a planilha traz em cada uma. Um book tem itens de um
 * fabricante só.
 */

/**
 * O Fabricante do book: a Fábrica digitada na importação; sem ela, a do
 * cadastro; sem as duas, o nome mais frequente da planilha.
 */
export function bookManufacturer(
  lot: Pick<BookingLot, "supplierHint"> & { supplierName?: string | null },
  factoryName: string | null | undefined,
): string | null {
  const clean = (v: string | null | undefined) =>
    (v ?? "").replace(/\s+/g, " ").trim() || null;
  return (
    clean(lot.supplierName) ??
    clean(factoryName) ??
    clean(lot.supplierHint?.name)
  );
}

type ManufacturerItem = {
  sheetSupplier?: string | null;
  manufacturerOkAt?: string | null;
};

/**
 * A linha diverge: a planilha traz outro fabricante e ninguém confirmou que
 * ela estava errada. Sem fabricante na linha (ou no book), não há o que
 * comparar. Nomes iguais sem pontuação nem "Co., Ltd." contam como o mesmo.
 */
export function manufacturerMismatch(
  item: ManufacturerItem,
  manufacturer: string | null,
): boolean {
  if (item.manufacturerOkAt) return false;
  const sheet = supplierKey(item.sheetSupplier);
  const book = supplierKey(manufacturer);
  return !!sheet && !!book && sheet !== book;
}

/** Nº da loja digitado × o da planilha: diferentes (os dois preenchidos)? */
export function storeNumberMismatch(
  typed: string | null | undefined,
  sheet: string | null | undefined,
): boolean {
  const a = storeKey(typed);
  const b = storeKey(sheet);
  return !!a && !!b && a !== b;
}

/** Situações em que o book pode ser travado: depois do rascunho, em trabalho. */
export const LOCKABLE_LOT_STATUSES: readonly BookingLotStatus[] = [
  "closed",
  "in_progress",
  "done",
];
export const bookingLotLockable = (status: BookingLotStatus) =>
  LOCKABLE_LOT_STATUSES.includes(status);
