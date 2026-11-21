/**
 * Dicionário do módulo "moneyFx": conversão do valor ao trocar a moeda do
 * campo (dono, 21/11/2026; `src/lib/fx-convert.ts`, `/api/fx`).
 */
export const pt = {
  "moneyFx.converted": "Convertido de {amount} · câmbio de {day}",
  "moneyFx.convertedManual":
    "Convertido de {amount} · câmbio manual das Configurações",
  "moneyFx.keep": "Manter {amount}",
  "moneyFx.keepAll": "Manter os valores digitados",
  "moneyFx.none": "Sem câmbio para converter: o valor ficou igual.",
};

export const en: Record<keyof typeof pt, string> = {
  "moneyFx.converted": "Converted from {amount} · rate of {day}",
  "moneyFx.convertedManual":
    "Converted from {amount} · manual rate in Settings",
  "moneyFx.keep": "Keep {amount}",
  "moneyFx.keepAll": "Keep the typed values",
  "moneyFx.none": "No exchange rate to convert: the value was kept.",
};

export const zh: Record<keyof typeof pt, string> = {
  "moneyFx.converted": "由 {amount} 换算 · {day} 汇率",
  "moneyFx.convertedManual": "由 {amount} 换算 · 设置中的手动汇率",
  "moneyFx.keep": "保留 {amount}",
  "moneyFx.keepAll": "保留输入的数值",
  "moneyFx.none": "没有可用的汇率：数值未换算。",
};
