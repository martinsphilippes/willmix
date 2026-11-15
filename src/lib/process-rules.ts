import { REQUEST_STATUSES, STAGE_KEYS } from "@/lib/db/schema";
import type { FlowBlock } from "@/lib/flow";
import {
  MILESTONE_BLOCKS,
  milestoneOfStatus,
  milestonesOfBlock,
  type MilestoneKey,
} from "@/lib/milestones";

/*
 * Regras de processo (Configurações → Processos; docs/PROCESSES.md): para cada
 * evento de status do portal, o que acontece no estoque e no Sankhya.
 *
 * Decisões da Wellmix (10/11/2026): os status do portal são os gatilhos da
 * movimentação de estoque (de-para ajustável pelo admin); a cotação (TOP
 * 1002) vira pre-order (1100) e depois pedido (1101) pelo planejamento de
 * compras, e cada passo escreve a TOP no Sankhya sem mexer no estoque; o
 * faturamento é mais um evento que escreve a TOP. Puro (sem banco).
 */

export const STOCK_ACTIONS = ["none", "entry", "exit"] as const;
export type StockAction = (typeof STOCK_ACTIONS)[number];

/**
 * Ação no Sankhya:
 * - create_note: inclui a nota (CACSP.incluirNota) com a TOP da regra;
 * - advance: fatura a nota ligada para a TOP da regra (SelecaoDocumentoSP.faturar),
 *   o caminho do Sankhya para cotação → pre-order → pedido → nota;
 * - cancel_note: cancela a nota ligada (CACSP.cancelarNota).
 */
export const SANKHYA_ACTIONS = [
  "none",
  "create_note",
  "advance",
  "cancel_note",
] as const;
export type SankhyaAction = (typeof SANKHYA_ACTIONS)[number];

export type MilestoneEventKey =
  `milestone:${MilestoneKey}:start` | `milestone:${MilestoneKey}:done`;

export type ProcessEventKey =
  | `request:${(typeof REQUEST_STATUSES)[number]}`
  | `stage:${(typeof STAGE_KEYS)[number]}:start`
  | `stage:${(typeof STAGE_KEYS)[number]}:done`
  | MilestoneEventKey
  | "order:signed"
  | "order:cancelled"
  | "order:invoiced";

/**
 * Grupos do editor de regras (fase 4d, docs/MILESTONES.md "Sankhya, regras e
 * painéis"): as solicitações, o pedido assinado, os 16 marcos por bloco
 * (começa/conclui), as etapas antigas (sem efeito desde a fase 5d: o motor
 * não dispara mais `stage:*`; ficam para o administrador trocar cada regra
 * gravada para o marco) e o faturamento e o cancelamento.
 */
export interface ProcessEventGroup {
  kind: "request" | "order" | "milestone" | "stage";
  /** Bloco do mapa (só nos marcos). */
  block?: FlowBlock;
  events: ProcessEventKey[];
}

export const milestoneEvent = (
  key: MilestoneKey,
  moment: "start" | "done",
): MilestoneEventKey => `milestone:${key}:${moment}`;

export const PROCESS_EVENT_GROUPS: ProcessEventGroup[] = [
  {
    kind: "request",
    events: REQUEST_STATUSES.filter((s) => s !== "REQUESTED").map(
      (s) => `request:${s}` as ProcessEventKey,
    ),
  },
  { kind: "order", events: ["order:signed"] },
  ...MILESTONE_BLOCKS.map((block): ProcessEventGroup => ({
    kind: "milestone",
    block,
    events: milestonesOfBlock(block).flatMap((k) => [
      milestoneEvent(k, "start"),
      milestoneEvent(k, "done"),
    ]),
  })),
  {
    kind: "stage",
    events: STAGE_KEYS.flatMap((k) => [
      `stage:${k}:start` as ProcessEventKey,
      `stage:${k}:done` as ProcessEventKey,
    ]),
  },
  { kind: "order", events: ["order:invoiced", "order:cancelled"] },
];

/** Todos os eventos, na ordem do processo (a do editor). */
export const PROCESS_EVENTS: ProcessEventKey[] = PROCESS_EVENT_GROUPS.flatMap(
  (g) => g.events,
);

/** Evento de marco (fase 4d)? */
export const isMilestoneEvent = (event: string): event is MilestoneEventKey =>
  event.startsWith("milestone:");

/**
 * Evento da etapa antiga? Desde a fase 5d o motor anda pelos marcos e não
 * dispara mais `stage:*`: a regra gravada com ele fica sem efeito até o
 * administrador trocá-la para o marco (`stageRuleMilestoneEvent`).
 */
export const isStageEvent = (event: string) => event.startsWith("stage:");

/**
 * Evento de marco proposto para a regra de etapa antiga (fase 5d):
 * `stage:X:start|done` → `milestone:<marco da etapa X>:start|done`, pelo
 * de-para etapa → marco (`milestoneOfStatus`). Sem marco: nulo.
 */
export function stageRuleMilestoneEvent(
  event: string,
): MilestoneEventKey | null {
  const [kind, stage, moment] = event.split(":");
  if (kind !== "stage" || (moment !== "start" && moment !== "done"))
    return null;
  const key = milestoneOfStatus(stage);
  return key ? milestoneEvent(key, moment) : null;
}

/** As regras sem a de etapa antiga dada, que passa para o evento de marco. */
export function rewriteStageRule(
  rules: readonly ProcessRule[],
  event: ProcessEventKey,
):
  | { ok: true; rules: ProcessRule[]; target: MilestoneEventKey }
  | { ok: false; error: "not_stage_rule" | "no_milestone" | "target_in_use" } {
  const rule = rules.find((r) => r.event === event);
  if (!rule || !isStageEvent(event) || !ruleDoesSomething(rule))
    return { ok: false, error: "not_stage_rule" };
  const target = stageRuleMilestoneEvent(event);
  if (!target) return { ok: false, error: "no_milestone" };
  // Nunca por cima de uma regra de marco que já faz alguma coisa.
  const current = rules.find((r) => r.event === target);
  if (current && ruleDoesSomething(current))
    return { ok: false, error: "target_in_use" };
  const { event: _old, ...action } = rule;
  void _old;
  const next = rules
    .filter((r) => r.event !== target)
    .map((r) => (r.event === event ? { event, ...EMPTY } : r));
  next.push({ ...action, event: target });
  return { ok: true, rules: next, target };
}

export interface ProcessRule {
  event: ProcessEventKey;
  active: boolean;
  stock: StockAction;
  sankhya: SankhyaAction;
  /** TOP de destino (create_note e advance). */
  top: number | null;
  note: string | null;
  /**
   * Local de estoque (CODLOCAL) das entradas/saídas da regra; vazio = sem
   * local (só no total do Brasil).
   */
  location?: number | null;
}

/**
 * Proposta inicial a partir das respostas da Wellmix; o admin ajusta na tela.
 * Estoque: nenhuma movimentação por padrão (containers já dão o "No Brasil").
 */
export const DEFAULT_RULES: Partial<
  Record<ProcessEventKey, Omit<ProcessRule, "event">>
> = {
  "request:WAITING_DOWN_PAYMENT": {
    active: true,
    stock: "none",
    sankhya: "create_note",
    top: 1002,
    note: "Fornecedor escolhido: cotação no Sankhya",
  },
  "request:ORDERED": {
    active: true,
    stock: "none",
    sankhya: "advance",
    top: 1100,
    note: "Pedido criado no portal: pre-order",
  },
  "order:signed": {
    active: true,
    stock: "none",
    sankhya: "advance",
    top: 1101,
    note: "Assinado pelos dois: pedido de compra",
  },
  "order:invoiced": {
    active: true,
    stock: "none",
    sankhya: "advance",
    top: null,
    note: "Faturamento: informe a TOP da nota",
  },
  "order:cancelled": {
    active: true,
    stock: "none",
    sankhya: "cancel_note",
    top: null,
    note: "Cancelado no portal: cancela no Sankhya",
  },
};

const EMPTY: Omit<ProcessRule, "event"> = {
  active: false,
  stock: "none",
  sankhya: "none",
  top: null,
  note: null,
};

/** Uma regra por evento: o gravado sobre a proposta inicial. */
export function mergeRules(stored: ProcessRule[] | null): ProcessRule[] {
  const byEvent = new Map((stored ?? []).map((r) => [r.event, r]));
  return PROCESS_EVENTS.map((event) => ({
    event,
    ...(DEFAULT_RULES[event] ?? EMPTY),
    ...(byEvent.get(event) ?? {}),
  }));
}

/** A regra faz alguma coisa? (ativa e com ação) */
export function ruleDoesSomething(rule: ProcessRule) {
  return rule.active && (rule.stock !== "none" || rule.sankhya !== "none");
}

/** O que falta para a regra rodar (TOP nas ações que precisam). */
export function ruleProblem(rule: ProcessRule): string | null {
  if (!rule.active) return null;
  if (
    (rule.sankhya === "create_note" || rule.sankhya === "advance") &&
    !rule.top
  )
    return "top_missing";
  return null;
}
