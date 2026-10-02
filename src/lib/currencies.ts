/**
 * Moedas com que a Wellmix trabalha. Lista única: telas (CurrencySelect) e
 * validação no servidor usam esta mesma lista.
 */
export const CURRENCIES = ["BRL", "CNY", "USD", "EUR"] as const;
export type Currency = (typeof CURRENCIES)[number];

export function isCurrency(value: unknown): value is Currency {
  return (
    typeof value === "string" &&
    (CURRENCIES as readonly string[]).includes(value)
  );
}

/** Valor do formulário para moeda aceita; RMB (planilha) vira CNY. Inválido: erro. */
export function parseCurrency(raw: unknown, fallback?: Currency): Currency {
  const value = String(raw ?? "")
    .trim()
    .toUpperCase();
  if (!value && fallback) return fallback;
  const normalized = value === "RMB" ? "CNY" : value;
  if (isCurrency(normalized)) return normalized;
  throw new Error("invalid_currency");
}
