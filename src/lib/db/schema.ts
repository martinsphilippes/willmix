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

import type { FreightTariffData } from "@/lib/services/freight-tariff-calc";

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
  // Fase D: assessoria de comércio exterior e agente de carga (logins próprios).
  "comex",
  "logistics",
  // Fase F: organismo de certificação de produto (logins próprios).
  "ocp",
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
  "comex",
  "logistics",
  "ocp",
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

/**
 * Condição de pagamento da Wellmix ao fornecedor (negociada com cada um):
 * parcelas em % do FOB, cada uma N dias depois de um marco do pedido.
 */
export const PAYMENT_TERM_BASES = [
  "order_created",
  "shipped",
  "delivered",
] as const;
export type PaymentTermBase = (typeof PAYMENT_TERM_BASES)[number];

export interface PaymentTermInstallment {
  /** Parte do FOB (0 < % ≤ 100); a soma das parcelas é 100. */
  percent: number;
  /** Marco que conta o prazo: pedido gerado, embarque ou entrega ao cliente. */
  base: PaymentTermBase;
  /** Dias depois do marco (0 = na data do marco). */
  days: number;
}

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
  // Briefing de embalagem: arquivos para a gráfica e foto da embalagem física.
  "print_ready",
  "packaging_sample",
  // Embarque e desembaraço (Fase D): arquivo de um passo (acesso pelo passo).
  "import_step",
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
/** O que o aviso pede de quem recebe: agir, prestar atenção, só saber ou algo concluído. */
export const NOTIFICATION_KINDS = ["action", "alert", "info", "done"] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];
/** Com quem está o assunto do aviso agora: quem recebe, a Wellmix ou um papel parceiro. */
export type NotificationActor = "recipient" | "wellmix" | Role;

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
  /* Foto que veio na planilha do fornecedor (coluna PHOTO): imagem do produto
     no catálogo até a equipe tirar a foto original, que continua pendente. */
  "supplier",
  /* Fase B (fluxo de compras): foto HD do produto e die cut (faca) para o Marketing. */
  "hd",
  "die_cut",
] as const;
export type PhotoKind = (typeof PHOTO_KINDS)[number];

/** Sim/Não informado (nulo = ainda não informado). */
export const YES_NO = ["yes", "no"] as const;
export type YesNo = (typeof YES_NO)[number];

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

/*
 * Briefing de embalagem (faca/die-cut, arte, arquivos para a gráfica e foto
 * da embalagem física) aberto para a agência (ou o marketing da Wellmix)
 * junto com a RFQ. open → ready (obrigatórios enviados) → transferred
 * (pedido criado: a arte segue para a aprovação do fornecedor) | cancelled.
 */
export const PACKAGING_BRIEF_STATUSES = [
  "open",
  "ready",
  "transferred",
  "cancelled",
] as const;
export type PackagingBriefStatus = (typeof PACKAGING_BRIEF_STATUSES)[number];
export const PACKAGING_ITEM_KEYS = [
  "dieline",
  "art",
  "print_ready",
  "packaging_sample",
] as const;
export type PackagingItemKey = (typeof PACKAGING_ITEM_KEYS)[number];
/** Como o dono do briefing foi definido (auditoria): escolhido na RFQ, padrão das configurações, única agência ativa ou Wellmix por falta de agência. */
export const PACKAGING_OWNER_SOURCES = [
  "chosen",
  "settings_default",
  "only_active",
  "wellmix",
] as const;
export type PackagingOwnerSource = (typeof PACKAGING_OWNER_SOURCES)[number];
export const PACKAGING_DIMS_SOURCES = ["master", "quote", "manual"] as const;
export type PackagingDimsSource = (typeof PACKAGING_DIMS_SOURCES)[number];

/** Como o fornecedor entrou na lista do produto: cadastro (principal), cotação respondida ou à mão. */
export const PRODUCT_SUPPLIER_SOURCES = ["catalog", "quote", "manual"] as const;
export type ProductSupplierSource = (typeof PRODUCT_SUPPLIER_SOURCES)[number];

/**
 * Booking como planilha (docs/BOOKING.md, "Booking por planilha"): a lista de
 * itens que um fornecedor mandou, antes de existir produto. Rascunho
 * (editável) → Fechado (importação concluída, análise do Superplan feita) →
 * Em andamento (algum item já foi escolhido) → Concluído; e Cancelado.
 */
export const BOOKING_LOT_STATUSES = [
  "draft",
  "closed",
  "in_progress",
  "done",
  "cancelled",
] as const;
export type BookingLotStatus = (typeof BOOKING_LOT_STATUSES)[number];

/** De onde veio o NCM do item do booking: aproximação, despachante ou a Wellmix. */
export const BOOKING_ITEM_NCM_SOURCES = ["match", "broker", "manual"] as const;
export type BookingItemNcmSource = (typeof BOOKING_ITEM_NCM_SOURCES)[number];

/**
 * Solicitação ao fornecedor (docs/SUPPLIER_REQUESTS.md): nasce na Seleção de
 * itens. Aberta (esperando o fornecedor) → Respondida (ele disse se faz e em
 * que condições) → Aprovada (a Wellmix segue com ele; o produto nasce depois)
 * ou Recusada; Cancelada pela Wellmix antes da decisão.
 */
export const SUPPLIER_REQUEST_STATUSES = [
  "open",
  "answered",
  "approved",
  "declined",
  "cancelled",
] as const;
export type SupplierRequestStatus = (typeof SUPPLIER_REQUEST_STATUSES)[number];

/** Escolha gravada de um grupo da seleção: gravada, com solicitação aberta, ou trocada por outra. */
export const SELECTION_GROUP_STATUSES = [
  "saved",
  "requested",
  "replaced",
] as const;
export type SelectionGroupStatus = (typeof SELECTION_GROUP_STATUSES)[number];

export const REVIEW_STATUSES = ["open", "resolved", "dismissed"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const INSPECTION_RESULTS = [
  "APPROVED",
  "DIVERGENT",
  "REVIEW_REQUIRED",
] as const;
export type InspectionResult = (typeof INSPECTION_RESULTS)[number];

/* ---- Segunda Onda: NCM, certificações, pós-venda, reposição, sourcing sob demanda ---- */

/**
 * Origem de uma solicitação: manual (padrão), recompra, nova proposta,
 * produto ainda não catalogado ou aberta do Superplan (viabilidade feita: a
 * RFQ vai direto ao fornecedor ganho, que manda faca, MOQ, prazo e foto em
 * alta; docs/SUPERPLAN.md).
 */
export const REQUEST_ORIGINS = [
  "manual",
  "replenishment",
  "proposal",
  "sourcing_demand",
  "superplan",
  /** Pedido de compra gerado das solicitações ao fornecedor aprovadas (docs/PURCHASE_ORDER.md). */
  "supplier_request",
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

/** Tarifário de frete: o vigente e os substituídos (histórico). */
export const FREIGHT_TARIFF_STATUSES = ["active", "replaced"] as const;
export type FreightTariffStatus = (typeof FREIGHT_TARIFF_STATUSES)[number];

/* Mensagens (chat interno Wellmix × empresas parceiras) */
export const CONVERSATION_STATUSES = ["open", "closed"] as const;
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];
/** Assunto da conversa: Geral, uma solicitação ou um pedido. */
/** "item": um produto do pedido (a conversa desce até o item). */
export const TOPIC_KINDS = ["general", "request", "order", "item"] as const;
export type TopicKind = (typeof TOPIC_KINDS)[number];
/** Quem escreveu: a equipe Wellmix ou alguém da empresa parceira. */
export const MESSAGE_SIDES = ["wellmix", "external"] as const;
export type MessageSide = (typeof MESSAGE_SIDES)[number];
/** Tamanho máximo do texto de uma mensagem. */
export const MESSAGE_MAX_LENGTH = 4000;

/* ------------------------------------------------------------------------ */
/* Tipos das linhas                                                          */
/* ------------------------------------------------------------------------ */

/**
 * Funções de um login da Wellmix (docs/APPROVALS.md): quem compra, quem
 * planeja, quem aprova. Um login pode ter várias. Admin faz tudo.
 */
export const WELLMIX_FUNCTIONS = [
  "buyer",
  "product_manager",
  "planner",
  "catalog",
  "finance",
  "purchasing_director",
  "executive_director",
  // Fase F: designer do marketing (artes e embalagens).
  "designer",
] as const;
export type WellmixFunction = (typeof WELLMIX_FUNCTIONS)[number];

/** Níveis de aprovação do pré-custo, na ordem. */
export const APPROVAL_LEVELS = [
  "planner",
  "purchasing_director",
  "executive_director",
] as const;
export type ApprovalLevel = (typeof APPROVAL_LEVELS)[number];
export const APPROVAL_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "cancelled",
  "failed",
] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

/*
 * Produção (Fase C, docs/PRODUCTION.md): fornecedor fábrica ou trade, follow
 * aos 5/15/25 dias do início da produção e inspeção por SKU.
 */
export const PRODUCTION_MODES = ["factory", "trade"] as const;
export type ProductionMode = (typeof PRODUCTION_MODES)[number];
export const FOLLOWUP_DAYS = [5, 15, 25] as const;
export const FOLLOWUP_STATUSES = ["on_track", "delayed"] as const;
export type FollowupStatus = (typeof FOLLOWUP_STATUSES)[number];
export const SKU_INSPECTION_RESULTS = ["approved", "rejected"] as const;
export type SkuInspectionResult = (typeof SKU_INSPECTION_RESULTS)[number];

/*
 * Embarque e desembaraço (Fase D, docs/IMPORT_FLOW.md): passos do processo de
 * importação, cada um com quem faz e quem valida.
 */
export const IMPORT_STEP_KEYS = [
  "booking",
  "draft_bl",
  "invoice_packing",
  "invoice_signed",
  "bl",
  "cargo_presence",
  "numerario",
  "numerario_paid",
  "channel",
  "di",
  "ce_mercante",
  "ci",
  "danfe",
  // Certificação (Fase F): memorial, laboratório e registro, com o OCP.
  "cert_memorial",
  "cert_lab",
  "cert_registration",
  // Selo de certificação: a certificadora envia o selo do pedido e a agência
  // aplica na arte da embalagem (docs/CERTIFICATION.md).
  "cert_seal",
  "cert_seal_art",
] as const;
export type ImportStepKey = (typeof IMPORT_STEP_KEYS)[number];
export const IMPORT_STEP_STATUSES = [
  "pending",
  "submitted",
  "validated",
  "rejected",
] as const;
export type ImportStepStatus = (typeof IMPORT_STEP_STATUSES)[number];
/** Canal de parametrização da DI/DUIMP. */
export const CUSTOMS_CHANNELS = ["green", "yellow", "red", "grey"] as const;
export type CustomsChannel = (typeof CUSTOMS_CHANNELS)[number];

/* Recebimento (Fase E, docs/RECEIVING.md): conferência da descarga. */
export const RECEIVING_CHECKS = [
  "seal_matches",
  "container_ok",
  "no_moisture",
  "pallets_ok",
  "labels_ok",
  "quantity_counted",
] as const;
export type ReceivingCheck = (typeof RECEIVING_CHECKS)[number];

/* Marketing (Fase F, docs/ARTWORK.md): não conformidade da arte por SKU. */
export const ART_ISSUE_STATUSES = ["open", "fixed", "accepted"] as const;
export type ArtIssueStatus = (typeof ART_ISSUE_STATUSES)[number];

/** Divisões da Wellmix: cada linha de produto e cada analista pertencem a uma. */
export const DIVISIONS = ["wellmix", "wellkids"] as const;
export type Division = (typeof DIVISIONS)[number];

/** Cargo do login da Wellmix (painel de SLA): do mais básico ao mais alto. */
export const JOB_LEVELS = [
  "analyst",
  "coordinator",
  "supervisor",
  "manager",
  "director",
] as const;
export type JobLevel = (typeof JOB_LEVELS)[number];

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
  /** Cargo (Wellmix; painel de SLA). Opcional: logins antigos ficam sem. */
  jobLevel?: JobLevel | null;
  /** A quem o login responde (Wellmix): o chefe vê o painel dele e de quem está abaixo. */
  managerUserId?: string | null;
  /** Divisão que o analista atende (as solicitações das linhas dela caem nele). */
  division?: Division | null;
  /** Funções do login da Wellmix (comprador, planner, diretoria…). */
  functions?: WellmixFunction[] | null;
  /**
   * Senha provisória: no próximo acesso o portal só mostra a troca de senha
   * (src/lib/services/password-change.ts). Ausente ou falso: acesso normal.
   */
  mustChangePassword?: boolean | null;
  /**
   * Telas liberadas uma a uma pelo administrador (docs/ACCESS.md). Nula ou
   * ausente: o login abre o padrão das funções. Guarda chaves de
   * src/lib/auth/screens.ts (validadas ao salvar e ao ler).
   */
  screens?: string[] | null;
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
  /** Nº da loja no mercado (ex.: Yiwu "A 154678"); vai para a ficha de compra. Nulo nos cadastros antigos. */
  storeNumber?: string | null;
  /** Condição de pagamento ao fornecedor (parcelas). Nulo = não configurada. */
  paymentTerms?: PaymentTermInstallment[] | null;
  /** Observação da condição (ex.: "T/T, banco em Hong Kong"). */
  paymentTermsNote?: string | null;
  /**
   * Cliente: operador da Wellmix responsável pela carteira. Tudo do cliente
   * (solicitações, pedidos, etapas) cai no painel de SLA dele. Opcional.
   */
  ownerUserId?: string | null;
  /** Código do parceiro (CODPARC) ou da empresa (EMP-CODEMP) no Sankhya (vínculo da carga; docs/SANKHYA.md). Nulo = não veio do ERP. */
  sankhyaCode?: string | null;
  /** Última sincronização com o Sankhya (docs/SANKHYA.md, fase 3). Alterado depois = pendente. */
  sankhyaSyncedAt?: string | null;
  /** Razão social (TGFPAR.RAZAOSOCIAL); `name` é o nome fantasia. */
  legalName?: string | null;
  /** Inscrição estadual (TGFPAR.IDENTINSCESTAD). */
  stateRegistration?: string | null;
  /** Pessoa física (F) ou jurídica (J) (TGFPAR.TIPPESSOA). */
  personType?: string | null;
  /**
   * Códigos do Sankhya do registro de origem (todas as colunas COD*, NU* e as
   * de endereço): guardam as ligações com outras entidades do ERP para usar
   * depois, mesmo as que o portal não tem como campo.
   */
  sankhyaRefs?: Record<string, string | number> | null;
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
  /** Divisão da linha (Wellmix ou WellKids): define o analista responsável. */
  division?: Division | null;
  /** Código do grupo (CODGRUPOPROD) no Sankhya (vínculo da carga; docs/SANKHYA.md). Nulo = não veio do ERP. */
  sankhyaCode?: string | null;
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
  /** Cores Pantone escolhidas no seletor (código + hex); `pantone` guarda o texto. Nulo nos cadastros antigos. */
  colorPantones?: PantoneColorRef[] | null;
  /**
   * O texto de `notes` vai para o e-commerce (é a descrição do produto lá)?
   * Falso: só observação interna. Ausente ou nulo: produto ainda não gravado
   * pelo cadastro unificado (src/lib/sheet-registration.ts).
   */
  notesToEcommerce?: boolean | null;
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
  /**
   * Códigos do Sankhya do registro de origem (todas as colunas COD*, NU* e as
   * de endereço): guardam as ligações com outras entidades do ERP para usar
   * depois, mesmo as que o portal não tem como campo.
   */
  sankhyaRefs?: Record<string, string | number> | null;
  /** Marca (TGFPRO.MARCA). */
  brand?: string | null;
  /** Estoque mínimo (limite): abaixo dele a tela Estoque pede reposição e o admin é avisado. Nulo = sem limite. */
  minStock?: number | null;
  /** Código do produto (CODPROD) no Sankhya (vínculo da carga; docs/SANKHYA.md). Nulo = não veio do ERP. */
  sankhyaCode?: string | null;
  /** EAN (código de barras); no Sankhya fica em REFERENCIA. */
  ean?: string | null;
  /** Última sincronização com o Sankhya (docs/SANKHYA.md, fase 3). Alterado depois = pendente. */
  sankhyaSyncedAt?: string | null;
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
  /**
   * Número da solicitação (sequencial, desde o envio). Os produtos do mesmo
   * lote têm o mesmo número. Nulo nas antigas e antes do esquema publicado.
   */
  number?: number | null;
  /**
   * Variação escolhida de um produto com variações e a cópia dos valores dela
   * (preço, MOQ, caixa, pesos, medidas, CBM…). Nulos sem variação.
   */
  variantId?: string | null;
  variant?: VariantSnapshot | null;
  /**
   * Analista responsável (automático pela divisão da linha do produto; ver
   * docs/SLA_PANEL.md). O pedido herda. Nulo = sem responsável.
   */
  ownerUserId?: string | null;
  /**
   * O cliente aprovou a proposta (etapa "Proposta ao cliente"); só depois o
   * sinal é pedido. A Wellmix confirmar o sinal também conta como aprovação.
   * Nulos enquanto não aprovou (e nas antigas).
   */
  proposalApprovedAt?: string | null;
  proposalApprovedByUserId?: string | null;
  /** NUNOTA da nota no Sankhya enquanto ainda não há pedido (cotação, pre-order). */
  sankhyaCode?: string | null;
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
  /** Cartão do fabricante confirmado nesta negociação (manufacturer_cards). */
  manufacturerCardId?: string | null;
  manufacturerCardConfirmedAt?: string | null;
  manufacturerCardConfirmedByUserId?: string | null;
  /**
   * Pedido mínimo confirmado pelo fornecedor (RFQ aberta do Superplan).
   * Coluna opcional: só vai ao banco nesse fluxo.
   */
  moq?: number | null;
  /**
   * Negociação (docs/QUOTE_FLOW.md): rodadas de "devolver com comentário" da
   * Wellmix e a resposta do fornecedor. Opcional: só gravada nesse fluxo.
   */
  negotiation?: import("@/lib/quote-flow").NegotiationRound[] | null;
  /** Proposta de embalagem enviada ao fornecedor e o OK dele. Opcional. */
  packagingProposal?: import("@/lib/quote-flow").PackagingProposal | null;
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
  /** Assessoria de comércio exterior e agente de carga (Fase D). Opcionais. */
  comexId?: string | null;
  logisticsId?: string | null;
  /** Certificação (OCP) e designer das artes (Fase F). Opcionais. */
  ocpId?: string | null;
  designerUserId?: string | null;
  closedAt: string | null;
  notes: string | null;
  /** Modalidade de operação copiada do cliente ao criar o pedido (nulo nos antigos). */
  operationMode: OperationMode | null;
  /** Login do cliente que solicitou: só ele, entre os logins do cliente, vê o pedido. */
  requestedByUserId: string | null;
  /** Analista responsável (herdado da solicitação). Opcional. */
  ownerUserId?: string | null;
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
  /**
   * Condição de pagamento ao fornecedor copiada do cadastro ao gerar o pedido
   * (mudar o cadastro depois não mexe no que já foi combinado). Nulo nos
   * pedidos antigos: vale a condição atual do fornecedor.
   */
  supplierPaymentTerms?: PaymentTermInstallment[] | null;
  /** NUNOTA da nota no Sankhya (vínculo da carga/integração; `erpNumber` é o número exibido). Nulo = sem vínculo. */
  sankhyaCode?: string | null;
  /** Faturamento registrado no portal (evento de processo "pedido faturado"). */
  invoicedAt?: string | null;
  invoicedByUserId?: string | null;
  /** Última sincronização com o Sankhya (docs/SANKHYA.md, fase 3). Alterado depois = pendente. */
  sankhyaSyncedAt?: string | null;
  /** Incoterm do pedido (FOB, EXW, CIF...); do Sankhya vem de TGFCAB.CIF_FOB. */
  incoterm?: string | null;
  /** Condição de pagamento (payment_conditions; CODTIPVENDA no Sankhya). */
  paymentConditionId?: string | null;
  /**
   * Fluxo do pedido. "supplier_request": pedido de compra gerado das
   * solicitações ao fornecedor aprovadas (docs/PURCHASE_ORDER.md), com as
   * raias do fornecedor, da agência de arte e da certificadora em paralelo e
   * o contrato assinado pelas duas partes. Vazio: o fluxo de sempre.
   */
  flow?: "supplier_request" | null;
  /** Câmbio do pedido (moeda do pedido → R$; TGFCAB.VLRMOEDA). */
  fxRate?: number | null;
  /**
   * Códigos do Sankhya do registro de origem (todas as colunas COD*, NU* e as
   * de endereço): guardam as ligações com outras entidades do ERP para usar
   * depois, mesmo as que o portal não tem como campo.
   */
  sankhyaRefs?: Record<string, string | number> | null;
}

export interface OrderItem extends BaseRow {
  orderId: string;
  productId: string | null;
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number | null;
  /** Variação pedida e a cópia dos valores dela (copiadas da solicitação). */
  variantId?: string | null;
  variant?: VariantSnapshot | null;
  /** SEQUENCIA do item na nota do Sankhya (a nota é o sankhyaCode do pedido). */
  sankhyaCode?: string | null;
  /**
   * Códigos do Sankhya do registro de origem (todas as colunas COD*, NU* e as
   * de endereço): guardam as ligações com outras entidades do ERP para usar
   * depois, mesmo as que o portal não tem como campo.
   */
  sankhyaRefs?: Record<string, string | number> | null;
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
  /**
   * Arquivo de um briefing de embalagem (faca, arte, gráfica, foto): chave do
   * isolamento (só a agência dona e, depois do pedido, o fornecedor escolhido).
   * Opcional: documentos antigos ficam sem.
   */
  packagingBriefId?: string | null;
  /**
   * Anexo de uma mensagem do chat: só abre quem vê aquele assunto da conversa
   * (a empresa da conversa e a Wellmix). Opcional: documentos antigos ficam sem.
   */
  conversationTopicId?: string | null;
  /**
   * Arquivo de uma cotação (imagem da proposta de embalagem): só a Wellmix e
   * o fornecedor daquela cotação abrem. Opcional: documentos antigos ficam sem.
   */
  quoteId?: string | null;
  /**
   * Arquivo da conversa de uma solicitação ao fornecedor: só a Wellmix e o
   * fornecedor dela abrem. Opcional: documentos antigos ficam sem.
   */
  supplierRequestId?: string | null;
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
  /** Título do financeiro (NUFIN) no Sankhya (vínculo da carga; docs/SANKHYA.md). Nulo = não veio do ERP. */
  sankhyaCode?: string | null;
  /**
   * Códigos do Sankhya do registro de origem (todas as colunas COD*, NU* e as
   * de endereço): guardam as ligações com outras entidades do ERP para usar
   * depois, mesmo as que o portal não tem como campo.
   */
  sankhyaRefs?: Record<string, string | number> | null;
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
  /** O que o aviso pede de quem recebe; nulo nos avisos de antes do campo (a tela infere pelo assunto). */
  kind: NotificationKind | null;
  /** Com quem está o assunto agora; nulo quando não há o que fazer. */
  actor: NotificationActor | null;
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
  /** Foto de uma variação do produto (a da coluna PHOTO da planilha); nulo nas demais. */
  variantId?: string | null;
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
  /** Variação comprada (os valores acima vêm dela quando há uma). */
  variantId?: string | null;
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
  /*
   * Despachante (Fase B, docs/PURCHASE_FLOW.md): antidumping, média e se o
   * produto precisa de certificação. Opcionais: fichas antigas ficam sem.
   * Com dumping, a escolha do fornecedor espera a liberação (gerente de
   * produto ou comprador).
   */
  dumping?: YesNo | null;
  dumpingNote?: string | null;
  dumpingReleasedByUserId?: string | null;
  dumpingReleasedAt?: string | null;
  averagePrice?: number | null;
  /**
   * Peso médio por peça (kg): um terceiro peso, além do líquido e do bruto,
   * informado pela fábrica ou medido. Opcional: fichas antigas ficam sem.
   */
  averageWeightPcKg?: number | null;
  certificationRequired?: YesNo | null;
  certificationNote?: string | null;
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
/**
 * Fornecedor de um produto do catálogo (um produto pode ter vários). O
 * principal continua em `products.supplierId`; aqui fica cada um com o seu
 * código do item na fábrica e o histórico de cotações. Só a Wellmix vê:
 * nada daqui vai para outro fornecedor nem para o cliente.
 */
export interface ProductSupplier extends BaseRow {
  productId: string;
  supplierId: string;
  /** Código do item na fábrica deste fornecedor. */
  supplierSku: string | null;
  /** Última cotação respondida (preço, moeda, MOQ, prazo). */
  price: number | null;
  currency: string | null;
  moq: number | null;
  leadTimeDays: number | null;
  source: ProductSupplierSource;
  lastQuoteId: string | null;
  lastQuotedAt: string | null;
  /** Cotações respondidas e escolhidas para este produto. */
  quoteCount: number | null;
  selectedCount: number | null;
  lastSelectedAt: string | null;
  createdByUserId: string | null;
}

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

/** Medidas que a faca e a arte usam (da ficha mestre, da cotação ou à mão). */
export interface PackagingDims {
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  masterCartonQty: number | null;
  innerQty: number | null;
  cbmPerCarton: number | null;
  packageType: string | null;
  material: string | null;
  colorPantones: PantoneColorRef[] | null;
  capacityMl: number | null;
}

/**
 * Briefing de embalagem: nasce com a RFQ (ou na escolha do fornecedor,
 * conforme `packagingBriefAt`), um por solicitação. A agência (ou o marketing
 * da Wellmix, `agencyId` nulo) envia faca, arte, arquivos para a gráfica e a
 * foto da embalagem física; quando o pedido nasce, a arte já enviada conclui
 * o item "Arte" da etapa Arte e embalagem e o fornecedor aprova.
 */
export interface PackagingBrief extends BaseRow {
  requestId: string;
  productId: string | null;
  customerId: string;
  /** Agência dona; nulo = marketing da Wellmix. */
  agencyId: string | null;
  ownerSource: PackagingOwnerSource;
  status: PackagingBriefStatus;
  /** Entregáveis obrigatórios para ficar "pronto" (congelados na abertura). */
  requiredKeys: PackagingItemKey[];
  /** Versão vigente de cada entregável. */
  dielineDocumentId: string | null;
  artDocumentId: string | null;
  printReadyDocumentId: string | null;
  sampleDocumentId: string | null;
  dims: PackagingDims | null;
  dimsSource: PackagingDimsSource | null;
  /** Cotação de onde as medidas vieram. */
  dimsQuoteId: string | null;
  /** Medidas de uma cotação ainda não escolhida. */
  dimsProvisional: boolean;
  dimsChangedAt: string | null;
  /** Instruções da Wellmix à agência. */
  brief: string | null;
  /** Observações da agência (gráfica, fornecedor). */
  agencyNotes: string | null;
  /**
   * Valor que a agência cobra por este item (criação e finalização da arte)
   * e a moeda. Opcionais: só gravados quando informados.
   */
  agencyItemPrice?: number | null;
  agencyItemCurrency?: string | null;
  dueAt: string | null;
  readyAt: string | null;
  /** Depois da transferência: o pedido e o item "Arte" dele. */
  orderId: string | null;
  orderArtRequirementId: string | null;
  transferredAt: string | null;
  cancelledAt: string | null;
  /** request_deleted | wellmix */
  cancelReason: string | null;
  reminderSentAt: string | null;
  createdByUserId: string;
  updatedByUserId: string | null;
}

/**
 * Cartão do fabricante (foto ou PDF) de um produto: diz quem fabrica. Um
 * produto pode ter vários (por fornecedor e ao longo do tempo); a cada
 * negociação o fornecedor confirma qual vale (quotes.manufacturerCardId).
 * Só a Wellmix e o próprio fornecedor veem; o cliente nunca (não pode ir
 * direto à fábrica) e outro fornecedor também não.
 */
export interface ManufacturerCard extends BaseRow {
  /** Produto do catálogo (nulo quando a solicitação ainda não tem produto). */
  productId: string | null;
  /** Fornecedor que apresentou o cartão. */
  supplierId: string;
  documentId: string;
  /** Lido do cartão (pela IA, conferido por quem envia) ou digitado. */
  companyName: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  storeAddress: string | null;
  factoryAddress: string | null;
  /** O cartão diz que é fábrica (endereço de fábrica, "厂家直销"). */
  isFactory: boolean | null;
  notes: string | null;
  source: string | null;
  /** Cotação em que o cartão foi apresentado (produto ainda sem cadastro). */
  quoteId: string | null;
  createdByUserId: string;
}

/**
 * Carrinho do cliente na vitrine (Explorar): um item por produto, por login
 * (como as solicitações, que cada login vê só as suas). Ao enviar, cada item
 * vira uma solicitação de orçamento (lote) e sai do carrinho. Guardado no
 * banco para valer em qualquer aparelho e para a Wellmix ver o interesse.
 */
export interface CartItem extends BaseRow {
  userId: string;
  customerId: string;
  productId: string;
  /** Quantidade em unidades (peças). */
  quantity: number;
  /** Personalização pedida pelo cliente (cor, logo, embalagem...). */
  notes: string | null;
  /** Variação escolhida (produto com variações); nulo nos itens antigos. */
  variantId?: string | null;
}

/**
 * Variação de um produto do catálogo (modelo, tamanho, acabamento): preço,
 * MOQ, caixa, pesos, medidas, CBM, cores, material, embalagem, código de
 * fábrica e foto próprios. Escolhida na solicitação, no carrinho e no pedido;
 * os valores viajam como cópia (`VariantSnapshot`). As colunas do produto e a
 * ficha mestre espelham a variação de referência (menor preço). Desativar em
 * vez de apagar. Ver docs/PRODUCT_VARIANTS.md.
 */
export interface ProductVariant extends BaseRow {
  productId: string;
  /** "GRECIE 4X6 / 10 X 15": descrição + tamanho, ou a coluna NAME da planilha. */
  name: string;
  /**
   * Chave normalizada (código de fábrica + nome, minúsculas, sem acentos nem
   * espaços repetidos) para a reimportação achar a mesma variação; única por
   * produto.
   */
  key: string;
  /** Ordem da planilha (e da lista). */
  sortOrder: number | null;
  active: boolean;
  /** SKU/código do item na fábrica. */
  factoryItemCode: string | null;
  /** Texto do tamanho ("8X10 / 20X25", "A4"). */
  sizeText: string | null;
  /** Preço do fornecedor de referência. */
  price: number | null;
  /** USD/CNY/BRL/EUR (convenção do produto; a ficha usa RMB). */
  currency: string | null;
  moq: number | null;
  masterBoxQty: number | null;
  innerBoxQty: number | null;
  /** Pesos por peça. */
  netWeightKg: number | null;
  grossWeightKg: number | null;
  /** Medidas da peça (cm). */
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  /** CBM por caixa master. */
  cbm: number | null;
  /** Cores juntas ("White / Gray / bege"). */
  colorAssortment: string | null;
  material: string | null;
  packageType: string | null;
  capacityMl: number | null;
  notes: string | null;
  /** Foto da variação (documento); nulo sem foto. */
  photoDocumentId: string | null;
  /** Lote da importação que criou/atualizou; nulo quando feita à mão. */
  importBatchId: string | null;
}

/**
 * Cópia dos valores da variação no momento da solicitação/pedido (como o
 * resto da ficha): a variação pode mudar depois sem alterar o que foi pedido.
 * Montada por `variantSnapshot` em src/lib/variants.ts.
 */
export interface VariantSnapshot {
  id: string;
  name: string;
  factoryItemCode: string | null;
  price: number | null;
  currency: string | null;
  moq: number | null;
  masterBoxQty: number | null;
  innerBoxQty: number | null;
  netWeightKg: number | null;
  grossWeightKg: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  cbm: number | null;
  colorAssortment: string | null;
  material: string | null;
  packageType: string | null;
}

/**
 * Tarifário de frete marítimo importado da planilha das companhias marítimas
 * ("ESTIMATIVA DE FRETE"): por agente de cargas, porto de origem e porto de
 * destino, o frete por container 40HQ, as taxas, o prazo de pagamento e o
 * custo total em R$. Um vigente por vez; os anteriores ficam no histórico.
 * Só a Wellmix vê (tem as tarifas de todas as companhias).
 */
export interface FreightTariff extends BaseRow {
  /** Dia de referência (AAAA-MM-DD): vai para a DTREFERENCIA do Sankhya. */
  referenceDate: string;
  fileName: string;
  /** Planilha original (documento interno), para conferência. */
  fileDocumentId: string | null;
  status: FreightTariffStatus;
  /** Câmbio da planilha (dólar + spread), R$ por US$. */
  fx: number;
  /** Frete rodoviário do porto até o CD, R$ por container. */
  roadFreightBrl: number | null;
  rateCount: number;
  forwarderCount: number | null;
  warningCount: number | null;
  /** Tudo o que foi lido (agentes, portos, taxas, tarifas e avisos). */
  data: FreightTariffData;
  uploadedByUserId: string;
  /**
   * Companhia marítima dona das tarifas (enviou a própria planilha, ou a
   * Wellmix importou em nome dela). null = planilha consolidada da Wellmix
   * (várias companhias); os registros de antes deste campo também.
   */
  shippingLineId?: string | null;
}

/** Onde a ficha lida pela foto do quadro mora. */
export const SHEET_READING_SCOPES = ["quote", "order", "product"] as const;
export type SheetReadingScope = (typeof SHEET_READING_SCOPES)[number];

/**
 * Foto do quadro (a placa que o fornecedor preenche à mão na loja, com o
 * produto, a balança, a régua e o cartão) lida pela IA. Os valores lidos
 * preenchem a ficha onde ela está vazia; onde a ficha já tem outro valor,
 * fica a divergência até a Wellmix dizer qual vale (`resolutions`). A foto
 * fica guardada como prova do que o fornecedor escreveu.
 */
export interface SheetReading extends BaseRow {
  scope: SheetReadingScope;
  /** Ficha: purchase_sheets.orderId (id da cotação, do pedido ou do produto). */
  sheetKey: string;
  /** Foto do quadro (documento interno). */
  documentId: string;
  source: AiSource;
  model: string | null;
  /** Valores lidos, com o nome dos campos da ficha (SheetReadingFields). */
  fields: Record<string, unknown>;
  /** O que a IA não conseguiu ler e observações. */
  notes: string | null;
  rawText: string | null;
  /**
   * Decisão da Wellmix em cada divergência: campo → valor que vale e se veio
   * da foto ou da ficha. Vale enquanto a ficha tiver esse valor.
   */
  resolutions: Record<string, SheetReadingResolution> | null;
  createdByUserId: string;
}

export interface SheetReadingResolution {
  /** "photo": a foto estava certa (a ficha passou a ter o valor dela). */
  choice: "photo" | "sheet";
  value: string | number | null;
  byUserId: string;
  at: string;
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

/**
 * Conversa da Wellmix com uma empresa parceira: uma por empresa (`partyId`),
 * vista e respondida por todos os logins dela; login sem empresa tem a sua
 * (`userId`). A Wellmix (admin e operadores) vê todas.
 */
export interface Conversation extends BaseRow {
  partyId: string | null;
  userId: string | null;
  lastMessageAt: string | null;
  /** Começo da última mensagem (lista de conversas). */
  lastMessagePreview: string | null;
  status: ConversationStatus;
}

/**
 * Assunto de uma conversa: "Geral" (um por conversa) ou ligado a uma
 * solicitação ou a um pedido de que a empresa participa.
 */
export interface ConversationTopic extends BaseRow {
  conversationId: string;
  kind: TopicKind;
  requestId: string | null;
  orderId: string | null;
  /** Referência do assunto (ex.: "#12 · Jarra de vidro"); vazio no Geral. */
  title: string | null;
  lastMessageAt: string | null;
  /** Assunto de item: o item do pedido e o produto dele (opcionais). */
  orderItemId?: string | null;
  productId?: string | null;
}

export interface Message extends BaseRow {
  conversationId: string;
  topicId: string;
  authorUserId: string;
  authorSide: MessageSide;
  body: string;
  /** Anexo (documents, com conversationTopicId); null sem anexo. */
  attachmentDocumentId: string | null;
  /**
   * Tradução automática (coluna opcional, preenchida depois do envio): o
   * idioma em que foi escrita e o texto nos outros idiomas do portal. Nula
   * enquanto não traduziu ou quando não precisa (só números, IA desligada).
   */
  translation?: MessageTranslation | null;
  /**
   * Resposta a uma mensagem marcada (citação), sempre do mesmo assunto.
   * Coluna opcional: só é gravada nas respostas.
   */
  replyToMessageId?: string | null;
}

/**
 * Tradução automática de uma mensagem (src/lib/services/message-translation.ts).
 * "done": `lang` é o idioma original (código ISO, ex.: "zh") e `texts` traz
 * a mensagem nos idiomas do portal diferentes dele; `by` diz se veio da IA
 * real ("api") ou do exemplo rotulado ("mock"). "failed": a IA não traduziu
 * (motivo em `error`, um AiErrorCode); quem lê vê o original e pode tentar
 * de novo.
 */
export type MessageTranslation =
  | {
      status: "done";
      lang: string;
      texts: Partial<Record<Locale, string>>;
      by: "api" | "mock";
      at: string;
    }
  | { status: "failed"; error: string; at: string };

/** Até onde cada login leu cada assunto (uma linha por login e assunto). */
/** Uma decisão de um nível da aprovação. */
export interface ApprovalStep {
  level: ApprovalLevel;
  decision: "approved" | "rejected";
  userId: string;
  at: string;
  note: string | null;
}

/**
 * Aprovação do pré-custo (docs/APPROVALS.md): a escolha do fornecedor e o
 * valor ao cliente propostos pelo comprador só valem depois de aprovados,
 * nível a nível. Reprovada: volta ao comprador com o motivo.
 */
export interface Approval extends BaseRow {
  requestId: string;
  quoteId: string;
  requestedByUserId: string;
  status: ApprovalStatus;
  /** Escolha proposta (o que a seleção do fornecedor grava quando aprovada). */
  input: Record<string, unknown>;
  /** Valor ao cliente em BRL (nulo sem câmbio: vai até a diretoria executiva). */
  valueBrl: number | null;
  /** Níveis exigidos, na ordem. */
  levels: ApprovalLevel[];
  steps: ApprovalStep[];
  /** Próximo nível a decidir (nulo quando terminou). */
  currentLevel: ApprovalLevel | null;
  /** Motivo da reprovação, do cancelamento ou da falha. */
  reason: string | null;
  decidedAt: string | null;
}

export interface EtdChange {
  from: string | null;
  to: string;
  at: string;
  byUserId: string;
  reason: string | null;
}

export interface ProductionFollowup {
  /** Dia do follow (5, 15 ou 25 dias do início da produção). */
  day: number;
  status: FollowupStatus;
  note: string | null;
  at: string;
  byUserId: string;
}

/** Acompanhamento da produção de um pedido (um por pedido). */
export interface ProductionTrack extends BaseRow {
  orderId: string;
  mode: ProductionMode | null;
  /** Fornecedor trade: fábrica onde o produto é feito (onde inspecionar). */
  factoryName: string | null;
  factoryAddress: string | null;
  productionStartAt: string | null;
  etd: string | null;
  /** ETD informado na primeira vez (para medir a variação). */
  etdOriginal: string | null;
  etdHistory: EtdChange[];
  followups: ProductionFollowup[];
  inspectionScheduledAt: string | null;
  inspectionNote: string | null;
  updatedByUserId: string | null;
}

/** Inspeção de um item (SKU) do pedido, rodada a rodada. */
export interface SkuInspection extends BaseRow {
  orderId: string;
  orderItemId: string;
  round: number;
  result: SkuInspectionResult;
  note: string | null;
  inspectedByUserId: string;
  inspectedAt: string;
  /** Reprovado: o que o fornecedor fez para corrigir. */
  supplierAction: string | null;
  supplierRespondedAt: string | null;
  supplierRespondedByUserId: string | null;
}

/** Um passo do embarque/desembaraço de um pedido (um por pedido e passo). */
export interface ImportStep extends BaseRow {
  orderId: string;
  key: ImportStepKey;
  status: ImportStepStatus;
  /** Número/texto (booking, BL, DI, CE, NF) ou o canal. */
  value: string | null;
  amount: number | null;
  currency: string | null;
  documentId: string | null;
  submittedByUserId: string | null;
  submittedAt: string | null;
  validatedByUserId: string | null;
  validatedAt: string | null;
  rejectReason: string | null;
}

export interface ReceivingItem {
  orderItemId: string;
  expected: number;
  received: number;
  damaged: number;
  note: string | null;
}

/** Recebimento do container no armazém (um por pedido). */
export interface Receiving extends BaseRow {
  orderId: string;
  sealNumber: string | null;
  sealIntact: YesNo | null;
  sealPhotoDocumentId: string | null;
  containerPhotoDocumentIds: string[];
  checklist: ReceivingCheck[];
  items: ReceivingItem[];
  ricNumber: string | null;
  ricDocumentId: string | null;
  containerReturnedAt: string | null;
  containerReturnDocumentId: string | null;
  closedAt: string | null;
  closedByUserId: string | null;
  closingNote: string | null;
  updatedByUserId: string | null;
}

/** Não conformidade da arte de um item do pedido; volta ao designer. */
export interface ArtIssue extends BaseRow {
  orderId: string;
  orderItemId: string;
  status: ArtIssueStatus;
  note: string;
  documentId: string | null;
  reportedByUserId: string;
  fixNote: string | null;
  fixDocumentId: string | null;
  fixedByUserId: string | null;
  fixedAt: string | null;
  acceptedByUserId: string | null;
  acceptedAt: string | null;
}

export interface MessageRead extends BaseRow {
  topicId: string;
  userId: string;
  lastReadAt: string;
}

/* ---- Estoque: baixas, inventário às cegas e perdas (docs/INVENTORY.md) ---- */

export const STOCK_MOVEMENT_KINDS = [
  "sale_out",
  "count_loss",
  "count_gain",
  /** Entrada e saída por regra de processo (Configurações → Processos). */
  "process_in",
  "process_out",
  /** Ajuste para o saldo do Sankhya (TGFEST) por local, na carga. */
  "sankhya_balance",
] as const;
export type StockMovementKind = (typeof STOCK_MOVEMENT_KINDS)[number];

/** Saída ou ajuste do estoque no Brasil (quantidade negativa = saiu). */
export interface StockMovement extends BaseRow {
  productId: string;
  kind: StockMovementKind;
  quantity: number;
  unit: string | null;
  /** Pedido do cliente atendido pela baixa (opcional). */
  orderId: string | null;
  /** Inventário e item de contagem que geraram o ajuste. */
  countId: string | null;
  countItemId: string | null;
  note: string | null;
  createdByUserId: string;
  /** Evento de processo que gerou a movimentação (kind process_in/out). */
  processEventId?: string | null;
  /** Local de estoque (stock_locations; CODLOCAL no Sankhya). */
  locationId?: string | null;
}

export const STOCK_COUNT_STATUSES = ["open", "closed"] as const;
export type StockCountStatus = (typeof STOCK_COUNT_STATUSES)[number];

/** Inventário (contagem física): aberto pelo admin, fechado quando tudo foi contado. */
export interface StockCount extends BaseRow {
  number: number;
  status: StockCountStatus;
  note: string | null;
  startedByUserId: string;
  closedByUserId: string | null;
  closedAt: string | null;
}

export const STOCK_COUNT_ITEM_STATUSES = [
  "pending",
  "retry",
  "review",
  "ok",
  "approved",
] as const;
export type StockCountItemStatus = (typeof STOCK_COUNT_ITEM_STATUSES)[number];

/**
 * Produto a contar num inventário. `expected` (o que o sistema tem) nunca vai
 * para quem conta: a contagem é às cegas. Duas tentativas; errou as duas, o
 * admin aprova a quantidade final e a diferença vira perda ou sobra.
 */
export interface StockCountItem extends BaseRow {
  countId: string;
  productId: string;
  expected: number;
  unit: string | null;
  status: StockCountItemStatus;
  attempt1Qty: number | null;
  attempt1ByUserId: string | null;
  attempt1At: string | null;
  attempt2Qty: number | null;
  attempt2ByUserId: string | null;
  attempt2At: string | null;
  finalQty: number | null;
  difference: number | null;
  approvedByUserId: string | null;
  approvedAt: string | null;
  approvalNote: string | null;
}

export const STOCK_RESERVATION_STATUSES = [
  "active",
  "used",
  "cancelled",
] as const;
export type StockReservationStatus =
  (typeof STOCK_RESERVATION_STATUSES)[number];

/**
 * Reserva de estoque no Brasil para um cliente: a quantidade sai do
 * disponível (vitrine e baixa para outros) até ser usada (vira baixa por
 * venda), cancelada ou vencer (`expiresAt` passado = vencida, sem gravar).
 */
/**
 * Retrato da análise do Superplan guardado no item do booking: o que foi
 * analisado, com que pressupostos e o resultado. A lista mostra o retrato com
 * a data (não recalcula sozinha). `verdict` nulo = faltou dado (`missing`).
 */
export interface BookingAnalysis {
  at: string;
  byUserId: string;
  /** Tipo de negócio do Superplan usado (markup, comissão, despesas e meta). */
  businessType: string;
  /** Preço de venda analisado (R$ por peça) e se era o preço mínimo. */
  salePriceBrl: number | null;
  usesMinimum: boolean;
  costBrl: number | null;
  minimumBrl: number | null;
  profitPct: number | null;
  targetPct: number;
  verdict: "viable" | "below" | "loss" | null;
  /** Preço para bater a meta; nulo quando impossível ou sem conta. */
  targetPriceBrl: number | null;
  /** O que faltou para calcular (chaves do Superplan: price, fx, cbm…). */
  missing: string[];
  /** Pressupostos da conta, para conferência. */
  inputs?: {
    /** O que a conta usou do produto (para conferir com a linha). */
    unitPrice?: number | null;
    currency?: string | null;
    pcsPerCarton?: number | null;
    cbmPerCarton?: number | null;
    officialRate: number | null;
    futureRate: number | null;
    rmbPerUsd: number | null;
    iiPct: number;
    ipiPct: number;
    /** NCM achado na tabela fiscal (sem ele, II e IPI contam 0). */
    ncmFound: boolean;
    container: string | null;
    freightUsd: number | null;
    /** Peso bruto estimado pelo líquido (a ficha não trouxe o bruto). */
    grossEstimated?: boolean;
  } | null;
}

/**
 * Fornecedor como a planilha do booking escreveu (nome, loja, telefone e
 * cidade): base da sugestão de cadastro quando ele ainda não existe.
 */
export interface BookingLotSupplierHint {
  name: string | null;
  store: string | null;
  phone: string | null;
  city: string | null;
}

/**
 * Booking (a planilha de um fornecedor): status, origem (a cidade do
 * fornecedor), fornecedor e data. Fornecedor e data vêm estimados da
 * planilha e o usuário confirma ou ajusta antes de fechar. Os itens ficam em
 * `booking_items`; nenhum produto do cadastro nasce aqui.
 */
export interface BookingLot extends BaseRow {
  /** Número sequencial (contador `booking_lot_number`). */
  number: number;
  status: BookingLotStatus;
  supplierId: string | null;
  /** Fornecedor lido da planilha (sugestão de cadastro). */
  supplierHint: BookingLotSupplierHint | null;
  /** Cidade do fornecedor (ou a da planilha enquanto não há fornecedor). */
  origin: string | null;
  /** Data do booking (ISO, meia-noite UTC). */
  bookingDate: string | null;
  /** Data como a planilha trouxe, para conferência. */
  sheetDate: string | null;
  fileName: string;
  fileDocumentId: string | null;
  sheetName: string | null;
  /** Cabeçalhos da planilha que não têm campo próprio (guardados nos itens). */
  extraHeaders: string[] | null;
  itemCount: number;
  /** Tipo de negócio do Superplan escolhido ao fechar (vazio = o padrão). */
  businessType: string | null;
  closedAt: string | null;
  closedByUserId: string | null;
  analyzedAt: string | null;
  statusChangedAt: string | null;
  statusChangedByUserId: string | null;
  note: string | null;
  ownerUserId: string | null;
  createdByUserId: string;
}

/**
 * Item de um booking: uma linha (ou linhas seguidas da mesma peça em cores
 * diferentes) da planilha. Não é produto: um analista cria o produto depois,
 * na seleção de itens, e liga a ele os itens iguais de vários bookings
 * (`productId`, vazio até lá).
 */
export interface BookingItem extends BaseRow {
  lotId: string;
  /** Ordem na planilha (0, 1, 2…). */
  position: number;
  sourceRows: string | null;
  /** PRODUCT NUMBER LIST: o número do item na planilha. */
  itemNumber: string | null;
  /** SKU / FACTORY ITEM CODE. */
  factoryItemCode: string | null;
  productName: string | null;
  description: string | null;
  incoterm: SheetIncoterm | null;
  currency: SheetCurrency | null;
  price: number | null;
  /** QTY/BOX: peças por caixa master. */
  masterCartonQty: number | null;
  innerQty: number | null;
  netWeightPcKg: number | null;
  grossWeightPcKg: number | null;
  /** CBM da caixa master. */
  cbmPerCarton: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  capacityMl: number | null;
  packageType: string | null;
  material: string | null;
  moq: number | null;
  /* Informativos (não obrigatórios). */
  colorAssortment: string | null;
  /** FUNCTION / BATTERY / 110 / 220. */
  powerDetail: string | null;
  purchaseSchedule: string | null;
  departureIntervalDays: string | null;
  purchaseQty: number | null;
  /** TT PCS: peças planejadas. */
  plannedQty: number | null;
  sizeText: string | null;
  photoDocumentId: string | null;
  cardDocumentId: string | null;
  /** Colunas da planilha sem campo próprio: cabeçalho → valor. Não aparecem na tela. */
  extras: Record<string, string> | null;
  /** Retrato da análise do Superplan (`BookingAnalysis`). */
  analysis: BookingAnalysis | null;
  /** Produto do cadastro a que o item foi ligado (seleção de itens, depois). */
  productId: string | null;
  updatedByUserId: string | null;
  /*
   * NCM do item (docs/BOOKING.md, "NCM do item"): por aproximação com os
   * produtos do cadastro (o mais provável, ou a moda entre os igualmente
   * prováveis); sem correspondência, o despachante preenche. Obrigatório
   * para fechar. Opcionais: itens antigos ficam sem.
   */
  ncm?: string | null;
  ncmSource?: BookingItemNcmSource | null;
  /** Produtos que deram o NCM por aproximação e a semelhança (0 a 1). */
  ncmMatchProductIds?: string[] | null;
  ncmScore?: number | null;
  /** Quando o item foi para o despachante (sem correspondência). */
  ncmRequestedAt?: string | null;
  ncmAt?: string | null;
  ncmByUserId?: string | null;
}

/** Cópia do item do booking no momento da solicitação (o que o fornecedor vê). */
export interface SupplierRequestItem {
  itemNumber: string | null;
  factoryItemCode: string | null;
  productName: string | null;
  description: string | null;
  incoterm: SheetIncoterm | null;
  currency: SheetCurrency | null;
  price: number | null;
  masterCartonQty: number | null;
  innerQty: number | null;
  netWeightPcKg: number | null;
  grossWeightPcKg: number | null;
  cbmPerCarton: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  capacityMl: number | null;
  packageType: string | null;
  material: string | null;
  moq: number | null;
  colorAssortment: string | null;
  powerDetail: string | null;
  photoDocumentId: string | null;
}

/**
 * Solicitação ao fornecedor: a Wellmix escolheu um item de um booking (e
 * guardou os parecidos como alternativas) e pergunta ao fornecedor se ele
 * faz o que ela precisa, em que quantidade e condições. O fornecedor vê e
 * responde no portal; nada de produto, cliente ou estoque nasce aqui.
 */
/** Passos da negociação da solicitação ao fornecedor (docs/SUPPLIER_REQUESTS.md, "Negociação"). */
export const SUPPLIER_REQUEST_EVENT_KINDS = [
  /** Wellmix devolve com contraproposta (preço, MOQ, prazo e comentário). */
  "proposal",
  /** Fornecedor aceita a contraproposta: ela vira a resposta. */
  "accept",
  /** Fornecedor responde com outra proposta (novos valores). */
  "counter",
  /** Fornecedor recusa a contraproposta: fica a resposta anterior. */
  "reject",
  /** Mensagem livre, com ou sem arquivo (foto, PDF ou Excel). */
  "message",
  /** Resposta do fornecedor (faz ou não e as condições), ou registrada pela Wellmix por ele. */
  "answer",
] as const;
export type SupplierRequestEventKind =
  (typeof SUPPLIER_REQUEST_EVENT_KINDS)[number];

/** Um passo da conversa da solicitação (histórico, na ordem). */
export interface SupplierRequestEvent {
  id: string;
  at: string;
  kind: SupplierRequestEventKind;
  side: "wellmix" | "supplier";
  byUserId: string;
  price?: number | null;
  currency?: SheetCurrency | null;
  moq?: number | null;
  leadTimeDays?: number | null;
  text?: string | null;
  documentId?: string | null;
  fileName?: string | null;
  /** Resposta ("answer"): faz ou não e a modalidade de entrega. */
  canDo?: YesNo | null;
  incoterm?: SheetIncoterm | null;
  /** Resposta registrada pela Wellmix em nome do fornecedor. */
  onBehalf?: boolean | null;
}

export interface SupplierRequest extends BaseRow {
  /** Número sequencial (contador `supplier_request_number`). */
  number: number;
  status: SupplierRequestStatus;
  supplierId: string;
  bookingItemId: string;
  bookingLotId: string;
  /** Itens parecidos de outros bookings (só a Wellmix vê). */
  alternativeItemIds: string[] | null;
  item: SupplierRequestItem;
  quantity: number;
  unit: string;
  /** O que a Wellmix precisa no produto (cor, embalagem, ajuste…). */
  needs: string | null;
  /** Busca usada na seleção (para refazer a comparação). */
  searchQuery: string | null;
  /* Resposta do fornecedor */
  supplierCanDo: YesNo | null;
  supplierPrice: number | null;
  supplierCurrency: SheetCurrency | null;
  supplierMoq: number | null;
  supplierLeadTimeDays: number | null;
  /** Modalidade de entrega da resposta (FOB/EXW). */
  supplierIncoterm?: SheetIncoterm | null;
  supplierNote: string | null;
  respondedAt: string | null;
  respondedByUserId: string | null;
  /* Decisão da Wellmix */
  decidedAt: string | null;
  decidedByUserId: string | null;
  decisionNote: string | null;
  createdByUserId: string;
  /*
   * Produto (depois de aprovada): criado a partir do item ou associado a um
   * que já existia. O criado fica fora da vitrine até ser liberado.
   */
  productId?: string | null;
  productAction?: "created" | "linked" | null;
  productLinkedAt?: string | null;
  productLinkedByUserId?: string | null;
  showcaseReleasedAt?: string | null;
  showcaseReleasedByUserId?: string | null;
  /** Quando o CODPROD do produto foi conferido no Sankhya (nulo: digitado sem conferir). */
  erpCheckedAt?: string | null;
  /** Negociação: contrapropostas, respostas e mensagens, na ordem (opcional: antigas ficam sem). */
  negotiation?: SupplierRequestEvent[] | null;
  /** Quando o aviso de SLA estourado foi enviado (uma vez só). */
  slaNotifiedAt?: string | null;
  /** Pedido de compra em que o produto desta solicitação entrou (docs/PURCHASE_ORDER.md). */
  orderId?: string | null;
}

/**
 * Grupo resolvido da seleção de itens (docs/SUPPLIER_REQUESTS.md, "Escolha
 * por grupo"): os itens comparados, o que ganhou e a quantidade. Só a
 * Wellmix vê; a solicitação ao fornecedor nasce depois, do ganhador.
 */
export interface SelectionGroup extends BaseRow {
  status: SelectionGroupStatus;
  /** Itens do grupo comparado (o ganhador incluído). */
  itemIds: string[];
  chosenItemId: string;
  /** Peças a pedir do ganhador. */
  quantity: number;
  needs: string | null;
  /** Solicitação ao fornecedor aberta desta escolha. */
  supplierRequestId: string | null;
  requestedAt: string | null;
  createdByUserId: string;
  updatedByUserId: string | null;
}

export interface StockReservation extends BaseRow {
  productId: string;
  customerId: string;
  quantity: number;
  unit: string | null;
  status: StockReservationStatus;
  expiresAt: string | null;
  note: string | null;
  createdByUserId: string;
  /** Baixa por venda que usou a reserva. */
  movementId: string | null;
  closedByUserId: string | null;
  closedAt: string | null;
}

/** Condição de pagamento (tabela de tipos de negociação do Sankhya, TGFTPV): vale para compra e venda. */
/** Execução de uma regra de processo (Configurações → Processos; docs/PROCESSES.md). */
export interface ProcessEvent extends BaseRow {
  /** Evento (ex.: "request:ORDERED", "stage:SHIPPING:done", "order:invoiced"). */
  event: string;
  requestId: string | null;
  orderId: string | null;
  /** O que a regra pediu: movimentação de estoque e ação no Sankhya. */
  stockAction: string;
  sankhyaAction: string;
  top: number | null;
  /** done = feito; simulated = integração desligada (só registrado); skipped; error. */
  status: "done" | "simulated" | "skipped" | "error";
  detail: string | null;
  /** NUNOTA antes e depois da ação no Sankhya. */
  nunotaBefore: string | null;
  nunotaAfter: string | null;
  createdByUserId: string | null;
  /** Sincronização de cadastro (fase 3): tabela e id do registro do portal. */
  entity?: string | null;
  entityId?: string | null;
}

/** Local de estoque (Sankhya TGFLOC; CODLOCAL). */
export interface StockLocation extends BaseRow {
  /** CODLOCAL no Sankhya (único). */
  code: number;
  name: string;
  active: boolean;
  notes: string | null;
  sankhyaCode: string | null;
}

export interface PaymentCondition extends BaseRow {
  /** CODTIPVENDA no Sankhya (único). */
  code: number;
  name: string;
  active: boolean;
  notes: string | null;
  /** Veio do Sankhya (carga) ou foi criada no portal. */
  source: "sankhya" | "portal";
  updatedByUserId: string | null;
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
  packaging_briefs: PackagingBrief;
  product_suppliers: ProductSupplier;
  sheet_readings: SheetReading;
  manufacturer_cards: ManufacturerCard;
  cart_items: CartItem;
  freight_tariffs: FreightTariff;
  product_variants: ProductVariant;
  conversations: Conversation;
  conversation_topics: ConversationTopic;
  messages: Message;
  message_reads: MessageRead;
  approvals: Approval;
  production_tracks: ProductionTrack;
  sku_inspections: SkuInspection;
  import_steps: ImportStep;
  receivings: Receiving;
  art_issues: ArtIssue;
  stock_movements: StockMovement;
  stock_counts: StockCount;
  stock_count_items: StockCountItem;
  stock_reservations: StockReservation;
  booking_lots: BookingLot;
  booking_items: BookingItem;
  supplier_requests: SupplierRequest;
  selection_groups: SelectionGroup;
  payment_conditions: PaymentCondition;
  stock_locations: StockLocation;
  process_events: ProcessEvent;
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
  /**
   * Chaves de índices antigos que este substitui: o publicador
   * (scripts/appwrite-push.ts) apaga só estes antes de criar o novo; nunca
   * outros. Ex.: `user_product_unique` → `user_product_variant_unique`.
   */
  drops?: string[];
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
/**
 * Enum obrigatório por padrão (status, tipo, papel). ATENÇÃO: coluna acrescentada
 * a uma tabela que já existe em produção tem de ser opcional (`enumOf(X, false)`):
 * obrigatória, o Appwrite recusa toda linha nova sem ela ("Missing required
 * attribute") e as linhas antigas, vazias, ficam inválidas. A conferência do
 * publicador (scripts/appwrite-push.ts) aponta coluna obrigatória com linhas vazias.
 */
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
      jobLevel: enumOf(JOB_LEVELS, false),
      managerUserId: id(false),
      division: enumOf(DIVISIONS, false),
      functions: json(),
      screens: json(),
      mustChangePassword: bool(),
    },
    indexes: [
      { key: "email_unique", type: "unique", columns: ["email"] },
      { key: "by_manager", type: "key", columns: ["managerUserId"] },
    ],
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
      storeNumber: str(60),
      paymentTerms: json(),
      paymentTermsNote: text(),
      ownerUserId: id(false),
      sankhyaCode: str(40),
      sankhyaSyncedAt: datetime(),
      legalName: str(160),
      stateRegistration: str(30),
      personType: str(2),
      sankhyaRefs: json(),
    },
    indexes: [
      { key: "by_type", type: "key", columns: ["type"] },
      { key: "by_owner", type: "key", columns: ["ownerUserId"] },
      { key: "by_sankhya", type: "key", columns: ["sankhyaCode"] },
    ],
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
      division: enumOf(DIVISIONS, false),
      sankhyaCode: str(40),
    },
    indexes: [{ key: "by_sankhya", type: "key", columns: ["sankhyaCode"] }],
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
      colorPantones: json(),
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
      notesToEcommerce: bool(),
      source: enumOf(PRODUCT_SOURCES, false),
      negotiatedAt: datetime(),
      sourcingItemId: id(false),
      primaryPhotoDocumentId: id(false),
      ncm: str(10),
      priceTiers: json(),
      sankhyaRefs: json(),
      brand: str(80),
      minStock: float(),
      sankhyaCode: str(40),
      ean: str(20),
      sankhyaSyncedAt: datetime(),
    },
    indexes: [
      { key: "by_sankhya", type: "key", columns: ["sankhyaCode"] },
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
      number: int(),
      variantId: id(false),
      variant: json(),
      ownerUserId: id(false),
      // Etapa "Proposta ao cliente" (opcionais; só gravados na aprovação).
      proposalApprovedAt: datetime(),
      proposalApprovedByUserId: id(false),
      sankhyaCode: str(40),
    },
    indexes: [
      { key: "by_customer", type: "key", columns: ["customerId"] },
      { key: "by_status", type: "key", columns: ["status"] },
      { key: "by_group", type: "key", columns: ["groupId"] },
      { key: "by_number", type: "key", columns: ["number"] },
      { key: "by_owner", type: "key", columns: ["ownerUserId"] },
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
      manufacturerCardId: id(false),
      manufacturerCardConfirmedAt: datetime(),
      manufacturerCardConfirmedByUserId: id(false),
      moq: int(),
      negotiation: json(),
      packagingProposal: json(),
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
      erpSyncStatus: enumOf(ERP_SYNC_STATUSES, false),
      erpNumber: str(60),
      agencyId: id(false),
      brokerId: id(false),
      shippingLineId: id(false),
      carrierId: id(false),
      comexId: id(false),
      logisticsId: id(false),
      ocpId: id(false),
      designerUserId: id(false),
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
      supplierPaymentTerms: json(),
      ownerUserId: id(false),
      sankhyaCode: str(40),
      invoicedAt: datetime(),
      invoicedByUserId: id(false),
      sankhyaSyncedAt: datetime(),
      incoterm: str(10),
      paymentConditionId: id(false),
      flow: enumOf(["supplier_request"], false),
      fxRate: float(),
      sankhyaRefs: json(),
    },
    indexes: [
      { key: "number_unique", type: "unique", columns: ["number"] },
      { key: "by_sankhya", type: "key", columns: ["sankhyaCode"] },
      { key: "by_owner", type: "key", columns: ["ownerUserId"] },
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
      variantId: id(false),
      variant: json(),
      sankhyaCode: str(40),
      sankhyaRefs: json(),
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
      packagingBriefId: id(false),
      conversationTopicId: id(false),
      quoteId: id(false),
      supplierRequestId: id(false),
    },
    indexes: [
      { key: "by_order", type: "key", columns: ["orderId"] },
      { key: "by_request", type: "key", columns: ["requestId"] },
      { key: "by_product", type: "key", columns: ["productId"] },
      {
        key: "by_packaging_brief",
        type: "key",
        columns: ["packagingBriefId"],
      },
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
      sankhyaCode: str(40),
      sankhyaRefs: json(),
    },
    indexes: [
      { key: "by_order", type: "key", columns: ["orderId"] },
      { key: "by_request", type: "key", columns: ["requestId"] },
      { key: "by_sankhya", type: "key", columns: ["sankhyaCode"] },
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
      kind: enumOf(NOTIFICATION_KINDS, false),
      actor: str(40),
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
      variantId: id(false),
    },
    indexes: [
      { key: "by_product", type: "key", columns: ["productId"] },
      { key: "by_item", type: "key", columns: ["sourcingItemId"] },
      { key: "by_order", type: "key", columns: ["orderId"] },
      { key: "by_variant", type: "key", columns: ["variantId"] },
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
      variantId: id(false),
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
      dumping: enumOf(YES_NO, false),
      dumpingNote: text(),
      dumpingReleasedByUserId: id(false),
      dumpingReleasedAt: datetime(),
      averagePrice: float(),
      averageWeightPcKg: float(),
      certificationRequired: enumOf(YES_NO, false),
      certificationNote: text(),
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
  packaging_briefs: {
    label: "Briefings de embalagem (faca e arte na RFQ)",
    columns: {
      requestId: id(),
      productId: id(false),
      customerId: id(),
      agencyId: id(false),
      ownerSource: enumOf(PACKAGING_OWNER_SOURCES),
      status: enumOf(PACKAGING_BRIEF_STATUSES),
      requiredKeys: json(),
      dielineDocumentId: id(false),
      artDocumentId: id(false),
      printReadyDocumentId: id(false),
      sampleDocumentId: id(false),
      dims: json(),
      dimsSource: enumOf(PACKAGING_DIMS_SOURCES, false),
      dimsQuoteId: id(false),
      dimsProvisional: bool(),
      dimsChangedAt: datetime(),
      brief: text(),
      agencyNotes: text(),
      agencyItemPrice: float(),
      agencyItemCurrency: str(3),
      dueAt: datetime(),
      readyAt: datetime(),
      orderId: id(false),
      orderArtRequirementId: id(false),
      transferredAt: datetime(),
      cancelledAt: datetime(),
      cancelReason: str(60),
      reminderSentAt: datetime(),
      createdByUserId: id(),
      updatedByUserId: id(false),
    },
    indexes: [
      { key: "by_request", type: "key", columns: ["requestId"] },
      { key: "by_agency_status", type: "key", columns: ["agencyId", "status"] },
      { key: "by_status", type: "key", columns: ["status"] },
      { key: "by_order", type: "key", columns: ["orderId"] },
    ],
  },
  product_suppliers: {
    label: "Fornecedores do produto",
    columns: {
      productId: id(),
      supplierId: id(),
      supplierSku: str(60),
      price: float(),
      currency: str(3),
      moq: int(),
      leadTimeDays: int(),
      source: enumOf(PRODUCT_SUPPLIER_SOURCES),
      lastQuoteId: id(false),
      lastQuotedAt: datetime(),
      quoteCount: int(),
      selectedCount: int(),
      lastSelectedAt: datetime(),
      createdByUserId: id(false),
    },
    indexes: [
      {
        key: "product_supplier_unique",
        type: "unique",
        columns: ["productId", "supplierId"],
      },
      { key: "by_supplier", type: "key", columns: ["supplierId"] },
    ],
  },
  sheet_readings: {
    label: "Fichas lidas pela foto do quadro",
    columns: {
      scope: enumOf(SHEET_READING_SCOPES),
      sheetKey: id(),
      documentId: id(),
      source: enumOf(AI_SOURCES),
      model: str(80),
      fields: json(),
      notes: text(),
      rawText: text(),
      resolutions: json(),
      createdByUserId: id(),
    },
    indexes: [{ key: "by_sheet", type: "key", columns: ["sheetKey"] }],
  },
  manufacturer_cards: {
    label: "Cartões do fabricante",
    columns: {
      productId: id(false),
      supplierId: id(),
      documentId: id(),
      companyName: str(160),
      contactName: str(120),
      phone: str(60),
      email: str(160),
      storeAddress: text(),
      factoryAddress: text(),
      isFactory: bool(),
      notes: text(),
      source: str(10),
      quoteId: id(false),
      createdByUserId: id(),
    },
    indexes: [
      { key: "by_product", type: "key", columns: ["productId"] },
      { key: "by_supplier", type: "key", columns: ["supplierId"] },
    ],
  },
  cart_items: {
    label: "Carrinho da vitrine",
    columns: {
      userId: id(),
      customerId: id(),
      productId: id(),
      quantity: int(true),
      notes: str(500),
      variantId: id(false),
    },
    indexes: [
      // Um item por produto E variação (duas variações do mesmo produto cabem
      // no carrinho). Substitui `user_product_unique` (userId+productId), que
      // o publicador apaga antes de criar este; o serviço continua juntando no
      // mesmo item pela regra produto + variação, sem depender do índice.
      {
        key: "user_product_variant_unique",
        type: "unique",
        columns: ["userId", "productId", "variantId"],
        drops: ["user_product_unique"],
      },
    ],
  },
  freight_tariffs: {
    label: "Tarifários de frete marítimo",
    columns: {
      referenceDate: str(10, true),
      fileName: str(255, true),
      fileDocumentId: id(false),
      status: enumOf(FREIGHT_TARIFF_STATUSES),
      fx: float(true),
      roadFreightBrl: float(),
      rateCount: int(true),
      forwarderCount: int(),
      warningCount: int(),
      data: jsonLarge(),
      uploadedByUserId: id(),
      shippingLineId: id(false),
    },
    indexes: [
      { key: "by_status", type: "key", columns: ["status"] },
      { key: "by_line", type: "key", columns: ["shippingLineId", "status"] },
    ],
  },
  product_variants: {
    label: "Variações do produto",
    columns: {
      productId: id(),
      name: str(160, true),
      key: str(80, true),
      sortOrder: int(),
      active: bool(),
      factoryItemCode: str(60),
      sizeText: str(60),
      price: float(),
      currency: str(3),
      moq: int(),
      masterBoxQty: int(),
      innerBoxQty: int(),
      netWeightKg: float(),
      grossWeightKg: float(),
      lengthCm: float(),
      widthCm: float(),
      heightCm: float(),
      cbm: float(),
      colorAssortment: str(200),
      material: str(200),
      packageType: str(120),
      capacityMl: float(),
      notes: text(),
      photoDocumentId: id(false),
      importBatchId: id(false),
    },
    indexes: [
      { key: "by_product", type: "key", columns: ["productId"] },
      {
        key: "product_key_unique",
        type: "unique",
        columns: ["productId", "key"],
      },
    ],
  },
  conversations: {
    label: "Conversas",
    columns: {
      partyId: id(false),
      userId: id(false),
      lastMessageAt: datetime(),
      lastMessagePreview: str(200),
      status: enumOf(CONVERSATION_STATUSES),
    },
    indexes: [
      { key: "by_party", type: "key", columns: ["partyId"] },
      { key: "by_user", type: "key", columns: ["userId"] },
    ],
  },
  conversation_topics: {
    label: "Assuntos das conversas",
    columns: {
      conversationId: id(),
      kind: enumOf(TOPIC_KINDS),
      requestId: id(false),
      orderId: id(false),
      title: str(160),
      lastMessageAt: datetime(),
      orderItemId: id(false),
      productId: id(false),
    },
    indexes: [
      { key: "by_conversation", type: "key", columns: ["conversationId"] },
      { key: "by_order", type: "key", columns: ["orderId"] },
      { key: "by_product", type: "key", columns: ["productId"] },
    ],
  },
  messages: {
    label: "Mensagens",
    columns: {
      conversationId: id(),
      topicId: id(),
      authorUserId: id(),
      authorSide: enumOf(MESSAGE_SIDES),
      body: text(true),
      attachmentDocumentId: id(false),
      // Tradução automática (opcional; ver MessageTranslation).
      translation: json(),
      // Resposta a uma mensagem marcada do mesmo assunto (opcional).
      replyToMessageId: id(false),
    },
    indexes: [
      { key: "by_topic", type: "key", columns: ["topicId"] },
      { key: "by_conversation", type: "key", columns: ["conversationId"] },
    ],
  },
  approvals: {
    label: "Aprovações",
    columns: {
      requestId: id(),
      quoteId: id(),
      requestedByUserId: id(),
      status: enumOf(APPROVAL_STATUSES),
      input: jsonLarge(),
      valueBrl: float(),
      levels: json(),
      steps: json(),
      currentLevel: enumOf(APPROVAL_LEVELS),
      reason: text(),
      decidedAt: datetime(),
    },
    indexes: [
      { key: "by_request", type: "key", columns: ["requestId"] },
      { key: "by_status", type: "key", columns: ["status"] },
    ],
  },
  production_tracks: {
    label: "Acompanhamento da produção",
    columns: {
      orderId: id(),
      mode: enumOf(PRODUCTION_MODES, false),
      factoryName: str(160),
      factoryAddress: text(),
      productionStartAt: datetime(),
      etd: datetime(),
      etdOriginal: datetime(),
      etdHistory: json(),
      followups: json(),
      inspectionScheduledAt: datetime(),
      inspectionNote: text(),
      updatedByUserId: id(false),
    },
    indexes: [{ key: "order_unique", type: "unique", columns: ["orderId"] }],
  },
  sku_inspections: {
    label: "Inspeção por SKU",
    columns: {
      orderId: id(),
      orderItemId: id(),
      round: int(true),
      result: enumOf(SKU_INSPECTION_RESULTS),
      note: text(),
      inspectedByUserId: id(),
      inspectedAt: datetime(true),
      supplierAction: text(),
      supplierRespondedAt: datetime(),
      supplierRespondedByUserId: id(false),
    },
    indexes: [
      { key: "by_order", type: "key", columns: ["orderId"] },
      { key: "by_item", type: "key", columns: ["orderItemId"] },
    ],
  },
  import_steps: {
    label: "Embarque e desembaraço",
    columns: {
      orderId: id(),
      key: enumOf(IMPORT_STEP_KEYS),
      status: enumOf(IMPORT_STEP_STATUSES),
      value: str(200),
      amount: float(),
      currency: str(3),
      documentId: id(false),
      submittedByUserId: id(false),
      submittedAt: datetime(),
      validatedByUserId: id(false),
      validatedAt: datetime(),
      rejectReason: text(),
    },
    indexes: [
      { key: "order_key_unique", type: "unique", columns: ["orderId", "key"] },
      { key: "by_document", type: "key", columns: ["documentId"] },
    ],
  },
  receivings: {
    label: "Recebimento",
    columns: {
      orderId: id(),
      sealNumber: str(60),
      sealIntact: enumOf(YES_NO, false),
      sealPhotoDocumentId: id(false),
      containerPhotoDocumentIds: json(),
      checklist: json(),
      items: json(),
      ricNumber: str(60),
      ricDocumentId: id(false),
      containerReturnedAt: datetime(),
      containerReturnDocumentId: id(false),
      closedAt: datetime(),
      closedByUserId: id(false),
      closingNote: text(),
      updatedByUserId: id(false),
    },
    indexes: [{ key: "order_unique", type: "unique", columns: ["orderId"] }],
  },
  art_issues: {
    label: "Não conformidades da arte",
    columns: {
      orderId: id(),
      orderItemId: id(),
      status: enumOf(ART_ISSUE_STATUSES),
      note: text(true),
      documentId: id(false),
      reportedByUserId: id(),
      fixNote: text(),
      fixDocumentId: id(false),
      fixedByUserId: id(false),
      fixedAt: datetime(),
      acceptedByUserId: id(false),
      acceptedAt: datetime(),
    },
    indexes: [{ key: "by_order", type: "key", columns: ["orderId"] }],
  },
  message_reads: {
    label: "Leitura das mensagens",
    columns: {
      topicId: id(),
      userId: id(),
      lastReadAt: datetime(true),
    },
    indexes: [
      {
        key: "topic_user_unique",
        type: "unique",
        columns: ["topicId", "userId"],
      },
      { key: "by_user", type: "key", columns: ["userId"] },
    ],
  },
  stock_movements: {
    label: "Movimentações de estoque",
    columns: {
      productId: id(),
      kind: enumOf(STOCK_MOVEMENT_KINDS),
      quantity: float(true),
      unit: str(20),
      orderId: id(false),
      countId: id(false),
      countItemId: id(false),
      note: text(),
      createdByUserId: id(),
      processEventId: id(false),
      locationId: id(false),
    },
    indexes: [
      { key: "by_product", type: "key", columns: ["productId"] },
      { key: "by_count", type: "key", columns: ["countId"] },
    ],
  },
  stock_counts: {
    label: "Inventários (contagem física)",
    columns: {
      number: int(true),
      status: enumOf(STOCK_COUNT_STATUSES),
      note: text(),
      startedByUserId: id(),
      closedByUserId: id(false),
      closedAt: datetime(),
    },
    indexes: [{ key: "by_status", type: "key", columns: ["status"] }],
  },
  stock_count_items: {
    label: "Itens do inventário",
    columns: {
      countId: id(),
      productId: id(),
      expected: float(true),
      unit: str(20),
      status: enumOf(STOCK_COUNT_ITEM_STATUSES),
      attempt1Qty: float(),
      attempt1ByUserId: id(false),
      attempt1At: datetime(),
      attempt2Qty: float(),
      attempt2ByUserId: id(false),
      attempt2At: datetime(),
      finalQty: float(),
      difference: float(),
      approvedByUserId: id(false),
      approvedAt: datetime(),
      approvalNote: text(),
    },
    indexes: [
      {
        key: "count_product_unique",
        type: "unique",
        columns: ["countId", "productId"],
      },
      { key: "by_count", type: "key", columns: ["countId"] },
    ],
  },
  stock_reservations: {
    label: "Reservas de estoque para clientes",
    columns: {
      productId: id(),
      customerId: id(),
      quantity: float(true),
      unit: str(20),
      status: enumOf(STOCK_RESERVATION_STATUSES),
      expiresAt: datetime(),
      note: text(),
      createdByUserId: id(),
      movementId: id(false),
      closedByUserId: id(false),
      closedAt: datetime(),
    },
    indexes: [
      { key: "by_product", type: "key", columns: ["productId"] },
      { key: "by_customer", type: "key", columns: ["customerId"] },
      { key: "by_status", type: "key", columns: ["status"] },
    ],
  },
  booking_lots: {
    label: "Bookings (planilhas de fornecedor)",
    columns: {
      number: int(true),
      status: enumOf(BOOKING_LOT_STATUSES),
      supplierId: id(false),
      supplierHint: json(),
      origin: str(80),
      bookingDate: datetime(),
      sheetDate: str(40),
      fileName: str(255, true),
      fileDocumentId: id(false),
      sheetName: str(120),
      extraHeaders: json(),
      itemCount: int(true),
      businessType: str(80),
      closedAt: datetime(),
      closedByUserId: id(false),
      analyzedAt: datetime(),
      statusChangedAt: datetime(),
      statusChangedByUserId: id(false),
      note: str(500),
      ownerUserId: id(false),
      createdByUserId: id(),
    },
    indexes: [
      { key: "by_status", type: "key", columns: ["status"] },
      { key: "by_supplier", type: "key", columns: ["supplierId"] },
    ],
  },
  booking_items: {
    label: "Itens do booking",
    columns: {
      lotId: id(),
      position: int(true),
      sourceRows: str(40),
      itemNumber: str(40),
      factoryItemCode: str(60),
      productName: str(160),
      description: text(),
      incoterm: enumOf(SHEET_INCOTERMS, false),
      currency: enumOf(SHEET_CURRENCIES, false),
      price: float(),
      masterCartonQty: int(),
      innerQty: int(),
      netWeightPcKg: float(),
      grossWeightPcKg: float(),
      cbmPerCarton: float(),
      lengthCm: float(),
      widthCm: float(),
      heightCm: float(),
      capacityMl: float(),
      packageType: str(120),
      material: str(200),
      moq: int(),
      colorAssortment: str(200),
      powerDetail: str(60),
      purchaseSchedule: str(80),
      departureIntervalDays: str(40),
      purchaseQty: int(),
      plannedQty: int(),
      sizeText: str(60),
      photoDocumentId: id(false),
      cardDocumentId: id(false),
      extras: json(),
      analysis: json(),
      productId: id(false),
      updatedByUserId: id(false),
      ncm: str(10),
      ncmSource: enumOf(BOOKING_ITEM_NCM_SOURCES, false),
      ncmMatchProductIds: json(),
      ncmScore: float(),
      ncmRequestedAt: datetime(),
      ncmAt: datetime(),
      ncmByUserId: id(false),
    },
    indexes: [
      { key: "by_lot", type: "key", columns: ["lotId"] },
      { key: "by_product", type: "key", columns: ["productId"] },
    ],
  },
  supplier_requests: {
    label: "Solicitações ao fornecedor",
    columns: {
      number: int(true),
      status: enumOf(SUPPLIER_REQUEST_STATUSES),
      supplierId: id(),
      bookingItemId: id(),
      bookingLotId: id(),
      alternativeItemIds: json(),
      item: json(),
      quantity: int(true),
      unit: str(20, true),
      needs: text(),
      searchQuery: str(200),
      supplierCanDo: enumOf(YES_NO, false),
      supplierPrice: float(),
      supplierCurrency: enumOf(SHEET_CURRENCIES, false),
      supplierMoq: int(),
      supplierLeadTimeDays: int(),
      supplierIncoterm: enumOf(SHEET_INCOTERMS, false),
      supplierNote: text(),
      respondedAt: datetime(),
      respondedByUserId: id(false),
      decidedAt: datetime(),
      decidedByUserId: id(false),
      decisionNote: str(500),
      createdByUserId: id(),
      productId: id(false),
      productAction: enumOf(["created", "linked"], false),
      productLinkedAt: datetime(),
      productLinkedByUserId: id(false),
      showcaseReleasedAt: datetime(),
      showcaseReleasedByUserId: id(false),
      erpCheckedAt: datetime(),
      negotiation: jsonLarge(),
      slaNotifiedAt: datetime(),
      orderId: id(false),
    },
    indexes: [
      { key: "by_supplier", type: "key", columns: ["supplierId"] },
      { key: "by_item", type: "key", columns: ["bookingItemId"] },
      { key: "by_status", type: "key", columns: ["status"] },
      { key: "by_product", type: "key", columns: ["productId"] },
      { key: "by_order", type: "key", columns: ["orderId"] },
    ],
  },
  selection_groups: {
    label: "Grupos resolvidos da seleção de itens",
    columns: {
      status: enumOf(SELECTION_GROUP_STATUSES),
      itemIds: json(),
      chosenItemId: id(),
      quantity: int(true),
      needs: text(),
      supplierRequestId: id(false),
      requestedAt: datetime(),
      createdByUserId: id(),
      updatedByUserId: id(false),
    },
    indexes: [
      { key: "by_status", type: "key", columns: ["status"] },
      { key: "by_chosen", type: "key", columns: ["chosenItemId"] },
    ],
  },
  stock_locations: {
    label: "Locais de estoque (Sankhya TGFLOC)",
    columns: {
      code: int(true),
      name: str(120, true),
      active: bool(),
      notes: text(),
      sankhyaCode: str(40),
    },
    indexes: [{ key: "code_unique", type: "unique", columns: ["code"] }],
  },
  payment_conditions: {
    label: "Condições de pagamento (Sankhya TGFTPV)",
    columns: {
      code: int(true),
      name: str(160, true),
      active: bool(),
      notes: text(),
      source: enumOf(["sankhya", "portal"] as const),
      updatedByUserId: id(false),
    },
    indexes: [{ key: "code_unique", type: "unique", columns: ["code"] }],
  },
  process_events: {
    label: "Eventos de processo (regras de status → estoque e Sankhya)",
    columns: {
      event: str(80, true),
      requestId: id(false),
      orderId: id(false),
      stockAction: str(20),
      sankhyaAction: str(20),
      top: int(),
      status: enumOf(["done", "simulated", "skipped", "error"] as const),
      detail: text(),
      nunotaBefore: str(40),
      nunotaAfter: str(40),
      createdByUserId: id(false),
      entity: str(40),
      entityId: id(false),
    },
    indexes: [
      { key: "by_order", type: "key", columns: ["orderId"] },
      { key: "by_request", type: "key", columns: ["requestId"] },
      { key: "by_event", type: "key", columns: ["event"] },
      { key: "by_entity", type: "key", columns: ["entityId"] },
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

/**
 * Extensões que o armazenamento (bucket `arquivos`) aceita. O Appwrite recusa
 * qualquer outra ("File extension not allowed"), então todo tipo aceito nos
 * documentos e no chat (`src/lib/services/documents.ts`) precisa estar aqui
 * (o teste bucket-extensions confere). Publicar o esquema só acrescenta.
 */
export const BUCKET_EXTENSIONS = [
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "heic",
  "heif",
  "xlsx",
  "xlsm",
  "xls",
  "csv",
  "json",
  "zip",
  "ai",
  "svg",
  "psd",
  "eps",
  "cdr",
  "tif",
  "tiff",
  // XML da DI/DUIMP, foto .jfif do Windows e PostScript.
  "xml",
  "jfif",
  "ps",
  // Só do chat: GIF, Word, PowerPoint, texto e vídeo.
  "gif",
  "doc",
  "docx",
  "ppt",
  "pptx",
  "txt",
  "mp4",
  "m4v",
  "mov",
  "qt",
  "webm",
  "3gp",
] as const;

/** 50 MB por arquivo (teto do plano do Appwrite Cloud); vídeo maior é reduzido no aparelho. */
export const BUCKET_MAX_BYTES = 50_000_000;
