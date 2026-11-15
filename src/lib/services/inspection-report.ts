import "server-only";

import {
  getStore,
  type AuditEntry,
  type InspectionComparison,
  type OrderMilestone,
  type Requirement,
  type ReviewItem,
} from "@/lib/db";
import { storedMilestone } from "./order-milestones";
import { getSettings } from "@/lib/settings";
import {
  compareReferenceMeasure,
  INSPECTION_MEASURES,
  inspectionReference,
} from "./inspection";
import { getSnapshotForOrder } from "./snapshots";

/**
 * Relatório da inspeção para a Wellmix: o que o fornecedor mediu, a comparação
 * com o que foi comprado (ficha de compra + snapshot), as fotos, a decisão da
 * revisão e a linha do tempo. Calculado na hora a partir dos itens do marco
 * Inspeção (fase 5e: pelo marco gravado no item e pela linha do marco, não
 * mais pela etapa), então vale também para pedidos que já passaram dela.
 */

export type InspectionOutcome =
  "waiting" | "approved" | "accepted" | "divergent" | "remeasure";

export interface InspectionReportRow {
  requirement: Requirement;
  attribute: string;
  comparison: InspectionComparison | null;
  /** Reenvio pedido: o valor mostrado é o anterior. */
  awaitingRemeasure: boolean;
}

export interface InspectionReport {
  /** A linha do marco Inspeção (começou, travou ou concluiu). */
  milestone: Pick<OrderMilestone, "id" | "status" | "blockReason">;
  outcome: InspectionOutcome;
  hasReference: boolean;
  rows: InspectionReportRow[];
  photos: Requirement[];
  review: Requirement | null;
  reviews: ReviewItem[];
  timeline: AuditEntry[];
}

const TIMELINE_ACTIONS = new Set([
  "requirement.submit",
  "requirement.approve",
  "requirement.reject",
  "inspection.divergence",
  "inspection.remeasure_requested",
  // Pedidos de antes da fase 5e (histórico).
  "stage.unblock",
  "stage.complete",
  "milestone.unblock",
]);

export async function inspectionReport(
  orderId: string,
): Promise<InspectionReport | null> {
  const store = getStore();
  const [milestone] = await store
    .list("order_milestones", {
      filter: { orderId, key: "inspection" },
      limit: 1,
    })
    .catch(() => []);
  // Só depois que a Inspeção começou (a linha do marco nasce com ela).
  if (!milestone) return null;
  const [all, snapshot, [sheet], settings, reviews] = await Promise.all([
    store.list("requirements", { filter: { orderId } }),
    getSnapshotForOrder(orderId),
    store.list("purchase_sheets", { filter: { orderId }, limit: 1 }),
    getSettings(),
    store.list("review_items", {
      filter: { entity: "order", entityId: orderId },
      orderBy: "createdAt",
      direction: "desc",
    }),
  ]);
  // Itens do marco Inspeção pelo marco gravado; item sem marco (antes da
  // migração), só as medidas, as fotos e a revisão da inspeção.
  const legacy = new Set<string>([
    ...INSPECTION_MEASURES.map((m) => m.key),
    "inspection_review",
    "photo_unpacked",
    "photo_packed",
    "photo_scale",
  ]);
  const requirements = all.filter((r) =>
    r.milestoneKey
      ? storedMilestone(r.milestoneKey) === "inspection"
      : legacy.has(r.key),
  );
  const reference = inspectionReference(snapshot, sheet ?? null);
  const tolerances = {
    weight: settings.weightTolerancePercent,
    cbm: settings.cbmTolerancePercent,
    dimension: settings.dimensionTolerancePercent,
    quantity: settings.quantityTolerancePercent,
  };

  const rows: InspectionReportRow[] = [];
  const measured = (key: string) => {
    const r = requirements.find((x) => x.key === key);
    return r?.value && r.status !== "pending" ? r.value : null;
  };
  for (const m of INSPECTION_MEASURES) {
    const requirement = requirements.find((r) => r.key === m.key);
    if (!requirement?.value || requirement.status === "pending") continue;
    rows.push({
      requirement,
      attribute: String(m.attribute),
      // Mesma conta do portão da inspeção (inner igual à master = sem inner).
      comparison: reference
        ? compareReferenceMeasure(
            m,
            reference,
            requirement.value,
            tolerances,
            measured("master_box_measured"),
          )
        : null,
      awaitingRemeasure: requirement.status === "rejected",
    });
  }
  const photos = requirements.filter((r) => r.type === "photo" && r.documentId);
  const review =
    requirements.find((r) => r.key === "inspection_review") ?? null;

  const ids = requirements.map((r) => r.id);
  const [stageAudit, orderAudit] = await Promise.all([
    store.list("audit_log", { filter: { entityId: ids } }),
    store.list("audit_log", { filter: { entity: "order", entityId: orderId } }),
  ]);
  const timeline = [...stageAudit, ...orderAudit]
    .filter((a) => TIMELINE_ACTIONS.has(a.action))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return {
    milestone,
    outcome: outcomeOf(milestone, review, rows),
    hasReference: !!reference,
    rows,
    photos,
    review,
    reviews: reviews.filter((r) => r.rule.startsWith("inspection.")),
    timeline,
  };
}

function outcomeOf(
  milestone: Pick<OrderMilestone, "status">,
  review: Requirement | null,
  rows: InspectionReportRow[],
): InspectionOutcome {
  if (rows.some((r) => r.awaitingRemeasure) || review?.status === "rejected")
    return "remeasure";
  if (review?.status === "pending" || milestone.status === "blocked")
    return "divergent";
  if (review?.status === "done" && review.value === "approved")
    return "accepted";
  if (milestone.status === "done") return "approved";
  if (rows.some((r) => r.comparison && !r.comparison.ok)) return "divergent";
  return rows.length > 0 && rows.every((r) => r.comparison?.ok)
    ? "approved"
    : "waiting";
}
