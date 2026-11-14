import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Store isolado por arquivo de teste (modo memória em diretório temporário). */
export function withTempStore() {
  process.env.DATA_MODE = "memory";
  process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "wellmix-test-"));
  (globalThis as { __wellmixStore?: unknown }).__wellmixStore = undefined;
}

/** Itens do documento do pedido que o "preencher a etapa" dos testes pula. */
export const ORDER_DOCUMENT_KEYS: readonly string[] = [
  "order_sign_send",
  "order_signed_wellmix",
  "order_signed_supplier",
];

/**
 * Ordem nova (docs/ORDER_SIGNATURE.md): a assinatura vem depois da arte e do
 * selo. Com a etapa "Arte e embalagem" aberta e a arte já enviada, a
 * certificadora (OCP) do pedido envia o selo (só ela envia; dono,
 * 14/11/2026; sem ela vinculada, a Wellmix vincula a da demonstração), a
 * Wellmix envia a arte com o selo (no lugar da agência) e aperta "Enviar para
 * assinatura".
 */
export async function sendForSignature(
  admin: import("@/lib/db").User,
  orderId: string,
) {
  const { getStore } = await import("@/lib/db");
  const { uploadDocument } = await import("@/lib/services/documents");
  const flow = await import("@/lib/services/import-flow");
  const s = await import("@/lib/services/order-signature");
  const store = getStore();
  let order = (await store.get("orders", orderId))!;
  if (!order.ocpId) {
    const [party] = await store.list("parties", {
      filter: { type: "ocp", active: true },
    });
    order = await store.update("orders", orderId, { ocpId: party.id });
  }
  const [ocp] = await store.list("users", {
    filter: { role: "ocp", partyId: order.ocpId!, active: true },
  });
  for (const key of ["cert_seal", "cert_seal_art"] as const) {
    const steps = await store.list("import_steps", { filter: { orderId } });
    const have = steps.find((step) => step.key === key);
    if (have?.status === "submitted" || have?.status === "validated") continue;
    const who = key === "cert_seal" ? ocp : admin;
    const doc = await uploadDocument(
      who,
      new File(["%PDF-1.4 selo"], `${key}.pdf`, { type: "application/pdf" }),
      { orderId, type: "import_step", visibility: "internal" },
    );
    await flow.submitStep(who, orderId, key, { documentId: doc.id });
  }
  await s.sendOrderForSignature(admin, orderId);
}

/**
 * Leva um pedido recém-criado até o ponto da assinatura (ordem nova): a
 * Wellmix conclui o que vem antes (Pedido criado, Preparação), envia a arte,
 * o selo e a arte com o selo e aperta "Enviar para assinatura". Depois disso
 * a Wellmix já pode assinar.
 */
export async function reachSignature(
  admin: import("@/lib/db").User,
  orderId: string,
  /** "packaging": para na etapa "Arte e embalagem" aberta, sem a arte. */
  stopAt: "signature" | "packaging" = "signature",
) {
  const { getStore } = await import("@/lib/db");
  const { loadOrderProgress, submitRequirement } =
    await import("@/lib/workflow/engine");
  const { uploadDocument } = await import("@/lib/services/documents");
  const fileFor = async (requirementId: string) =>
    (
      await uploadDocument(
        admin,
        new File(["%PDF-1.4 teste"], "arquivo.pdf", {
          type: "application/pdf",
        }),
        { orderId, requirementId, type: "other", visibility: "internal" },
      )
    ).id;
  for (let guard = 0; guard < 40; guard++) {
    const progress = (await loadOrderProgress(orderId))!;
    const stage = progress.stages.find(
      (s) => s.status === "active" || s.status === "blocked",
    );
    if (!stage) throw new Error("order_has_no_open_stage");
    const pending = progress.requirements.filter(
      (r) => r.stageId === stage.id && r.status !== "done" && r.required,
    );
    if (stage.key === "PACKAGING") {
      if (stopAt === "packaging") return;
      const art = pending.find((r) => r.key === "art");
      if (art)
        await submitRequirement(admin, art.id, {
          documentId: await fileFor(art.id),
        });
      await sendForSignature(admin, orderId);
      return;
    }
    // A programação de compra é da Wellmix e vem antes de validar a ficha.
    if (stage.key === "PREPARATION") {
      const ps = await import("@/lib/services/purchase-sheet");
      if (!(await ps.scheduleDone(orderId)))
        await ps.saveSheet(admin, orderId, {
          lots: [{ departureIntervalDays: 30, masterCartons: 10 }],
        } as never);
    }
    if (!pending.length) throw new Error(`stage_${stage.key}_stuck`);
    for (const r of pending) {
      const fresh = await getStore().get("stages", stage.id);
      if (fresh?.status !== "active" && fresh?.status !== "blocked") break;
      if (r.type === "file" || r.type === "photo")
        await submitRequirement(admin, r.id, {
          documentId: await fileFor(r.id),
        });
      else
        await submitRequirement(admin, r.id, {
          value:
            r.type === "number" ? "1" : r.type === "date" ? "2026-10-01" : "ok",
        });
    }
  }
  throw new Error("order_did_not_reach_packaging");
}

/**
 * Documento do pedido do começo ao fim, na ordem nova: selo, envio para
 * assinatura, a Wellmix assina e o fornecedor do pedido assina em seguida.
 */
export async function completeOrderDocument(
  admin: import("@/lib/db").User,
  orderId: string,
) {
  const { getStore } = await import("@/lib/db");
  await sendForSignature(admin, orderId);
  await signOrderAs(admin, orderId);
  const order = (await getStore().get("orders", orderId))!;
  const supplier = (await getStore().list("users")).find(
    (u) => u.role === "supplier" && u.partyId === order.supplierId,
  );
  if (!supplier) throw new Error("order_supplier_user_missing");
  await signOrderAs(supplier, orderId);
}

/**
 * Assina o documento do pedido como a página faz (docs/ORDER_SIGNATURE.md):
 * a Wellmix primeiro e o fornecedor em seguida, depois do "Enviar para
 * assinatura" (etapa "Arte e embalagem").
 */
export async function signOrderAs(
  user: import("@/lib/db").User,
  orderId: string,
) {
  const s = await import("@/lib/services/order-signature");
  const view = await s.getOrderSignatureView(user, orderId);
  if (!view) throw new Error("order_document_not_visible");
  return s.signOrderDocument(user, orderId, {
    name: user.name,
    agree: true,
    hash: view.hash,
  });
}
