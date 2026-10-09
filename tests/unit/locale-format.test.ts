import { describe, expect, it } from "vitest";
import { translator } from "@/i18n";
import { formatDate, formatMoney, intlOf } from "@/components/ui";
import {
  formatNumber,
  formatPercent,
} from "@/app/app/containers/_components/shared";
import { formatMoneyValue } from "@/lib/workflow/money";
import {
  formatMoneyText,
  normalizeMoneyText,
  parseMoneyText,
} from "@/components/money-input";

/** Intl usa espaço inseparável entre símbolo e valor; comparamos com espaço comum. */
const plain = (s: string) => s.replace(/\u00a0/g, " ");

/** Datas, números e moedas seguem o idioma escolhido (pt-BR, en-US, zh-CN). */
describe("formatação no idioma do usuário", () => {
  it("translator expõe a tag Intl do idioma", () => {
    expect(translator("pt").intl).toBe("pt-BR");
    expect(translator("en").intl).toBe("en-US");
    expect(translator("zh").intl).toBe("zh-CN");
    expect(translator("zh").locale).toBe("zh");
  });

  it("intlOf aceita t, tag direta ou nada (pt-BR)", () => {
    expect(intlOf(translator("en"))).toBe("en-US");
    expect(intlOf("zh-CN")).toBe("zh-CN");
    expect(intlOf(undefined)).toBe("pt-BR");
  });

  it("formatDate muda a ordem dia/mês/ano por idioma", () => {
    const iso = "2026-03-09T12:00:00.000Z";
    expect(formatDate(iso, translator("pt"))).toBe("09/03/2026");
    expect(formatDate(iso, "en-US")).toBe("03/09/2026");
    expect(formatDate(iso, "zh-CN")).toBe("2026/03/09");
    expect(formatDate(null, "en-US")).toBe("—");
  });

  it("formatMoney usa separadores do idioma", () => {
    expect(plain(formatMoney(1234.5, "USD", translator("pt")))).toBe(
      "US$ 1.234,50",
    );
    expect(formatMoney(1234.5, "USD", "en-US")).toBe("$1,234.50");
    expect(formatMoney(1234.5, "CNY", "zh-CN")).toBe("¥1,234.50");
  });

  it("números e percentuais das telas de container seguem o idioma", () => {
    expect(formatNumber(1234.567, "pt-BR")).toBe("1.234,567");
    expect(formatNumber(1234.567, "en-US")).toBe("1,234.567");
    expect(formatPercent(42.55, "en-US")).toBe("42.6%");
    expect(formatPercent(42.55, "pt-BR")).toBe("42,6%");
  });

  it("valor monetário salvo como texto é exibido no idioma", () => {
    expect(formatMoneyValue("USD 1500.25", "en-US")).toBe("$1,500.25");
    expect(plain(formatMoneyValue("USD 1500.25", "pt-BR"))).toBe(
      "US$ 1.500,25",
    );
  });

  it("campo de valor entende o que o usuário digita no idioma dele", () => {
    // Os dois separadores: o último é o decimal, em qualquer idioma.
    expect(normalizeMoneyText("1.234,56", "pt-BR")).toBe("1234.56");
    expect(normalizeMoneyText("1,234.56", "pt-BR")).toBe("1234.56");
    expect(normalizeMoneyText("1.234,56", "en-US")).toBe("1234.56");
    expect(normalizeMoneyText("1,234.56", "zh-CN")).toBe("1234.56");
    // pt-BR: vírgula decimal; ponto sozinho fica como está (2.35 → 2.35).
    expect(normalizeMoneyText("1234,5", "pt-BR")).toBe("1234.5");
    expect(normalizeMoneyText("2.35", "pt-BR")).toBe("2.35");
    // en-US / zh-CN: vírgula é milhar, salvo "1,5" (hábito brasileiro).
    expect(normalizeMoneyText("1,234", "en-US")).toBe("1234");
    expect(normalizeMoneyText("1,234,567", "zh-CN")).toBe("1234567");
    expect(normalizeMoneyText("1,5", "en-US")).toBe("1.5");
    expect(normalizeMoneyText("R$ 10", "pt-BR")).toBe("10");
    expect(normalizeMoneyText("", "en-US")).toBe("");
  });

  it("campo de valor: o que é mostrado volta ao mesmo número ao sair do campo", () => {
    for (const loc of ["pt-BR", "en-US", "zh-CN"])
      for (const [n, d] of [
        [1234.5, 2],
        [28000, 2],
        [1234567.89, 2],
        [0.5, 2],
        [1234.5678, 4],
        [1235, 0],
      ] as const) {
        const shown = formatMoneyText(n, d, loc);
        expect(parseMoneyText(shown, loc, d), `${loc} ${shown}`).toBe(n);
      }
  });

  it("campo de valor: leitura ao sair do campo segue o idioma", () => {
    expect(parseMoneyText("1,234.56", "en-US")).toBe(1234.56);
    expect(parseMoneyText("28,000.00", "zh-CN")).toBe(28000);
    expect(parseMoneyText("1,234.56", "pt-BR")).toBe(1234.56);
    expect(parseMoneyText("1.234,56", "en-US")).toBe(1234.56);
    expect(parseMoneyText("1.234.567", "pt-BR")).toBe(1234567);
    expect(parseMoneyText("2.35", "pt-BR")).toBe(2.35);
    expect(parseMoneyText("1.235", "pt-BR", 0)).toBe(1235);
    expect(parseMoneyText("1,235", "en-US", 0)).toBe(1235);
    expect(parseMoneyText("-5", "pt-BR")).toBeNull();
    expect(parseMoneyText("abc", "en-US")).toBeNull();
    expect(parseMoneyText("1.2.3,4.5", "pt-BR")).toBeNull();
  });
});
