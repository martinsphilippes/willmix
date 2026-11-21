"use client";

import { useEffect, useRef, useState } from "react";
import {
  originSearchParams,
  useRequestCustomer,
} from "./request-customer-context";
import { ProductPicker } from "./product-picker";
import type { SearchPickerLabels } from "./search-picker";

/** Textos do seletor de produtos (no idioma de quem vê). */
export interface ProductBrowserLabels {
  open: string;
  title: string;
  close: string;
  /** Grupo, Sub grupo e Coleção do grupo (os níveis abaixo da família). */
  levels: [string, string, string];
  all: string;
  /** "✓ visto" (opção com todos os produtos vistos). */
  seenMark: string;
  /** "{n}/{m} vistos" */
  partialSeen: string;
  markSeen: string;
  unmarkSeen: string;
  /** "{n} de {m} produtos da família já vistos" */
  progress: string;
  defaultQty: string;
  defaultQtyHint: string;
  /** Rótulo do buscador por nome ou código (o mesmo da página). */
  search: string;
  picker: SearchPickerLabels;
  selectAll: string;
  /** "Selecionar {name}" */
  select: string;
  photo: string;
  name: string;
  addOne: string;
  /** "Adicionar selecionados ({n})" */
  addSelected: string;
  /** "{n} produto(s) acrescentado(s) ao pedido." */
  added: string;
  inOrder: string;
  seen: string;
  empty: string;
  loading: string;
  error: string;
  /** "Página {page} de {pages} · {total} produtos" */
  pageOf: string;
  prev: string;
  next: string;
  noPhoto: string;
}

type Levels = [string | null, string | null, string | null];

interface Facet {
  key: string;
  name: string;
  products: number;
  seen: number;
}

interface Result {
  facets: Facet[][];
  items: Array<{
    id: string;
    name: string;
    sku: string | null;
    photoId: string | null;
    seen: boolean;
  }>;
  total: number;
  page: number;
  pages: number;
  family: { products: number; seen: number };
}

const EMPTY: Levels = [null, null, null];
const sameCombo = (a: Levels, b: Levels) => a.every((v, i) => v === b[i]);

/** Os filtros marcados como vistos, por cliente, país e família (no navegador). */
function seenKey(customer: string, country: string, family: string) {
  return `wellmix.browse-seen.v1:${customer}:${country}:${family}`;
}
function readSeen(key: string): Levels[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(raw)
      ? (
          raw.filter((c) => Array.isArray(c) && c.length === 3) as Levels[]
        ).slice(0, 300)
      : [];
  } catch {
    return [];
  }
}
function writeSeen(key: string, combos: Levels[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(combos.slice(0, 300)));
  } catch {
    /* sem o armazenamento do navegador: vale só enquanto o seletor está aberto */
  }
}

/**
 * Lupa ao lado da busca de produto da Nova solicitação (dono, 15/11/2026;
 * docs/ORDER_TERMS.md 11.5): abre o seletor com os produtos do país e da
 * família do pedido, filtrados por Grupo, Sub grupo e Coleção do grupo (as
 * opções de cada filtro andam com os outros), em uma tabela paginada com a
 * foto grande e o nome. Clique acrescenta ao pedido sem fechar; a seleção
 * acrescenta vários de uma vez; a quantidade padrão vale para todos; cada
 * filtro pode ser marcado como visto, para percorrer a família inteira.
 */
export function ProductBrowserButton({
  labels,
}: {
  labels: ProductBrowserLabels;
}) {
  const shared = useRequestCustomer();
  const origin = shared?.origin ?? null;
  return (
    <>
      <button
        type="button"
        onClick={() => shared?.setBrowserOpen(true)}
        disabled={!origin}
        title={labels.open}
        aria-label={labels.open}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
        data-product-browser-open
      >
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="h-4 w-4"
        >
          <circle cx="8.5" cy="8.5" r="5.5" />
          <path d="m13 13 4.5 4.5" strokeLinecap="round" />
        </svg>
      </button>
    </>
  );
}

/**
 * O seletor em si, um só na tela (fora das linhas de produto): a lupa de
 * qualquer linha abre este.
 */
export function ProductBrowserHost({
  labels,
}: {
  labels: ProductBrowserLabels;
}) {
  const shared = useRequestCustomer();
  const origin = shared?.origin ?? null;
  if (!shared?.browserOpen || !origin) return null;
  return (
    <ProductBrowserDialog
      labels={labels}
      country={origin.country}
      family={origin.family}
      port={origin.port}
      customer={shared.customer?.id ?? "-"}
      onClose={() => shared.setBrowserOpen(false)}
    />
  );
}

function ProductBrowserDialog({
  labels,
  country,
  family,
  port,
  customer,
  onClose,
}: {
  labels: ProductBrowserLabels;
  country: string;
  family: string;
  /** Porto do pedido (dono, 21/11/2026); ausente = qualquer. */
  port?: string;
  customer: string;
  onClose: () => void;
}) {
  const shared = useRequestCustomer();
  const chosen = shared?.chosenProductIds ?? [];
  const dialog = useRef<HTMLDialogElement>(null);
  const storageKey = seenKey(
    customer,
    port === undefined ? country : `${country}|${port}`,
    family,
  );
  const [filters, setFilters] = useState<Levels>(EMPTY);
  const [page, setPage] = useState(1);
  const [seen, setSeen] = useState<Levels[]>(() => readSeen(storageKey));
  const [result, setResult] = useState<Result | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [selected, setSelected] = useState<string[]>([]);
  const [defaultQty, setDefaultQty] = useState("");
  const [added, setAdded] = useState(0);
  // Remonta o buscador depois de cada escolha (o campo volta vazio).
  const [pickerKey, setPickerKey] = useState(0);

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
  }, []);

  useEffect(() => {
    let alive = true;
    const params = new URLSearchParams({
      country,
      family,
      page: String(page),
      seen: JSON.stringify(seen),
    });
    if (port !== undefined) params.set("port", port);
    filters.forEach((v, i) => v && params.set(`l${i + 1}`, v));
    void (async () => {
      try {
        const res = await fetch(`/api/products/browse?${params}`);
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as Result;
        if (!alive) return;
        setResult(body);
        setState("ok");
      } catch {
        if (alive) setState("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, [country, family, port, filters, page, seen]);

  const choose = (level: number, value: string) => {
    setState("loading");
    setFilters((f) => {
      const out = [...f] as Levels;
      out[level] = value || null;
      // Trocou um nível: os de baixo recomeçam.
      for (let i = level + 1; i < out.length; i++) out[i] = null;
      return out;
    });
    setPage(1);
    setSelected([]);
  };
  const isSeen = seen.some((c) => sameCombo(c, filters));
  const toggleSeen = () => {
    const next = isSeen
      ? seen.filter((c) => !sameCombo(c, filters))
      : [...seen, filters];
    setState("loading");
    setSeen(next);
    writeSeen(storageKey, next);
  };
  const qty = Math.floor(Number(defaultQty.replace(",", "."))) || null;
  const add = (ids: string[]) => {
    const fresh = ids.filter((id) => !chosen.includes(id));
    if (!fresh.length) return;
    shared?.requestAddProducts(fresh, qty);
    setAdded(fresh.length);
    setSelected((s) => s.filter((id) => !fresh.includes(id)));
  };
  const pageIds = (result?.items ?? [])
    .map((p) => p.id)
    .filter((id) => !chosen.includes(id));
  const allSelected =
    !!pageIds.length && pageIds.every((id) => selected.includes(id));
  const fill = (text: string, values: Record<string, number | string>) =>
    Object.entries(values).reduce(
      (out, [k, v]) => out.replace(`{${k}}`, String(v)),
      text,
    );

  return (
    <dialog
      ref={dialog}
      aria-labelledby="product-browser-title"
      onClose={onClose}
      className="m-auto max-h-[calc(100vh-2rem)] w-[min(64rem,calc(100vw-2rem))] overflow-hidden rounded-2xl p-0 shadow-xl backdrop:bg-zinc-900/40"
      data-product-browser
    >
      <div className="flex max-h-[calc(100vh-2rem)] flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-5 py-3">
          <h3
            id="product-browser-title"
            className="text-base font-semibold text-zinc-900"
          >
            {labels.title}
          </h3>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            className="rounded-md px-2 py-1 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
            data-product-browser-close
          >
            {labels.close}
          </button>
        </div>
        <div className="space-y-3 border-b border-zinc-200 px-5 py-3">
          {/* O mesmo buscador ao lado da lupa (nome ou código, no país e na
              família do pedido): escolher acrescenta o produto ao pedido. */}
          <div className="space-y-1" data-product-browser-search>
            <label
              htmlFor="product-browser-search"
              className="block text-xs font-medium text-zinc-700"
            >
              {labels.search}
            </label>
            <ProductPicker
              key={pickerKey}
              scope="catalog"
              query={originSearchParams({ country, family, port })}
              inputId="product-browser-search"
              ariaLabel={labels.search}
              labels={labels.picker}
              onChoose={(option) => {
                if (!option) return;
                add([option.id]);
                setPickerKey((k) => k + 1);
              }}
            />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {labels.levels.map((label, level) => (
              <label
                key={level}
                className="block text-xs font-medium text-zinc-700"
              >
                {label}
                <select
                  value={filters[level] ?? ""}
                  onChange={(e) => choose(level, e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm"
                  data-product-browser-level={level + 1}
                >
                  <option value="">{labels.all}</option>
                  {(result?.facets[level] ?? []).map((o) => (
                    <option
                      key={o.key}
                      value={o.key}
                      data-seen={
                        o.seen >= o.products ? "all" : o.seen ? "some" : "none"
                      }
                    >
                      {`${o.seen >= o.products ? "✓ " : ""}${o.name} (${o.products})${
                        o.seen && o.seen < o.products
                          ? ` · ${fill(labels.partialSeen, { n: o.seen, m: o.products })}`
                          : o.seen >= o.products
                            ? ` · ${labels.seenMark}`
                            : ""
                      }`}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <button
              type="button"
              onClick={toggleSeen}
              aria-pressed={isSeen}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ring-1 ring-inset ${
                isSeen
                  ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                  : "bg-white text-zinc-700 ring-zinc-300 hover:bg-zinc-50"
              }`}
              data-product-browser-seen={isSeen ? "on" : "off"}
            >
              {isSeen ? `✓ ${labels.unmarkSeen}` : labels.markSeen}
            </button>
            {result ? (
              <p
                className="text-xs text-zinc-600"
                data-product-browser-progress
              >
                {fill(labels.progress, {
                  n: result.family.seen,
                  m: result.family.products,
                })}
              </p>
            ) : null}
            <label className="ml-auto block text-xs font-medium text-zinc-700">
              {labels.defaultQty}
              <input
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                value={defaultQty}
                onChange={(e) => setDefaultQty(e.target.value)}
                className="mt-1 block w-36 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm"
                aria-describedby="product-browser-qty-hint"
                data-product-browser-qty
              />
            </label>
          </div>
          <p id="product-browser-qty-hint" className="text-xs text-zinc-500">
            {labels.defaultQtyHint}
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-2">
          {state === "error" ? (
            <p className="py-6 text-sm text-red-700">{labels.error}</p>
          ) : !result ? (
            <p className="py-6 text-sm text-zinc-500">{labels.loading}</p>
          ) : !result.items.length ? (
            <p
              className="py-6 text-sm text-zinc-500"
              data-product-browser-empty
            >
              {labels.empty}
            </p>
          ) : (
            <table
              className={`w-full border-collapse text-sm ${state === "loading" ? "opacity-60" : ""}`}
              data-product-browser-table
            >
              <thead>
                <tr className="text-left text-xs text-zinc-500">
                  <th className="w-10 py-2">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      disabled={!pageIds.length}
                      onChange={() =>
                        setSelected((s) =>
                          allSelected
                            ? s.filter((id) => !pageIds.includes(id))
                            : [...new Set([...s, ...pageIds])],
                        )
                      }
                      aria-label={labels.selectAll}
                      title={labels.selectAll}
                      data-product-browser-select-all
                    />
                  </th>
                  <th className="w-44 py-2 font-semibold">{labels.photo}</th>
                  <th className="py-2 font-semibold">{labels.name}</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((p) => {
                  const inOrder = chosen.includes(p.id);
                  return (
                    <tr
                      key={p.id}
                      className="border-t border-zinc-100"
                      data-product-browser-item={p.id}
                      data-state={inOrder ? "in-order" : "available"}
                    >
                      <td className="py-2 align-middle">
                        <input
                          type="checkbox"
                          checked={selected.includes(p.id)}
                          disabled={inOrder}
                          onChange={() =>
                            setSelected((s) =>
                              s.includes(p.id)
                                ? s.filter((id) => id !== p.id)
                                : [...s, p.id],
                            )
                          }
                          aria-label={fill(labels.select, { name: p.name })}
                          data-product-browser-select={p.id}
                        />
                      </td>
                      <td className="py-2">
                        <button
                          type="button"
                          onClick={() => add([p.id])}
                          disabled={inOrder}
                          title={labels.addOne}
                          className="block disabled:cursor-default"
                          tabIndex={-1}
                        >
                          {p.photoId ? (
                            // eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido por /api/files com sessão
                            <img
                              src={`/api/files/${p.photoId}`}
                              alt=""
                              loading="lazy"
                              className="h-40 w-40 rounded-xl border border-zinc-200 bg-white object-contain"
                              data-product-browser-photo
                            />
                          ) : (
                            <span className="flex h-40 w-40 items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50 text-xs text-zinc-400">
                              {labels.noPhoto}
                            </span>
                          )}
                        </button>
                      </td>
                      <td className="py-2 align-middle">
                        <button
                          type="button"
                          onClick={() => add([p.id])}
                          disabled={inOrder}
                          title={labels.addOne}
                          className={`text-left text-base font-medium hover:text-brand-700 disabled:cursor-default ${inOrder ? "text-zinc-500 line-through" : "text-zinc-900"}`}
                          data-product-browser-add={p.id}
                        >
                          {p.name}
                        </button>
                        <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
                          {p.sku ? <span>{p.sku}</span> : null}
                          {inOrder ? (
                            <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200">
                              ✓ {labels.inOrder}
                            </span>
                          ) : null}
                          {p.seen ? (
                            <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-600">
                              {labels.seen}
                            </span>
                          ) : null}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-zinc-200 px-5 py-3">
          <button
            type="button"
            onClick={() => add(selected)}
            disabled={!selected.length}
            className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            data-product-browser-add-selected
          >
            {fill(labels.addSelected, { n: selected.length })}
          </button>
          <p
            aria-live="polite"
            className="text-xs font-medium text-emerald-700"
            data-product-browser-added
          >
            {added ? fill(labels.added, { n: added }) : ""}
          </p>
          {result && result.pages > 1 ? (
            <div className="ml-auto flex items-center gap-2 text-xs text-zinc-600">
              <button
                type="button"
                onClick={() => {
                  setState("loading");
                  setPage((p) => Math.max(1, p - 1));
                }}
                disabled={result.page <= 1}
                className="rounded-md px-2 py-1 font-medium ring-1 ring-inset ring-zinc-300 disabled:opacity-40"
                data-product-browser-prev
              >
                {labels.prev}
              </button>
              <span data-product-browser-page>
                {fill(labels.pageOf, {
                  page: result.page,
                  pages: result.pages,
                  total: result.total,
                })}
              </span>
              <button
                type="button"
                onClick={() => {
                  setState("loading");
                  setPage((p) => p + 1);
                }}
                disabled={result.page >= result.pages}
                className="rounded-md px-2 py-1 font-medium ring-1 ring-inset ring-zinc-300 disabled:opacity-40"
                data-product-browser-next
              >
                {labels.next}
              </button>
            </div>
          ) : result ? (
            <span
              className="ml-auto text-xs text-zinc-600"
              data-product-browser-page
            >
              {fill(labels.pageOf, { page: 1, pages: 1, total: result.total })}
            </span>
          ) : null}
        </div>
      </div>
    </dialog>
  );
}
