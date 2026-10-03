import { CURRENCIES, isCurrency, type Currency } from "@/lib/currencies";

/*
 * Requisitos de dinheiro (custos previstos e realizados do desembaraço):
 * moeda escolhida + valor, guardados no `value` do requisito como
 * "BRL 1234.56" (código ISO, espaço, valor com ponto). O tipo no esquema
 * continua "number": um valor antigo só numérico segue válido e aparece como
 * foi digitado.
 */
export const MONEY_REQUIREMENT_KEYS = ["estimated_costs", "actual_costs"];

export function isMoneyRequirement(r: { key: string; type: string }) {
  return r.type === "number" && MONEY_REQUIREMENT_KEYS.includes(r.key);
}

export const CURRENCY_SYMBOL: Record<Currency, string> = {
  BRL: "R$",
  CNY: "¥",
  USD: "US$",
  EUR: "€",
};

export interface MoneyValue {
  currency: Currency;
  amount: number;
}

/** "BRL 1234.56" → { currency, amount }; qualquer outra coisa → null. */
export function parseMoneyValue(
  value: string | null | undefined,
): MoneyValue | null {
  const m = /^([A-Z]{3}) (-?\d+(?:\.\d+)?)$/.exec((value ?? "").trim());
  if (!m || !isCurrency(m[1])) return null;
  const amount = Number(m[2]);
  return Number.isFinite(amount) ? { currency: m[1], amount } : null;
}

export function moneyValue(currency: Currency, amount: number) {
  return `${currency} ${amount.toFixed(2)}`;
}

/**
 * Valor digitado pela pessoa ("1.234,56", "1234.56", "1 234,5") → número.
 * Vírgula como decimal quando aparece; senão ponto. Inválido → null.
 */
export function parseAmount(raw: string, decimals = 2): number | null {
  const s = raw.replace(/\s|[A-Za-z$€¥]/g, "");
  if (!s) return null;
  const normalized = s.includes(",")
    ? s.replace(/\./g, "").replace(",", ".")
    : s;
  const n = Number(normalized);
  const k = 10 ** decimals;
  return Number.isFinite(n) && n >= 0 ? Math.round(n * k) / k : null;
}

/** "BRL 1234.56" → "R$ 1.234,56"; valor antigo ou texto livre → como está. */
export function formatMoneyValue(value: string | null | undefined) {
  const money = parseMoneyValue(value);
  if (!money) return value ?? "";
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: money.currency,
    }).format(money.amount);
  } catch {
    return `${CURRENCY_SYMBOL[money.currency]} ${money.amount.toFixed(2)}`;
  }
}

export { CURRENCIES };
