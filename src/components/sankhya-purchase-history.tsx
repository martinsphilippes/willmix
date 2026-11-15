"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type {
  SankhyaHistoryItem,
  SankhyaHistoryOrder,
  SankhyaHistoryProduct,
  SankhyaQuantity,
} from "@/lib/services/sankhya-customer-history";
import {
  PRODUCT_SORTS,
  VALUE_SORTS,
  sortProducts,
  type ProductSort,
} from "@/lib/sankhya-product-sort";
import { useRequestCustomer } from "./request-customer-context";
import { Button, Card, cx } from "./ui";

/** Textos do card (no idioma de quem vê). */
export interface SankhyaHistoryLabels {
  /** Tag Intl do idioma (datas e valores). */
  intl: string;
  title: string;
  source: string;
  select: string;
  loading: string;
  empty: string;
  error: string;
  retry: string;
  more: string;
  hint: string;
  /** "Pedido {n}" (NUNOTA). */
  order: string;
  /** "Nota {n}" (NUMNOTA). */
  note: string;
  /** "{n} itens". */
  items: string;
  pending: string;
  done: string;
  noItems: string;
  /** Sem Sankhya configurado / cliente sem código: o histórico do portal. */
  fallbackNotConfigured: string;
  fallbackNoCode: string;
  /** Seletor no topo do card (dono, 15/11/2026). */
  view: { label: string; orders: string; products: string };
  /** Visão Produto. */
  products: {
    hint: string;
    /** "Período consultado: {from} a {to} ({n} pedido(s))". */
    period: string;
    /** "Total {q}". */
    total: string;
    empty: string;
    more: string;
    /** "Mostrar mais produtos ({n} restantes)". */
    showMore: string;
    incomplete: string;
    /** "Ordenar" e os rótulos curtos das quatro ordens. */
    sort: { label: string } & Record<ProductSort, string>;
    /** Rótulo dos totais do produto (leitor de tela). */
    totals: string;
  };
  f: {
    code: string;
    reference: string;
    supplierReference: string;
    ncm: string;
    quantity: string;
    delivered: string;
    unitPrice: string;
    discount: string;
    unitNet: string;
    totalNet: string;
    container: string;
    top: string;
    company: string;
  };
}

type Orders =
  | { state: "ok"; orders: SankhyaHistoryOrder[]; next: number | null }
  | { state: "not_configured" }
  | { state: "no_code" }
  | { state: "error"; code: string; message: string };
type Items =
  | { state: "ok"; items: SankhyaHistoryItem[] }
  | { state: "error"; code: string; message: string }
  | { state: "not_configured" }
  | { state: "no_code" };

interface Loaded {
  key: string;
  attempt: number;
  result: Orders | null;
  failed: boolean;
}

type Products =
  | {
      state: "ok";
      products: SankhyaHistoryProduct[];
      orders: number;
      from: string | null;
      to: string | null;
      complete: boolean;
      /** Quem lê vê valores ("Ver valores e margem"). */
      money: boolean;
    }
  | { state: "not_configured" }
  | { state: "no_code" }
  | { state: "error"; code: string; message: string };

/** Visão Produto lida para um cliente e um número de pedidos. */
interface ProductsLoaded {
  key: string;
  /** Pedidos da lista quando a visão foi lida (0 = a primeira página). */
  count: number;
  attempt: number;
  result: Products | null;
  failed: boolean;
}

type View = "orders" | "products";
/** Produtos mostrados por vez na visão Produto. */
const PRODUCTS_STEP = 50;

const DASH = "—";

/**
 * Histórico do cliente pelo Sankhya na Nova solicitação (dono, 15/11/2026;
 * docs/PURCHASE_HISTORY.md seção 9): os pedidos do cliente escolhido, lidos
 * na hora pela API do Sankhya (DbExplorer, view VW_AD_PEDCLIENTE_ITEM_WELL),
 * 10 por vez; tocar no pedido lê os itens dele. Sem o Sankhya configurado
 * ou sem o código do cliente, mostra o histórico gravado no portal
 * (`fallback`), com o aviso. Só a Wellmix.
 */
export function SankhyaPurchaseHistory({
  labels,
  className,
  fallback,
}: {
  labels: SankhyaHistoryLabels;
  className?: string;
  /** O histórico do portal (o card de antes). */
  fallback: ReactNode;
}) {
  const shared = useRequestCustomer();
  const stock = !!shared?.stock;
  const key = shared?.customer?.id ?? null;
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [moreFor, setMoreFor] = useState<string | null>(null);
  const [moreFailed, setMoreFailed] = useState(false);
  const current = useRef(key);
  useEffect(() => {
    current.current = key;
  }, [key]);
  // Seletor Pedido | Produto (dono, 15/11/2026): Pedido por padrão; a
  // escolha fica ao trocar de cliente (o conteúdo é o do cliente novo).
  const [view, setView] = useState<View>("orders");
  // Ordem da visão Produto (dono, 15/11/2026): Mais un. por padrão; fica ao
  // trocar de cliente.
  const [sort, setSort] = useState<ProductSort>("units_desc");
  const [products, setProducts] = useState<ProductsLoaded | null>(null);
  const [productsAttempt, setProductsAttempt] = useState(0);
  const productsRef = useRef<ProductsLoaded | null>(null);
  useEffect(() => {
    productsRef.current = products;
  }, [products]);

  const url = (customer: string, shown = 0) =>
    `/api/purchase-history/sankhya?${new URLSearchParams({
      customer,
      ...(shown ? { shown: String(shown) } : {}),
    }).toString()}`;

  useEffect(() => {
    if (!key || stock) return;
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(url(key), { signal: controller.signal });
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as Orders;
        setLoaded({ key, attempt, result: body, failed: false });
      } catch {
        if (controller.signal.aborted) return;
        setLoaded({ key, attempt, result: null, failed: true });
      }
    })();
    return () => controller.abort();
  }, [key, attempt, stock]);

  const mine =
    key && loaded && loaded.key === key && loaded.attempt === attempt
      ? loaded
      : null;
  const result = mine?.result ?? null;
  // Pedidos já na lista: a visão Produto soma os mesmos (0 = a 1ª página).
  const ordersCount = result?.state === "ok" ? result.orders.length : 0;

  // Visão Produto: lida ao abrir pelo seletor, para o cliente e os pedidos
  // da lista; a mesma leitura é reaproveitada ao voltar para ela.
  const ordersRead = !!mine;
  useEffect(() => {
    // Espera a lista (o número de pedidos) para ler uma vez só.
    if (!key || stock || view !== "products" || !ordersRead) return;
    const have = productsRef.current;
    if (
      have &&
      have.key === key &&
      have.count === ordersCount &&
      have.attempt === productsAttempt
    )
      return;
    const want = { key, count: ordersCount, attempt: productsAttempt };
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(
          `/api/purchase-history/sankhya?${new URLSearchParams({
            customer: key,
            view: "products",
            ...(ordersCount ? { shown: String(ordersCount) } : {}),
          }).toString()}`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as Products;
        setProducts({ ...want, result: body, failed: false });
      } catch {
        if (controller.signal.aborted) return;
        setProducts({ ...want, result: null, failed: true });
      }
    })();
    return () => controller.abort();
  }, [key, ordersCount, ordersRead, view, productsAttempt, stock]);

  if (stock) return null;
  // A visão Produto do cliente escolhido (a última lida, mesmo se a lista
  // cresceu depois) e se ela já é a dos pedidos atuais.
  const productsMine = key && products?.key === key ? products : null;
  const productsCurrent =
    productsMine &&
    productsMine.count === ordersCount &&
    productsMine.attempt === productsAttempt
      ? productsMine
      : null;
  const fallbackState =
    result?.state === "not_configured" || result?.state === "no_code"
      ? result.state
      : productsCurrent?.result?.state === "not_configured" ||
          productsCurrent?.result?.state === "no_code"
        ? productsCurrent.result.state
        : null;

  // Sem Sankhya ou sem código: o histórico do portal, com o aviso.
  if (fallbackState)
    return (
      <div className={className} data-sankhya-history-fallback={fallbackState}>
        <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200">
          {fallbackState === "no_code"
            ? labels.fallbackNoCode
            : labels.fallbackNotConfigured}
        </p>
        {fallback}
      </div>
    );

  const state = !key
    ? "select"
    : !mine
      ? "loading"
      : mine.failed || result?.state === "error"
        ? "error"
        : result?.state === "ok" && result.orders.length
          ? "ready"
          : "empty";

  async function loadMore() {
    if (!key || result?.state !== "ok" || result.next === null) return;
    const forKey = key;
    setMoreFor(forKey);
    setMoreFailed(false);
    try {
      const res = await fetch(url(forKey, result.orders.length));
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as Orders;
      if (current.current !== forKey) return;
      if (body.state !== "ok") throw new Error(body.state);
      setLoaded((prev) =>
        prev && prev.key === forKey && prev.result?.state === "ok"
          ? {
              ...prev,
              result: {
                state: "ok",
                orders: [
                  ...prev.result.orders,
                  ...body.orders.filter(
                    (o) =>
                      prev.result?.state === "ok" &&
                      !prev.result.orders.some((x) => x.nunota === o.nunota),
                  ),
                ],
                next: body.next,
              },
            }
          : prev,
      );
    } catch {
      if (current.current === forKey) setMoreFailed(true);
    } finally {
      setMoreFor(null);
    }
  }

  return (
    <div
      className={className}
      data-purchase-history
      data-sankhya-history
      data-purchase-history-state={state}
      data-sankhya-history-view={view}
    >
      <Card title={labels.title}>
        <p className="-mt-1 mb-2 text-[11px] font-medium uppercase tracking-wide text-emerald-700">
          {labels.source}
        </p>
        {/* Pedido | Produto (dono, 15/11/2026): uma visão por vez, aqui
            embaixo, no mesmo card. */}
        <div
          role="group"
          aria-label={labels.view.label}
          className="mb-3 grid grid-cols-2 gap-1 rounded-lg bg-zinc-100 p-1"
          data-sankhya-history-views
        >
          {(["orders", "products"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              data-sankhya-history-view-button={v}
              className={cx(
                "min-h-10 rounded-md px-3 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600",
                view === v
                  ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200"
                  : "text-zinc-600 hover:text-zinc-900",
              )}
            >
              {v === "orders" ? labels.view.orders : labels.view.products}
            </button>
          ))}
        </div>
        {state === "select" ? (
          <p className="text-sm text-zinc-500" data-purchase-history-select>
            {labels.select}
          </p>
        ) : null}
        {view === "orders" && state === "loading" ? (
          <p className="text-sm text-zinc-500" role="status">
            {labels.loading}
          </p>
        ) : null}
        {view === "orders" && state === "error" ? (
          <p className="text-sm text-red-700" role="alert">
            {labels.error}
            {result?.state === "error" ? (
              <span className="block text-xs text-red-600">
                {result.message}
              </span>
            ) : null}{" "}
            <button
              type="button"
              className="font-medium underline underline-offset-2"
              onClick={() => setAttempt((n) => n + 1)}
            >
              {labels.retry}
            </button>
          </p>
        ) : null}
        {view === "orders" && state === "empty" ? (
          <p className="text-sm text-zinc-500" data-purchase-history-empty>
            {labels.empty}
          </p>
        ) : null}
        {view === "products" && key ? (
          <ProductsPanel
            key={key}
            loaded={productsMine}
            current={!!productsCurrent}
            labels={labels}
            sort={sort}
            onSort={setSort}
            onRetry={() => setProductsAttempt((n) => n + 1)}
            more={
              result?.state === "ok" && result.next !== null
                ? {
                    loading: moreFor === key,
                    failed: moreFailed,
                    onClick: () => void loadMore(),
                  }
                : null
            }
          />
        ) : null}
        {view === "orders" &&
        state === "ready" &&
        key &&
        result?.state === "ok" ? (
          <>
            <p className="mb-1 text-xs leading-relaxed text-zinc-500">
              {labels.hint}
            </p>
            <ul className="divide-y divide-zinc-100">
              {result.orders.map((o) => (
                <OrderRow
                  key={`${key}-${o.nunota}`}
                  customer={key}
                  order={o}
                  labels={labels}
                />
              ))}
            </ul>
            {result.next !== null ? (
              <div className="pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  onClick={() => void loadMore()}
                  disabled={moreFor === key}
                  data-purchase-history-more
                >
                  {moreFor === key ? labels.loading : labels.more}
                </Button>
                {moreFailed ? (
                  <p className="mt-1 text-xs text-red-700" role="alert">
                    {labels.error}
                  </p>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}
      </Card>
    </div>
  );
}

const fill = (s: string, vars: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));

function formatter(intl: string) {
  const money = (n: number | null) =>
    n === null
      ? DASH
      : n.toLocaleString(intl, { style: "currency", currency: "BRL" });
  const qty = (n: number | null) =>
    n === null ? DASH : n.toLocaleString(intl, { maximumFractionDigits: 3 });
  const date = (iso: string | null) => {
    if (!iso) return DASH;
    const d = new Date(`${iso}T00:00:00`);
    return Number.isNaN(d.getTime())
      ? iso
      : d.toLocaleDateString(intl, {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
  };
  return { money, qty, date };
}

function OrderRow({
  customer,
  order: o,
  labels,
}: {
  customer: string;
  order: SankhyaHistoryOrder;
  labels: SankhyaHistoryLabels;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Items | null>(null);
  const [failed, setFailed] = useState(false);
  const format = formatter(labels.intl);
  const detailsId = `sankhya-history-${o.nunota}`;

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (!next || (items && items.state === "ok")) return;
    setFailed(false);
    try {
      const res = await fetch(
        `/api/purchase-history/sankhya?${new URLSearchParams({
          customer,
          nunota: String(o.nunota),
        }).toString()}`,
      );
      if (!res.ok) throw new Error(String(res.status));
      setItems((await res.json()) as Items);
    } catch {
      setFailed(true);
    }
  }

  return (
    <li data-sankhya-history-order={o.nunota}>
      <button
        type="button"
        onClick={() => void toggle()}
        aria-expanded={open}
        aria-controls={detailsId}
        className="flex w-full min-w-0 items-start gap-2 py-2.5 text-left hover:bg-zinc-50/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      >
        <svg
          viewBox="0 0 16 16"
          aria-hidden="true"
          className={cx(
            "mt-1 h-3.5 w-3.5 shrink-0 text-zinc-400 transition-transform",
            open && "rotate-90",
          )}
        >
          <path
            d="M6 3.5 10.5 8 6 12.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline justify-between gap-x-2">
            <span className="font-medium text-zinc-900">
              {fill(labels.order, { n: o.nunota })}
              {o.numnota ? (
                <span className="font-normal text-zinc-500">
                  {" · "}
                  {fill(labels.note, { n: o.numnota })}
                </span>
              ) : null}
            </span>
            <span
              className="text-sm tabular-nums text-zinc-900"
              data-purchase-history-total
            >
              {format.money(o.totalBrl)}
            </span>
          </span>
          <span className="mt-0.5 block text-xs text-zinc-500">
            <span data-purchase-history-date>{format.date(o.date)}</span>
            {" · "}
            <span data-purchase-history-status>
              {o.pending === true
                ? labels.pending
                : o.pending === false
                  ? labels.done
                  : DASH}
            </span>
            {" · "}
            {fill(labels.items, { n: o.items })}
          </span>
          {o.topName || o.top ? (
            <span className="mt-0.5 block truncate text-xs text-zinc-400">
              {labels.f.top}: {o.top ?? DASH}
              {o.topName ? ` · ${o.topName}` : ""}
              {o.company ? ` · ${labels.f.company} ${o.company}` : ""}
            </span>
          ) : null}
        </span>
      </button>
      {open ? (
        <div
          id={detailsId}
          role="region"
          aria-label={fill(labels.order, { n: o.nunota })}
          className="space-y-2 pb-3 pl-5"
          data-purchase-history-details
        >
          {failed || items?.state === "error" ? (
            <p className="text-xs text-red-700" role="alert">
              {labels.error}
              {items?.state === "error" ? ` ${items.message}` : ""}
            </p>
          ) : !items ? (
            <p className="text-xs text-zinc-500" role="status">
              {labels.loading}
            </p>
          ) : items.state === "ok" && items.items.length ? (
            items.items.map((item) => (
              <ItemBlock
                key={item.sequence}
                item={item}
                labels={labels}
                format={format}
              />
            ))
          ) : (
            <p className="text-xs text-zinc-500">{labels.noItems}</p>
          )}
        </div>
      ) : null}
    </li>
  );
}

function ItemBlock({
  item,
  labels,
  format,
}: {
  item: SankhyaHistoryItem;
  labels: SankhyaHistoryLabels;
  format: ReturnType<typeof formatter>;
}) {
  const unit = item.unit ? ` ${item.unit}` : "";
  const lines: Array<[string, string, string]> = [
    ["code", labels.f.code, item.code === null ? DASH : String(item.code)],
    ["reference", labels.f.reference, item.reference ?? DASH],
    [
      "supplierReference",
      labels.f.supplierReference,
      item.supplierReference ?? DASH,
    ],
    ["quantity", labels.f.quantity, `${format.qty(item.quantity)}${unit}`],
    ["delivered", labels.f.delivered, `${format.qty(item.delivered)}${unit}`],
    ["unitPrice", labels.f.unitPrice, format.money(item.unitPriceBrl)],
    ["discount", labels.f.discount, format.money(item.discountBrl)],
    ["unitNet", labels.f.unitNet, format.money(item.unitNetBrl)],
    ["totalNet", labels.f.totalNet, format.money(item.totalNetBrl)],
  ];
  if (item.ncm) lines.push(["ncm", labels.f.ncm, item.ncm]);
  if (item.container)
    lines.push(["container", labels.f.container, item.container]);
  return (
    <div
      className="rounded-lg border border-zinc-100 bg-zinc-50/70 px-2.5 py-2"
      data-purchase-history-item
    >
      <p className="text-sm font-medium text-zinc-900">{item.name}</p>
      <div className="mt-1 space-y-0.5 text-xs leading-relaxed">
        {lines.map(([key, label, value]) => (
          <p
            key={key}
            className="break-words"
            data-purchase-history-field={key}
          >
            <span className="text-zinc-500">{label}: </span>
            <span className="text-zinc-900">{value}</span>
          </p>
        ))}
      </div>
    </div>
  );
}

/** "60 UN" (ou "60 UN · 2 CX" quando o produto veio em mais de uma unidade). */
function quantityText(
  list: SankhyaQuantity[],
  format: ReturnType<typeof formatter>,
) {
  if (!list.length) return DASH;
  return list
    .map((q) => `${format.qty(q.quantity)}${q.unit ? ` ${q.unit}` : ""}`)
    .join(" · ");
}

/**
 * Visão Produto (dono, 15/11/2026): os produtos dos pedidos da lista, pelo
 * código no Sankhya. Nome à esquerda e o total do período à direita; embaixo,
 * a quantidade de cada data, da mais recente para a mais antiga.
 */
function ProductsPanel({
  loaded,
  current,
  labels,
  sort,
  onSort,
  onRetry,
  more,
}: {
  /** A última visão lida para este cliente (pode ser de menos pedidos). */
  loaded: ProductsLoaded | null;
  /** A leitura já é a dos pedidos atuais da lista. */
  current: boolean;
  labels: SankhyaHistoryLabels;
  /** Ordem escolhida (fica no card ao trocar de cliente). */
  sort: ProductSort;
  onSort: (sort: ProductSort) => void;
  onRetry: () => void;
  /** "Carregar mais pedidos" (amplia o período), quando há mais. */
  more: { loading: boolean; failed: boolean; onClick: () => void } | null;
}) {
  const [limit, setLimit] = useState(PRODUCTS_STEP);
  const format = formatter(labels.intl);
  const data = loaded?.result?.state === "ok" ? loaded.result : null;
  if (!data) {
    if (!loaded || !current)
      return (
        <p className="text-sm text-zinc-500" role="status">
          {labels.loading}
        </p>
      );
    return (
      <p className="text-sm text-red-700" role="alert">
        {labels.error}
        {loaded.result?.state === "error" ? (
          <span className="block text-xs text-red-600">
            {loaded.result.message}
          </span>
        ) : null}{" "}
        <button
          type="button"
          className="font-medium underline underline-offset-2"
          onClick={onRetry}
        >
          {labels.retry}
        </button>
      </p>
    );
  }
  if (!data.orders)
    return (
      <p className="text-sm text-zinc-500" data-purchase-history-empty>
        {labels.empty}
      </p>
    );
  // Sem "Ver valores e margem": só as ordens por unidades.
  const sorts = PRODUCT_SORTS.filter(
    (o) => data.money || !VALUE_SORTS.includes(o),
  );
  const active = sorts.includes(sort) ? sort : "units_desc";
  const sorted = sortProducts(data.products, active);
  const shown = sorted.slice(0, limit);
  const left = sorted.length - shown.length;
  return (
    <div data-sankhya-products>
      <p className="mb-1 text-xs leading-relaxed text-zinc-500">
        {labels.products.hint}
      </p>
      {/* Período e "Ordenar" na mesma linha, o seletor no canto superior
          direito (dono, 15/11/2026). Na coluna estreita, o período quebra
          na própria coluna e o seletor continua ao lado, compacto (o rótulo
          pequeno em cima). */}
      <div className="mb-2 flex items-start justify-between gap-3">
        <p
          className="min-w-0 flex-1 text-xs font-medium leading-relaxed text-zinc-700"
          data-sankhya-products-period
        >
          {fill(labels.products.period, {
            from: format.date(data.from),
            to: format.date(data.to),
            n: data.orders,
          })}
        </p>
        <label
          className="flex shrink-0 flex-col items-end gap-0.5"
          data-sankhya-products-sort-label
        >
          <span className="text-[11px] font-medium leading-4 text-zinc-500">
            {labels.products.sort.label}
          </span>
          <select
            value={active}
            onChange={(e) => onSort(e.target.value as ProductSort)}
            className="h-8 rounded-md border border-zinc-300 bg-white py-0 pl-2 pr-7 text-xs text-zinc-900 focus-visible:outline-2 focus-visible:outline-brand-600"
            data-sankhya-products-sort
          >
            {sorts.map((o) => (
              <option key={o} value={o}>
                {labels.products.sort[o]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!data.complete ? (
        <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200">
          {labels.products.incomplete}
        </p>
      ) : null}
      {data.products.length ? (
        <ul className="space-y-2">
          {shown.map((p) => (
            <li
              key={p.key}
              className="rounded-lg border border-zinc-100 bg-zinc-50/70 px-2.5 py-2"
              data-sankhya-product={p.key}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 break-words text-sm font-medium text-zinc-900">
                  {p.name}
                </p>
                {/* Totais do período, um embaixo do outro: unidades e valor
                    (após descontos; "—" sem valor). */}
                <div className="shrink-0 text-right tabular-nums">
                  <span className="sr-only">{labels.products.totals}: </span>
                  <p
                    className="whitespace-nowrap text-sm font-semibold text-zinc-900"
                    data-sankhya-product-total
                  >
                    {quantityText(p.total, format)}
                  </p>
                  <p
                    className="whitespace-nowrap text-xs font-medium text-zinc-700"
                    data-sankhya-product-value
                  >
                    {format.money(p.value)}
                  </p>
                </div>
              </div>
              {p.code !== null ? (
                <p className="text-[11px] text-zinc-500">
                  {labels.f.code}: {p.code}
                </p>
              ) : null}
              <ul className="mt-1.5 space-y-0.5 border-t border-zinc-100 pt-1.5 text-xs">
                {p.days.map((d) => (
                  <li
                    key={d.date ?? "sem-data"}
                    className="flex items-baseline justify-between gap-3"
                    data-sankhya-product-day={d.date ?? ""}
                  >
                    <span className="text-zinc-600">{format.date(d.date)}</span>
                    <span className="tabular-nums text-zinc-900">
                      {quantityText(d.quantities, format)}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-500" data-sankhya-products-empty>
          {labels.products.empty}
        </p>
      )}
      {left > 0 ? (
        <div className="pt-2">
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={() => setLimit((n) => n + PRODUCTS_STEP)}
            data-sankhya-products-show-more
          >
            {fill(labels.products.showMore, { n: left })}
          </Button>
        </div>
      ) : null}
      {more ? (
        <div className="pt-2">
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={more.onClick}
            disabled={more.loading || !current}
            data-sankhya-products-more
          >
            {more.loading || !current ? labels.loading : labels.products.more}
          </Button>
          {more.failed ? (
            <p className="mt-1 text-xs text-red-700" role="alert">
              {labels.error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
