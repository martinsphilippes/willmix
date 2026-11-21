import type { FxRates } from "@/lib/pricing";

/*
 * Conversão de um valor quando a moeda do campo muda (dono, 21/11/2026): pelo
 * câmbio do dia do portal (R$ por unidade de cada moeda; `getFxRates`, a PTAX
 * do Banco Central e as fontes de reserva), passando pelo Real. O Yuan aparece
 * como CNY nas telas e como RMB no câmbio. Sem câmbio de uma das moedas, não
 * converte (o valor fica como estava): nunca um número inventado.
 */

/** Situação do câmbio (a mesma de `getFxRates`). */
export type FxPayloadStatus = "today" | "stale" | "manual" | "none";

/** Textos do aviso, no idioma de quem usa (vêm do servidor com o câmbio). */
export interface FxLabels {
  /** "Convertido de {amount} · câmbio de {day}" */
  converted: string;
  /** "Convertido de {amount} · câmbio manual das Configurações" */
  convertedManual: string;
  /** "Manter {amount}" */
  keep: string;
  /** "Manter os valores digitados" */
  keepAll: string;
  /** "Sem câmbio para converter: o valor ficou igual." */
  none: string;
}

/** O que `/api/fx` devolve. */
export interface FxPayload {
  rates: FxRates;
  status: FxPayloadStatus;
  /** Dia do câmbio usado (AAAA-MM-DD); manual ou sem câmbio: null. */
  day: string | null;
  labels: FxLabels;
}

/** Código da moeda no câmbio: CNY e RMB são a mesma moeda. */
function fxCode(code: string) {
  const c = code.trim().toUpperCase();
  return c === "CNY" ? "RMB" : c;
}

/** Mesma moeda (CNY = RMB, sem diferença de maiúsculas). */
export function sameCurrency(a: string, b: string) {
  return fxCode(a) === fxCode(b);
}

/** R$ por unidade da moeda (Real = 1); sem câmbio: null. */
export function fxRateOf(code: string, rates: FxRates): number | null {
  const c = fxCode(code);
  if (!c) return null;
  if (c === "BRL") return 1;
  const rate = rates[c as keyof FxRates];
  return typeof rate === "number" && Number.isFinite(rate) && rate > 0
    ? rate
    : null;
}

/**
 * Valor em `from` → valor em `to`, arredondado às casas do campo. Sem câmbio
 * de uma das moedas, valor inválido ou moedas vazias: null.
 */
export function convertAmount(
  amount: number,
  from: string,
  to: string,
  rates: FxRates,
  decimals: number,
): number | null {
  if (!Number.isFinite(amount)) return null;
  if (sameCurrency(from, to)) return amount;
  const a = fxRateOf(from, rates);
  const b = fxRateOf(to, rates);
  if (a === null || b === null) return null;
  const k = 10 ** decimals;
  return Math.round(((amount * a) / b) * k) / k;
}

/** AAAA-MM-DD → dd/mm/aaaa. */
export function fxDay(day: string | null) {
  return day && /^\d{4}-\d{2}-\d{2}$/.test(day)
    ? `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}`
    : "";
}

/** Texto do aviso de conversão ("Convertido de US$ 1,0194 · câmbio de 21/11/2026"). */
export function convertedText(payload: FxPayload, amountText: string) {
  const template =
    payload.status === "manual" || !payload.day
      ? payload.labels.convertedManual
      : payload.labels.converted;
  return template
    .replaceAll("{amount}", amountText)
    .replaceAll("{day}", fxDay(payload.day));
}
