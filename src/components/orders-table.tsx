"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  Badge,
  cx,
  inputDenseClass,
  linkClass,
  rowClass,
  type Tone,
} from "./ui";
import { ChatOpenButton } from "./chat-open-button";
import { PhotoGallery, type GalleryPhoto } from "./photo-gallery";
import { RowMoreDetails, RowMoreToggle, oneLine } from "./row-more";
import { chatTargetFromHref } from "@/lib/chat-target";
import { TableTools } from "@/components/table-tools";
import {
  ORDERS_FILTER_KEYS as FILTER_KEYS,
  ORDERS_STATE_RANK as STATE_RANK,
  filterOrderRows,
  parseOrdersSort,
  type OrdersFilterKey as FilterKey,
  type OrdersFilters as Filters,
  type OrdersSortKey as SortKey,
} from "@/lib/orders-filter";

/** Textos da galeria de fotos da linha (já no idioma de quem vê). */
type GalleryLabels = {
  title: string;
  close: string;
  open: string;
  count: string;
  noPhoto: string;
};

/*
 * Painel de Pedidos com filtro em todas as colunas (texto ou lista) e
 * ordenação por coluna. O servidor filtra, ordena e manda uma página por vez
 * (com milhares de pedidos do Sankhya, a lista inteira não cabia); a tela
 * aplica o filtro na hora sobre a página e pede a nova ao servidor. Os filtros
 * ficam no endereço (?p=…&st=…&pg=…), então voltar, recarregar ou mandar o
 * link mantém.
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
  /** Posição na viagem (0–100), a mesma dos quadrados da Control Tower. */
  progress: number | null;
  /** Passo da viagem (chave) e o nome dele, no idioma de quem vê. */
  step: string | null;
  stepLabel: string | null;
  due: string;
  dueLabel: string;
  /**
   * Foto, código, especificação, caixas, volume e peso (como a folha do
   * fornecedor). Só a Wellmix: para os demais o servidor nem manda.
   */
  detail?: OrdersItemDetail | null;
}

/** Valores já formatados no servidor (nulo = "—"). */
export interface OrdersItemDetail {
  photos: GalleryPhoto[];
  gallery: GalleryLabels;
  sku: string | null;
  supplierSku: string | null;
  specification: string | null;
  color: string | null;
  weight: string | null;
  perBox: string | null;
  boxes: string | null;
  cbm: string | null;
  /** Preço × quantidade (mesma moeda do preço). */
  amount: string | null;
}

/** Linha de total da tabela de itens (itens cancelados ficam de fora). */
export interface OrdersItemsTotals {
  weight: string | null;
  quantity: string | null;
  boxes: string | null;
  cbm: string | null;
  amount: string | null;
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
  /** Posição na viagem do produto mais atrasado do grupo (0–100). */
  progress: number | null;
  step: string | null;
  stepLabel: string | null;
  /** AAAA-MM-DD (dia) ou vazio. */
  due: string;
  dueLabel: string;
  updated: string;
  updatedLabel: string;
  /** Total da tabela de itens (só com os detalhes da Wellmix). */
  itemsTotals?: OrdersItemsTotals | null;
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
  /** Filtro de Progresso: os passos da viagem (valor, texto), na ordem. */
  journey: {
    groupRequest: string;
    groupOrder: string;
    steps: Array<[string, string]>;
    cancelled: string;
    /** "Parou em: {step}" (pedido cancelado). */
    stoppedAt: string;
  };
  dueOptions: { overdue: string; week: string; none: string };
  updatedOptions: { today: string; week: string; month: string };
  request: string;
  /** "{shown} de {total}" */
  count: string;
  /** "Página {page} de {pages}" e os botões da paginação. */
  pageOf: string;
  pagePrev: string;
  pageNext: string;
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
  /** Colunas da folha do fornecedor (tabela de itens com detalhes). */
  image: string;
  code: string;
  itemCode: string;
  spec: string;
  color: string;
  weight: string;
  perBox: string;
  boxes: string;
  cbm: string;
  amount: string;
  total: string;
  /** Setinha da linha do item: abre os textos inteiros embaixo. */
  more: string;
}

const STATE_TONE: Record<RowState, Tone> = {
  active: "info",
  blocked: "warning",
  done: "success",
  cancelled: "danger",
};
export function OrdersTable({
  rows,
  showCustomer,
  showSupplier,
  labels,
  initial,
  today,
  paging,
}: {
  rows: OrdersTableRow[];
  showCustomer: boolean;
  showSupplier: boolean;
  labels: OrdersTableLabels;
  /** Filtros e ordem vindos do endereço. */
  initial: Partial<Filters> & { sort?: string };
  /** Dia de hoje (AAAA-MM-DD, Brasília), do servidor. */
  today: string;
  /**
   * Paginação do servidor: `rows` é só a página; `matched` são as linhas que
   * passam no filtro e `total`, todas. As listas dos filtros vêm de todas.
   */
  paging?: {
    page: number;
    pages: number;
    matched: number;
    total: number;
    phases: Array<[string, string]>;
    states: RowState[];
  };
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const typing = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (typing.current) clearTimeout(typing.current);
    },
    [],
  );
  const [filters, setFilters] = useState<Filters>(
    () =>
      Object.fromEntries(
        FILTER_KEYS.map((k) => [k, initial[k] ?? ""]),
      ) as Filters,
  );
  // Linha escolhida: os itens dela aparecem no painel de baixo (como no
  // Sankhya). Sem escolha, vale a primeira da lista filtrada.
  const [picked, setPicked] = useState<string | null>(null);
  // Só colunas conhecidas (link editado ou antigo não quebra a tela).
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean } | null>(() =>
    parseOrdersSort(initial.sort),
  );

  // Filtros e ordem no endereço. Com paginação do servidor, o endereço novo
  // pede a página certa (texto: espera a pessoa parar de digitar).
  function sync(
    next: Filters,
    nextSort: typeof sort,
    options: { wait?: boolean; page?: number } = {},
  ) {
    try {
      const url = new URL(window.location.href);
      if (options.page && options.page > 1)
        url.searchParams.set("pg", String(options.page));
      else url.searchParams.delete("pg");
      for (const k of FILTER_KEYS)
        if (next[k]) url.searchParams.set(k, next[k]);
        else url.searchParams.delete(k);
      if (nextSort)
        url.searchParams.set(
          "sort",
          `${nextSort.desc ? "-" : ""}${nextSort.key}`,
        );
      else url.searchParams.delete("sort");
      if (paging) {
        if (typing.current) clearTimeout(typing.current);
        const go = () =>
          startTransition(() =>
            router.replace(`${url.pathname}${url.search}`, { scroll: false }),
          );
        if (options.wait) typing.current = setTimeout(go, 400);
        else go();
        return;
      }
      // Estado nulo: o Next acompanha a troca de endereço (useSearchParams).
      window.history.replaceState(null, "", url);
    } catch {
      // Sem histórico (tela embutida): os filtros valem só na tela.
    }
  }
  function setFilter(key: FilterKey, value: string, wait = false) {
    const next = { ...filters, [key]: value };
    setFilters(next);
    sync(next, sort, { wait });
  }
  function goToPage(page: number) {
    sync(filters, sort, { page });
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

  const localPhases = useMemo(() => {
    const seen = new Map<string, { label: string; rank: number }>();
    for (const r of rows)
      if (!seen.has(r.phaseKey))
        seen.set(r.phaseKey, { label: r.phase, rank: r.phaseRank });
    return [...seen.entries()]
      .sort((a, b) => a[1].rank - b[1].rank)
      .map(([key, v]) => [key, v.label] as [string, string]);
  }, [rows]);
  const localStates = useMemo(
    () =>
      (Object.keys(STATE_RANK) as RowState[]).filter((s) =>
        rows.some((r) => r.state === s),
      ),
    [rows],
  );
  const phases = paging?.phases ?? localPhases;
  const states = paging?.states ?? localStates;

  const shown = useMemo(
    () =>
      filterOrderRows(rows, filters, sort, {
        today,
        showCustomer,
        showSupplier,
      }),
    [rows, filters, sort, today, showCustomer, showSupplier],
  );

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
      onChange={(e) => setFilter(key, e.target.value, true)}
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
            .replace("{shown}", String(paging?.matched ?? shown.length))
            .replace("{total}", String(paging?.total ?? rows.length))}
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
      <TableTools
        tableClassName="min-w-[56rem]"
        sortable={false}
        searchable={false}
        paginated={!paging}
      >
        <thead>
          <tr>
            {head("number", labels.number, "w-24")}
            {head("product", labels.product)}
            {showCustomer ? head("customer", labels.customer) : null}
            {showSupplier ? head("supplier", labels.supplier) : null}
            {head("phase", labels.phase)}
            {head("state", labels.state)}
            {head("progress", labels.progress, "w-44")}
            {head("due", labels.due)}
            {head("updated", labels.updated)}
            <th className="w-10 px-2.5 py-2" />
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
              <select
                value={filters.pr}
                onChange={(e) => setFilter("pr", e.target.value)}
                aria-label={labels.progress}
                className={control}
                data-orders-filter="pr"
              >
                <option value="">{labels.all}</option>
                {[
                  [labels.journey.groupRequest, "req"],
                  [labels.journey.groupOrder, "ord"],
                ].map(([group, prefix]) => {
                  const options = labels.journey.steps.filter(([value]) =>
                    value.startsWith(prefix),
                  );
                  return options.length ? (
                    <optgroup key={prefix} label={group}>
                      {options.map(([value, text]) => (
                        <option key={value} value={value}>
                          {text}
                        </option>
                      ))}
                    </optgroup>
                  ) : null;
                })}
                <option value="cancelled">{labels.journey.cancelled}</option>
              </select>,
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
            <td className="px-2.5 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {shown.length === 0 ? (
            <tr>
              <td
                colSpan={8 + (showCustomer ? 1 : 0) + (showSupplier ? 1 : 0)}
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
                    selected && "bg-brand-50 ring-1 ring-inset ring-brand-200",
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
                    <Link href={r.href} className={linkClass}>
                      {r.number}
                    </Link>
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
                    <JourneyBar
                      progress={r.progress}
                      label={r.stepLabel}
                      step={r.step}
                      cancelled={r.state === "cancelled"}
                      stoppedAt={labels.journey.stoppedAt}
                    />
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
                  {/* Conversa do pedido/solicitação: sempre na última coluna. */}
                  <td className="whitespace-nowrap px-2.5 py-2 text-right">
                    {chatTargetFromHref(r.href) ? (
                      <ChatOpenButton
                        target={chatTargetFromHref(r.href)!}
                        label={labels.chat}
                      />
                    ) : null}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </TableTools>
      {paging && paging.pages > 1 ? (
        <nav
          className="mt-2 flex items-center justify-end gap-3 text-sm text-zinc-600"
          data-orders-pager
        >
          <button
            type="button"
            disabled={paging.page <= 1}
            onClick={() => goToPage(paging.page - 1)}
            className="rounded-md border border-zinc-200 px-2.5 py-1 disabled:opacity-40"
            data-orders-page-prev
          >
            {labels.pagePrev}
          </button>
          <span data-orders-page>
            {labels.pageOf
              .replace("{page}", String(paging.page))
              .replace("{pages}", String(paging.pages))}
          </span>
          <button
            type="button"
            disabled={paging.page >= paging.pages}
            onClick={() => goToPage(paging.page + 1)}
            className="rounded-md border border-zinc-200 px-2.5 py-1 disabled:opacity-40"
            data-orders-page-next
          >
            {labels.pageNext}
          </button>
        </nav>
      ) : null}
      <ItemsPanel
        row={current}
        labels={labels}
        showSupplier={showSupplier}
        today={today}
      />
    </div>
  );
}

/**
 * Painel de itens da linha escolhida (embaixo da lista, como no Sankhya).
 * Para a Wellmix, as colunas da folha do fornecedor (foto, código, cód. do
 * item, especificação, cor, peso, quantidade por caixa, caixas, volume e
 * valor) e a linha de total; os demais veem a tabela de sempre.
 */
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
  const detailed = !!row?.items.some((i) => i.detail);
  // Colunas da tabela de itens (a faixa do "ver mais" ocupa todas).
  const columns =
    3 + // nº, produto, variação
    (detailed ? 9 : 0) + // imagem, código, cód. do item, especificação, cor, peso, qtd. por caixa, caixas, volume
    1 + // quantidade
    (withPrice ? 1 : 0) +
    (withPrice && detailed ? 1 : 0) +
    (showSupplier ? 1 : 0) +
    6; // pedido, etapa, progresso, situação, prazo, conversa
  const cell = "whitespace-nowrap px-2.5 py-2";
  const num = cx(cell, "text-right tabular-nums");
  const dash = (v: string | null | undefined) => v ?? "—";
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
          <table
            className={cx(
              "w-full text-left text-sm",
              detailed ? "min-w-[72rem]" : "min-w-[40rem]",
            )}
            data-orders-items-detailed={detailed ? "" : undefined}
          >
            <thead>
              <tr className="align-bottom text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                <th className="px-2.5 py-2">{labels.seq}</th>
                {detailed ? (
                  <th className="w-14 px-2.5 py-2">{labels.image}</th>
                ) : null}
                <th className="px-2.5 py-2">{labels.product}</th>
                <th className="px-2.5 py-2">{labels.variant}</th>
                {detailed ? (
                  <>
                    <th className="px-2.5 py-2">{labels.code}</th>
                    <th className="px-2.5 py-2">{labels.itemCode}</th>
                    <th className="px-2.5 py-2">{labels.spec}</th>
                    <th className="px-2.5 py-2">{labels.color}</th>
                    <th className="px-2.5 py-2 text-right">{labels.weight}</th>
                  </>
                ) : null}
                <th className="px-2.5 py-2 text-right">{labels.quantity}</th>
                {detailed ? (
                  <>
                    <th className="px-2.5 py-2 text-right">{labels.perBox}</th>
                    <th className="px-2.5 py-2 text-right">{labels.boxes}</th>
                    <th className="px-2.5 py-2 text-right">{labels.cbm}</th>
                  </>
                ) : null}
                {withPrice ? (
                  <th className="px-2.5 py-2 text-right">{labels.price}</th>
                ) : null}
                {withPrice && detailed ? (
                  <th className="px-2.5 py-2 text-right">{labels.amount}</th>
                ) : null}
                {showSupplier ? (
                  <th className="px-2.5 py-2">{labels.supplier}</th>
                ) : null}
                <th className="px-2.5 py-2">{labels.ref}</th>
                <th className="px-2.5 py-2">{labels.phase}</th>
                <th className="w-40 px-2.5 py-2">{labels.progress}</th>
                <th className="px-2.5 py-2">{labels.state}</th>
                <th className="px-2.5 py-2">{labels.due}</th>
                <th className="w-10 px-2.5 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {row.items.map((item, i) => {
                const late =
                  !!item.due &&
                  item.due < today &&
                  (item.state === "active" || item.state === "blocked");
                const d = item.detail ?? null;
                return (
                  <Fragment key={i}>
                    <tr
                      className={cx(
                        rowClass,
                        detailed && item.state === "cancelled" && "opacity-60",
                      )}
                      data-orders-item
                    >
                      {/* Linha fina: o que não cabe termina em "…"; a setinha abre tudo embaixo. */}
                      <td className={cx(cell, "tabular-nums text-zinc-500")}>
                        <RowMoreToggle label={labels.more} />
                        {i + 1}
                      </td>
                      {detailed ? (
                        <td className="w-14 px-2.5 py-1.5">
                          {d ? (
                            <PhotoGallery
                              name={item.name}
                              photos={d.photos}
                              labels={d.gallery}
                            />
                          ) : (
                            "—"
                          )}
                        </td>
                      ) : null}
                      <td className="max-w-56 px-2.5 py-2 font-medium text-zinc-900">
                        <span className={oneLine}>{item.name}</span>
                      </td>
                      <td className="max-w-40 px-2.5 py-2 text-zinc-600">
                        <span className={oneLine}>{item.variant ?? "—"}</span>
                      </td>
                      {detailed ? (
                        <>
                          <td className={cell}>
                            <span className="font-mono text-xs text-zinc-700">
                              {dash(d?.sku)}
                            </span>
                          </td>
                          <td className={cell}>
                            <span className="font-mono text-xs text-zinc-700">
                              {dash(d?.supplierSku)}
                            </span>
                          </td>
                          <td className="px-2.5 py-2">
                            <span
                              className="block max-w-48 truncate"
                              title={d?.specification ?? undefined}
                              data-orders-item-spec
                            >
                              {dash(d?.specification)}
                            </span>
                          </td>
                          <td className="px-2.5 py-2">
                            <span className={cx(oneLine, "max-w-32")}>
                              {dash(d?.color)}
                            </span>
                          </td>
                          <td className={num} data-orders-item-weight>
                            {dash(d?.weight)}
                          </td>
                        </>
                      ) : null}
                      <td
                        className={cx(num, detailed && "font-semibold")}
                        data-orders-item-qty
                      >
                        {item.quantity}
                      </td>
                      {detailed ? (
                        <>
                          <td className={num}>{dash(d?.perBox)}</td>
                          <td className={num} data-orders-item-boxes>
                            {dash(d?.boxes)}
                          </td>
                          <td className={num} data-orders-item-cbm>
                            {dash(d?.cbm)}
                          </td>
                        </>
                      ) : null}
                      {withPrice ? (
                        <td className={num}>{item.price ?? "—"}</td>
                      ) : null}
                      {withPrice && detailed ? (
                        <td className={num}>{dash(d?.amount)}</td>
                      ) : null}
                      {showSupplier ? (
                        <td className="max-w-40 px-2.5 py-2">
                          <span className={oneLine}>
                            {item.supplier || "—"}
                          </span>
                        </td>
                      ) : null}
                      <td className={cell}>
                        <Link href={item.href} className={linkClass}>
                          {item.ref}
                        </Link>
                      </td>
                      <td className={cell}>{item.phase}</td>
                      <td className="w-40 px-2.5 py-2">
                        <JourneyBar
                          progress={item.progress}
                          label={item.stepLabel}
                          step={item.step}
                          cancelled={item.state === "cancelled"}
                          stoppedAt={labels.journey.stoppedAt}
                        />
                      </td>
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
                      {/* Conversa do item (desce até o produto): última coluna. */}
                      <td className={cx(cell, "text-right")}>
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
                      </td>
                    </tr>
                    <RowMoreDetails
                      colSpan={columns}
                      items={[
                        [labels.product, item.name],
                        [labels.variant, item.variant],
                        ...(detailed
                          ? ([
                              [labels.code, d?.sku],
                              [labels.itemCode, d?.supplierSku],
                              [labels.color, d?.color],
                            ] as Array<[string, string | null | undefined]>)
                          : []),
                        ...(showSupplier
                          ? ([[labels.supplier, item.supplier]] as Array<
                              [string, string]
                            >)
                          : []),
                        ...(detailed
                          ? ([[labels.spec, d?.specification, true]] as Array<
                              [string, string | null | undefined, boolean]
                            >)
                          : []),
                      ]}
                    />
                  </Fragment>
                );
              })}
              {detailed && row.itemsTotals ? (
                <tr
                  className="bg-amber-50/60 font-semibold"
                  data-orders-items-total
                >
                  {/* Nº, imagem, produto, variação, código, cód. do item, especificação e cor. */}
                  <td colSpan={8} className={cell}>
                    {labels.total}
                  </td>
                  <td className={num}>{dash(row.itemsTotals.weight)}</td>
                  <td className={num}>{dash(row.itemsTotals.quantity)}</td>
                  <td />
                  <td className={num}>{dash(row.itemsTotals.boxes)}</td>
                  <td className={num}>{dash(row.itemsTotals.cbm)}</td>
                  {withPrice ? (
                    <>
                      <td />
                      <td className={num}>{dash(row.itemsTotals.amount)}</td>
                    </>
                  ) : null}
                  {/* Pedido, etapa, progresso, situação, prazo, conversa (e fornecedor). */}
                  <td colSpan={6 + (showSupplier ? 1 : 0)} />
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** Barra da viagem com o nome do passo; no cancelado, cinza e onde parou. */
function JourneyBar({
  progress,
  label,
  step,
  cancelled,
  stoppedAt,
}: {
  progress: number | null;
  label: string | null;
  step: string | null;
  cancelled: boolean;
  /** "Parou em: {step}" */
  stoppedAt: string;
}) {
  if (progress === null) return <span className="text-zinc-400">—</span>;
  return (
    <div className="min-w-0" data-orders-journey={step ?? ""}>
      <div className="flex h-5 items-center gap-2">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
          <div
            className={cx(
              "h-full rounded-full",
              cancelled ? "bg-zinc-400" : "bg-brand-600",
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="w-9 shrink-0 text-right text-xs font-semibold tabular-nums text-zinc-600">
          {progress}%
        </span>
      </div>
      {label ? (
        <span
          className={cx(
            "block text-[11px] leading-tight",
            cancelled ? "text-zinc-400" : "text-zinc-600",
          )}
        >
          {cancelled ? stoppedAt.replace("{step}", label) : label}
        </span>
      ) : null}
    </div>
  );
}
