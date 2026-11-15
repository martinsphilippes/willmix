import type { Translate } from "@/i18n";
import {
  CONTACT_ROLES,
  OPERATION_TYPES,
  SALE_FORMATS,
  WELLMIX_TIERS,
} from "@/lib/order-terms";
import type { RequestOrderTermsLabels } from "./request-order-terms";
import type { RequestCustomerContactsLabels } from "./request-customer-contacts";

const record = <K extends string>(
  keys: readonly K[],
  text: (key: K) => string,
): Record<K, string> =>
  Object.fromEntries(keys.map((k) => [k, text(k)])) as Record<K, string>;

/** Textos das condições do pedido (docs/ORDER_TERMS.md), no idioma de quem vê. */
export function orderTermsLabels(t: Translate): RequestOrderTermsLabels {
  return {
    title: t("orderTerms.title"),
    hint: t("orderTerms.hint"),
    operationType: t("orderTerms.operationType"),
    operation: record(OPERATION_TYPES, (k) => t(`orderTerms.operation.${k}`)),
    saleFormat: t("orderTerms.saleFormat"),
    format: record(SALE_FORMATS, (k) => t(`orderTerms.format.${k}`)),
    tier: t("orderTerms.tier"),
    tierChoose: t("orderTerms.tierChoose"),
    tiers: record(WELLMIX_TIERS, (k) => t(`orderTerms.tier.${k}`)),
    delivery: t("orderTerms.delivery"),
    carrier: t("orderTerms.carrier"),
    carrierNone: t("orderTerms.carrierNone"),
    redispatch: t("orderTerms.redispatch"),
    redispatchNone: t("orderTerms.redispatchNone"),
    carrierSankhya: t("orderTerms.carrierSankhya"),
    carrierSankhyaOff: t("orderTerms.carrierSankhyaOff"),
    carrierSankhyaError: t("orderTerms.carrierSankhyaError"),
    country: t("orderTerms.country"),
    countryChoose: t("orderTerms.countryChoose"),
    countryUnknown: t("orderTerms.countryUnknown"),
    group: t("orderTerms.group"),
    groupChoose: t("orderTerms.groupChoose"),
    groupPickCountry: t("orderTerms.groupPickCountry"),
    groupNone: t("orderTerms.groupNone"),
    originHint: t("orderTerms.originHint"),
    loading: t("orderTerms.loading"),
    error: t("orderTerms.error"),
    productsCount: t("orderTerms.productsCount", { n: "{n}" }),
    stock: t("orderTerms.stock"),
    disclaimerTitle: t("orderTerms.disclaimerTitle"),
    disclaimer: t("orderTerms.disclaimer"),
  };
}

/** Textos do bloco do cliente (contatos), no idioma de quem vê. */
export function customerContactsLabels(
  t: Translate,
): RequestCustomerContactsLabels {
  return {
    title: t("customerContacts.title"),
    intro: t("customerContacts.intro"),
    pick: t("customerContacts.pick"),
    stock: t("customerContacts.stock"),
    loading: t("customerContacts.loading"),
    error: t("customerContacts.error"),
    blind: t("customerContacts.blind"),
    known: t("customerContacts.known"),
    updated: t("customerContacts.updated", { date: "{date}", name: "{name}" }),
    edit: t("customerContacts.edit"),
    cancel: t("customerContacts.cancel"),
    phone: t("customerContacts.phone"),
    email: t("customerContacts.email"),
    rule: t("customerContacts.rule"),
    roles: record(CONTACT_ROLES, (k) => t(`customerContacts.role.${k}`)),
  };
}
