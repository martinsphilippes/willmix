import { describe, expect, it } from "vitest";
import {
  convertAmount,
  convertedText,
  fxDay,
  fxRateOf,
  sameCurrency,
  type FxPayload,
} from "@/lib/fx-convert";
import { en, pt, zh } from "@/i18n/modules/money-fx";

/*
 * Conversão do valor ao trocar a moeda (dono, 21/11/2026): pelo câmbio do dia
 * do portal (R$ por unidade), passando pelo Real; Yuan é CNY nas telas e RMB
 * no câmbio; sem câmbio de uma das moedas, nada é convertido.
 */
const rates = { USD: 5.5, RMB: 0.78, EUR: 6 };

const labels = {
  converted: pt["moneyFx.converted"],
  convertedManual: pt["moneyFx.convertedManual"],
  keep: pt["moneyFx.keep"],
  keepAll: pt["moneyFx.keepAll"],
  none: pt["moneyFx.none"],
};

describe("câmbio de cada moeda", () => {
  it("Real vale 1; CNY e RMB são o Yuan; sem câmbio ou moeda vazia, null", () => {
    expect(fxRateOf("BRL", rates)).toBe(1);
    expect(fxRateOf("usd", rates)).toBe(5.5);
    expect(fxRateOf("CNY", rates)).toBe(0.78);
    expect(fxRateOf("RMB", rates)).toBe(0.78);
    expect(fxRateOf("EUR", {})).toBeNull();
    expect(fxRateOf("", rates)).toBeNull();
    expect(fxRateOf("USD", { USD: 0 })).toBeNull();
    expect(sameCurrency("CNY", "rmb")).toBe(true);
    expect(sameCurrency("USD", "BRL")).toBe(false);
  });
});

describe("conversão do valor", () => {
  it("passa pelo Real e arredonda às casas do campo", () => {
    // US$ 1,0194 × 5,5 = R$ 5,6067
    expect(convertAmount(1.0194, "USD", "BRL", rates, 4)).toBe(5.6067);
    // US$ 1,0194 → ¥: 1,0194 × 5,5 ÷ 0,78 = 7,18808 → 7,1881
    expect(convertAmount(1.0194, "USD", "CNY", rates, 4)).toBe(7.1881);
    // R$ 100 → US$ 18,18 (duas casas)
    expect(convertAmount(100, "BRL", "USD", rates, 2)).toBe(18.18);
    // ¥ 40 → € 5,20
    expect(convertAmount(40, "RMB", "EUR", rates, 2)).toBe(5.2);
  });

  it("mesma moeda não muda; sem câmbio ou valor inválido, null (nunca inventa)", () => {
    expect(convertAmount(12.5, "CNY", "RMB", rates, 2)).toBe(12.5);
    expect(convertAmount(10, "USD", "EUR", { USD: 5.5 }, 2)).toBeNull();
    expect(convertAmount(10, "", "USD", rates, 2)).toBeNull();
    expect(convertAmount(Number.NaN, "USD", "BRL", rates, 2)).toBeNull();
  });
});

describe("aviso da conversão", () => {
  const payload: FxPayload = {
    rates,
    status: "today",
    day: "2026-11-21",
    labels,
  };

  it("com o dia do câmbio; manual sem dia", () => {
    expect(fxDay("2026-11-21")).toBe("21/11/2026");
    expect(fxDay(null)).toBe("");
    expect(convertedText(payload, "US$ 1,0194")).toBe(
      "Convertido de US$ 1,0194 · câmbio de 21/11/2026",
    );
    expect(
      convertedText({ ...payload, status: "manual", day: null }, "¥ 40.00"),
    ).toBe("Convertido de ¥ 40.00 · câmbio manual das Configurações");
    // O último câmbio obtido (stale) também diz o dia.
    expect(
      convertedText(
        { ...payload, status: "stale", day: "2026-11-19" },
        "€ 5,20",
      ),
    ).toBe("Convertido de € 5,20 · câmbio de 19/11/2026");
  });

  it("os textos existem nos três idiomas, com os mesmos marcadores", () => {
    for (const dict of [en, zh]) {
      expect(Object.keys(dict).sort()).toEqual(Object.keys(pt).sort());
      expect(dict["moneyFx.converted"]).toContain("{amount}");
      expect(dict["moneyFx.converted"]).toContain("{day}");
      expect(dict["moneyFx.keep"]).toContain("{amount}");
    }
  });
});
