import { describe, expect, it } from "vitest";
import {
  MONEY_MAX_DIGITS,
  formatMoneyDigits,
  moneyDigits,
  moneyDigitsOfPaste,
  moneyDigitsOfValue,
  moneySeparators,
  moneyValueOfDigits,
} from "@/lib/money-mask";
import { parseNumberInput } from "@/lib/number-input";

/*
 * Preço digitado como numa caixa registradora (dono, 20/11/2026;
 * docs/PURCHASE_DEMAND.md, "Moeda e preço na cotação"): só números, a
 * vírgula das casas entra sozinha (4000 = 40,00), com o separador da moeda.
 */

const RMB = moneySeparators("RMB");
const BRL = moneySeparators("BRL");

/** O campo depois de cada tecla, como a tela faz (texto → números → texto). */
function typing(keys: string[], sep = RMB) {
  let text = "";
  return keys.map((key) => {
    const next = key === "Backspace" ? text.slice(0, -1) : text + key;
    text = formatMoneyDigits(moneyDigits(next), sep);
    return text;
  });
}

describe("máscara de preço (caixa registradora)", () => {
  it("a vírgula entra sozinha a cada número: 4000 vira 40.00", () => {
    expect(typing(["4", "0", "0", "0"])).toEqual([
      "0.04",
      "0.40",
      "4.00",
      "40.00",
    ]);
    // Apagar tira o último número.
    expect(typing(["4", "0", "0", "0", "Backspace", "Backspace"])).toEqual([
      "0.04",
      "0.40",
      "4.00",
      "40.00",
      "4.00",
      "0.40",
    ]);
    // Zero à esquerda não conta; apagar tudo deixa o campo vazio.
    expect(typing(["0", "5", "Backspace"])).toEqual(["", "0.05", ""]);
  });

  it("separador da moeda: Yuan e Dólar com ponto, Real e Euro com vírgula", () => {
    expect(moneySeparators("RMB")).toEqual({ decimal: ".", group: "," });
    expect(moneySeparators("cny")).toEqual({ decimal: ".", group: "," });
    expect(moneySeparators("USD")).toEqual({ decimal: ".", group: "," });
    expect(moneySeparators("BRL")).toEqual({ decimal: ",", group: "." });
    expect(moneySeparators("EUR")).toEqual({ decimal: ",", group: "." });
    expect(formatMoneyDigits("4000", RMB)).toBe("40.00");
    expect(formatMoneyDigits("4000", BRL)).toBe("40,00");
    expect(formatMoneyDigits("123456789", RMB)).toBe("1,234,567.89");
    expect(formatMoneyDigits("123456789", BRL)).toBe("1.234.567,89");
    expect(typing(["4", "0", "0", "0"], BRL)).toEqual([
      "0,04",
      "0,40",
      "4,00",
      "40,00",
    ]);
    expect(formatMoneyDigits("", RMB)).toBe("");
  });

  it("o que vai ao servidor é o número com ponto, lido igual pelo servidor", () => {
    expect(moneyValueOfDigits("4000")).toBe("40.00");
    expect(moneyValueOfDigits("5")).toBe("0.05");
    expect(moneyValueOfDigits("")).toBe("");
    for (const digits of ["5", "210", "4000", "123456789", "99999999999"])
      expect(parseNumberInput(moneyValueOfDigits(digits))).toBe(
        Number(digits) / 100,
      );
  });

  it("o preço gravado volta para o campo; texto colado vale como está escrito", () => {
    expect(moneyDigitsOfValue("2.1")).toBe("210");
    expect(moneyDigitsOfValue(2.1)).toBe("210");
    expect(moneyDigitsOfValue(40)).toBe("4000");
    expect(moneyDigitsOfValue(null)).toBe("");
    expect(moneyDigitsOfValue("")).toBe("");
    expect(moneyDigitsOfValue("abc")).toBe("");
    expect(moneyDigitsOfPaste("40,50")).toBe("4050");
    expect(moneyDigitsOfPaste("US$ 1,234.56")).toBe("123456");
    expect(moneyDigitsOfPaste("R$ 1.234,56")).toBe("123456");
    expect(moneyDigitsOfPaste("4000")).toBe("400000");
  });

  it("o limite de números: o que passa não entra", () => {
    const max = "9".repeat(MONEY_MAX_DIGITS);
    expect(moneyDigits(`${max}1`)).toBe(max);
    expect(formatMoneyDigits(max, RMB)).toBe("999,999,999.99");
  });
});
