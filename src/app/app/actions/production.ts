"use server";

import { z } from "zod";
import {
  FOLLOWUP_STATUSES,
  PRODUCTION_MODES,
  SKU_INSPECTION_RESULTS,
} from "@/lib/db/schema";
import { field, requireUser, run, str } from "./helpers";

/*
 * Produção (docs/PRODUCTION.md): dados da produção e ETD, follow 5/15/25,
 * agenda da inspeção, resultado por SKU e correção do fornecedor. O serviço
 * confere quem pode (Wellmix ou o fornecedor do pedido).
 */

const ID = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const note = (form: FormData, key: string) =>
  field(form, key, z.string().trim().max(1000)) || null;
/** Dia do formulário (AAAA-MM-DD) → ISO ao meio-dia UTC (não muda de dia no fuso). */
const isoDay = (value: string) => `${value}T12:00:00.000Z`;

function back(form: FormData) {
  const orderId = ID.safeParse(str(form, "orderId"));
  return orderId.success ? `/app/orders/${orderId.data}` : "/app/orders";
}

export async function saveProductionPlanAction(form: FormData) {
  const user = await requireUser();
  const to = back(form);
  await run(`${to}#production`, async () => {
    const orderId = ID.parse(str(form, "orderId"));
    const mode = str(form, "mode");
    const start = str(form, "productionStartAt");
    const etd = str(form, "etd");
    const { savePlan } = await import("@/lib/services/production");
    await savePlan(user, orderId, {
      mode: mode ? z.enum(PRODUCTION_MODES).parse(mode) : null,
      factoryName:
        field(form, "factoryName", z.string().trim().max(160)) || null,
      factoryAddress:
        field(form, "factoryAddress", z.string().trim().max(1000)) || null,
      productionStartAt: start ? isoDay(DATE.parse(start)) : null,
      ...(etd ? { etd: isoDay(DATE.parse(etd)) } : {}),
      etdReason: note(form, "etdReason"),
    });
    return `${to}?production=saved#production`;
  });
}

export async function recordFollowupAction(form: FormData) {
  const user = await requireUser();
  const to = back(form);
  await run(`${to}#production`, async () => {
    const orderId = ID.parse(str(form, "orderId"));
    const day = z.coerce.number().int().parse(str(form, "day"));
    const status = z.enum(FOLLOWUP_STATUSES).parse(str(form, "status"));
    const { recordFollowup } = await import("@/lib/services/production");
    await recordFollowup(user, orderId, {
      day,
      status,
      note: note(form, "note"),
    });
    return `${to}?production=followup#production`;
  });
}

export async function scheduleInspectionAction(form: FormData) {
  const user = await requireUser();
  const to = back(form);
  await run(`${to}#production`, async () => {
    const orderId = ID.parse(str(form, "orderId"));
    const at = isoDay(DATE.parse(str(form, "inspectionAt")));
    const { scheduleInspection } = await import("@/lib/services/production");
    await scheduleInspection(user, orderId, {
      at,
      note: note(form, "inspectionNote"),
    });
    return `${to}?production=scheduled#production`;
  });
}

export async function inspectSkuAction(form: FormData) {
  const user = await requireUser();
  const to = back(form);
  await run(`${to}#production`, async () => {
    const orderId = ID.parse(str(form, "orderId"));
    const orderItemId = ID.parse(str(form, "orderItemId"));
    const result = z.enum(SKU_INSPECTION_RESULTS).parse(str(form, "result"));
    const { inspectSku } = await import("@/lib/services/production");
    await inspectSku(user, orderId, {
      orderItemId,
      result,
      note: note(form, "note"),
    });
    return `${to}?production=inspected#production`;
  });
}

export async function respondSkuAction(form: FormData) {
  const user = await requireUser();
  const to = back(form);
  await run(`${to}#production`, async () => {
    const inspectionId = ID.parse(str(form, "inspectionId"));
    const action = field(form, "action", z.string().trim().min(1).max(1000));
    const { respondSku } = await import("@/lib/services/production");
    await respondSku(user, inspectionId, action);
    return `${to}?production=fixed#production`;
  });
}
