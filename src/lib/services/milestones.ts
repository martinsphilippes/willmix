import "server-only";
import type {
  ImportStep,
  Order,
  OrderMilestone,
  ProductionTrack,
  Receiving,
  Requirement,
  Stage,
} from "@/lib/db/schema";
import { getStore } from "@/lib/db";
import { flowStepOfImportKey, flowStepsOf, stepId } from "@/lib/flow";
import {
  MILESTONE_KEYS,
  MILESTONES,
  orderMilestones,
  type MilestoneKey,
  type MilestoneView,
  type Subtask,
} from "@/lib/milestones";
import { baseKeyOf, LANE_KEYS, SAMPLE_ORDER_KEY } from "@/lib/purchase-lanes";
import { parseSampleOrder } from "@/lib/sample-order";
import { isOffFlowStage, isPurchaseFlow } from "@/lib/workflow/stages";
import {
  IMPORT_STEPS,
  groupOf,
  importStepDone,
  lpcoApplies,
  sealArtApplies,
  stepApplies,
} from "./import-flow";

/*
 * Subtarefas de um pedido para os marcos (dono, 14/11/2026; fase 2,
 * docs/MILESTONES.md): os itens do pedido (pelo passo do menu de cada um),
 * os passos do embarque, da origem, da certificação e das amostras que valem
 * para ele, a produção (dados e ETD; começo da inspeção) e o recebimento no
 * CD. A situação dos marcos sai da regra pura (`orderMilestones`).
 */

export interface MilestoneInput {
  order: Order;
  stages: Stage[];
  /** Todos os itens do pedido, de qualquer situação. */
  requirements: Requirement[];
  importSteps: ImportStep[];
  track: ProductionTrack | null;
  receiving: Receiving | null;
  /** O pedido tem produto de NCM que exige LPCO. */
  lpco: boolean;
  /**
   * Passo do item no lugar do calculado pela etapa (fase 5b, conferência da
   * migração): devolve o passo gravado no item (`requirements.step`) ou nulo
   * (o item não entra). Sem ele, o passo sai da etapa e da chave.
   */
  requirementStep?: (r: Requirement, stage: Stage) => string | null;
  /**
   * De onde sai o passo do item (fase 5c): "stored" (o padrão) lê o passo
   * gravado no item (`requirements.step`) e só cai no de-para pela etapa
   * quando ele está vazio; "stages" usa sempre a etapa (a conta antiga, para
   * a conferência da migração).
   */
  source?: "stored" | "stages";
}

/** Passos de um item: o gravado (fase 5c) ou, sem ele, pela etapa e a chave. */
function stepsOfRequirement(
  r: Pick<Requirement, "key" | "step">,
  stage: Pick<Stage, "key">,
  source: "stored" | "stages",
): string[] {
  if (source === "stored" && r.step) return [r.step];
  return flowStepsOf({
    kind: "requirement",
    stageKey: stage.key,
    items: [{ key: r.key }],
  }).map(stepId);
}

/** Passo começado (enviado, validado ou recusado; a linha pendente não conta). */
const startedStep = (step: ImportStep | undefined) =>
  !!step && step.status !== "pending";

/** As subtarefas do pedido, cada uma no passo do menu dela (função pura). */
export function orderSubtasks(input: MilestoneInput): Subtask[] {
  const { order } = input;
  const stageById = new Map(input.stages.map((s) => [s.id, s]));
  const out: Subtask[] = [];
  // Itens do pedido (etapa cancelada não conta).
  for (const r of input.requirements) {
    const stage = stageById.get(r.stageId);
    if (!stage || stage.status === "cancelled") continue;
    // Fase 5d: o item opcional (e o da etapa fora do fluxo) não segura os
    // marcos seguintes.
    const optional =
      r.required === false || isOffFlowStage(stage.key) ? true : undefined;
    if (input.requirementStep) {
      const step = input.requirementStep(r, stage);
      if (step)
        out.push({
          step,
          key: r.key,
          done: r.status === "done",
          dueAt: r.status === "done" ? null : (stage.dueAt ?? null),
          ...(optional ? { optional } : {}),
        });
      continue;
    }
    for (const step of stepsOfRequirement(r, stage, input.source ?? "stored"))
      out.push({
        step,
        key: r.key,
        done: r.status === "done",
        dueAt: r.status === "done" ? null : (stage.dueAt ?? null),
        ...(optional ? { optional } : {}),
      });
  }
  // Passos do embarque, da origem, da certificação e das amostras.
  const saved = new Map(input.importSteps.map((s) => [s.key, s]));
  const certification =
    input.importSteps.some((s) => s.key.startsWith("cert_")) ||
    input.requirements.some((r) => baseKeyOf(r.key) === LANE_KEYS.certificate);
  const sampleDoc = parseSampleOrder(
    input.requirements.find((r) => r.key === SAMPLE_ORDER_KEY)?.value,
  );
  const samples =
    isPurchaseFlow(order) &&
    sampleDoc?.status === "ordered" &&
    !!sampleDoc.lines?.length;
  // Fase 5d: a certificação do cartão do pedido (memorial, selo e arte com
  // o selo) no pedido de compra cuja linha exige (P6, item do certificado);
  // laboratório e registro, e nos outros pedidos qualquer passo, só depois
  // de começados (como o cartão Certificação mostra).
  const fullCertification =
    isPurchaseFlow(order) &&
    input.requirements.some((r) => baseKeyOf(r.key) === LANE_KEYS.certificate);
  // Reposição e encomenda sem certificado novo: sem a arte com o selo.
  const sealArt = sealArtApplies(
    order,
    input.requirements.map((r) => r.key),
  );
  for (const tpl of IMPORT_STEPS) {
    const group = groupOf(tpl);
    if (group === "certification" && !certification) continue;
    if (
      group === "certification" &&
      !startedStep(saved.get(tpl.key)) &&
      !(fullCertification && (tpl.seal || tpl.key === "cert_memorial"))
    )
      continue;
    if (group === "samples" && !samples) continue;
    // Divergência no recebimento: só com as linhas dos passos (contagem com divergência).
    if (!stepApplies(order, tpl.key, input.lpco, input.importSteps, sealArt))
      continue;
    if (tpl.key === "bl" && isPurchaseFlow(order)) continue;
    const step = flowStepOfImportKey(tpl.key);
    if (!step) continue;
    out.push({
      step: stepId(step),
      key: tpl.key,
      done: importStepDone(saved.get(tpl.key)),
    });
  }
  // Fase 5e: a produção e o recebimento pelos marcos, não mais pela etapa
  // da Inspeção nem pela situação do pedido. Uma primeira conta só com os
  // itens e os passos diz onde o pedido está.
  const first = orderMilestones(out, order.status);
  const finished = finishedMilestones(first);
  // Produção: dados e ETD depois do sinal; a inspeção começa (como a etapa
  // começava) quando os marcos do bloco Pedido estão prontos; a produção
  // conclui (liberada para carregar) quando a Inspeção conclui.
  const paid = input.requirements.some(
    (r) => r.key === "down_payment" && r.status === "done",
  );
  const inspection = first.find((v) => v.key === "inspection");
  const inspecting =
    !!inspection &&
    inspection.state !== "na" &&
    ORDER_BLOCK_MILESTONES.every((k) => finished.has(k));
  if (paid || input.track || inspecting)
    out.push({
      step: "production/pre-production",
      key: "production_plan",
      done: !!input.track?.etd || inspecting,
    });
  if (inspection && inspection.state !== "na")
    out.push({
      step: "production/production",
      key: "production",
      done: inspecting && cleared(inspection),
    });
  // Recebimento no CD (descarga, contagem, RIC e fechamento): com a nota
  // fiscal e o transporte prontos (antes, a situação "Entregue").
  if (
    input.receiving ||
    order.status === "CLOSED" ||
    finished.has("invoice-transport")
  )
    out.push({
      step: "delivery/storage",
      key: "receiving",
      done: !!input.receiving?.closedAt || order.status === "CLOSED",
    });
  return out;
}

/** Marcos do bloco Pedido (antes da produção): os que a etapa da Inspeção esperava. */
const ORDER_BLOCK_MILESTONES: readonly MilestoneKey[] = [
  "new-order",
  "certification",
  "art-material",
  "art",
  "contract",
  "down-payment",
];

/** Todas as obrigatórias feitas (o opcional não segura; fase 5d). */
const cleared = (v: Pick<MilestoneView, "state" | "subtasks">) =>
  v.state === "done" ||
  v.state === "na" ||
  v.subtasks.every((x) => x.done || x.optional);

/**
 * Marcos prontos para os seguintes: as obrigatórias dele e as dos marcos de
 * que depende feitas (o que não se aplica é transparente).
 */
export function finishedMilestones(
  views: readonly Pick<MilestoneView, "key" | "state" | "subtasks">[],
): Set<MilestoneKey> {
  const byKey = new Map(views.map((v) => [v.key, v]));
  const memo = new Map<MilestoneKey, boolean>();
  const ok = (key: MilestoneKey): boolean => {
    const known = memo.get(key);
    if (known !== undefined) return known;
    const v = byKey.get(key);
    const def = MILESTONES.find((d) => d.key === key)!;
    const result = (!v || cleared(v)) && def.deps.every(ok);
    memo.set(key, result);
    return result;
  };
  return new Set(MILESTONE_KEYS.filter(ok));
}

/**
 * Prazo dos marcos pelo gravado em `order_milestones` (fase 5c): o marco em
 * andamento com linha e prazo usa o `dueAt` dela; sem linha (ou sem prazo),
 * fica o da subtarefa aberta mais antiga (o prazo da etapa).
 */
export function withStoredDue<
  T extends Pick<MilestoneView, "key" | "state" | "dueAt">,
>(
  views: T[],
  rows: readonly Pick<OrderMilestone, "key" | "dueAt">[] | null | undefined,
): T[] {
  if (!rows?.length) return views;
  const due = new Map(rows.map((r) => [r.key, r.dueAt ?? null]));
  return views.map((v) => {
    if (v.state !== "active") return v;
    const stored = due.get(v.key);
    return stored ? { ...v, dueAt: stored } : v;
  });
}

/** Os marcos do pedido pelas subtarefas e pelo prazo gravado (fase 5c). */
export function milestoneViews(
  input: MilestoneInput & {
    milestones?: readonly Pick<OrderMilestone, "key" | "dueAt">[] | null;
  },
): MilestoneView[] {
  return withStoredDue(
    orderMilestones(orderSubtasks(input), input.order.status),
    input.milestones,
  );
}

/** Os marcos de um pedido, lendo o que ele tem (leituras pelo pedido). */
export async function milestonesOf(input: Order): Promise<MilestoneView[]> {
  const store = getStore();
  // A situação de agora (o pedido pode ter mudado depois de lido).
  const order = (await store.get("orders", input.id)) ?? input;
  const filter = { orderId: order.id };
  const [stages, requirements, importSteps, tracks, receivings, lpco, rows] =
    await Promise.all([
      store.list("stages", { filter }),
      store.list("requirements", { filter }),
      store.list("import_steps", { filter }).catch(() => []),
      store.list("production_tracks", { filter }).catch(() => []),
      store.list("receivings", { filter }).catch(() => []),
      lpcoApplies(order).catch(() => false),
      store.list("order_milestones", { filter }).catch(() => []),
    ]);
  return milestoneViews({
    order,
    stages,
    requirements,
    importSteps,
    track: tracks[0] ?? null,
    receiving: receivings[0] ?? null,
    lpco,
    milestones: rows,
  });
}
