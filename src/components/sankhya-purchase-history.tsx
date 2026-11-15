"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type {
  SankhyaHistoryItem,
  SankhyaHistoryOrder,
} from "@/lib/services/sankhya-customer-history";
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

  if (stock) return null;
  const mine =
    key && loaded && loaded.key === key && loaded.attempt === attempt
      ? loaded
      : null;
  const result = mine?.result ?? null;

  // Sem Sankhya ou sem código: o histórico do portal, com o aviso.
  if (result?.state === "not_configured" || result?.state === "no_code")
    return (
      <div className={className} data-sankhya-history-fallback={result.state}>
        <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200">
          {result.state === "no_code"
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
    >
      <Card title={labels.title}>
        <p className="-mt-1 mb-2 text-[11px] font-medium uppercase tracking-wide text-emerald-700">
          {labels.source}
        </p>
        {state === "select" ? (
          <p className="text-sm text-zinc-500" data-purchase-history-select>
            {labels.select}
          </p>
        ) : null}
        {state === "loading" ? (
          <p className="text-sm text-zinc-500" role="status">
            {labels.loading}
          </p>
        ) : null}
        {state === "error" ? (
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
        {state === "empty" ? (
          <p className="text-sm text-zinc-500" data-purchase-history-empty>
            {labels.empty}
          </p>
        ) : null}
        {state === "ready" && key && result?.state === "ok" ? (
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
