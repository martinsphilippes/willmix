/**
 * Dicionários por módulo (evolução incremental). Cada módulo exporta
 * `{ pt, en, zh }` com as mesmas chaves; aqui tudo é fundido e entra em
 * src/i18n/dictionaries.ts. O teste de paridade cobre estas chaves também.
 */
import * as catalog from "./catalog";
import * as importing from "./import";
import * as logistics from "./logistics";
import * as orders from "./orders";
import * as reviews from "./reviews";
import * as sourcing from "./sourcing";
import * as vision from "./vision";
import * as marketing from "./marketing";
import * as operations from "./operations";
import * as lookup from "./lookup";
import * as ai from "./ai";
import * as access from "./access";
import * as home from "./home";
import * as payments from "./payments";
import * as purchaseSheet from "./purchase-sheet";
import * as supplierPayment from "./supplier-payment";
import * as inspectionReport from "./inspection-report";
import * as sla from "./sla";
import * as requestProduct from "./request-product";
import * as requestDelete from "./request-delete";
import * as pricing from "./pricing";
import * as quoteSheet from "./quote-sheet";
import * as freight from "./freight";
import * as importTaxes from "./import-taxes";
import * as errors from "./errors";

export const modulesPt = {
  ...sourcing.pt,
  ...catalog.pt,
  ...importing.pt,
  ...logistics.pt,
  ...reviews.pt,
  ...orders.pt,
  ...vision.pt,
  ...marketing.pt,
  ...operations.pt,
  ...lookup.pt,
  ...ai.pt,
  ...access.pt,
  ...home.pt,
  ...payments.pt,
  ...purchaseSheet.pt,
  ...supplierPayment.pt,
  ...inspectionReport.pt,
  ...sla.pt,
  ...requestProduct.pt,
  ...requestDelete.pt,
  ...pricing.pt,
  ...quoteSheet.pt,
  ...freight.pt,
  ...importTaxes.pt,
  ...errors.pt,
};
export const modulesEn: Record<keyof typeof modulesPt, string> = {
  ...sourcing.en,
  ...catalog.en,
  ...importing.en,
  ...logistics.en,
  ...reviews.en,
  ...orders.en,
  ...vision.en,
  ...marketing.en,
  ...operations.en,
  ...lookup.en,
  ...ai.en,
  ...access.en,
  ...home.en,
  ...payments.en,
  ...purchaseSheet.en,
  ...supplierPayment.en,
  ...inspectionReport.en,
  ...sla.en,
  ...requestProduct.en,
  ...requestDelete.en,
  ...pricing.en,
  ...quoteSheet.en,
  ...freight.en,
  ...importTaxes.en,
  ...errors.en,
};
export const modulesZh: Record<keyof typeof modulesPt, string> = {
  ...sourcing.zh,
  ...catalog.zh,
  ...importing.zh,
  ...logistics.zh,
  ...reviews.zh,
  ...orders.zh,
  ...vision.zh,
  ...marketing.zh,
  ...operations.zh,
  ...lookup.zh,
  ...ai.zh,
  ...access.zh,
  ...home.zh,
  ...payments.zh,
  ...purchaseSheet.zh,
  ...supplierPayment.zh,
  ...inspectionReport.zh,
  ...sla.zh,
  ...requestProduct.zh,
  ...requestDelete.zh,
  ...pricing.zh,
  ...quoteSheet.zh,
  ...freight.zh,
  ...importTaxes.zh,
  ...errors.zh,
};
