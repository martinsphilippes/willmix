import "server-only";

import { isWellmix } from "@/lib/auth/permissions";
import { getStore, type Order, type Requirement, type User } from "@/lib/db";
import {
  LANE_KEYS,
  baseKeyOf,
  blockedBy,
  itemIdOf,
  laneDueAt,
} from "@/lib/purchase-lanes";

/*
 * Mesas de trabalho por papel (mapa do processo, "Mesas de trabalho";
 * docs/DESKS.md): o que espera cada área na etapa Pedido, em filas, com o
 * prazo de cada passo e o atalho para a tela onde se faz. Só leitura: as
 * filas saem dos mesmos itens que as pendências e as raias usam.
 *
 * - GP: amostras a avaliar e certificados dos pedidos (aprovação dele).
 * - Cadastro e fiscal: NCM a validar, fichas incompletas, certificações a
 *   vencer e falhas da sincronização com o Sankhya.
 * - Marketing: artes a validar e produtos novos fora da vitrine.
 * - Agência de arte: artes a fazer (e as devolvidas) e artes finais com o selo.
 * - Certificadora: certificados a emitir.
 */

export const DESK_KEYS = ["gp", "cadastro", "mkt", "agency", "ocp"] as const;
export type DeskKey = (typeof DESK_KEYS)[number];

export const isDeskKey = (v: unknown): v is DeskKey =>
  typeof v === "string" && (DESK_KEYS as readonly string[]).includes(v);

export interface DeskRow {
  id: string;
  /** Produto ou assunto. */
  title: string;
  orderNumber: number | null;
  /** Situação curta (ex.: "Devolvida: Logo maior"). */
  note: string | null;
  dueAt: string | null;
  /** Prazo já vencido (na hora da leitura). */
  late?: boolean;
  link: string;
}

export interface DeskQueue {
  key: string;
  rows: DeskRow[];
}

/** Mesas que o login abre: a Wellmix as dela; agência e certificadora, a sua. */
export function desksFor(user: User): DeskKey[] {
  if (isWellmix(user)) return ["gp", "cadastro", "mkt", "agency", "ocp"];
  if (user.role === "agency") return ["agency"];
  if (user.role === "ocp") return ["ocp"];
  return [];
}

/** Mesa que abre primeiro: pela função do login da Wellmix (GP, cadastro, designer). */
export function defaultDesk(user: User): DeskKey | null {
  const desks = desksFor(user);
  if (!desks.length) return null;
  const fns = user.functions ?? [];
  if (fns.includes("catalog")) return "cadastro";
  if (fns.includes("designer")) return "mkt";
  if (fns.includes("product_manager")) return "gp";
  return desks[0];
}

const productOf = (r: Pick<Requirement, "label">) =>
  r.label.split(" · ").slice(1).join(" · ").trim() || r.label;

const byDue = (a: DeskRow, b: DeskRow) =>
  (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999");

interface LaneData {
  orders: Order[];
  requirements: Requirement[];
  stageStart: Map<string, string | null>;
  items: Map<string, string | null>;
  sla: Awaited<ReturnType<typeof import("./purchase-order").purchaseLaneSla>>;
}

/** Pedidos de compra na Preparação ou no contrato (do parceiro, quando é ele). */
async function laneData(
  filter: Partial<Pick<Order, "agencyId" | "ocpId">> = {},
): Promise<LaneData> {
  const store = getStore();
  const orders = (
    await store.list("orders", {
      filter: {
        flow: "supplier_request",
        status: ["PREPARATION", "PACKAGING"],
        ...filter,
      },
    })
  ).sort((a, b) => a.number - b.number);
  const ids = orders.map((o) => o.id);
  const [requirements, stages, items] = ids.length
    ? await Promise.all([
        store.list("requirements", { filter: { orderId: ids } }),
        store.list("stages", { filter: { orderId: ids } }),
        store.list("order_items", { filter: { orderId: ids } }),
      ])
    : [[], [], []];
  const { purchaseLaneSla } = await import("./purchase-order");
  return {
    orders,
    requirements,
    stageStart: new Map(stages.map((s) => [s.id, s.startedAt])),
    items: new Map(items.map((i) => [i.id, i.productId ?? null])),
    sla: await purchaseLaneSla(),
  };
}

/** Itens abertos e já liberados com a chave base dada. */
function openLane(
  data: LaneData,
  bases: string[],
  link: (order: Order, r: Requirement, productId: string | null) => string,
): DeskRow[] {
  const rows: DeskRow[] = [];
  for (const order of data.orders) {
    const mine = data.requirements.filter((r) => r.orderId === order.id);
    for (const r of mine) {
      if (r.status === "done" || !bases.includes(baseKeyOf(r.key))) continue;
      const stage = mine.filter((x) => x.stageId === r.stageId);
      if (blockedBy(r.key, stage).length) continue;
      const productId = data.items.get(itemIdOf(r.key) ?? "") ?? null;
      rows.push({
        id: r.id,
        title: productOf(r),
        orderNumber: order.number,
        note: r.status === "rejected" ? r.note : null,
        dueAt: laneDueAt(
          r.key,
          order.createdAt,
          stage,
          data.sla,
          data.stageStart.get(r.stageId) ?? null,
        ),
        link: link(order, r, productId),
      });
    }
  }
  return rows.sort(byDue);
}

const orderLink =
  (anchor = "") =>
  (order: Order) =>
    `/app/orders/${order.id}${anchor}`;

/** As filas da mesa. Recusa (vazio) a mesa que o login não abre. */
export async function loadDesk(
  user: User,
  desk: DeskKey,
): Promise<DeskQueue[]> {
  const now = Date.now();
  return (await queuesOf(user, desk)).map((q) => ({
    ...q,
    rows: q.rows.map((r) => ({
      ...r,
      late: !!r.dueAt && Date.parse(r.dueAt) < now,
    })),
  }));
}

async function queuesOf(user: User, desk: DeskKey): Promise<DeskQueue[]> {
  if (!desksFor(user).includes(desk)) return [];
  const store = getStore();
  const wellmix = isWellmix(user);
  switch (desk) {
    case "gp": {
      const data = await laneData();
      const requests = await store
        .list("supplier_requests", { filter: { status: "approved" } })
        .catch(() => []);
      const samples: DeskRow[] = requests
        .filter((r) => r.sampling?.status === "submitted")
        .map((r) => ({
          id: r.id,
          title:
            r.item.productName ??
            r.item.description ??
            r.item.factoryItemCode ??
            `#${r.number}`,
          orderNumber: null,
          note: null,
          dueAt: null,
          link: `/app/supplier-requests/${r.id}?view=item`,
        }));
      return [
        { key: "samples", rows: samples },
        {
          key: "certificates",
          rows: openLane(
            data,
            [LANE_KEYS.certificate],
            orderLink("#certification"),
          ),
        },
      ];
    }
    case "cadastro": {
      const data = await laneData();
      const { expiringCertifications } = await import("./compliance");
      const expiring = await expiringCertifications().catch(() => []);
      const errors = await store
        .list("process_events", { filter: { status: "error" } })
        .catch(() => []);
      const since = Date.now() - 7 * 86_400_000;
      return [
        {
          key: "ncm",
          rows: openLane(data, [LANE_KEYS.ncmValidated], (o, _r, p) =>
            p ? `/app/products/${p}/tax` : `/app/orders/${o.id}`,
          ),
        },
        {
          key: "sheet",
          rows: openLane(data, [LANE_KEYS.sheetComplete], (o, _r, p) =>
            p ? `/app/products/${p}#photos` : `/app/orders/${o.id}`,
          ),
        },
        {
          key: "certExpiring",
          rows: expiring
            .map((c) => ({
              id: c.id,
              title: `${c.kind}${c.number ? ` ${c.number}` : ""}`,
              orderNumber: null,
              note: c.name,
              dueAt: c.validUntil,
              link:
                c.entity === "product"
                  ? `/app/products/${c.entityId}`
                  : `/app/parties/${c.entityId}`,
            }))
            .sort(byDue),
        },
        {
          key: "sankhya",
          rows: errors
            .filter((e) => Date.parse(e.createdAt) >= since)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .slice(0, 50)
            .map((e) => ({
              id: e.id,
              title: e.event,
              orderNumber: null,
              note: e.detail,
              dueAt: null,
              link: "/app/settings/sankhya?tab=process",
            })),
        },
      ];
    }
    case "mkt": {
      const data = await laneData();
      const { hiddenBookingProductIds } = await import("./booking-visibility");
      const hidden = [...(await hiddenBookingProductIds())];
      const products = hidden.length
        ? await store.list("products", { filter: { id: hidden } })
        : [];
      return [
        {
          key: "artReview",
          rows: openLane(data, [LANE_KEYS.artReview], orderLink()),
        },
        {
          key: "showcase",
          rows: products
            .filter((p) => p.active)
            .map((p) => ({
              id: p.id,
              title: p.name,
              orderNumber: null,
              note: null,
              dueAt: null,
              link: `/app/products/${p.id}`,
            })),
        },
      ];
    }
    case "agency": {
      const data = await laneData(
        wellmix ? {} : { agencyId: user.partyId ?? "__none__" },
      );
      return [
        { key: "art", rows: openLane(data, [LANE_KEYS.art], orderLink()) },
        {
          key: "artFinal",
          rows: openLane(data, [LANE_KEYS.artFinal], orderLink()),
        },
      ];
    }
    case "ocp": {
      const data = await laneData(
        wellmix ? {} : { ocpId: user.partyId ?? "__none__" },
      );
      return [
        {
          key: "certificates",
          rows: openLane(
            data,
            [LANE_KEYS.certificate],
            orderLink("#certification"),
          ),
        },
      ];
    }
  }
}
