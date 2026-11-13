import "server-only";
import { withoutPlaceholder } from "@/lib/placeholder-name";
import { indexBy, listByIds } from "@/lib/db/lookup";

import {
  getStore,
  type Certification,
  type Order,
  type Penalty,
  type Product,
  type Request,
  type RequestStatus,
  type Requirement,
  type ReviewItem,
  type Role,
  type Stage,
  type StageKey,
} from "@/lib/db";
import type { BoardOrder } from "./tower-board";
import type { FinanceSummary, FinanceSummaryRow } from "./finance";
import type { OrderFacts } from "./order-summary";

/** Pedido do item de revisão (itens antigos podem ter só entity "order"). */
export const reviewOrderId = (r: ReviewItem) =>
  r.orderId ?? (r.entity === "order" ? r.entityId : null);

export interface TowerRow {
  id: string;
  number: string;
  customer: string;
  product: string;
  stageKey: StageKey | null;
  requestStatus: RequestStatus | null;
  responsible: Role | null;
  dueAt: string | null;
  overdue: boolean;
  blocked: boolean;
  link: string;
  /**
   * Quadros da operação (tower-board.ts): o que a linha é, para o selo da
   * etapa e a conversa. Sem ele vale a regra antiga (solicitação pela situação).
   */
  kind?: "order" | "request" | "cert" | "booking" | "supplier_request";
  /** Pedido cancelado (selo "Cancelado" com a etapa em que parou). */
  cancelled?: boolean;
  /** Pedido do portal (fluxo do pedido de compra) ou importado do Sankhya (só visibilidade). */
  origin?: "portal" | "sankhya";
  /** Chave de texto do selo da linha (lote e solicitação ao fornecedor, que não têm etapa). */
  statusKey?: string;
}

export interface TowerException {
  kind:
    | "overdue"
    | "payment"
    | "document"
    | "weight"
    | "erp"
    | "penalty"
    | "review"
    | "compliance";
  severity: "high" | "medium";
  detail: string;
  link: string;
}

export interface TowerData {
  buckets: {
    active: TowerRow[];
    requestsOpen: TowerRow[];
    waitingSupplier: TowerRow[];
    waitingCustomer: TowerRow[];
    preparation: TowerRow[];
    inspection: TowerRow[];
    shipping: TowerRow[];
    customs: TowerRow[];
    transport: TowerRow[];
    overdue: TowerRow[];
    problems: TowerRow[];
    closed: TowerRow[];
  };
  exceptions: TowerException[];
}

/** O que as visões gerais e as exceções leem (montagem pura em `buildControlTower`). */
export interface ControlTowerInput {
  now: number;
  /** Pedidos, do número maior para o menor. */
  orders: BoardOrder[];
  /** Nome do parceiro como o cadastro tem (nulo: não encontrado). */
  partyName: (id: string | null) => string | null;
  /** Primeiro item do pedido (nulo: sem itens). */
  productOf: (orderId: string) => string | null;
  /** Primeira etapa em andamento ou bloqueada do pedido. */
  stageOf: (
    orderId: string,
  ) => Pick<Stage, "dueAt" | "status" | "responsibleRole"> | undefined;
  requests: Request[];
  penalties: Pick<Penalty, "orderId" | "reason">[];
  rejected: Pick<Requirement, "orderId" | "label">[];
  products: Pick<Product, "id" | "name">[];
  certifications: Certification[];
  reviews: ReviewItem[];
}

const OPEN_REQUEST_STATUSES: RequestStatus[] = [
  "REQUESTED",
  "RFQ_OPEN",
  "QUOTATION_RECEIVED",
  "SUPPLIER_SELECTED",
  "WAITING_DOWN_PAYMENT",
];

/**
 * O que não vem do resumo dos pedidos: tabelas pequenas, lidas na hora
 * (solicitações abertas, multas em aberto, itens recusados, certificações a
 * vencer e os produtos delas, revisão).
 */
export async function loadTowerSide() {
  const store = getStore();
  const [requests, penalties, rejected, certifications, reviews] =
    await Promise.all([
      store.list("requests", { filter: { status: OPEN_REQUEST_STATUSES } }),
      store.list("penalties", { filter: { status: ["open", "disputed"] } }),
      store.list("requirements", { filter: { status: "rejected" } }),
      import("./compliance").then((m) => m.expiringCertifications()),
      store.list("review_items", {
        filter: { status: "open" },
        orderBy: "createdAt",
        direction: "desc",
      }),
    ]);
  const productIds = [
    ...new Set(
      certifications
        .filter((c) => c.entity === "product")
        .map((c) => c.entityId),
    ),
  ];
  // Só os produtos das certificações (antes: o cadastro inteiro).
  const products = productIds.length
    ? await store.list("products", { filter: { id: productIds } })
    : [];
  return { requests, penalties, rejected, certifications, reviews, products };
}

/** Visão da Wellmix: onde cada pedido está, quem precisa agir, o que está atrasado ou com problema. */
export async function loadControlTower(
  now: number = Date.now(),
): Promise<TowerData> {
  const sideP = loadTowerSide();
  sideP.catch(() => undefined);
  const { readOrderSummaries } = await import("./order-summary");
  const view = await readOrderSummaries();
  if (view) {
    // Do resumo dos pedidos (docs/RESUMOS.md).
    return controlTowerFromFacts(view.facts, await sideP, now);
  }
  // Caminho antigo (sem resumo ainda): as tabelas de pedidos, itens e etapas.
  const store = getStore();
  const [orders, stages, items, side] = await Promise.all([
    store.list("orders", { orderBy: "number", direction: "desc" }),
    store.list("stages", { filter: { status: ["active", "blocked"] } }),
    store.list("order_items"),
    sideP,
  ]);
  // Só os parceiros que aparecem na tela (antes: a tabela inteira, ~32 mil).
  const parties = await listByIds(store, "parties", [
    ...orders.map((o) => o.customerId),
    ...side.requests.map((r) => r.customerId),
  ]);
  // Mapas pelo primeiro de cada (como o .find de antes, sem pedidos × itens).
  const partyById = indexBy(parties, "id");
  const itemByOrder = indexBy(items, "orderId");
  const stageByOrder = indexBy(stages, "orderId");
  return buildControlTower({
    now,
    orders,
    partyName: (id) => (id === null ? null : (partyById.get(id)?.name ?? null)),
    productOf: (id) => itemByOrder.get(id)?.name ?? null,
    stageOf: (id) => stageByOrder.get(id),
    ...side,
  });
}

/** O que `loadTowerSide` lê (tabelas pequenas, lidas na hora). */
export type TowerSide = Awaited<ReturnType<typeof loadTowerSide>>;

/** Visões gerais e exceções a partir do resumo dos pedidos dados. */
export async function controlTowerFromFacts(
  facts: OrderFacts[],
  side: TowerSide,
  now: number,
): Promise<TowerData> {
  const byId = new Map(facts.map((f) => [f.order.id, f]));
  const names = new Map<string, string>();
  for (const f of facts) {
    if (f.customer !== null) names.set(f.order.customerId, f.customer);
    if (f.supplier !== null) names.set(f.order.supplierId, f.supplier);
  }
  // Clientes das solicitações abertas que não aparecem nos pedidos.
  const missing = [
    ...new Set(
      side.requests
        .map((r) => r.customerId)
        .filter((id): id is string => !!id && !names.has(id)),
    ),
  ];
  if (missing.length)
    for (const p of await getStore().list("parties", {
      filter: { id: missing },
    }))
      if (!names.has(p.id)) names.set(p.id, p.name);
  return buildControlTower({
    now,
    orders: facts.map((f) => f.order),
    partyName: (id) => (id === null ? null : (names.get(id) ?? null)),
    productOf: (id) => byId.get(id)?.product ?? null,
    stageOf: (id) => byId.get(id)?.active[0],
    ...side,
  });
}

/** Visões gerais e exceções (função pura). */
export function buildControlTower(input: ControlTowerInput): TowerData {
  const { now, orders, requests, penalties } = input;
  const partyName = (id: string | null) => input.partyName(id) ?? "—";
  const productOf = (order: BoardOrder) => input.productOf(order.id) ?? "—";
  const stageOf = (order: BoardOrder) => input.stageOf(order.id);
  const orderById = new Map<string, BoardOrder>();
  for (const o of orders) if (!orderById.has(o.id)) orderById.set(o.id, o);

  const rows: TowerRow[] = orders
    .filter(
      (o): o is BoardOrder & { status: StageKey } =>
        o.status !== "CLOSED" && o.status !== "CANCELLED",
    )
    .map((o) => {
      const stage = stageOf(o);
      return {
        id: o.id,
        number: `#${o.number}`,
        customer: partyName(o.customerId),
        product: productOf(o),
        stageKey: o.status,
        requestStatus: null,
        responsible: stage?.responsibleRole ?? null,
        dueAt: stage?.dueAt ?? null,
        overdue: !!stage?.dueAt && Date.parse(stage.dueAt) < now,
        blocked: stage?.status === "blocked",
        link: `/app/orders/${o.id}`,
      };
    });

  const closedRows: TowerRow[] = orders
    .filter(
      (o): o is BoardOrder & { status: "CLOSED" } => o.status === "CLOSED",
    )
    .map((o) => ({
      id: o.id,
      number: `#${o.number}`,
      customer: partyName(o.customerId),
      product: productOf(o),
      stageKey: o.status,
      requestStatus: null,
      responsible: null,
      dueAt: o.closedAt,
      overdue: false,
      blocked: false,
      link: `/app/orders/${o.id}`,
    }));

  const requestRows: TowerRow[] = requests.map((r) => ({
    id: r.id,
    number: "S",
    customer: partyName(r.customerId),
    product: r.productName,
    stageKey: null,
    requestStatus: r.status,
    responsible:
      r.status === "RFQ_OPEN"
        ? "supplier"
        : r.status === "WAITING_DOWN_PAYMENT"
          ? "customer"
          : "operator",
    dueAt: r.deadline,
    overdue: false,
    blocked: false,
    link: `/app/requests/${r.id}`,
  }));

  const exceptions: TowerException[] = [];
  for (const row of rows) {
    if (row.overdue)
      exceptions.push({
        kind: "overdue",
        severity: "high",
        detail: `${row.number} · ${row.product}`,
        link: row.link,
      });
    if (row.blocked)
      exceptions.push({
        kind: "weight",
        severity: "high",
        detail: `${row.number} · ${row.product}`,
        link: row.link,
      });
  }
  for (const req of input.rejected) {
    const order = orderById.get(req.orderId);
    if (order && order.status !== "CLOSED" && order.status !== "CANCELLED") {
      exceptions.push({
        kind: "document",
        severity: "medium",
        detail: `#${order.number} · ${withoutPlaceholder(req.label)}`,
        link: `/app/orders/${order.id}`,
      });
    }
  }
  for (const r of requests) {
    if (r.status === "WAITING_DOWN_PAYMENT") {
      exceptions.push({
        kind: "payment",
        severity: "medium",
        detail: r.productName,
        link: `/app/requests/${r.id}`,
      });
    }
  }
  for (const o of orders) {
    if (
      o.status !== "CLOSED" &&
      o.status !== "CANCELLED" &&
      o.erpSyncStatus === "pending"
    ) {
      exceptions.push({
        kind: "erp",
        severity: "medium",
        detail: `#${o.number}`,
        link: `/app/orders/${o.id}`,
      });
    }
  }
  for (const p of penalties) {
    const order = p.orderId ? orderById.get(p.orderId) : undefined;
    exceptions.push({
      kind: "penalty",
      severity: "medium",
      detail: `#${order?.number ?? "?"} · ${p.reason}`,
      link: `/app/orders/${p.orderId}`,
    });
  }
  // Certificações válidas a vencer no prazo de aviso.
  const productById = new Map(input.products.map((p) => [p.id, p]));
  for (const cert of input.certifications) {
    const product =
      cert.entity === "product" ? productById.get(cert.entityId) : null;
    exceptions.push({
      kind: "compliance",
      severity: "medium",
      detail: `${cert.kind}${product ? ` · ${product.name}` : ""}${cert.validUntil ? ` · ${cert.validUntil.slice(0, 10)}` : ""}`,
      link: product
        ? `/app/products/${product.id}`
        : `/app/parties/${cert.entityId}`,
    });
  }
  // Fila "itens para revisão" (gates): cada item aberto é uma exceção com atalho.
  // Item de pedido cancelado não é pendência (os de antes da regra ficaram abertos).
  for (const r of input.reviews) {
    const id = reviewOrderId(r);
    const order = id ? orderById.get(id) : undefined;
    if (order?.status === "CANCELLED") continue;
    exceptions.push({
      kind: "review",
      severity: r.rule.startsWith("inspection.") ? "high" : "medium",
      detail: `${order ? `#${order.number} · ` : ""}${r.problem}`,
      link: r.link ?? "/app/reviews",
    });
  }

  const byStage = (keys: StageKey[]) =>
    rows.filter((r) => r.stageKey && keys.includes(r.stageKey));
  return {
    buckets: {
      active: rows,
      closed: closedRows,
      requestsOpen: requestRows,
      waitingSupplier: rows
        .filter((r) => r.responsible === "supplier")
        .concat(requestRows.filter((r) => r.requestStatus === "RFQ_OPEN")),
      waitingCustomer: rows
        .filter((r) => r.responsible === "customer")
        .concat(
          requestRows.filter((r) => r.requestStatus === "WAITING_DOWN_PAYMENT"),
        ),
      preparation: byStage([
        "ORDER_CREATED",
        "PREPARATION",
        "SUPPLIER_PAYMENT",
        "PACKAGING",
      ]),
      inspection: byStage(["INSPECTION"]),
      shipping: byStage(["SHIPPING"]),
      customs: byStage(["CUSTOMS"]),
      transport: byStage(["TRANSPORT", "DELIVERED"]),
      overdue: rows.filter((r) => r.overdue),
      problems: rows.filter(
        (r) =>
          r.blocked ||
          exceptions.some((e) => e.link === r.link && e.kind !== "overdue"),
      ),
    },
    exceptions,
  };
}

/* ------------------------------------------------------------------------ */
/* Totais financeiros e operacionais (docs/EVOLUTION_PLAN.md, itens 27 e 28)  */
/* ------------------------------------------------------------------------ */

export interface TowerTotals {
  /** Moeda de venda (normalmente BRL). */
  sellCurrency: string;
  sold: number;
  received: number;
  receivable: number;
  /** Comprado (FOB), pago e saldo por moeda do fornecedor. */
  purchasedByCurrency: Record<string, number>;
  paidByCurrency: Record<string, number>;
  payableByCurrency: Record<string, number>;
  /** Pedidos por fase operacional, com valor de venda somado (moeda de venda). */
  pipeline: Array<{
    key:
      | "production"
      | "ready"
      | "shipped"
      | "customs"
      | "transport"
      | "delivered";
    count: number;
    value: number;
  }>;
  reviewsOpen: number;
  containers: {
    total: number;
    open: number;
    avgOccupancyPercent: number | null;
  };
  /** Visão comercial: por container, vendido × disponível em volume. */
  commercial: Array<{
    id: string;
    code: string;
    customer: string | null;
    totalCbm: number;
    occupancyPercent: number;
    soldPercent: number;
    availablePercent: number;
    soldValue: number;
    soldCurrency: string;
  }>;
}

const PIPELINE: Array<{
  key: TowerTotals["pipeline"][number]["key"];
  stages: StageKey[];
}> = [
  {
    key: "production",
    stages: ["ORDER_CREATED", "PREPARATION", "SUPPLIER_PAYMENT", "PACKAGING"],
  },
  { key: "ready", stages: ["INSPECTION"] },
  { key: "shipped", stages: ["SHIPPING"] },
  { key: "customs", stages: ["CUSTOMS"] },
  { key: "transport", stages: ["TRANSPORT"] },
  { key: "delivered", stages: ["DELIVERED", "CLOSED"] },
];

/** Linha do financeiro que os totais leem (de `loadFinance` ou do resumo do pedido). */
export type TotalsRow = FinanceSummaryRow & {
  order: Pick<Order, "id" | "status">;
  fob: number;
};

/** Reutiliza o financeiro e o container; nada é estimado: só o que foi lançado. */
export async function loadTowerTotals(): Promise<TowerTotals> {
  const { loadFinance, summarizeFinance } = await import("./finance");
  const { readOrderSummaries } = await import("./order-summary");
  const store = getStore();
  const [view, reviews] = await Promise.all([
    readOrderSummaries(),
    store.list("review_items", { filter: { status: "open" } }),
  ]);
  let rows: TotalsRow[];
  let summary: FinanceSummary;
  if (view) {
    // Do resumo dos pedidos (docs/RESUMOS.md): o mesmo cálculo, sem ler as tabelas.
    rows = view.facts.map((f) => ({ ...f.money, order: f.order }));
    summary = summarizeFinance(rows);
  } else {
    // Só o que foi lançado (sem estimar pelo câmbio do dia).
    ({ rows, summary } = await loadFinance({ estimate: false }));
  }
  return buildTowerTotals(
    rows,
    summary,
    reviews,
    await loadContainerTotals(summary.currency),
  );
}

/** Containers da faixa de totais e da visão comercial (poucos: lidos na hora). */
export async function loadContainerTotals(
  currency: string,
): Promise<Pick<TowerTotals, "containers" | "commercial">> {
  const { listContainers, loadContainer } = await import("./containers");
  const containers = await listContainers();
  const openContainers = containers.filter(
    (c) => c.container.status !== "closed",
  );
  const avgOccupancyPercent =
    openContainers.length > 0
      ? Math.round(
          (openContainers.reduce((s, c) => s + c.usage.occupancyPercent, 0) /
            openContainers.length) *
            10,
        ) / 10
      : null;
  const commercial = await Promise.all(
    openContainers.map(async (c) => {
      const view = await loadContainer(c.container.id);
      return {
        id: c.container.id,
        code: c.container.code,
        customer: c.customerName,
        totalCbm: c.usage.totalCbm,
        occupancyPercent: c.usage.occupancyPercent,
        soldPercent: c.split.soldPercent,
        availablePercent: c.split.availablePercent,
        soldValue: view?.soldValue ?? 0,
        soldCurrency: view?.soldCurrency ?? currency,
      };
    }),
  );
  return {
    containers: {
      total: containers.length,
      open: openContainers.length,
      avgOccupancyPercent,
    },
    commercial,
  };
}

/** Totais da faixa do financeiro e da operação (função pura). */
export function buildTowerTotals(
  rows: TotalsRow[],
  summary: FinanceSummary,
  reviews: ReviewItem[],
  containerTotals: Pick<TowerTotals, "containers" | "commercial">,
): TowerTotals {
  // Pedido cancelado não é compra: fica fora do "Comprado (FOB)".
  const purchasedByCurrency: Record<string, number> = {};
  const cancelled = new Set<string>();
  for (const r of rows) {
    if (r.order.status === "CANCELLED") {
      cancelled.add(r.order.id);
      continue;
    }
    purchasedByCurrency[r.fobCurrency] =
      (purchasedByCurrency[r.fobCurrency] ?? 0) + r.fob;
  }
  const pipeline = PIPELINE.map((p) => {
    const mine = rows.filter((r) =>
      (p.stages as readonly string[]).includes(r.order.status),
    );
    return {
      key: p.key,
      count: mine.length,
      value: mine
        .filter((r) => r.sellCurrency === summary.currency)
        .reduce((s, r) => s + r.sell, 0),
    };
  });
  return {
    sellCurrency: summary.currency,
    sold: summary.sell,
    received: summary.received,
    receivable: summary.receivable,
    purchasedByCurrency,
    paidByCurrency: summary.paidByCurrency,
    payableByCurrency: summary.payableByCurrency,
    pipeline,
    // Itens de revisão de pedido cancelado não contam (os de antes da regra ficaram abertos).
    reviewsOpen: reviews.filter((r) => !cancelled.has(reviewOrderId(r) ?? ""))
      .length,
    ...containerTotals,
  };
}
