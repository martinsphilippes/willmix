/**
 * SLA de resposta da cotação: a Wellmix define em Configurações quantos dias
 * úteis tem para responder uma solicitação; o prazo vira o `deadline` da
 * solicitação (tarefa da Wellmix, Control Tower). Dias úteis = segunda a sexta,
 * contados a partir de hoje no horário de Brasília (sem calendário de feriados).
 */

export const QUOTE_SLA_MIN_DAYS = 1;
export const QUOTE_SLA_MAX_DAYS = 60;

/** Data de hoje (AAAA-MM-DD) no fuso de Brasília. */
function todayInBrazil(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Soma dias úteis (seg–sex) a uma data AAAA-MM-DD. */
export function addBusinessDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  let left = Math.max(0, Math.floor(days));
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const weekday = d.getUTCDay();
    if (weekday !== 0 && weekday !== 6) left--;
  }
  return d.toISOString().slice(0, 10);
}

/** Prazo de resposta de uma solicitação criada agora. */
export function quoteSlaDeadline(days: number, now = new Date()): string {
  return addBusinessDays(todayInBrazil(now), days);
}
