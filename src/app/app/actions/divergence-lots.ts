"use server";

import { z } from "zod";
import { parseNumberInput } from "@/lib/number-input";
import { field, files, requireUser, run, str, withQuery } from "./helpers";

/*
 * Lote com divergência (docs/RECEIVING.md; mapa E21, E24 a E27). Aqui só o
 * formato; o serviço confere quem faz cada passo e quem decide (a Trading).
 */

const ID = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/);
const STEP = z.enum(["supplier", "evidence", "finance"]);
const TEXT = z.string().trim().max(2000);

const backOf = (orderId: string, lotId: string) =>
  ID.safeParse(orderId).success && ID.safeParse(lotId).success
    ? `/app/orders/${orderId}/lots/${lotId}`
    : "/app/lots";

/** Quem faz envia o passo à Trading (texto, opção, valor e arquivos). */
export async function submitLotStepAction(form: FormData) {
  const user = await requireUser();
  const orderId = str(form, "orderId");
  const lotId = str(form, "lotId");
  const back = backOf(orderId, lotId);
  await run(back, async () => {
    ID.parse(lotId);
    const step = STEP.parse(str(form, "step"));
    const { lotView, submitLotStep } =
      await import("@/lib/services/divergence-lots");
    const view = await lotView(user, lotId);
    if (!view || !view.can[step].submit) throw new Error("forbidden");
    const { uploadDocument } = await import("@/lib/services/documents");
    const documentIds: string[] = [];
    for (const file of files(form, "files"))
      documentIds.push(
        (
          await uploadDocument(user, file, {
            orderId: view.order.id,
            type: "attachment",
            // A Trading do pedido aprova: ela abre os arquivos.
            visibility: "supplier",
            video: true,
          })
        ).id,
      );
    const amountRaw = str(form, "amount");
    await submitLotStep(user, lotId, step, {
      text: field(form, "text", TEXT) || null,
      choice: str(form, "choice") || null,
      amount: amountRaw ? parseNumberInput(amountRaw) : null,
      currency: str(form, "currency")
        ? z
            .string()
            .regex(/^[A-Z]{3}$/)
            .parse(str(form, "currency"))
        : null,
      documentIds,
    });
    return withQuery(back, "submitted", "1");
  });
}

/** A Trading decide: responde (E25) ou aprova/devolve (E26 e E27). */
export async function decideLotStepAction(form: FormData) {
  const user = await requireUser();
  const orderId = str(form, "orderId");
  const lotId = str(form, "lotId");
  const back = backOf(orderId, lotId);
  await run(back, async () => {
    ID.parse(lotId);
    const step = STEP.parse(str(form, "step"));
    const { decideLotStep } = await import("@/lib/services/divergence-lots");
    await decideLotStep(user, lotId, step, {
      approve: str(form, "decision") !== "reject",
      choice: str(form, "choice") || null,
      text: field(form, "text", TEXT) || null,
    });
    return withQuery(back, "decided", "1");
  });
}
