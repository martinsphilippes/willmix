import {
  ROLES,
  STAGE_KEYS,
  type Notification,
  type NotificationActor,
  type NotificationKind,
  type StageKey,
} from "@/lib/db/schema";
import type { Translate } from "@/i18n";

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

export function notificationKind(n: Row): NotificationKind {
  if (n.kind) return n.kind;
  const s = n.subject.toLowerCase();
  if (LEGACY_ALERT.some((w) => s.includes(w))) return "alert";
  if (LEGACY_ACTION.some((w) => s.includes(w))) return "action";
  return "info";
}

const ACTORS = new Set<string>(["recipient", "wellmix", ...ROLES]);

/** Com quem está o assunto. Aviso antigo que cobrava algo: com quem recebeu. */
export function notificationActor(n: Row): NotificationActor | null {
  if (n.actor) return ACTORS.has(n.actor) ? n.actor : null;
  if (n.kind) return null;
  const kind = notificationKind(n);
  return kind === "action" || kind === "alert" ? "recipient" : null;
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
