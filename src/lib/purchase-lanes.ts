import type {
  Requirement,
  RequirementTemplate,
  RequirementType,
  Role,
  StageStatus,
} from "@/lib/db/schema";
import { titleWithName } from "@/lib/placeholder-name";

/*
 * Pedido de compra das solicitações ao fornecedor (docs/PURCHASE_ORDER.md):
 * regras puras das três raias que correm em paralelo na etapa "Preparação,
 * arte e certificação", item a item do pedido.
 *
 * - Fornecedor: checklist da linha do produto (padrão: faca e foto em alta),
 *   MOQ e prazo de produção confirmados.
 * - Agência de arte: arte do produto (SLA em dias), validação da Wellmix
 *   (aprova ou devolve, com SLA), arte final com o selo depois do certificado.
 * - Certificadora (OCP, Inmetro): certificado do produto, só quando a linha
 *   do produto exige certificação (mapa do processo, passo P6). O produto que
 *   já tem certificação válida pelo período do pedido não renova (P8).
 * - Cadastro e fiscal (Wellmix): NCM validado e ficha mestre completa do
 *   produto (P9/P14), conferidos sozinhos pelo sistema.
 *
 * A sequência segue o mapa do processo (docs/PURCHASE_ORDER.md, "Sequência"):
 * a arte espera a faca e a foto em alta; a arte final espera a arte validada e
 * o certificado; o contrato só começa com todas as raias concluídas; o sinal
 * (ou a conta corrente) vem depois das duas assinaturas e libera a produção.
 *
 * Cada requisito leva o item do pedido na chave (`base__itemId`).
 */

export const LANE_SEPARATOR = "__";

export const laneKey = (base: string, itemId: string) =>
  `${base}${LANE_SEPARATOR}${itemId}`;

/** A parte da chave antes do item (`art__abc` → `art`). */
export const baseKeyOf = (key: string) => key.split(LANE_SEPARATOR)[0];

/** O item do pedido da chave, ou nulo para os requisitos do pedido inteiro. */
export function itemIdOf(key: string): string | null {
  const i = key.indexOf(LANE_SEPARATOR);
  return i < 0 ? null : key.slice(i + LANE_SEPARATOR.length);
}

export const LANE_KEYS = {
  dieCut: "die_cut",
  hdPhoto: "hd_photo",
  moq: "moq_confirmed",
  leadTime: "lead_time_confirmed",
  art: "art",
  artReview: "art_review",
  certificate: "certificate",
  artFinal: "art_final",
  ncmValidated: "ncm_validated",
  sheetComplete: "sheet_complete",
} as const;

/**
 * Sinal pago ao fornecedor ou conta corrente (passos P12?/P12 do mapa): item
 * do contrato, depois das duas assinaturas. Segura a produção.
 */
export const DOWN_PAYMENT_KEY = "down_payment";
const SIGNED_WELLMIX = "order_signed_wellmix";
const SIGNED_SUPPLIER = "order_signed_supplier";

/**
 * Pedido de amostras (contrato secundário, mapa P17, docs/SAMPLE_ORDER.md):
 * a Wellmix define (gera o pedido ou marca "sem amostras") antes de assinar
 * o contrato; o fornecedor aceita o pedido de amostras à parte.
 */
export const SAMPLE_ORDER_KEY = "sample_order";
export const SAMPLE_ORDER_SUPPLIER_KEY = "sample_order_supplier";
export const SAMPLE_ORDER_KEYS: readonly string[] = [
  SAMPLE_ORDER_KEY,
  SAMPLE_ORDER_SUPPLIER_KEY,
];
export const isSampleOrderKey = (key: string) =>
  SAMPLE_ORDER_KEYS.includes(key);

/*
 * Inspeção do pedido de compra (mapa, R3/R4?; docs/PRODUCTION.md, "Sequência
 * da inspeção"): fotos, peso e vídeo da produção do fornecedor; a declaração
 * de conformidade do fornecedor (ou da trading) depois deles; e a aprovação
 * da Wellmix de todos os SKUs, que o sistema confere e segura o embarque.
 */
export const PRODUCTION_VIDEO_KEY = "production_video";
export const SUPPLIER_CONFORMITY_KEY = "supplier_conformity";
export const SKU_APPROVED_KEY = "sku_approved";
/** O que o fornecedor manda para a inspeção (volta a pendente a cada reprovação). */
export const INSPECTION_MEDIA_KEYS: readonly string[] = [
  "photo_unpacked",
  "photo_packed",
  "photo_scale",
  "weight_measured",
  PRODUCTION_VIDEO_KEY,
];

/**
 * Itens que o sistema confere sozinho (ninguém marca à mão): o NCM validado
 * na tela fiscal, a ficha mestre completa e o sinal pago (ou a conta corrente).
 */
export const AUTO_GATE_KEYS: readonly string[] = [
  LANE_KEYS.ncmValidated,
  LANE_KEYS.sheetComplete,
  DOWN_PAYMENT_KEY,
  SKU_APPROVED_KEY,
];

export const isAutoGateKey = (key: string) =>
  AUTO_GATE_KEYS.includes(baseKeyOf(key));

/**
 * As quatro tarefas da Preparação com dono por login (dono, 14/11/2026):
 * arte, validação da arte, certificado e arte final com o selo. Quem recebe
 * cada uma sai de `laneRoute` (src/lib/services/cert-art-routing.ts).
 */
const ROUTED_LANE_BASES = new Set<string>([
  LANE_KEYS.art,
  LANE_KEYS.artReview,
  LANE_KEYS.certificate,
  LANE_KEYS.artFinal,
]);

/** É uma das quatro (`art__item`, `certificate__item`…)? */
export const isRoutedLaneKey = (key: string) =>
  !!itemIdOf(key) && ROUTED_LANE_BASES.has(baseKeyOf(key));

export type Lane = "supplier" | "art" | "certification" | "registration";

const ART_KEYS = new Set<string>([
  LANE_KEYS.art,
  LANE_KEYS.artReview,
  LANE_KEYS.artFinal,
]);

/** Raia do requisito pela chave base. */
export function laneOf(key: string): Lane {
  const base = baseKeyOf(key);
  if (base === LANE_KEYS.certificate) return "certification";
  if (ART_KEYS.has(base)) return "art";
  if (base === LANE_KEYS.ncmValidated || base === LANE_KEYS.sheetComplete)
    return "registration";
  return "supplier";
}

/*
 * Aprovações do mapa no fim de cada marco (dono, 14/11/2026;
 * docs/MILESTONES.md): o GP aprova o cadastro e a certificação, o Comprador
 * o material de arte, o Planner a pré-produção e a Diretoria de compras o
 * sinal. Cada uma é um item obrigatório do pedido de compra, liberado quando
 * as subtarefas do marco estão feitas, e feito só por quem tem a ação
 * (Equipe e acessos).
 */
export interface MilestoneApproval {
  key: string;
  /** Ação (Equipe → Funções e acessos) de quem aprova. */
  action:
    | "approve.productManager"
    | "approve.buyer"
    | "approve.planner"
    | "approve.purchasingDirector";
  /** Itens (pela chave sem o produto) que precisam estar feitos antes. */
  requires: string[];
  label: string;
}

export const MILESTONE_APPROVALS = {
  registration: {
    key: "approval_registration",
    action: "approve.productManager",
    requires: [LANE_KEYS.ncmValidated, LANE_KEYS.sheetComplete],
    label: "Cadastro e fiscal aprovados pelo GP",
  },
  certification: {
    key: "approval_certification",
    action: "approve.productManager",
    requires: [LANE_KEYS.certificate],
    label: "Certificação aprovada pelo GP",
  },
  artMaterial: {
    key: "approval_art_material",
    action: "approve.buyer",
    requires: [
      LANE_KEYS.dieCut,
      LANE_KEYS.hdPhoto,
      LANE_KEYS.moq,
      LANE_KEYS.leadTime,
    ],
    label: "Material de arte aprovado pelo Comprador",
  },
  preProduction: {
    key: "approval_pre_production",
    action: "approve.planner",
    requires: [],
    label: "Pré-produção (dados e ETD) aprovada pelo Planner",
  },
  downPayment: {
    key: "approval_down_payment",
    action: "approve.purchasingDirector",
    requires: [DOWN_PAYMENT_KEY],
    label: "Sinal aprovado pela Diretoria de compras",
  },
} as const satisfies Record<string, MilestoneApproval>;

const APPROVAL_BY_KEY = new Map<string, MilestoneApproval>(
  Object.values(MILESTONE_APPROVALS).map((a) => [a.key, a]),
);

/** A aprovação do mapa de um item, se for uma. */
export const milestoneApprovalOf = (key: string): MilestoneApproval | null =>
  APPROVAL_BY_KEY.get(key) ?? null;

const approvalTemplate = (a: MilestoneApproval): RequirementTemplate => ({
  key: a.key,
  label: a.label,
  type: "confirm",
  required: true,
  role: "operator",
});

/** Aprovações do fim da Preparação: cadastro, material de arte e (se houver) certificação. */
export function preparationApprovals(
  lanes: RequirementTemplate[],
): RequirementTemplate[] {
  const cert = lanes.some((r) => baseKeyOf(r.key) === LANE_KEYS.certificate);
  return [
    approvalTemplate(MILESTONE_APPROVALS.registration),
    approvalTemplate(MILESTONE_APPROVALS.artMaterial),
    ...(cert ? [approvalTemplate(MILESTONE_APPROVALS.certification)] : []),
  ];
}

export const DOWN_PAYMENT_APPROVAL = approvalTemplate(
  MILESTONE_APPROVALS.downPayment,
);
export const PRE_PRODUCTION_APPROVAL = approvalTemplate(
  MILESTONE_APPROVALS.preProduction,
);

/** O que precisa estar concluído antes (mesmo item): a ordem dentro das raias. */
export function prerequisitesOf(key: string): string[] {
  // Contrato: o fornecedor assina depois da Wellmix; o sinal (ou a conta
  // corrente) vem com as duas assinaturas.
  if (key === SIGNED_SUPPLIER) return [SIGNED_WELLMIX];
  // A Wellmix só assina com o pedido de amostras definido (P17 → P11); o
  // fornecedor aceita o pedido de amostras depois de gerado.
  if (key === SIGNED_WELLMIX) return [SAMPLE_ORDER_KEY];
  if (key === SAMPLE_ORDER_SUPPLIER_KEY) return [SAMPLE_ORDER_KEY];
  // Inspeção: a declaração depois das fotos, do peso e do vídeo; a
  // aprovação da Wellmix depois da declaração.
  if (key === SUPPLIER_CONFORMITY_KEY) return [...INSPECTION_MEDIA_KEYS];
  if (key === SKU_APPROVED_KEY) return [SUPPLIER_CONFORMITY_KEY];
  if (key === DOWN_PAYMENT_KEY) return [SIGNED_WELLMIX, SIGNED_SUPPLIER];
  const item = itemIdOf(key);
  if (!item) return [];
  const base = baseKeyOf(key);
  // A agência cria a arte sobre a faca e a foto em alta do fornecedor (P4 → P5).
  if (base === LANE_KEYS.art)
    return [laneKey(LANE_KEYS.dieCut, item), laneKey(LANE_KEYS.hdPhoto, item)];
  if (base === LANE_KEYS.artReview) return [laneKey(LANE_KEYS.art, item)];
  if (base === LANE_KEYS.artFinal)
    return [
      laneKey(LANE_KEYS.artReview, item),
      laneKey(LANE_KEYS.certificate, item),
    ];
  return [];
}

/** A aprovação e o requisito que ela confere (a validação da arte confere a arte). */
export function approvalSourceOf(key: string): string | null {
  const item = itemIdOf(key);
  if (item && baseKeyOf(key) === LANE_KEYS.artReview)
    return laneKey(LANE_KEYS.art, item);
  return null;
}

/**
 * Requisitos ainda não liberados (falta o anterior da raia). Só conta o
 * anterior que existe no pedido: sem certificação na linha, a arte final não
 * existe; pedido antigo sem a faca não prende a arte.
 */
export function blockedBy(
  key: string,
  requirements: Array<Pick<Requirement, "key" | "status">>,
): string[] {
  const present = new Set(requirements.map((r) => r.key));
  const done = new Set(
    requirements.filter((r) => r.status === "done").map((r) => r.key),
  );
  // Aprovação do mapa: todos os itens do marco (de todos os produtos).
  const approval = milestoneApprovalOf(key);
  if (approval)
    return [...present].filter(
      (k) =>
        (approval.requires as readonly string[]).includes(baseKeyOf(k)) &&
        !done.has(k),
    );
  return prerequisitesOf(key).filter((k) => present.has(k) && !done.has(k));
}

/**
 * Visão do fornecedor na etapa "Preparação, arte e certificação" do pedido de
 * compra (pedido do dono, 13/11/2026): só três tarefas por produto, a faca
 * (die cut), a foto em alta e o prazo de produção. O resto (MOQ, arte,
 * validação, certificado, arte final, NCM ou outro item da linha do produto)
 * continua existindo e valendo; só não aparece para ele nessa seção. A
 * Wellmix vê tudo, e o MOQ segue no quadro Die Cut.
 */
const SUPPLIER_PREPARATION_KEYS = new Set<string>([
  LANE_KEYS.dieCut,
  LANE_KEYS.hdPhoto,
  LANE_KEYS.leadTime,
]);

export function supplierSeesLaneRequirement(
  requirement: Pick<Requirement, "key">,
): boolean {
  return (
    !!itemIdOf(requirement.key) &&
    SUPPLIER_PREPARATION_KEYS.has(baseKeyOf(requirement.key))
  );
}

/**
 * A etapa 2 do pedido de compra como o login Trading a vê (pedido do dono,
 * 13/11/2026): "Die-Cut", com o andamento só das tarefas dele (as de
 * `supplierSeesLaneRequirement`), contado do que está gravado. Com todas
 * feitas, a etapa aparece concluída para ele, mesmo com a arte, a validação
 * ou o certificado ainda abertos para os outros. A etapa de verdade não muda.
 * Nulo quando a etapa não tem tarefa dele (pedido do fluxo antigo).
 */
export interface SupplierLaneView {
  /** Situação mostrada: concluída quando as tarefas dele estão feitas. */
  status: StageStatus;
  done: number;
  total: number;
  percent: number;
  complete: boolean;
  /** Data do último envio, quando a etapa aparece concluída para ele. */
  completedAt: string | null;
}

export function supplierLaneView(
  stage: { status: StageStatus },
  requirements: Array<Pick<Requirement, "key" | "status" | "submittedAt">>,
): SupplierLaneView | null {
  const mine = requirements.filter(supplierSeesLaneRequirement);
  if (!mine.length) return null;
  const done = mine.filter((r) => r.status === "done");
  const complete = done.length === mine.length;
  // Só a etapa que já começou (aberta, parada ou concluída) vira concluída,
  // e só ela mostra a data de conclusão.
  const shownDone =
    complete &&
    (stage.status === "active" ||
      stage.status === "blocked" ||
      stage.status === "done");
  return {
    status: shownDone ? "done" : stage.status,
    done: done.length,
    total: mine.length,
    percent: Math.round((done.length / mine.length) * 100),
    complete,
    completedAt: shownDone
      ? (done
          .map((r) => r.submittedAt)
          .filter((at): at is string => !!at)
          .sort()
          .at(-1) ?? null)
      : null,
  };
}

/** O prazo de produção confirmado de um item do pedido (`lead_time_confirmed__item`). */
export const isLeadTimeKey = (key: string) =>
  !!itemIdOf(key) && baseKeyOf(key) === LANE_KEYS.leadTime;

export interface LaneItem {
  id: string;
  name: string;
  /** Itens a mais do checklist da linha do produto (a faca e a foto em alta sempre entram). */
  lineRequirements?: RequirementTemplate[] | null;
  /**
   * A linha do produto exige certificação (P6): certificado e arte final com o
   * selo. Sem valor, entra (comportamento de antes).
   */
  certificationRequired?: boolean;
}

const req = (
  key: string,
  label: string,
  type: RequirementType,
  role: Role,
): RequirementTemplate => ({ key, label, type, required: true, role });

/**
 * Requisitos da etapa "Preparação, arte e certificação" do pedido de compra:
 * as três raias, para cada produto do pedido.
 */
export function laneRequirements(
  items: LaneItem[],
  roles: { art: Role; ocp: Role },
): RequirementTemplate[] {
  const out: RequirementTemplate[] = [];
  for (const item of items) {
    // Sem nome real (vazio ou de exemplo), fica só o título da tarefa.
    const of = (label: string) => titleWithName(label, item.name);
    const certified = item.certificationRequired !== false;
    // Cadastro e fiscal: NCM validado e ficha mestre completa (o sistema confere).
    out.push(
      req(
        laneKey(LANE_KEYS.ncmValidated, item.id),
        of("NCM validado"),
        "confirm",
        "operator",
      ),
      req(
        laneKey(LANE_KEYS.sheetComplete, item.id),
        of("Ficha mestre completa"),
        "confirm",
        "operator",
      ),
    );
    // Sempre a faca e a foto em alta; a linha do produto acrescenta os itens
    // dela (a ficha de compra é do fluxo antigo e fica de fora).
    const base: RequirementTemplate[] = [
      req(LANE_KEYS.dieCut, "Faca (die cut)", "file", "supplier"),
      req(LANE_KEYS.hdPhoto, "Foto em alta resolução", "photo", "supplier"),
    ];
    const extra = (item.lineRequirements ?? []).filter(
      (r) => r.key !== "purchase_sheet" && !base.some((b) => b.key === r.key),
    );
    const checklist = [...base, ...extra];
    for (const r of checklist)
      out.push({ ...r, key: laneKey(r.key, item.id), label: of(r.label) });
    out.push(
      req(
        laneKey(LANE_KEYS.moq, item.id),
        of("MOQ confirmado (peças)"),
        "number",
        "supplier",
      ),
      req(
        laneKey(LANE_KEYS.leadTime, item.id),
        of("Prazo de produção confirmado (dias)"),
        "number",
        "supplier",
      ),
      req(laneKey(LANE_KEYS.art, item.id), of("Arte"), "file", roles.art),
      req(
        laneKey(LANE_KEYS.artReview, item.id),
        of("Validação da arte pela Wellmix"),
        "approval",
        "operator",
      ),
    );
    if (certified)
      out.push(
        req(
          laneKey(LANE_KEYS.certificate, item.id),
          of("Certificado (Inmetro)"),
          "file",
          roles.ocp,
        ),
        req(
          laneKey(LANE_KEYS.artFinal, item.id),
          of("Arte final com o selo"),
          "file",
          roles.art,
        ),
      );
  }
  return out;
}

const DAY = 86_400_000;
const addDays = (iso: string, days: number) =>
  new Date(new Date(iso).getTime() + days * DAY).toISOString();

/** Prazos de cada passo (Configurações → SLA), em dias corridos. */
export interface LaneSla {
  /** Dias da agência para mandar a arte, desde a faca e a foto em alta. */
  artDays: number;
  /** Dias da Wellmix para validar a arte, desde o envio. */
  reviewDays: number;
  /** Dias do fornecedor para faca, foto em alta, MOQ e prazo, desde o pedido. */
  dieCutDays?: number;
  /** Dias da certificadora para o certificado, desde o pedido. */
  certDays?: number;
  /** Dias de quem faz a arte para a arte final com o selo, desde a liberação. */
  finalDays?: number;
  /** Dias do cadastro e fiscal para validar o NCM e completar a ficha, desde o pedido. */
  registrationDays?: number;
  /** Dias de cada assinatura: a da Wellmix desde o início do contrato; a do fornecedor desde a da Wellmix. */
  signatureDays?: number;
  /** Dias do financeiro para pagar o sinal, desde as duas assinaturas. */
  downPaymentDays?: number;
  /** Dias do fornecedor para fotos, vídeo e declaração, desde o início da produção. */
  inspectionMediaDays?: number;
  /** Dias da Wellmix para aprovar os SKUs, desde a declaração do fornecedor. */
  inspectionReviewDays?: number;
}

/** Dias do passo pela chave, ou nulo quando o passo segue o prazo da etapa. */
function daysOf(key: string, sla: LaneSla): number | null {
  if (
    key === SIGNED_WELLMIX ||
    key === SIGNED_SUPPLIER ||
    key === SAMPLE_ORDER_KEY ||
    key === SAMPLE_ORDER_SUPPLIER_KEY
  )
    return sla.signatureDays ?? null;
  if (key === DOWN_PAYMENT_KEY) return sla.downPaymentDays ?? null;
  if (INSPECTION_MEDIA_KEYS.includes(key) || key === SUPPLIER_CONFORMITY_KEY)
    return sla.inspectionMediaDays ?? null;
  if (key === SKU_APPROVED_KEY) return sla.inspectionReviewDays ?? null;
  if (!itemIdOf(key)) return null;
  switch (baseKeyOf(key)) {
    case LANE_KEYS.art:
      return sla.artDays;
    case LANE_KEYS.artReview:
      return sla.reviewDays;
    case LANE_KEYS.certificate:
      return sla.certDays ?? null;
    case LANE_KEYS.artFinal:
      return sla.finalDays ?? null;
    case LANE_KEYS.ncmValidated:
    case LANE_KEYS.sheetComplete:
      return sla.registrationDays ?? null;
    default:
      return sla.dieCutDays ?? null;
  }
}

/**
 * Quando o passo foi liberado: o último anterior concluído (envio mais
 * recente), ou o pedido (o início do contrato, para a assinatura da Wellmix)
 * quando não há anterior. Nulo enquanto algum anterior falta.
 */
export function unlockedAt(
  key: string,
  orderCreatedAt: string,
  requirements: Array<Pick<Requirement, "key" | "submittedAt" | "status">>,
  stageStartedAt?: string | null,
): string | null {
  if (blockedBy(key, requirements).length) return null;
  // Fotos, vídeo e declaração: o mesmo prazo, do início da produção (R3).
  if (key === SUPPLIER_CONFORMITY_KEY) return stageStartedAt ?? null;
  const present = prerequisitesOf(key)
    .map((k) => requirements.find((r) => r.key === k))
    .filter((r): r is NonNullable<typeof r> => !!r);
  const times = present
    .map((r) => r.submittedAt)
    .filter((t): t is string => !!t)
    .sort();
  if (times.length) return times.at(-1)!;
  if (key === SIGNED_WELLMIX || key === SAMPLE_ORDER_KEY)
    return stageStartedAt ?? null;
  if (INSPECTION_MEDIA_KEYS.includes(key)) return stageStartedAt ?? null;
  return orderCreatedAt;
}

/**
 * Prazo de um requisito do pedido de compra: cada passo conta da liberação
 * (o anterior concluído) mais os dias dele nas Configurações. Nulo quando o
 * passo ainda não foi liberado ou segue o prazo da etapa.
 */
export function laneDueAt(
  key: string,
  orderCreatedAt: string,
  requirements: Array<Pick<Requirement, "key" | "submittedAt" | "status">>,
  sla: LaneSla,
  stageStartedAt?: string | null,
): string | null {
  const days = daysOf(key, sla);
  if (days === null) return null;
  const from = unlockedAt(key, orderCreatedAt, requirements, stageStartedAt);
  return from ? addDays(from, days) : null;
}

/**
 * Arquivos de outras tarefas que esta usa (dono, 14/11/2026): a validação
 * traz a arte enviada; a arte final, a arte validada e o certificado (o
 * selo). Só a chave do rótulo e o documento; quem chama busca o arquivo.
 * Usado no detalhe do pedido e na tela do passo do menu (docs/FLOW_MENU.md).
 */
export function laneInputKeys(
  key: string,
  requirements: readonly Pick<Requirement, "key" | "status" | "documentId">[],
): {
  label: "lane.input.art" | "lane.input.review" | "lane.input.certificate";
  documentId: string;
}[] {
  const item = itemIdOf(key);
  if (!item) return [];
  const base = baseKeyOf(key);
  if (base !== LANE_KEYS.artReview && base !== LANE_KEYS.artFinal) return [];
  const sibling = (source: string) =>
    requirements.find((x) => x.key === laneKey(source, item));
  const fileOf = (source: string) => {
    const src = sibling(source);
    return src?.status === "done" ? (src.documentId ?? null) : null;
  };
  const reviewed = sibling(LANE_KEYS.artReview)?.status === "done";
  const out: ReturnType<typeof laneInputKeys> = [];
  // A validação mostra a arte enviada; a arte final, só a arte validada.
  const art = fileOf(LANE_KEYS.art);
  if (art && (base === LANE_KEYS.artReview || reviewed))
    out.push({
      label: reviewed ? "lane.input.art" : "lane.input.review",
      documentId: art,
    });
  const certificate =
    base === LANE_KEYS.artFinal ? fileOf(LANE_KEYS.certificate) : null;
  if (certificate)
    out.push({ label: "lane.input.certificate", documentId: certificate });
  return out;
}
