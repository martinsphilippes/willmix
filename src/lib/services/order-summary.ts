import "server-only";

import { realName } from "@/lib/placeholder-name";
import {
  getStore,
  type ArtIssue,
  type ImportStep,
  type Order,
  type OrderItem,
  type OrderSummary,
  type Party,
  type Payment,
  type ProductionTrack,
  type Receiving,
  type Requirement,
  type RequirementStatus,
  type SkuInspection,
  type Stage,
  type StageKey,
  type User,
} from "@/lib/db";
import { isSchemaMissing } from "@/lib/db/errors";
import { isHeld, projectJson } from "@/lib/db/store";
import {
  DUE_SOON_DAYS,
  addDays,
  brazilDay,
  type InstallmentStatus,
} from "@/lib/supplier-terms";
import { JOURNEY_REQUIREMENT_KEYS } from "./journey";
import {
  computeOrderFinance,
  originCostsOf,
  saleFxFromRecord,
  type FinanceSummaryRow,
} from "./finance";
import { SCHEDULE_REQUIREMENT_KEYS, payableFor } from "./supplier-terms";
import type { BoardOrder, BoardStage } from "./tower-board";

/*
 * Resumo por pedido (docs/RESUMOS.md). A Control Tower lia, a cada abertura,
 * as tabelas inteiras de pedidos, itens, parceiros e produtos e as etapas,
 * requisitos e pagamentos de todos os pedidos (centenas de idas ao banco,
 * mais de 100 MB). Agora cada pedido tem uma linha em `order_summaries` com o
 * que as telas de visão geral leem dele (`OrderFacts`), e a tela lê só essa
 * tabela. As regras continuam as mesmas: o resumo guarda os dados de entrada
 * já filtrados, e os quadros, as visões gerais e os totais são montados pelas
 * mesmas funções de antes, na hora da leitura (prazo vencido e parcela a
 * vencer comparam com o agora da leitura).
 *
 * - Por evento: toda gravação ligada a um pedido (pedido, etapa, requisito,
 *   item, pagamento, embarque, produção, inspeção, arte, recebimento; nome ou
 *   condição de pagamento do parceiro) marca o pedido (src/lib/db/summary-dirty.ts),
 *   e o resumo dele é recalculado depois da resposta, ou antes da próxima
 *   leitura nesta instância.
 * - Reserva: o job noturno (/api/jobs/summaries) reconstrói tudo e grava só o
 *   que mudou; o administrador também pode reconstruir em Configurações.
 * - Enquanto não houver uma reconstrução completa (marcador em `settings`),
 *   ou com resumo de outro formato, as telas usam o caminho antigo.
 */

/**
 * Formato de `facts`; mudar o formato = subir o número (as telas voltam ao
 * caminho antigo até a reconstrução, que em produção começa sozinha depois do
 * deploy: summary-kick.ts). 9: `itemCount` (a tela Pedidos lê os itens só da
 * página). 10: a contribuição de cada pedido para o Overview dos blocos
 * (`kpi.f`, flow-contribution.ts; docs/FLOW_MENU.md).
 */
export const SUMMARY_VERSION = 10;

/** Marcador em `settings`: a última reconstrução completa. */
export const SUMMARY_SETTING_KEY = "orderSummaries";

export interface SummaryMarker {
  builtAt: string;
  version: number;
  orders: number;
  written: number;
  removed: number;
  ms: number;
}

/** Item de etapa como os quadros leem (etapa pela chave, não pelo id). */
export interface FactRequirement {
  k: string;
  s: StageKey | null;
  st: RequirementStatus;
  v: string | null;
}

export type FactMoney = Omit<FinanceSummaryRow, "order"> & { fob: number };

export interface OrderFacts {
  order: BoardOrder;
  /** Nome do cliente e do fornecedor como estão no cadastro (nulo: parceiro não encontrado). */
  customer: string | null;
  supplier: string | null;
  /** Nome do primeiro item do pedido (nulo: sem itens ou nome de exemplo). */
  product: string | null;
  /** Quantos itens o pedido tem (a tela Pedidos lê os itens só da página mostrada). */
  itemCount: number;
  /** Etapas em andamento ou bloqueadas, na ordem do banco. */
  active: Array<Omit<BoardStage, "orderId"> & Pick<Stage, "percent">>;
  /** Itens das etapas que dividem os quadros de posição (journey.ts). */
  reqs: FactRequirement[];
  /** Todos os itens do pedido de compra (raias e contrato); nulo no importado. */
  lane: Array<Omit<FactRequirement, "v">> | null;
  steps: ImportStep[];
  tracks: ProductionTrack[];
  skus: SkuInspection[];
  art: Array<Pick<ArtIssue, "status">>;
  receivings: Receiving[];
  /** O que o resumo do financeiro lê (sem estimativa pelo câmbio do dia). */
  money: FactMoney;
  /** Parcelas ao fornecedor (situação e vencimento). */
  installments: Array<{ status: InstallmentStatus; dueDate: string | null }>;
  /** Pagamentos do pedido (sem os códigos do Sankhya): financeiro, cronograma, conta do cliente. */
  pays: FactPayment[];
  /** Custos de origem (POP) validados da compra EXW (docs/ORIGIN_CONTAINER.md). */
  pop?: import("./finance").OriginCost[];
  /** Etapas de embarque e entrega (marcos do cronograma de pagamento e da entrega). */
  ship: FactStage[];
  /** Itens das etapas do cronograma de pagamento (data de embarque, pagamento antigo). */
  sreqs: FactScheduleRequirement[];
}

export type FactPayment = Omit<Payment, "sankhyaRefs">;
export type FactStage = Pick<
  Stage,
  "id" | "key" | "status" | "startedAt" | "completedAt" | "dueAt"
>;
export type FactScheduleRequirement = Pick<
  Requirement,
  "id" | "stageId" | "key" | "status" | "value" | "submittedAt" | "updatedAt"
>;

const BOARD_KEYS: readonly string[] = JOURNEY_REQUIREMENT_KEYS;
const SCHEDULE_KEYS: readonly string[] = SCHEDULE_REQUIREMENT_KEYS;
const ACTIVE: Stage["status"][] = ["active", "blocked"];

const isPortal = (o: Pick<Order, "flow">) => o.flow === "supplier_request";

/** Tabela que o esquema publicado ainda não tem: lista vazia. */
const safe = <T>(p: Promise<T[]>): Promise<T[]> =>
  p.catch((error) => {
    if (isSchemaMissing(error)) return [] as T[];
    throw error;
  });

function groupBy<T>(rows: T[], keyOf: (row: T) => string | null) {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const key = keyOf(row);
    if (!key) continue;
    const list = map.get(key);
    if (list) list.push(row);
    else map.set(key, [row]);
  }
  return map;
}

/** Os dados de entrada dos resumos, já agrupados por pedido. */
interface Sources {
  orders: Order[];
  parties: Map<string, Party>;
  items: Map<string, OrderItem[]>;
  stages: Map<string, Stage[]>;
  requirements: Map<string, Requirement[]>;
  portalRequirements: Map<string, Requirement[]>;
  /** Itens pendentes ou recusados (pendências das etapas em andamento). */
  openRequirements: Map<string, Requirement[]>;
  steps: Map<string, ImportStep[]>;
  tracks: Map<string, ProductionTrack[]>;
  skus: Map<string, SkuInspection[]>;
  art: Map<string, ArtIssue[]>;
  receivings: Map<string, Receiving[]>;
  payments: Map<string, Payment[]>;
  /** Sinal ao fornecedor e pedido de amostras (passos do Overview, flow-contribution.ts). */
  flowRequirements: Map<string, Requirement[]>;
}

/**
 * Lê o que os resumos precisam: dos pedidos dados ou, sem eles, de todos
 * (reconstrução). Requisitos só das chaves usadas (quadros e cronograma de
 * pagamento); do pedido de compra, todos.
 */
async function loadSources(ids: string[] | null): Promise<Sources> {
  const store = getStore();
  const orders = ids
    ? ids.length
      ? await store.list("orders", { filter: { id: ids } })
      : []
    : await store.list("orders");
  const orderIds = orders.map((o) => o.id);
  const byOrder = ids ? { orderId: orderIds } : {};
  const portalIds = orders.filter(isPortal).map((o) => o.id);
  const partyIds = [
    ...new Set(
      orders.flatMap((o) => [o.customerId, o.supplierId]).filter((x) => !!x),
    ),
  ];
  if (!orders.length)
    return {
      orders,
      parties: new Map(),
      items: new Map(),
      stages: new Map(),
      requirements: new Map(),
      portalRequirements: new Map(),
      openRequirements: new Map(),
      steps: new Map(),
      tracks: new Map(),
      skus: new Map(),
      art: new Map(),
      receivings: new Map(),
      payments: new Map(),
      flowRequirements: new Map(),
    };
  const [
    parties,
    items,
    stages,
    requirements,
    portalRequirements,
    openRequirements,
    steps,
    tracks,
    skus,
    art,
    receivings,
    payments,
    flowRequirements,
  ] = await Promise.all([
    partyIds.length
      ? store.list("parties", { filter: { id: partyIds } })
      : Promise.resolve([]),
    store.list("order_items", { filter: byOrder }),
    store.list("stages", { filter: byOrder }),
    store.list("requirements", {
      filter: { ...byOrder, key: [...BOARD_KEYS, ...SCHEDULE_KEYS] },
    }),
    portalIds.length
      ? store.list("requirements", { filter: { orderId: portalIds } })
      : Promise.resolve([]),
    store.list("requirements", {
      filter: { ...byOrder, status: ["pending", "rejected"] },
    }),
    safe(store.list("import_steps", { filter: byOrder })),
    safe(store.list("production_tracks", { filter: byOrder })),
    safe(store.list("sku_inspections", { filter: byOrder })),
    safe(
      store.list("art_issues", {
        filter: { ...byOrder, status: ["open", "fixed"] },
      }),
    ),
    safe(store.list("receivings", { filter: byOrder })),
    store.list("payments", { filter: byOrder }),
    store.list("requirements", {
      filter: { ...byOrder, key: ["down_payment", "sample_order"] },
    }),
  ]);
  const partyMap = new Map<string, Party>();
  for (const p of parties) if (!partyMap.has(p.id)) partyMap.set(p.id, p);
  return {
    orders,
    parties: partyMap,
    items: groupBy(items, (r) => r.orderId),
    stages: groupBy(stages, (r) => r.orderId),
    requirements: groupBy(requirements, (r) => r.orderId),
    portalRequirements: groupBy(portalRequirements, (r) => r.orderId),
    openRequirements: groupBy(openRequirements, (r) => r.orderId),
    steps: groupBy(steps, (r) => r.orderId),
    tracks: groupBy(tracks, (r) => r.orderId),
    skus: groupBy(skus, (r) => r.orderId),
    art: groupBy(art, (r) => r.orderId),
    receivings: groupBy(receivings, (r) => r.orderId),
    payments: groupBy(payments, (r) => r.orderId),
    flowRequirements: groupBy(flowRequirements, (r) => r.orderId),
  };
}

const pickOrder = (o: Order): BoardOrder => ({
  id: o.id,
  number: o.number,
  status: o.status,
  flow: o.flow ?? null,
  customerId: o.customerId,
  supplierId: o.supplierId,
  closedAt: o.closedAt ?? null,
  cancelledAt: o.cancelledAt ?? null,
  cancelStageKey: o.cancelStageKey ?? null,
  erpSyncStatus: o.erpSyncStatus,
  cancelRequestStatus: o.cancelRequestStatus ?? null,
});

/** O resumo de um pedido (função pura sobre os dados lidos). */
export function buildOrderFacts(
  order: Order,
  src: Omit<Sources, "orders">,
  today: string,
): OrderFacts {
  const id = order.id;
  const stages = src.stages.get(id) ?? [];
  const keyOf = new Map(stages.map((s) => [s.id, s.key]));
  const reqs = src.requirements.get(id) ?? [];
  const customer = src.parties.get(order.customerId) ?? null;
  const supplier = src.parties.get(order.supplierId) ?? null;
  const items = src.items.get(id) ?? [];
  const payments = src.payments.get(id) ?? [];
  const pop = originCostsOf(src.steps.get(id) ?? []);
  const finance = computeOrderFinance(
    order,
    payments,
    {
      customer: customer?.name ?? "—",
      supplier: supplier?.name ?? "—",
      product: realName(items[0]?.name) ?? "—",
    },
    {
      today: null,
      saleFx: saleFxFromRecord(
        null,
        order.fobCurrency ?? "USD",
        order.sellCurrency ?? "BRL",
      ),
      originCosts: pop,
    },
  );
  const payable = payableFor(
    order,
    supplier,
    payments.filter((p) => p.direction === "supplier_out"),
    stages.filter((s) => s.key === "SHIPPING" || s.key === "DELIVERED"),
    reqs.filter((r) => SCHEDULE_KEYS.includes(r.key)),
    items,
    today,
  );
  return {
    order: pickOrder(order),
    customer: customer?.name ?? null,
    supplier: supplier?.name ?? null,
    // Nome de exemplo ("Produto novo XPTO") vale como ausente.
    product: realName(items[0]?.name),
    itemCount: items.length,
    active: stages
      .filter((s) => ACTIVE.includes(s.status))
      .map((s) => ({
        id: s.id,
        key: s.key,
        status: s.status,
        dueAt: s.dueAt ?? null,
        responsibleRole: s.responsibleRole,
        percent: s.percent,
      })),
    reqs: reqs
      .filter((r) => BOARD_KEYS.includes(r.key))
      .map((r) => ({
        k: r.key,
        s: keyOf.get(r.stageId) ?? null,
        st: r.status,
        v: r.value ?? null,
      })),
    lane: isPortal(order)
      ? (src.portalRequirements.get(id) ?? []).map((r) => ({
          k: r.key,
          s: keyOf.get(r.stageId) ?? null,
          st: r.status,
        }))
      : null,
    steps: src.steps.get(id) ?? [],
    tracks: src.tracks.get(id) ?? [],
    skus: src.skus.get(id) ?? [],
    art: (src.art.get(id) ?? []).map((a) => ({ status: a.status })),
    receivings: src.receivings.get(id) ?? [],
    money: {
      sellCurrency: finance.sellCurrency,
      sell: finance.sell,
      received: finance.received,
      receivable: finance.receivable,
      cost: finance.cost,
      estimated: finance.estimated,
      fxEffect: finance.fxEffect,
      fobCurrency: finance.fobCurrency,
      fob: finance.fob,
      payable: finance.payable,
      paid: finance.paid,
      paidOther: finance.paidOther,
    },
    installments: payable.schedule.installments.map((i) => ({
      status: i.status,
      dueDate: i.dueDate,
    })),
    pays: payments.map(withoutRefs),
    ...(pop.length ? { pop } : {}),
    ship: stages
      .filter((x) => x.key === "SHIPPING" || x.key === "DELIVERED")
      .map((x) => ({
        id: x.id,
        key: x.key,
        status: x.status,
        startedAt: x.startedAt ?? null,
        completedAt: x.completedAt ?? null,
        dueAt: x.dueAt ?? null,
      })),
    sreqs: reqs
      .filter((r) => SCHEDULE_KEYS.includes(r.key))
      .map((r) => ({
        id: r.id,
        stageId: r.stageId,
        key: r.key,
        status: r.status,
        value: r.value ?? null,
        submittedAt: r.submittedAt ?? null,
        updatedAt: r.updatedAt,
      })),
  };
}

/** Pagamento sem os códigos do Sankhya (não entram em conta nenhuma). */
function withoutRefs(p: Payment): FactPayment {
  const copy: Partial<Payment> = { ...p };
  delete copy.sankhyaRefs;
  return copy as FactPayment;
}

const live = (status: string) => status !== "CLOSED" && status !== "CANCELLED";

function summaryRow(
  facts: OrderFacts,
  computedAt: string,
  kpi: unknown,
  tasks: StoredTasks | null = null,
) {
  return {
    tasks,
    hasTasks: !!tasks,
    id: facts.order.id,
    orderId: facts.order.id,
    number: facts.order.number,
    status: facts.order.status,
    live: live(facts.order.status),
    version: SUMMARY_VERSION,
    facts,
    computedAt,
    kpi,
  };
}

/** Pendência de etapa da Wellmix guardada no resumo: a ordem da etapa e a pendência. */
interface StoredTask {
  k: string;
  d: unknown;
}

/** O pedido nas pendências guardadas: só o que as pendências e o encaminhamento leem. */
const TASK_ORDER_FIELDS = [
  "id",
  "number",
  "createdAt",
  "requestId",
  "customerId",
  "supplierId",
  "status",
  "flow",
  "held",
  "ownerUserId",
  "designerUserId",
  "agencyId",
  "brokerId",
  "ocpId",
  "comexId",
  "logisticsId",
] as const satisfies readonly (keyof Order)[];
export type TaskOrder = Pick<Order, (typeof TASK_ORDER_FIELDS)[number]>;

/** Parcela ao fornecedor que vence ou pode vencer só com a passagem do tempo. */
export interface StoredInstallment {
  index: number;
  count: number;
  open: number;
  dueDate: string | null;
  status: InstallmentStatus;
}

/**
 * Pendências da Wellmix guardadas no resumo do pedido (`order_summaries.tasks`,
 * docs/RESUMOS.md). As de etapa vêm prontas. As outras guardam o que a
 * leitura usa para saber de quem cada uma é (o pedido com os parceiros, o
 * analista e o designer; quem enviou; quem apontou e quem corrigiu a arte),
 * porque a equipe, as funções e as configurações mudam sem gravar no
 * pedido; e as datas, porque o follow, o rastreio do container e a parcela
 * vencem sem gravação. Pedido em espera (`held`) não guarda nada.
 */
export interface StoredTasks {
  /** Etapas em andamento: a ordem da etapa e a pendência pronta. */
  s: StoredTask[];
  /** Ordem do pedido na lista (criação, id), a mesma da leitura dos pedidos. */
  k: string;
  o: TaskOrder;
  /** Produção: follows ainda não registrados (com a data) e reinspeção. */
  p?: import("./production").ProductionCandidate[];
  /** Embarque, desembaraço e certificação, antes de saber quem vê. */
  i?: import("./import-flow").ImportCandidate[];
  /** Artes: as não conformidades abertas ou corrigidas (ordem de criação). */
  a?: Array<{
    k: string;
    issue: import("./artwork").ArtIssueFields;
    item: string;
  }>;
  /** "Pagar fornecedor": parcelas em aberto que vencem com o tempo. */
  f?: { supplier: string | null; currency: string; parts: StoredInstallment[] };
}

/** Login genérico da Wellmix: as pendências de etapa são as mesmas para toda a equipe. */
const WELLMIX_VIEWER = {
  id: "__wellmix__",
  role: "operator",
  partyId: null,
} as unknown as User;

/** Etapas do pedido com pendência de produção da Wellmix (follow e reinspeção). */
const PRODUCTION_STATUSES: readonly string[] = [
  "ORDER_CREATED",
  "PREPARATION",
  "SUPPLIER_PAYMENT",
  "PACKAGING",
  "INSPECTION",
  "SHIPPING",
];

/** Situações da parcela que mudam só com o dia (a pendência pode aparecer sem gravação). */
const TIMED: readonly InstallmentStatus[] = [
  "overdue",
  "due_soon",
  "scheduled",
];

/**
 * Pendências da Wellmix de cada pedido (`StoredTasks`), com as mesmas
 * funções da leitura pelas tabelas: etapas (`stageTaskDrafts`), produção
 * (`wellmixProductionCandidates`), embarque e certificação
 * (`wellmixImportCandidates`), artes e "Pagar fornecedor" (`payableFor`,
 * como em `listPayables`).
 */
async function tasksOf(
  src: Sources,
  facts: OrderFacts[],
  today: string,
): Promise<Map<string, StoredTasks>> {
  const [
    { stageTaskDrafts },
    { wellmixProductionCandidates, latestByItem },
    { wellmixImportCandidates, WELLMIX_IMPORT_STATUSES },
    { artIssueCounts },
    { baseKeyOf, LANE_KEYS },
  ] = await Promise.all([
    import("./tasks"),
    import("./production"),
    import("./import-flow"),
    import("./artwork"),
    import("@/lib/purchase-lanes"),
  ]);
  const out = new Map<string, StoredTasks>();
  const portal = src.orders.filter(isPortal);
  const lanes = portal.length
    ? {
        ...(await import("@/lib/purchase-lanes")),
        sla: await (await import("./purchase-order")).purchaseLaneSla(),
        all: portal.flatMap((o) => src.portalRequirements.get(o.id) ?? []),
      }
    : null;
  const factsById = new Map(facts.map((f) => [f.order.id, f]));
  for (const order of src.orders) {
    // Pedido do histórico do Sankhya em espera: sem pendência até o go-live.
    if (order.held) continue;
    const stored: StoredTasks = {
      s: [],
      k: `${order.createdAt ?? ""}|${order.id}`,
      o: Object.fromEntries(
        TASK_ORDER_FIELDS.map((f) => [f, order[f] ?? null]),
      ) as TaskOrder,
    };
    // Etapas (etapa em espera também não entra).
    const stages = (src.stages.get(order.id) ?? []).filter(
      (s) => ACTIVE.includes(s.status) && !isHeld(s),
    );
    const steps = src.steps.get(order.id) ?? [];
    if (stages.length) {
      const sealApplied = new Set(
        steps
          .filter(
            (s) =>
              s.key === "cert_seal_art" &&
              (s.status === "submitted" || s.status === "validated"),
          )
          .map((s) => s.orderId),
      );
      const byKey = new Map(stages.map((s) => [s.key, s]));
      stored.s = stageTaskDrafts(WELLMIX_VIEWER, {
        stages,
        orderById: new Map([[order.id, order]]),
        openRequirements: src.openRequirements.get(order.id) ?? [],
        sealApplied,
        lanes,
      }).map((d) => {
        const stage = d.stageKey ? byKey.get(d.stageKey) : undefined;
        return { k: `${stage?.createdAt ?? ""}|${stage?.id ?? ""}`, d };
      });
    }
    // Produção (Fase C): follow 5/15/25 e reinspeção.
    if (PRODUCTION_STATUSES.includes(order.status)) {
      const track = (src.tracks.get(order.id) ?? [])[0] ?? null;
      const p = wellmixProductionCandidates(order, track, [
        ...latestByItem(src.skus.get(order.id) ?? []).values(),
      ]);
      if (p.length) stored.p = p;
    }
    // Embarque, desembaraço e certificação (Fases D e F).
    if (WELLMIX_IMPORT_STATUSES.includes(order.status)) {
      const needsCert =
        isPortal(order) &&
        (src.portalRequirements.get(order.id) ?? []).some(
          (r) => baseKeyOf(r.key) === LANE_KEYS.certificate,
        );
      const i = wellmixImportCandidates(order, steps, needsCert);
      if (i.length) stored.i = i;
    }
    // Artes: corrigir e conferir a correção.
    if (artIssueCounts(order)) {
      const items = src.items.get(order.id) ?? [];
      const a = (src.art.get(order.id) ?? [])
        .filter((x) => x.status === "open" || x.status === "fixed")
        .map((x) => ({
          k: `${x.createdAt ?? ""}|${x.id}`,
          issue: {
            id: x.id,
            status: x.status,
            reportedByUserId: x.reportedByUserId,
            fixedByUserId: x.fixedByUserId ?? null,
            updatedAt: x.updatedAt,
            fixedAt: x.fixedAt ?? null,
          },
          // Nome de exemplo ("Produto novo XPTO") vale como ausente.
          item:
            realName(items.find((it) => it.id === x.orderItemId)?.name) ?? "—",
        }));
      if (a.length) stored.a = a;
    }
    // "Pagar fornecedor": o cronograma como em Contas a pagar (do resumo).
    const f = factsById.get(order.id);
    if (f) {
      const copy: Partial<Order> = { ...order };
      delete copy.sankhyaRefs;
      const supplier = src.parties.get(order.supplierId) ?? null;
      const payable = payableFor(
        copy as Order,
        supplier,
        (f.pays as Payment[]).filter((p) => p.direction === "supplier_out"),
        f.ship as Stage[],
        f.sreqs as Requirement[],
        (f.product != null ? [{ name: f.product }] : []) as OrderItem[],
        today,
      );
      const parts = payable.schedule.installments
        .filter((i) => i.open > 0 && TIMED.includes(i.status))
        .map((i) => ({
          index: i.index,
          count: i.count,
          open: i.open,
          dueDate: i.dueDate,
          status: i.status,
        }));
      if (parts.length)
        stored.f = {
          supplier: payable.supplier?.name ?? null,
          currency: payable.schedule.currency,
          parts,
        };
    }
    if (stored.s.length || stored.p || stored.i || stored.a || stored.f)
      out.set(order.id, stored);
  }
  return out;
}

/** As pendências guardadas de um pedido, para a leitura. */
export interface ReadyOrderTasks {
  order: Order;
  tasks: StoredTasks;
}

/**
 * As pendências da Wellmix guardadas nos resumos (só as linhas com
 * pendência, `hasTasks`), na ordem dos pedidos; as de etapa já na ordem das
 * etapas. Resumo de outro formato é recalculado antes.
 */
export async function wellmixReadyTasks(): Promise<{
  stage: Array<import("./tasks").TaskDraft>;
  orders: ReadyOrderTasks[];
}> {
  const { flushSummaryChanges } = await import("@/lib/db/summary-dirty");
  await flushSummaryChanges();
  const { listColumns } = await import("@/lib/db/lookup");
  const store = getStore();
  const older = Array.from({ length: SUMMARY_VERSION - 1 }, (_, i) => i + 1);
  const stale = older.length
    ? await listColumns(store, "order_summaries", ["version"], {
        filter: { version: older },
      })
    : [];
  if (stale.length) await recomputeOrderSummaries(stale.map((r) => r.id));
  const rows = await listColumns(store, "order_summaries", ["tasks"], {
    filter: { hasTasks: true },
  });
  const orders = rows
    .map((r) => r.tasks as StoredTasks | null)
    .filter((t): t is StoredTasks => !!t?.o)
    .sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : 0))
    .map((tasks) => ({ order: tasks.o as Order, tasks }));
  const stage = orders
    .flatMap((o) => o.tasks.s)
    .sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : 0))
    .map((t) => t.d as import("./tasks").TaskDraft);
  return { stage, orders };
}

/** Contribuição de cada pedido para os indicadores (src/lib/services/tower-kpis.ts). */
async function kpisOf(
  facts: OrderFacts[],
  now: Date,
  ids: string[] | null,
  src?: Sources,
): Promise<Map<string, unknown>> {
  const { orderKpisFor } = await import("./tower-kpis");
  const kpis = await orderKpisFor(facts, now, ids);
  if (!src) return kpis;
  // Contribuição para o Overview dos blocos (`f`, flow-contribution.ts).
  const flows = await flowsOf(src);
  return new Map(
    [...kpis.entries()].map(([id, kpi]) => [
      id,
      { ...kpi, f: flows.get(id) ?? null },
    ]),
  );
}

/** Contribuição de cada pedido para o Overview dos blocos (docs/FLOW_MENU.md). */
async function flowsOf(src: Sources) {
  const { buildOrderFlow } = await import("./flow-contribution");
  const out = new Map<string, unknown>();
  for (const order of src.orders) {
    const reqs = src.flowRequirements.get(order.id) ?? [];
    out.set(
      order.id,
      buildOrderFlow({
        order,
        stages: src.stages.get(order.id) ?? [],
        openRequirements: src.openRequirements.get(order.id) ?? [],
        importSteps: src.steps.get(order.id) ?? [],
        track: src.tracks.get(order.id)?.[0] ?? null,
        receiving: src.receivings.get(order.id)?.[0] ?? null,
        items: src.items.get(order.id) ?? [],
        downPayment:
          reqs.find((r) => r.key === "down_payment" && r.status === "done") ??
          null,
        sampleOrder: reqs.find((r) => r.key === "sample_order") ?? null,
      }),
    );
  }
  return out;
}

async function writeSummaries(rows: ReturnType<typeof summaryRow>[]) {
  if (!rows.length) return;
  const store = getStore();
  if (store.upsertMany) {
    await store.upsertMany("order_summaries", rows);
    return;
  }
  // Sem gravação em lote (Appwrite): uma a uma.
  for (const row of rows) {
    const { id, ...rest } = row;
    const existing = await store.get("order_summaries", id);
    if (existing) await store.update("order_summaries", id, rest);
    else await store.create("order_summaries", row);
  }
}

async function readMarker(): Promise<SummaryMarker | null> {
  const [row] = await getStore().list("settings", {
    filter: { key: SUMMARY_SETTING_KEY },
    limit: 1,
  });
  const value = row?.value as SummaryMarker | undefined;
  const marker = value?.builtAt ? value : null;
  // Formato antigo depois de um deploy: pede a reconstrução (summary-kick.ts).
  if (marker) {
    const { kickStaleSummaries } = await import("./summary-kick");
    kickStaleSummaries(marker.version, SUMMARY_VERSION);
  }
  return marker;
}

/** Os resumos estão em uso (houve uma reconstrução completa)? */
export async function summariesEnabled(): Promise<boolean> {
  return !!(await readMarker());
}

export async function summaryStatus(): Promise<SummaryMarker | null> {
  return readMarker();
}

/** Recalcula o resumo dos pedidos dados (e apaga o dos pedidos que não existem mais). */
export async function recomputeOrderSummaries(
  ids: string[],
  now: Date = new Date(),
): Promise<number> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return 0;
  const src = await loadSources(unique);
  const today = brazilDay(now.toISOString()) as string;
  const at = now.toISOString();
  const facts = src.orders.map((o) => buildOrderFacts(o, src, today));
  const kpis = await kpisOf(
    facts,
    now,
    src.orders.map((o) => o.id),
    src,
  );
  const tasks = await tasksOf(src, facts, today);
  const rows = facts.map((f) =>
    summaryRow(f, at, kpis.get(f.order.id), tasks.get(f.order.id) ?? null),
  );
  await writeSummaries(rows);
  const found = new Set(src.orders.map((o) => o.id));
  const store = getStore();
  for (const id of unique)
    if (!found.has(id))
      await store.remove("order_summaries", id).catch(() => undefined);
  return rows.length;
}

/** Pedidos de um parceiro (nome ou condição de pagamento mudou). */
async function ordersOfParties(partyIds: string[]): Promise<string[]> {
  if (!partyIds.length) return [];
  const store = getStore();
  const [asCustomer, asSupplier] = await Promise.all([
    store.list("orders", { filter: { customerId: partyIds } }),
    store.list("orders", { filter: { supplierId: partyIds } }),
  ]);
  return [...asCustomer, ...asSupplier].map((o) => o.id);
}

/**
 * Recalcula o que as gravações marcaram (src/lib/db/summary-dirty.ts). Sem
 * reconstrução completa ainda, não faz nada (as telas usam o caminho antigo).
 */
export async function applySummaryChanges(changes: {
  orders: string[];
  parties: string[];
  /** Mudou uma tabela pequena dos indicadores (bookings, solicitações, certificações...). */
  kpi?: boolean;
}): Promise<number> {
  if (!(await summariesReady())) return 0;
  const ids = [...changes.orders, ...(await ordersOfParties(changes.parties))];
  const done = await recomputeOrderSummaries(ids);
  // Indicadores prontos: refeitos depois de cada leva de gravações.
  if (ids.length || changes.kpi) {
    const { rebuildTowerKpis } = await import("./tower-kpis");
    await rebuildTowerKpis();
    // Overview dos blocos (flow-kpis.ts): o mesmo evento muda os números.
    const { rebuildFlowKpis } = await import("./flow-kpis");
    await rebuildFlowKpis();
  }
  return done;
}

/** Os resumos estão prontos no formato atual (houve reconstrução neste formato)? */
export async function summariesReady(): Promise<boolean> {
  const marker = await readMarker().catch(() => null);
  return !!marker && marker.version === SUMMARY_VERSION;
}

/**
 * JSON com as chaves em ordem: o jsonb do Postgres reordena as chaves, e a
 * comparação "mudou?" não pode depender disso.
 */
export function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>).sort(([a], [b]) =>
            a < b ? -1 : a > b ? 1 : 0,
          ),
        )
      : v,
  );
}

/*
 * Reconstrução em partes (docs/RESUMOS.md). Ler e gravar todos os pedidos de
 * uma vez passava dos 5 minutos que a Vercel dá a uma requisição (15 mil
 * pedidos). Agora cada rodada processa fatias de pedidos (em ordem de id) até
 * o tempo dado e guarda onde parou em `settings` (`orderSummariesRebuild`); a
 * próxima rodada continua dali. A última apaga o resumo de pedido que não
 * existe mais, grava o marcador e refaz os indicadores.
 */

/** Andamento de uma reconstrução em partes (em `settings`). */
export const REBUILD_SETTING_KEY = "orderSummariesRebuild";

/** Pedidos por fatia: cabem com folga numa rodada. */
export const REBUILD_CHUNK = 500;

/** Reconstrução parada há mais que isso recomeça do zero (dados velhos). */
const REBUILD_STALE_MS = 12 * 60 * 60 * 1000;

export interface RebuildProgress {
  startedAt: string;
  version: number;
  /** Último id de pedido processado (as fatias seguem a ordem de id). */
  cursor: string | null;
  processed: number;
  total: number;
  written: number;
  /** Outra rodada está trabalhando até esse instante. */
  lockUntil: string | null;
}

export type RebuildState =
  | { state: "idle" }
  | {
      state: "running";
      processed: number;
      total: number;
      startedAt: string;
      /** Outra rodada está trabalhando agora; esta não fez nada. */
      busy: boolean;
    }
  | { state: "done"; marker: SummaryMarker };

async function settingRow(key: string) {
  const [row] = await getStore().list("settings", {
    filter: { key },
    limit: 1,
  });
  return row ?? null;
}

async function readProgress(): Promise<RebuildProgress | null> {
  const value = (await settingRow(REBUILD_SETTING_KEY))?.value as
    RebuildProgress | undefined;
  return value?.startedAt ? value : null;
}

async function saveProgress(progress: RebuildProgress) {
  const { setRawSetting } = await import("@/lib/settings");
  await setRawSetting(REBUILD_SETTING_KEY, progress);
}

async function clearProgress() {
  const row = await settingRow(REBUILD_SETTING_KEY);
  if (row) await getStore().remove("settings", row.id);
}

/** A reconstrução em andamento, se houver (para a tela de Configurações). */
export async function rebuildProgress(): Promise<RebuildProgress | null> {
  return readProgress();
}

/** Ids de todos os pedidos, em ordem (só a coluna id). */
async function orderIdsSorted(): Promise<string[]> {
  const { listColumns } = await import("@/lib/db/lookup");
  const rows = await listColumns(getStore(), "orders", ["id"]);
  return rows.map((r) => r.id).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * Uma fatia: resume os pedidos dados e grava só o que mudou. Resumo
 * recalculado por evento depois do início (mais novo) não é sobrescrito.
 */
async function rebuildChunk(
  ids: string[],
  startedAt: string,
  now: Date,
): Promise<number> {
  const store = getStore();
  const src = await loadSources(ids);
  const today = brazilDay(now.toISOString()) as string;
  const facts = src.orders.map((o) => buildOrderFacts(o, src, today));
  const kpis = await kpisOf(
    facts,
    now,
    src.orders.map((o) => o.id),
    src,
  );
  const tasks = await tasksOf(src, facts, today);
  const existing = new Map(
    (
      await store.list("order_summaries", {
        filter: { id: src.orders.map((o) => o.id) },
      })
    ).map((r) => [r.id, r]),
  );
  const rows = facts
    .map((f) =>
      summaryRow(
        f,
        startedAt,
        kpis.get(f.order.id),
        tasks.get(f.order.id) ?? null,
      ),
    )
    .filter((row) => {
      const old = existing.get(row.id);
      if (!old) return true;
      if (old.computedAt > startedAt) return false;
      return (
        old.version !== row.version ||
        old.status !== row.status ||
        old.number !== row.number ||
        stableJson(old.facts) !== stableJson(row.facts) ||
        stableJson(old.kpi ?? null) !== stableJson(row.kpi ?? null) ||
        stableJson(old.tasks ?? null) !== stableJson(row.tasks) ||
        !!old.hasTasks !== row.hasTasks
      );
    });
  await writeSummaries(rows);
  return rows.length;
}

/**
 * Fim da reconstrução: apaga o resumo de pedido que não existe mais, resume
 * o pedido criado durante ela que ficou antes do cursor, grava o marcador e
 * refaz os indicadores.
 */
async function finishRebuild(
  progress: RebuildProgress,
  ids: string[],
  now: Date,
): Promise<SummaryMarker> {
  const store = getStore();
  const { listColumns } = await import("@/lib/db/lookup");
  const summaryIds = (
    await listColumns(store, "order_summaries", ["orderId"])
  ).map((r) => r.id);
  const found = new Set(ids);
  const have = new Set(summaryIds);
  let removed = 0;
  for (const id of summaryIds)
    if (!found.has(id)) {
      await store.remove("order_summaries", id);
      removed++;
    }
  const missing = ids.filter((id) => !have.has(id));
  let written = progress.written;
  if (missing.length)
    written += await rebuildChunk(missing, progress.startedAt, now);
  const marker: SummaryMarker = {
    builtAt: new Date().toISOString(),
    version: SUMMARY_VERSION,
    orders: ids.length,
    written,
    removed,
    ms: Date.now() - Date.parse(progress.startedAt),
  };
  const { setRawSetting } = await import("@/lib/settings");
  await setRawSetting(SUMMARY_SETTING_KEY, marker);
  await clearProgress();
  // Indicadores prontos refeitos sobre os resumos novos.
  const { rebuildTowerKpis } = await import("./tower-kpis");
  await rebuildTowerKpis(now);
  const { rebuildFlowKpis } = await import("./flow-kpis");
  await rebuildFlowKpis(now);
  return marker;
}

/**
 * Uma rodada da reconstrução: começa uma (com `start`) ou continua a que
 * está em andamento, processa fatias até `budgetMs` (ao menos uma) e termina
 * quando não sobra pedido. Outra rodada trabalhando agora: devolve o
 * andamento sem fazer nada (`busy`).
 */
export async function rebuildOrderSummariesStep(options: {
  budgetMs: number;
  start?: boolean;
  chunk?: number;
  now?: Date;
}): Promise<RebuildState> {
  const chunk = options.chunk ?? REBUILD_CHUNK;
  const began = Date.now();
  const deadline = began + options.budgetMs;
  const running = (p: RebuildProgress, busy: boolean): RebuildState => ({
    state: "running",
    processed: p.processed,
    total: p.total,
    startedAt: p.startedAt,
    busy,
  });
  let progress = await readProgress();
  if (
    progress &&
    (progress.version !== SUMMARY_VERSION ||
      began - Date.parse(progress.startedAt) > REBUILD_STALE_MS)
  )
    progress = null;
  if (progress?.lockUntil && Date.parse(progress.lockUntil) > began)
    return running(progress, true);
  if (!progress && !options.start) return { state: "idle" };
  const ids = await orderIdsSorted();
  progress ??= {
    startedAt: new Date(began).toISOString(),
    version: SUMMARY_VERSION,
    cursor: null,
    processed: 0,
    total: ids.length,
    written: 0,
    lockUntil: null,
  };
  const cursor = progress.cursor;
  const pending = cursor ? ids.filter((id) => id > cursor) : ids;
  // A trava cobre a rodada e mais um minuto (rodada que caiu não prende a
  // próxima); sem limite de tempo, dez minutos por fatia.
  const lock = () =>
    new Date(
      Math.min(Math.max(deadline, Date.now()), Date.now() + 9 * 60_000) +
        60_000,
    ).toISOString();
  progress = { ...progress, total: progress.processed + pending.length };
  let offset = 0;
  do {
    const part = pending.slice(offset, offset + chunk);
    if (!part.length) break;
    await saveProgress({ ...progress, lockUntil: lock() });
    const now = options.now ?? new Date();
    const written = await rebuildChunk(part, progress.startedAt, now);
    offset += part.length;
    progress = {
      ...progress,
      cursor: part[part.length - 1],
      processed: progress.processed + part.length,
      written: progress.written + written,
    };
  } while (Date.now() < deadline);
  if (offset < pending.length) {
    progress = { ...progress, lockUntil: null };
    await saveProgress(progress);
    return running(progress, false);
  }
  await saveProgress({ ...progress, lockUntil: lock() });
  const marker = await finishRebuild(progress, ids, options.now ?? new Date());
  return { state: "done", marker };
}

/**
 * Reconstrói todos os resumos de uma vez (testes e modo memória): as mesmas
 * fatias da reconstrução em partes, sem limite de tempo.
 */
export async function rebuildOrderSummaries(
  now: Date = new Date(),
): Promise<SummaryMarker> {
  for (;;) {
    const result = await rebuildOrderSummariesStep({
      budgetMs: Number.POSITIVE_INFINITY,
      start: true,
      now,
    });
    if (result.state === "done") return result.marker;
    if (result.state === "running" && result.busy)
      throw new Error("summary_rebuild_busy");
  }
}

/* ------------------------------------------------------------------------ */
/* Leitura                                                                    */
/* ------------------------------------------------------------------------ */

export interface SummaryView<F = OrderFacts> {
  /** Resumos na ordem dos pedidos (número decrescente). */
  facts: F[];
  /** Id do pedido de cada resumo, na ordem de `facts` (readOrderSummaries). */
  ids?: string[];
}

/** Uma parte do resumo (`readOrderSummaries` e `factsForOrders` com `keys`). */
export type FactKey = keyof OrderFacts;

/**
 * Os resumos de todos os pedidos, prontos para as telas; nulo quando ainda
 * não podem ser usados (sem reconstrução completa, ou de outro formato).
 * Antes, recalcula o que gravações desta instância marcaram.
 */
export async function readOrderSummaries(
  /** Só os resumos destes pedidos (lista curta); sem ela, todos. */
  ids?: string[],
): Promise<SummaryView | null>;
/**
 * Só as partes `keys` de cada resumo (auditoria de performance, 14/11/2026):
 * o resumo inteiro tem ~2,7 kB por pedido (52 MB de JSON para os 16 mil
 * pedidos); quem precisa só da etapa e da viagem lê um quarto disso.
 */
export async function readOrderSummaries<K extends FactKey>(
  ids: string[] | undefined,
  keys: readonly K[],
): Promise<SummaryView<Pick<OrderFacts, K>> | null>;
export async function readOrderSummaries(
  ids?: string[],
  keys?: readonly FactKey[],
): Promise<SummaryView | null> {
  const marker = await readMarker().catch(() => null);
  if (!marker || marker.version !== SUMMARY_VERSION) return null;
  const { flushSummaryChanges } = await import("@/lib/db/summary-dirty");
  await flushSummaryChanges();
  const options = {
    ...(ids ? { filter: { id: ids } } : {}),
    orderBy: "number" as const,
    direction: "desc" as const,
  };
  let rows: Array<Pick<OrderSummary, "id" | "version" | "facts">>;
  try {
    if (ids && !ids.length) rows = [];
    else if (keys) {
      const { listColumns } = await import("@/lib/db/lookup");
      rows = await listColumns(
        getStore(),
        "order_summaries",
        ["version", "facts"],
        { ...options, jsonKeys: { facts: keys } },
      );
    } else rows = await getStore().list("order_summaries", options);
  } catch (error) {
    if (isSchemaMissing(error)) return null;
    throw error;
  }
  if (rows.some((r) => r.version !== SUMMARY_VERSION)) return null;
  return {
    facts: rows.map((r) => r.facts as OrderFacts),
    ids: rows.map((r) => r.id),
  };
}

/** Acima disto, lê todos os resumos de uma vez em vez de pedir pelos ids. */
const BY_ID_LIMIT = 300;

/**
 * Resumo de cada pedido dado, pelo id do pedido; nulo quando os resumos não
 * estão em uso (as telas seguem pelo caminho antigo). Pedido sem resumo
 * ainda (gravado agora em outra instância) é calculado na hora.
 */
export async function factsForOrders(
  orders: Array<Pick<Order, "id">>,
): Promise<Map<string, OrderFacts> | null>;
/** Só as partes `keys` de cada resumo (ver `readOrderSummaries`). */
export async function factsForOrders<K extends FactKey>(
  orders: Array<Pick<Order, "id">>,
  keys: readonly K[],
): Promise<Map<string, Pick<OrderFacts, K>> | null>;
export async function factsForOrders(
  orders: Array<Pick<Order, "id">>,
  keys?: readonly FactKey[],
): Promise<Map<string, OrderFacts> | null> {
  const ids = [...new Set(orders.map((o) => o.id))];
  const wanted = ids.length <= BY_ID_LIMIT ? ids : undefined;
  const view = keys
    ? await readOrderSummaries(wanted, keys)
    : await readOrderSummaries(wanted);
  if (!view) return null;
  // O id do resumo é o do pedido (summaryRow).
  const map = new Map(
    view.facts.map((f, i) => [
      view.ids?.[i] ?? (f as OrderFacts).order.id,
      f as OrderFacts,
    ]),
  );
  const missing = ids.filter((id) => !map.has(id));
  if (missing.length) {
    await recomputeOrderSummaries(missing);
    for (const row of await getStore().list("order_summaries", {
      filter: { id: missing },
    }))
      map.set(
        row.id,
        (keys
          ? projectJson({ facts: row.facts }, { facts: keys }).facts
          : row.facts) as OrderFacts,
      );
  }
  return map;
}

/**
 * Etapas e itens de etapa dos quadros e da viagem (journey.ts), montados do
 * resumo: a etapa de cada item vai num id sintético (pedido + chave).
 */
export function journeyRowsFromFacts(
  facts: Array<Pick<OrderFacts, "order" | "reqs" | "lane">>,
) {
  const stages: Array<Pick<Stage, "id" | "orderId" | "key">> = [];
  const requirements: Array<
    Pick<Requirement, "orderId" | "stageId" | "key" | "status" | "value">
  > = [];
  const laneRequirements: Array<
    Pick<Requirement, "orderId" | "stageId" | "key" | "status">
  > = [];
  for (const f of facts) {
    const orderId = f.order.id;
    const keys = new Set<StageKey>();
    for (const r of f.reqs) {
      if (r.s) keys.add(r.s);
      requirements.push({
        orderId,
        stageId: factStageId(orderId, r.s),
        key: r.k,
        status: r.st,
        value: r.v,
      });
    }
    for (const r of f.lane ?? []) {
      if (r.s) keys.add(r.s);
      laneRequirements.push({
        orderId,
        stageId: factStageId(orderId, r.s),
        key: r.k,
        status: r.st,
      });
    }
    for (const key of keys)
      stages.push({ id: factStageId(orderId, key), orderId, key });
  }
  return { stages, requirements, laneRequirements };
}

/** Etapas em andamento ou bloqueadas de todos os pedidos dados. */
export const activeStagesFromFacts = (
  facts: Array<Pick<OrderFacts, "order" | "active">>,
) => facts.flatMap((f) => f.active.map((s) => ({ ...s, orderId: f.order.id })));

/** Situação da parcela no dia (vencida, a vencer, agendada mudam com o tempo). */
export function installmentStatusOn(
  i: { status: InstallmentStatus; dueDate: string | null },
  today: string,
): InstallmentStatus {
  if (
    !i.dueDate ||
    (i.status !== "overdue" &&
      i.status !== "due_soon" &&
      i.status !== "scheduled")
  )
    return i.status;
  const soon = addDays(today, DUE_SOON_DAYS);
  return i.dueDate < today
    ? "overdue"
    : i.dueDate <= soon
      ? "due_soon"
      : "scheduled";
}

/** Id sintético da etapa de um item (os quadros só precisam saber de que etapa ele é). */
export const factStageId = (orderId: string, key: StageKey | null) =>
  key ? `${orderId}|${key}` : "";

export { live as isLiveStatus };
