import "server-only";

import { getStore } from "@/lib/db";

/**
 * Decisões em aberto parametrizadas (docs/OPEN_DECISIONS.md).
 * Valores padrão aqui; sobrescritos pela tabela `settings` (tela de configurações).
 */
export const DEFAULT_SETTINGS = {
  customerCanCreateRequest: true,
  wellmixCanCreateRequest: true,
  /** CUSTOMER | WELLMIX | BOTH: quem confirma o recebimento da entrega. */
  deliveryConfirmationMode: "BOTH" as "CUSTOMER" | "WELLMIX" | "BOTH",
  agencyValidationEnabled: true,
  /** Tolerância de divergência de peso entre preparação e inspeção (%). */
  weightTolerancePercent: 3,
  paymentMode: "MANUAL" as const,
  sankhyaMode: "MOCK" as "MOCK" | "MANUAL",
  whatsappMode: "MOCK" as const,
  emailMode: "MOCK" as const,
  quotationExpirationDays: 15,
  /** Percentual do sinal cobrado do cliente. */
  downPaymentPercent: 30,
  /** Prazos padrão por etapa, em dias. */
  stageDueDays: {
    ORDER_CREATED: 1,
    PREPARATION: 15,
    SUPPLIER_PAYMENT: 5,
    PACKAGING: 7,
    INSPECTION: 5,
    SHIPPING: 10,
    CUSTOMS: 15,
    TRANSPORT: 7,
    DELIVERED: 3,
    CLOSED: 0,
  } as Record<string, number>,
  /** Dias para lembrar antes do vencimento e depois. */
  reminderDaysBeforeDue: 1,
};

export type Settings = typeof DEFAULT_SETTINGS;
export type SettingKey = keyof Settings;

export async function getSettings(): Promise<Settings> {
  const rows = await getStore().list("settings");
  const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    if (row.key in DEFAULT_SETTINGS) merged[row.key] = row.value;
  }
  return merged as Settings;
}

export async function setSetting<K extends SettingKey>(
  key: K,
  value: Settings[K],
) {
  const store = getStore();
  const [existing] = await store.list("settings", {
    filter: { key },
    limit: 1,
  });
  if (existing) await store.update("settings", existing.id, { value });
  else await store.create("settings", { key, value });
}
