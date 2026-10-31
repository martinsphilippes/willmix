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
import { ChatOpenButton } from "./chat-open-button";
import { chatTargetFromHref } from "@/lib/chat-target";

/*
 * Painel de Pedidos com filtro em todas as colunas (texto ou lista) e
 * ordenação por coluna. Os dados chegam prontos do servidor (já filtrados por
 * papel); filtrar e ordenar é só na tela, na hora. Os filtros ficam no
 * endereço (?p=…&st=…), então voltar, recarregar ou mandar o link mantém.
 */

export type RowState = "active" | "blocked" | "done" | "cancelled";

/** Item da linha escolhida (painel de itens embaixo, como no Sankhya). */
export interface OrdersTableItem {
  /** Item do pedido (o chat desce até ele); nulo em solicitação. */
  orderItemId?: string | null;
  name: string;
  variant: string | null;
  /** Quantidade já formatada com a unidade ("2.400 un"). */
  quantity: string;
  /** Preço unitário formatado (só a Wellmix; nulo para os demais). */
  price: string | null;
  supplier: string;
  /** Pedido ou solicitação deste item ("#4", "Sol. 6"). */
  ref: string;
  href: string;
  phase: string;
  state: RowState;
  progress: number | null;
  due: string;
  dueLabel: string;
}

export interface OrdersTableRow {
  key: string;
  href: string;
  items: OrdersTableItem[];
  number: string;
  /** Embaixo do número: os pedidos do grupo, ou "Solicitação". */
  subtitle: string | null;
  isRequest: boolean;
  product: string;
  customer: string;
  supplier: string;
  phase: string;
  /** Etapa sem tradução ("stage:PREPARATION"): é o que o filtro e o link guardam. */
  phaseKey: string;
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
  /** "+{n} itens" ao lado do produto. */
  moreItems: string;
  /** "+1 item" (singular). */
  moreItem: string;
  items: string;
  showItems: string;
  hideItems: string;
  openOrder: string;
  openRequest: string;
  noItems: string;
  /** "Itens de {ref}" (título do painel de itens). */
  itemsOf: string;
  /** Nenhuma linha escolhida. */
  pickRow: string;
  /** Ícone de chat da linha ("Conversar sobre este pedido ou solicitação"). */
  chat: string;
  price: string;
  seq: string;
  variant: string;
  quantity: string;
  ref: string;
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
const SORT_KEYS: readonly SortKey[] = [
  "number",
  "product",
  "customer",
  "supplier",
  "phase",
  "state",
  "progress",
  "due",
  "updated",
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
  // Linha escolhida: os itens dela aparecem no painel de baixo (como no
  // Sankhya). Sem escolha, vale a primeira da lista filtrada.
  const [picked, setPicked] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean } | null>(
    () => {
      // Só colunas conhecidas (link editado ou antigo não quebra a tela).
      const raw = initial.sort ?? "";
      const key = raw.replace(/^-/, "");
      return (SORT_KEYS as readonly string[]).includes(key)
        ? { key: key as SortKey, desc: raw.startsWith("-") }
        : null;
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
      // Estado nulo: o Next acompanha a troca de endereço (useSearchParams).
      window.history.replaceState(null, "", url);
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
    const seen = new Map<string, { label: string; rank: number }>();
    for (const r of rows)
      if (!seen.has(r.phaseKey))
        seen.set(r.phaseKey, { label: r.phase, rank: r.phaseRank });
    return [...seen.entries()]
      .sort((a, b) => a[1].rank - b[1].rank)
      .map(([key, v]) => [key, v.label] as [string, string]);
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
      // Produto: acha também pelos outros itens do pedido/lote.
      if (
        !has(r.product, filters.p) &&
        !r.items.some((i) => has(`${i.name} ${i.variant ?? ""}`, filters.p))
      )
        return false;
      if (showCustomer && !has(r.customer, filters.c)) return false;
      if (showSupplier && !has(r.supplier, filters.s)) return false;
      if (filters.ph && r.phaseKey !== filters.ph) return false;
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
        case "product":
        case "customer":
        case "supplier":
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

  const current = shown.find((r) => r.key === picked) ?? shown[0] ?? null;

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
              {filterCell(select("ph", labels.phase, phases))}
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
                const selected = current?.key === r.key;
                return (
                  <tr
                    key={r.key}
                    className={cx(
                      rowClass,
                      "cursor-pointer",
                      selected &&
                        "bg-brand-50 ring-1 ring-inset ring-brand-200",
                    )}
                    data-orders-row={r.key}
                    data-orders-state={r.state}
                    aria-selected={selected}
                    // Clicar na linha mostra os itens embaixo; o número e o
                    // nome continuam abrindo a página.
                    onClick={(event) => {
                      if ((event.target as HTMLElement).closest("a,button"))
                        return;
                      setPicked(r.key);
                    }}
                  >
                    <td className="whitespace-nowrap px-2.5 py-2">
                      <span className="inline-flex items-center gap-1">
                        <Link href={r.href} className={linkClass}>
                          {r.number}
                        </Link>
                        {chatTargetFromHref(r.href) ? (
                          <ChatOpenButton
                            target={chatTargetFromHref(r.href)!}
                            label={labels.chat}
                          />
                        ) : null}
                      </span>
                      {r.subtitle ? (
                        <span className="block text-[11px] text-zinc-500">
                          {r.subtitle}
                        </span>
                      ) : null}
                    </td>
                    <td className="min-w-40 px-2.5 py-2 font-medium text-zinc-900">
                      <Link href={r.href} className="hover:underline">
                        {r.product}
                      </Link>
                      {r.items.length > 1 ? (
                        <span className="ml-1.5 whitespace-nowrap text-xs font-normal text-zinc-500">
                          {r.items.length === 2
                            ? labels.moreItem
                            : labels.moreItems.replace(
                                "{n}",
                                String(r.items.length - 1),
                              )}
                        </span>
                      ) : null}
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
      <ItemsPanel
        row={current}
        labels={labels}
        showSupplier={showSupplier}
        today={today}
      />
    </div>
  );
}

/** Painel de itens da linha escolhida (embaixo da lista, como no Sankhya). */
function ItemsPanel({
  row,
  labels,
  showSupplier,
  today,
}: {
  row: OrdersTableRow | null;
  labels: OrdersTableLabels;
  showSupplier: boolean;
  today: string;
}) {
  const withPrice = !!row?.items.some((i) => i.price !== null);
  const cell = "whitespace-nowrap px-2.5 py-2";
  return (
    <section
      className="mt-4 rounded-xl border border-zinc-200/80 bg-white"
      data-orders-items={row?.key ?? ""}
      aria-live="polite"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 bg-zinc-50/80 px-3 py-2">
        <h2 className="text-sm font-semibold text-zinc-800">
          {row
            ? `${labels.itemsOf.replace("{ref}", row.number)} (${row.items.length})`
            : labels.items}
        </h2>
        {row ? (
          <Link href={row.href} className={cx(linkClass, "text-sm")}>
            {row.isRequest ? labels.openRequest : labels.openOrder} →
          </Link>
        ) : null}
      </header>
      {!row ? (
        <p className="px-3 py-4 text-sm text-zinc-500">{labels.pickRow}</p>
      ) : row.items.length === 0 ? (
        <p className="px-3 py-4 text-sm text-zinc-500">{labels.noItems}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                <th className="px-2.5 py-2">{labels.seq}</th>
                <th className="px-2.5 py-2">{labels.product}</th>
                <th className="px-2.5 py-2">{labels.variant}</th>
                <th className="px-2.5 py-2 text-right">{labels.quantity}</th>
                {withPrice ? (
                  <th className="px-2.5 py-2 text-right">{labels.price}</th>
                ) : null}
                {showSupplier ? (
                  <th className="px-2.5 py-2">{labels.supplier}</th>
                ) : null}
                <th className="px-2.5 py-2">{labels.ref}</th>
                <th className="px-2.5 py-2">{labels.phase}</th>
                <th className="px-2.5 py-2">{labels.state}</th>
                <th className="px-2.5 py-2">{labels.due}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {row.items.map((item, i) => {
                const late =
                  !!item.due &&
                  item.due < today &&
                  (item.state === "active" || item.state === "blocked");
                return (
                  <tr key={i} className={rowClass} data-orders-item>
                    <td className={cx(cell, "tabular-nums text-zinc-500")}>
                      {i + 1}
                    </td>
                    <td className="min-w-40 px-2.5 py-2 font-medium text-zinc-900">
                      {item.name}
                    </td>
                    <td className="px-2.5 py-2 text-zinc-600">
                      {item.variant ?? "—"}
                    </td>
                    <td className={cx(cell, "text-right tabular-nums")}>
                      {item.quantity}
                    </td>
                    {withPrice ? (
                      <td className={cx(cell, "text-right tabular-nums")}>
                        {item.price ?? "—"}
                      </td>
                    ) : null}
                    {showSupplier ? (
                      <td className="min-w-32 px-2.5 py-2">
                        {item.supplier || "—"}
                      </td>
                    ) : null}
                    <td className={cell}>
                      <span className="inline-flex items-center gap-1">
                        <Link href={item.href} className={linkClass}>
                          {item.ref}
                        </Link>
                        {chatTargetFromHref(item.href) ? (
                          <ChatOpenButton
                            target={
                              item.orderItemId
                                ? {
                                    ...chatTargetFromHref(item.href)!,
                                    orderItemId: item.orderItemId,
                                  }
                                : chatTargetFromHref(item.href)!
                            }
                            label={labels.chat}
                          />
                        ) : null}
                      </span>
                    </td>
                    <td className={cell}>{item.phase}</td>
                    <td className={cell}>
                      <Badge tone={STATE_TONE[item.state]}>
                        {labels.states[item.state]}
                      </Badge>
                    </td>
                    <td
                      className={cx(
                        cell,
                        "tabular-nums",
                        late && "font-semibold text-red-700",
                      )}
                    >
                      {item.dueLabel}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
