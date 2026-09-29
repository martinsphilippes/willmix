import "server-only";

import {
  getStore,
  type InspectionComparison,
  type InspectionResult,
  type Order,
  type PurchaseSnapshot,
  type Requirement,
  type Stage,
  type User,
} from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { divergencePercent } from "@/lib/logistics/cbm";
import { audit } from "./audit";
import { notifyWellmix } from "./notifications";
import { openReview, resolveReviews } from "./reviews";
import { getSnapshotForOrder } from "./snapshots";

/**
 * Inspeção cega + comparação comprado × inspecionado.
 *
 * O inspetor informa só o que encontrou (peso, medidas, caixa, material, cor);
 * os valores esperados vêm do snapshot da compra e nunca são mostrados a ele.
 * A comparação é determinística: tolerâncias em settings, resultado gravado em
 * inspection_results, cada divergência vira item na fila de revisão e a etapa
 * fica bloqueada até a Wellmix decidir (mesmo requisito `inspection_review`
 * usado pela regra de peso já existente).
 */

/** Requisito da inspeção → atributo do snapshot. */
export const INSPECTION_MEASURES: Array<{
  key: string;
  attribute: keyof PurchaseSnapshot;
  kind: "number" | "text";
  tolerance: "weight" | "cbm" | "dimension" | "quantity" | null;
}> = [
  {
    key: "weight_measured",
    attribute: "netWeightKg",
    kind: "number",
    tolerance: "weight",
  },
  {
    key: "gross_weight_measured",
    attribute: "grossWeightKg",
    kind: "number",
    tolerance: "cbm",
  },
  {
    key: "length_measured",
    attribute: "lengthCm",
    kind: "number",
    tolerance: "dimension",
  },
  {
    key: "width_measured",
    attribute: "widthCm",
    kind: "number",
    tolerance: "dimension",
  },
  {
    key: "height_measured",
    attribute: "heightCm",
    kind: "number",
    tolerance: "dimension",
  },
  {
    key: "master_box_measured",
    attribute: "masterBoxQty",
    kind: "number",
    tolerance: "quantity",
  },
  {
    key: "inner_box_measured",
    attribute: "innerBoxQty",
    kind: "number",
    tolerance: "quantity",
  },
  {
    key: "material_found",
    attribute: "material",
    kind: "text",
    tolerance: null,
  },
  { key: "color_found", attribute: "color", kind: "text", tolerance: null },
];

export const isInspectionMeasureKey = (key: string) =>
  INSPECTION_MEASURES.some((m) => m.key === key);

const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");

export function compareWithSnapshot(
  snapshot: PurchaseSnapshot,
  requirements: Pick<Requirement, "key" | "status" | "value">[],
  tolerances: {
    weight: number;
    cbm: number;
    dimension: number;
    quantity: number;
  },
): InspectionComparison[] {
  const out: InspectionComparison[] = [];
  const valueOf = (key: string) =>
    requirements.find((r) => r.key === key && r.status === "done")?.value ??
    null;
  for (const m of INSPECTION_MEASURES) {
    const raw = valueOf(m.key);
    if (raw === null || raw === "") continue;
    const expected = snapshot[m.attribute] as number | string | null;
    if (expected === null || expected === undefined || expected === "")
      continue;
    if (m.kind === "number") {
      const found = Number(raw);
      if (!Number.isFinite(found)) continue;
      const tol = m.tolerance ? tolerances[m.tolerance] : 0;
      const div = divergencePercent(Number(expected), found);
      out.push({
        attribute: String(m.attribute),
        expected: Number(expected),
        found,
        tolerancePercent: tol,
        ok: div !== null && div <= tol + 1e-9,
      });
    } else {
      out.push({
        attribute: String(m.attribute),
        expected: String(expected),
        found: raw,
        tolerancePercent: null,
        ok: norm(String(expected)) === norm(raw),
      });
    }
  }
  return out;
}

export function summarizeResult(
  comparisons: InspectionComparison[],
): InspectionResult {
  if (comparisons.length === 0) return "REVIEW_REQUIRED";
  return comparisons.every((c) => c.ok) ? "APPROVED" : "DIVERGENT";
}

const ATTRIBUTE_LABEL: Record<string, string> = {
  netWeightKg: "Peso líquido (kg)",
  grossWeightKg: "Peso bruto (kg)",
  lengthCm: "Comprimento (cm)",
  widthCm: "Largura (cm)",
  heightCm: "Altura (cm)",
  masterBoxQty: "Unidades por caixa master",
  innerBoxQty: "Unidades por inner box",
  material: "Material",
  color: "Cor",
  cbm: "CBM",
};

/**
 * Roda após cada submissão de medida na inspeção. Grava o resultado, abre ou
 * resolve itens de revisão e bloqueia/libera a etapa. Sem snapshot, não faz nada
 * (pedidos antigos seguem só com a regra de peso declarado × medido).
 */
export async function compareInspection(
  user: User,
  order: Order,
  stage: Stage,
) {
  const snapshot = await getSnapshotForOrder(order.id);
  if (!snapshot) return null;
  const store = getStore();
  const settings = await getSettings();
  const requirements = await store.list("requirements", {
    filter: { stageId: stage.id },
  });
  const comparisons = compareWithSnapshot(snapshot, requirements, {
    weight: settings.weightTolerancePercent,
    cbm: settings.cbmTolerancePercent,
    dimension: settings.dimensionTolerancePercent,
    quantity: settings.quantityTolerancePercent,
  });
  if (comparisons.length === 0) return null;
  const result = summarizeResult(comparisons);
  const row = await store.create("inspection_results", {
    orderId: order.id,
    stageId: stage.id,
    snapshotId: snapshot.id,
    result,
    comparisons,
    measuredByUserId: user.id,
    comparedAt: new Date().toISOString(),
    note: null,
  });

  const divergent = comparisons.filter((c) => !c.ok);
  const link = `/app/orders/${order.id}`;
  for (const c of comparisons) {
    const rule = `inspection.${c.attribute}`;
    if (c.ok) {
      await resolveReviews(user, "order", order.id, {
        rulePrefix: rule,
        note: "Dentro da tolerância após nova medição.",
      });
    } else {
      await openReview(user, {
        orderId: order.id,
        entity: "order",
        entityId: order.id,
        rule,
        problem: `${ATTRIBUTE_LABEL[c.attribute] ?? c.attribute} divergente do comprado${
          c.tolerancePercent !== null
            ? ` (tolerância ${c.tolerancePercent}%)`
            : ""
        }`,
        expected: c.expected,
        found: c.found,
        responsibleRole: "operator",
        action:
          "Revisar com o fornecedor; aprovar a divergência ou pedir nova medição.",
        link,
      });
    }
  }

  if (divergent.length > 0) {
    const reason = `Divergência comprado × inspecionado: ${divergent
      .map(
        (c) =>
          `${ATTRIBUTE_LABEL[c.attribute] ?? c.attribute} esperado ${c.expected}, encontrado ${c.found}`,
      )
      .join("; ")}. REVISÃO NECESSÁRIA.`;
    await store.update("stages", stage.id, {
      status: "blocked",
      blockReason: reason,
    });
    const [review] = await store.list("requirements", {
      filter: { stageId: stage.id, key: "inspection_review" },
    });
    if (!review) {
      await store.create("requirements", {
        orderId: order.id,
        stageId: stage.id,
        key: "inspection_review",
        label: "Revisão da divergência de peso (Wellmix)",
        type: "approval",
        required: true,
        role: "operator",
        status: "pending",
        value: null,
        documentId: null,
        submittedByUserId: null,
        submittedAt: null,
        note: reason,
      });
    } else if (review.status !== "pending") {
      await store.update("requirements", review.id, {
        status: "pending",
        value: null,
        note: reason,
      });
    }
    await audit(user, "inspection.divergence", "order", order.id, reason);
    await notifyWellmix({
      subject: `Pedido #${order.number}: divergência comprado × inspecionado`,
      body: reason,
      link,
    });
  } else {
    // Tudo dentro da tolerância: se a etapa estava bloqueada só por esta comparação, libera.
    const fresh = await store.get("stages", stage.id);
    const [review] = await store.list("requirements", {
      filter: { stageId: stage.id, key: "inspection_review" },
    });
    const stillOpen = await store.list("review_items", {
      filter: { entity: "order", entityId: order.id, status: "open" },
    });
    if (
      fresh?.status === "blocked" &&
      review?.status === "pending" &&
      stillOpen.filter((r) => r.rule.startsWith("inspection.")).length === 0
    ) {
      await store.update("requirements", review.id, {
        status: "done",
        value: "auto",
        note: "Dentro da tolerância após nova medição.",
      });
      await store.update("stages", stage.id, {
        status: "active",
        blockReason: null,
      });
    }
  }
  return row;
}

export async function latestInspectionResult(orderId: string) {
  const [row] = await getStore().list("inspection_results", {
    filter: { orderId },
    orderBy: "comparedAt",
    direction: "desc",
    limit: 1,
  });
  return row ?? null;
}
