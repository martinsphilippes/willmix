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
  kind: "overdue" | "payment" | "document" | "weight" | "erp" | "penalty";
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
  };
  exceptions: TowerException[];
}

/** Visão da Willmix: onde cada pedido está, quem precisa agir, o que está atrasado ou com problema. */
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

  const byStage = (keys: StageKey[]) =>
    rows.filter((r) => r.stageKey && keys.includes(r.stageKey));
  return {
    buckets: {
      active: rows,
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
