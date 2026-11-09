import type {
  ApprovalLevel,
  ApprovalStatus,
  QuoteStatus,
  RequestStatus,
} from "@/lib/db/schema";
import { addBusinessDays } from "@/lib/sla";
import { brazilDay } from "@/lib/supplier-terms";

/*
 * Etapas da solicitação: o rastreio de tudo o que acontece antes de virar
 * pedido, como as "Etapas do pedido" (decisão do dono). Na ordem:
 *
 *  1. Solicitação nova       → a RFQ é aberta                   (Wellmix)
 *  2. RFQ aberta             → chega a 1ª cotação               (fornecedores)
 *  3. Cotações recebidas     → todos responderam ou venceu o
 *                              prazo da RFQ                     (fornecedores)
 *  4. Comparação de cotações → o comprador escolhe              (Wellmix)
 *  5. Valor calculado        → junto com a escolha (marco)      (Wellmix)
 *  6. Aprovação do pré-custo → último nível aprova              (aprovadores)
 *  7. Faca (die-cut)         → o fornecedor escolhido envia;
 *                              corre junto com 8 e 9            (fornecedor)
 *  8. Proposta ao cliente    → o cliente aprova (ou a Wellmix
 *                              confirma o sinal)                (cliente)
 *  9. Sinal                  → sinal confirmado: vira pedido    (cliente)
 *
 * Prazos em dias úteis (Configurações → requestStepDays). Tudo sai dos dados
 * que já existem (cotações, aprovação, auditoria da escolha e do sinal,
 * briefing da embalagem); a única coisa nova gravada é a aprovação da
 * proposta pelo cliente. Função pura: a tela e os testes usam a mesma regra.
 */

export const REQUEST_STAGE_KEYS = [
  "new",
  "rfq",
  "quotes",
  "compare",
  "priced",
  "approval",
  "dieline",
  "proposal",
  "down",
] as const;
export type RequestStageKey = (typeof REQUEST_STAGE_KEYS)[number];

/** Etapas em sequência (a faca corre ao lado, a partir da escolha). */
const MAIN: RequestStageKey[] = [
  "new",
  "rfq",
  "quotes",
  "compare",
  "priced",
  "approval",
  "proposal",
  "down",
];

export type RequestStageState =
  "done" | "active" | "pending" | "skipped" | "cancelled";

/** Com quem está a etapa. */
export type RequestStageWho =
  "wellmix" | "suppliers" | "supplier" | "approvers" | "customer";

/** Prazos das etapas em dias úteis (Configurações). */
export interface RequestStepDays {
  /** Abrir a RFQ depois da solicitação. */
  new: number;
  /** Os fornecedores responderem depois de a RFQ abrir. */
  rfq: number;
  /** O comprador escolher depois que as cotações chegam. */
  compare: number;
  /** Cada nível da aprovação do pré-custo. */
  approval: number;
  /** O cliente aprovar a proposta. */
  proposal: number;
}

export const DEFAULT_REQUEST_STEP_DAYS: RequestStepDays = {
  new: 1,
  rfq: 3,
  compare: 1,
  approval: 1,
  proposal: 2,
};

/** Prazos das Configurações, com os padrões no que faltar ou vier errado. */
export function requestStepDays(value: unknown): RequestStepDays {
  const v = (value ?? {}) as Partial<Record<keyof RequestStepDays, unknown>>;
  const out = { ...DEFAULT_REQUEST_STEP_DAYS };
  for (const key of Object.keys(out) as (keyof RequestStepDays)[]) {
    const n = Number(v[key]);
    if (Number.isFinite(n) && n >= 0 && n <= 60) out[key] = Math.round(n);
  }
  return out;
}

export interface RequestStageRow {
  key: RequestStageKey;
  state: RequestStageState;
  who: RequestStageWho;
  /** Prazo (dia, AAAA-MM-DD). */
  dueAt: string | null;
  /** Quando terminou (data e hora), se se sabe. */
  doneAt: string | null;
  /** Em andamento com o prazo vencido. */
  late: boolean;
  /** Cotações: quantas responderam de quantas convidadas. */
  answered?: { done: number; total: number };
  /** Aprovação: o nível que decide agora. */
  level?: ApprovalLevel | null;
}

export interface RequestStagesInput {
  status: RequestStatus;
  createdAt: string;
  quotes: {
    createdAt: string;
    answeredAt: string | null;
    status: QuoteStatus;
  }[];
  /** A aprovação do pré-custo mais recente (se houve). */
  approval: {
    status: ApprovalStatus;
    createdAt: string;
    decidedAt: string | null;
    levels: ApprovalLevel[];
    currentLevel: ApprovalLevel | null;
  } | null;
  /** Quando o fornecedor foi escolhido (a proposta foi ao cliente). */
  selectedAt: string | null;
  /** Faca obrigatória no briefing da embalagem (nulo = sem faca). */
  dieline: { dueAt: string | null; doneAt: string | null } | null;
  /** O cliente aprovou a proposta. */
  proposalApprovedAt: string | null;
  /** Sinal confirmado pela Wellmix. */
  downConfirmedAt: string | null;
  days: RequestStepDays;
  now: Date;
}

const WHO: Record<RequestStageKey, RequestStageWho> = {
  new: "wellmix",
  rfq: "suppliers",
  quotes: "suppliers",
  compare: "wellmix",
  priced: "wellmix",
  approval: "approvers",
  dieline: "supplier",
  proposal: "customer",
  down: "customer",
};

const first = (values: (string | null | undefined)[]) =>
  values.filter((v): v is string => !!v).sort()[0] ?? null;
const last = (values: (string | null | undefined)[]) =>
  values
    .filter((v): v is string => !!v)
    .sort()
    .at(-1) ?? null;

/** As etapas da solicitação, na ordem, com situação, prazo e conclusão. */
export function requestStages(i: RequestStagesInput): RequestStageRow[] {
  const today = brazilDay(i.now) ?? "";
  const plus = (iso: string | null, days: number) => {
    const day = brazilDay(iso);
    return day ? addBusinessDays(day, days) : null;
  };

  // O que já aconteceu, pelos próprios dados.
  const rfqOpenedAt = first(i.quotes.map((q) => q.createdAt));
  const answers = i.quotes.map((q) => q.answeredAt).filter(Boolean);
  const firstAnswerAt = first(answers);
  const allAnswered = i.quotes.length > 0 && answers.length >= i.quotes.length;
  const rfqDue = plus(rfqOpenedAt, i.days.rfq);
  const rfqExpired = !!rfqDue && rfqDue < today;
  // A aprovação reprovada ou cancelada devolve a escolha ao comprador.
  const approval =
    i.approval &&
    (i.approval.status === "pending" || i.approval.status === "approved")
      ? i.approval
      : null;
  const comparedAt = approval?.createdAt ?? i.selectedAt;
  const quotesDoneAt = allAnswered
    ? last(answers)
    : rfqExpired && firstAnswerAt
      ? `${rfqDue}T23:59:59.000Z`
      : null;
  const proposalAt = i.proposalApprovedAt ?? i.downConfirmedAt;
  const ordered = i.status === "ORDERED";

  const doneAt: Record<RequestStageKey, string | null> = {
    new: rfqOpenedAt,
    rfq: firstAnswerAt,
    quotes:
      quotesDoneAt && comparedAt
        ? first([quotesDoneAt, comparedAt])
        : (quotesDoneAt ?? comparedAt),
    compare: comparedAt,
    priced: comparedAt,
    approval: approval?.status === "approved" ? approval.decidedAt : null,
    dieline: i.dieline?.doneAt ?? null,
    proposal: proposalAt,
    down: i.downConfirmedAt,
  };

  // Etapa sem aprovação: escolha feita direto (aprovação desligada).
  const approvalSkipped = !approval && !!i.selectedAt;
  // Até onde a solicitação andou: uma etapa adiante feita (ou a situação)
  // conclui as de antes, mesmo sem a data delas.
  const reached = (key: RequestStageKey) => MAIN.indexOf(key);
  let progress = -1;
  MAIN.forEach((key, index) => {
    if (doneAt[key]) progress = Math.max(progress, index);
  });
  if (i.status === "RFQ_OPEN" || i.status === "QUOTATION_RECEIVED")
    progress = Math.max(progress, reached("new"));
  if (i.status === "WAITING_DOWN_PAYMENT")
    progress = Math.max(progress, reached("approval"));
  if (ordered) progress = MAIN.length - 1;
  // Ainda chegando cotações dentro do prazo: não pula para a comparação.
  const waitingQuotes =
    !!firstAnswerAt && !allAnswered && !rfqExpired && !comparedAt;
  const cancelled = i.status === "CANCELLED";

  const due: Record<RequestStageKey, string | null> = {
    new: plus(i.createdAt, i.days.new),
    rfq: rfqDue,
    quotes: rfqDue,
    compare: plus(quotesDoneAt ?? firstAnswerAt, i.days.compare),
    priced: null,
    approval: approval
      ? plus(
          approval.createdAt,
          i.days.approval * Math.max(1, approval.levels.length),
        )
      : null,
    dieline: i.dieline?.dueAt ? brazilDay(i.dieline.dueAt) : null,
    proposal: plus(i.selectedAt, i.days.proposal),
    down: null,
  };

  let activeSet = false;
  const rows: RequestStageRow[] = [];
  for (const key of REQUEST_STAGE_KEYS) {
    let state: RequestStageState;
    if (key === "dieline") {
      // Corre ao lado: começa na escolha do fornecedor.
      state = !i.dieline
        ? "skipped"
        : i.dieline.doneAt
          ? "done"
          : cancelled
            ? i.selectedAt
              ? "cancelled"
              : "pending"
            : i.selectedAt || progress >= reached("approval")
              ? "active"
              : "pending";
    } else if (key === "approval" && approvalSkipped) {
      state = "skipped";
    } else if (reached(key) <= progress || doneAt[key]) {
      state = "done";
    } else if (activeSet) {
      state = "pending";
    } else {
      activeSet = true;
      state = cancelled ? "cancelled" : "active";
    }
    // Cotações ainda chegando: a etapa 3 fica em andamento (não concluída).
    if (key === "quotes" && waitingQuotes && !cancelled) state = "active";
    if (key === "compare" && waitingQuotes && !cancelled) state = "pending";
    const row: RequestStageRow = {
      key,
      state,
      who: WHO[key],
      // Etapa que ainda não começou: sem prazo (começa quando a anterior acabar).
      dueAt: state === "skipped" || state === "pending" ? null : due[key],
      doneAt: state === "done" ? doneAt[key] : null,
      late: state === "active" && !!due[key] && (due[key] as string) < today,
    };
    if (key === "rfq" || key === "quotes")
      row.answered = { done: answers.length, total: i.quotes.length };
    if (key === "approval" && approval)
      row.level = approval.status === "pending" ? approval.currentLevel : null;
    rows.push(row);
  }
  return rows;
}
