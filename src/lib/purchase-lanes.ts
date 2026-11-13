import type {
  Requirement,
  RequirementTemplate,
  RequirementType,
  Role,
} from "@/lib/db/schema";

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
 * Itens que o sistema confere sozinho (ninguém marca à mão): o NCM validado
 * na tela fiscal, a ficha mestre completa e o sinal pago (ou a conta corrente).
 */
export const AUTO_GATE_KEYS: readonly string[] = [
  LANE_KEYS.ncmValidated,
  LANE_KEYS.sheetComplete,
  DOWN_PAYMENT_KEY,
];

export const isAutoGateKey = (key: string) =>
  AUTO_GATE_KEYS.includes(baseKeyOf(key));

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

/** O que precisa estar concluído antes (mesmo item): a ordem dentro das raias. */
export function prerequisitesOf(key: string): string[] {
  // Contrato: o fornecedor assina depois da Wellmix; o sinal (ou a conta
  // corrente) vem com as duas assinaturas.
  if (key === SIGNED_SUPPLIER) return [SIGNED_WELLMIX];
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
    const of = (label: string) => `${label} · ${item.name}`;
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
}

/** Dias do passo pela chave, ou nulo quando o passo segue o prazo da etapa. */
function daysOf(key: string, sla: LaneSla): number | null {
  if (key === SIGNED_WELLMIX || key === SIGNED_SUPPLIER)
    return sla.signatureDays ?? null;
  if (key === DOWN_PAYMENT_KEY) return sla.downPaymentDays ?? null;
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
  const present = prerequisitesOf(key)
    .map((k) => requirements.find((r) => r.key === k))
    .filter((r): r is NonNullable<typeof r> => !!r);
  const times = present
    .map((r) => r.submittedAt)
    .filter((t): t is string => !!t)
    .sort();
  if (times.length) return times.at(-1)!;
  if (key === SIGNED_WELLMIX) return stageStartedAt ?? null;
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
