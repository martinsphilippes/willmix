"use client";

import Link from "next/link";
import { StatusLink } from "./status-link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Badge,
  cx,
  inputDenseClass,
  linkClass,
  OpenLink,
  rowClass,
  type Tone,
} from "./ui";
import { ChatOpenButton } from "./chat-open-button";
import { PhotoGallery, type GalleryPhoto } from "./photo-gallery";
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
  /** Tabela padrão de itens (docs/ORDER_TABLES.md). */
  description?: string;
  /** De quem é a vez (o que o item espera). */
  turn?: string;
  turnLabel?: string;
  turnTone?: "brand" | "warning" | "info" | "danger" | "neutral";
  /** Preço Wellmix sem frete e com frete (só com "Ver valores e margem"). */
  priceIpi?: string | null;
  priceIpiFreight?: string | null;
  perInner?: string | null;
  pieces?: string | null;
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
  /**
   * Produtos diferentes (SKUs) do pedido: a lista é no nível do pedido (dono,
   * 18/11/2026), sem o nome do produto; os produtos ficam nos itens embaixo
   * e na página do pedido.
   */
  productCount?: number;
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
  /**
   * Quem está com a vez (docs/TURNS.md): a parte (o filtro guarda), o texto
   * ("Aguardando cliente") e o tom do selo; vazio quando ninguém.
   */
  turn: string;
  turnLabel: string;
  turnTone: "brand" | "warning" | "info" | "danger" | "neutral";
  /** Total da tabela de itens (só com os detalhes da Wellmix). */
  itemsTotals?: OrdersItemsTotals | null;
  /** Tabela padrão de pedidos (docs/ORDER_TABLES.md); vazio = "—". */
  std?: {
    track: string;
    negotiationDate: string;
    saleType: string;
    paymentTerm: string;
    paymentMethod: string;
    billing: string;
    vip: string;
    group: string;
    customerCode: string;
    deliveries: string;
    cbm: string;
    value: string;
  };
}

export interface OrdersTableLabels {
  number: string;
  product: string;
  /** "Produtos" (contagem de SKUs, no lugar do nome do produto). */
  products?: string;
  customer: string;
  supplier: string;
  phase: string;
  state: string;
  /** "Com quem está" (docs/TURNS.md). */
  turn: string;
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
  /** Cabeçalhos das tabelas padrão (pedidos e itens), pela chave da coluna. */
  std: Record<string, string>;
  stdItem: Record<string, string>;
  /** "Track ID {id}" */
  track: string;
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
  showTerms,
  showValue,
  labels,
  initial,
  today,
  paging,
}: {
  rows: OrdersTableRow[];
  showCustomer: boolean;
  showSupplier: boolean;
  /** Condições do pedido (tipo de venda, pagamento, entregas e m³): Wellmix e cliente. */
  showTerms: boolean;
  /** Valor do pedido: só com "Ver valores e margem". */
  showValue: boolean;
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
    /** Valor, texto e, nos marcos, o bloco (grupo da lista). */
    phases: Array<[string, string, string?]>;
    states: RowState[];
    /** Com quem está a vez: as partes presentes (valor, texto). */
    turns: Array<[string, string]>;
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
  const phases: Array<[string, string, string?]> =
    paging?.phases ?? localPhases;
  const states = paging?.states ?? localStates;
  // Com quem está a vez: as partes das linhas (sem o servidor paginando).
  const localTurns = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rows)
      if (r.turn && !seen.has(r.turn)) seen.set(r.turn, r.turnLabel);
    return [...seen.entries()] as Array<[string, string]>;
  }, [rows]);
  const turns = paging?.turns ?? localTurns;

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
  /** Coluna padrão sem ordenação (o dado só existe nas linhas da página). */
  const plain = (key: string) => (
    <th
      className="whitespace-nowrap border-b border-zinc-200 bg-zinc-50/80 px-2.5 pt-2 text-left align-bottom text-[11px] font-semibold uppercase tracking-wide text-zinc-500"
      data-order-head={key}
    >
      {labels.std[key]}
    </th>
  );
  const columnCount =
    6 + // nº, data, status, situação, prazo, itens
    1 + // abrir e conversa
    (showTerms ? 6 : 0) +
    (showCustomer ? 4 : 0) +
    (showValue ? 1 : 0) +
    (showSupplier ? 1 : 0);
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
      {/* Filtros de colunas que saíram da tabela padrão (situação da linha,
          progresso e atualização): seguem valendo, aqui em cima. */}
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-zinc-600">
        <label className="inline-flex items-center gap-1">
          {labels.state}
          {select(
            "st",
            labels.state,
            states.map((s) => [s, labels.states[s]]),
          )}
        </label>
        <label className="inline-flex items-center gap-1">
          {labels.progress}
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
          </select>
        </label>
        <label className="inline-flex items-center gap-1">
          {labels.updated}
          {select("u", labels.updated, [
            ["today", labels.updatedOptions.today],
            ["week", labels.updatedOptions.week],
            ["month", labels.updatedOptions.month],
          ])}
        </label>
      </div>
      {/* Tabela padrão de pedidos (dono, 22/11/2026; docs/ORDER_TABLES.md):
          as mesmas colunas, na mesma ordem, de toda lista de pedidos. */}
      <TableTools
        tableClassName="min-w-[96rem]"
        sortable={false}
        searchable={false}
        paginated={!paging}
      >
        <thead>
          <tr>
            {head("number", labels.std.number, "w-24")}
            {plain("negotiationDate")}
            {showTerms ? plain("saleType") : null}
            {showTerms ? plain("paymentTerm") : null}
            {showTerms ? plain("paymentMethod") : null}
            {showTerms ? plain("billing") : null}
            {showCustomer ? plain("vip") : null}
            {showCustomer ? plain("group") : null}
            {showCustomer ? plain("customerCode") : null}
            {showCustomer ? head("customer", labels.std.customerName) : null}
            {plain("status")}
            {head("phase", labels.std.step)}
            {head("due", labels.std.sla)}
            {head("product", labels.std.items)}
            {showTerms ? plain("deliveries") : null}
            {showTerms ? plain("cbm") : null}
            {showValue ? plain("value") : null}
            {showSupplier ? head("supplier", labels.std.supplier) : null}
            <th className="w-10 border-b border-zinc-200 bg-zinc-50/80 px-2.5 py-2" />
          </tr>
          <tr>
            {filterCell(text("n", labels.std.number))}
            {filterCell(null)}
            {showTerms ? filterCell(null) : null}
            {showTerms ? filterCell(null) : null}
            {showTerms ? filterCell(null) : null}
            {showTerms ? filterCell(null) : null}
            {showCustomer ? filterCell(null) : null}
            {showCustomer ? filterCell(null) : null}
            {showCustomer ? filterCell(null) : null}
            {showCustomer ? filterCell(text("c", labels.customer)) : null}
            {filterCell(select("w", labels.turn, turns))}
            {filterCell(
              <select
                value={filters.ph}
                onChange={(e) => setFilter("ph", e.target.value)}
                aria-label={labels.phase}
                className={control}
                data-orders-filter="ph"
              >
                <option value="">{labels.all}</option>
                {phaseGroups(phases).map(({ group, options }, i) =>
                  group ? (
                    <optgroup key={`${group}-${i}`} label={group}>
                      {options.map(([value, text]) => (
                        <option key={value} value={value}>
                          {text}
                        </option>
                      ))}
                    </optgroup>
                  ) : (
                    options.map(([value, text]) => (
                      <option key={value} value={value}>
                        {text}
                      </option>
                    ))
                  ),
                )}
              </select>,
            )}
            {filterCell(
              select("d", labels.due, [
                ["overdue", labels.dueOptions.overdue],
                ["week", labels.dueOptions.week],
                ["none", labels.dueOptions.none],
              ]),
            )}
            {filterCell(text("p", labels.product))}
            {showTerms ? filterCell(null) : null}
            {showTerms ? filterCell(null) : null}
            {showValue ? filterCell(null) : null}
            {showSupplier ? filterCell(text("s", labels.supplier)) : null}
            {filterCell(null)}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {shown.length === 0 ? (
            <tr>
              <td
                colSpan={columnCount}
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
              const std = r.std;
              const td = "whitespace-nowrap px-2.5 py-2";
              const numTd = cx(td, "text-right tabular-nums");
              const dash = (v: string | undefined) => v || "—";
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
                  <td className={td}>
                    <Link href={r.href} className={linkClass}>
                      {r.number}
                    </Link>
                    {r.subtitle ? (
                      <span className="block text-[11px] text-zinc-500">
                        {r.subtitle}
                      </span>
                    ) : null}
                    {std?.track ? (
                      <span
                        className="block text-[11px] text-zinc-500"
                        data-order-track
                      >
                        {labels.track.replace("{id}", std.track)}
                      </span>
                    ) : null}
                  </td>
                  <td
                    className={cx(td, "tabular-nums")}
                    data-order-col="negotiationDate"
                  >
                    {dash(std?.negotiationDate)}
                  </td>
                  {showTerms ? (
                    <>
                      <td className={td} data-order-col="saleType">
                        {dash(std?.saleType)}
                      </td>
                      <td className={numTd} data-order-col="paymentTerm">
                        {dash(std?.paymentTerm)}
                      </td>
                      <td
                        className="px-2.5 py-2"
                        data-order-col="paymentMethod"
                      >
                        {dash(std?.paymentMethod)}
                      </td>
                      <td className={td} data-order-col="billing">
                        {dash(std?.billing)}
                      </td>
                    </>
                  ) : null}
                  {showCustomer ? (
                    <>
                      <td className={td} data-order-col="vip">
                        {dash(std?.vip)}
                      </td>
                      <td className="px-2.5 py-2" data-order-col="group">
                        {dash(std?.group)}
                      </td>
                      <td className={numTd} data-order-col="customerCode">
                        {dash(std?.customerCode)}
                      </td>
                      <td
                        className="min-w-32 px-2.5 py-2"
                        data-order-col="customerName"
                      >
                        {r.customer || "—"}
                      </td>
                    </>
                  ) : null}
                  {/* Status: o que o pedido espera (de quem é a vez);
                      encerrado ou cancelado, isso mesmo. */}
                  <td className={td} data-orders-turn={r.turn || undefined}>
                    {r.turn ? (
                      // O status leva ao lugar de agir (dono, 24/11/2026):
                      // o pedido, com a etapa atual e os itens dela.
                      <StatusLink tone={r.turnTone} href={r.href}>
                        {r.turnLabel}
                      </StatusLink>
                    ) : r.state === "done" || r.state === "cancelled" ? (
                      <Badge tone={STATE_TONE[r.state]}>
                        {labels.states[r.state]}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </td>
                  {/* Situação: o momento do passo em que ele está. */}
                  <td className={td} data-order-col="step">
                    {r.phase}
                    {r.state === "blocked" ? (
                      <>
                        {" "}
                        <Badge tone={STATE_TONE.blocked}>
                          {labels.states.blocked}
                        </Badge>
                      </>
                    ) : null}
                  </td>
                  <td
                    className={cx(
                      td,
                      "tabular-nums",
                      overdue && "font-semibold text-red-700",
                    )}
                    data-order-col="sla"
                  >
                    {r.dueLabel}
                  </td>
                  <td
                    className={numTd}
                    title={r.product}
                    data-orders-products={r.productCount ?? r.items.length}
                  >
                    {r.productCount ?? r.items.length}
                  </td>
                  {showTerms ? (
                    <>
                      <td className={numTd} data-order-col="deliveries">
                        {dash(std?.deliveries)}
                      </td>
                      <td className={numTd} data-order-col="cbm">
                        {dash(std?.cbm)}
                      </td>
                    </>
                  ) : null}
                  {showValue ? (
                    <td className={numTd} data-order-col="value">
                      {dash(std?.value)}
                    </td>
                  ) : null}
                  {showSupplier ? (
                    <td
                      className="min-w-32 px-2.5 py-2"
                      data-order-col="supplier"
                    >
                      {r.supplier || "—"}
                    </td>
                  ) : null}
                  {/* Conversa do pedido/solicitação: sempre na última coluna. */}
                  <td className={cx(td, "text-right")}>
                    <OpenLink
                      href={r.href}
                      label={
                        r.isRequest ? labels.openRequest : labels.openOrder
                      }
                      className="align-middle"
                    />
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
        showValue={showValue}
        today={today}
      />
    </div>
  );
}

/**
 * Painel de itens da linha escolhida (embaixo da lista, como no Sankhya), na
 * tabela padrão de itens do pedido (dono, 22/11/2026; docs/ORDER_TABLES.md).
 * Foto, código, embalagem e m³ só saem do servidor para a Wellmix; os
 * valores, só com "Ver valores e margem". No nível do item não há o que abrir.
 */
function ItemsPanel({
  row,
  labels,
  showValue,
  today,
}: {
  row: OrdersTableRow | null;
  labels: OrdersTableLabels;
  showValue: boolean;
  today: string;
}) {
  const detailed = !!row?.items.some((i) => i.detail);
  const cell = "whitespace-nowrap px-2.5 py-2";
  const num = cx(cell, "text-right tabular-nums");
  const dash = (v: string | null | undefined) => v || "—";
  const h = labels.stdItem;
  const th = "whitespace-nowrap px-2.5 py-2";
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
          <OpenLink
            href={row.href}
            label={row.isRequest ? labels.openRequest : labels.openOrder}
          />
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
              detailed ? "min-w-[80rem]" : "min-w-[40rem]",
            )}
            data-orders-items-detailed={detailed ? "" : undefined}
          >
            <thead>
              <tr className="align-bottom text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                <th className={th}>{h.sequence}</th>
                {detailed ? (
                  <th className={cx(th, "w-14")}>{h.photo}</th>
                ) : null}
                <th className={th}>{h.step}</th>
                <th className={th}>{h.status}</th>
                <th className={th}>{h.sla}</th>
                {detailed ? <th className={th}>{h.code}</th> : null}
                <th className={th}>{h.description}</th>
                {showValue ? (
                  <>
                    <th className={cx(th, "text-right")}>{h.priceNoIpi}</th>
                    <th className={cx(th, "text-right")}>{h.priceIpi}</th>
                    <th className={cx(th, "text-right")}>
                      {h.priceIpiFreight}
                    </th>
                  </>
                ) : null}
                {detailed ? (
                  <>
                    <th className={cx(th, "text-right")}>{h.perBox}</th>
                    <th className={cx(th, "text-right")}>{h.perInner}</th>
                    <th className={cx(th, "text-right")}>{h.boxes}</th>
                  </>
                ) : null}
                <th className={cx(th, "text-right")}>{h.pieces}</th>
                {detailed ? (
                  <th className={cx(th, "text-right")}>{h.cbm}</th>
                ) : null}
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
                const description = item.description ?? item.name;
                return (
                  <tr
                    key={i}
                    className={cx(
                      rowClass,
                      item.state === "cancelled" && "opacity-60",
                    )}
                    data-orders-item
                  >
                    <td className={cx(cell, "tabular-nums text-zinc-500")}>
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
                    {/* Situação: o momento do passo em que o item está. */}
                    <td className={cell}>
                      <Link href={item.href} className={linkClass}>
                        {item.phase || "—"}
                      </Link>
                    </td>
                    {/* Status: o que ele espera (de quem é a vez). */}
                    <td className={cell}>
                      {item.turn ? (
                        <StatusLink
                          tone={item.turnTone ?? "neutral"}
                          href={item.href}
                        >
                          {item.turnLabel}
                        </StatusLink>
                      ) : item.state === "done" ||
                        item.state === "cancelled" ? (
                        <Badge tone={STATE_TONE[item.state]}>
                          {labels.states[item.state]}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td
                      className={cx(
                        cell,
                        "tabular-nums",
                        late && "font-semibold text-red-700",
                      )}
                    >
                      {item.dueLabel || "—"}
                    </td>
                    {detailed ? (
                      <td className={cell}>
                        <span className="font-mono text-xs text-zinc-700">
                          {dash(d?.sku)}
                        </span>
                      </td>
                    ) : null}
                    <td className="max-w-80 px-2.5 py-2 font-medium text-zinc-900">
                      <span
                        className="block truncate"
                        title={description}
                        data-orders-item-description
                      >
                        {description}
                      </span>
                    </td>
                    {showValue ? (
                      <>
                        <td className={num}>—</td>
                        <td className={num}>{dash(item.priceIpi)}</td>
                        <td className={num}>{dash(item.priceIpiFreight)}</td>
                      </>
                    ) : null}
                    {detailed ? (
                      <>
                        <td className={num}>{dash(d?.perBox)}</td>
                        <td className={num}>{dash(item.perInner)}</td>
                        <td className={num} data-orders-item-boxes>
                          {dash(d?.boxes)}
                        </td>
                      </>
                    ) : null}
                    <td
                      className={cx(num, "font-semibold")}
                      data-orders-item-qty
                    >
                      {item.pieces ?? item.quantity}
                    </td>
                    {detailed ? (
                      <td className={num} data-orders-item-cbm>
                        {dash(d?.cbm)}
                      </td>
                    ) : null}
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
                );
              })}
              {detailed && row.itemsTotals ? (
                <tr
                  className="bg-amber-50/60 font-semibold"
                  data-orders-items-total
                >
                  {/* Seq., foto, situação, status, prazo, código e descrição
                      (e os três valores). */}
                  <td colSpan={7 + (showValue ? 3 : 0)} className={cell}>
                    {labels.total}
                  </td>
                  <td />
                  <td />
                  <td className={num}>{dash(row.itemsTotals.boxes)}</td>
                  <td className={num}>{dash(row.itemsTotals.quantity)}</td>
                  <td className={num}>{dash(row.itemsTotals.cbm)}</td>
                  <td />
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** Opções do filtro de marco em grupos seguidos (os marcos pelo bloco). */
function phaseGroups(options: Array<[string, string, string?]>) {
  const out: Array<{ group: string | null; options: Array<[string, string]> }> =
    [];
  for (const [value, text, group] of options) {
    const last = out[out.length - 1];
    if (last && last.group === (group ?? null))
      last.options.push([value, text]);
    else out.push({ group: group ?? null, options: [[value, text]] });
  }
  return out;
}
