import type { Translate } from "@/i18n";
import {
  CONTACT_ROLES,
  OPERATION_TYPES,
  SALE_FORMATS,
  WELLMIX_TIERS,
} from "@/lib/order-terms";
import type { RequestOrderTermsLabels } from "./request-order-terms";
import type { RequestCustomerContactsLabels } from "./request-customer-contacts";
import type { ContainerCompositionLabels } from "./container-composition";
import type { CustomerOrderConfirmLabels } from "./customer-order-confirm";

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
    operationDisabled: t("orderTerms.operationDisabled"),
    saleFormat: t("orderTerms.saleFormat"),
    format: record(SALE_FORMATS, (k) => t(`orderTerms.format.${k}`)),
    tier: t("orderTerms.tier"),
    tierChoose: t("orderTerms.tierChoose"),
    tiers: record(WELLMIX_TIERS, (k) => t(`orderTerms.tier.${k}`)),
    delivery: t("orderTerms.delivery"),
    carrier: t("orderTerms.carrier"),
    carrierNone: t("orderTerms.carrierNone"),
    redispatch: t("orderTerms.redispatch"),
    redispatchYes: t("orderTerms.redispatchYes"),
    redispatchNo: t("orderTerms.redispatchNo"),
    redispatchHint: t("orderTerms.redispatchHint"),
    carrierSankhya: t("orderTerms.carrierSankhya"),
    carrierSankhyaOff: t("orderTerms.carrierSankhyaOff"),
    carrierSankhyaError: t("orderTerms.carrierSankhyaError"),
    country: t("orderTerms.country"),
    countryChoose: t("orderTerms.countryChoose"),
    countryDisabled: t("orderTerms.countryDisabled"),
    group: t("orderTerms.group"),
    groupChoose: t("orderTerms.groupChoose"),
    groupPickCountry: t("orderTerms.groupPickCountry"),
    groupNone: t("orderTerms.groupNone"),
    originHint: t("orderTerms.originHint"),
    loading: t("orderTerms.loading"),
    error: t("orderTerms.error"),
    productsCount: t("orderTerms.productsCount", { n: "{n}" }),
    stock: t("orderTerms.stock"),
    confirmNote: t("orderTerms.confirmNote"),
    switchTitle: t("orderTerms.switchTitle"),
    switchBody: t("orderTerms.switchBody"),
    switchKeep: t("orderTerms.switchKeep"),
    switchConfirm: t("orderTerms.switchConfirm"),
  };
}

/** Textos da confirmação do pedido pelo cliente. */
export function customerConfirmLabels(
  t: Translate,
): CustomerOrderConfirmLabels {
  return {
    title: t("customerConfirm.title"),
    intro: t("customerConfirm.intro"),
    disclaimerTitle: t("orderTerms.disclaimerTitle"),
    disclaimer: t("orderTerms.disclaimer"),
    accept: t("orderTerms.accept"),
    redispatchTitle: t("customerConfirm.redispatchTitle"),
    redispatchHint: t("customerConfirm.redispatchHint"),
    cnpj: t("customerConfirm.cnpj"),
    cnpjPlaceholder: t("customerConfirm.cnpjPlaceholder"),
    lookup: t("customerConfirm.lookup"),
    looking: t("customerConfirm.looking"),
    cnpjInvalid: t("customerConfirm.cnpjInvalid"),
    notFound: t("customerConfirm.notFound"),
    manual: t("customerConfirm.manual"),
    carrierName: t("customerConfirm.carrierName"),
    found: t("customerConfirm.found"),
    submit: t("customerConfirm.submit"),
    submitting: t("customerConfirm.submitting"),
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

/** Textos da Composição de containers, no idioma de quem vê. */
export function compositionLabels(t: Translate): ContainerCompositionLabels {
  return {
    title: t("composition.title"),
    hint: t("composition.hint"),
    empty: t("composition.empty"),
    container: t("composition.container"),
    containerN: t("composition.containerN", { n: "{n}" }),
    roundN: t("composition.roundN", { n: "{n}" }),
    expand: t("composition.expand"),
    collapse: t("composition.collapse"),
    unused: t("composition.unused"),
    reference: t("composition.reference", { code: "{code}", cbm: "{cbm}" }),
    mixed: t("composition.mixed"),
    missing: t("composition.missing", { names: "{names}" }),
    tooBig: t("composition.tooBig", { names: "{names}" }),
    cartons: t("composition.cartons", { cartons: "{cartons}" }),
    goTo: t("composition.goTo"),
    intl: t.intl,
  };
}
