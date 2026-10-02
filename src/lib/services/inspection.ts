import "server-only";

import {
  getStore,
  type InspectionComparison,
  type InspectionResult,
  type Order,
  type PurchaseSheet,
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
    key: "master_box_cbm_measured",
    attribute: "cbm",
    kind: "number",
    tolerance: "cbm",
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

/**
 * Referência da inspeção: o que foi comprado. A ficha de compra da Preparação
 * (planilha COMPRAS) vale primeiro para peso, caixa, CBM e material; o snapshot
 * do cadastro completa o resto (medidas da peça, cor).
 */
export type InspectionReference = Partial<
  Record<keyof PurchaseSnapshot, number | string | null>
>;

export function inspectionReference(
  snapshot: PurchaseSnapshot | null,
  sheet: PurchaseSheet | null,
): InspectionReference | null {
  if (!snapshot && !sheet) return null;
  const pick = <T>(a: T | null | undefined, b: T | null | undefined) =>
    a !== null && a !== undefined && a !== "" ? a : (b ?? null);
  return {
    ...(snapshot ?? {}),
    netWeightKg: pick(sheet?.netWeightPcKg, snapshot?.netWeightKg),
    grossWeightKg: pick(sheet?.grossWeightPcKg, snapshot?.grossWeightKg),
    masterBoxQty: pick(sheet?.masterCartonQty, snapshot?.masterBoxQty),
    innerBoxQty: pick(sheet?.innerQty, snapshot?.innerBoxQty),
    cbm: pick(sheet?.cbmPerCarton, snapshot?.cbm),
    material: pick(sheet?.material, snapshot?.material),
  } as InspectionReference;
}

export interface InspectionTolerances {
  weight: number;
  cbm: number;
  dimension: number;
  quantity: number;
}

/** Compara uma medida com a referência; null quando não há valor ou referência. */
export function compareMeasure(
  m: (typeof INSPECTION_MEASURES)[number],
  expected: number | string | null | undefined,
  raw: string | null | undefined,
  tolerances: InspectionTolerances,
): InspectionComparison | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (expected === null || expected === undefined || expected === "")
    return null;
  if (m.kind === "number") {
    const found = Number(raw);
    if (!Number.isFinite(found)) return null;
    const tol = m.tolerance ? tolerances[m.tolerance] : 0;
    const div = divergencePercent(Number(expected), found);
    return {
      attribute: String(m.attribute),
      expected: Number(expected),
      found,
      tolerancePercent: tol,
      ok: div !== null && div <= tol + 1e-9,
    };
  }
  return {
    attribute: String(m.attribute),
    expected: String(expected),
    found: raw,
    tolerancePercent: null,
    ok: norm(String(expected)) === norm(raw),
  };
}

export function compareWithSnapshot(
  snapshot: InspectionReference,
  requirements: Pick<Requirement, "key" | "status" | "value">[],
  tolerances: InspectionTolerances,
): InspectionComparison[] {
  const out: InspectionComparison[] = [];
  const valueOf = (key: string) =>
    requirements.find((r) => r.key === key && r.status === "done")?.value ??
    null;
  for (const m of INSPECTION_MEASURES) {
    const c = compareMeasure(
      m,
      snapshot[m.attribute],
      valueOf(m.key),
      tolerances,
    );
    if (c) out.push(c);
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
  const store = getStore();
  const [snapshot, [sheet], settings] = await Promise.all([
    getSnapshotForOrder(order.id),
    store.list("purchase_sheets", { filter: { orderId: order.id }, limit: 1 }),
    getSettings(),
  ]);
  const reference = inspectionReference(snapshot, sheet ?? null);
  if (!reference) return null;
  const requirements = await store.list("requirements", {
    filter: { stageId: stage.id },
  });
  const comparisons = compareWithSnapshot(reference, requirements, {
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
    snapshotId: snapshot?.id ?? null,
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
        label: "Revisão da divergência na inspeção (Wellmix)",
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
    // Também fecha a revisão reprovada (nova medição pedida) quando a medição
    // refeita fica dentro da tolerância.
    if (
      review &&
      ((fresh?.status === "blocked" && review.status === "pending") ||
        review.status === "rejected") &&
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
