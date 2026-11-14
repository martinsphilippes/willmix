import "server-only";
import { getStore } from "@/lib/db";
import type { BookingLot, SupplierRequest } from "@/lib/db/schema";
import {
  BOOK_PERCENT,
  PROGRESS_BLOCKS,
  lateDaysSince,
  orderProgress,
  overallOf,
  requestPercent,
  type ProgressBlock,
} from "@/lib/flow-progress";
import { getSettings } from "@/lib/settings";
import {
  supplierRequestLate,
  supplierRequestSlaDue,
} from "@/lib/supplier-requests";

/*
 * Linha do tempo do book e da solicitação ao fornecedor (dono, 14/11/2026;
 * docs/FLOW_MENU.md): a entidade do Produto novo aberta pelo Overview mostra
 * os passos do bloco em cor (situação, prazo, atraso) e os blocos seguintes
 * (Pedido, Produção, Entrega) em cinza, com o percentual dos pedidos que
 * nasceram dela. Só leitura.
 */

export type EntityStepState = "done" | "current" | "pending";

export interface EntityTimelineStep {
  key: "books" | "selection" | "quotes" | "negotiations";
  state: EntityStepState;
  /** Texto da situação: chave do dicionário e valores. */
  detail: { key: string; values?: Record<string, string | number> } | null;
  lateDays: number;
  href?: string;
}

export interface EntityTimeline {
  /** Completude no Produto novo. */
  percent: number;
  /** Completude geral: o Produto novo e os pedidos que nasceram dela. */
  overall: number;
  steps: EntityTimelineStep[];
  /** Pedidos que nasceram da entidade, bloco a bloco (média). */
  blocks: { block: ProgressBlock; percent: number }[];
  orders: number;
  lateDays: number;
}

const mean = (xs: number[]) =>
  xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0;

/** Os blocos de Pedido a Entrega dos pedidos (média de cada bloco e do geral). */
async function ordersProgress(orderIds: string[], now: Date) {
  const ids = [...new Set(orderIds)];
  const stages = ids.length
    ? await getStore().list("stages", { filter: { orderId: ids } })
    : [];
  const progress = ids.map((id) =>
    orderProgress(
      stages.filter((s) => s.orderId === id),
      now,
    ),
  );
  return {
    blocks: PROGRESS_BLOCKS.map((block) => ({
      block,
      percent: mean(
        progress.map(
          (p) => p.blocks.find((b) => b.block === block)?.percent ?? 0,
        ),
      ),
    })),
    overall: mean(progress.map((p) => p.overall)),
    orders: ids.length,
  };
}

export async function bookTimeline(
  lot: BookingLot,
  now = new Date(),
): Promise<EntityTimeline> {
  const store = getStore();
  const [invites, requests] = await Promise.all([
    store
      .list("booking_invites", { filter: { bookingLotId: lot.id } })
      .catch(() => []),
    store.list("supplier_requests", { filter: { bookingLotId: lot.id } }),
  ]);
  const openInvites = invites.filter((i) => i.status === "open");
  const inviteLate = Math.max(
    0,
    ...openInvites.map((i) => lateDaysSince(i.dueAt, now)),
  );
  const minutes = (await getSettings()).supplierRequestSlaMinutes;
  const live = requests.filter((r) => requestPercent(r) !== null);
  const reqLate = Math.max(
    0,
    ...live.map((r) =>
      supplierRequestLate(r, minutes, now)
        ? lateDaysSince(supplierRequestSlaDue(r, minutes), now)
        : 0,
    ),
  );
  const s = lot.status;
  const checked = s !== "preparing" && s !== "draft";
  const orders = await ordersProgress(
    requests.map((r) => r.orderId).filter((x): x is string => !!x),
    now,
  );
  const percent = BOOK_PERCENT[s] ?? 0;
  return {
    percent,
    overall: overallOf(percent, orders.orders, orders.overall),
    steps: [
      {
        key: "books",
        state: checked ? "done" : "current",
        detail: { key: `bookingLots.status.${s}` },
        lateDays: 0,
      },
      {
        key: "selection",
        state: s === "done" ? "done" : checked ? "current" : "pending",
        detail: checked ? { key: `bookingLots.status.${s}` } : null,
        lateDays: 0,
      },
      {
        key: "quotes",
        state: openInvites.length
          ? "current"
          : invites.some((i) => i.status === "answered")
            ? "done"
            : "pending",
        detail: invites.length
          ? {
              key: "flow.np.invites",
              values: {
                open: openInvites.length,
                answered: invites.filter((i) => i.status === "answered").length,
              },
            }
          : null,
        lateDays: inviteLate,
      },
      {
        key: "negotiations",
        state: !live.length
          ? "pending"
          : live.every((r) => requestPercent(r) === 100 || r.orderId)
            ? "done"
            : "current",
        detail: live.length
          ? {
              key: "flow.np.requests",
              values: {
                n: live.length,
                percent: mean(live.map((r) => requestPercent(r) ?? 0)),
              },
            }
          : null,
        lateDays: reqLate,
      },
    ],
    blocks: orders.blocks,
    orders: orders.orders,
    lateDays: Math.max(inviteLate, reqLate),
  };
}

export async function requestTimeline(
  r: SupplierRequest,
  now = new Date(),
): Promise<EntityTimeline> {
  const minutes = (await getSettings()).supplierRequestSlaMinutes;
  const late = supplierRequestLate(r, minutes, now)
    ? lateDaysSince(supplierRequestSlaDue(r, minutes), now)
    : 0;
  const percent = requestPercent(r) ?? 0;
  const orders = await ordersProgress(r.orderId ? [r.orderId] : [], now);
  const lotHref = `/app/booking/lots/${r.bookingLotId}#entity-timeline`;
  return {
    percent,
    overall: overallOf(percent, orders.orders, orders.overall),
    steps: [
      {
        key: "books",
        state: "done",
        detail: { key: "flow.np.fromBook" },
        lateDays: 0,
        href: lotHref,
      },
      {
        key: "selection",
        state: "done",
        detail: { key: "flow.np.selected" },
        lateDays: 0,
      },
      {
        key: "negotiations",
        state:
          percent === 100 || r.orderId
            ? "done"
            : requestPercent(r) === null
              ? "pending"
              : "current",
        detail: {
          key:
            r.status === "approved"
              ? `flow.np.sampling.${r.sampling?.status ?? "pending"}`
              : `supplierRequests.status.${r.status}`,
        },
        lateDays: late,
      },
    ],
    blocks: orders.blocks,
    orders: orders.orders,
    lateDays: late,
  };
}
