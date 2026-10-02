import "server-only";

import {
  getStore,
  type AuditEntry,
  type InspectionComparison,
  type Requirement,
  type ReviewItem,
  type Stage,
} from "@/lib/db";
import { getSettings } from "@/lib/settings";
import {
  compareMeasure,
  INSPECTION_MEASURES,
  inspectionReference,
} from "./inspection";
import { getSnapshotForOrder } from "./snapshots";

/**
 * Relatório da inspeção para a Wellmix: o que o fornecedor mediu, a comparação
 * com o que foi comprado (ficha de compra + snapshot), as fotos, a decisão da
 * revisão e a linha do tempo. Calculado na hora a partir dos itens da etapa,
 * então vale também para pedidos que já passaram da inspeção.
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
  stage: Stage;
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
  "stage.unblock",
  "stage.complete",
]);

export async function inspectionReport(
  orderId: string,
): Promise<InspectionReport | null> {
  const store = getStore();
  const [stage] = await store.list("stages", {
    filter: { orderId, key: "INSPECTION" },
    limit: 1,
  });
  if (!stage || stage.status === "pending") return null;
  const [requirements, snapshot, [sheet], settings, reviews] =
    await Promise.all([
      store.list("requirements", { filter: { stageId: stage.id } }),
      getSnapshotForOrder(orderId),
      store.list("purchase_sheets", { filter: { orderId }, limit: 1 }),
      getSettings(),
      store.list("review_items", {
        filter: { entity: "order", entityId: orderId },
        orderBy: "createdAt",
        direction: "desc",
      }),
    ]);
  const reference = inspectionReference(snapshot, sheet ?? null);
  const tolerances = {
    weight: settings.weightTolerancePercent,
    cbm: settings.cbmTolerancePercent,
    dimension: settings.dimensionTolerancePercent,
    quantity: settings.quantityTolerancePercent,
  };

  const rows: InspectionReportRow[] = [];
  for (const m of INSPECTION_MEASURES) {
    const requirement = requirements.find((r) => r.key === m.key);
    if (!requirement?.value || requirement.status === "pending") continue;
    rows.push({
      requirement,
      attribute: String(m.attribute),
      comparison: reference
        ? compareMeasure(
            m,
            reference[m.attribute],
            requirement.value,
            tolerances,
          )
        : null,
      awaitingRemeasure: requirement.status === "rejected",
    });
  }
  const photos = requirements.filter((r) => r.type === "photo" && r.documentId);
  const review =
    requirements.find((r) => r.key === "inspection_review") ?? null;

  const ids = [stage.id, ...requirements.map((r) => r.id)];
  const [stageAudit, orderAudit] = await Promise.all([
    store.list("audit_log", { filter: { entityId: ids } }),
    store.list("audit_log", { filter: { entity: "order", entityId: orderId } }),
  ]);
  const timeline = [...stageAudit, ...orderAudit]
    .filter(
      (a) =>
        TIMELINE_ACTIONS.has(a.action) &&
        (a.entity !== "stage" || a.entityId === stage.id),
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return {
    stage,
    outcome: outcomeOf(stage, review, rows),
    hasReference: !!reference,
    rows,
    photos,
    review,
    reviews: reviews.filter((r) => r.rule.startsWith("inspection.")),
    timeline,
  };
}

function outcomeOf(
  stage: Stage,
  review: Requirement | null,
  rows: InspectionReportRow[],
): InspectionOutcome {
  if (rows.some((r) => r.awaitingRemeasure) || review?.status === "rejected")
    return "remeasure";
  if (review?.status === "pending" || stage.status === "blocked")
    return "divergent";
  if (review?.status === "done" && review.value === "approved")
    return "accepted";
  if (stage.status === "done") return "approved";
  if (rows.some((r) => r.comparison && !r.comparison.ok)) return "divergent";
  return rows.length > 0 && rows.every((r) => r.comparison?.ok)
    ? "approved"
    : "waiting";
}
