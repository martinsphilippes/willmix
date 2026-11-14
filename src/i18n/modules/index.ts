/**
 * Dicionários por módulo (evolução incremental). Cada módulo exporta
 * `{ pt, en, zh }` com as mesmas chaves; aqui tudo é fundido e entra em
 * src/i18n/dictionaries.ts. O teste de paridade cobre estas chaves também.
 */
import * as catalog from "./catalog";
import * as intro from "./intro";
import * as productSuppliers from "./product-suppliers";
import * as sheetMissing from "./sheet-missing";
import * as messageControl from "./message-control";
import * as customers from "./customers";
import * as passwordChange from "./password-change";
import * as suppliers from "./suppliers";
import * as requestsList from "./requests-list";
import * as productsList from "./products-list";
import * as inventory from "./inventory";
import * as saleSheet from "./sale-sheet";
import * as stock from "./stock";
import * as owner from "./owner";
import * as reservations from "./reservations";
import * as supplierScore from "./supplier-score";
import * as orderView from "./order-view";
import * as orderParts from "./order-parts";
import * as towerBoard from "./tower-board";
import * as productPhotos from "./product-photos";
import * as sheetGenerate from "./sheet-generate";
import * as notificationsDelete from "./notifications-delete";
import * as tableTools from "./table-tools";
import * as partyPicker from "./party-picker";
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
import * as passwordReset from "./password-reset";
import * as supabaseCopy from "./supabase-copy";
import * as sheetReading from "./sheet-reading";
import * as manufacturerCards from "./manufacturer-cards";
import * as supplierRanking from "./supplier-ranking";
import * as explore from "./explore";
import * as inspectionReport from "./inspection-report";
import * as sla from "./sla";
import * as slaPanel from "./sla-panel";
import * as partnerTypes from "./partner-types";
import * as partnerAccess from "./partner-access";
import * as commissions from "./commissions";
import * as approvals from "./approvals";
import * as purchaseFlow from "./purchase-flow";
import * as production from "./production";
import * as importFlow from "./import-flow";
import * as receiving from "./receiving";
import * as certificationArtwork from "./certification-artwork";
import * as dashboards from "./dashboards";
import * as demoAccounts from "./demo-accounts";
import * as accessScreens from "./access-screens";
import * as teamAccess from "./team-access";
import * as requestProduct from "./request-product";
import * as requestDelete from "./request-delete";
import * as productDelete from "./product-delete";
import * as requestAdd from "./request-add";
import * as pricing from "./pricing";
import * as quoteSheet from "./quote-sheet";
import * as freight from "./freight";
import * as importTaxes from "./import-taxes";
import * as errors from "./errors";
import * as rfq from "./rfq";
import * as rfqStandby from "./rfq-standby";
import * as sourcingStandby from "./sourcing-standby";
import * as portalAccess from "./portal-access";
import * as supplierTasks from "./supplier-tasks";
import * as superplanLogic from "./superplan-logic";
import * as dieCutStep from "./die-cut-step";
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
import * as flow from "./flow";
import * as orderSummary from "./order-summary";
import * as goLive from "./go-live";
import * as milestones from "./milestones";
import * as placeholders from "./placeholders";
import * as ncmSheet from "./ncm-sheet";
import * as i18nSweep from "./i18n-sweep";
import * as requestSchedule from "./request-schedule";
import * as freightTariff from "./freight-tariff";
import * as superplan from "./superplan";
import * as sankhya from "./sankhya";
import * as sankhyaIntegration from "./sankhya-integration";
import * as processes from "./processes";
import * as superplanRfq from "./superplan-rfq";
import * as quoteFlow from "./quote-flow";
import * as orderSignature from "./order-signature";
import * as booking from "./booking";
import * as bookingScreen from "./booking-screen";
import * as bookingLots from "./booking-lots";
import * as bookingInvites from "./booking-invites";
import * as supplierRequests from "./supplier-requests";
import * as supplierRequestProduct from "./supplier-request-product";
import * as placeholderName from "./placeholder-name";
import * as bookingNcm from "./booking-ncm";
import * as supplierRequestNegotiation from "./supplier-request-negotiation";
import * as purchaseOrder from "./purchase-order";
import * as purchaseSequence from "./purchase-sequence";
import * as sampleOrder from "./sample-order";
import * as desks from "./desks";
import * as inspectionSequence from "./inspection-sequence";
import * as shippingDocs from "./shipping-docs";
import * as supplierInvoice from "./supplier-invoice";
import * as sampleFlow from "./sample-flow";
import * as exwOrigin from "./exw-origin";
import * as delivery from "./delivery";
import * as purchaseRounds from "./purchase-rounds";
import * as colorVariants from "./color-variants";
import * as aiReferences from "./ai-references";
import * as sampling from "./sampling";
import * as notifications from "./notifications";
import * as productSheetImport from "./product-sheet-import";
import * as productVariants from "./product-variants";
import * as messages from "./messages";

export const modulesPt = {
  ...messages.pt,
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
  ...passwordReset.pt,
  ...supabaseCopy.pt,
  ...sheetReading.pt,
  ...manufacturerCards.pt,
  ...supplierRanking.pt,
  ...explore.pt,
  ...inspectionReport.pt,
  ...sla.pt,
  ...slaPanel.pt,
  ...partnerTypes.pt,
  ...partnerAccess.pt,
  ...commissions.pt,
  ...approvals.pt,
  ...purchaseFlow.pt,
  ...production.pt,
  ...importFlow.pt,
  ...receiving.pt,
  ...certificationArtwork.pt,
  ...dashboards.pt,
  ...demoAccounts.pt,
  ...accessScreens.pt,
  ...teamAccess.pt,
  ...requestProduct.pt,
  ...requestDelete.pt,
  ...productDelete.pt,
  ...requestAdd.pt,
  ...pricing.pt,
  ...quoteSheet.pt,
  ...freight.pt,
  ...importTaxes.pt,
  ...errors.pt,
  ...rfq.pt,
  ...rfqStandby.pt,
  ...sourcingStandby.pt,
  ...portalAccess.pt,
  ...supplierTasks.pt,
  ...superplanLogic.pt,
  ...dieCutStep.pt,
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
  ...flow.pt,
  ...orderSummary.pt,
  ...goLive.pt,
  ...milestones.pt,
  ...placeholders.pt,
  ...ncmSheet.pt,
  ...i18nSweep.pt,
  ...requestSchedule.pt,
  ...productSuppliers.pt,
  ...sheetMissing.pt,
  ...messageControl.pt,
  ...customers.pt,
  ...passwordChange.pt,
  ...suppliers.pt,
  ...requestsList.pt,
  ...productsList.pt,
  ...inventory.pt,
  ...saleSheet.pt,
  ...stock.pt,
  ...owner.pt,
  ...reservations.pt,
  ...supplierScore.pt,
  ...orderView.pt,
  ...orderParts.pt,
  ...towerBoard.pt,
  ...productPhotos.pt,
  ...sheetGenerate.pt,
  ...notificationsDelete.pt,
  ...tableTools.pt,
  ...partyPicker.pt,
  ...sheetSafety.pt,
  ...productSpec.pt,
  ...freightTariff.pt,
  ...superplan.pt,
  ...sankhya.pt,
  ...sankhyaIntegration.pt,
  ...processes.pt,
  ...superplanRfq.pt,
  ...quoteFlow.pt,
  ...orderSignature.pt,
  ...booking.pt,
  ...bookingScreen.pt,
  ...bookingLots.pt,
  ...bookingInvites.pt,
  ...supplierRequests.pt,
  ...supplierRequestProduct.pt,
  ...placeholderName.pt,
  ...bookingNcm.pt,
  ...supplierRequestNegotiation.pt,
  ...purchaseOrder.pt,
  ...purchaseSequence.pt,
  ...sampleOrder.pt,
  ...desks.pt,
  ...inspectionSequence.pt,
  ...shippingDocs.pt,
  ...supplierInvoice.pt,
  ...sampleFlow.pt,
  ...exwOrigin.pt,
  ...delivery.pt,
  ...purchaseRounds.pt,
  ...colorVariants.pt,
  ...aiReferences.pt,
  ...sampling.pt,
  ...intro.pt,
};
export const modulesEn: Record<keyof typeof modulesPt, string> = {
  ...messages.en,
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
  ...passwordReset.en,
  ...supabaseCopy.en,
  ...sheetReading.en,
  ...manufacturerCards.en,
  ...supplierRanking.en,
  ...explore.en,
  ...inspectionReport.en,
  ...sla.en,
  ...slaPanel.en,
  ...partnerTypes.en,
  ...partnerAccess.en,
  ...commissions.en,
  ...approvals.en,
  ...purchaseFlow.en,
  ...production.en,
  ...importFlow.en,
  ...receiving.en,
  ...certificationArtwork.en,
  ...dashboards.en,
  ...demoAccounts.en,
  ...accessScreens.en,
  ...teamAccess.en,
  ...requestProduct.en,
  ...requestDelete.en,
  ...productDelete.en,
  ...requestAdd.en,
  ...pricing.en,
  ...quoteSheet.en,
  ...freight.en,
  ...importTaxes.en,
  ...errors.en,
  ...rfq.en,
  ...rfqStandby.en,
  ...sourcingStandby.en,
  ...portalAccess.en,
  ...supplierTasks.en,
  ...superplanLogic.en,
  ...dieCutStep.en,
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
  ...flow.en,
  ...orderSummary.en,
  ...goLive.en,
  ...milestones.en,
  ...placeholders.en,
  ...ncmSheet.en,
  ...i18nSweep.en,
  ...requestSchedule.en,
  ...productSuppliers.en,
  ...sheetMissing.en,
  ...messageControl.en,
  ...customers.en,
  ...passwordChange.en,
  ...suppliers.en,
  ...requestsList.en,
  ...productsList.en,
  ...inventory.en,
  ...saleSheet.en,
  ...stock.en,
  ...owner.en,
  ...reservations.en,
  ...supplierScore.en,
  ...orderView.en,
  ...orderParts.en,
  ...towerBoard.en,
  ...productPhotos.en,
  ...sheetGenerate.en,
  ...notificationsDelete.en,
  ...tableTools.en,
  ...partyPicker.en,
  ...sheetSafety.en,
  ...productSpec.en,
  ...freightTariff.en,
  ...superplan.en,
  ...sankhya.en,
  ...sankhyaIntegration.en,
  ...processes.en,
  ...superplanRfq.en,
  ...quoteFlow.en,
  ...orderSignature.en,
  ...booking.en,
  ...bookingScreen.en,
  ...bookingLots.en,
  ...bookingInvites.en,
  ...supplierRequests.en,
  ...supplierRequestProduct.en,
  ...placeholderName.en,
  ...bookingNcm.en,
  ...supplierRequestNegotiation.en,
  ...purchaseOrder.en,
  ...purchaseSequence.en,
  ...sampleOrder.en,
  ...desks.en,
  ...inspectionSequence.en,
  ...shippingDocs.en,
  ...supplierInvoice.en,
  ...sampleFlow.en,
  ...exwOrigin.en,
  ...delivery.en,
  ...purchaseRounds.en,
  ...colorVariants.en,
  ...aiReferences.en,
  ...sampling.en,
  ...intro.en,
};
export const modulesZh: Record<keyof typeof modulesPt, string> = {
  ...messages.zh,
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
  ...passwordReset.zh,
  ...supabaseCopy.zh,
  ...sheetReading.zh,
  ...manufacturerCards.zh,
  ...supplierRanking.zh,
  ...explore.zh,
  ...inspectionReport.zh,
  ...sla.zh,
  ...slaPanel.zh,
  ...partnerTypes.zh,
  ...partnerAccess.zh,
  ...commissions.zh,
  ...approvals.zh,
  ...purchaseFlow.zh,
  ...production.zh,
  ...importFlow.zh,
  ...receiving.zh,
  ...certificationArtwork.zh,
  ...dashboards.zh,
  ...demoAccounts.zh,
  ...accessScreens.zh,
  ...teamAccess.zh,
  ...requestProduct.zh,
  ...requestDelete.zh,
  ...productDelete.zh,
  ...requestAdd.zh,
  ...pricing.zh,
  ...quoteSheet.zh,
  ...freight.zh,
  ...importTaxes.zh,
  ...errors.zh,
  ...rfq.zh,
  ...rfqStandby.zh,
  ...sourcingStandby.zh,
  ...portalAccess.zh,
  ...supplierTasks.zh,
  ...superplanLogic.zh,
  ...dieCutStep.zh,
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
  ...flow.zh,
  ...orderSummary.zh,
  ...goLive.zh,
  ...milestones.zh,
  ...placeholders.zh,
  ...ncmSheet.zh,
  ...i18nSweep.zh,
  ...requestSchedule.zh,
  ...productSuppliers.zh,
  ...sheetMissing.zh,
  ...messageControl.zh,
  ...customers.zh,
  ...passwordChange.zh,
  ...suppliers.zh,
  ...requestsList.zh,
  ...productsList.zh,
  ...inventory.zh,
  ...saleSheet.zh,
  ...stock.zh,
  ...owner.zh,
  ...reservations.zh,
  ...supplierScore.zh,
  ...orderView.zh,
  ...orderParts.zh,
  ...towerBoard.zh,
  ...productPhotos.zh,
  ...sheetGenerate.zh,
  ...notificationsDelete.zh,
  ...tableTools.zh,
  ...partyPicker.zh,
  ...sheetSafety.zh,
  ...productSpec.zh,
  ...freightTariff.zh,
  ...superplan.zh,
  ...sankhya.zh,
  ...sankhyaIntegration.zh,
  ...processes.zh,
  ...superplanRfq.zh,
  ...quoteFlow.zh,
  ...orderSignature.zh,
  ...booking.zh,
  ...bookingScreen.zh,
  ...bookingLots.zh,
  ...bookingInvites.zh,
  ...supplierRequests.zh,
  ...supplierRequestProduct.zh,
  ...placeholderName.zh,
  ...bookingNcm.zh,
  ...supplierRequestNegotiation.zh,
  ...purchaseOrder.zh,
  ...purchaseSequence.zh,
  ...sampleOrder.zh,
  ...desks.zh,
  ...inspectionSequence.zh,
  ...shippingDocs.zh,
  ...supplierInvoice.zh,
  ...sampleFlow.zh,
  ...exwOrigin.zh,
  ...delivery.zh,
  ...purchaseRounds.zh,
  ...colorVariants.zh,
  ...aiReferences.zh,
  ...sampling.zh,
  ...intro.zh,
};
