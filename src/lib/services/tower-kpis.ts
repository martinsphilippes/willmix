import "server-only";

import {
  getStore,
  type Order,
  type Penalty,
  type Requirement,
  type ReviewItem,
} from "@/lib/db";
import { listColumns } from "@/lib/db/lookup";
import { isSchemaMissing } from "@/lib/db/errors";
import { addDays, brazilDay, DUE_SOON_DAYS } from "@/lib/supplier-terms";
import { supplierRequestSlaDue } from "@/lib/supplier-requests";
import {
  BOARD_CARDS,
  RISK_DAYS,
  atRisk,
  boardFromSummaries,
  buildTowerBoard,
  loadBoardSide,
  type BoardCard,
  type BoardCardKey,
  type TowerBoard,
} from "./tower-board";
import {
  buildControlTower,
  buildTowerTotals,
  controlTowerFromFacts,
  loadContainerTotals,
  loadTowerSide,
  reviewOrderId,
  type TowerData,
  type TowerException,
  type TowerRow,
  type TowerTotals,
} from "./control-tower";
import { summarizeFinance } from "./finance";
import {
  SUMMARY_VERSION,
  activeStagesFromFacts,
  installmentStatusOn,
  isLiveStatus,
  journeyRowsFromFacts,
  readOrderSummaries,
  recomputeOrderSummaries,
  summariesReady,
  type FactMoney,
  type OrderFacts,
} from "./order-summary";

/*
 * Indicadores prontos da Control Tower (docs/RESUMOS.md). A tela lê uma
 * linha só (`kpi_snapshots`, chave "tower") com a contagem, os atrasados, os
 * em risco e o valor de cada quadrado, as visões gerais, as exceções e os
 * totais; a lista de um quadrado só é montada quando ele é escolhido.
 *
 * - Cada pedido guarda a própria contribuição (`order_summaries.kpi`,
 *   `OrderKpi`): em que quadrados e visões entra, calculada pelas mesmas
 *   funções da tela (`buildTowerBoard`, `buildControlTower`) só com ele, e
 *   até quando ela vale (`u`: o próximo prazo que vence, o dia que vira).
 * - O agregado soma as contribuições (coluna pequena, lida sozinha) e o que
 *   não é de pedido (bookings, solicitações ao fornecedor, certificações,
 *   revisão, containers, solicitações do cliente), lido na hora.
 * - Recalculado por evento (gravação de pedido ou de uma dessas tabelas,
 *   src/lib/db/summary-dirty.ts) e quando passa `validUntil`: os pedidos
 *   vencidos são recalculados e o agregado refeito antes de responder.
 */

export const KPI_VERSION = 1;
export const TOWER_KPI_KEY = "tower";
/** Linhas mostradas na lista do quadrado escolhido (o total vem do indicador). */
export const TOWER_LIST_LIMIT = 200;

const DAY = 86_400_000;

type BucketKey = keyof TowerData["buckets"];
const BUCKET_KEYS: BucketKey[] = [
  "active",
  "requestsOpen",
  "waitingSupplier",
  "waitingCustomer",
  "preparation",
  "inspection",
  "shipping",
  "customs",
  "transport",
  "overdue",
  "problems",
  "closed",
];

/** Quadrados que não são de pedido (somados das tabelas pequenas, lidas na hora). */
const NON_ORDER_CARDS = new Set<BoardCardKey>(
  BOARD_CARDS.filter((c) => c.block === "booking" || c.block === "request")
    .map((c) => c.key as BoardCardKey)
    .concat(["probCertExpiring", "probReviews", "parContainers"]),
);
/** Quadrados de parcela: entram sem valor (outra moeda, a do fornecedor). */
const NO_VALUE_CARDS = new Set<string>([
  "parInstallmentOverdue",
  "parInstallmentDueSoon",
  "parInstallmentRequested",
]);

/** Contribuição de um pedido para os indicadores. */
export interface OrderKpi {
  id: string;
  /** Número do pedido (ordem da lista e moeda principal). */
  n: number;
  st: Order["status"];
  /** Quadrados do pedido: [atrasado, em risco] (0/1). */
  c: Record<string, [number, number]>;
  /** Visões gerais em que o pedido aparece. */
  b: string[];
  /** Exceções do pedido. */
  x: number;
  /** Valores do financeiro (totais e valor dos quadrados). */
  m: FactMoney;
  /** Até quando a contribuição vale (ISO); nulo = não muda com o tempo. */
  u: string | null;
}

export interface CardKpi {
  count: number;
  overdue: number;
  risk: number;
  /** Valor com Finanças (nulo sem valor). */
  value: number | null;
}

export interface TowerKpis {
  version: number;
  summaryVersion: number;
  computedAt: string;
  validUntil: string | null;
  /** Moeda dos valores (a de venda principal). */
  currency: string;
  cards: Record<string, CardKpi>;
  buckets: Record<BucketKey, number>;
  exceptions: number;
  totals: TowerTotals;
}

interface KpiSide {
  penalties: Penalty[];
  rejected: Requirement[];
  reviews: ReviewItem[];
}

/* ------------------------------------------------------------------------ */
/* Contribuição de cada pedido                                                */
/* ------------------------------------------------------------------------ */

/** Meia-noite (horário de Brasília) do dia AAAA-MM-DD. */
const midnight = (day: string) => Date.parse(`${day}T03:00:00.000Z`);

/** Primeiro instante depois de `now` em que a contribuição pode mudar. */
export function nextChange(f: OrderFacts, now: Date): number | null {
  const at = now.getTime();
  const today = brazilDay(now.toISOString()) as string;
  const candidates: number[] = [];
  const add = (t: number) => {
    if (Number.isFinite(t) && t > at) candidates.push(t);
  };
  const live = isLiveStatus(f.order.status);
  // Prazo da etapa: vence (atrasado) e entra em risco RISK_DAYS antes.
  for (const s of f.active)
    if (s.dueAt) {
      const due = Date.parse(s.dueAt);
      add(due);
      add(due + 1);
      add(due - RISK_DAYS * DAY);
    }
  // Datas de dia (chegada, embarque) na viagem: viram à meia-noite.
  for (const r of f.reqs)
    if (r.v && /^\d{4}-\d{2}-\d{2}/.test(r.v)) {
      const day = r.v.slice(0, 10);
      add(midnight(day));
      add(midnight(addDays(day, 1)));
    }
  // Produção: atraso do ETD (dia) e follow-ups (instante).
  if (live)
    for (const t of f.tracks) {
      if (t.etd) {
        const etd = brazilDay(t.etd);
        if (etd) add(midnight(addDays(etd, 1)));
      }
      if (t.productionStartAt) {
        const start = Date.parse(t.productionStartAt);
        for (const d of [5, 15, 25, 35, 45, 60, 90]) add(start + d * DAY);
        add(midnight(addDays(today, 1)));
      }
    }
  // Parcelas: a vencer DUE_SOON_DAYS antes; vencida no dia seguinte.
  for (const i of f.installments)
    if (
      i.dueDate &&
      (i.status === "scheduled" ||
        i.status === "due_soon" ||
        i.status === "overdue")
    ) {
      add(midnight(addDays(i.dueDate, -DUE_SOON_DAYS)));
      add(midnight(addDays(i.dueDate, 1)));
    }
  // Encerrado ou cancelado no mês: sai do mês na virada.
  const ended =
    f.order.status === "CLOSED"
      ? f.order.closedAt
      : f.order.status === "CANCELLED"
        ? (f.order.cancelledAt ?? null)
        : null;
  const endedDay = brazilDay(ended);
  if (endedDay && endedDay.slice(0, 7) >= today.slice(0, 7)) {
    const [y, m] = endedDay.slice(0, 7).split("-").map(Number);
    const next =
      m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
    add(midnight(next));
  }
  return candidates.length ? Math.min(...candidates) : null;
}

/** A contribuição de um pedido (as mesmas regras da tela, só com ele). */
export function buildOrderKpi(
  f: OrderFacts,
  side: KpiSide,
  now: Date,
): OrderKpi {
  const at = now.getTime();
  const o = f.order;
  const live = isLiveStatus(o.status);
  const liveFacts = live ? [f] : [];
  const { stages, requirements, laneRequirements } =
    journeyRowsFromFacts(liveFacts);
  const today = brazilDay(now.toISOString()) as string;
  const board = buildTowerBoard({
    now,
    finance: true,
    orders: [o],
    parties:
      f.customer !== null ? [{ id: o.customerId, name: f.customer }] : [],
    items: f.product !== null ? [{ orderId: o.id, name: f.product }] : [],
    products: [],
    activeStages: activeStagesFromFacts([f]),
    stages,
    requirements,
    laneRequirements,
    lots: [],
    supplierRequests: [],
    steps: liveFacts.flatMap((x) => x.steps),
    tracks: liveFacts.flatMap((x) => x.tracks),
    skus: liveFacts.flatMap((x) => x.skus),
    artIssues: liveFacts.flatMap((x) =>
      x.art.map((a) => ({ orderId: o.id, status: a.status })),
    ),
    receivings: liveFacts.flatMap((x) => x.receivings),
    penalties: side.penalties,
    rejected: live ? side.rejected : [],
    reviews: side.reviews,
    certifications: [],
    containers: { open: 0 },
    installments: f.installments.map((i) => ({
      orderId: o.id,
      status: installmentStatusOn(i, today),
    })),
    money: new Map([
      [
        o.id,
        {
          sell: f.money.sell,
          currency: f.money.sellCurrency,
          receivable: f.money.receivable,
        },
      ],
    ]),
    currency: f.money.sellCurrency,
  });
  const c: OrderKpi["c"] = {};
  for (const card of board.cards) {
    if (NON_ORDER_CARDS.has(card.key)) continue;
    const row = card.rows.find((r) => r.id === o.id);
    if (row) c[card.key] = [row.overdue ? 1 : 0, atRisk(row, at) ? 1 : 0];
  }
  const data = buildControlTower({
    now: at,
    orders: [o],
    partyName: (id) =>
      id === null
        ? null
        : id === o.customerId
          ? f.customer
          : id === o.supplierId
            ? f.supplier
            : null,
    productOf: () => f.product,
    stageOf: () => f.active[0],
    requests: [],
    penalties: side.penalties,
    rejected: side.rejected,
    products: [],
    certifications: [],
    reviews: side.reviews,
  });
  const next = nextChange(f, now);
  return {
    id: o.id,
    n: o.number,
    st: o.status,
    c,
    b: BUCKET_KEYS.filter((k) => data.buckets[k].some((r) => r.id === o.id)),
    x: data.exceptions.length,
    m: f.money,
    u: next === null ? null : new Date(next).toISOString(),
  };
}

/** Multas em aberto, itens recusados e revisão aberta de cada pedido. */
async function kpiSides(ids: string[] | null): Promise<Map<string, KpiSide>> {
  const store = getStore();
  const byOrder = ids ? { orderId: ids } : {};
  const [penalties, rejected, reviews] = await Promise.all([
    ids && !ids.length
      ? Promise.resolve([] as Penalty[])
      : store.list("penalties", {
          filter: { ...byOrder, status: ["open", "disputed"] },
        }),
    ids && !ids.length
      ? Promise.resolve([] as Requirement[])
      : store.list("requirements", {
          filter: { ...byOrder, status: "rejected" },
        }),
    store.list("review_items", {
      filter: { status: "open" },
      orderBy: "createdAt",
      direction: "desc",
    }),
  ]);
  const out = new Map<string, KpiSide>();
  const of = (id: string) => {
    let side = out.get(id);
    if (!side) {
      side = { penalties: [], rejected: [], reviews: [] };
      out.set(id, side);
    }
    return side;
  };
  for (const p of penalties) if (p.orderId) of(p.orderId).penalties.push(p);
  for (const r of rejected) of(r.orderId).rejected.push(r);
  for (const r of reviews) {
    const id = reviewOrderId(r);
    if (id) of(id).reviews.push(r);
  }
  return out;
}

const EMPTY_SIDE: KpiSide = { penalties: [], rejected: [], reviews: [] };

/** Contribuição dos pedidos dados (ids: só eles; nulo: todos, na reconstrução). */
export async function orderKpisFor(
  facts: OrderFacts[],
  now: Date,
  ids: string[] | null,
): Promise<Map<string, OrderKpi>> {
  const sides = await kpiSides(ids);
  return new Map(
    facts.map((f) => [
      f.order.id,
      buildOrderKpi(f, sides.get(f.order.id) ?? EMPTY_SIDE, now),
    ]),
  );
}

/* ------------------------------------------------------------------------ */
/* Agregado                                                                   */
/* ------------------------------------------------------------------------ */

/** Contribuições guardadas (coluna pequena). Nulo: resumos de outro formato. */
async function readOrderKpis(): Promise<Array<{
  id: string;
  kpi: OrderKpi | null;
}> | null> {
  const rows = await listColumns(getStore(), "order_summaries", [
    "kpi",
    "version",
  ]);
  if (rows.some((r) => r.version !== SUMMARY_VERSION)) return null;
  return rows.map((r) => ({ id: r.id, kpi: (r.kpi as OrderKpi) ?? null }));
}

/**
 * Refaz o agregado: soma as contribuições (recalcula antes as que venceram
 * ou faltam) e o que não é de pedido, e grava. Nulo: resumos fora de uso.
 */
export async function rebuildTowerKpis(
  now: Date = new Date(),
): Promise<TowerKpis | null> {
  if (!(await summariesReady())) return null;
  let rows = await readOrderKpis();
  if (!rows) return null;
  const at = now.getTime();
  const stale = rows
    .filter((r) => !r.kpi || (r.kpi.u !== null && Date.parse(r.kpi.u) <= at))
    .map((r) => r.id);
  if (stale.length) {
    await recomputeOrderSummaries(stale, now);
    rows = await readOrderKpis();
    if (!rows) return null;
  }
  const kpis = rows
    .map((r) => r.kpi)
    .filter((k): k is OrderKpi => !!k)
    .sort((a, b) => b.n - a.n);
  const ids = new Set(kpis.map((k) => k.id));
  const cancelled = new Set(
    kpis.filter((k) => k.st === "CANCELLED").map((k) => k.id),
  );
  const currency = kpis[0]?.m.sellCurrency ?? "BRL";

  // Quadrados dos pedidos: soma das contribuições.
  const cards: Record<string, CardKpi & { touched: boolean; sum: number }> = {};
  for (const c of BOARD_CARDS)
    cards[c.key] = {
      count: 0,
      overdue: 0,
      risk: 0,
      value: null,
      touched: false,
      sum: 0,
    };
  const buckets = Object.fromEntries(BUCKET_KEYS.map((k) => [k, 0])) as Record<
    BucketKey,
    number
  >;
  let exceptions = 0;
  let validUntil: number | null = null;
  const until = (t: number | null) => {
    if (t !== null && t > at && (validUntil === null || t < validUntil))
      validUntil = t;
  };
  for (const k of kpis) {
    for (const [key, [late, risk]] of Object.entries(k.c)) {
      const card = cards[key];
      if (!card) continue;
      card.count++;
      card.overdue += late;
      card.risk += risk;
      card.touched = true;
      if (NO_VALUE_CARDS.has(key)) continue;
      if (k.m.sellCurrency !== currency) continue;
      card.sum += key === "parReceivable" ? k.m.receivable : k.m.sell;
    }
    for (const b of k.b) buckets[b as BucketKey]++;
    exceptions += k.x;
    if (k.u) until(Date.parse(k.u));
  }

  // O que não é de pedido: bookings, solicitações ao fornecedor,
  // certificações, revisão e containers (quadrados); solicitações do
  // cliente, certificações, multas e revisão sem pedido (visões e exceções).
  const [boardSide, towerSide] = await Promise.all([
    loadBoardSide(),
    loadTowerSide(),
  ]);
  const others = await boardFromSummaries({ facts: [] }, true, now, boardSide);
  for (const card of others.cards) {
    if (!NON_ORDER_CARDS.has(card.key)) continue;
    const target = cards[card.key];
    target.count = card.count;
    target.overdue = card.overdue;
    target.risk = card.risk ?? 0;
  }
  const reviews = boardSide[2];
  cards.probReviews.count = reviews.filter(
    (r) => !cancelled.has(reviewOrderId(r) ?? ""),
  ).length;
  const requestsData = buildControlTower({
    now: at,
    orders: [],
    partyName: () => null,
    productOf: () => null,
    stageOf: () => undefined,
    ...towerSide,
    penalties: [],
    reviews: [],
  });
  for (const key of BUCKET_KEYS)
    buckets[key] += requestsData.buckets[key].length;
  exceptions += requestsData.exceptions.length;
  exceptions += towerSide.penalties.filter(
    (p) => !p.orderId || !ids.has(p.orderId),
  ).length;
  exceptions += towerSide.reviews.filter((r) => {
    const id = reviewOrderId(r);
    return !id || !ids.has(id);
  }).length;
  // Prazos do que não é de pedido: SLA das solicitações ao fornecedor,
  // vencimento das certificações; e a virada do dia (janela de aviso).
  const sla = boardSide[7].supplierRequestSlaMinutes ?? 30;
  for (const r of boardSide[6])
    if (r.status === "open" || r.status === "answered")
      until(Date.parse(supplierRequestSlaDue(r, sla)));
  for (const c of boardSide[3])
    if (c.validUntil) until(Date.parse(c.validUntil));
  until(midnight(addDays(brazilDay(now.toISOString()) as string, 1)));

  // Totais (faixa do financeiro e visão comercial).
  const moneyRows = kpis.map((k) => ({
    ...k.m,
    order: { id: k.id, status: k.st as Order["status"] },
  }));
  const summary = summarizeFinance(moneyRows);
  const totals = buildTowerTotals(
    moneyRows,
    summary,
    reviews,
    await loadContainerTotals(summary.currency),
  );

  const snapshot: TowerKpis = {
    version: KPI_VERSION,
    summaryVersion: SUMMARY_VERSION,
    computedAt: now.toISOString(),
    validUntil: validUntil === null ? null : new Date(validUntil).toISOString(),
    currency,
    cards: Object.fromEntries(
      Object.entries(cards).map(([key, c]) => [
        key,
        {
          count: c.count,
          overdue: c.overdue,
          risk: c.risk,
          value: c.touched && c.sum > 0.005 ? c.sum : null,
        },
      ]),
    ),
    buckets,
    exceptions,
    totals,
  };
  await writeSnapshot(snapshot);
  return snapshot;
}

async function writeSnapshot(snapshot: TowerKpis) {
  const store = getStore();
  const row = {
    id: TOWER_KPI_KEY,
    key: TOWER_KPI_KEY,
    version: KPI_VERSION,
    data: snapshot,
    validUntil: snapshot.validUntil,
    computedAt: snapshot.computedAt,
  };
  if (store.upsertMany) {
    await store.upsertMany("kpi_snapshots", [row]);
    return;
  }
  const { id, ...rest } = row;
  if (await store.get("kpi_snapshots", id))
    await store.update("kpi_snapshots", id, rest);
  else await store.create("kpi_snapshots", row);
}

/**
 * Os indicadores da Control Tower, prontos; nulo enquanto os resumos não
 * estão em uso (a tela segue pelo caminho antigo). Recalcula antes o que
 * gravações desta instância marcaram; vencido (`validUntil`) ou de outro
 * formato, refaz o agregado antes de responder.
 */
export async function readTowerKpis(
  now: Date = new Date(),
): Promise<TowerKpis | null> {
  if (!(await summariesReady())) return null;
  const { flushSummaryChanges } = await import("@/lib/db/summary-dirty");
  await flushSummaryChanges();
  let row;
  try {
    row = await getStore().get("kpi_snapshots", TOWER_KPI_KEY);
  } catch (error) {
    if (isSchemaMissing(error)) return null;
    throw error;
  }
  const data = row?.data as TowerKpis | undefined;
  if (
    data &&
    data.version === KPI_VERSION &&
    data.summaryVersion === SUMMARY_VERSION &&
    (!data.validUntil || Date.parse(data.validUntil) > now.getTime())
  )
    return data;
  return rebuildTowerKpis(now);
}

/* ------------------------------------------------------------------------ */
/* Tela                                                                       */
/* ------------------------------------------------------------------------ */

/** Os quadrados com os números prontos (sem as linhas). */
export function boardFromKpis(kpis: TowerKpis, finance: boolean): TowerBoard {
  const cards = BOARD_CARDS.filter(
    (c) => finance || !("finance" in c && c.finance),
  ).map((c): BoardCard => {
    const k = kpis.cards[c.key] ?? {
      count: 0,
      overdue: 0,
      risk: 0,
      value: null,
    };
    return {
      key: c.key,
      block: c.block,
      href: "href" in c ? c.href : null,
      rows: [],
      count: k.count,
      overdue: k.overdue,
      risk: k.risk,
      value: finance ? k.value : null,
    };
  });
  return { cards, currency: finance ? kpis.currency : "BRL" };
}

/** Pedidos de um quadrado ou de uma visão (do maior número para o menor). */
async function membersOf(test: (k: OrderKpi) => boolean): Promise<string[]> {
  const rows = (await readOrderKpis()) ?? [];
  return rows
    .map((r) => r.kpi)
    .filter((k): k is OrderKpi => !!k && test(k))
    .sort((a, b) => b.n - a.n)
    .map((k) => k.id);
}

async function factsOf(ids: string[]): Promise<OrderFacts[]> {
  if (!ids.length) return [];
  const view = await readOrderSummaries(ids);
  return view?.facts ?? [];
}

/** Lista do quadrado escolhido: as primeiras `limit` linhas e o total. */
export async function towerCardRows(
  key: BoardCardKey,
  finance: boolean,
  now: Date = new Date(),
  limit = TOWER_LIST_LIMIT,
): Promise<{ rows: TowerRow[]; total: number }> {
  const side = await loadBoardSide();
  if (NON_ORDER_CARDS.has(key)) {
    const board = await boardFromSummaries({ facts: [] }, finance, now, side);
    const rows = board.cards.find((c) => c.key === key)?.rows ?? [];
    return { rows: rows.slice(0, limit), total: rows.length };
  }
  const ids = await membersOf((k) => key in k.c);
  const facts = await factsOf(ids.slice(0, limit));
  const board = await boardFromSummaries({ facts }, finance, now, side);
  const rows = board.cards.find((c) => c.key === key)?.rows ?? [];
  return { rows, total: ids.length };
}

/** Lista de uma visão geral: as primeiras `limit` linhas e o total. */
export async function towerBucketRows(
  bucket: BucketKey,
  now: Date = new Date(),
  limit = TOWER_LIST_LIMIT,
): Promise<{ rows: TowerRow[]; total: number }> {
  const ids = await membersOf((k) => k.b.includes(bucket));
  const side = await loadTowerSide();
  const facts = await factsOf(ids.slice(0, limit));
  const data = await controlTowerFromFacts(facts, side, now.getTime());
  const all = data.buckets[bucket];
  // As solicitações (sem pedido) vêm depois dos pedidos, como na tela.
  const requests = all.filter((r) => r.stageKey === null);
  return {
    rows: all.slice(0, limit),
    total: ids.length + requests.length,
  };
}

/** Exceções: as primeiras `limit` e o total (do indicador). */
export async function towerExceptionRows(
  now: Date = new Date(),
  limit = TOWER_LIST_LIMIT,
): Promise<TowerException[]> {
  const ids = await membersOf((k) => k.x > 0);
  const side = await loadTowerSide();
  const facts = await factsOf(ids);
  const data = await controlTowerFromFacts(facts, side, now.getTime());
  return data.exceptions.slice(0, limit);
}
