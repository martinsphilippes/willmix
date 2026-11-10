"use server";

import { z } from "zod";
import { SHEET_CURRENCIES, YES_NO } from "@/lib/db/schema";
import { parseNumberInput } from "@/lib/number-input";
import { requireUser, run, str, withQuery } from "./helpers";

/*
 * Seleção de itens e solicitação ao fornecedor (docs/SUPPLIER_REQUESTS.md):
 * abrir (Wellmix, tela Booking), responder (o fornecedor dono, ou a Wellmix
 * em nome dele; tela Cotações) e decidir (Wellmix). O serviço confere papel,
 * tela e dono de novo.
 */

const ID = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const SELECTION = "/app/booking/selection";
const detail = (id: string) => `/app/supplier-requests/${id}`;

/** Número digitado (vírgula ou ponto); vazio = nulo; ilegível recusa. */
function number(form: FormData, key: string, int = false): number | null {
  const n = parseNumberInput(str(form, key), { int });
  if (n === null) return null;
  if (!Number.isFinite(n) || n <= 0 || n > 1e9)
    throw new Error("invalid_input");
  return int ? Math.round(n) : n;
}

export async function openSupplierRequestAction(form: FormData) {
  const user = await requireUser();
  const q = str(form, "q").slice(0, 200);
  const back = q ? `${SELECTION}?q=${encodeURIComponent(q)}` : SELECTION;
  await run(back, async () => {
    const chosen = str(form, "chosen");
    if (!chosen) throw new Error("supplier_request_choose");
    const input = z
      .object({
        itemId: ID,
        alternativeIds: z.array(ID).max(60),
        needs: z.string().max(4000).nullable(),
      })
      .parse({
        itemId: chosen,
        alternativeIds: form
          .getAll("alternatives")
          .filter((v): v is string => typeof v === "string"),
        needs: str(form, "needs") || null,
      });
    const { openSupplierRequest } =
      await import("@/lib/services/supplier-requests");
    const request = await openSupplierRequest(user, {
      ...input,
      quantity: number(form, "quantity", true),
      searchQuery: q || null,
    });
    return withQuery(detail(request.id), "created", "1");
  });
}

export async function answerSupplierRequestAction(form: FormData) {
  const user = await requireUser();
  const raw = str(form, "id");
  const back = ID.safeParse(raw).success
    ? detail(raw)
    : "/app/supplier-requests";
  await run(back, async () => {
    const input = z
      .object({
        id: ID,
        canDo: z.enum(YES_NO),
        currency: z.enum(SHEET_CURRENCIES).nullable(),
        note: z.string().max(4000).nullable(),
      })
      .parse({
        id: raw,
        canDo: str(form, "canDo"),
        currency: str(form, "currency") || null,
        note: str(form, "note") || null,
      });
    const { answerSupplierRequest } =
      await import("@/lib/services/supplier-requests");
    await answerSupplierRequest(user, input.id, {
      canDo: input.canDo,
      currency: input.currency,
      note: input.note,
      price: number(form, "price"),
      moq: number(form, "moq", true),
      leadTimeDays: number(form, "leadTimeDays", true),
    });
    return withQuery(back, "answered", "1");
  });
}

export async function decideSupplierRequestAction(form: FormData) {
  const user = await requireUser();
  const raw = str(form, "id");
  const back = ID.safeParse(raw).success
    ? detail(raw)
    : "/app/supplier-requests";
  await run(back, async () => {
    const input = z
      .object({
        id: ID,
        decision: z.enum(["approved", "declined", "cancelled"]),
        note: z.string().max(500).nullable(),
      })
      .parse({
        id: raw,
        decision: str(form, "decision"),
        note: str(form, "note") || null,
      });
    const { decideSupplierRequest } =
      await import("@/lib/services/supplier-requests");
    await decideSupplierRequest(user, input.id, input.decision, input.note);
    return withQuery(back, "decided", input.decision);
  });
}
