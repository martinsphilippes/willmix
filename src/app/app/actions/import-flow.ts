"use server";

import { z } from "zod";
import { IMPORT_STEP_KEYS } from "@/lib/db/schema";
import { assertScreen } from "@/lib/auth/screens";
import { field, files, requireUser, run, str } from "./helpers";

/*
 * Embarque e desembaraço (docs/IMPORT_FLOW.md): enviar um passo (número,
 * data, canal, valor e/ou arquivo) e validar/recusar. O serviço confere quem
 * pode; o arquivo só sobe depois de conferido que o usuário faz o passo.
 */

const ID = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

/** Cartão de onde veio (embarque ou certificação). */
const anchorOf = (form: FormData) =>
  str(form, "anchor") === "certification" ? "certification" : "import-flow";

function back(form: FormData) {
  const orderId = ID.safeParse(str(form, "orderId"));
  return orderId.success ? `/app/orders/${orderId.data}` : "/app/orders";
}

export async function submitImportStepAction(form: FormData) {
  const user = await requireUser();
  const to = back(form);
  await run(`${to}#${anchorOf(form)}`, async () => {
    const orderId = ID.parse(str(form, "orderId"));
    const key = z.enum(IMPORT_STEP_KEYS).parse(str(form, "key"));
    const value = field(form, "value", z.string().trim().max(200)) || null;
    const amountRaw = str(form, "amount").replace(",", ".");
    const amount = amountRaw
      ? z.coerce.number().positive().max(1e12).parse(amountRaw)
      : null;
    const currency = str(form, "currency")
      ? z
          .string()
          .regex(/^[A-Z]{3}$/)
          .parse(str(form, "currency"))
      : null;
    const svc = await import("@/lib/services/import-flow");
    const { getStore } = await import("@/lib/db");
    const order = await getStore().get("orders", orderId);
    if (!order) throw new Error("not_found");
    // Confere antes de subir o arquivo: quem não faz o passo não grava nada.
    if (!svc.actsAs(user, order, svc.stepTemplate(key).actor))
      throw new Error("forbidden");
    assertScreen(user, "orders");
    const [file] = files(form, "file");
    let documentId: string | null = null;
    if (file) {
      const { uploadDocument } = await import("@/lib/services/documents");
      const doc = await uploadDocument(user, file, {
        orderId,
        type: "import_step",
        visibility: "internal",
      });
      documentId = doc.id;
    }
    await svc.submitStep(user, orderId, key, {
      value,
      amount,
      currency,
      documentId,
    });
    return `${to}?importStep=submitted#${anchorOf(form)}`;
  });
}

export async function validateImportStepAction(form: FormData) {
  const user = await requireUser();
  const to = back(form);
  await run(`${to}#${anchorOf(form)}`, async () => {
    assertScreen(user, "orders");
    const orderId = ID.parse(str(form, "orderId"));
    const key = z.enum(IMPORT_STEP_KEYS).parse(str(form, "key"));
    const decision = z
      .enum(["validated", "rejected"])
      .parse(str(form, "decision"));
    const reason = field(form, "reason", z.string().trim().max(1000)) || null;
    const { validateStep } = await import("@/lib/services/import-flow");
    await validateStep(user, orderId, key, decision, reason);
    return `${to}?importStep=${decision}#${anchorOf(form)}`;
  });
}
