import { parseNumberInput } from "./number-input";

/*
 * Preço digitado como numa caixa registradora (dono, 20/11/2026;
 * docs/PURCHASE_DEMAND.md, "Moeda e preço na cotação"): a pessoa digita só os
 * números e a vírgula das casas decimais entra sozinha, no lugar certo, a cada
 * número (4 → 0.04, 40 → 0.40, 400 → 4.00, 4000 → 40.00). O separador é o da
 * moeda: Yuan e Dólar com ponto decimal (1,234.56); Real e Euro com vírgula
 * (1.234,56). Sem Intl: o mesmo resultado no navegador e nos testes.
 */

export interface MoneySeparators {
  decimal: "." | ",";
  group: "," | ".";
}

const DOT: MoneySeparators = { decimal: ".", group: "," };
const COMMA: MoneySeparators = { decimal: ",", group: "." };

/** Separadores da moeda: Real e Euro com vírgula decimal; Yuan (RMB), Dólar e as outras com ponto. */
export function moneySeparators(
  currency: string | null | undefined,
): MoneySeparators {
  const code = (currency ?? "").trim().toUpperCase();
  return code === "BRL" || code === "EUR" ? COMMA : DOT;
}

/** Dígitos no máximo: até 999.999.999,99 com duas casas. */
export const MONEY_MAX_DIGITS = 11;

/**
 * Só os números do que está no campo, sem zeros à esquerda; o que passar do
 * limite é ignorado (o número a mais não entra).
 */
export function moneyDigits(text: string, maxDigits = MONEY_MAX_DIGITS) {
  return text.replace(/\D/g, "").replace(/^0+/, "").slice(0, maxDigits);
}

function split(digits: string, decimals: number) {
  const padded = digits.padStart(decimals + 1, "0");
  return {
    int: padded.slice(0, padded.length - decimals),
    frac: padded.slice(padded.length - decimals),
  };
}

/** Números → texto do campo, com a vírgula no lugar: "4000" → "40.00" (Yuan) ou "40,00" (Real). */
export function formatMoneyDigits(
  digits: string,
  sep: MoneySeparators,
  decimals = 2,
) {
  if (!digits) return "";
  const { int, frac } = split(digits, decimals);
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, sep.group);
  return decimals > 0 ? `${grouped}${sep.decimal}${frac}` : grouped;
}

/** Números → valor que vai ao servidor, com ponto: "4000" → "40.00". */
export function moneyValueOfDigits(digits: string, decimals = 2) {
  if (!digits) return "";
  const { int, frac } = split(digits, decimals);
  return decimals > 0 ? `${int}.${frac}` : int;
}

/** Valor gravado ("2.1" ou 2.1) → números do campo ("210"); vazio ou inválido → "". */
export function moneyDigitsOfValue(
  value: number | string | null | undefined,
  decimals = 2,
) {
  if (value === null || value === undefined || value === "") return "";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return "";
  return moneyDigits(Math.round(n * 10 ** decimals).toString());
}

/**
 * Texto colado no campo: vale o número como está escrito ("40,50", "US$
 * 1,234.56", "4000" = quatro mil), não a digitação número a número. O que não
 * dá para ler como número fica só com os números, como na digitação.
 */
export function moneyDigitsOfPaste(text: string, decimals = 2) {
  const n = parseNumberInput(text.replace(/[^\d.,]/g, ""));
  return n !== null && Number.isFinite(n)
    ? moneyDigitsOfValue(n, decimals)
    : moneyDigits(text);
}
