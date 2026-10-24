import {
  NOTIFICATION_KINDS,
  ROLES,
  STAGE_KEYS,
  type Notification,
  type NotificationActor,
  type NotificationKind,
  type StageKey,
} from "@/lib/db/schema";
import type { Translate } from "@/i18n";
import { dictionaries, type DictionaryKey } from "@/i18n/dictionaries";

/*
 * Leitura de um aviso para a tela: o tipo (o que ele pede de quem recebe),
 * com quem está o assunto e a seção em que entra. Avisos de antes dos campos
 * `kind` e `actor` são classificados pelo assunto, para a caixa antiga não
 * virar uma lista igual sem distinção.
 */

type Row = Pick<Notification, "subject"> &
  Partial<Pick<Notification, "kind" | "actor">>;

/** Trechos de assuntos antigos que pediam atenção (problema, atraso, cancelamento). */
const LEGACY_ALERT = [
  "atrasado:",
  "divergência",
  "revisão necessária",
  " cancelado",
  "precisa de atualização",
  "vencida",
];

/** Trechos de assuntos antigos que pediam uma ação de quem recebia. */
const LEGACY_ACTION = [
  "aguarda sua ação",
  "vence em breve",
  "reprovado",
  "rfq:",
  "proposta disponível",
  "proposta atualizada",
  "to review",
  "please confirm",
  "order #",
  "cotação de frete",
  "carga alterada",
  "nova solicitação",
  "cotação recebida",
  "comprovante do sinal",
  "como foi a sua compra",
  "sourcing sob demanda",
  "kit de marketing comprado",
  "atualize a quantidade",
  "mudou a programação",
  "pediu cancelamento",
  "cancelar no sankhya",
  "esperando conferência",
  "payment(s)",
  "parcela(s)",
  "frete informado",
  "multa registrada",
];

/**
 * Assuntos dos avisos novos, pelo modelo do dicionário (pt, en e zh): tipo e
 * com quem está. Vale para avisos gravados sem `kind` (banco ainda sem a
 * coluna), que saem com o mesmo texto dos demais.
 */
const TEMPLATE_KINDS: ReadonlyArray<
  [DictionaryKey, NotificationKind, NotificationActor | null]
> = [
  ["notif.stage.subject", "action", "recipient"],
  ["notif.due.subject", "action", "recipient"],
  ["notif.overdue.subject", "alert", "recipient"],
  ["notif.rejected.subject", "action", "recipient"],
  ["notif.artwork.subject", "action", "recipient"],
  ["notif.orderCreated.supplier.subject", "action", "recipient"],
  ["notif.orderCreated.customer.subject", "info", "supplier"],
  ["notif.proposal.subject", "action", "recipient"],
  ["notif.proposalUpdated.subject", "action", "recipient"],
  ["notif.quoteSelected.subject", "info", "customer"],
  ["notif.rfq.subject", "action", "recipient"],
  ["notif.rfq.many.subject", "action", "recipient"],
  ["notif.paymentRegistered.subject", "action", "recipient"],
  ["notif.paymentToSupplier.subject", "action", "recipient"],
  ["notif.customerPayment.subject", "done", null],
  ["notif.quantityAdjusted.subject", "info", null],
  ["notif.afterSales.subject", "action", "recipient"],
  ["notif.cancelled.subject", "alert", null],
  ["notif.cancelRefused.subject", "info", null],
  ["notif.freightQuote.subject", "action", "recipient"],
  ["notif.freightChanged.subject", "action", "recipient"],
  ["notif.kit.available.subject", "info", null],
  ["notif.kit.released.subject", "done", null],
];

interface Template {
  re: RegExp;
  kind: NotificationKind;
  actor: NotificationActor | null;
}
let templates: Template[] | null = null;
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Modelos compilados uma vez: cada {parâmetro} vira um trecho curto qualquer. */
function compiledTemplates(): Template[] {
  if (templates) return templates;
  templates = [];
  for (const [key, kind, actor] of TEMPLATE_KINDS)
    for (const locale of ["pt", "en", "zh"] as const) {
      const text = dictionaries[locale][key];
      if (!text) continue;
      const source = text.split(/\{[a-zA-Z]+\}/).map(escapeRegExp).join(".{0,120}");
      templates.push({ re: new RegExp(`^${source}$`), kind, actor });
    }
  return templates;
}
function templateOf(subject: string): Template | null {
  if (subject.length > 200) return null;
  return compiledTemplates().find((t) => t.re.test(subject)) ?? null;
}

const KINDS = new Set<string>(NOTIFICATION_KINDS);

export function notificationKind(n: Row): NotificationKind {
  if (n.kind && KINDS.has(n.kind)) return n.kind;
  const template = templateOf(n.subject);
  if (template) return template.kind;
  const s = n.subject.toLowerCase();
  if (LEGACY_ALERT.some((w) => s.includes(w))) return "alert";
  if (LEGACY_ACTION.some((w) => s.includes(w))) return "action";
  return "info";
}

const ACTORS = new Set<string>(["recipient", "wellmix", ...ROLES]);

/**
 * Com quem está o assunto. Aviso antigo que cobrava algo: com quem recebeu;
 * atenção antiga só é "sua vez" quando era o lembrete de atraso (o aviso de
 * cancelamento ia para todo mundo, sem nada a fazer).
 */
export function notificationActor(n: Row): NotificationActor | null {
  if (n.actor) return ACTORS.has(n.actor) ? n.actor : null;
  if (n.kind && KINDS.has(n.kind)) return null;
  const template = templateOf(n.subject);
  if (template) return template.actor;
  const kind = notificationKind(n);
  if (kind === "action") return "recipient";
  if (kind === "alert") return /^atrasado:/i.test(n.subject) ? "recipient" : null;
  return null;
}

/** Seções da tela: o que precisa de você, o que pede atenção e o resto. */
export type NotificationGroup = "action" | "alert" | "news";
export const NOTIFICATION_GROUPS: readonly NotificationGroup[] = [
  "action",
  "alert",
  "news",
];

export function notificationGroup(kind: NotificationKind): NotificationGroup {
  return kind === "action" || kind === "alert" ? kind : "news";
}

const LEGACY_STAGE = /^Pedido #(\d+): etapa ([A-Z_]+) aguarda sua ação$/;
const LEGACY_DUE = /^(ATRASADO|Vence em breve): pedido #(\d+), etapa ([A-Z_]+)$/;
const isStageKey = (key: string): key is StageKey =>
  (STAGE_KEYS as readonly string[]).includes(key);

/**
 * Assunto para a tela. Aviso antigo com a chave interna da etapa (ex.:
 * "etapa DELIVERED aguarda sua ação") sai reescrito com o nome traduzido;
 * os demais, como foram gravados.
 */
export function displaySubject(n: Row, t: Translate): string {
  if (n.kind) return n.subject;
  const stage = LEGACY_STAGE.exec(n.subject);
  if (stage && isStageKey(stage[2]))
    return t("notif.stage.subject", {
      n: stage[1],
      stage: t(`stage.${stage[2]}`),
    });
  const due = LEGACY_DUE.exec(n.subject);
  if (due && isStageKey(due[3]))
    return t(
      due[1] === "ATRASADO" ? "notif.overdue.subject" : "notif.due.subject",
      { n: due[2], stage: t(`stage.${due[3]}`) },
    );
  return n.subject;
}
