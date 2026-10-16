"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Badge,
  cx,
  inputDenseClass,
  linkClass,
  rowClass,
  type Tone,
} from "./ui";

/*
 * Painel de Pedidos com filtro em todas as colunas (texto ou lista) e
 * ordenação por coluna. Os dados chegam prontos do servidor (já filtrados por
 * papel); filtrar e ordenar é só na tela, na hora. Os filtros ficam no
 * endereço (?p=…&st=…), então voltar, recarregar ou mandar o link mantém.
 */

export type RowState = "active" | "blocked" | "done" | "cancelled";

export interface OrdersTableRow {
  key: string;
  href: string;
  number: string;
  isRequest: boolean;
  product: string;
  customer: string;
  supplier: string;
  phase: string;
  /** Ordem da etapa no fluxo (para ordenar e para a lista do filtro). */
  phaseRank: number;
  state: RowState;
  progress: number | null;
  /** AAAA-MM-DD (dia) ou vazio. */
  due: string;
  dueLabel: string;
  updated: string;
  updatedLabel: string;
}

export interface OrdersTableLabels {
  number: string;
  product: string;
  customer: string;
  supplier: string;
  phase: string;
  state: string;
  progress: string;
  due: string;
  updated: string;
  all: string;
  search: string;
  states: Record<RowState, string>;
  progressOptions: { none: string; partial: string; full: string };
  dueOptions: { overdue: string; week: string; none: string };
  updatedOptions: { today: string; week: string; month: string };
  request: string;
  /** "{shown} de {total}" */
  count: string;
  clear: string;
  empty: string;
  sortBy: string;
}

type Filters = Record<FilterKey, string>;
type FilterKey = "n" | "p" | "c" | "s" | "ph" | "st" | "pr" | "d" | "u";
type SortKey =
  | "number"
  | "product"
  | "customer"
  | "supplier"
  | "phase"
  | "state"
  | "progress"
  | "due"
  | "updated";

const FILTER_KEYS: FilterKey[] = [
  "n",
  "p",
  "c",
  "s",
  "ph",
  "st",
  "pr",
  "d",
  "u",
];
const STATE_TONE: Record<RowState, Tone> = {
  active: "info",
  blocked: "warning",
  done: "success",
  cancelled: "danger",
};
const STATE_RANK: Record<RowState, number> = {
  blocked: 0,
  active: 1,
  done: 2,
  cancelled: 3,
};

/** Sem acento e sem caixa: "Preparação" acha "preparacao". */
const fold = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function addDays(day: string, n: number) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function OrdersTable({
  rows,
  showCustomer,
  showSupplier,
  labels,
  initial,
  today,
}: {
  rows: OrdersTableRow[];
  showCustomer: boolean;
  showSupplier: boolean;
  labels: OrdersTableLabels;
  /** Filtros e ordem vindos do endereço. */
  initial: Partial<Filters> & { sort?: string };
  /** Dia de hoje (AAAA-MM-DD, Brasília), do servidor. */
  today: string;
}) {
  const [filters, setFilters] = useState<Filters>(
    () =>
      Object.fromEntries(
        FILTER_KEYS.map((k) => [k, initial[k] ?? ""]),
      ) as Filters,
  );
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean } | null>(
    () => {
      const raw = initial.sort ?? "";
      const key = raw.replace(/^-/, "") as SortKey;
      return raw ? { key, desc: raw.startsWith("-") } : null;
    },
  );

  // Filtros e ordem no endereço, sem recarregar a página.
  function sync(next: Filters, nextSort: typeof sort) {
    try {
      const url = new URL(window.location.href);
      for (const k of FILTER_KEYS)
        if (next[k]) url.searchParams.set(k, next[k]);
        else url.searchParams.delete(k);
      if (nextSort)
        url.searchParams.set(
          "sort",
          `${nextSort.desc ? "-" : ""}${nextSort.key}`,
        );
      else url.searchParams.delete("sort");
      window.history.replaceState(window.history.state, "", url);
    } catch {
      // Sem histórico (tela embutida): os filtros valem só na tela.
    }
  }
  function setFilter(key: FilterKey, value: string) {
    const next = { ...filters, [key]: value };
    setFilters(next);
    sync(next, sort);
  }
  function toggleSort(key: SortKey) {
    const next =
      sort?.key === key
        ? sort.desc
          ? null
          : { key, desc: true }
        : { key, desc: false };
    setSort(next);
    sync(filters, next);
  }
  function clear() {
    const empty = Object.fromEntries(
      FILTER_KEYS.map((k) => [k, ""]),
    ) as Filters;
    setFilters(empty);
    setSort(null);
    sync(empty, null);
  }

  const phases = useMemo(() => {
    const seen = new Map<string, number>();
    for (const r of rows)
      if (!seen.has(r.phase)) seen.set(r.phase, r.phaseRank);
    return [...seen.entries()].sort((a, b) => a[1] - b[1]).map(([p]) => p);
  }, [rows]);
  const states = useMemo(
    () =>
      (Object.keys(STATE_RANK) as RowState[]).filter((s) =>
        rows.some((r) => r.state === s),
      ),
    [rows],
  );

  const shown = useMemo(() => {
    const has = (value: string, q: string) =>
      !q || fold(value).includes(fold(q));
    const week = addDays(today, 7);
    const weekAgo = addDays(today, -7);
    const monthAgo = addDays(today, -30);
    const list = rows.filter((r) => {
      if (!has(r.number, filters.n)) return false;
      if (!has(r.product, filters.p)) return false;
      if (showCustomer && !has(r.customer, filters.c)) return false;
      if (showSupplier && !has(r.supplier, filters.s)) return false;
      if (filters.ph && r.phase !== filters.ph) return false;
      if (filters.st && r.state !== filters.st) return false;
      if (filters.pr === "none" && r.progress !== 0) return false;
      if (
        filters.pr === "partial" &&
        !(r.progress !== null && r.progress > 0 && r.progress < 100)
      )
        return false;
      if (filters.pr === "full" && r.progress !== 100) return false;
      if (filters.d === "overdue" && !(r.due && r.due < today)) return false;
      if (filters.d === "week" && !(r.due && r.due >= today && r.due <= week))
        return false;
      if (filters.d === "none" && r.due) return false;
      if (filters.u === "today" && r.updated !== today) return false;
      if (filters.u === "week" && r.updated < weekAgo) return false;
      if (filters.u === "month" && r.updated < monthAgo) return false;
      return true;
    });
    if (!sort) return list;
    const value = (r: OrdersTableRow): string | number => {
      switch (sort.key) {
        case "number":
          return Number(r.number.replace(/\D/g, "")) || 0;
        case "phase":
          return r.phaseRank;
        case "state":
          return STATE_RANK[r.state];
        case "progress":
          return r.progress ?? -1;
        case "due":
          return r.due || "9999";
        case "updated":
          return r.updated;
        default:
          return fold(r[sort.key]);
      }
    };
    return [...list].sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      const cmp =
        typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb));
      return sort.desc ? -cmp : cmp;
    });
  }, [rows, filters, sort, today, showCustomer, showSupplier]);

  const filtering = FILTER_KEYS.some((k) => filters[k]) || !!sort;
  const control = cx(inputDenseClass, "min-w-24 font-normal normal-case");

  const head = (key: SortKey, label: string, className?: string) => (
    <th
      className={cx(
        "border-b border-zinc-200 bg-zinc-50/80 px-2.5 pt-2 text-left align-bottom text-[11px] font-semibold uppercase tracking-wide text-zinc-500",
        className,
      )}
      aria-sort={
        sort?.key === key ? (sort.desc ? "descending" : "ascending") : "none"
      }
    >
      <button
        type="button"
        onClick={() => toggleSort(key)}
        className="inline-flex items-center gap-1 uppercase hover:text-zinc-800"
        title={`${labels.sortBy} ${label}`}
        data-orders-sort={key}
      >
        {label}
        <span aria-hidden className="text-zinc-400">
          {sort?.key === key ? (sort.desc ? "↓" : "↑") : "↕"}
        </span>
      </button>
    </th>
  );
  const filterCell = (children: React.ReactNode) => (
    <th className="border-b border-zinc-200 bg-zinc-50/80 px-2.5 pb-2 pt-1 text-left align-top">
      {children}
    </th>
  );
  const text = (key: FilterKey, label: string) => (
    <input
      type="search"
      value={filters[key]}
      onChange={(e) => setFilter(key, e.target.value)}
      placeholder={labels.search}
      aria-label={`${labels.search}: ${label}`}
      className={control}
      data-orders-filter={key}
    />
  );
  const select = (
    key: FilterKey,
    label: string,
    options: Array<[string, string]>,
  ) => (
    <select
      value={filters[key]}
      onChange={(e) => setFilter(key, e.target.value)}
      aria-label={`${label}`}
      className={control}
      data-orders-filter={key}
    >
      <option value="">{labels.all}</option>
      {options.map(([value, text]) => (
        <option key={value} value={value}>
          {text}
        </option>
      ))}
    </select>
  );

  return (
    <div data-orders-panel>
      <div className="mb-2 flex flex-wrap items-center gap-3 text-sm text-zinc-600">
        <span data-orders-count>
          {labels.count
            .replace("{shown}", String(shown.length))
            .replace("{total}", String(rows.length))}
        </span>
        {filtering ? (
          <button
            type="button"
            onClick={clear}
            className="font-medium text-brand-700 underline underline-offset-2"
            data-orders-clear
          >
            {labels.clear}
          </button>
        ) : null}
      </div>
      <div className="-mx-4 overflow-x-auto border-y border-zinc-200/80 bg-white sm:mx-0 sm:rounded-xl sm:border">
        <table className="w-full min-w-[56rem] text-sm">
          <thead>
            <tr>
              {head("number", labels.number, "w-24")}
              {head("product", labels.product)}
              {showCustomer ? head("customer", labels.customer) : null}
              {showSupplier ? head("supplier", labels.supplier) : null}
              {head("phase", labels.phase)}
              {head("state", labels.state)}
              {head("progress", labels.progress, "w-36")}
              {head("due", labels.due)}
              {head("updated", labels.updated)}
            </tr>
            <tr>
              {filterCell(text("n", labels.number))}
              {filterCell(text("p", labels.product))}
              {showCustomer ? filterCell(text("c", labels.customer)) : null}
              {showSupplier ? filterCell(text("s", labels.supplier)) : null}
              {filterCell(
                select(
                  "ph",
                  labels.phase,
                  phases.map((p) => [p, p]),
                ),
              )}
              {filterCell(
                select(
                  "st",
                  labels.state,
                  states.map((s) => [s, labels.states[s]]),
                ),
              )}
              {filterCell(
                select("pr", labels.progress, [
                  ["none", labels.progressOptions.none],
                  ["partial", labels.progressOptions.partial],
                  ["full", labels.progressOptions.full],
                ]),
              )}
              {filterCell(
                select("d", labels.due, [
                  ["overdue", labels.dueOptions.overdue],
                  ["week", labels.dueOptions.week],
                  ["none", labels.dueOptions.none],
                ]),
              )}
              {filterCell(
                select("u", labels.updated, [
                  ["today", labels.updatedOptions.today],
                  ["week", labels.updatedOptions.week],
                  ["month", labels.updatedOptions.month],
                ]),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {shown.length === 0 ? (
              <tr>
                <td
                  colSpan={7 + (showCustomer ? 1 : 0) + (showSupplier ? 1 : 0)}
                  className="px-3 py-6 text-center text-zinc-500"
                >
                  {labels.empty}
                </td>
              </tr>
            ) : (
              shown.map((r) => {
                const overdue =
                  !!r.due &&
                  r.due < today &&
                  (r.state === "active" || r.state === "blocked");
                return (
                  <tr
                    key={r.key}
                    className={rowClass}
                    data-orders-row={r.key}
                    data-orders-state={r.state}
                  >
                    <td className="whitespace-nowrap px-2.5 py-2">
                      <Link href={r.href} className={linkClass}>
                        {r.number}
                      </Link>
                      {r.isRequest ? (
                        <span className="block text-[11px] text-zinc-500">
                          {labels.request}
                        </span>
                      ) : null}
                    </td>
                    <td className="min-w-40 px-2.5 py-2 font-medium text-zinc-900">
                      <Link href={r.href} className="hover:underline">
                        {r.product}
                      </Link>
                    </td>
                    {showCustomer ? (
                      <td className="min-w-32 px-2.5 py-2">
                        {r.customer || "—"}
                      </td>
                    ) : null}
                    {showSupplier ? (
                      <td className="min-w-32 px-2.5 py-2">
                        {r.supplier || "—"}
                      </td>
                    ) : null}
                    <td className="whitespace-nowrap px-2.5 py-2">{r.phase}</td>
                    <td className="whitespace-nowrap px-2.5 py-2">
                      <Badge tone={STATE_TONE[r.state]}>
                        {labels.states[r.state]}
                      </Badge>
                    </td>
                    <td className="px-2.5 py-2">
                      {r.progress === null ? (
                        <span className="text-zinc-400">—</span>
                      ) : (
                        <div className="flex h-5 items-center gap-2">
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                            <div
                              className="h-full rounded-full bg-brand-600"
                              style={{ width: `${r.progress}%` }}
                            />
                          </div>
                          <span className="w-9 shrink-0 text-right text-xs font-semibold tabular-nums text-zinc-600">
                            {r.progress}%
                          </span>
                        </div>
                      )}
                    </td>
                    <td
                      className={cx(
                        "whitespace-nowrap px-2.5 py-2 tabular-nums",
                        overdue && "font-semibold text-red-700",
                      )}
                    >
                      {r.dueLabel}
                    </td>
                    <td className="whitespace-nowrap px-2.5 py-2 tabular-nums text-zinc-600">
                      {r.updatedLabel}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
