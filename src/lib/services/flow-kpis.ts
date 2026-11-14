import "server-only";
import { cache } from "react";
import { getStore } from "@/lib/db";
import { listColumns } from "@/lib/db/lookup";
import { isSchemaMissing } from "@/lib/db/errors";
import { stepsOf, stepId, type FlowBlock } from "@/lib/flow";
import {
  PROGRESS_BLOCKS,
  heldStepOf,
  type ProgressBlock,
} from "@/lib/flow-progress";
import type { OrderFlow } from "./flow-contribution";
import type { OverviewEntity } from "./flow";

/*
 * Indicadores prontos do Overview dos blocos (dono, 14/11/2026;
 * docs/RESUMOS.md e docs/FLOW_MENU.md). A tela lê uma linha só
 * (`kpi_snapshots`, chave "flow"): por bloco, quantas entidades, atrasadas,
 * a completude média do bloco e a geral e a mais antiga; por passo, quantas
 * entidades. A lista do bloco (ou do passo) é montada da contribuição de
 * cada pedido (`order_summaries.kpi.f`, só os em andamento), e a do Produto
 * novo das tabelas pequenas (books e solicitações), lidas na hora.
 *
 * - Refeito por evento (gravação de pedido, book, convite ou solicitação;
 *   src/lib/db/summary-dirty.ts), na reconstrução dos resumos e quando passa
 *   `validUntil` (um prazo vence e o atraso muda).
 * - Mudou o formato? Suba FLOW_KPI_VERSION.
 */

export const FLOW_KPI_VERSION = 2;
export const FLOW_KPI_KEY = "flow";

const DAY = 86_400_000;

export interface FlowBlockKpi {
  count: number;
  late: number;
  /** Completude média do bloco. */
  percent: number;
  /** Completude geral média. */
  overall: number;
  /** A entidade há mais tempo no bloco (desde quando). */
  oldest: string | null;
}

export interface FlowKpis {
  version: number;
  summaryVersion: number;
  computedAt: string;
  validUntil: string | null;
  blocks: Record<string, FlowBlockKpi>;
  /** Entidades em cada passo (`bloco/passo`). */
  steps: Record<string, number>;
  /**
   * Histórico do Sankhya em espera até o go-live, à parte: quantos em cada
   * bloco e em cada passo, pela situação (docs/SANKHYA.md).
   */
  held: { blocks: Record<string, number>; steps: Record<string, number> };
}

/** Blocos com o Overview pelas entidades, na ordem do mapa. */
export const ENTITY_BLOCKS: readonly FlowBlock[] = [
  "new-product",
  ...PROGRESS_BLOCKS,
];

const avg = (xs: number[]) =>
  xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0;

/** Dias de atraso pelo prazo mais antigo das etapas abertas (a regra de orderProgress). */
const lateFrom = (due: string | null, now: Date) => {
  const at = due ? Date.parse(due) : NaN;
  return Number.isFinite(at) && at < now.getTime()
    ? Math.max(0, Math.floor((now.getTime() - at) / DAY))
    : 0;
};

/** As linhas de um bloco montadas da contribuição de cada pedido. */
export function entitiesFromFlows(
  flows: Array<{ id: string; f: OrderFlow }>,
  block: ProgressBlock,
  now: Date,
): OverviewEntity[] {
  const i = PROGRESS_BLOCKS.indexOf(block);
  const order = stepsOf(block)
    .filter((s) => !s.badgeOnly)
    .map((s) => s.key);
  const out: OverviewEntity[] = [];
  for (const { id, f } of flows) {
    if (f.h) continue;
    const keys = Object.keys(f.s)
      .filter((k) => k.startsWith(`${block}/`))
      .map((k) => k.slice(block.length + 1))
      .filter((k) => order.includes(k))
      .sort((a, b) => order.indexOf(a) - order.indexOf(b));
    if (!keys.length) continue;
    const since = keys
      .map((k) => f.s[`${block}/${k}`])
      .filter((d): d is string => !!d)
      .sort()[0];
    out.push({
      kind: "order",
      id,
      number: f.n,
      href: `/app/orders/${id}?from=${block}#order-progress`,
      partyId: f.sup,
      steps: keys,
      statusKey: `stage.${f.st}`,
      since: f.b[i] ?? since ?? null,
      lateDays: lateFrom(f.d[i], now),
      percent: f.p[i] ?? 0,
      overall: f.o,
    });
  }
  return out.sort((a, b) => a.number - b.number);
}

/** Pedido do histórico em espera como linha do Overview (só pela situação). */
export function heldEntity(o: {
  id: string;
  number: number;
  status: string;
  supplierId: string | null;
}): (OverviewEntity & { block: string }) | null {
  const ref = heldStepOf(o.status);
  if (!ref) return null;
  const [block, key] = ref.split("/");
  return {
    block,
    kind: "order",
    id: o.id,
    number: o.number,
    href: `/app/orders/${o.id}`,
    partyId: o.supplierId || null,
    steps: [key],
    statusKey: `stage.${o.status}`,
    since: null,
    lateDays: 0,
    percent: 0,
    overall: 0,
  };
}

/** Os pedidos em espera de um bloco (pela situação), na ordem do número. */
export function heldOfBlock(
  orders: Array<{
    id: string;
    number: number;
    status: string;
    supplierId: string | null;
  }>,
  block: ProgressBlock,
): OverviewEntity[] {
  const out: OverviewEntity[] = [];
  for (const o of orders) {
    const e = heldEntity(o);
    if (!e || e.block !== block) continue;
    const { block: inBlock, ...row } = e;
    void inBlock;
    out.push(row);
  }
  return out.sort((a, b) => a.number - b.number);
}

/** Os pedidos em espera de um bloco, da contribuição guardada no resumo. */
export function heldFromFlows(
  flows: Array<{ id: string; f: OrderFlow }>,
  block: ProgressBlock,
): OverviewEntity[] {
  return heldOfBlock(
    flows
      .filter(({ f }) => f.h)
      .map(({ id, f }) => ({
        id,
        number: f.n,
        status: f.st,
        supplierId: f.sup,
      })),
    block,
  );
}

/** Os números do Overview a partir das linhas de cada bloco. */
export function aggregateFlow(
  byBlock: Map<FlowBlock, OverviewEntity[]>,
  heldByBlock: Map<FlowBlock, OverviewEntity[]> = new Map(),
): Pick<FlowKpis, "blocks" | "steps" | "held"> {
  const held: FlowKpis["held"] = { blocks: {}, steps: {} };
  const blocks: Record<string, FlowBlockKpi> = {};
  const steps: Record<string, number> = {};
  for (const block of ENTITY_BLOCKS) {
    const list = byBlock.get(block) ?? [];
    blocks[block] = {
      count: list.length,
      late: list.filter((e) => e.lateDays > 0).length,
      percent: avg(list.map((e) => e.percent)),
      overall: avg(list.map((e) => e.overall)),
      oldest:
        list
          .map((e) => e.since)
          .filter((d): d is string => !!d)
          .sort()[0] ?? null,
    };
    for (const step of stepsOf(block)) {
      if (step.badgeOnly) continue;
      steps[stepId(step)] = list.filter((e) =>
        e.steps.includes(step.key),
      ).length;
    }
  }
  for (const block of ENTITY_BLOCKS) {
    const list = heldByBlock.get(block) ?? [];
    held.blocks[block] = list.length;
    for (const step of stepsOf(block)) {
      if (step.badgeOnly) continue;
      held.steps[stepId(step)] = list.filter((e) =>
        e.steps.includes(step.key),
      ).length;
    }
  }
  return { blocks, steps, held };
}

/** Contribuições dos pedidos em andamento. Nulo: resumos de outro formato. */
export async function readOrderFlows(
  ids?: string[],
): Promise<Array<{ id: string; f: OrderFlow }> | null> {
  const { SUMMARY_VERSION } = await import("./order-summary");
  const rows = await listColumns(
    getStore(),
    "order_summaries",
    ["kpi", "version"],
    {
      filter: ids ? { id: ids } : { live: true },
      jsonKeys: { kpi: ["f"] },
    },
  );
  if (rows.some((r) => r.version !== SUMMARY_VERSION)) return null;
  return rows.flatMap((r) => {
    const f = (r.kpi as { f?: OrderFlow | null } | null)?.f;
    return f ? [{ id: r.id, f }] : [];
  });
}

/** As contribuições dos pedidos em andamento, lidas uma vez por página. */
export const readLiveOrderFlows = cache(() => readOrderFlows());

/** Próximo instante em que o atraso de alguma linha muda. */
function nextLateChange(
  flows: Array<{ f: OrderFlow }>,
  npDues: number[],
  now: Date,
): number | null {
  const at = now.getTime();
  let next: number | null = null;
  const until = (t: number) => {
    if (Number.isFinite(t) && t > at && (next === null || t < next)) next = t;
  };
  // Pedido: atrasado a partir de 1 dia inteiro depois do prazo.
  for (const { f } of flows)
    for (const d of f.d) if (d) until(Date.parse(d) + DAY);
  // Produto novo: atrasado logo depois do prazo (convite, SLA).
  for (const t of npDues) until(t);
  return next;
}

/**
 * Refaz o agregado e grava. Nulo: resumos fora de uso (a tela segue pelas
 * tabelas).
 */
export async function rebuildFlowKpis(
  now: Date = new Date(),
): Promise<FlowKpis | null> {
  const { summariesReady, SUMMARY_VERSION } = await import("./order-summary");
  if (!(await summariesReady())) return null;
  const flows = await readOrderFlows();
  if (!flows) return null;
  const byBlock = new Map<FlowBlock, OverviewEntity[]>();
  for (const block of PROGRESS_BLOCKS)
    byBlock.set(block, entitiesFromFlows(flows, block, now));
  const { newProductData } = await import("./flow");
  const overall = new Map(flows.map(({ id, f }) => [id, f.o]));
  const np = await newProductData(null, now, overall);
  byBlock.set("new-product", np.rows);
  const validUntil = nextLateChange(flows, np.dues, now);
  const snapshot: FlowKpis = {
    version: FLOW_KPI_VERSION,
    summaryVersion: SUMMARY_VERSION,
    computedAt: now.toISOString(),
    validUntil: validUntil === null ? null : new Date(validUntil).toISOString(),
    ...aggregateFlow(
      byBlock,
      new Map(PROGRESS_BLOCKS.map((b) => [b, heldFromFlows(flows, b)])),
    ),
  };
  await writeSnapshot(snapshot);
  return snapshot;
}

async function writeSnapshot(snapshot: FlowKpis) {
  const store = getStore();
  const row = {
    id: FLOW_KPI_KEY,
    key: FLOW_KPI_KEY,
    version: FLOW_KPI_VERSION,
    data: snapshot,
    validUntil: snapshot.validUntil,
    computedAt: snapshot.computedAt,
  };
  if (store.upsertMany) {
    await store.upsertMany("kpi_snapshots", [row]);
    return;
  }
  const { id, ...rest } = row;
  if (await store.get("kpi_snapshots", id))
    await store.update("kpi_snapshots", id, rest);
  else await store.create("kpi_snapshots", row);
}

/**
 * Os indicadores do Overview, prontos; nulo enquanto os resumos não estão em
 * uso. Recalcula antes o que gravações desta instância marcaram; vencido ou
 * de outro formato, refaz antes de responder.
 */
export async function readFlowKpis(
  now: Date = new Date(),
): Promise<FlowKpis | null> {
  const { summariesReady, SUMMARY_VERSION } = await import("./order-summary");
  if (!(await summariesReady())) return null;
  const { flushSummaryChanges } = await import("@/lib/db/summary-dirty");
  await flushSummaryChanges();
  let row;
  try {
    row = await getStore().get("kpi_snapshots", FLOW_KPI_KEY);
  } catch (error) {
    if (isSchemaMissing(error)) return null;
    throw error;
  }
  const data = row?.data as FlowKpis | undefined;
  if (
    data &&
    data.version === FLOW_KPI_VERSION &&
    data.summaryVersion === SUMMARY_VERSION &&
    (!data.validUntil || Date.parse(data.validUntil) > now.getTime())
  )
    return data;
  return rebuildFlowKpis(now);
}
