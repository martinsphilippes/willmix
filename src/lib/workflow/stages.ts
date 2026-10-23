import type {
  Order,
  ProductLine,
  RequirementTemplate,
  Role,
  StageKey,
} from "@/lib/db/schema";
import { STAGE_KEYS } from "@/lib/db/schema";

/** Item que conclui o Embarque (os dados do embarque são opcionais). */
export const SHIPPED_KEY = "shipped";
export const SHIPPED_LABEL = "Embarque confirmado";
/** Dados do embarque que eram obrigatórios antes do "Embarque confirmado". */
export const SHIPPING_OPTIONAL_KEYS = ["ship_date", "eta", "bl"] as const;
/** Dados do embarque que ainda dá para completar depois de confirmado. */
export const SHIPPING_LATE_KEYS = ["ship_date", "eta", "vessel", "bl"] as const;

/**
 * Dado opcional do Embarque já confirmado (BL que chegou depois, data real,
 * navio): ainda pode ser enviado ou trocado até o pedido encerrar.
 */
export function canCompleteLater(
  stage: { key: string; status: string },
  requirement: { key: string; required: boolean },
  order: { status: string },
): boolean {
  return (
    stage.key === "SHIPPING" &&
    stage.status === "done" &&
    !requirement.required &&
    (SHIPPING_LATE_KEYS as readonly string[]).includes(requirement.key) &&
    order.status !== "CANCELLED" &&
    order.status !== "CLOSED"
  );
}

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
  deliveryConfirmationMode: "CUSTOMER" | "WELLMIX" | "BOTH";
  /** Inspeção cega ampliada: medidas, peso bruto, caixa, material e cor (comparados com o snapshot da compra). */
  inspectionExtendedChecks?: boolean;
}

/**
 * Medidas extras da inspeção. Opcionais: só entram na comparação quando o
 * snapshot da compra tem o valor esperado. O inspetor nunca vê o esperado.
 */
export const EXTENDED_INSPECTION_REQUIREMENTS: RequirementTemplate[] = [
  {
    key: "gross_weight_measured",
    label: "Peso bruto medido (kg)",
    type: "number",
    required: false,
    role: "supplier",
  },
  {
    key: "length_measured",
    label: "Comprimento medido (cm)",
    type: "number",
    required: false,
    role: "supplier",
  },
  {
    key: "width_measured",
    label: "Largura medida (cm)",
    type: "number",
    required: false,
    role: "supplier",
  },
  {
    key: "height_measured",
    label: "Altura medida (cm)",
    type: "number",
    required: false,
    role: "supplier",
  },
  {
    key: "master_box_cbm_measured",
    label: "CBM da caixa master medido (m³)",
    type: "number",
    required: false,
    role: "supplier",
  },
  {
    key: "master_box_measured",
    label: "Unidades por caixa master encontradas",
    type: "number",
    required: false,
    role: "supplier",
  },
  {
    key: "inner_box_measured",
    label: "Unidades por inner box encontradas",
    type: "number",
    required: false,
    role: "supplier",
  },
  {
    key: "material_found",
    label: "Material encontrado",
    type: "text",
    required: false,
    role: "supplier",
  },
  {
    key: "color_found",
    label: "Cor encontrada",
    type: "text",
    required: false,
    role: "supplier",
  },
];

/**
 * Checklist padrão da Preparação (quando a linha não define o seu): só a ficha de compra (planilha COMPRAS). Ela reúne
 * fornecedor, preço, caixa, pesos, medidas, programação e fotos (a foto na
 * balança é obrigatória nela); o peso líquido por peça é o peso comparado na
 * inspeção. Dieline, foto profissional, peso e etiqueta saíram do checklist.
 */
export const DEFAULT_PREPARATION_REQUIREMENTS: RequirementTemplate[] = [
  {
    key: "purchase_sheet",
    label: "Ficha de compra",
    type: "text",
    required: true,
    role: "supplier",
  },
];

/** Quem envia a arte da embalagem: a agência do pedido ou, sem ela, a Wellmix. */
export function artRole(
  order: Pick<Order, "agencyId">,
  agencyValidationEnabled: boolean,
): Role {
  return agencyValidationEnabled && order.agencyId ? "agency" : "operator";
}

export const ART_APPROVAL_LABEL = "Aprovação da arte pelo fornecedor";

/**
 * Etapas que não seguram o pedido: concluem na hora em que começam (mesmo nos
 * pedidos antigos, que ainda têm itens nelas) e não aparecem no fluxo.
 */
export const OFF_FLOW_STAGES: readonly StageKey[] = ["SUPPLIER_PAYMENT"];

export const isOffFlowStage = (key: string) =>
  (OFF_FLOW_STAGES as readonly string[]).includes(key);

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
    /*
     * Fora do fluxo (OFF_FLOW_STAGES): o pagamento ao fornecedor segue a
     * condição negociada com cada um (cadastro do fornecedor) e costuma vencer
     * meses depois da entrega. A etapa fica no esquema (pedidos antigos), mas
     * conclui sozinha; o pagamento vive em Contas a pagar, no card do pedido e
     * na conta corrente do fornecedor.
     */
    key: "SUPPLIER_PAYMENT",
    responsibleRole: "operator",
    partyField: "supplierId",
    requirements: () => [],
  },
  {
    /*
     * Arte e embalagem: a agência de marketing faz a arte e envia; o
     * fornecedor confere e aprova para produzir (ou reprova com observação, e
     * a arte volta para quem a fez). Sem agência no pedido (ou com "Arte feita
     * pela agência" desligado nas configurações), quem envia a arte é a Wellmix.
     */
    key: "PACKAGING",
    responsibleRole: "agency",
    partyField: "agencyId",
    requirements: ({ order, agencyValidationEnabled }) => [
      {
        key: "art",
        label: "Arte da embalagem",
        type: "file",
        required: true,
        role: artRole(order, agencyValidationEnabled),
      },
      {
        key: "art_approval",
        label: ART_APPROVAL_LABEL,
        type: "approval",
        required: true,
        role: "supplier",
      },
    ],
  },
  {
    key: "INSPECTION",
    responsibleRole: "supplier",
    partyField: "supplierId",
    requirements: ({ inspectionExtendedChecks }) => [
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
      ...(inspectionExtendedChecks ? EXTENDED_INSPECTION_REQUIREMENTS : []),
    ],
  },
  {
    key: "SHIPPING",
    responsibleRole: "shipping_line",
    partyField: "shippingLineId",
    // Data, chegada, navio e BL são opcionais (dá para avançar sem eles); o
    // "Embarque confirmado" é o que conclui a etapa.
    requirements: ({ order }) => {
      const role: Role = order.shippingLineId ? "shipping_line" : "operator";
      return [
        {
          key: "ship_date",
          label: "Data de embarque",
          type: "date",
          required: false,
          role,
        },
        {
          key: "eta",
          label: "Previsão de chegada",
          type: "date",
          required: false,
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
          required: false,
          role,
        },
        {
          key: SHIPPED_KEY,
          label: SHIPPED_LABEL,
          type: "confirm",
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
        role: deliveryConfirmationMode === "WELLMIX" ? "operator" : "customer",
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
