import "server-only";

import { can, holdersOf } from "@/lib/auth/function-access";
import { ForbiddenError, isAdmin, isWellmix } from "@/lib/auth/permissions";
import {
  getStore,
  type ImportStep,
  type Order,
  type RealMedia,
  type User,
} from "@/lib/db";
import { SAMPLE_ORDER_KEY } from "@/lib/purchase-lanes";
import {
  parseSampleOrder,
  sampleSplit,
  type SampleLine,
  type SampleSplit,
} from "@/lib/sample-order";
import { isPurchaseFlow } from "@/lib/workflow/stages";
import { audit } from "./audit";
import { notify, notifyWellmix, type NotifyTarget } from "./notifications";
import { loadFunctionDefs } from "./team-functions";

/*
 * Amostras depois da inspeção e fotos reais (mapa R12 a R16 e R5;
 * docs/SAMPLE_FLOW.md). Decisões do dono (14/11/2026):
 *
 * - com o SKU aprovado, a trading retira as amostras do pedido de amostras e
 *   envia, de cada 5, 4 ao show room no Brasil e 1 à agência de marketing na
 *   China (4 × 3 × Nm e 1 × 3 × Nm);
 * - a agência de marketing na China é um parceiro próprio, com login,
 *   designado no pedido; ela fotografa e filma a amostra de cada produto;
 * - o marketing aprova: as fotos reais viram as principais do catálogo, as
 *   de referência saem da vitrine (ficam guardadas) e o produto é liberado
 *   para venda; ou pede para refazer;
 * - "Devolve": a amostra da China volta à trading, que a embarca com o
 *   pedido; o carregamento do container espera essa devolução.
 *
 * Os passos (retirada, envios, recebimento e devolução) usam o mecanismo do
 * embarque (import_steps, grupo "samples"); as fotos são por produto
 * (tabela real_media).
 */

export class SampleFlowError extends Error {}

/** Etapas em que as amostras andam: depois da inspeção (SKU aprovado). */
const SAMPLES_LIVE: readonly Order["status"][] = [
  "SHIPPING",
  "CUSTOMS",
  "TRANSPORT",
  "DELIVERED",
  "CLOSED",
];

/** Linhas do pedido de amostras gerado (nulo: sem amostras ou ainda não decidido). */
export async function orderedSamples(
  orderId: string,
): Promise<SampleLine[] | null> {
  const [req] = await getStore()
    .list("requirements", { filter: { orderId, key: SAMPLE_ORDER_KEY } })
    .catch(() => []);
  const doc = parseSampleOrder(req?.value);
  return doc?.status === "ordered" && doc.lines.length ? doc.lines : null;
}

/** O pedido tem amostras a cuidar (pedido de compra, com amostras pedidas). */
export async function samplesOrdered(order: Order) {
  return isPurchaseFlow(order) && !!(await orderedSamples(order.id));
}

/** Os passos das amostras estão abertos (SKU aprovado, já no Embarque ou depois). */
export async function samplesApply(order: Order) {
  return SAMPLES_LIVE.includes(order.status) && (await samplesOrdered(order));
}

/** Divisão por produto: Brasil, China e total. */
export async function samplesSplitOf(order: Order): Promise<SampleSplit[]> {
  return ((await orderedSamples(order.id)) ?? []).map(sampleSplit);
}

const stepDone = (s: ImportStep | undefined) =>
  !!s && (s.status === "submitted" || s.status === "validated");

async function stepsOf(orderId: string) {
  return getStore()
    .list("import_steps", { filter: { orderId } })
    .catch(() => [] as ImportStep[]);
}

/* ---------------- Fotos e vídeos reais ---------------- */

const isOrderAgency = (user: User, order: Order) =>
  user.role === "marketing_agency" &&
  !!user.partyId &&
  user.partyId === order.marketingAgencyId;

/** Quem envia: a agência do pedido (sem agência designada, a Wellmix). */
export const canSendRealMedia = (user: User, order: Order) =>
  isOrderAgency(user, order) || isWellmix(user);

/** Quem aprova: o marketing (ação "Aprovar fotos reais") ou o administrador. */
export const canApproveRealMedia = (user: User) =>
  isAdmin(user) || (isWellmix(user) && can(user, "realMedia.approve"));

export interface RealMediaLine extends SampleSplit {
  row: RealMedia | null;
  status: "missing" | RealMedia["status"];
}

export interface RealMediaView {
  order: Order;
  /** A agência já recebeu as amostras: dá para fotografar. */
  open: boolean;
  lines: RealMediaLine[];
  canSend: boolean;
  canApprove: boolean;
  /** Todos os produtos aprovados. */
  complete: boolean;
}

async function rowsOf(orderId: string) {
  return getStore()
    .list("real_media", { filter: { orderId } })
    .catch(() => [] as RealMedia[]);
}

export async function realMediaView(
  user: User,
  orderId: string,
): Promise<RealMediaView | null> {
  const order = await getStore().get("orders", orderId);
  if (!order || !(await samplesOrdered(order))) return null;
  if (!isWellmix(user) && !isOrderAgency(user, order)) return null;
  const [split, rows, steps] = await Promise.all([
    samplesSplitOf(order),
    rowsOf(order.id),
    stepsOf(order.id),
  ]);
  const live = order.status !== "CANCELLED" && order.status !== "CLOSED";
  const open =
    live &&
    SAMPLES_LIVE.includes(order.status) &&
    stepDone(steps.find((s) => s.key === "samples_china_received"));
  const lines = split.map((l) => {
    const row = rows.find((r) => r.orderItemId === l.itemId) ?? null;
    return { ...l, row, status: row?.status ?? ("missing" as const) };
  });
  return {
    order,
    open,
    lines,
    canSend: open && canSendRealMedia(user, order),
    canApprove: open && canApproveRealMedia(user),
    complete: lines.length > 0 && lines.every((l) => l.status === "approved"),
  };
}

/** Todos os produtos com as fotos reais aprovadas (a amostra pode voltar à trading). */
export async function realMediaComplete(order: Order) {
  const split = await samplesSplitOf(order);
  if (!split.length) return true;
  const rows = await rowsOf(order.id);
  return split.every(
    (l) => rows.find((r) => r.orderItemId === l.itemId)?.status === "approved",
  );
}

async function approversTarget(): Promise<NotifyTarget> {
  const team = await getStore().list("users", {
    filter: { role: ["admin", "operator"], active: true },
  });
  const holders = holdersOf(
    team,
    "realMedia.approve",
    await loadFunctionDefs(),
  );
  return {
    userIds: (holders.length ? holders : team.filter(isAdmin)).map((u) => u.id),
  };
}

/** A agência envia (ou reenvia) as fotos e vídeos de um produto. */
export async function sendRealMedia(
  user: User,
  orderId: string,
  orderItemId: string,
  documentIds: string[],
) {
  const view = await realMediaView(user, orderId);
  if (!view) throw new ForbiddenError();
  if (!view.canSend) throw new SampleFlowError("real_media_closed");
  const line = view.lines.find((l) => l.itemId === orderItemId);
  if (!line) throw new SampleFlowError("item_not_found");
  if (line.status === "approved")
    throw new SampleFlowError("real_media_closed");
  if (!documentIds.length) throw new SampleFlowError("real_media_empty");
  const store = getStore();
  const docs = await store.list("documents", { filter: { id: documentIds } });
  if (!docs.some((d) => d.mime.startsWith("image/")))
    throw new SampleFlowError("real_media_no_photo");
  const now = new Date().toISOString();
  const data = {
    status: "sent" as const,
    // Reenvio depois de "refazer": os arquivos novos entram junto dos de antes.
    documentIds: [
      ...new Set([
        ...(line.row?.status === "rejected"
          ? []
          : (line.row?.documentIds ?? [])),
        ...documentIds,
      ]),
    ],
    reason: null,
    sentByUserId: user.id,
    sentAt: now,
    decidedByUserId: null,
    decidedAt: null,
  };
  if (line.row) await store.update("real_media", line.row.id, data);
  else
    await store.create("real_media", {
      orderId,
      orderItemId,
      productId: line.productId,
      ...data,
    });
  await audit(
    user,
    "real_media.sent",
    "order",
    orderId,
    `Fotos e vídeos reais de ${line.name}: ${documentIds.length} arquivo(s)`,
  );
  await notify(await approversTarget(), {
    kind: "action",
    link: `/app/orders/${orderId}/real-media`,
    text: (t) => ({
      subject: t("realMedia.notify.sent.subject", {
        n: String(view.order.number),
      }),
      body: t("realMedia.notify.sent.body", { product: line.name }),
    }),
  });
}

/**
 * O marketing decide. Aprovado: as fotos reais entram no cadastro do produto
 * (a primeira vira a principal), as de referência saem da vitrine (a vitrine
 * mostra só as reais quando existem; nada é apagado) e o produto fica ativo
 * para venda.
 */
export async function decideRealMedia(
  user: User,
  orderId: string,
  orderItemId: string,
  decision: "approved" | "rejected",
  reason: string | null,
) {
  const view = await realMediaView(user, orderId);
  if (!view) throw new ForbiddenError();
  if (!view.canApprove) throw new ForbiddenError();
  const line = view.lines.find((l) => l.itemId === orderItemId);
  if (!line?.row || line.row.status !== "sent")
    throw new SampleFlowError("real_media_closed");
  if (decision === "rejected" && !reason?.trim())
    throw new SampleFlowError("reason_required");
  const store = getStore();
  const now = new Date().toISOString();
  await store.update("real_media", line.row.id, {
    status: decision,
    reason: decision === "rejected" ? reason!.trim() : null,
    decidedByUserId: user.id,
    decidedAt: now,
  });
  if (decision === "rejected") {
    await audit(
      user,
      "real_media.rejected",
      "order",
      orderId,
      `Fotos reais de ${line.name}: refazer (${reason})`,
    );
    const target: NotifyTarget = view.order.marketingAgencyId
      ? { role: "marketing_agency", partyId: view.order.marketingAgencyId }
      : await approversTarget();
    await notify(target, {
      kind: "alert",
      actor: "recipient",
      link: `/app/orders/${orderId}/real-media`,
      text: (t) => ({
        subject: t("realMedia.notify.rejected.subject", {
          n: String(view.order.number),
          product: line.name,
        }),
        body: t("realMedia.notify.rejected.body", { reason: reason!.trim() }),
      }),
    });
    return;
  }
  if (line.productId) await publishRealPhotos(user, line.productId, line.row);
  await audit(
    user,
    "real_media.approved",
    "order",
    orderId,
    `Fotos reais de ${line.name} aprovadas: catálogo com fotos reais e produto à venda`,
  );
  await notifyWellmix({
    kind: "done",
    subject: `${line.name} à venda com fotos reais`,
    body: `As fotos reais do pedido #${view.order.number} entraram no catálogo e o produto está liberado para venda (vitrine e oferta ativa).`,
    link: line.productId
      ? `/app/products/${line.productId}`
      : `/app/orders/${orderId}/real-media`,
  });
}

/** Fotos reais no cadastro do produto: principais na vitrine, produto ativo. */
async function publishRealPhotos(
  user: User,
  productId: string,
  row: RealMedia,
) {
  const store = getStore();
  const product = await store.get("products", productId);
  if (!product) return;
  const docs = (
    await store.list("documents", { filter: { id: row.documentIds } })
  ).filter((d) => d.mime.startsWith("image/"));
  if (!docs.length) return;
  const photos = await store.list("product_photos", {
    filter: { productId },
  });
  // A principal passa a ser a primeira foto real; as outras deixam de ser.
  for (const p of photos)
    if (p.isPrimary)
      await store.update("product_photos", p.id, { isPrimary: false });
  const now = new Date().toISOString();
  let first: string | null = null;
  for (const doc of docs) {
    if (photos.some((p) => p.documentId === doc.id && p.kind === "real"))
      continue;
    first ??= doc.id;
    await store.create("product_photos", {
      productId,
      sourcingItemId: null,
      orderId: null,
      documentId: doc.id,
      kind: "real",
      caption: null,
      takenAt: now,
      takenByUserId: row.sentByUserId,
      derivedFromPhotoId: null,
      isPrimary: first === doc.id,
    });
  }
  await store.update("products", productId, {
    active: true,
    ...(first ? { primaryPhotoDocumentId: first } : {}),
  });
  await audit(
    user,
    "product.real_photos",
    "product",
    productId,
    `Fotos reais no catálogo (${docs.length}); as de referência saíram da vitrine e o produto está à venda`,
  );
}

/* ---------------- Pendências ---------------- */

export interface RealMediaTask {
  order: Order;
  kind: "do" | "approve";
  count: number;
}

/** Pendências das fotos reais: a agência (fotografar) e o marketing (aprovar). */
export async function realMediaTasks(user: User): Promise<RealMediaTask[]> {
  const agency = user.role === "marketing_agency" && !!user.partyId;
  const approver = canApproveRealMedia(user);
  if (!agency && !approver) return [];
  const orders = (
    await getStore()
      .list("orders", {
        filter: {
          flow: "supplier_request",
          status: ["SHIPPING", "CUSTOMS", "TRANSPORT", "DELIVERED"],
          ...(agency ? { marketingAgencyId: user.partyId! } : {}),
        },
      })
      .catch(() => [] as Order[])
  ).filter((o) => o.status !== "CANCELLED");
  const out: RealMediaTask[] = [];
  for (const order of orders) {
    const view = await realMediaView(user, order.id);
    if (!view?.open) continue;
    const todo = view.lines.filter(
      (l) => l.status === "missing" || l.status === "rejected",
    ).length;
    const toApprove = view.lines.filter((l) => l.status === "sent").length;
    // Sem agência designada, quem aprova também cuida do envio.
    if (todo && (agency || (approver && !order.marketingAgencyId)))
      out.push({ order, kind: "do", count: todo });
    if (toApprove && approver)
      out.push({ order, kind: "approve", count: toApprove });
  }
  return out;
}
