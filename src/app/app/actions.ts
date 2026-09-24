"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import {
  assertRole,
  assertWellmix,
  canViewOrder,
  isAdmin,
  isWellmix,
} from "@/lib/auth/permissions";
import {
  getStore,
  PARTY_TYPES,
  ROLES,
  LOCALES,
  type DocumentType,
  type User,
} from "@/lib/db";
import { isLocale } from "@/i18n";
import { LOCALE_COOKIE } from "@/i18n/server";
import {
  answerQuote,
  confirmDownPayment,
  createRequest,
  openRfq,
  selectQuote,
} from "@/lib/services/requests";
import { uploadDocument } from "@/lib/services/documents";
import {
  decideRequirement,
  submitRequirement,
  unblockStage,
} from "@/lib/workflow/engine";
import { audit } from "@/lib/services/audit";
import { notify } from "@/lib/services/notifications";
import { DEFAULT_SETTINGS, setSetting, type SettingKey } from "@/lib/settings";
import { hashPassword } from "@/lib/auth/password";
import { importCsv } from "@/lib/services/import";

/* ------------------------------------------------------------------------ */
/* Helpers                                                                   */
/* ------------------------------------------------------------------------ */

async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

function str(form: FormData, key: string) {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
}
function num(form: FormData, key: string) {
  const v = str(form, key).replace(",", ".");
  return v === "" ? null : Number(v);
}

/** Executa a ação e volta para `back` com ?error=<código> em caso de falha. */
async function run(back: string, fn: () => Promise<string | void>) {
  let target = back;
  try {
    const result = await fn();
    if (result) target = result;
  } catch (error) {
    const code =
      error instanceof Error && error.message ? error.message : "error";
    const url = new URL(back, "http://x");
    url.searchParams.set("error", code.slice(0, 60));
    target = url.pathname + url.search;
  }
  revalidatePath("/app", "layout");
  redirect(target);
}

/* ------------------------------------------------------------------------ */
/* Idioma                                                                    */
/* ------------------------------------------------------------------------ */

export async function setLocaleAction(form: FormData) {
  const locale = str(form, "locale");
  if (isLocale(locale)) {
    const jar = await cookies();
    jar.set(LOCALE_COOKIE, locale, {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
    const user = await getCurrentUser();
    if (user) await getStore().update("users", user.id, { locale });
  }
  revalidatePath("/app", "layout");
}

/* ------------------------------------------------------------------------ */
/* Solicitações                                                              */
/* ------------------------------------------------------------------------ */

const requestSchema = z.object({
  customerId: z.string().min(1),
  productId: z.string().optional().nullable(),
  productName: z.string().min(2),
  description: z.string().min(2),
  specification: z.string().optional().nullable(),
  quantity: z.number().positive(),
  unit: z.string().min(1),
  deadline: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function createRequestAction(form: FormData) {
  const user = await requireUser();
  await run("/app/requests/new", async () => {
    const productId = str(form, "productId") || null;
    let productName = str(form, "productName");
    if (productId && !productName) {
      const product = await getStore().get("products", productId);
      productName = product?.name ?? "";
    }
    const parsed = requestSchema.parse({
      customerId:
        user.role === "customer" ? user.partyId : str(form, "customerId"),
      productId,
      productName,
      description: str(form, "description"),
      specification: str(form, "specification") || null,
      quantity: num(form, "quantity"),
      unit: str(form, "unit") || "un",
      deadline: str(form, "deadline") || null,
      notes: str(form, "notes") || null,
    });
    const request = await createRequest(user, parsed);
    const files = form
      .getAll("attachments")
      .filter((f): f is File => f instanceof File && f.size > 0);
    for (const file of files) {
      await uploadDocument(user, file, {
        requestId: request.id,
        type: "attachment",
        visibility: "internal",
      });
    }
    return `/app/requests/${request.id}`;
  });
}

export async function openRfqAction(form: FormData) {
  const user = await requireUser();
  const requestId = str(form, "requestId");
  await run(`/app/requests/${requestId}`, async () => {
    const supplierIds = form.getAll("supplierIds").map(String).filter(Boolean);
    await openRfq(user, requestId, supplierIds);
  });
}

export async function answerQuoteAction(form: FormData) {
  const user = await requireUser();
  const quoteId = str(form, "quoteId");
  const back = str(form, "back") || `/app/quotes/${quoteId}`;
  await run(back, async () => {
    const parsed = z
      .object({
        price: z.number().positive(),
        currency: z.string().length(3),
        leadTimeDays: z.number().int().positive(),
        conditions: z.string().optional().nullable(),
      })
      .parse({
        price: num(form, "price"),
        currency: str(form, "currency").toUpperCase(),
        leadTimeDays: num(form, "leadTimeDays"),
        conditions: str(form, "conditions") || null,
      });
    await answerQuote(user, quoteId, parsed);
  });
}

export async function selectQuoteAction(form: FormData) {
  const user = await requireUser();
  const requestId = str(form, "requestId");
  await run(`/app/requests/${requestId}`, async () => {
    const parsed = z
      .object({
        quoteId: z.string().min(1),
        sellPrice: z.number().positive(),
        sellCurrency: z.string().length(3),
        downPaymentAmount: z.number().nonnegative().optional().nullable(),
      })
      .parse({
        quoteId: str(form, "quoteId"),
        sellPrice: num(form, "sellPrice"),
        sellCurrency: (str(form, "sellCurrency") || "BRL").toUpperCase(),
        downPaymentAmount: num(form, "downPaymentAmount"),
      });
    await selectQuote(user, parsed.quoteId, parsed);
  });
}

export async function confirmDownPaymentAction(form: FormData) {
  const user = await requireUser();
  const requestId = str(form, "requestId");
  await run(`/app/requests/${requestId}`, async () => {
    const proof = form.get("proof");
    let proofId: string | null = null;
    if (proof instanceof File && proof.size > 0) {
      const doc = await uploadDocument(user, proof, {
        requestId,
        type: "proof",
        visibility: "internal",
      });
      proofId = doc.id;
    }
    const order = await confirmDownPayment(user, requestId, proofId);
    return `/app/orders/${order.id}`;
  });
}

/* ------------------------------------------------------------------------ */
/* Pedidos: requisitos, aprovações, parceiros, pagamentos                    */
/* ------------------------------------------------------------------------ */

export async function submitRequirementAction(form: FormData) {
  const user = await requireUser();
  const orderId = str(form, "orderId");
  const requirementId = str(form, "requirementId");
  await run(`/app/orders/${orderId}`, async () => {
    const store = getStore();
    const requirement = await store.get("requirements", requirementId);
    if (!requirement || requirement.orderId !== orderId)
      throw new Error("not_found");
    let documentId: string | null = null;
    const file = form.get("file");
    if (file instanceof File && file.size > 0) {
      const type: DocumentType =
        requirement.type === "photo"
          ? "photo"
          : (docTypeForKey(requirement.key) ?? "other");
      const doc = await uploadDocument(user, file, {
        orderId,
        requirementId,
        type,
      });
      documentId = doc.id;
    }
    const value =
      requirement.type === "confirm" ? "confirmed" : str(form, "value") || null;
    await submitRequirement(user, requirementId, {
      value,
      documentId,
      note: str(form, "note") || null,
    });
    return `/app/orders/${orderId}#stage-${requirement.stageId}`;
  });
}

function docTypeForKey(key: string): DocumentType | null {
  const map: Record<string, DocumentType> = {
    dieline: "dieline",
    label: "label",
    art: "art",
    bl: "bl",
    customs_docs: "customs",
    manual: "manual",
  };
  return map[key] ?? null;
}

export async function decideRequirementAction(form: FormData) {
  const user = await requireUser();
  const orderId = str(form, "orderId");
  await run(`/app/orders/${orderId}`, async () => {
    const decision = str(form, "decision") === "approve" ? "approve" : "reject";
    await decideRequirement(
      user,
      str(form, "requirementId"),
      decision,
      str(form, "note") || null,
    );
  });
}

export async function unblockStageAction(form: FormData) {
  const user = await requireUser();
  const orderId = str(form, "orderId");
  await run(`/app/orders/${orderId}`, async () => {
    await unblockStage(user, str(form, "stageId"));
  });
}

export async function assignPartnerAction(form: FormData) {
  const user = await requireUser();
  const orderId = str(form, "orderId");
  await run(`/app/orders/${orderId}`, async () => {
    assertWellmix(user);
    const field = str(form, "field");
    const allowed = [
      "agencyId",
      "brokerId",
      "shippingLineId",
      "carrierId",
    ] as const;
    if (!(allowed as readonly string[]).includes(field))
      throw new Error("invalid_field");
    const partyId = str(form, "partyId") || null;
    const store = getStore();
    const order = await store.get("orders", orderId);
    if (!order) throw new Error("not_found");
    await store.update("orders", orderId, { [field]: partyId });
    // Etapas ainda não iniciadas passam a apontar para o novo parceiro.
    const stages = await store.list("stages", { filter: { orderId } });
    const roleByField: Record<string, string> = {
      agencyId: "agency",
      brokerId: "broker",
      shippingLineId: "shipping_line",
      carrierId: "carrier",
    };
    for (const stage of stages) {
      const reqs = await store.list("requirements", {
        filter: { stageId: stage.id },
      });
      for (const req of reqs) {
        if (req.status !== "pending") continue;
        // Requisitos que o operador assumiu por falta de parceiro voltam ao papel do parceiro.
        const stageRole = roleByField[field];
        const belongs =
          (field === "brokerId" && stage.key === "CUSTOMS") ||
          (field === "shippingLineId" && stage.key === "SHIPPING") ||
          (field === "carrierId" && stage.key === "TRANSPORT");
        if (belongs && req.key !== "inspection_review") {
          await store.update("requirements", req.id, {
            role: (partyId ? stageRole : "operator") as never,
          });
        }
      }
      if (
        (field === "brokerId" && stage.key === "CUSTOMS") ||
        (field === "shippingLineId" && stage.key === "SHIPPING") ||
        (field === "carrierId" && stage.key === "TRANSPORT")
      ) {
        await store.update("stages", stage.id, { responsiblePartyId: partyId });
      }
    }
    if (field === "agencyId" && partyId) {
      const [pack] = stages.filter((s) => s.key === "PACKAGING");
      if (pack) {
        const reqs = await store.list("requirements", {
          filter: { stageId: pack.id, key: "art_approval" },
        });
        if (reqs.length === 0) {
          await store.create("requirements", {
            orderId,
            stageId: pack.id,
            key: "art_approval",
            label: "Aprovação da arte pela agência",
            type: "approval",
            required: true,
            role: "agency",
            status: "pending",
            value: null,
            documentId: null,
            submittedByUserId: null,
            submittedAt: null,
            note: null,
          });
        }
      }
    }
    await audit(
      user,
      "order.assign",
      "order",
      orderId,
      `${field} = ${partyId ?? "—"}`,
    );
  });
}

export async function registerSupplierPaymentAction(form: FormData) {
  const user = await requireUser();
  const orderId = str(form, "orderId");
  await run(`/app/orders/${orderId}`, async () => {
    assertWellmix(user);
    const store = getStore();
    const order = await store.get("orders", orderId);
    if (!order) throw new Error("not_found");
    const parsed = z
      .object({
        amount: z.number().positive(),
        currency: z.string().length(3),
        fxRate: z.number().positive().nullable(),
        note: z.string().nullable(),
      })
      .parse({
        amount: num(form, "amount"),
        currency: (
          str(form, "currency") ||
          order.fobCurrency ||
          "USD"
        ).toUpperCase(),
        fxRate: num(form, "fxRate"),
        note: str(form, "note") || null,
      });
    let proofDocumentId: string | null = null;
    const proof = form.get("proof");
    if (proof instanceof File && proof.size > 0) {
      const doc = await uploadDocument(user, proof, {
        orderId,
        type: "proof",
        visibility: "supplier",
      });
      proofDocumentId = doc.id;
    }
    const payment = await store.create("payments", {
      orderId,
      requestId: null,
      direction: "supplier_out",
      amount: parsed.amount,
      currency: parsed.currency,
      fxRate: parsed.fxRate,
      method: "manual",
      status: "confirmed",
      proofDocumentId,
      registeredByUserId: user.id,
      confirmedByUserId: null,
      confirmedAt: null,
      note: parsed.note,
    });
    await audit(
      user,
      "payment.register",
      "payment",
      payment.id,
      `${parsed.currency} ${parsed.amount}`,
    );
    // Marca o requisito "pagamento registrado" da etapa, se estiver ativa.
    const [stage] = await store.list("stages", {
      filter: { orderId, key: "SUPPLIER_PAYMENT" },
    });
    if (stage && stage.status === "active") {
      const [req] = await store.list("requirements", {
        filter: {
          stageId: stage.id,
          key: "payment_registered",
          status: "pending",
        },
      });
      if (req) await submitRequirement(user, req.id, { value: payment.id });
    }
    await notify(
      { role: "supplier", partyId: order.supplierId },
      {
        subject: `Order #${order.number}: payment registered`,
        body: `${parsed.currency} ${parsed.amount.toFixed(2)}. Please confirm receipt.`,
        link: `/app/orders/${orderId}`,
      },
    );
  });
}

export async function confirmSupplierPaymentAction(form: FormData) {
  const user = await requireUser();
  const paymentId = str(form, "paymentId");
  const back = str(form, "back") || "/app/account";
  await run(back, async () => {
    const store = getStore();
    const payment = await store.get("payments", paymentId);
    if (!payment || payment.direction !== "supplier_out" || !payment.orderId)
      throw new Error("not_found");
    const order = await store.get("orders", payment.orderId);
    if (!order) throw new Error("not_found");
    if (!(
      isWellmix(user) ||
      (user.role === "supplier" && order.supplierId === user.partyId)
    ))
      throw new Error("forbidden");
    await store.update("payments", paymentId, {
      status: "received",
      confirmedByUserId: user.id,
      confirmedAt: new Date().toISOString(),
    });
    await audit(
      user,
      "payment.received",
      "payment",
      paymentId,
      "Recebimento confirmado pelo fornecedor",
    );
    const [stage] = await store.list("stages", {
      filter: { orderId: order.id, key: "SUPPLIER_PAYMENT" },
    });
    if (stage && stage.status === "active") {
      const [req] = await store.list("requirements", {
        filter: {
          stageId: stage.id,
          key: "payment_received",
          status: "pending",
        },
      });
      if (req) await submitRequirement(user, req.id, { value: paymentId });
    }
  });
}

export async function createPenaltyAction(form: FormData) {
  const user = await requireUser();
  const orderId = str(form, "orderId");
  await run(`/app/orders/${orderId}`, async () => {
    assertWellmix(user);
    const parsed = z
      .object({
        reason: z.string().min(2),
        amount: z.number().nonnegative(),
        currency: z.string().length(3),
        responsiblePartyId: z.string().nullable(),
      })
      .parse({
        reason: str(form, "reason"),
        amount: num(form, "amount"),
        currency: (str(form, "currency") || "BRL").toUpperCase(),
        responsiblePartyId: str(form, "responsiblePartyId") || null,
      });
    let evidenceDocumentId: string | null = null;
    const evidence = form.get("evidence");
    if (evidence instanceof File && evidence.size > 0) {
      const doc = await uploadDocument(user, evidence, {
        orderId,
        type: "other",
        visibility: "internal",
      });
      evidenceDocumentId = doc.id;
    }
    const penalty = await getStore().create("penalties", {
      orderId,
      ...parsed,
      evidenceDocumentId,
      status: "open",
      createdByUserId: user.id,
    });
    await audit(user, "penalty.create", "penalty", penalty.id, parsed.reason);
    await notify(
      { role: "legal" },
      {
        subject: `Multa registrada no pedido`,
        body: parsed.reason,
        link: `/app/orders/${orderId}`,
      },
    );
  });
}

export async function updatePenaltyStatusAction(form: FormData) {
  const user = await requireUser();
  await run("/app/penalties", async () => {
    assertRole(user, ["admin", "operator", "legal"]);
    const status = str(form, "status");
    if (!["open", "disputed", "paid", "cancelled"].includes(status))
      throw new Error("invalid");
    await getStore().update("penalties", str(form, "penaltyId"), {
      status: status as never,
    });
    await audit(
      user,
      "penalty.status",
      "penalty",
      str(form, "penaltyId"),
      status,
    );
  });
}

export async function markNotificationsReadAction() {
  const user = await requireUser();
  const store = getStore();
  const unread = await store.list("notifications", {
    filter: { userId: user.id, channel: "inapp", readAt: null },
  });
  const now = new Date().toISOString();
  for (const n of unread)
    await store.update("notifications", n.id, { readAt: now });
  revalidatePath("/app/notifications");
}

/* ------------------------------------------------------------------------ */
/* Cadastros                                                                 */
/* ------------------------------------------------------------------------ */

export async function savePartyAction(form: FormData) {
  const user = await requireUser();
  const id = str(form, "id");
  await run(id ? `/app/parties/${id}` : "/app/parties/new", async () => {
    assertWellmix(user);
    const parsed = z
      .object({
        type: z.enum(PARTY_TYPES),
        name: z.string().min(2),
        country: z.string().nullable(),
        email: z.string().email().nullable(),
        phone: z.string().nullable(),
        taxId: z.string().nullable(),
        notes: z.string().nullable(),
        active: z.boolean(),
      })
      .parse({
        type: str(form, "type"),
        name: str(form, "name"),
        country: str(form, "country") || null,
        email: str(form, "email") || null,
        phone: str(form, "phone") || null,
        taxId: str(form, "taxId") || null,
        notes: str(form, "notes") || null,
        active: form.get("active") !== "off",
      });
    const store = getStore();
    if (id) {
      await store.update("parties", id, parsed);
      await audit(user, "party.update", "party", id, parsed.name);
      return `/app/parties/${id}`;
    }
    const party = await store.create("parties", parsed);
    await audit(user, "party.create", "party", party.id, parsed.name);
    return `/app/parties/${party.id}`;
  });
}

export async function createUserAction(form: FormData) {
  const user = await requireUser();
  const partyId = str(form, "partyId") || null;
  const back = partyId ? `/app/parties/${partyId}` : "/app/parties";
  await run(back, async () => {
    assertWellmix(user);
    const parsed = z
      .object({
        email: z.string().email(),
        name: z.string().min(2),
        role: z.enum(ROLES),
        locale: z.enum(LOCALES),
        password: z.string().min(6),
      })
      .parse({
        email: str(form, "email").toLowerCase(),
        name: str(form, "name"),
        role: str(form, "role"),
        locale: str(form, "locale") || "pt",
        password: str(form, "password"),
      });
    if (
      (parsed.role === "admin" || parsed.role === "operator") &&
      !isAdmin(user)
    )
      throw new Error("forbidden");
    const store = getStore();
    if (store.mode === "appwrite") {
      const { createAdminClient } = await import("@/lib/appwrite/server");
      const { users } = createAdminClient();
      await users.create({
        userId: "unique()",
        email: parsed.email,
        password: parsed.password,
        name: parsed.name,
      });
    }
    const created = await store.create("users", {
      email: parsed.email,
      name: parsed.name,
      role: parsed.role,
      partyId: partyId,
      locale: parsed.locale,
      passwordHash:
        store.mode === "memory" ? hashPassword(parsed.password) : null,
      active: true,
    });
    await audit(
      user,
      "user.create",
      "user",
      created.id,
      `${parsed.email} (${parsed.role})`,
    );
  });
}

export async function saveProductAction(form: FormData) {
  const user = await requireUser();
  await run("/app/products", async () => {
    assertWellmix(user);
    const parsed = z
      .object({
        lineId: z.string().min(1),
        name: z.string().min(2),
        sku: z.string().nullable(),
        specification: z.string().nullable(),
      })
      .parse({
        lineId: str(form, "lineId"),
        name: str(form, "name"),
        sku: str(form, "sku") || null,
        specification: str(form, "specification") || null,
      });
    const id = str(form, "id");
    const store = getStore();
    if (id) await store.update("products", id, parsed);
    else await store.create("products", { ...parsed, active: true });
  });
}

export async function saveLineAction(form: FormData) {
  const user = await requireUser();
  await run("/app/lines", async () => {
    assertWellmix(user);
    const name = str(form, "name");
    if (name.length < 2) throw new Error("invalid_name");
    const requirements = str(form, "requirements")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [key, label, type = "file", required = "1"] = line
          .split("|")
          .map((p) => p.trim());
        return {
          key: key.replace(/[^a-z0-9_]/gi, "_").toLowerCase(),
          label: label || key,
          type: ([
            "file",
            "photo",
            "text",
            "number",
            "date",
            "confirm",
          ].includes(type)
            ? type
            : "file") as never,
          required: required !== "0",
          role: "supplier" as const,
        };
      });
    const id = str(form, "id");
    const store = getStore();
    let manualDocumentId: string | null = null;
    const manual = form.get("manual");
    if (manual instanceof File && manual.size > 0) {
      manualDocumentId = (
        await uploadDocument(user, manual, {
          type: "manual",
          visibility: "supplier",
        })
      ).id;
    }
    if (id) {
      const existing = await store.get("product_lines", id);
      await store.update("product_lines", id, {
        name,
        requirements,
        manualDocumentId:
          manualDocumentId ?? existing?.manualDocumentId ?? null,
      });
    } else {
      await store.create("product_lines", {
        name,
        requirements,
        manualDocumentId,
        active: true,
      });
    }
  });
}

export async function importCsvAction(form: FormData) {
  const user = await requireUser();
  const entity = str(form, "entity");
  await run(`/app/import?entity=${entity}`, async () => {
    assertWellmix(user);
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0)
      throw new Error("file_required");
    const result = await importCsv(user, entity, await file.text());
    return `/app/import?entity=${entity}&created=${result.created}&skipped=${result.skipped}`;
  });
}

export async function saveSettingsAction(form: FormData) {
  const user = await requireUser();
  await run("/app/settings", async () => {
    assertRole(user, ["admin"]);
    for (const key of Object.keys(DEFAULT_SETTINGS) as SettingKey[]) {
      const raw = form.get(key);
      if (raw === null) continue;
      const current = DEFAULT_SETTINGS[key];
      let value: unknown = raw;
      if (typeof current === "boolean") value = raw === "on" || raw === "true";
      else if (typeof current === "number") value = Number(raw);
      else if (typeof current === "object") {
        try {
          value = JSON.parse(String(raw));
        } catch {
          throw new Error("invalid_json");
        }
      }
      await setSetting(key, value as never);
    }
    await audit(
      user,
      "settings.update",
      "settings",
      "global",
      "Configurações atualizadas",
    );
    return "/app/settings?ok=1";
  });
}

/** Garante acesso ao pedido em ações genéricas. */
export async function assertOrderAccess(user: User, orderId: string) {
  const order = await getStore().get("orders", orderId);
  if (!order || !canViewOrder(user, order)) throw new Error("forbidden");
  return order;
}
