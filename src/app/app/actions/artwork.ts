"use server";

import { z } from "zod";
import { assertScreen } from "@/lib/auth/screens";
import { field, files, requireUser, run, str } from "./helpers";

/*
 * Artes do pedido (docs/ARTWORK.md): designer, não conformidade por SKU,
 * correção do designer e aceite/reabertura. O arquivo só sobe depois de
 * conferido que o usuário pode agir.
 */

const ID = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

function back(form: FormData) {
  const orderId = ID.safeParse(str(form, "orderId"));
  return orderId.success ? `/app/orders/${orderId.data}` : "/app/orders";
}

export async function assignDesignerAction(form: FormData) {
  const user = await requireUser();
  const to = back(form);
  await run(`${to}#artwork`, async () => {
    assertScreen(user, "orders");
    const orderId = ID.parse(str(form, "orderId"));
    const raw = str(form, "designerUserId");
    const { assignDesigner } = await import("@/lib/services/artwork");
    await assignDesigner(user, orderId, raw ? ID.parse(raw) : null);
    return `${to}?artwork=designer#artwork`;
  });
}

export async function reportArtIssueAction(form: FormData) {
  const user = await requireUser();
  const to = back(form);
  await run(`${to}#artwork`, async () => {
    const orderId = ID.parse(str(form, "orderId"));
    const orderItemId = ID.parse(str(form, "orderItemId"));
    const note = field(form, "note", z.string().trim().min(1).max(2000));
    const { assertWellmix } = await import("@/lib/auth/permissions");
    assertWellmix(user);
    assertScreen(user, "orders");
    const [file] = files(form, "file");
    let documentId: string | null = null;
    if (file) {
      const { uploadDocument } = await import("@/lib/services/documents");
      documentId = (
        await uploadDocument(user, file, {
          orderId,
          type: "attachment",
          visibility: "internal",
        })
      ).id;
    }
    const { reportArtIssue } = await import("@/lib/services/artwork");
    await reportArtIssue(user, orderId, { orderItemId, note, documentId });
    return `${to}?artwork=reported#artwork`;
  });
}

export async function fixArtIssueAction(form: FormData) {
  const user = await requireUser();
  const to = back(form);
  await run(`${to}#artwork`, async () => {
    const orderId = ID.parse(str(form, "orderId"));
    const issueId = ID.parse(str(form, "issueId"));
    const fixNote = field(form, "fixNote", z.string().trim().min(1).max(2000));
    const { getStore } = await import("@/lib/db");
    const svc = await import("@/lib/services/artwork");
    const issue = await getStore().get("art_issues", issueId);
    const order = issue ? await getStore().get("orders", issue.orderId) : null;
    if (!issue || !order || order.id !== orderId) throw new Error("not_found");
    if (!svc.canFixArt(user, order)) throw new Error("forbidden");
    assertScreen(user, "orders");
    const [file] = files(form, "file");
    let documentId: string | null = null;
    if (file) {
      const { uploadDocument } = await import("@/lib/services/documents");
      // Arte corrigida: visível a quem trabalha no pedido (fornecedor imprime).
      documentId = (await uploadDocument(user, file, { orderId, type: "art" }))
        .id;
    }
    await svc.fixArtIssue(user, issueId, { fixNote, documentId });
    return `${to}?artwork=fixed#artwork`;
  });
}

export async function reviewArtFixAction(form: FormData) {
  const user = await requireUser();
  const to = back(form);
  await run(`${to}#artwork`, async () => {
    assertScreen(user, "orders");
    const issueId = ID.parse(str(form, "issueId"));
    const accept = z.enum(["accept", "reopen"]).parse(str(form, "decision"));
    const note = field(form, "note", z.string().trim().max(2000)) || null;
    const { reviewArtFix } = await import("@/lib/services/artwork");
    await reviewArtFix(user, issueId, accept === "accept", note);
    return `${to}?artwork=${accept === "accept" ? "accepted" : "reopened"}#artwork`;
  });
}
