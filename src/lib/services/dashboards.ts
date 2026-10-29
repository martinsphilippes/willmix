import "server-only";

import { getStore, type Order, type User } from "@/lib/db";
import type { TableName, Tables } from "@/lib/db/schema";
import { ForbiddenError, isWellmix } from "@/lib/auth/permissions";
import { isSchemaMissing } from "./packaging-brief";
import { followupsDue } from "./production";

/*
 * Painéis por área (Fase G, docs/DASHBOARDS.md): números de cada área para
 * a Wellmix decidir onde agir. Tudo calculado na hora a partir dos dados do
 * portal (sem cache); cada indicador leva à tela onde se age. Integração
 * real com o Sankhya depende de credenciais: aqui só o que o portal sabe
 * (pedidos com sincronização pendente, modo manual).
 */

export const DASHBOARD_AREAS = [
  "purchasing",
  "production",
  "shipping",
  "receiving",
  "certification",
  "finance",
] as const;
export type DashboardArea = (typeof DASHBOARD_AREAS)[number];

export interface Metric {
  key: string;
  value: number | string;
  tone?: "neutral" | "warning" | "danger" | "success";
  href?: string;
}

export interface OrderRow {
  id: string;
  number: number;
  detail: string;
}

export interface AreaPanel {
  area: DashboardArea;
  metrics: Metric[];
  /** Pedidos que pedem atenção (até 10). */
  attention: OrderRow[];
}

const LIVE = [
  "ORDER_CREATED",
  "PREPARATION",
  "SUPPLIER_PAYMENT",
  "PACKAGING",
  "INSPECTION",
  "SHIPPING",
  "CUSTOMS",
  "TRANSPORT",
  "DELIVERED",
];

/** Lista que não quebra antes de o esquema novo ser publicado. */
async function safeList<K extends TableName>(
  table: K,
  filter: Record<string, unknown> = {},
): Promise<Tables[K][]> {
  try {
    return await getStore().list(table, { filter: filter as never });
  } catch (error) {
    if (isSchemaMissing(error)) return [];
    throw error;
  }
}

const DAY = 86_400_000;
const days = (ms: number) => Math.round(ms / DAY);
const avg = (xs: number[]) =>
  xs.length
    ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10
    : 0;

export async function areaPanel(
  user: User,
  area: DashboardArea,
): Promise<AreaPanel> {
  if (!isWellmix(user)) throw new ForbiddenError();
  const orders = (await safeList("orders", { status: LIVE })) as Order[];
  const byId = new Map(orders.map((o) => [o.id, o]));
  const ids = orders.map((o) => o.id);
  const row = (o: Order, detail: string): OrderRow => ({
    id: o.id,
    number: o.number,
    detail,
  });
  const now = Date.now();

  switch (area) {
    case "purchasing": {
      const [requests, approvals, sheets] = await Promise.all([
        safeList("requests", {
          status: ["REQUESTED", "RFQ_OPEN", "QUOTATION_RECEIVED"],
        }),
        safeList("approvals"),
        safeList("purchase_sheets", { dumping: "yes" }),
      ]);
      const pending = approvals.filter((a) => a.status === "pending");
      const decided = approvals.filter(
        (a) =>
          a.decidedAt && (a.status === "approved" || a.status === "rejected"),
      );
      const held = sheets.filter((s) => !s.dumpingReleasedAt);
      return {
        area,
        metrics: [
          {
            key: "openRequests",
            value: requests.length,
            href: "/app/requests",
          },
          {
            key: "awaitingQuotes",
            value: requests.filter((r) => r.status === "RFQ_OPEN").length,
          },
          {
            key: "toSelect",
            value: requests.filter((r) => r.status === "QUOTATION_RECEIVED")
              .length,
            tone: "warning",
          },
          {
            key: "pendingApprovals",
            value: pending.length,
            tone: pending.length ? "warning" : "neutral",
            href: "/app/tasks",
          },
          {
            key: "approvalDays",
            value: avg(
              decided.map((a) =>
                days(Date.parse(a.decidedAt!) - Date.parse(a.createdAt)),
              ),
            ),
          },
          {
            key: "rejectionRate",
            value: decided.length
              ? `${Math.round((decided.filter((a) => a.status === "rejected").length / decided.length) * 100)}%`
              : "—",
          },
          {
            key: "dumpingHeld",
            value: held.length,
            tone: held.length ? "danger" : "neutral",
          },
        ],
        attention: [],
      };
    }
    case "production": {
      const [tracks, skus] = await Promise.all([
        safeList("production_tracks", { orderId: ids }),
        safeList("sku_inspections", { orderId: ids }),
      ]);
      const shifts = tracks
        .filter((t) => t.etd && t.etdOriginal)
        .map((t) => days(Date.parse(t.etd!) - Date.parse(t.etdOriginal!)));
      const overdue = tracks.filter((t) => followupsDue(t).length);
      const delayed = tracks.filter((t) =>
        (t.followups ?? []).some((f) => f.status === "delayed"),
      );
      const rejected = skus.filter((s) => s.result === "rejected");
      return {
        area,
        metrics: [
          { key: "tracked", value: tracks.length },
          {
            key: "followupsDue",
            value: overdue.length,
            tone: overdue.length ? "warning" : "neutral",
            href: "/app/tasks",
          },
          {
            key: "delayed",
            value: delayed.length,
            tone: delayed.length ? "danger" : "neutral",
          },
          { key: "etdChanged", value: shifts.filter((d) => d !== 0).length },
          { key: "etdShiftAvg", value: avg(shifts.filter((d) => d !== 0)) },
          {
            key: "skuRejectRate",
            value: skus.length
              ? `${Math.round((rejected.length / skus.length) * 100)}%`
              : "—",
          },
        ],
        attention: [
          ...delayed.map((t) => {
            const o = byId.get(t.orderId);
            const last = [...(t.followups ?? [])]
              .reverse()
              .find((f) => f.status === "delayed");
            return o ? row(o, last?.note ?? "") : null;
          }),
          ...overdue.map((t) => {
            const o = byId.get(t.orderId);
            return o
              ? row(
                  o,
                  `follow ${followupsDue(t)
                    .map((f) => f.day)
                    .join("/")}`,
                )
              : null;
          }),
        ]
          .filter((r): r is OrderRow => !!r)
          .slice(0, 10),
      };
    }
    case "shipping": {
      const steps = await safeList("import_steps", { orderId: ids });
      const ship = steps.filter((s) => !s.key.startsWith("cert_"));
      const channels = ["green", "yellow", "red", "grey"].map(
        (c) => ship.filter((s) => s.key === "channel" && s.value === c).length,
      );
      const rejected = ship.filter((s) => s.status === "rejected");
      const toValidate = ship.filter((s) => s.status === "submitted");
      return {
        area,
        metrics: [
          {
            key: "inTransit",
            value: orders.filter((o) =>
              ["SHIPPING", "CUSTOMS", "TRANSPORT"].includes(o.status),
            ).length,
          },
          {
            key: "toValidate",
            value: toValidate.length,
            tone: toValidate.length ? "warning" : "neutral",
          },
          {
            key: "rejectedSteps",
            value: rejected.length,
            tone: rejected.length ? "danger" : "neutral",
          },
          { key: "channelGreen", value: channels[0], tone: "success" },
          { key: "channelYellow", value: channels[1] },
          {
            key: "channelRed",
            value: channels[2] + channels[3],
            tone: channels[2] + channels[3] ? "danger" : "neutral",
          },
        ],
        attention: rejected
          .map((s) => {
            const o = byId.get(s.orderId);
            return o ? row(o, `${s.key}: ${s.rejectReason ?? ""}`) : null;
          })
          .filter((r): r is OrderRow => !!r)
          .slice(0, 10),
      };
    }
    case "receiving": {
      const rows = await safeList("receivings", { orderId: ids });
      const divergent = rows.filter((r) =>
        (r.items ?? []).some((i) => i.received !== i.expected || i.damaged > 0),
      );
      const broken = rows.filter((r) => r.sealIntact === "no");
      const notReturned = rows.filter((r) => !r.containerReturnedAt);
      return {
        area,
        metrics: [
          {
            key: "receivingOpen",
            value: rows.filter((r) => !r.closedAt).length,
          },
          {
            key: "divergences",
            value: divergent.length,
            tone: divergent.length ? "danger" : "neutral",
          },
          {
            key: "brokenSeals",
            value: broken.length,
            tone: broken.length ? "danger" : "neutral",
          },
          {
            key: "containersOut",
            value: notReturned.length,
            tone: notReturned.length ? "warning" : "neutral",
          },
        ],
        attention: divergent
          .map((r) => {
            const o = byId.get(r.orderId);
            const n = (r.items ?? []).filter(
              (i) => i.received !== i.expected || i.damaged > 0,
            ).length;
            return o ? row(o, `${n} SKU`) : null;
          })
          .filter((r): r is OrderRow => !!r)
          .slice(0, 10),
      };
    }
    case "certification": {
      const [steps, issues] = await Promise.all([
        safeList("import_steps", { orderId: ids }),
        safeList("art_issues", { orderId: ids }),
      ]);
      const cert = steps.filter((s) => s.key.startsWith("cert_"));
      const registered = cert.filter(
        (s) => s.key === "cert_registration" && s.status === "validated",
      );
      const inProgress = new Set(
        cert.filter((s) => s.status !== "validated").map((s) => s.orderId),
      );
      const open = issues.filter((i) => i.status === "open");
      const fixed = issues.filter((i) => i.status !== "open" && i.fixedAt);
      return {
        area,
        metrics: [
          { key: "certInProgress", value: inProgress.size },
          { key: "certRegistered", value: registered.length, tone: "success" },
          {
            key: "artOpen",
            value: open.length,
            tone: open.length ? "warning" : "neutral",
          },
          {
            key: "artAwaiting",
            value: issues.filter((i) => i.status === "fixed").length,
          },
          {
            key: "artFixDays",
            value: avg(
              fixed.map((i) =>
                days(Date.parse(i.fixedAt!) - Date.parse(i.createdAt)),
              ),
            ),
          },
        ],
        attention: open
          .map((i) => {
            const o = byId.get(i.orderId);
            return o ? row(o, i.note.split("\n")[0]) : null;
          })
          .filter((r): r is OrderRow => !!r)
          .slice(0, 10),
      };
    }
    case "finance": {
      const [steps, payments] = await Promise.all([
        safeList("import_steps", { orderId: ids, key: "numerario" }),
        safeList("payments", { status: "pending" }),
      ]);
      const numerarioToValidate = steps.filter((s) => s.status === "submitted");
      const numerarioTotal = numerarioToValidate.reduce(
        (a, s) => a + (s.amount ?? 0),
        0,
      );
      const erpPending = orders.filter(
        (o) => o.erpSyncStatus === "pending" || o.erpSyncStatus === "failed",
      );
      const pendingIn = payments.filter((p) => p.direction === "customer_in");
      const pendingOut = payments.filter((p) => p.direction === "supplier_out");
      const stale = pendingIn.filter(
        (p) => now - Date.parse(p.createdAt) > 7 * DAY,
      );
      return {
        area,
        metrics: [
          {
            key: "downPaymentsPending",
            value: pendingIn.length,
            tone: stale.length
              ? "danger"
              : pendingIn.length
                ? "warning"
                : "neutral",
            href: "/app/finance",
          },
          {
            key: "supplierPaymentsPending",
            value: pendingOut.length,
            href: "/app/payables",
          },
          {
            key: "numerarioToValidate",
            value: numerarioToValidate.length,
            tone: numerarioToValidate.length ? "warning" : "neutral",
          },
          {
            key: "numerarioAmount",
            value: numerarioTotal.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            }),
          },
          {
            key: "erpPending",
            value: erpPending.length,
            tone: erpPending.length ? "warning" : "neutral",
          },
        ],
        attention: numerarioToValidate
          .map((s) => {
            const o = byId.get(s.orderId);
            return o
              ? row(
                  o,
                  (s.amount ?? 0).toLocaleString("pt-BR", {
                    style: "currency",
                    currency: s.currency ?? "BRL",
                  }),
                )
              : null;
          })
          .filter((r): r is OrderRow => !!r)
          .slice(0, 10),
      };
    }
  }
}
