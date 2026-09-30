"use server";

import { z } from "zod";
import { assertRole, assertWellmix, isWellmix } from "@/lib/auth/permissions";
import { getStore, type Role } from "@/lib/db";
import { audit } from "@/lib/services/audit";
import {
  addCertification,
  setCertificationStatus,
} from "@/lib/services/compliance";
import {
  addTaxCandidate,
  rejectTaxClassification,
  suggestNcm,
  suggestTaxCandidates,
  validateTaxClassification,
} from "@/lib/services/taxes";
import { files, num, requireUser, run, str } from "./helpers";

/*
 * Segunda Onda, catálogo: classificação fiscal (NCM) com validação humana,
 * certificações de produto e de fornecedor e certificações obrigatórias por
 * linha. Toda escrita passa por aqui com zod e checagem de papel; os serviços
 * auditam. Erros voltam por ?error=<código> (traduzidos em catalog.error.*).
 */

/** Quem sugere/valida NCM: Wellmix e despachante. */
const TAX_ROLES: Role[] = ["admin", "operator", "broker"];

/**
 * Tela de origem da ação de NCM: a ficha do produto (Wellmix) ou a página só
 * de classificação (Wellmix e despachante). Nunca um caminho arbitrário.
 */
function taxBack(form: FormData, productId: string) {
  const sheet = `/app/products/${productId}`;
  return str(form, "back") === "tax" ? `${sheet}/tax` : sheet;
}

/** "2026-11-05" (input date) → ISO ao meio-dia UTC (o dia não muda em nenhum fuso); vazio → null. */
function dateField(form: FormData, key: string): string | null {
  const v = str(form, key);
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return `${v}T12:00:00.000Z`;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new Error("invalid_date");
  return d.toISOString();
}

/* ------------------------------------------------------------------------ */
/* NCM                                                                       */
/* ------------------------------------------------------------------------ */

/** Gera candidatas heurísticas (palavra-chave). Nunca valida nada sozinho. */
export async function suggestNcmAction(form: FormData) {
  const user = await requireUser();
  const productId = str(form, "productId");
  const back = taxBack(form, productId);
  await run(back, async () => {
    assertRole(user, TAX_ROLES);
    const product = await getStore().get("products", productId);
    if (!product) throw new Error("product_not_found");
    const created = await suggestTaxCandidates(user, productId);
    // Nenhuma palavra reconhecida e a IA (se configurada) não trouxe nada.
    if (created.length === 0 && suggestNcm(product).length === 0)
      throw new Error("no_suggestions");
    return `${back}#tax`;
  });
}

const rate = z.number().finite().min(0).max(100).nullable();
const candidateSchema = z.object({
  ncm: z.string().min(4).max(10),
  description: z.string().max(2000).nullable(),
  II: rate,
  IPI: rate,
  PIS: rate,
  COFINS: rate,
  ICMS: rate,
  adminTreatment: z.string().max(2000).nullable(),
  notes: z.string().max(5000).nullable(),
  sourceRef: z.string().max(255).nullable(),
});

/** Candidata manual (Wellmix) ou do despachante (broker); entra como "sugerida". */
export async function addTaxCandidateAction(form: FormData) {
  const user = await requireUser();
  const productId = str(form, "productId");
  const back = taxBack(form, productId);
  await run(back, async () => {
    assertRole(user, TAX_ROLES);
    const parsed = candidateSchema.parse({
      ncm: str(form, "ncm"),
      description: str(form, "description") || null,
      II: num(form, "II"),
      IPI: num(form, "IPI"),
      PIS: num(form, "PIS"),
      COFINS: num(form, "COFINS"),
      ICMS: num(form, "ICMS"),
      adminTreatment: str(form, "adminTreatment") || null,
      notes: str(form, "notes") || null,
      sourceRef: str(form, "sourceRef") || null,
    });
    const taxes: Record<string, number> = {};
    for (const key of ["II", "IPI", "PIS", "COFINS", "ICMS"] as const) {
      const value = parsed[key];
      if (value !== null) taxes[key] = value;
    }
    await addTaxCandidate(user, productId, {
      ncm: parsed.ncm,
      description: parsed.description,
      taxes: Object.keys(taxes).length ? taxes : null,
      adminTreatment: parsed.adminTreatment,
      notes: parsed.notes,
      source: user.role === "broker" ? "broker" : "manual",
      sourceRef: parsed.sourceRef,
    });
    return `${back}#tax`;
  });
}

export async function validateTaxAction(form: FormData) {
  const user = await requireUser();
  const productId = str(form, "productId");
  const back = taxBack(form, productId);
  await run(back, async () => {
    assertRole(user, TAX_ROLES);
    const id = z.string().min(1).parse(str(form, "id"));
    const row = await getStore().get("tax_classifications", id);
    if (!row || row.productId !== productId) throw new Error("not_found");
    await validateTaxClassification(user, id);
    return `${back}#tax`;
  });
}

export async function rejectTaxAction(form: FormData) {
  const user = await requireUser();
  const productId = str(form, "productId");
  const back = taxBack(form, productId);
  await run(back, async () => {
    assertRole(user, TAX_ROLES);
    const parsed = z
      .object({ id: z.string().min(1), note: z.string().max(2000).nullable() })
      .parse({ id: str(form, "id"), note: str(form, "note") || null });
    const row = await getStore().get("tax_classifications", parsed.id);
    if (!row || row.productId !== productId) throw new Error("not_found");
    await rejectTaxClassification(user, parsed.id, parsed.note);
    return `${back}#tax`;
  });
}

/* ------------------------------------------------------------------------ */
/* Certificações                                                             */
/* ------------------------------------------------------------------------ */

/**
 * Tela de origem: ficha do produto, tela do parceiro (Wellmix) ou a conta
 * corrente do fornecedor (back=account). Nunca um caminho arbitrário.
 */
function certBack(
  form: FormData,
  entity: "product" | "party",
  entityId: string,
) {
  if (str(form, "back") === "account") return "/app/account";
  return entity === "party"
    ? `/app/parties/${entityId}`
    : `/app/products/${entityId}`;
}

const certificationSchema = z.object({
  kind: z.string().min(1).max(60),
  name: z.string().max(160).nullable(),
  issuer: z.string().max(160).nullable(),
  number: z.string().max(80).nullable(),
  validUntil: z.string().nullable(),
  notes: z.string().max(5000).nullable(),
  status: z.enum(["valid", "pending"]),
});

/**
 * Registra certificação de produto ou de fornecedor. Wellmix escolhe a situação
 * inicial (válida ou pendente); o fornecedor só registra as suas e entram
 * pendentes (regra no serviço).
 */
export async function addCertificationAction(form: FormData) {
  const user = await requireUser();
  const entity = str(form, "entity") === "party" ? "party" : "product";
  const entityId = str(form, "entityId");
  const back = certBack(form, entity, entityId);
  await run(back, async () => {
    assertRole(user, ["admin", "operator", "supplier"]);
    if (!str(form, "kind")) throw new Error("kind_required");
    const parsed = certificationSchema.parse({
      kind: str(form, "kind"),
      name: str(form, "name") || null,
      issuer: str(form, "issuer") || null,
      number: str(form, "number") || null,
      validUntil: dateField(form, "validUntil"),
      notes: str(form, "notes") || null,
      status: isWellmix(user) ? str(form, "status") || "valid" : "pending",
    });
    const store = getStore();
    const target =
      entity === "party"
        ? await store.get("parties", entityId)
        : await store.get("products", entityId);
    if (!target) throw new Error("not_found");
    const [document] = files(form, "document");
    await addCertification(user, entity, entityId, {
      ...parsed,
      document: document ?? null,
    });
    return `${back}#certifications`;
  });
}

const statusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["valid", "expired", "rejected"]),
  note: z.string().max(2000).nullable(),
});

/** Validar, marcar vencida ou rejeitar (só Wellmix). */
export async function setCertificationStatusAction(form: FormData) {
  const user = await requireUser();
  const entity = str(form, "entity") === "party" ? "party" : "product";
  const entityId = str(form, "entityId");
  const back = certBack(form, entity, entityId);
  await run(back, async () => {
    assertWellmix(user);
    const parsed = statusSchema.parse({
      id: str(form, "id"),
      status: str(form, "status"),
      note: str(form, "note") || null,
    });
    const cert = await getStore().get("certifications", parsed.id);
    if (!cert || cert.entity !== entity || cert.entityId !== entityId)
      throw new Error("not_found");
    await setCertificationStatus(user, parsed.id, parsed.status, parsed.note);
    return `${back}#certifications`;
  });
}

/* ------------------------------------------------------------------------ */
/* Linhas: certificações obrigatórias                                        */
/* ------------------------------------------------------------------------ */

/** Lista separada por vírgula → product_lines.requiredCertifications (null quando vazia). */
export async function setLineCertificationsAction(form: FormData) {
  const user = await requireUser();
  const lineId = str(form, "lineId");
  await run("/app/lines", async () => {
    assertWellmix(user);
    const store = getStore();
    const line = await store.get("product_lines", lineId);
    if (!line) throw new Error("line_not_found");
    const text = z.string().max(500).parse(str(form, "certifications"));
    const seen = new Set<string>();
    const list = text
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter((s) => {
        const key = s.toLowerCase();
        if (!s || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    await store.update("product_lines", lineId, {
      requiredCertifications: list.length ? list : null,
    });
    await audit(
      user,
      "line.certifications",
      "product_line",
      lineId,
      `${line.name}: ${list.join(", ") || "nenhuma"}`,
      { requiredCertifications: line.requiredCertifications },
      { requiredCertifications: list },
    );
    return `/app/lines?saved=${lineId}`;
  });
}
