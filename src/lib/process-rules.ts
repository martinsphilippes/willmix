import { REQUEST_STATUSES, STAGE_KEYS } from "@/lib/db/schema";
import type { FlowBlock } from "@/lib/flow";
import {
  MILESTONE_BLOCKS,
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
 * (começa/conclui), as etapas antigas (continuam valendo e disparando, para
 * as regras gravadas seguirem funcionando) e o faturamento e o cancelamento.
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

/** Evento da etapa antiga (continua disparando até a fase 5)? */
export const isStageEvent = (event: string) => event.startsWith("stage:");

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
