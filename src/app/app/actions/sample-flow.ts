"use server";

import { z } from "zod";
import { assertScreen } from "@/lib/auth/screens";
import { field, files, requireUser, run, str } from "./helpers";

/*
 * Fotos e vídeos reais do produto (docs/SAMPLE_FLOW.md): a agência de
 * marketing na China envia por produto; o marketing aprova (troca as fotos
 * do catálogo e ativa a venda) ou pede para refazer. Aqui só o formato; o
 * serviço confere quem pode e se a etapa está aberta.
 */

const ID = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;
const backOf = (orderId: string) =>
  ID.test(orderId) ? `/app/orders/${orderId}/real-media` : "/app";

/** No máximo de arquivos por envio. */
const MAX_FILES = 20;

export async function sendRealMediaAction(form: FormData) {
  const user = await requireUser();
  const orderId = str(form, "orderId");
  await run(backOf(orderId), async () => {
    assertScreen(user, "orders");
    const input = z
      .object({ orderId: z.string().regex(ID), itemId: z.string().regex(ID) })
      .parse({ orderId, itemId: str(form, "itemId") });
    const chosen = files(form, "files").slice(0, MAX_FILES);
    if (!chosen.length) throw new Error("real_media_empty");
    const svc = await import("@/lib/services/sample-flow");
    // Confere antes de subir: quem não envia não grava arquivo.
    const view = await svc.realMediaView(user, input.orderId);
    const line = view?.lines.find((l) => l.itemId === input.itemId);
    if (!view?.canSend || !line) throw new Error("real_media_closed");
    const { uploadDocument } = await import("@/lib/services/documents");
    const ids: string[] = [];
    for (const file of chosen)
      ids.push(
        (
          await uploadDocument(user, file, {
            productId: line.productId,
            type: "real_media",
            visibility: "internal",
            video: true,
          })
        ).id,
      );
    await svc.sendRealMedia(user, input.orderId, input.itemId, ids);
    return `${backOf(input.orderId)}?done=uploaded#item-${input.itemId}`;
  });
}

export async function decideRealMediaAction(form: FormData) {
  const user = await requireUser();
  const orderId = str(form, "orderId");
  await run(backOf(orderId), async () => {
    assertScreen(user, "orders");
    const input = z
      .object({
        orderId: z.string().regex(ID),
        itemId: z.string().regex(ID),
        decision: z.enum(["approved", "rejected"]),
      })
      .parse({
        orderId,
        itemId: str(form, "itemId"),
        decision: str(form, "decision"),
      });
    const reason = field(form, "reason", z.string().trim().max(1000)) || null;
    const { decideRealMedia } = await import("@/lib/services/sample-flow");
    await decideRealMedia(
      user,
      input.orderId,
      input.itemId,
      input.decision,
      reason,
    );
    return `${backOf(input.orderId)}?done=${input.decision}#item-${input.itemId}`;
  });
}
