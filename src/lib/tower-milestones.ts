import {
  MILESTONE_KEYS,
  milestoneNumber,
  type MilestoneKey,
} from "@/lib/milestones";

/*
 * Control Tower pelos marcos (fase 4d, docs/MILESTONES.md "Sankhya, regras e
 * painéis"). Puro (sem banco nem tela).
 *
 * - Visões gerais de preparação, inspeção, embarque, desembaraço e
 *   transporte: contadas pelo marco atual do pedido (`milestoneOfFacts`:
 *   `facts.m`, ou a situação sem resumo). Os 16 marcos caem em exatamente uma
 *   delas, então a soma continua igual ao total de pedidos em andamento.
 * - Quadros "Processo por etapa": cada quadro de pedido mostra os marcos que
 *   cobre (a contagem continua a dos quadrados).
 */

export type TowerMilestoneBucket =
  "preparation" | "inspection" | "shipping" | "customs" | "transport";

/** Marcos de cada visão geral, na ordem dos 16 (cobrem os 16, sem repetir). */
export const TOWER_BUCKET_MILESTONES: Record<
  TowerMilestoneBucket,
  readonly MilestoneKey[]
> = {
  preparation: [
    "new-order",
    "certification",
    "art-material",
    "art",
    "contract",
    "down-payment",
  ],
  inspection: ["pre-production", "inspection", "samples", "production"],
  shipping: ["booking", "loading", "shipment"],
  customs: ["customs"],
  transport: ["invoice-transport", "delivery"],
};

export const TOWER_MILESTONE_BUCKETS = Object.keys(
  TOWER_BUCKET_MILESTONES,
) as TowerMilestoneBucket[];

/** Visão geral do marco (nula sem marco). */
export function towerBucketOfMilestone(
  key: MilestoneKey | null | undefined,
): TowerMilestoneBucket | null {
  if (!key) return null;
  for (const bucket of TOWER_MILESTONE_BUCKETS)
    if (TOWER_BUCKET_MILESTONES[bucket].includes(key)) return bucket;
  return null;
}

/** Marcos que cada quadro "Processo por etapa" de pedido cobre. */
export const TOWER_STAGE_MILESTONES: Partial<
  Record<string, readonly MilestoneKey[]>
> = {
  prep: ["new-order", "certification", "art-material", "art"],
  contract: ["contract", "down-payment"],
  production: ["pre-production", "inspection", "samples", "production"],
  shipping: ["booking", "loading", "shipment"],
  port: ["customs"],
  delivery: ["invoice-transport", "delivery"],
};

/** Faixa dos números dos marcos: "1–4" ou "14". */
export function milestoneRange(keys: readonly MilestoneKey[]): string {
  if (!keys.length) return "";
  const numbers = keys.map(milestoneNumber).sort((a, b) => a - b);
  const first = numbers[0];
  const last = numbers[numbers.length - 1];
  return first === last ? String(first) : `${first}–${last}`;
}

/**
 * Pedidos em andamento por marco atual (painel "Pedidos por marco"): uma
 * contagem por marco, na ordem dos 16, e "none" para o que não tem marco.
 */
export function countByMilestone(
  milestones: ReadonlyArray<MilestoneKey | null | undefined>,
): Record<MilestoneKey | "none", number> {
  const out = Object.fromEntries(
    [...MILESTONE_KEYS, "none"].map((k) => [k, 0]),
  ) as Record<MilestoneKey | "none", number>;
  for (const m of milestones) out[m ?? "none"]++;
  return out;
}
