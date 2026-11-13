import "server-only";
import { realName } from "@/lib/placeholder-name";
import { indexBy, listByIds, listColumns } from "@/lib/db/lookup";

import {
  getStore,
  type Stage,
  type StageKey,
  type User,
  type VariantSnapshot,
} from "@/lib/db";
import {
  canSeeSupplier,
  canViewOrder,
  ORDER_ACCESS_FIELDS,
  isWellmix,
} from "@/lib/auth/permissions";
import {
  journeyIndex,
  loadJourneyInput,
  type JourneyInput,
  type JourneyStep,
} from "./journey";
import type { OrderFacts } from "./order-summary";

/*
 * Painel de Pedidos: cada pedido com a etapa em que está (cancelado mostra a
 * etapa em que parou) e, para a Wellmix, também as solicitações que ainda
 * não viraram pedido (solicitado, RFQ, cotações, aguardando sinal,
 * canceladas/excluídas). Os demais papéis veem só os pedidos que já viam.
 */

export type PipelineState = "active" | "blocked" | "done" | "cancelled";

/** Item do pedido/da solicitação (painel de itens embaixo da lista). */
export interface PipelineItem {
  /** Item do pedido (o chat desce até ele); nulo na solicitação. */
  id?: string | null;
  name: string;
  variant: string | null;
  quantity: number;
  unit: string;
  /** Preço unitário FOB do fornecedor: só a Wellmix (nulo para os demais). */
  unitPrice: number | null;
  currency: string | null;
  /*
   * Para foto, código, especificação, caixas, volume e peso na tabela de
   * itens (como a folha do fornecedor): só a Wellmix (nulos para os demais).
   */
  productId: string | null;
  variantData: VariantSnapshot | null;
  /** Especificação da solicitação (vale antes da do cadastro). */
  specification: string | null;
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
  /**
   * Passo da viagem, o mesmo dos quadrados da Control Tower (journey.ts):
   * encerrado no fim; cancelado, onde parou; nulo quando não se sabe.
   */
  journey: JourneyStep | null;
  dueAt: string | null;
  updatedAt: string;
  /** Itens do pedido (ou o produto da solicitação). */
  items: PipelineItem[];
  /**
   * Solicitação a que a linha pertence (lote = mesmo groupId): a tela junta
   * as linhas do mesmo grupo numa linha só, com os itens embaixo.
   */
  groupKey: string;
  /** Página do grupo (lote) quem pode abrir; nulo = a da própria linha. */
  groupHref: string | null;
  /** Número da solicitação (o mesmo para o lote). */
  requestNumber: number | null;
}

/**
 * A mesma entrada de `loadJourneyInput`, montada do resumo dos pedidos dados
 * (etapas e itens de etapa, passos do embarque) e da revisão aberta.
 */
async function journeyInputFromFacts(
  facts: OrderFacts[],
  activeStages: JourneyInput["activeStages"],
  rowsOf: (f: OrderFacts[]) => {
    stages: JourneyInput["stages"];
    requirements: JourneyInput["requirements"];
  },
  now = new Date(),
): Promise<JourneyInput> {
  const { stages, requirements } = rowsOf(facts);
  const reviews = await getStore().list("review_items", {
    filter: { status: "open" },
    orderBy: "createdAt",
    direction: "desc",
  });
  return {
    now,
    activeStages,
    stages,
    requirements,
    steps: facts.flatMap((f) => f.steps),
    reviews,
  };
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
  // Só as colunas usadas: a cópia do registro do ERP (sankhyaRefs) era mais
  // da metade dos pedidos e itens (com ~100 mil itens, a tela passava dos
  // 300 s da Vercel).
  const requestColumns = [
    "groupId",
    "number",
    "specification",
    "status",
    "customerId",
    "productName",
    "variant",
    "quantity",
    "unit",
    "productId",
    "deadline",
  ] as const;
  const [orders, items, requests] = await Promise.all([
    listColumns(
      store,
      "orders",
      [
        ...ORDER_ACCESS_FIELDS,
        "number",
        "status",
        "requestId",
        "fobCurrency",
        "cancelStageKey",
      ],
      { orderBy: "number", direction: "desc" },
    ),
    listColumns(store, "order_items", [
      "orderId",
      "name",
      "variant",
      "quantity",
      "unit",
      "unitPrice",
      "productId",
    ]),
    wellmix
      ? listColumns(store, "requests", requestColumns)
      : Promise.resolve([]),
  ]);
  // Etapas e viagem: do resumo por pedido (docs/RESUMOS.md) quando em uso.
  const { factsForOrders, activeStagesFromFacts, journeyRowsFromFacts } =
    await import("./order-summary");
  const facts = await factsForOrders(orders);
  const stages: Array<Pick<Stage, "orderId" | "status" | "percent" | "dueAt">> =
    facts
      ? activeStagesFromFacts([...facts.values()])
      : await listColumns(
          store,
          "stages",
          ["orderId", "status", "percent", "dueAt"],
          { filter: { status: ["active", "blocked"] } },
        );
  const stageByOrder = indexBy(stages, "orderId");
  // Só os parceiros que aparecem (antes: a tabela inteira, ~32 mil).
  const parties = indexBy(
    await listByIds(store, "parties", [
      ...orders.flatMap((o) => [o.customerId, o.supplierId]),
      ...requests.map((r) => r.customerId),
    ]),
    "id",
  );
  const itemsByOrder = new Map<string, typeof items>();
  for (const i of items) {
    const list = itemsByOrder.get(i.orderId);
    if (list) list.push(i);
    else itemsByOrder.set(i.orderId, [i]);
  }
  const name = (id: string | null | undefined) =>
    (id && parties.get(id)?.name) || null;
  // Solicitação de cada pedido (lote e número). A Wellmix já carregou todas;
  // os demais, só as dos pedidos que veem (só groupId e número são usados).
  const visibleOrders = orders.filter((o) => canViewOrder(user, o));
  const orderRequests = wellmix
    ? requests
    : await (async () => {
        const ids = [
          ...new Set(
            visibleOrders
              .map((o) => o.requestId)
              .filter((id): id is string => !!id),
          ),
        ];
        return ids.length
          ? listColumns(store, "requests", requestColumns, {
              filter: { id: ids },
            })
          : [];
      })();
  const requestById = new Map(orderRequests.map((r) => [r.id, r]));
  // Página do lote: Wellmix e cliente abrem; os demais ficam na linha.
  const lotePage = wellmix || user.role === "customer";
  const group = (
    request: { id: string; groupId?: string | null } | undefined,
    own: string,
  ) =>
    request?.groupId
      ? {
          groupKey: `group:${request.groupId}`,
          groupHref: lotePage
            ? `/app/requests/batch/${encodeURIComponent(request.groupId)}`
            : null,
        }
      : { groupKey: own, groupHref: null };
  const showSupplier = canSeeSupplier(user) && user.role !== "supplier";
  // Passo da viagem: pedidos em andamento e cancelados (onde pararam) e as
  // solicitações abertas, com a regra da Control Tower.
  const journeyOrders = visibleOrders.filter(
    (o) =>
      o.status !== "CLOSED" && (o.status !== "CANCELLED" || !!o.cancelStageKey),
  );
  const journey = journeyIndex(
    facts
      ? await journeyInputFromFacts(
          journeyOrders.flatMap((o) => facts.get(o.id) ?? []),
          stages,
          journeyRowsFromFacts,
        )
      : await loadJourneyInput(
          journeyOrders.map((o) => o.id),
          requests
            .filter((r) => r.status !== "ORDERED" && r.status !== "CANCELLED")
            .map((r) => r.id),
        ),
  );
  const rows: PipelineRow[] = [];

  for (const o of visibleOrders) {
    const request = o.requestId ? requestById.get(o.requestId) : undefined;
    const stage = stageByOrder.get(o.id);
    const cancelled = o.status === "CANCELLED";
    const closed = o.status === "CLOSED";
    rows.push({
      key: `order:${o.id}`,
      kind: "order",
      // Fornecedor entra pelo documento do pedido (as pendências dele
      // estão lá, com o atalho de cada uma); a gestão é da Wellmix.
      href:
        user.role === "supplier"
          ? `/app/orders/${o.id}/purchase-order`
          : `/app/orders/${o.id}`,
      number: o.number,
      // Nome de exemplo ("Produto novo XPTO") vale como ausente.
      product: realName(itemsByOrder.get(o.id)?.[0]?.name) ?? "—",
      items: (itemsByOrder.get(o.id) ?? []).map((i) => ({
        id: i.id,
        name: realName(i.name) ?? "—",
        variant: i.variant?.name ?? null,
        quantity: i.quantity,
        unit: i.unit,
        unitPrice: wellmix ? i.unitPrice : null,
        currency: wellmix ? o.fobCurrency : null,
        productId: wellmix ? i.productId : null,
        variantData: wellmix ? (i.variant ?? null) : null,
        specification: wellmix ? (request?.specification ?? null) : null,
      })),
      ...group(request, `order:${o.id}`),
      requestNumber: request?.number ?? null,
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
      journey: journey.orderStep(o),
      dueAt: cancelled || closed ? null : (stage?.dueAt ?? null),
      updatedAt: o.updatedAt,
    });
  }

  // Wellmix: solicitações que ainda não viraram pedido (as que viraram
  // aparecem pelo pedido).
  for (const r of requests) {
    if (r.status === "ORDERED") continue;
    rows.push({
      key: `request:${r.id}`,
      kind: "request",
      href: `/app/requests/${r.id}`,
      number: r.number ?? null,
      product: realName(r.productName) ?? "—",
      items: [
        {
          name: realName(r.productName) ?? "—",
          variant: r.variant?.name ?? null,
          quantity: r.quantity,
          unit: r.unit,
          unitPrice: null,
          currency: null,
          // Solicitações só entram para a Wellmix.
          productId: r.productId,
          variantData: r.variant ?? null,
          specification: r.specification,
        },
      ],
      ...group(r, `request:${r.id}`),
      requestNumber: r.number ?? null,
      customer: name(r.customerId),
      supplier: null,
      phase: { kind: "request", key: r.status },
      state: r.status === "CANCELLED" ? "cancelled" : "active",
      progress: null,
      journey: journey.requestStep(r),
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
