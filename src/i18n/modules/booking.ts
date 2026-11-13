/**
 * Dicionário do módulo "booking" (docs/BOOKING.md, "Booking por planilha"):
 * o menu e o sinal da análise do Superplan nos itens. Mesmas chaves em pt, en
 * e zh.
 */
export const pt = {
  "nav.booking": "Book",
  "booking.signal.viable": "Viável",
  "booking.signal.below": "Abaixo da meta",
  "booking.signal.loss": "Prejuízo",
  "booking.signal.missing": "Falta dado",
  "booking.signal.none": "Sem análise",
};

export const en: Record<keyof typeof pt, string> = {
  "nav.booking": "Book",
  "booking.signal.viable": "Viable",
  "booking.signal.below": "Below target",
  "booking.signal.loss": "Loss",
  "booking.signal.missing": "Missing data",
  "booking.signal.none": "Not analyzed",
};

export const zh: Record<keyof typeof pt, string> = {
  "nav.booking": "Book",
  "booking.signal.viable": "可行",
  "booking.signal.below": "低于目标",
  "booking.signal.loss": "亏损",
  "booking.signal.missing": "缺少数据",
  "booking.signal.none": "未分析",
};
