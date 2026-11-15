import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  flowStepOfImportKey,
  flowStepsOf,
  stepId,
  type FlowBlock,
} from "@/lib/flow";

/*
 * Marcos do pedido (dono, 14/11/2026; fase 2 do plano, docs/MILESTONES.md):
 * 16 marcos na ordem do mapa do processo (docs/MAPA_PROCESSO.md), cada um
 * juntando os passos do menu lateral (que já seguem o mapa) e, por eles, as
 * subtarefas que o pedido já tem (itens, passos do embarque, produção,
 * recebimento). A situação do marco sai das subtarefas e das dependências do
 * mapa: concluído, liberado (em andamento), aguardando outro marco, ou não se
 * aplica. Regra pura: sem banco, sem tela.
 */

export const MILESTONE_KEYS = [
  "new-order",
  "certification",
  "art-material",
  "art",
  "contract",
  "down-payment",
  "pre-production",
  "inspection",
  "samples",
  "production",
  "booking",
  "loading",
  "shipment",
  "customs",
  "invoice-transport",
  "delivery",
] as const;
export type MilestoneKey = (typeof MILESTONE_KEYS)[number];

export interface MilestoneDef {
  key: MilestoneKey;
  /** Bloco do mapa (o mesmo do menu lateral). */
  block: FlowBlock;
  /** Passos do menu (`bloco/passo`) cujas subtarefas o marco junta. */
  steps: string[];
  /** Marcos que precisam estar concluídos antes (o mapa). */
  deps: MilestoneKey[];
  /** Passos do mapa que o marco cobre (docs/MAPA_PROCESSO.md). */
  map: string[];
}

const m = (
  key: MilestoneKey,
  block: FlowBlock,
  steps: string[],
  deps: MilestoneKey[],
  map: string[],
): MilestoneDef => ({ key, block, steps, deps, map });

/**
 * Os 16 marcos, na ordem definida pelo dono (14/11/2026), com as
 * dependências do mapa (sempre para trás).
 */
export const MILESTONES: MilestoneDef[] = [
  // Pedido.
  m(
    "new-order",
    "order",
    ["order/orders", "registry/products"],
    [],
    ["P1", "P2", "P3", "P9", "P14", "P16"],
  ),
  m(
    "certification",
    "order",
    ["order/certification"],
    // As três frentes começam juntas com o pedido gerado, em paralelo com o
    // cadastro (docs/PURCHASE_ORDER.md, 1a); só o Contrato espera todas.
    [],
    ["P6", "P8", "P15"],
  ),
  m("art-material", "order", ["order/art-material"], [], ["P4"]),
  m(
    "art",
    "order",
    ["order/art"],
    ["art-material"],
    ["P5", "P5?", "P7?", "P7"],
  ),
  m(
    "contract",
    "order",
    ["order/contract"],
    ["new-order", "certification", "art"],
    ["P10", "P17", "P11"],
  ),
  m(
    "down-payment",
    "order",
    ["finance/finance"],
    ["contract"],
    ["P12?", "P12"],
  ),
  // Produção.
  m(
    "pre-production",
    "production",
    ["production/pre-production"],
    ["down-payment"],
    ["R1"],
  ),
  m(
    "inspection",
    "production",
    ["production/inspection"],
    ["pre-production"],
    ["R3", "R4?", "R10", "R11"],
  ),
  m(
    "samples",
    "production",
    ["production/sample"],
    ["inspection"],
    ["R12", "R13", "R14", "R15", "R5", "R16"],
  ),
  // Produção concluída: liberada para carregar depois da inspeção aprovada.
  m(
    "production",
    "production",
    ["production/production"],
    ["inspection"],
    ["R1"],
  ),
  m(
    "booking",
    "production",
    ["production/booking", "production/logistics"],
    ["production"],
    ["R8", "R17?", "R17", "R18", "R19"],
  ),
  m(
    "loading",
    "production",
    ["production/loading", "production/cargo-docs"],
    ["booking"],
    ["R20", "R7", "R21", "R22", "R22?", "R23", "R23?", "R24", "R25"],
  ),
  m(
    "shipment",
    "production",
    ["production/shipment"],
    ["loading"],
    ["R26", "R27"],
  ),
  // Entrega.
  m(
    "customs",
    "delivery",
    ["delivery/lpco", "delivery/cargo-presence", "delivery/channel"],
    ["shipment"],
    ["E5", "E5?", "E6", "E7", "E7?", "E11"],
  ),
  m(
    "invoice-transport",
    "delivery",
    ["delivery/invoice", "delivery/logistics"],
    ["customs"],
    ["E12?", "E13", "E14", "E15", "E16"],
  ),
  m(
    "delivery",
    "delivery",
    ["delivery/delivery", "delivery/storage", "delivery/return"],
    ["invoice-transport"],
    [
      "E17?",
      "E9",
      "E18",
      "E19",
      "E20",
      "E19?",
      "E21",
      "E22",
      // Os 4 últimos da Entrega (nomes do dono, 14/11/2026).
      "E24",
      "E25",
      "E26",
      "E27",
    ],
  ),
];

const BY_STEP = new Map<string, MilestoneKey>();
for (const def of MILESTONES)
  for (const s of def.steps) BY_STEP.set(s, def.key);

/** Marco de um passo do menu (`bloco/passo`); nulo fora dos marcos. */
export const milestoneOfStep = (step: string): MilestoneKey | null =>
  BY_STEP.get(step) ?? null;

/** Etapa antiga → marco, para o item que nenhum passo do menu reclama. */
const STAGE_MILESTONE: Partial<Record<string, MilestoneKey>> = {
  ORDER_CREATED: "new-order",
  PREPARATION: "new-order",
  PACKAGING: "contract",
  SUPPLIER_PAYMENT: "down-payment",
  INSPECTION: "inspection",
  SHIPPING: "shipment",
  CUSTOMS: "customs",
  TRANSPORT: "invoice-transport",
  DELIVERED: "delivery",
  CLOSED: "delivery",
};

/**
 * Marco de um item do pedido (fase 3, tela do pedido): pelo passo do menu do
 * item (`flowStepsOf`), o mesmo das subtarefas; sem passo nos marcos, pela
 * etapa dele.
 */
export function milestoneOfRequirement(
  stageKey: string,
  key: string,
): MilestoneKey | null {
  for (const step of flowStepsOf({
    kind: "requirement",
    stageKey,
    items: [{ key }],
  })) {
    const found = milestoneOfStep(stepId(step));
    if (found) return found;
  }
  return STAGE_MILESTONE[stageKey] ?? null;
}

/** Marco de um passo do embarque, da certificação, das amostras ou da origem. */
export function milestoneOfImportKey(key: string): MilestoneKey | null {
  const step = flowStepOfImportKey(key);
  return step ? milestoneOfStep(stepId(step)) : null;
}

export const milestoneLabelKey = (key: MilestoneKey) =>
  `milestone.${key}` as DictionaryKey;

/** Subtarefa do pedido, já com o passo do menu dela. */
export interface Subtask {
  /** Passo do menu (`bloco/passo`). */
  step: string;
  /** Identificação (chave do item ou do passo do embarque). */
  key: string;
  done: boolean;
  /** Prazo da subtarefa, se tiver. */
  dueAt?: string | null;
}

export type MilestoneState = "done" | "active" | "waiting" | "na";

export interface MilestoneView {
  key: MilestoneKey;
  block: FlowBlock;
  state: MilestoneState;
  /** Marco que falta concluir antes (no "aguardando"). */
  waitingFor: MilestoneKey | null;
  total: number;
  done: number;
  percent: number;
  subtasks: Subtask[];
  /** Prazo mais antigo das subtarefas abertas (atraso). */
  dueAt: string | null;
}

/**
 * Situação de cada marco do pedido: concluído (todas as subtarefas feitas),
 * aguardando (falta concluir um marco anterior), liberado (em andamento) ou
 * não se aplica (sem subtarefa, ex.: certificação numa linha que não exige).
 * Marco que não se aplica conta como concluído para os seguintes.
 */
export function orderMilestones(
  subtasks: Subtask[],
  /** Situação do pedido: encerrado conclui tudo; cancelado não se aplica. */
  status?: string,
): MilestoneView[] {
  const groups = new Map<MilestoneKey, Subtask[]>();
  for (const s of subtasks) {
    const key = milestoneOfStep(s.step);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }
  const out = new Map<MilestoneKey, MilestoneView>();
  const defs = new Map(MILESTONES.map((d) => [d.key, d]));
  // Concluído para os seguintes: feito, ou que não se aplica e com as
  // dependências dele concluídas (o marco que não se aplica é transparente).
  const finished = (key: MilestoneKey): boolean => {
    const v = out.get(key);
    if (!v) return true;
    if (v.state === "done") return true;
    if (v.state !== "na") return false;
    return defs.get(key)!.deps.every(finished);
  };
  // O primeiro marco não concluído na corrente de dependências.
  const blocker = (key: MilestoneKey): MilestoneKey | null => {
    for (const d of defs.get(key)!.deps) {
      if (finished(d)) continue;
      return out.get(d)?.state === "na" ? blocker(d) : d;
    }
    return null;
  };
  for (const def of MILESTONES) {
    const list = groups.get(def.key) ?? [];
    const done = list.filter((s) => s.done).length;
    const open = list
      .filter((s) => !s.done && s.dueAt)
      .map((s) => s.dueAt!)
      .sort();
    const waitingFor = blocker(def.key);
    const state: MilestoneState =
      !list.length || status === "CANCELLED"
        ? "na"
        : done === list.length || status === "CLOSED"
          ? "done"
          : waitingFor
            ? "waiting"
            : "active";
    out.set(def.key, {
      key: def.key,
      block: def.block,
      state,
      waitingFor: state === "waiting" ? waitingFor : null,
      total: list.length,
      done,
      percent: list.length ? Math.round((done / list.length) * 100) : 0,
      subtasks: list,
      dueAt: open[0] ?? null,
    });
  }
  return MILESTONES.map((d) => out.get(d.key)!);
}

/*
 * Fase 4a (docs/MILESTONES.md, "Telas que leem os marcos"): as listas e os
 * painéis mostram o marco atual do pedido no lugar da etapa antiga.
 */

/** Número do marco (1 a 16, na ordem do dono). */
export const milestoneNumber = (key: MilestoneKey) =>
  MILESTONE_KEYS.indexOf(key) + 1;

/**
 * Marco de uma situação do pedido (etapa antiga, `orders.status`): para o
 * resumo de formato antigo e as telas que não têm os marcos à mão. Cancelado
 * (ou situação desconhecida): nulo.
 */
export const milestoneOfStatus = (
  status: string | null | undefined,
): MilestoneKey | null => (status ? (STAGE_MILESTONE[status] ?? null) : null);

type MilestoneLike = Pick<MilestoneView, "key" | "state">;

/** Os marcos em andamento (podem correr em paralelo), na ordem do dono. */
export function activeMilestones(
  views: readonly MilestoneLike[],
): MilestoneKey[] {
  const active = new Set(
    views.filter((v) => v.state === "active").map((v) => v.key),
  );
  return MILESTONE_KEYS.filter((k) => active.has(k));
}

/**
 * O marco atual do pedido (a manchete das listas): o primeiro em andamento,
 * na ordem do dono; sem nenhum, o primeiro aguardando; tudo concluído (ou sem
 * aplicação), "Entrega e recebimento" (encerrado). Pedido cancelado, ou sem
 * nenhum marco que se aplique (e não encerrado): nulo.
 */
export function currentMilestone(
  views: readonly MilestoneLike[],
  status?: string | null,
): MilestoneKey | null {
  if (status === "CANCELLED") return null;
  const state = new Map(views.map((v) => [v.key, v.state]));
  const first = (s: MilestoneState) =>
    MILESTONE_KEYS.find((k) => state.get(k) === s) ?? null;
  const found = first("active") ?? first("waiting");
  if (found) return found;
  if (status === "CLOSED" || views.some((v) => v.state === "done"))
    return "delivery";
  return null;
}

/**
 * Marco no resumo do pedido (`order_summaries.facts.m`, docs/RESUMOS.md):
 * chave, situação, feitas, total e prazo da subtarefa aberta mais antiga.
 */
export interface CompactMilestone {
  k: MilestoneKey;
  s: MilestoneState;
  d: number;
  t: number;
  due?: string;
}

/** Os marcos no formato curto do resumo. */
export const compactMilestones = (
  views: readonly MilestoneView[],
): CompactMilestone[] =>
  views.map((v) => ({
    k: v.key,
    s: v.state,
    d: v.done,
    t: v.total,
    ...(v.dueAt ? { due: v.dueAt } : {}),
  }));

/**
 * Marco atual pelo resumo; resumo sem `m` (formato antigo até a
 * reconstrução) ou sem marco que se aplique, pela situação do pedido
 * (`milestoneOfStatus`). Cancelado: nulo.
 */
export function milestoneOfFacts(
  m: readonly CompactMilestone[] | null | undefined,
  status: string | null | undefined,
): MilestoneKey | null {
  if (status === "CANCELLED") return null;
  const found = m?.length
    ? currentMilestone(
        m.map((x) => ({ key: x.k, state: x.s })),
        status,
      )
    : null;
  return found ?? milestoneOfStatus(status);
}

/** Texto "N. Marco" para listas, filtros e cabeçalhos. */
export const milestoneTitle = (
  t: (key: DictionaryKey) => string,
  key: MilestoneKey,
) => `${milestoneNumber(key)}. ${t(milestoneLabelKey(key))}`;

/**
 * Texto da situação do pedido pelo marco (listas sem os marcos à mão):
 * "N. Marco" pelo resumo (`m`) ou pela situação; cancelado ou situação sem
 * marco, o nome antigo (`stage.<situação>`).
 */
export function orderMilestoneText(
  t: (key: DictionaryKey) => string,
  status: string,
  m?: readonly CompactMilestone[] | null,
): string {
  const key = milestoneOfFacts(m, status);
  return key ? milestoneTitle(t, key) : t(`stage.${status}` as DictionaryKey);
}

/** Ordem de um marco (0 a 15); sem marco, depois de todos. */
export const milestoneRank = (key: MilestoneKey | null | undefined) =>
  key ? MILESTONE_KEYS.indexOf(key) : MILESTONE_KEYS.length;
