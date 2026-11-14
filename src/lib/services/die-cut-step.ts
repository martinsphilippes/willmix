import "server-only";
import { getStore } from "@/lib/db";
import type { Document, Order, Requirement, User } from "@/lib/db/schema";
import { ForbiddenError, isWellmix } from "@/lib/auth/permissions";
import { isPurchaseFlow } from "@/lib/workflow/stages";
import { baseKeyOf, itemIdOf, laneKey, LANE_KEYS } from "@/lib/purchase-lanes";
import {
  dieCutItemOf,
  dieCutHref,
  dieCutProducts,
  type DieCutProduct,
} from "@/lib/die-cut-step";
import { isOrderSupplier } from "./order-signature";

/*
 * Quadro "Die Cut" do pedido de compra (decisão do dono, 13/11/2026): os
 * quatro itens do fornecedor, produto a produto, numa tela própria
 * (/app/orders/{id}/die-cut). Nada novo no banco: são os requisitos da raia
 * do fornecedor (docs/PURCHASE_ORDER.md, seção 2). O pedido mínimo e o prazo
 * negociados vêm da resposta dele à solicitação ao fornecedor.
 */

export interface DieCutViewProduct extends DieCutProduct<Requirement> {
  /** Negociados na solicitação ao fornecedor (o que ele confere e confirma). */
  negotiatedMoq: number | null;
  negotiatedLeadTimeDays: number | null;
}

export interface DieCutView {
  order: Order;
  /** A etapa está aberta: ainda dá para enviar e corrigir. */
  open: boolean;
  /** Quem vê pode enviar os itens (o fornecedor do pedido ou a Wellmix). */
  canAct: boolean;
  products: DieCutViewProduct[];
  documents: Map<string, Document>;
  /**
   * Todas as fotos e arquivos enviados no die-cut e na foto em alta de cada
   * produto (pelo id do item da raia), na ordem de envio: o principal do
   * item e os acrescentados pelo "+".
   */
  attachments: Map<string, Document[]>;
}

/** Só a Wellmix e o fornecedor do pedido abrem o quadro. */
export function canViewDieCut(user: User, order: Order): boolean {
  return (
    isPurchaseFlow(order) && (isWellmix(user) || isOrderSupplier(user, order))
  );
}

/**
 * Pedido mínimo e prazo negociados de cada item do pedido (por id do item):
 * a resposta do fornecedor à solicitação, já com o que a negociação mudou.
 * Também preenche o campo do prazo na visão do fornecedor da Preparação.
 */
export async function negotiatedTerms(
  order: Pick<Order, "id" | "parentOrderId">,
) {
  const store = getStore();
  const [items, requests] = await Promise.all([
    store.list("order_items", { filter: { orderId: order.id } }),
    // Rodada de uma programação de compra: a negociação é a do pedido pai.
    store.list("supplier_requests", {
      filter: { orderId: order.parentOrderId ?? order.id },
    }),
  ]);
  const out = new Map<string, { moq: number | null; days: number | null }>();
  for (const item of items) {
    const r = requests.find((x) => x.productId === item.productId);
    out.set(item.id, {
      moq: r?.supplierMoq ?? r?.item.moq ?? null,
      days: r?.supplierLeadTimeDays ?? null,
    });
  }
  return out;
}

export async function getDieCutView(
  user: User,
  orderId: string,
): Promise<DieCutView | null> {
  const store = getStore();
  const order = await store.get("orders", orderId);
  if (!order || !canViewDieCut(user, order)) return null;
  const [stages, requirements, terms] = await Promise.all([
    store.list("stages", { filter: { orderId, key: "PREPARATION" } }),
    store.list("requirements", { filter: { orderId } }),
    negotiatedTerms(order),
  ]);
  const stage = stages[0];
  const mine = requirements
    .filter((r) => !stage || r.stageId === stage.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const products = dieCutProducts(mine).map((p) => ({
    ...p,
    negotiatedMoq: terms.get(p.itemId)?.moq ?? null,
    negotiatedLeadTimeDays: terms.get(p.itemId)?.days ?? null,
  }));
  const docIds = products
    .flatMap((p) => [p.items.dieline?.documentId, p.items.hd?.documentId])
    .filter((id): id is string => !!id);
  const fileReqIds = products
    .flatMap((p) => [p.items.dieline?.id, p.items.hd?.id])
    .filter((id): id is string => !!id);
  const [docs, attached] = await Promise.all([
    docIds.length
      ? store.list("documents", { filter: { id: docIds } })
      : Promise.resolve([] as Document[]),
    fileReqIds.length
      ? store.list("documents", { filter: { requirementId: fileReqIds } })
      : Promise.resolve([] as Document[]),
  ]);
  const attachments = new Map<string, Document[]>();
  for (const d of [...attached].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.version - b.version,
  )) {
    if (!d.requirementId) continue;
    attachments.set(d.requirementId, [
      ...(attachments.get(d.requirementId) ?? []),
      d,
    ]);
  }
  return {
    order,
    open: !!stage && (stage.status === "active" || stage.status === "blocked"),
    canAct: isWellmix(user) || isOrderSupplier(user, order),
    products,
    documents: new Map(docs.map((d) => [d.id, d])),
    attachments,
  };
}

export class DieCutPhotoError extends Error {}

/**
 * Die-cut ou foto em alta já feitos em que quem envia pode acrescentar ou
 * tirar fotos (pedido do dono, 14/11/2026): as mesmas regras do envio do
 * item (quem pode preencher, a raia, a etapa aberta). Só esses dois itens.
 */
async function photoTarget(user: User, orderId: string, requirementId: string) {
  const store = getStore();
  const [order, requirement] = await Promise.all([
    store.get("orders", orderId),
    store.get("requirements", requirementId),
  ]);
  if (!order || !requirement || requirement.orderId !== orderId)
    throw new DieCutPhotoError("not_found");
  const base = baseKeyOf(requirement.key);
  if (base !== LANE_KEYS.dieCut && base !== LANE_KEYS.hdPhoto)
    throw new DieCutPhotoError("not_found");
  const { canSubmitRequirement } = await import("@/lib/workflow/engine");
  if (
    !canViewDieCut(user, order) ||
    !canSubmitRequirement(user, order, requirement)
  )
    throw new ForbiddenError();
  if (order.flow === "supplier_request") {
    const { assertLaneActor } = await import("./cert-art-routing");
    await assertLaneActor(user, order, requirement);
  }
  const stage = await store.get("stages", requirement.stageId);
  if (!stage || (stage.status !== "active" && stage.status !== "blocked"))
    throw new DieCutPhotoError("stage_not_active");
  return { order, requirement };
}

/**
 * "+" do die-cut e da foto em alta: cada foto vira um anexo próprio do item
 * (mesmo produto e mesma seção). O item continua feito e o arquivo
 * principal não muda; nada do que já foi enviado é apagado.
 */
export async function addDieCutPhotos(
  user: User,
  orderId: string,
  requirementId: string,
  input: { files: File[]; uploadedIds: string[] },
): Promise<number> {
  const { requirement } = await photoTarget(user, orderId, requirementId);
  if (requirement.status !== "done")
    throw new DieCutPhotoError("die_cut_send_first");
  if (!input.files.length && !input.uploadedIds.length)
    throw new DieCutPhotoError("photo_required");
  const { uploadDocument, registerUploadedPhoto } = await import("./documents");
  const target = {
    orderId,
    requirementId,
    type:
      requirement.type === "photo" ? ("photo" as const) : ("other" as const),
  };
  let added = 0;
  // Só fotos (o "+" abre a câmera ou a galeria).
  if (input.files.some((f) => !(f.type ?? "").startsWith("image/")))
    throw new DieCutPhotoError("mime");
  for (const file of input.files) {
    await uploadDocument(user, file, target);
    added++;
  }
  for (const id of input.uploadedIds) {
    await registerUploadedPhoto(user, id, target);
    added++;
  }
  return added;
}

/**
 * Exclui só a foto escolhida. Sendo o arquivo principal do item e havendo
 * outras, a mais recente vira a principal e o item continua feito; sendo a
 * única, o item volta a pendente, como a exclusão de sempre.
 */
export async function removeDieCutPhoto(
  user: User,
  orderId: string,
  requirementId: string,
  documentId: string,
): Promise<void> {
  const { requirement } = await photoTarget(user, orderId, requirementId);
  const store = getStore();
  const doc = await store.get("documents", documentId);
  if (!doc || doc.requirementId !== requirement.id)
    throw new DieCutPhotoError("not_found");
  if (doc.id === requirement.documentId) {
    const others = (
      await store.list("documents", {
        filter: { requirementId: requirement.id },
      })
    )
      .filter((d) => d.id !== doc.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (!others.length) {
      const { clearRequirementDocument } =
        await import("@/lib/workflow/engine");
      await clearRequirementDocument(user, requirement.id);
      return;
    }
    await store.update("requirements", requirement.id, {
      documentId: others[0].id,
    });
  }
  await store.remove("documents", doc.id);
  await store.removeFile(doc.storageKey).catch((error) => {
    console.error("removeDieCutPhoto: arquivo não apagado", error);
  });
}

/**
 * Confirma (ou corrige) o pedido mínimo e o prazo de entrega de um produto
 * de uma vez. Com o quadro já completo, a mudança de valor avisa a Wellmix
 * com o número de antes.
 */
export async function confirmDieCutTerms(
  user: User,
  orderId: string,
  itemId: string,
  input: { moq: number; leadTimeDays: number },
): Promise<void> {
  const store = getStore();
  const order = await store.get("orders", orderId);
  if (!order || !canViewDieCut(user, order)) throw new Error("not_found");
  const requirements = await store.list("requirements", {
    filter: { orderId },
  });
  const moq = requirements.find(
    (r) => r.key === laneKey(LANE_KEYS.moq, itemId),
  );
  const lead = requirements.find(
    (r) => r.key === laneKey(LANE_KEYS.leadTime, itemId),
  );
  if (!moq || !lead) throw new Error("not_found");
  const product = dieCutProducts(requirements).find((p) => p.itemId === itemId);
  const wasComplete = !!product?.complete;
  const before = { moq: moq.value, days: lead.value };
  const { submitRequirement } = await import("@/lib/workflow/engine");
  await submitRequirement(user, moq.id, { value: String(input.moq) });
  await submitRequirement(user, lead.id, {
    value: String(input.leadTimeDays),
  });
  if (
    wasComplete &&
    (before.moq !== String(input.moq) ||
      before.days !== String(input.leadTimeDays))
  )
    await notifyDieCut(order, itemId, product?.name ?? "", {
      moq: String(input.moq),
      days: String(input.leadTimeDays),
      before: { moq: before.moq ?? "—", days: before.days ?? "—" },
    });
}

async function notifyDieCut(
  order: Order,
  itemId: string,
  product: string,
  values: {
    moq: string;
    days: string;
    before: { moq: string | number; days: string | number } | null;
  },
) {
  const { notifyWellmix } = await import("./notifications");
  await notifyWellmix({
    kind: "action",
    link: dieCutHref(order.id, itemId),
    text: (t) => ({
      subject: `${t("supplierTasks.orderStep", {
        n: order.number,
        step: t(
          values.before
            ? "notif.dieCut.changedSubject"
            : "notif.dieCut.subject",
          { product: product || t("productName.unnamed") },
        ),
      })}`,
      body: [
        t("notif.dieCut.body", { moq: values.moq, days: values.days }),
        values.before
          ? t("notif.dieCut.changed", {
              moq: values.before.moq,
              days: values.before.days,
            })
          : "",
      ]
        .filter(Boolean)
        .join(" "),
    }),
  }).catch((error) => console.error("notify(die_cut)", error));
}

/**
 * Depois de um item do Die Cut ser enviado pela primeira vez: com os quatro
 * feitos, a Wellmix é avisada (com o número de antes, se o pedido mínimo ou
 * o prazo saíram diferentes do negociado).
 */
export async function afterDieCutItem(
  order: Order,
  key: string,
  statusBefore: Requirement["status"] | undefined,
): Promise<void> {
  const itemId = itemIdOf(key);
  if (!itemId || !dieCutItemOf(key) || statusBefore === "done") return;
  const requirements = await getStore().list("requirements", {
    filter: { orderId: order.id },
  });
  const product = dieCutProducts(requirements).find((p) => p.itemId === itemId);
  if (!product?.complete) return;
  const moq = product.items.moq?.value ?? "—";
  const days = product.items.leadTime?.value ?? "—";
  const negotiated = (await negotiatedTerms(order)).get(itemId);
  const changed =
    (negotiated?.moq != null && String(negotiated.moq) !== moq) ||
    (negotiated?.days != null && String(negotiated.days) !== days);
  await notifyDieCut(order, itemId, product.name, {
    moq,
    days,
    before: changed
      ? { moq: negotiated?.moq ?? "—", days: negotiated?.days ?? "—" }
      : null,
  });
}
