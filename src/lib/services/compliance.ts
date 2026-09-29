import "server-only";

import {
  getStore,
  type Certification,
  type CertificationStatus,
  type Order,
  type Product,
  type User,
} from "@/lib/db";
import { assertWellmix, isWellmix } from "@/lib/auth/permissions";
import { getSettings } from "@/lib/settings";
import { audit } from "./audit";
import { uploadDocument } from "./documents";
import { openReview, resolveReviews } from "./reviews";

/**
 * Certificações e compliance. A linha de produto declara o que é obrigatório
 * (ex.: Inmetro); o produto (ou o fornecedor) guarda a certificação com
 * documento e validade. Sem certificação válida, o pedido entra na fila de
 * revisão e ganha um requisito de conferência que impede o avanço.
 */
export type CertEntity = "product" | "party";

export async function listCertifications(entity: CertEntity, entityId: string) {
  return getStore().list("certifications", {
    filter: { entity, entityId },
    orderBy: "createdAt",
    direction: "desc",
  });
}

/** Situação real hoje: "valid" vencida vira "expired" na leitura (o registro não muda sozinho). */
export function effectiveStatus(
  cert: Certification,
  now = Date.now(),
): CertificationStatus {
  if (
    cert.status === "valid" &&
    cert.validUntil &&
    Date.parse(cert.validUntil) < now
  )
    return "expired";
  return cert.status;
}

export async function addCertification(
  user: User,
  entity: CertEntity,
  entityId: string,
  input: {
    kind: string;
    name?: string | null;
    issuer?: string | null;
    number?: string | null;
    validUntil?: string | null;
    notes?: string | null;
    document?: File | null;
    /** Wellmix pode já registrar como válida; fornecedor registra como pendente. */
    status?: CertificationStatus;
  },
): Promise<Certification> {
  const store = getStore();
  if (!isWellmix(user)) {
    // Fornecedor só registra para o próprio cadastro ou para produtos seus.
    if (entity === "party" && user.partyId !== entityId)
      throw new Error("forbidden");
    if (entity === "product") {
      const product = await store.get("products", entityId);
      if (!product || product.supplierId !== user.partyId)
        throw new Error("forbidden");
    }
  }
  let documentId: string | null = null;
  if (input.document && input.document.size > 0) {
    const doc = await uploadDocument(user, input.document, {
      type: "other",
      visibility: "supplier",
      productId: entity === "product" ? entityId : null,
    });
    documentId = doc.id;
  }
  const status: CertificationStatus = isWellmix(user)
    ? (input.status ?? "valid")
    : "pending";
  const row = await store.create("certifications", {
    entity,
    entityId,
    kind: input.kind.trim(),
    name: input.name ?? null,
    issuer: input.issuer ?? null,
    number: input.number ?? null,
    validUntil: input.validUntil ?? null,
    documentId,
    status,
    notes: input.notes ?? null,
    createdByUserId: user.id,
    validatedByUserId: status === "valid" ? user.id : null,
    validatedAt: status === "valid" ? new Date().toISOString() : null,
  });
  await audit(
    user,
    "certification.add",
    entity,
    entityId,
    `${row.kind} (${status})`,
  );
  if (entity === "product") await refreshComplianceReviews(user, entityId);
  return row;
}

export async function setCertificationStatus(
  user: User,
  id: string,
  status: CertificationStatus,
  note?: string | null,
) {
  assertWellmix(user);
  const store = getStore();
  const cert = await store.get("certifications", id);
  if (!cert) throw new Error("not_found");
  const updated = await store.update("certifications", id, {
    status,
    notes: note ?? cert.notes,
    validatedByUserId: user.id,
    validatedAt: new Date().toISOString(),
  });
  await audit(
    user,
    `certification.${status}`,
    cert.entity,
    cert.entityId,
    cert.kind,
  );
  if (cert.entity === "product")
    await refreshComplianceReviews(user, cert.entityId);
  return updated;
}

export interface ComplianceCheck {
  required: string[];
  valid: string[];
  missing: string[];
  /** Certificações válidas que vencem dentro do prazo de aviso. */
  expiring: Certification[];
}

const norm = (s: string) => s.trim().toLowerCase();

/** Compara o que a linha exige com o que o produto tem de válido (não vencido). */
export async function checkProductCompliance(
  productId: string,
): Promise<ComplianceCheck> {
  const store = getStore();
  const settings = await getSettings();
  const product = await store.get("products", productId);
  const line = product
    ? await store.get("product_lines", product.lineId)
    : null;
  const required = (line?.requiredCertifications ?? [])
    .map((k) => k.trim())
    .filter(Boolean);
  const certs = await listCertifications("product", productId);
  const now = Date.now();
  const validCerts = certs.filter((c) => effectiveStatus(c, now) === "valid");
  const valid = required.filter((k) =>
    validCerts.some((c) => norm(c.kind) === norm(k)),
  );
  const missing = required.filter((k) => !valid.includes(k));
  const horizon = now + settings.certificationExpiryWarningDays * 86400000;
  const expiring = validCerts.filter(
    (c) => c.validUntil && Date.parse(c.validUntil) <= horizon,
  );
  return { required, valid, missing, expiring };
}

/** Reabre ou resolve o item de revisão de conformidade dos pedidos abertos do produto. */
async function refreshComplianceReviews(user: User, productId: string) {
  const store = getStore();
  const check = await checkProductCompliance(productId);
  const items = await store.list("order_items", { filter: { productId } });
  for (const item of items) {
    const order = await store.get("orders", item.orderId);
    if (!order || order.status === "CLOSED") continue;
    if (check.missing.length === 0) {
      await resolveReviews(user, "order", order.id, {
        rulePrefix: "compliance.",
        note: "Certificação válida registrada.",
      });
      const [req] = await store.list("requirements", {
        filter: {
          orderId: order.id,
          key: "compliance_check",
          status: "pending",
        },
      });
      if (req)
        await store.update("requirements", req.id, {
          status: "done",
          value: "auto",
          note: "Certificação válida registrada.",
          submittedByUserId: user.id,
          submittedAt: new Date().toISOString(),
        });
    }
  }
}

/**
 * Gate na criação do pedido: linha exige certificação e o produto não tem
 * certificação válida → item de revisão + requisito de conferência (Wellmix)
 * na etapa ORDER_CREATED. Pedidos antigos e linhas sem exigência: nada muda.
 */
export async function runComplianceGate(
  user: User | null,
  order: Order,
  product: Product | null,
) {
  if (!product) return null;
  const settings = await getSettings();
  if (!settings.complianceGateEnabled) return null;
  const check = await checkProductCompliance(product.id);
  if (check.missing.length === 0) return check;
  const store = getStore();
  await openReview(user, {
    orderId: order.id,
    entity: "order",
    entityId: order.id,
    rule: "compliance.missingCertification",
    problem: `Produto sem certificação válida exigida pela linha: ${check.missing.join(", ")}`,
    expected: check.required.join(", "),
    found: check.valid.length ? check.valid.join(", ") : "nenhuma",
    responsibleRole: "operator",
    action:
      "Registrar a certificação (ou ensaio) na ficha do produto antes de liberar ao fornecedor.",
    link: `/app/products/${product.id}`,
  });
  const [stage] = await store.list("stages", {
    filter: { orderId: order.id, key: "ORDER_CREATED" },
  });
  if (stage) {
    const [existing] = await store.list("requirements", {
      filter: { stageId: stage.id, key: "compliance_check" },
    });
    if (!existing)
      await store.create("requirements", {
        orderId: order.id,
        stageId: stage.id,
        key: "compliance_check",
        label: "Conformidade: certificação obrigatória conferida",
        type: "confirm",
        required: true,
        role: "operator",
        status: "pending",
        value: null,
        documentId: null,
        submittedByUserId: null,
        submittedAt: null,
        note: `Faltam: ${check.missing.join(", ")}`,
      });
  }
  await audit(
    user,
    "compliance.gate",
    "order",
    order.id,
    `Faltam: ${check.missing.join(", ")}`,
  );
  return check;
}

/** Certificações válidas a vencer (para exceções da Control Tower). */
export async function expiringCertifications() {
  const store = getStore();
  const settings = await getSettings();
  const now = Date.now();
  const horizon = now + settings.certificationExpiryWarningDays * 86400000;
  const certs = await store.list("certifications", {
    filter: { status: "valid" },
  });
  return certs.filter(
    (c) => c.validUntil && Date.parse(c.validUntil) <= horizon,
  );
}
