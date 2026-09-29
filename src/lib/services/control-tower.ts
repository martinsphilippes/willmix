import "server-only";

import {
  getStore,
  type Order,
  type RequestStatus,
  type Role,
  type StageKey,
} from "@/lib/db";

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

/** Visão da Wellmix: onde cada pedido está, quem precisa agir, o que está atrasado ou com problema. */
export async function loadControlTower(): Promise<TowerData> {
  const store = getStore();
  const now = Date.now();
  const [orders, parties, stages, requests, penalties, items] =
    await Promise.all([
      store.list("orders", { orderBy: "number", direction: "desc" }),
      store.list("parties"),
      store.list("stages", { filter: { status: ["active", "blocked"] } }),
      store.list("requests", {
        filter: {
          status: [
            "REQUESTED",
            "RFQ_OPEN",
            "QUOTATION_RECEIVED",
            "SUPPLIER_SELECTED",
            "WAITING_DOWN_PAYMENT",
          ],
        },
      }),
      store.list("penalties", { filter: { status: ["open", "disputed"] } }),
      store.list("order_items"),
    ]);
  const partyName = (id: string | null) =>
    parties.find((p) => p.id === id)?.name ?? "—";
  const productOf = (order: Order) =>
    items.find((i) => i.orderId === order.id)?.name ?? "—";
  const stageOf = (order: Order) => stages.find((s) => s.orderId === order.id);

  const rows: TowerRow[] = orders
    .filter((o) => o.status !== "CLOSED")
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
    .filter((o) => o.status === "CLOSED")
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
  const rejected = await store.list("requirements", {
    filter: { status: "rejected" },
  });
  for (const req of rejected) {
    const order = orders.find((o) => o.id === req.orderId);
    if (order && order.status !== "CLOSED") {
      exceptions.push({
        kind: "document",
        severity: "medium",
        detail: `#${order.number} · ${req.label}`,
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
    if (o.status !== "CLOSED" && o.erpSyncStatus === "pending") {
      exceptions.push({
        kind: "erp",
        severity: "medium",
        detail: `#${o.number}`,
        link: `/app/orders/${o.id}`,
      });
    }
  }
  for (const p of penalties) {
    const order = orders.find((o) => o.id === p.orderId);
    exceptions.push({
      kind: "penalty",
      severity: "medium",
      detail: `#${order?.number ?? "?"} · ${p.reason}`,
      link: `/app/orders/${p.orderId}`,
    });
  }
  // Certificações válidas a vencer no prazo de aviso.
  const { expiringCertifications } = await import("./compliance");
  const products = await store.list("products");
  for (const cert of await expiringCertifications()) {
    const product =
      cert.entity === "product"
        ? products.find((p) => p.id === cert.entityId)
        : null;
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
  const reviews = await store.list("review_items", {
    filter: { status: "open" },
    orderBy: "createdAt",
    direction: "desc",
  });
  for (const r of reviews) {
    const order = orders.find((o) => o.id === r.orderId);
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

/** Reutiliza o financeiro e o container; nada é estimado: só o que foi lançado. */
export async function loadTowerTotals(): Promise<TowerTotals> {
  const { loadFinance } = await import("./finance");
  const { listContainers } = await import("./containers");
  const store = getStore();
  const [{ rows, summary }, containers, reviews] = await Promise.all([
    loadFinance(),
    listContainers(),
    store.list("review_items", { filter: { status: "open" } }),
  ]);
  const purchasedByCurrency: Record<string, number> = {};
  for (const r of rows) {
    purchasedByCurrency[r.fobCurrency] =
      (purchasedByCurrency[r.fobCurrency] ?? 0) + r.fob;
  }
  const pipeline = PIPELINE.map((p) => {
    const mine = rows.filter((r) => p.stages.includes(r.order.status));
    return {
      key: p.key,
      count: mine.length,
      value: mine
        .filter((r) => r.sellCurrency === summary.currency)
        .reduce((s, r) => s + r.sell, 0),
    };
  });
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
      const { loadContainer } = await import("./containers");
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
        soldCurrency: view?.soldCurrency ?? summary.currency,
      };
    }),
  );
  return {
    sellCurrency: summary.currency,
    sold: summary.sell,
    received: summary.received,
    receivable: summary.receivable,
    purchasedByCurrency,
    paidByCurrency: summary.paidByCurrency,
    payableByCurrency: summary.payableByCurrency,
    pipeline,
    reviewsOpen: reviews.length,
    containers: {
      total: containers.length,
      open: openContainers.length,
      avgOccupancyPercent,
    },
    commercial,
  };
}
