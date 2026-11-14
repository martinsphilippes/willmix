import "server-only";
import type { DictionaryKey } from "@/i18n/dictionaries";
import type {
  ImportStep,
  Order,
  OrderItem,
  ProductionTrack,
  Receiving,
  Requirement,
  Stage,
} from "@/lib/db/schema";
import { flowStepOfImportKey, flowStepsOf, stepId } from "@/lib/flow";
import {
  PROGRESS_BLOCKS,
  orderProgress,
  type ProgressBlock,
} from "@/lib/flow-progress";
import { isPurchaseFlow } from "@/lib/workflow/stages";
import { parseSampleOrder } from "@/lib/sample-order";
import { openImportStepKeys } from "./import-flow";
import { RECEIVING_STATUSES, missingForClose } from "./receiving";

/*
 * Em que passo do menu cada pedido está agora e a contribuição dele para o
 * Overview (dono, 14/11/2026; docs/FLOW_MENU.md e docs/RESUMOS.md). Uma regra
 * só, pura, usada pelo "Todos no passo" lido das tabelas (flow.ts) e pelo
 * resumo do pedido (`order_summaries.kpi.f`), que soma os indicadores
 * prontos do Overview (`kpi_snapshots`, chave "flow", flow-kpis.ts).
 */

/** Item aberto de um pedido num passo (aba "Todos" da tela do passo). */
export type FlowEntityItem =
  | { kind: "requirement"; requirement: Requirement }
  | { kind: "import"; key: string }
  | {
      kind: "case";
      title: {
        title: DictionaryKey;
        detail: DictionaryKey;
        values: Record<string, string | number>;
      };
    };

/** O que a regra lê de um pedido. */
export interface OrderFlowInput {
  order: Order;
  /** Todas as etapas do pedido. */
  stages: Stage[];
  /** Itens de etapa não concluídos (pendentes ou recusados). */
  openRequirements: Requirement[];
  importSteps: ImportStep[];
  track: ProductionTrack | null;
  receiving: Receiving | null;
  /** Itens do pedido (contagem do recebimento). */
  items: OrderItem[];
  /** Sinal ao fornecedor concluído (item `down_payment`), se houver. */
  downPayment: Requirement | null;
  /** Item do pedido de amostras (`sample_order`), se houver. */
  sampleOrder: Requirement | null;
  /** LPCO: o pedido tem produto de NCM que exige (lpcoOrderIds). */
  lpco?: boolean;
}

export interface FlowEntry {
  step: string;
  item: FlowEntityItem;
  since: string | null;
}

/**
 * Pedido em andamento (nem encerrado, nem cancelado). O do histórico do
 * Sankhya em espera também (dono, 14/11/2026): aparece na situação real, nos
 * passos em que tem atividade, só sem avisos (docs/SANKHYA.md).
 */
export const flowLive = (o: Pick<Order, "status">) =>
  o.status !== "CLOSED" && o.status !== "CANCELLED";

/** Peças da descarga (Armazenagem); o resto (RIC, devolução, fechamento) é Retorno. */
const STORAGE_PARTS = ["seal", "photos", "checklist", "counts"] as const;
/** Etapas em que os passos das amostras andam (sample-flow.ts, SAMPLES_LIVE). */
const SAMPLES_LIVE: readonly string[] = [
  "SHIPPING",
  "CUSTOMS",
  "TRANSPORT",
  "DELIVERED",
];

/**
 * Tudo o que está aberto no pedido, passo a passo: os itens de etapa das
 * etapas em andamento (ou bloqueadas), os passos do embarque, da origem, da
 * certificação e das amostras prontos e não concluídos, a produção em
 * andamento (com ETD, na etapa de inspeção), o recebimento no CD e a
 * pré-produção. Vazio para pedido fora de andamento.
 */
export function orderFlowEntries(input: OrderFlowInput): FlowEntry[] {
  const { order } = input;
  if (!flowLive(order)) return [];
  const out: FlowEntry[] = [];
  // Itens de etapa abertos das etapas em andamento (ou bloqueadas).
  const live = new Map(
    input.stages
      .filter((s) => s.status === "active" || s.status === "blocked")
      .map((s) => [s.id, s]),
  );
  for (const r of input.openRequirements) {
    if (r.status === "done") continue;
    const stage = live.get(r.stageId);
    if (!stage) continue;
    for (const step of flowStepsOf({
      kind: "requirement",
      stageKey: stage.key,
      items: [{ key: r.key }],
    }))
      out.push({
        step: stepId(step),
        item: { kind: "requirement", requirement: r },
        since: stage.startedAt ?? null,
      });
  }
  // Passos do embarque, da origem, da certificação e das amostras.
  const steps = input.importSteps;
  const certification = steps.some((s) => s.key.startsWith("cert_"));
  const sampleDoc = parseSampleOrder(input.sampleOrder?.value);
  const samples =
    SAMPLES_LIVE.includes(order.status) &&
    isPurchaseFlow(order) &&
    sampleDoc?.status === "ordered" &&
    !!sampleDoc.lines?.length;
  const after =
    steps
      .map((s) => s.updatedAt ?? s.createdAt ?? null)
      .filter((d): d is string => !!d)
      .sort()
      .pop() ?? null;
  for (const key of openImportStepKeys(order, steps, {
    certification,
    samples,
    lpco: input.lpco ?? false,
  })) {
    const step = flowStepOfImportKey(key);
    if (step)
      out.push({
        step: stepId(step),
        item: { kind: "import", key },
        since: after,
      });
  }
  // Produção em andamento: com ETD e na etapa de inspeção.
  if (input.track?.etd && order.status === "INSPECTION")
    out.push({
      step: "production/production",
      item: {
        kind: "case",
        title: {
          title: "flow.all.production",
          detail: "flow.all.production",
          values: { n: order.number },
        },
      },
      since: input.track.productionStartAt ?? null,
    });
  // Recebimento no CD: entregue (ou com a descarga começada) e aberto.
  const row = input.receiving;
  if (
    (RECEIVING_STATUSES as readonly string[]).includes(order.status) &&
    !row?.closedAt &&
    (row || order.status === "DELIVERED")
  ) {
    const missing = missingForClose(row, input.items);
    const storage = missing.some((m) =>
      (STORAGE_PARTS as readonly string[]).includes(m),
    );
    for (const step of flowStepsOf({
      kind: storage ? "receiving_storage" : "receiving_return",
    }))
      out.push({
        step: stepId(step),
        item: {
          kind: "case",
          title: {
            title: "flow.receiving.title",
            detail: storage
              ? "flow.receiving.storage"
              : "flow.receiving.return",
            values: { n: order.number },
          },
        },
        since: row?.createdAt ?? null,
      });
  }
  // Pré-produção: sinal pago e a produção sem ETD.
  if (input.downPayment && !input.track?.etd)
    out.push({
      step: "production/pre-production",
      item: {
        kind: "case",
        title: {
          title: "flow.preproduction.title",
          detail: "flow.preproduction.detail",
          values: { n: order.number },
        },
      },
      since:
        input.downPayment.submittedAt ?? input.downPayment.updatedAt ?? null,
    });
  return out;
}

/**
 * Contribuição do pedido para o Overview, guardada no resumo
 * (`order_summaries.kpi.f`). Só datas e números: o atraso é contado na
 * leitura, contra o "agora".
 */
export interface OrderFlow {
  /** Número do pedido. */
  n: number;
  /** Situação do pedido (a etapa). */
  st: string;
  /** Fornecedor. */
  sup: string | null;
  /** Passos em que o pedido está (`bloco/passo`) e desde quando. */
  s: Record<string, string | null>;
  /** Completude de Pedido, Produção e Entrega (PROGRESS_BLOCKS). */
  p: number[];
  /** Completude geral. */
  o: number;
  /** Prazo mais antigo das etapas abertas de cada bloco (atraso). */
  d: (string | null)[];
  /** Início de cada bloco (a primeira etapa dele que começou). */
  b: (string | null)[];
  /**
   * Histórico do Sankhya em espera até o go-live: entra nos passos reais,
   * como os outros, marcado (sem avisos; docs/SANKHYA.md).
   */
  h?: true;
}

/** Só os passos dos blocos com Overview pelos pedidos. */
const inProgressBlocks = (step: string) =>
  (PROGRESS_BLOCKS as readonly string[]).includes(step.split("/")[0]);

export function buildOrderFlow(input: OrderFlowInput): OrderFlow | null {
  const { order } = input;
  if (!flowLive(order)) return null;
  const s: Record<string, string | null> = {};
  for (const e of orderFlowEntries(input)) {
    if (!inProgressBlocks(e.step)) continue;
    const prev = s[e.step];
    if (!(e.step in s)) s[e.step] = e.since;
    else if (e.since && (!prev || e.since < prev)) s[e.step] = e.since;
  }
  const progress = orderProgress(input.stages);
  const due = (block: ProgressBlock) => {
    const dates = progress.blocks
      .find((b) => b.block === block)!
      .stages.filter((x) => x.state === "active" || x.state === "blocked")
      .map((x) => x.dueAt)
      .filter((d): d is string => !!d && Number.isFinite(Date.parse(d)))
      .sort((a, b) => Date.parse(a) - Date.parse(b));
    return dates[0] ?? null;
  };
  return {
    n: input.order.number,
    st: input.order.status,
    sup: input.order.supplierId || null,
    s,
    p: PROGRESS_BLOCKS.map(
      (b) => progress.blocks.find((x) => x.block === b)!.percent,
    ),
    o: progress.overall,
    d: PROGRESS_BLOCKS.map(due),
    b: PROGRESS_BLOCKS.map(
      (b) => progress.blocks.find((x) => x.block === b)!.startedAt,
    ),
    ...(order.held ? { h: true as const } : {}),
  };
}
