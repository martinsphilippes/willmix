"use server";

import { z } from "zod";
import { RECEIVING_CHECKS, YES_NO } from "@/lib/db/schema";
import type { User } from "@/lib/db";
import { assertScreen } from "@/lib/auth/screens";
import { field, files, requireUser, run, str } from "./helpers";

/*
 * Recebimento (docs/RECEIVING.md): só a Wellmix. Lacre/fotos/checklist,
 * contagem por SKU, RIC, devolução do container e encerramento.
 */

const ID = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function back(form: FormData) {
  const orderId = ID.safeParse(str(form, "orderId"));
  return orderId.success ? `/app/orders/${orderId.data}` : "/app/orders";
}

/** Sobe os arquivos do campo como documentos internos do pedido. */
async function upload(
  user: User,
  orderId: string,
  list: File[],
  type: "photo" | "customs",
) {
  const { assertWellmix } = await import("@/lib/auth/permissions");
  assertWellmix(user);
  const { uploadDocument } = await import("@/lib/services/documents");
  const ids: string[] = [];
  for (const file of list) {
    const doc = await uploadDocument(user, file, {
      orderId,
      type,
      visibility: "internal",
    });
    ids.push(doc.id);
  }
  return ids;
}

export async function saveUnloadingAction(form: FormData) {
  const user = await requireUser();
  const to = back(form);
  await run(`${to}#receiving`, async () => {
    assertScreen(user, "orders");
    const orderId = ID.parse(str(form, "orderId"));
    const intact = str(form, "sealIntact");
    const checklist = form
      .getAll("checklist")
      .map(String)
      .filter((c): c is (typeof RECEIVING_CHECKS)[number] =>
        (RECEIVING_CHECKS as readonly string[]).includes(c),
      );
    const [sealPhoto] = await upload(
      user,
      orderId,
      files(form, "sealPhoto").slice(0, 1),
      "photo",
    );
    const containerPhotos = await upload(
      user,
      orderId,
      files(form, "containerPhotos").slice(0, 20),
      "photo",
    );
    const { saveUnloading } = await import("@/lib/services/receiving");
    await saveUnloading(user, orderId, {
      sealNumber: field(form, "sealNumber", z.string().trim().max(60)) || null,
      sealIntact: intact ? z.enum(YES_NO).parse(intact) : null,
      sealPhotoDocumentId: sealPhoto ?? null,
      containerPhotoDocumentIds: containerPhotos,
      checklist,
    });
    return `${to}?receiving=saved#receiving`;
  });
}

export async function saveCountsAction(form: FormData) {
  const user = await requireUser();
  const to = back(form);
  await run(`${to}#receiving`, async () => {
    assertScreen(user, "orders");
    const orderId = ID.parse(str(form, "orderId"));
    const ids = form.getAll("itemId").map((v) => ID.parse(String(v)));
    const count = z.coerce.number().int().min(0).max(1e9);
    const counts = ids.map((id) => ({
      orderItemId: id,
      received: count.parse(str(form, `received_${id}`) || "0"),
      damaged: count.parse(str(form, `damaged_${id}`) || "0"),
      note: field(form, `note_${id}`, z.string().trim().max(500)) || null,
    }));
    const { saveCounts } = await import("@/lib/services/receiving");
    await saveCounts(user, orderId, counts);
    return `${to}?receiving=counted#receiving`;
  });
}

export async function saveRicAction(form: FormData) {
  const user = await requireUser();
  const to = back(form);
  await run(`${to}#receiving`, async () => {
    assertScreen(user, "orders");
    const orderId = ID.parse(str(form, "orderId"));
    const [doc] = await upload(
      user,
      orderId,
      files(form, "ricFile").slice(0, 1),
      "customs",
    );
    const { saveRic } = await import("@/lib/services/receiving");
    await saveRic(user, orderId, {
      ricNumber: field(form, "ricNumber", z.string().trim().min(1).max(60)),
      ricDocumentId: doc ?? null,
    });
    return `${to}?receiving=ric#receiving`;
  });
}

export async function saveReturnAction(form: FormData) {
  const user = await requireUser();
  const to = back(form);
  await run(`${to}#receiving`, async () => {
    assertScreen(user, "orders");
    const orderId = ID.parse(str(form, "orderId"));
    const day = DATE.parse(str(form, "returnedAt"));
    const [doc] = await upload(
      user,
      orderId,
      files(form, "returnFile").slice(0, 1),
      "customs",
    );
    const { saveReturn } = await import("@/lib/services/receiving");
    await saveReturn(user, orderId, {
      returnedAt: `${day}T12:00:00.000Z`,
      documentId: doc ?? null,
    });
    return `${to}?receiving=returned#receiving`;
  });
}

export async function closeReceivingAction(form: FormData) {
  const user = await requireUser();
  const to = back(form);
  await run(`${to}#receiving`, async () => {
    assertScreen(user, "orders");
    const orderId = ID.parse(str(form, "orderId"));
    const { closeReceiving } = await import("@/lib/services/receiving");
    await closeReceiving(
      user,
      orderId,
      field(form, "closingNote", z.string().trim().max(1000)) || null,
    );
    return `${to}?receiving=closed#receiving`;
  });
}
