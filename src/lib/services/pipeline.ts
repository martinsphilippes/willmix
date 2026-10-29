import "server-only";

import { getStore, type StageKey, type User } from "@/lib/db";
import {
  canSeeSupplier,
  canViewOrder,
  isWellmix,
} from "@/lib/auth/permissions";

/*
 * Painel de Pedidos: cada pedido com a etapa em que está (cancelado mostra a
 * etapa em que parou) e, para a Wellmix, também as solicitações que ainda
 * não viraram pedido (solicitado, RFQ, cotações, aguardando sinal,
 * canceladas/excluídas). Os demais papéis veem só os pedidos que já viam.
 */

export type PipelineState = "active" | "blocked" | "done" | "cancelled";

/** Item mostrado ao abrir a linha: produto, variação e quantidade. */
export interface PipelineItem {
  name: string;
  variant: string | null;
  quantity: number;
  unit: string;
  /** Solicitação do mesmo lote (abre a própria); nulo nos itens do pedido. */
  href: string | null;
  /** Situação da solicitação do lote (reqStatusLabel.*); nulo no pedido. */
  status: string | null;
}

export interface PipelineRow {
  /** "order:<id>" ou "request:<id>". */
  key: string;
  kind: "order" | "request";
  href: string;
  number: number | null;
  product: string;
  /** Só para a Wellmix. */
  customer: string | null;
  /** Só para quem pode ver o fornecedor (e não é o próprio). */
  supplier: string | null;
  /** Etapa do pedido (chave de stage.*) ou situação da solicitação (reqStatusLabel.*). */
  phase: { kind: "stage"; key: StageKey } | { kind: "request"; key: string };
  state: PipelineState;
  /** Quanto da etapa atual foi cumprido (pedidos em andamento). */
  progress: number | null;
  dueAt: string | null;
  updatedAt: string;
  /** Itens do pedido ou produtos do mesmo lote da solicitação. */
  items: PipelineItem[];
}

const STATE_ORDER: Record<PipelineState, number> = {
  blocked: 0,
  active: 1,
  done: 2,
  cancelled: 3,
};

export async function pipelineFor(user: User): Promise<PipelineRow[]> {
  const store = getStore();
  const wellmix = isWellmix(user);
  const [orders, parties, stages, items, requests, quotes] = await Promise.all([
    store.list("orders", { orderBy: "number", direction: "desc" }),
    store.list("parties"),
    store.list("stages", { filter: { status: ["active", "blocked"] } }),
    store.list("order_items"),
    wellmix ? store.list("requests") : Promise.resolve([]),
    wellmix
      ? store.list("quotes", { filter: { status: "selected" } })
      : Promise.resolve([]),
  ]);
  const name = (id: string | null | undefined) =>
    (id && parties.find((p) => p.id === id)?.name) || null;
  const showSupplier = canSeeSupplier(user) && user.role !== "supplier";
  const rows: PipelineRow[] = [];

  for (const o of orders) {
    if (!canViewOrder(user, o)) continue;
    const stage = stages.find((s) => s.orderId === o.id);
    const cancelled = o.status === "CANCELLED";
    const closed = o.status === "CLOSED";
    rows.push({
      key: `order:${o.id}`,
      kind: "order",
      href: `/app/orders/${o.id}`,
      number: o.number,
      product: items.find((i) => i.orderId === o.id)?.name ?? "—",
      items: items
        .filter((i) => i.orderId === o.id)
        .map((i) => ({
          name: i.name,
          variant: i.variant?.name ?? null,
          quantity: i.quantity,
          unit: i.unit,
          href: null,
          status: null,
        })),
      customer: wellmix ? name(o.customerId) : null,
      supplier: showSupplier ? name(o.supplierId) : null,
      // Cancelado: a etapa em que estava (pedidos antigos sem ela: "Cancelado").
      phase: cancelled
        ? o.cancelStageKey
          ? { kind: "stage", key: o.cancelStageKey }
          : { kind: "request", key: "CANCELLED" }
        : { kind: "stage", key: o.status as StageKey },
      state: cancelled
        ? "cancelled"
        : closed
          ? "done"
          : stage?.status === "blocked"
            ? "blocked"
            : "active",
      progress: cancelled ? null : closed ? 100 : (stage?.percent ?? 0),
      dueAt: cancelled || closed ? null : (stage?.dueAt ?? null),
      updatedAt: o.updatedAt,
    });
  }

  // Wellmix: solicitações que ainda não viraram pedido (as que viraram
  // aparecem pelo pedido).
  for (const r of requests) {
    if (r.status === "ORDERED") continue;
    const selected = r.selectedQuoteId
      ? quotes.find((q) => q.id === r.selectedQuoteId)
      : null;
    rows.push({
      key: `request:${r.id}`,
      kind: "request",
      href: `/app/requests/${r.id}`,
      number: r.number ?? null,
      product: r.productName,
      // Lote: os produtos enviados juntos (mesmo formulário); sozinha, ela mesma.
      items: (r.groupId ? requests.filter((x) => x.groupId === r.groupId) : [r])
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((x) => ({
          name: x.productName,
          variant: x.variant?.name ?? null,
          quantity: x.quantity,
          unit: x.unit,
          href: x.id === r.id ? null : `/app/requests/${x.id}`,
          status: x.status,
        })),
      customer: name(r.customerId),
      supplier: selected ? name(selected.supplierId) : null,
      phase: { kind: "request", key: r.status },
      state: r.status === "CANCELLED" ? "cancelled" : "active",
      progress: null,
      dueAt: r.status === "CANCELLED" ? null : r.deadline,
      updatedAt: r.updatedAt,
    });
  }

  return rows.sort(
    (a, b) =>
      STATE_ORDER[a.state] - STATE_ORDER[b.state] ||
      b.updatedAt.localeCompare(a.updatedAt),
  );
}
