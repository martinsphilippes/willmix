"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import type {
  HistoryItemView,
  HistoryPageView,
  HistoryPurchaseView,
} from "@/lib/services/purchase-history";
import { useRequestCustomer } from "./request-customer-context";
import {
  HistoryProductName,
  useHistoryFamilyFilter,
  type HistoryPickLabels,
} from "./history-product-pick";
import { Button, Card, cx } from "./ui";

/** Textos do card (no idioma de quem vê). */
export interface PurchaseHistoryLabels {
  title: string;
  select: string;
  loading: string;
  empty: string;
  error: string;
  retry: string;
  more: string;
  hint: string;
  current: string;
  currentHint: string;
  rounds: string;
  noItems: string;
  /** "Produtos do pedido #{n}". */
  details: string;
  /** "Abrir o pedido #{n} (nova aba)". */
  open: string;
  /** Histórico → pedido (docs/ORDER_TERMS.md seção 10). */
  pick?: HistoryPickLabels;
}

/** Resultado de uma busca, guardado com o cliente e a tentativa dela. */
interface Loaded {
  key: string;
  attempt: number;
  purchases: HistoryPurchaseView[];
  next: number | null;
  failed: boolean;
}

const DASH = "—";

/**
 * Histórico de compras do cliente na Nova solicitação (dono, 14/11/2026;
 * docs/PURCHASE_HISTORY.md), na coluna ao lado do formulário: os pedidos do
 * cliente escolhido no campo Cliente, do mais recente para o mais antigo,
 * 10 por vez ("Carregar mais"). Trocar o cliente limpa a lista e carrega a
 * do novo; sem cliente, o pedido para escolher; "Compra para estoque"
 * esconde o card. O login do cliente (`self`) vê o histórico dele, sem
 * escolher. Tudo vem pronto do servidor (/api/purchase-history), já com as
 * permissões e no idioma de quem vê.
 */
export function CustomerPurchaseHistory({
  labels,
  self = false,
  className,
}: {
  labels: PurchaseHistoryLabels;
  self?: boolean;
  className?: string;
}) {
  const shared = useRequestCustomer();
  const stock = !self && !!shared?.stock;
  const key = self ? "self" : (shared?.customer?.id ?? null);
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [open, setOpen] = useState<{ key: string | null; ids: string[] }>({
    key: null,
    ids: [],
  });
  const [moreFor, setMoreFor] = useState<string | null>(null);
  const [moreFailed, setMoreFailed] = useState(false);
  const current = useRef(key);
  useEffect(() => {
    current.current = key;
  }, [key]);

  const url = (before: number | null, shown = 0) => {
    const params = new URLSearchParams();
    if (!self && key) params.set("customer", key);
    if (before !== null) params.set("before", String(before));
    if (shown) params.set("shown", String(shown));
    const qs = params.toString();
    return `/api/purchase-history${qs ? `?${qs}` : ""}`;
  };

  // Primeira página do cliente escolhido (e de novo em "Tentar de novo").
  useEffect(() => {
    if (!key || stock) return;
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(url(null), { signal: controller.signal });
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as HistoryPageView;
        setLoaded({
          key,
          attempt,
          purchases: body.purchases,
          next: body.next,
          failed: false,
        });
      } catch {
        if (controller.signal.aborted) return;
        setLoaded({ key, attempt, purchases: [], next: null, failed: true });
      }
    })();
    return () => controller.abort();
    // `url` lê `key` e `self`, que já estão aqui.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt, stock, self]);

  if (stock) return null;

  // O que vale agora: só o resultado deste cliente e desta tentativa.
  const mine =
    key && loaded && loaded.key === key && loaded.attempt === attempt
      ? loaded
      : null;
  const loading = !!key && !mine;
  const expanded = new Set(open.key === key ? open.ids : []);
  const toggle = (id: string) =>
    setOpen({
      key,
      ids: expanded.has(id)
        ? [...expanded].filter((x) => x !== id)
        : [...expanded, id],
    });

  async function loadMore() {
    if (!mine || mine.next === null || !key) return;
    const forKey = key;
    setMoreFor(forKey);
    setMoreFailed(false);
    try {
      const res = await fetch(url(mine.next, mine.purchases.length));
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as HistoryPageView;
      // Trocou de cliente no meio: a página não é mais deste.
      if (current.current !== forKey) return;
      setLoaded((prev) =>
        prev && prev.key === forKey
          ? {
              ...prev,
              purchases: [
                ...prev.purchases,
                ...body.purchases.filter(
                  (p) => !prev.purchases.some((x) => x.id === p.id),
                ),
              ],
              next: body.next,
            }
          : prev,
      );
    } catch {
      if (current.current === forKey) setMoreFailed(true);
    } finally {
      setMoreFor(null);
    }
  }

  const state = !key
    ? "select"
    : loading
      ? "loading"
      : mine?.failed
        ? "error"
        : mine?.purchases.length
          ? "ready"
          : "empty";

  return (
    <div
      className={className}
      data-purchase-history
      data-purchase-history-state={state}
    >
      <Card title={labels.title}>
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
            {labels.error}{" "}
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
        {state === "ready" && mine ? (
          <>
            <p className="mb-1 text-xs leading-relaxed text-zinc-500">
              {labels.hint}
            </p>
            <ul className="divide-y divide-zinc-100">
              {mine.purchases.map((p) => (
                <PurchaseRow
                  key={p.id}
                  purchase={p}
                  open={expanded.has(p.id)}
                  onToggle={() => toggle(p.id)}
                  labels={labels}
                />
              ))}
            </ul>
            {mine.next !== null ? (
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

function PurchaseRow({
  purchase: p,
  open,
  onToggle,
  labels,
}: {
  purchase: HistoryPurchaseView;
  open: boolean;
  onToggle: () => void;
  labels: PurchaseHistoryLabels;
}) {
  // Com a família escolhida no pedido, só os produtos dela.
  const { keep } = useHistoryFamilyFilter();
  const visibleItems = p.items.filter((i) => keep(i.family));
  const detailsId = `purchase-history-${p.id}`;
  return (
    <li data-purchase-history-order={p.number}>
      <button
        type="button"
        onClick={onToggle}
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
            <span className="font-medium text-zinc-900">{p.label}</span>
            <span
              className="text-sm tabular-nums text-zinc-900"
              data-purchase-history-total
            >
              {p.total}
            </span>
          </span>
          <span className="mt-0.5 block text-xs text-zinc-500">
            <span title={p.dateHint ?? undefined} data-purchase-history-date>
              {p.date}
            </span>
            {" · "}
            <span data-purchase-history-status>{p.status}</span>
          </span>
        </span>
      </button>
      {open ? (
        <div
          id={detailsId}
          role="region"
          aria-label={labels.details.replace("{n}", String(p.number))}
          className="space-y-2 pb-3 pl-5"
          data-purchase-history-details
        >
          {p.items.length > visibleItems.length && labels.pick ? (
            <p className="text-xs text-zinc-500" data-history-family-filtered>
              {labels.pick.filtered.replace(
                "{n}",
                String(p.items.length - visibleItems.length),
              )}
            </p>
          ) : null}
          {p.items.length ? (
            visibleItems.map((item, i) => (
              <ItemBlock key={i} item={item} labels={labels} />
            ))
          ) : (
            <p className="text-xs text-zinc-500">{labels.noItems}</p>
          )}
          {p.rounds.length ? (
            <div data-purchase-history-rounds>
              <p className="text-xs font-semibold text-zinc-700">
                {labels.rounds}
              </p>
              <ul className="mt-1 space-y-1.5">
                {p.rounds.map((r, i) => (
                  <li
                    key={r.orderId ?? `planned-${i}`}
                    className="text-xs"
                    data-purchase-history-round={r.orderId ?? ""}
                  >
                    <p className="text-zinc-800">
                      {r.orderId ? (
                        <a
                          href={`/app/orders/${r.orderId}`}
                          target="_blank"
                          rel="noopener"
                          className="underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-500"
                        >
                          {r.label}
                        </a>
                      ) : (
                        r.label
                      )}
                    </p>
                    {r.items.map((item, j) => (
                      <p key={j} className="text-zinc-500">
                        {item.name}:{" "}
                        {item.lines.find((l) => l.key === "quantity")?.value ??
                          DASH}
                      </p>
                    ))}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {/* O pedido em outra aba: a solicitação em andamento fica aqui. */}
          <a
            href={`/app/orders/${p.id}`}
            target="_blank"
            rel="noopener"
            className="inline-block text-xs font-medium text-brand-700 underline underline-offset-2"
            data-purchase-history-open
          >
            {labels.open.replace("{n}", String(p.number))}
          </a>
        </div>
      ) : null}
    </li>
  );
}

function ItemBlock({
  item,
  labels,
}: {
  item: HistoryItemView;
  labels: PurchaseHistoryLabels;
}) {
  return (
    <div
      className="rounded-lg border border-zinc-100 bg-zinc-50/70 px-2.5 py-2"
      data-purchase-history-item
    >
      <HistoryProductName
        name={item.name}
        productId={item.productId}
        labels={labels.pick}
      />
      <div className="mt-1 space-y-0.5 text-xs leading-relaxed">
        {item.lines.map((l) => (
          <Fragment key={l.key}>
            <p className="break-words" data-purchase-history-field={l.key}>
              <span className="text-zinc-500">{l.label}: </span>
              {l.current && l.value !== DASH ? (
                // Valor e selo juntos: na coluna estreita, quebram de linha
                // juntos (o selo não fica sozinho embaixo).
                <span className="inline-block max-w-full">
                  <span className="text-zinc-900">{l.value}</span>
                  <span
                    className="ml-1 inline-block rounded bg-amber-50 px-1 align-baseline text-[10px] font-medium text-amber-800 ring-1 ring-amber-200"
                    title={labels.currentHint}
                    data-purchase-history-current
                  >
                    {labels.current}
                  </span>
                </span>
              ) : (
                <span className="text-zinc-900">{l.value}</span>
              )}
            </p>
          </Fragment>
        ))}
      </div>
    </div>
  );
}
