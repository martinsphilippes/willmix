import type { Translate } from "@/i18n";
import { errorTextFor } from "@/i18n/error-text";
import type { Tone } from "@/components/ui";
import type { Standing } from "@/lib/services/portfolio";

/** Cor da situação do cliente na carteira. */
export const STANDING_TONE: Record<Standing, Tone> = {
  overdue: "danger",
  never: "warning",
  due_soon: "info",
  ok: "success",
};

/** Texto do erro de uma ação da carteira (?error=<código>). */
export function portfolioError(t: Translate, error: unknown): string | null {
  return typeof error === "string" && error
    ? errorTextFor(t, error.slice(0, 60), [
        "portfolio.error",
        "catalog.error",
        "settings.error",
      ])
    : null;
}

const TZ = "America/Sao_Paulo";

/** Data e hora em Brasília, no idioma da tela. */
export function dateTimeBr(t: Translate, iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(t.intl, {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/** Data (sem hora) em Brasília, no idioma da tela. */
export function dateBr(t: Translate, iso: string | null | undefined) {
  if (!iso) return "—";
  // Dia puro (AAAA-MM-DD): meio-dia UTC cai no mesmo dia em Brasília.
  const d = new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00Z` : iso,
  );
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(t.intl, {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

/** "AAAA-MM-DDTHH:MM" em Brasília (valor do campo de data e hora). */
export function brasiliaLocal(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** O instante atual (fora do render dos componentes). */
export const currentTime = () => new Date();
