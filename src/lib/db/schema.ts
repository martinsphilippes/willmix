/**
 * Fonte única do esquema de dados do Portal Wellmix.
 *
 * Usado por:
 * - MemoryStore (desenvolvimento e testes sem Appwrite);
 * - AppwriteStore (produção, TablesDB);
 * - scripts/appwrite-config.ts (gera appwrite.config.json a partir daqui).
 *
 * Campos `id`, `createdAt` e `updatedAt` existem em todas as tabelas e são
 * mapeados para `$id`, `$createdAt` e `$updatedAt` no Appwrite.
 */

export const ROLES = [
  "admin",
  "operator",
  "customer",
  "supplier",
  "agency",
  "broker",
  "shipping_line",
  "carrier",
  "legal",
] as const;
export type Role = (typeof ROLES)[number];

export const PARTY_TYPES = [
  "customer",
  "supplier",
  "agency",
  "broker",
  "shipping_line",
  "carrier",
  "legal",
] as const;
export type PartyType = (typeof PARTY_TYPES)[number];

export const LOCALES = ["pt", "en", "zh"] as const;
export type Locale = (typeof LOCALES)[number];

export const REQUEST_STATUSES = [
  "REQUESTED",
  "RFQ_OPEN",
  "QUOTATION_RECEIVED",
  "SUPPLIER_SELECTED",
  "WAITING_DOWN_PAYMENT",
  "ORDERED",
  "CANCELLED",
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const STAGE_KEYS = [
  "ORDER_CREATED",
  "PREPARATION",
  "SUPPLIER_PAYMENT",
  "PACKAGING",
  "INSPECTION",
  "SHIPPING",
  "CUSTOMS",
  "TRANSPORT",
  "DELIVERED",
  "CLOSED",
] as const;
export type StageKey = (typeof STAGE_KEYS)[number];

/** "cancelled": etapa que não aconteceu porque o pedido foi cancelado. */
export const STAGE_STATUSES = [
  "pending",
  "active",
  "blocked",
  "done",
  "cancelled",
] as const;
export type StageStatus = (typeof STAGE_STATUSES)[number];

/** Situação do pedido: a etapa em andamento, ou CANCELLED (cancelado pela Wellmix). */
export const ORDER_STATUSES = [...STAGE_KEYS, "CANCELLED"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Motivos de cancelamento do pedido (lista curta; o texto livre fica na observação). */
export const ORDER_CANCEL_REASONS = [
  "customer_withdrew",
  "supplier_issue",
  "quality_rejected",
  "price_or_deadline",
  "other",
] as const;
export type OrderCancelReason = (typeof ORDER_CANCEL_REASONS)[number];

/** Pedido de cancelamento feito pelo cliente: aguardando, recusado ou aceito (pedido cancelado). */
export const CANCEL_REQUEST_STATUSES = [
  "requested",
  "rejected",
  "approved",
] as const;
export type CancelRequestStatus = (typeof CANCEL_REQUEST_STATUSES)[number];

export const REQUIREMENT_TYPES = [
  "file",
  "photo",
  "text",
  "number",
  "date",
  "confirm",
  "approval",
] as const;
export type RequirementType = (typeof REQUIREMENT_TYPES)[number];

export const REQUIREMENT_STATUSES = ["pending", "done", "rejected"] as const;
export type RequirementStatus = (typeof REQUIREMENT_STATUSES)[number];

export const QUOTE_STATUSES = [
  "invited",
  "answered",
  "selected",
  "rejected",
] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const PAYMENT_DIRECTIONS = ["customer_in", "supplier_out"] as const;
export type PaymentDirection = (typeof PAYMENT_DIRECTIONS)[number];
export const PAYMENT_STATUSES = ["pending", "confirmed", "received"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const DOCUMENT_TYPES = [
  "manual",
  "dieline",
  "label",
  "photo",
  "proof",
  "inspection",
  "bl",
  "customs",
  "art",
  "attachment",
  "other",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const VISIBILITIES = [
  "internal",
  "customer",
  "supplier",
  "all",
] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export const NOTIFICATION_CHANNELS = ["inapp", "email", "whatsapp"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const PENALTY_STATUSES = [
  "open",
  "disputed",
  "paid",
  "cancelled",
] as const;
export type PenaltyStatus = (typeof PENALTY_STATUSES)[number];

export const ERP_SYNC_STATUSES = [
  "pending",
  "synced",
  "failed",
  "manual",
] as const;
export type ErpSyncStatus = (typeof ERP_SYNC_STATUSES)[number];

/* ---- Evolução incremental (docs/EVOLUTION_PLAN.md): sourcing, ficha, container, inspeção ---- */

/** Origem da informação de um produto: cadastro manual, sourcing na China ou importação de planilha. */
export const PRODUCT_SOURCES = ["manual", "sourcing", "import"] as const;
export type ProductSource = (typeof PRODUCT_SOURCES)[number];

export const VISIT_STATUSES = ["planned", "done"] as const;
export type VisitStatus = (typeof VISIT_STATUSES)[number];

export const SOURCING_STATUSES = [
  "draft",
  "negotiating",
  "approved",
  "promoted",
  "discarded",
] as const;
export type SourcingStatus = (typeof SOURCING_STATUSES)[number];

/** Tipos de foto: original é evidência da negociação e nunca é substituída pela comercial. */
export const PHOTO_KINDS = [
  "original",
  "commercial",
  "dimension_front",
  "dimension_side",
  "dimension_depth",
  "dimension_height",
  "dimension_scale",
  "dimension_other",
  "weight_scale",
  "packaging",
  "other",
  /* Ficha de compra (planilha COMPRAS): mais ângulos, cartão do fornecedor e foto de referência. */
  "angle",
  "business_card",
  "prompt",
] as const;
export type PhotoKind = (typeof PHOTO_KINDS)[number];

/* ---- Ficha de compra (planilha COMPRAS, etapa Preparação) ---- */
export const SHEET_INCOTERMS = ["FOB", "EXW"] as const;
export type SheetIncoterm = (typeof SHEET_INCOTERMS)[number];
/** Planilha COMPRAS usa U$/RMB; Real e Euro completam as moedas da Wellmix. */
export const SHEET_CURRENCIES = ["USD", "RMB", "BRL", "EUR"] as const;
export type SheetCurrency = (typeof SHEET_CURRENCIES)[number];
export const SHEET_POWER_SOURCES = [
  "none",
  "battery",
  "110v",
  "220v",
  "bivolt",
  "usb",
] as const;
export type SheetPowerSource = (typeof SHEET_POWER_SOURCES)[number];

export const MEASUREMENT_KINDS = [
  "weight_net",
  "weight_gross",
  "length",
  "width",
  "height",
  "cbm",
  "quantity",
  "master_box",
  "inner_box",
] as const;
export type MeasurementKind = (typeof MEASUREMENT_KINDS)[number];

export const SCHEDULE_STATUSES = [
  "planned",
  "confirmed",
  "ordered",
  "cancelled",
] as const;
export type ScheduleStatus = (typeof SCHEDULE_STATUSES)[number];

export const CONTAINER_STATUSES = [
  "planning",
  "loading",
  "shipped",
  "arrived",
  "closed",
] as const;
export type ContainerStatus = (typeof CONTAINER_STATUSES)[number];

/** Visualizar e confirmar são eventos diferentes; "visualizou" nunca vale como "confirmou". */
export const ACK_EVENTS = ["viewed", "confirmed"] as const;
export type AckEvent = (typeof ACK_EVENTS)[number];

/** Cotação de frete da companhia marítima para a cotação de um fornecedor. */
export const FREIGHT_QUOTE_STATUSES = [
  "invited",
  "answered",
  "cancelled",
] as const;
export type FreightQuoteStatus = (typeof FREIGHT_QUOTE_STATUSES)[number];

export const REVIEW_STATUSES = ["open", "resolved", "dismissed"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const INSPECTION_RESULTS = [
  "APPROVED",
  "DIVERGENT",
  "REVIEW_REQUIRED",
] as const;
export type InspectionResult = (typeof INSPECTION_RESULTS)[number];

/* ---- Segunda Onda: NCM, certificações, pós-venda, reposição, sourcing sob demanda ---- */

/** Origem de uma solicitação: manual (padrão), recompra, nova proposta ou produto ainda não catalogado. */
export const REQUEST_ORIGINS = [
  "manual",
  "replenishment",
  "proposal",
  "sourcing_demand",
] as const;
export type RequestOrigin = (typeof REQUEST_ORIGINS)[number];

/** Classificação fiscal: sugestão nunca é definitiva; só "validated" vale. */
export const TAX_STATUSES = ["suggested", "validated", "rejected"] as const;
export type TaxStatus = (typeof TAX_STATUSES)[number];
export const TAX_SOURCES = ["manual", "heuristic", "ai", "broker"] as const;
export type TaxSource = (typeof TAX_SOURCES)[number];
/** De onde veio o NCM confirmado da solicitação. */
export const REQUEST_NCM_SOURCES = [
  "product",
  "ai",
  "table",
  "manual",
] as const;
export type RequestNcmSource = (typeof REQUEST_NCM_SOURCES)[number];

/** Sugestão de NCM guardada na solicitação (IA ou tabela). Nunca vale sem confirmação. */
export interface NcmSuggestion {
  ncm: string;
  description: string | null;
  reason: string | null;
  source: "ai" | "table";
  model: string | null;
}

export const CERTIFICATION_STATUSES = [
  "pending",
  "valid",
  "expired",
  "rejected",
] as const;
export type CertificationStatus = (typeof CERTIFICATION_STATUSES)[number];

export const AFTER_SALES_STATUSES = ["open", "answered", "closed"] as const;
export type AfterSalesStatus = (typeof AFTER_SALES_STATUSES)[number];
export const REPURCHASE_INTERESTS = ["yes", "maybe", "no"] as const;
export type RepurchaseInterest = (typeof REPURCHASE_INTERESTS)[number];

/* ---- Visão de Produto ---- */
/** Modalidade de operação do cliente: importação própria (RADAR do cliente) ou via estrutura/trade da Wellmix. */
export const OPERATION_MODES = ["own_import", "via_trade", "other"] as const;
export type OperationMode = (typeof OPERATION_MODES)[number];
/** Habilitação RADAR (Siscomex) do cliente. Nulo = não informado. */
export const RADAR_STATUSES = [
  "none",
  "express",
  "limited",
  "unlimited",
] as const;
export type RadarStatus = (typeof RADAR_STATUSES)[number];
export const AI_SUGGESTION_KINDS = [
  "product_fields",
  "marketing_text",
] as const;
export type AiSuggestionKind = (typeof AI_SUGGESTION_KINDS)[number];
export const AI_SUGGESTION_STATUSES = [
  "suggested",
  "applied",
  "discarded",
] as const;
export type AiSuggestionStatus = (typeof AI_SUGGESTION_STATUSES)[number];
/** De onde veio a sugestão: API real ou mock claramente rotulado (nunca dado falso como real). */
export const AI_SOURCES = ["api", "mock"] as const;
export type AiSource = (typeof AI_SOURCES)[number];
/** Preview → Oferta → Compra → Pagamento → Liberação. */
export const MARKETING_KIT_STATUSES = [
  "draft",
  "preview",
  "offered",
  "purchased",
  "paid",
  "released",
  "cancelled",
] as const;
export type MarketingKitStatus = (typeof MARKETING_KIT_STATUSES)[number];
/** Leitura do link de referência: ok, site bloqueou/sem dados, falha de rede, link inválido. */
export const LINK_STATUSES = ["ok", "blocked", "failed", "invalid"] as const;
export type LinkStatus = (typeof LINK_STATUSES)[number];

export const IMPORT_BATCH_STATUSES = [
  "uploaded",
  "mapped",
  "imported",
  "cancelled",
] as const;
export type ImportBatchStatus = (typeof IMPORT_BATCH_STATUSES)[number];

/* ------------------------------------------------------------------------ */
/* Tipos das linhas                                                          */
/* ------------------------------------------------------------------------ */

export interface BaseRow {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface User extends BaseRow {
  email: string;
  name: string;
  role: Role;
  partyId: string | null;
  locale: Locale;
  passwordHash: string | null;
  active: boolean;
  /** Preparação multi-importador: nulo = a importadora dona da plataforma (Wellmix). */
  importerId: string | null;
}

export interface Party extends BaseRow {
  type: PartyType;
  name: string;
  country: string | null;
  email: string | null;
  phone: string | null;
  taxId: string | null;
  notes: string | null;
  active: boolean;
  /* Sourcing (opcionais; nulos nos registros antigos) */
  city: string | null;
  address: string | null;
  contactName: string | null;
  wechat: string | null;
  /* Visão de Produto: modalidade de operação do cliente (nulos nos cadastros antigos = não informado) */
  operationMode: OperationMode | null;
  radar: RadarStatus | null;
  radarNotes: string | null;
  /** Preparação multi-importador: nulo = Wellmix. */
  importerId: string | null;
  /* Dados bancários (fornecedor): base do "copiar dados para o banco" no pagamento. */
  bankBeneficiary: string | null;
  bankName: string | null;
  bankAccount: string | null;
  bankSwift: string | null;
  bankAddress: string | null;
}

export interface RequirementTemplate {
  key: string;
  label: string;
  type: RequirementType;
  required: boolean;
  /** Papel que preenche o requisito. Wellmix pode preencher qualquer um. */
  role: Role;
}

export interface ProductLine extends BaseRow {
  name: string;
  manualDocumentId: string | null;
  /** JSON: RequirementTemplate[] aplicados na etapa PREPARATION. */
  requirements: RequirementTemplate[];
  active: boolean;
  /** Certificações obrigatórias (ex.: ["Inmetro"]); sem certificação válida o pedido entra em revisão. */
  requiredCertifications: string[] | null;
  /** Prompts e regras da linha (Prompt Base + Linha + Produto + Contexto em src/lib/ai/prompts.ts). */
  prompts: LinePrompts | null;
}

/** Configuração de IA e de validação por linha de produto. Tudo opcional; nulo = só o prompt base. */
export interface LinePrompts {
  descriptionPrompt: string | null;
  marketingPrompt: string | null;
  imagePrompt: string | null;
  /** Atributos que a ficha deve ter (ex.: material, cor, pantone); conferência determinística. */
  requiredAttributes: string[];
  /** Regras em texto livre para o operador e para o prompt (ex.: "sem menção a marca de terceiros"). */
  validationRules: string[];
}

export interface Product extends BaseRow {
  lineId: string;
  name: string;
  sku: string | null;
  specification: string | null;
  active: boolean;
  /* Ficha completa (todos opcionais; a linha de produto pode exigir alguns) */
  supplierId: string | null;
  supplierSku: string | null;
  category: string | null;
  material: string | null;
  color: string | null;
  pantone: string | null;
  moq: number | null;
  price: number | null;
  currency: string | null;
  masterBoxQty: number | null;
  innerBoxQty: number | null;
  netWeightKg: number | null;
  grossWeightKg: number | null;
  widthCm: number | null;
  heightCm: number | null;
  lengthCm: number | null;
  /** Dimensões da caixa master (cm); o CBM é por caixa master, calculado delas quando não informado. */
  boxLengthCm: number | null;
  boxWidthCm: number | null;
  boxHeightCm: number | null;
  cbm: number | null;
  notes: string | null;
  source: ProductSource | null;
  negotiatedAt: string | null;
  sourcingItemId: string | null;
  primaryPhotoDocumentId: string | null;
  /** NCM validado (cópia da classificação "validated"); nunca vem direto de sugestão. */
  ncm: string | null;
  /** Faixas de preço por quantidade negociadas: [{ minQty, price }]. Base da análise de oportunidade. */
  priceTiers: PriceTier[] | null;
}

export interface PriceTier {
  minQty: number;
  price: number;
}

export interface Request extends BaseRow {
  customerId: string;
  createdByUserId: string;
  productId: string | null;
  productName: string;
  description: string;
  specification: string | null;
  quantity: number;
  unit: string;
  deadline: string | null;
  status: RequestStatus;
  selectedQuoteId: string | null;
  orderId: string | null;
  /** Preço de venda ao cliente definido pela Wellmix ao selecionar fornecedor. */
  sellPrice: number | null;
  sellCurrency: string | null;
  downPaymentAmount: number | null;
  notes: string | null;
  /* Segunda Onda (nulos nas solicitações antigas = manual) */
  origin: RequestOrigin | null;
  /** Pedido anterior de que esta solicitação deriva (recompra, nova proposta). */
  sourceOrderId: string | null;
  /**
   * Login do cliente que solicitou (só ele vê a solicitação e o pedido). Cliente
   * criando = ele mesmo; Wellmix criando em nome do cliente = o login escolhido
   * (nulo = nenhum login do cliente vê).
   */
  requestedForUserId: string | null;
  /*
   * Classificação fiscal da solicitação (opcionais: solicitações antigas ficam
   * sem). NCM do cadastro do produto vale direto; sem cadastro, a IA sugere e a
   * Wellmix confirma. II e IPI saem da tabela TEC/TIPI por este NCM.
   */
  ncm?: string | null;
  ncmSource?: RequestNcmSource | null;
  ncmConfirmedByUserId?: string | null;
  ncmConfirmedAt?: string | null;
  ncmSuggestions?: NcmSuggestion[] | null;
  /**
   * Lote: várias solicitações criadas juntas num formulário só (um produto por
   * solicitação, mesmo lote). Nulo nas solicitações criadas uma a uma.
   */
  groupId?: string | null;
  /** Programação de entregas pedida pelo cliente (N entregas, intervalo, datas). */
  schedule?: RequestSchedule | null;
}

export interface Quote extends BaseRow {
  requestId: string;
  supplierId: string;
  status: QuoteStatus;
  price: number | null;
  currency: string | null;
  leadTimeDays: number | null;
  conditions: string | null;
  validUntil: string | null;
  answeredAt: string | null;
}

export interface Order extends BaseRow {
  number: number;
  requestId: string;
  customerId: string;
  supplierId: string;
  lineId: string | null;
  status: OrderStatus;
  currentStageId: string | null;
  fobTotal: number | null;
  fobCurrency: string | null;
  sellPrice: number | null;
  sellCurrency: string | null;
  erpSyncStatus: ErpSyncStatus;
  erpNumber: string | null;
  agencyId: string | null;
  brokerId: string | null;
  shippingLineId: string | null;
  carrierId: string | null;
  closedAt: string | null;
  notes: string | null;
  /** Modalidade de operação copiada do cliente ao criar o pedido (nulo nos antigos). */
  operationMode: OperationMode | null;
  /** Login do cliente que solicitou: só ele, entre os logins do cliente, vê o pedido. */
  requestedByUserId: string | null;
  /*
   * Cancelamento (só admin, a qualquer momento). Opcionais: pedidos antigos
   * ficam sem. O acerto financeiro com o cliente é texto livre, editável.
   */
  cancelledAt?: string | null;
  cancelledByUserId?: string | null;
  cancelReason?: OrderCancelReason | null;
  cancelNote?: string | null;
  cancelSettlement?: string | null;
  /** Etapa em que o pedido estava quando foi cancelado. */
  cancelStageKey?: StageKey | null;
  /** Pedido de cancelamento do cliente (até a produção começar). */
  cancelRequestStatus?: CancelRequestStatus | null;
  cancelRequestedAt?: string | null;
  cancelRequestedByUserId?: string | null;
  cancelRequestReason?: string | null;
  cancelRequestResponse?: string | null;
}

export interface OrderItem extends BaseRow {
  orderId: string;
  productId: string | null;
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number | null;
}

export interface Stage extends BaseRow {
  orderId: string;
  key: StageKey;
  sequence: number;
  status: StageStatus;
  responsibleRole: Role;
  responsiblePartyId: string | null;
  dueAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  percent: number;
  reminderSentAt: string | null;
  blockReason: string | null;
}

export interface Requirement extends BaseRow {
  orderId: string;
  stageId: string;
  key: string;
  label: string;
  type: RequirementType;
  required: boolean;
  role: Role;
  status: RequirementStatus;
  value: string | null;
  documentId: string | null;
  submittedByUserId: string | null;
  submittedAt: string | null;
  note: string | null;
}

export interface Document extends BaseRow {
  orderId: string | null;
  requestId: string | null;
  requirementId: string | null;
  type: DocumentType;
  name: string;
  mime: string;
  size: number;
  storageKey: string;
  version: number;
  previousDocumentId: string | null;
  uploadedByUserId: string;
  visibility: Visibility;
  /* Fotos de produto e de sourcing (sem pedido nem solicitação) */
  productId: string | null;
  sourcingItemId: string | null;
  /** Arquivo de kit de marketing (prévia ou final); acesso do cliente depende da situação do kit. */
  kitId: string | null;
  /** Impressão digital visual (dHash, 16 hex) para achar a mesma foto no catálogo; "-" = não é imagem legível. */
  imageHash: string | null;
}

export interface Payment extends BaseRow {
  orderId: string | null;
  requestId: string | null;
  direction: PaymentDirection;
  amount: number;
  currency: string;
  fxRate: number | null;
  method: string | null;
  status: PaymentStatus;
  proofDocumentId: string | null;
  registeredByUserId: string;
  confirmedByUserId: string | null;
  confirmedAt: string | null;
  note: string | null;
  /** Pagamento de kit de marketing (sem pedido nem solicitação). */
  kitId: string | null;
}

export interface Notification extends BaseRow {
  userId: string | null;
  partyId: string | null;
  role: Role | null;
  channel: NotificationChannel;
  subject: string;
  body: string;
  link: string | null;
  status: "sent" | "mock" | "failed";
  readAt: string | null;
}

export interface AuditEntry extends BaseRow {
  userId: string | null;
  action: string;
  entity: string;
  entityId: string;
  summary: string;
  before: unknown;
  after: unknown;
}

export interface Penalty extends BaseRow {
  orderId: string;
  responsiblePartyId: string | null;
  reason: string;
  amount: number;
  currency: string;
  evidenceDocumentId: string | null;
  status: PenaltyStatus;
  createdByUserId: string;
}

export interface Setting extends BaseRow {
  key: string;
  value: unknown;
}

export interface Counter extends BaseRow {
  key: string;
  value: number;
}

/* ---- Sourcing / compras na China ---- */

export interface SupplierVisit extends BaseRow {
  supplierId: string | null;
  /** Nome livre quando o fornecedor ainda não está cadastrado. */
  supplierName: string | null;
  factoryName: string | null;
  city: string | null;
  address: string | null;
  /** Local: feira, loja, fábrica, escritório. */
  location: string | null;
  visitedAt: string;
  participants: string | null;
  notes: string | null;
  nextVisitAt: string | null;
  followUp: string | null;
  status: VisitStatus;
  createdByUserId: string;
}

/** Produto encontrado numa visita ou negociação; vira Product quando aprovado. */
export interface SourcingItem extends BaseRow {
  visitId: string | null;
  supplierId: string | null;
  supplierName: string | null;
  productId: string | null;
  lineId: string | null;
  category: string | null;
  name: string;
  description: string | null;
  supplierSku: string | null;
  material: string | null;
  color: string | null;
  pantone: string | null;
  price: number | null;
  currency: string | null;
  moq: number | null;
  masterBoxQty: number | null;
  innerBoxQty: number | null;
  netWeightKg: number | null;
  grossWeightKg: number | null;
  widthCm: number | null;
  heightCm: number | null;
  lengthCm: number | null;
  boxLengthCm: number | null;
  boxWidthCm: number | null;
  boxHeightCm: number | null;
  cbm: number | null;
  conditions: string | null;
  notes: string | null;
  foundAt: string | null;
  city: string | null;
  location: string | null;
  status: SourcingStatus;
  primaryPhotoDocumentId: string | null;
  createdByUserId: string;
  /** Sourcing sob demanda: solicitação do cliente que originou a busca. */
  requestId: string | null;
  priceTiers: PriceTier[] | null;
}

export interface ProductPhoto extends BaseRow {
  productId: string | null;
  sourcingItemId: string | null;
  orderId: string | null;
  documentId: string;
  kind: PhotoKind;
  caption: string | null;
  takenAt: string | null;
  takenByUserId: string | null;
  /** Imagem comercial derivada de qual original. */
  derivedFromPhotoId: string | null;
  isPrimary: boolean;
}

/** Evidência de peso ou medida: valor informado, valor medido, foto, quem e quando. */
export interface Measurement extends BaseRow {
  entity: "product" | "sourcing_item" | "order";
  entityId: string;
  kind: MeasurementKind;
  declaredValue: number | null;
  measuredValue: number;
  unit: string;
  photoDocumentId: string | null;
  measuredByUserId: string;
  measuredAt: string;
  note: string | null;
}

/** Fotografia lógica do que foi efetivamente comprado; não muda se o cadastro mestre mudar. */
export interface PurchaseSnapshot extends BaseRow {
  orderId: string;
  orderItemId: string | null;
  requestId: string | null;
  productId: string | null;
  sourcingItemId: string | null;
  supplierId: string;
  quoteId: string | null;
  name: string;
  supplierSku: string | null;
  material: string | null;
  color: string | null;
  pantone: string | null;
  unitPrice: number | null;
  currency: string | null;
  quantity: number;
  unit: string;
  moq: number | null;
  masterBoxQty: number | null;
  innerBoxQty: number | null;
  netWeightKg: number | null;
  grossWeightKg: number | null;
  widthCm: number | null;
  heightCm: number | null;
  lengthCm: number | null;
  boxLengthCm: number | null;
  boxWidthCm: number | null;
  boxHeightCm: number | null;
  cbm: number | null;
  specification: string | null;
  conditions: string | null;
  /** IDs dos documentos de foto no momento da compra. */
  photoDocumentIds: string[];
  /** Ex.: "gerado retroativamente" para pedidos anteriores ao snapshot. */
  note: string | null;
  createdByUserId: string;
  ncm: string | null;
}

export interface PurchaseSchedule extends BaseRow {
  productId: string | null;
  sourcingItemId: string | null;
  customerId: string | null;
  supplierId: string | null;
  requestId: string | null;
  orderId: string | null;
  sequence: number;
  quantity: number;
  unit: string;
  scheduledFor: string | null;
  periodLabel: string | null;
  price: number | null;
  currency: string | null;
  status: ScheduleStatus;
  notes: string | null;
  createdByUserId: string;
}

/* ---- Container ---- */

export interface Container extends BaseRow {
  code: string;
  /** Tipo configurável em settings.containerTypes (ex.: 20GP, 40HC). */
  type: string;
  capacityCbm: number;
  maxWeightKg: number | null;
  customerId: string | null;
  status: ContainerStatus;
  etd: string | null;
  eta: string | null;
  notes: string | null;
  createdByUserId: string;
}

/** Item dentro do container. Com orderId é mercadoria vendida; sem, é estoque disponível. */
export interface ContainerItem extends BaseRow {
  containerId: string;
  orderId: string | null;
  orderItemId: string | null;
  productId: string | null;
  name: string;
  quantity: number;
  unit: string;
  unitsPerBox: number | null;
  boxCount: number;
  cbmPerBox: number;
  weightPerBoxKg: number | null;
}

/* ---- Confirmação de visualização, revisão e inspeção ---- */

export interface Acknowledgement extends BaseRow {
  entity: "document" | "payment";
  entityId: string;
  userId: string;
  partyId: string | null;
  event: AckEvent;
  at: string;
  note: string | null;
}

/** Fila "itens para revisão": o que violou uma regra, esperado × encontrado, quem resolve. */
export interface ReviewItem extends BaseRow {
  orderId: string | null;
  entity: string;
  entityId: string;
  rule: string;
  problem: string;
  expected: string | null;
  found: string | null;
  responsibleRole: Role | null;
  action: string | null;
  link: string | null;
  status: ReviewStatus;
  resolvedByUserId: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
}

export interface InspectionComparison {
  attribute: string;
  expected: number | string | null;
  found: number | string | null;
  tolerancePercent: number | null;
  ok: boolean;
}

export interface InspectionResultRow extends BaseRow {
  orderId: string;
  stageId: string;
  snapshotId: string | null;
  result: InspectionResult;
  comparisons: InspectionComparison[];
  measuredByUserId: string | null;
  comparedAt: string;
  note: string | null;
}

/* ---- Importação de planilhas (XLSX/CSV) com mapeamento e conferência ---- */

export interface ImportBatch extends BaseRow {
  entity: string;
  fileDocumentId: string | null;
  fileName: string;
  sheetName: string | null;
  headers: string[];
  /** Linhas lidas (limitadas); cada linha é um objeto cabeçalho → valor. */
  rows: Record<string, string>[];
  /** Coluna de origem → campo de destino. */
  mapping: Record<string, string>;
  /** Decisão por linha: create | update:<id> | skip. */
  decisions: Record<string, string>;
  status: ImportBatchStatus;
  summary: Record<string, number> | null;
  rowCount: number;
  createdByUserId: string;
}

/* ---- Segunda Onda ---- */

/** Candidatas e classificação fiscal validada de um produto. */
export interface TaxClassification extends BaseRow {
  productId: string;
  ncm: string;
  description: string | null;
  /** Alíquotas informadas (%), sem cálculo automático: { II, IPI, PIS, COFINS, ICMS }. */
  taxes: Record<string, number> | null;
  adminTreatment: string | null;
  notes: string | null;
  source: TaxSource;
  /** Texto livre da fonte (site, despachante, tabela). */
  sourceRef: string | null;
  status: TaxStatus;
  suggestedByUserId: string | null;
  validatedByUserId: string | null;
  validatedAt: string | null;
}

/** Certificação/ensaio de produto ou fornecedor, com documento e validade. */
export interface Certification extends BaseRow {
  entity: "product" | "party";
  entityId: string;
  /** Tipo (ex.: Inmetro, CE, ensaio de laboratório) — casa com ProductLine.requiredCertifications. */
  kind: string;
  name: string | null;
  issuer: string | null;
  number: string | null;
  validUntil: string | null;
  documentId: string | null;
  status: CertificationStatus;
  notes: string | null;
  createdByUserId: string;
  validatedByUserId: string | null;
  validatedAt: string | null;
}

/** Pós-venda: aberto na entrega; o cliente responde; a Wellmix encerra. */
export interface AfterSales extends BaseRow {
  orderId: string;
  customerId: string;
  status: AfterSalesStatus;
  rating: number | null;
  experience: string | null;
  problems: string | null;
  perceivedCosts: string | null;
  suggestions: string | null;
  repurchaseInterest: RepurchaseInterest | null;
  answeredAt: string | null;
  answeredByUserId: string | null;
  closedAt: string | null;
  notes: string | null;
}

/** Sugestão de IA (cadastro por foto ou texto de marketing): humano confirma campo a campo. */
export interface AiSuggestion extends BaseRow {
  entity: "product" | "sourcing_item" | "marketing_kit";
  entityId: string;
  kind: AiSuggestionKind;
  source: AiSource;
  model: string | null;
  /** Prompt efetivamente enviado (base + linha + produto + contexto), para auditoria. */
  prompt: string;
  imageDocumentId: string | null;
  /** Campos sugeridos (JSON validado no serviço). */
  fields: Record<string, unknown>;
  rawText: string | null;
  status: AiSuggestionStatus;
  requestedByUserId: string;
  decidedByUserId: string | null;
  decidedAt: string | null;
  /** Quais campos foram aplicados, ou motivo do descarte. */
  note: string | null;
}

/** Kit de marketing por produto: prévia → oferta → compra → pagamento → liberação. Preço vem das configurações. */
export interface MarketingKit extends BaseRow {
  productId: string;
  customerId: string | null;
  name: string;
  price: number;
  currency: string;
  status: MarketingKitStatus;
  concept: string | null;
  slogan: string | null;
  description: string | null;
  campaign: string | null;
  colors: string[] | null;
  pantone: string | null;
  /** Prévias (visíveis ao cliente a partir da oferta). */
  previewDocumentIds: string[];
  /** Arquivos finais (visíveis ao cliente só depois de liberado). */
  releasedDocumentIds: string[];
  paymentId: string | null;
  offeredAt: string | null;
  purchasedAt: string | null;
  paidAt: string | null;
  releasedAt: string | null;
  notes: string | null;
  createdByUserId: string;
}

/** Produto do catálogo que corresponde à foto/link, com o motivo. */
export interface LookupMatch {
  productId: string;
  /** 0–1; só para ordenar. */
  score: number;
  /** Mesmo produto: foto, foto do link, nome/SKU, IA. Relacionado: mesma categoria, palavra em comum. */
  reasons: Array<"photo" | "link_photo" | "name" | "ai" | "category" | "word">;
}

export type LookupSource = "link" | "catalog" | "ai" | "mock";
export interface LookupOption {
  value: string;
  source: LookupSource;
}
export type LookupField = "productName" | "description" | "specification";

/** Programação de entregas pedida pelo cliente na solicitação. */
export interface RequestScheduleItem {
  /** 1, 2, 3… */
  index: number;
  quantity: number;
  /** AAAA-MM-DD: 1ª data + intervalo × (n − 1). */
  expectedAt: string;
}
export interface RequestSchedule {
  intervalDays: number;
  /** AAAA-MM-DD da 1ª entrega prevista. */
  firstDate: string;
  items: RequestScheduleItem[];
}

/** Cor Pantone na ficha: código como no leque ("185 C") e hex aproximado. */
export interface PantoneColorRef {
  code: string;
  hex: string;
}

/** Lote da programação de compra: intervalo de saída (dias) e quantidade em caixas master. */
export interface PurchaseLot {
  departureIntervalDays: number | null;
  masterCartons: number | null;
}

/**
 * Ficha de compra do pedido (planilha COMPRAS): um registro por pedido, preenchido
 * à mão na Preparação pelo fornecedor ou pela Wellmix; NCM/II/IPI pelo despachante.
 * Cliente nunca vê (fornecedor, contato e preço). Peças, CBM, containers e datas
 * de saída são calculados (services/purchase-sheet.ts), não digitados.
 */
export interface PurchaseSheet extends BaseRow {
  orderId: string;
  productId: string | null;
  sheetDate: string | null;
  location: string | null;
  supplierName: string | null;
  supplierStore: string | null;
  supplierPhone: string | null;
  factoryItemCode: string | null;
  incoterm: SheetIncoterm | null;
  currency: SheetCurrency | null;
  price: number | null;
  moq: number | null;
  masterCartonQty: number | null;
  innerQty: number | null;
  netWeightPcKg: number | null;
  grossWeightPcKg: number | null;
  cbmPerCarton: number | null;
  heightCm: number | null;
  widthCm: number | null;
  lengthCm: number | null;
  capacityMl: number | null;
  packageType: string | null;
  colorAssortment: string | null;
  /** Cores Pantone escolhidas na tabela (código e sRGB aproximado). */
  colorPantones?: PantoneColorRef[] | null;
  material: string | null;
  powerSource: SheetPowerSource | null;
  powerDetail: string | null;
  productionStartAt: string | null;
  lots: PurchaseLot[] | null;
  containerType: string | null;
  ncm: string | null;
  importTaxPercent: number | null;
  ipiPercent: number | null;
  ecommerceDescription: string | null;
  notes: string | null;
  updatedByUserId: string | null;
  completedAt: string | null;
}

/**
 * Pedido de frete à companhia marítima: nasce quando o fornecedor envia a
 * cotação (com a ficha) e guarda a carga que a companhia viu (CBM, caixas,
 * peso) e o valor que ela informou. Uma por cotação de fornecedor e companhia.
 */
export interface FreightQuote extends BaseRow {
  requestId: string;
  /** Cotação do fornecedor a que este frete se refere. */
  quoteId: string;
  /** Companhia marítima (parceiro do tipo shipping_line). */
  carrierId: string;
  status: FreightQuoteStatus;
  /** Carga no momento do pedido de frete (muda se o fornecedor reenviar a ficha). */
  totalCbm: number | null;
  cartons: number | null;
  grossWeightKg: number | null;
  /** Valor total do frete informado pela companhia. */
  amount: number | null;
  currency: string | null;
  transitDays: number | null;
  validUntil: string | null;
  notes: string | null;
  answeredByUserId: string | null;
  answeredAt: string | null;
}

/** Busca de produto por foto ou link (tela de nova solicitação). Guarda o que foi achado e sugerido. */
export interface ProductLookup extends BaseRow {
  userId: string;
  customerId: string | null;
  imageDocumentId: string | null;
  url: string | null;
  linkStatus: LinkStatus | null;
  linkTitle: string | null;
  linkSiteName: string | null;
  linkImageUrl: string | null;
  /** Preço exibido no link (referência de varejo; nunca vira preço de compra). */
  linkPrice: string | null;
  imageHash: string | null;
  linkImageHash: string | null;
  matches: LookupMatch[];
  suggestions: Partial<Record<LookupField, LookupOption[]>>;
  aiSource: AiSource | null;
  /** Motivo da falha da IA nesta busca (card_required, no_credit…); nulo se não falhou. */
  aiError: string | null;
  requestId: string | null;
}

export interface Tables {
  users: User;
  parties: Party;
  product_lines: ProductLine;
  products: Product;
  requests: Request;
  quotes: Quote;
  orders: Order;
  order_items: OrderItem;
  stages: Stage;
  requirements: Requirement;
  documents: Document;
  payments: Payment;
  notifications: Notification;
  audit_log: AuditEntry;
  penalties: Penalty;
  settings: Setting;
  counters: Counter;
  supplier_visits: SupplierVisit;
  sourcing_items: SourcingItem;
  product_photos: ProductPhoto;
  measurements: Measurement;
  purchase_snapshots: PurchaseSnapshot;
  purchase_schedules: PurchaseSchedule;
  containers: Container;
  container_items: ContainerItem;
  acknowledgements: Acknowledgement;
  review_items: ReviewItem;
  inspection_results: InspectionResultRow;
  import_batches: ImportBatch;
  tax_classifications: TaxClassification;
  certifications: Certification;
  after_sales: AfterSales;
  ai_suggestions: AiSuggestion;
  marketing_kits: MarketingKit;
  product_lookups: ProductLookup;
  purchase_sheets: PurchaseSheet;
  freight_quotes: FreightQuote;
}
export type TableName = keyof Tables;

/* ------------------------------------------------------------------------ */
/* Definição de colunas (para Appwrite e validação básica)                   */
/* ------------------------------------------------------------------------ */

/** json = JSON em coluna de texto (64 KB); json_large = JSON em longtext (planilhas importadas). */
export type ColumnType =
  | "string"
  | "text"
  | "int"
  | "float"
  | "bool"
  | "datetime"
  | "json"
  | "json_large";

export interface ColumnDef {
  type: ColumnType;
  size?: number;
  required?: boolean;
  enum?: readonly string[];
}

export interface IndexDef {
  key: string;
  type: "key" | "unique";
  columns: string[];
}

export interface TableDef {
  label: string;
  columns: Record<string, ColumnDef>;
  indexes?: IndexDef[];
}

const id = (required = true): ColumnDef => ({
  type: "string",
  size: 36,
  required,
});
const str = (size: number, required = false): ColumnDef => ({
  type: "string",
  size,
  required,
});
const text = (required = false): ColumnDef => ({ type: "text", required });
const json = (): ColumnDef => ({ type: "json" });
const jsonLarge = (): ColumnDef => ({ type: "json_large" });
const int = (required = false): ColumnDef => ({ type: "int", required });
const float = (required = false): ColumnDef => ({ type: "float", required });
const bool = (): ColumnDef => ({ type: "bool" });
const datetime = (required = false): ColumnDef => ({
  type: "datetime",
  required,
});
const enumOf = (values: readonly string[], required = true): ColumnDef => ({
  type: "string",
  size: 40,
  required,
  enum: values,
});

export const TABLES: Record<TableName, TableDef> = {
  users: {
    label: "Usuários",
    columns: {
      email: str(254, true),
      name: str(120, true),
      role: enumOf(ROLES),
      partyId: id(false),
      locale: enumOf(LOCALES),
      passwordHash: str(255),
      active: bool(),
      importerId: id(false),
    },
    indexes: [{ key: "email_unique", type: "unique", columns: ["email"] }],
  },
  parties: {
    label: "Parceiros",
    columns: {
      type: enumOf(PARTY_TYPES),
      name: str(160, true),
      country: str(60),
      email: str(254),
      phone: str(40),
      taxId: str(40),
      notes: text(),
      active: bool(),
      city: str(80),
      address: str(255),
      contactName: str(120),
      wechat: str(80),
      operationMode: enumOf(OPERATION_MODES, false),
      radar: enumOf(RADAR_STATUSES, false),
      radarNotes: text(),
      importerId: id(false),
      bankBeneficiary: str(160),
      bankName: str(160),
      bankAccount: str(80),
      bankSwift: str(20),
      bankAddress: str(255),
    },
    indexes: [{ key: "by_type", type: "key", columns: ["type"] }],
  },
  product_lines: {
    label: "Linhas de produto",
    columns: {
      name: str(120, true),
      manualDocumentId: id(false),
      requirements: json(),
      active: bool(),
      requiredCertifications: json(),
      prompts: json(),
    },
  },
  products: {
    label: "Produtos",
    columns: {
      lineId: id(),
      name: str(160, true),
      sku: str(60),
      specification: text(),
      active: bool(),
      supplierId: id(false),
      supplierSku: str(60),
      category: str(80),
      material: str(120),
      color: str(60),
      pantone: str(40),
      moq: int(),
      price: float(),
      currency: str(3),
      masterBoxQty: int(),
      innerBoxQty: int(),
      netWeightKg: float(),
      grossWeightKg: float(),
      widthCm: float(),
      heightCm: float(),
      lengthCm: float(),
      boxLengthCm: float(),
      boxWidthCm: float(),
      boxHeightCm: float(),
      cbm: float(),
      notes: text(),
      source: enumOf(PRODUCT_SOURCES, false),
      negotiatedAt: datetime(),
      sourcingItemId: id(false),
      primaryPhotoDocumentId: id(false),
      ncm: str(10),
      priceTiers: json(),
    },
    indexes: [
      { key: "by_line", type: "key", columns: ["lineId"] },
      { key: "by_supplier", type: "key", columns: ["supplierId"] },
    ],
  },
  requests: {
    label: "Solicitações",
    columns: {
      customerId: id(),
      createdByUserId: id(),
      productId: id(false),
      productName: str(160, true),
      description: text(true),
      specification: text(),
      quantity: float(true),
      unit: str(20, true),
      deadline: datetime(),
      status: enumOf(REQUEST_STATUSES),
      selectedQuoteId: id(false),
      orderId: id(false),
      sellPrice: float(),
      sellCurrency: str(3),
      downPaymentAmount: float(),
      notes: text(),
      origin: enumOf(REQUEST_ORIGINS, false),
      sourceOrderId: id(false),
      requestedForUserId: id(false),
      ncm: str(10),
      ncmSource: enumOf(REQUEST_NCM_SOURCES, false),
      ncmConfirmedByUserId: id(false),
      ncmConfirmedAt: datetime(),
      ncmSuggestions: json(),
      groupId: id(false),
      schedule: json(),
    },
    indexes: [
      { key: "by_customer", type: "key", columns: ["customerId"] },
      { key: "by_status", type: "key", columns: ["status"] },
      { key: "by_group", type: "key", columns: ["groupId"] },
    ],
  },
  quotes: {
    label: "Cotações",
    columns: {
      requestId: id(),
      supplierId: id(),
      status: enumOf(QUOTE_STATUSES),
      price: float(),
      currency: str(3),
      leadTimeDays: int(),
      conditions: text(),
      validUntil: datetime(),
      answeredAt: datetime(),
    },
    indexes: [
      { key: "by_request", type: "key", columns: ["requestId"] },
      { key: "by_supplier", type: "key", columns: ["supplierId"] },
    ],
  },
  orders: {
    label: "Pedidos",
    columns: {
      number: int(true),
      requestId: id(),
      customerId: id(),
      supplierId: id(),
      lineId: id(false),
      status: enumOf(ORDER_STATUSES),
      currentStageId: id(false),
      fobTotal: float(),
      fobCurrency: str(3),
      sellPrice: float(),
      sellCurrency: str(3),
      erpSyncStatus: enumOf(ERP_SYNC_STATUSES),
      erpNumber: str(60),
      agencyId: id(false),
      brokerId: id(false),
      shippingLineId: id(false),
      carrierId: id(false),
      closedAt: datetime(),
      notes: text(),
      operationMode: enumOf(OPERATION_MODES, false),
      requestedByUserId: id(false),
      cancelledAt: datetime(),
      cancelledByUserId: id(false),
      cancelReason: enumOf(ORDER_CANCEL_REASONS, false),
      cancelNote: text(),
      cancelSettlement: text(),
      cancelStageKey: enumOf(STAGE_KEYS, false),
      cancelRequestStatus: enumOf(CANCEL_REQUEST_STATUSES, false),
      cancelRequestedAt: datetime(),
      cancelRequestedByUserId: id(false),
      cancelRequestReason: text(),
      cancelRequestResponse: text(),
    },
    indexes: [
      { key: "number_unique", type: "unique", columns: ["number"] },
      { key: "by_customer", type: "key", columns: ["customerId"] },
      { key: "by_supplier", type: "key", columns: ["supplierId"] },
      { key: "by_status", type: "key", columns: ["status"] },
    ],
  },
  order_items: {
    label: "Itens de pedido",
    columns: {
      orderId: id(),
      productId: id(false),
      name: str(160, true),
      quantity: float(true),
      unit: str(20, true),
      unitPrice: float(),
    },
    indexes: [{ key: "by_order", type: "key", columns: ["orderId"] }],
  },
  stages: {
    label: "Etapas",
    columns: {
      orderId: id(),
      key: enumOf(STAGE_KEYS),
      sequence: int(true),
      status: enumOf(STAGE_STATUSES),
      responsibleRole: enumOf(ROLES),
      responsiblePartyId: id(false),
      dueAt: datetime(),
      startedAt: datetime(),
      completedAt: datetime(),
      percent: int(true),
      reminderSentAt: datetime(),
      blockReason: text(),
    },
    indexes: [
      { key: "by_order", type: "key", columns: ["orderId"] },
      { key: "by_status", type: "key", columns: ["status"] },
    ],
  },
  requirements: {
    label: "Requisitos",
    columns: {
      orderId: id(),
      stageId: id(),
      key: str(60, true),
      label: str(160, true),
      type: enumOf(REQUIREMENT_TYPES),
      required: bool(),
      role: enumOf(ROLES),
      status: enumOf(REQUIREMENT_STATUSES),
      value: text(),
      documentId: id(false),
      submittedByUserId: id(false),
      submittedAt: datetime(),
      note: text(),
    },
    indexes: [
      { key: "by_stage", type: "key", columns: ["stageId"] },
      { key: "by_order", type: "key", columns: ["orderId"] },
    ],
  },
  documents: {
    label: "Documentos",
    columns: {
      orderId: id(false),
      requestId: id(false),
      requirementId: id(false),
      type: enumOf(DOCUMENT_TYPES),
      name: str(255, true),
      mime: str(120, true),
      size: int(true),
      storageKey: str(255, true),
      version: int(true),
      previousDocumentId: id(false),
      uploadedByUserId: id(),
      visibility: enumOf(VISIBILITIES),
      productId: id(false),
      sourcingItemId: id(false),
      kitId: id(false),
      imageHash: str(32),
    },
    indexes: [
      { key: "by_order", type: "key", columns: ["orderId"] },
      { key: "by_request", type: "key", columns: ["requestId"] },
      { key: "by_product", type: "key", columns: ["productId"] },
    ],
  },
  payments: {
    label: "Pagamentos",
    columns: {
      orderId: id(false),
      requestId: id(false),
      direction: enumOf(PAYMENT_DIRECTIONS),
      amount: float(true),
      currency: str(3, true),
      fxRate: float(),
      method: str(60),
      status: enumOf(PAYMENT_STATUSES),
      proofDocumentId: id(false),
      registeredByUserId: id(),
      confirmedByUserId: id(false),
      confirmedAt: datetime(),
      note: text(),
      kitId: id(false),
    },
    indexes: [
      { key: "by_order", type: "key", columns: ["orderId"] },
      { key: "by_request", type: "key", columns: ["requestId"] },
    ],
  },
  notifications: {
    label: "Notificações",
    columns: {
      userId: id(false),
      partyId: id(false),
      role: enumOf(ROLES, false),
      channel: enumOf(NOTIFICATION_CHANNELS),
      subject: str(200, true),
      body: text(true),
      link: str(255),
      status: enumOf(["sent", "mock", "failed"]),
      readAt: datetime(),
    },
    indexes: [{ key: "by_user", type: "key", columns: ["userId"] }],
  },
  audit_log: {
    label: "Auditoria",
    columns: {
      userId: id(false),
      action: str(60, true),
      entity: str(40, true),
      entityId: str(36, true),
      summary: str(255, true),
      before: json(),
      after: json(),
    },
    indexes: [
      { key: "by_entity", type: "key", columns: ["entity", "entityId"] },
    ],
  },
  penalties: {
    label: "Multas",
    columns: {
      orderId: id(),
      responsiblePartyId: id(false),
      reason: text(true),
      amount: float(true),
      currency: str(3, true),
      evidenceDocumentId: id(false),
      status: enumOf(PENALTY_STATUSES),
      createdByUserId: id(),
    },
    indexes: [{ key: "by_order", type: "key", columns: ["orderId"] }],
  },
  settings: {
    label: "Configurações",
    columns: {
      key: str(60, true),
      value: json(),
    },
    indexes: [{ key: "key_unique", type: "unique", columns: ["key"] }],
  },
  counters: {
    label: "Contadores",
    columns: {
      key: str(60, true),
      value: int(true),
    },
    indexes: [{ key: "key_unique", type: "unique", columns: ["key"] }],
  },
  supplier_visits: {
    label: "Visitas a fornecedores",
    columns: {
      supplierId: id(false),
      supplierName: str(160),
      factoryName: str(160),
      city: str(80),
      address: str(255),
      location: str(160),
      visitedAt: datetime(true),
      participants: text(),
      notes: text(),
      nextVisitAt: datetime(),
      followUp: text(),
      status: enumOf(VISIT_STATUSES),
      createdByUserId: id(),
    },
    indexes: [
      { key: "by_supplier", type: "key", columns: ["supplierId"] },
      { key: "by_date", type: "key", columns: ["visitedAt"] },
    ],
  },
  sourcing_items: {
    label: "Produtos encontrados (sourcing)",
    columns: {
      visitId: id(false),
      supplierId: id(false),
      supplierName: str(160),
      productId: id(false),
      lineId: id(false),
      category: str(80),
      name: str(160, true),
      description: text(),
      supplierSku: str(60),
      material: str(120),
      color: str(60),
      pantone: str(40),
      price: float(),
      currency: str(3),
      moq: int(),
      masterBoxQty: int(),
      innerBoxQty: int(),
      netWeightKg: float(),
      grossWeightKg: float(),
      widthCm: float(),
      heightCm: float(),
      lengthCm: float(),
      boxLengthCm: float(),
      boxWidthCm: float(),
      boxHeightCm: float(),
      cbm: float(),
      conditions: text(),
      notes: text(),
      foundAt: datetime(),
      city: str(80),
      location: str(160),
      status: enumOf(SOURCING_STATUSES),
      primaryPhotoDocumentId: id(false),
      createdByUserId: id(),
      requestId: id(false),
      priceTiers: json(),
    },
    indexes: [
      { key: "by_visit", type: "key", columns: ["visitId"] },
      { key: "by_supplier", type: "key", columns: ["supplierId"] },
      { key: "by_status", type: "key", columns: ["status"] },
    ],
  },
  product_photos: {
    label: "Fotos de produto",
    columns: {
      productId: id(false),
      sourcingItemId: id(false),
      orderId: id(false),
      documentId: id(),
      kind: enumOf(PHOTO_KINDS),
      caption: str(200),
      takenAt: datetime(),
      takenByUserId: id(false),
      derivedFromPhotoId: id(false),
      isPrimary: bool(),
    },
    indexes: [
      { key: "by_product", type: "key", columns: ["productId"] },
      { key: "by_item", type: "key", columns: ["sourcingItemId"] },
      { key: "by_order", type: "key", columns: ["orderId"] },
    ],
  },
  measurements: {
    label: "Medições",
    columns: {
      entity: str(20, true),
      entityId: id(),
      kind: enumOf(MEASUREMENT_KINDS),
      declaredValue: float(),
      measuredValue: float(true),
      unit: str(10, true),
      photoDocumentId: id(false),
      measuredByUserId: id(),
      measuredAt: datetime(true),
      note: text(),
    },
    indexes: [
      { key: "by_entity", type: "key", columns: ["entity", "entityId"] },
    ],
  },
  purchase_snapshots: {
    label: "Snapshots de compra",
    columns: {
      orderId: id(),
      orderItemId: id(false),
      requestId: id(false),
      productId: id(false),
      sourcingItemId: id(false),
      supplierId: id(),
      quoteId: id(false),
      name: str(160, true),
      supplierSku: str(60),
      material: str(120),
      color: str(60),
      pantone: str(40),
      unitPrice: float(),
      currency: str(3),
      quantity: float(true),
      unit: str(20, true),
      moq: int(),
      masterBoxQty: int(),
      innerBoxQty: int(),
      netWeightKg: float(),
      grossWeightKg: float(),
      widthCm: float(),
      heightCm: float(),
      lengthCm: float(),
      boxLengthCm: float(),
      boxWidthCm: float(),
      boxHeightCm: float(),
      cbm: float(),
      specification: text(),
      conditions: text(),
      photoDocumentIds: json(),
      note: text(),
      createdByUserId: id(),
      ncm: str(10),
    },
    indexes: [{ key: "by_order", type: "key", columns: ["orderId"] }],
  },
  purchase_schedules: {
    label: "Programações de compra",
    columns: {
      productId: id(false),
      sourcingItemId: id(false),
      customerId: id(false),
      supplierId: id(false),
      requestId: id(false),
      orderId: id(false),
      sequence: int(true),
      quantity: float(true),
      unit: str(20, true),
      scheduledFor: datetime(),
      periodLabel: str(60),
      price: float(),
      currency: str(3),
      status: enumOf(SCHEDULE_STATUSES),
      notes: text(),
      createdByUserId: id(),
    },
    indexes: [
      { key: "by_product", type: "key", columns: ["productId"] },
      { key: "by_customer", type: "key", columns: ["customerId"] },
    ],
  },
  containers: {
    label: "Containers",
    columns: {
      code: str(40, true),
      type: str(20, true),
      capacityCbm: float(true),
      maxWeightKg: float(),
      customerId: id(false),
      status: enumOf(CONTAINER_STATUSES),
      etd: datetime(),
      eta: datetime(),
      notes: text(),
      createdByUserId: id(),
    },
    indexes: [
      { key: "by_customer", type: "key", columns: ["customerId"] },
      { key: "by_status", type: "key", columns: ["status"] },
    ],
  },
  container_items: {
    label: "Itens de container",
    columns: {
      containerId: id(),
      orderId: id(false),
      orderItemId: id(false),
      productId: id(false),
      name: str(160, true),
      quantity: float(true),
      unit: str(20, true),
      unitsPerBox: int(),
      boxCount: int(true),
      cbmPerBox: float(true),
      weightPerBoxKg: float(),
    },
    indexes: [
      { key: "by_container", type: "key", columns: ["containerId"] },
      { key: "by_order", type: "key", columns: ["orderId"] },
    ],
  },
  acknowledgements: {
    label: "Confirmações de visualização",
    columns: {
      entity: str(20, true),
      entityId: id(),
      userId: id(),
      partyId: id(false),
      event: enumOf(ACK_EVENTS),
      at: datetime(true),
      note: text(),
    },
    indexes: [
      { key: "by_entity", type: "key", columns: ["entity", "entityId"] },
    ],
  },
  review_items: {
    label: "Itens para revisão",
    columns: {
      orderId: id(false),
      entity: str(40, true),
      entityId: id(),
      rule: str(60, true),
      problem: text(true),
      expected: str(120),
      found: str(120),
      responsibleRole: enumOf(ROLES, false),
      action: text(),
      link: str(255),
      status: enumOf(REVIEW_STATUSES),
      resolvedByUserId: id(false),
      resolvedAt: datetime(),
      resolutionNote: text(),
    },
    indexes: [
      { key: "by_status", type: "key", columns: ["status"] },
      { key: "by_order", type: "key", columns: ["orderId"] },
    ],
  },
  inspection_results: {
    label: "Resultados de inspeção",
    columns: {
      orderId: id(),
      stageId: id(),
      snapshotId: id(false),
      result: enumOf(INSPECTION_RESULTS),
      comparisons: json(),
      measuredByUserId: id(false),
      comparedAt: datetime(true),
      note: text(),
    },
    indexes: [{ key: "by_order", type: "key", columns: ["orderId"] }],
  },
  import_batches: {
    label: "Importações de planilha",
    columns: {
      entity: str(40, true),
      fileDocumentId: id(false),
      fileName: str(255, true),
      sheetName: str(120),
      headers: json(),
      rows: jsonLarge(),
      mapping: json(),
      decisions: json(),
      status: enumOf(IMPORT_BATCH_STATUSES),
      summary: json(),
      rowCount: int(true),
      createdByUserId: id(),
    },
    indexes: [{ key: "by_status", type: "key", columns: ["status"] }],
  },
  tax_classifications: {
    label: "Classificação fiscal (NCM)",
    columns: {
      productId: id(),
      ncm: str(10, true),
      description: text(),
      taxes: json(),
      adminTreatment: text(),
      notes: text(),
      source: enumOf(TAX_SOURCES),
      sourceRef: str(255),
      status: enumOf(TAX_STATUSES),
      suggestedByUserId: id(false),
      validatedByUserId: id(false),
      validatedAt: datetime(),
    },
    indexes: [{ key: "by_product", type: "key", columns: ["productId"] }],
  },
  certifications: {
    label: "Certificações",
    columns: {
      entity: str(20, true),
      entityId: id(),
      kind: str(60, true),
      name: str(160),
      issuer: str(160),
      number: str(80),
      validUntil: datetime(),
      documentId: id(false),
      status: enumOf(CERTIFICATION_STATUSES),
      notes: text(),
      createdByUserId: id(),
      validatedByUserId: id(false),
      validatedAt: datetime(),
    },
    indexes: [
      { key: "by_entity", type: "key", columns: ["entity", "entityId"] },
      { key: "by_status", type: "key", columns: ["status"] },
    ],
  },
  after_sales: {
    label: "Pós-venda",
    columns: {
      orderId: id(),
      customerId: id(),
      status: enumOf(AFTER_SALES_STATUSES),
      rating: int(),
      experience: text(),
      problems: text(),
      perceivedCosts: text(),
      suggestions: text(),
      repurchaseInterest: enumOf(REPURCHASE_INTERESTS, false),
      answeredAt: datetime(),
      answeredByUserId: id(false),
      closedAt: datetime(),
      notes: text(),
    },
    indexes: [
      { key: "by_order", type: "key", columns: ["orderId"] },
      { key: "by_customer", type: "key", columns: ["customerId"] },
      { key: "by_status", type: "key", columns: ["status"] },
    ],
  },
  ai_suggestions: {
    label: "Sugestões de IA",
    columns: {
      entity: str(20, true),
      entityId: id(),
      kind: enumOf(AI_SUGGESTION_KINDS),
      source: enumOf(AI_SOURCES),
      model: str(80),
      prompt: text(true),
      imageDocumentId: id(false),
      fields: json(),
      rawText: text(),
      status: enumOf(AI_SUGGESTION_STATUSES),
      requestedByUserId: id(),
      decidedByUserId: id(false),
      decidedAt: datetime(),
      note: text(),
    },
    indexes: [
      { key: "by_entity", type: "key", columns: ["entity", "entityId"] },
    ],
  },
  marketing_kits: {
    label: "Kits de marketing",
    columns: {
      productId: id(),
      customerId: id(false),
      name: str(160, true),
      price: float(true),
      currency: str(3, true),
      status: enumOf(MARKETING_KIT_STATUSES),
      concept: text(),
      slogan: str(255),
      description: text(),
      campaign: text(),
      colors: json(),
      pantone: str(120),
      previewDocumentIds: json(),
      releasedDocumentIds: json(),
      paymentId: id(false),
      offeredAt: datetime(),
      purchasedAt: datetime(),
      paidAt: datetime(),
      releasedAt: datetime(),
      notes: text(),
      createdByUserId: id(),
    },
    indexes: [
      { key: "by_product", type: "key", columns: ["productId"] },
      { key: "by_customer", type: "key", columns: ["customerId"] },
      { key: "by_status", type: "key", columns: ["status"] },
    ],
  },
  product_lookups: {
    label: "Buscas de produto (foto/link)",
    columns: {
      userId: id(),
      customerId: id(false),
      imageDocumentId: id(false),
      url: text(),
      linkStatus: enumOf(LINK_STATUSES, false),
      linkTitle: str(500),
      linkSiteName: str(160),
      linkImageUrl: text(),
      linkPrice: str(60),
      imageHash: str(32),
      linkImageHash: str(32),
      matches: json(),
      suggestions: json(),
      aiSource: enumOf(AI_SOURCES, false),
      aiError: str(40),
      requestId: id(false),
    },
    indexes: [{ key: "by_user", type: "key", columns: ["userId"] }],
  },
  purchase_sheets: {
    label: "Fichas de compra (Preparação)",
    columns: {
      orderId: id(),
      productId: id(false),
      sheetDate: datetime(),
      location: str(80),
      supplierName: str(160),
      supplierStore: str(60),
      supplierPhone: str(40),
      factoryItemCode: str(60),
      incoterm: enumOf(SHEET_INCOTERMS, false),
      currency: enumOf(SHEET_CURRENCIES, false),
      price: float(),
      moq: int(),
      masterCartonQty: int(),
      innerQty: int(),
      netWeightPcKg: float(),
      grossWeightPcKg: float(),
      cbmPerCarton: float(),
      heightCm: float(),
      widthCm: float(),
      lengthCm: float(),
      capacityMl: float(),
      packageType: str(120),
      colorAssortment: str(200),
      colorPantones: json(),
      material: str(200),
      powerSource: enumOf(SHEET_POWER_SOURCES, false),
      powerDetail: str(60),
      productionStartAt: datetime(),
      lots: json(),
      containerType: str(20),
      ncm: str(12),
      importTaxPercent: float(),
      ipiPercent: float(),
      ecommerceDescription: text(),
      notes: text(),
      updatedByUserId: id(false),
      completedAt: datetime(),
    },
    indexes: [{ key: "by_order", type: "unique", columns: ["orderId"] }],
  },
  freight_quotes: {
    label: "Cotações de frete (companhia marítima)",
    columns: {
      requestId: id(),
      quoteId: id(),
      carrierId: id(),
      status: enumOf(FREIGHT_QUOTE_STATUSES),
      totalCbm: float(),
      cartons: int(),
      grossWeightKg: float(),
      amount: float(),
      currency: str(3),
      transitDays: int(),
      validUntil: datetime(),
      notes: text(),
      answeredByUserId: id(false),
      answeredAt: datetime(),
    },
    indexes: [
      { key: "by_quote", type: "key", columns: ["quoteId"] },
      { key: "by_request", type: "key", columns: ["requestId"] },
      {
        key: "by_carrier_status",
        type: "key",
        columns: ["carrierId", "status"],
      },
    ],
  },
};

/* ------------------------------------------------------------------------ */
/* Padrões das colunas adicionadas depois do MVP                              */
/* ------------------------------------------------------------------------ */

/**
 * Registros antigos ficam com estas colunas nulas; quem cria registros novos
 * espalha os padrões (`{ ...PARTY_EXTRA_DEFAULTS, ...dados }`) para não ter de
 * conhecer cada coluna nova.
 */
export const PARTY_EXTRA_DEFAULTS = {
  city: null,
  address: null,
  contactName: null,
  wechat: null,
  operationMode: null,
  radar: null,
  radarNotes: null,
  importerId: null,
  bankBeneficiary: null,
  bankName: null,
  bankAccount: null,
  bankSwift: null,
  bankAddress: null,
} satisfies Partial<Party>;

export const USER_EXTRA_DEFAULTS = {
  importerId: null,
} satisfies Partial<User>;

export const LINE_EXTRA_DEFAULTS = {
  requiredCertifications: null,
  prompts: null,
} satisfies Partial<ProductLine>;

export const ORDER_EXTRA_DEFAULTS = {
  operationMode: null,
  requestedByUserId: null,
} satisfies Partial<Order>;

export const PAYMENT_EXTRA_DEFAULTS = {
  kitId: null,
} satisfies Partial<Payment>;

export const PRODUCT_EXTRA_DEFAULTS = {
  supplierId: null,
  supplierSku: null,
  category: null,
  material: null,
  color: null,
  pantone: null,
  moq: null,
  price: null,
  currency: null,
  masterBoxQty: null,
  innerBoxQty: null,
  netWeightKg: null,
  grossWeightKg: null,
  widthCm: null,
  heightCm: null,
  lengthCm: null,
  boxLengthCm: null,
  boxWidthCm: null,
  boxHeightCm: null,
  cbm: null,
  notes: null,
  source: null,
  negotiatedAt: null,
  sourcingItemId: null,
  primaryPhotoDocumentId: null,
  ncm: null,
  priceTiers: null,
} satisfies Partial<Product>;

export const REQUEST_EXTRA_DEFAULTS = {
  origin: null,
  sourceOrderId: null,
  requestedForUserId: null,
} satisfies Partial<Request>;

export const DOCUMENT_EXTRA_DEFAULTS = {
  productId: null,
  sourcingItemId: null,
  kitId: null,
  imageHash: null,
} satisfies Partial<Document>;

/**
 * ID do banco no Appwrite. Permanece "willmix" porque já está provisionado com
 * dados; o nome exibido é "Wellmix". Renomear o ID exigiria recriar o banco.
 */
export const DATABASE_ID = "willmix";
export const BUCKET_ID = "arquivos";
