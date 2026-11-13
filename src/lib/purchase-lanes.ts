import type {
  Requirement,
  RequirementTemplate,
  RequirementType,
  Role,
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
 * - Certificadora (OCP, Inmetro): certificado do produto.
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
} as const;

export type Lane = "supplier" | "art" | "certification";

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
  return "supplier";
}

/** O que precisa estar concluído antes (mesmo item): a ordem dentro das raias. */
export function prerequisitesOf(key: string): string[] {
  const item = itemIdOf(key);
  if (!item) return [];
  const base = baseKeyOf(key);
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

/** Requisitos ainda não liberados (falta o anterior da raia). */
export function blockedBy(
  key: string,
  requirements: Array<Pick<Requirement, "key" | "status">>,
): string[] {
  const done = new Set(
    requirements.filter((r) => r.status === "done").map((r) => r.key),
  );
  return prerequisitesOf(key).filter((k) => !done.has(k));
}

export interface LaneItem {
  id: string;
  name: string;
  /** Itens a mais do checklist da linha do produto (a faca e a foto em alta sempre entram). */
  lineRequirements?: RequirementTemplate[] | null;
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

export interface LaneSla {
  /** Dias da agência para mandar a arte, desde o pedido. */
  artDays: number;
  /** Dias da Wellmix para validar a arte, desde o envio. */
  reviewDays: number;
}

/**
 * Prazo de um requisito das raias: a arte conta do pedido; a validação, do
 * envio da arte. Os outros seguem o prazo da etapa (nulo aqui).
 */
export function laneDueAt(
  key: string,
  orderCreatedAt: string,
  requirements: Array<Pick<Requirement, "key" | "submittedAt" | "status">>,
  sla: LaneSla,
): string | null {
  const base = baseKeyOf(key);
  const item = itemIdOf(key);
  if (!item) return null;
  if (base === LANE_KEYS.art) return addDays(orderCreatedAt, sla.artDays);
  if (base === LANE_KEYS.artReview) {
    const art = requirements.find(
      (r) => r.key === laneKey(LANE_KEYS.art, item),
    );
    return art?.status === "done" && art.submittedAt
      ? addDays(art.submittedAt, sla.reviewDays)
      : null;
  }
  return null;
}
