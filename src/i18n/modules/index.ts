/**
 * Dicionários por módulo (evolução incremental). Cada módulo exporta
 * `{ pt, en, zh }` com as mesmas chaves; aqui tudo é fundido e entra em
 * src/i18n/dictionaries.ts. O teste de paridade cobre estas chaves também.
 */
import * as catalog from "./catalog";
import * as productSuppliers from "./product-suppliers";
import * as sheetMissing from "./sheet-missing";
import * as productPhotos from "./product-photos";
import * as sheetGenerate from "./sheet-generate";
import * as notificationsDelete from "./notifications-delete";
import * as sheetSafety from "./sheet-safety";
import * as productSpec from "./product-spec";
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
import * as supplierTerms from "./supplier-terms";
import * as packaging from "./packaging";
import * as packagingBrief from "./packaging-brief";
import * as carton from "./carton";
import * as dateOrder from "./date-order";
import * as financeFx from "./finance-fx";
import * as pageHelp from "./page-help";
import * as dataReset from "./data-reset";
import * as sheetReading from "./sheet-reading";
import * as manufacturerCards from "./manufacturer-cards";
import * as supplierRanking from "./supplier-ranking";
import * as explore from "./explore";
import * as inspectionReport from "./inspection-report";
import * as sla from "./sla";
import * as requestProduct from "./request-product";
import * as requestDelete from "./request-delete";
import * as productDelete from "./product-delete";
import * as pricing from "./pricing";
import * as quoteSheet from "./quote-sheet";
import * as freight from "./freight";
import * as importTaxes from "./import-taxes";
import * as errors from "./errors";
import * as rfq from "./rfq";
import * as sheetProgress from "./sheet-progress";
import * as requirementFiles from "./requirement-files";
import * as sheetPhotos from "./sheet-photos";
import * as orderCancel from "./order-cancel";
import * as requestBatch from "./request-batch";
import * as tasksFilter from "./tasks-filter";
import * as pantone from "./pantone";
import * as sheetFill from "./sheet-fill";
import * as productSheet from "./product-sheet";
import * as sheetRecords from "./sheet-records";
import * as navGroups from "./nav-groups";
import * as placeholders from "./placeholders";
import * as ncmSheet from "./ncm-sheet";
import * as i18nSweep from "./i18n-sweep";
import * as requestSchedule from "./request-schedule";
import * as freightTariff from "./freight-tariff";
import * as notifications from "./notifications";
import * as productSheetImport from "./product-sheet-import";
import * as productVariants from "./product-variants";

export const modulesPt = {
  ...productVariants.pt,
  ...productSheetImport.pt,
  ...notifications.pt,
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
  ...supplierTerms.pt,
  ...packaging.pt,
  ...packagingBrief.pt,
  ...carton.pt,
  ...dateOrder.pt,
  ...financeFx.pt,
  ...pageHelp.pt,
  ...dataReset.pt,
  ...sheetReading.pt,
  ...manufacturerCards.pt,
  ...supplierRanking.pt,
  ...explore.pt,
  ...inspectionReport.pt,
  ...sla.pt,
  ...requestProduct.pt,
  ...requestDelete.pt,
  ...productDelete.pt,
  ...pricing.pt,
  ...quoteSheet.pt,
  ...freight.pt,
  ...importTaxes.pt,
  ...errors.pt,
  ...rfq.pt,
  ...sheetProgress.pt,
  ...requirementFiles.pt,
  ...sheetPhotos.pt,
  ...orderCancel.pt,
  ...requestBatch.pt,
  ...tasksFilter.pt,
  ...pantone.pt,
  ...sheetFill.pt,
  ...productSheet.pt,
  ...sheetRecords.pt,
  ...navGroups.pt,
  ...placeholders.pt,
  ...ncmSheet.pt,
  ...i18nSweep.pt,
  ...requestSchedule.pt,
  ...productSuppliers.pt,
  ...sheetMissing.pt,
  ...productPhotos.pt,
  ...sheetGenerate.pt,
  ...notificationsDelete.pt,
  ...sheetSafety.pt,
  ...productSpec.pt,
  ...freightTariff.pt,
};
export const modulesEn: Record<keyof typeof modulesPt, string> = {
  ...productVariants.en,
  ...productSheetImport.en,
  ...notifications.en,
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
  ...supplierTerms.en,
  ...packaging.en,
  ...packagingBrief.en,
  ...carton.en,
  ...dateOrder.en,
  ...financeFx.en,
  ...pageHelp.en,
  ...dataReset.en,
  ...sheetReading.en,
  ...manufacturerCards.en,
  ...supplierRanking.en,
  ...explore.en,
  ...inspectionReport.en,
  ...sla.en,
  ...requestProduct.en,
  ...requestDelete.en,
  ...productDelete.en,
  ...pricing.en,
  ...quoteSheet.en,
  ...freight.en,
  ...importTaxes.en,
  ...errors.en,
  ...rfq.en,
  ...sheetProgress.en,
  ...requirementFiles.en,
  ...sheetPhotos.en,
  ...orderCancel.en,
  ...requestBatch.en,
  ...tasksFilter.en,
  ...pantone.en,
  ...sheetFill.en,
  ...productSheet.en,
  ...sheetRecords.en,
  ...navGroups.en,
  ...placeholders.en,
  ...ncmSheet.en,
  ...i18nSweep.en,
  ...requestSchedule.en,
  ...productSuppliers.en,
  ...sheetMissing.en,
  ...productPhotos.en,
  ...sheetGenerate.en,
  ...notificationsDelete.en,
  ...sheetSafety.en,
  ...productSpec.en,
  ...freightTariff.en,
};
export const modulesZh: Record<keyof typeof modulesPt, string> = {
  ...productVariants.zh,
  ...productSheetImport.zh,
  ...notifications.zh,
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
  ...supplierTerms.zh,
  ...packaging.zh,
  ...packagingBrief.zh,
  ...carton.zh,
  ...dateOrder.zh,
  ...financeFx.zh,
  ...pageHelp.zh,
  ...dataReset.zh,
  ...sheetReading.zh,
  ...manufacturerCards.zh,
  ...supplierRanking.zh,
  ...explore.zh,
  ...inspectionReport.zh,
  ...sla.zh,
  ...requestProduct.zh,
  ...requestDelete.zh,
  ...productDelete.zh,
  ...pricing.zh,
  ...quoteSheet.zh,
  ...freight.zh,
  ...importTaxes.zh,
  ...errors.zh,
  ...rfq.zh,
  ...sheetProgress.zh,
  ...requirementFiles.zh,
  ...sheetPhotos.zh,
  ...orderCancel.zh,
  ...requestBatch.zh,
  ...tasksFilter.zh,
  ...pantone.zh,
  ...sheetFill.zh,
  ...productSheet.zh,
  ...sheetRecords.zh,
  ...navGroups.zh,
  ...placeholders.zh,
  ...ncmSheet.zh,
  ...i18nSweep.zh,
  ...requestSchedule.zh,
  ...productSuppliers.zh,
  ...sheetMissing.zh,
  ...productPhotos.zh,
  ...sheetGenerate.zh,
  ...notificationsDelete.zh,
  ...sheetSafety.zh,
  ...productSpec.zh,
  ...freightTariff.zh,
};
