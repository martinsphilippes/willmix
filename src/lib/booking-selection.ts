import type {
  BookingItem,
  BookingLotStatus,
  SelectionGroup,
} from "@/lib/db/schema";
import { itemKeywords, searchWords } from "@/lib/supplier-requests";

/*
 * Seleção de itens (docs/SUPPLIER_REQUESTS.md, "Abas Itens e Seleção"):
 * filtros dos bookings e blocos sugeridos de itens parecidos. Regras puras.
 */

/** Status que entram na seleção; o cancelado só quando pedido no filtro. */
export const SELECTION_STATUSES: BookingLotStatus[] = [
  "draft",
  "closed",
  "in_progress",
  "done",
  "cancelled",
];
export const DEFAULT_SELECTION_STATUSES: BookingLotStatus[] = [
  "draft",
  "closed",
  "in_progress",
  "done",
];

/** Itens num grupo para comparar (o endereço leva os ids). */
export const GROUP_MAX = 60;

export interface SelectionFilters {
  /** Vazio: os padrões (todos menos cancelado). */
  statuses: BookingLotStatus[];
  /** AAAA-MM-DD, inclusive. */
  from: string | null;
  to: string | null;
  supplierId: string | null;
  /** Cidade do fornecedor (origem do booking). */
  origin: string | null;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Lê os filtros do endereço, descartando o que não vale. */
export function parseSelectionFilters(
  query: Record<string, string | string[] | undefined>,
): SelectionFilters {
  const list = (v: string | string[] | undefined) =>
    (Array.isArray(v) ? v : v ? [v] : []).flatMap((s) => s.split(","));
  const one = (v: string | string[] | undefined) =>
    (Array.isArray(v) ? v[0] : v)?.trim().slice(0, 200) || null;
  const statuses = list(query.status).filter((s): s is BookingLotStatus =>
    (SELECTION_STATUSES as string[]).includes(s),
  );
  const day = (v: string | string[] | undefined) => {
    const s = one(v);
    return s && DAY.test(s) ? s : null;
  };
  let from = day(query.from);
  let to = day(query.to);
  if (from && to && from > to) [from, to] = [to, from];
  return {
    statuses: [...new Set(statuses)],
    from,
    to,
    supplierId: one(query.supplier),
    origin: one(query.origin),
  };
}

/**
 * Abas da Seleção de itens (dono, 14/11/2026), nesta ordem: Itens → Seleção
 * → Blocos Sugeridos → Com Solicitação Aberta. Cada aba mostra só o
 * conteúdo dela.
 */
export const SELECTION_TABS = [
  "items",
  "selection",
  "blocks",
  "requested",
] as const;
export type SelectionTab = (typeof SELECTION_TABS)[number];

/** A aba do endereço (`tab=`); sem ela, ou com um valor que não existe, Itens. */
export function parseSelectionTab(
  v: string | string[] | undefined,
): SelectionTab {
  const one = Array.isArray(v) ? v[0] : v;
  return SELECTION_TABS.find((k) => k === one) ?? "items";
}

/** Os ids de um grupo (`ids=a,b,c`), sem repetição, até GROUP_MAX. */
export function parseGroupIds(v: string | string[] | undefined): string[] {
  const raw = (Array.isArray(v) ? v.join(",") : (v ?? "")).split(",");
  return [
    ...new Set(
      raw.map((s) => s.trim()).filter((s) => /^[A-Za-z0-9_-]{1,64}$/.test(s)),
    ),
  ].slice(0, GROUP_MAX);
}

export interface LotForFilter {
  status: BookingLotStatus;
  bookingDate: string | null;
  supplierId: string | null;
  origin: string | null;
}

/** O booking passa nos filtros (status, intervalo de datas, fornecedor, origem)? */
export function lotMatchesFilters(
  lot: LotForFilter,
  f: SelectionFilters,
): boolean {
  const statuses = f.statuses.length ? f.statuses : DEFAULT_SELECTION_STATUSES;
  if (!statuses.includes(lot.status)) return false;
  const day = lot.bookingDate ? lot.bookingDate.slice(0, 10) : null;
  if (f.from && (!day || day < f.from)) return false;
  if (f.to && (!day || day > f.to)) return false;
  if (f.supplierId && lot.supplierId !== f.supplierId) return false;
  if (f.origin && fold(lot.origin ?? "") !== fold(f.origin)) return false;
  return true;
}

const fold = (s: string) =>
  s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Os filtros como parâmetros do endereço (para links que os mantêm). */
export function filtersToParams(f: SelectionFilters, q = ""): URLSearchParams {
  const p = new URLSearchParams();
  if (q) p.set("q", q);
  for (const s of f.statuses) p.append("status", s);
  if (f.from) p.set("from", f.from);
  if (f.to) p.set("to", f.to);
  if (f.supplierId) p.set("supplier", f.supplierId);
  if (f.origin) p.set("origin", f.origin);
  return p;
}

export interface BlockInput {
  item: Pick<BookingItem, "id" | "description" | "productName">;
  supplierId: string | null;
}

export interface SelectionBlock {
  /** Palavras que os itens têm em comum (o nome do bloco). */
  label: string[];
  ids: string[];
  suppliers: number;
}

/** Palavra em mais itens do que isso não liga itens (ex.: "cup" em tudo). */
const COMMON_LIMIT = 400;

/**
 * Blocos de itens parecidos pelo nome: dois itens ficam juntos quando as
 * palavras significativas se parecem (Jaccard ≥ `threshold`), e a ligação é
 * transitiva. Só blocos com 2 ou mais itens; primeiro os com mais
 * fornecedores, depois os maiores.
 */
export function suggestBlocks(
  rows: BlockInput[],
  { threshold = 0.5, max = 60 }: { threshold?: number; max?: number } = {},
): SelectionBlock[] {
  const words = rows.map((r) => new Set(itemKeywords(r.item)));
  const parent = rows.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const byWord = new Map<string, number[]>();
  words.forEach((set, i) => {
    for (const w of set) {
      const list = byWord.get(w) ?? [];
      list.push(i);
      byWord.set(w, list);
    }
  });
  const seen = new Set<string>();
  for (const list of byWord.values()) {
    if (list.length < 2 || list.length > COMMON_LIMIT) continue;
    for (let a = 0; a < list.length; a++)
      for (let b = a + 1; b < list.length; b++) {
        const i = list[a];
        const j = list[b];
        const key = `${i}:${j}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (find(i) === find(j)) continue;
        if (jaccard(words[i], words[j]) >= threshold) parent[find(i)] = find(j);
      }
  }
  const groups = new Map<number, number[]>();
  rows.forEach((_, i) => {
    if (!words[i].size) return;
    const root = find(i);
    groups.set(root, [...(groups.get(root) ?? []), i]);
  });
  const blocks: SelectionBlock[] = [];
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    const firstWords = itemKeywords(rows[members[0]].item);
    const order = (w: string) => {
      const i = firstWords.indexOf(w);
      return i < 0 ? 999 : i;
    };
    const count = new Map<string, number>();
    for (const i of members)
      for (const w of words[i]) count.set(w, (count.get(w) ?? 0) + 1);
    const label = [...count.entries()]
      .filter(([, n]) => n >= Math.ceil(members.length / 2))
      // Mais frequentes primeiro; empate na ordem da descrição do 1º item.
      .sort((x, y) => y[1] - x[1] || order(x[0]) - order(y[0]))
      .slice(0, 3)
      .map(([w]) => w);
    blocks.push({
      label,
      ids: members.map((i) => rows[i].item.id),
      suppliers: new Set(
        members.map((i) => rows[i].supplierId ?? `?${rows[i].item.id}`),
      ).size,
    });
  }
  return blocks
    .sort(
      (a, b) =>
        b.suppliers - a.suppliers ||
        b.ids.length - a.ids.length ||
        a.label.join(" ").localeCompare(b.label.join(" ")),
    )
    .slice(0, max);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  return inter / (a.size + b.size - inter);
}

/**
 * Sugestões da busca (autocompletar): valores distintos dos campos dos
 * itens mostrados (descrição, código, material, fornecedor, origem...).
 */
export function searchSuggestions(
  values: Array<string | null | undefined>,
  max = 400,
): string[] {
  const out = new Map<string, string>();
  for (const v of values) {
    const s = (v ?? "").trim();
    if (s.length < 2 || s.length > 120) continue;
    const key = searchWords(s).join(" ");
    if (key && !out.has(key)) out.set(key, s);
    if (out.size >= max) break;
  }
  return [...out.values()].sort((a, b) => a.localeCompare(b, "pt"));
}

/**
 * A escolha gravada de um bloco: o grupo cujo ganhador está no bloco. Com
 * mais de um, vale a que ainda não virou solicitação e, entre iguais, a mais
 * nova.
 */
export function groupForBlock<
  G extends Pick<SelectionGroup, "chosenItemId" | "status" | "updatedAt">,
>(blockIds: string[], groups: G[]): G | null {
  const ids = new Set(blockIds);
  return (
    groups
      .filter((g) => ids.has(g.chosenItemId))
      .sort(
        (a, b) =>
          Number(b.status === "saved") - Number(a.status === "saved") ||
          b.updatedAt.localeCompare(a.updatedAt),
      )[0] ?? null
  );
}

/**
 * Os itens comparados que não ganharam, na ordem dada: os que `find` acha e
 * quantos não existem mais (ex.: item apagado do book). O ganhador nunca
 * entra, e um id repetido conta uma vez só.
 */
export function otherGroupItems<T>(
  ids: string[],
  chosenId: string,
  find: (id: string) => T | null | undefined,
): { rows: T[]; missing: number } {
  const rows: T[] = [];
  let missing = 0;
  for (const id of new Set(ids)) {
    if (id === chosenId) continue;
    const row = find(id);
    if (row) rows.push(row);
    else missing++;
  }
  return { rows, missing };
}
