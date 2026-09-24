/**
 * Fonte única do esquema de dados do Portal Willmix.
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

export const STAGE_STATUSES = ["pending", "active", "blocked", "done"] as const;
export type StageStatus = (typeof STAGE_STATUSES)[number];

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
}

export interface RequirementTemplate {
  key: string;
  label: string;
  type: RequirementType;
  required: boolean;
  /** Papel que preenche o requisito. Willmix pode preencher qualquer um. */
  role: Role;
}

export interface ProductLine extends BaseRow {
  name: string;
  manualDocumentId: string | null;
  /** JSON: RequirementTemplate[] aplicados na etapa PREPARATION. */
  requirements: RequirementTemplate[];
  active: boolean;
}

export interface Product extends BaseRow {
  lineId: string;
  name: string;
  sku: string | null;
  specification: string | null;
  active: boolean;
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
  /** Preço de venda ao cliente definido pela Willmix ao selecionar fornecedor. */
  sellPrice: number | null;
  sellCurrency: string | null;
  downPaymentAmount: number | null;
  notes: string | null;
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
  status: StageKey;
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
}
export type TableName = keyof Tables;

/* ------------------------------------------------------------------------ */
/* Definição de colunas (para Appwrite e validação básica)                   */
/* ------------------------------------------------------------------------ */

export type ColumnType =
  "string" | "text" | "int" | "float" | "bool" | "datetime" | "json";

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
    },
    indexes: [{ key: "by_line", type: "key", columns: ["lineId"] }],
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
    },
    indexes: [
      { key: "by_customer", type: "key", columns: ["customerId"] },
      { key: "by_status", type: "key", columns: ["status"] },
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
      status: enumOf(STAGE_KEYS),
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
    },
    indexes: [
      { key: "by_order", type: "key", columns: ["orderId"] },
      { key: "by_request", type: "key", columns: ["requestId"] },
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
};

export const DATABASE_ID = "willmix";
export const BUCKET_ID = "arquivos";
