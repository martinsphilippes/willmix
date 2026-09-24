import type {
  Order,
  ProductLine,
  RequirementTemplate,
  Role,
  StageKey,
} from "@/lib/db/schema";
import { STAGE_KEYS } from "@/lib/db/schema";

export interface StageTemplate {
  key: StageKey;
  /** Papel responsável padrão (o real é recalculado pelo próximo requisito pendente). */
  responsibleRole: Role;
  /** Campo do pedido que identifica o parceiro responsável. */
  partyField: PartyField | null;
  requirements: (ctx: StageContext) => RequirementTemplate[];
}

export interface StageContext {
  order: Order;
  line: ProductLine | null;
  agencyValidationEnabled: boolean;
  deliveryConfirmationMode: "CUSTOMER" | "WILLMIX" | "BOTH";
}

/** Checklist padrão de preparação quando a linha de produto não define o seu. */
export const DEFAULT_PREPARATION_REQUIREMENTS: RequirementTemplate[] = [
  {
    key: "dieline",
    label: "Dieline",
    type: "file",
    required: true,
    role: "supplier",
  },
  {
    key: "photo_pro",
    label: "Foto profissional",
    type: "photo",
    required: true,
    role: "supplier",
  },
  {
    key: "weight",
    label: "Peso (kg)",
    type: "number",
    required: true,
    role: "supplier",
  },
  {
    key: "photo_scale",
    label: "Foto na balança",
    type: "photo",
    required: true,
    role: "supplier",
  },
  {
    key: "label",
    label: "Etiqueta",
    type: "file",
    required: true,
    role: "supplier",
  },
];

export const STAGE_TEMPLATES: StageTemplate[] = [
  {
    key: "ORDER_CREATED",
    responsibleRole: "operator",
    partyField: null,
    requirements: () => [
      {
        key: "order_confirmed",
        label: "Pedido conferido e liberado ao fornecedor",
        type: "confirm",
        required: true,
        role: "operator",
      },
      {
        key: "erp_number",
        label: "Número no Sankhya",
        type: "text",
        required: false,
        role: "operator",
      },
    ],
  },
  {
    key: "PREPARATION",
    responsibleRole: "supplier",
    partyField: "supplierId",
    requirements: ({ line }) =>
      line?.requirements?.length
        ? line.requirements
        : DEFAULT_PREPARATION_REQUIREMENTS,
  },
  {
    key: "SUPPLIER_PAYMENT",
    responsibleRole: "operator",
    partyField: "supplierId",
    requirements: () => [
      {
        key: "payment_registered",
        label: "Pagamento ao fornecedor registrado",
        type: "confirm",
        required: true,
        role: "operator",
      },
      {
        key: "payment_received",
        label: "Recebimento confirmado pelo fornecedor",
        type: "confirm",
        required: true,
        role: "supplier",
      },
    ],
  },
  {
    key: "PACKAGING",
    responsibleRole: "supplier",
    partyField: "supplierId",
    requirements: ({ order, agencyValidationEnabled }) => [
      {
        key: "art",
        label: "Arte da embalagem",
        type: "file",
        required: true,
        role: "supplier",
      },
      ...(agencyValidationEnabled && order.agencyId
        ? [
            {
              key: "art_approval",
              label: "Aprovação da arte pela agência",
              type: "approval" as const,
              required: true,
              role: "agency" as const,
            },
          ]
        : []),
    ],
  },
  {
    key: "INSPECTION",
    responsibleRole: "supplier",
    partyField: "supplierId",
    requirements: () => [
      {
        key: "photo_unpacked",
        label: "Foto sem embalagem",
        type: "photo",
        required: true,
        role: "supplier",
      },
      {
        key: "photo_packed",
        label: "Foto com embalagem",
        type: "photo",
        required: true,
        role: "supplier",
      },
      {
        key: "photo_scale",
        label: "Foto na balança",
        type: "photo",
        required: true,
        role: "supplier",
      },
      {
        key: "weight_measured",
        label: "Peso medido (kg)",
        type: "number",
        required: true,
        role: "supplier",
      },
    ],
  },
  {
    key: "SHIPPING",
    responsibleRole: "shipping_line",
    partyField: "shippingLineId",
    requirements: ({ order }) => {
      const role: Role = order.shippingLineId ? "shipping_line" : "operator";
      return [
        {
          key: "ship_date",
          label: "Data de embarque",
          type: "date",
          required: true,
          role,
        },
        {
          key: "eta",
          label: "Previsão de chegada",
          type: "date",
          required: true,
          role,
        },
        {
          key: "vessel",
          label: "Navio / viagem",
          type: "text",
          required: false,
          role,
        },
        {
          key: "bl",
          label: "Bill of Lading (BL)",
          type: "file",
          required: true,
          role,
        },
      ];
    },
  },
  {
    key: "CUSTOMS",
    responsibleRole: "broker",
    partyField: "brokerId",
    requirements: ({ order }) => {
      const role: Role = order.brokerId ? "broker" : "operator";
      return [
        {
          key: "process_number",
          label: "Número do processo",
          type: "text",
          required: true,
          role,
        },
        {
          key: "customs_docs",
          label: "Documentos aduaneiros",
          type: "file",
          required: true,
          role,
        },
        {
          key: "estimated_costs",
          label: "Custos previstos",
          type: "number",
          required: false,
          role,
        },
        {
          key: "actual_costs",
          label: "Custos realizados",
          type: "number",
          required: true,
          role,
        },
        {
          key: "release",
          label: "Liberação aduaneira",
          type: "confirm",
          required: true,
          role,
        },
      ];
    },
  },
  {
    key: "TRANSPORT",
    responsibleRole: "carrier",
    partyField: "carrierId",
    requirements: ({ order }) => {
      const role: Role = order.carrierId ? "carrier" : "operator";
      return [
        {
          key: "plate",
          label: "Placa do veículo",
          type: "text",
          required: true,
          role,
        },
        {
          key: "eta",
          label: "Previsão de entrega",
          type: "date",
          required: true,
          role,
        },
        {
          key: "status_update",
          label: "Situação do transporte",
          type: "text",
          required: false,
          role,
        },
        {
          key: "delivered",
          label: "Entrega realizada",
          type: "confirm",
          required: true,
          role,
        },
      ];
    },
  },
  {
    key: "DELIVERED",
    responsibleRole: "customer",
    partyField: "customerId",
    requirements: ({ deliveryConfirmationMode }) => [
      {
        key: "receipt_confirmed",
        label: "Recebimento confirmado",
        type: "confirm",
        required: true,
        role: deliveryConfirmationMode === "WILLMIX" ? "operator" : "customer",
      },
    ],
  },
  {
    key: "CLOSED",
    responsibleRole: "operator",
    partyField: null,
    requirements: () => [],
  },
];

/** Campo do pedido que identifica o parceiro de cada papel externo. */
export type PartyField =
  | "customerId"
  | "supplierId"
  | "agencyId"
  | "brokerId"
  | "shippingLineId"
  | "carrierId";

export const ROLE_PARTY_FIELD: Record<Role, PartyField | null> = {
  admin: null,
  operator: null,
  legal: null,
  customer: "customerId",
  supplier: "supplierId",
  agency: "agencyId",
  broker: "brokerId",
  shipping_line: "shippingLineId",
  carrier: "carrierId",
};

export const stageTemplate = (key: StageKey) =>
  STAGE_TEMPLATES.find((s) => s.key === key)!;
export const stageIndex = (key: StageKey) => STAGE_KEYS.indexOf(key);
export const nextStageKey = (key: StageKey): StageKey | null =>
  STAGE_KEYS[stageIndex(key) + 1] ?? null;
