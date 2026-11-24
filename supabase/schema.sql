-- Gerado por npm run supabase:sql a partir de src/lib/db/schema.ts. Não edite.
-- Só adiciona (if not exists): pode rodar de novo a qualquer momento.

create table if not exists public."users" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."users" enable row level security;
alter table public."users" add column if not exists "email" text;
alter table public."users" add column if not exists "name" text;
alter table public."users" add column if not exists "role" text;
alter table public."users" add column if not exists "partyId" text;
alter table public."users" add column if not exists "locale" text;
alter table public."users" add column if not exists "passwordHash" text;
alter table public."users" add column if not exists "active" boolean;
alter table public."users" add column if not exists "importerId" text;
alter table public."users" add column if not exists "jobLevel" text;
alter table public."users" add column if not exists "managerUserId" text;
alter table public."users" add column if not exists "division" text;
alter table public."users" add column if not exists "areaId" text;
alter table public."users" add column if not exists "positionId" text;
alter table public."users" add column if not exists "reviewNote" text;
alter table public."users" add column if not exists "functions" jsonb;
alter table public."users" add column if not exists "screens" jsonb;
alter table public."users" add column if not exists "mustChangePassword" boolean;
alter table public."users" add column if not exists "screenExceptions" jsonb;
alter table public."users" add column if not exists "loginSuspended" boolean;
alter table public."users" add column if not exists "sellerCode" text;
create unique index if not exists "users_email_unique" on public."users" ("email");
create index if not exists "users_by_manager" on public."users" ("managerUserId");
create index if not exists "users_created" on public."users" ("createdAt");
create index if not exists "users_created_id" on public."users" ("createdAt", "id");
create index if not exists "users_name_id" on public."users" ("name", "id");

create table if not exists public."parties" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."parties" enable row level security;
alter table public."parties" add column if not exists "type" text;
alter table public."parties" add column if not exists "partnerTypeId" text;
alter table public."parties" add column if not exists "name" text;
alter table public."parties" add column if not exists "country" text;
alter table public."parties" add column if not exists "email" text;
alter table public."parties" add column if not exists "phone" text;
alter table public."parties" add column if not exists "taxId" text;
alter table public."parties" add column if not exists "notes" text;
alter table public."parties" add column if not exists "active" boolean;
alter table public."parties" add column if not exists "city" text;
alter table public."parties" add column if not exists "address" text;
alter table public."parties" add column if not exists "contactName" text;
alter table public."parties" add column if not exists "wechat" text;
alter table public."parties" add column if not exists "operationMode" text;
alter table public."parties" add column if not exists "radar" text;
alter table public."parties" add column if not exists "radarNotes" text;
alter table public."parties" add column if not exists "importerId" text;
alter table public."parties" add column if not exists "bankBeneficiary" text;
alter table public."parties" add column if not exists "bankName" text;
alter table public."parties" add column if not exists "bankAccount" text;
alter table public."parties" add column if not exists "bankSwift" text;
alter table public."parties" add column if not exists "bankAddress" text;
alter table public."parties" add column if not exists "storeNumber" text;
alter table public."parties" add column if not exists "paymentTerms" jsonb;
alter table public."parties" add column if not exists "paymentTermsNote" text;
alter table public."parties" add column if not exists "ownerUserId" text;
alter table public."parties" add column if not exists "rcaCode" text;
alter table public."parties" add column if not exists "rcaPortal" jsonb;
alter table public."parties" add column if not exists "sankhyaCode" text;
alter table public."parties" add column if not exists "sankhyaSyncedAt" timestamptz;
alter table public."parties" add column if not exists "legalName" text;
alter table public."parties" add column if not exists "stateRegistration" text;
alter table public."parties" add column if not exists "personType" text;
alter table public."parties" add column if not exists "sankhyaRefs" jsonb;
alter table public."parties" add column if not exists "customerContacts" jsonb;
alter table public."parties" add column if not exists "customerContactsUpdatedAt" timestamptz;
alter table public."parties" add column if not exists "customerContactsUpdatedByUserId" text;
alter table public."parties" add column if not exists "customerGroupId" text;
alter table public."parties" add column if not exists "economicGroupCode" text;
alter table public."parties" add column if not exists "economicGroupName" text;
alter table public."parties" add column if not exists "matrixCode" text;
alter table public."parties" add column if not exists "sankhyaCustomer" jsonb;
alter table public."parties" add column if not exists "sankhyaCustomerAt" timestamptz;
alter table public."parties" add column if not exists "sankhyaSupplier" jsonb;
alter table public."parties" add column if not exists "sankhyaSupplierAt" timestamptz;
create index if not exists "parties_by_type" on public."parties" ("type");
create index if not exists "parties_by_owner" on public."parties" ("ownerUserId");
create index if not exists "parties_by_sankhya" on public."parties" ("sankhyaCode");
create index if not exists "parties_by_customer_group" on public."parties" ("customerGroupId");
create index if not exists "parties_by_economic_group" on public."parties" ("economicGroupCode");
create index if not exists "parties_created" on public."parties" ("createdAt");
create index if not exists "parties_created_id" on public."parties" ("createdAt", "id");
create index if not exists "parties_name_id" on public."parties" ("name", "id");

create table if not exists public."product_lines" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."product_lines" enable row level security;
alter table public."product_lines" add column if not exists "name" text;
alter table public."product_lines" add column if not exists "manualDocumentId" text;
alter table public."product_lines" add column if not exists "requirements" jsonb;
alter table public."product_lines" add column if not exists "active" boolean;
alter table public."product_lines" add column if not exists "requiredCertifications" jsonb;
alter table public."product_lines" add column if not exists "prompts" jsonb;
alter table public."product_lines" add column if not exists "division" text;
alter table public."product_lines" add column if not exists "sankhyaCode" text;
alter table public."product_lines" add column if not exists "agencyId" text;
alter table public."product_lines" add column if not exists "familyCode" text;
create index if not exists "product_lines_by_sankhya" on public."product_lines" ("sankhyaCode");
create index if not exists "product_lines_by_family" on public."product_lines" ("familyCode");
create index if not exists "product_lines_created" on public."product_lines" ("createdAt");
create index if not exists "product_lines_created_id" on public."product_lines" ("createdAt", "id");
create index if not exists "product_lines_name_id" on public."product_lines" ("name", "id");

create table if not exists public."products" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."products" enable row level security;
alter table public."products" add column if not exists "lineId" text;
alter table public."products" add column if not exists "name" text;
alter table public."products" add column if not exists "sku" text;
alter table public."products" add column if not exists "specification" text;
alter table public."products" add column if not exists "active" boolean;
alter table public."products" add column if not exists "supplierId" text;
alter table public."products" add column if not exists "supplierSku" text;
alter table public."products" add column if not exists "category" text;
alter table public."products" add column if not exists "material" text;
alter table public."products" add column if not exists "color" text;
alter table public."products" add column if not exists "pantone" text;
alter table public."products" add column if not exists "colorPantones" jsonb;
alter table public."products" add column if not exists "moq" bigint;
alter table public."products" add column if not exists "price" double precision;
alter table public."products" add column if not exists "currency" text;
alter table public."products" add column if not exists "masterBoxQty" bigint;
alter table public."products" add column if not exists "innerBoxQty" bigint;
alter table public."products" add column if not exists "netWeightKg" double precision;
alter table public."products" add column if not exists "grossWeightKg" double precision;
alter table public."products" add column if not exists "widthCm" double precision;
alter table public."products" add column if not exists "heightCm" double precision;
alter table public."products" add column if not exists "lengthCm" double precision;
alter table public."products" add column if not exists "boxLengthCm" double precision;
alter table public."products" add column if not exists "boxWidthCm" double precision;
alter table public."products" add column if not exists "boxHeightCm" double precision;
alter table public."products" add column if not exists "cbm" double precision;
alter table public."products" add column if not exists "notes" text;
alter table public."products" add column if not exists "notesToEcommerce" boolean;
alter table public."products" add column if not exists "source" text;
alter table public."products" add column if not exists "negotiatedAt" timestamptz;
alter table public."products" add column if not exists "sourcingItemId" text;
alter table public."products" add column if not exists "primaryPhotoDocumentId" text;
alter table public."products" add column if not exists "ncm" text;
alter table public."products" add column if not exists "priceTiers" jsonb;
alter table public."products" add column if not exists "sankhyaRefs" jsonb;
alter table public."products" add column if not exists "brand" text;
alter table public."products" add column if not exists "minStock" double precision;
alter table public."products" add column if not exists "sankhyaCode" text;
alter table public."products" add column if not exists "ean" text;
alter table public."products" add column if not exists "sankhyaSyncedAt" timestamptz;
alter table public."products" add column if not exists "sankhyaImages" jsonb;
alter table public."products" add column if not exists "approvalStatus" text;
alter table public."products" add column if not exists "approvalRequestedByUserId" text;
alter table public."products" add column if not exists "approvalRequestedAt" timestamptz;
alter table public."products" add column if not exists "approvalDecidedByUserId" text;
alter table public."products" add column if not exists "approvalDecidedAt" timestamptz;
alter table public."products" add column if not exists "approvalNote" text;
create index if not exists "products_by_sankhya" on public."products" ("sankhyaCode");
create index if not exists "products_by_line" on public."products" ("lineId");
create index if not exists "products_by_supplier" on public."products" ("supplierId");
create index if not exists "products_by_approval" on public."products" ("approvalStatus") where "approvalStatus" is not null;
create index if not exists "products_created" on public."products" ("createdAt");
create index if not exists "products_created_id" on public."products" ("createdAt", "id");
create index if not exists "products_name_id" on public."products" ("name", "id");

create table if not exists public."requests" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."requests" enable row level security;
alter table public."requests" add column if not exists "customerId" text;
alter table public."requests" add column if not exists "createdByUserId" text;
alter table public."requests" add column if not exists "productId" text;
alter table public."requests" add column if not exists "productName" text;
alter table public."requests" add column if not exists "description" text;
alter table public."requests" add column if not exists "specification" text;
alter table public."requests" add column if not exists "quantity" double precision;
alter table public."requests" add column if not exists "unit" text;
alter table public."requests" add column if not exists "deadline" timestamptz;
alter table public."requests" add column if not exists "status" text;
alter table public."requests" add column if not exists "orderId" text;
alter table public."requests" add column if not exists "sellPrice" double precision;
alter table public."requests" add column if not exists "sellCurrency" text;
alter table public."requests" add column if not exists "downPaymentAmount" double precision;
alter table public."requests" add column if not exists "notes" text;
alter table public."requests" add column if not exists "origin" text;
alter table public."requests" add column if not exists "sourceOrderId" text;
alter table public."requests" add column if not exists "requestedForUserId" text;
alter table public."requests" add column if not exists "ncm" text;
alter table public."requests" add column if not exists "ncmSource" text;
alter table public."requests" add column if not exists "ncmConfirmedByUserId" text;
alter table public."requests" add column if not exists "ncmConfirmedAt" timestamptz;
alter table public."requests" add column if not exists "ncmSuggestions" jsonb;
alter table public."requests" add column if not exists "groupId" text;
alter table public."requests" add column if not exists "schedule" jsonb;
alter table public."requests" add column if not exists "number" bigint;
alter table public."requests" add column if not exists "variantId" text;
alter table public."requests" add column if not exists "variant" jsonb;
alter table public."requests" add column if not exists "ownerUserId" text;
alter table public."requests" add column if not exists "sankhyaCode" text;
alter table public."requests" add column if not exists "channel" text;
alter table public."requests" add column if not exists "desiredAt" timestamptz;
alter table public."requests" add column if not exists "purchaseDecisionId" text;
alter table public."requests" add column if not exists "orderTerms" jsonb;
alter table public."requests" add column if not exists "strategySentAt" timestamptz;
alter table public."requests" add column if not exists "strategySentByUserId" text;
alter table public."requests" add column if not exists "priceForecast" jsonb;
alter table public."requests" add column if not exists "companyAllocations" jsonb;
alter table public."requests" add column if not exists "sentForm" jsonb;
alter table public."requests" add column if not exists "innerRequirement" jsonb;
create index if not exists "requests_by_customer" on public."requests" ("customerId");
create index if not exists "requests_by_status" on public."requests" ("status");
create index if not exists "requests_by_origin" on public."requests" ("origin");
create index if not exists "requests_by_group" on public."requests" ("groupId");
create index if not exists "requests_by_number" on public."requests" ("number");
create index if not exists "requests_by_owner" on public."requests" ("ownerUserId");
create index if not exists "requests_created" on public."requests" ("createdAt");
create index if not exists "requests_created_id" on public."requests" ("createdAt", "id");

create table if not exists public."orders" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."orders" enable row level security;
alter table public."orders" add column if not exists "number" bigint;
alter table public."orders" add column if not exists "requestId" text;
alter table public."orders" add column if not exists "customerId" text;
alter table public."orders" add column if not exists "supplierId" text;
alter table public."orders" add column if not exists "lineId" text;
alter table public."orders" add column if not exists "status" text;
alter table public."orders" add column if not exists "currentStageId" text;
alter table public."orders" add column if not exists "fobTotal" double precision;
alter table public."orders" add column if not exists "fobCurrency" text;
alter table public."orders" add column if not exists "sellPrice" double precision;
alter table public."orders" add column if not exists "sellCurrency" text;
alter table public."orders" add column if not exists "saleFormat" text;
alter table public."orders" add column if not exists "erpSyncStatus" text;
alter table public."orders" add column if not exists "erpNumber" text;
alter table public."orders" add column if not exists "agencyId" text;
alter table public."orders" add column if not exists "brokerId" text;
alter table public."orders" add column if not exists "shippingLineId" text;
alter table public."orders" add column if not exists "carrierId" text;
alter table public."orders" add column if not exists "comexId" text;
alter table public."orders" add column if not exists "logisticsId" text;
alter table public."orders" add column if not exists "ocpId" text;
alter table public."orders" add column if not exists "marketingAgencyId" text;
alter table public."orders" add column if not exists "pausedAt" timestamptz;
alter table public."orders" add column if not exists "pauseReason" text;
alter table public."orders" add column if not exists "arrivalPort" text;
alter table public."orders" add column if not exists "designerUserId" text;
alter table public."orders" add column if not exists "closedAt" timestamptz;
alter table public."orders" add column if not exists "notes" text;
alter table public."orders" add column if not exists "operationMode" text;
alter table public."orders" add column if not exists "requestedByUserId" text;
alter table public."orders" add column if not exists "cancelledAt" timestamptz;
alter table public."orders" add column if not exists "cancelledByUserId" text;
alter table public."orders" add column if not exists "cancelReason" text;
alter table public."orders" add column if not exists "cancelNote" text;
alter table public."orders" add column if not exists "cancelSettlement" text;
alter table public."orders" add column if not exists "cancelStageKey" text;
alter table public."orders" add column if not exists "cancelRequestStatus" text;
alter table public."orders" add column if not exists "cancelRequestedAt" timestamptz;
alter table public."orders" add column if not exists "cancelRequestedByUserId" text;
alter table public."orders" add column if not exists "cancelRequestReason" text;
alter table public."orders" add column if not exists "cancelRequestResponse" text;
alter table public."orders" add column if not exists "supplierPaymentTerms" jsonb;
alter table public."orders" add column if not exists "ownerUserId" text;
alter table public."orders" add column if not exists "sankhyaCode" text;
alter table public."orders" add column if not exists "invoicedAt" timestamptz;
alter table public."orders" add column if not exists "invoicedByUserId" text;
alter table public."orders" add column if not exists "sankhyaSyncedAt" timestamptz;
alter table public."orders" add column if not exists "incoterm" text;
alter table public."orders" add column if not exists "paymentConditionId" text;
alter table public."orders" add column if not exists "flow" text;
alter table public."orders" add column if not exists "fxRate" double precision;
alter table public."orders" add column if not exists "sankhyaRefs" jsonb;
alter table public."orders" add column if not exists "purchaseRounds" jsonb;
alter table public."orders" add column if not exists "demandIds" jsonb;
alter table public."orders" add column if not exists "parentOrderId" text;
alter table public."orders" add column if not exists "roundIndex" bigint;
alter table public."orders" add column if not exists "held" boolean;
alter table public."orders" add column if not exists "milestoneKey" text;
alter table public."orders" add column if not exists "cancelMilestoneKey" text;
alter table public."orders" add column if not exists "customerPaymentPlan" jsonb;
alter table public."orders" add column if not exists "paymentPlanStatus" text;
alter table public."orders" add column if not exists "customerCharges" jsonb;
alter table public."orders" add column if not exists "chargeNotices" jsonb;
alter table public."orders" add column if not exists "sellerUserId" text;
alter table public."orders" add column if not exists "sankhyaChain" jsonb;
alter table public."orders" add column if not exists "sankhyaChangedAt" timestamptz;
alter table public."orders" add column if not exists "sankhyaQuality" text;
alter table public."orders" add column if not exists "sankhyaInspectedAt" timestamptz;
alter table public."orders" add column if not exists "sankhyaReceipt" text;
alter table public."orders" add column if not exists "sankhyaReceivedAt" timestamptz;
alter table public."orders" add column if not exists "customsChannel" text;
alter table public."orders" add column if not exists "sankhyaImportProcesses" bigint;
alter table public."orders" add column if not exists "shipmentState" text;
alter table public."orders" add column if not exists "sankhyaSituation" text;
alter table public."orders" add column if not exists "sankhyaTrackId" text;
create unique index if not exists "orders_number_unique" on public."orders" ("number");
create index if not exists "orders_by_payment_plan" on public."orders" ("paymentPlanStatus");
create index if not exists "orders_live_by_status" on public."orders" ("status") where "held" is null;
create index if not exists "orders_by_parent" on public."orders" ("parentOrderId");
create index if not exists "orders_by_sankhya" on public."orders" ("sankhyaCode");
create index if not exists "orders_by_sankhya_track" on public."orders" ("sankhyaTrackId");
create index if not exists "orders_by_owner" on public."orders" ("ownerUserId");
create index if not exists "orders_by_customer" on public."orders" ("customerId");
create index if not exists "orders_by_supplier" on public."orders" ("supplierId");
create index if not exists "orders_by_status" on public."orders" ("status");
create index if not exists "orders_created" on public."orders" ("createdAt");
create index if not exists "orders_created_id" on public."orders" ("createdAt", "id");

create table if not exists public."order_items" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."order_items" enable row level security;
alter table public."order_items" add column if not exists "orderId" text;
alter table public."order_items" add column if not exists "productId" text;
alter table public."order_items" add column if not exists "name" text;
alter table public."order_items" add column if not exists "quantity" double precision;
alter table public."order_items" add column if not exists "unit" text;
alter table public."order_items" add column if not exists "unitPrice" double precision;
alter table public."order_items" add column if not exists "sellUnitPrice" double precision;
alter table public."order_items" add column if not exists "saleQuote" jsonb;
alter table public."order_items" add column if not exists "variantId" text;
alter table public."order_items" add column if not exists "variant" jsonb;
alter table public."order_items" add column if not exists "colors" jsonb;
alter table public."order_items" add column if not exists "sankhyaCode" text;
alter table public."order_items" add column if not exists "sankhyaRefs" jsonb;
alter table public."order_items" add column if not exists "shippedQty" double precision;
alter table public."order_items" add column if not exists "receivedQty" double precision;
alter table public."order_items" add column if not exists "pendingQty" double precision;
create index if not exists "order_items_by_order" on public."order_items" ("orderId");
create index if not exists "order_items_created" on public."order_items" ("createdAt");
create index if not exists "order_items_created_id" on public."order_items" ("createdAt", "id");
create index if not exists "order_items_name_id" on public."order_items" ("name", "id");

create table if not exists public."stages" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."stages" enable row level security;
alter table public."stages" add column if not exists "orderId" text;
alter table public."stages" add column if not exists "key" text;
alter table public."stages" add column if not exists "sequence" bigint;
alter table public."stages" add column if not exists "status" text;
alter table public."stages" add column if not exists "responsibleRole" text;
alter table public."stages" add column if not exists "responsiblePartyId" text;
alter table public."stages" add column if not exists "dueAt" timestamptz;
alter table public."stages" add column if not exists "startedAt" timestamptz;
alter table public."stages" add column if not exists "completedAt" timestamptz;
alter table public."stages" add column if not exists "percent" bigint;
alter table public."stages" add column if not exists "reminderSentAt" timestamptz;
alter table public."stages" add column if not exists "blockReason" text;
alter table public."stages" add column if not exists "held" boolean;
create index if not exists "stages_by_order" on public."stages" ("orderId");
create index if not exists "stages_by_status" on public."stages" ("status");
create index if not exists "stages_live_by_status" on public."stages" ("status") where "held" is not true;
create index if not exists "stages_created" on public."stages" ("createdAt");
create index if not exists "stages_created_id" on public."stages" ("createdAt", "id");

create table if not exists public."requirements" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."requirements" enable row level security;
alter table public."requirements" add column if not exists "orderId" text;
alter table public."requirements" add column if not exists "stageId" text;
alter table public."requirements" add column if not exists "key" text;
alter table public."requirements" add column if not exists "label" text;
alter table public."requirements" add column if not exists "type" text;
alter table public."requirements" add column if not exists "required" boolean;
alter table public."requirements" add column if not exists "role" text;
alter table public."requirements" add column if not exists "status" text;
alter table public."requirements" add column if not exists "value" text;
alter table public."requirements" add column if not exists "documentId" text;
alter table public."requirements" add column if not exists "submittedByUserId" text;
alter table public."requirements" add column if not exists "submittedAt" timestamptz;
alter table public."requirements" add column if not exists "note" text;
alter table public."requirements" add column if not exists "held" boolean;
alter table public."requirements" add column if not exists "step" text;
alter table public."requirements" add column if not exists "milestoneKey" text;
create index if not exists "requirements_by_stage" on public."requirements" ("stageId");
create index if not exists "requirements_by_order_milestone" on public."requirements" ("orderId", "milestoneKey");
create index if not exists "requirements_by_order" on public."requirements" ("orderId");
create index if not exists "requirements_live_by_status" on public."requirements" ("status") where "held" is not true;
create index if not exists "requirements_live_by_key" on public."requirements" ("key") where "held" is not true;
create index if not exists "requirements_created" on public."requirements" ("createdAt");
create index if not exists "requirements_created_id" on public."requirements" ("createdAt", "id");

create table if not exists public."order_milestones" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."order_milestones" enable row level security;
alter table public."order_milestones" add column if not exists "orderId" text;
alter table public."order_milestones" add column if not exists "key" text;
alter table public."order_milestones" add column if not exists "status" text;
alter table public."order_milestones" add column if not exists "startedAt" timestamptz;
alter table public."order_milestones" add column if not exists "dueAt" timestamptz;
alter table public."order_milestones" add column if not exists "completedAt" timestamptz;
alter table public."order_milestones" add column if not exists "reminderSentAt" timestamptz;
alter table public."order_milestones" add column if not exists "blockReason" text;
alter table public."order_milestones" add column if not exists "held" boolean;
create index if not exists "order_milestones_by_order" on public."order_milestones" ("orderId");
create unique index if not exists "order_milestones_order_key_unique" on public."order_milestones" ("orderId", "key");
create index if not exists "order_milestones_live_by_status" on public."order_milestones" ("status") where "held" is not true;
create index if not exists "order_milestones_created" on public."order_milestones" ("createdAt");
create index if not exists "order_milestones_created_id" on public."order_milestones" ("createdAt", "id");

create table if not exists public."documents" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."documents" enable row level security;
alter table public."documents" add column if not exists "orderId" text;
alter table public."documents" add column if not exists "requestId" text;
alter table public."documents" add column if not exists "requirementId" text;
alter table public."documents" add column if not exists "type" text;
alter table public."documents" add column if not exists "name" text;
alter table public."documents" add column if not exists "mime" text;
alter table public."documents" add column if not exists "size" bigint;
alter table public."documents" add column if not exists "storageKey" text;
alter table public."documents" add column if not exists "version" bigint;
alter table public."documents" add column if not exists "previousDocumentId" text;
alter table public."documents" add column if not exists "uploadedByUserId" text;
alter table public."documents" add column if not exists "visibility" text;
alter table public."documents" add column if not exists "productId" text;
alter table public."documents" add column if not exists "sourcingItemId" text;
alter table public."documents" add column if not exists "kitId" text;
alter table public."documents" add column if not exists "imageHash" text;
alter table public."documents" add column if not exists "conversationTopicId" text;
alter table public."documents" add column if not exists "supplierRequestId" text;
alter table public."documents" add column if not exists "thumbKey" text;
create index if not exists "documents_by_order" on public."documents" ("orderId");
create index if not exists "documents_by_request" on public."documents" ("requestId");
create index if not exists "documents_by_product" on public."documents" ("productId");
create index if not exists "documents_created" on public."documents" ("createdAt");
create index if not exists "documents_created_id" on public."documents" ("createdAt", "id");
create index if not exists "documents_name_id" on public."documents" ("name", "id");

create table if not exists public."payments" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."payments" enable row level security;
alter table public."payments" add column if not exists "orderId" text;
alter table public."payments" add column if not exists "requestId" text;
alter table public."payments" add column if not exists "direction" text;
alter table public."payments" add column if not exists "amount" double precision;
alter table public."payments" add column if not exists "currency" text;
alter table public."payments" add column if not exists "fxRate" double precision;
alter table public."payments" add column if not exists "method" text;
alter table public."payments" add column if not exists "status" text;
alter table public."payments" add column if not exists "proofDocumentId" text;
alter table public."payments" add column if not exists "registeredByUserId" text;
alter table public."payments" add column if not exists "confirmedByUserId" text;
alter table public."payments" add column if not exists "confirmedAt" timestamptz;
alter table public."payments" add column if not exists "note" text;
alter table public."payments" add column if not exists "kitId" text;
alter table public."payments" add column if not exists "sankhyaCode" text;
alter table public."payments" add column if not exists "sankhyaRefs" jsonb;
create index if not exists "payments_by_order" on public."payments" ("orderId");
create index if not exists "payments_by_request" on public."payments" ("requestId");
create index if not exists "payments_by_sankhya" on public."payments" ("sankhyaCode");
create index if not exists "payments_created" on public."payments" ("createdAt");
create index if not exists "payments_created_id" on public."payments" ("createdAt", "id");

create table if not exists public."notifications" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."notifications" enable row level security;
alter table public."notifications" add column if not exists "userId" text;
alter table public."notifications" add column if not exists "partyId" text;
alter table public."notifications" add column if not exists "role" text;
alter table public."notifications" add column if not exists "channel" text;
alter table public."notifications" add column if not exists "subject" text;
alter table public."notifications" add column if not exists "body" text;
alter table public."notifications" add column if not exists "link" text;
alter table public."notifications" add column if not exists "status" text;
alter table public."notifications" add column if not exists "readAt" timestamptz;
alter table public."notifications" add column if not exists "kind" text;
alter table public."notifications" add column if not exists "actor" text;
create index if not exists "notifications_by_user" on public."notifications" ("userId");
create index if not exists "notifications_by_user_channel_created" on public."notifications" ("userId", "channel", "createdAt");
create index if not exists "notifications_created" on public."notifications" ("createdAt");
create index if not exists "notifications_created_id" on public."notifications" ("createdAt", "id");

create table if not exists public."audit_log" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."audit_log" enable row level security;
alter table public."audit_log" add column if not exists "userId" text;
alter table public."audit_log" add column if not exists "action" text;
alter table public."audit_log" add column if not exists "entity" text;
alter table public."audit_log" add column if not exists "entityId" text;
alter table public."audit_log" add column if not exists "summary" text;
alter table public."audit_log" add column if not exists "before" jsonb;
alter table public."audit_log" add column if not exists "after" jsonb;
create index if not exists "audit_log_by_entity" on public."audit_log" ("entity", "entityId");
create index if not exists "audit_log_created" on public."audit_log" ("createdAt");
create index if not exists "audit_log_created_id" on public."audit_log" ("createdAt", "id");

create table if not exists public."penalties" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."penalties" enable row level security;
alter table public."penalties" add column if not exists "orderId" text;
alter table public."penalties" add column if not exists "responsiblePartyId" text;
alter table public."penalties" add column if not exists "reason" text;
alter table public."penalties" add column if not exists "amount" double precision;
alter table public."penalties" add column if not exists "currency" text;
alter table public."penalties" add column if not exists "evidenceDocumentId" text;
alter table public."penalties" add column if not exists "status" text;
alter table public."penalties" add column if not exists "createdByUserId" text;
create index if not exists "penalties_by_order" on public."penalties" ("orderId");
create index if not exists "penalties_created" on public."penalties" ("createdAt");
create index if not exists "penalties_created_id" on public."penalties" ("createdAt", "id");

create table if not exists public."settings" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."settings" enable row level security;
alter table public."settings" add column if not exists "key" text;
alter table public."settings" add column if not exists "value" jsonb;
create unique index if not exists "settings_key_unique" on public."settings" ("key");
create index if not exists "settings_created" on public."settings" ("createdAt");
create index if not exists "settings_created_id" on public."settings" ("createdAt", "id");

create table if not exists public."counters" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."counters" enable row level security;
alter table public."counters" add column if not exists "key" text;
alter table public."counters" add column if not exists "value" bigint;
create unique index if not exists "counters_key_unique" on public."counters" ("key");
create index if not exists "counters_created" on public."counters" ("createdAt");
create index if not exists "counters_created_id" on public."counters" ("createdAt", "id");

create table if not exists public."supplier_visits" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."supplier_visits" enable row level security;
alter table public."supplier_visits" add column if not exists "supplierId" text;
alter table public."supplier_visits" add column if not exists "supplierName" text;
alter table public."supplier_visits" add column if not exists "factoryName" text;
alter table public."supplier_visits" add column if not exists "city" text;
alter table public."supplier_visits" add column if not exists "address" text;
alter table public."supplier_visits" add column if not exists "location" text;
alter table public."supplier_visits" add column if not exists "visitedAt" timestamptz;
alter table public."supplier_visits" add column if not exists "participants" text;
alter table public."supplier_visits" add column if not exists "notes" text;
alter table public."supplier_visits" add column if not exists "nextVisitAt" timestamptz;
alter table public."supplier_visits" add column if not exists "followUp" text;
alter table public."supplier_visits" add column if not exists "status" text;
alter table public."supplier_visits" add column if not exists "createdByUserId" text;
create index if not exists "supplier_visits_by_supplier" on public."supplier_visits" ("supplierId");
create index if not exists "supplier_visits_by_date" on public."supplier_visits" ("visitedAt");
create index if not exists "supplier_visits_created" on public."supplier_visits" ("createdAt");
create index if not exists "supplier_visits_created_id" on public."supplier_visits" ("createdAt", "id");

create table if not exists public."sourcing_items" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."sourcing_items" enable row level security;
alter table public."sourcing_items" add column if not exists "visitId" text;
alter table public."sourcing_items" add column if not exists "supplierId" text;
alter table public."sourcing_items" add column if not exists "supplierName" text;
alter table public."sourcing_items" add column if not exists "productId" text;
alter table public."sourcing_items" add column if not exists "lineId" text;
alter table public."sourcing_items" add column if not exists "category" text;
alter table public."sourcing_items" add column if not exists "name" text;
alter table public."sourcing_items" add column if not exists "description" text;
alter table public."sourcing_items" add column if not exists "supplierSku" text;
alter table public."sourcing_items" add column if not exists "material" text;
alter table public."sourcing_items" add column if not exists "color" text;
alter table public."sourcing_items" add column if not exists "pantone" text;
alter table public."sourcing_items" add column if not exists "price" double precision;
alter table public."sourcing_items" add column if not exists "currency" text;
alter table public."sourcing_items" add column if not exists "moq" bigint;
alter table public."sourcing_items" add column if not exists "masterBoxQty" bigint;
alter table public."sourcing_items" add column if not exists "innerBoxQty" bigint;
alter table public."sourcing_items" add column if not exists "netWeightKg" double precision;
alter table public."sourcing_items" add column if not exists "grossWeightKg" double precision;
alter table public."sourcing_items" add column if not exists "widthCm" double precision;
alter table public."sourcing_items" add column if not exists "heightCm" double precision;
alter table public."sourcing_items" add column if not exists "lengthCm" double precision;
alter table public."sourcing_items" add column if not exists "boxLengthCm" double precision;
alter table public."sourcing_items" add column if not exists "boxWidthCm" double precision;
alter table public."sourcing_items" add column if not exists "boxHeightCm" double precision;
alter table public."sourcing_items" add column if not exists "cbm" double precision;
alter table public."sourcing_items" add column if not exists "conditions" text;
alter table public."sourcing_items" add column if not exists "notes" text;
alter table public."sourcing_items" add column if not exists "foundAt" timestamptz;
alter table public."sourcing_items" add column if not exists "city" text;
alter table public."sourcing_items" add column if not exists "location" text;
alter table public."sourcing_items" add column if not exists "status" text;
alter table public."sourcing_items" add column if not exists "primaryPhotoDocumentId" text;
alter table public."sourcing_items" add column if not exists "createdByUserId" text;
alter table public."sourcing_items" add column if not exists "requestId" text;
alter table public."sourcing_items" add column if not exists "priceTiers" jsonb;
create index if not exists "sourcing_items_by_visit" on public."sourcing_items" ("visitId");
create index if not exists "sourcing_items_by_supplier" on public."sourcing_items" ("supplierId");
create index if not exists "sourcing_items_by_status" on public."sourcing_items" ("status");
create index if not exists "sourcing_items_created" on public."sourcing_items" ("createdAt");
create index if not exists "sourcing_items_created_id" on public."sourcing_items" ("createdAt", "id");
create index if not exists "sourcing_items_name_id" on public."sourcing_items" ("name", "id");

create table if not exists public."product_photos" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."product_photos" enable row level security;
alter table public."product_photos" add column if not exists "productId" text;
alter table public."product_photos" add column if not exists "sourcingItemId" text;
alter table public."product_photos" add column if not exists "orderId" text;
alter table public."product_photos" add column if not exists "documentId" text;
alter table public."product_photos" add column if not exists "kind" text;
alter table public."product_photos" add column if not exists "caption" text;
alter table public."product_photos" add column if not exists "takenAt" timestamptz;
alter table public."product_photos" add column if not exists "takenByUserId" text;
alter table public."product_photos" add column if not exists "derivedFromPhotoId" text;
alter table public."product_photos" add column if not exists "isPrimary" boolean;
alter table public."product_photos" add column if not exists "variantId" text;
create index if not exists "product_photos_by_product" on public."product_photos" ("productId");
create index if not exists "product_photos_by_item" on public."product_photos" ("sourcingItemId");
create index if not exists "product_photos_by_order" on public."product_photos" ("orderId");
create index if not exists "product_photos_by_variant" on public."product_photos" ("variantId");
create index if not exists "product_photos_created" on public."product_photos" ("createdAt");
create index if not exists "product_photos_created_id" on public."product_photos" ("createdAt", "id");

create table if not exists public."measurements" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."measurements" enable row level security;
alter table public."measurements" add column if not exists "entity" text;
alter table public."measurements" add column if not exists "entityId" text;
alter table public."measurements" add column if not exists "kind" text;
alter table public."measurements" add column if not exists "declaredValue" double precision;
alter table public."measurements" add column if not exists "measuredValue" double precision;
alter table public."measurements" add column if not exists "unit" text;
alter table public."measurements" add column if not exists "photoDocumentId" text;
alter table public."measurements" add column if not exists "measuredByUserId" text;
alter table public."measurements" add column if not exists "measuredAt" timestamptz;
alter table public."measurements" add column if not exists "note" text;
create index if not exists "measurements_by_entity" on public."measurements" ("entity", "entityId");
create index if not exists "measurements_created" on public."measurements" ("createdAt");
create index if not exists "measurements_created_id" on public."measurements" ("createdAt", "id");

create table if not exists public."purchase_snapshots" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."purchase_snapshots" enable row level security;
alter table public."purchase_snapshots" add column if not exists "orderId" text;
alter table public."purchase_snapshots" add column if not exists "orderItemId" text;
alter table public."purchase_snapshots" add column if not exists "requestId" text;
alter table public."purchase_snapshots" add column if not exists "productId" text;
alter table public."purchase_snapshots" add column if not exists "sourcingItemId" text;
alter table public."purchase_snapshots" add column if not exists "supplierId" text;
alter table public."purchase_snapshots" add column if not exists "name" text;
alter table public."purchase_snapshots" add column if not exists "supplierSku" text;
alter table public."purchase_snapshots" add column if not exists "material" text;
alter table public."purchase_snapshots" add column if not exists "color" text;
alter table public."purchase_snapshots" add column if not exists "pantone" text;
alter table public."purchase_snapshots" add column if not exists "unitPrice" double precision;
alter table public."purchase_snapshots" add column if not exists "currency" text;
alter table public."purchase_snapshots" add column if not exists "quantity" double precision;
alter table public."purchase_snapshots" add column if not exists "unit" text;
alter table public."purchase_snapshots" add column if not exists "moq" bigint;
alter table public."purchase_snapshots" add column if not exists "masterBoxQty" bigint;
alter table public."purchase_snapshots" add column if not exists "innerBoxQty" bigint;
alter table public."purchase_snapshots" add column if not exists "netWeightKg" double precision;
alter table public."purchase_snapshots" add column if not exists "grossWeightKg" double precision;
alter table public."purchase_snapshots" add column if not exists "widthCm" double precision;
alter table public."purchase_snapshots" add column if not exists "heightCm" double precision;
alter table public."purchase_snapshots" add column if not exists "lengthCm" double precision;
alter table public."purchase_snapshots" add column if not exists "boxLengthCm" double precision;
alter table public."purchase_snapshots" add column if not exists "boxWidthCm" double precision;
alter table public."purchase_snapshots" add column if not exists "boxHeightCm" double precision;
alter table public."purchase_snapshots" add column if not exists "cbm" double precision;
alter table public."purchase_snapshots" add column if not exists "specification" text;
alter table public."purchase_snapshots" add column if not exists "conditions" text;
alter table public."purchase_snapshots" add column if not exists "photoDocumentIds" jsonb;
alter table public."purchase_snapshots" add column if not exists "note" text;
alter table public."purchase_snapshots" add column if not exists "createdByUserId" text;
alter table public."purchase_snapshots" add column if not exists "ncm" text;
alter table public."purchase_snapshots" add column if not exists "variantId" text;
create index if not exists "purchase_snapshots_by_order" on public."purchase_snapshots" ("orderId");
create index if not exists "purchase_snapshots_created" on public."purchase_snapshots" ("createdAt");
create index if not exists "purchase_snapshots_created_id" on public."purchase_snapshots" ("createdAt", "id");
create index if not exists "purchase_snapshots_name_id" on public."purchase_snapshots" ("name", "id");

create table if not exists public."purchase_schedules" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."purchase_schedules" enable row level security;
alter table public."purchase_schedules" add column if not exists "productId" text;
alter table public."purchase_schedules" add column if not exists "sourcingItemId" text;
alter table public."purchase_schedules" add column if not exists "customerId" text;
alter table public."purchase_schedules" add column if not exists "supplierId" text;
alter table public."purchase_schedules" add column if not exists "requestId" text;
alter table public."purchase_schedules" add column if not exists "orderId" text;
alter table public."purchase_schedules" add column if not exists "sequence" bigint;
alter table public."purchase_schedules" add column if not exists "quantity" double precision;
alter table public."purchase_schedules" add column if not exists "unit" text;
alter table public."purchase_schedules" add column if not exists "scheduledFor" timestamptz;
alter table public."purchase_schedules" add column if not exists "periodLabel" text;
alter table public."purchase_schedules" add column if not exists "price" double precision;
alter table public."purchase_schedules" add column if not exists "currency" text;
alter table public."purchase_schedules" add column if not exists "status" text;
alter table public."purchase_schedules" add column if not exists "notes" text;
alter table public."purchase_schedules" add column if not exists "createdByUserId" text;
create index if not exists "purchase_schedules_by_product" on public."purchase_schedules" ("productId");
create index if not exists "purchase_schedules_by_customer" on public."purchase_schedules" ("customerId");
create index if not exists "purchase_schedules_created" on public."purchase_schedules" ("createdAt");
create index if not exists "purchase_schedules_created_id" on public."purchase_schedules" ("createdAt", "id");

create table if not exists public."containers" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."containers" enable row level security;
alter table public."containers" add column if not exists "code" text;
alter table public."containers" add column if not exists "type" text;
alter table public."containers" add column if not exists "capacityCbm" double precision;
alter table public."containers" add column if not exists "maxWeightKg" double precision;
alter table public."containers" add column if not exists "customerId" text;
alter table public."containers" add column if not exists "status" text;
alter table public."containers" add column if not exists "etd" timestamptz;
alter table public."containers" add column if not exists "eta" timestamptz;
alter table public."containers" add column if not exists "notes" text;
alter table public."containers" add column if not exists "createdByUserId" text;
alter table public."containers" add column if not exists "sankhyaCode" text;
alter table public."containers" add column if not exists "sankhyaChain" jsonb;
alter table public."containers" add column if not exists "supplierId" text;
create index if not exists "containers_by_sankhya" on public."containers" ("sankhyaCode");
create index if not exists "containers_by_customer" on public."containers" ("customerId");
create index if not exists "containers_by_status" on public."containers" ("status");
create index if not exists "containers_created" on public."containers" ("createdAt");
create index if not exists "containers_created_id" on public."containers" ("createdAt", "id");

create table if not exists public."container_items" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."container_items" enable row level security;
alter table public."container_items" add column if not exists "containerId" text;
alter table public."container_items" add column if not exists "orderId" text;
alter table public."container_items" add column if not exists "orderItemId" text;
alter table public."container_items" add column if not exists "productId" text;
alter table public."container_items" add column if not exists "name" text;
alter table public."container_items" add column if not exists "quantity" double precision;
alter table public."container_items" add column if not exists "unit" text;
alter table public."container_items" add column if not exists "unitsPerBox" bigint;
alter table public."container_items" add column if not exists "boxCount" bigint;
alter table public."container_items" add column if not exists "cbmPerBox" double precision;
alter table public."container_items" add column if not exists "weightPerBoxKg" double precision;
create index if not exists "container_items_by_container" on public."container_items" ("containerId");
create index if not exists "container_items_by_order" on public."container_items" ("orderId");
create index if not exists "container_items_created" on public."container_items" ("createdAt");
create index if not exists "container_items_created_id" on public."container_items" ("createdAt", "id");
create index if not exists "container_items_name_id" on public."container_items" ("name", "id");

create table if not exists public."acknowledgements" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."acknowledgements" enable row level security;
alter table public."acknowledgements" add column if not exists "entity" text;
alter table public."acknowledgements" add column if not exists "entityId" text;
alter table public."acknowledgements" add column if not exists "userId" text;
alter table public."acknowledgements" add column if not exists "partyId" text;
alter table public."acknowledgements" add column if not exists "event" text;
alter table public."acknowledgements" add column if not exists "at" timestamptz;
alter table public."acknowledgements" add column if not exists "note" text;
create index if not exists "acknowledgements_by_entity" on public."acknowledgements" ("entity", "entityId");
create index if not exists "acknowledgements_created" on public."acknowledgements" ("createdAt");
create index if not exists "acknowledgements_created_id" on public."acknowledgements" ("createdAt", "id");

create table if not exists public."review_items" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."review_items" enable row level security;
alter table public."review_items" add column if not exists "orderId" text;
alter table public."review_items" add column if not exists "entity" text;
alter table public."review_items" add column if not exists "entityId" text;
alter table public."review_items" add column if not exists "rule" text;
alter table public."review_items" add column if not exists "problem" text;
alter table public."review_items" add column if not exists "expected" text;
alter table public."review_items" add column if not exists "found" text;
alter table public."review_items" add column if not exists "responsibleRole" text;
alter table public."review_items" add column if not exists "action" text;
alter table public."review_items" add column if not exists "link" text;
alter table public."review_items" add column if not exists "status" text;
alter table public."review_items" add column if not exists "resolvedByUserId" text;
alter table public."review_items" add column if not exists "resolvedAt" timestamptz;
alter table public."review_items" add column if not exists "resolutionNote" text;
create index if not exists "review_items_by_status" on public."review_items" ("status");
create index if not exists "review_items_by_order" on public."review_items" ("orderId");
create index if not exists "review_items_created" on public."review_items" ("createdAt");
create index if not exists "review_items_created_id" on public."review_items" ("createdAt", "id");

create table if not exists public."inspection_results" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."inspection_results" enable row level security;
alter table public."inspection_results" add column if not exists "orderId" text;
alter table public."inspection_results" add column if not exists "stageId" text;
alter table public."inspection_results" add column if not exists "snapshotId" text;
alter table public."inspection_results" add column if not exists "result" text;
alter table public."inspection_results" add column if not exists "comparisons" jsonb;
alter table public."inspection_results" add column if not exists "measuredByUserId" text;
alter table public."inspection_results" add column if not exists "comparedAt" timestamptz;
alter table public."inspection_results" add column if not exists "note" text;
create index if not exists "inspection_results_by_order" on public."inspection_results" ("orderId");
create index if not exists "inspection_results_created" on public."inspection_results" ("createdAt");
create index if not exists "inspection_results_created_id" on public."inspection_results" ("createdAt", "id");

create table if not exists public."import_batches" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."import_batches" enable row level security;
alter table public."import_batches" add column if not exists "entity" text;
alter table public."import_batches" add column if not exists "fileDocumentId" text;
alter table public."import_batches" add column if not exists "fileName" text;
alter table public."import_batches" add column if not exists "sheetName" text;
alter table public."import_batches" add column if not exists "headers" jsonb;
alter table public."import_batches" add column if not exists "rows" jsonb;
alter table public."import_batches" add column if not exists "mapping" jsonb;
alter table public."import_batches" add column if not exists "decisions" jsonb;
alter table public."import_batches" add column if not exists "status" text;
alter table public."import_batches" add column if not exists "summary" jsonb;
alter table public."import_batches" add column if not exists "rowCount" bigint;
alter table public."import_batches" add column if not exists "createdByUserId" text;
create index if not exists "import_batches_by_status" on public."import_batches" ("status");
create index if not exists "import_batches_created" on public."import_batches" ("createdAt");
create index if not exists "import_batches_created_id" on public."import_batches" ("createdAt", "id");

create table if not exists public."tax_classifications" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."tax_classifications" enable row level security;
alter table public."tax_classifications" add column if not exists "productId" text;
alter table public."tax_classifications" add column if not exists "ncm" text;
alter table public."tax_classifications" add column if not exists "description" text;
alter table public."tax_classifications" add column if not exists "taxes" jsonb;
alter table public."tax_classifications" add column if not exists "adminTreatment" text;
alter table public."tax_classifications" add column if not exists "notes" text;
alter table public."tax_classifications" add column if not exists "source" text;
alter table public."tax_classifications" add column if not exists "sourceRef" text;
alter table public."tax_classifications" add column if not exists "status" text;
alter table public."tax_classifications" add column if not exists "suggestedByUserId" text;
alter table public."tax_classifications" add column if not exists "validatedByUserId" text;
alter table public."tax_classifications" add column if not exists "validatedAt" timestamptz;
create index if not exists "tax_classifications_by_product" on public."tax_classifications" ("productId");
create index if not exists "tax_classifications_created" on public."tax_classifications" ("createdAt");
create index if not exists "tax_classifications_created_id" on public."tax_classifications" ("createdAt", "id");

create table if not exists public."certifications" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."certifications" enable row level security;
alter table public."certifications" add column if not exists "entity" text;
alter table public."certifications" add column if not exists "entityId" text;
alter table public."certifications" add column if not exists "kind" text;
alter table public."certifications" add column if not exists "name" text;
alter table public."certifications" add column if not exists "issuer" text;
alter table public."certifications" add column if not exists "number" text;
alter table public."certifications" add column if not exists "validUntil" timestamptz;
alter table public."certifications" add column if not exists "documentId" text;
alter table public."certifications" add column if not exists "status" text;
alter table public."certifications" add column if not exists "notes" text;
alter table public."certifications" add column if not exists "createdByUserId" text;
alter table public."certifications" add column if not exists "validatedByUserId" text;
alter table public."certifications" add column if not exists "validatedAt" timestamptz;
create index if not exists "certifications_by_entity" on public."certifications" ("entity", "entityId");
create index if not exists "certifications_by_status" on public."certifications" ("status");
create index if not exists "certifications_created" on public."certifications" ("createdAt");
create index if not exists "certifications_created_id" on public."certifications" ("createdAt", "id");
create index if not exists "certifications_name_id" on public."certifications" ("name", "id");

create table if not exists public."after_sales" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."after_sales" enable row level security;
alter table public."after_sales" add column if not exists "orderId" text;
alter table public."after_sales" add column if not exists "customerId" text;
alter table public."after_sales" add column if not exists "status" text;
alter table public."after_sales" add column if not exists "rating" bigint;
alter table public."after_sales" add column if not exists "experience" text;
alter table public."after_sales" add column if not exists "problems" text;
alter table public."after_sales" add column if not exists "perceivedCosts" text;
alter table public."after_sales" add column if not exists "suggestions" text;
alter table public."after_sales" add column if not exists "repurchaseInterest" text;
alter table public."after_sales" add column if not exists "answeredAt" timestamptz;
alter table public."after_sales" add column if not exists "answeredByUserId" text;
alter table public."after_sales" add column if not exists "closedAt" timestamptz;
alter table public."after_sales" add column if not exists "notes" text;
create index if not exists "after_sales_by_order" on public."after_sales" ("orderId");
create index if not exists "after_sales_by_customer" on public."after_sales" ("customerId");
create index if not exists "after_sales_by_status" on public."after_sales" ("status");
create index if not exists "after_sales_created" on public."after_sales" ("createdAt");
create index if not exists "after_sales_created_id" on public."after_sales" ("createdAt", "id");

create table if not exists public."ai_suggestions" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."ai_suggestions" enable row level security;
alter table public."ai_suggestions" add column if not exists "entity" text;
alter table public."ai_suggestions" add column if not exists "entityId" text;
alter table public."ai_suggestions" add column if not exists "kind" text;
alter table public."ai_suggestions" add column if not exists "source" text;
alter table public."ai_suggestions" add column if not exists "model" text;
alter table public."ai_suggestions" add column if not exists "prompt" text;
alter table public."ai_suggestions" add column if not exists "imageDocumentId" text;
alter table public."ai_suggestions" add column if not exists "fields" jsonb;
alter table public."ai_suggestions" add column if not exists "rawText" text;
alter table public."ai_suggestions" add column if not exists "status" text;
alter table public."ai_suggestions" add column if not exists "requestedByUserId" text;
alter table public."ai_suggestions" add column if not exists "decidedByUserId" text;
alter table public."ai_suggestions" add column if not exists "decidedAt" timestamptz;
alter table public."ai_suggestions" add column if not exists "note" text;
create index if not exists "ai_suggestions_by_entity" on public."ai_suggestions" ("entity", "entityId");
create index if not exists "ai_suggestions_created" on public."ai_suggestions" ("createdAt");
create index if not exists "ai_suggestions_created_id" on public."ai_suggestions" ("createdAt", "id");

create table if not exists public."marketing_kits" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."marketing_kits" enable row level security;
alter table public."marketing_kits" add column if not exists "productId" text;
alter table public."marketing_kits" add column if not exists "customerId" text;
alter table public."marketing_kits" add column if not exists "name" text;
alter table public."marketing_kits" add column if not exists "price" double precision;
alter table public."marketing_kits" add column if not exists "currency" text;
alter table public."marketing_kits" add column if not exists "status" text;
alter table public."marketing_kits" add column if not exists "concept" text;
alter table public."marketing_kits" add column if not exists "slogan" text;
alter table public."marketing_kits" add column if not exists "description" text;
alter table public."marketing_kits" add column if not exists "campaign" text;
alter table public."marketing_kits" add column if not exists "colors" jsonb;
alter table public."marketing_kits" add column if not exists "pantone" text;
alter table public."marketing_kits" add column if not exists "previewDocumentIds" jsonb;
alter table public."marketing_kits" add column if not exists "releasedDocumentIds" jsonb;
alter table public."marketing_kits" add column if not exists "paymentId" text;
alter table public."marketing_kits" add column if not exists "offeredAt" timestamptz;
alter table public."marketing_kits" add column if not exists "purchasedAt" timestamptz;
alter table public."marketing_kits" add column if not exists "paidAt" timestamptz;
alter table public."marketing_kits" add column if not exists "releasedAt" timestamptz;
alter table public."marketing_kits" add column if not exists "notes" text;
alter table public."marketing_kits" add column if not exists "createdByUserId" text;
create index if not exists "marketing_kits_by_product" on public."marketing_kits" ("productId");
create index if not exists "marketing_kits_by_customer" on public."marketing_kits" ("customerId");
create index if not exists "marketing_kits_by_status" on public."marketing_kits" ("status");
create index if not exists "marketing_kits_created" on public."marketing_kits" ("createdAt");
create index if not exists "marketing_kits_created_id" on public."marketing_kits" ("createdAt", "id");
create index if not exists "marketing_kits_name_id" on public."marketing_kits" ("name", "id");

create table if not exists public."product_lookups" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."product_lookups" enable row level security;
alter table public."product_lookups" add column if not exists "userId" text;
alter table public."product_lookups" add column if not exists "customerId" text;
alter table public."product_lookups" add column if not exists "imageDocumentId" text;
alter table public."product_lookups" add column if not exists "url" text;
alter table public."product_lookups" add column if not exists "linkStatus" text;
alter table public."product_lookups" add column if not exists "linkTitle" text;
alter table public."product_lookups" add column if not exists "linkSiteName" text;
alter table public."product_lookups" add column if not exists "linkImageUrl" text;
alter table public."product_lookups" add column if not exists "linkPrice" text;
alter table public."product_lookups" add column if not exists "imageHash" text;
alter table public."product_lookups" add column if not exists "linkImageHash" text;
alter table public."product_lookups" add column if not exists "matches" jsonb;
alter table public."product_lookups" add column if not exists "suggestions" jsonb;
alter table public."product_lookups" add column if not exists "aiSource" text;
alter table public."product_lookups" add column if not exists "aiError" text;
alter table public."product_lookups" add column if not exists "requestId" text;
create index if not exists "product_lookups_by_user" on public."product_lookups" ("userId");
create index if not exists "product_lookups_created" on public."product_lookups" ("createdAt");
create index if not exists "product_lookups_created_id" on public."product_lookups" ("createdAt", "id");

create table if not exists public."purchase_sheets" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."purchase_sheets" enable row level security;
alter table public."purchase_sheets" add column if not exists "orderId" text;
alter table public."purchase_sheets" add column if not exists "productId" text;
alter table public."purchase_sheets" add column if not exists "sheetDate" timestamptz;
alter table public."purchase_sheets" add column if not exists "location" text;
alter table public."purchase_sheets" add column if not exists "supplierName" text;
alter table public."purchase_sheets" add column if not exists "supplierStore" text;
alter table public."purchase_sheets" add column if not exists "supplierPhone" text;
alter table public."purchase_sheets" add column if not exists "factoryItemCode" text;
alter table public."purchase_sheets" add column if not exists "incoterm" text;
alter table public."purchase_sheets" add column if not exists "currency" text;
alter table public."purchase_sheets" add column if not exists "price" double precision;
alter table public."purchase_sheets" add column if not exists "moq" bigint;
alter table public."purchase_sheets" add column if not exists "masterCartonQty" bigint;
alter table public."purchase_sheets" add column if not exists "innerQty" bigint;
alter table public."purchase_sheets" add column if not exists "netWeightPcKg" double precision;
alter table public."purchase_sheets" add column if not exists "grossWeightPcKg" double precision;
alter table public."purchase_sheets" add column if not exists "cbmPerCarton" double precision;
alter table public."purchase_sheets" add column if not exists "heightCm" double precision;
alter table public."purchase_sheets" add column if not exists "widthCm" double precision;
alter table public."purchase_sheets" add column if not exists "lengthCm" double precision;
alter table public."purchase_sheets" add column if not exists "capacityMl" double precision;
alter table public."purchase_sheets" add column if not exists "packageType" text;
alter table public."purchase_sheets" add column if not exists "colorAssortment" text;
alter table public."purchase_sheets" add column if not exists "colorPantones" jsonb;
alter table public."purchase_sheets" add column if not exists "material" text;
alter table public."purchase_sheets" add column if not exists "powerSource" text;
alter table public."purchase_sheets" add column if not exists "powerDetail" text;
alter table public."purchase_sheets" add column if not exists "productionStartAt" timestamptz;
alter table public."purchase_sheets" add column if not exists "lots" jsonb;
alter table public."purchase_sheets" add column if not exists "containerType" text;
alter table public."purchase_sheets" add column if not exists "ncm" text;
alter table public."purchase_sheets" add column if not exists "importTaxPercent" double precision;
alter table public."purchase_sheets" add column if not exists "ipiPercent" double precision;
alter table public."purchase_sheets" add column if not exists "ecommerceDescription" text;
alter table public."purchase_sheets" add column if not exists "notes" text;
alter table public."purchase_sheets" add column if not exists "updatedByUserId" text;
alter table public."purchase_sheets" add column if not exists "completedAt" timestamptz;
alter table public."purchase_sheets" add column if not exists "dumping" text;
alter table public."purchase_sheets" add column if not exists "dumpingNote" text;
alter table public."purchase_sheets" add column if not exists "dumpingReleasedByUserId" text;
alter table public."purchase_sheets" add column if not exists "dumpingReleasedAt" timestamptz;
alter table public."purchase_sheets" add column if not exists "averagePrice" double precision;
alter table public."purchase_sheets" add column if not exists "averageWeightPcKg" double precision;
alter table public."purchase_sheets" add column if not exists "certificationRequired" text;
alter table public."purchase_sheets" add column if not exists "certificationNote" text;
create unique index if not exists "purchase_sheets_by_order" on public."purchase_sheets" ("orderId");
create index if not exists "purchase_sheets_created" on public."purchase_sheets" ("createdAt");
create index if not exists "purchase_sheets_created_id" on public."purchase_sheets" ("createdAt", "id");

create table if not exists public."freight_quotes" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."freight_quotes" enable row level security;
alter table public."freight_quotes" add column if not exists "requestId" text;
alter table public."freight_quotes" add column if not exists "orderId" text;
alter table public."freight_quotes" add column if not exists "carrierId" text;
alter table public."freight_quotes" add column if not exists "status" text;
alter table public."freight_quotes" add column if not exists "totalCbm" double precision;
alter table public."freight_quotes" add column if not exists "cartons" bigint;
alter table public."freight_quotes" add column if not exists "grossWeightKg" double precision;
alter table public."freight_quotes" add column if not exists "amount" double precision;
alter table public."freight_quotes" add column if not exists "currency" text;
alter table public."freight_quotes" add column if not exists "transitDays" bigint;
alter table public."freight_quotes" add column if not exists "validUntil" timestamptz;
alter table public."freight_quotes" add column if not exists "notes" text;
alter table public."freight_quotes" add column if not exists "answeredByUserId" text;
alter table public."freight_quotes" add column if not exists "answeredAt" timestamptz;
create index if not exists "freight_quotes_by_order" on public."freight_quotes" ("orderId");
create index if not exists "freight_quotes_by_request" on public."freight_quotes" ("requestId");
create index if not exists "freight_quotes_by_carrier_status" on public."freight_quotes" ("carrierId", "status");
create index if not exists "freight_quotes_created" on public."freight_quotes" ("createdAt");
create index if not exists "freight_quotes_created_id" on public."freight_quotes" ("createdAt", "id");

create table if not exists public."product_suppliers" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."product_suppliers" enable row level security;
alter table public."product_suppliers" add column if not exists "productId" text;
alter table public."product_suppliers" add column if not exists "supplierId" text;
alter table public."product_suppliers" add column if not exists "supplierSku" text;
alter table public."product_suppliers" add column if not exists "price" double precision;
alter table public."product_suppliers" add column if not exists "currency" text;
alter table public."product_suppliers" add column if not exists "moq" bigint;
alter table public."product_suppliers" add column if not exists "leadTimeDays" bigint;
alter table public."product_suppliers" add column if not exists "source" text;
alter table public."product_suppliers" add column if not exists "createdByUserId" text;
alter table public."product_suppliers" add column if not exists "sankhyaPorts" jsonb;
alter table public."product_suppliers" add column if not exists "sankhyaPreferential" boolean;
alter table public."product_suppliers" add column if not exists "sankhyaValidated" boolean;
alter table public."product_suppliers" add column if not exists "sankhyaLastPurchaseAt" timestamptz;
alter table public."product_suppliers" add column if not exists "sankhyaListed" boolean;
alter table public."product_suppliers" add column if not exists "sankhyaSyncedAt" timestamptz;
create unique index if not exists "product_suppliers_product_supplier_unique" on public."product_suppliers" ("productId", "supplierId");
create index if not exists "product_suppliers_by_supplier" on public."product_suppliers" ("supplierId");
create index if not exists "product_suppliers_created" on public."product_suppliers" ("createdAt");
create index if not exists "product_suppliers_created_id" on public."product_suppliers" ("createdAt", "id");

create table if not exists public."sheet_readings" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."sheet_readings" enable row level security;
alter table public."sheet_readings" add column if not exists "scope" text;
alter table public."sheet_readings" add column if not exists "sheetKey" text;
alter table public."sheet_readings" add column if not exists "documentId" text;
alter table public."sheet_readings" add column if not exists "source" text;
alter table public."sheet_readings" add column if not exists "model" text;
alter table public."sheet_readings" add column if not exists "fields" jsonb;
alter table public."sheet_readings" add column if not exists "notes" text;
alter table public."sheet_readings" add column if not exists "rawText" text;
alter table public."sheet_readings" add column if not exists "resolutions" jsonb;
alter table public."sheet_readings" add column if not exists "createdByUserId" text;
create index if not exists "sheet_readings_by_sheet" on public."sheet_readings" ("sheetKey");
create index if not exists "sheet_readings_created" on public."sheet_readings" ("createdAt");
create index if not exists "sheet_readings_created_id" on public."sheet_readings" ("createdAt", "id");

create table if not exists public."manufacturer_cards" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."manufacturer_cards" enable row level security;
alter table public."manufacturer_cards" add column if not exists "productId" text;
alter table public."manufacturer_cards" add column if not exists "supplierId" text;
alter table public."manufacturer_cards" add column if not exists "documentId" text;
alter table public."manufacturer_cards" add column if not exists "companyName" text;
alter table public."manufacturer_cards" add column if not exists "contactName" text;
alter table public."manufacturer_cards" add column if not exists "phone" text;
alter table public."manufacturer_cards" add column if not exists "email" text;
alter table public."manufacturer_cards" add column if not exists "storeAddress" text;
alter table public."manufacturer_cards" add column if not exists "factoryAddress" text;
alter table public."manufacturer_cards" add column if not exists "isFactory" boolean;
alter table public."manufacturer_cards" add column if not exists "notes" text;
alter table public."manufacturer_cards" add column if not exists "source" text;
alter table public."manufacturer_cards" add column if not exists "createdByUserId" text;
create index if not exists "manufacturer_cards_by_product" on public."manufacturer_cards" ("productId");
create index if not exists "manufacturer_cards_by_supplier" on public."manufacturer_cards" ("supplierId");
create index if not exists "manufacturer_cards_created" on public."manufacturer_cards" ("createdAt");
create index if not exists "manufacturer_cards_created_id" on public."manufacturer_cards" ("createdAt", "id");

create table if not exists public."request_drafts" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."request_drafts" enable row level security;
alter table public."request_drafts" add column if not exists "userId" text;
alter table public."request_drafts" add column if not exists "customerId" text;
alter table public."request_drafts" add column if not exists "customerName" text;
alter table public."request_drafts" add column if not exists "title" text;
alter table public."request_drafts" add column if not exists "itemCount" bigint;
alter table public."request_drafts" add column if not exists "payload" jsonb;
alter table public."request_drafts" add column if not exists "number" bigint;
create index if not exists "request_drafts_by_user" on public."request_drafts" ("userId");
create index if not exists "request_drafts_created" on public."request_drafts" ("createdAt");
create index if not exists "request_drafts_created_id" on public."request_drafts" ("createdAt", "id");

create table if not exists public."form_drafts" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."form_drafts" enable row level security;
alter table public."form_drafts" add column if not exists "userId" text;
alter table public."form_drafts" add column if not exists "form" text;
alter table public."form_drafts" add column if not exists "payload" jsonb;
create unique index if not exists "form_drafts_by_user_form" on public."form_drafts" ("userId", "form");
create index if not exists "form_drafts_created" on public."form_drafts" ("createdAt");
create index if not exists "form_drafts_created_id" on public."form_drafts" ("createdAt", "id");

create table if not exists public."customer_groups" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."customer_groups" enable row level security;
alter table public."customer_groups" add column if not exists "name" text;
alter table public."customer_groups" add column if not exists "notes" text;
alter table public."customer_groups" add column if not exists "ownerUserId" text;
alter table public."customer_groups" add column if not exists "archivedAt" timestamptz;
alter table public."customer_groups" add column if not exists "createdByUserId" text;
create index if not exists "customer_groups_by_owner" on public."customer_groups" ("ownerUserId");
create index if not exists "customer_groups_created" on public."customer_groups" ("createdAt");
create index if not exists "customer_groups_created_id" on public."customer_groups" ("createdAt", "id");
create index if not exists "customer_groups_name_id" on public."customer_groups" ("name", "id");

create table if not exists public."economic_group_shares" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."economic_group_shares" enable row level security;
alter table public."economic_group_shares" add column if not exists "groupCode" text;
alter table public."economic_group_shares" add column if not exists "customerId" text;
alter table public."economic_group_shares" add column if not exists "percent" double precision;
alter table public."economic_group_shares" add column if not exists "updatedByUserId" text;
create index if not exists "economic_group_shares_by_group" on public."economic_group_shares" ("groupCode");
create index if not exists "economic_group_shares_by_customer" on public."economic_group_shares" ("customerId");
create index if not exists "economic_group_shares_created" on public."economic_group_shares" ("createdAt");
create index if not exists "economic_group_shares_created_id" on public."economic_group_shares" ("createdAt", "id");

create table if not exists public."delivery_round_shares" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."delivery_round_shares" enable row level security;
alter table public."delivery_round_shares" add column if not exists "customerId" text;
alter table public."delivery_round_shares" add column if not exists "rounds" bigint;
alter table public."delivery_round_shares" add column if not exists "percents" jsonb;
alter table public."delivery_round_shares" add column if not exists "updatedByUserId" text;
create index if not exists "delivery_round_shares_by_customer" on public."delivery_round_shares" ("customerId");
create index if not exists "delivery_round_shares_created" on public."delivery_round_shares" ("createdAt");
create index if not exists "delivery_round_shares_created_id" on public."delivery_round_shares" ("createdAt", "id");

create table if not exists public."customer_attendances" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."customer_attendances" enable row level security;
alter table public."customer_attendances" add column if not exists "customerId" text;
alter table public."customer_attendances" add column if not exists "attendedByUserId" text;
alter table public."customer_attendances" add column if not exists "channel" text;
alter table public."customer_attendances" add column if not exists "occurredAt" timestamptz;
alter table public."customer_attendances" add column if not exists "summary" text;
alter table public."customer_attendances" add column if not exists "nextStep" text;
alter table public."customer_attendances" add column if not exists "documentIds" jsonb;
alter table public."customer_attendances" add column if not exists "status" text;
alter table public."customer_attendances" add column if not exists "linkNonce" text;
alter table public."customer_attendances" add column if not exists "linkExpiresAt" timestamptz;
alter table public."customer_attendances" add column if not exists "customerAnsweredAt" timestamptz;
alter table public."customer_attendances" add column if not exists "customerName" text;
alter table public."customer_attendances" add column if not exists "customerNote" text;
alter table public."customer_attendances" add column if not exists "cancelledAt" timestamptz;
alter table public."customer_attendances" add column if not exists "cancelledByUserId" text;
create index if not exists "customer_attendances_by_customer" on public."customer_attendances" ("customerId");
create index if not exists "customer_attendances_by_attendant" on public."customer_attendances" ("attendedByUserId");
create index if not exists "customer_attendances_by_status" on public."customer_attendances" ("status");
create index if not exists "customer_attendances_created" on public."customer_attendances" ("createdAt");
create index if not exists "customer_attendances_created_id" on public."customer_attendances" ("createdAt", "id");

create table if not exists public."customer_sales_monthly" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."customer_sales_monthly" enable row level security;
alter table public."customer_sales_monthly" add column if not exists "customerId" text;
alter table public."customer_sales_monthly" add column if not exists "month" text;
alter table public."customer_sales_monthly" add column if not exists "productCode" text;
alter table public."customer_sales_monthly" add column if not exists "productName" text;
alter table public."customer_sales_monthly" add column if not exists "unit" text;
alter table public."customer_sales_monthly" add column if not exists "quantity" double precision;
alter table public."customer_sales_monthly" add column if not exists "pieces" double precision;
alter table public."customer_sales_monthly" add column if not exists "valueBrl" double precision;
alter table public."customer_sales_monthly" add column if not exists "orders" bigint;
alter table public."customer_sales_monthly" add column if not exists "lastOrderDate" text;
alter table public."customer_sales_monthly" add column if not exists "loadedAt" timestamptz;
create index if not exists "customer_sales_monthly_by_customer" on public."customer_sales_monthly" ("customerId");
create index if not exists "customer_sales_monthly_by_customer_month" on public."customer_sales_monthly" ("customerId", "month");
create index if not exists "customer_sales_monthly_created" on public."customer_sales_monthly" ("createdAt");
create index if not exists "customer_sales_monthly_created_id" on public."customer_sales_monthly" ("createdAt", "id");

create table if not exists public."sankhya_stage_rows" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."sankhya_stage_rows" enable row level security;
alter table public."sankhya_stage_rows" add column if not exists "dataset" text;
alter table public."sankhya_stage_rows" add column if not exists "rowKey" text;
alter table public."sankhya_stage_rows" add column if not exists "nunota" bigint;
alter table public."sankhya_stage_rows" add column if not exists "runId" text;
alter table public."sankhya_stage_rows" add column if not exists "row" jsonb;
alter table public."sankhya_stage_rows" add column if not exists "loadedAt" timestamptz;
create index if not exists "sankhya_stage_rows_by_dataset_nunota" on public."sankhya_stage_rows" ("dataset", "nunota");
create index if not exists "sankhya_stage_rows_created" on public."sankhya_stage_rows" ("createdAt");
create index if not exists "sankhya_stage_rows_created_id" on public."sankhya_stage_rows" ("createdAt", "id");

create table if not exists public."sankhya_projection" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."sankhya_projection" enable row level security;
alter table public."sankhya_projection" add column if not exists "kind" text;
alter table public."sankhya_projection" add column if not exists "key" text;
alter table public."sankhya_projection" add column if not exists "situation" text;
alter table public."sankhya_projection" add column if not exists "milestone" text;
alter table public."sankhya_projection" add column if not exists "top" bigint;
alter table public."sankhya_projection" add column if not exists "supplierCode" text;
alter table public."sankhya_projection" add column if not exists "supplierName" text;
alter table public."sankhya_projection" add column if not exists "shipmentState" text;
alter table public."sankhya_projection" add column if not exists "data" jsonb;
alter table public."sankhya_projection" add column if not exists "computedAt" timestamptz;
create index if not exists "sankhya_projection_by_kind_situation" on public."sankhya_projection" ("kind", "situation");
create index if not exists "sankhya_projection_created" on public."sankhya_projection" ("createdAt");
create index if not exists "sankhya_projection_created_id" on public."sankhya_projection" ("createdAt", "id");

create table if not exists public."customer_sales_loads" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."customer_sales_loads" enable row level security;
alter table public."customer_sales_loads" add column if not exists "customerId" text;
alter table public."customer_sales_loads" add column if not exists "loadedAt" timestamptz;
alter table public."customer_sales_loads" add column if not exists "triedAt" timestamptz;
alter table public."customer_sales_loads" add column if not exists "lastOrderDate" text;
alter table public."customer_sales_loads" add column if not exists "rows" bigint;
alter table public."customer_sales_loads" add column if not exists "complete" boolean;
alter table public."customer_sales_loads" add column if not exists "error" text;
create index if not exists "customer_sales_loads_by_customer" on public."customer_sales_loads" ("customerId");
create index if not exists "customer_sales_loads_created" on public."customer_sales_loads" ("createdAt");
create index if not exists "customer_sales_loads_created_id" on public."customer_sales_loads" ("createdAt", "id");

create table if not exists public."trade_activities" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."trade_activities" enable row level security;
alter table public."trade_activities" add column if not exists "title" text;
alter table public."trade_activities" add column if not exists "description" text;
alter table public."trade_activities" add column if not exists "customerId" text;
alter table public."trade_activities" add column if not exists "groupId" text;
alter table public."trade_activities" add column if not exists "productCode" text;
alter table public."trade_activities" add column if not exists "productName" text;
alter table public."trade_activities" add column if not exists "focus" text;
alter table public."trade_activities" add column if not exists "responsibleUserId" text;
alter table public."trade_activities" add column if not exists "dueDate" text;
alter table public."trade_activities" add column if not exists "status" text;
alter table public."trade_activities" add column if not exists "notes" text;
alter table public."trade_activities" add column if not exists "documentIds" jsonb;
alter table public."trade_activities" add column if not exists "doneAt" timestamptz;
alter table public."trade_activities" add column if not exists "doneByUserId" text;
alter table public."trade_activities" add column if not exists "cancelledAt" timestamptz;
alter table public."trade_activities" add column if not exists "createdByUserId" text;
create index if not exists "trade_activities_by_customer" on public."trade_activities" ("customerId");
create index if not exists "trade_activities_by_group" on public."trade_activities" ("groupId");
create index if not exists "trade_activities_by_responsible" on public."trade_activities" ("responsibleUserId");
create index if not exists "trade_activities_by_status" on public."trade_activities" ("status");
create index if not exists "trade_activities_created" on public."trade_activities" ("createdAt");
create index if not exists "trade_activities_created_id" on public."trade_activities" ("createdAt", "id");

create table if not exists public."cart_items" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."cart_items" enable row level security;
alter table public."cart_items" add column if not exists "userId" text;
alter table public."cart_items" add column if not exists "customerId" text;
alter table public."cart_items" add column if not exists "productId" text;
alter table public."cart_items" add column if not exists "quantity" bigint;
alter table public."cart_items" add column if not exists "notes" text;
alter table public."cart_items" add column if not exists "variantId" text;
create unique index if not exists "cart_items_user_product_variant_unique" on public."cart_items" ("userId", "productId", "variantId");
create index if not exists "cart_items_created" on public."cart_items" ("createdAt");
create index if not exists "cart_items_created_id" on public."cart_items" ("createdAt", "id");

create table if not exists public."freight_tariffs" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."freight_tariffs" enable row level security;
alter table public."freight_tariffs" add column if not exists "referenceDate" text;
alter table public."freight_tariffs" add column if not exists "fileName" text;
alter table public."freight_tariffs" add column if not exists "fileDocumentId" text;
alter table public."freight_tariffs" add column if not exists "status" text;
alter table public."freight_tariffs" add column if not exists "fx" double precision;
alter table public."freight_tariffs" add column if not exists "roadFreightBrl" double precision;
alter table public."freight_tariffs" add column if not exists "rateCount" bigint;
alter table public."freight_tariffs" add column if not exists "forwarderCount" bigint;
alter table public."freight_tariffs" add column if not exists "warningCount" bigint;
alter table public."freight_tariffs" add column if not exists "data" jsonb;
alter table public."freight_tariffs" add column if not exists "uploadedByUserId" text;
alter table public."freight_tariffs" add column if not exists "shippingLineId" text;
create index if not exists "freight_tariffs_by_status" on public."freight_tariffs" ("status");
create index if not exists "freight_tariffs_by_line" on public."freight_tariffs" ("shippingLineId", "status");
create index if not exists "freight_tariffs_created" on public."freight_tariffs" ("createdAt");
create index if not exists "freight_tariffs_created_id" on public."freight_tariffs" ("createdAt", "id");

create table if not exists public."product_variants" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."product_variants" enable row level security;
alter table public."product_variants" add column if not exists "productId" text;
alter table public."product_variants" add column if not exists "name" text;
alter table public."product_variants" add column if not exists "key" text;
alter table public."product_variants" add column if not exists "sortOrder" bigint;
alter table public."product_variants" add column if not exists "active" boolean;
alter table public."product_variants" add column if not exists "factoryItemCode" text;
alter table public."product_variants" add column if not exists "sizeText" text;
alter table public."product_variants" add column if not exists "price" double precision;
alter table public."product_variants" add column if not exists "currency" text;
alter table public."product_variants" add column if not exists "moq" bigint;
alter table public."product_variants" add column if not exists "masterBoxQty" bigint;
alter table public."product_variants" add column if not exists "innerBoxQty" bigint;
alter table public."product_variants" add column if not exists "netWeightKg" double precision;
alter table public."product_variants" add column if not exists "grossWeightKg" double precision;
alter table public."product_variants" add column if not exists "lengthCm" double precision;
alter table public."product_variants" add column if not exists "widthCm" double precision;
alter table public."product_variants" add column if not exists "heightCm" double precision;
alter table public."product_variants" add column if not exists "cbm" double precision;
alter table public."product_variants" add column if not exists "colorAssortment" text;
alter table public."product_variants" add column if not exists "material" text;
alter table public."product_variants" add column if not exists "packageType" text;
alter table public."product_variants" add column if not exists "capacityMl" double precision;
alter table public."product_variants" add column if not exists "notes" text;
alter table public."product_variants" add column if not exists "photoDocumentId" text;
alter table public."product_variants" add column if not exists "importBatchId" text;
create index if not exists "product_variants_by_product" on public."product_variants" ("productId");
create unique index if not exists "product_variants_product_key_unique" on public."product_variants" ("productId", "key");
create index if not exists "product_variants_created" on public."product_variants" ("createdAt");
create index if not exists "product_variants_created_id" on public."product_variants" ("createdAt", "id");
create index if not exists "product_variants_name_id" on public."product_variants" ("name", "id");

create table if not exists public."conversations" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."conversations" enable row level security;
alter table public."conversations" add column if not exists "partyId" text;
alter table public."conversations" add column if not exists "userId" text;
alter table public."conversations" add column if not exists "lastMessageAt" timestamptz;
alter table public."conversations" add column if not exists "lastMessagePreview" text;
alter table public."conversations" add column if not exists "status" text;
alter table public."conversations" add column if not exists "wellmixUserId" text;
alter table public."conversations" add column if not exists "externalUserId" text;
create index if not exists "conversations_by_party" on public."conversations" ("partyId");
create index if not exists "conversations_by_user" on public."conversations" ("userId");
create index if not exists "conversations_by_wellmix_user" on public."conversations" ("wellmixUserId");
create index if not exists "conversations_by_external_user" on public."conversations" ("externalUserId");
create index if not exists "conversations_created" on public."conversations" ("createdAt");
create index if not exists "conversations_created_id" on public."conversations" ("createdAt", "id");

create table if not exists public."conversation_topics" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."conversation_topics" enable row level security;
alter table public."conversation_topics" add column if not exists "conversationId" text;
alter table public."conversation_topics" add column if not exists "kind" text;
alter table public."conversation_topics" add column if not exists "requestId" text;
alter table public."conversation_topics" add column if not exists "orderId" text;
alter table public."conversation_topics" add column if not exists "title" text;
alter table public."conversation_topics" add column if not exists "lastMessageAt" timestamptz;
alter table public."conversation_topics" add column if not exists "orderItemId" text;
alter table public."conversation_topics" add column if not exists "productId" text;
alter table public."conversation_topics" add column if not exists "draftId" text;
create index if not exists "conversation_topics_by_conversation" on public."conversation_topics" ("conversationId");
create index if not exists "conversation_topics_by_order" on public."conversation_topics" ("orderId");
create index if not exists "conversation_topics_by_product" on public."conversation_topics" ("productId");
create index if not exists "conversation_topics_by_draft" on public."conversation_topics" ("draftId");
create index if not exists "conversation_topics_created" on public."conversation_topics" ("createdAt");
create index if not exists "conversation_topics_created_id" on public."conversation_topics" ("createdAt", "id");

create table if not exists public."messages" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."messages" enable row level security;
alter table public."messages" add column if not exists "conversationId" text;
alter table public."messages" add column if not exists "topicId" text;
alter table public."messages" add column if not exists "authorUserId" text;
alter table public."messages" add column if not exists "authorSide" text;
alter table public."messages" add column if not exists "body" text;
alter table public."messages" add column if not exists "attachmentDocumentId" text;
alter table public."messages" add column if not exists "translation" jsonb;
alter table public."messages" add column if not exists "replyToMessageId" text;
create index if not exists "messages_by_topic" on public."messages" ("topicId");
create index if not exists "messages_by_conversation" on public."messages" ("conversationId");
create index if not exists "messages_created" on public."messages" ("createdAt");
create index if not exists "messages_created_id" on public."messages" ("createdAt", "id");

create table if not exists public."production_tracks" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."production_tracks" enable row level security;
alter table public."production_tracks" add column if not exists "orderId" text;
alter table public."production_tracks" add column if not exists "mode" text;
alter table public."production_tracks" add column if not exists "factoryName" text;
alter table public."production_tracks" add column if not exists "factoryAddress" text;
alter table public."production_tracks" add column if not exists "productionStartAt" timestamptz;
alter table public."production_tracks" add column if not exists "etd" timestamptz;
alter table public."production_tracks" add column if not exists "etdOriginal" timestamptz;
alter table public."production_tracks" add column if not exists "etdHistory" jsonb;
alter table public."production_tracks" add column if not exists "followups" jsonb;
alter table public."production_tracks" add column if not exists "inspectionScheduledAt" timestamptz;
alter table public."production_tracks" add column if not exists "inspectionNote" text;
alter table public."production_tracks" add column if not exists "updatedByUserId" text;
create unique index if not exists "production_tracks_order_unique" on public."production_tracks" ("orderId");
create index if not exists "production_tracks_created" on public."production_tracks" ("createdAt");
create index if not exists "production_tracks_created_id" on public."production_tracks" ("createdAt", "id");

create table if not exists public."shipping_docs" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."shipping_docs" enable row level security;
alter table public."shipping_docs" add column if not exists "orderId" text;
alter table public."shipping_docs" add column if not exists "kind" text;
alter table public."shipping_docs" add column if not exists "status" text;
alter table public."shipping_docs" add column if not exists "number" text;
alter table public."shipping_docs" add column if not exists "containerNumber" text;
alter table public."shipping_docs" add column if not exists "lines" jsonb;
alter table public."shipping_docs" add column if not exists "entries" jsonb;
alter table public."shipping_docs" add column if not exists "mismatches" jsonb;
alter table public."shipping_docs" add column if not exists "documentId" text;
alter table public."shipping_docs" add column if not exists "currency" text;
alter table public."shipping_docs" add column if not exists "version" bigint;
alter table public."shipping_docs" add column if not exists "submittedByUserId" text;
alter table public."shipping_docs" add column if not exists "submittedAt" timestamptz;
create unique index if not exists "shipping_docs_order_kind_unique" on public."shipping_docs" ("orderId", "kind");
create index if not exists "shipping_docs_created" on public."shipping_docs" ("createdAt");
create index if not exists "shipping_docs_created_id" on public."shipping_docs" ("createdAt", "id");

create table if not exists public."showroom_receipts" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."showroom_receipts" enable row level security;
alter table public."showroom_receipts" add column if not exists "orderId" text;
alter table public."showroom_receipts" add column if not exists "lines" jsonb;
alter table public."showroom_receipts" add column if not exists "divergent" boolean;
alter table public."showroom_receipts" add column if not exists "note" text;
alter table public."showroom_receipts" add column if not exists "documentId" text;
alter table public."showroom_receipts" add column if not exists "receivedByUserId" text;
alter table public."showroom_receipts" add column if not exists "receivedAt" timestamptz;
create unique index if not exists "showroom_receipts_order_unique" on public."showroom_receipts" ("orderId");
create index if not exists "showroom_receipts_created" on public."showroom_receipts" ("createdAt");
create index if not exists "showroom_receipts_created_id" on public."showroom_receipts" ("createdAt", "id");

create table if not exists public."real_media" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."real_media" enable row level security;
alter table public."real_media" add column if not exists "orderId" text;
alter table public."real_media" add column if not exists "orderItemId" text;
alter table public."real_media" add column if not exists "productId" text;
alter table public."real_media" add column if not exists "status" text;
alter table public."real_media" add column if not exists "documentIds" jsonb;
alter table public."real_media" add column if not exists "reason" text;
alter table public."real_media" add column if not exists "sentByUserId" text;
alter table public."real_media" add column if not exists "sentAt" timestamptz;
alter table public."real_media" add column if not exists "decidedByUserId" text;
alter table public."real_media" add column if not exists "decidedAt" timestamptz;
create unique index if not exists "real_media_item_unique" on public."real_media" ("orderItemId");
create index if not exists "real_media_by_order" on public."real_media" ("orderId");
create index if not exists "real_media_created" on public."real_media" ("createdAt");
create index if not exists "real_media_created_id" on public."real_media" ("createdAt", "id");

create table if not exists public."sales_orders" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."sales_orders" enable row level security;
alter table public."sales_orders" add column if not exists "number" bigint;
alter table public."sales_orders" add column if not exists "customerId" text;
alter table public."sales_orders" add column if not exists "offerId" text;
alter table public."sales_orders" add column if not exists "purchaseOrderId" text;
alter table public."sales_orders" add column if not exists "lines" jsonb;
alter table public."sales_orders" add column if not exists "currency" text;
alter table public."sales_orders" add column if not exists "paymentConditionId" text;
alter table public."sales_orders" add column if not exists "status" text;
alter table public."sales_orders" add column if not exists "deliveryDate" text;
alter table public."sales_orders" add column if not exists "deliveryWindow" text;
alter table public."sales_orders" add column if not exists "note" text;
alter table public."sales_orders" add column if not exists "erpStatus" text;
alter table public."sales_orders" add column if not exists "erpNumber" text;
alter table public."sales_orders" add column if not exists "erpError" text;
alter table public."sales_orders" add column if not exists "createdByUserId" text;
alter table public."sales_orders" add column if not exists "confirmedAt" timestamptz;
alter table public."sales_orders" add column if not exists "confirmedByUserId" text;
alter table public."sales_orders" add column if not exists "invoiceNumber" text;
alter table public."sales_orders" add column if not exists "invoiceDocumentId" text;
alter table public."sales_orders" add column if not exists "invoicedAt" timestamptz;
alter table public."sales_orders" add column if not exists "invoicedByUserId" text;
alter table public."sales_orders" add column if not exists "carrierId" text;
alter table public."sales_orders" add column if not exists "customerPickup" boolean;
alter table public."sales_orders" add column if not exists "freightValue" double precision;
alter table public."sales_orders" add column if not exists "shippedAt" timestamptz;
alter table public."sales_orders" add column if not exists "shippedByUserId" text;
alter table public."sales_orders" add column if not exists "deliveredAt" timestamptz;
alter table public."sales_orders" add column if not exists "receivedBy" text;
alter table public."sales_orders" add column if not exists "proofDocumentId" text;
alter table public."sales_orders" add column if not exists "deliveredByUserId" text;
alter table public."sales_orders" add column if not exists "freightDueDate" text;
alter table public."sales_orders" add column if not exists "freightPaidAt" timestamptz;
alter table public."sales_orders" add column if not exists "freightPaidByUserId" text;
alter table public."sales_orders" add column if not exists "freightProofDocumentId" text;
create unique index if not exists "sales_orders_number_unique" on public."sales_orders" ("number");
create index if not exists "sales_orders_by_customer" on public."sales_orders" ("customerId");
create index if not exists "sales_orders_created" on public."sales_orders" ("createdAt");
create index if not exists "sales_orders_created_id" on public."sales_orders" ("createdAt", "id");

create table if not exists public."divergence_lots" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."divergence_lots" enable row level security;
alter table public."divergence_lots" add column if not exists "number" bigint;
alter table public."divergence_lots" add column if not exists "orderId" text;
alter table public."divergence_lots" add column if not exists "items" jsonb;
alter table public."divergence_lots" add column if not exists "status" text;
alter table public."divergence_lots" add column if not exists "note" text;
alter table public."divergence_lots" add column if not exists "createdByUserId" text;
alter table public."divergence_lots" add column if not exists "purchasingNotifiedAt" timestamptz;
alter table public."divergence_lots" add column if not exists "purchasingUserIds" jsonb;
alter table public."divergence_lots" add column if not exists "supplierStep" jsonb;
alter table public."divergence_lots" add column if not exists "evidenceStep" jsonb;
alter table public."divergence_lots" add column if not exists "financeStep" jsonb;
alter table public."divergence_lots" add column if not exists "closedAt" timestamptz;
create unique index if not exists "divergence_lots_number_unique" on public."divergence_lots" ("number");
create index if not exists "divergence_lots_by_order" on public."divergence_lots" ("orderId");
create index if not exists "divergence_lots_created" on public."divergence_lots" ("createdAt");
create index if not exists "divergence_lots_created_id" on public."divergence_lots" ("createdAt", "id");

create table if not exists public."sales_returns" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."sales_returns" enable row level security;
alter table public."sales_returns" add column if not exists "salesOrderId" text;
alter table public."sales_returns" add column if not exists "lines" jsonb;
alter table public."sales_returns" add column if not exists "reason" text;
alter table public."sales_returns" add column if not exists "status" text;
alter table public."sales_returns" add column if not exists "createdByUserId" text;
alter table public."sales_returns" add column if not exists "invoiceNumber" text;
alter table public."sales_returns" add column if not exists "invoiceDocumentId" text;
alter table public."sales_returns" add column if not exists "invoicedAt" timestamptz;
alter table public."sales_returns" add column if not exists "invoicedByUserId" text;
alter table public."sales_returns" add column if not exists "checkedAt" timestamptz;
alter table public."sales_returns" add column if not exists "checkedByUserId" text;
alter table public."sales_returns" add column if not exists "lossNote" text;
create index if not exists "sales_returns_by_sales_order" on public."sales_returns" ("salesOrderId");
create index if not exists "sales_returns_created" on public."sales_returns" ("createdAt");
create index if not exists "sales_returns_created_id" on public."sales_returns" ("createdAt", "id");

create table if not exists public."sales_offers" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."sales_offers" enable row level security;
alter table public."sales_offers" add column if not exists "kind" text;
alter table public."sales_offers" add column if not exists "orderId" text;
alter table public."sales_offers" add column if not exists "productId" text;
alter table public."sales_offers" add column if not exists "offeredTo" text;
alter table public."sales_offers" add column if not exists "customerId" text;
alter table public."sales_offers" add column if not exists "note" text;
alter table public."sales_offers" add column if not exists "offeredByUserId" text;
alter table public."sales_offers" add column if not exists "offeredAt" timestamptz;
alter table public."sales_offers" add column if not exists "decision" text;
alter table public."sales_offers" add column if not exists "decisionNote" text;
alter table public."sales_offers" add column if not exists "decidedAt" timestamptz;
alter table public."sales_offers" add column if not exists "decidedByUserId" text;
alter table public."sales_offers" add column if not exists "salesOrderId" text;
create index if not exists "sales_offers_by_order" on public."sales_offers" ("orderId");
create index if not exists "sales_offers_by_product" on public."sales_offers" ("productId");
create index if not exists "sales_offers_created" on public."sales_offers" ("createdAt");
create index if not exists "sales_offers_created_id" on public."sales_offers" ("createdAt", "id");

create table if not exists public."sku_inspections" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."sku_inspections" enable row level security;
alter table public."sku_inspections" add column if not exists "orderId" text;
alter table public."sku_inspections" add column if not exists "orderItemId" text;
alter table public."sku_inspections" add column if not exists "round" bigint;
alter table public."sku_inspections" add column if not exists "result" text;
alter table public."sku_inspections" add column if not exists "note" text;
alter table public."sku_inspections" add column if not exists "inspectedByUserId" text;
alter table public."sku_inspections" add column if not exists "inspectedAt" timestamptz;
alter table public."sku_inspections" add column if not exists "supplierAction" text;
alter table public."sku_inspections" add column if not exists "supplierRespondedAt" timestamptz;
alter table public."sku_inspections" add column if not exists "supplierRespondedByUserId" text;
create index if not exists "sku_inspections_by_order" on public."sku_inspections" ("orderId");
create index if not exists "sku_inspections_by_item" on public."sku_inspections" ("orderItemId");
create index if not exists "sku_inspections_created" on public."sku_inspections" ("createdAt");
create index if not exists "sku_inspections_created_id" on public."sku_inspections" ("createdAt", "id");

create table if not exists public."import_steps" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."import_steps" enable row level security;
alter table public."import_steps" add column if not exists "orderId" text;
alter table public."import_steps" add column if not exists "key" text;
alter table public."import_steps" add column if not exists "status" text;
alter table public."import_steps" add column if not exists "value" text;
alter table public."import_steps" add column if not exists "amount" double precision;
alter table public."import_steps" add column if not exists "currency" text;
alter table public."import_steps" add column if not exists "documentId" text;
alter table public."import_steps" add column if not exists "submittedByUserId" text;
alter table public."import_steps" add column if not exists "submittedAt" timestamptz;
alter table public."import_steps" add column if not exists "validatedByUserId" text;
alter table public."import_steps" add column if not exists "validatedAt" timestamptz;
alter table public."import_steps" add column if not exists "rejectReason" text;
create unique index if not exists "import_steps_order_key_unique" on public."import_steps" ("orderId", "key");
create index if not exists "import_steps_by_document" on public."import_steps" ("documentId");
create index if not exists "import_steps_created" on public."import_steps" ("createdAt");
create index if not exists "import_steps_created_id" on public."import_steps" ("createdAt", "id");

create table if not exists public."receivings" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."receivings" enable row level security;
alter table public."receivings" add column if not exists "orderId" text;
alter table public."receivings" add column if not exists "sealNumber" text;
alter table public."receivings" add column if not exists "sealIntact" text;
alter table public."receivings" add column if not exists "sealPhotoDocumentId" text;
alter table public."receivings" add column if not exists "containerPhotoDocumentIds" jsonb;
alter table public."receivings" add column if not exists "checklist" jsonb;
alter table public."receivings" add column if not exists "items" jsonb;
alter table public."receivings" add column if not exists "ricNumber" text;
alter table public."receivings" add column if not exists "ricDocumentId" text;
alter table public."receivings" add column if not exists "containerReturnedAt" timestamptz;
alter table public."receivings" add column if not exists "containerReturnDocumentId" text;
alter table public."receivings" add column if not exists "closedAt" timestamptz;
alter table public."receivings" add column if not exists "closedByUserId" text;
alter table public."receivings" add column if not exists "closingNote" text;
alter table public."receivings" add column if not exists "qualityResult" text;
alter table public."receivings" add column if not exists "qualityAt" timestamptz;
alter table public."receivings" add column if not exists "qualityByUserId" text;
alter table public."receivings" add column if not exists "qualityNote" text;
alter table public."receivings" add column if not exists "storedAt" timestamptz;
alter table public."receivings" add column if not exists "updatedByUserId" text;
create unique index if not exists "receivings_order_unique" on public."receivings" ("orderId");
create index if not exists "receivings_created" on public."receivings" ("createdAt");
create index if not exists "receivings_created_id" on public."receivings" ("createdAt", "id");

create table if not exists public."art_issues" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."art_issues" enable row level security;
alter table public."art_issues" add column if not exists "orderId" text;
alter table public."art_issues" add column if not exists "orderItemId" text;
alter table public."art_issues" add column if not exists "status" text;
alter table public."art_issues" add column if not exists "note" text;
alter table public."art_issues" add column if not exists "documentId" text;
alter table public."art_issues" add column if not exists "reportedByUserId" text;
alter table public."art_issues" add column if not exists "fixNote" text;
alter table public."art_issues" add column if not exists "fixDocumentId" text;
alter table public."art_issues" add column if not exists "fixedByUserId" text;
alter table public."art_issues" add column if not exists "fixedAt" timestamptz;
alter table public."art_issues" add column if not exists "acceptedByUserId" text;
alter table public."art_issues" add column if not exists "acceptedAt" timestamptz;
create index if not exists "art_issues_by_order" on public."art_issues" ("orderId");
create index if not exists "art_issues_created" on public."art_issues" ("createdAt");
create index if not exists "art_issues_created_id" on public."art_issues" ("createdAt", "id");

create table if not exists public."message_reads" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."message_reads" enable row level security;
alter table public."message_reads" add column if not exists "topicId" text;
alter table public."message_reads" add column if not exists "userId" text;
alter table public."message_reads" add column if not exists "lastReadAt" timestamptz;
create unique index if not exists "message_reads_topic_user_unique" on public."message_reads" ("topicId", "userId");
create index if not exists "message_reads_by_user" on public."message_reads" ("userId");
create index if not exists "message_reads_created" on public."message_reads" ("createdAt");
create index if not exists "message_reads_created_id" on public."message_reads" ("createdAt", "id");

create table if not exists public."stock_movements" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."stock_movements" enable row level security;
alter table public."stock_movements" add column if not exists "productId" text;
alter table public."stock_movements" add column if not exists "kind" text;
alter table public."stock_movements" add column if not exists "quantity" double precision;
alter table public."stock_movements" add column if not exists "unit" text;
alter table public."stock_movements" add column if not exists "orderId" text;
alter table public."stock_movements" add column if not exists "countId" text;
alter table public."stock_movements" add column if not exists "countItemId" text;
alter table public."stock_movements" add column if not exists "note" text;
alter table public."stock_movements" add column if not exists "createdByUserId" text;
alter table public."stock_movements" add column if not exists "processEventId" text;
alter table public."stock_movements" add column if not exists "locationId" text;
alter table public."stock_movements" add column if not exists "salesOrderId" text;
create index if not exists "stock_movements_by_product" on public."stock_movements" ("productId");
create index if not exists "stock_movements_by_count" on public."stock_movements" ("countId");
create index if not exists "stock_movements_created" on public."stock_movements" ("createdAt");
create index if not exists "stock_movements_created_id" on public."stock_movements" ("createdAt", "id");

create table if not exists public."stock_counts" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."stock_counts" enable row level security;
alter table public."stock_counts" add column if not exists "number" bigint;
alter table public."stock_counts" add column if not exists "status" text;
alter table public."stock_counts" add column if not exists "note" text;
alter table public."stock_counts" add column if not exists "startedByUserId" text;
alter table public."stock_counts" add column if not exists "closedByUserId" text;
alter table public."stock_counts" add column if not exists "closedAt" timestamptz;
create index if not exists "stock_counts_by_status" on public."stock_counts" ("status");
create index if not exists "stock_counts_created" on public."stock_counts" ("createdAt");
create index if not exists "stock_counts_created_id" on public."stock_counts" ("createdAt", "id");

create table if not exists public."stock_count_items" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."stock_count_items" enable row level security;
alter table public."stock_count_items" add column if not exists "countId" text;
alter table public."stock_count_items" add column if not exists "productId" text;
alter table public."stock_count_items" add column if not exists "expected" double precision;
alter table public."stock_count_items" add column if not exists "unit" text;
alter table public."stock_count_items" add column if not exists "status" text;
alter table public."stock_count_items" add column if not exists "attempt1Qty" double precision;
alter table public."stock_count_items" add column if not exists "attempt1ByUserId" text;
alter table public."stock_count_items" add column if not exists "attempt1At" timestamptz;
alter table public."stock_count_items" add column if not exists "attempt2Qty" double precision;
alter table public."stock_count_items" add column if not exists "attempt2ByUserId" text;
alter table public."stock_count_items" add column if not exists "attempt2At" timestamptz;
alter table public."stock_count_items" add column if not exists "finalQty" double precision;
alter table public."stock_count_items" add column if not exists "difference" double precision;
alter table public."stock_count_items" add column if not exists "approvedByUserId" text;
alter table public."stock_count_items" add column if not exists "approvedAt" timestamptz;
alter table public."stock_count_items" add column if not exists "approvalNote" text;
create unique index if not exists "stock_count_items_count_product_unique" on public."stock_count_items" ("countId", "productId");
create index if not exists "stock_count_items_by_count" on public."stock_count_items" ("countId");
create index if not exists "stock_count_items_created" on public."stock_count_items" ("createdAt");
create index if not exists "stock_count_items_created_id" on public."stock_count_items" ("createdAt", "id");

create table if not exists public."stock_reservations" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."stock_reservations" enable row level security;
alter table public."stock_reservations" add column if not exists "productId" text;
alter table public."stock_reservations" add column if not exists "customerId" text;
alter table public."stock_reservations" add column if not exists "quantity" double precision;
alter table public."stock_reservations" add column if not exists "unit" text;
alter table public."stock_reservations" add column if not exists "status" text;
alter table public."stock_reservations" add column if not exists "expiresAt" timestamptz;
alter table public."stock_reservations" add column if not exists "note" text;
alter table public."stock_reservations" add column if not exists "createdByUserId" text;
alter table public."stock_reservations" add column if not exists "movementId" text;
alter table public."stock_reservations" add column if not exists "closedByUserId" text;
alter table public."stock_reservations" add column if not exists "closedAt" timestamptz;
alter table public."stock_reservations" add column if not exists "requestId" text;
create index if not exists "stock_reservations_by_product" on public."stock_reservations" ("productId");
create index if not exists "stock_reservations_by_customer" on public."stock_reservations" ("customerId");
create index if not exists "stock_reservations_by_status" on public."stock_reservations" ("status");
create index if not exists "stock_reservations_created" on public."stock_reservations" ("createdAt");
create index if not exists "stock_reservations_created_id" on public."stock_reservations" ("createdAt", "id");

create table if not exists public."booking_lots" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."booking_lots" enable row level security;
alter table public."booking_lots" add column if not exists "number" bigint;
alter table public."booking_lots" add column if not exists "status" text;
alter table public."booking_lots" add column if not exists "supplierId" text;
alter table public."booking_lots" add column if not exists "supplierHint" jsonb;
alter table public."booking_lots" add column if not exists "origin" text;
alter table public."booking_lots" add column if not exists "bookingDate" timestamptz;
alter table public."booking_lots" add column if not exists "sheetDate" text;
alter table public."booking_lots" add column if not exists "fileName" text;
alter table public."booking_lots" add column if not exists "fileDocumentId" text;
alter table public."booking_lots" add column if not exists "sheetName" text;
alter table public."booking_lots" add column if not exists "extraHeaders" jsonb;
alter table public."booking_lots" add column if not exists "itemCount" bigint;
alter table public."booking_lots" add column if not exists "businessType" text;
alter table public."booking_lots" add column if not exists "closedAt" timestamptz;
alter table public."booking_lots" add column if not exists "closedByUserId" text;
alter table public."booking_lots" add column if not exists "analyzedAt" timestamptz;
alter table public."booking_lots" add column if not exists "statusChangedAt" timestamptz;
alter table public."booking_lots" add column if not exists "statusChangedByUserId" text;
alter table public."booking_lots" add column if not exists "note" text;
alter table public."booking_lots" add column if not exists "ownerUserId" text;
alter table public."booking_lots" add column if not exists "createdByUserId" text;
alter table public."booking_lots" add column if not exists "partnerId" text;
alter table public."booking_lots" add column if not exists "sourceKind" text;
alter table public."booking_lots" add column if not exists "storeNumber" text;
alter table public."booking_lots" add column if not exists "supplierName" text;
alter table public."booking_lots" add column if not exists "incoterm" text;
alter table public."booking_lots" add column if not exists "exwValue" double precision;
alter table public."booking_lots" add column if not exists "itemType" text;
alter table public."booking_lots" add column if not exists "sheetFiles" jsonb;
create index if not exists "booking_lots_by_status" on public."booking_lots" ("status");
create index if not exists "booking_lots_by_supplier" on public."booking_lots" ("supplierId");
create index if not exists "booking_lots_created" on public."booking_lots" ("createdAt");
create index if not exists "booking_lots_created_id" on public."booking_lots" ("createdAt", "id");

create table if not exists public."booking_locks" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."booking_locks" enable row level security;
alter table public."booking_locks" add column if not exists "scope" text;
alter table public."booking_locks" add column if not exists "lotId" text;
alter table public."booking_locks" add column if not exists "typeKey" text;
alter table public."booking_locks" add column if not exists "itemType" text;
alter table public."booking_locks" add column if not exists "userId" text;
alter table public."booking_locks" add column if not exists "lockedAt" timestamptz;
create index if not exists "booking_locks_by_user" on public."booking_locks" ("userId");
create index if not exists "booking_locks_by_lot" on public."booking_locks" ("lotId");
create index if not exists "booking_locks_created" on public."booking_locks" ("createdAt");
create index if not exists "booking_locks_created_id" on public."booking_locks" ("createdAt", "id");

create table if not exists public."booking_items" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."booking_items" enable row level security;
alter table public."booking_items" add column if not exists "lotId" text;
alter table public."booking_items" add column if not exists "position" bigint;
alter table public."booking_items" add column if not exists "sourceRows" text;
alter table public."booking_items" add column if not exists "itemNumber" text;
alter table public."booking_items" add column if not exists "factoryItemCode" text;
alter table public."booking_items" add column if not exists "productName" text;
alter table public."booking_items" add column if not exists "description" text;
alter table public."booking_items" add column if not exists "incoterm" text;
alter table public."booking_items" add column if not exists "currency" text;
alter table public."booking_items" add column if not exists "price" double precision;
alter table public."booking_items" add column if not exists "masterCartonQty" bigint;
alter table public."booking_items" add column if not exists "innerQty" bigint;
alter table public."booking_items" add column if not exists "netWeightPcKg" double precision;
alter table public."booking_items" add column if not exists "grossWeightPcKg" double precision;
alter table public."booking_items" add column if not exists "cbmPerCarton" double precision;
alter table public."booking_items" add column if not exists "lengthCm" double precision;
alter table public."booking_items" add column if not exists "widthCm" double precision;
alter table public."booking_items" add column if not exists "heightCm" double precision;
alter table public."booking_items" add column if not exists "capacityMl" double precision;
alter table public."booking_items" add column if not exists "packageType" text;
alter table public."booking_items" add column if not exists "material" text;
alter table public."booking_items" add column if not exists "moq" bigint;
alter table public."booking_items" add column if not exists "colorAssortment" text;
alter table public."booking_items" add column if not exists "powerDetail" text;
alter table public."booking_items" add column if not exists "purchaseSchedule" text;
alter table public."booking_items" add column if not exists "departureIntervalDays" text;
alter table public."booking_items" add column if not exists "purchaseQty" bigint;
alter table public."booking_items" add column if not exists "plannedQty" bigint;
alter table public."booking_items" add column if not exists "sizeText" text;
alter table public."booking_items" add column if not exists "photoDocumentId" text;
alter table public."booking_items" add column if not exists "cardDocumentId" text;
alter table public."booking_items" add column if not exists "extras" jsonb;
alter table public."booking_items" add column if not exists "analysis" jsonb;
alter table public."booking_items" add column if not exists "productId" text;
alter table public."booking_items" add column if not exists "updatedByUserId" text;
alter table public."booking_items" add column if not exists "ncm" text;
alter table public."booking_items" add column if not exists "ncmSource" text;
alter table public."booking_items" add column if not exists "ncmMatchProductIds" jsonb;
alter table public."booking_items" add column if not exists "ncmScore" double precision;
alter table public."booking_items" add column if not exists "ncmRequestedAt" timestamptz;
alter table public."booking_items" add column if not exists "ncmAt" timestamptz;
alter table public."booking_items" add column if not exists "ncmByUserId" text;
alter table public."booking_items" add column if not exists "workedAt" timestamptz;
alter table public."booking_items" add column if not exists "workedByUserId" text;
create index if not exists "booking_items_by_lot" on public."booking_items" ("lotId");
create index if not exists "booking_items_by_product" on public."booking_items" ("productId");
create index if not exists "booking_items_created" on public."booking_items" ("createdAt");
create index if not exists "booking_items_created_id" on public."booking_items" ("createdAt", "id");

create table if not exists public."purchase_quotes" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."purchase_quotes" enable row level security;
alter table public."purchase_quotes" add column if not exists "number" bigint;
alter table public."purchase_quotes" add column if not exists "decisionId" text;
alter table public."purchase_quotes" add column if not exists "demandIds" jsonb;
alter table public."purchase_quotes" add column if not exists "lineIds" jsonb;
alter table public."purchase_quotes" add column if not exists "items" jsonb;
alter table public."purchase_quotes" add column if not exists "status" text;
alter table public."purchase_quotes" add column if not exists "hours" double precision;
alter table public."purchase_quotes" add column if not exists "openedByUserId" text;
alter table public."purchase_quotes" add column if not exists "winnerResponseId" text;
alter table public."purchase_quotes" add column if not exists "chosenByUserId" text;
alter table public."purchase_quotes" add column if not exists "chosenAt" timestamptz;
alter table public."purchase_quotes" add column if not exists "chosenNote" text;
alter table public."purchase_quotes" add column if not exists "approvedByUserId" text;
alter table public."purchase_quotes" add column if not exists "approvedAt" timestamptz;
alter table public."purchase_quotes" add column if not exists "approvalNote" text;
alter table public."purchase_quotes" add column if not exists "supplierRequestIds" jsonb;
alter table public."purchase_quotes" add column if not exists "emptyNotifiedAt" timestamptz;
create index if not exists "purchase_quotes_by_status" on public."purchase_quotes" ("status");
create index if not exists "purchase_quotes_by_decision" on public."purchase_quotes" ("decisionId");
create index if not exists "purchase_quotes_created" on public."purchase_quotes" ("createdAt");
create index if not exists "purchase_quotes_created_id" on public."purchase_quotes" ("createdAt", "id");

create table if not exists public."purchase_quote_responses" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."purchase_quote_responses" enable row level security;
alter table public."purchase_quote_responses" add column if not exists "quoteId" text;
alter table public."purchase_quote_responses" add column if not exists "supplierId" text;
alter table public."purchase_quote_responses" add column if not exists "status" text;
alter table public."purchase_quote_responses" add column if not exists "invitedAt" timestamptz;
alter table public."purchase_quote_responses" add column if not exists "dueAt" timestamptz;
alter table public."purchase_quote_responses" add column if not exists "prices" jsonb;
alter table public."purchase_quote_responses" add column if not exists "currency" text;
alter table public."purchase_quote_responses" add column if not exists "incoterm" text;
alter table public."purchase_quote_responses" add column if not exists "incotermValue" double precision;
alter table public."purchase_quote_responses" add column if not exists "leadTimeDays" bigint;
alter table public."purchase_quote_responses" add column if not exists "port" text;
alter table public."purchase_quote_responses" add column if not exists "moq" double precision;
alter table public."purchase_quote_responses" add column if not exists "note" text;
alter table public."purchase_quote_responses" add column if not exists "answeredAt" timestamptz;
alter table public."purchase_quote_responses" add column if not exists "answeredByUserId" text;
alter table public."purchase_quote_responses" add column if not exists "reminderSentAt" timestamptz;
alter table public."purchase_quote_responses" add column if not exists "items" jsonb;
alter table public."purchase_quote_responses" add column if not exists "negotiation" jsonb;
alter table public."purchase_quote_responses" add column if not exists "sampling" jsonb;
create index if not exists "purchase_quote_responses_by_quote" on public."purchase_quote_responses" ("quoteId");
create index if not exists "purchase_quote_responses_by_supplier" on public."purchase_quote_responses" ("supplierId");
create unique index if not exists "purchase_quote_responses_quote_supplier_unique" on public."purchase_quote_responses" ("quoteId", "supplierId");
create index if not exists "purchase_quote_responses_created" on public."purchase_quote_responses" ("createdAt");
create index if not exists "purchase_quote_responses_created_id" on public."purchase_quote_responses" ("createdAt", "id");

create table if not exists public."supplier_product_sheets" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."supplier_product_sheets" enable row level security;
alter table public."supplier_product_sheets" add column if not exists "productId" text;
alter table public."supplier_product_sheets" add column if not exists "supplierId" text;
alter table public."supplier_product_sheets" add column if not exists "kind" text;
alter table public."supplier_product_sheets" add column if not exists "data" jsonb;
alter table public."supplier_product_sheets" add column if not exists "baseline" jsonb;
alter table public."supplier_product_sheets" add column if not exists "changedFields" jsonb;
alter table public."supplier_product_sheets" add column if not exists "soldBefore" boolean;
alter table public."supplier_product_sheets" add column if not exists "source" text;
alter table public."supplier_product_sheets" add column if not exists "quoteId" text;
alter table public."supplier_product_sheets" add column if not exists "quoteResponseId" text;
alter table public."supplier_product_sheets" add column if not exists "orderId" text;
alter table public."supplier_product_sheets" add column if not exists "scalePhotoDocumentId" text;
alter table public."supplier_product_sheets" add column if not exists "confirmedAt" timestamptz;
alter table public."supplier_product_sheets" add column if not exists "confirmedByUserId" text;
alter table public."supplier_product_sheets" add column if not exists "review" text;
alter table public."supplier_product_sheets" add column if not exists "reviewedAt" timestamptz;
alter table public."supplier_product_sheets" add column if not exists "reviewedByUserId" text;
alter table public."supplier_product_sheets" add column if not exists "reviewNote" text;
create unique index if not exists "supplier_product_sheets_product_supplier_sheet_unique" on public."supplier_product_sheets" ("productId", "supplierId");
create index if not exists "supplier_product_sheets_by_supplier" on public."supplier_product_sheets" ("supplierId");
create index if not exists "supplier_product_sheets_by_review" on public."supplier_product_sheets" ("review");
create index if not exists "supplier_product_sheets_created" on public."supplier_product_sheets" ("createdAt");
create index if not exists "supplier_product_sheets_created_id" on public."supplier_product_sheets" ("createdAt", "id");

create table if not exists public."supplier_lines" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."supplier_lines" enable row level security;
alter table public."supplier_lines" add column if not exists "supplierId" text;
alter table public."supplier_lines" add column if not exists "lineId" text;
alter table public."supplier_lines" add column if not exists "createdByUserId" text;
alter table public."supplier_lines" add column if not exists "familyConvertedAt" timestamptz;
create index if not exists "supplier_lines_by_supplier" on public."supplier_lines" ("supplierId");
create index if not exists "supplier_lines_by_line" on public."supplier_lines" ("lineId");
create index if not exists "supplier_lines_created" on public."supplier_lines" ("createdAt");
create index if not exists "supplier_lines_created_id" on public."supplier_lines" ("createdAt", "id");

create table if not exists public."materials" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."materials" enable row level security;
alter table public."materials" add column if not exists "namePt" text;
alter table public."materials" add column if not exists "nameEn" text;
alter table public."materials" add column if not exists "nameZh" text;
alter table public."materials" add column if not exists "nameKey" text;
alter table public."materials" add column if not exists "active" boolean;
alter table public."materials" add column if not exists "createdByUserId" text;
alter table public."materials" add column if not exists "updatedByUserId" text;
create unique index if not exists "materials_by_name_key" on public."materials" ("nameKey");
create index if not exists "materials_created" on public."materials" ("createdAt");
create index if not exists "materials_created_id" on public."materials" ("createdAt", "id");

create table if not exists public."product_families" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."product_families" enable row level security;
alter table public."product_families" add column if not exists "code" text;
alter table public."product_families" add column if not exists "name" text;
alter table public."product_families" add column if not exists "nameKey" text;
alter table public."product_families" add column if not exists "active" boolean;
alter table public."product_families" add column if not exists "syncedAt" timestamptz;
create unique index if not exists "product_families_by_code" on public."product_families" ("code");
create index if not exists "product_families_created" on public."product_families" ("createdAt");
create index if not exists "product_families_created_id" on public."product_families" ("createdAt", "id");
create index if not exists "product_families_name_id" on public."product_families" ("name", "id");

create table if not exists public."party_families" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."party_families" enable row level security;
alter table public."party_families" add column if not exists "partyId" text;
alter table public."party_families" add column if not exists "familyCode" text;
alter table public."party_families" add column if not exists "createdByUserId" text;
create index if not exists "party_families_by_party" on public."party_families" ("partyId");
create index if not exists "party_families_by_family" on public."party_families" ("familyCode");
create index if not exists "party_families_created" on public."party_families" ("createdAt");
create index if not exists "party_families_created_id" on public."party_families" ("createdAt", "id");

create table if not exists public."purchase_decisions" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."purchase_decisions" enable row level security;
alter table public."purchase_decisions" add column if not exists "number" bigint;
alter table public."purchase_decisions" add column if not exists "productId" text;
alter table public."purchase_decisions" add column if not exists "lineId" text;
alter table public."purchase_decisions" add column if not exists "demandIds" jsonb;
alter table public."purchase_decisions" add column if not exists "quantity" double precision;
alter table public."purchase_decisions" add column if not exists "choice" text;
alter table public."purchase_decisions" add column if not exists "reference" jsonb;
alter table public."purchase_decisions" add column if not exists "note" text;
alter table public."purchase_decisions" add column if not exists "status" text;
alter table public."purchase_decisions" add column if not exists "chosenByUserId" text;
alter table public."purchase_decisions" add column if not exists "chosenAt" timestamptz;
alter table public."purchase_decisions" add column if not exists "approvedByUserId" text;
alter table public."purchase_decisions" add column if not exists "approvedAt" timestamptz;
alter table public."purchase_decisions" add column if not exists "approvalNote" text;
alter table public."purchase_decisions" add column if not exists "orderId" text;
alter table public."purchase_decisions" add column if not exists "quoteId" text;
alter table public."purchase_decisions" add column if not exists "recipientIds" jsonb;
alter table public."purchase_decisions" add column if not exists "sendId" text;
create index if not exists "purchase_decisions_by_status" on public."purchase_decisions" ("status");
create index if not exists "purchase_decisions_by_product" on public."purchase_decisions" ("productId");
create index if not exists "purchase_decisions_created" on public."purchase_decisions" ("createdAt");
create index if not exists "purchase_decisions_created_id" on public."purchase_decisions" ("createdAt", "id");

create table if not exists public."purchase_strategy_sends" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."purchase_strategy_sends" enable row level security;
alter table public."purchase_strategy_sends" add column if not exists "number" bigint;
alter table public."purchase_strategy_sends" add column if not exists "status" text;
alter table public."purchase_strategy_sends" add column if not exists "lines" jsonb;
alter table public."purchase_strategy_sends" add column if not exists "createdByUserId" text;
alter table public."purchase_strategy_sends" add column if not exists "lastRunAt" timestamptz;
alter table public."purchase_strategy_sends" add column if not exists "runs" bigint;
create index if not exists "purchase_strategy_sends_by_status" on public."purchase_strategy_sends" ("status");
create index if not exists "purchase_strategy_sends_by_creator" on public."purchase_strategy_sends" ("createdByUserId");
create index if not exists "purchase_strategy_sends_created" on public."purchase_strategy_sends" ("createdAt");
create index if not exists "purchase_strategy_sends_created_id" on public."purchase_strategy_sends" ("createdAt", "id");

create table if not exists public."booking_invites" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."booking_invites" enable row level security;
alter table public."booking_invites" add column if not exists "number" bigint;
alter table public."booking_invites" add column if not exists "groupId" text;
alter table public."booking_invites" add column if not exists "status" text;
alter table public."booking_invites" add column if not exists "bookingItemId" text;
alter table public."booking_invites" add column if not exists "bookingLotId" text;
alter table public."booking_invites" add column if not exists "item" jsonb;
alter table public."booking_invites" add column if not exists "partnerId" text;
alter table public."booking_invites" add column if not exists "message" text;
alter table public."booking_invites" add column if not exists "dueAt" timestamptz;
alter table public."booking_invites" add column if not exists "answeredAt" timestamptz;
alter table public."booking_invites" add column if not exists "answeredByUserId" text;
alter table public."booking_invites" add column if not exists "answeredLotId" text;
alter table public."booking_invites" add column if not exists "cancelledAt" timestamptz;
alter table public."booking_invites" add column if not exists "createdByUserId" text;
create index if not exists "booking_invites_by_item" on public."booking_invites" ("bookingItemId");
create index if not exists "booking_invites_by_partner" on public."booking_invites" ("partnerId");
create index if not exists "booking_invites_by_group" on public."booking_invites" ("groupId");
create index if not exists "booking_invites_created" on public."booking_invites" ("createdAt");
create index if not exists "booking_invites_created_id" on public."booking_invites" ("createdAt", "id");

create table if not exists public."supplier_requests" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."supplier_requests" enable row level security;
alter table public."supplier_requests" add column if not exists "number" bigint;
alter table public."supplier_requests" add column if not exists "status" text;
alter table public."supplier_requests" add column if not exists "supplierId" text;
alter table public."supplier_requests" add column if not exists "bookingItemId" text;
alter table public."supplier_requests" add column if not exists "bookingLotId" text;
alter table public."supplier_requests" add column if not exists "alternativeItemIds" jsonb;
alter table public."supplier_requests" add column if not exists "item" jsonb;
alter table public."supplier_requests" add column if not exists "quantity" bigint;
alter table public."supplier_requests" add column if not exists "unit" text;
alter table public."supplier_requests" add column if not exists "needs" text;
alter table public."supplier_requests" add column if not exists "searchQuery" text;
alter table public."supplier_requests" add column if not exists "supplierCanDo" text;
alter table public."supplier_requests" add column if not exists "supplierPrice" double precision;
alter table public."supplier_requests" add column if not exists "supplierCurrency" text;
alter table public."supplier_requests" add column if not exists "supplierMoq" bigint;
alter table public."supplier_requests" add column if not exists "supplierLeadTimeDays" bigint;
alter table public."supplier_requests" add column if not exists "supplierIncoterm" text;
alter table public."supplier_requests" add column if not exists "supplierNote" text;
alter table public."supplier_requests" add column if not exists "respondedAt" timestamptz;
alter table public."supplier_requests" add column if not exists "respondedByUserId" text;
alter table public."supplier_requests" add column if not exists "decidedAt" timestamptz;
alter table public."supplier_requests" add column if not exists "decidedByUserId" text;
alter table public."supplier_requests" add column if not exists "decisionNote" text;
alter table public."supplier_requests" add column if not exists "createdByUserId" text;
alter table public."supplier_requests" add column if not exists "productId" text;
alter table public."supplier_requests" add column if not exists "productAction" text;
alter table public."supplier_requests" add column if not exists "productLinkedAt" timestamptz;
alter table public."supplier_requests" add column if not exists "productLinkedByUserId" text;
alter table public."supplier_requests" add column if not exists "showcaseReleasedAt" timestamptz;
alter table public."supplier_requests" add column if not exists "showcaseReleasedByUserId" text;
alter table public."supplier_requests" add column if not exists "erpCheckedAt" timestamptz;
alter table public."supplier_requests" add column if not exists "negotiation" jsonb;
alter table public."supplier_requests" add column if not exists "slaNotifiedAt" timestamptz;
alter table public."supplier_requests" add column if not exists "orderId" text;
alter table public."supplier_requests" add column if not exists "batchId" text;
alter table public."supplier_requests" add column if not exists "schedule" jsonb;
alter table public."supplier_requests" add column if not exists "colorPlan" jsonb;
alter table public."supplier_requests" add column if not exists "aiAssets" jsonb;
alter table public."supplier_requests" add column if not exists "sampling" jsonb;
alter table public."supplier_requests" add column if not exists "quoteResponseId" text;
alter table public."supplier_requests" add column if not exists "demandIds" jsonb;
create index if not exists "supplier_requests_by_supplier" on public."supplier_requests" ("supplierId");
create index if not exists "supplier_requests_by_item" on public."supplier_requests" ("bookingItemId");
create index if not exists "supplier_requests_by_status" on public."supplier_requests" ("status");
create index if not exists "supplier_requests_by_product" on public."supplier_requests" ("productId");
create index if not exists "supplier_requests_by_order" on public."supplier_requests" ("orderId");
create index if not exists "supplier_requests_created" on public."supplier_requests" ("createdAt");
create index if not exists "supplier_requests_created_id" on public."supplier_requests" ("createdAt", "id");

create table if not exists public."selection_groups" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."selection_groups" enable row level security;
alter table public."selection_groups" add column if not exists "status" text;
alter table public."selection_groups" add column if not exists "itemIds" jsonb;
alter table public."selection_groups" add column if not exists "chosenItemId" text;
alter table public."selection_groups" add column if not exists "quantity" bigint;
alter table public."selection_groups" add column if not exists "needs" text;
alter table public."selection_groups" add column if not exists "supplierRequestId" text;
alter table public."selection_groups" add column if not exists "requestedAt" timestamptz;
alter table public."selection_groups" add column if not exists "createdByUserId" text;
alter table public."selection_groups" add column if not exists "updatedByUserId" text;
alter table public."selection_groups" add column if not exists "schedule" jsonb;
alter table public."selection_groups" add column if not exists "colorPlan" jsonb;
alter table public."selection_groups" add column if not exists "aiPrompts" jsonb;
alter table public."selection_groups" add column if not exists "aiAssets" jsonb;
create index if not exists "selection_groups_by_status" on public."selection_groups" ("status");
create index if not exists "selection_groups_by_chosen" on public."selection_groups" ("chosenItemId");
create index if not exists "selection_groups_created" on public."selection_groups" ("createdAt");
create index if not exists "selection_groups_created_id" on public."selection_groups" ("createdAt", "id");

create table if not exists public."stock_locations" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."stock_locations" enable row level security;
alter table public."stock_locations" add column if not exists "code" bigint;
alter table public."stock_locations" add column if not exists "name" text;
alter table public."stock_locations" add column if not exists "active" boolean;
alter table public."stock_locations" add column if not exists "notes" text;
alter table public."stock_locations" add column if not exists "sankhyaCode" text;
create unique index if not exists "stock_locations_code_unique" on public."stock_locations" ("code");
create index if not exists "stock_locations_created" on public."stock_locations" ("createdAt");
create index if not exists "stock_locations_created_id" on public."stock_locations" ("createdAt", "id");
create index if not exists "stock_locations_name_id" on public."stock_locations" ("name", "id");

create table if not exists public."commission_agreements" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."commission_agreements" enable row level security;
alter table public."commission_agreements" add column if not exists "number" bigint;
alter table public."commission_agreements" add column if not exists "rootId" text;
alter table public."commission_agreements" add column if not exists "version" bigint;
alter table public."commission_agreements" add column if not exists "name" text;
alter table public."commission_agreements" add column if not exists "status" text;
alter table public."commission_agreements" add column if not exists "category" text;
alter table public."commission_agreements" add column if not exists "priority" bigint;
alter table public."commission_agreements" add column if not exists "beneficiaryPartyId" text;
alter table public."commission_agreements" add column if not exists "beneficiaryType" text;
alter table public."commission_agreements" add column if not exists "scope" jsonb;
alter table public."commission_agreements" add column if not exists "validFrom" text;
alter table public."commission_agreements" add column if not exists "validTo" text;
alter table public."commission_agreements" add column if not exists "currency" text;
alter table public."commission_agreements" add column if not exists "generateOn" text;
alter table public."commission_agreements" add column if not exists "releaseOn" text;
alter table public."commission_agreements" add column if not exists "releaseMode" text;
alter table public."commission_agreements" add column if not exists "dueDays" bigint;
alter table public."commission_agreements" add column if not exists "components" jsonb;
alter table public."commission_agreements" add column if not exists "notes" text;
alter table public."commission_agreements" add column if not exists "createdByUserId" text;
alter table public."commission_agreements" add column if not exists "activatedAt" timestamptz;
alter table public."commission_agreements" add column if not exists "activatedByUserId" text;
create index if not exists "commission_agreements_by_root" on public."commission_agreements" ("rootId");
create index if not exists "commission_agreements_by_status" on public."commission_agreements" ("status");
create index if not exists "commission_agreements_created" on public."commission_agreements" ("createdAt");
create index if not exists "commission_agreements_created_id" on public."commission_agreements" ("createdAt", "id");
create index if not exists "commission_agreements_name_id" on public."commission_agreements" ("name", "id");

create table if not exists public."commission_entries" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."commission_entries" enable row level security;
alter table public."commission_entries" add column if not exists "key" text;
alter table public."commission_entries" add column if not exists "kind" text;
alter table public."commission_entries" add column if not exists "originalEntryId" text;
alter table public."commission_entries" add column if not exists "orderId" text;
alter table public."commission_entries" add column if not exists "beneficiaryPartyId" text;
alter table public."commission_entries" add column if not exists "agreementId" text;
alter table public."commission_entries" add column if not exists "rootId" text;
alter table public."commission_entries" add column if not exists "version" bigint;
alter table public."commission_entries" add column if not exists "category" text;
alter table public."commission_entries" add column if not exists "currency" text;
alter table public."commission_entries" add column if not exists "amount" double precision;
alter table public."commission_entries" add column if not exists "released" double precision;
alter table public."commission_entries" add column if not exists "paidAmount" double precision;
alter table public."commission_entries" add column if not exists "status" text;
alter table public."commission_entries" add column if not exists "referenceDate" timestamptz;
alter table public."commission_entries" add column if not exists "eligibleAt" timestamptz;
alter table public."commission_entries" add column if not exists "dueAt" timestamptz;
alter table public."commission_entries" add column if not exists "approvedAt" timestamptz;
alter table public."commission_entries" add column if not exists "approvedByUserId" text;
alter table public."commission_entries" add column if not exists "memory" jsonb;
alter table public."commission_entries" add column if not exists "note" text;
create unique index if not exists "commission_entries_key_unique" on public."commission_entries" ("key");
create index if not exists "commission_entries_by_order" on public."commission_entries" ("orderId");
create index if not exists "commission_entries_by_beneficiary" on public."commission_entries" ("beneficiaryPartyId");
create index if not exists "commission_entries_by_status" on public."commission_entries" ("status");
create index if not exists "commission_entries_created" on public."commission_entries" ("createdAt");
create index if not exists "commission_entries_created_id" on public."commission_entries" ("createdAt", "id");

create table if not exists public."commission_payments" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."commission_payments" enable row level security;
alter table public."commission_payments" add column if not exists "number" bigint;
alter table public."commission_payments" add column if not exists "beneficiaryPartyId" text;
alter table public."commission_payments" add column if not exists "amount" double precision;
alter table public."commission_payments" add column if not exists "currency" text;
alter table public."commission_payments" add column if not exists "paidAt" timestamptz;
alter table public."commission_payments" add column if not exists "reference" text;
alter table public."commission_payments" add column if not exists "documentId" text;
alter table public."commission_payments" add column if not exists "note" text;
alter table public."commission_payments" add column if not exists "allocations" jsonb;
alter table public."commission_payments" add column if not exists "createdByUserId" text;
create index if not exists "commission_payments_by_beneficiary" on public."commission_payments" ("beneficiaryPartyId");
create index if not exists "commission_payments_created" on public."commission_payments" ("createdAt");
create index if not exists "commission_payments_created_id" on public."commission_payments" ("createdAt", "id");

create table if not exists public."commission_events" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."commission_events" enable row level security;
alter table public."commission_events" add column if not exists "orderId" text;
alter table public."commission_events" add column if not exists "event" text;
alter table public."commission_events" add column if not exists "note" text;
alter table public."commission_events" add column if not exists "documentId" text;
alter table public."commission_events" add column if not exists "createdByUserId" text;
create index if not exists "commission_events_by_order" on public."commission_events" ("orderId");
create index if not exists "commission_events_created" on public."commission_events" ("createdAt");
create index if not exists "commission_events_created_id" on public."commission_events" ("createdAt", "id");

create table if not exists public."team_areas" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."team_areas" enable row level security;
alter table public."team_areas" add column if not exists "name" text;
alter table public."team_areas" add column if not exists "active" boolean;
alter table public."team_areas" add column if not exists "createdByUserId" text;
alter table public."team_areas" add column if not exists "updatedByUserId" text;
create index if not exists "team_areas_created" on public."team_areas" ("createdAt");
create index if not exists "team_areas_created_id" on public."team_areas" ("createdAt", "id");
create index if not exists "team_areas_name_id" on public."team_areas" ("name", "id");

create table if not exists public."team_positions" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."team_positions" enable row level security;
alter table public."team_positions" add column if not exists "name" text;
alter table public."team_positions" add column if not exists "areaId" text;
alter table public."team_positions" add column if not exists "active" boolean;
alter table public."team_positions" add column if not exists "createdByUserId" text;
alter table public."team_positions" add column if not exists "updatedByUserId" text;
create index if not exists "team_positions_by_area" on public."team_positions" ("areaId");
create index if not exists "team_positions_created" on public."team_positions" ("createdAt");
create index if not exists "team_positions_created_id" on public."team_positions" ("createdAt", "id");
create index if not exists "team_positions_name_id" on public."team_positions" ("name", "id");

create table if not exists public."team_pending" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."team_pending" enable row level security;
alter table public."team_pending" add column if not exists "name" text;
alter table public."team_pending" add column if not exists "status" text;
alter table public."team_pending" add column if not exists "positionId" text;
alter table public."team_pending" add column if not exists "areaId" text;
alter table public."team_pending" add column if not exists "jobLevel" text;
alter table public."team_pending" add column if not exists "functions" jsonb;
alter table public."team_pending" add column if not exists "reviewNote" text;
alter table public."team_pending" add column if not exists "source" text;
alter table public."team_pending" add column if not exists "userId" text;
alter table public."team_pending" add column if not exists "createdByUserId" text;
alter table public."team_pending" add column if not exists "updatedByUserId" text;
create index if not exists "team_pending_by_status" on public."team_pending" ("status");
create index if not exists "team_pending_created" on public."team_pending" ("createdAt");
create index if not exists "team_pending_created_id" on public."team_pending" ("createdAt", "id");
create index if not exists "team_pending_name_id" on public."team_pending" ("name", "id");

create table if not exists public."partner_types" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."partner_types" enable row level security;
alter table public."partner_types" add column if not exists "key" text;
alter table public."partner_types" add column if not exists "builtin" text;
alter table public."partner_types" add column if not exists "name" text;
alter table public."partner_types" add column if not exists "nameEn" text;
alter table public."partner_types" add column if not exists "nameZh" text;
alter table public."partner_types" add column if not exists "description" text;
alter table public."partner_types" add column if not exists "active" boolean;
alter table public."partner_types" add column if not exists "loginClass" text;
alter table public."partner_types" add column if not exists "createdByUserId" text;
alter table public."partner_types" add column if not exists "updatedByUserId" text;
create unique index if not exists "partner_types_key_unique" on public."partner_types" ("key");
create index if not exists "partner_types_created" on public."partner_types" ("createdAt");
create index if not exists "partner_types_created_id" on public."partner_types" ("createdAt", "id");
create index if not exists "partner_types_name_id" on public."partner_types" ("name", "id");

create table if not exists public."payment_plans" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."payment_plans" enable row level security;
alter table public."payment_plans" add column if not exists "name" text;
alter table public."payment_plans" add column if not exists "installments" jsonb;
alter table public."payment_plans" add column if not exists "requiresApproval" boolean;
alter table public."payment_plans" add column if not exists "approverUserId" text;
alter table public."payment_plans" add column if not exists "monthlyInterestPercent" double precision;
alter table public."payment_plans" add column if not exists "active" boolean;
alter table public."payment_plans" add column if not exists "sortOrder" bigint;
alter table public."payment_plans" add column if not exists "updatedByUserId" text;
create index if not exists "payment_plans_created" on public."payment_plans" ("createdAt");
create index if not exists "payment_plans_created_id" on public."payment_plans" ("createdAt", "id");
create index if not exists "payment_plans_name_id" on public."payment_plans" ("name", "id");

create table if not exists public."payment_conditions" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."payment_conditions" enable row level security;
alter table public."payment_conditions" add column if not exists "code" bigint;
alter table public."payment_conditions" add column if not exists "name" text;
alter table public."payment_conditions" add column if not exists "active" boolean;
alter table public."payment_conditions" add column if not exists "notes" text;
alter table public."payment_conditions" add column if not exists "source" text;
alter table public."payment_conditions" add column if not exists "updatedByUserId" text;
create unique index if not exists "payment_conditions_code_unique" on public."payment_conditions" ("code");
create index if not exists "payment_conditions_created" on public."payment_conditions" ("createdAt");
create index if not exists "payment_conditions_created_id" on public."payment_conditions" ("createdAt", "id");
create index if not exists "payment_conditions_name_id" on public."payment_conditions" ("name", "id");

create table if not exists public."process_events" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."process_events" enable row level security;
alter table public."process_events" add column if not exists "event" text;
alter table public."process_events" add column if not exists "requestId" text;
alter table public."process_events" add column if not exists "orderId" text;
alter table public."process_events" add column if not exists "stockAction" text;
alter table public."process_events" add column if not exists "sankhyaAction" text;
alter table public."process_events" add column if not exists "top" bigint;
alter table public."process_events" add column if not exists "status" text;
alter table public."process_events" add column if not exists "detail" text;
alter table public."process_events" add column if not exists "nunotaBefore" text;
alter table public."process_events" add column if not exists "nunotaAfter" text;
alter table public."process_events" add column if not exists "createdByUserId" text;
alter table public."process_events" add column if not exists "entity" text;
alter table public."process_events" add column if not exists "entityId" text;
create index if not exists "process_events_by_order" on public."process_events" ("orderId");
create index if not exists "process_events_by_request" on public."process_events" ("requestId");
create index if not exists "process_events_by_event" on public."process_events" ("event");
create index if not exists "process_events_by_entity" on public."process_events" ("entityId");
create index if not exists "process_events_created" on public."process_events" ("createdAt");
create index if not exists "process_events_created_id" on public."process_events" ("createdAt", "id");

create table if not exists public."order_summaries" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."order_summaries" enable row level security;
alter table public."order_summaries" add column if not exists "orderId" text;
alter table public."order_summaries" add column if not exists "number" bigint;
alter table public."order_summaries" add column if not exists "status" text;
alter table public."order_summaries" add column if not exists "live" boolean;
alter table public."order_summaries" add column if not exists "version" bigint;
alter table public."order_summaries" add column if not exists "facts" jsonb;
alter table public."order_summaries" add column if not exists "computedAt" timestamptz;
alter table public."order_summaries" add column if not exists "kpi" jsonb;
alter table public."order_summaries" add column if not exists "tasks" jsonb;
alter table public."order_summaries" add column if not exists "hasTasks" boolean;
create index if not exists "order_summaries_by_order" on public."order_summaries" ("orderId");
create index if not exists "order_summaries_by_live" on public."order_summaries" ("live");
create index if not exists "order_summaries_by_has_tasks" on public."order_summaries" ("hasTasks");
create index if not exists "order_summaries_created" on public."order_summaries" ("createdAt");
create index if not exists "order_summaries_created_id" on public."order_summaries" ("createdAt", "id");

create table if not exists public."kpi_snapshots" (
  "id" text primary key,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
alter table public."kpi_snapshots" enable row level security;
alter table public."kpi_snapshots" add column if not exists "key" text;
alter table public."kpi_snapshots" add column if not exists "version" bigint;
alter table public."kpi_snapshots" add column if not exists "data" jsonb;
alter table public."kpi_snapshots" add column if not exists "validUntil" timestamptz;
alter table public."kpi_snapshots" add column if not exists "computedAt" timestamptz;
create unique index if not exists "kpi_snapshots_by_key" on public."kpi_snapshots" ("key");
create index if not exists "kpi_snapshots_created" on public."kpi_snapshots" ("createdAt");
create index if not exists "kpi_snapshots_created_id" on public."kpi_snapshots" ("createdAt", "id");

create or replace function public.next_number(counter_key text)
returns bigint
language sql
security definer
set search_path = public
as $$
  insert into public.counters ("id", "key", "value")
  values (gen_random_uuid()::text, counter_key, 1)
  on conflict ("key") do update
    set "value" = public.counters."value" + 1, "updatedAt" = now()
  returning "value";
$$;
revoke all on function public.next_number(text) from public, anon, authenticated;
grant execute on function public.next_number(text) to service_role;

do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit)
    values ('arquivos', 'arquivos', false, 50000000)
    on conflict (id) do nothing;
  end if;
end $$;
