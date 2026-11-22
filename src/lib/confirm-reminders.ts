import type { ConfirmReminders } from "@/lib/order-terms";

/*
 * Lembrete da confirmação do cliente (dono, 22/11/2026; docs/ORDER_TERMS.md,
 * "Lembrete da confirmação"). Regras puras, usadas pelo job diário e pelos
 * testes: um lembrete por dia enquanto a encomenda espera o cliente, até o
 * limite das Configurações (`customerConfirmReminderMax`, padrão 3); com o
 * último, o vendedor que lançou a encomenda é avisado uma vez.
 */

/**
 * Intervalo mínimo entre o envio (ou o último lembrete) e o próximo. O job
 * roda uma vez por dia; 20 h dão folga ao horário em que ele roda.
 */
export const CONFIRM_REMINDER_GAP_MS = 20 * 3_600_000;

/**
 * O que o job faz com a encomenda hoje: esperar (ainda não deu o intervalo),
 * lembrar, lembrar pela última vez (e avisar o vendedor) ou nada (acabou o
 * limite ou os lembretes estão desligados).
 */
export type ConfirmReminderStep = "wait" | "remind" | "remind_last" | "done";

export function confirmReminderStep(input: {
  /** Quando a encomenda foi para o cliente (criada ou refeita na edição). */
  sentAt: string;
  reminders: ConfirmReminders | null | undefined;
  max: number;
  now: Date;
}): ConfirmReminderStep {
  const { reminders, max, now } = input;
  const count = reminders?.count ?? 0;
  if (max <= 0 || count >= max) return "done";
  const since = Date.parse(reminders?.lastAt ?? input.sentAt);
  if (!Number.isFinite(since)) return "done";
  if (now.getTime() - since < CONFIRM_REMINDER_GAP_MS) return "wait";
  return count + 1 >= max ? "remind_last" : "remind";
}
