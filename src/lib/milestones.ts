import type { DictionaryKey } from "@/i18n/dictionaries";
import type { FlowBlock } from "@/lib/flow";

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
    ["new-order"],
    ["P6", "P8", "P15"],
  ),
  m("art-material", "order", ["order/art-material"], ["new-order"], ["P4"]),
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
