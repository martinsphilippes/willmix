import type { Translate } from "@/i18n";
import type { SankhyaHistoryLabels } from "./sankhya-purchase-history";

/** Textos do histórico pelo Sankhya, no idioma de quem vê. */
export function sankhyaHistoryLabels(t: Translate): SankhyaHistoryLabels {
  return {
    pick: {
      add: t("historyPick.add"),
      inOrder: t("historyPick.inOrder"),
      filtered: t("historyPick.filtered", { n: "{n}" }),
    },
    intl: t.intl,
    title: t("purchaseHistory.title"),
    source: t("sankhyaHistory.source"),
    select: t("purchaseHistory.select"),
    loading: t("purchaseHistory.loading"),
    empty: t("sankhyaHistory.empty"),
    error: t("sankhyaHistory.error"),
    retry: t("purchaseHistory.retry"),
    more: t("purchaseHistory.more"),
    hint: t("sankhyaHistory.hint"),
    order: t("sankhyaHistory.order", { n: "{n}" }),
    note: t("sankhyaHistory.note", { n: "{n}" }),
    items: t("sankhyaHistory.items", { n: "{n}" }),
    pending: t("sankhyaHistory.pending"),
    done: t("sankhyaHistory.done"),
    noItems: t("purchaseHistory.noItems"),
    fallbackNotConfigured: t("sankhyaHistory.fallbackNotConfigured"),
    fallbackNoCode: t("sankhyaHistory.fallbackNoCode"),
    view: {
      label: t("sankhyaHistory.view.label"),
      orders: t("sankhyaHistory.view.orders"),
      products: t("sankhyaHistory.view.products"),
    },
    products: {
      hint: t("sankhyaHistory.products.hint"),
      period: t("sankhyaHistory.products.period", {
        from: "{from}",
        to: "{to}",
        n: "{n}",
      }),
      total: t("sankhyaHistory.products.total", { q: "{q}" }),
      empty: t("sankhyaHistory.products.empty"),
      more: t("sankhyaHistory.products.more"),
      showMore: t("sankhyaHistory.products.showMore", { n: "{n}" }),
      incomplete: t("sankhyaHistory.products.incomplete"),
      sort: {
        label: t("sankhyaHistory.products.sort"),
        units_desc: t("sankhyaHistory.products.sort.units_desc"),
        units_asc: t("sankhyaHistory.products.sort.units_asc"),
        value_desc: t("sankhyaHistory.products.sort.value_desc"),
        value_asc: t("sankhyaHistory.products.sort.value_asc"),
      },
      totals: t("sankhyaHistory.products.totals"),
    },
    f: {
      code: t("sankhyaHistory.f.code"),
      reference: t("sankhyaHistory.f.reference"),
      supplierReference: t("sankhyaHistory.f.supplierReference"),
      ncm: t("sankhyaHistory.f.ncm"),
      quantity: t("sankhyaHistory.f.quantity"),
      delivered: t("sankhyaHistory.f.delivered"),
      unitPrice: t("sankhyaHistory.f.unitPrice"),
      discount: t("sankhyaHistory.f.discount"),
      unitNet: t("sankhyaHistory.f.unitNet"),
      totalNet: t("sankhyaHistory.f.totalNet"),
      container: t("sankhyaHistory.f.container"),
      top: t("sankhyaHistory.f.top"),
      company: t("sankhyaHistory.f.company"),
    },
  };
}
