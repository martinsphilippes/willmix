/**
 * Booking por planilha: o aviso das células que gravam sozinhas (gravando,
 * gravado, não gravou). Mesmas chaves em pt, en e zh.
 */
export const pt = {
  "booking.row.saving": "Gravando…",
  "booking.row.saved": "Gravado ✓",
  "booking.row.failed": "Não gravou. Tente de novo.",
};

export const en: Record<keyof typeof pt, string> = {
  "booking.row.saving": "Saving…",
  "booking.row.saved": "Saved ✓",
  "booking.row.failed": "Not saved. Try again.",
};

export const zh: Record<keyof typeof pt, string> = {
  "booking.row.saving": "保存中…",
  "booking.row.saved": "已保存 ✓",
  "booking.row.failed": "未保存，请重试。",
};
