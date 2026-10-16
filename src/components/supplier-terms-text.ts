import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  PAYMENT_TERM_BASES,
  type PaymentTermBase,
  type PaymentTermInstallment,
} from "@/lib/db/schema";
import type { InstallmentStatus } from "@/lib/supplier-terms";
import type { PaymentTermsTexts } from "./payment-terms-editor";
import { formatDate, type Tone } from "./ui";

/** Cor da situação de cada parcela. */
export const INSTALLMENT_TONE: Record<InstallmentStatus, Tone> = {
  received: "success",
  paid: "success",
  requested: "info",
  overdue: "danger",
  due_soon: "warning",
  scheduled: "neutral",
  waiting: "neutral",
  cancelled: "neutral",
};

/** Dia AAAA-MM-DD na data do idioma (meio-dia UTC: não troca de dia por fuso). */
export const formatDay = (day: string | null, t: Translate) =>
  day ? formatDate(`${day}T12:00:00Z`, t) : "—";

/** "na data do pedido", "90 dias após a entrega ao cliente"… */
export function termWhen(t: Translate, base: PaymentTermBase, days: number) {
  return days === 0
    ? t(`payTerms.when.${base}.0` as DictionaryKey)
    : t(`payTerms.when.${base}` as DictionaryKey, { days });
}

/** "30% na data do pedido + 70% 90 dias após a entrega ao cliente" */
export function describeTerms(t: Translate, terms: PaymentTermInstallment[]) {
  return terms
    .map(
      (term) =>
        `${term.percent.toLocaleString(t.intl, { maximumFractionDigits: 2 })}% ${termWhen(t, term.base, term.days)}`,
    )
    .join(" + ");
}

/** Textos do editor de parcelas (componente do navegador). */
export function paymentTermsTexts(t: Translate): PaymentTermsTexts {
  const byBase = <T>(fn: (base: PaymentTermBase) => T) =>
    Object.fromEntries(PAYMENT_TERM_BASES.map((b) => [b, fn(b)])) as Record<
      PaymentTermBase,
      T
    >;
  return {
    percent: t("payTerms.percent"),
    base: t("payTerms.base"),
    days: t("payTerms.days"),
    add: t("payTerms.add"),
    remove: t("payTerms.remove", { n: "{n}" }),
    sum: t("payTerms.sum", { sum: "{sum}" }),
    sumOff: t("payTerms.sumOff", { sum: "{sum}" }),
    presets: t("payTerms.presets"),
    save: t("payTerms.save"),
    installment: t("payTerms.installment", { n: "{n}", count: "{count}" }),
    baseLabels: byBase((b) => t(`payTerms.base.${b}` as DictionaryKey)),
    when: byBase((b) => ({
      zero: t(`payTerms.when.${b}.0` as DictionaryKey),
      days: t(`payTerms.when.${b}` as DictionaryKey, { days: "{days}" }),
    })),
  };
}
